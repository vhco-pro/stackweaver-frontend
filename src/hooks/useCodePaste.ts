// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useCallback } from 'react';
import { config } from '@/config';
import { handleCodePasteEvent } from './codePaste';

/**
 * Hook for wiring OTP / verification code inputs to an auto-submit behaviour
 * on paste. Returns an onPaste handler suitable for `<Input onPaste={...}>`.
 *
 * The handler fires `onSubmit(value)` when:
 *   1. `config.autoSubmitCode` is true (VITE_STACKWEAVER_AUTO_SUBMIT_CODE=true),
 *   2. the pasted text, after trimming and stripping whitespace, has exactly
 *      `expectedLength` digits,
 *   3. the pasted text is all digits (guards against pastes that happen to
 *      include a newline-terminated secret with other characters).
 *
 * Homelab UX only — pairs with STACKWEAVER_NOTIFICATION_MODE=return_code
 * where the dev can copy the OTP straight out of the UI. Production deploys
 * with email-mode delivery should leave the flag off so users retain the
 * chance to correct a mistyped paste before submitting.
 */
export function useCodePaste(
  onSubmit: (value: string) => void,
  expectedLength = 6,
) {
  return useCallback(
    (event: React.ClipboardEvent<HTMLInputElement>) => {
      handleCodePasteEvent(event, onSubmit, expectedLength, config.autoSubmitCode);
    },
    [onSubmit, expectedLength],
  );
}
