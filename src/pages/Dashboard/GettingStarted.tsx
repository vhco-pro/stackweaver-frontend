// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Link } from 'react-router-dom';
import { Rocket } from 'lucide-react';
import { AnalyticsCard } from '@/components/ui/analytics-card';
import type { OnboardingState } from './onboarding';

/** The onboarding checklist, shown in place of the operational sections until the estate exists. */
export function GettingStarted({
  state,
  firstOrgName,
}: {
  state: OnboardingState;
  firstOrgName?: string;
}) {
  const steps = [
    {
      done: state.hasOrganization,
      title: 'Create an organization',
      body: 'Set up your first organization to hold projects and workspaces.',
      cta: 'Create organization',
      to: '/organizations',
      gradient: 'from-purple-500 to-violet-500',
    },
    {
      done: state.hasProject,
      title: 'Create your first project',
      body: 'Projects group the workspaces that belong to one system.',
      cta: 'Create project',
      to: '/projects',
      gradient: 'from-violet-500 to-indigo-500',
    },
    {
      done: state.hasWorkspace,
      title: 'Set up a workspace',
      body: 'A workspace holds one OpenTofu state and the runs that change it.',
      cta: 'Create workspace',
      to: firstOrgName ? `/app/${firstOrgName}/workspaces` : '/organizations',
      gradient: 'from-indigo-500 to-blue-500',
    },
  ];

  return (
    <AnalyticsCard
      title="Getting started"
      hint="Three steps to your first OpenTofu run"
      icon={<Rocket className="h-4 w-4 text-purple-400" />}
    >
      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="flex items-start gap-3 rounded-xl border border-gray-300/70 dark:border-white/10 p-4"
          >
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-to-br ${step.gradient} text-xs font-semibold text-white`}
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">
                {step.title}
                {step.done && (
                  <span className="ml-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">Done</span>
                )}
              </span>
              <span className="block text-xs text-muted-foreground">{step.body}</span>
              {!step.done && (
                <Link
                  to={step.to}
                  className="mt-2 inline-block text-xs font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                >
                  {step.cta} →
                </Link>
              )}
            </span>
          </li>
        ))}
      </ol>
    </AnalyticsCard>
  );
}
