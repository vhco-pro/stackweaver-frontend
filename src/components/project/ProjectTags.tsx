import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tag, Plus, X, Loader2 } from 'lucide-react';

interface TagBinding {
  key: string;
  value: string;
}

/**
 * ProjectTags renders a project's key/value tag bindings (TFE-compatible) with add/remove editing.
 * Workspaces in the project inherit these tags. Data fetching uses React Query (no raw useEffect).
 */
export function ProjectTags({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ['projectTags', projectId],
    queryFn: () => projectsApi.getTags(projectId),
    enabled: !!projectId,
  });

  const mutation = useMutation({
    mutationFn: (next: TagBinding[]) => projectsApi.setTags(projectId, next),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projectTags', projectId] });
    },
  });

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
    <div className="rounded-2xl border border-white/10 bg-white/5 dark:bg-black/10 backdrop-blur-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <Tag className="h-5 w-5 text-purple-500" />
        <h3 className="text-lg font-semibold">Tags</h3>
        <span className="text-sm text-muted-foreground">— workspaces in this project inherit these</span>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading tags…</div>
      ) : (
        <>
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-4">
              {tags.map(t => (
                <span
                  key={t.key}
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
            <p className="text-sm text-muted-foreground mb-4">No tags yet. Add one below to organize this project and its workspaces.</p>
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
  );
}
