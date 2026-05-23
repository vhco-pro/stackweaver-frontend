// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, it, expect, vi } from 'vitest';
import { handleCodePasteEvent } from './codePaste';

// The useCallback wrapper in useCodePaste is pass-through, so the behaviour
// under test lives entirely in handleCodePasteEvent. Testing the pure function
// directly avoids needing a React/DOM test environment.

function makeClipboardEvent(text: string) {
  return {
    clipboardData: {
      getData: () => text,
    },
    preventDefault: vi.fn(),
  } as unknown as React.ClipboardEvent<HTMLInputElement>;
}

async function flushMicrotasks() {
  await Promise.resolve();
}

describe('handleCodePasteEvent', () => {
  it('does nothing when the flag is off', async () => {
    const onSubmit = vi.fn();
    const consumed = handleCodePasteEvent(makeClipboardEvent('123456'), onSubmit, 6, false);
    await flushMicrotasks();
    expect(consumed).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a valid 6-digit paste when flag is on', async () => {
    const onSubmit = vi.fn();
    const consumed = handleCodePasteEvent(makeClipboardEvent('123456'), onSubmit, 6, true);
    await flushMicrotasks();
    expect(consumed).toBe(true);
    expect(onSubmit).toHaveBeenCalledWith('123456');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('trims whitespace and internal spaces before validating', async () => {
    const onSubmit = vi.fn();
    handleCodePasteEvent(makeClipboardEvent('  123 456 \n'), onSubmit, 6, true);
    await flushMicrotasks();
    expect(onSubmit).toHaveBeenCalledWith('123456');
  });

  it('ignores pastes with non-digit characters', async () => {
    const onSubmit = vi.fn();
    const consumed = handleCodePasteEvent(makeClipboardEvent('12a456'), onSubmit, 6, true);
    await flushMicrotasks();
    expect(consumed).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('ignores pastes that do not match expectedLength', async () => {
    const onSubmit = vi.fn();
    handleCodePasteEvent(makeClipboardEvent('12345'), onSubmit, 6, true);
    handleCodePasteEvent(makeClipboardEvent('1234567'), onSubmit, 6, true);
    await flushMicrotasks();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('supports a non-default expectedLength', async () => {
    const onSubmit = vi.fn();
    handleCodePasteEvent(makeClipboardEvent('12345678'), onSubmit, 8, true);
    await flushMicrotasks();
    expect(onSubmit).toHaveBeenCalledWith('12345678');
  });

  it('does not call preventDefault so the paste still lands in the input', async () => {
    const onSubmit = vi.fn();
    const preventDefault = vi.fn();
    const evt = {
      clipboardData: { getData: () => '123456' },
      preventDefault,
    } as unknown as React.ClipboardEvent<HTMLInputElement>;
    handleCodePasteEvent(evt, onSubmit, 6, true);
    await flushMicrotasks();
    expect(preventDefault).not.toHaveBeenCalled();
  });
});
