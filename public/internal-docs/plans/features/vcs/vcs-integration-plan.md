# VCS Integration Plan — Multi-Provider Clean Interface

**Status:** Azure DevOps complete (e2e tested); Bitbucket and GitLab pending  
**Related:** [GitHub issue #114](https://github.com/michielvha/stackweaver/issues/114) — do not close until Bitbucket and GitLab providers are implemented.  
**Created:** 2025-02-18  
**Updated:** 2026-02-22 (Azure DevOps e2e tested for Terraform and Ansible flows; design doc aligned with remaining work)  
**Scope:** Clean VCS provider interface, keep GitHub working, full Azure DevOps implementation including automatic webhook registration and PR status checks

---

## 1. Current State

All code changes are implemented, compiling, and unit-tested. The backend builds cleanly with only two pre-existing `contextcheck` lint warnings in `github_provider.go`.

### Provider Layer (`backend/internal/services/vcs/`)

| File | Status | Description |
|------|--------|-------------|
| `provider.go` | Stable | Core `ProviderService` interface — 8 methods covering repos, branches, files, tokens, clone URLs, webhooks |
| `registry.go` | Stable | `ProviderRegistry` dispatches `VCSConnection.Provider` → implementation; accepts `ConnUpdater` callback for token persistence |
| `github_provider.go` | Stable | Full GitHub implementation (App + PAT), HMAC-SHA256 webhooks, push + PR parsing |
| `github_app.go` | Stable | GitHub App API (JWT, installation tokens, repos, branches, files) |
| `github_app_manager.go` | Stable | GitHub App config singleton from env vars |
| `github.go` | Stable | Legacy PAT-based GitHub service |
| `github_status.go` | Stable | GitHub commit status checks for PR runs |
| `azuredevops_manager.go` | **Complete** | Azure DevOps OAuth2 manager via Microsoft Entra ID — auth URL (`login.microsoftonline.com`), code exchange, token refresh; OAuth scopes include `vso.code`, `vso.code_status`, `vso.project`, `offline_access` |
| `azuredevops_provider.go` | **Complete** | Full Azure DevOps implementation — repos, branches, files, OAuth2 tokens, HMAC-SHA1 webhooks, push + PR parsing, per-repository Service Hook registration; `GetFreshToken` auto-persists refreshed tokens via `ConnUpdater`; `doRequest` rejects redirects and HTML responses to prevent silent auth failures |
| `azuredevops_status.go` | **New** | Azure DevOps PR Status API — posts status updates (pending/succeeded/failed/error) to pull requests via `POST /{org}/{project}/_apis/git/repositories/{repo}/pullRequests/{prId}/statuses`; status context uses `stackweaver` genre + `terraform-plan/{workspace}` name for idempotent updates |
| `gitlab_provider.go` | Stub | Returns "not implemented" |
| `bitbucket_provider.go` | Stub | Returns "not implemented" |
| `provider_test.go` | **Updated** | 22 unit tests — registry, clone URLs, HMAC validation, webhook parsing, cross-provider normalization, ADO status mapping, GetConnUpdater |

### Handler Layer (`backend/internal/api/v2/handlers/`)

| File | Status | Changes |
|------|--------|---------|
| `vcs_connections.go` | Fixed | Constructor now receives `*vcs.ProviderRegistry` (was `*vcs.GitHubAppManager`) |
| `vcs_app_installation.go` | **Updated** | Constructor receives all 16 params; added `adoStatusService` field; ADO PR webhook handler now posts pending status to ADO Pull Request Status API and stores `PRNumber`, `SourceBranch`, and real `Committer` as separate fields on ConfigurationVersion; GitHub PR handler similarly stores `PRNumber` (from event), `SourceBranch` (head branch), and `Committer` (`User.Login` from PR event) |
| `runner_agent.go` | Fixed | Clone URL building now uses `vcsRegistry.GetProvider()` → `GetFreshToken()` + `BuildCloneURL()` instead of provider-specific switch |
| `terraform/runs.go` | Fixed | `createConfigurationVersionFromVCS` now uses `vcsRegistry` instead of hardcoded GitHub-only clone logic; `githubAppManager` field removed from struct; run API response includes `pr-number` and `source-branch` attributes from `ConfigurationVersion` when present |
| `terraform/workspaces.go` | Fixed | Added `vcsRegistry` field; `maybeRegisterADOWebhook` helper called after Create and Update when workspace is linked to an ADO repo; `formatWorkspaceSimple` now includes `vcs_account_name` from preloaded VCS connection |

### Routes (`backend/internal/api/v2/routes/routes.go`)

| Change | Details |
|--------|---------|
| Manager creation | `AzureDevOpsManager` + `ProviderRegistry` constructed at startup; registry receives `ConnUpdater` callback backed by `VCSConnectionRepository.Update` |
| Handler wiring | All 3 handler constructors receive correct types and param counts |
| New routes | `GET .../azure-devops/install` (authenticated), `POST .../azure-devops/callback` (public), `POST .../azure-devops/webhook` (public) |

### Other Changes

| File | Change |
|------|--------|
| `backend/cmd/ansible-runner/main.go` | Added `VCSProviderAzureDevOps` case to exhaustive switch |
| `backend/cmd/orchestrator/status_check.go` | **Refactored** — multi-provider status dispatch; dispatches to GitHub or ADO based on `VCSConnection.Provider`; extracted helper functions `mapRunStatusToCheckState`, `buildPlannedDescription`, `buildTargetURL`, `extractPRNumber`; uses `configVersion.PRNumber` directly with fallback to `extractPRNumber(configVersion.Committer)` for backward compatibility |
| `backend/cmd/orchestrator/main.go` | **Updated** — initializes `AzureDevOpsManager`, `AzureDevOpsStatusService`, and `ProviderRegistry` alongside existing GitHub services; passes all services to `updatePRStatusChecks` |
| `backend/cmd/orchestrator/status_check_test.go` | **New** — 19 unit tests for `extractPRNumber`, `mapRunStatusToCheckState`, `buildPlannedDescription` |
| `deploy/vcs.env` | **New** — `STACKWEAVER_WEBHOOK_BASE_URL` + Azure DevOps OAuth2 credentials (separated from SSO config) |
| `deploy/docker-compose.yml` | Added `./vcs.env` to API **and** `ansible-runner` service `env_file` lists |
| `deploy/sso.env` | Removed VCS-related env vars (moved to `vcs.env`) |

---

## 2. API Endpoints

### Azure DevOps Routes (NEW)

| Method | Path | Auth | Handler |
|--------|------|------|---------|
| `GET` | `/api/v2/organizations/:name/vcs-connections/azure-devops/install` | JWT | `InitiateAzureDevOpsInstallation` |
| `POST` | `/api/v2/vcs-connections/azure-devops/callback` | Public | `CompleteAzureDevOpsInstallation` |
| `POST` | `/api/v2/vcs-connections/azure-devops/webhook` | Public | `HandleAzureDevOpsWebhook` |

### Existing Routes (Unchanged)

| Method | Path | Auth | Handler |
|--------|------|------|---------|
| `GET` | `/api/v2/organizations/:name/vcs-connections/github/install` | JWT | `InitiateGitHubInstallation` |
| `GET` | `/api/v2/vcs-connections/github/callback` | Public | `CompleteGitHubInstallation` |
| `POST` | `/api/v2/vcs-connections/github/webhook` | Public | `HandleGitHubWebhook` |
| `GET/POST/PATCH/DELETE` | `/api/v2/organizations/:name/vcs-connections/...` | JWT | CRUD + browsing |

---

## 3. Architecture

```
Frontend
  ├── GitHub Install → GET .../github/install → GitHub OAuth App flow
  ├── ADO Install    → GET .../azure-devops/install → ADO OAuth2 flow
  ├── ADO Callback   → POST .../azure-devops/callback → Exchange code → Store tokens
  │                   (no webhook registration here — done at workspace-link time instead)
  │
  ├── Workspace Create/Update → if VCSConnectionID is ADO + VCSRepository is set
  │                           → maybeRegisterADOWebhook() in background goroutine
  │                             → resolves project/repo names to GUIDs (GET git/repositories/{repo})
  │                             → idempotency check (GET hooks/subscriptions, key = repoGUID/eventType)
  │                             → creates git.push / git.pullrequest.created /
  │                               git.pullrequest.updated scoped to that specific repository
  │
  └── VCS Connections CRUD → uses ProviderRegistry to dispatch to correct provider
       ├── ListRepositories → Provider.ListRepositories()
       ├── ListBranches     → Provider.ListBranches()
       └── GetFileContent   → Provider.GetFileContent()

Webhooks (public, no auth):
  ├── GitHub  → POST .../github/webhook        → ValidateWebhook (HMAC-SHA256) → ParseWebhookPayload → trigger runs
  └── ADO     → POST .../azure-devops/webhook   → ValidateWebhook (HMAC-SHA1)  → ParseWebhookPayload → trigger runs
       ├── git.push                → plan-and-apply runs on matching workspaces
       ├── git.pullrequest.created → speculative plan-only runs (SpeculativeEnabled workspaces)
       └── git.pullrequest.updated → speculative plan-only runs (active PRs only)

Runner Agent (clone URL building):
  Runner receives workspace → looks up VCSConnection → vcsRegistry.GetProvider(conn)
  → provider.GetFreshToken(conn) → provider.BuildCloneURL(conn, token, repoPath)

ProviderRegistry
  ├── "github"       → GitHubProvider{GitHubAppManager}      — App install tokens + PAT
  ├── "azure_devops" → AzureDevOpsProvider{AzureDevOpsManager} — OAuth2 refresh tokens + per-repo Service Hooks
  ├── "gitlab"       → GitLabProvider{}                       — stub
  └── "bitbucket"    → BitbucketProvider{}                    — stub
```

---

## 4. Configuration

### Environment Variables (`deploy/vcs.env`)

> **Note:** The original Azure DevOps OAuth flow (`app.vssps.visualstudio.com`) was deprecated in April 2025 and no longer accepts new registrations. The implementation uses **Microsoft Entra ID OAuth2** (`login.microsoftonline.com`) instead. Registration is in the Azure Portal, not in Azure DevOps.

```env
# Public API base URL — used to register webhook subscriptions automatically.
# Must be reachable from Azure DevOps. Leave unset to skip auto-registration.
STACKWEAVER_WEBHOOK_BASE_URL=https://stackweaver.example.com:8022

# Frontend base URL — used to build clickable target links in PR status checks.
# Must be the externally-accessible URL of the Stackweaver frontend.
STACKWEAVER_BASE_URL=https://sw.example.com

# Azure DevOps — Microsoft Entra ID OAuth2
# Register at: Azure Portal → Microsoft Entra ID → App registrations
AZURE_DEVOPS_CLIENT_ID=<Application (client) ID from Entra app registration>
AZURE_DEVOPS_CLIENT_SECRET=<Client secret value from Certificates & secrets>
AZURE_DEVOPS_REDIRECT_URI=http://localhost:5173/vcs/azure-devops/callback
# AZURE_DEVOPS_TENANT_ID=common  # default; set to specific tenant ID for single-tenant installs
```

These are loaded by the API container via `docker-compose.yml` env_file directive.

### GitHub App Variables (unchanged, in `deploy/.env`)

```env
GITHUB_APP_ID=<app id>
GITHUB_APP_PRIVATE_KEY_PATH=<path>
GITHUB_APP_WEBHOOK_SECRET=<secret>
```

---

## 5. Unit Tests

### Provider Tests (`backend/internal/services/vcs/provider_test.go`)

**Package:** `vcs_test` (black-box)  
**Tests:** 22, all pure functions, no network calls, no database, deterministic  
**Run time:** ~4ms

| Test | What It Validates |
|------|-------------------|
| `TestProviderRegistry_GetProvider` | Registry dispatches to correct provider for all 5 types (4 valid + 1 error) |
| `TestGitHubProvider_BuildCloneURL` | GitHub clone URL format with/without token |
| `TestGitHubProvider_ValidateWebhook` | HMAC-SHA256 validation: empty secret pass, valid pass, invalid fail |
| `TestGitHubProvider_ParseWebhookPayload_Push` | Push event → branch, commit, changed files, committer |
| `TestGitHubProvider_ParseWebhookPayload_PullRequest` | PR event → PR number, head/base branches, commit |
| `TestAzureDevOpsProvider_BuildCloneURL` | ADO clone URL with project/repo split, fallback for single-segment |
| `TestAzureDevOpsProvider_ValidateWebhook` | HMAC-SHA1 validation: empty secret pass, valid pass, invalid fail |
| `TestAzureDevOpsProvider_ParseWebhookPayload_Push` | git.push → normalized push with files |
| `TestAzureDevOpsProvider_ParseWebhookPayload_PullRequest` | git.pullrequest.created → normalized PR |
| `TestAzureDevOpsProvider_ParseWebhookPayload_PullRequestCompleted` | Completed PRs are NOT normalized to "pull_request" |
| `TestAzureDevOpsProvider_ParseWebhookPayload_UnknownEvent` | Unknown events pass through with original eventType |
| `TestAzureDevOpsProvider_ParseWebhookPayload_TagPush` | Tag refs keep full `refs/tags/` prefix in Branch |
| `TestAzureDevOpsProvider_ParseWebhookPayload_MultipleCommits` | Changed files aggregated across all commits |
| `TestAzureDevOpsProvider_ParseWebhookPayload_InvalidJSON` | Returns error for malformed JSON |
| `TestGitHubProvider_ParseWebhookPayload_InvalidJSON` | Returns error for malformed JSON |
| `TestWebhookPayload_Normalization` | Cross-provider: GitHub and ADO produce identical normalized payloads for equivalent events |
| `TestAzureDevOpsManager_Disabled` | Manager disabled without env vars |
| `TestAzureDevOpsManager_Enabled` | Manager enabled with env vars, GetClientID works |
| `TestAzureDevOpsManager_AuthorizationURL` | Authorization URL contains correct endpoint, client_id, response_type |
| `TestMapStatusToADO` | Maps internal StatusState to ADO-specific status (pending→pending, success→succeeded, etc.) |
| `TestAzureDevOpsStatusService_New` | Service creation with nil manager doesn't panic |
| `TestGetConnUpdater` / `TestGetConnUpdater_Nil` | Registry exposes ConnUpdater for external callers |

### Orchestrator Tests (`backend/cmd/orchestrator/status_check_test.go`)

**Package:** `main`  
**Tests:** 19, pure functions, no network calls, no database, deterministic  
**Run time:** ~3ms

| Test | What It Validates |
|------|-------------------|
| `TestExtractPRNumber` | Parses "PR #N" format (9 subtests: valid numbers, empty, non-matching formats) |
| `TestMapRunStatusToCheckState` | Maps run statuses to VCS status states (7 subtests: pending, planning, planned, failed, cancelled, applying, applied) |
| `TestBuildPlannedDescription` | Formats plan impact counts (7 subtests: nil, empty, adds-only, changes-only, destroys-only, all three, mixed) |

---

## 6. Key Design Decisions

1. **Single interface, multiple implementations** — `ProviderService` is the abstraction boundary. Adding a new provider = implement the interface + register in `ProviderRegistry`.
2. **OAuth2 per provider** — Each provider manager handles its own OAuth2 flow. GitHub uses App installation tokens, Azure DevOps uses standard OAuth2 with refresh tokens.
3. **Normalized webhook payloads** — `WebhookPayload` struct normalizes push/PR events across providers. Handlers operate on normalized data, not provider-specific payloads.
4. **Environment-based configuration** — Provider credentials loaded from env vars at startup. Disabled providers return a disabled manager (no errors, features just unavailable).
5. **Token refresh transparency** — `GetFreshToken()` handles token refresh internally. Callers don't need to know about expiration. Refreshed Azure DevOps tokens are automatically persisted to the database via the `ConnUpdater` callback injected through `ProviderRegistry`, so subsequent calls (even from different containers) use the fresh token.
6. **Separated env files** — VCS credentials in `deploy/vcs.env`, SSO/IdP credentials in `deploy/sso.env`, shared infra in `deploy/.env`. Both the API and ansible-runner containers load `vcs.env`. Prevents config entanglement.
7. **Per-repository webhook registration** — `RegisterWebhooksForRepo(ctx, conn, webhookBaseURL, projectName, repoName)` is part of the `ProviderService` interface. It is called from the workspace Create and Update handlers when a workspace is linked to an ADO repository — not during the initial OAuth flow. This keeps subscriptions scoped to exactly the repositories that are actually in use, avoiding the security and noise problems of org-wide subscriptions. Idempotent: the idempotency key is `repoGUID/eventType`, so re-saving a workspace does not duplicate subscriptions. GitHub and the stubs return nil (no-op). If `STACKWEAVER_WEBHOOK_BASE_URL` is not set, registration is skipped silently.

---

## 7. Frontend Architecture

### Shared VCS Utility (`frontend/src/lib/vcs.tsx`)

All provider-specific frontend logic is centralised in a single shared module. No component contains its own provider switch. The module exports:

| Export | Purpose |
|--------|---------|
| `getVcsProviderIcon(provider, className?)` | Branded SVG icon — GitHub (lucide), Azure DevOps, GitLab, Bitbucket (custom SVGs), generic fallback |
| `getVcsProviderLabel(provider)` | Human-readable name string |
| `getVcsRepoUrl(provider, repo, accountName?)` | Repository root URL |
| `getVcsBranchUrl(provider, repo, branch, accountName?)` | Branch browse URL |
| `getVcsFileUrl(provider, repo, branch, filePath, accountName?)` | File blob URL |
| `getVcsCommitUrl(provider, repo, commit, accountName?)` | Commit URL |
| `getVcsManageUrl(provider, installationId, accountName, accountType)` | GitHub App installation management URL (null for non-GitHub) |

All functions return `null` when the required information to build a URL is missing (e.g. ADO without `accountName`).

### `vcs_account_name` Propagation

The workspace `?format=simple` API response now includes `vcs_account_name`, populated from the preloaded `VCSConnection.AccountName`. This field is required to construct Azure DevOps URLs. The `Workspace` TypeScript interface now includes `vcs_account_name?: string`.

Backend changes:
- `backend/internal/repository/workspace.go` — added `Preload("VCSConnection")` to `GetByID`, `GetByOrganizationAndName`, `ListByOrganization`, `ListByOrganizationAndIDs`
- `backend/internal/api/v2/handlers/terraform/workspaces.go` — `formatWorkspaceSimple` populates `vcs_account_name` from `workspace.VCSConnection.AccountName` when VCS connection is set

### Components Updated

| File | Change |
|------|--------|
| `frontend/src/lib/vcs.tsx` | **New** — shared utility module; exports `getVcsProviderIcon`, `getVcsProviderLabel`, `getVcsRepoUrl`, `getVcsBranchUrl`, `getVcsFileUrl`, `getVcsCommitUrl`, `getVcsPullRequestUrl`, `getVcsManageUrl` |
| `frontend/src/api/client.ts` | Added `vcs_account_name?: string` to `Workspace` interface; added `azure_devops` to provider type; ADO API methods; `?format=simple` on workspace create; added `'pr-number'?: number` and `'source-branch'?: string` to `Run` interface |
| `frontend/src/pages/WorkspaceDetail.tsx` | Provider-aware repo link + commit links via shared utility |
| `frontend/src/pages/Workspaces.tsx` | Provider-aware repo column link and icon |
| `frontend/src/pages/Ansible/PlaybookDetail.tsx` | Provider-aware VCS card, commit link, manage URL |
| `frontend/src/pages/Ansible/Playbooks.tsx` | Provider-aware badge, file/branch/repo links, manage URL |
| `frontend/src/pages/Ansible/Inventories.tsx` | Provider-aware icon in connection list and repo selector |
| `frontend/src/pages/Ansible/InventoryDetail.tsx` | Provider-aware icon and repo/file URLs |
| `frontend/src/pages/Registry/ModuleDetail.tsx` | Provider-aware icon and repo URL |
| `frontend/src/components/workspace/CreateWorkspaceDialog.tsx` | Removed local provider helpers; uses shared utility; provider-aware manage URL |
| `frontend/src/components/workspace/EditWorkspaceDialog.tsx` | Same as CreateWorkspaceDialog |
| `frontend/src/components/registry/CreateModuleDialog.tsx` | Removed local provider helpers; uses shared utility |
| `frontend/src/components/runs/RunSourceDisplay.tsx` | Replaced 40-line local `getCommitUrl` with `getVcsCommitUrl` from shared utility; shows PR icon with `#N` (orange badge, clickable → PR page), source branch (purple monospace, clickable → branch page), commit hash (blue link → commit page), and committer name as separate display elements for VCS-triggered runs |
| `frontend/src/pages/VCS/AzureDevOpsCallback.tsx` | **New** — OAuth callback page |
| `frontend/src/App.tsx` | Added `/vcs/azure-devops/callback` route |
| `frontend/src/pages/Settings/VCSConnections.tsx` | Azure DevOps provider card + connect button |
| `frontend/src/components/vcs/VCSProviderSelector.tsx` | Azure DevOps card in workspace/playbook/inventory dialogs |
| `frontend/src/pages/Settings/Webhooks.tsx` | ADO webhook URL section |

### OAuth Flow (Azure DevOps)

```
1. User clicks "Connect Azure DevOps" → dialog prompts for ADO organization name
2. Frontend calls GET /organizations/:name/vcs-connections/azure-devops/install?ado_org={adoOrg}&return={returnPath}
   → Backend returns { data: { auth_url: "https://login.microsoftonline.com/..." } }
3. Frontend redirects to auth_url
4. User authenticates with Microsoft
5. Microsoft redirects to AZURE_DEVOPS_REDIRECT_URI = http://localhost:5173/vcs/azure-devops/callback?code=xxx&state=yyy
6. AzureDevOpsCallback.tsx reads code + state (state = "stackweaverOrg|adoOrg|base64(returnPath)|uuid")
7. Calls POST /api/v2/vcs-connections/azure-devops/callback?code={code}&state={state}
   → Backend exchanges code for token, creates VCSConnection record
8. Navigate to returnPath or /app/{orgName}/settings/vcs-connections
```

### URL Formats per Provider

| Provider | Repo | Branch | File | Commit | Pull Request |
|----------|------|--------|------|--------|--------------|
| `github` | `https://github.com/{repo}` | `.../tree/{branch}` | `.../blob/{branch}/{path}` | `.../commit/{hash}` | `.../pull/{number}` |
| `gitlab` | `https://gitlab.com/{repo}` | `.../-/tree/{branch}` | `.../-/blob/{branch}/{path}` | `.../-/commit/{hash}` | `.../-/merge_requests/{number}` |
| `azure_devops` | `https://dev.azure.com/{org}/{project}/_git/{repo}` | `...?version=GB{branch}` | `...?path={path}&version=GB{branch}` | `.../commit/{hash}` | `.../pullrequest/{number}` |
| `bitbucket` | `https://bitbucket.org/{repo}` | `.../src/{branch}` | `.../src/{branch}/{path}` | `.../commits/{hash}` | `.../pull-requests/{number}` |

For Azure DevOps, `{org}` is `vcs_account_name` from the workspace response, `{project}/{repo}` comes from splitting `vcs_repository` on `/`.

---

## 8. Remaining Work

### Bug Fixes Applied
- [x] Workspace creation redirect: `workspacesApi.create` added `?format=simple` so flat `Workspace` object is returned and `workspace.name` is populated correctly
- [x] Run creation clone failure (exit 128): `RunHandlerV2.createConfigurationVersionFromVCS` replaced hardcoded GitHub-only clone URL with `vcsRegistry.GetProvider()` → `GetFreshToken()` + `BuildCloneURL()`
- [x] Frontend VCS provider icons and URLs: all hardcoded GitHub implementations replaced with shared `@/lib/vcs` utility; Azure DevOps, GitLab, Bitbucket icons and URLs fully supported
- [x] `vcs_account_name` propagation: backend workspace repository queries preload `VCSConnection`; `formatWorkspaceSimple` includes `vcs_account_name`; `Workspace` TypeScript interface updated
- [x] Azure DevOps token refresh persistence: `GetFreshToken` now persists refreshed access/refresh tokens and expiry to the database via `ConnUpdater` callback injected through `ProviderRegistry`. Previously, refreshed tokens were only used in-memory and lost between requests, causing repeated refresh failures when the old refresh token was consumed (single-use) or the old access token expired
- [x] Azure DevOps `doRequest` redirect hardening: `doRequestWithBody` now disables Go's default HTTP redirect following and explicitly rejects 3xx responses and HTML response bodies. Previously, expired tokens caused ADO to return a 302 redirect to the sign-in page; Go followed the redirect, the sign-in page returned 200 with HTML, and `json.Unmarshal` failed with `invalid character '<'` — making it look like the API was "broken" rather than an auth issue
- [x] Ansible-runner missing `vcs.env`: `deploy/docker-compose.yml` now includes `./vcs.env` in the `ansible-runner` service's `env_file` list, so the `AzureDevOpsManager` is properly configured and can refresh tokens. Previously, the manager was created in disabled mode (logging a warning) and `GetFreshToken` always fell back to the stale stored token
- [x] Playbook API `vcs_provider` / `vcs_account_name`: `formatPlaybookResponse` now includes `vcs-provider` and `vcs-account-name` attributes derived from the preloaded `VCSConnection`. The frontend `AnsiblePlaybook` interface and JSON:API deserializer extract these fields. Playbook overview and detail pages use `playbook.vcs_provider` directly instead of looking up `vcsConnections` (which was only loaded when the create/edit dialog opened), eliminating the delayed/missing VCS icon issue
- [x] Workspace VCS icon color: removed hardcoded `text-purple-500` classes from VCS provider icons in the workspace overview table, keeping native icon colors
- [x] Azure DevOps PR status checks: new `AzureDevOpsStatusService` posts status updates to ADO pull requests via the Pull Request Status API (`POST /{org}/{project}/_apis/git/repositories/{repo}/pullRequests/{prId}/statuses?api-version=7.1`). Status context uses `stackweaver` genre + `terraform-plan/{workspace}` name for idempotent updates. The webhook handler posts a pending status immediately after creating a speculative run, and the orchestrator updates the status as the run progresses (pending → succeeded/failed/error). Supports multiple workspaces simultaneously — each workspace gets its own status check entry
- [x] ~"Run not triggered" status checks~ — **Reverted.** Initially implemented to match TFE behavior (posting a "succeeded" status for workspaces whose working directory didn't match changed files), but removed because it pollutes the PR status list with redundant noise. Workspaces that are not affected by changed files simply get no status check entry, which is cleaner and less confusing
- [x] Azure DevOps PR metadata: `ConfigurationVersion` model now has dedicated `PRNumber int` and `SourceBranch string` fields (GORM auto-migrated). Both ADO and GitHub PR webhook handlers store the PR number, source branch, and real committer as separate fields instead of overwriting `Committer` with `"PR #N"` format. The orchestrator reads `configVersion.PRNumber` directly (with `extractPRNumber` fallback for old data). The run API response includes `pr-number` and `source-branch` JSON:API attributes. The frontend `RunSourceDisplay` component displays all four pieces of metadata (PR number, source branch, commit hash, committer) as separate visual elements
- [x] Azure DevOps `vso.code_status` OAuth scope: the PR Status API requires the `vso.code_status` scope (separate from `vso.code`). This scope was added to the `adoScopes` constant. **User action required:** add the `vso.code_status` permission to the Entra ID app registration, then delete and re-create the VCS connection to re-authorize with the new scope (existing tokens do not pick up new scopes)
- [x] Azure DevOps `connectionData` API version: the `_apis/connectionData` endpoint used for org validation during VCS connection setup requires `api-version=7.1-preview` (it is a preview API at version 7.1). Previously used `7.1` without the preview flag, causing a 400 `VssInvalidPreviewVersionException` when re-initializing VCS connections
- [x] Frontend `getRunFromJsonApi` missing PR metadata: the `getRunFromJsonApi()` function in `utils/jsonapi.ts` explicitly maps each JSON:API attribute to the `Run` object but was missing `pr-number` and `source-branch`. These attributes were returned by the API but silently dropped during parsing, so `RunSourceDisplay` never received them
- [x] Multi-provider orchestrator status checks: `updatePRStatusCheck` in the orchestrator now dispatches to GitHub or Azure DevOps based on `VCSConnection.Provider` instead of being GitHub-only. The orchestrator initializes both `GitHubStatusService` and `AzureDevOpsStatusService` at startup, along with a `ProviderRegistry` for ADO token refresh
- [x] Azure DevOps `ListFiles` leading-slash path normalization: the ADO Items API returns file paths with a leading `/` (e.g. `/ansible-examples/playbooks/site.yml`), while GitHub returns paths without one. This caused Ansible playbook paths stored from ADO repos to be treated as absolute system paths by `filepath.IsAbs()` in `buildAnsibleArgs` and `syncPlaybook`, resulting in `chdir: no such file or directory` errors when running jobs. Fixed by stripping the leading `/` in `ListFiles` (provider level), and adding defensive `strings.TrimPrefix(playbookPath, "/")` in `buildAnsibleArgs`, `syncPlaybook`, and `agent_mode.go` to handle existing data

### Integration Testing
- [x] End-to-end test with a real Azure DevOps organization — verified: workspace creation, VCS connection, push webhooks trigger plan-and-apply runs, webhook auto-registration creates correct Service Hook subscriptions
- [x] **Terraform flow (ADO):** workspace link, push/PR webhooks, plan-and-apply and speculative runs, PR status checks, clone URL and token refresh — e2e tested
- [x] **Ansible flow (ADO):** playbook/inventory from ADO repo, job execution with correct playbook path (leading-slash normalization), clone and run — e2e tested
- [x] Verify webhook payload format matches actual ADO Service Hook payloads — confirmed working for `git.push`, `git.pullrequest.created`, and `git.pullrequest.updated` events
- [ ] Verify `RegisterWebhooksForRepo` handles missing Service Hook creation permission gracefully (currently logs a warning and continues)
- [x] Verify ADO PR status updates appear correctly on pull requests — confirmed: pending → planning → planned (succeeded) status progression works correctly with clickable target URLs; multi-workspace status checks display independently; `STACKWEAVER_BASE_URL` env var correctly sets external domain in target links
- [x] `STACKWEAVER_BASE_URL` for status check target URLs: configured in `deploy/vcs.env`, loaded by both the API and orchestrator services. The base URL is used to construct clickable target links in PR status checks (e.g. `https://sw.vhco.pro/app/{org}/workspaces/{ws}/runs/{run}`). Defaults to `http://localhost:5173` when unset. Both `status_check.go` (orchestrator) and `vcs_app_installation.go` (webhook handler) read this env var
- [x] Frontend PR metadata display verified: PR number (clickable → ADO PR page), source branch (clickable → branch page), commit hash (clickable → commit page), and committer all display correctly in `RunSourceDisplay`

### Future Work (issue #114 remains open until done)
- [ ] **GitLab** provider implementation (OAuth, webhooks, PR status, `RegisterWebhooksForRepo`)
- [ ] **Bitbucket** provider implementation (including `RegisterWebhooksForRepo` via Bitbucket Webhooks API)
- [ ] VCS connection health check endpoint


## Good to know about the design choices

**Orchestrator init pattern:** The initialization is actually symmetric - both GitHub and ADO follow the same pattern (create manager → create status service). The only difference is ADO needs a connUpdater callback because ADO uses OAuth tokens that expire and need refreshing+persisting, while GitHub App uses installation tokens generated on-the-fly from a private key. That's an inherent auth model difference, not a design flaw. Both are separate binaries so they each construct their own instances.
