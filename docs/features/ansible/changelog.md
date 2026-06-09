---
description: "Version history and changelog for the Ansible integration"
covers:
  - "backend/cmd/ansible-runner/**"
  - "core/services/ansible/**"
  - "frontend/src/pages/Ansible/**"
---

# Changelog

### Fixed
- **List pagination across all Ansible pages**: The Playbooks, Job Templates, Jobs (and queue), Credentials, Schedules, and inventory Sources lists all loaded only the first server page of 20 rows with no pager — so beyond 20 items, the rest were silently hidden and the page's search/filter only saw the loaded 20. Each now loads every page and windows the rendered rows with a pager (and the job-template/schedule create-form dropdowns load all options). Extracted the shared `fetchAllPages` helper (`frontend/src/lib/pagination.ts`) and `Pager` component (`frontend/src/components/ui/pager.tsx`), and migrated the inventory pages onto them. See `frontend/src/pages/Ansible/**` and `frontend/src/api/ansible.ts`.

### Changed
- **Inventory UI — compact header & list pagination**: The inventory detail header's four stat cards and the separate tab row (which duplicated the Hosts/Groups counts) were consolidated into a single slim bar — the Hosts/Groups/Content/Sources tabs now carry the counts with a subtle active highlight, Type and Last Sync render as inline info, and the contextual Add action moved into the bar. The inventories list page now loads **all** inventories (it previously showed only the first server page of 20, stranding newly-created ones) and windows them with a pager, fetching host/group counts only for the visible page. See `frontend/src/pages/Ansible/InventoryDetail.tsx`, `frontend/src/pages/Ansible/Inventories.tsx`, and `frontend/src/api/ansible.ts`.

### Fixed
- **Inventory Detail Host/Group Counts & Membership**: The inventory detail page previously loaded only the first server page (20) of hosts and groups, so the Hosts/Groups stat cards and tab labels under-reported the real totals, the remaining hosts were unreachable (no pager), and group membership was understated because it was intersected against only the loaded host page. The page now walks every page to assemble the complete host/group sets, sources the counts from the pagination `total-count`, resolves group membership against all loaded hosts, and windows the Hosts/Groups tabs with a client-side pager. See `frontend/src/pages/Ansible/InventoryDetail.tsx` and `frontend/src/api/ansible.ts`.
- **Job Template Relationship Updates**: Fixed an issue where updating a job template's credential or inventory relationship would not persist to the database. GORM's `Updates()` method was using preloaded relationship data instead of the field values when updating foreign keys. The fix uses a fresh model instance with `Omit()` to exclude relationships, ensuring GORM uses the field values from the updates map. See `backend/internal/repository/ansible_playbook.go:AnsibleJobTemplateRepository.Update()`.

### Planned
- WebSocket real-time updates (optional enhancement)
- Workflow templates
- Org-level collection management

---

## December 15, 2025 (v3)

### Output/Events Tab Fix ✅

**Fixed job detail Output and Events tabs:**

- **Output tab**: Now shows raw JSONL stream as it comes from Ansible (the actual JSON lines)
- **Events tab**: Shows parsed task details with host-level output
- Backend stores raw JSONL in `Stdout` field for Output display
- Backend stores parsed task output in `EventData._parsed_output` for Events display
- Frontend extracts `_parsed_output` from event data for detailed task view

**Code Changes:**
- `backend/cmd/ansible-runner/main.go`:
  - Modified `parseAndStoreJSONLEvent()` to accept raw line parameter
  - Store raw JSONL line in `Stdout` field
  - Store parsed output in `eventData["_parsed_output"]`
- `frontend/src/pages/Ansible/JobDetail.tsx`:
  - Events tab now reads `event.event_data._parsed_output` for task output

### Collection Caching ✅

**Implemented persistent Galaxy collection cache to avoid re-downloads:**

- Cache directory: `/home/iac/galaxy-cache/collections` and `/home/iac/galaxy-cache/roles`
- Collections persist between job runs
- `ANSIBLE_COLLECTIONS_PATH` and `ANSIBLE_ROLES_PATH` env vars set at playbook execution
- Cache directory created in Dockerfile

**Code Changes:**
- `backend/cmd/ansible-runner/main.go`:
  - Updated `installGalaxyRequirements()` to use cache directory
  - Added `ANSIBLE_COLLECTIONS_PATH` and `ANSIBLE_ROLES_PATH` to playbook env
- `runner-images/ansible/Dockerfile`:
  - Added creation of `/home/iac/galaxy-cache/{collections,roles}`

### Collection Version Pinning (Model) ✅

**Added support for pinning collection versions in Job Templates:**

- New `GalaxyRequirements` field on `AnsibleJobTemplate` model
- Format: `{"collections": [{"name": "amazon.aws", "version": ">=6.0.0"}], "roles": [...]}`
- UI wiring to be added in future iteration

**Code Changes:**
- `backend/internal/models/ansible_playbook.go`:
  - Added `GalaxyRequirements InventoryVariables` field to `AnsibleJobTemplate`

### Collections UI ✅

**Added Galaxy Collections page showing pre-installed collections:**

- New `/app/:orgName/ansible/collections` route
- Shows 7 pre-installed collections (amazon.aws, azure.azcollection, etc.)
- Search/filter functionality
- Info banner explaining `requirements.yml` auto-install
- Links to Galaxy Hub for each collection

**Code Changes:**
- `backend/internal/api/v2/handlers/ansible/collections.go` (NEW)
- `backend/internal/api/v2/routes/ansible_routes.go` - added collection routes
- `frontend/src/pages/Ansible/Collections.tsx` (NEW)
- `frontend/src/api/ansible.ts` - added `ansibleCollectionsApi`
- `frontend/src/components/layout/Sidebar.tsx` - added Collections nav link

---

## December 15, 2025 (v2)

### Galaxy Auto-Install ✅

**Implemented automatic Galaxy collection/role installation from requirements.yml:**

- Auto-detects `requirements.yml` in: repo root, `collections/`, `roles/`
- Runs `ansible-galaxy collection install` before playbook execution
- Runs `ansible-galaxy role install` for any roles specified
- Creates job events to track installation progress:
  - "Installing Galaxy Requirements" - at job start
  - "Galaxy Requirements Installed" - on success
  - "Galaxy Installation Failed" - on error (job continues)

**Code Changes:**
- `backend/cmd/ansible-runner/main.go`:
  - Added `installGalaxyRequirements()` function
  - Called after `preparePlaybook()` before inventory generation

### Slimmed Runner Image ✅

**Reduced pre-installed collections from 50+ to 7 essentials:**

- `amazon.aws` - AWS dynamic inventory
- `azure.azcollection` - Azure dynamic inventory
- `google.cloud` - GCP dynamic inventory
- `community.vmware` - VMware support
- `community.general` - Essential utilities
- `ansible.posix` - JSONL callback (required)
- `ansible.netcommon` - Network automation base

Any additional collections should be specified in `requirements.yml`.

### Frontend Live Updates Fix ✅

**Fixed auto-refresh and improved event display:**

- Events now refresh during polling (not just output when on Output tab)
- Events grouped by task (not duplicate entries per host)
- Output tab is now default (with spinner when running)
- Events tab shows aggregated task status with host counts
- Failed task output expanded automatically

**Code Changes:**
- `frontend/src/pages/Ansible/JobDetail.tsx`:
  - Added `GroupedTask` interface for task grouping
  - Modified polling to always fetch events AND output
  - Changed default tab to "output"
  - Added spinner to Output tab during running jobs

---

## December 15, 2025

### Live Output Streaming ✅

**Implemented JSONL callback for live job output streaming:**

- Changed `ANSIBLE_STDOUT_CALLBACK` from `json` to `ansible.posix.jsonl`
- Events now stream line-by-line as tasks execute (not buffered until completion)
- Frontend polling (3 seconds) automatically shows live events
- Stats update incrementally during job execution

**Code Changes:**
- `backend/cmd/ansible-runner/main.go`:
  - Replaced `io.ReadAll` with `bufio.Scanner` for line-by-line processing
  - Added `parseAndStoreJSONLEvent()` for JSONL event parsing
  - Removed old `parseAndStoreJSONOutput()` and `parseJobStats()` functions
  - Stats counters are now atomic and updated during streaming

### Documentation Migration ✅

**Migrated from monolithic design doc to organized documentation suite:**

- Archived `ansible-integration-design.md` to `docs/archive/ansible-integration-design-v1.md`
- Created focused documentation files in `docs/ansible/`:
  - `README.md` - Index with feature status and code locations
  - `overview.md` - Architecture overview with code references
  - `architecture.md` - Data models, services, API layer (reference-focused)
  - `runner.md` - Runner implementation details
  - `live-output.md` - JSONL streaming implementation guide
  - `galaxy-collections.md` - **NEW** - Ansible Galaxy collection support
  - `implementation-status.md` - Phase tracking and feature checklist
  - `roadmap.md` - Future development plans with priorities
  - `api-reference.md` - REST API documentation
  - `changelog.md` - This file

**Documentation principles:**
- Reference code locations instead of duplicating code
- Keep each document focused on one topic
- Link to actual source files for implementation details

### Ansible Galaxy Documentation ✅

**Created comprehensive Galaxy documentation:**

- Listed 50+ pre-installed collections in runner image
- Documented how to use collections in playbooks (FQCN)
- Explained `requirements.yml` support (planned auto-install)
- Added instructions for adding collections to Dockerfile
- Documented private collection support

---

## December 2025

### Phase 1.9 - Event Type Fix & Enhanced Warnings ✅

**Fixed**:
- Event type attribute naming (`event-type` vs `event`)
- Test playbook permission error (missing `become: true`)

**Added**:
- Individual warning parsing from event output
- AWX-style status indicators with colored icons and badges
- "Changed" option to status filter dropdown

### Phase 1.8 - Schedules API & Compact Job UI ✅

**Fixed**:
- Schedules API organization ID resolution
- Credential deletion foreign key constraint handling
- Job template deletion cascade (deletes jobs and schedules)

**Added**:
- Compact job detail page layout
- Inline stats bar with icons
- Collapsible warnings banner
- Searchable output panel
- Filterable events with host/status dropdowns
- Event count badge on tab

### Phase 1.7 - Job Event Parsing & UI ✅

**Fixed**:
- JSON callback output parsing (now handles complete JSON object)
- Working directory for playbooks (uses playbook directory, not repo root)
- Encryption key mismatch between API and runner

**Added**:
- Proper event structure with play/task/host information
- Status badges for events (OK, FAILED, UNREACHABLE, SKIPPED)
- Separate warnings display with yellow styling
- Server icon badge for hosts

### Phase 1.6 - UX Improvements & Bug Fixes ✅

**Fixed**:
- Connection status badge dismissal on user interaction
- Inventory JSON format (hosts as dict, not array)
- Improved error capture in Ansible runner

**Added**:
- Clickable job template cards
- Playbook file content viewer with syntax highlighting
- Auto-generated playbook names from VCS fields
- Auto-fill inventory host names
- Error message display in job output

### Dynamic Inventory UI/UX Improvements

**Fixed**:
- Inventory sources API endpoint path parameters
- Radix UI select empty value error

**Added**:
- Inventory type descriptions with icons
- Auto-open source configuration for new dynamic inventories
- Info banner for dynamic inventories explaining host management
- Hidden "Add Host" button for dynamic inventories
- Colored status icons in schedules page
- Job template cascade delete (removes jobs and schedules)
- Clickable playbook/inventory links in job detail

---

## Phase 2.5 - Usability Improvements ✅

### Playbook Detail Page
- YAML syntax highlighting with line numbers
- Copy button and word wrap toggle
- Job templates tab
- Recent jobs tab
- VCS sync button with status display

### Job Template Detail Page
- Configuration display with all settings
- Linked playbook and inventory references
- Launch form with variable overrides
- Recent job history with status badges

### Launch Job from UI
- Extra variables input (JSON)
- Limit/Tags/Skip-tags options
- Launch from template detail page

### List Page Create Dialogs
- Create playbook dialog with VCS connection selector
- Create job template dialog with resource selectors
- Updated empty state messages

### Navigation Improvements
- "All Organizations" link in org-scoped sidebar
- "Organizations" link in global sidebar

---

## Phase 1.5 - VCS Sync Implementation ✅

### Backend
- Added `PlaybookSyncMessage` and `InventorySyncMessage` structs
- Dedicated sync worker on `ansible_sync` queue
- Repository cloning with VCS access tokens
- Playbook file verification
- VCS inventory file parsing via ansible-inventory
- Commit SHA tracking
- Auto-sync on inventory creation
- Webhook-triggered sync on push events (for matching branch)

### Frontend
- Enhanced sync button with status display
- Status card with sync info (time, commit, errors)
- Auto-refresh on sync status change
- GitHub commit links
- VCS inventory sync button and status

---

## Phase 1 - Core Infrastructure ✅

### Data Models
- `AnsibleInventory` with hosts and groups
- `AnsiblePlaybook` with VCS configuration
- `AnsibleJobTemplate` for reusable configurations
- `AnsibleJob` with events and stats
- `AnsibleCredential` with encrypted storage

### API Endpoints
- Full CRUD for inventories, hosts, groups
- Full CRUD for credentials (multiple types)
- Full CRUD for playbooks and job templates
- Job launch, cancel, relaunch
- Job events and output retrieval

### Services
- Credential encryption with AES-256-GCM
- Inventory generation (INI, JSON, YAML formats)
- Job queue integration
- Scheduler service for cron-based execution
- Inventory source service for dynamic inventories

### Runner
- Job queue processing
- Playbook execution via `ansible-playbook`
- JSON callback for structured output
- Credential handling (SSH, cloud providers)
- VCS sync worker

### Frontend
- Inventories list and detail pages
- Credentials management with type-specific forms
- Playbooks list with VCS sync
- Job templates management
- Jobs list and detail pages
- Schedules management with cron builder
### Fixed (Dec 2025)
- [x] Token persistence across browser sessions - Changed from sessionStorage to localStorage
- [x] OrganizationContext now waits for auth before fetching organizations
- [x] Sidebar organized into sections: Terraform (Workspaces/Registry), Ansible, Core (Projects/Usage/Settings)
- [x] Better error handling when org access is denied - Shows friendly error page with retry, org list, and sign-out options
- [x] Handle token refresh/expiry gracefully - Added automatic token refresh using refresh_token grant
