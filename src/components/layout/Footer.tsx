// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Link } from 'react-router-dom';

const linkClass = 'hover:text-blue-600 dark:hover:text-white transition-colors';

interface FooterLink {
  label: string;
  /** An in-app route, or an absolute URL for a page outside the application. */
  href: string;
}

const RESOURCES: FooterLink[] = [
  { label: 'GitHub', href: 'https://github.com/vhco-pro' },
  { label: 'Blog', href: '/blog' },
  { label: 'Ansible automation', href: '/ansible' },
  { label: 'Documentation', href: '/docs' },
  { label: 'API Reference', href: '/docs/api-reference/explorer' },
  { label: 'Support', href: 'https://github.com/vhco-pro/.github/blob/main/SUPPORT.md' },
  { label: 'Security Policy', href: 'https://github.com/vhco-pro/.github/blob/main/SECURITY.md' },
];

const LEGAL: FooterLink[] = [
  { label: 'License (BSL 1.1)', href: 'https://github.com/vhco-pro/stackweaver-api/blob/main/LICENSE' },
  { label: 'Trademark Policy', href: 'https://github.com/vhco-pro/.github/blob/main/TRADEMARK.md' },
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
];

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-950 dark:text-white mb-4">{title}</h3>
      <ul className="space-y-2 text-sm text-slate-800 dark:text-gray-400">
        {links.map((link) => (
          <li key={link.label}>
            {link.href.startsWith('/') ? (
              <Link to={link.href} className={linkClass}>
                {link.label}
              </Link>
            ) : (
              <a href={link.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                {link.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="py-16 px-6 border-t border-slate-200 dark:border-white/10 bg-gradient-to-t from-slate-100/50 to-transparent dark:from-slate-950/50 dark:to-transparent">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white mb-4">About</h3>
            <p className="text-slate-800 dark:text-gray-400 text-sm">
              Stackweaver is a DevOps automation platform for managing infrastructure and configuration with OpenTofu and Ansible.
            </p>
          </div>
          <FooterColumn title="Resources" links={RESOURCES} />
          <FooterColumn title="Legal" links={LEGAL} />
        </div>

        <div className="border-t border-slate-200 dark:border-white/10 pt-8 mt-8 flex justify-center">
          <p className="text-slate-800 dark:text-gray-400 text-sm text-center">
            © 2025-{new Date().getFullYear()} VH &amp; Co BV. Stackweaver is a trademark of VH &amp; Co.
          </p>
        </div>
      </div>
    </footer>
  );
}
