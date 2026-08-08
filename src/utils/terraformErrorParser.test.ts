// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, it, expect } from 'vitest';
import { parseTerraformErrors } from './terraformErrorParser';

describe('parseTerraformErrors', () => {
  // Empty / no input
  it('returns empty result for empty string', () => {
    const result = parseTerraformErrors('');
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.hasTrace).toBe(false);
  });

  it('returns empty result for whitespace-only input', () => {
    const result = parseTerraformErrors('   \n  \n  ');
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  // Plain text error parsing
  describe('plain text errors', () => {
    it('parses a simple error message', () => {
      const logs = `
╷
Error: Invalid resource type
╵
`;
      const result = parseTerraformErrors(logs);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Invalid resource type');
    });

    it('parses error with file location', () => {
      const logs = `
╷
Error: Reference to undeclared resource
│
│   on main.tf line 42, in resource "aws_instance" "web":
│   42:   ami = data.aws_ami.missing.id
│
│ A managed resource "aws_ami" "missing" has not been declared.
╵
`;
      const result = parseTerraformErrors(logs);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].file).toBe('main.tf');
      expect(result.errors[0].line).toBe(42);
      expect(result.errors[0].resource).toBe('aws_instance.web');
    });

    it('parses error with "with" resource line', () => {
      const logs = `
╷
Error: creating EC2 Instance
│
│   with aws_instance.web,
│   on main.tf line 10, in resource "aws_instance" "web":
│   10:   ami = "ami-invalid"
│
│ InvalidParameterValue: Invalid AMI
╵
`;
      const result = parseTerraformErrors(logs);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].resource).toBe('aws_instance.web');
    });

    it('parses error with suggestion', () => {
      const logs = `
╷
Error: Unsupported argument
│
│   on main.tf line 5, in resource "aws_instance" "web":
│   5:   hostnames = ["example.com"]
│
│ An argument named "hostnames" is not expected here. Did you mean "hostname"?
╵
`;
      const result = parseTerraformErrors(logs);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].suggestion).toBe('hostname');
    });

    it('parses multiple errors', () => {
      const logs = `
╷
Error: First error
╵
╷
Error: Second error
╵
╷
Error: Third error
╵
`;
      const result = parseTerraformErrors(logs);
      expect(result.errors).toHaveLength(3);
    });

    it('strips ANSI escape codes', () => {
      const logs = `\x1b[31m╷\x1b[0m\n\x1b[31mError: Some ANSI error\x1b[0m\n\x1b[31m╵\x1b[0m`;
      const result = parseTerraformErrors(logs);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).not.toContain('\x1b');
    });
  });

  // Plain text warning parsing
  describe('plain text warnings', () => {
    it('parses a simple warning', () => {
      const logs = `
╷
Warning: Argument is deprecated
│
│ Use "new_argument" instead.
╵
`;
      const result = parseTerraformErrors(logs);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('deprecation');
      expect(result.warnings[0].message).toContain('Argument is deprecated');
    });

    it('parses warning with file location', () => {
      const logs = `
╷
Warning: Value for undeclared variable
│
│   on main.tf line 3, in resource "aws_s3_bucket" "my_bucket":
│
│ This is just a test warning.
╵
`;
      const result = parseTerraformErrors(logs);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].file).toBe('main.tf');
      expect(result.warnings[0].line).toBe(3);
    });

    it('classifies deprecation warnings', () => {
      const logs = `
╷
Warning: Deprecated feature
│
│ This feature has been deprecated.
╵
`;
      const result = parseTerraformErrors(logs);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('deprecation');
    });

    it('classifies non-deprecation warnings', () => {
      const logs = `
╷
Warning: Applied changes may be incomplete
│
│ Some detail about the warning.
╵
`;
      const result = parseTerraformErrors(logs);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('warning');
    });
  });

  // JSON log parsing (fallback when no plain text errors)
  describe('JSON log errors', () => {
    it('parses JSON error logs', () => {
      const logs = `{"@level":"error","@message":"Error: required field is not set","@timestamp":"2024-01-01T00:00:00Z"}`;
      const result = parseTerraformErrors(logs);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
    });

    it('ignores non-error JSON logs', () => {
      const logs = `{"@level":"info","@message":"Initializing provider plugins","@timestamp":"2024-01-01T00:00:00Z"}
{"@level":"debug","@message":"Some debug message","@timestamp":"2024-01-01T00:00:00Z"}`;
      const result = parseTerraformErrors(logs);
      expect(result.errors).toHaveLength(0);
    });

    it('skips vertex/trace/diagnostic messages in JSON logs', () => {
      const logs = `{"@level":"error","@message":"vertex error in graph","@timestamp":"2024-01-01T00:00:00Z"}
{"@level":"error","@message":"trace output here","@timestamp":"2024-01-01T00:00:00Z"}`;
      const result = parseTerraformErrors(logs);
      expect(result.errors).toHaveLength(0);
    });
  });

  // hasTrace detection
  describe('trace detection', () => {
    it('detects trace-level logs', () => {
      const logs = `Some output\n{"@level":"trace","@message":"trace msg"}\nError: Something failed`;
      const result = parseTerraformErrors(logs);
      expect(result.hasTrace).toBe(true);
    });

    it('detects debug-level logs', () => {
      const logs = `Some output\n{"@level":"debug","@message":"debug msg"}\nError: Something failed`;
      const result = parseTerraformErrors(logs);
      expect(result.hasTrace).toBe(true);
    });

    it('detects large output as trace', () => {
      const lines = Array.from({ length: 110 }, (_, i) => `line ${i}`);
      const logs = lines.join('\n') + '\nError: Something failed';
      const result = parseTerraformErrors(logs);
      expect(result.hasTrace).toBe(true);
    });
  });

  // Mixed plain text + JSON
  describe('mixed formats', () => {
    it('prioritizes plain text errors over JSON errors', () => {
      const logs = `
╷
Error: Plain text error
╵
{"@level":"error","@message":"Error: required field is missing","@timestamp":"2024-01-01T00:00:00Z"}
`;
      const result = parseTerraformErrors(logs);
      // Plain text errors take priority - JSON errors skipped when plain text found
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Plain text error');
    });
  });

  // fullTrace preservation
  it('preserves full log text in fullTrace', () => {
    const logs = 'Error: test\nSome other content';
    const result = parseTerraformErrors(logs);
    expect(result.fullTrace).toBe(logs);
  });
});
