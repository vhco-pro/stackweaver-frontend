// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * A `.env` parser for the variable import flow.
 *
 * It follows the de-facto dotenv grammar (motdotla/dotenv, docker --env-file,
 * direnv): `KEY=value` lines, an optional `export ` prefix, `#` comments,
 * single/double/backtick quoting, and quoted values that span multiple lines.
 * Escape sequences are only expanded inside double quotes, matching dotenv.
 *
 * Values are never interpolated - `${OTHER}` is kept verbatim, because the
 * variables end up in StackWeaver rather than in a shell that could expand them.
 *
 * Lines that cannot be parsed are reported in `issues` instead of throwing, so
 * the import preview can show what was skipped and why.
 */

/** A single parsed `KEY=value` pair. */
export interface DotenvEntry {
  key: string;
  value: string;
  /** 1-based line number the entry starts on. */
  line: number;
}

/** A line that could not be turned into an entry. */
export interface DotenvIssue {
  /** 1-based line number. */
  line: number;
  /** Human-readable reason, shown in the import preview. */
  detail: string;
}

export interface DotenvParseResult {
  /** Parsed entries in first-appearance order; for repeated keys the last value wins. */
  entries: DotenvEntry[];
  /** Lines that were skipped, with the reason. */
  issues: DotenvIssue[];
  /** Keys that appeared more than once in the file. */
  duplicateKeys: string[];
}

/**
 * Accepted key shape. Stricter than "anything before the =" so typos and stray
 * prose lines surface as issues, looser than POSIX env names so Terraform-style
 * keys (`db.password`, `my-var`) still import.
 */
const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

/** Whether a key is shaped like something we can send to the variables API. */
export function isValidVariableKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

/** Keys whose values are almost certainly secrets, used to pre-tick "sensitive". */
const SENSITIVE_KEY_PATTERN =
  /(PASS|PWD|SECRET|TOKEN|CREDENTIAL|PRIVATE|APIKEY|API_KEY|ACCESS_KEY|KEY_ID|_KEY$|^KEY$|KEYFILE|SALT|CIPHER|SIGNATURE|SIGNING|CERT|AUTH|SESSION|DSN|CONNECTION_STRING|DATABASE_URL)/i;

/**
 * Whether a key looks like it holds a secret. Deliberately broad: a false
 * positive only means a value is stored encrypted and masked in the UI, while a
 * false negative would leave a real secret readable in plain text.
 */
export function looksSensitive(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key);
}

/** Expand the escape sequences dotenv recognises inside double-quoted values. */
function unescapeDoubleQuoted(raw: string): string {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    if (char !== '\\' || i === raw.length - 1) {
      out += char;
      continue;
    }
    const next = raw[++i];
    switch (next) {
      case 'n': out += '\n'; break;
      case 'r': out += '\r'; break;
      case 't': out += '\t'; break;
      case 'f': out += '\f'; break;
      case 'b': out += '\b'; break;
      case '"': out += '"'; break;
      case "'": out += "'"; break;
      case '`': out += '`'; break;
      case '\\': out += '\\'; break;
      // Anything else keeps the backslash: `\d` in a regex value stays `\d`.
      default: out += '\\' + next; break;
    }
  }
  return out;
}

/**
 * Strip an unquoted value's trailing comment. Only a `#` at the start or
 * preceded by whitespace starts a comment, so `pass#word` stays intact.
 */
function stripInlineComment(raw: string): string {
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '#' && (i === 0 || /\s/.test(raw[i - 1]))) {
      return raw.slice(0, i);
    }
  }
  return raw;
}

export function parseDotenv(input: string): DotenvParseResult {
  // Strip a UTF-8 BOM and normalise line endings so CRLF files behave.
  const text = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');

  const byKey = new Map<string, DotenvEntry>();
  const seenCounts = new Map<string, number>();
  const issues: DotenvIssue[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const withoutExport = trimmed.replace(/^export\s+/, '');
    const separator = withoutExport.indexOf('=');
    if (separator === -1) {
      issues.push({ line: lineNumber, detail: 'not a KEY=value assignment' });
      continue;
    }

    const key = withoutExport.slice(0, separator).trim();
    if (key === '') {
      issues.push({ line: lineNumber, detail: 'missing key before "="' });
      continue;
    }
    if (!isValidVariableKey(key)) {
      issues.push({ line: lineNumber, detail: `"${key}" is not a valid variable key` });
      continue;
    }

    const rest = withoutExport.slice(separator + 1).replace(/^[ \t]+/, '');
    const quote = rest[0];
    let value: string;

    if (quote === '"' || quote === "'" || quote === '`') {
      // Scan for the closing quote, consuming further lines when the value is
      // multiline (PEM keys, JSON blobs). Only double quotes honour `\"`.
      let body = rest.slice(1);
      let closed = false;
      let cursor = i;
      for (;;) {
        let j = 0;
        while (j < body.length) {
          if (quote === '"' && body[j] === '\\') {
            j += 2;
            continue;
          }
          if (body[j] === quote) {
            closed = true;
            break;
          }
          j++;
        }
        if (closed) {
          body = body.slice(0, j);
          break;
        }
        cursor++;
        if (cursor >= lines.length) break;
        body += '\n' + lines[cursor];
      }

      if (!closed) {
        issues.push({ line: lineNumber, detail: 'unterminated quoted value' });
        // Do not swallow the rest of the file on a stray quote: keep scanning
        // from the next line rather than from where the scan gave up.
        continue;
      }

      value = quote === '"' ? unescapeDoubleQuoted(body) : body;
      i = cursor;
    } else {
      value = stripInlineComment(rest).trimEnd();
    }

    seenCounts.set(key, (seenCounts.get(key) ?? 0) + 1);
    const existing = byKey.get(key);
    if (existing) {
      // Last assignment wins (what a shell sourcing the file would end up with)
      // but the row keeps its original position in the preview.
      existing.value = value;
    } else {
      byKey.set(key, { key, value, line: lineNumber });
    }
  }

  const duplicateKeys = [...seenCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key);

  return { entries: [...byKey.values()], issues, duplicateKeys };
}
