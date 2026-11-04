// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// The D15 UI placement guard (#933, AC66). The runner architecture spec's parity table (D15) names,
// for every user-configurable capability, the one existing page or dialog its UI control joins, and
// AC66 requires the control to be there "and nowhere else". The controls are components, so this
// test reads the source and holds the set of files that import each one to exactly the surfaces
// its D15 row names. A second page reusing a control fails here until its row says so.
//
// Spec: docs/internal/plans/infrastructure/runners/runner-architecture-launcher-driver-executor.md,
// D15 and AC66.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = dirname(fileURLToPath(import.meta.url));

/** Every non-test source file under src/, as a path relative to src/. */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(SRC, dir))) {
    const rel = dir ? `${dir}/${name}` : name;
    if (statSync(join(SRC, rel)).isDirectory()) {
      if (name !== 'node_modules' && name !== 'test') out.push(...walk(rel));
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) {
      out.push(rel);
    }
  }
  return out;
}

const FILES = walk('').sort();
const SOURCE = new Map(FILES.map((f) => [f, readFileSync(join(SRC, f), 'utf8')]));

/** A module path relative to src/, without its extension: `components/settings/HostedCapacity`. */
function resolveSpecifier(from: string, specifier: string): string | null {
  let path: string;
  if (specifier.startsWith('@/')) path = specifier.slice(2);
  else if (specifier.startsWith('.')) path = relative(SRC, normalize(join(SRC, dirname(from), specifier)));
  else return null;
  return path.replace(/\.(ts|tsx)$/, '');
}

/** The names a file imports from each module it imports. `*` stands for the whole module. */
function importsOf(file: string): Map<string, Set<string>> {
  const src = SOURCE.get(file) ?? '';
  const out = new Map<string, Set<string>>();
  const add = (specifier: string, names: string[]) => {
    const mod = resolveSpecifier(file, specifier);
    if (!mod) return;
    const set = out.get(mod) ?? new Set<string>();
    names.forEach((n) => set.add(n));
    out.set(mod, set);
  };
  // Static imports and re-exports, including multi-line named lists and `import type`.
  // A clause holds no `;`, `(` or `=`, so a match cannot run on from an unrelated statement.
  for (const m of src.matchAll(/^\s*(?:import|export)\s+(type\s+)?([^;()=]*?)\s+from\s+['"]([^'"]+)['"]/gm)) {
    const clause = m[2];
    const names: string[] = [];
    const named = /\{([\s\S]*?)\}/.exec(clause);
    if (named) {
      for (const part of named[1].split(',')) {
        const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
        if (name) names.push(name);
      }
    }
    if (/\*\s+as\s+\w+/.test(clause) || clause.trim() === '*') names.push('*');
    const beforeBrace = clause.split('{')[0].replace(/,\s*$/, '').trim();
    if (beforeBrace && !beforeBrace.startsWith('*')) names.push('default');
    add(m[3], names);
  }
  // Dynamic imports, which the lazy routes use: the whole module.
  for (const m of src.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) add(m[1], ['*']);
  return out;
}

const IMPORTS = new Map(FILES.map((f) => [f, importsOf(f)]));

/** The files that import `name` (or the whole module) from `module`. */
function importersOf(module: string, name: string): string[] {
  return FILES.filter((f) => {
    const names = IMPORTS.get(f)?.get(module);
    return !!names && (names.has(name) || names.has('*'));
  });
}

/** The files whose source contains `needle`. */
function filesContaining(needle: string): string[] {
  return FILES.filter((f) => (SOURCE.get(f) ?? '').includes(needle));
}

interface Placement {
  /** The D15 row the control belongs to. */
  row: string;
  module: string;
  name: string;
  /** The only files allowed to import it: the surfaces the row names. */
  allowed: string[];
}

const LAUNCHING_AND_LEVEL_DIALOGS = [
  // The launching level: beside execution mode in the workspace dialogs, the job template edit
  // dialog, and the inventory source edit dialog.
  'components/workspace/CreateWorkspaceDialog.tsx',
  'components/workspace/EditWorkspaceDialog.tsx',
  'pages/Ansible/JobTemplateDetail.tsx',
  'pages/Ansible/InventoryDetail.tsx',
  // The project level: the Edit project dialog on ProjectDetail.
  'components/project/EditProjectDialog.tsx',
  // The organization level: the Run defaults card in Settings > Organization.
  'components/settings/OrgRunDefaults.tsx',
];

// The surfaces that render an effective setting under its control ("Inherited from ...").
const EFFECTIVE_SETTING_SURFACES = [
  'components/workspace/EditWorkspaceDialog.tsx',
  'pages/WorkspaceDetail.tsx',
  'pages/Ansible/JobTemplateDetail.tsx',
  'pages/Ansible/InventoryDetail.tsx',
];

const AGENT_POOLS_PAGE = ['pages/Settings/AgentPools.tsx'];

const PLACEMENTS: Placement[] = [
  {
    row: 'Run images per organization: the Settings-hub page Settings/RunImages.tsx',
    module: 'pages/Settings/RunImages',
    name: 'RunImages',
    allowed: ['appRoutes.tsx'],
  },
  {
    row: 'Run image at the launching, project and organization levels',
    module: 'components/settings/RunPlacementFields',
    name: 'RunImageSelect',
    allowed: LAUNCHING_AND_LEVEL_DIALOGS,
  },
  {
    row: 'Identity binding at the launching, project and organization levels',
    module: 'components/settings/RunPlacementFields',
    name: 'IdentityBindingSelect',
    allowed: LAUNCHING_AND_LEVEL_DIALOGS,
  },
  {
    row: 'Effective settings with the level each came from: the "Inherited from ..." hint',
    module: 'components/settings/RunPlacementFields',
    name: 'InheritedHint',
    allowed: EFFECTIVE_SETTING_SURFACES,
  },
  {
    row: 'Effective settings: the read the hints render',
    module: 'api/runPlacement',
    name: 'effectiveSettingsApi',
    allowed: EFFECTIVE_SETTING_SURFACES,
  },
  {
    row: 'The project level: an Edit project dialog on ProjectDetail.tsx',
    module: 'components/project/EditProjectDialog',
    name: 'EditProjectDialog',
    allowed: ['pages/ProjectDetail.tsx'],
  },
  {
    row: 'The organization level: a Run defaults card in Settings/Organization.tsx',
    module: 'components/settings/OrgRunDefaults',
    name: 'OrgRunDefaults',
    allowed: ['pages/Settings/Organization.tsx'],
  },
  {
    row: "Identity bindings per pool: embedded in the pool's expanded row of Settings/AgentPools.tsx",
    module: 'components/settings/AgentPoolIdentityBindings',
    name: 'AgentPoolIdentityBindings',
    allowed: AGENT_POOLS_PAGE,
  },
  {
    row: "Registry pull Secrets per pool: the pool's expanded row, beside the identity bindings",
    module: 'components/settings/AgentPoolPullSecrets',
    name: 'AgentPoolPullSecrets',
    allowed: AGENT_POOLS_PAGE,
  },
  {
    row: "Pool settings, read-only kind, driver, network mode and hosted group: the pool's expanded row",
    module: 'components/settings/PoolPlacementSettings',
    name: 'PoolSettingsSummary',
    allowed: AGENT_POOLS_PAGE,
  },
  {
    row: "Deployment-level settings: read-only on the pool's expanded row",
    module: 'components/settings/PoolPlacementSettings',
    name: 'DeploymentSettingsPanel',
    allowed: AGENT_POOLS_PAGE,
  },
  {
    row: 'Hosted capacity, cap and placement group: the row at the top of Settings/AgentPools.tsx',
    module: 'components/settings/HostedCapacity',
    name: 'HostedCapacity',
    allowed: AGENT_POOLS_PAGE,
  },
  {
    row: 'Placement record and queue reason: the run and job detail pages',
    module: 'components/runners/PlacementRecord',
    name: 'PlacementRecord',
    allowed: ['pages/RunDetail.tsx', 'pages/Ansible/JobDetail.tsx'],
  },
  {
    row: 'Queue reason on a waiting run or job: the run and job timelines',
    module: 'lib/placement',
    name: 'queueReasonText',
    allowed: ['components/runners/PlacementRecord.tsx'],
  },
  // The write clients of the per-organization and per-pool resources, held to the surface that
  // owns each (the run placement hooks only list them for the pickers).
  {
    row: 'Run images per organization: writes',
    module: 'api/runPlacement',
    name: 'runImagesApi',
    allowed: ['pages/Settings/RunImages.tsx', 'hooks/useRunPlacement.ts'],
  },
  {
    row: 'Identity bindings per pool: writes',
    module: 'api/runPlacement',
    name: 'identityBindingsApi',
    allowed: ['components/settings/AgentPoolIdentityBindings.tsx', 'hooks/useRunPlacement.ts'],
  },
  {
    row: 'Registry pull Secrets per pool: writes',
    module: 'api/runPlacement',
    name: 'pullSecretsApi',
    allowed: ['components/settings/AgentPoolPullSecrets.tsx'],
  },
];

/** Controls that are not components of their own, held by the text that renders or calls them. */
const TEXT_PLACEMENTS: { row: string; needle: string; allowed: string[] }[] = [
  {
    row: 'Registry credential: one more type in the Ansible/Credentials.tsx create dialog',
    needle: "value: 'registry'",
    allowed: ['pages/Ansible/Credentials.tsx'],
  },
  {
    row: 'Drain: the runner detail page action menu',
    needle: 'runnersApi.drain(',
    allowed: ['pages/Settings/RunnerDetail.tsx'],
  },
];

describe('D15 UI placement (AC66): every control is on the surface its row names and nowhere else', () => {
  it('reads imports the way the source writes them', () => {
    // The parser must see a named import, a multi-line one and a lazy route, or every equality
    // below could pass by seeing nothing.
    expect(importersOf('components/settings/AgentPoolIdentityBindings', 'AgentPoolIdentityBindings')).toContain('pages/Settings/AgentPools.tsx');
    expect(importersOf('pages/Settings/RunImages', 'RunImages')).toContain('appRoutes.tsx');
    expect(resolveSpecifier('pages/Settings/AgentPools.tsx', '../../lib/placement')).toBe('lib/placement');
  });

  for (const p of PLACEMENTS) {
    it(`${p.module} ${p.name}: ${p.row}`, () => {
      expect(importersOf(p.module, p.name).sort()).toEqual([...p.allowed].sort());
    });
  }

  for (const t of TEXT_PLACEMENTS) {
    it(`${t.needle}: ${t.row}`, () => {
      expect(filesContaining(t.needle).sort()).toEqual([...t.allowed].sort());
    });
  }
});
