// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, GitPullRequest, KeyRound, Loader2, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { organizationsApi, type Organization } from '@/api/client';
import { toast } from 'sonner';

// Settings → Organization: the org-level TFE-compatible settings (tfe_organization). Every toggle
// maps 1:1 onto a kebab-case attribute of PATCH /api/v2/organizations/:name.

/** One boolean policy row: label + description + immediate-PATCH switch. */
function PolicyRow({
  id,
  label,
  description,
  checked,
  disabled,
  onToggle,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <div className="space-y-1">
        <Label htmlFor={id} className="font-medium">{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => { onToggle(value); }}
        aria-label={label}
      />
    </div>
  );
}

export default function OrganizationSettings() {
  const { orgName } = useParams<{ orgName: string }>();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState('');
  const [authPolicy, setAuthPolicy] = useState<'password' | 'two_factor_mandatory'>('password');
  const [generalDirty, setGeneralDirty] = useState(false);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingFlag, setSavingFlag] = useState<string | null>(null);
  const [lastSyncedKey, setLastSyncedKey] = useState<string | undefined>(undefined);

  const { data: org = null, isLoading, isError, refetch } = useQuery({
    queryKey: ['orgSettings', orgName],
    queryFn: async (): Promise<Organization> => organizationsApi.get(orgName!),
    enabled: !!orgName,
  });

  // Sync the editable general fields from server data when it changes (adjust-state-during-render).
  const dataKey = org ? `${org.name}:${org.email ?? ''}:${org.collaborator_auth_policy ?? ''}` : 'none';
  if (dataKey !== lastSyncedKey) {
    setLastSyncedKey(dataKey);
    if (org) {
      setEmail(org.email ?? '');
      setAuthPolicy(org.collaborator_auth_policy ?? 'password');
      setGeneralDirty(false);
    }
  }

  const patchOrg = async (attributes: Record<string, unknown>) => {
    await organizationsApi.update(orgName!, {
      data: { type: 'organizations', attributes },
    });
    await refetch();
    // The org list carries the same attributes - keep pickers fresh.
    void queryClient.invalidateQueries({ queryKey: ['organizations'] });
  };

  const handleSaveGeneral = async () => {
    if (!orgName) return;
    setSavingGeneral(true);
    try {
      await patchOrg({ email, 'collaborator-auth-policy': authPolicy });
      toast.success('Organization settings saved');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save organization settings');
    } finally {
      setSavingGeneral(false);
    }
  };

  // Toggle a single boolean attribute; `extra` lets mutually-exclusive pairs flip together.
  const toggleFlag = (attribute: string, value: boolean, extra: Record<string, unknown> = {}) => {
    if (!orgName) return;
    setSavingFlag(attribute);
    void (async () => {
      try {
        await patchOrg({ [attribute]: value, ...extra });
        toast.success('Setting updated');
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to update setting');
      } finally {
        setSavingFlag(null);
      }
    })();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !org) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-muted-foreground">Failed to load organization settings.</p>
        <Button variant="outline" onClick={() => { void refetch(); }}>Retry</Button>
      </div>
    );
  }

  const busy = savingFlag !== null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={`/app/${orgName}/settings`}>
          <Button variant="ghost" size="icon" aria-label="Back to settings">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20">
            <Building2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Organization Settings</h1>
            <p className="text-sm text-muted-foreground">
              General settings and policies for {org.name} (TFE-compatible: tfe_organization)
            </p>
          </div>
        </div>
      </div>

      {/* General */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            General
          </CardTitle>
          <CardDescription>
            The organization's admin contact and authentication policy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="org-email">Admin email</Label>
              <Input
                id="org-email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setGeneralDirty(true); }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-auth-policy">Collaborator authentication policy</Label>
              <Select
                value={authPolicy}
                onValueChange={(value) => { setAuthPolicy(value as typeof authPolicy); setGeneralDirty(true); }}
              >
                <SelectTrigger id="org-auth-policy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="password">Password</SelectItem>
                  <SelectItem value="two_factor_mandatory">Two-factor mandatory</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Stored for TFE compatibility; enforcement arrives with the identity-provider MFA integration.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => { void handleSaveGeneral(); }}
              disabled={savingGeneral || !generalDirty}
            >
              {savingGeneral ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Workspace policies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Workspace Policies
          </CardTitle>
          <CardDescription>
            Organization-wide rules every workspace inherits.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <PolicyRow
            id="allow-force-delete"
            label="Allow force-deleting workspaces"
            description="Let workspace admins delete workspaces with resources under management. When off, only organization owners may."
            checked={org.allow_force_delete_workspaces ?? false}
            disabled={busy}
            onToggle={(value) => { toggleFlag('allow-force-delete-workspaces', value); }}
          />
          <PolicyRow
            id="assessments-enforced"
            label="Enforce health assessments"
            description="Run drift detection on every eligible workspace, regardless of each workspace's own assessment setting."
            checked={org.assessments_enforced ?? false}
            disabled={busy}
            onToggle={(value) => { toggleFlag('assessments-enforced', value); }}
          />
          <PolicyRow
            id="cost-estimation"
            label="Cost estimation"
            description="Estimate the cost of planned changes. The estimation engine is under development - this setting is stored for TFE compatibility."
            checked={org.cost_estimation_enabled ?? true}
            disabled={busy}
            onToggle={(value) => { toggleFlag('cost-estimation-enabled', value); }}
          />
        </CardContent>
      </Card>

      {/* Pull request statuses */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitPullRequest className="h-5 w-5" />
            Pull Request Behavior
          </CardTitle>
          <CardDescription>
            How speculative (PR) plans and their commit statuses behave across the organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <PolicyRow
            id="speculative-plan-management"
            label="Speculative plan management"
            description="Cancel pending speculative plans from outdated commits when a newer commit is pushed to the same branch."
            checked={org.speculative_plan_management_enabled ?? true}
            disabled={busy}
            onToggle={(value) => { toggleFlag('speculative-plan-management-enabled', value); }}
          />
          <PolicyRow
            id="aggregated-commit-status"
            label="Aggregated status checks"
            description="Post one rolled-up commit status per PR instead of one per workspace - useful for monorepos. Mutually exclusive with passing statuses for untriggered plans."
            checked={org.aggregated_commit_status_enabled ?? false}
            disabled={busy}
            onToggle={(value) => {
              // Mutually exclusive with send-passing (TFE rule) - flip the other off in the same PATCH.
              toggleFlag('aggregated-commit-status-enabled', value,
                value ? { 'send-passing-statuses-for-untriggered-speculative-plans': false } : {});
            }}
          />
          <PolicyRow
            id="send-passing-statuses"
            label="Passing statuses for untriggered plans"
            description="Post a passing status for connected workspaces a PR does not trigger (path filtering), so required checks never block."
            checked={org.send_passing_statuses_for_untriggered_speculative_plans ?? false}
            disabled={busy}
            onToggle={(value) => {
              toggleFlag('send-passing-statuses-for-untriggered-speculative-plans', value,
                value ? { 'aggregated-commit-status-enabled': false } : {});
            }}
          />
        </CardContent>
      </Card>

      {/* Access */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Token Access
          </CardTitle>
          <CardDescription>
            Which token kinds may access this organization's API.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <PolicyRow
            id="user-tokens-enabled"
            label="Allow user tokens"
            description="Let personal (user-bound) API tokens access this organization. When off, only the organization token works - organization owners stay exempt so you cannot lock yourself out."
            checked={org.user_tokens_enabled ?? true}
            disabled={busy}
            onToggle={(value) => { toggleFlag('user-tokens-enabled', value); }}
          />
          <div className="flex items-start gap-2 pt-3 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Disabling user tokens blocks non-owner members' personal tokens and <code>terraform login</code> sessions
              against this organization. CI should use the{' '}
              <Link to={`/app/${orgName}/settings/authentication-token`} className="underline underline-offset-2">
                organization token
              </Link>{' '}
              instead.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
