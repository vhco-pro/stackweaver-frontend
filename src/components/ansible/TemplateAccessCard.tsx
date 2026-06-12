// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { JsonApiResource } from '@/utils/jsonapi';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2, Users } from 'lucide-react';

interface TeamAccess {
  teamName: string;
  read: boolean;
  write: boolean;
  execute: boolean;
}

interface TemplateAccessCardProps {
  templateId: string;
}

/**
 * Read-only summary of which teams can view, edit, and execute this job
 * template (derived from org + project team access). Per-template grants are
 * tracked in the RBAC master plan.
 */
export function TemplateAccessCard({ templateId }: TemplateAccessCardProps) {
  const { data: access = [], isLoading } = useQuery({
    queryKey: ['templateAccess', templateId],
    queryFn: async () => {
      const res = await apiClient.get<{ data: JsonApiResource[] }>(`/ansible/job-templates/${templateId}/access`);
      return (res.data || []).map((r): TeamAccess => ({
        teamName: (r.attributes?.['team-name'] as string) || '',
        read: Boolean(r.attributes?.read),
        write: Boolean(r.attributes?.write),
        execute: Boolean(r.attributes?.execute),
      }));
    },
    enabled: !!templateId,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5" />
          Access
        </CardTitle>
        <CardDescription>
          Teams with access to this template, derived from organization and project permissions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading access...
          </div>
        ) : access.length === 0 ? (
          <p className="text-sm text-muted-foreground">No team has explicit access to this template.</p>
        ) : (
          <div className="space-y-2">
            {access.map((a) => (
              <div key={a.teamName} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span className="truncate font-medium">{a.teamName}</span>
                <div className="flex gap-1">
                  {a.read && <Badge variant="outline">read</Badge>}
                  {a.write && <Badge variant="outline">edit</Badge>}
                  {a.execute && <Badge variant="secondary">execute</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
