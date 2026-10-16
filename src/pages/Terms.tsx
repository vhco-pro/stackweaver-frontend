// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { glassSurface } from '@/lib/surfaces';
import { cn } from '@/lib/utils';
import { ArrowLeft, Scale } from 'lucide-react';

// The date the terms last changed. Written down, not computed: terms that show today's date
// on every visit claim a revision that never happened.
const LAST_UPDATED = 'October 12, 2026';

const inlineLink = 'text-blue-600 dark:text-blue-400 underline underline-offset-4 hover:text-blue-700 dark:hover:text-blue-300';

function External({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={inlineLink}>
      {children}
    </a>
  );
}

const List = ({ items }: { items: ReactNode[] }) => (
  <ul className="list-disc space-y-1.5 pl-6">
    {items.map((item, i) => (
      <li key={i}>{item}</li>
    ))}
  </ul>
);

interface Clause {
  title: string;
  body: ReactNode;
}

const CLAUSES: Clause[] = [
  {
    title: 'Who we are',
    body: (
      <>
      <p>
        Stackweaver is made by VH &amp; Co BV, a company incorporated under Belgian law, with its registered office at
        Torenhoflaan 5, 3110 Rotselaar, Belgium, registered with the Crossroads Bank for Enterprises under number
        1031.077.138 (VAT BE 1031.077.138). In these terms "we" and "us" mean VH &amp; Co BV. You can reach us at
        contact@vhco.pro.
      </p>
      </>
    ),
  },
  {
    title: 'What these terms cover',
    body: (
      <>
      <p>These terms apply when you use:</p>
      <List
        items={[
          'the website stackweaver.sh and its documentation;',
          'the software, container images, Helm charts and other files we publish for download; and',
          'any instance of Stackweaver that we operate ourselves and let you sign in to (a "hosted instance"). We do not offer a hosted instance yet. The parts of these terms about hosted instances apply from the day we do.',
        ]}
      />
      <p>
        By using any of these you agree to these terms. If you use them on behalf of an organisation, you confirm that
        you may accept these terms for it. If you do not agree, please do not use them.
      </p>
      <p>
        An instance of Stackweaver that you or your organisation run on your own infrastructure is not operated by us.
        Whoever operates it decides who may use it and on what terms.
      </p>
      </>
    ),
  },
  {
    title: 'The software and its license',
    body: (
      <>
      <p>
        Stackweaver is source-available software. Your right to copy, modify, run and redistribute it comes from the
        license published with it, the Business Source License 1.1 with the parameters set out in the{' '}
        <code className="font-mono text-sm">LICENSE</code> file in our repositories, and not from these terms. If these
        terms and that license say different things about the software, the license decides.
      </p>
      <p>
        As a summary only: the license lets you copy, modify and use the software, and run it in production, as long as
        you do not offer it to third parties on a hosted or embedded basis as a managed Stackweaver service or a
        substantially similar service. Offering such a service needs a commercial license from us. On the date set by
        the license, each version becomes available under the Apache License, Version 2.0.
      </p>
      <p>
        Some components and related projects are published under other licenses, stated in their own repositories. At
        the time of writing the runner images, the Helm chart and the registry are published under the Apache License,
        Version 2.0. Those licenses apply to them.
      </p>
      <p>
        Stackweaver works with third-party software such as OpenTofu and Ansible, which have their own licenses. We do
        not distribute or run Terraform. Terraform is a trade mark of its owner, and we are not affiliated with or
        endorsed by it.
      </p>
      </>
    ),
  },
  {
    title: 'Our name and logo',
    body: (
      <>
      <p>
        "Stackweaver" and the Stackweaver logo are registered EU trade marks of VH &amp; Co BV. The software license
        does not give you a right to use them. Our{' '}
        <External href="https://github.com/vhco-pro/.github/blob/main/TRADEMARK.md">Trademark Policy</External> sets out
        how you may and may not use them.
      </p>
      </>
    ),
  },
  {
    title: 'Accounts on a hosted instance',
    body: (
      <>
      <p>
        To use a hosted instance you need an account. Give accurate information, keep your credentials and API tokens
        secret, and tell us promptly at contact@vhco.pro if you think someone else has used your account. You are
        responsible for what is done through your account and with tokens you create.
      </p>
      <p>
        You may close your account at any time. We may suspend or close an account that breaks these terms or puts the
        service or other people at risk. Where we reasonably can, we will warn you first and give you the chance to
        export your data.
      </p>
      </>
    ),
  },
  {
    title: 'Your configurations and data',
    body: (
      <>
      <p>
        What you put into a hosted instance stays yours: your configurations, state, variables, playbooks, inventories
        and logs. You give us only the permission we need to store and process it in order to run the service for you.
        You are responsible for having the right to use that material, and for the infrastructure changes your runs and
        jobs make.
      </p>
      <p>
        Keep your own backups of anything you cannot afford to lose, in particular state files and secrets. A hosted
        instance is not a backup service.
      </p>
      </>
    ),
  },
  {
    title: 'Acceptable use',
    body: (
      <>
      <p>When you use the website or a hosted instance, do not:</p>
      <List
        items={[
          "break the law or infringe someone else's rights;",
          'try to gain access to systems, accounts or data that are not yours;',
          'interfere with the service, overload it on purpose, or work around its limits;',
          'use it to distribute malware, to mine cryptocurrency, or to attack other systems; or',
          <>
            test its security without our agreement. If you find a vulnerability, please follow our{' '}
            <External href="https://github.com/vhco-pro/.github/blob/main/SECURITY.md">Security Policy</External>.
          </>,
        ]}
      />
      </>
    ),
  },
  {
    title: 'Feedback and contributions',
    body: (
      <>
      <p>
        If you send us suggestions, we may use them without owing you anything. Code and documentation you contribute
        to our repositories are covered by the terms stated in those repositories.
      </p>
      </>
    ),
  },
  {
    title: 'Availability and changes',
    body: (
      <>
      <p>
        We work to keep the website and any hosted instance available, but we do not promise that they will always be
        available or free of errors. We may change, suspend or stop any part of them. For a hosted instance, we will
        give reasonable notice of a change that removes something you rely on, unless we have to act immediately for
        security or legal reasons.
      </p>
      </>
    ),
  },
  {
    title: 'No warranty',
    body: (
      <>
      <p>
        The website, the documentation and the downloads are provided as they are. To the extent the law allows, we
        give no warranty that they are fit for a particular purpose, complete or free of errors. The software changes
        your infrastructure when you tell it to: review a plan before you apply it, and test in an environment where a
        mistake is cheap.
      </p>
      </>
    ),
  },
  {
    title: 'Our liability',
    body: (
      <>
      <p>
        To the extent the law allows, we are not liable for indirect or consequential loss, including loss of profit,
        loss of data, or the cost of downtime of your infrastructure. Our total liability to you in connection with
        these terms is limited to the amount you paid us in the twelve months before the event that gave rise to the
        claim, or to one hundred euros if you paid nothing.
      </p>
      <p>
        Nothing in these terms limits our liability for fraud, for our wilful misconduct or gross negligence, for death
        or personal injury, or in any other case where the law does not allow liability to be limited.
      </p>
      <p>
        If you are a consumer, these terms do not take away any right that the law of the country where you live gives
        you and that cannot be set aside by agreement.
      </p>
      </>
    ),
  },
  {
    title: 'Privacy',
    body: (
      <>
      <p>
        Our{' '}
        <Link to="/privacy" className={inlineLink}>
          Privacy Policy
        </Link>{' '}
        explains what personal data we process and what your rights are. It forms part of how we provide the website
        and any hosted instance.
      </p>
      </>
    ),
  },
  {
    title: 'Changes to these terms',
    body: (
      <>
      <p>
        We may update these terms. The date at the top shows when they last changed. If a change materially affects
        people who have an account on a hosted instance, we will tell them by email or in the product before it takes
        effect. If you keep using the website or a hosted instance after a change takes effect, you accept the updated
        terms.
      </p>
      </>
    ),
  },
  {
    title: 'Governing law and courts',
    body: (
      <>
      <p>Belgian law governs these terms. Any dispute about them goes to the courts of Leuven, Belgium.</p>
      <p>
        If you are a consumer living in the European Union, you keep the protection of the mandatory rules of the
        country where you live, and you may also bring a claim before the courts of that country.
      </p>
      </>
    ),
  },
  {
    title: 'General',
    body: (
      <>
      <p>
        If a court finds part of these terms invalid, the rest still applies. If we do not enforce a right straight
        away, we have not given it up. These terms are written in English; if we publish a translation and the two
        differ, the English text decides, except where the law requires otherwise.
      </p>
      </>
    ),
  },
  {
    title: 'Contact',
    body: <p>Questions about these terms: contact@vhco.pro.</p>,
  },
];

export default function Terms() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 text-slate-900 dark:from-slate-950 dark:via-blue-950 dark:to-slate-950 dark:text-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="mb-12">
          <Link to="/" className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          <div className="flex items-center gap-4 mb-4">
            <div className="h-16 w-16 shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Scale className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 via-cyan-600 to-sky-600 dark:from-blue-300 dark:via-cyan-300 dark:to-sky-300 bg-clip-text text-transparent">
                Terms of Service
              </h1>
              <p className="text-slate-600 dark:text-gray-400 mt-2">Last updated: {LAST_UPDATED}</p>
            </div>
          </div>
        </div>

        <article className={cn(glassSurface, 'p-6 md:p-10 divide-y divide-slate-200 dark:divide-white/10')}>
          {CLAUSES.map((clause, index) => (
            <section key={clause.title} data-clause={index + 1} className="py-7 first:pt-0 last:pb-0">
              <h2 className="text-xl md:text-2xl font-bold mb-4 flex items-baseline gap-3">
                <span className="font-mono text-base text-blue-600 dark:text-blue-400 tabular-nums">{index + 1}</span>
                {clause.title}
              </h2>
              <div className="space-y-4 text-slate-700 dark:text-gray-300 leading-relaxed">{clause.body}</div>
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
