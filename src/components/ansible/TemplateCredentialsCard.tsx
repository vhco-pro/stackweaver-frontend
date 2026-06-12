// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ansibleJobTemplatesApi, type AnsibleCredential } from '@/api/ansible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Key, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

interface AttachedCredential {
  id: string;
  name: string;
  credential_type: string;
  vault_id?: string;
  username?: string;
}

interface TemplateCredentialsCardProps {
  templateId: string;
  canManage: boolean;
  /** The org's credentials, for the attach dropdown. */
  orgCredentials: AnsibleCredential[];
}

/**
 * The template's multi-credential attachment set (AWX-style): at most one
 * credential per type, plus any number of vault credentials with distinct
 * vault IDs. The backend enforces the rule; conflicts surface as toasts.
 */
export function TemplateCredentialsCard({ templateId, canManage, orgCredentials }: TemplateCredentialsCardProps) {
  const queryClient = useQueryClient();
  const [selectedCredential, setSelectedCredential] = useState('');
  const [busy, setBusy] = useState(false);

  const queryKey = ['templateCredentials', templateId];
  const { data: attached = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await ansibleJobTemplatesApi.listCredentials(templateId);
      return (res.data || []).map((r): AttachedCredential => ({
        id: r.id,
        name: (r.attributes?.name as string) || '',
        credential_type: (r.attributes?.['credential-type'] as string) || '',
        vault_id: r.attributes?.['vault-id'] as string | undefined,
        username: r.attributes?.username as string | undefined,
      }));
    },
    enabled: !!templateId,
  });

  const attachable = orgCredentials.filter((c) => !attached.some((a) => a.id === c.id));

  const refresh = () => { void queryClient.invalidateQueries({ queryKey }); };

  const handleAttach = async () => {
    if (!selectedCredential) return;
    setBusy(true);
    try {
      await ansibleJobTemplatesApi.attachCredential(templateId, selectedCredential);
      setSelectedCredential('');
      refresh();
      toast.success('Credential attached');
    } catch (err: unknown) {
      console.error('Failed to attach credential:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to attach credential');
    } finally {
      setBusy(false);
    }
  };

  const handleDetach = async (credentialId: string) => {
    setBusy(true);
    try {
      await ansibleJobTemplatesApi.detachCredential(templateId, credentialId);
      refresh();
      toast.success('Credential detached');
    } catch (err: unknown) {
      console.error('Failed to detach credential:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to detach credential');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Key className="h-5 w-5" />
          Credentials
        </CardTitle>
        <CardDescription>
          One credential per type; multiple vault credentials with distinct vault IDs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading credentials...
          </div>
        ) : attached.length === 0 ? (
          <p className="text-sm text-muted-foreground">No credentials attached.</p>
        ) : (
          <div className="space-y-2">
            {attached.map((cred) => (
              <div key={cred.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate font-medium">{cred.name}</span>
                  <Badge variant="outline">{cred.credential_type}</Badge>
                  {cred.vault_id && <Badge variant="secondary">vault-id: {cred.vault_id}</Badge>}
                </div>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    disabled={busy}
                    onClick={() => { void handleDetach(cred.id); }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {canManage && (
          <div className="flex items-center gap-2">
            <Select value={selectedCredential} onValueChange={setSelectedCredential}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Attach a credential" />
              </SelectTrigger>
              <SelectContent>
                {attachable.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">No credentials available</div>
                ) : (
                  attachable.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.type})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              disabled={busy || !selectedCredential}
              onClick={() => { void handleAttach(); }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Attach
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
