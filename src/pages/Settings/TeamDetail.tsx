// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { teamsApi } from '@/api/client';
import { WorkspaceNotifications } from '@/components/workspace/WorkspaceNotifications';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Users } from 'lucide-react';

/**
 * TeamDetail is the per-team settings page. Teams are otherwise managed from a tab inside the Users
 * page with a modal, which has no room for a notifications section; this page follows the existing
 * runners -> runners/:runnerId precedent instead of growing that dialog further.
 *
 * Its only section today is team notifications (tfe_team_notification_configuration), which fire when a
 * change request is filed against any workspace the team can reach.
 */
export default function TeamDetail() {
  const { orgName, teamId } = useParams<{ orgName: string; teamId: string }>();

  const { data: team, isLoading, error } = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => teamsApi.get(teamId ?? ''),
    enabled: !!teamId,
  });

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-4">
        <Link to={orgName ? `/app/${orgName}/settings/users` : '/settings'}>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground"
            aria-label="Back to Users & Teams"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent mb-2">
            {team?.name ?? 'Team'}
          </h1>
          <p className="text-muted-foreground">Notification settings for this team</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error || !team ? (
        <div className="rounded-2xl border border-dashed border-white/20 dark:border-white/10 p-8 text-center text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Team not found.</p>
          <p className="text-sm mt-1">It may have been deleted, or you may not have access to it.</p>
        </div>
      ) : (
        <WorkspaceNotifications scope="teams" id={team.id} />
      )}
    </div>
  );
}
