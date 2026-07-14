// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OrganizationToken } from '@/components/settings/OrganizationToken';

/**
 * OrganizationTokenSettings is the dedicated Organization Settings page for the single organization
 * API token (tfe_organization_token) - mirroring TFE's "Organization Settings → API Token" page,
 * separate from user API tokens and org API keys.
 */
export default function OrganizationTokenSettings() {
  const { orgName } = useParams<{ orgName: string }>();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to={orgName ? `/app/${orgName}/settings` : '/settings'}>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/10 dark:hover:bg-black/10 transition-colors"
            aria-label="Back to Settings"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
            Organization Token
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            A single API token for the whole organization, used by CI and automation (for example the{' '}
            <code className="px-1 py-0.5 rounded-sm bg-muted text-xs">tfe_organization_token</code> resource).
            It has organization-admin access - treat it like a password. Only one exists at a time, and
            regenerating it revokes the previous token.
          </p>
        </div>
      </div>

      {orgName && <OrganizationToken orgName={orgName} />}
    </div>
  );
}
