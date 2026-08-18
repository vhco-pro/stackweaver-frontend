---
description: "Platform features overview summarizing Terraform, Ansible, VCS, and organization capabilities"
covers: []
---

# Platform Features

StackWeaver is a unified orchestration platform for managing OpenTofu and Ansible workflows. It combines the capabilities of Terraform Cloud and Ansible AWX into a single solution, and stays API-compatible with Terraform Cloud/Enterprise tooling. It's available for self hosting or as a managed service.

## What StackWeaver Does

StackWeaver provides a web-based dashboard, API and customizable runners for managing infrastructure as code and automation workflows. The platform manages the complete lifecycle of OpenTofu workspaces, handles Ansible automation with playbook and inventory management, and provides a unified interface where you can monitor both types of operations side by side.

Version control integration through GitHub App webhooks enables automated runs and playbook synchronization, while organization and team-based RBAC ensures fine-grained access control over all resources.

## Core Platform Capabilities

### Organization & Access Management

StackWeaver uses an organization and team-based model for access control. Organizations serve as top-level containers for all resources including workspaces, playbooks, and projects. Within organizations, teams group users together with configurable permissions, allowing you to control who can create, read, update, or delete specific resources.

Projects provide logical grouping of related resources, making it easier to organize your infrastructure by environment, service, or team. This structure supports complex access patterns while keeping permissions manageable.

### Version Control Integration

Connect repositories through GitHub App integration for secure, webhook-based automation. The platform automatically triggers runs and syncs Ansible playbooks whenever repository changes are pushed.

Path-based filtering ensures that workspaces only trigger when files in their configured paths actually change, preventing unnecessary runs in monorepo setups. Both workspace and playbook configurations can be tied to specific Git branches, supporting environment-specific workflows.

### State & Execution Management

State is stored securely with versioning in S3-compatible storage. State locking prevents concurrent applies that could corrupt your infrastructure state. Plan, apply, and destroy operations execute with full output streaming, while Ansible job runs provide real-time output and event tracking for complete visibility into automation workflows.

## OpenTofu Features

### Workspace Management

Create, configure, and edit workspaces throughout their lifecycle without needing to delete and recreate them. Specify Terraform versions per workspace to control which version executes your infrastructure code. Configure working directories within repositories for multi-environment setups, supporting monorepo patterns where different workspaces manage different paths.

Choose execution modes based on your needs: remote execution with platform-managed runners, local execution, or agent-based execution for specialized scenarios.

### Run Management

StackWeaver provides comprehensive run management capabilities:

| Feature | Description |
|---------|-------------|
| **[Output Streaming](./terraform/terraform-streaming.md)** | Live, real-time streaming of plan and apply output with resource status updates as they happen |
| **[Run Timeout](./terraform/run-timeout.md)** | Configurable timeouts automatically cancel long-running applies to prevent stuck jobs |
| **[Run Cancellation](./terraform/run-cancellation.md)** | Manually cancel runs in progress, whether queued, planning, or applying |
| Run History | Complete audit trail of all plan and apply operations for compliance and debugging |

### Advanced Features

Modify workspace settings after creation with [workspace editing](./terraform/workspace-editing.md), eliminating the need to delete and recreate workspaces when configuration changes. [VCS path filtering](./terraform/vcs-path-filtering.md) implements GitOps-style filtering that only triggers workspaces when relevant files change, perfect for monorepo architectures.

Variable management includes workspace variables, variable sets for sharing across multiple workspaces, and encrypted storage for sensitive values. Full JSON:API compatibility with Terraform Enterprise and Cloud provider ensures existing tooling and workflows continue to work.

## Ansible Features

### Playbook & Inventory Management

Store, version, and manage Ansible playbooks within the platform. [Automatic playbook synchronization](./ansible-playbook-webhook-sync.md) keeps your playbooks up to date with your Git repositories whenever you push changes.

Three inventory types are supported: static inventories defined within StackWeaver, dynamic inventories that query external systems, and VCS-synced inventories that pull from Git repositories. Credential management provides secure storage and automatic injection of API keys, passwords, and SSH keys into job executions.

### Job Execution

Create reusable job templates that combine playbooks, inventories, and credentials into standardized automation workflows. Execute Ansible jobs with real-time output streaming using JSONL-based event streaming for immediate visibility into task progress and results.

Every job execution is preserved in history with detailed task outputs, making it easy to debug failures and understand what happened in past runs. Schedule recurring jobs for regular maintenance tasks and automated workflows.

### Galaxy Integration

Ansible Galaxy collections are automatically installed when specified in requirements files. The platform handles version tracking and dependency resolution, ensuring your jobs have access to the collections they need.

## Additional Features

The unified dashboard provides an overview of all Terraform and Ansible operations across your organizations, giving you a single place to monitor infrastructure changes and automation workflows. An activity timeline tracks recent actions and changes across the platform, helping you understand what's happening in your infrastructure.

An API-first design means everything is accessible via REST API with JSON:API format, enabling automation, integration with other tools, and programmatic management. The platform can also be managed declaratively with the [official Terraform provider](../user-guides/terraform-provider.md), which covers both the Terraform and the Ansible surface. Real-time updates use Server-Sent Events (SSE) for live log streaming and status updates, so you always see current information without refreshing.

## Related Documentation

- [User Guides](../user-guides/README.md) - Step-by-step guides for using features
- [Terraform Workspace Editing](./terraform/workspace-editing.md) - Complete Terraform workspace documentation
- [Ansible Documentation](./ansible/README.md) - Complete Ansible integration documentation
- [API Reference](../internal/api-reference/backend-api-reference.md) - REST API documentation
