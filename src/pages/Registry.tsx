// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Package, Search, Plus, Clock, Download, GitBranch, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { registryApi, organizationsApi, type Module, type Organization } from '@/api/client';
import { toast } from 'sonner';
import { CreateModuleDialog } from '@/components/registry/CreateModuleDialog';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

export default function Registry() {
  const { orgName } = useParams<{ orgName: string }>();
  const navigate = useNavigate();
  const [modules, setModules] = useState<Module[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>(orgName || '');
  const [loading, setLoading] = useState(true);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [publishTypeFilter, setPublishTypeFilter] = useState<string>('all');
  const [tagsFilter, setTagsFilter] = useState(false);

  // Load organizations
  useEffect(() => {
    void organizationsApi.list()
      .then((res) => {
        const orgs = res.data || [];
        setOrganizations(orgs);
        setLoadingOrgs(false);
        
        // If no org in URL but we have orgs, redirect to first org using new route
        if (!orgName && orgs.length > 0) {
          void navigate(`/app/${orgs[0].name}/registry`, { replace: true });
          setSelectedOrg(orgs[0].name);
        } else if (orgName) {
          setSelectedOrg(orgName);
        }
      })
      .catch((err) => {
        console.error('Failed to load organizations:', err);
        setLoadingOrgs(false);
      });
  }, [orgName, navigate]);

  const fetchModules = () => {
    if (!selectedOrg) {
      setLoading(false);
      return;
    }

    setLoading(true);
    void registryApi.modules.list(selectedOrg)
      .then((modulesList) => {
        setModules(modulesList || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load modules:', err);
        toast.error('Failed to load modules');
        setModules([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchModules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg]);

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

  if (loadingOrgs) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading organizations...
        </div>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="p-8">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">No organizations found. Please create an organization first.</p>
          <Button onClick={() => { void navigate('/organizations'); }}>
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
    <div className="min-h-screen bg-background">
      {/* Breadcrumb Header */}
      <div className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-6 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="hover:text-foreground cursor-pointer" onClick={() => { void navigate(`/app/${selectedOrg}/workspaces`); }}>
              {selectedOrg}
            </span>
            <span>/</span>
            <span className="text-foreground font-medium">Registry</span>
            <span>/</span>
            <span className="text-foreground font-medium">Modules</span>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Main Title */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Registry</h1>
        </div>

        {/* Search and Tabs */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter providers and modules"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
            className="sm:hidden border border-input bg-background text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
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
          <Button 
            onClick={() => setCreateDialogOpen(true)}
            className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white ml-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Module
          </Button>
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
              <div className="flex min-h-[400px] items-center justify-center">
                <div className={cn(
                  'text-center space-y-6 p-12 rounded-2xl',
                  'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
                  'dark:from-black/10 dark:via-black/5',
                  'backdrop-blur-md border border-white/20 dark:border-white/10',
                  'shadow-xl shadow-purple-500/10',
                  'max-w-2xl'
                )}>
                  <div className="flex justify-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 via-indigo-500/20 to-purple-500/20 border border-blue-500/30">
                      <Package className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold mb-2">No Modules Found</h3>
                    <p className="text-muted-foreground text-lg">
                      {searchQuery ? 'No modules match your search.' : 'Get started by publishing your first module.'}
                    </p>
                  </div>
                  {!searchQuery && (
                    <Button 
                      onClick={() => setCreateDialogOpen(true)}
                      className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add New Module
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredModules.map((module) => (
                  <div
                    key={module.id}
                    className="group border rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer bg-card"
                    onClick={() => { void navigate(`/organizations/${selectedOrg}/registry/modules/${module.name}/${module.provider}`); }}
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
      </div>

      <CreateModuleDialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            fetchModules();
          }
        }}
        orgName={selectedOrg}
      />
    </div>
  );
}
