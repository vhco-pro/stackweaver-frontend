// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Link } from 'react-router-dom';
import { Database, Scale, ShieldCheck, type LucideIcon } from 'lucide-react';

interface TrustCard {
  icon: LucideIcon;
  title: string;
  text: string;
  link: string;
  /** An in-app route, or an absolute URL for a page outside the application. */
  href: string;
}

// The license sentence follows licenses/BSL-1.1.LICENSE, the file the public repositories
// publish: production use unless offered as a managed service, and the change to Apache 2.0
// on the Change Date or four years after a version's release, whichever comes first.
const CARDS: TrustCard[] = [
  {
    icon: Scale,
    title: 'Source you can read',
    text: 'Business Source License 1.1. Run it in production for free, as long as you do not offer it to others as a managed service. Each version becomes Apache 2.0 within four years of its release.',
    link: 'Read the license',
    href: 'https://github.com/vhco-pro/stackweaver-api/blob/main/LICENSE',
  },
  {
    icon: ShieldCheck,
    title: 'Releases you can verify',
    text: 'Container images are signed with Sigstore keyless signing and ship with SLSA build provenance and SBOM attestations.',
    link: 'Verify a release',
    href: '/docs/security/verifying-releases',
  },
  {
    icon: Database,
    title: 'Data that stays put',
    text: 'State, secrets and logs live in your database and your bucket. Runners work inside your network and reach your clouds with short-lived credentials.',
    link: 'Security overview',
    href: '/docs/security',
  },
];

const linkClass = 'mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 dark:text-blue-300 hover:underline underline-offset-4';

export function LicenseSecurity() {
  return (
    <section id="trust" className="py-12 md:py-24 px-4 md:px-6 relative scroll-mt-28">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-4 pb-1 bg-gradient-to-r from-blue-500 via-blue-600 to-purple-500 dark:from-white dark:to-blue-200 bg-clip-text text-transparent">
          License &amp; Security
        </h2>
        <p className="text-center text-slate-800 dark:text-gray-400 mb-8 md:mb-16 max-w-2xl mx-auto">Yours to run, and yours to check.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CARDS.map((card) => (
            <div
              key={card.title}
              className="h-full flex flex-col rounded-xl bg-white/50 dark:bg-transparent backdrop-blur-md border border-gray-300/80 dark:border-white/10 p-6 hover:bg-white/60 hover:border-gray-300 dark:hover:border-white/20 transition-colors shadow-xs dark:shadow-none"
            >
              <div className="w-12 h-12 mb-4 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 dark:from-blue-500/20 dark:to-indigo-500/20 flex items-center justify-center shrink-0">
                <card.icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-slate-950 dark:text-white">{card.title}</h3>
              <p className="text-slate-800 dark:text-gray-400 text-sm leading-relaxed mb-5">{card.text}</p>
              {card.href.startsWith('/') ? (
                <Link to={card.href} className={linkClass}>
                  {card.link}
                </Link>
              ) : (
                <a href={card.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  {card.link}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
