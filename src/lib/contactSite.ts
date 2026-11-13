// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

export const contactEmailHref = 'mailto:contact@vhco.pro';

// nginx substitutes the same deployment decision into initial HTML and the sitemap.
export function contactPageEnabled(): boolean {
  return typeof document !== 'undefined'
    && document.querySelector<HTMLMetaElement>('meta[name="sw-contact-enabled"]')?.content === '1';
}

export function contactHref(): string {
  if (typeof document === 'undefined') return '__SW_CONTACT_HREF__';
  return contactPageEnabled() ? '/contact' : contactEmailHref;
}
