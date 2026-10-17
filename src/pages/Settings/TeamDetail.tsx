// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { teamsApi } from '@/api/client';
import { WorkspaceNotifications } from '@/components/workspace/WorkspaceNotifications';
import { TeamToken } from '@/components/settings/TeamToken';
import { Page } from '@/components/layout/Page';
import { PageHeader } from '@/components/layout/PageHeader';
import { Loader2, Users } from 'lucide-react';

/**
 * TeamDetail is the per-team settings page. Teams are otherwise managed from a tab inside the Users
 * page with a modal, which has no room for extra sections; this page follows the existing
 * runners -> runners/:runnerId precedent instead of growing that dialog further.
 *
 * Sections: the team's API token (tfe_team_token), an automation credential that acts as the team, and
 * team notifications (tfe_team_notification_configuration), which fire when a change request is filed
 * against any workspace the team can reach.
 */
export default function TeamDetail() {
  const { orgName, teamId } = useParams<{ orgName: string; teamId: string }>();

  const { data: team, isLoading, error } = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => teamsApi.get(teamId ?? ''),
    enabled: !!teamId,
  });

  return (
    <Page ramp="account" className="space-y-8">
      <PageHeader
        title={team?.name ?? 'Team'}
        subtitle="Token and notification settings for this team"
        backTo={{ to: orgName ? `/app/${orgName}/settings/users` : '/settings', label: 'Back to Users & Teams' }}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error || !team ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-white/10 p-8 text-center text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Team not found.</p>
          <p className="text-sm mt-1">It may have been deleted, or you may not have access to it.</p>
        </div>
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <div>
              <h2 className="text-xl font-semibold">Team token</h2>
              <p className="text-sm text-muted-foreground">
                An automation credential that acts as this team. Shown once when generated.
              </p>
            </div>
            <TeamToken teamId={team.id} />
          </section>

          <WorkspaceNotifications scope="teams" id={team.id} />
        </div>
      )}
    </Page>
  );
}
