// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/**
 * The app's canonical card surface, theme-paired (issue #680).
 *
 * Dark mode reproduces the legacy glass recipe byte-for-byte
 * (`bg-gradient-to-br from-white/10 via-white/5 to-transparent dark:from-black/10
 * dark:via-black/5 backdrop-blur-md border-white/20 dark:border-white/10 shadow-lg`
 * resolved under `.dark`) — dark rendering must never change. Light mode gets a real
 * surface: frosted white over the body gradient, a visible hairline border, soft lift.
 *
 * Padding is intentionally not included — call sites keep their own `p-*`.
 */
// NOTE: the light surface is expressed as gradient *stops* on the same
// bg-gradient-to-br utility (not bg-white + dark:bg-transparent): tailwind-merge
// in cn() resolves a dark:bg-transparent/dark:bg-gradient-to-br pair down to one
// class, which leaks the light background-color into dark mode.
export const glassSurface = [
  'rounded-2xl bg-gradient-to-br from-white/90 via-white/75 to-white/60',
  'border border-gray-300/80 shadow-[0_1px_2px_rgb(15_23_42/0.06),0_8px_24px_-8px_rgb(15_23_42/0.14)] backdrop-blur-md',
  'dark:from-black/10 dark:via-black/5 dark:to-transparent dark:border-white/10 dark:shadow-lg',
].join(' ');

/** Dashed empty-state shell paired with {@link glassSurface}. Dark keeps the legacy `border-white/10`. */
export const glassDashedEmpty = 'rounded-2xl border border-dashed border-gray-400/60 dark:border-white/10';

/** Row/section divider inside a {@link glassSurface}. Dark keeps the legacy `border-white/5`. */
export const glassDivider = 'border-gray-200 dark:border-white/5';
