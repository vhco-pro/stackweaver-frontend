// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useParams } from 'react-router-dom';
import { KeySquare } from 'lucide-react';
import { Page } from '@/components/layout/Page';
import { PageHeader } from '@/components/layout/PageHeader';
import { OrganizationToken } from '@/components/settings/OrganizationToken';

/**
 * OrganizationTokenSettings is the dedicated Organization Settings page for the single organization
 * API token (tfe_organization_token) - mirroring TFE's "Organization Settings → API Token" page,
 * separate from user API tokens and org API keys.
 */
export default function OrganizationTokenSettings() {
  const { orgName } = useParams<{ orgName: string }>();

  return (
    <Page ramp="apiKeys" className="space-y-8">
      {/* Header */}
      <PageHeader
        icon={KeySquare}
        title="Organization Token"
        subtitle={
          <p className="max-w-2xl">
            A single API token for the whole organization, used by CI and automation (for example the{' '}
            <code className="px-1 py-0.5 rounded-sm bg-muted text-xs">tfe_organization_token</code> resource).
            It has organization-admin access - treat it like a password. Only one exists at a time, and
            regenerating it revokes the previous token.
          </p>
        }
        backTo={{ to: orgName ? `/app/${orgName}/settings` : '/settings', label: 'Back to Settings' }}
      />

      {orgName && <OrganizationToken orgName={orgName} />}

      {/* Audit trail token (tfe_audit_trail_token): a distinct, read-only singleton for the org's
          audit surface. Shares the endpoint via ?token=audit-trails and coexists with the org token. */}
      <div className="pt-4 border-t border-white/10 dark:border-white/5">
        <div className="mb-4">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-600 dark:from-amber-400 via-orange-600 dark:via-orange-400 to-amber-600 dark:to-amber-400 bg-clip-text text-transparent mb-2">
            Audit Trail Token
          </h2>
          <p className="text-muted-foreground max-w-2xl">
            A separate, read-only token for the organization's audit trail (the{' '}
            <code className="px-1 py-0.5 rounded-sm bg-muted text-xs">tfe_audit_trail_token</code> resource).
            It can read audit data but cannot make changes, and it is independent of the Organization Token
            above - an organization can hold both. Only one exists at a time; regenerating revokes the
            previous token.
          </p>
        </div>
        {orgName && <OrganizationToken orgName={orgName} tokenType="audit-trails" label="audit trail" />}
      </div>
    </Page>
  );
}
