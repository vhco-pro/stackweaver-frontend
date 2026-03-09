// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Edit, Users as UsersIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { organizationMembershipsApi, teamsApi, type OrganizationMembership, type Team } from '@/api/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export default function UsersSettings() {
  const { orgName } = useParams<{ orgName: string }>();
  const navigate = useNavigate();
  const [memberships, setMemberships] = useState<OrganizationMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasManageAccess, setHasManageAccess] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState('users');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCreateTeamDialog, setShowCreateTeamDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedMembership, setSelectedMembership] = useState<OrganizationMembership | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadMemberships = useCallback(async () => {
    if (!orgName) return;
    try {
      setLoading(true);
      setError(null);
      const response = await organizationMembershipsApi.list(orgName);
      setMemberships(response.data || []);
      
      // Permission check: If we can successfully load memberships, we have access
      // Backend will return 403 if user doesn't have manage-membership permission
      setHasManageAccess(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load organization members';
      setError(errorMessage);
      
      // If it's a 403, user doesn't have permission to manage memberships
      const errorWithStatus = err as Error & { status?: number };
      if (errorWithStatus?.status === 403 && orgName) {
        setHasManageAccess(false);
        toast.error('Only members of the "owners" team can manage users and teams');
        void Promise.resolve(navigate(`/app/${orgName}/settings`));
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [orgName, navigate]);

  // Load memberships on mount
  useEffect(() => {
    if (orgName) {
      void loadMemberships();
    }
  }, [orgName, loadMemberships]);

  const handleAdd = async () => {
    if (!orgName || !newEmail.trim()) {
      toast.error('Email is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      // Roles are deprecated - permissions come from team memberships
      await organizationMembershipsApi.create(orgName, {
        email: newEmail.trim(),
      });
      toast.success('User added successfully. Add them to teams to grant permissions.');
      setShowAddDialog(false);
      setNewEmail('');
      await loadMemberships();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add user';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };


  const handleDelete = async () => {
    if (!selectedMembership) return;

    try {
      setDeleting(true);
      setError(null);
      await organizationMembershipsApi.delete(selectedMembership.id);
      toast.success('User removed successfully');
      setShowDeleteDialog(false);
      setSelectedMembership(null);
      await loadMemberships();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove user';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const openDeleteDialog = (membership: OrganizationMembership) => {
    setSelectedMembership(membership);
    setShowDeleteDialog(true);
  };

  if (!orgName) {
    return (
      <div className="space-y-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Organization name is required</p>
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading && hasManageAccess === null) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Link
            to={`/app/${orgName}/settings`}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-violet-400 via-indigo-400 to-blue-400 bg-clip-text text-transparent">
              Users & Teams
            </h1>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Show access denied if user doesn't have manage-membership permission
  if (hasManageAccess === false) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Link
            to={`/app/${orgName}/settings`}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-violet-400 via-indigo-400 to-blue-400 bg-clip-text text-transparent">
              Users & Teams
            </h1>
          </div>
        </div>
        <div className="text-center py-12">
          <p className="text-destructive font-semibold mb-2">Access Denied</p>
          <p className="text-muted-foreground">Only members of the "owners" team can manage users and teams.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/app/${orgName}/settings`}>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground"
              aria-label="Back to Settings"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-violet-400 via-indigo-400 to-blue-400 bg-clip-text text-transparent">
              Users & Teams
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage organization members and teams
            </p>
          </div>
        </div>
        <div className="relative inline-flex rounded-xl bg-gradient-to-r from-violet-500 via-indigo-500 to-blue-500 p-[2px]">
          <Button
            variant="ghost"
            onClick={() => {
              if (activeTab === 'users') {
                setShowAddDialog(true);
              } else {
                setShowCreateTeamDialog(true);
              }
            }}
            className="bg-white dark:bg-slate-950/80 dark:backdrop-blur-sm text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-950/90 border-0 whitespace-nowrap rounded-[calc(0.75rem-2px)] px-4 py-2"
          >
            <Plus className="h-4 w-4 mr-2" />
            {activeTab === 'users' ? 'Add User' : 'Create Team'}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            /* Members Table */
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Teams</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memberships.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        <UsersIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No users found</p>
                        <p className="text-sm mt-2">Add users to get started</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    memberships.map((membership) => (
                      <TableRow key={membership.id}>
                        <TableCell className="font-medium">
                          {membership.user?.email || 'N/A'}
                        </TableCell>
                        <TableCell>
                          {membership.user?.name || '-'}
                        </TableCell>
                        <TableCell>
                          {membership.status === 'invited' ? (
                            <Badge variant="outline" className="border-yellow-500 text-yellow-600 dark:text-yellow-400">
                              Pending Invitation
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-green-500 text-green-600 dark:text-green-400">
                              Active
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {membership.teams && membership.teams.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {membership.teams.map(team => (
                                <Badge key={team.id} variant="outline" className="text-xs">
                                  {team.name}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground italic">No teams</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDeleteDialog(membership)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Add User Dialog */}
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>
              Add a new user to the organization by email address
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Users are added without permissions. Add them to teams via the Teams tab to grant access.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => { void handleAdd(); }} disabled={saving || !newEmail.trim()}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add User'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
          </Dialog>

          {/* Delete User Dialog */}
          <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove User</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {selectedMembership?.user?.email || 'this user'} from the organization?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => { void handleDelete(); }}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove User'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="teams">
          <TeamsTab orgName={orgName} showCreateDialog={showCreateTeamDialog} setShowCreateDialog={setShowCreateTeamDialog} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Teams Tab Component (extracted from Teams.tsx)
function TeamsTab({ orgName, showCreateDialog, setShowCreateDialog }: { orgName: string; showCreateDialog: boolean; setShowCreateDialog: (open: boolean) => void }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [allMemberships, setAllMemberships] = useState<OrganizationMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<OrganizationMembership[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  
  // Form state
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamVisibility, setNewTeamVisibility] = useState<'organization' | 'secret'>('secret');
  const [newTeamSSOID, setNewTeamSSOID] = useState<string>('');
  const [newTeamAllowTokenMgmt, setNewTeamAllowTokenMgmt] = useState<boolean>(true);
  const [newTeamOrgAccess, setNewTeamOrgAccess] = useState<Record<string, boolean>>({
    'manage-policies': false,
    'manage-policy-overrides': false,
    'manage-workspaces': false,
    'manage-vcs-settings': false,
    'manage-providers': false,
    'manage-modules': false,
    'manage-run-tasks': false,
    'manage-projects': false,
    'read-workspaces': false,
    'read-projects': false,
    'manage-membership': false,
    'manage-teams': false,
    'manage-organization-access': false,
    'access-secret-teams': false,
    'manage-agent-pools': false,
  });

  const [editingTeamName, setEditingTeamName] = useState('');
  const [editingTeamVisibility, setEditingTeamVisibility] = useState<'organization' | 'secret'>('secret');
  const [editingTeamSSOID, setEditingTeamSSOID] = useState<string>('');
  const [editingTeamAllowTokenMgmt, setEditingTeamAllowTokenMgmt] = useState<boolean>(true);
  
  // Organization access structured like TFE
  const [editingProjectPermission, setEditingProjectPermission] = useState<'none' | 'read' | 'manage'>('none');
  const [editingWorkspacePermission, setEditingWorkspacePermission] = useState<'none' | 'read' | 'manage'>('none');
  const [editingTeamPermission, setEditingTeamPermission] = useState<'none' | 'manage-membership' | 'manage-teams' | 'manage-organization-access'>('none');
  const [editingAccessSecretTeams, setEditingAccessSecretTeams] = useState(false);
  const [editingManagePolicies, setEditingManagePolicies] = useState(false);
  const [editingManagePolicyOverrides, setEditingManagePolicyOverrides] = useState(false);
  const [editingManageRunTasks, setEditingManageRunTasks] = useState(false);
  const [editingManageVCSSettings, setEditingManageVCSSettings] = useState(false);
  const [editingManageAgentPools, setEditingManageAgentPools] = useState(false);
  const [editingManagePrivateRegistry, setEditingManagePrivateRegistry] = useState(false);
  const [editingManageModules, setEditingManageModules] = useState(false);
  const [editingManageProviders, setEditingManageProviders] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingMembers, setUpdatingMembers] = useState(false);
  

  const loadTeams = useCallback(async () => {
    if (!orgName) return;
    try {
      setLoading(true);
      setError(null);
      const response = await teamsApi.list(orgName);
      setTeams(response.data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load teams';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [orgName]);

  const loadAllMemberships = useCallback(async () => {
    if (!orgName) return;
    try {
      const response = await organizationMembershipsApi.list(orgName);
      setAllMemberships(response.data || []);
    } catch (err) {
      console.error('Failed to load memberships:', err);
    }
  }, [orgName]);

  useEffect(() => {
    if (orgName) {
      void loadTeams();
      void loadAllMemberships();
    }
  }, [orgName, loadTeams, loadAllMemberships]);

  const loadTeamMembers = async (teamId: string) => {
    try {
      setLoadingMembers(true);
      const response = await teamsApi.listOrganizationMemberships(teamId);
      setTeamMembers(response.data || []);
    } catch (err) {
      toast.error('Failed to load team members');
      console.error('Failed to load team members:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleCreate = async () => {
    if (!orgName || !newTeamName.trim()) {
      toast.error('Team name is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      // Prepare organization-access object (only include true values, or all if any are true)
      const hasOrgAccess = Object.values(newTeamOrgAccess).some(v => v);
      const orgAccess = hasOrgAccess ? newTeamOrgAccess : undefined;

      await teamsApi.create(orgName, {
        name: newTeamName.trim(),
        visibility: newTeamVisibility,
        'allow-member-token-management': newTeamAllowTokenMgmt,
        'sso-team-id': newTeamSSOID.trim() || null,
        'organization-access': orgAccess,
      });
      toast.success('Team created successfully');
      setShowCreateDialog(false);
      setNewTeamName('');
      setNewTeamVisibility('secret');
      setNewTeamSSOID('');
      setNewTeamAllowTokenMgmt(true);
      setNewTeamOrgAccess({
        'manage-policies': false,
        'manage-policy-overrides': false,
        'manage-workspaces': false,
        'manage-vcs-settings': false,
        'manage-providers': false,
        'manage-modules': false,
        'manage-run-tasks': false,
        'manage-projects': false,
        'read-workspaces': false,
        'read-projects': false,
        'manage-membership': false,
        'manage-teams': false,
        'manage-organization-access': false,
        'access-secret-teams': false,
        'manage-agent-pools': false,
      });
      await loadTeams();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create team';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedTeam) return;

    try {
      setSaving(true);
      setError(null);
      
      // Convert TFE-style structure back to API format
      // Send ALL fields (both true and false) so backend can properly clear unchecked permissions
      const orgAccess: Record<string, boolean> = {};
      
      // Project permissions (mutually exclusive)
      orgAccess['manage-projects'] = editingProjectPermission === 'manage';
      orgAccess['read-projects'] = editingProjectPermission === 'read';
      
      // Workspace permissions (mutually exclusive)
      orgAccess['manage-workspaces'] = editingWorkspacePermission === 'manage';
      orgAccess['read-workspaces'] = editingWorkspacePermission === 'read';
      
      // Team permissions (mutually exclusive)
      orgAccess['manage-organization-access'] = editingTeamPermission === 'manage-organization-access';
      orgAccess['manage-teams'] = editingTeamPermission === 'manage-teams';
      orgAccess['manage-membership'] = editingTeamPermission === 'manage-membership';
      
      // Settings permissions (checkboxes)
      orgAccess['access-secret-teams'] = editingAccessSecretTeams;
      orgAccess['manage-policies'] = editingManagePolicies;
      orgAccess['manage-policy-overrides'] = editingManagePolicyOverrides;
      orgAccess['manage-run-tasks'] = editingManageRunTasks;
      orgAccess['manage-vcs-settings'] = editingManageVCSSettings;
      orgAccess['manage-agent-pools'] = editingManageAgentPools;
      
      // Private registry permissions (checkboxes)
      orgAccess['manage-modules'] = editingManageModules;
      orgAccess['manage-providers'] = editingManageProviders;

      await teamsApi.update(selectedTeam.id, {
        name: editingTeamName,
        visibility: editingTeamVisibility,
        'allow-member-token-management': editingTeamAllowTokenMgmt,
        'sso-team-id': editingTeamSSOID.trim() || null,
        'organization-access': Object.keys(orgAccess).length > 0 ? orgAccess : undefined,
      });
      toast.success('Team updated successfully');
      setShowEditDialog(false);
      setSelectedTeam(null);
      await loadTeams();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update team';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTeam) return;

    try {
      setDeleting(true);
      setError(null);
      await teamsApi.delete(selectedTeam.id);
      toast.success('Team deleted successfully');
      setShowDeleteDialog(false);
      setSelectedTeam(null);
      await loadTeams();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete team';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const handleUpdateMembers = async (membershipIdsToAdd: string[], membershipIdsToRemove: string[]) => {
    if (!selectedTeam) return;

    try {
      setUpdatingMembers(true);
      setError(null);

      // Add members
      if (membershipIdsToAdd.length > 0) {
        await teamsApi.addOrganizationMemberships(selectedTeam.id, membershipIdsToAdd);
      }

      // Remove members
      if (membershipIdsToRemove.length > 0) {
        await teamsApi.removeOrganizationMemberships(selectedTeam.id, membershipIdsToRemove);
      }

      toast.success('Team members updated successfully');
      await loadTeamMembers(selectedTeam.id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update team members';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setUpdatingMembers(false);
    }
  };

  const openEditDialog = (team: Team) => {
    if (!orgName) return;
    setSelectedTeam(team);
    setEditingTeamName(team.name);
    setEditingTeamVisibility(team.visibility);
    setEditingTeamSSOID(team['sso-team-id'] || '');
    setEditingTeamAllowTokenMgmt(team['allow-member-token-management'] ?? true);
    
    // Initialize organization access permissions from team data - convert to TFE-style structure
    const orgAccess = team['organization-access'] || {};
    
    // Project permissions: check if manage-projects or read-projects
    if (orgAccess['manage-projects']) {
      setEditingProjectPermission('manage');
    } else if (orgAccess['read-projects']) {
      setEditingProjectPermission('read');
    } else {
      setEditingProjectPermission('none');
    }
    
    // Workspace permissions: check if manage-workspaces or read-workspaces
    if (orgAccess['manage-workspaces']) {
      setEditingWorkspacePermission('manage');
    } else if (orgAccess['read-workspaces']) {
      setEditingWorkspacePermission('read');
    } else {
      setEditingWorkspacePermission('none');
    }
    
    // Team permissions: check in order of precedence
    if (orgAccess['manage-organization-access']) {
      setEditingTeamPermission('manage-organization-access');
    } else if (orgAccess['manage-teams']) {
      setEditingTeamPermission('manage-teams');
    } else if (orgAccess['manage-membership']) {
      setEditingTeamPermission('manage-membership');
    } else {
      setEditingTeamPermission('none');
    }
    
    // Settings permissions
    setEditingAccessSecretTeams(orgAccess['access-secret-teams'] || false);
    setEditingManagePolicies(orgAccess['manage-policies'] || false);
    setEditingManagePolicyOverrides(orgAccess['manage-policy-overrides'] || false);
    setEditingManageRunTasks(orgAccess['manage-run-tasks'] || false);
    setEditingManageVCSSettings(orgAccess['manage-vcs-settings'] || false);
    setEditingManageAgentPools(orgAccess['manage-agent-pools'] || false);
    
    // Private registry permissions
    setEditingManagePrivateRegistry(orgAccess['manage-providers'] || orgAccess['manage-modules'] || false);
    setEditingManageModules(orgAccess['manage-modules'] || false);
    setEditingManageProviders(orgAccess['manage-providers'] || false);
    
    setShowEditDialog(true);
  };

  const openDeleteDialog = (team: Team) => {
    setSelectedTeam(team);
    setShowDeleteDialog(true);
  };

  const openMembersDialog = async (team: Team) => {
    setSelectedTeam(team);
    setShowMembersDialog(true);
    await loadTeamMembers(team.id);
  };


  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        /* Teams Table */
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead>Members</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                    <UsersIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No teams found</p>
                    <p className="text-sm mt-2">Create a team to get started</p>
                  </TableCell>
                </TableRow>
              ) : (
                teams.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell className="font-medium">{team.name}</TableCell>
                    <TableCell>
                      <Badge variant={team.visibility === 'organization' ? 'default' : 'secondary'}>
                        {team.visibility === 'organization' ? 'Organization' : 'Secret'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UsersIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{team['users-count'] ?? 0} members</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { void openMembersDialog(team); }}
                          title="Manage Members"
                        >
                          <UsersIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { void openEditDialog(team); }}
                          title="Edit Team"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(team)}
                          className="text-destructive hover:text-destructive"
                          title="Delete Team"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Team Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Team</DialogTitle>
            <DialogDescription>
              Create a new team in the organization
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="team-name">Team Name</Label>
                <Input
                  id="team-name"
                  placeholder="engineering-team"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-visibility">Visibility</Label>
                <Select value={newTeamVisibility} onValueChange={(value) => setNewTeamVisibility(value as 'organization' | 'secret')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="organization">Organization</SelectItem>
                    <SelectItem value="secret">Secret</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-sso-id">SSO Team ID (Optional)</Label>
                <Input
                  id="team-sso-id"
                  placeholder="sso-team-id"
                  value={newTeamSSOID}
                  onChange={(e) => setNewTeamSSOID(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  SSO team ID for OIDC/SAML integration
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="team-allow-token-mgmt"
                  checked={newTeamAllowTokenMgmt}
                  onCheckedChange={(checked) => setNewTeamAllowTokenMgmt(checked === true)}
                />
                <Label
                  htmlFor="team-allow-token-mgmt"
                  className="text-sm font-normal cursor-pointer"
                >
                  Allow Member Token Management
                </Label>
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              <div>
                <Label className="text-base font-semibold">Organization Access Permissions</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Grant organization-level permissions to this team
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="org-access-manage-policies"
                    checked={newTeamOrgAccess['manage-policies']}
                    onCheckedChange={(checked) => setNewTeamOrgAccess({ ...newTeamOrgAccess, 'manage-policies': checked === true })}
                  />
                  <Label htmlFor="org-access-manage-policies" className="text-sm font-normal cursor-pointer">
                    Manage Policies
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="org-access-manage-policy-overrides"
                    checked={newTeamOrgAccess['manage-policy-overrides']}
                    onCheckedChange={(checked) => setNewTeamOrgAccess({ ...newTeamOrgAccess, 'manage-policy-overrides': checked === true })}
                  />
                  <Label htmlFor="org-access-manage-policy-overrides" className="text-sm font-normal cursor-pointer">
                    Manage Policy Overrides
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="org-access-manage-workspaces"
                    checked={newTeamOrgAccess['manage-workspaces']}
                    onCheckedChange={(checked) => setNewTeamOrgAccess({ ...newTeamOrgAccess, 'manage-workspaces': checked === true })}
                  />
                  <Label htmlFor="org-access-manage-workspaces" className="text-sm font-normal cursor-pointer">
                    Manage Workspaces
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="org-access-manage-vcs-settings"
                    checked={newTeamOrgAccess['manage-vcs-settings']}
                    onCheckedChange={(checked) => setNewTeamOrgAccess({ ...newTeamOrgAccess, 'manage-vcs-settings': checked === true })}
                  />
                  <Label htmlFor="org-access-manage-vcs-settings" className="text-sm font-normal cursor-pointer">
                    Manage VCS Settings
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="org-access-manage-providers"
                    checked={newTeamOrgAccess['manage-providers']}
                    onCheckedChange={(checked) => setNewTeamOrgAccess({ ...newTeamOrgAccess, 'manage-providers': checked === true })}
                  />
                  <Label htmlFor="org-access-manage-providers" className="text-sm font-normal cursor-pointer">
                    Manage Providers
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="org-access-manage-modules"
                    checked={newTeamOrgAccess['manage-modules']}
                    onCheckedChange={(checked) => setNewTeamOrgAccess({ ...newTeamOrgAccess, 'manage-modules': checked === true })}
                  />
                  <Label htmlFor="org-access-manage-modules" className="text-sm font-normal cursor-pointer">
                    Manage Modules
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="org-access-manage-run-tasks"
                    checked={newTeamOrgAccess['manage-run-tasks']}
                    onCheckedChange={(checked) => setNewTeamOrgAccess({ ...newTeamOrgAccess, 'manage-run-tasks': checked === true })}
                  />
                  <Label htmlFor="org-access-manage-run-tasks" className="text-sm font-normal cursor-pointer">
                    Manage Run Tasks
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="org-access-manage-projects"
                    checked={newTeamOrgAccess['manage-projects']}
                    onCheckedChange={(checked) => setNewTeamOrgAccess({ ...newTeamOrgAccess, 'manage-projects': checked === true })}
                  />
                  <Label htmlFor="org-access-manage-projects" className="text-sm font-normal cursor-pointer">
                    Manage Projects
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="org-access-read-workspaces"
                    checked={newTeamOrgAccess['read-workspaces']}
                    onCheckedChange={(checked) => setNewTeamOrgAccess({ ...newTeamOrgAccess, 'read-workspaces': checked === true })}
                  />
                  <Label htmlFor="org-access-read-workspaces" className="text-sm font-normal cursor-pointer">
                    Read Workspaces
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="org-access-read-projects"
                    checked={newTeamOrgAccess['read-projects']}
                    onCheckedChange={(checked) => setNewTeamOrgAccess({ ...newTeamOrgAccess, 'read-projects': checked === true })}
                  />
                  <Label htmlFor="org-access-read-projects" className="text-sm font-normal cursor-pointer">
                    Read Projects
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="org-access-manage-membership"
                    checked={newTeamOrgAccess['manage-membership']}
                    onCheckedChange={(checked) => setNewTeamOrgAccess({ ...newTeamOrgAccess, 'manage-membership': checked === true })}
                  />
                  <Label htmlFor="org-access-manage-membership" className="text-sm font-normal cursor-pointer">
                    Manage Membership
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="org-access-manage-teams"
                    checked={newTeamOrgAccess['manage-teams']}
                    onCheckedChange={(checked) => setNewTeamOrgAccess({ ...newTeamOrgAccess, 'manage-teams': checked === true })}
                  />
                  <Label htmlFor="org-access-manage-teams" className="text-sm font-normal cursor-pointer">
                    Manage Teams
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="org-access-manage-organization-access"
                    checked={newTeamOrgAccess['manage-organization-access']}
                    onCheckedChange={(checked) => setNewTeamOrgAccess({ ...newTeamOrgAccess, 'manage-organization-access': checked === true })}
                  />
                  <Label htmlFor="org-access-manage-organization-access" className="text-sm font-normal cursor-pointer">
                    Manage Organization Access
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="org-access-access-secret-teams"
                    checked={newTeamOrgAccess['access-secret-teams']}
                    onCheckedChange={(checked) => setNewTeamOrgAccess({ ...newTeamOrgAccess, 'access-secret-teams': checked === true })}
                  />
                  <Label htmlFor="org-access-access-secret-teams" className="text-sm font-normal cursor-pointer">
                    Access Secret Teams
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="org-access-manage-agent-pools"
                    checked={newTeamOrgAccess['manage-agent-pools']}
                    onCheckedChange={(checked) => setNewTeamOrgAccess({ ...newTeamOrgAccess, 'manage-agent-pools': checked === true })}
                  />
                  <Label htmlFor="org-access-manage-agent-pools" className="text-sm font-normal cursor-pointer">
                    Manage Agent Pools
                  </Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => { void handleCreate(); }} disabled={saving || !newTeamName.trim()}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Team'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Team Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Team - {selectedTeam?.name}</DialogTitle>
            <DialogDescription>
              Manage team settings, organization access, and resource permissions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-team-name">Team Name</Label>
                <Input
                  id="edit-team-name"
                  value={editingTeamName}
                  onChange={(e) => setEditingTeamName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-team-sso-id">SSO Team ID (Optional)</Label>
                <Input
                  id="edit-team-sso-id"
                  placeholder="sso-team-id"
                  value={editingTeamSSOID}
                  onChange={(e) => setEditingTeamSSOID(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  SSO team ID for OIDC/SAML integration
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-team-allow-token-mgmt"
                  checked={editingTeamAllowTokenMgmt}
                  onCheckedChange={(checked) => setEditingTeamAllowTokenMgmt(checked === true)}
                />
                <Label
                  htmlFor="edit-team-allow-token-mgmt"
                  className="text-sm font-normal cursor-pointer"
                >
                  Allow Member Token Management
                </Label>
              </div>
            </div>

            {/* Organization Access - TFE-style structure */}
            <div className="space-y-6 border-t pt-6">
              <div>
                <h3 className="text-lg font-semibold mb-1">Organization Access</h3>
                <p className="text-sm text-muted-foreground">
                  Grant organization-level permissions to this team. Org-level permissions apply to all resources unless overridden at the project level.
                </p>
              </div>

              {/* Project Permissions - Radio Buttons */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Project permissions</Label>
                <div className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <input
                      type="radio"
                      id="project-perm-none"
                      name="project-permission"
                      value="none"
                      checked={editingProjectPermission === 'none'}
                      onChange={() => setEditingProjectPermission('none')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label htmlFor="project-perm-none" className="font-normal cursor-pointer">
                        None
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Does not grant members any explicit access to projects. Permissions may still be granted on individual projects.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <input
                      type="radio"
                      id="project-perm-read"
                      name="project-permission"
                      value="read"
                      checked={editingProjectPermission === 'read'}
                      onChange={() => setEditingProjectPermission('read')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label htmlFor="project-perm-read" className="font-normal cursor-pointer">
                        View all projects
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Allow this team to view all projects in this organization.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <input
                      type="radio"
                      id="project-perm-manage"
                      name="project-permission"
                      value="manage"
                      checked={editingProjectPermission === 'manage'}
                      onChange={() => setEditingProjectPermission('manage')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label htmlFor="project-perm-manage" className="font-normal cursor-pointer">
                        Manage all projects
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Grants members the ability to view, edit, delete, and assign team access to all projects in this organization, as well as the ability to create new workspaces in any project.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Workspace Permissions - Radio Buttons */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Workspace permissions</Label>
                <div className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <input
                      type="radio"
                      id="workspace-perm-none"
                      name="workspace-permission"
                      value="none"
                      checked={editingWorkspacePermission === 'none'}
                      onChange={() => setEditingWorkspacePermission('none')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label htmlFor="workspace-perm-none" className="font-normal cursor-pointer">
                        None
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Does not grant members any explicit access to workspaces. Permissions may still be granted on individual workspaces.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <input
                      type="radio"
                      id="workspace-perm-read"
                      name="workspace-permission"
                      value="read"
                      checked={editingWorkspacePermission === 'read'}
                      onChange={() => setEditingWorkspacePermission('read')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label htmlFor="workspace-perm-read" className="font-normal cursor-pointer">
                        View all workspaces
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Allow this team to view all workspaces in this organization.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <input
                      type="radio"
                      id="workspace-perm-manage"
                      name="workspace-permission"
                      value="manage"
                      checked={editingWorkspacePermission === 'manage'}
                      onChange={() => setEditingWorkspacePermission('manage')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label htmlFor="workspace-perm-manage" className="font-normal cursor-pointer">
                        Manage all workspaces
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Grants members the ability to view, edit, delete, and assign team access to all workspaces in this organization, as well as the ability to create new workspaces in the default project.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Team Permissions - Radio Buttons */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Team permissions</Label>
                <div className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <input
                      type="radio"
                      id="team-perm-none"
                      name="team-permission"
                      value="none"
                      checked={editingTeamPermission === 'none'}
                      onChange={() => setEditingTeamPermission('none')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label htmlFor="team-perm-none" className="font-normal cursor-pointer">
                        None
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Does not grant members any explicit access to teams.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <input
                      type="radio"
                      id="team-perm-membership"
                      name="team-permission"
                      value="manage-membership"
                      checked={editingTeamPermission === 'manage-membership'}
                      onChange={() => setEditingTeamPermission('manage-membership')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label htmlFor="team-perm-membership" className="font-normal cursor-pointer">
                        Manage membership
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Allow members to add and remove users from the organization, and to manage the membership of teams. This permission allows members to assign themselves to other teams.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <input
                      type="radio"
                      id="team-perm-teams"
                      name="team-permission"
                      value="manage-teams"
                      checked={editingTeamPermission === 'manage-teams'}
                      onChange={() => setEditingTeamPermission('manage-teams')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label htmlFor="team-perm-teams" className="font-normal cursor-pointer">
                        Manage teams
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Grant members the ability to manage membership, as well as to create and delete teams and team tokens. This permission allows members to manage all teams, including those that they are not a part of.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <input
                      type="radio"
                      id="team-perm-org-access"
                      name="team-permission"
                      value="manage-organization-access"
                      checked={editingTeamPermission === 'manage-organization-access'}
                      onChange={() => setEditingTeamPermission('manage-organization-access')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label htmlFor="team-perm-org-access" className="font-normal cursor-pointer">
                        Manage organization access
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Grant members the ability to manage team memberships, permissions, and organization access. This permission level is similar to that of an organization owner, giving this individual the power to grant access to an organization&apos;s resources and settings to themselves or others.
                      </p>
                      {editingTeamPermission === 'manage-organization-access' && (
                        <div className="mt-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                          <p className="text-sm text-yellow-600 dark:text-yellow-400">
                            ⚠️ This permission should only be granted to trusted users.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Include Secret Teams Checkbox */}
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="edit-access-secret-teams"
                  checked={editingAccessSecretTeams}
                  onCheckedChange={(checked) => setEditingAccessSecretTeams(checked === true)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <Label htmlFor="edit-access-secret-teams" className="font-normal cursor-pointer">
                    Include secret teams
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Allow members to access secret teams. Members will be able to view all secret teams and potentially manage them depending on their level of team permissions.
                  </p>
                </div>
              </div>

              {/* Settings Permissions - Checkboxes */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Settings permissions</Label>
                <div className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="edit-manage-policies"
                      checked={editingManagePolicies}
                      onCheckedChange={(checked) => setEditingManagePolicies(checked === true)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label htmlFor="edit-manage-policies" className="font-normal cursor-pointer">
                        Manage policies
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Allow members to create, edit, read, list and delete the organization&apos;s policies
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="edit-manage-policy-overrides"
                      checked={editingManagePolicyOverrides}
                      onCheckedChange={(checked) => setEditingManagePolicyOverrides(checked === true)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label htmlFor="edit-manage-policy-overrides" className="font-normal cursor-pointer">
                        Manage policy overrides
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Allow members to override soft-mandatory policy checks
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="edit-manage-run-tasks"
                      checked={editingManageRunTasks}
                      onCheckedChange={(checked) => setEditingManageRunTasks(checked === true)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label htmlFor="edit-manage-run-tasks" className="font-normal cursor-pointer">
                        Manage run tasks
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Allow members to create, update, and delete run tasks on an organization
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="edit-manage-vcs-settings"
                      checked={editingManageVCSSettings}
                      onCheckedChange={(checked) => setEditingManageVCSSettings(checked === true)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label htmlFor="edit-manage-vcs-settings" className="font-normal cursor-pointer">
                        Manage version control settings
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Allow members to manage the organization&apos;s VCS Providers and SSH keys
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="edit-manage-agent-pools"
                      checked={editingManageAgentPools}
                      onCheckedChange={(checked) => setEditingManageAgentPools(checked === true)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label htmlFor="edit-manage-agent-pools" className="font-normal cursor-pointer">
                        Manage agent pools
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Allow members to create, update, and delete the organization&apos;s agent pools
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Private Registry Permissions - Parent + Nested */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Private registry permissions</Label>
                <div className="space-y-3 pl-6">
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="edit-manage-private-registry"
                      checked={editingManagePrivateRegistry}
                      onCheckedChange={(checked) => {
                        setEditingManagePrivateRegistry(checked === true);
                        if (!checked) {
                          setEditingManageModules(false);
                          setEditingManageProviders(false);
                        }
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label htmlFor="edit-manage-private-registry" className="font-normal cursor-pointer">
                        Manage private registry
                      </Label>
                    </div>
                  </div>
                  {editingManagePrivateRegistry && (
                    <div className="space-y-3 pl-6">
                      <div className="flex items-start space-x-2">
                        <Checkbox
                          id="edit-manage-modules"
                          checked={editingManageModules}
                          onCheckedChange={(checked) => setEditingManageModules(checked === true)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <Label htmlFor="edit-manage-modules" className="font-normal cursor-pointer">
                            Manage modules
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Allow members to publish and delete modules in the organization&apos;s private registry
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-2">
                        <Checkbox
                          id="edit-manage-providers"
                          checked={editingManageProviders}
                          onCheckedChange={(checked) => setEditingManageProviders(checked === true)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <Label htmlFor="edit-manage-providers" className="font-normal cursor-pointer">
                            Manage providers
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Allow members to publish and delete providers in the organization&apos;s private registry
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => { void handleEdit(); }} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Update team organization access'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Team Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Team</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the team &quot;{selectedTeam?.name}&quot;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => { void handleDelete(); }}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Team'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Members Dialog */}
      <Dialog open={showMembersDialog} onOpenChange={setShowMembersDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Team Members</DialogTitle>
            <DialogDescription>
              Add or remove members from {selectedTeam?.name}
            </DialogDescription>
          </DialogHeader>
          <TeamMembersManager
            team={selectedTeam}
            allMemberships={allMemberships}
            teamMembers={teamMembers}
            loadingMembers={loadingMembers}
            updatingMembers={updatingMembers}
            onUpdateMembers={handleUpdateMembers}
            onRefresh={() => selectedTeam && void loadTeamMembers(selectedTeam.id)}
          />
        </DialogContent>
      </Dialog>

    </div>
  );
}

// Team Members Manager Component
interface TeamMembersManagerProps {
  team: Team | null;
  allMemberships: OrganizationMembership[];
  teamMembers: OrganizationMembership[];
  loadingMembers: boolean;
  updatingMembers: boolean;
  onUpdateMembers: (toAdd: string[], toRemove: string[]) => Promise<void>;
  onRefresh: () => void;
}

function TeamMembersManager({
  team,
  allMemberships,
  teamMembers,
  loadingMembers,
  updatingMembers,
  onUpdateMembers,
  onRefresh,
}: TeamMembersManagerProps) {
  const [selectedMembershipIds, setSelectedMembershipIds] = useState<string[]>([]);
  const [currentMemberIds, setCurrentMemberIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (teamMembers && teamMembers.length > 0) {
      const memberIds = new Set(teamMembers.map(m => m.id));
      const membershipIds = teamMembers.map(m => m.id);
      // Use requestAnimationFrame to defer state updates
      requestAnimationFrame(() => {
        setCurrentMemberIds(memberIds);
        setSelectedMembershipIds(membershipIds);
      });
    } else {
      requestAnimationFrame(() => {
        setCurrentMemberIds(new Set());
        setSelectedMembershipIds([]);
      });
    }
  }, [teamMembers]);

  const handleSave = async () => {
    if (!team) return;

    const toAdd = selectedMembershipIds.filter(id => !currentMemberIds.has(id));
    const toRemove = Array.from(currentMemberIds).filter(id => !selectedMembershipIds.includes(id));

    if (toAdd.length === 0 && toRemove.length === 0) {
      return; // No changes
    }

    await onUpdateMembers(toAdd, toRemove);
    onRefresh();
  };

  const toggleMembership = (membershipId: string) => {
    setSelectedMembershipIds(prev => {
      if (prev.includes(membershipId)) {
        return prev.filter(id => id !== membershipId);
      } else {
        return [...prev, membershipId];
      }
    });
  };

  if (!team) return null;

  return (
    <div className="space-y-4">
      {loadingMembers ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {allMemberships.map((membership) => {
            const isSelected = selectedMembershipIds.includes(membership.id);
            const isCurrentMember = currentMemberIds.has(membership.id);
            return (
              <div
                key={membership.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg border',
                  isSelected ? 'bg-primary/10 border-primary' : 'bg-background'
                )}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleMembership(membership.id)}
                    className="h-4 w-4"
                  />
                  <div>
                    <div className="font-medium">
                      {membership.user?.email || 'N/A'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {membership.user?.name || '-'} • {membership.role}
                    </div>
                  </div>
                </div>
                {isCurrentMember && (
                  <Badge variant="secondary">Current Member</Badge>
                )}
              </div>
            );
          })}
        </div>
      )}
      <DialogFooter>
        <Button
          onClick={() => { void handleSave(); }}
          disabled={updatingMembers || loadingMembers}
        >
          {updatingMembers ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </DialogFooter>
    </div>
  );
}

