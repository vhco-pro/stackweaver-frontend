<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Terraform Features

StackWeaver's Terraform integration provides workspace management, run execution, and automation features compatible with Terraform Cloud and Enterprise. This section covers platform-specific capabilities for configuring workspaces, controlling runs, and viewing output.

## In This Section

### [Workspace Editing](./workspace-editing.md)

Change workspace settings after creation without deleting and recreating workspaces. Covers safe changes (name, working directory, Terraform version, timeouts) and state-affecting changes (VCS connection, repository, branch) that require extra confirmation.

### [VCS Path Filtering](./vcs-path-filtering.md)

Trigger runs only when files in your workspace's working directory change. Supports GitOps-style setups with multiple environments or services in one repository, so each workspace runs only when its paths are modified.

### [Terraform Output Streaming](./terraform-streaming.md)

View plan and apply output in real time as Terraform runs. Output streams line-by-line to the UI and is stored for later review.

### [Run Timeout](./run-timeout.md)

Set a maximum duration for apply operations. Applies that exceed the timeout are automatically cancelled to avoid stuck runs.

### [Run Cancellation](./run-cancellation.md)

Manually cancel runs that are queued, planning, or applying. Describes when cancellation is allowed and what happens to partial work.

## Related Documentation

- [Platform Features Overview](../README.md): full feature set and platform capabilities
- [Your First Terraform Workspace](../../get-started/your-first-terraform-workspace.md): end-to-end setup and first run
