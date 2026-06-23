// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, it, expect } from 'vitest';
import { parseLogChunk } from './client';

// Helpers for building raw byte buffers the way the server frames run logs:
// STX (0x02) start-of-text, ETX (0x03) end-of-text, UTF-8 body in between.
const STX = 0x02;
const ETX = 0x03;
const enc = (s: string) => new TextEncoder().encode(s);
const concat = (...parts: Uint8Array[]) => {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
};

describe('parseLogChunk', () => {
  it('strips the STX start marker but counts it toward the byte offset', () => {
    const buf = concat(new Uint8Array([STX]), enc('hello\n'));
    const chunk = parseLogChunk(buf);
    expect(chunk.text).toBe('hello\n');
    // 1 (STX) + 6 ("hello\n") — the marker is a real byte the next offset must skip.
    expect(chunk.bytes).toBe(7);
    expect(chunk.done).toBe(false);
  });

  it('flags done and strips ETX when the end-of-text marker terminates the buffer', () => {
    const buf = concat(enc('done\n'), new Uint8Array([ETX]));
    const chunk = parseLogChunk(buf);
    expect(chunk.text).toBe('done\n');
    expect(chunk.bytes).toBe(6);
    expect(chunk.done).toBe(true);
  });

  it('handles a complete single-fetch stream framed by both STX and ETX', () => {
    const buf = concat(new Uint8Array([STX]), enc('plan output\n'), new Uint8Array([ETX]));
    const chunk = parseLogChunk(buf);
    expect(chunk.text).toBe('plan output\n');
    expect(chunk.bytes).toBe(14); // 1 + 12 + 1
    expect(chunk.done).toBe(true);
  });

  it('counts multi-byte UTF-8 by bytes, not by JS string length', () => {
    // Terraform output is full of box-drawing chars (╷ ╵ │ ─), each 3 bytes in UTF-8.
    const body = '╷\n│ Error\n╵\n';
    const buf = enc(body);
    const chunk = parseLogChunk(buf);
    expect(chunk.text).toBe(body);
    // bytes must be the UTF-8 length, which is larger than the JS UTF-16 string length —
    // using string length here would drift the offset and corrupt the next slice.
    expect(chunk.bytes).toBe(buf.length);
    expect(chunk.bytes).toBeGreaterThan(body.length);
  });

  it('returns an empty, not-done chunk for the no-new-bytes poll', () => {
    const chunk = parseLogChunk(new Uint8Array([]));
    expect(chunk.text).toBe('');
    expect(chunk.bytes).toBe(0);
    expect(chunk.done).toBe(false);
  });

  it('reassembles byte-identically when a framed log is split across incremental chunks', () => {
    // Full stream: STX + "line1\nline2\nline3\n" + ETX
    const body = 'line1\nline2\nline3\n';
    const full = concat(new Uint8Array([STX]), enc(body), new Uint8Array([ETX]));

    // Poll 1 reads a prefix, poll 2 reads the remainder by byte offset.
    const split = 8;
    const c1 = parseLogChunk(full.slice(0, split));
    const c2 = parseLogChunk(full.slice(c1.bytes));

    expect(c1.bytes).toBe(split);
    expect(c1.done).toBe(false);
    expect(c2.done).toBe(true);
    // The displayed text reassembled from chunks equals the marker-stripped body.
    expect(c1.text + c2.text).toBe(body);
  });
});
