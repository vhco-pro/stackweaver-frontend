<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Documentation Cleanup and Reorganization Plan

## Overview

Before implementing the docs viewer, we should clean up and reorganize the documentation structure. This will:
- Remove redundant/useless content
- Rename files to match ignore patterns (so they're automatically excluded)
- Organize files into clear categories
- Ensure only user-facing documentation is included in the public docs viewer

## Current Stats

- **Total markdown files**: 115
- **Target**: Clean, organized structure with clear separation between user-facing docs and internal/planning docs

## Cleanup Strategy

### 1. Files to Rename (Add ignore pattern suffixes)

These files should be renamed to match ignore patterns so they're automatically excluded from the docs viewer:

#### Root Level Files
- `add_trivy_security_scanning_1314b0a0.plan.md` → `add_trivy_security_scanning_1314b0a0-plan.md` ✅ Already matches pattern
- `docs-viewer-implementation-plan.md` → Keep as-is (internal planning doc) ✅ Already matches pattern
- `linting-fixes-summary.md` → `linting-fixes-summary.md` (already has `-summary` suffix) ✅
- `tfe-provider-compatibiltiy-checklist.md` → `tfe-provider-compatibility-checklist.md` (fix typo + already has `-checklist`) ✅

#### Ansible Files
- `ansible/implementation-status.md` → `ansible/implementation-status.md` (already matches) ✅
- `ansible/output-comparison-analysis.md` → ✅ Already matches `-analysis` pattern
- `ansible/terminal-output-implementation-plan.md` → ✅ Already matches `-plan` pattern

#### Features Files
- `features/ansible-playbook-webhook-sync-issue.md` → ✅ Already matches `-issue` pattern
- `features/github-pr-status-checks-implementation.md` → ✅ Already matches `implementation` pattern
- `features/phase3-rollback-research.md` → ✅ Already matches `-research` pattern
- `features/run-cancellation-implementation.md` → ✅ Already matches `implementation` pattern
- `features/teams-implementation.md` → ✅ Already matches `implementation` pattern
- `features/variables/variable-expansion-phase1-research.md` → ✅ Already matches `-research` pattern
- `features/variables/variable-expansion-plan.md` → ✅ Already matches `-plan` pattern
- `features/variables/varset-verification-analysis.md` → ✅ Already matches `-analysis` pattern

#### Terraform Files
- `terraform/plan-streaming-implementation.md` → ✅ Already matches `implementation` pattern
- `terraform/TFE_COMPATIBILITY_AUDIT.md` → ✅ Already matches `AUDIT` pattern
- `terraform/workspace-run-ui-enhancement-preserved-logic.md` → Rename to `workspace-run-ui-enhancement-preserved-logic-summary.md` or move to archive
- `terraform/workspace-run-ui-enhancement-summary.md` → ✅ Already matches `-summary` pattern
- `terraform/workspace-run-ui-enhancement.md` → Keep (main feature doc)

#### General Files
- `general/stackweaver-terraform-provider-analysis.md` → ✅ Already matches `-analysis` pattern
- `general/TFE_STATE_LOCK_IMPLEMENTATION.md` → ✅ Already matches `IMPLEMENTATION` pattern
- `general/TODO.md` → ✅ Already excluded (TODO.md pattern)

#### Architecture Files (Already in subdirectories that will be excluded)
- All files in `architecture/status/` → ✅ Directory will be excluded
- All files in `architecture/analysis/` → ✅ Directory will be excluded
- All files in `architecture/auth/*/research/` → ✅ Directory will be excluded
- All files in `architecture/auth/*/plans/` → ✅ Directory will be excluded
- All files in `architecture/auth/*/implementation/` → ✅ Directory will be excluded
- All files in `architecture/legacy/` → ✅ Directory will be excluded
- `architecture/GITHUB_APP_VS_OAUTH-sitrep.md` → Rename to `architecture/GITHUB_APP_VS_OAUTH-sitrep.md` or move to `architecture/status/`

#### Testing Files
- All files in `testing/` → Most should be excluded, but consider keeping `TESTING_API.md` if it's user-facing

#### Dashboard Files
- `dashboard/IMPLEMENTATION_PLAN.md` → ✅ Already matches `PLAN` pattern
- `dashboard/IMPLEMENTATION_SUMMARY.md` → ✅ Already matches `SUMMARY` pattern

### 2. Files to Move/Reorganize

Files that should be moved to better locations:

- Already in `archive/` folder → ✅ Keep there, directory will be excluded
- `ansible/implementation-status.md` → Consider if it's still relevant or move to archive
- `general/SELF_HOSTED_RUNNERS_DESIGN.md` → Keep (still needs to be implemented) ✅
- `archive/random.md` → Move to `frontend/notes.md` or `frontend/styling-notes.md` (contains gradient comment reference)
- `architecture/GITHUB_APP_VS_OAUTH-sitrep.md` → Move to `architecture/status/GITHUB_APP_VS_OAUTH-sitrep.md` (it's a status/sitrep doc)

### 3. Files to Keep (Personal/Internal)

Files that are personal notes but should be kept:

- `archive/random.md` → Move to `frontend/notes.md` or `frontend/styling-notes.md` (gradient comment reference - developer note)
- `general/TODO.md` → Keep (personal TODO file - will be excluded by TODO.md pattern) ✅

### 4. Files to Review for Consolidation

Potential redundant content:

- **Zitadel setup files**: Multiple files with distinct purposes:
  - `ZITADEL_SETUP.md` - Main automated setup guide (Go bootstrap script)
  - `ZITADEL_MANUAL_SETUP.md` - Manual setup fallback when automated doesn't work
  - `zitadel-localhost-alias.md` - Technical networking notes (Docker aliases, localhost access)
  
  **Recommendation**: These serve different purposes and complement each other. Option to consolidate:
  1. **Keep separate** (current) - Clear separation of concerns
  2. **Consolidate** - Merge `zitadel-localhost-alias.md` into `ZITADEL_SETUP.md` as a "Networking & Aliases" section, keep manual setup separate
  
  **Action**: Review if `zitadel-localhost-alias.md` content fits better in main setup guide or should stay separate as a technical reference.

- **Terraform workspace enhancement files**: Multiple files with similar names
  - `workspace-run-ui-enhancement.md` (main doc - keep) ✅
  - `workspace-run-ui-enhancement-summary.md` (summary - exclude by `-summary` pattern) ✅
  - `workspace-run-ui-enhancement-preserved-logic.md` (implementation detail - rename to `workspace-run-ui-enhancement-preserved-logic-analysis.md` to match exclude pattern)

- **Architecture auth files**: Many related files that might be consolidated
  - Review if some can be merged or if they all serve distinct purposes

### 5. Files to Keep (User-Facing Documentation)

These should definitely be included in the docs viewer:

#### Root Level
- ✅ `README.md` (main entry point)
- ✅ `DOCUMENTATION_STANDARDS.md` (might be user-facing for contributors)

#### Setup
- ✅ `setup/setup-guide.md` (main setup guide)
- ✅ `setup/GITHUB_APP_SETUP.md` (user-facing)
- ✅ `setup/ZITADEL_SETUP.md` (user-facing)
- ✅ `setup/ZITADEL_MANUAL_SETUP.md` (if user-facing)
- ✅ `setup/zitadel-localhost-alias.md` (if user-facing)

#### Architecture
- ✅ `architecture/architecture.md` (main architecture doc)
- ✅ `architecture/authentication.md` (user-facing auth docs)
- ✅ `architecture/design/API_ARCHITECTURE_DESIGN.md` (might be user-facing)
- ✅ `architecture/design/TFE_WORKSPACE_DESIGN.md` (might be user-facing)
- ✅ `architecture/design/frontend-v2-design.md` (might be user-facing)
- ✅ `architecture/references/*` (reference docs - likely user-facing)

#### API Reference
- ✅ `api-reference/frontend-api-reference.md`
- ✅ `api-reference/backend-api-reference.md`

#### Features
- ✅ `features/ansible-playbook-webhook-sync.md` (main feature doc)
- ✅ `features/terraform-streaming.md` (main feature doc)
- ✅ `features/run-timeout.md` (main feature doc)
- ✅ `features/vcs-path-filtering.md` (main feature doc)
- ✅ `features/workspace-editing.md` (main feature doc)
- ✅ `features/variables/tfe-parent-vs-scope-model.md` (user-facing model doc)
- ❌ Exclude: `-issue`, `-implementation`, `-research`, `-plan`, `-analysis` variants

#### Ansible
- ✅ `ansible/README.md`
- ✅ `ansible/overview.md`
- ✅ `ansible/architecture.md`
- ✅ `ansible/api-reference.md`
- ✅ `ansible/changelog.md`
- ✅ `ansible/roadmap.md`
- ✅ `ansible/runner.md`
- ✅ `ansible/execution-environments.md`
- ✅ `ansible/galaxy-collections.md`
- ✅ `ansible/live-output.md`
- ❌ Exclude: `implementation-status`, `-analysis`, `-plan` variants

#### Terraform
- ✅ `terraform/Workspaces.md`
- ✅ `terraform/api.md`
- ✅ `terraform/ID_FORMAT.md`
- ❌ Exclude: `-implementation`, `AUDIT`, `-summary` variants

#### Frontend
- ✅ `frontend/run-output-components.md`
- ✅ `frontend/icon-color-guidelines.md` (if user-facing for contributors)

#### Security
- ✅ `security/certs.md`

#### General
- ✅ Keep `general/SELF_HOSTED_RUNNERS_DESIGN.md` if it's current design doc (not outdated)

#### Migration
- ✅ `migration/V2_MIGRATION_COMPLETE.md` (might be useful for reference)

### 6. Directory Structure Improvements

Current structure is mostly good, but consider:

1. **Consolidate `testing/` folder**: 
   - Move internal testing docs to `architecture/testing/` or `testing/internal/`
   - Keep only user-facing testing docs in `testing/`

2. **Better organization of feature docs**:
   - Main feature docs are good
   - Implementation/plan/research variants should be excluded automatically

3. **Clear separation**:
   - User-facing: Root, `setup/`, `api-reference/`, `features/` (main docs), `ansible/` (main docs), `terraform/` (main docs)
   - Internal: `architecture/status/`, `architecture/analysis/`, `architecture/auth/*/research/`, `archive/`, `testing/` (most)

## Action Items

### Phase 1: Rename/Move Files

1. ✅ Most files already match ignore patterns - good!
2. ⚠️ Files to rename:
   - `terraform/workspace-run-ui-enhancement-preserved-logic.md` → `terraform/workspace-run-ui-enhancement-preserved-logic-analysis.md` (add `-analysis` suffix)
   
3. ⚠️ Files to move:
   - `architecture/GITHUB_APP_VS_OAUTH-sitrep.md` → Move to `architecture/status/GITHUB_APP_VS_OAUTH-sitrep.md`
   - `archive/random.md` → Move to `frontend/styling-notes.md` (contains gradient comment reference)

### Phase 2: Review and Organize

1. ✅ Keep `general/TODO.md` (personal TODO file - will be excluded)
2. Move `archive/random.md` → `frontend/styling-notes.md` (as part of Phase 1)

### Phase 3: Consolidate/Organize (Optional)

1. **Zitadel setup files** - Review if `zitadel-localhost-alias.md` should be:
   - Merged into `ZITADEL_SETUP.md` as a "Networking & Aliases" section, OR
   - Kept separate as a technical reference (current state)
   
   Recommendation: If merged, add section title "## Docker Networking & Localhost Aliases" to preserve context

2. Review terraform workspace enhancement files - ✅ Already handled (main doc kept, others excluded by patterns)

3. Review testing docs - Move internal ones to `testing/internal/` or exclude via patterns

### Phase 4: Update References

1. Update `README.md` to reflect cleaned structure
2. Fix any broken internal links after renames
3. Update `DOCUMENTATION_STANDARDS.md` if needed

## Files That Need Attention

### High Priority ✅ COMPLETED
1. ✅ **Rename**: `terraform/workspace-run-ui-enhancement-preserved-logic.md` → `terraform/workspace-run-ui-enhancement-preserved-logic-analysis.md`
2. ✅ **Move**: `architecture/GITHUB_APP_VS_OAUTH-sitrep.md` → `architecture/status/GITHUB_APP_VS_OAUTH-sitrep.md`
3. ✅ **Move**: `archive/random.md` → `frontend/styling-notes.md`

### Medium Priority ✅ COMPLETED
1. ✅ **Zitadel setup files** - Consolidated `zitadel-localhost-alias.md` into `ZITADEL_SETUP.md` as "Docker Networking & Localhost Aliases" section
   - Content merged and preserved
   - Updated README.md reference
   - File deleted (consolidated)

### Remaining (Optional)
1. **Testing docs** - Organize internal vs user-facing (move internal ones or ensure exclude patterns work)

### Low Priority
- `docs-viewer-implementation-plan.md` - Internal planning doc (will be excluded by `-plan` pattern) ✅
- Files in archive - Already in excluded directory ✅
- All files matching ignore patterns - Already handled ✅

## Expected Outcome

After cleanup:
- **User-facing docs**: ~50-60 files (clean, organized)
- **Internal/planning docs**: Excluded via patterns/directories (~55-65 files)
- **Clear structure**: Easy to navigate, maintain, and understand
- **No redundancy**: Each doc has a clear purpose

## Next Steps

1. Review this plan
2. Execute Phase 1-3 (rename, delete, consolidate)
3. Update references
4. Test that ignore patterns work correctly
5. Proceed with docs viewer implementation