// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/config';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { OrganizationProvider } from '@/contexts/OrganizationContext';
import { NotificationProvider, useNotifications } from '@/contexts/NotificationContext';
import { RunDisplayPreferencesProvider } from '@/contexts/RunDisplayPreferencesContext';
import { NotificationContainer } from '@/components/notifications/NotificationContainer';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Layout } from '@/components/layout/Layout';
import { OrganizationGuard } from '@/components/routes/OrganizationGuard';
import { WorkspacesLegacyRedirect } from '@/components/routes/WorkspacesLegacyRedirect';
import { RegistryLegacyRedirect } from '@/components/routes/RegistryLegacyRedirect';
import { SettingsLegacyRedirect } from '@/components/routes/SettingsLegacyRedirect';
import Dashboard from './pages/Dashboard';
import Organizations from './pages/Organizations';
import OrganizationDetail from './pages/OrganizationDetail';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Workspaces from './pages/Workspaces';
import WorkspaceDetail from './pages/WorkspaceDetail';
import WorkspacesRedirect from './components/WorkspacesRedirect';
import Registry from './pages/Registry';
import ModuleDetail from './pages/Registry/ModuleDetail';
import ProviderList from './pages/Registry/ProviderList';
import ProviderPublish from './pages/Registry/ProviderPublish';
import Usage from './pages/Usage';
import Activities from './pages/Activities';
import Settings from './pages/Settings';
import ProfileSettings from './pages/Settings/Profile';
import NotificationSettings from './pages/Settings/Notifications';
import SecuritySettings from './pages/Settings/Security';
import UsersSettings from './pages/Settings/Users';
import DocsIndex from './pages/Docs/DocsIndex';
import DocsViewer from './pages/Docs/DocsViewer';
import SessionsSettings from './pages/Settings/Sessions';
import OAuthAuthorize from './pages/OAuthAuthorize';
import ApiKeysSettings from './pages/Settings/ApiKeys';
import OrganizationTokenSettings from './pages/Settings/OrganizationTokenSettings';
import PersonalAccessTokens from './pages/Settings/PersonalAccessTokens';
import PreferencesSettings from './pages/Settings/Preferences';
import VCSConnections from './pages/Settings/VCSConnections';
import Webhooks from './pages/Settings/Webhooks';
import VariableSets from './pages/Settings/VariableSets';
import AgentPools from './pages/Settings/AgentPools';
import OIDCConfigurations from './pages/Settings/OIDCConfigurations';
import TerraformVersions from './pages/Settings/TerraformVersions';
import Runners from './pages/Settings/Runners';
import ChangeRequests from './pages/Settings/ChangeRequests';
import RunTasks from './pages/Settings/RunTasks';
import TeamDetail from './pages/Settings/TeamDetail';
import RunnerDetail from './pages/Settings/RunnerDetail';
import AnsibleConfiguration from './pages/Settings/AnsibleConfig';
import Providers from './pages/Providers';
import RunDetail from './pages/RunDetail';
import StateVersionDetail from './pages/StateVersionDetail';
import RunRedirect from './components/RunRedirect';
import TestJsonViewer from './pages/TestJsonViewer';
import Auth from './pages/Auth';
import LoginRouter from './pages/Login/LoginRouter';
import Landing from './pages/Landing';
import Privacy from './pages/Privacy';
import GitHubInstalled from './pages/VCS/GitHubInstalled';
import AzureDevOpsCallback from './pages/VCS/AzureDevOpsCallback';
// Ansible pages
import { Inventories as AnsibleInventories, InventoryDetail as AnsibleInventoryDetail, Credentials as AnsibleCredentials, Jobs as AnsibleJobs, JobDetail as AnsibleJobDetail, Playbooks as AnsiblePlaybooks, PlaybookDetail as AnsiblePlaybookDetail, JobTemplates as AnsibleJobTemplates, JobTemplateDetail as AnsibleJobTemplateDetail, Schedules as AnsibleSchedules, Collections as AnsibleCollections, Workflows as AnsibleWorkflows } from './pages/Ansible';

function AppContent() {
  const { notifications, dismissNotification } = useNotifications();
  
  return (
    <BrowserRouter basename={config.basePath}>
      <OrganizationProvider>
      <div className="min-h-screen bg-background">
        <NotificationContainer notifications={notifications} onDismiss={dismissNotification} />
        <ConnectionStatus />
        <Routes>
              <Route path="/landing" element={<Landing />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/vcs/github/installed" element={<GitHubInstalled />} />
              <Route path="/vcs/azure-devops/callback" element={<AzureDevOpsCallback />} />
            <Route path="/login/*" element={<LoginRouter />} />
            <Route path="/auth/*" element={<Auth />} />
              <Route path="/oauth/authorize" element={<OAuthAuthorize />} />
              <Route path="/" element={<Landing />} />
              <Route path="/docs" element={<DocsIndex />} />
              <Route path="/docs/*" element={<DocsViewer />} />
              <Route path="/internal-docs" element={<ProtectedRoute><DocsViewer docsBase="/internal-docs" indexFile="/internal-docs-index.json" /></ProtectedRoute>} />
              <Route path="/internal-docs/*" element={<ProtectedRoute><DocsViewer docsBase="/internal-docs" indexFile="/internal-docs-index.json" /></ProtectedRoute>} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                    <Layout>
                  <Dashboard />
                    </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/organizations"
              element={
                <ProtectedRoute>
                    {/* Card grid: extra room becomes extra columns, not fatter cards. */}
                    <Layout width="wide">
                  <Organizations />
                    </Layout>
                </ProtectedRoute>
              }
            />
            <Route
                path="/organizations/:name"
              element={
                <ProtectedRoute>
                    {/* Card grid: extra room becomes extra columns, not fatter cards. */}
                    <Layout width="wide">
                  <OrganizationDetail />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/projects"
                element={
                  <ProtectedRoute>
                    {/* Card grid: extra room becomes extra columns, not fatter cards. */}
                    <Layout width="wide">
                      <Projects />
                    </Layout>
                </ProtectedRoute>
              }
            />
            <Route
                path="/organizations/:organizationName/projects/:projectName"
              element={
                <ProtectedRoute>
                    {/* Card grid: extra room becomes extra columns, not fatter cards. */}
                    <Layout width="wide">
                  <ProjectDetail />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/workspaces"
                element={
                  <ProtectedRoute>
                    <WorkspacesRedirect />
                  </ProtectedRoute>
                }
              />
              {/* Legacy routes - redirect to new structure */}
              <Route
                path="/organizations/:organizationName/workspaces"
                element={
                  <ProtectedRoute>
                    <WorkspacesLegacyRedirect />
                  </ProtectedRoute>
                }
              />
            <Route
                path="/organizations/:organizationName/workspaces/:workspaceName"
              element={
                <ProtectedRoute>
                  <WorkspacesLegacyRedirect />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organizations/:organizationName/registry"
                element={
                  <ProtectedRoute>
                    <RegistryLegacyRedirect />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organizations/:organizationName/registry/modules/:moduleName/:provider"
                element={
                  <ProtectedRoute>
                    <RegistryLegacyRedirect />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organizations/:organizationName/registry/providers"
                element={
                  <ProtectedRoute>
                    <RegistryLegacyRedirect />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organizations/:organizationName/registry/providers/:providerName"
                element={
                  <ProtectedRoute>
                    <RegistryLegacyRedirect />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organizations/:organizationName/settings/variable-sets"
                element={
                  <ProtectedRoute>
                    <SettingsLegacyRedirect />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organizations/:organizationName/registry"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Registry />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organizations/:organizationName/registry/modules/:moduleName/:provider"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ModuleDetail />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organizations/:organizationName/registry/providers"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ProviderList />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organizations/:organizationName/registry/providers/:providerName"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ProviderPublish />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/registry"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Registry />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/usage"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Usage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/activities"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Activities />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    {/* Card grid: extra room becomes extra columns, not fatter cards. */}
                    <Layout width="wide">
                      <Settings />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/profile"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ProfileSettings />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/notifications"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <NotificationSettings />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/security"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <SecuritySettings />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/sessions"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <SessionsSettings />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/tokens"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <PersonalAccessTokens />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/preferences"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <PreferencesSettings />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/vcs-connections"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <VCSConnections />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organizations/:organizationName/settings/variable-sets"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <VariableSets />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/variable-sets"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <VariableSets />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/providers"
                element={
                  <ProtectedRoute>
                    {/* Card grid: extra room becomes extra columns, not fatter cards. */}
                    <Layout width="wide">
                      <Providers />
                    </Layout>
                </ProtectedRoute>
              }
             />
            {/* New V2 Routes: Organization-scoped routes with /app/:orgName/* pattern */}
            <Route
              path="/app/:orgName/projects"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    {/* Card grid: extra room becomes extra columns, not fatter cards. */}
                    <Layout width="wide">
                      <Projects />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/projects/:projectName"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    {/* Card grid: extra room becomes extra columns, not fatter cards. */}
                    <Layout width="wide">
                      <ProjectDetail />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/workspaces"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <Workspaces />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/workspaces/:workspaceName"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <WorkspaceDetail />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            {/* TFE-compatible run route: /app/:orgName/:workspaceName/runs/:runId */}
            <Route
              path="/app/:orgName/:workspaceName/runs/:runId"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <RunDetail />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            {/* Legacy run route: /app/:orgName/workspaces/:workspaceName/runs/:runId */}
            <Route
              path="/app/:orgName/workspaces/:workspaceName/runs/:runId"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <RunDetail />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            {/* State version detail route: /app/:orgName/:workspaceName/states/:stateVersionId */}
            <Route
              path="/app/:orgName/:workspaceName/states/:stateVersionId"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <StateVersionDetail />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/registry"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <Registry />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/registry/modules/:moduleName/:provider"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <ModuleDetail />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/registry/providers"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <ProviderList />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/registry/providers/:providerName"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <ProviderPublish />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/usage"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <Usage />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/settings"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    {/* Card grid: extra room becomes extra columns, not fatter cards. */}
                    <Layout width="wide">
                      <Settings />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/settings/variable-sets"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <VariableSets />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/settings/vcs-connections"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <VCSConnections />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/settings/users"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <UsersSettings />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/settings/webhooks"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <Webhooks />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/settings/api-keys"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <ApiKeysSettings />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/settings/authentication-token"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <OrganizationTokenSettings />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/settings/agent-pools"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <AgentPools />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/settings/oidc"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <OIDCConfigurations />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/settings/terraform-versions"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <TerraformVersions />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/settings/teams/:teamId"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <TeamDetail />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/settings/change-requests"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <ChangeRequests />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/settings/run-tasks"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <RunTasks />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/settings/runners"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <Runners />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/settings/runners/:runnerId"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <RunnerDetail />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/settings/ansible-config"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <AnsibleConfiguration />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />

            {/* Ansible Routes */}
            <Route
              path="/app/:orgName/ansible/inventories"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    {/* Card grid: extra room becomes extra columns, not fatter cards. */}
                    <Layout width="wide">
                      <AnsibleInventories />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/ansible/inventories/:inventoryId"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <AnsibleInventoryDetail />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/settings/credentials"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    {/* Card grid: extra room becomes extra columns, not fatter cards. */}
                    <Layout width="wide">
                      <AnsibleCredentials />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/ansible/jobs"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <AnsibleJobs />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/ansible/jobs/:jobId"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    {/* The run matrix is host x task: its natural width grows with
                        the playbook and overflows `default` on any real run. */}
                    <Layout width="wide">
                      <AnsibleJobDetail />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/ansible/playbooks"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <AnsiblePlaybooks />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/ansible/playbooks/:playbookId"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <AnsiblePlaybookDetail />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/ansible/job-templates"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <AnsibleJobTemplates />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/ansible/job-templates/:templateId"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <AnsibleJobTemplateDetail />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/ansible/schedules"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <AnsibleSchedules />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/ansible/collections"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    {/* Card grid: extra room becomes extra columns, not fatter cards. */}
                    <Layout width="wide">
                      <AnsibleCollections />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/:orgName/ansible/workflows"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <AnsibleWorkflows />
                    </Layout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />

            {/* TFE-compatible route: /app/:organization/:workspace/runs/:id (legacy format) */}
            <Route
                path="/app/:org/:workspace/runs/:id"
              element={
                <ProtectedRoute>
                    <Layout>
                  <RunDetail />
                    </Layout>
                </ProtectedRoute>
              }
            />
            {/* Legacy route: /runs/:id - redirects to TFE format */}
            <Route
                path="/runs/:id"
              element={
                <ProtectedRoute>
                    <Layout>
                  <RunRedirect />
                    </Layout>
                </ProtectedRoute>
              }
            />
            <Route
                path="/test/json-viewer"
              element={
                <ProtectedRoute>
                    <Layout>
                  <TestJsonViewer />
                    </Layout>
                </ProtectedRoute>
              }
            />
        </Routes>
        <Toaster />
      </div>
      </OrganizationProvider>
    </BrowserRouter>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <RunDisplayPreferencesProvider>
              <AppContent />
            </RunDisplayPreferencesProvider>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
