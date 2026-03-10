<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Terraform Cloud Workspace Features & Implementation Plan

## ⚠️ Important: Zitadel Integration & TFE API Compatibility

### Using Zitadel for GitHub Integration

**Zitadel provides identity provider (IdP) integration** that allows users to authenticate with GitHub. However, for VCS operations (reading repos, creating webhooks), we need GitHub API access tokens.

**Approach:**
1. **User Authentication**: Use Zitadel's GitHub IdP integration (configured via Zitadel SDK)
   - Users log in with GitHub through Zitadel
   - Zitadel handles the OAuth flow
   - We authenticate users via Zitadel (already implemented)

2. **VCS Operations**: Get GitHub tokens through Zitadel's OAuth flow
   - When user connects GitHub, use Zitadel's OAuth to get GitHub access token
   - Store token securely (encrypted) for GitHub API calls
   - Use token for: listing repos, branches, creating webhooks, etc.

**Implementation Strategy:**
- Use Zitadel SDK (`zitadel-go`) to configure GitHub as an external IdP
- Use Zitadel's OAuth flow to obtain GitHub tokens for VCS operations
- Store tokens in `VCSConnection` model (encrypted)
- Use tokens for GitHub API calls via `github.com/google/go-github`

### Terraform Enterprise (TFE) API Compatibility

**Goal**: Make our API compatible with the official `terraform-provider-tfe` so users can use the standard Terraform provider without modifications.

**TFE Provider API Endpoints** (from `hashicorp/terraform-provider-tfe`):

**✅ Implemented (TFE-Compatible):**
- ✅ `GET /api/v2/organizations` - List organizations
- ✅ `POST /api/v2/organizations` - Create organization
- ✅ `GET /api/v2/organizations/:name` - Get organization
- ✅ `PATCH /api/v2/organizations/:name` - Update organization
- ✅ `DELETE /api/v2/organizations/:name` - Delete organization
- ✅ `GET /api/v2/organizations/:name/entitlement-set` - Get organization entitlements
- ✅ `GET /api/v2/organizations/:name/workspaces` - List workspaces
- ✅ `GET /api/v2/organizations/:name/workspaces/:name` - Get workspace
- ✅ `POST /api/v2/organizations/:name/workspaces` - Create workspace
- ✅ `PATCH /api/v2/organizations/:name/workspaces/:name` - Update workspace
- ✅ `DELETE /api/v2/organizations/:name/workspaces/:name` - Delete workspace
- ✅ `POST /api/v2/workspaces/:id/configuration-versions` - Create configuration version
- ✅ `GET /api/v2/workspaces/:id/configuration-versions` - List configuration versions
- ✅ `GET /api/v2/configuration-versions/:id` - Get configuration version
- ✅ `PUT /api/v2/configuration-versions/:id/upload` - Upload configuration files
- ✅ `POST /api/v2/runs` - Create run (supports configuration-version relationship)
- ✅ `GET /api/v2/runs/:id` - Get run
- ✅ `GET /api/v2/runs/:id/plan` - Get plan output
- ✅ `GET /api/v2/plans/:id` - Get plan output (TFE-compatible alias, plan ID = run ID)
  - **Auth**: TFE token or JWT token (Authorization header)
  - Returns plan status "finished" for completed plans (TFE Plans API spec)
  - Includes status timestamps (queued-at, pending-at, started-at, finished-at)
  - Includes `has-changes`, resource counts (additions, changes, destructions, imports)
  - Includes `log-read-url` with absolute URL and token in query parameter
  - Includes relationships (state-versions) and links (self, json-output)
- ✅ `GET /api/v2/runs/:id/logs` - Get run logs (TFE-compatible, supports all execution modes)
- ✅ `POST /api/v2/runs/:id/actions/apply` - Apply run
- ✅ `POST /api/v2/runs/:id/actions/cancel` - Cancel run
- ✅ `POST /api/v2/runs/:id/actions/discard` - Discard run
- ✅ `POST /api/v2/runs/:id/actions/force-cancel` - Force cancel run
- ✅ `POST /api/v2/runs/:id/actions/force-execute` - Force execute run
- ✅ `GET /api/v2/workspaces/:id/runs` - List runs by workspace
- ✅ `GET /api/v2/organizations/:name/runs` - List runs by organization
- ✅ `GET /api/v2/organizations/:name/runs/queue` - Get run queue for organization
- ✅ `GET /api/v2/workspaces/:id/state-versions` - List state versions
- ✅ `POST /api/v2/workspaces/:id/state-versions` - Create state version
- ✅ `GET /api/v2/state-versions/:id` - Get state version
- ✅ `POST /api/v2/workspaces/:id/vars` - Create variable (TFE uses `vars`)
- ✅ `GET /api/v2/workspaces/:id/vars` - List variables
- ✅ `PATCH /api/v2/workspaces/:id/vars/:variable_id` - Update variable
- ✅ `DELETE /api/v2/workspaces/:id/vars/:variable_id` - Delete variable
- ✅ `POST /api/v2/tokens` - Create TFE token
- ✅ `GET /api/v2/tokens` - List user's TFE tokens
- ✅ `DELETE /api/v2/tokens/:id` - Delete TFE token
- ✅ `GET /api/v2/ping` - Ping endpoint (health check)
  - **Auth**: Public endpoint (no authentication required)
  - Used by Terraform CLI for backend health checks
  - Returns `200 OK` with JSON response

**API Compatibility Requirements:**
1. ✅ **URL Structure**: Using `/api/v2/` prefix (v1 removed, fully migrated to v2)
2. ✅ **Authentication**: Supports both JWT (Zitadel) and TFE token authentication
   - **TFE tokens**: `Authorization: Bearer <tfe-token>` (prefixed with "tfe-")
     - Stored in `tfe_tokens` table
     - Validated via `TFETokenRepository.GetByToken()`
     - Used for Terraform CLI operations
   - **JWT tokens**: `Authorization: Bearer <jwt-token>` (from Zitadel)
     - Validated via Zitadel OIDC verifier
     - Used for frontend/web operations
   - **Query parameter tokens**: Some endpoints support `?token=<token>` in URL
     - Used for: `/api/v2/configuration-versions/:id/upload?token=<upload_token>`
     - Used for: `/api/v2/runs/:id/logs?token=<token>` (Terraform CLI compatibility)
     - Auth middleware checks query parameter if Authorization header is missing
   - **Middleware behavior**: Checks TFE tokens first, then JWT tokens, then query parameters
3. ✅ **Response Format**: Matches TFE JSON:API structure (`{ data: { id, type, attributes, relationships } }`)
4. ✅ **Pagination**: Supports TFE-style pagination (`page[size]`, `page[number]`) and offset-based (`page`, `per_page`)
5. ⏭️ **Filtering**: TFE query parameters (`filter[workspace][name]`, etc.) - TODO
6. ✅ **Error Format**: Matches TFE error format (`{ errors: [{ status, title, detail }] }`)
7. ✅ **Public Endpoints**: `/api/v2/ping` is public (no authentication required) for backend health checks

**Current State**: ✅ **Fully migrated to v2 API**
- ✅ All endpoints use `/api/v2/` prefix
- ✅ Frontend migrated to v2 endpoints (uses `?format=simple` for compatibility)
- ✅ TFE-compatible response formats (JSON:API)
- ✅ Dual authentication (JWT + TFE tokens)
- ✅ All core TFE endpoints implemented
- ✅ Configuration versions support (required for `terraform plan`)
- ✅ **Storage**: Both configuration files and state files stored in MinIO (TFE-compatible)
  - Configuration: `configuration-versions/{id}/config.tar.gz`
  - State: `workspaces/{workspace_id}/state/{version}.json`
  - Database stores only metadata (version numbers, lineage, serial, timestamps)

**Configuration Version Upload Implementation (✅ Fully Implemented):**
- ✅ **Token-Based Authentication**: Upload endpoint uses temporary token in URL query parameter (not Authorization header)
  - Token is generated when configuration version is created
  - Token is stored in database (`upload_token` field in `configuration_versions` table)
  - Upload URL format: `/api/v2/configuration-versions/:id/upload?token=<upload_token>`
- ✅ **Auth Middleware Bypass**: Upload endpoint is registered separately to bypass authentication middleware
  - Terraform CLI doesn't send Authorization header for upload URLs
  - Token validation happens in the upload handler itself
- ✅ **Storage Integration**: Configuration files stored in MinIO using `storage.Client` interface
  - Storage client initialized at startup with MinIO configuration
  - Files stored at: `configuration-versions/{config_version_id}/config.tar.gz`
  - Storage client properly initialized before handler creation
- ✅ **Upload Flow**:
  1. Terraform CLI creates configuration version via `POST /api/v2/workspaces/:id/configuration-versions`
  2. Backend generates temporary upload token and returns it in `upload-url` attribute
  3. Terraform CLI uploads configuration files via `PUT /api/v2/configuration-versions/:id/upload?token=<token>`
  4. Backend validates token, stores files in MinIO, updates status to `uploaded`

**Run Logs Endpoint Implementation (✅ Fully Implemented):**
- ✅ **Token-Based Authentication**: Logs endpoint supports token in URL query parameter for Terraform CLI compatibility
  - URL format: `/api/v2/runs/:id/logs?token=<token>`
  - Auth middleware checks query parameter if Authorization header is missing
  - Token can be TFE token or JWT token (same validation as Authorization header)
- ✅ **Log Streaming**: Supports `offset` and `limit` query parameters for log streaming
  - Terraform CLI reads logs in chunks using offset/limit
  - Returns requested chunk of logs based on offset/limit
  - Returns `200 OK` with empty body when offset >= log length (signals end of stream)
  - Default behavior: Returns full logs if offset/limit not specified
- ✅ **Response Format**: Returns logs as plain text (`text/plain` content type)
- ✅ **Missing Logs**: Returns `200 OK` with empty body when logs don't exist (TFE-compatible)
- ✅ **Storage Path**: Logs stored in MinIO at `runs/{run_id}/logs/{operation}.log`
- ✅ **Execution Mode Support**: Supports all execution modes (remote, local, agent)
  - Remote execution: Logs stored during runner execution
  - Agent execution: Same storage as remote
  - Local execution: Returns empty (logs not uploaded from local machine)

**Backlog Items:**
- ⏭️ **Frontend JSON:API Format Migration**: Consider migrating frontend to consume TFE JSON:API format directly instead of using `?format=simple` transformation layer. This would eliminate the transformation layer and ensure frontend uses the same format as Terraform CLI.

---

## Terraform Cloud Workspace Features

### 1. VCS Integration
- **GitHub App Installation**: Self-service GitHub App installation (like Terraform Enterprise)
  - Users install the app on their own organizations/repositories
  - No manual OAuth App configuration required
  - Platform owner creates ONE GitHub App (one-time setup)
  - Users get installation-specific tokens automatically
- **Repository Selection**: Browse and select repositories (public and private)
- **Branch Selection**: Choose default branch or specify custom branch
- **Working Directory**: Specify subdirectory path within repository (e.g., `/terraform`, `/infra/prod`)
- **Auto-apply**: Automatically apply plans on merge to default branch
- **Trigger Patterns**: Configure which paths trigger runs (e.g., `terraform/**`, `*.tf`)
- **Webhook Management**: Automatic webhook creation/management for push/PR events
- **VCS Connection Status**: Display connection health and last sync time

### 2. Workspace Configuration
- **Name & Description**: Human-readable workspace name and description
- **Terraform Version**: Select specific Terraform version (with version constraints)
- **Execution Mode**: 
  - Remote (managed by platform)
  - Local (self-managed agents)
  - Agent (custom runner pools)
- **Auto-queue Runs**: Automatically queue runs on VCS push
- **Auto-apply**: Automatically apply successful plans
- **Terraform Variables**: Environment-specific variables (HCL/JSON)
- **Sensitive Variables**: Encrypted variable storage
- **Variable Sets**: Reusable variable sets across workspaces

### 3. Run Management & Execution
- **Plan Runs**: Preview infrastructure changes
- **Apply Runs**: Execute infrastructure changes
- **Destroy Runs**: Tear down infrastructure
- **Run Triggers**: 
  - VCS push to branch
  - Pull request events
  - Manual trigger
  - API trigger
  - Scheduled runs (cron)
- **Run History**: View all runs with status, logs, and outputs
- **Run Notifications**: Email/Slack notifications on run completion
- **Execution Modes** (TFE-compatible):
  - **Remote**: Runs executed on platform-managed runners (default)
  - **Local**: Runs executed on user's local machine (self-managed)
  - **Agent**: Runs executed on customer-managed agent pools
- **Run Queue**: Runs are queued via Redis and processed by runners
- **Runner Architecture**: Separate orchestrator and runner processes for scalability

### 4. State Management
- **Remote State**: Centralized state storage (encrypted)
- **State Locking**: ✅ **FULLY IMPLEMENTED (TFE-Compatible)** - Two-tier locking system:
  - **Manual Workspace Locking**: Users can manually lock workspaces via UI/API to prevent all state operations. When locked, no runs can be created and no state versions can be saved.
  - **Automatic State Locking**: Runners automatically acquire state locks when apply/destroy operations start. Locks are released when runs complete, fail, or are cancelled. Prevents concurrent state modifications.
  - **Lock Integration**: All state modification operations (SaveState, state version creation) check both workspace and state locks before proceeding.
- **State Versions**: Historical state snapshots
- **State History**: View state changes over time
- **State Download**: Download state files for backup/audit
- **State Rollback**: Revert to previous state version

### 5. Security & Access
- **RBAC**: Role-based access control per workspace
- **SSH Keys**: SSH key management for private repos
- **API Tokens**: Workspace-specific API tokens
- **Audit Logs**: Track all workspace changes
- **Variable Encryption**: Encrypt sensitive variables at rest
- **IP Allowlist**: Restrict access by IP address

### 6. Collaboration Features
- **Comments**: Comment on runs and plans
- **Team Management**: Assign teams to workspaces
- **Notifications**: Team-wide notifications
- **Run Approvals**: Require approval before apply
- **Cost Estimation**: Show infrastructure cost changes

### 7. Advanced Features
- **Policy as Code**: Sentinel/OPA policy enforcement
- **Drift Detection**: ✅ **IMPLEMENTED** - Scheduled plan runs to detect infrastructure drift. Configure via workspace `drift_detection_enabled`, `drift_detection_schedule` (cron expression), and `drift_detection_timezone` fields. See `backend/internal/services/terraform/drift_detection.go` for implementation.
- **Private Module Registry**: Share modules across organization
- **Run Tasks**: Integrate external tools (security scanning, cost analysis)
- **Workspace Tags**: Organize workspaces with tags
- **Workspace Settings**: 
  - Lock workspace (prevent runs) - ✅ **IMPLEMENTED** - Workspace automatically locks during runs
  - Force unlock state
  - Delete workspace - ✅ **PROTECTED** - Workspaces with applied runs cannot be deleted

---

## Implementation Plan for Our Platform

### Phase 1: Core Workspace Creation (MVP) ⚡ **START HERE**

#### 1.1 GitHub Integration via GitHub App (Self-Service)
**Backend:**
- [x] ✅ Create `VCSConnection` model (store GitHub App installation IDs per organization)
  - ✅ Model with provider, installation_id, account info
  - ✅ Support for GitHub, GitLab, Bitbucket
- [x] ✅ Implement GitHub App installation flow (redirect to installation page)
- [x] ✅ Implement GitHub App webhook handler for installation events
- [x] ✅ Implement installation token generation (JWT signing with private key)
- [x] ✅ Create `GitHubAppService` for GitHub API interactions using installation tokens
- [x] ✅ Endpoint: `GET /api/v2/organizations/:name/vcs-connections/github/install` (initiate installation)
- [x] ✅ Endpoint: `POST /api/v2/vcs-connections/github/webhook` (handle installation webhook)
- [x] ✅ Endpoint: `POST /api/v2/organizations/:name/vcs-connections` (create connection)
- [x] ✅ Endpoint: `GET /api/v2/organizations/:name/vcs-connections` (list connections)
- [x] ✅ Endpoint: `GET /api/v2/vcs-connections/:id` (get connection)
- [x] ✅ Endpoint: `DELETE /api/v2/vcs-connections/:id` (disconnect)
- [x] ✅ Endpoint: `GET /api/v2/vcs-connections/:id/repositories` (list repositories)
- [x] ✅ Endpoint: `GET /api/v2/vcs-connections/:id/repositories/:owner/:repo/branches` (list branches)

**GitHub App Setup:**
- Platform owner creates ONE GitHub App (one-time setup)
- Users install the app on their own organizations (self-service)
- No manual OAuth configuration needed per user

**Frontend:**
- [x] ✅ "Connect GitHub" button that redirects to GitHub App installation
- [x] ✅ Display connected VCS providers
- [x] ✅ Disconnect VCS connection
- [x] ✅ Repository and branch selection in workspace creation

#### 1.2 Repository Selection
**Backend:**
- [x] ✅ Endpoint: `GET /api/v2/vcs-connections/:id/repositories` (list repos)
- [x] ✅ Endpoint: `GET /api/v2/vcs-connections/:id/repositories/:owner/:repo/branches` (list branches)
- [x] ✅ Support pagination for large orgs
- [ ] Cache repository list (refresh on demand) - TODO

**Frontend:**
- [x] ✅ Repository selector component (searchable dropdown)
- [x] ✅ Branch selector component
- [x] ✅ Repository preview (shows repo name, description, visibility)

#### 1.3 Workspace Creation Form
**Backend:**
- [x] ✅ Authorization check (user must be authenticated via JWT or TFE token)
- [x] ✅ Workspace creation endpoint: `POST /api/v2/organizations/:name/workspaces` (TFE-compatible)
- [x] ✅ Validate VCS connection exists (if VCS selected)
- [x] ✅ Validate VCS connection belongs to organization
- [x] ✅ Validate repository is provided when VCS connection is selected
- [x] ✅ Support for all workspace configuration fields (AutoQueueRuns, AutoApply, ExecutionMode, etc.)
- [ ] Validate repository access (via GitHub API - TODO)
- [ ] Validate branch exists (via GitHub API - TODO)
- [ ] Generate webhook secret
- [ ] Create webhook in GitHub (if VCS connected)

**Frontend Workspace Creation Form Requirements:**
- [ ] Create workspace dialog/form component
- [ ] **Form Fields (Required for TFE Compatibility):**
  - **Name** (required, string) - Workspace name (must be unique within organization)
  - **Description** (optional, string) - Workspace description
  - **Project** (required, select) - Select project within organization
  - **VCS Connection** (optional, select) - Select VCS connection if organization has connections
  - **Repository** (conditional, select) - Select repository (populated from VCS connection)
  - **Branch** (conditional, select) - Select branch (populated from repository, default: "main")
  - **Working Directory** (optional, string) - Path within repository (e.g., `/terraform`, `/infra/prod`)
  - **Terraform Version** (optional, select) - Select Terraform version (dropdown with available versions)
- [ ] **Form Validation:**
  - Name: Required, alphanumeric + hyphens/underscores, unique within project
  - VCS fields: Required if VCS connection selected
  - Working directory: Must start with `/` or be empty for root
- [ ] **Success/Error Handling:**
  - Show success message on creation
  - Navigate to workspace detail page
  - Display validation errors inline
  - Handle API errors (401, 403, 409, 500)
- [ ] **TFE Token Support:**
  - Allow users to generate TFE tokens from settings
  - Display token creation instructions
  - Link to token management page

#### 1.4 Working Directory & Path Configuration
**Backend:**
- [ ] Validate working directory path format
- [ ] Optional: List directories in repo (for path picker)
- [ ] Store working directory in workspace model

**Frontend:**
- [ ] Working directory input field
- [ ] Path validation (must start with `/` or be empty for root)
- [ ] Helper text: "Leave empty for repository root, or specify path like `/terraform` or `/infra/prod`"

---

### Phase 2: Webhook & Auto-Triggering

#### 2.1 Webhook Management
**Backend:**
- [x] ✅ **IMPLEMENTED**: Webhook endpoint for workspace runs: `POST /api/v2/vcs-connections/github/webhook` (handles both module publishing and workspace runs)
- [x] ✅ **IMPLEMENTED**: Handle branch push events → create plan run
  - Webhook handler (`handleBranchPushEvent`) processes branch push events for workspace runs
  - Finds workspaces matching repository and branch with `AutoQueueRuns` enabled
  - Clones repository at commit, creates configuration version with commit info, uploads files, creates plan run
  - Stores commit hash and committer in `ConfigurationVersion` model for later use in state versions
  - If `AutoApply` is enabled and push is to default branch, auto-apply will be triggered after plan completes (TODO: background job)
- [ ] ⏭️ **TODO**: Verify webhook signature for workspace runs (currently skipped)
- [ ] ⏭️ **TODO**: Handle PR events → queue plan run (speculative plans)
- [ ] ⏭️ **TODO**: Create GitHub webhook on workspace creation (currently relies on existing GitHub App webhook)
- [ ] ⏭️ **TODO**: Store webhook secret securely per workspace

**Frontend:**
- [ ] Display webhook status (connected/error)
- [ ] Test webhook button
- [ ] Webhook event log

#### 2.2 Auto-Queue Configuration
**Backend:**
- [ ] Add `AutoQueueRuns` boolean to workspace model
- [ ] Add `TriggerPatterns` (array of glob patterns) to workspace model
- [ ] Webhook handler checks trigger patterns
- [ ] Queue run if pattern matches changed files

**Frontend:**
- [ ] Toggle: "Automatically queue runs on VCS push"
- [ ] Trigger patterns input (e.g., `terraform/**`, `*.tf`)
- [ ] Pattern validation and preview

---

### Phase 3: Advanced Configuration

#### 3.1 Terraform Version Management
**Backend:**
- [ ] Endpoint: `GET /api/v1/terraform-versions` (list available versions)
- [ ] Version constraint validation (e.g., `>= 1.0, < 2.0`)
- [ ] Store version in workspace

**Frontend:**
- [ ] Terraform version selector with search
- [ ] Show latest stable version
- [ ] Version constraint input (advanced)

#### 3.2 Execution Mode
**Backend:**
- [ ] Add `ExecutionMode` enum to workspace model:
  - `remote` (default - platform manages)
  - `local` (self-managed)
  - `agent` (custom runner pool)
- [ ] Add `AgentPoolID` (optional, for agent mode)

**Frontend:**
- [ ] Execution mode selector
- [ ] Agent pool selector (if agent mode selected)

#### 3.3 Auto-Apply
**Backend:**
- [ ] Add `AutoApply` boolean to workspace model
- [ ] Add `AutoApplyOnBranch` (branch name, default: main/master)
- [ ] Apply handler checks auto-apply settings

**Frontend:**
- [ ] Toggle: "Automatically apply successful plans"
- [ ] Branch selector for auto-apply

---

### Phase 4: State Management

#### 4.1 State Storage ✅ **FULLY IMPLEMENTED (TFE-Compatible)**
**Backend:**
- [x] ✅ State versioning (store each state update)
- [x] ✅ State stored in MinIO (TFE-compatible - `workspaces/{workspace_id}/state/{version}.json`)
- [x] ✅ State metadata stored in database (version numbers, lineage, serial, timestamps)
- [x] ✅ State locking model and repository (StateLock model exists)
- [x] ✅ **State locking fully integrated** - All state operations check locks
- [x] ✅ **Manual workspace locking** - Prevents all state operations when locked
- [x] ✅ **Automatic state locking** - Runners acquire/release locks during applies
- [x] ✅ **State version outputs endpoint** - `GET /api/v2/state-versions/:id/outputs`
- [ ] ⏭️ Encrypt state at rest

**Current Implementation:**
- ✅ **State Files**: Stored in MinIO at `workspaces/{workspace_id}/state/{version}.json` (TFE-compatible)
- ✅ **State Metadata**: Stored in PostgreSQL (`state_versions` table - version, serial, lineage, timestamps)
- ✅ **State Locking**: Fully integrated (`state_locks` table with automatic acquisition/release)
- ✅ **Workspace Locking**: Manual locking via `POST /api/v2/workspaces/:id/actions/lock` prevents all state operations
- ✅ **Lock Enforcement**: `SaveState()` and state version creation endpoint check both workspace and state locks
- ✅ **Runner Integration**: Runners acquire state locks for apply/destroy operations, release on completion
- ✅ **State Version Outputs**: `GET /api/v2/state-versions/:id/outputs` endpoint implemented (TFE-compatible)
- ✅ **Configuration Files**: Stored in MinIO at `configuration-versions/{id}/config.tar.gz`
- ✅ **Configuration Version Metadata**: Stored in PostgreSQL (`configuration_versions` table - status, upload_token, source, timestamps)
- ✅ **Upload Authentication**: Token-based authentication via query parameter (bypasses auth middleware)
- ⏭️ **TODO**: Add state encryption at rest

**Lock Behavior (TFE-Compatible):**
- **Manual Workspace Lock**: When workspace is manually locked via UI/API:
  - No runs can be created (checked in run creation handler)
  - No state versions can be created (checked in state version creation endpoint)
  - Runners cannot save state (checked in `SaveState()`)
- **Automatic State Lock**: When apply/destroy run starts:
  - Runner acquires state lock with lock ID `run-<run-id>`
  - Lock TTL based on workspace `run_timeout` (default: 2 hours)
  - Lock prevents concurrent state modifications
  - Lock released when run completes (success, failure, or cancellation)
- **Lock Checking**: All state operations check:
  1. Workspace lock (manual lock)
  2. State lock (automatic lock from runs)
  3. Lock ownership (if runID provided, verify lock belongs to that run)

**TFE Storage Strategy (✅ Fully Implemented):**
- **Configuration Files**: Stored in object storage (S3/MinIO) - ✅ **IMPLEMENTED**
  - Path: `configuration-versions/{config_version_id}/config.tar.gz`
  - Uploaded via `PUT /api/v2/configuration-versions/:id/upload?token=<upload_token>`
  - Authentication: Token-based (token in query parameter, not Authorization header)
  - Storage client: Initialized at startup using MinIO configuration from environment variables
- **State Files**: Stored in object storage (S3/MinIO) - ✅ **IMPLEMENTED**
  - Path: `workspaces/{workspace_id}/state/{version}.json`
  - Created via `POST /api/v2/workspaces/:id/state-versions`
- **State Metadata**: Stored in database (version numbers, lineage, serial, timestamps) - ✅ **IMPLEMENTED**
- **Configuration Version Metadata**: Stored in database (status, upload_token, source, timestamps) - ✅ **IMPLEMENTED**

**Frontend:**
- [ ] State version history view
- [ ] Download state file
- [ ] State diff viewer

---

### Phase 5: Variables & Secrets ✅

#### 5.1 Workspace Variables ✅
**Backend:**
- [x] ✅ Variable model exists (`Variable` model)
- [x] ✅ Endpoint: `POST /api/v2/workspaces/:id/variables` (TFE-compatible)
- [x] ✅ Endpoint: `GET /api/v2/workspaces/:id/variables` (TFE-compatible)
- [x] ✅ Endpoint: `PATCH /api/v2/workspaces/:id/variables/:variable_id` (TFE-compatible)
- [x] ✅ Endpoint: `DELETE /api/v2/workspaces/:id/variables/:variable_id` (TFE-compatible)
- [x] ✅ Encrypt sensitive variables
- [ ] Variable validation (HCL/JSON) - TODO

**Frontend:**
- [x] ✅ Variables management page (in workspace detail, Variables tab)
- [x] ✅ Add/edit/delete variables
- [x] ✅ Mark as sensitive (password input)
- [x] ✅ Variable preview (masked for sensitive)

#### 5.2 Variable Sets (Variable Groups) ✅ **COMPLETED**
**Backend:**
- [x] ✅ VariableSet model (organization-scoped and workspace-scoped)
- [x] ✅ VariableSetVariable model (variables within a set)
- [x] ✅ VariableSetRepository with CRUD operations
- [x] ✅ VariableSet API handlers (TFE-compatible: `varsets` in path)
  - `GET/POST /api/v2/organizations/:name/varsets`
  - `GET/PATCH/DELETE /api/v2/varsets/:id`
  - `POST/DELETE /api/v2/varsets/:id/relationships/workspaces`
  - `POST/DELETE /api/v2/varsets/:id/relationships/projects`
  - `GET/POST/PATCH/DELETE /api/v2/varsets/:id/relationships/vars` (and under org-scoped `:id/relationships/vars`)
- [ ] Variable precedence: Workspace variables override variable set variables (implemented in variable service; TODO: full integration in run execution)

**Frontend:**
- [x] ✅ Variable sets management page (organization settings, `/app/:orgName/settings/variable-sets`)
- [x] ✅ Create/edit/delete variable sets
- [x] ✅ Assign variable sets to workspaces and projects
- [x] ✅ Manage variables within variable sets
- [ ] Show variable precedence in workspace variables tab (workspace vars override set vars)

---

### Phase 6: Run Execution & Runners ✅ **PARTIALLY IMPLEMENTED**

#### 6.1 Run Execution Architecture (TFE-Compatible)

**Current Implementation:**
- ✅ **Run Creation**: Runs are created via `POST /api/v2/runs` (TFE-compatible)
- ✅ **Run Queue**: Redis-based queue system for run execution
- ✅ **Orchestrator**: Separate process (`cmd/orchestrator`) that polls for pending runs and queues them
- ✅ **Runner**: Separate process (`cmd/runner`) that dequeues and executes runs
- ✅ **Execution Modes**: Workspace model supports `ExecutionMode` field (remote, local, agent)
- ⏭️ **Auto-Queue**: Runs should be queued immediately when created (currently relies on orchestrator polling)
- ⏭️ **Agent Pools**: Agent pool management not yet implemented
- ⏭️ **Local Execution**: Local execution mode not yet implemented

**TFE Execution Modes:**
1. **Remote Execution** (Default - ✅ Implemented):
   - Runs executed on platform-managed runners
   - Configuration files downloaded from object storage
   - Terraform executed in isolated containers/environments
   - State stored remotely in object storage
   - Current implementation: Uses Redis queue + runner processes

2. **Local Execution** (⏭️ TODO):
   - Runs executed on user's local machine
   - Terraform CLI connects to remote backend
   - State stored remotely, execution happens locally
   - Requires Terraform CLI to be installed locally

3. **Agent Execution** (⏭️ TODO):
   - Runs executed on customer-managed agent pools
   - Agents connect to platform and poll for work
   - Useful for air-gapped environments or custom infrastructure
   - Requires agent pool management and agent registration

**Run Execution Flow (TFE-Compatible):**
1. **Run Creation**: `POST /api/v2/runs` creates a run with status `pending`
   - **TFE-Compatible Run Types**: Two run types - "plan-only" and "plan-and-apply"
     - **plan-only**: CLI runs and UI "Plan only" runs (cannot be applied, status: pending → planning → planned)
     - **plan-and-apply**: UI "Plan and Apply" runs (goes through both phases: pending → planning → planned → applying → applied)
     - **destroy**: Destroy runs (tear down infrastructure)
   - **TFE-Compatible Restriction**: CLI remote backend can only create plan-only runs (not apply runs)
   - **Plan-and-Apply Flow**: For plan-and-apply runs, the Apply action transitions the run from "planned" to "applying" status (single run, not separate runs)
   - **Auto-Cancellation**: 
     - **Plan-only runs**: Cancel other plan-only runs (pending/running/planned) for better UX - users don't want to wait for old plan-only runs to finish
       - Plan-only runs cannot alter state, so they run completely independently from plan-and-apply runs
       - Multiple plan-only runs can run in parallel, but cancelling old ones when starting new ones improves UX
     - **Plan-and-apply runs**: Cancel other plan-and-apply runs (pending/running/planned) to prevent state corruption
       - Plan-and-apply runs will alter state, so only one should run at a time
       - Plan-and-apply runs do NOT cancel plan-only runs (they're separate operations)
   - Deduplication logic prevents duplicate runs from Terraform CLI retries
   - Checks for recent run (within 10 seconds) with same workspace and operation
   - **Operation field**: Run operation (`plan-only`, `plan-and-apply`, `destroy`) is included in API response attributes (TFE-compatible)
   - **Source field**: Run source (`tfe-ui`, `tfe-api`, `tfe-configuration-version`) is determined from configuration version source or auth method (TFE-compatible)
2. **Queue Processing**: Orchestrator polls for pending and applying runs every 5 seconds and enqueues them to Redis
   - Polls for runs with status `pending` (initial state) and `applying` (plan-and-apply runs ready for apply phase)
   - Reloads run status before enqueueing to skip cancelled/failed/completed runs
   - Skips runs older than 30 minutes (handled by cleanup routine)
3. **Run Execution**: Runner dequeues job and:
   - Checks if run was cancelled before starting execution
   - Updates run status based on operation and phase:
     - **plan-and-apply runs**: `pending` → `planning` (plan phase) → `planned` (plan completed) → `applying` (apply phase) → `applied` (apply completed)
     - **plan-only runs**: `pending` → `planning` → `planned` (final state)
     - **destroy runs**: `pending` → `running` → `completed` (legacy status)
   - Downloads configuration files from object storage (if configuration version exists)
   - **Replaces remote backend with local backend** in Terraform config files (BEFORE init)
   - Clones VCS repository (if VCS connected)
   - Executes Terraform init with `-upgrade` flag to ensure providers are downloaded
   - If plan fails with provider error, automatically re-runs init and retries plan
   - Checks run status after init and after each Terraform operation (cancellation support)
  - ✅ **Streaming Log Capture** (new): Streams logs to Redis during execution in real-time
    - Uses `PlanWithOptions()` and `ApplyWithOptions()` with callbacks
    - Logs available via API endpoint during execution (not just after completion)
    - Logs copied to MinIO at completion for long-term persistence
  - ✅ **Non-Streaming Log Capture** (original): Captures logs using `CombinedOutput()`
    - Original `Plan()` and `Apply()` methods still available (backward compatible)
  - Filters out local file path messages (e.g., "Saved the plan to: /path/to/plan.out") from logs
  - Stores logs in MinIO with phase-specific keys:
     - **Plan-and-apply runs**: `runs/{run_id}/logs/plan.log` (plan phase) and `runs/{run_id}/logs/apply.log` (apply phase)
     - **Plan-only runs**: `runs/{run_id}/logs/plan.log`
     - **Destroy runs**: `runs/{run_id}/logs/destroy.log`
    - **Legacy apply runs**: `runs/{run_id}/logs/apply.log`
  - ✅ **Redis Storage** (during execution): `run:logs:{runID}:{phase}` with 24-hour TTL
  - **Plan Phase** (for plan-only and plan-and-apply runs):
     - Stores plan output in database (JSON format with resource_changes, resource counts, has-changes)
     - Sets status to `planned` when plan completes successfully
     - **Auto-Apply Logic** (TFE-compatible):
       - **VCS-triggered plan-and-apply runs**: If workspace has `AutoApply` enabled, automatically transitions to `applying` status after plan completes
       - **UI "Plan and Apply" runs**: User sees plan output and clicks "Apply Plan" button to transition to `applying` status
       - **UI "Plan only" runs**: Cannot be applied (status stays at `planned`)
       - **CLI runs**: NEVER auto-apply (they're just for preview, prevents drift with git)
   - **Apply Phase** (for plan-and-apply runs in `applying` status):
     - Executes `terraform apply` using the plan output
     - Sets status to `applied` when apply completes successfully
     - After successful apply, automatically reads `terraform.tfstate` and creates state version via state service
     - State is saved to MinIO at `workspaces/{workspace_id}/state/{version}.json`
     - State version metadata is stored in database
     - **Commit Info**: For VCS-triggered runs, commit hash and committer are extracted from `ConfigurationVersion` and stored in state version
     - Matches TFE behavior of automatically saving state after apply
4. **State Management**: After apply, state is automatically stored in object storage via state service
   - Runner reads `terraform.tfstate` file from workspace directory
   - Parses state as JSON
   - Creates state version via `stateService.SaveState()` (TFE-compatible)
   - State stored at `workspaces/{workspace_id}/state/{version}.json` in MinIO
5. **Logs Retrieval**: Logs can be retrieved via `GET /api/v2/runs/:id/logs` (TFE-compatible)
   - Supports offset/limit for streaming (Terraform CLI reads logs in chunks)
   - Returns empty body when offset >= log length (signals end of stream)
   - Returns plain text (`text/plain` content type)
   - Frontend fetches logs for apply/destroy runs to display output

**Runner Architecture:**
- **Orchestrator** (`cmd/orchestrator/main.go`):
  - Polls database for pending runs every 5 seconds
  - Enqueues runs to Redis queue
  - ✅ **Stuck Run Cleanup**: Cleans up stuck runs every 1 minute
    - Pending runs older than 30 minutes → marked as `failed`
    - Running runs exceeding timeout (workspace `run_timeout` or 2-hour safety net) → marked as `failed`
  - ✅ **Status Reload**: Reloads run status before enqueueing to skip cancelled/failed/completed runs
  - ✅ **Age Check**: Skips runs older than 30 minutes (should be handled by cleanup)
  - Can be scaled horizontally (multiple orchestrators can run)

- **Drift Detection Service** (`backend/internal/services/terraform/drift_detection.go`):
  - ✅ **IMPLEMENTED** - Background service that runs scheduled drift detection checks
  - Polls workspaces with `drift_detection_enabled = true` every minute
  - Creates plan-only runs on schedule (based on `drift_detection_schedule` cron expression)
  - Skips drift checks if workspace is locked or has active runs
  - Updates `next_drift_check_at` and `last_drift_check_at` timestamps
  - Integrated into API server startup (see `backend/cmd/api/main.go`)
  - Can be disabled via `TERRAFORM_DRIFT_DETECTION_ENABLED=false` environment variable
  
- **Runner** (`cmd/runner/main.go`):
  - Dequeues jobs from Redis queue (5-second timeout)
  - ✅ **Cancellation Check**: Checks if run was cancelled before starting execution
  - Executes Terraform operations (init, plan, apply, destroy)
  - ✅ **Remote Backend Replacement**: Replaces `backend "remote"` with `backend "local"` in terraform config files
    - Prevents infinite loop where runner creates nested runs when executing `terraform plan`
    - Function: `replaceRemoteBackendWithLocal()` scans terraform files and replaces backend blocks
    - **Called BEFORE init** to ensure init uses the correct backend configuration
  - ✅ **Provider Initialization**: Enhanced with `-upgrade` flag to ensure providers are always downloaded
    - Uses `terraform init -input=false -upgrade` to ensure providers are available
    - Matches TFE behavior of ensuring providers are initialized before operations
  - ✅ **Provider Error Detection**: Automatically detects provider-related errors and retries init
    - Distinguishes between provider errors (retry init) and configuration errors (fail immediately)
    - Only retries on actual provider initialization failures, not configuration errors
    - Matches Terraform CLI behavior of automatic re-initialization on provider errors
  - ✅ **Cancellation Checks**: Checks run status after init and after each terraform operation
    - If run status is `canceled`, runner stops processing immediately
  - ✅ **Workspace Lock Check**: Checks if workspace is manually locked before execution
    - If locked, run fails immediately with clear error message
    - Prevents runs from executing when workspace is manually locked
    - See `backend/cmd/runner/main.go:207-220` for implementation
  - ✅ **State Locking**: Automatically acquires state lock when apply/destroy run starts and releases when run completes
    - Acquires state lock with lock ID `run-<run-id>` for apply/destroy operations
    - Lock TTL based on workspace `run_timeout` setting (default: 2 hours)
    - Lock stored in `state_locks` table with `locked_by` = run ID
    - Lock released via defer when run completes (success, failure, or cancellation)
    - Prevents concurrent state modifications during applies
    - Plan-only runs do NOT acquire locks (they don't modify state)
    - See `backend/cmd/runner/main.go:222-260` for lock acquisition
    - See `backend/cmd/runner/main.go:630-665` for state saving with lock validation
  - Captures logs from all Terraform operations (stdout/stderr)
  - Stores logs in MinIO at `runs/{run_id}/logs/{operation}.log`
  - Updates run status and outputs (plan output with resource counts)
  - Can be scaled horizontally (multiple runners can process jobs in parallel)

**Current Limitations:**
- ✅ **Foreign Key Constraint**: Workspace deletion now properly cascades to related records (fixed)
- ⚠️ **Run Queuing**: Currently relies on orchestrator polling (5-second delay). For immediate queuing, Redis should be initialized in API and runs queued on creation.
- ✅ **Configuration Download**: Runner downloads configuration files from MinIO before execution
- ⚠️ **VCS Integration**: Runner clones repositories but needs proper authentication tokens
- ✅ **State Locking**: ✅ **IMPLEMENTED** - Workspace is automatically locked when a run starts and unlocked when the run completes, fails, or is cancelled. See `backend/cmd/runner/main.go` for implementation.
- ✅ **Logs Storage**: Logs are captured and stored in MinIO for remote execution
- ✅ **Drift Detection**: ✅ **IMPLEMENTED** - Scheduled drift detection runs can be configured per workspace. See `backend/internal/services/terraform/drift_detection.go` for implementation.
- ✅ **Workspace Deletion Protection**: ✅ **IMPLEMENTED** - Workspaces with applied runs cannot be deleted. See `backend/internal/api/v2/handlers/terraform/workspaces.go:758+` for implementation.
- ✅ **Logs Endpoint**: TFE-compatible logs endpoint implemented (`GET /api/v2/runs/:id/logs`)
  - Supports offset/limit for log streaming (Terraform CLI compatibility)
  - Returns empty body when offset >= log length (signals end of stream)
  - ✅ **Streaming Support**: Checks Redis first for active runs (real-time logs during execution)
  - ✅ **MinIO Fallback**: Falls back to MinIO for completed runs (long-term persistence)
- ✅ **Logs Capture**: All Terraform operations (init, plan, apply, destroy) capture logs
  - ✅ **Streaming Mode** (new): Logs streamed to Redis during execution, copied to MinIO at completion
  - ✅ **Non-Streaming Mode** (original): Logs written to MinIO after completion (backward compatible)
- ⚠️ **Local Execution Logs**: Local execution mode logs are not yet uploaded to backend (returns empty logs)
- ✅ **Agent Execution Logs**: Agent execution mode logs are stored same as remote (agents send logs to backend)
- ✅ **Stuck Run Cleanup**: Orchestrator automatically cleans up stuck runs (pending > 30min or running > timeout)
- ✅ **CORS Support**: CORS middleware supports IPv6 localhost and all localhost variants
- ✅ **Run Cancellation (TFE-Compatible)**: Full cancellation support matching Terraform Enterprise behavior
  - **Cancel Endpoint**: `POST /api/v2/runs/:id/actions/cancel` - TFE-compatible cancellation API
    - Can cancel runs in `pending`, `running`, `planning`, and `applying` statuses
    - Sends INT signal to Terraform process (equivalent to Ctrl+C)
    - Terraform wraps up in the safest way possible
    - Optional `comment` field in request body for cancellation reason
    - Returns `202 Accepted` on success (no response body, matches TFE spec)
    - Returns `409 Conflict` if run cannot be cancelled in current state
    - Requires permission to apply runs for the workspace
  - **Cancellation Behavior**: Matches TFE behavior exactly
    - Cancellation is queued (may not happen immediately)
    - After canceling, run is marked as `canceled` and `completed_at` is set
    - Later runs can proceed after cancellation
    - Partial applies remain in infrastructure (no automatic rollback)
    - State timestamps are preserved (planned-at, applying-at) to determine which phase was cancelled
  - **Phase Timeline Display**: Correctly shows phase status when runs are cancelled
    - Plan phase shows as `completed` if plan finished before cancellation
    - Apply phase shows as `cancelled` if apply was in progress
    - Uses status-timestamps to accurately determine which phase was active
    - Dedicated `cancelled` status type (grey border, X icon) distinguishes from `failed` (red, error)
  - **Active Cancellation During Execution (Phase 2)**: Database polling detects cancellation within 2-4 seconds
    - Runner polls database every 2 seconds to check for cancellation status
    - When cancellation detected, context is cancelled to immediately stop Terraform process
    - Significantly faster than waiting for operation completion (can take 30+ minutes)
    - Works for plan, apply, and destroy operations
    - Uses `exec.CommandContext` for safe process termination
  - **Visual Feedback**: Consistent UI indicators for cancelled phases
    - Grey spinner for pending state, blue spinner for planning/running state
    - Big circled X indicator in content area for cancelled phases
    - Phase timeline correctly displays cancelled states on page reload
  - **Implementation References**:
    - Cancel Handler: `backend/internal/api/v2/handlers/terraform/runs.go:1370-1426`
    - Active Cancellation: `backend/cmd/runner/main.go:createCancellableContext()`
    - Phase Timeline: `frontend/src/components/runs/UnifiedPhaseTimeline.tsx`
    - Run Detail: `frontend/src/pages/RunDetail.tsx`
- ✅ **Run Deduplication**: Prevents duplicate runs from Terraform CLI retries (10-second window)
- ✅ **Remote Backend Replacement**: Runner replaces remote backend with local backend to prevent infinite loops
- ✅ **VCS Webhook for Workspace Runs**: **IMPLEMENTED**
  - Branch push events trigger "plan and apply" runs for workspaces with `AutoQueueRuns` enabled
  - Webhook handler (`handleBranchPushEvent`) processes branch push events (not just tag pushes)
  - Finds workspaces matching repository and branch with `AutoQueueRuns` enabled
  - **Path-Based Filtering (GitOps-style)**: Only triggers workspaces where changed files match their `WorkingDirectory` path
    - If `WorkingDirectory` is empty or "/", workspace matches all changes (root-level workspace)
    - If `WorkingDirectory` is a subfolder (e.g., "proxmox/api"), only triggers when files in that subfolder are changed
    - Prevents unnecessary runs when multiple workspaces share the same repository but monitor different paths
    - Implementation: `isWorkspaceAffected()` function checks if any changed files are within the workspace's working directory
    - See `backend/internal/api/v2/handlers/vcs_app_installation.go:886-930` for implementation
  - Clones repository at commit, creates configuration version, uploads files, creates plan run
  - Stores commit hash and committer in configuration version for later use in state versions
  - **Auto-Apply Flow**: After plan completes successfully, runner automatically creates apply run if `AutoApply` is enabled
    - This implements TFE's "plan and apply" flow for VCS pushes
    - Assumes that pushing to the configured branch means you want to update the config
  - Commit info is stored in `ConfigurationVersion` model (`CommitHash`, `Committer` fields)
  - When state is saved after apply, commit info is extracted from configuration version and stored in state version
- ✅ **UI Run Options**: **IMPLEMENTED**
  - **Plan Only**: Creates a plan run - user can manually apply via "Apply Plan" button if desired
  - **Plan and Apply** (default): Creates a plan run - follows 2-phase process: plan runs, user sees output, then clicks "Apply Plan" button to confirm
  - **Destroy**: Creates a destroy run to tear down infrastructure
  - **All UI runs follow 2-phase process**: Plan first, then user confirms via "Apply Plan" button
  - CLI runs (remote backend) can only create "Plan only" runs and should NEVER auto-apply (prevents drift with git)
  - Only VCS push events can auto-apply (if workspace.AutoApply is enabled)

**TFE Compatibility:**
- ✅ **Run Status Values**: TFE-compatible statuses (pending, planning, planned, applying, applied, failed, canceled)
  - ⚠️ **Important**: TFE uses "canceled" (American spelling), not "cancelled" (British spelling)
  - Run status constant: `RunStatusCancelled RunStatus = "canceled"`
  - Database stores "canceled" status value
  - **New Statuses** (TFE-compatible):
    - `planning`: Plan phase in progress (for plan-only and plan-and-apply runs)
    - `planned`: Plan phase completed (for plan-only runs, this is final state; for plan-and-apply runs, waiting for apply)
    - `applying`: Apply phase in progress (for plan-and-apply runs)
    - `applied`: Apply phase completed (for plan-and-apply runs, this is final state)
  - **Legacy Statuses** (for backward compatibility):
    - `running`: Generic running status (maps to planning or applying based on phase)
    - `completed`: Generic completed status (maps to planned or applied based on phase)
  - **Status Transitions**:
    - **plan-only runs**: `pending` → `planning` → `planned` (final)
    - **plan-and-apply runs**: `pending` → `planning` → `planned` → `applying` → `applied` (final)
    - **destroy runs**: `pending` → `running` → `completed` (legacy)
- ✅ **Run Operation Field**: Operation (`plan-only`, `plan-and-apply`, `destroy`) is included in run response attributes (TFE-compatible)
  - Frontend correctly displays "Plan Only Run" vs "Plan and Apply Run" vs "Destroy Run"
  - Operation is determined from request based on `auto_apply_after_plan` flag
  - Legacy operations (`plan`, `apply`) are supported for backward compatibility
- ✅ Run attributes match TFE JSON:API format
- ✅ **Status Timestamps**: Fully implemented with granular timestamps (TFE-compatible)
  - `planning-at`: Set when run status is `planning` (plan phase in progress)
  - `planned-at`: Set when run status is `planned` (plan phase completed)
  - `applying-at`: Set when run status is `applying` (apply phase in progress)
  - `applied-at`: Set when run status is `applied` (apply phase completed)
  - `plan-queued-at`: Set when run status is `pending` (queued for planning)
  - Legacy timestamps are mapped appropriately for backward compatibility
- ✅ **has-changes**: Calculated from plan output (resource additions, changes, destructions)
- ✅ Configuration versions linked to runs
- ✅ Plan output stored in run model
- ✅ **Plans Endpoint**: Both `/api/v2/runs/:id/plan` and `/api/v2/plans/:id` supported (plan ID = run ID)
  - Returns plan status "finished" for completed plans (not "completed" or "planned")
  - Includes proper status timestamps (queued-at, pending-at, started-at, finished-at)
  - Includes `has-changes`, resource counts, and `log-read-url` with token
  - Includes relationships and links (self, json-output)
- ✅ Logs endpoint implemented (`GET /api/v2/runs/:id/logs`) - TFE-compatible
  - Supports token authentication via query parameter: `?token=<token>`
  - Supports offset/limit query parameters for log streaming (Terraform CLI reads logs in chunks)
  - Returns `200 OK` with empty body when logs don't exist or when offset >= log length
  - Returns requested chunk of logs based on offset/limit
- ✅ Logs stored in MinIO at `runs/{run_id}/logs/{operation}.log`
- ✅ Logs support all execution modes (remote, local, agent)
- ✅ Logs captured from all Terraform operations (init, plan, apply, destroy)
- ✅ Logs returned as plain text (TFE-compatible format)
- ✅ **Apply Output Display**: Frontend fetches and displays logs for apply/destroy runs
  - Plan runs show structured plan output (JSON) via plan endpoint
  - Apply/destroy runs show logs (plain text) via logs endpoint
  - Matches TFE behavior of showing different output types for different operations
- ✅ **State Saving After Apply**: Runner automatically saves state after successful apply
  - Reads `terraform.tfstate` file from workspace directory
  - Creates state version via state service (TFE-compatible)
  - State stored in MinIO and metadata in database
  - **State versions linked to runs**: `RunID` field added to `StateVersion` model to track which run created each state version
  - Matches TFE behavior of automatic state versioning after apply
- ✅ **State Version Display**: Frontend displays state versions with run ID instead of "Triggered via CLI"
  - State versions are clickable and link to the run that created them
  - State version name shows "Run {run_id}" when linked to a run
  - State versions can be inspected from the frontend by clicking on them
- ✅ **Resource Count Display**: Frontend calculates and displays accurate resource count from latest state version
  - Resources count shown in workspace header metadata
  - Resources section in Overview tab shows count from latest state
  - Counts resources from `state_data.resources` field in state version
- ✅ **Run Status Badge**: Status pill correctly shows operation-specific labels
  - "Planned" for completed plan runs that can be applied (`can-apply: true`, database status is "completed", badge shows "Planned" for UI clarity)
  - "Finished" for completed plan-only runs that cannot be applied or that have been applied (`can-apply: false`)
    - Status immediately changes to "Finished" when "Apply Plan" is clicked (frontend local state update)
    - Status persists when navigating back because backend returns `can-apply: false` if an apply run exists
  - "Applied" for completed apply runs
  - "Destroyed" for completed destroy runs
  - "Running", "Pending", "Errored", "Cancelled" for other statuses
  - ✅ **Output Viewer**: Unified component for displaying plan and apply outputs
    - Renamed `PlanViewer` to `OutputViewer` for general use
    - Used for both plan outputs (JSON) and apply/destroy outputs (logs)
    - Attempts to parse logs as JSON and display using JsonViewer if valid JSON
    - Falls back to plain text display if logs are not JSON
    - Consistent formatting across all run types
  - ✅ **Apply Output Viewer**: Component for displaying apply phase output with real-time resource status
    - Implementation: `frontend/src/components/runs/ApplyOutputViewer.tsx`
    - **Error State Handling**: Improved resource error state transitions
      - Resources that produce errors now correctly transition from `applying` (blue) to `failed` (red) state
      - Uses fuzzy resource address matching to handle module prefix mismatches in error messages
      - `findMatchingResourceAddress()` helper function performs three-level matching:
        1. Exact match (e.g., `module.path.type.name` matches `module.path.type.name`)
        2. Suffix match (e.g., `type.name` matches `module.path.type.name`)
        3. Type-name match (e.g., `type.name` matches any `*.type.name`)
      - Handles cases where error messages contain partial addresses without module prefixes
      - Error messages are displayed on resource cards with failed status
    - **Failed Resource Badge**: Added "Failed" badge to summary section
      - Displays count of resources that failed during apply (e.g., "1 added, 1 failed")
      - Red badge with XCircle icon, matches styling of other summary badges
      - Counted from resource status map after error parsing
      - Shown only when `summary.failed > 0`
    - **Summary Section Layout**: Added padding between resource cards and summary badges (`pt-4` on badges container)
    - **Error Message Display**: Error messages from Terraform logs are parsed and associated with correct resources for display
  - **Plan Output Improvements**:
    - **Accurate Total Changes**: Total changes count is sum of add, change, destroy, and replace (not number of resources)
    - **Replace Operations**: Resources with both `delete` and `create` actions are counted as `replace` (shown in orange)
    - **No-Op Resource Filtering**: Resources with no changes (empty actions array or all "no-op" actions) are filtered out from display
    - **Resource Changes Header**: Shows "Resource Changes ({count})" where count is actual resources with changes
    - **Data Sources Display**: Optional checkbox to show/hide data sources in the plan view
      - Data sources are identified by `mode === "data"` in the plan output
      - When enabled, data sources are displayed with a double-headed arrow icon (`ArrowLeftRight`) instead of action badges
      - Data sources are shown even if they have no changes (unlike managed resources which are filtered out)
      - **Data Source Extraction**: Data sources are extracted from `planned_values.root_module` and `prior_state.values.root_module` recursively (including child modules)
        - Uses `collectResourcesFromModule()` helper function to traverse nested module structures
        - Handles data sources in modules (e.g., `module.proxmox_test.data.proxmox_virtual_environment_version.version`)
        - Data sources are identified by `mode === "data"` property
      - Data source values are extracted from `prior_state.values.root_module.resources` or `planned_values.root_module.resources` and displayed inline
      - Data source values are shown as key-value pairs below the resource address (e.g., "version: 8.4.0, release: 8.4")
      - Visual styling matches managed resources (same background, border, font size) while retaining distinct color coding (orange for keys, green for strings)
      - Users can expand data sources to see full details in the diff view
      - Implementation: See `OutputViewer` component in `frontend/src/components/runs/OutputViewer.tsx`
- ✅ **Plan and Apply Flow (TFE-Compatible Single Run Model)**: 
  - **Plan-and-Apply Runs**: Single run that goes through both phases on the same page
    - Phase 1 (Plan): `pending` → `planning` → `planned` (plan output displayed)
    - Phase 2 (Apply): User clicks "Apply Plan" → run transitions to `applying` → `applied` (apply output displayed)
    - Both phases are shown on the same run detail page
    - Apply action (`POST /api/v2/runs/:id/actions/apply`) transitions the run from `planned` to `applying` status (doesn't create a new run)
    - **Apply Phase Visibility**: Apply section only appears when "Apply Plan" button is clicked (never before)
    - **Auto-Scroll to Apply Phase**: When "Apply Plan" is clicked, page automatically scrolls to apply phase section
    - **Optimistic UI Updates**: Apply phase section appears immediately when button is clicked (before backend confirms)
  - **Plan-Only Runs**: Single run that only goes through plan phase
    - `pending` → `planning` → `planned` (final state, cannot be applied)
    - CLI runs are always plan-only (cannot be applied, prevents drift with git)
  - **UI Options**:
    - "Plan Only": Creates a plan-only run (cannot be applied)
    - "Plan and Apply" (default): Creates a plan-and-apply run (goes through both phases)
    - "Destroy": Creates a destroy run
  - **Run Titles**: Display "Plan Only" and "Plan and Apply" (removed "Run" suffix for cleaner UI)
  - **VCS Auto-Apply**: For VCS-triggered plan-and-apply runs, if workspace has `AutoApply` enabled, the run automatically transitions to `applying` status after plan completes
  - Matches TFE behavior where plan-and-apply is a single run with two phases
- ✅ **Run Status Badge Logic**: Unified status badge computation (TFE-compatible)
  - **Implementation**: Single shared utility and component (see `docs/architecture/status/STATUS_BADGE_UNIFICATION.md`)
  - **Status Computation**: `frontend/src/utils/runStatus.ts` - `computeDisplayStatus()`
  - **Badge Component**: `frontend/src/components/runs/StatusBadge.tsx`
  - **Usage**: All components (RunDetail, WorkspaceDetail, Workspaces) use shared utility
  - **Status Mapping**:
    - "Planned" for `planned` status when `can-apply=true` and `has-changes=true`
    - "Finished" for plan-only runs, no-changes plans, or completed plan-and-apply with no changes
    - "Applied" for `applied` status or completed apply runs
    - "Destroyed" for completed destroy runs
    - "Planning", "Applying", "Running" for in-progress statuses
    - "Errored", "Cancelled", "Pending" for other statuses
  - **Workspace Status Badge**: 
    - Uses latest run's status badge (TFE pattern)
    - Implementation: `frontend/src/pages/WorkspaceDetail.tsx:754-765`
- ✅ **State Version Display**: TFE-style state version display
  - Shows state version number as primary identifier
  - Shows run ID that triggered the state version (if available)
  - Shows commit hash (shortened, if available)
  - Shows committer email/name (if available)
  - Only state version number and run ID are required; commit info is optional
  - State versions are clickable and link to the run that created them
- ✅ **Real-Time Run Experience (TFE-Compatible)**: Engaging, real-time run monitoring similar to Terraform Enterprise
  - **Polling Hook (`useRunPolling`)**: Custom React hook that polls run status every 2 seconds while run is active
    - Uses refs to track status across closures (prevents infinite polling loops)
    - Automatically stops polling when run reaches terminal state (completed, failed, canceled)
    - Automatically fetches plan output when plan completes (or if already completed)
    - Incrementally fetches logs for apply/destroy runs as they execute
    - Provides callbacks for status changes, plan output updates, and log updates
    - Shows toast notifications on status changes
    - Properly handles component unmounting and cleanup
  - **Sleek Timeline Component (`RunTimeline`)**: Replaces bulky timestamp cards with integrated timeline
    - Shows Created, Started, Completed timestamps in a horizontal flow
    - Uses status icons (clock, spinner, checkmark, X) to indicate state
    - Compact design that takes minimal space
    - Interactive and frontend-driven (updates in real-time via polling)
  - **Unified Plan-and-Apply View**: Plan and apply runs are shown as one unified run in the frontend
    - When viewing a plan run, automatically detects if there's an associated apply run (same config version)
    - If apply run exists, shows both "Plan Phase" and "Apply Phase" sections in one view
    - Run title shows "Plan and Apply Run" when both phases are present
    - Plan output appears in "Plan Phase" section
    - Apply output appears in "Apply Phase" section (polled in real-time if apply run is still running)
    - Apply button only shows for plan runs that can be applied (based on `permissions.can-apply` from backend)
    - Backend is source of truth for `can-apply` - frontend doesn't require plan output to be loaded to show apply button
  - **Real-Time Resource Updates**: For apply/destroy runs, resources are displayed as they're being created/modified/destroyed
    - Logs are fetched incrementally during execution (not just at completion)
    - `ApplyOutputViewer` parses logs in real-time to extract resource changes
    - **Interactive Resource Status**: Resources show real-time status indicators
      - `pending`: Empty circle (waiting to be applied)
      - `applying`: Blue spinning circle (currently being applied)
      - `completed`: Green checkmark (successfully applied)
      - `failed`: Red X (application failed)
      - **Error State Transitions**: Resources now correctly transition from `applying` to `failed` when errors occur
        - Uses fuzzy matching to associate error messages with correct resource addresses
        - Error messages are displayed on failed resource cards
        - Failed resources counted in summary badge
    - Resources appear in the UI as they complete (create, update, delete, replace)
    - **Staged Resources Display**: All planned resources are shown immediately when apply phase starts
      - Resources are pre-populated from plan output before apply begins
      - Status indicators update in real-time as logs stream in
      - Matches TFE behavior where staged resources are visible from the start
    - Replace operations (delete + create) are correctly identified and shown in orange
    - Summary counts update dynamically as resources are processed
    - **Resource Status Colors**: 
      - Successfully applied resources show green checkmark (regardless of action type)
      - Action pill (create/update/delete/replace) retains its color (green/blue/red/orange)
      - Card border/background changes based on status (blue for applying, green for completed, red for failed)
  - **Plan-Only Runs**: Show output only when plan completes (no real-time updates needed)
  - **Plan and Apply Runs**: Full real-time experience - plan output appears when plan completes, then apply output streams in real-time as resources are created
  - **Apply Phase Polling**: 
    - Apply phase output polls continuously while status is `applying`
    - `logsFetchedRef` is only set to `true` when status is NOT `applying`, ensuring continuous polling during apply
    - Plan output is fetched when status is `planned`, `applying`, or `applied` (for staged resources display)
    - Logs are fetched incrementally during apply phase with offset tracking
  - **Color Coding**: Consistent color scheme across plan and apply outputs
    - Green: Create operations
    - Blue: Update operations
    - Orange: Replace operations (delete + create)
    - Red: Delete operations
  - **User Experience**: 
    - No page refresh needed - all updates happen automatically
    - Smooth transitions and animations
    - Immediate feedback on actions (cancel, apply, discard)
    - Status badges update in real-time
    - Toast notifications for important events
    - No infinite polling loops - proper cleanup and status tracking
- ✅ **Run Source Display (Context-Aware)**: TFE-style run trigger information display
  - **Backend Implementation**: Run response includes configuration version details in attributes
    - `configuration-version-source`: "tfe-vcs", "tfe-cli", "tfe-ui", "tfe-api" (indicates how config version was created)
    - `commit-hash`: Git commit hash (for VCS-triggered runs)
    - `committer`: Committer email/name (for VCS-triggered runs)
    - These fields are included when a run has a configuration version
  - **Frontend Implementation**: `RunSourceDisplay` component shows context-aware messages
    - **CLI-triggered runs**: Shows "Triggered via CLI" with terminal icon
    - **UI-triggered runs**: Shows "Triggered via UI" with globe icon (blue color: `text-blue-500 dark:text-blue-400`)
    - **VCS-triggered runs**: Shows "Triggered via VCS" with git branch icon (purple color: `text-purple-500 dark:text-purple-400`), plus commit hash (shortened) and committer (if available)
      - Format: "Triggered via VCS • {commit_hash} • {committer}" (similar to state version display)
      - **Clickable Commit Hash**: Commit hash is a clickable link that opens the VCS platform's diff page
        - GitHub: `https://github.com/{owner}/{repo}/commit/{hash}`
        - GitLab: `https://gitlab.com/{owner}/{repo}/-/commit/{hash}`
        - Link includes `ExternalLink` icon and opens in new tab
        - Click event stops propagation to prevent parent link navigation
        - Workspace details are fetched to construct correct repository URL
    - **API-triggered runs**: Shows "Triggered via API" (fallback)
    - **Icon Colors**: 
      - Git branch icon: Purple (`text-purple-500 dark:text-purple-400`)
      - Globe icon: Blue (`text-blue-500 dark:text-blue-400`)
  - **Display Locations**:
    - Run detail page: Shows below run title and status badge
    - Workspace runs list: Shows in each run card, replacing hardcoded "Triggered via CLI" text
  - **Source Determination Logic**:
    - Priority 1: Configuration version source (most accurate - tells how config was created)
    - Priority 2: Run source (fallback - tells how run was queued)
    - Configuration version source takes precedence because it provides more specific context
    - VCS-triggered runs include commit info (hash and committer) for full traceability
- ✅ **Queue Endpoint**: `/api/v2/organizations/:name/runs/queue` excludes cancelled/completed/failed runs
  - Only returns runs with status `pending` or `running`
  - Used by Terraform CLI to check if runs are blocking new runs
- ✅ **Run Deduplication**: Prevents duplicate runs from Terraform CLI retries
  - Checks for recent run (within 10 seconds) with same workspace and operation
  - Ignores configuration version to catch retries
- ✅ **Run Actions**: Accurately set based on run state (is-cancelable, is-discardable, etc.)
- ✅ **Plan-Only Attribute (TFE-Compatible)**: Correctly implements `plan-only` attribute per TFE spec
  - **CLI runs** (source="tfe-cli"): Always `plan-only: true` - cannot be applied (prevents drift with git)
  - **UI "Plan only" runs**: `plan-only: true` - cannot be applied
  - **UI "Plan and Apply" runs**: `plan-only: false` - can be applied after completion
  - **Configuration version runs** (source="tfe-configuration-version"): `plan-only: false` - can be applied if workspace.AutoApply is enabled
    - Note: We check the configuration version's source to determine if it's VCS-triggered for auto-apply logic
  - **permissions.can-apply**: Only `true` if run status is "completed", plan operation, NOT plan-only, AND no apply run exists
    - According to TFE spec: can-apply is true only if run is completed, plan operation, not plan-only
    - **Backend Logic**: The `formatRunResponse` function checks for existing apply runs associated with the plan run:
      - Queries for apply runs with the same workspace and configuration version created at or after the plan run
      - If an apply run exists (regardless of its status: pending, running, completed, failed), `can-apply` is set to `false`
      - This ensures that once an apply run is created, the plan run can no longer be applied
      - Uses `!existingRun.CreatedAt.Before(run.CreatedAt)` to handle cases where runs are created in quick succession
    - Database stores "completed" status for completed plan runs (not "planned")
    - The "planned-at" timestamp in status-timestamps signals plan completion, but can-apply checks status="completed"
  - Frontend uses `permissions.can-apply` from API response to determine if "Apply Plan" button should be shown
    - When `can-apply: false`, buttons are hidden and status badge shows "Finished"
    - Frontend immediately updates local state when "Apply Plan" is clicked (before backend responds) for instant feedback
  - Matches TFE behavior where Terraform CLI checks `plan-only` attribute to determine if run can be applied
- ✅ **Run Source Detection (TFE-Compatible)**: Correctly identifies run source based on TFE spec
  - **Configuration Version Runs** (highest priority): If run has a configuration version, source is `tfe-configuration-version`
    - According to TFE spec: "Indicates a run was queued from a Configuration Version, triggered from a VCS provider"
    - This applies regardless of how the configuration version was created (VCS, CLI, UI, etc.)
    - The configuration version's `source` field indicates how the config was created, but the run's `source` indicates it was queued from a configuration version
  - **Auth Method** (fallback): If no configuration version, use auth method from context
    - `tfe_token`: Maps to `tfe-cli` (Terraform CLI remote backend)
    - `jwt`: Maps to `tfe-ui` (web interface)
    - `api_key`: Maps to `tfe-cli` (programmatic access)
  - **Default**: Falls back to `tfe-api` if source cannot be determined
  - **Configuration Version Source**: Configuration versions track their own source (how they were created)
    - `tfe-vcs`: Created from VCS webhook push events
    - `tfe-cli`: Created from Terraform CLI remote backend
    - `tfe-ui`: Created from web interface
    - `tfe-api`: Created via API
  - **Run Response**: `source` attribute in run response correctly reflects the run's origin per TFE spec
- ✅ **Auto-Cancellation of Previous Plan Runs**: Prevents state corruption while allowing plan-only runs to run independently from plan-and-apply runs
  - **Plan-only runs**: When creating a new plan-only run, only other plan-only runs are cancelled (pending/running/planned)
    - Plan-only runs cannot alter state, so they run completely independently from plan-and-apply runs
    - Cancelling old plan-only runs when starting new ones improves UX - users don't want to wait for old previews
    - Multiple plan-only runs can run in parallel, but cancelling old ones prevents queue buildup
    - Plan-only runs do NOT cancel plan-and-apply runs (they're separate operations)
  - **Plan-and-apply runs**: When creating a new plan-and-apply run, only other plan-and-apply runs are cancelled (pending/running/planned)
    - Plan-and-apply runs will alter state, so only one should run at a time to prevent state corruption
    - Plan-and-apply runs do NOT cancel plan-only runs (they're separate operations that cannot alter state)
    - Ensures only one state-altering plan-and-apply run is active at a time
  - **Key Principle**: Plan-only runs and plan-and-apply runs are completely independent - they never cancel each other
  - Only applies to plan runs (not apply or destroy runs)
  - Cancelled runs are marked with `status: "canceled"` and `completed_at` timestamp
  - **Implementation**: See `backend/internal/api/v2/handlers/terraform/runs.go:610-650`
- ✅ **can-apply Permission Implementation**: Backend correctly determines `can-apply` permission for plan runs
  - **Backend Logic**: In `formatRunResponse` function (`backend/internal/api/v2/handlers/terraform/runs.go`):
    - Initially sets `canApply = true` if run status is "completed", operation is "plan", and not plan-only
    - Then checks for existing apply runs associated with the plan run:
      - Queries workspace runs for apply runs with the same workspace and configuration version
      - Uses `!existingRun.CreatedAt.Before(run.CreatedAt)` to handle runs created in quick succession
      - If an apply run exists (regardless of status: pending, running, completed, failed), sets `canApply = false`
    - This ensures that once an apply run is created, the plan run's `can-apply` permission is immediately set to `false`
    - The check works immediately after apply run creation, so navigation back to plan run shows correct status
  - **Frontend Logic**: In `RunDetail.tsx`:
    - Status badge checks `permissions['can-apply']` to determine if it should show "Planned" or "Finished"
    - When "Apply Plan" is clicked, immediately updates local state to `status: 'completed'` and `permissions['can-apply']: false`
    - This provides instant UI feedback before the backend responds
    - After apply run creation, refetches the plan run to ensure backend consistency
    - Auto-navigates to the newly created apply run

**Backend:**
- [x] ✅ Run creation endpoint (TFE-compatible)
- [x] ✅ Run queue system (Redis-based)
- [x] ✅ Orchestrator process (polls and queues runs)
- [x] ✅ Runner process (executes runs)
- [x] ✅ Execution mode field in workspace model
- [x] ✅ Logs endpoint (`GET /api/v2/runs/:id/logs`) - TFE-compatible
- [x] ✅ Logs captured during terraform execution (init, plan, apply, destroy)
- [x] ✅ Logs stored in MinIO at `runs/{run_id}/logs/{operation}.log`
- [x] ✅ Logs support remote execution mode
- [x] ✅ Logs support agent execution mode (same storage as remote)
- [x] ✅ Plugin interface updated to return logs from all operations
- [x] ✅ Runner stores logs in MinIO during execution
- [x] ✅ Stuck run cleanup mechanism (orchestrator cleans up abandoned runs)
- [x] ✅ CORS middleware supports IPv6 localhost
- [ ] ⏭️ Immediate run queuing on creation (optional Redis in API)
- [ ] ⏭️ Local execution mode log upload endpoint
- [ ] ⏭️ Agent pool management
- [ ] ⏭️ Local execution mode support (full implementation)

**Frontend:**
- [x] ✅ Run detail page with cancel button
- [x] ✅ Cancel run functionality (calls `POST /api/v2/runs/:id/actions/cancel`)
- [x] ✅ CORS support for all localhost variants (IPv4 and IPv6)
- [ ] Execution mode selector in workspace settings
- [ ] Run queue status display
- [ ] Runner status/health monitoring
- [ ] Agent pool management UI
- [x] ✅ Logs viewer in run detail page (plan output via plan endpoint; apply/destroy logs via `GET /api/v2/runs/:id/logs`)
- [x] ✅ Discard plan functionality (Plan and Apply runs in `planned` status; `POST /api/v2/runs/:id/actions/discard`)

---

### Phase 7: Run Configuration

#### 6.1 Run Settings
**Backend:**
- [ ] Add run configuration to workspace:
  - `QueueAllRuns` (boolean)
  - `SpeculativeEnabled` (allow PR runs)
  - `AllowDestroyPlan` (boolean)
  - `RunTimeout` (seconds)

**Frontend:**
- [ ] Run settings section in workspace config
- [ ] Toggle switches for each setting

---

## Database Schema Updates Needed

### Current Workspace Model (Existing)
```go
type Workspace struct {
    ID                uuid.UUID  `gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
    ProjectID         uuid.UUID  `gorm:"type:uuid;not null;index"`
    Name              string     `gorm:"type:varchar(255);not null;uniqueIndex:idx_project_workspace"`
    Description       string     `gorm:"type:text"`
    VCSProvider       string     `gorm:"type:varchar(50)"`        // ✅ Existing
    VCSRepository     string     `gorm:"type:varchar(500)"`       // ✅ Existing
    VCSBranch         string     `gorm:"type:varchar(255);default:'main'"` // ✅ Existing
    VCSWebhookSecret  string     `gorm:"type:varchar(255)"`       // ✅ Existing
    TerraformVersion  string     `gorm:"type:varchar(50)"`         // ✅ Existing
    WorkingDirectory  string     `gorm:"type:varchar(500)"`        // ✅ Existing
    CreatedAt         time.Time
    UpdatedAt         time.Time
    Project           Project    `gorm:"foreignKey:ProjectID"`
    Runs              []Run      `gorm:"foreignKey:WorkspaceID"`
    Variables         []Variable `gorm:"foreignKey:WorkspaceID"`
}
```

### New Models Needed

```go
// VCSConnection - Stores GitHub App connections per organization
type VCSConnection struct {
    ID              uuid.UUID `gorm:"type:uuid;primary_key"`
    OrganizationID  uuid.UUID `gorm:"type:uuid;not null;index"`
    Provider        string    `gorm:"type:varchar(50);not null"` // "github", "gitlab", "bitbucket"
    InstallationID  string    `gorm:"type:varchar(255)"`         // GitHub App installation ID
    AccessToken     string    `gorm:"type:text"`                // Encrypted access token
    RefreshToken    string    `gorm:"type:text"`                // Encrypted refresh token
    TokenExpiresAt  *time.Time
    AccountName     string    `gorm:"type:varchar(255)"`         // GitHub org/user name
    AccountType     string    `gorm:"type:varchar(50)"`         // "organization" or "user"
    CreatedAt       time.Time
    UpdatedAt       time.Time
    Organization    Organization `gorm:"foreignKey:OrganizationID"`
}
```

### Workspace Model Updates Needed

```go
// Workspace - Additional fields needed for full TFE compatibility
type Workspace struct {
    // ... existing fields above ...
    
    // VCS Integration (Phase 1)
    VCSConnectionID *uuid.UUID `gorm:"type:uuid;index"`         // Link to VCSConnection
    VCSConnection   VCSConnection `gorm:"foreignKey:VCSConnectionID"` // Relationship
    
    // Auto-triggering (Phase 2)
    AutoQueueRuns   bool       `gorm:"default:false"`           // Auto-queue on VCS push
    TriggerPatterns string     `gorm:"type:text"`               // JSON array of glob patterns
    
    // Auto-apply (Phase 3)
    AutoApply       bool       `gorm:"default:false"`           // Auto-apply successful plans
    AutoApplyBranch string     `gorm:"type:varchar(255)"`       // Branch for auto-apply
    
    // Execution Mode (Phase 3)
    ExecutionMode   string     `gorm:"type:varchar(50);default:'remote'"` // remote, local, agent
    AgentPoolID     *uuid.UUID `gorm:"type:uuid"`               // For agent mode
    
    // Run Settings (Phase 6)
    QueueAllRuns    bool       `gorm:"default:true"`            // Allow all runs
    SpeculativeEnabled bool    `gorm:"default:true"`            // Allow PR runs
    AllowDestroyPlan bool      `gorm:"default:false"`           // Allow destroy operations
    RunTimeout      int        `gorm:"default:3600"`             // Run timeout in seconds
    
    // Workspace State
    Locked           bool      `gorm:"default:false"`            // Lock workspace
    LockedBy         *uuid.UUID `gorm:"type:uuid"`              // User who locked
    LockedAt         *time.Time                                  // When locked
}
```

---

## API Endpoints to Implement

### VCS Connections (v2 API - Implemented)
- `GET /api/v2/organizations/:name/vcs-connections/github/install` - Initiate GitHub App installation
- `POST /api/v2/vcs-connections/github/webhook` - GitHub App webhook (installation + push events)
- `GET /api/v2/organizations/:name/vcs-connections` - List connections
- `POST /api/v2/organizations/:name/vcs-connections` - Create (e.g. from installation)
- `GET /api/v2/vcs-connections/:id` - Get connection details
- `DELETE /api/v2/vcs-connections/:id` - Disconnect
- `GET /api/v2/vcs-connections/:id/repositories` - List repositories
- `GET /api/v2/vcs-connections/:id/repositories/:owner/:repo/branches` - List branches
- `GET /api/v2/vcs-connections/:id/repositories/:owner/:repo/contents/*path` - File content
- `GET /api/v2/vcs-connections/:id/repositories/:owner/:repo/yaml-files` - List YAML files
- `GET /api/v2/vcs-connections/:id/repositories/:owner/:repo/inventory-files` - List inventory files

### TFE-Compatible API (v2 API - Terraform Provider) ✅ **FULLY IMPLEMENTED**

**Organizations:**
- ✅ `GET /api/v2/organizations` - List organizations
- ✅ `GET /api/v2/organizations/:name` - Get organization
- ✅ `POST /api/v2/organizations` - Create organization
- ✅ `PATCH /api/v2/organizations/:name` - Update organization
- ✅ `DELETE /api/v2/organizations/:name` - Delete organization

**Projects:**
- ✅ `GET /api/v2/organizations/:name/projects` - List projects
- ✅ `GET /api/v2/organizations/:name/projects/:name` - Get project
- ✅ `POST /api/v2/organizations/:name/projects` - Create project
- ✅ `PATCH /api/v2/organizations/:name/projects/:name` - Update project
- ✅ `DELETE /api/v2/organizations/:name/projects/:name` - Delete project

**Workspaces:**
- ✅ `GET /api/v2/organizations/:name/workspaces` - List workspaces
- ✅ `GET /api/v2/organizations/:name/workspaces/:name` - Get workspace
- ✅ `POST /api/v2/organizations/:name/workspaces` - Create workspace
- ✅ `PATCH /api/v2/organizations/:name/workspaces/:name` - Update workspace
- ✅ `DELETE /api/v2/organizations/:name/workspaces/:name` - Delete workspace

**Configuration Versions:**
- ✅ `POST /api/v2/workspaces/:id/configuration-versions` - Create configuration version (returns upload-url with token)
  - **Auth**: TFE token or JWT token (Authorization header)
  - Returns `upload-url` attribute with token in query parameter
- ✅ `GET /api/v2/workspaces/:id/configuration-versions` - List configuration versions
  - **Auth**: TFE token or JWT token (Authorization header)
- ✅ `GET /api/v2/configuration-versions/:id` - Get configuration version
  - **Auth**: TFE token or JWT token (Authorization header)
- ✅ `PUT /api/v2/configuration-versions/:id/upload?token=<upload_token>` - Upload configuration files
  - **Auth**: Token in query parameter (`?token=<upload_token>`)
  - **Bypasses middleware**: Endpoint registered separately to bypass authentication middleware
  - Terraform CLI doesn't send Authorization header for upload URLs
  - Token validated in upload handler itself

**Runs:**
- ✅ `POST /api/v2/runs` - Create run (supports configuration-version relationship)
  - **Auth**: TFE token or JWT token (Authorization header)
  - **Deduplication**: Prevents duplicate runs (checks for recent run with same workspace/operation within 10 seconds)
  - **TFE-Compatible Restriction**: CLI remote backend can only create plan runs (not apply runs)
  - Apply runs must be created via `POST /api/v2/runs/:id/actions/apply` after a plan run completes
  - UI only supports "Plan and Apply" (2-phase process): create plan run, show output, confirm, then create apply run
- ✅ `GET /api/v2/runs/:id` - Get run
  - **Auth**: TFE token or JWT token (Authorization header)
  - Returns run with status timestamps (planned-at, planning-at, plan-queued-at)
  - Returns `has-changes` calculated from plan output
  - **Run status**: Plan runs that complete successfully have status "completed" (not "planned")
    - Terraform CLI expects "completed" status to recognize plan completion
    - The "planned-at" timestamp in status-timestamps also signals completion
    - According to TFE design: "Run status stays as 'completed' (not mapped to 'planned') - Terraform CLI checks plan status, not run status"
- ✅ `GET /api/v2/runs/:id/plan` - Get plan output
  - **Auth**: TFE token or JWT token (Authorization header)
  - Returns plan output in JSON format (TFE Plans API spec)
  - Plan status: "finished" for completed plans (not "completed" or "planned")
  - Includes status timestamps (queued-at, pending-at, started-at, finished-at)
  - Includes `has-changes`, resource counts (additions, changes, destructions, imports)
  - Includes `log-read-url` attribute with absolute URL to logs endpoint (includes token in query parameter)
  - Includes relationships (state-versions) and links (self, json-output)
- ✅ `GET /api/v2/plans/:id` - Get plan output (TFE-compatible alias)
  - **Auth**: TFE token or JWT token (Authorization header)
  - Maps to same handler as `/api/v2/runs/:id/plan` (plan ID = run ID)
  - Returns same response format as `/api/v2/runs/:id/plan` (TFE Plans API spec)
- ✅ `GET /api/v2/runs/:id/logs` - Get run logs (TFE-compatible, supports all execution modes)
  - **Auth**: TFE token or JWT token (Authorization header OR `?token=<token>` query parameter)
  - **Query Parameters**: Supports `offset` and `limit` for log streaming
    - Terraform CLI reads logs in chunks using offset/limit
    - Returns requested chunk of logs based on offset/limit
    - Returns `200 OK` with empty body when offset >= log length (signals end of stream)
  - Returns logs as plain text (`text/plain` content type)
  - Returns `200 OK` with empty body when logs don't exist
  - Logs stored in MinIO at `runs/{run_id}/logs/{operation}.log`
- ✅ `POST /api/v2/runs/:id/actions/apply` - Apply run
  - **Auth**: TFE token or JWT token (Authorization header)
  - **TFE-Compatible Behavior**: 
    - **For plan-and-apply runs**: Transitions the run from `planned` status to `applying` status (single run, no new run created)
      - Returns `202 Accepted` with the updated run in response
      - Run continues as the same entity through both phases
    - **For legacy plan runs**: Creates a NEW apply run (backward compatibility)
      - Returns `202 Accepted` with the new apply run in response
      - The apply run uses the same configuration version as the plan run
  - Only runs in `planned` status (plan-and-apply) or `completed` status (legacy plan) can be applied
  - **Backend can-apply Logic**: For plan-and-apply runs, `can-apply` is `true` when status is `planned` and `false` when status transitions to `applying` or `applied`
    - For legacy plan runs, after creating an apply run, subsequent GET requests for the plan run will return `can-apply: false` because:
      - The `formatRunResponse` function checks for existing apply runs with the same workspace and configuration version
      - If an apply run exists (created at or after the plan run), `can-apply` is set to `false`
      - This ensures the plan run status shows "Finished" and buttons remain hidden when navigating back
- ✅ `POST /api/v2/runs/:id/actions/cancel` - Cancel run
  - **Auth**: TFE token or JWT token (Authorization header)
  - Returns `202 Accepted` (no body) - TFE-compatible
  - Updates run status to `canceled` (American spelling, TFE-compatible)
- ✅ `POST /api/v2/runs/:id/actions/discard` - Discard run
  - **Auth**: TFE token or JWT token (Authorization header)
  - Returns `202 Accepted` (no body) - TFE-compatible
- ✅ `POST /api/v2/runs/:id/actions/force-cancel` - Force cancel run
  - **Auth**: TFE token or JWT token (Authorization header)
  - Returns `202 Accepted` (no body) - TFE-compatible
- ✅ `POST /api/v2/runs/:id/actions/force-execute` - Force execute run
  - **Auth**: TFE token or JWT token (Authorization header)
  - Returns `202 Accepted` (no body) - TFE-compatible
- ✅ `GET /api/v2/workspaces/:id/runs` - List runs by workspace
  - **Auth**: TFE token or JWT token (Authorization header)
  - Supports pagination (`page`, `per_page`)
- ✅ `GET /api/v2/organizations/:name/runs` - List runs by organization
  - **Auth**: TFE token or JWT token (Authorization header)
  - Supports pagination (`page`, `per_page`)
- ✅ `GET /api/v2/organizations/:name/runs/queue` - Get run queue for organization
  - **Auth**: TFE token or JWT token (Authorization header)
  - Returns only runs with status `pending` or `running` (excludes cancelled/completed/failed)
  - Used by Terraform CLI to check if runs are blocking new runs

**State Versions:**
- ✅ `GET /api/v2/workspaces/:id/state-versions` - List state versions
- ✅ `POST /api/v2/workspaces/:id/state-versions` - Create state version
- ✅ `GET /api/v2/state-versions/:id` - Get state version

**Variables (TFE uses `vars` in path):**
- ✅ `POST /api/v2/workspaces/:id/vars` - Create variable
- ✅ `GET /api/v2/workspaces/:id/vars` - List variables
- ✅ `PATCH /api/v2/workspaces/:id/vars/:variable_id` - Update variable
- ✅ `DELETE /api/v2/workspaces/:id/vars/:variable_id` - Delete variable

**TFE Token Management:**
- ✅ `POST /api/v2/tokens` - Create TFE token
- ✅ `GET /api/v2/tokens` - List user's tokens
- ✅ `DELETE /api/v2/tokens/:id` - Delete token

### Workspaces (v2 – TFE-compatible; Enhanced)
- `GET/POST /api/v2/organizations/:name/workspaces` - List/create workspaces (by org/name)
- `GET/PATCH/DELETE /api/v2/organizations/:name/workspaces/:name` - Get/update/delete workspace
- `GET /api/v2/workspaces/:id` - Get workspace by ID (TFE)
- `GET /api/v2/terraform/workspaces/:id` - Get workspace by ID (internal)
- `POST /api/v2/workspaces/:id/actions/lock` - Lock workspace
- `POST /api/v2/workspaces/:id/actions/unlock` - Unlock workspace
- `POST /api/v2/workspaces/:id/actions/force-unlock` - Force unlock

### Webhooks
- `POST /api/v1/webhooks/github` - GitHub webhook handler
- `POST /api/v1/webhooks/gitlab` - GitLab webhook handler (future)
- `GET /api/v1/workspaces/:id/webhook-status` - Get webhook status

---

## GitHub Integration Setup (via Zitadel)

### 1. Configure GitHub as External IdP in Zitadel

**Option A: Via Zitadel UI**
1. Go to Zitadel Console → Settings → Identity Providers
2. Add GitHub as external IdP
3. Configure OAuth app in GitHub
4. Enter Client ID and Client Secret in Zitadel

**Option B: Via Zitadel SDK (Programmatic)**
```go
// Use zitadel-go SDK to create GitHub IdP
// This can be done in zitadel-init script or via API
```

**GitHub OAuth App Requirements:**
- App name: "IaC Platform"
- Homepage URL: Your platform URL
- Authorization callback URL: `https://your-zitadel-instance.com/oauth/v2/callback`
- Permissions needed:
  - **Repository permissions:**
    - Contents: Read (to read repo files)
    - Metadata: Read (required)
    - Pull requests: Read (for PR-based runs)
    - Webhooks: Write (to create webhooks)

### 2. OAuth Flow for VCS Operations

1. User clicks "Connect GitHub" in organization settings
2. Redirect to Zitadel OAuth flow (which redirects to GitHub)
3. User authorizes GitHub access
4. GitHub redirects back to Zitadel
5. Zitadel redirects back to our callback with authorization code
6. Exchange code for GitHub access token
7. Store token (encrypted) in `VCSConnection` model
8. Use token for GitHub API calls (repos, branches, webhooks)

**Note**: Zitadel handles the OAuth flow, but we need to extract the GitHub token for VCS operations.

---

## Implementation Priority

### 🔥 **Phase 1 (MVP) - Immediate**
1. GitHub App OAuth flow
2. VCS Connection model & API
3. Repository listing
4. Enhanced workspace creation form
5. Working directory configuration

### 📅 **Phase 2 - Next Sprint**
1. Webhook creation & management
2. Auto-queue runs on push
3. Trigger patterns

### 🚀 **Phase 3 - Future**
1. Auto-apply
2. Execution modes
3. Advanced run settings

---

## Technical Stack

### Backend
- **Zitadel SDK**: `github.com/zitadel/zitadel-go/v3` (for IdP configuration)
- **GitHub API**: `github.com/google/go-github/v60` (official GitHub SDK)
- **OAuth**: `golang.org/x/oauth2` (for token exchange)
- **Webhook Verification**: `github.com/go-playground/webhooks/v6`
- **TFE API Compatibility**: Implement `/api/v2/` endpoints matching TFE spec

### Frontend
- **OAuth Flow**: Redirect through Zitadel (which handles GitHub)
- **Repository Selector**: Custom component with search
- **Form**: React Hook Form or similar

---

## Security Considerations

1. **Token Storage**: Encrypt GitHub tokens at rest
2. **Webhook Secrets**: Generate unique secret per workspace
3. **Webhook Verification**: Verify GitHub webhook signatures
4. **Access Control**: Only org members can connect VCS
5. **Token Refresh**: Handle token expiration/refresh
6. **Rate Limiting**: Respect GitHub API rate limits

---

## Testing Strategy

1. **Unit Tests**: VCS service methods
2. **Integration Tests**: GitHub API interactions (use GitHub API mocks)
3. **E2E Tests**: Full workspace creation flow
4. **Webhook Tests**: Test webhook handling with sample payloads

---

## Implementation Priority

### ✅ **Phase 0: Foundation - COMPLETED**
1. ✅ Review this plan
2. ✅ Research Zitadel SDK for GitHub IdP configuration
3. ✅ Research TFE API spec (from terraform-provider-tfe source)
4. ✅ Design API v2 structure (TFE-compatible)
5. ✅ Complete migration to v2 API (v1 removed)

### ✅ **Phase 1: TFE API Compatibility - COMPLETED**
1. ✅ Implement all core TFE v2 endpoints
2. ✅ Add TFE token authentication (middleware + token management API)
3. ✅ Match TFE response formats (JSON:API structure)
4. ✅ Implement state versions API
5. ✅ Implement variables API
6. ✅ Frontend migrated to v2 endpoints
7. ⏭️ Test with official terraform-provider-tfe (manual testing needed)

### 🔥 **Phase 2: Core Workspace Creation (MVP) - IN PROGRESS**
1. ⏭️ Configure GitHub as external IdP in Zitadel (via SDK or UI)
2. ✅ Implement VCS Connection model
   - ✅ Model with all fields (provider, tokens, account info)
   - ✅ Repository with CRUD operations
   - ✅ API handlers (List, Create, Get, Delete)
   - ✅ Routes configured (`/api/v2/organizations/:name/vcs-connections`)
<!-- 3. ⏭️ Build OAuth flow to get GitHub tokens -->
4. ⏭️ Create workspace form with VCS selection (frontend)
5. ✅ Add workspace configuration fields to model
   - ✅ VCSConnectionID (link to VCS connection)
   - ✅ AutoQueueRuns, AutoApply, ExecutionMode
   - ✅ Run settings (QueueAllRuns, SpeculativeEnabled, AllowDestroyPlan, RunTimeout)
   - ✅ Workspace state (Locked, LockedBy, LockedAt)
6. ✅ Enhance workspace creation endpoint with VCS validation
   - ✅ VCS connection validation (exists and belongs to organization)
   - ✅ Repository/branch validation when VCS selected
   - ✅ Project selection support
   - ✅ All new fields supported in create request

### 📅 **Phase 3: Webhook & Auto-Triggering**
1. ⏭️ Webhook management (create/update/delete)
2. ⏭️ Auto-triggering on VCS push
3. ⏭️ Trigger patterns implementation
4. ⏭️ Webhook signature verification

### 📅 **Phase 4: Advanced Configuration**
1. ⏭️ Auto-apply configuration
2. ⏭️ Execution mode selection
3. ⏭️ Run settings (timeout, destroy plans, etc.)
4. ⏭️ Workspace locking/unlocking

### ✅ **Phase 5: State Management - COMPLETED**
1. ✅ State storage (MinIO/S3)
2. ✅ State versioning API
3. ✅ State locking (model exists)
4. ⏭️ State download/rollback (frontend)

### ✅ **Phase 6: Variables & Secrets - COMPLETED**
1. ✅ Variable model and API
2. ✅ Encrypted/sensitive variable support
3. ✅ Variable CRUD operations
4. ✅ Variable management UI (frontend) - In workspace detail, Variables tab

### 🔥 **Phase 7: Workspace UI/UX Redesign - COMPLETED**
1. ✅ Workspace list page redesign (Terraform Enterprise-like)
   - ✅ Table view with filtering by status
   - ✅ Search functionality
   - ✅ Status badges and statistics
   - ✅ Pagination
   - ✅ Organization selector
2. ✅ Workspace detail page redesign (Terraform Enterprise-like)
   - ✅ Tabbed interface (Overview, Runs, States, Variables)
   - ✅ Overview tab with latest run, resources, outputs, workspace settings
   - ✅ Runs tab with filtering, status badges, and run history
   - ✅ States tab with state version history
   - ✅ Variables tab with variable management (add/edit/delete)
   - ✅ Breadcrumb navigation
   - ✅ Workspace header with metadata and actions
3. ✅ Runs view with comprehensive filtering and status display
4. ✅ States view with state version history
5. ✅ Variables view with full CRUD operations

### ✅ **Phase 9: Variable Sets (Variable Groups) - COMPLETED**
1. ✅ VariableSet model (organization and workspace scope)
2. ✅ VariableSetVariable model
3. ✅ VariableSetRepository with CRUD operations
4. ✅ VariableSet API handlers (TFE-compatible)
   - ✅ List variable sets by organization
   - ✅ Get variable set by ID
   - ✅ Create variable set
   - ✅ Update variable set
   - ✅ Delete variable set
   - ✅ Assign workspace to variable set
   - ✅ Unassign workspace from variable set
   - ✅ List variables in variable set
   - ✅ Create variable in variable set
   - ✅ Update variable in variable set
   - ✅ Delete variable from variable set
5. ✅ VariableSet frontend UI (organization settings)
   - ✅ Variable sets list page with filtering
   - ✅ Create/edit/delete variable sets
   - ✅ Manage variables within variable sets
   - ✅ Assign/unassign variable sets to workspaces
   - ✅ Variable set variables management (add/edit/delete)
6. ⏭️ Variable precedence logic (workspace vars override set vars) - TODO: Implement in run execution

---

## UI/UX Design Patterns (Terraform Enterprise-like)

### Workspace List Page
The workspace list page follows Terraform Enterprise's design patterns:

- **Breadcrumb Navigation**: Shows organization path (e.g., `mikevh / Workspaces`)
- **Header**: Large title with organization selector and "New" button
- **Status Filter Bar**: Horizontal bar with status filters (All, Needs Attention, Errored, Running, On Hold, Success) with counts
- **Search and Filters**: Search bar, Tags filter, Status filter dropdown, Clear all button
- **Workspaces Table**: 
  - Columns: Workspace Name (with project badge), Run Status (badge), Repo (with icon), Latest Change (time ago), Actions (dropdown menu)
  - Hover effects and clickable rows
  - Status badges with color coding (green for success, red for errored, orange for planned, blue for running)
- **Pagination**: Bottom pagination controls with page numbers
- **Empty State**: Centered card with icon, message, and call-to-action button

### Workspace Detail Page
The workspace detail page provides comprehensive information with a tabbed interface:

- **Breadcrumb Navigation**: Full path including workspace name
- **Workspace Header**:
  - Large workspace name with Terraform version badge
  - Workspace ID with copy button
  - Description (or "Add workspace description" link)
  - Metadata bar: Unlocked status, Resources count, Tags count, Terraform version, Updated time
  - Action buttons: Lock, New run
- **Tabbed Interface**:
  - **Overview Tab**: 
    - Latest Run section with run details, status badge, and metrics
    - Resources and Outputs sections (empty states)
    - Workspace Settings sidebar (Execution Mode, Auto-apply settings, Source repository)
  - **Runs Tab**:
    - Status filter buttons (All, Errored, Running, On Hold, Success) with counts
    - Search bar and Status filter dropdown
    - Run list with status badges, operation type, time ago, and run ID
    - Clickable run cards linking to run detail page
  - **States Tab**:
    - State version history list
    - Each state version shows: Triggered via CLI, State version number, time ago, state version ID
    - Empty state when no state versions exist
  - **Variables Tab**:
    - Variables table with Key, Value (masked for sensitive), Category, Actions columns
    - "Add variable" button
    - Create/Edit variable dialog with Key, Value, Sensitive checkbox, Category dropdown
    - Delete variable functionality
    - Empty state when no variables exist
- **Color Scheme**: Blue/purple gradient for titles, consistent status badge colors

### Variable Sets (Variable Groups)
Variable sets allow grouping variables together and applying them to multiple workspaces:

- **Organization-Scoped Variable Sets**: Apply to all workspaces in an organization
- **Workspace-Scoped Variable Sets**: Apply to specific workspaces (many-to-many relationship)
- **Variable Precedence**: Workspace variables override variable set variables (same key)
- **Variable Set Management**: 
  - Create/edit/delete variable sets in organization settings
  - Add/remove variables from a set
  - Assign/unassign variable sets to workspaces
  - View variable sets in workspace variables tab

### Design Consistency
- **Color Scheme**: Blue/purple gradient for headings, consistent status colors
- **Badges**: Outline style with color-coded backgrounds for status indicators
- **Empty States**: Centered cards with icons, messages, and call-to-action buttons
- **Tables**: Clean borders, hover effects, proper spacing
- **Forms**: Consistent input styling, labels, and validation
- **Buttons**: Primary actions use gradient backgrounds, secondary actions use outline style

---

## Interactive Run Time Lapse Experience

### Overview
The run detail page is redesigned to create an immersive, timeline-based experience that guides users through the run's lifecycle in a linear, progressive disclosure format. This creates a "time lapse" effect where users follow the run from creation through planning to application, with each phase appearing as the run progresses.

### Design Goals
1. **Linear Progression**: Create a vertical timeline that flows from top to bottom, following the run's natural progression
2. **Progressive Disclosure**: Show phases as they become relevant, not all at once
3. **Contextual Actions**: Place action buttons (Apply, Discard) where they're needed in the flow
4. **Visual Continuity**: Use a vertical timeline to connect phases visually
5. **Collapsible Sections**: Allow users to collapse completed phases to focus on active sections

### Layout Structure

#### 1. Header Section (Top)
```
┌─────────────────────────────────────────────────────────┐
│ [Breadcrumb: org / workspace / Run ID]                  │
├─────────────────────────────────────────────────────────┤
│ [Icon] Plan and Apply                                   │
│         [Status Badge] [Time Ago]                       │
│         Triggered via UI • Terraform 1.13.0            │
└─────────────────────────────────────────────────────────┘
```

**Changes:**
- Move Terraform version from plan section to header, next to "Triggered via UI"
- Format: "Triggered via UI • Terraform 1.13.0"
- Keep status badge and time ago in header
- Remove horizontal timeline from header

#### 2. Vertical Timeline Structure
```
┌─────────────────────────────────────────────────────────┐
│ Created                                                  │
│ ┃                                                        │
│ ┃  Plan Phase [Collapsible]                             │
│ ┃  ├─ Terraform Plan                                    │
│ ┃  ├─ Summary Cards (Total Changes, To Add, etc.)       │
│ ┃  └─ Resource Changes List                             │
│ ┃                                                        │
│ ┃  [Apply Plan] [Discard Plan] ← Buttons appear here    │
│ ┃                                                        │
│ ┃  Apply Phase [Collapsible] (when applicable)          │
│ ┃  ├─ Staged Resources                                  │
│ ┃  ├─ Real-time Resource Updates                        │
│ ┃  └─ Apply Summary                                     │
│ ┃                                                        │
│ Completed                                                │
└─────────────────────────────────────────────────────────┘
```

**Key Features:**
- **Vertical Timeline**: Timeline runs vertically down the left side, connecting phases
- **Phase Sections**: Each phase (Plan, Apply) is a collapsible section
- **Action Buttons**: Apply and Discard buttons appear between Plan and Apply phases
- **Progressive Disclosure**: Apply phase only appears when applicable (after Apply button clicked)

### Component Redesign

#### 1. Vertical Timeline Component
**New Component**: `VerticalRunTimeline`

**Structure:**
- Vertical line running down the left side
- Timeline nodes at key points:
  - **Created**: Top of timeline (always visible)
  - **Plan Phase**: When plan starts/completes
  - **Apply Phase**: When apply starts (if applicable)
  - **Completed**: Bottom of timeline (when run completes)

**Visual Design:**
- Vertical line: 2px solid, muted color
- Timeline nodes: Circular icons (clock, checkmark, spinner) connected to line
- Active phase: Highlighted with colored line segment
- Completed phases: Muted colors
- Current phase: Animated spinner or colored highlight

**Implementation:**
```tsx
<VerticalRunTimeline>
  <TimelineNode status="created" timestamp={run.created_at} />
  <TimelineNode status="planning" timestamp={run.started_at} />
  <TimelineNode status="planned" timestamp={run.planned_at} />
  {run.status === 'applying' && (
    <TimelineNode status="applying" timestamp={run.applying_at} />
  )}
  {run.status === 'applied' && (
    <TimelineNode status="applied" timestamp={run.applied_at} />
  )}
</VerticalRunTimeline>
```

#### 2. Collapsible Phase Sections
**Component**: Enhanced `OutputViewer` with collapsible wrapper

**Features:**
- Collapse/expand button in section header
- Default state: Expanded for active phase, collapsed for completed phases
- Smooth animation on expand/collapse
- Icon indicator (chevron) showing state

**Implementation:**
```tsx
<CollapsibleSection
  title="Plan Phase"
  defaultExpanded={run.status === 'planning' || run.status === 'planned'}
  collapsible={run.status !== 'planning'}
>
  <OutputViewer data={planOutput} />
</CollapsibleSection>
```

#### 3. Action Buttons Placement
**Location**: Between Plan Phase and Apply Phase sections

**Behavior:**
- Only visible when plan phase is completed (`status === 'planned'`)
- Positioned after Plan Phase section, before Apply Phase section
- Auto-scroll: When plan completes, page scrolls to show buttons
- Sticky positioning: Buttons remain visible while scrolling (optional enhancement)

**Layout:**
```
[Plan Phase Section - Collapsed/Expanded]
┌─────────────────────────────────────────┐
│  [Apply Plan] [Discard Plan]           │
└─────────────────────────────────────────┘
[Apply Phase Section - when applicable]
```

#### 4. Header Metadata Reorganization
**Current:**
- Title: "Plan and Apply"
- Status badge + time ago
- "Triggered via UI"
- Terraform version shown in Plan Phase section

**New:**
- Title: "Plan and Apply"
- Status badge + time ago
- "Triggered via UI • Terraform 1.13.0" (single line, version moved here)

### User Flow

#### Initial State (Run Created)
1. User sees header with run title and status
2. Vertical timeline shows "Created" node
3. Plan Phase section visible (if plan has started) or loading state
4. No action buttons yet

#### Plan Phase Active
1. Timeline extends down, shows "Planning" node
2. Plan Phase section expanded, showing plan output
3. Action buttons appear below Plan Phase when plan completes
4. Page auto-scrolls to show buttons (smooth scroll)

#### Apply Phase Triggered
1. User clicks "Apply Plan" button
2. Timeline extends further, shows "Applying" node
3. Apply Phase section appears below buttons
4. Page auto-scrolls to Apply Phase section
5. Real-time resource updates visible in Apply Phase

#### Run Completed
1. Timeline extends to bottom, shows "Completed" node
2. All phases visible (can be collapsed)
3. Action buttons hidden (no longer applicable)
4. Final summary visible

### Implementation Plan

#### Phase 1: Header Reorganization
1. ✅ Move Terraform version to header (next to RunSourceDisplay)
2. ✅ Update RunSourceDisplay to include version or add version badge separately
3. ✅ Remove horizontal timeline from header
4. ✅ Test header layout on different screen sizes

#### Phase 2: Vertical Timeline Component
1. ✅ Create `VerticalRunTimeline` component
2. ✅ Implement timeline nodes with status icons
3. ✅ Add vertical line connecting nodes
4. ✅ Handle different run statuses and phases
5. ✅ Add animations for active phases
6. ✅ Test timeline appearance for all run types

#### Phase 3: Collapsible Sections
1. ✅ Create `CollapsibleSection` wrapper component
2. ✅ Add collapse/expand functionality
3. ✅ Implement smooth animations
4. ✅ Set default expanded state based on run status
5. ✅ Add chevron icon indicator
6. ✅ Apply to Plan Phase section
7. ✅ Apply to Apply Phase section

#### Phase 4: Action Buttons Repositioning
1. ✅ Move Apply and Discard buttons from header to between phases
2. ✅ Show buttons only when plan is completed
3. ✅ Implement auto-scroll to buttons when plan completes
4. ✅ Test button visibility and positioning
5. ✅ Ensure buttons are accessible and visible

#### Phase 5: Progressive Disclosure
1. ✅ Ensure Apply Phase only shows when applicable
2. ✅ Implement smooth scroll to Apply Phase when it appears
3. ✅ Test full user flow from creation to completion
4. ✅ Verify timeline updates correctly as run progresses

#### Phase 6: Polish & Testing
1. ✅ Test on different screen sizes (mobile, tablet, desktop)
2. ✅ Verify accessibility (keyboard navigation, screen readers)
3. ✅ Test with different run types (plan-only, plan-and-apply, destroy)
4. ✅ Verify real-time updates work correctly
5. ✅ Test collapsible sections behavior
6. ✅ Verify timeline visual continuity

### Technical Considerations

#### State Management
- Use React state for collapsible section expanded/collapsed state
- Persist collapse state in localStorage (optional enhancement)
- Track scroll position for auto-scroll behavior

#### Performance
- Lazy load Apply Phase section until needed
- Optimize timeline rendering for long-running runs
- Debounce scroll events if implementing sticky buttons

#### Accessibility
- Ensure timeline is keyboard navigable
- Add ARIA labels for collapsible sections
- Ensure action buttons are focusable and have proper labels
- Test with screen readers

#### Responsive Design
- Timeline adapts to mobile (may need horizontal layout on small screens)
- Collapsible sections work on touch devices
- Action buttons remain accessible on all screen sizes

### Visual Mockup (Text-Based)

```
┌─────────────────────────────────────────────────────────┐
│ mike / workspace-name / Run abc12345                     │
├─────────────────────────────────────────────────────────┤
│ [🎯] Plan and Apply                                      │
│      [Planned] 1m ago                                    │
│      Triggered via UI • Terraform 1.13.0                │
├─────────────────────────────────────────────────────────┤
│ ● Created                                                │
│ │  20:37:57 Nov 25, 2025                                │
│ │                                                        │
│ │  ▼ Plan Phase                                         │
│ │  ├─ Terraform Plan                                    │
│ │  ├─ [10 Total Changes] [+ 10 To Add]                │
│ │  └─ Resource Changes (10)                            │
│ │                                                        │
│ │  [Apply Plan] [Discard Plan]                         │
│ │                                                        │
│ ○ Planned                                                │
│   20:37:58                                               │
└─────────────────────────────────────────────────────────┘
```

### Success Criteria
1. ✅ Terraform version moved to header next to source
2. ✅ Vertical timeline replaces horizontal timeline
3. ✅ Plan Phase section is collapsible
4. ✅ Apply Phase section is collapsible
5. ✅ Action buttons appear between Plan and Apply phases
6. ✅ Timeline visually connects all phases
7. ✅ Smooth auto-scroll to relevant sections
8. ✅ Progressive disclosure works correctly
9. ✅ Experience feels like a "time lapse" journey through the run

---

## Changelog

### 2025-01-XX: Frontend UI Improvements

#### Run Status Bar Fixes
Updated the workspace list status bar to correctly map TFE-style run statuses:

| Backend Status | Status Bar Category | Description |
|----------------|---------------------|-------------|
| `pending` | On Hold | Waiting to start |
| `planning` | Running | Plan is executing |
| `planned` | On Hold | Plan completed, waiting for apply confirmation |
| `applying` | Running | Apply is executing |
| `applied` | Success | Run completed successfully |
| `errored` | Errored / Needs Attention | Run failed |
| `canceled` | Needs Attention | Run was cancelled |

The status bar now properly counts:
- **Needs Attention**: `errored`, `canceled`, `failed` (legacy)
- **Errored**: `errored`, `failed` (legacy)
- **Running**: `planning`, `applying`, `running` (legacy)
- **On Hold**: `pending`, `planned` (waiting for apply confirmation)
- **Success**: `applied`, `completed` (legacy)

Files changed:
- `frontend/src/pages/Workspaces.tsx` - Updated status counting and filtering logic

#### Start a New Run Dialog Improvements
Redesigned the "Start a new run" dialog for better UX:

- More compact dialog width (`sm:max-w-md`)
- Clearer button layout with icon + label + description in a column format
- Shorter, more concise descriptions:
  - "Plan & Apply" → "Plan changes, then confirm to apply"
  - "Plan Only" → "Preview changes without applying"  
  - "Destroy" → "Remove all managed resources"
- Better visual hierarchy with proper spacing and font weights

Files changed:
- `frontend/src/pages/WorkspaceDetail.tsx` - Updated dialog UI

#### Auto-Fill Workspace Name from Repository
When creating a workspace from VCS, the workspace name field is now automatically populated with the repository name when a repository is selected.

- Extracts repo name from full name (e.g., `owner/my-terraform-repo` → `my-terraform-repo`)
- Only auto-fills if the name field is empty (doesn't override user input)

Files changed:
- `frontend/src/components/workspace/CreateWorkspaceDialog.tsx` - Added useEffect for auto-fill

#### HMR Error Resilience
Improved `useOrganization` hook to handle Hot Module Replacement (HMR) scenarios gracefully:

- Detects HMR environment by checking for Vite plugin indicators
- Returns a safe fallback (loading state) during HMR instead of throwing an error
- Prevents "useOrganization must be used within an OrganizationProvider" crashes during development

Files changed:
- `frontend/src/contexts/OrganizationContext.tsx` - Added HMR-safe fallback
