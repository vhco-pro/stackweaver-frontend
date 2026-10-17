// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Copy, ExternalLink, Layers, Plug, Terminal, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const REGISTRY_URL = 'https://registry.terraform.io/providers/vhco-pro/stackweaver/latest/docs';
const SOURCE_URL = 'https://github.com/vhco-pro/terraform-provider-stackweaver';

/** Block keywords coloured at the start of a line. */
const KEYWORDS = new Set(['terraform', 'required_providers', 'provider', 'resource', 'cloud', 'workspaces']);

/** Colours one HCL or shell snippet from its plain text: comments, strings and block keywords. */
function highlight(plain: string): ReactNode {
  return plain.split('\n').map((line, i) => {
    const nl = i > 0 ? '\n' : '';
    if (line.trimStart().startsWith('#')) {
      return (
        <span key={i}>
          {nl}
          <span className="text-slate-500">{line}</span>
        </span>
      );
    }
    const indent = line.match(/^\s*/)?.[0] ?? '';
    const word = line.slice(indent.length).match(/^[a-z_]+/)?.[0];
    const isKeyword = word !== undefined && KEYWORDS.has(word) && /^[a-z_]+\s*("|\{)/.test(line.slice(indent.length));
    const rest = isKeyword ? line.slice(indent.length + word.length) : line.slice(indent.length);
    const parts = rest.split(/("[^"]*")/);
    return (
      <span key={i}>
        {nl}
        {indent}
        {isKeyword && <span className="text-sky-300">{word}</span>}
        {parts.map((part, j) =>
          part.startsWith('"') ? (
            <span key={j} className="text-green-300">
              {part}
            </span>
          ) : (
            part
          )
        )}
      </span>
    );
  });
}

interface ConnectTab {
  id: string;
  /** The snippet as it is shown and as the copy button puts it on the clipboard. */
  plain: string;
}

// The provider first, then the setups a reader may already have. The `cloud` block is the
// reader's own wire contract and keeps its name.
const TABS: ConnectTab[] = [
  {
    id: 'provider',
    plain: `terraform {
  required_providers {
    stackweaver = {
      source = "vhco-pro/stackweaver"
    }
  }
}

provider "stackweaver" {
  hostname     = "stackweaver.example.com"
  organization = "platform"
}

resource "stackweaver_workspace" "network" {
  name         = "prod-network"
  organization = "platform"
}`,
  },
  {
    id: 'ansible',
    plain: `# the Ansible side, in the same configuration
resource "stackweaver_ansible_inventory" "prod" {
  organization = "platform"
  name         = "production"
  type         = "static"
}

resource "stackweaver_ansible_job_template" "patch" {
  organization = "platform"
  name         = "patch-fleet"
  playbook_id  = stackweaver_ansible_playbook.site.id
  inventory_id = stackweaver_ansible_inventory.prod.id
}`,
  },
  {
    id: 'cloud',
    plain: `terraform {
  cloud {
    # point the cloud block at your host
    hostname     = "stackweaver.example.com"
    organization = "platform"

    workspaces {
      name = "prod-network"
    }
  }
}`,
  },
  {
    id: 'login',
    plain: `# sign in from the CLI you already use
terraform login stackweaver.example.com

# or
tofu login stackweaver.example.com`,
  },
];

interface Point {
  icon: LucideIcon;
  title: string;
  text: ReactNode;
}

const Mono = ({ children }: { children: ReactNode }) => <code className="font-mono text-slate-950 dark:text-white">{children}</code>;

const POINTS: Point[] = [
  {
    icon: Layers,
    title: 'Both tools, one configuration',
    text: 'A workspace and the job template that patches its hosts sit side by side, reviewed in one pull request and applied in one plan.',
  },
  {
    icon: Terminal,
    title: 'The CLI you already use',
    text: (
      <>
        <Mono>terraform</Mono> or <Mono>tofu</Mono>, signed in with <Mono>login</Mono> against your host. Runs execute on
        OpenTofu; Stackweaver itself does not ship or run the Terraform binary.
      </>
    ),
  },
  {
    icon: Plug,
    title: 'A standard API underneath',
    text: (
      <>
        Stackweaver implements the Terraform Enterprise API, so a <Mono>cloud</Mono> block and existing workspace configurations
        work against it too.
      </>
    ),
  },
];

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
            Manage Stackweaver as code.
          </h2>
          <p className="text-slate-800 dark:text-gray-400 text-lg leading-relaxed mb-8">
            The Stackweaver Terraform provider describes the platform itself: organizations, projects, workspaces, variables,
            teams and runners, and the Ansible side with its playbooks, inventories, credentials and job templates.
          </p>
          <ul className="space-y-5">
            {POINTS.map((point) => (
              <li key={point.title} className="flex gap-4">
                <span className="w-10 h-10 shrink-0 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 dark:from-blue-500/20 dark:to-indigo-500/20 flex items-center justify-center">
                  <point.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-950 dark:text-white">{point.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-800 dark:text-gray-400">{point.text}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/docs/user-guides/terraform-provider"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-100 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-400/30 text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-500/30 transition-all"
            >
              <ArrowRight className="h-3.5 w-3.5" /> Provider guide
            </Link>
            <a
              href={REGISTRY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 dark:border-white/15 text-sm font-medium text-slate-800 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Terraform Registry
            </a>
          </div>
        </div>

        <div className="min-w-0 rounded-2xl backdrop-blur-md border bg-blue-50/80 dark:bg-transparent border-blue-400/40 shadow-lg shadow-blue-500/10 p-4 md:p-6">
          <div className="relative rounded-lg bg-slate-900/80 border border-white/10 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-2 border-b border-white/10 bg-white/5">
              <div className="hidden sm:flex items-center gap-2 shrink-0">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Provider examples" onKeyDown={onKeyDown}>
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
                <code>{highlight(tab.plain)}</code>
              </pre>
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-800 dark:text-gray-400">
            Published as{' '}
            <a className="text-blue-700 dark:text-blue-300 underline underline-offset-4" href={REGISTRY_URL} target="_blank" rel="noopener noreferrer">
              vhco-pro/stackweaver
            </a>{' '}
            under <span className="whitespace-nowrap">MPL-2.0</span>, with its source on{' '}
            <a className="text-blue-700 dark:text-blue-300 underline underline-offset-4" href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
