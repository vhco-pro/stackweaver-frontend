---
description: "Version history and changelog for the Ansible integration"
covers:
  - "backend/cmd/ansible-runner/**"
  - "core/services/ansible/**"
  - "frontend/src/pages/Ansible/**"
---

# Changelog

### Added
- **Sliced launches read as one run**: opening any slice of a job launched with slicing now shows the whole fleet - every slice's hosts in one grid, one set of totals, one timeline and one stream - with a chip per slice showing its host count and worst result. Each slice is a separate `ansible-playbook` invocation, so the same task carries a different id in each; they are matched on task name and source file so the fan-out collapses back into the columns it started from. Opening a cell belonging to another slice fetches that slice's event. See `frontend/src/pages/Ansible/run-viewer/slices.ts`.
- **Raw output, back in the Stream lane**: the Stream pivot has a **Raw** toggle that swaps the synthesized lines for the runner's own output verbatim, one line per event. Unlike the Output tab it replaces, it is virtualized, obeys the status filters, and highlights search matches, so a fleet-sized run stays usable; for a run large enough to load in the summary projection the toggle is disabled, since that projection omits stdout by design. Individual raw events are still one click away in the default line view.
- **Live run polish**: while a job runs, its cells now appear with a brief animation as each host reports, and the run header carries a ticking elapsed clock. Both respect `prefers-reduced-motion`, and neither animates on a finished job.
- **Server-side event filtering and a summary projection**: `GET /ansible/jobs/:id/events` now answers `filter[host]`, `filter[status]` (ok, changed, failed, unreachable, skipped), `filter[task]` and `filter[counter]`, each composing with `after` and with pagination, and `meta.pagination.total-count` describes the filtered stream. `fields[events]=summary` returns a reduced event - no stdout or stderr, no gathered facts, module arguments, loop results or diffs, and a message truncated to 200 characters - which is roughly a third of the payload on a fact-gathering event. The web UI switches to that projection by itself above 5,000 events and fetches individual events in full as you open them, so a several-hundred-host run loads without pulling megabytes of module output. See `docs/features/ansible/api-reference.md` and `core/repository/ansible_job.go`.

### Fixed
- **Job events now record which host they belong to**: the `ansible.posix.jsonl` callback never emits `host`, `changed`, `failed` or `skipped` at the top level of a result line - they live inside the per-host result - so both ingest paths (the platform runner and the self-hosted agent endpoint) left those columns empty and stored nearly every row as `runner_on_ok`, with a timestamp of `0001-01-01`. Both now read the host result, so the columns say what the row actually is and can answer filtered queries directly; events written before this fix are still matched correctly through a fallback that reads the stored event data. The runner's synthetic events (playbook source, Galaxy install) also take their counter from the job's own sequence instead of a hardcoded 0/1/2, which used to collide with the playbook's own counters and made `?after=<counter>` ambiguous for a polling client. See `core/services/ansible/event_ingest.go`.

### Added
- **Fleet Run Viewer (Run tab)**: The job detail page opens on a new **Run** tab that pivots the job's event stream into a host-by-task matrix - one row per host, one column per task, and one glyph per result (ok, changed, failed, unreachable, skipped, or did not run). A whole fleet run fits on one screen, so a single failed host inside an otherwise green task is visible without scrolling or expanding anything, and each column header carries the task's duration and its per-status host counts. Status is always carried by a glyph as well as a colour, and rows virtualize above sixty hosts so large fleets stay fast. The live poll behind all of this moved onto React Query, which also stops the page re-fetching the playbook and inventory on every three-second tick. See `frontend/src/pages/Ansible/run-viewer/` and `frontend/src/pages/Ansible/JobDetail.tsx`.
- **One pane of glass for a run**: The Run tab now carries two more pivots over the same model - a **Timeline** that puts every task on the job clock (so "where did the time go" is one glance) and a **Stream** that renders the run as chronological terminal-style lines, each expandable to its raw event. Status tiles double as filters and a single search box matches host names, task names, and the entire module result, so a phrase that only appears deep inside a module's return value still finds the host that hit it; the filters apply to all three pivots at once. Clicking any cell, host, or task column opens a detail drawer with the module, source file and line, return code, attempts, message, stdout, stderr, a rendered diff, gathered facts, warnings, and the raw event JSON. Anything the viewer cannot structure - galaxy installs, runner stderr, ad-hoc output - shows in the stream verbatim rather than being dropped, and every JSON payload is syntax-coloured the same way the state and plan viewers colour theirs. Matrix columns can be dragged wider when a task name is too long to read in place (double-click a column edge to put it back). **The Output and Events tabs are removed**; Details and Host Facts are unchanged, the job's own failure message moved to a banner above the tabs, and copying the raw output is now a button in the Run tab's filter bar. See `frontend/src/pages/Ansible/run-viewer/`.

### Security
- **Ansible runner hardening**: The platform ansible runner now isolates and cleans up the sensitive material a job touches. Each job's scratch directory (which briefly holds SSH keys, vault passwords, and inventory secrets) is an ephemeral per-job directory removed on completion, on a volume isolated from the terraform runner so neither can read the other's staged credentials. The per-project Ansible Galaxy cache lives on its own dedicated volume, is namespaced per project, and is evicted by a background janitor once idle past a configurable TTL (`GALAXY_CACHE_TTL_DAYS`). The container drops all Linux capabilities, forbids privilege escalation, and runs under the default seccomp profile, on top of the existing read-only root filesystem and non-root user. Credential encryption is now enforced: the runner refuses to start with a missing or all-zero encryption key instead of silently using a publicly known one. See the [Kubernetes self-hosting guide](../../get-started/self-hosting/kubernetes/README.md#runner-security-and-isolation) and `backend/cmd/ansible-runner/main.go`.

### Added
- **Force delete inventories**: Deleting an inventory that is still referenced (job templates, jobs, sources) is rejected with a clear dependency message; the delete dialog then offers **Force Delete Everything**, which cascades over every dependent resource - templates and their schedules, credential/variable links, notification attachments, and workflow nodes; jobs and their events; and inventory sources - in one transaction. Constructed inventories using it as an input lose that input but are kept. Force delete requires organization-level Ansible management permission (`DELETE …/inventories/:id?force=true`). See `core/repository/ansible_inventory.go` and `backend/internal/api/v2/handlers/ansible/inventories.go`.

### Changed
- **Sync warnings moved to the Syncs tab**: A successful sync that printed stderr warnings no longer renders a full-width banner in the Hosts view. The sync status icon in the inventory tab bar turns amber (the host count still shows, so it is clearly a success), and clicking it opens the Syncs tab with the warning text at the top. See `frontend/src/pages/Ansible/InventoryDetail.tsx`.

### Added
- **Job template lifecycle controls**: Job templates gained an enable/disable toggle (disabled templates refuse every launch path - UI, API, schedules, callbacks - with 409), a per-job **timeout** (seconds; both runner paths kill the run and mark it failed when exceeded), **allow simultaneous** (without it, concurrent launches of the same template are held and released in order once the active run finishes), and per-template **retention days** overriding the new organization-wide job retention setting (Settings → Ansible; finished jobs and their events are cleaned up daily, the most recent job of each template is always kept). Verbosity now goes up to 5 (`-vvvvv`). See `core/models/ansible_playbook.go`, `core/services/ansible/job.go`, and `core/repository/ansible_job.go`.
- **Multiple credentials per job template**: Templates now carry a credential set (AWX semantics: at most one credential per type, plus any number of vault credentials with distinct vault IDs). Machine SSH, become, cloud, and multi-vault (`--vault-id label@file`) credentials are all injected together on both runner paths. The template detail page gained a Credentials card for attaching and detaching. See `backend/internal/api/v2/handlers/ansible/template_credentials.go` and `backend/cmd/ansible-runner/main.go`.
- **Azure workload identity for playbook runs**: Jobs now receive the organization's Azure OIDC federation environment (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_FEDERATED_TOKEN_FILE`, plus `ARM_*` aliases) like inventory syncs already did, so playbooks can authenticate to Azure - including reading Key Vault secrets - without stored credentials. See the [Azure Key Vault from playbooks](../../user-guides/azure-key-vault-from-playbooks.md) guide.
- **Workflow execution engine**: Workflows now actually run: launching one snapshots the graph, starts the root nodes, and the scheduler tick advances execution along `on_success` / `on_failure` / `always` edges, with convergence control (any-parent vs all-parents), approval nodes (approve/deny with optional timeout that denies), and inventory-source sync nodes. Workflow runs are visible per workflow (Launch / View Runs), and pending approvals can be decided from the run dialog. Workflows can also be scheduled (new `workflow` schedule type). See `core/services/ansible/workflow_engine.go`.
- **Job slicing**: Templates with `job_slice_count` > 1 fan a launch out into N sliced jobs, each running against a deterministic slice of the inventory (hosts sorted and distributed round-robin); slices run simultaneously and are grouped by a slice group ID. See `core/services/ansible/inventory_slice.go`.
- **Notifications (webhook, email, Microsoft Teams)**: Organization-level notification channels can be attached to job templates and workflows with per-trigger flags (started / success / failure). Delivery is crash-safe - a scheduler tick polls for unnotified state transitions, so notifications fire regardless of which runner executed the job. Channels support test-send from the template's Notifications card, where they can also be created inline (including full SMTP settings - host, port, from/to addresses, and credentials - for email channels). See `core/services/ansible/notifications.go`.
- **Incremental job output polling**: While a job runs, the detail page fetches only the events newer than the last one it has (`?after=<counter>` on the events endpoint) and appends them, instead of re-downloading the full event history and output every few seconds - long playbook runs stay cheap for the browser and the API. See `backend/internal/api/v2/handlers/ansible/jobs.go` and `frontend/src/pages/Ansible/JobDetail.tsx`.
- **Live-tail sync output**: While a dynamic source sync or constructed inventory build runs, the runner flushes its output to the sync-history row every couple of seconds, and the output dialog polls running syncs - so long cloud queries (especially at higher verbosity) can be tailed live instead of appearing only at completion. See `core/services/ansible/sync_tail.go`.
- **Execution flows documentation**: New [Execution Flows](execution-flows.md) page with diagrams of the job lifecycle and launch gates, the platform runner vs self-hosted agent paths, inventory sync flows, the workflow engine, ad hoc commands, webhook triggers, and the scheduler tick.
- **SCM webhook launches**: Job templates gained a "Launch on push" toggle - when the playbook's VCS repository receives a push (GitHub or Azure DevOps), every enabled template that opted in launches automatically, with full variable-set merging and the update-on-launch gates, right after the playbook sync is queued. Pair it with the playbook's `fresh` source mode so the job always runs the pushed commit (cached mode may race the snapshot sync). See `backend/internal/api/v2/handlers/vcs_app_installation.go`.
- **Provisioning callbacks**: Templates can allow AWX-style provisioning callbacks: a freshly booted host POSTs the template's host config key to `/api/v2/ansible/job-templates/:id/callback` and gets configured by a job limited to itself (the caller's IP is matched against the template's inventory). See `backend/internal/api/v2/handlers/ansible/callbacks.go`.
- **Template access visibility**: The job template detail page shows which teams can view, edit, and execute the template, derived from organization and project access. See `backend/internal/services/rbac/service.go`.
- **Per-source ownership and overwrite semantics**: Dynamic inventory sources now stamp the hosts and groups they discover, and each source gained **overwrite** (prune hosts/groups the provider no longer reports - strictly scoped to rows owned by that source) and **overwrite variables** (replace host variables wholesale instead of the new default merge, which preserves manual edits to other keys). Multiple sources on one inventory coexist cleanly, each with its own credential or Azure subscription. See `core/services/ansible/inventory_output.go`.
- **Update-on-launch honored**: Launching a job whose inventory has stale update-on-launch sources now syncs them first and holds the job until they settle; `update_cache_timeout` (seconds) skips the pre-launch sync while a previous one is fresh. A stuck sync stops blocking releases after 30 minutes. See `core/services/ansible/job.go`.
- **Inventory sync history with captured output**: Every sync run - manual, scheduled, pre-launch, workflow, webhook - is recorded with status, trigger, host/group counts, duration, and the captured `ansible-inventory` output. Sources gained a sync **verbosity** setting (`-v`…`-vvvv`). The inventory detail page gained a Syncs tab that lists run history and opens the output in a dialog. See `core/models/ansible_inventory_sync.go` and `frontend/src/components/ansible/InventorySyncsCard.tsx`.
- **Ad hoc commands (Run Command)**: Run a single module against an inventory through the normal job pipeline - a transient one-task playbook is generated, so ad hoc runs get streaming output, events, and statistics like any job, on either platform runners or self-hosted agents (pick the runner in the dialog). A host card's terminal icon launches the dialog with the limit prefilled to that host. Allowed modules are an organization setting (defaulting to AWX's list) enforced server-side, and a dedicated permission (`ansible:adhoc:execute`) gates the endpoint. See `backend/internal/api/v2/handlers/ansible/adhoc.go`.
- **Constructed inventories**: A new inventory type that combines N ordered input inventories and derives groups and variables through `ansible.builtin.constructed` rules (`compose`, `groups`, `keyed_groups`), with an optional limit. Constructed inventories rebuild from their inputs before every launch (bounded by a cache timeout) and on demand via the Rebuild button; builds are recorded in the Syncs tab. Inputs must belong to the same organization, cannot themselves be constructed, and cannot be deleted while in use. See `backend/cmd/ansible-runner/main.go` and `frontend/src/pages/Ansible/Inventories.tsx`.

### Fixed
- **Agent pool organization boundary**: Job template create and update (and the ad hoc Run Command) now verify that a referenced agent pool belongs to the same organization as the template's project (or the command's inventory), rejecting foreign pool IDs with 400. Previously only the UUID format was checked, so a template could route every launch - manual, scheduled, webhook, workflow - onto another organization's self-hosted runners. See `backend/internal/api/v2/handlers/ansible/playbooks.go` and `adhoc.go`.

### Added
- **Playbook discovery: bulk import and repository browser**: Playbooks no longer have to be registered one by one. The Playbooks page gained an "Import from repository" wizard that scans a connected repository (GitHub via the Git Trees API - one API call instead of one per directory - or Azure DevOps), lists every playbook candidate with already-registered files annotated, and registers the checked files in a single idempotent call with per-file results. The job template create and edit forms gained a dual-mode playbook field: the classic registered-playbooks dropdown, or an AWX-style "From repository" browser that picks a file directly and registers it automatically on save (find-or-create - cancelling never creates anything). Discovery hides conventional non-playbook YAML (roles/, group_vars/, inventories/, CI files, …). Job templates can now also change their playbook after creation. Playbook and job template names are now unique **per project** instead of accidentally globally unique (legacy single-column index rebuilt on startup). See `backend/internal/api/v2/handlers/ansible/playbook_discovery.go`, `frontend/src/components/ansible/`, and the [Managing Ansible Playbooks](../../user-guides/managing-ansible-playbooks.md) guide.

### Fixed
- **Dynamic inventory group memberships**: Syncing a dynamic or VCS inventory associated each host with only **one** of its groups - whichever group the sync happened to process first - so groups like `rg_*`, `location_*`, or tag-based `keyed_groups` were missing hosts that clearly belonged to them, and which groups were affected changed from sync to sync. Parent groups whose membership comes only via `children` (for example `keyed_groups` parent groups) were never created at all, and memberships removed at the source were never cleaned up. Inventory syncs now persist every host into every group it belongs to, create children-only groups and flatten their transitive membership (a host in a child group is a member of every ancestor group, with single-parent nesting reflected in the group hierarchy), and remove stale memberships among the synced groups on re-sync - without touching manually created groups. The previously duplicated parsing logic is consolidated into one shared, tested implementation. See `core/services/ansible/inventory_output.go`.

### Added
- **Configurable playbook source (cached snapshot vs fresh)**: A playbook now has a **Source** mode. In `cached` mode (the default) a job runs the last synced snapshot of the playbook and its dependencies, captured to object storage at sync time; the first run with no snapshot yet auto-syncs inline and then runs from it. After that, the playbook keeps running even when its VCS remote is unreachable. In `fresh` mode each run clones the repository at runtime (always latest HEAD). The runner clones using a clone URL the API resolves at enqueue time, so it never needs the VCS provider's OAuth credentials of its own. The create/edit playbook form exposes the selector, and the playbook resource surfaces `source-mode` plus `cached-commit` / `cached-at` / `cached-size-bytes`. A cached run also announces at the top of the job output which snapshot commit it ran and when that commit was captured, so it is obvious the job ran captured-at-sync-time code rather than the remote's current HEAD. See `backend/cmd/ansible-runner/playbook_snapshot.go`, `backend/cmd/ansible-runner/main.go`, `core/services/ansible/job.go`, and `frontend/src/pages/Ansible/Playbooks.tsx`.
- **Inventory host & group search**: The inventory detail page now has a search box (above the Hosts/Groups tabs) that filters hosts by name or hostname and groups by name or member host name. Tab counts show matches as `filtered/total` while a search is active. See `frontend/src/pages/Ansible/InventoryDetail.tsx`.
- **Group membership on host cards**: Each host card now shows the groups it belongs to as badges. Hosts and groups with more members than fit collapse the remainder behind a `+N` badge that expands them inline (host cards reveal all groups; group cards reveal all member hosts). When searching, hosts matching the query are surfaced ahead of the `+N` overflow.

### Fixed
- **List pagination across all Ansible pages**: The Playbooks, Job Templates, Jobs (and queue), Credentials, Schedules, and inventory Sources lists all loaded only the first server page of 20 rows with no pager - so beyond 20 items, the rest were silently hidden and the page's search/filter only saw the loaded 20. Each now loads every page and windows the rendered rows with a pager (and the job-template/schedule create-form dropdowns load all options). Extracted the shared `fetchAllPages` helper (`frontend/src/lib/pagination.ts`) and `Pager` component (`frontend/src/components/ui/pager.tsx`), and migrated the inventory pages onto them. See `frontend/src/pages/Ansible/**` and `frontend/src/api/ansible.ts`.

### Changed
- **Playbooks default to a cached snapshot**: Existing and new VCS-backed playbooks default to the `cached` source mode rather than always cloning fresh at job time. This makes critical playbooks resilient to a VCS outage by default; the first run after the change auto-syncs a snapshot and self-heals. Choose `fresh` on the playbook form to keep the always-latest-HEAD behaviour. See `core/models/ansible_playbook.go` and `frontend/src/pages/Ansible/Playbooks.tsx`.
- **Inventory UI - compact header & list pagination**: The inventory detail header's four stat cards and the separate tab row (which duplicated the Hosts/Groups counts) were consolidated into a single slim bar - the Hosts/Groups/Content/Sources tabs now carry the counts with a subtle active highlight, Type and Last Sync render as inline info, and the contextual Add action moved into the bar. The inventories list page now loads **all** inventories (it previously showed only the first server page of 20, stranding newly-created ones) and windows them with a pager, fetching host/group counts only for the visible page. See `frontend/src/pages/Ansible/InventoryDetail.tsx`, `frontend/src/pages/Ansible/Inventories.tsx`, and `frontend/src/api/ansible.ts`.

### Fixed
- **Inventory Detail Host/Group Counts & Membership**: The inventory detail page previously loaded only the first server page (20) of hosts and groups, so the Hosts/Groups stat cards and tab labels under-reported the real totals, the remaining hosts were unreachable (no pager), and group membership was understated because it was intersected against only the loaded host page. The page now walks every page to assemble the complete host/group sets, sources the counts from the pagination `total-count`, resolves group membership against all loaded hosts, and windows the Hosts/Groups tabs with a client-side pager. See `frontend/src/pages/Ansible/InventoryDetail.tsx` and `frontend/src/api/ansible.ts`.
- **Job Template Relationship Updates**: Fixed an issue where updating a job template's credential or inventory relationship would not persist to the database. GORM's `Updates()` method was using preloaded relationship data instead of the field values when updating foreign keys. The fix uses a fresh model instance with `Omit()` to exclude relationships, ensuring GORM uses the field values from the updates map. See `core/repository/ansible_playbook.go:AnsibleJobTemplateRepository.Update()`.

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
- `core/models/ansible_playbook.go`:
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
