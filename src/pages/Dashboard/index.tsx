// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useAuth } from '@/contexts/AuthContext';
import { useActivityNotifications } from '@/hooks/useActivityNotifications';
import { AttentionList } from './AttentionList';
import { GettingStarted } from './GettingStarted';
import { LiveOperations } from './LiveOperations';
import { Organizations } from './Organizations';
import { RecentActivityCard } from './RecentActivityCard';
import { onboardingState, shouldShowGettingStarted } from './onboarding';
import { useDashboardStats } from './useDashboardData';

/**
 * The post-login landing page: the one screen that spans organizations.
 *
 * Its job is to tell you *which* organization needs you, and hand you off - so it is deliberately
 * scoped to everything the reader can reach, with no organization selector. An organization-scoped
 * dashboard can only ever be a lesser copy of that organization's own pages, which are one click
 * away and better at it; spanning tenants is the only thing this page can do that they cannot.
 *
 * That is also why there is no chart here and no shortcut row: the drillable analytics live on
 * Usage & Analytics, and a cross-organization "Workspaces" shortcut has no organization to point
 * at. Selecting the organization you mean is the first real step, so the organization list is the
 * navigation.
 */
export default function Dashboard() {
  const { session } = useAuth();
  const stats = useDashboardStats();

  // Toasts for activity that arrives while the dashboard is open. Shares its query with the Recent
  // Activity card, so the two do not each poll the same endpoint.
  useActivityNotifications(true, 30_000);

  const onboarding = onboardingState(stats.data);
  // Still loading is not the same as "you have nothing": the checklist would flash on every visit.
  const showGettingStarted = !stats.isLoading && shouldShowGettingStarted(onboarding);
  const firstOrgName = stats.data?.organizations?.[0]?.name;

  const greetingName = session?.user.given_name || session?.user.name;
  const orgCount = stats.data?.organizations?.length ?? 0;

  const retry = () => {
    void stats.refetch();
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="mb-2 bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 dark:from-purple-400 dark:via-violet-400 dark:to-indigo-400 bg-clip-text text-3xl font-bold text-transparent sm:text-4xl">
          Welcome back{greetingName ? `, ${greetingName}` : ''}
        </h1>
        <p className="text-muted-foreground">
          {orgCount > 0
            ? `What needs you across your ${orgCount === 1 ? 'organization' : `${orgCount} organizations`}`
            : 'Create an organization to start managing infrastructure'}
        </p>
      </header>

      {showGettingStarted ? (
        // Replaces the operational sections rather than sitting alongside them: an estate with no
        // workspace has no attention items and nothing in flight to report.
        <GettingStarted state={onboarding} firstOrgName={firstOrgName} />
      ) : (
        <>
          <AttentionList
            stats={stats.data}
            isLoading={stats.isLoading}
            isError={stats.isError}
            onRetry={retry}
          />
          <LiveOperations />
        </>
      )}

      <Organizations
        stats={stats.data}
        isLoading={stats.isLoading}
        isError={stats.isError}
        onRetry={retry}
      />

      <RecentActivityCard />
    </div>
  );
}
