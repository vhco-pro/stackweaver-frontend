// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ansibleNotificationsApi } from '@/api/ansible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bell, Loader2, Plus, Send, X } from 'lucide-react';
import { toast } from 'sonner';

interface NotificationChannel {
  id: string;
  name: string;
  type: string;
}

interface NotificationAttachment {
  id: string;
  templateName: string;
  onStarted: boolean;
  onSuccess: boolean;
  onFailure: boolean;
}

interface TemplateNotificationsCardProps {
  templateId: string;
  orgName: string;
  canManage: boolean;
}

/**
 * Notification attachments for a job template (AWX-style): pick an org
 * notification channel (webhook / email / Teams) and the triggers that fire
 * it. Channels can be created inline and test-sent.
 */
export function TemplateNotificationsCard({ templateId, orgName, canManage }: TemplateNotificationsCardProps) {
  const queryClient = useQueryClient();
  const [selectedChannel, setSelectedChannel] = useState('');
  const [triggers, setTriggers] = useState({ on_started: false, on_success: true, on_failure: true });
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const emptyChannel = { name: '', type: 'webhook' as 'webhook' | 'email' | 'teams', url: '', secret: '', username: '', from: '', to: '', port: '' };
  const [newChannel, setNewChannel] = useState(emptyChannel);

  const channelsKey = ['notificationChannels', orgName];
  const { data: channels = [] } = useQuery({
    queryKey: channelsKey,
    queryFn: async () => {
      const res = await ansibleNotificationsApi.list(orgName);
      return (res.data || []).map((r): NotificationChannel => ({
        id: r.id,
        name: (r.attributes?.name as string) || '',
        type: (r.attributes?.['notification-type'] as string) || '',
      }));
    },
    enabled: !!orgName,
  });

  const attachmentsKey = ['templateNotifications', templateId];
  const { data: attachments = [], isLoading } = useQuery({
    queryKey: attachmentsKey,
    queryFn: async () => {
      const res = await ansibleNotificationsApi.listForJobTemplate(templateId);
      return (res.data || []).map((r): NotificationAttachment => ({
        id: r.id,
        templateName: (r.attributes?.['notification-template-name'] as string) || '',
        onStarted: Boolean(r.attributes?.['on-started']),
        onSuccess: Boolean(r.attributes?.['on-success']),
        onFailure: Boolean(r.attributes?.['on-failure']),
      }));
    },
    enabled: !!templateId,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: attachmentsKey });
    void queryClient.invalidateQueries({ queryKey: channelsKey });
  };

  const handleAttach = async () => {
    if (!selectedChannel) return;
    setBusy(true);
    try {
      await ansibleNotificationsApi.attach(orgName, {
        notification_template_id: selectedChannel,
        job_template_id: templateId,
        ...triggers,
      });
      setSelectedChannel('');
      refresh();
      toast.success('Notification attached');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to attach notification');
    } finally {
      setBusy(false);
    }
  };

  const handleDetach = async (attachmentId: string) => {
    setBusy(true);
    try {
      await ansibleNotificationsApi.detach(orgName, attachmentId);
      refresh();
      toast.success('Notification detached');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to detach notification');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateChannel = async () => {
    if (!newChannel.name || !newChannel.url) {
      toast.error(newChannel.type === 'email' ? 'Name and SMTP host are required' : 'Name and URL are required');
      return;
    }
    if (newChannel.type === 'email' && (!newChannel.from || !newChannel.to)) {
      toast.error('From and To addresses are required for email channels');
      return;
    }
    setBusy(true);
    try {
      const config: Record<string, unknown> = newChannel.type === 'email'
        ? {
            host: newChannel.url,
            port: newChannel.port ? Number(newChannel.port) : undefined,
            username: newChannel.username || undefined,
            from: newChannel.from,
            to: newChannel.to.split(',').map((s) => s.trim()).filter(Boolean),
          }
        : { url: newChannel.url };
      const res = await ansibleNotificationsApi.create(orgName, {
        name: newChannel.name,
        type: newChannel.type,
        config,
        secret: newChannel.secret || undefined,
      });
      toast.success('Notification channel created');
      setShowCreate(false);
      setNewChannel(emptyChannel);
      refresh();
      setSelectedChannel(res.data.id);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create channel');
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async (channelId: string) => {
    setBusy(true);
    try {
      await ansibleNotificationsApi.test(channelId);
      toast.success('Test notification sent');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Test send failed');
    } finally {
      setBusy(false);
    }
  };

  const triggerBadges = (a: NotificationAttachment) => {
    const out: string[] = [];
    if (a.onStarted) out.push('started');
    if (a.onSuccess) out.push('success');
    if (a.onFailure) out.push('failure');
    return out;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5" />
          Notifications
        </CardTitle>
        <CardDescription>
          Send webhook, email, or Microsoft Teams notifications when jobs from this template start or finish.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading notifications...
          </div>
        ) : attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notifications attached.</p>
        ) : (
          <div className="space-y-2">
            {attachments.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate font-medium">{a.templateName}</span>
                  {triggerBadges(a).map((t) => (
                    <Badge key={t} variant="outline">{t}</Badge>
                  ))}
                </div>
                {canManage && (
                  <Button variant="ghost" size="icon" aria-label="Remove notification" className="h-7 w-7 shrink-0" disabled={busy} onClick={() => { void handleDetach(a.id); }}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {canManage && (
          <>
            <div className="flex items-center gap-2">
              <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Attach a notification channel" />
                </SelectTrigger>
                <SelectContent>
                  {channels.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No channels yet - create one below</div>
                  ) : (
                    channels.map((ch) => (
                      <SelectItem key={ch.id} value={ch.id}>{ch.name} ({ch.type})</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button variant="outline" disabled={busy || !selectedChannel} onClick={() => { void handleAttach(); }}>
                <Plus className="h-4 w-4 mr-1" />
                Attach
              </Button>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox checked={triggers.on_started} onCheckedChange={(v) => { setTriggers({ ...triggers, on_started: Boolean(v) }); }} />
                started
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox checked={triggers.on_success} onCheckedChange={(v) => { setTriggers({ ...triggers, on_success: Boolean(v) }); }} />
                success
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox checked={triggers.on_failure} onCheckedChange={(v) => { setTriggers({ ...triggers, on_failure: Boolean(v) }); }} />
                failure
              </label>
              {selectedChannel && (
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => { void handleTest(selectedChannel); }}>
                  <Send className="h-3 w-3 mr-1" />
                  Test
                </Button>
              )}
            </div>

            {!showCreate ? (
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setShowCreate(true); }}>
                <Plus className="h-3 w-3 mr-1" />
                New channel
              </Button>
            ) : (
              <div className="rounded-md border p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Name</Label>
                    <Input value={newChannel.name} onChange={(e) => { setNewChannel({ ...newChannel, name: e.target.value }); }} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select value={newChannel.type} onValueChange={(v) => { setNewChannel({ ...newChannel, type: v as 'webhook' | 'email' | 'teams' }); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="webhook">Webhook</SelectItem>
                        <SelectItem value="teams">Microsoft Teams</SelectItem>
                        <SelectItem value="email">Email (SMTP)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{newChannel.type === 'email' ? 'SMTP host' : 'URL'}</Label>
                    <Input value={newChannel.url} onChange={(e) => { setNewChannel({ ...newChannel, url: e.target.value }); }} placeholder={newChannel.type === 'email' ? 'smtp.example.com' : 'https://...'} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{newChannel.type === 'email' ? 'SMTP password (optional)' : 'Secret (optional)'}</Label>
                    <Input type="password" value={newChannel.secret} onChange={(e) => { setNewChannel({ ...newChannel, secret: e.target.value }); }} />
                  </div>
                  {newChannel.type === 'email' && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">From</Label>
                        <Input value={newChannel.from} onChange={(e) => { setNewChannel({ ...newChannel, from: e.target.value }); }} placeholder="stackweaver@example.com" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">To (comma-separated)</Label>
                        <Input value={newChannel.to} onChange={(e) => { setNewChannel({ ...newChannel, to: e.target.value }); }} placeholder="ops@example.com" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">SMTP username (optional)</Label>
                        <Input value={newChannel.username} onChange={(e) => { setNewChannel({ ...newChannel, username: e.target.value }); }} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Port (default 587)</Label>
                        <Input type="number" value={newChannel.port} onChange={(e) => { setNewChannel({ ...newChannel, port: e.target.value }); }} placeholder="587" />
                      </div>
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy} onClick={() => { void handleCreateChannel(); }}>Create</Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowCreate(false); }}>Cancel</Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
