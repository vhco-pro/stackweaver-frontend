// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { createRoutesFromElements, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { internalDocs } from '@/components/docs/docsCollection';
import { deferredPage } from '@/components/routes/deferredPage';
import { DocsShell } from '@/components/routes/DocsShell';
import Landing from './pages/Landing';

const ApplicationProviders = deferredPage(() => import('@/components/routes/ApplicationProviders'), 'ApplicationProviders');

const Layout = deferredPage(async () => ({ default: (await import('@/components/layout/Layout')).Layout }), 'Layout');
const OrganizationGuard = deferredPage(async () => ({ default: (await import('@/components/routes/OrganizationGuard')).OrganizationGuard }), 'OrganizationGuard');
const WorkspacesLegacyRedirect = deferredPage(async () => ({ default: (await import('@/components/routes/WorkspacesLegacyRedirect')).WorkspacesLegacyRedirect }), 'WorkspacesLegacyRedirect');
const RegistryLegacyRedirect = deferredPage(async () => ({ default: (await import('@/components/routes/RegistryLegacyRedirect')).RegistryLegacyRedirect }), 'RegistryLegacyRedirect');
const SettingsLegacyRedirect = deferredPage(async () => ({ default: (await import('@/components/routes/SettingsLegacyRedirect')).SettingsLegacyRedirect }), 'SettingsLegacyRedirect');
const ProjectsLegacyRedirect = deferredPage(async () => ({ default: (await import('@/components/routes/ProjectsLegacyRedirect')).ProjectsLegacyRedirect }), 'ProjectsLegacyRedirect');
const Dashboard = deferredPage(() => import('./pages/Dashboard'), 'Dashboard');
const Organizations = deferredPage(() => import('./pages/Organizations'), 'Organizations');
const Projects = deferredPage(() => import('./pages/Projects'), 'Projects');
const ProjectDetail = deferredPage(() => import('./pages/ProjectDetail'), 'ProjectDetail');
const Workspaces = deferredPage(() => import('./pages/Workspaces'), 'Workspaces');
const WorkspaceDetail = deferredPage(() => import('./pages/WorkspaceDetail'), 'WorkspaceDetail');
const WorkspacesRedirect = deferredPage(() => import('./components/WorkspacesRedirect'), 'WorkspacesRedirect');
const Registry = deferredPage(() => import('./pages/Registry'), 'Registry');
const ModuleDetail = deferredPage(() => import('./pages/Registry/ModuleDetail'), 'ModuleDetail');
const ProviderList = deferredPage(() => import('./pages/Registry/ProviderList'), 'ProviderList');
const ProviderPublish = deferredPage(() => import('./pages/Registry/ProviderPublish'), 'ProviderPublish');
const Usage = deferredPage(() => import('./pages/Usage'), 'Usage');
const Activities = deferredPage(() => import('./pages/Activities'), 'Activities');
const Settings = deferredPage(() => import('./pages/Settings'), 'Settings');
const ProfileSettings = deferredPage(() => import('./pages/Settings/Profile'), 'ProfileSettings');
const NotificationSettings = deferredPage(() => import('./pages/Settings/Notifications'), 'NotificationSettings');
const SecuritySettings = deferredPage(() => import('./pages/Settings/Security'), 'SecuritySettings');
const UsersSettings = deferredPage(() => import('./pages/Settings/Users'), 'UsersSettings');
const DocsIndex = deferredPage(() => import('./pages/Docs/DocsIndex'), 'DocsIndex', { publicDocs: true });
const DocsViewer = deferredPage(() => import('./pages/Docs/DocsViewer'), 'DocsViewer', { publicDocs: true });
const ApiReferenceExplorer = deferredPage(() => import('./pages/Docs/ApiReferenceExplorer'), 'ApiReferenceExplorer');
const SessionsSettings = deferredPage(() => import('./pages/Settings/Sessions'), 'SessionsSettings');
const OAuthAuthorize = deferredPage(() => import('./pages/OAuthAuthorize'), 'OAuthAuthorize');
const ApiKeysSettings = deferredPage(() => import('./pages/Settings/ApiKeys'), 'ApiKeysSettings');
const OrganizationTokenSettings = deferredPage(() => import('./pages/Settings/OrganizationTokenSettings'), 'OrganizationTokenSettings');
const PersonalAccessTokens = deferredPage(() => import('./pages/Settings/PersonalAccessTokens'), 'PersonalAccessTokens');
const PreferencesSettings = deferredPage(() => import('./pages/Settings/Preferences'), 'PreferencesSettings');
const VCSConnections = deferredPage(() => import('./pages/Settings/VCSConnections'), 'VCSConnections');
const Webhooks = deferredPage(() => import('./pages/Settings/Webhooks'), 'Webhooks');
const VariableSets = deferredPage(() => import('./pages/Settings/VariableSets'), 'VariableSets');
const AgentPools = deferredPage(() => import('./pages/Settings/AgentPools'), 'AgentPools');
const OIDCConfigurations = deferredPage(() => import('./pages/Settings/OIDCConfigurations'), 'OIDCConfigurations');
const TofuVersions = deferredPage(() => import('./pages/Settings/TofuVersions'), 'TofuVersions');
const PlatformAdministrators = deferredPage(() => import('./pages/Settings/PlatformAdministrators'), 'PlatformAdministrators');
const PlatformOrganizations = deferredPage(() => import('./pages/Settings/PlatformOrganizations'), 'PlatformOrganizations');
const Runners = deferredPage(() => import('./pages/Settings/Runners'), 'Runners');
const ChangeRequests = deferredPage(() => import('./pages/Settings/ChangeRequests'), 'ChangeRequests');
const RunTasks = deferredPage(() => import('./pages/Settings/RunTasks'), 'RunTasks');
const TeamDetail = deferredPage(() => import('./pages/Settings/TeamDetail'), 'TeamDetail');
const RunnerDetail = deferredPage(() => import('./pages/Settings/RunnerDetail'), 'RunnerDetail');
const AnsibleConfiguration = deferredPage(() => import('./pages/Settings/AnsibleConfig'), 'AnsibleConfiguration');
const OrganizationSettings = deferredPage(() => import('./pages/Settings/Organization'), 'OrganizationSettings');
const Providers = deferredPage(() => import('./pages/Providers'), 'Providers');
const RunDetail = deferredPage(() => import('./pages/RunDetail'), 'RunDetail');
const StateVersionDetail = deferredPage(() => import('./pages/StateVersionDetail'), 'StateVersionDetail');
const RunRedirect = deferredPage(() => import('./components/RunRedirect'), 'RunRedirect');
const Auth = deferredPage(() => import('./pages/Auth'), 'Auth');
const LoginRouter = deferredPage(() => import('./pages/Login/LoginRouter'), 'LoginRouter');
const Privacy = deferredPage(() => import('./pages/Privacy'), 'Privacy');
const Terms = deferredPage(() => import('./pages/Terms'), 'Terms');
const GitHubInstalled = deferredPage(() => import('./pages/VCS/GitHubInstalled'), 'GitHubInstalled');
const GitHubAuthorized = deferredPage(() => import('./pages/VCS/GitHubAuthorized'), 'GitHubAuthorized');
const AzureDevOpsCallback = deferredPage(() => import('./pages/VCS/AzureDevOpsCallback'), 'AzureDevOpsCallback');
const AnsibleInventories = deferredPage(() => import('./pages/Ansible/Inventories'), 'AnsibleInventories');
const AnsibleInventoryDetail = deferredPage(() => import('./pages/Ansible/InventoryDetail'), 'AnsibleInventoryDetail');
const AnsibleCredentials = deferredPage(() => import('./pages/Ansible/Credentials'), 'AnsibleCredentials');
const AnsibleJobs = deferredPage(() => import('./pages/Ansible/Jobs'), 'AnsibleJobs');
const AnsibleJobDetail = deferredPage(() => import('./pages/Ansible/JobDetail'), 'AnsibleJobDetail');
const AnsiblePlaybooks = deferredPage(() => import('./pages/Ansible/Playbooks'), 'AnsiblePlaybooks');
const AnsiblePlaybookDetail = deferredPage(() => import('./pages/Ansible/PlaybookDetail'), 'AnsiblePlaybookDetail');
const AnsibleJobTemplates = deferredPage(() => import('./pages/Ansible/JobTemplates'), 'AnsibleJobTemplates');
const AnsibleJobTemplateDetail = deferredPage(() => import('./pages/Ansible/JobTemplateDetail'), 'AnsibleJobTemplateDetail');
const AnsibleSchedules = deferredPage(() => import('./pages/Ansible/Schedules'), 'AnsibleSchedules');
const AnsibleCollections = deferredPage(() => import('./pages/Ansible/Collections'), 'AnsibleCollections');
const AnsibleWorkflows = deferredPage(() => import('./pages/Ansible/Workflows'), 'AnsibleWorkflows');

export const appRoutes = createRoutesFromElements(<>

              <Route path="/landing" element={<Landing />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/vcs/github/installed" element={<GitHubInstalled />} />
              <Route path="/vcs/github/authorized" element={<GitHubAuthorized />} />
              <Route path="/vcs/azure-devops/callback" element={<AzureDevOpsCallback />} />
            <Route path="/login/*" element={<LoginRouter />} />
            <Route path="/auth/*" element={<Auth />} />
              <Route path="/oauth/authorize" element={<OAuthAuthorize />} />
              <Route path="/" element={<Landing />} />
            <Route element={<DocsShell />}>
              <Route path="/docs" element={<DocsIndex />} />
              {/* Ahead of /docs/*, which would otherwise resolve "explorer" as a
                  markdown document and 404. */}
              <Route path="/docs/api-reference/explorer" element={<ApiReferenceExplorer />} />
              <Route path="/docs/*" element={<DocsViewer />} />
              <Route path="/internal-docs" element={<ProtectedRoute><DocsIndex collection={internalDocs} /></ProtectedRoute>} />
              <Route path="/internal-docs/*" element={<ProtectedRoute><DocsViewer docsBase="/internal-docs" indexFile="/internal-docs-index.json" /></ProtectedRoute>} />
            </Route>
            <Route element={<ApplicationProviders />}>
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                    {/* Dashboard: side-by-side sections and a full-width chart, the tier
                        PageContainer names for exactly this. */}
                    <Layout width="wide">
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
                  <ProjectsLegacyRedirect />
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
                  <ProjectsLegacyRedirect />
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
              {/* Install-wide platform pages: the admin routes answer 404 to anyone who is not a
                  platform administrator, and each page shows its not-found state then. */}
              <Route
                path="/settings/platform/administrators"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <PlatformAdministrators />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/platform/terraform-versions"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <TofuVersions />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings/platform/organizations"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <PlatformOrganizations />
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
              path="/app/:orgName/registry/providers/:registryName/:namespace/:providerName"
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
            {/* The versions are install-wide, so the page lives under the platform settings; the old
                organization path stays as a redirect so bookmarks keep working. */}
            <Route
              path="/app/:orgName/settings/terraform-versions"
              element={<Navigate to="/settings/platform/terraform-versions" replace />}
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
            <Route
              path="/app/:orgName/settings/organization"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <Layout>
                      <OrganizationSettings />
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
            </Route>
</>);
