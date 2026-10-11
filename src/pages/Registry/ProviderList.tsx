// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Package, Plus, Search, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GradientButton } from '@/components/ui/gradient-button';
import { Page } from '@/components/layout/Page';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageEmptyState } from '@/components/layout/PageEmptyState';
import { cn } from '@/lib/utils';
import { registryApi } from '@/api/client';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

export default function ProviderList() {
  const params = useParams<{ orgName: string }>();
  const orgName = params.orgName;
  const navigate = useNavigate();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const { data: providers = [], isLoading: loading, isError: loadFailed, refetch: refetchProviders } = useQuery({
    queryKey: ['providers', orgName],
    queryFn: async () => {
      const providersList = await registryApi.providers.list(orgName!);
      return providersList || [];
    },
    enabled: !!orgName,
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !orgName) {
      toast.error('Provider name is required');
      return;
    }

    setCreating(true);
    try {
      await registryApi.providers.create(orgName, { name: name.trim() });

      toast.success('Provider created successfully');
      setCreateDialogOpen(false);
      setName('');
      void refetchProviders();
    } catch (err: unknown) {
      console.error('Failed to create provider:', err);
      const errorMessage = err && typeof err === 'object' && 'message' in err
        ? String((err).message)
        : 'Failed to create provider';
      toast.error(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const filteredProviders = providers.filter(provider =>
    searchQuery === '' ||
    provider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    provider.namespace.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!orgName) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Please select an organization to view providers.</p>
      </div>
    );
  }

  // Defined once and handed to both the header and the empty-state card: the header does not
  // render it while there is nothing to list, so the action never appears twice.
  const addProviderAction = (
    <GradientButton ramp="app" onClick={() => setCreateDialogOpen(true)} className="w-auto px-4 py-2">
      <Plus className="h-4 w-4 mr-2" />
      Add New Provider
    </GradientButton>
  );
  const listState = loading
    ? 'loading'
    : loadFailed
      ? 'error'
      : providers.length === 0 && searchQuery === ''
        ? 'empty'
        : 'ready';

  return (
    <Page className="space-y-8 p-8">
      {/* Breadcrumb Header */}
      <div className="border-b border-border/40 pb-3 mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{orgName}</span>
          <span>/</span>
          <span className="hover:text-foreground cursor-pointer" onClick={() => { void Promise.resolve(navigate(`/app/${orgName}/registry`)); }}>
            Registry
          </span>
          <span>/</span>
          <span className="text-foreground font-medium">Providers</span>
        </div>
      </div>

      <PageHeader
        icon={Package}
        title="Provider Registry"
        subtitle="Manage custom Terraform providers"
        action={addProviderAction}
        listState={listState}
      />

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500 dark:text-muted-foreground" />
        <input
          type="text"
          placeholder="Search providers..."
          aria-label="Search providers"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={cn(
            'w-full pl-12 pr-4 py-3 rounded-xl',
            'bg-white dark:bg-white/5',
            'backdrop-blur-md border border-gray-300 dark:border-white/10',
            'text-gray-900 dark:text-white',
            'focus:outline-hidden focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 dark:focus:border-blue-500/50',
            'transition-all duration-300',
            'placeholder:text-gray-400 dark:placeholder:text-muted-foreground',
            'shadow-xs dark:shadow-none'
          )}
        />
      </div>

      {/* Providers Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading providers...</div>
        </div>
      ) : filteredProviders.length === 0 ? (
        searchQuery ? (
          <PageEmptyState
            icon={Package}
            title="No Providers Found"
            description="No providers match your search."
            filtered
            onClearFilters={() => setSearchQuery('')}
          />
        ) : (
          <PageEmptyState
            icon={Package}
            title="No Providers Found"
            description="Get started by creating your first provider."
            action={loadFailed ? undefined : addProviderAction}
          />
        )
      ) : (
        <div className="rounded-lg border border-gray-300/80 dark:border-white/10 bg-white dark:bg-white/5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Registry</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProviders.map((provider) => (
                <TableRow key={provider.id}>
                  <TableCell className="font-medium">{provider.name}</TableCell>
                  <TableCell className="text-muted-foreground">{provider.namespace}</TableCell>
                  <TableCell>
                    {provider.registry_name === 'public' ? (
                      <Badge variant="secondary">Public</Badge>
                    ) : (
                      <Badge variant="default" className="bg-blue-500">Private</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { void Promise.resolve(navigate(`/app/${orgName}/registry/providers/${provider.registry_name}/${provider.namespace}/${provider.name}`)); }}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Publish Version
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Provider Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Provider</DialogTitle>
            <DialogDescription>
              Create a new custom provider in this organization's private registry. It is
              namespaced by the organization.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { void handleCreate(e); }} className="space-y-4">
            <div>
              <Label htmlFor="provider-name">Provider Name *</Label>
              <Input
                id="provider-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., custom-cloud"
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <GradientButton ramp="app" className="w-auto px-4 py-2" type="submit" disabled={creating || !name.trim()}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Provider
              </GradientButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Page>
  );
}

