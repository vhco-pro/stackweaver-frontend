// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Package, Search, Plus, Clock, Download, GitBranch, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GradientButton } from '@/components/ui/gradient-button';
import { Page } from '@/components/layout/Page';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageEmptyState } from '@/components/layout/PageEmptyState';
import { registryApi, organizationsApi } from '@/api/client';
import { CreateModuleDialog } from '@/components/registry/CreateModuleDialog';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

export default function Registry() {
  const { orgName } = useParams<{ orgName: string }>();
  const navigate = useNavigate();
  const [selectedOrg, setSelectedOrg] = useState<string>(orgName || '');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [publishTypeFilter, setPublishTypeFilter] = useState<string>('all');
  const [tagsFilter, setTagsFilter] = useState(false);

  // Load organizations
  const { data: organizations = [], isLoading: loadingOrgs } = useQuery({
    queryKey: ['registry-organizations', orgName],
    queryFn: async () => {
      const res = await organizationsApi.list();
      const orgs = res.data || [];
      if (!orgName && orgs.length > 0) {
        void navigate(`/app/${orgs[0].name}/registry`, { replace: true });
        setSelectedOrg(orgs[0].name);
      } else if (orgName) {
        setSelectedOrg(orgName);
      }
      return orgs;
    },
  });

  // Load modules for selected org
  const { data: modules = [], isLoading: loading, isError: loadFailed, refetch: refetchModules } = useQuery({
    queryKey: ['modules', selectedOrg],
    queryFn: async () => {
      const modulesList = await registryApi.modules.list(selectedOrg);
      return modulesList || [];
    },
    enabled: !!selectedOrg,
  });

  const filteredModules = modules.filter(module => {
    // Search filter
    const matchesSearch = searchQuery === '' ||
      module.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      module.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
      module.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Publish type filter
    const matchesPublishType = publishTypeFilter === 'all' ||
      (publishTypeFilter === 'tags' && module.auto_publish_tags) ||
      (publishTypeFilter === 'manual' && !module.auto_publish_tags);
    
    // Tags filter (if enabled, only show modules with auto_publish_tags)
    const matchesTags = !tagsFilter || module.auto_publish_tags;
    
    return matchesSearch && matchesPublishType && matchesTags;
  });

  const filtersActive = searchQuery !== '' || publishTypeFilter !== 'all' || tagsFilter;
  const clearFilters = () => {
    setSearchQuery('');
    setPublishTypeFilter('all');
    setTagsFilter(false);
  };

  // Defined once and handed to both the header and the empty-state card: the header does not
  // render it while there is nothing to list, so the action never appears twice.
  const addModuleAction = (
    <GradientButton ramp="app" onClick={() => setCreateDialogOpen(true)} className="w-auto px-4 py-2">
      <Plus className="h-4 w-4 mr-2" />
      Add New Module
    </GradientButton>
  );
  // The module list cannot be known before the organizations are: until they load there may be
  // no organization selected, which leaves the module query idle rather than loading.
  const listState = loadingOrgs || loading
    ? 'loading'
    : loadFailed
      ? 'error'
      : modules.length === 0 && !filtersActive
        ? 'empty'
        : 'ready';
  const header = (
    <PageHeader
      icon={Package}
      title="Registry"
      subtitle="Private modules and providers for your organization"
      action={addModuleAction}
      listState={listState}
    />
  );

  if (loadingOrgs) {
    return (
      <Page className="min-h-screen bg-background p-6">
        {header}
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading organizations...
          </div>
        </div>
      </Page>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="p-8">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">No organizations found. Please create an organization first.</p>
          <Button variant="outline" onClick={() => { void navigate('/organizations'); }}>
            Go to Organizations
          </Button>
        </div>
      </div>
    );
  }

  if (!selectedOrg) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Please select an organization to view modules.</p>
      </div>
    );
  }

  return (
    <Page className="min-h-screen bg-background p-6">
      {header}

      {/* Search and Tabs */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter providers and modules"
            aria-label="Filter providers and modules"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
        </div>
        <div className="hidden sm:flex items-center gap-2 border-b border-border">
          <button className="px-4 py-2 text-sm font-medium border-b-2 border-primary text-primary">
            Modules
          </button>
          <button 
            onClick={() => { void navigate(`/app/${selectedOrg}/registry/providers`); }}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Providers
          </button>
        </div>
        {/* Responsive fallback: compact select shown when tabs don't fit */}
        <select
          className="sm:hidden border border-input bg-background text-sm rounded-lg px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-ring"
          onChange={(e) => {
            if (e.target.value === 'providers') {
              void navigate(`/app/${selectedOrg}/registry/providers`);
            }
          }}
          defaultValue="modules"
        >
          <option value="modules">Modules</option>
          <option value="providers">Providers</option>
        </select>
      </div>

      <div className="flex gap-6">
        {/* Left Sidebar - Filters */}
        <div className="w-64 space-y-6">
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              Filters
              <ChevronDown className="h-4 w-4" />
            </h3>
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  Publishing Type
                  <ChevronDown className="h-3 w-3" />
                </h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="publishType"
                      value="all"
                      checked={publishTypeFilter === 'all'}
                      onChange={(e) => setPublishTypeFilter(e.target.value)}
                      className="text-primary"
                    />
                    <span>All</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="publishType"
                      value="tags"
                      checked={publishTypeFilter === 'tags'}
                      onChange={(e) => setPublishTypeFilter(e.target.value)}
                      className="text-primary"
                    />
                    <span>Git Tag based</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="publishType"
                      value="manual"
                      checked={publishTypeFilter === 'manual'}
                      onChange={(e) => setPublishTypeFilter(e.target.value)}
                      className="text-primary"
                    />
                    <span>Manual upload</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={tagsFilter}
                    onCheckedChange={(checked) => setTagsFilter(checked === true)}
                  />
                  <span>Tags</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Module List */}
        <div className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading modules...</div>
            </div>
          ) : filteredModules.length === 0 ? (
            filtersActive ? (
              <PageEmptyState
                icon={Package}
                title="No Modules Found"
                description="No modules match your search."
                filtered
                onClearFilters={clearFilters}
              />
            ) : (
              <PageEmptyState
                icon={Package}
                title="No Modules Found"
                description="Get started by publishing your first module."
                action={loadFailed ? undefined : addModuleAction}
              />
            )
          ) : (
            <div className="space-y-4">
              {filteredModules.map((module) => (
                <div
                  key={module.id}
                  className="group border rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer bg-card"
                  onClick={() => { void navigate(`/app/${selectedOrg}/registry/modules/${module.name}/${module.provider}`); }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{module.name}</h3>
                        <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">
                          <Package className="h-3 w-3 mr-1" />
                          Private
                        </Badge>
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                          {module.provider}
                        </Badge>
                        {module.latest_version && (
                          <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20">
                            <Clock className="h-3 w-3 mr-1" />
                            {module.latest_version}
                          </Badge>
                        )}
                        {module.auto_publish_tags && (
                          <>
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                              <GitBranch className="h-3 w-3 mr-1" />
                              Git Tag based module
                            </Badge>
                            <Badge variant="outline" className="text-muted-foreground">
                              <Clock className="h-3 w-3 mr-1" />
                              a minute ago
                            </Badge>
                          </>
                        )}
                      </div>
                      {module.description && (
                        <p className="text-sm text-muted-foreground mb-3">
                          {module.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Download className="h-3 w-3" />
                          <span>&lt; 100</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateModuleDialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            void refetchModules();
          }
        }}
        orgName={selectedOrg}
      />
    </Page>
  );
}
