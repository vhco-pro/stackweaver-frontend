// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useParams } from 'react-router-dom';
import { ansibleCollectionsApi, type AnsibleCollection } from '@/api/ansible';
import type { JsonApiResource } from '@/utils/jsonapi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Package, Search, ExternalLink, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { YamlViewer } from '@/components/code/YamlViewer';

export default function Collections() {
  useParams<{ orgName: string }>();
  const [collections, setCollections] = useState<AnsibleCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useMountEffect(() => {
    const fetchCollections = async () => {
      try {
        const response = await ansibleCollectionsApi.listPreInstalled();
        const data = (response.data || []).map((item: JsonApiResource) => {
          const attrs = (item.attributes || {}) as Record<string, unknown>;
          return {
            id: item.id,
            name: (attrs.name as string) || item.id,
            namespace: (attrs.namespace as string) || '',
            version: (attrs.version as string) || 'latest',
            description: (attrs.description as string) || '',
            source: ((attrs.source as string) || 'pre-installed') as 'manual' | 'pre-installed' | 'requirements.yml',
          };
        });
        setCollections(data);
      } catch (err) {
        console.error('Failed to load collections:', err);
      } finally {
        setLoading(false);
      }
    };

    void fetchCollections();
  });

  const filteredCollections = collections.filter(col => 
    col.name.toLowerCase().includes(search.toLowerCase()) ||
    col.description?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Galaxy Collections</h1>
          <p className="text-muted-foreground">
            Ansible Galaxy collections available in the runner
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-500 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-500">Auto-Install from requirements.yml</p>
              <p className="text-muted-foreground mt-1">
                Additional collections can be installed automatically by adding a <code className="bg-muted px-1 rounded-sm">requirements.yml</code> file 
                to your playbook repository. The runner will install them before job execution.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search collections..."
            aria-label="Search collections"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <a
          href="https://galaxy.ansible.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          Browse Galaxy Hub
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Collections Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5">
        {filteredCollections.map((collection) => (
          <Card key={collection.id} className="hover:border-primary/50 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">{collection.name}</CardTitle>
                </div>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs",
                    collection.source === 'pre-installed' && "border-green-500/50 text-green-500"
                  )}
                >
                  {collection.source}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                {collection.namespace} • v{collection.version}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {collection.description || 'No description available'}
              </p>
              <a
                href={`https://galaxy.ansible.com/ui/repo/published/${collection.namespace}/${collection.name.split('.')[1]}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline mt-2 inline-flex items-center gap-1"
              >
                View on Galaxy
                <ExternalLink className="h-3 w-3" />
              </a>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredCollections.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No collections found matching "{search}"
        </div>
      )}

      {/* Requirements.yml Example */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Adding Custom Collections</CardTitle>
          <CardDescription>
            Create a requirements.yml file in your playbook repository to install additional collections
          </CardDescription>
        </CardHeader>
        <CardContent>
          <YamlViewer
            content={`# requirements.yml
collections:
  - name: cisco.ios
    version: ">=5.0.0"
  - name: f5networks.f5_modules
  - name: paloaltonetworks.panos

roles:
  - name: geerlingguy.docker
  - name: geerlingguy.nginx`}
            maxHeight="300px"
            showLineNumbers={true}
            showCopyButton={true}
            showWrapToggle={false}
          />
          <p className="text-sm text-muted-foreground mt-4">
            The runner will automatically detect and install these before executing your playbook.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
