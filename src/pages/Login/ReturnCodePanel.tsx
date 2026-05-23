// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * Visible inline panel that surfaces a verification code returned by the
 * auth proxy when the backend is running in `return_code` notification mode.
 *
 * Only renders when the caller has a code to show — if `code` is empty the
 * component renders nothing at all. In production (email notification mode)
 * the proxy never emits a code, so this component never appears. That's the
 * safety model: there is no "should I hide this?" flag to forget; no code,
 * no panel.
 *
 * The amber palette intentionally matches the dev-mode warning banners
 * elsewhere in the app so it reads as a non-production affordance rather
 * than a normal part of the login UI.
 *
 * Plan reference: C20. Extracted from previously-inlined copies in
 * PasswordReset.tsx and Otp.tsx.
 */
export interface ReturnCodePanelProps {
  code: string;
  /** Short label describing what this code is for (e.g. "Verification code"). */
  label?: string;
}

export default function ReturnCodePanel({ code, label = 'Verification code' }: ReturnCodePanelProps) {
  if (!code) return null;
  return (
    <div
      className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-center"
      role="status"
      aria-live="polite"
    >
      <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">Dev mode — {label}</p>
      <p className="text-2xl font-mono font-bold tracking-widest select-all">{code}</p>
    </div>
  );
}
