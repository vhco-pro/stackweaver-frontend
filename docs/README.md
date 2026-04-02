---
description: "Top-level documentation index and navigation page"
covers: []
---

# Documentation Index

Welcome to the StackWeaver documentation. This directory contains comprehensive documentation for developers, operators, and users of the orchestration platform.

## Get Started

- **[Get Started](./get-started/readme.md)**: Overview of StackWeaver and how to get up and running
- **[Your First Terraform Workspace](./get-started/your-first-terraform-workspace.md)**
- **[Running Your First Ansible Job](./get-started/your-first-ansible-job.md)**
- **[Self-Hosting](./get-started/self-hosting/)**
  - **[Environment Variables Reference](./get-started/self-hosting/environment-variables.md)**: All service environment variables
  - **[Docker Compose](./get-started/self-hosting/docker-compose/)**: Deploy on a single machine with Docker Compose
    - **[Cloudflare Tunnel](./get-started/self-hosting/docker-compose/cloud-flare-tunnel.md)**: Expose your Docker Compose stack publicly via Cloudflare Tunnel
  - **[Kubernetes](./get-started/self-hosting/kubernetes/)**: Deploy on Kubernetes using the Helm chart
    - **[Kubernetes Pull Secret for GHCR](./get-started/self-hosting/kubernetes/kubernetes-pull-secret-ghcr.md)**: Pull StackWeaver images in a private cluster

## Architecture

- **[Architecture Overview](./architecture/README.md)**: System architecture, components, and end-to-end data flows

## Platform Features

- **[Platform Features Overview](./features/README.md)**: What StackWeaver does and how the platform is organized

### Terraform

- **[Output Streaming](./features/terraform/terraform-streaming.md)**: Live streaming of plan/apply output with resource status updates
- **[Run Timeout](./features/terraform/run-timeout.md)**: Automatic cancellation for long-running runs
- **[Run Cancellation](./features/terraform/run-cancellation.md)**: Manually cancel queued/planning/applying runs
- **[Workspace Editing](./features/terraform/workspace-editing.md)**: Update workspace settings after creation
- **[VCS Path Filtering](./features/terraform/vcs-path-filtering.md)**: Trigger runs only when relevant paths change

### Ansible

- **[Ansible Overview](./features/ansible/README.md)**: How Ansible is modeled and executed in StackWeaver
- **[Ansible API Reference](./features/ansible/api-reference.md)**: Ansible REST API endpoints
- **[Galaxy Collections](./features/ansible/galaxy-collections.md)**: Automatic collection installation via requirements files
- **[Roadmap](./features/ansible/roadmap.md)**: Planned Ansible improvements
- **[Changelog](./features/ansible/changelog.md)**: User-visible changes to the Ansible feature set
- **[Playbook Webhook Sync](./features/ansible-playbook-webhook-sync.md)**: Sync playbooks from VCS on webhook events

### Dashboard

- **[Dashboard](./features/dashboard/README.md)**: Unified dashboard and activity overview

## User Guides

- **[User Guides Overview](./user-guides/README.md)**: Practical, step-by-step workflows
  - **[Authentication](./user-guides/authentication/README.md)**
    - **[Zitadel Setup](./user-guides/authentication/zitadel-setup.md)**: Set up Zitadel for authentication
    - **[Custom Domain](./user-guides/authentication/zitadel-custom-domain.md)**: Configure a custom domain for Zitadel
  - **[VCS Integration](./user-guides/vcs/README.md)**
    - **[GitHub App](./user-guides/vcs/github-app.md)**: Configure GitHub App integration for VCS connections
    - **[Azure DevOps](./user-guides/vcs/azure-devops.md)**: Connect Azure DevOps repositories
  - **[Understanding Terraform Runs](./user-guides/understanding-terraform-runs.md)**
  - **[Managing Workspace Variables](./user-guides/managing-workspace-variables.md)**
  - **[Troubleshooting Common Issues](./user-guides/troubleshooting-common-issues.md)**
  - **[Single Sign-On (SSO)](./user-guides/sso/README.md)**: Federated authentication with external identity providers
    - **[Azure AD / Entra ID](./user-guides/sso/azure-ad.md)**
    - **[Okta](./user-guides/sso/okta.md)**
    - **[AWS Cognito](./user-guides/sso/aws-cognito.md)**
    - **[Generic OIDC Provider](./user-guides/sso/generic-oidc.md)**
    - **[SSO Team Mapping](./user-guides/sso/team-mapping.md)**

## Docs Viewer Test Pages

- **[Syntax Highlighting + Rendering Tests](./test-syntax-highlighting.md)**: Single page to verify docs viewer rendering features
