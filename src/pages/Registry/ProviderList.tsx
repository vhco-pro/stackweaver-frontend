// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Package, Plus, Search, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const [description, setDescription] = useState('');

  const { data: providers = [], isLoading: loading, refetch: refetchProviders } = useQuery({
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
      await registryApi.providers.create(orgName, {
        name: name.trim(),
        description: description.trim() || undefined,
      });

      toast.success('Provider created successfully');
      setCreateDialogOpen(false);
      setName('');
      setDescription('');
      void refetchProviders();
    } catch (err: unknown) {
      console.error('Failed to create provider:', err);
      const errorMessage = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : 'Failed to create provider';
      toast.error(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const filteredProviders = providers.filter(provider =>
    searchQuery === '' ||
    provider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    provider.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!orgName) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Please select an organization to view providers.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-8">
      {/* Breadcrumb Header */}
      <div className="border-b border-border/40 pb-3 mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="hover:text-foreground cursor-pointer" onClick={() => { void Promise.resolve(navigate(`/app/${orgName}/registry`)); }}>
            {orgName}
          </span>
          <span>/</span>
          <span className="hover:text-foreground cursor-pointer" onClick={() => { void Promise.resolve(navigate(`/app/${orgName}/registry`)); }}>
            Registry
          </span>
          <span>/</span>
          <span className="text-foreground font-medium">Providers</span>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Provider Registry
          </h1>
          <p className="text-muted-foreground">
            Manage custom Terraform providers
          </p>
        </div>
        <Button 
          onClick={() => setCreateDialogOpen(true)}
          className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300 w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add New Provider
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500 dark:text-muted-foreground" />
        <input
          type="text"
          placeholder="Search providers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={cn(
            'w-full pl-12 pr-4 py-3 rounded-xl',
            'bg-white dark:bg-white/5',
            'backdrop-blur-md border border-gray-300 dark:border-white/10',
            'text-gray-900 dark:text-white',
            'focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 dark:focus:border-blue-500/50',
            'transition-all duration-300',
            'placeholder:text-gray-400 dark:placeholder:text-muted-foreground',
            'shadow-sm dark:shadow-none'
          )}
        />
      </div>

      {/* Providers Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading providers...</div>
        </div>
      ) : filteredProviders.length === 0 ? (
        <div className="flex min-h-[400px] items-center justify-center">
          <div className={cn(
            'text-center space-y-6 p-12 rounded-2xl',
            'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
            'dark:from-black/10 dark:via-black/5',
            'backdrop-blur-md border border-white/20 dark:border-white/10',
            'shadow-xl shadow-blue-500/10',
            'max-w-2xl'
          )}>
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 via-indigo-500/20 to-purple-500/20 border border-blue-500/30">
                <Package className="h-10 w-10 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-semibold mb-2">No Providers Found</h3>
              <p className="text-muted-foreground text-lg">
                {searchQuery ? 'No providers match your search.' : 'Get started by creating your first provider.'}
              </p>
            </div>
            {!searchQuery && (
              <Button 
                onClick={() => setCreateDialogOpen(true)}
                className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New Provider
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProviders.map((provider) => (
                <TableRow key={provider.id}>
                  <TableCell className="font-medium">{provider.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {provider.description || 'No description'}
                  </TableCell>
                  <TableCell>
                    {provider.verified ? (
                      <Badge variant="default" className="bg-green-500">Verified</Badge>
                    ) : (
                      <Badge variant="secondary">Unverified</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { void Promise.resolve(navigate(`/app/${orgName}/registry/providers/${provider.name}`)); }}
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
              Create a new custom Terraform provider in the registry.
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
            <div>
              <Label htmlFor="provider-description">Description</Label>
              <Input
                id="provider-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this provider"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !name.trim()}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Provider
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

