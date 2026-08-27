// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Server,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ServerOff,
  ClipboardList,
  Loader2,
  GitBranch,
  Clock,
  Unlock,
  FolderOpen,
  Tag,
  Play,
  Globe,
  RefreshCw,
  AlertCircle,
  Zap,
  Ban,
  ArrowLeft,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TourPaneId } from '@/components/landing/heroTour';

// ---------------------------------------------------------------------------------------------
// Hero product tour: four styled miniatures of real Stackweaver screens, one per feature pill.
// They are deliberately markup (not screenshots) so they follow the theme and never go stale.
// Fixture wording mirrors the real pages (pages/Dashboard/attention.ts, WorkspaceDetail tabs,
// Settings/ChangeRequests, Settings/Runners) so the pictures stay honest.
// ---------------------------------------------------------------------------------------------

// ---- shared mini building blocks ------------------------------------------------------------

const card = 'rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5';
const muted = 'text-slate-500 dark:text-slate-400';
const strong = 'font-semibold text-slate-900 dark:text-white';

function MiniTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div>
      <div className="text-sm font-bold bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 bg-clip-text text-transparent">
        {children}
      </div>
      {sub && <div className={cn('text-[9px]', muted)}>{sub}</div>}
    </div>
  );
}

function MiniSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className={cn('text-[10px] mb-1', strong)}>{title}</div>
      {children}
    </div>
  );
}

function MiniBar({ value, className }: { value: string; className?: string }) {
  return (
    <div className="h-1 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
      <div className={cn('h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500', className)} style={{ width: value }} />
    </div>
  );
}

// ---- sidebar ---------------------------------------------------------------------------------

const MOCK_NAV: { section: string; items: string[] }[] = [
  { section: 'OpenTofu', items: ['Workspaces', 'Registry'] },
  { section: 'Ansible', items: ['Inventories', 'Playbooks', 'Job Templates', 'Jobs'] },
  { section: 'Core', items: ['Dashboard', 'Settings'] },
];

function MiniSidebar({ active }: { active: string }) {
  return (
    <div className="col-span-3 border-r border-slate-200 dark:border-white/10 pr-3 space-y-3 text-[9px] leading-tight">
      {MOCK_NAV.map(({ section, items }) => (
        <div key={section}>
          <div className="font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">{section}</div>
          {items.map((item) => (
            <div
              key={item}
              className={cn(
                'rounded px-1.5 py-0.5 text-slate-600 dark:text-slate-400 transition-colors duration-300',
                item === active && 'bg-blue-500/10 dark:bg-blue-500/20 text-slate-900 dark:text-white font-semibold'
              )}
            >
              {item}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---- pane 1: dashboard (single pane of glass) --------------------------------------------------

const MOCK_ATTENTION: { org: string; text: string; icon: LucideIcon; tone: string }[] = [
  { org: 'platform', text: '1 OpenTofu run is waiting for someone to apply', icon: AlertTriangle, tone: 'text-amber-500' },
  { org: 'demo', text: '2 workspaces have been left broken', icon: XCircle, tone: 'text-red-500' },
  { org: 'demo', text: '1 of 3 runners is offline', icon: ServerOff, tone: 'text-red-500' },
  { org: 'main', text: '3 open change requests', icon: ClipboardList, tone: 'text-indigo-500' },
];
const MOCK_LIVE = [
  { name: 'main-prod-network', status: 'applying', progress: '64%' },
  { name: 'demo-fleet-converge', status: 'running', progress: '38%' },
];
const MOCK_ORGS = [
  { name: 'main', workspaces: 4, playbooks: 2 },
  { name: 'platform', workspaces: 11, playbooks: 6 },
  { name: 'demo', workspaces: 9, playbooks: 14 },
];

function OverviewPane() {
  return (
    <>
      <MiniSidebar active="Dashboard" />
      <div className="col-span-9 min-w-0 space-y-3.5">
        <MiniTitle sub="What needs you across your 3 organizations">Welcome back, Admin</MiniTitle>

        <MiniSection title="Needs your attention">
          <div className={cn(card, 'divide-y divide-slate-200 dark:divide-white/10')}>
            {MOCK_ATTENTION.map((row) => (
              <div key={row.text} className="flex items-center gap-2 px-2.5 py-1.5 text-[9px]">
                <row.icon className={cn('w-3 h-3 shrink-0', row.tone)} />
                <span className={strong}>{row.org}</span>
                <span className="text-slate-600 dark:text-slate-400 truncate">{row.text}</span>
              </div>
            ))}
          </div>
        </MiniSection>

        <MiniSection title="Live operations">
          <div className="grid grid-cols-2 gap-2">
            {MOCK_LIVE.map((op) => (
              <div key={op.name} className={cn(card, 'p-2 text-[9px]')}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className={cn(strong, 'truncate')}>{op.name}</span>
                  <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 shrink-0">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    {op.status}
                  </span>
                </div>
                <MiniBar value={op.progress} />
              </div>
            ))}
          </div>
        </MiniSection>

        <div className="grid grid-cols-3 gap-2">
          {MOCK_ORGS.map((org) => (
            <div key={org.name} className={cn(card, 'p-2 text-[9px]')}>
              <div className={strong}>{org.name}</div>
              <div className={muted}>
                {org.workspaces} workspaces · {org.playbooks} playbooks
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ---- shared: workspace detail header (mirrors pages/WorkspaceDetail.tsx) --------------------

const WS_TABS = ['Overview', 'Runs', 'States', 'Variables', 'Tags', 'Change Requests'];

function MiniWorkspaceHeader({ tab }: { tab: string }) {
  return (
    <>
      <div className={cn('text-[8px]', muted)}>
        main / Workspaces / <span className={strong}>stackweaver-tests</span>
      </div>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-bold bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 bg-clip-text text-transparent">
            stackweaver-tests
          </div>
          <div className={cn('text-[8px]', muted)}>ID: ws-hAsqCdPhavkZbPbH</div>
        </div>
      </div>
      <div className={cn('flex flex-wrap gap-x-2.5 text-[8px]', muted)}>
        <span className="flex items-center gap-0.5"><Unlock className="w-2 h-2" /> Unlocked</span>
        <span className="flex items-center gap-0.5"><FolderOpen className="w-2 h-2" /> Resources 11</span>
        <span className="flex items-center gap-0.5"><Tag className="w-2 h-2" /> Outputs 1</span>
        <span>OpenTofu 1.12.5</span>
        <span className="flex items-center gap-0.5"><Clock className="w-2 h-2" /> Updated 1 month ago</span>
      </div>
      <div className="flex rounded-md bg-slate-100 dark:bg-white/5 p-0.5 text-[8px]">
        {WS_TABS.map((t) => (
          <div
            key={t}
            className={cn(
              'flex-1 text-center py-0.5 rounded truncate',
              t === tab ? 'bg-white dark:bg-slate-800 shadow-xs text-slate-900 dark:text-white font-semibold' : muted
            )}
          >
            {t}
          </div>
        ))}
      </div>
    </>
  );
}

function StatusPill({ tone, children }: { tone: 'green' | 'slate' | 'red' | 'blue'; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 px-1.5 py-px rounded-full text-[8px] font-medium border',
        tone === 'green' && 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400',
        tone === 'slate' && 'bg-slate-500/10 border-slate-400/30 text-slate-600 dark:text-slate-300',
        tone === 'red' && 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400',
        tone === 'blue' && 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400'
      )}
    >
      {children}
    </span>
  );
}

// ---- pane 2: workspace overview - latest run + resources table (visualize resources) ----------

const MOCK_RESOURCES = [
  { name: 'aws_vpc.main', provider: 'hashicorp/aws', type: 'aws_vpc', module: 'root' },
  { name: 'aws_subnet.private[0]', provider: 'hashicorp/aws', type: 'aws_subnet', module: 'network' },
  { name: 'aws_instance.web', provider: 'hashicorp/aws', type: 'aws_instance', module: 'root' },
  { name: 'local_file.deprecated_test', provider: 'hashicorp/local', type: 'local_file', module: 'root' },
];

function ResourcesPane() {
  return (
    <>
      <MiniSidebar active="Workspaces" />
      <div className="col-span-9 min-w-0 space-y-2">
        <MiniWorkspaceHeader tab="Overview" />

        <div className={cn('text-[9px]', strong)}>Latest Run</div>
        <div className={cn(card, 'p-2 text-[8px]')}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-4 h-4 rounded-full border border-purple-500/40 bg-purple-500/10 flex items-center justify-center shrink-0">
                <Play className="w-2 h-2 text-purple-600 dark:text-purple-400" />
              </span>
              <div className="min-w-0">
                <div className={cn(strong, 'truncate')}>Plan and Apply run-IdNYYhaZePxkPkbc</div>
                <div className={cn(muted, 'flex items-center gap-0.5')}><Globe className="w-2 h-2" /> Triggered via UI</div>
              </div>
            </div>
            <StatusPill tone="green"><CheckCircle2 className="w-2 h-2" /> Applied</StatusPill>
          </div>
          <div className="grid grid-cols-4 gap-1 mt-1.5 text-center">
            {[
              { l: 'Policy checks', v: '-' },
              { l: 'Estimated cost change', v: '-' },
              { l: 'Plan & apply duration', v: '2s' },
            ].map((m) => (
              <div key={m.l}>
                <div className={muted}>{m.l}</div>
                <div className={strong}>{m.v}</div>
              </div>
            ))}
            <div>
              <div className={muted}>Resource impact</div>
              <div className="flex justify-center gap-1 mt-px">
                <span className="px-1 rounded border border-green-500/40 text-green-600 dark:text-green-400">+ 1</span>
                <span className="px-1 rounded border border-amber-500/40 text-amber-600 dark:text-amber-400">↻ 1</span>
              </div>
            </div>
          </div>
        </div>

        <div className="inline-flex rounded-md bg-slate-100 dark:bg-white/5 p-0.5 text-[8px]">
          {['Resources (11)', 'Data Sources (0)', 'Outputs (1)'].map((t, i) => (
            <div key={t} className={cn('px-1.5 py-0.5 rounded', i === 0 ? 'bg-white dark:bg-slate-800 shadow-xs text-slate-900 dark:text-white font-semibold' : muted)}>
              {t}
            </div>
          ))}
        </div>
        <div className={cn(card, 'overflow-hidden text-[8px]')}>
          <div className="grid grid-cols-[1.6fr_1fr_0.9fr_0.6fr] gap-2 px-2 py-1 bg-slate-100/70 dark:bg-white/5 font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>Name</span><span>Provider</span><span>Type</span><span>Module</span>
          </div>
          {MOCK_RESOURCES.map((r) => (
            <div key={r.name} className="grid grid-cols-[1.6fr_1fr_0.9fr_0.6fr] gap-2 px-2 py-1 border-t border-slate-200 dark:border-white/10">
              <span className="font-mono text-slate-900 dark:text-white truncate">{r.name}</span>
              <span className={cn(muted, 'truncate')}>{r.provider}</span>
              <span className="text-slate-700 dark:text-slate-300 truncate">{r.type}</span>
              <span className={muted}>{r.module}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ---- pane 3: runs tab - VCS-triggered plan/apply runs (GitOps workflows) ----------------------

const MOCK_RUN_LIST: { kind: string; via: string; id: string; status: string; tone: 'green' | 'slate' | 'blue'; when: string; icon: LucideIcon }[] = [
  { kind: 'Plan and Apply', via: 'Triggered via VCS · main @ 4f2a9c1', id: 'run-KSzUvhn7R0LqYkFd', status: 'Applying', tone: 'blue', when: 'just now', icon: Loader2 },
  { kind: 'Plan Only', via: 'Triggered via VCS · feat/vpc-peering @ b71e0d3', id: 'run-SIowNIZYgcEaqm7x', status: 'Finished', tone: 'green', when: '1 day ago', icon: CheckCircle2 },
  { kind: 'Plan and Apply', via: 'Triggered via VCS · main @ 9c0d44e', id: 'run-IdNYYhaZePxkPkbc', status: 'Applied', tone: 'green', when: '2 days ago', icon: CheckCircle2 },
  { kind: 'Plan Only', via: 'Triggered via UI', id: 'run-WcBvk4q6VPJRUrBZ', status: 'Cancelled', tone: 'slate', when: '2 days ago', icon: XCircle },
];

function GitOpsPane() {
  return (
    <>
      <MiniSidebar active="Workspaces" />
      <div className="col-span-9 min-w-0 space-y-2">
        <MiniWorkspaceHeader tab="Runs" />

        <div className="flex items-center gap-2 text-[8px]">
          <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold">All 9</span>
          <span className="flex items-center gap-0.5 text-red-500"><XCircle className="w-2 h-2" /> Errored 0</span>
          <span className="flex items-center gap-0.5 text-blue-600 dark:text-blue-400"><Loader2 className="w-2 h-2" /> Running 1</span>
          <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400"><CheckCircle2 className="w-2 h-2" /> Success 5</span>
          <span className={cn('ml-auto px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/10', muted)}>Search runs…</span>
        </div>

        <div className="space-y-1.5">
          {MOCK_RUN_LIST.map((run) => (
            <div key={run.id} className={cn(card, 'px-2 py-1.5 text-[8px] flex items-center justify-between gap-2')}>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-4 h-4 rounded-full border border-purple-500/40 bg-purple-500/10 flex items-center justify-center shrink-0">
                  <Play className="w-2 h-2 text-purple-600 dark:text-purple-400" />
                </span>
                <div className="min-w-0">
                  <div className={strong}>{run.kind}</div>
                  <div className={cn(muted, 'flex items-center gap-0.5 truncate')}>
                    {run.via.includes('VCS') ? <GitBranch className="w-2 h-2 shrink-0" /> : <Globe className="w-2 h-2 shrink-0" />}
                    {run.via}
                  </div>
                  <div className={cn(muted, 'font-mono')}>#{run.id}</div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <StatusPill tone={run.tone}>
                  <run.icon className={cn('w-2 h-2', run.status === 'Applying' && 'animate-spin')} /> {run.status}
                </StatusPill>
                <div className={cn(muted, 'mt-0.5')}>{run.when}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ---- pane 4: ansible job run viewer - matrix view (mirrors pages/Ansible/run-viewer) ----------

type Cell = 'ok' | 'changed' | 'failed' | 'unreachable' | 'skipped' | 'none';
const MATRIX_TASKS = ['Gathering Facts', 'Verify connectivity', 'Install application', 'Render nginx site', 'Restart application', 'Wait for health'];
const MATRIX_HOSTS: { host: string; tone: string; cells: Cell[] }[] = [
  { host: 'api01', tone: 'bg-amber-500', cells: ['ok', 'ok', 'changed', 'skipped', 'changed', 'ok'] },
  { host: 'api02', tone: 'bg-amber-500', cells: ['ok', 'ok', 'ok', 'skipped', 'changed', 'ok'] },
  { host: 'api03', tone: 'bg-red-500', cells: ['ok', 'ok', 'changed', 'skipped', 'failed', 'none'] },
  { host: 'cache01', tone: 'bg-green-500', cells: ['ok', 'ok', 'ok', 'skipped', 'skipped', 'skipped'] },
  { host: 'db01', tone: 'bg-amber-500', cells: ['ok', 'ok', 'changed', 'skipped', 'skipped', 'skipped'] },
  { host: 'lb01', tone: 'bg-amber-500', cells: ['ok', 'ok', 'ok', 'changed', 'skipped', 'skipped'] },
  { host: 'lb02', tone: 'bg-green-500', cells: ['ok', 'ok', 'ok', 'ok', 'skipped', 'skipped'] },
  { host: 'web01', tone: 'bg-amber-500', cells: ['ok', 'ok', 'changed', 'changed', 'changed', 'ok'] },
  { host: 'web02', tone: 'bg-amber-500', cells: ['ok', 'ok', 'changed', 'changed', 'changed', 'ok'] },
  { host: 'web03', tone: 'bg-purple-500', cells: ['ok', 'unreachable', 'none', 'none', 'none', 'none'] },
  { host: 'worker01', tone: 'bg-amber-500', cells: ['ok', 'ok', 'changed', 'skipped', 'changed', 'ok'] },
];
const CELL_STYLE: Record<Cell, { box: string; icon: LucideIcon | null }> = {
  ok: { box: 'border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400', icon: CheckCircle2 },
  changed: { box: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400', icon: RefreshCw },
  failed: { box: 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400', icon: AlertCircle },
  unreachable: { box: 'border-purple-500/40 bg-purple-500/10 text-purple-600 dark:text-purple-400', icon: Zap },
  skipped: { box: 'border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400', icon: Ban },
  none: { box: 'border-transparent', icon: null },
};

function AnsiblePane() {
  return (
    <>
      <MiniSidebar active="Jobs" />
      <div className="col-span-9 min-w-0 space-y-2 text-[8px]">
        <div className={cn(card, 'px-2 py-1.5 flex items-center gap-2')}>
          <ArrowLeft className={cn('w-2.5 h-2.5', muted)} />
          <span className="text-[10px] font-bold text-slate-900 dark:text-white truncate">rolling-deploy-v2.14.1 (20 hosts)</span>
          <StatusPill tone="red"><AlertCircle className="w-2 h-2" /> Failed</StatusPill>
          <span className={cn(muted, 'hidden sm:flex items-center gap-0.5')}><Clock className="w-2 h-2" /> 13h 7m 59s</span>
          <span className={cn(muted, 'hidden sm:inline')}>production</span>
          <span className="ml-auto px-1.5 py-0.5 rounded bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold flex items-center gap-0.5 shrink-0">
            <RefreshCw className="w-2 h-2" /> Relaunch
          </span>
        </div>

        <div className="flex items-center gap-1">
          <div className="inline-flex rounded-md bg-slate-100 dark:bg-white/5 p-0.5">
            {['Run', 'Details', 'Host Facts'].map((t, i) => (
              <div key={t} className={cn('px-1.5 py-0.5 rounded', i === 0 ? 'bg-white dark:bg-slate-800 shadow-xs text-slate-900 dark:text-white font-semibold' : muted)}>{t}</div>
            ))}
          </div>
          <div className={cn(card, 'ml-auto px-2 py-1 flex items-center gap-2')}>
            <span><b className="text-slate-900 dark:text-white">20</b> <span className={muted}>hosts</span></span>
            <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400 font-semibold"><CheckCircle2 className="w-2 h-2" /> 122</span>
            <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-semibold"><RefreshCw className="w-2 h-2" /> 43</span>
            <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400 font-semibold"><AlertCircle className="w-2 h-2" /> 1</span>
            <span className="flex items-center gap-0.5 text-purple-600 dark:text-purple-400 font-semibold"><Zap className="w-2 h-2" /> 1</span>
            <span className="flex items-center gap-0.5 text-blue-600 dark:text-blue-400 font-semibold"><Ban className="w-2 h-2" /> 47</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md bg-slate-100 dark:bg-white/5 p-0.5">
            {['Matrix', 'Timeline', 'Stream'].map((t, i) => (
              <div key={t} className={cn('px-1.5 py-0.5 rounded', i === 0 ? 'bg-white dark:bg-slate-800 shadow-xs text-slate-900 dark:text-white font-semibold' : muted)}>{t}</div>
            ))}
          </div>
          <span className={strong}>Rolling deploy of web application</span>
          <span className={muted}>9 tasks · 49s</span>
        </div>

        <div className={cn(card, 'overflow-hidden')}>
          <div className="grid gap-px" style={{ gridTemplateColumns: `3.5rem repeat(${MATRIX_TASKS.length}, minmax(0, 1fr))` }}>
            <div className={cn('px-1.5 py-1 uppercase tracking-wider text-[6px] font-bold', muted)}>Host → Task</div>
            {MATRIX_TASKS.map((t) => (
              <div key={t} className={cn('px-1 py-1 truncate', strong)}>{t}</div>
            ))}
            {MATRIX_HOSTS.map((row) => (
              <div key={row.host} className="contents">
                <div className="px-1.5 py-0.5 flex items-center gap-1 border-t border-slate-200 dark:border-white/10">
                  <span className={cn('w-1 h-1 rounded-full shrink-0', row.tone)} />
                  <span className="font-mono text-slate-700 dark:text-slate-300">{row.host}</span>
                </div>
                {row.cells.map((c, i) => {
                  const st = CELL_STYLE[c];
                  return (
                    <div key={i} className="py-0.5 border-t border-slate-200 dark:border-white/10 flex items-center justify-center">
                      <span className={cn('w-3 h-3 rounded border flex items-center justify-center', st.box)}>
                        {st.icon && <st.icon className="w-2 h-2" />}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ---- pane 5: runners + agent pools (runners & fleet; mirrors Settings/Runners + AgentPools) ---

const MOCK_RUNNERS: { name: string; pool: string; status: 'online' | 'busy' | 'offline'; job?: string; version: string }[] = [
  { name: 'runner-eu-west-1a', pool: 'default', status: 'busy', job: 'main-prod-network', version: 'v1.8.2' },
  { name: 'runner-eu-west-1b', pool: 'default', status: 'online', version: 'v1.8.2' },
  { name: 'ansible-runner-01', pool: 'ansible', status: 'busy', job: 'demo-fleet-converge', version: 'v1.8.2' },
  { name: 'runner-onprem-dc2', pool: 'on-prem', status: 'offline', version: 'v1.7.9' },
];
const MOCK_POOLS = [
  { name: 'default', runners: 2, workspaces: 14, load: '62%' },
  { name: 'ansible', runners: 1, workspaces: 6, load: '88%' },
  { name: 'on-prem', runners: 1, workspaces: 4, load: '0%' },
];
const MOCK_ASSIGNMENTS = [
  { id: 'run-KSzU', what: 'Plan and Apply · main-prod-network', runner: 'runner-eu-west-1a', when: 'just now' },
  { id: 'job-569f', what: 'demo-fleet-converge', runner: 'ansible-runner-01', when: '2m ago' },
  { id: 'run-SIow', what: 'Plan Only · stackweaver-tests', runner: 'runner-eu-west-1b', when: '1d ago' },
];
const STATUS_TONE = {
  online: 'text-green-600 dark:text-green-400',
  busy: 'text-blue-600 dark:text-blue-400',
  offline: 'text-red-500',
};

function FleetPane() {
  return (
    <>
      <MiniSidebar active="Settings" />
      <div className="col-span-9 min-w-0 space-y-3">
        <MiniTitle sub="3 of 4 runners online · 2 jobs in flight">Runners</MiniTitle>

        <div className={cn(card, 'divide-y divide-slate-200 dark:divide-white/10')}>
          {MOCK_RUNNERS.map((r) => (
            <div key={r.name} className="flex items-center gap-2 px-2.5 py-1.5 text-[9px]">
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full shrink-0',
                  r.status === 'online' && 'bg-green-500',
                  r.status === 'busy' && 'bg-blue-500 animate-pulse',
                  r.status === 'offline' && 'bg-red-500'
                )}
              />
              <span className={cn(strong, 'font-mono truncate')}>{r.name}</span>
              <span className={cn(muted, 'hidden sm:inline')}>{r.pool}</span>
              <span className={cn(muted, 'hidden sm:inline font-mono')}>{r.version}</span>
              <span className={cn('ml-auto shrink-0', STATUS_TONE[r.status])}>{r.job ? `busy · ${r.job}` : r.status}</span>
            </div>
          ))}
        </div>

        <MiniSection title="Agent pools">
          <div className="grid grid-cols-3 gap-2">
            {MOCK_POOLS.map((pool) => (
              <div key={pool.name} className={cn(card, 'p-2 text-[9px] space-y-1')}>
                <div className={strong}>{pool.name}</div>
                <div className={muted}>
                  {pool.runners} runners · {pool.workspaces} workspaces
                </div>
                <MiniBar value={pool.load} />
                <div className={muted}>{pool.load} capacity in use</div>
              </div>
            ))}
          </div>
        </MiniSection>

        <MiniSection title="Recent assignments">
          <div className={cn(card, 'divide-y divide-slate-200 dark:divide-white/10')}>
            {MOCK_ASSIGNMENTS.map((a) => (
              <div key={a.id} className="flex items-center gap-2 px-2.5 py-1.5 text-[9px]">
                <span className={cn(muted, 'font-mono')}>{a.id}</span>
                <span className="text-slate-700 dark:text-slate-300 truncate">{a.what}</span>
                <span className={cn(muted, 'font-mono hidden sm:inline')}>→ {a.runner}</span>
                <span className={cn(muted, 'ml-auto shrink-0')}>{a.when}</span>
              </div>
            ))}
          </div>
        </MiniSection>
      </div>
    </>
  );
}

// ---- floating cards per pane ----------------------------------------------------------------

function FloatTop({ children }: { children: ReactNode }) {
  return (
    <motion.div
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      className="absolute top-[9%] right-[-20px] bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-white/10 shadow-xl w-52 z-20 hidden md:block"
      style={{ transform: 'translateZ(40px)' }}
    >
      {children}
    </motion.div>
  );
}

function FloatBottom({ children }: { children: ReactNode }) {
  return (
    <motion.div
      animate={{ y: [0, 15, 0] }}
      transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      className="absolute bottom-1/4 left-[-10px] bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-white/10 shadow-xl w-44 z-20 hidden md:block"
      style={{ transform: 'translateZ(60px)' }}
    >
      {children}
    </motion.div>
  );
}

function IconRow({ icon: Icon, tone, title, sub }: { icon: LucideIcon; tone: string; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn('p-1.5 rounded-md', tone)}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <div className="text-xs font-semibold text-slate-900 dark:text-white">{title}</div>
        <div className="text-[10px] text-slate-500 dark:text-slate-400">{sub}</div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <>
      <div className="text-xs text-slate-500 dark:text-gray-400 mb-1">{label}</div>
      <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{sub}</div>
    </>
  );
}

const FLOATS: Record<TourPaneId, { top: ReactNode; bottom: ReactNode }> = {
  overview: {
    top: (
      <>
        <div className="mb-2">
          <IconRow icon={CheckCircle2} tone="bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400" title="Run applied" sub="stackweaver-tests · 2m ago" />
        </div>
        <div className="h-1.5 w-full bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
          <div className="h-full w-full bg-green-500" />
        </div>
      </>
    ),
    bottom: <Stat label="Completed this month" value="128" sub="112 OpenTofu · 16 Ansible" />,
  },
  resources: {
    top: <IconRow icon={CheckCircle2} tone="bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400" title="State version 14" sub="11 resources · 1 output" />,
    bottom: <Stat label="Resources" value="11" sub="hashicorp/aws · hashicorp/local" />,
  },
  gitops: {
    top: <IconRow icon={GitBranch} tone="bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400" title="Push to main" sub="michielvha/stackweaver-tests" />,
    bottom: <Stat label="Plan" value="+1 ~1" sub="0 to destroy · applying" />,
  },
  ansible: {
    top: <IconRow icon={AlertCircle} tone="bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400" title="api03 failed" sub="Restart application · rc=1" />,
    bottom: <Stat label="Hosts" value="20" sub="122 ok · 43 changed · 1 failed" />,
  },
  fleet: {
    top: <IconRow icon={Server} tone="bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400" title="Runner registered" sub="runner-eu-west-1b · v1.8.2" />,
    bottom: <Stat label="Queue" value="0" sub="runs waiting for a runner" />,
  },
};

const PANES: Record<TourPaneId, () => ReactNode> = {
  overview: OverviewPane,
  resources: ResourcesPane,
  gitops: GitOpsPane,
  ansible: AnsiblePane,
  fleet: FleetPane,
};

// ---- the visual ------------------------------------------------------------------------------

export function HeroTourVisual({ pane }: { pane: TourPaneId }) {
  const Pane = PANES[pane];
  const floats = FLOATS[pane];
  return (
    <motion.div
      initial={{ rotateY: 15, rotateX: 5, scale: 0.9, opacity: 0 }}
      whileInView={{ rotateY: -10, rotateX: 5, scale: 1, opacity: 1 }}
      transition={{ duration: 1.2, ease: 'easeOut' }}
      viewport={{ once: true }}
      className="relative w-full aspect-[4/3] rounded-xl overflow-hidden shadow-2xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl group"
      style={{ transformStyle: 'preserve-3d', boxShadow: 'var(--shadow-color)' }}
    >
      {/* Window chrome */}
      <div className="h-12 border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 flex items-center px-4 justify-between">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <div className="h-6 w-1/3 bg-slate-200 dark:bg-white/5 rounded-md" />
        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/10" />
      </div>

      <div className="relative h-[calc(100%-3rem)]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pane}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="absolute inset-0 p-5 grid grid-cols-12 gap-5 text-left"
          >
            <Pane />
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`floats-${pane}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <FloatTop>{floats.top}</FloatTop>
          <FloatBottom>{floats.bottom}</FloatBottom>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
