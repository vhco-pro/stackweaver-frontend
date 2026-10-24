// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { createContext, useContext, type CSSProperties } from 'react';

/**
 * A page's colour ramp: the one entry both its title gradient and its primary button ring read.
 *
 * Every page outside Settings uses `app`. Each Settings topic keeps its own entry, and the topic
 * colour rides the heading and the button alike (owner decision, 2026-10-10). Because both come
 * from one entry they cannot disagree, which is the drift this map exists to end - see
 * `docs/internal/guidelines/frontend/page-header-pattern.md`.
 *
 * Class strings are written out in full so Tailwind can see them; never build one by
 * interpolation.
 */
export interface Ramp {
  /** The three ring stops, read by `.gradient-ring-btn` through `--sw-ring-c1/c2/c3`. */
  ring: readonly [string, string, string];
  /** Title gradient stops: saturated `-600` in light, pale `-400` behind `dark:`. */
  title: string;
  /** Colour of the icon beside the title, matching the ramp's first stop. */
  icon: string;
}

// Tailwind's -500 palette as hex, matching the stops already written into index.css.
const violet = '#8b5cf6';
const indigo = '#6366f1';
const blue = '#3b82f6';
const purple = '#a855f7';
const pink = '#ec4899';
const teal = '#14b8a6';
const cyan = '#06b6d4';
const rose = '#f43f5e';
const orange = '#f97316';
const sky = '#0ea5e9';
const fuchsia = '#d946ef';
const amber = '#f59e0b';
const emerald = '#10b981';

export const RAMPS = {
  app: {
    ring: [violet, indigo, blue],
    title: 'from-violet-600 via-indigo-600 to-blue-600 dark:from-violet-400 dark:via-indigo-400 dark:to-blue-400',
    icon: 'text-violet-600 dark:text-violet-400',
  },
  runners: {
    ring: [purple, pink, purple],
    title: 'from-purple-600 via-pink-600 to-purple-600 dark:from-purple-400 dark:via-pink-400 dark:to-purple-400',
    icon: 'text-purple-600 dark:text-purple-400',
  },
  agentPools: {
    ring: [teal, cyan, teal],
    title: 'from-teal-600 via-cyan-600 to-teal-600 dark:from-teal-400 dark:via-cyan-400 dark:to-teal-400',
    icon: 'text-teal-600 dark:text-teal-400',
  },
  apiKeys: {
    ring: [cyan, blue, cyan],
    title: 'from-cyan-600 via-blue-600 to-cyan-600 dark:from-cyan-400 dark:via-blue-400 dark:to-cyan-400',
    icon: 'text-cyan-600 dark:text-cyan-400',
  },
  changeRequests: {
    ring: [rose, orange, rose],
    title: 'from-rose-600 via-orange-600 to-rose-600 dark:from-rose-400 dark:via-orange-400 dark:to-rose-400',
    icon: 'text-rose-600 dark:text-rose-400',
  },
  oidc: {
    ring: [sky, blue, sky],
    title: 'from-sky-600 via-blue-600 to-sky-600 dark:from-sky-400 dark:via-blue-400 dark:to-sky-400',
    icon: 'text-sky-600 dark:text-sky-400',
  },
  personalTokens: {
    ring: [purple, fuchsia, purple],
    title: 'from-purple-600 via-fuchsia-600 to-purple-600 dark:from-purple-400 dark:via-fuchsia-400 dark:to-purple-400',
    icon: 'text-purple-600 dark:text-purple-400',
  },
  runTasks: {
    ring: [amber, orange, amber],
    title: 'from-amber-600 via-orange-600 to-amber-600 dark:from-amber-400 dark:via-orange-400 dark:to-amber-400',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  credentials: {
    ring: [amber, orange, amber],
    title: 'from-amber-600 via-orange-600 to-amber-600 dark:from-amber-400 dark:via-orange-400 dark:to-amber-400',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  tofuVersions: {
    ring: [emerald, teal, emerald],
    title: 'from-emerald-600 via-teal-600 to-emerald-600 dark:from-emerald-400 dark:via-teal-400 dark:to-emerald-400',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
  variableSets: {
    ring: [blue, indigo, blue],
    title: 'from-blue-600 via-indigo-600 to-blue-600 dark:from-blue-400 dark:via-indigo-400 dark:to-blue-400',
    icon: 'text-blue-600 dark:text-blue-400',
  },
  notifications: {
    ring: [indigo, blue, cyan],
    title: 'from-indigo-600 via-blue-600 to-cyan-600 dark:from-indigo-400 dark:via-blue-400 dark:to-cyan-400',
    icon: 'text-indigo-600 dark:text-indigo-400',
  },
  preferences: {
    ring: [indigo, violet, indigo],
    title: 'from-indigo-600 via-violet-600 to-indigo-600 dark:from-indigo-400 dark:via-violet-400 dark:to-indigo-400',
    icon: 'text-indigo-600 dark:text-indigo-400',
  },
  account: {
    ring: [blue, cyan, blue],
    title: 'from-blue-600 via-cyan-600 to-blue-600 dark:from-blue-400 dark:via-cyan-400 dark:to-blue-400',
    icon: 'text-blue-600 dark:text-blue-400',
  },
  // Install-wide pages, which act on every organization: a hue no organization or personal
  // Settings page starts on, so a platform page never reads as one of those.
  platform: {
    ring: [pink, rose, pink],
    title: 'from-pink-600 via-rose-600 to-pink-600 dark:from-pink-400 dark:via-rose-400 dark:to-pink-400',
    icon: 'text-pink-600 dark:text-pink-400',
  },
  integrations: {
    ring: [blue, indigo, purple],
    title: 'from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400',
    icon: 'text-blue-600 dark:text-blue-400',
  },
} as const satisfies Record<string, Ramp>;

export type RampName = keyof typeof RAMPS;

/**
 * Which ramp each Settings page uses, keyed by its path under `pages/`. The colours are the ones
 * each page carried before the sweep. A Settings page that had no gradient takes its topic's
 * ramp where it belongs to one (`RunnerDetail`) and the app ramp otherwise.
 */
export const SETTINGS_PAGE_RAMPS: Record<string, RampName> = {
  'Settings.tsx': 'app',
  'Settings/AgentPools.tsx': 'agentPools',
  'Settings/AnsibleConfig.tsx': 'app',
  'Settings/ApiKeys.tsx': 'apiKeys',
  'Settings/ChangeRequests.tsx': 'changeRequests',
  'Settings/Notifications.tsx': 'notifications',
  'Settings/OIDCConfigurations.tsx': 'oidc',
  'Settings/Organization.tsx': 'app',
  'Settings/OrganizationTokenSettings.tsx': 'apiKeys',
  'Settings/PersonalAccessTokens.tsx': 'personalTokens',
  'Settings/PlatformAdministrators.tsx': 'platform',
  'Settings/PlatformOrganizations.tsx': 'platform',
  'Settings/Preferences.tsx': 'preferences',
  'Settings/Profile.tsx': 'account',
  'Settings/RunTasks.tsx': 'runTasks',
  'Settings/RunnerDetail.tsx': 'runners',
  'Settings/Runners.tsx': 'runners',
  'Settings/Security.tsx': 'account',
  'Settings/Sessions.tsx': 'account',
  'Settings/TeamDetail.tsx': 'account',
  'Settings/TofuVersions.tsx': 'tofuVersions',
  'Settings/Users.tsx': 'app',
  'Settings/VCSConnections.tsx': 'integrations',
  'Settings/VariableSets.tsx': 'variableSets',
  'Settings/Webhooks.tsx': 'integrations',
  'Ansible/Credentials.tsx': 'credentials',
};

/** The ring stops as the custom properties `.gradient-ring-btn` reads with fallbacks. */
export function rampVars(name: RampName): CSSProperties {
  const [c1, c2, c3] = RAMPS[name].ring;
  return { '--sw-ring-c1': c1, '--sw-ring-c2': c2, '--sw-ring-c3': c3 } as CSSProperties;
}

/**
 * The ramp of the page being rendered. `Page` provides it. Custom properties inherit down the
 * DOM, but a dialog renders through a portal outside the page, so anything portaled reads the
 * ramp from here instead.
 */
export const RampContext = createContext<RampName>('app');

export function useRamp(): RampName {
  return useContext(RampContext);
}
