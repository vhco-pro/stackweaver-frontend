<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Internal Documentation Migration Status

This document tracks the migration of internal documentation files from scattered locations to the organized `docs/internal/` structure.

## Migration Complete ✅

As of the reorganization, **67 markdown files** have been moved to `docs/internal/` from:

- `architecture/status/` → `internal/status/`
- `architecture/analysis/` → `internal/analysis/architecture/`
- `architecture/auth/*/research/` → `internal/research/features/`
- `architecture/auth/*/plans/` → `internal/plans/features/teams/`
- `architecture/auth/*/implementation/` → `internal/summaries/features/teams/`
- `dashboard/IMPLEMENTATION_*.md` → `internal/plans/features/dashboard/` and `internal/summaries/features/dashboard/`
- `features/*-implementation.md` → `internal/summaries/features/`
- `features/*-plan.md` → `internal/plans/features/`
- `features/*-research.md` → `internal/research/features/`
- `features/variables/*-plan.md` → `internal/plans/features/terraform/`
- `features/variables/*-analysis.md` → `internal/analysis/features/terraform/`
- `terraform/*-implementation.md` → `internal/summaries/features/terraform/`
- `terraform/*-analysis.md` → `internal/analysis/features/terraform/`
- `ansible/implementation-status.md` → `internal/summaries/features/ansible/`
- `ansible/*-analysis.md` → `internal/analysis/features/ansible/`
- `ansible/*-plan.md` → `internal/plans/features/ansible/`
- `testing/*-PLAN.md` → `internal/testing/plans/`
- `testing/*-checklist.md` → `internal/testing/checklists/`
- `testing/*-ANALYSIS.md` → `internal/testing/analysis/`
- And many more...

## Current Structure

```
docs/internal/
├── analysis/          # Technical analysis (7 subdirectories, 13 files)
├── fixes/             # Bug fixes (2 subdirectories, 5 files)
├── guidelines/        # Internal guidelines (2 subdirectories, 4 files)
├── plans/             # Implementation plans (2 subdirectories, 8 files)
├── research/          # Research documents (1 subdirectory, 5 files)
├── status/            # Status reports (1 subdirectory, 6 files)
├── summaries/         # Implementation summaries (2 subdirectories, 15 files)
└── testing/           # Testing documentation (3 subdirectories, 3 files)
```

## Files Intentionally Left Outside Internal/

These files remain outside `internal/` because they are **user-facing documentation**:

### Architecture
- `architecture/architecture.md` - High-level architecture overview
- `architecture/authentication.md` - Authentication flow documentation
- `architecture/auth/permissions/PERMISSIONS_MODEL_V2.md` - Permission model documentation
- `architecture/design/` - Design documentation (API, frontend, TFE workspace)
- `architecture/references/` - External API references

### Ansible
- `ansible/README.md`, `ansible/overview.md`, `ansible/api-reference.md` - User-facing Ansible docs
- `ansible/architecture.md`, `ansible/runner.md`, `ansible/live-output.md` - User-facing technical docs

### Terraform
- `terraform/api.md`, `terraform/Workspaces.md`, `terraform/ID_FORMAT.md` - User-facing Terraform docs
- `terraform/workspace-run-ui-enhancement.md` - Feature documentation

### Features
- `features/terraform-streaming.md` - User-facing feature doc
- `features/variables/tfe-parent-vs-scope-model.md` - User-facing variable docs
- All other `features/*.md` files - User-facing feature documentation

### Testing
- `testing/TESTING_API.md` - Testing API documentation
- `testing/STATE_LOCK_TESTING.md` - Testing guide
- `testing/manual-tests-rbac.md` - Manual testing procedures
- `testing/webhook-debugging.md` - Webhook debugging guide
- `testing/cloud-flare-tunnel.md` - Configuration documentation

These files are intentionally excluded from `internal/` because they are meant to be viewed by end users, contributors, or operators - not just internal developers.

## Next Steps

1. ✅ All internal docs moved to `docs/internal/`
2. ✅ Build script excludes `internal/` directory
3. ⏳ Update internal links/references if needed
4. ⏳ Create `internal/README.md` index
