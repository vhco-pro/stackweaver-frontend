import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workspacesApi } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tag, Plus, X, Loader2, Layers } from 'lucide-react';

interface TagBinding {
  key: string;
  value: string;
}

/**
 * WorkspaceTags renders a workspace's key/value tag bindings (TFE-compatible) with add/remove editing.
 * It also shows tags inherited from the workspace's project as read-only chips (the workspace's own
 * bindings win on key conflict, matching effective-tag-bindings). Data fetching uses React Query.
 */
export function WorkspaceTags({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ['workspaceTags', workspaceId],
    queryFn: () => workspacesApi.getTags(workspaceId),
    enabled: !!workspaceId,
  });

  const { data: effective = [] } = useQuery({
    queryKey: ['workspaceEffectiveTags', workspaceId],
    queryFn: () => workspacesApi.getEffectiveTags(workspaceId),
    enabled: !!workspaceId,
  });

  const mutation = useMutation({
    mutationFn: (next: TagBinding[]) => workspacesApi.setTags(workspaceId, next),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workspaceTags', workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ['workspaceEffectiveTags', workspaceId] });
    },
  });

  // Inherited = keys present in the effective set but not in the workspace's own bindings.
  const ownKeys = new Set(tags.map(t => t.key));
  const inherited = effective.filter(t => !ownKeys.has(t.key));

  const addTag = () => {
    const key = newKey.trim();
    if (!key) return;
    const next = [...tags.filter(t => t.key !== key), { key, value: newValue.trim() }];
    mutation.mutate(next);
    setNewKey('');
    setNewValue('');
  };

  const removeTag = (key: string) => {
    mutation.mutate(tags.filter(t => t.key !== key));
  };

  return (
    <div className="space-y-6">
      {/* Own tags - editable */}
      <div className="rounded-2xl border border-white/10 bg-white/5 dark:bg-black/10 backdrop-blur-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Tag className="h-5 w-5 text-purple-500" />
          <h3 className="text-lg font-semibold">Tags</h3>
          <span className="text-sm text-muted-foreground">- this workspace's own key/value tags</span>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading tags…</div>
        ) : (
          <>
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-2 mb-4">
                {tags.map(t => (
                  <span
                    key={`own-${t.key}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-500/15 to-blue-500/15 border border-purple-500/20 px-3 py-1.5 text-sm"
                  >
                    <span className="font-medium">{t.key}</span>
                    {t.value && <span className="text-muted-foreground">= {t.value}</span>}
                    <button
                      type="button"
                      aria-label={`Remove tag ${t.key}`}
                      onClick={() => { removeTag(t.key); }}
                      className="ml-1 rounded-full p-0.5 hover:bg-red-500/20 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">No tags on this workspace yet. Add one below.</p>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="key (e.g. env)"
                value={newKey}
                onChange={e => { setNewKey(e.target.value); }}
                onKeyDown={e => { if (e.key === 'Enter') { addTag(); } }}
                className="sm:max-w-[200px]"
                aria-label="Tag key"
              />
              <Input
                placeholder="value (e.g. prod)"
                value={newValue}
                onChange={e => { setNewValue(e.target.value); }}
                onKeyDown={e => { if (e.key === 'Enter') { addTag(); } }}
                className="sm:max-w-[200px]"
                aria-label="Tag value"
              />
              <Button
                type="button"
                onClick={() => { addTag(); }}
                disabled={!newKey.trim() || mutation.isPending}
                className="gap-1.5"
              >
                {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add tag
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Inherited tags - read-only, only shown when the project contributes tags */}
      {!isLoading && inherited.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 dark:bg-black/10 backdrop-blur-sm p-6">
          <div className="flex items-center gap-2 mb-1">
            <Layers className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Inherited from project</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            These come from the workspace's project. Add a tag with the same key above to override it here.
          </p>
          <div className="flex flex-wrap gap-2">
            {inherited.map(t => (
              <span
                key={`inherited-${t.key}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-muted-foreground"
              >
                <span className="font-medium">{t.key}</span>
                {t.value && <span>= {t.value}</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
