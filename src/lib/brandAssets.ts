// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import logo from '@/assets/logo.webp';
import nav64 from '@/assets/logo-nav-64.webp';
import nav80 from '@/assets/logo-nav-80.webp';
import nav120 from '@/assets/logo-nav-120.webp';

/** Same artwork, sized for the largest default logo at 2x density and cached by content hash. */
export const defaultLogo = logo;

/** Responsive variants of the same artwork for compact navigation logos. */
export const navigationLogo = nav80;
export const navigationLogoSrcSet = `${nav64} 64w, ${nav80} 80w, ${nav120} 120w`;
