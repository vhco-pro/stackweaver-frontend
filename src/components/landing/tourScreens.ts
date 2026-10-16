// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { FileDiff, FolderOpen, GitPullRequest, Layers, LayoutDashboard, Play, Server, type LucideIcon } from 'lucide-react';
import manifest from './tourManifest.json';

// The captures are imported, not served from public/, so the bundler gives each a
// content-hashed name: the production web server caches static files for a year.
import dashboardDark from '@/assets/landing/dashboard-dark.webp';
import dashboardLight from '@/assets/landing/dashboard-light.webp';
import workspacesDark from '@/assets/landing/workspaces-dark.webp';
import workspacesLight from '@/assets/landing/workspaces-light.webp';
import workspaceDark from '@/assets/landing/workspace-dark.webp';
import workspaceLight from '@/assets/landing/workspace-light.webp';
import runsDark from '@/assets/landing/runs-dark.webp';
import runsLight from '@/assets/landing/runs-light.webp';
import runDark from '@/assets/landing/run-dark.webp';
import runLight from '@/assets/landing/run-light.webp';
import jobDark from '@/assets/landing/job-dark.webp';
import jobLight from '@/assets/landing/job-light.webp';
import runnersDark from '@/assets/landing/runners-dark.webp';
import runnersLight from '@/assets/landing/runners-light.webp';

/** The address a screen was captured at, as the capture script recorded it. */
const capturedPath = (id: string): string => manifest.screens.find((screen) => screen.id === id)?.path ?? '/';

export type TourScreenId = 'dashboard' | 'workspaces' | 'workspace' | 'runs' | 'run' | 'job' | 'runners';

export interface TourScreen {
  id: TourScreenId;
  /** The short name on the screen's pill. */
  label: string;
  icon: LucideIcon;
  /** The path shown in the product window's address bar: where the capture was taken. */
  url: string;
  title: string;
  description: string;
  /** A capture of the real page, one per theme. */
  image: { dark: string; light: string };
}

// The stage's scroll budget, in viewport heights: the hero's exit, one step per screen, and a
// short hold on the last screen before the stage releases.
export const STAGE_HERO = 0.7;
export const STAGE_STEP = 0.28;
export const STAGE_TAIL = 0.2;

export const TOUR_INTERVAL_MS = 7000;

export const TOUR_SCREENS: TourScreen[] = [
  {
    id: 'dashboard',
    url: capturedPath('dashboard'),
    label: 'Dashboard',
    icon: LayoutDashboard,
    title: 'The dashboard you land on',
    description:
      'One page across every organization you belong to. It opens with what needs you: a run waiting for someone to apply, a failing job template, an offline runner and open change requests.',
    image: { dark: dashboardDark, light: dashboardLight },
  },
  {
    id: 'workspaces',
    url: capturedPath('workspaces'),
    label: 'Workspaces',
    icon: FolderOpen,
    title: 'Every workspace in one list',
    description: 'Filter by status, tag or project. One glance tells you which environments applied cleanly, which one is applying right now and which one is waiting for you.',
    image: { dark: workspacesDark, light: workspacesLight },
  },
  {
    id: 'workspace',
    url: capturedPath('workspace'),
    label: 'Workspace',
    icon: Layers,
    title: 'Inside a workspace',
    description:
      'The latest run and what it changed, the resources in state, and tabs for runs, state versions, variables, notifications, change requests and run tasks.',
    image: { dark: workspaceDark, light: workspaceLight },
  },
  {
    id: 'runs',
    url: capturedPath('runs'),
    label: 'GitOps runs',
    icon: GitPullRequest,
    title: 'Runs, driven from Git',
    description:
      'Every run shows the branch, commit and author that triggered it. A merge to main plans and applies, and a pull request gets its own plan-only run.',
    image: { dark: runsDark, light: runsLight },
  },
  {
    id: 'run',
    url: capturedPath('run'),
    label: 'Plan review',
    icon: FileDiff,
    title: 'Read the plan before you apply',
    description: 'Every change the plan would make, before anything is applied. Expand a resource for its diff, filter by action, or open the raw OpenTofu output.',
    image: { dark: runDark, light: runLight },
  },
  {
    id: 'job',
    url: capturedPath('job'),
    label: 'Ansible jobs',
    icon: Play,
    title: 'An Ansible job, host by task',
    description:
      'A certificate rotation across ten hosts as a matrix. One host failed and one was unreachable, and you find both without reading the log.',
    image: { dark: jobDark, light: jobLight },
  },
  {
    id: 'runners',
    url: capturedPath('runners'),
    label: 'Runners',
    icon: Server,
    title: 'Runners you host yourself',
    description: 'Self-hosted runners grouped into agent pools. OpenTofu and Ansible workloads share the same fleet, inside your own network.',
    image: { dark: runnersDark, light: runnersLight },
  },
];
