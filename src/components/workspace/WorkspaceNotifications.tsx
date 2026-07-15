import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi, type NotificationConfig, type NotificationScope } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, Plus, Trash2, Loader2, Send, Webhook } from 'lucide-react';
import { toast } from 'sonner';

// Triggers are scope-specific, matching the provider: workspace and project configs fire on the run
// lifecycle, while a team config's ONLY valid trigger is change_request:created. Offering run triggers
// on a team config would let someone build one that can never fire.
const RUN_TRIGGERS = [
  { id: 'run:created', label: 'Created' },
  { id: 'run:planning', label: 'Planning' },
  { id: 'run:needs_attention', label: 'Needs attention' },
  { id: 'run:applying', label: 'Applying' },
  { id: 'run:completed', label: 'Completed' },
  { id: 'run:errored', label: 'Errored' },
];

const TEAM_TRIGGERS = [{ id: 'change_request:created', label: 'Change request created' }];

function triggersForScope(scope: NotificationScope) {
  return scope === 'teams' ? TEAM_TRIGGERS : RUN_TRIGGERS;
}

function defaultTriggersForScope(scope: NotificationScope): string[] {
  return scope === 'teams' ? ['change_request:created'] : ['run:completed', 'run:errored'];
}

const DESTINATIONS = [
  { value: 'generic', label: 'Webhook (generic, HMAC-signed)' },
  { value: 'slack', label: 'Slack' },
  { value: 'microsoft-teams', label: 'Microsoft Teams' },
];

/**
 * WorkspaceNotifications manages notification configurations for a workspace, project or team:
 * generic/Slack/Teams destinations that fire on an event. Workspace and project configs fire on run
 * lifecycle events; team configs fire on change_request:created. React Query for data; the token is
 * write-only (sent on create, never displayed).
 */
export function WorkspaceNotifications({ scope = 'workspaces', id }: { scope?: NotificationScope; id: string }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('generic');
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [triggers, setTriggers] = useState<string[]>(() => defaultTriggersForScope(scope));
  const availableTriggers = triggersForScope(scope);

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['notifications', scope, id],
    queryFn: () => notificationsApi.list(scope, id),
    enabled: !!id,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notifications', scope, id] });

  const createMutation = useMutation({
    mutationFn: () => notificationsApi.create(scope, id, { name, destination_type: destination, url, enabled: true, triggers, token: token || undefined }),
    onSuccess: () => {
      void invalidate();
      setShowForm(false); setName(''); setUrl(''); setToken(''); setDestination('generic'); setTriggers(defaultTriggersForScope(scope));
      toast.success('Notification created');
    },
    onError: (e: unknown) => { toast.error(e instanceof Error ? e.message : 'Failed to create notification'); },
  });

  const toggleMutation = useMutation({
    mutationFn: (c: NotificationConfig) => notificationsApi.update(c.id, { enabled: !c.enabled }),
    onSuccess: () => void invalidate(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.delete(id),
    onSuccess: () => { void invalidate(); toast.success('Notification deleted'); },
  });

  const verifyMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.verify(id),
    onSuccess: () => toast.success('Test notification sent'),
    onError: (e: unknown) => { toast.error(e instanceof Error ? e.message : 'Test delivery failed'); },
  });

  const toggleTrigger = (id: string) => {
    setTriggers(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 dark:bg-black/10 backdrop-blur-sm p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-purple-500" />
          <div>
            <h3 className="text-lg font-semibold">Notifications</h3>
            <p className="text-sm text-muted-foreground">
              {scope === 'teams'
                ? 'Notify this team when a change request is filed against a workspace it can access.'
                : 'Send run events to a webhook, Slack, or Microsoft Teams.'}
            </p>
          </div>
        </div>
        <Button type="button" size="sm" onClick={() => { setShowForm(v => !v); }} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add notification
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-white/10 bg-white/5 dark:bg-black/10 p-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={e => { setName(e.target.value); }} placeholder="e.g. Slack #infra" />
            </div>
            <div className="space-y-2">
              <Label>Destination</Label>
              <Select value={destination} onValueChange={setDestination}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DESTINATIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>URL</Label>
            <Input value={url} onChange={e => { setUrl(e.target.value); }} placeholder="https://hooks.example.com/..." />
          </div>
          {destination === 'generic' && (
            <div className="space-y-2">
              <Label>HMAC token (optional)</Label>
              <Input type="password" value={token} onChange={e => { setToken(e.target.value); }} placeholder="Signs the payload with X-TFE-Notification-Signature" />
            </div>
          )}
          <div className="space-y-2">
            <Label>Triggers</Label>
            <div className="flex flex-wrap gap-3">
              {availableTriggers.map(t => (
                <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={triggers.includes(t.id)} onCheckedChange={() => { toggleTrigger(t.id); }} />
                  {t.label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => { setShowForm(false); }}>Cancel</Button>
            <Button type="button" size="sm" disabled={!name.trim() || !url.trim() || triggers.length === 0 || createMutation.isPending}
              onClick={() => { createMutation.mutate(); }} className="gap-1.5">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : configs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notifications yet. Add one to get alerted on run events.</p>
      ) : (
        <div className="space-y-3">
          {configs.map(c => (
            <div key={c.id} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 dark:bg-black/10 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Webhook className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium truncate">{c.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/20">{c.destination_type}</span>
                  {!c.enabled && <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-muted-foreground">disabled</span>}
                </div>
                <div className="text-xs text-muted-foreground mt-1 truncate">{c.url}</div>
                <div className="text-xs text-muted-foreground mt-1">{c.triggers.join(', ')}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button type="button" variant="ghost" size="sm" onClick={() => { verifyMutation.mutate(c.id); }} disabled={verifyMutation.isPending} className="gap-1.5" aria-label={`Send test for ${c.name}`}>
                  <Send className="h-4 w-4" /> Test
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { toggleMutation.mutate(c); }} disabled={toggleMutation.isPending}>
                  {c.enabled ? 'Disable' : 'Enable'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { if (confirm('Delete this notification?')) deleteMutation.mutate(c.id); }}
                  disabled={deleteMutation.isPending} className="text-red-500 hover:text-red-600 hover:bg-red-500/10" aria-label={`Delete ${c.name}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
