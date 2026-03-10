<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Issue: Ansible Playbooks Not Auto-Syncing on GitHub Commits

## Problem Description

When making a commit to a GitHub repository that contains Ansible playbooks, the playbooks are not automatically synced even though:
- The playbook is configured with a VCS connection
- The repository has webhooks configured
- Other resources (workspaces, inventories) sync correctly

## Expected Behavior

When a commit is pushed to a GitHub repository:
1. Webhook receives push event
2. System identifies playbooks linked to that repository/branch
3. System checks if playbook files were affected by the commit
4. System automatically queues a sync job for affected playbooks
5. Playbook sync executes and updates the playbook

**Manual sync functionality** (`POST /api/v2/ansible/playbooks/:id/actions/sync`) will continue to work as before and is unaffected by this change.

## Current Behavior

- Workspaces: ✅ Auto-sync on push events
- Inventories: ✅ Auto-sync on push events  
- Playbooks: ❌ **NOT auto-syncing**

## Root Cause

The active webhook handler (`VCSAppInstallationHandlerV2`) at `/api/v2/vcs-connections/github/webhook` handles workspace runs and inventory syncs, but is missing playbook sync logic.

The old webhook handler (`GitHubWebhookHandler`) at `/api/v2/webhooks/github` has playbook sync logic, but:
1. It's deprecated and not the primary handler
2. The `syncQueuer` is set to `nil` in route setup, so it never actually queues syncs

## Impact

- Users must manually trigger playbook syncs from the UI (manual sync remains available)
- No automatic updates when playbooks are committed to VCS
- Inconsistent behavior compared to inventories and workspaces (both support auto-sync)

**Note**: Manual sync functionality will remain fully functional after this fix is implemented.

## Solution

Add playbook sync logic to the v2 webhook handler, following the same pattern as inventory syncs. See implementation plan: `docs/features/ansible-playbook-webhook-sync.md`

## Priority

Medium - Feature gap that affects user experience and consistency with other VCS-connected resources.

