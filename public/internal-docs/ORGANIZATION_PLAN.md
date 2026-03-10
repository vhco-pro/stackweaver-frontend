<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Internal Documentation Organization Plan

This document outlines the proposed structure for organizing internal documentation in `docs/internal/`.

## Current State Analysis

Internal docs are currently scattered across:
- `docs/internal/` (new structure, partially organized)
- `docs/architecture/status/` (status reports)
- `docs/architecture/analysis/` (analysis documents)
- `docs/architecture/auth/*/research/` (research)
- `docs/architecture/auth/*/plans/` (plans)
- `docs/features/*-implementation.md`, `*-research.md`, `*-plan.md`
- `docs/dashboard/IMPLEMENTATION_PLAN.md`, `IMPLEMENTATION_SUMMARY.md`
- `docs/terraform/*-implementation.md`, `*-analysis.md`
- `docs/testing/*` (testing plans/checklists)

## Proposed Structure

Organize by **document type first**, then **topic area**. This makes it easy to find all plans, all analysis, etc., while still allowing topic grouping.

```
docs/internal/
├── README.md                    # Index of internal docs
│
├── plans/                       # Implementation plans
│   ├── features/               # Feature-specific plans
│   │   ├── dashboard/
│   │   ├── terraform/
│   │   ├── ansible/
│   │   └── teams/
│   ├── infrastructure/         # Infrastructure/enhancement plans
│   │   ├── self-hosted-runners/
│   │   └── docs-viewer/
│   └── general/                # Cross-cutting plans
│
├── analysis/                    # Technical analysis documents
│   ├── architecture/           # Architecture analysis
│   ├── api/                    # API design analysis
│   ├── features/               # Feature-specific analysis
│   └── migrations/             # Migration analysis
│
├── research/                    # Research & investigation docs
│   ├── features/               # Feature research
│   ├── architecture/           # Architecture research
│   └── integrations/           # Third-party integration research
│
├── summaries/                   # Implementation summaries & status
│   ├── features/               # Feature implementation summaries
│   ├── phases/                 # Phase completion summaries
│   └── commits/                # Commit summaries
│
├── status/                      # Status reports (sitreps)
│   ├── auth/                   # Authentication status
│   ├── features/               # Feature status
│   └── infrastructure/         # Infrastructure status
│
├── testing/                     # Testing documentation
│   ├── plans/                  # Test plans
│   ├── checklists/             # Verification checklists
│   └── analysis/               # Testing analysis
│
├── guidelines/                  # Internal guidelines (renamed from guide-lines)
│   ├── documentation/          # Documentation standards
│   ├── frontend/               # Frontend guidelines
│   └── backend/                # Backend guidelines
│
└── fixes/                       # Bug fixes & patches
    ├── linting/                # Linting fixes
    └── security/               # Security fixes
```

## Migration Plan

### Phase 1: Move Scattered Files to Internal

**From `architecture/status/`** → `internal/status/auth/` or `internal/status/features/`
- `COMMIT_SUMMARY.md` → `internal/summaries/commits/COMMIT_SUMMARY.md`
- `ISSUES_62_63_STATUS.md` → `internal/status/features/ISSUES_62_63_STATUS.md`
- `STATUS_BADGE_UNIFICATION.md` → `internal/status/features/STATUS_BADGE_UNIFICATION.md`
- `TFE_ENDPOINT_COMPATIBILITY_SITREP.md` → `internal/status/api/TFE_ENDPOINT_COMPATIBILITY_SITREP.md`
- `USER_AUTH_FLOW_SITREP.md` → `internal/status/auth/USER_AUTH_FLOW_SITREP.md`
- `GITHUB_APP_VS_OAUTH-sitrep.md` → `internal/status/auth/GITHUB_APP_VS_OAUTH-sitrep.md`

**From `architecture/analysis/`** → `internal/analysis/architecture/`
- `STATE_PERSISTENCE_ANALYSIS.md` → `internal/analysis/architecture/STATE_PERSISTENCE_ANALYSIS.md`
- `LOG_FETCHING_ROOT_CAUSE.md` → `internal/analysis/architecture/LOG_FETCHING_ROOT_CAUSE.md`
- `LOG_WRITING_ON_CANCELLATION_ANALYSIS.md` → `internal/analysis/architecture/LOG_WRITING_ON_CANCELLATION_ANALYSIS.md`
- `storage-client-analysis.md` → `internal/analysis/architecture/storage-client-analysis.md`
- `TFE_API_VERSIONING_ANALYSIS.md` → `internal/analysis/api/TFE_API_VERSIONING_ANALYSIS.md`
- `VARIABLES_JSONAPI_MIGRATION.md` → `internal/analysis/migrations/VARIABLES_JSONAPI_MIGRATION.md`

**From `architecture/auth/*/research/`** → `internal/research/features/`
- `TEAM_WORKSPACE_ACCESS_RESEARCH.md` → `internal/research/features/team-workspace-access.md`
- `TEAM_PROJECT_ACCESS_RESEARCH.md` → `internal/research/features/team-project-access.md`
- `TEAM_PHASE1_MISSING_FIELDS.md` → `internal/research/features/team-phase1-missing-fields.md`

**From `architecture/auth/*/plans/`** → `internal/plans/features/teams/`
- `SSO_OIDC_TEAM_INTEGRATION_PLAN.md` → `internal/plans/features/teams/sso-oidc-integration.md`

**From `architecture/auth/*/implementation/`** → `internal/summaries/features/teams/`
- `PHASE1_TEAMS_IMPLEMENTATION_STATUS.md` → `internal/summaries/features/teams/phase1-status.md`
- `HANDLER_RBAC_SITREP.md` → `internal/status/features/rbac-handler.md`

**From `dashboard/`** (internal docs)
- `IMPLEMENTATION_PLAN.md` → `internal/plans/features/dashboard/IMPLEMENTATION_PLAN.md`
- `IMPLEMENTATION_SUMMARY.md` → `internal/summaries/features/dashboard/IMPLEMENTATION_SUMMARY.md`
- Keep `README.md` in `dashboard/` (user-facing)

**From `features/`** (internal docs)
- `*-implementation.md` → `internal/summaries/features/` or `internal/status/features/`
- `*-research.md` → `internal/research/features/`
- `*-plan.md` → `internal/plans/features/`
- `*-issue.md` → `internal/fixes/`
- Keep user-facing feature docs in `features/` (like `terraform-streaming.md`)

**From `terraform/`** (internal docs)
- `*-implementation.md` → `internal/summaries/features/terraform/`
- `*-analysis.md` → `internal/analysis/features/terraform/`
- `*-summary.md` → `internal/summaries/features/terraform/`
- Keep user-facing docs (like `Workspaces.md`, `api.md`)

**From `testing/`**
- `*-PLAN.md`, `*-checklist.md` → `internal/testing/plans/` or `internal/testing/checklists/`
- `*-ANALYSIS.md` → `internal/testing/analysis/`
- Keep user-facing testing docs (like `TESTING_API.md`, `manual-tests-rbac.md`)

### Phase 2: Organize Existing Internal Folder

**Current `internal/enhancements/`** → Split into `internal/plans/infrastructure/` and `internal/analysis/`
- `enhancements/plans/docs-viewer-implementation-plan.md` → `internal/plans/infrastructure/docs-viewer.md`
- `enhancements/general/SELF_HOSTED_RUNNERS_DESIGN.md` → `internal/plans/infrastructure/self-hosted-runners.md`
- `enhancements/general/stackweaver-terraform-provider-analysis.md` → `internal/analysis/features/terraform-provider.md`
- `enhancements/general/TFE_STATE_LOCK_IMPLEMENTATION.md` → `internal/summaries/features/state-lock.md`
- `enhancements/general/TODO.md` → Keep in root `docs/internal/TODO.md` or move to appropriate plan

**Current `internal/features/`** → `internal/summaries/features/` or merge with existing structure

**Current `internal/fixes/`** → Keep, but organize by type (linting, security, etc.)

**Current `internal/guide-lines/`** → Rename to `internal/guidelines/` (fix spelling)

**Current `internal/security/`** → Could merge into `internal/analysis/security/` or keep separate

## Benefits of This Structure

1. **Type-based navigation**: Easy to find all plans, all analysis, all research
2. **Topic grouping**: Related docs still grouped by feature/area
3. **Clear separation**: Internal vs user-facing is obvious
4. **Scalable**: Easy to add new types or topics
5. **Consistent**: Follows a clear pattern

## Example Structure After Migration

```
docs/internal/
├── README.md
├── plans/
│   ├── features/
│   │   ├── dashboard/
│   │   │   └── IMPLEMENTATION_PLAN.md
│   │   ├── teams/
│   │   │   └── sso-oidc-integration.md
│   │   └── terraform/
│   │       └── variable-expansion-plan.md
│   └── infrastructure/
│       ├── docs-viewer.md
│       └── self-hosted-runners.md
├── analysis/
│   ├── architecture/
│   │   ├── STATE_PERSISTENCE_ANALYSIS.md
│   │   └── LOG_FETCHING_ROOT_CAUSE.md
│   └── features/
│       └── terraform-provider.md
├── research/
│   └── features/
│       ├── team-workspace-access.md
│       └── variable-expansion-phase1-research.md
├── summaries/
│   ├── features/
│   │   ├── dashboard/
│   │   │   └── IMPLEMENTATION_SUMMARY.md
│   │   └── terraform/
│   │       └── workspace-run-ui-enhancement-summary.md
│   └── commits/
│       └── COMMIT_SUMMARY.md
├── status/
│   ├── auth/
│   │   ├── USER_AUTH_FLOW_SITREP.md
│   │   └── GITHUB_APP_VS_OAUTH-sitrep.md
│   └── features/
│       ├── ISSUES_62_63_STATUS.md
│       └── rbac-handler.md
├── testing/
│   ├── plans/
│   │   └── phase2-verification-checklist.md
│   └── checklists/
│       └── phase3-verification-checklist.md
└── guidelines/
    ├── documentation/
    │   └── DOCUMENTATION_STANDARDS.md
    └── frontend/
        └── styling-notes.md
```

## Decision: Type-First vs Topic-First

**Chosen: Type-First**

**Pros:**
- Easier to find all plans or all analysis
- Clear categorization (plans vs summaries vs status)
- Works well for cross-cutting concerns
- Easier to maintain (less duplication)

**Cons:**
- Related docs for one feature are scattered
- Need to look in multiple places for feature context

**Alternative Considered: Topic-First**

Would look like:
```
internal/
├── features/
│   ├── dashboard/
│   │   ├── plan.md
│   │   ├── summary.md
│   │   └── analysis.md
│   └── teams/
│       ├── plan.md
│       ├── research.md
│       └── status.md
```

**Why Type-First Won:**
- Most queries are "find all plans" or "find all analysis"
- Cross-cutting docs (like architecture analysis) don't fit topic-first
- Type-first is more scalable as project grows

## Implementation

1. Create the new folder structure in `docs/internal/`
2. Move files gradually, starting with most-used categories
3. Update any internal links/references
4. Update build script filters (already excludes `internal/`)
5. Add `internal/README.md` as an index
