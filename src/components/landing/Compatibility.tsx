// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

const K = ({ children }: { children: ReactNode }) => <span className="text-sky-300">{children}</span>;
const S = ({ children }: { children: ReactNode }) => <span className="text-green-300">{children}</span>;
const C = ({ children }: { children: ReactNode }) => <span className="text-slate-500">{children}</span>;
const Mono = ({ children }: { children: ReactNode }) => <code className="font-mono text-slate-950 dark:text-white">{children}</code>;

interface ConnectTab {
  id: string;
  /** What the copy button puts on the clipboard. */
  plain: string;
  code: ReactNode;
}

// Four ways an existing setup points at Stackweaver. The wire-contract names (the `cloud` block,
// `tfe_workspace`, TFE_HOSTNAME, TFE_TOKEN) are the reader's own and stay as they are.
const TABS: ConnectTab[] = [
  {
    id: 'cloud',
    plain: `terraform {
  cloud {
    # only this line changes
    hostname     = "stackweaver.example.com"
    organization = "platform"

    workspaces {
      name = "prod-network"
    }
  }
}`,
    code: (
      <>
        <K>terraform</K> {'{'}
        {'\n  '}
        <K>cloud</K> {'{'}
        {'\n    '}
        <C># only this line changes</C>
        {'\n    hostname     = '}
        <S>"stackweaver.example.com"</S>
        {'\n    organization = '}
        <S>"platform"</S>
        {'\n\n    '}
        <K>workspaces</K> {'{'}
        {'\n      name = '}
        <S>"prod-network"</S>
        {'\n    }\n  }\n}'}
      </>
    ),
  },
  {
    id: 'provider',
    plain: `# the provider reads both from the environment
export TFE_HOSTNAME=stackweaver.example.com
export TFE_TOKEN=<your Stackweaver API token>

provider "tfe" {}

resource "tfe_workspace" "network" {
  name         = "prod-network"
  organization = "platform"
}`,
    code: (
      <>
        <C># the provider reads both from the environment</C>
        {'\nexport TFE_HOSTNAME='}
        <S>stackweaver.example.com</S>
        {'\nexport TFE_TOKEN='}
        <S>{'<your Stackweaver API token>'}</S>
        {'\n\n'}
        <K>provider</K> <S>"tfe"</S> {'{}'}
        {'\n\n'}
        <K>resource</K> <S>"tfe_workspace"</S> <S>"network"</S> {'{'}
        {'\n  name         = '}
        <S>"prod-network"</S>
        {'\n  organization = '}
        <S>"platform"</S>
        {'\n}'}
      </>
    ),
  },
  {
    id: 'discovery',
    plain: `# the service discovery document the terraform and tofu CLIs read
curl https://stackweaver.example.com/.well-known/terraform.json`,
    code: (
      <>
        <C># the service discovery document the terraform and tofu CLIs read</C>
        {'\ncurl https://stackweaver.example.com/.well-known/terraform.json'}
      </>
    ),
  },
  {
    id: 'login',
    plain: `# sign in from the CLI you already use
terraform login stackweaver.example.com

# or
tofu login stackweaver.example.com`,
    code: (
      <>
        <C># sign in from the CLI you already use</C>
        {'\nterraform login '}
        <S>stackweaver.example.com</S>
        {'\n\n'}
        <C># or</C>
        {'\ntofu login '}
        <S>stackweaver.example.com</S>
      </>
    ),
  },
];

const ROWS: { kind: 'Stays' | 'Changes'; text: ReactNode }[] = [
  {
    kind: 'Stays',
    text: (
      <>
        Your modules, your state, your HCL and the CLI you already use, <Mono>terraform</Mono> or <Mono>tofu</Mono>.
      </>
    ),
  },
  {
    kind: 'Stays',
    text: (
      <>
        The <Mono>hashicorp/tfe</Mono> provider, through <Mono>TFE_HOSTNAME</Mono> and <Mono>TFE_TOKEN</Mono>.
      </>
    ),
  },
  { kind: 'Changes', text: 'The host you talk to, and the token you talk to it with.' },
  {
    kind: 'Changes',
    text: 'Runs execute on OpenTofu. Your own terraform CLI connects as before; Stackweaver itself does not ship or run the Terraform binary.',
  },
];

const pill = {
  Stays: 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400',
  Changes: 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300',
};

export function Compatibility() {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(TABS[active].plain);
    setCopied(true);
    setTimeout(() => { setCopied(false); }, 2000);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (active + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length;
    setActive(next);
    document.getElementById(`compat-tab-${TABS[next].id}`)?.focus();
  };

  return (
    <section id="compat" className="py-12 md:py-24 px-4 md:px-6 relative scroll-mt-28">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <div className="min-w-0">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-5 pb-1 bg-gradient-to-r from-blue-500 via-blue-600 to-purple-500 dark:from-white dark:to-blue-200 bg-clip-text text-transparent">
            Keep your workflow. Change the hostname.
          </h2>
          <p className="text-slate-800 dark:text-gray-400 text-lg leading-relaxed mb-6">
            Stackweaver speaks the Terraform Enterprise API and runs your configurations with OpenTofu. Moving a workspace over from Terraform Cloud or Enterprise is mostly repointing, not rewriting.
          </p>
          <ul className="space-y-3 text-sm">
            {ROWS.map((row, i) => (
              <li key={i} className="flex gap-4">
                <span className={cn('w-20 shrink-0 inline-flex justify-center px-2 py-1 rounded-full border text-xs font-medium h-fit', pill[row.kind])}>
                  {row.kind}
                </span>
                <span className="text-slate-800 dark:text-gray-300">{row.text}</span>
              </li>
            ))}
          </ul>
          <Link
            to="/docs/user-guides/migrating-from-terraform-cloud"
            className="mt-7 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-100 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-400/30 text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-500/30 transition-all"
          >
            <ArrowRight className="h-3.5 w-3.5" /> Migration guide and verified resource table
          </Link>
        </div>

        <div className="min-w-0 rounded-2xl backdrop-blur-md border bg-blue-50/80 dark:bg-transparent border-blue-400/40 shadow-lg shadow-blue-500/10 p-4 md:p-6">
          <div className="relative rounded-lg bg-slate-900/80 border border-white/10 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-2 border-b border-white/10 bg-white/5">
              <div className="hidden sm:flex items-center gap-2 shrink-0">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Ways to connect" onKeyDown={onKeyDown}>
                {TABS.map((tab, i) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`compat-tab-${tab.id}`}
                    aria-controls={`compat-panel-${tab.id}`}
                    aria-selected={i === active}
                    tabIndex={i === active ? 0 : -1}
                    onClick={() => { setActive(i); }}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-mono transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                      i === active ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
                    )}
                  >
                    {tab.id}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={copy}
                className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-400" />
                    <span className="text-green-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            {TABS.map((tab, i) => (
              <pre
                key={tab.id}
                role="tabpanel"
                id={`compat-panel-${tab.id}`}
                aria-labelledby={`compat-tab-${tab.id}`}
                hidden={i !== active}
                className="p-4 text-sm text-gray-300 overflow-x-auto whitespace-pre"
              >
                <code>{tab.code}</code>
              </pre>
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-800 dark:text-gray-400">
            Prefer a native provider?{' '}
            <a
              className="text-blue-700 dark:text-blue-300 underline underline-offset-4"
              href="https://github.com/vhco-pro/terraform-provider-stackweaver"
              target="_blank"
              rel="noopener noreferrer"
            >
              terraform-provider-stackweaver
            </a>{' '}
            manages Stackweaver itself as code.
          </p>
        </div>
      </div>
    </section>
  );
}
