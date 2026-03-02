<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# User Guides

Practical, step-by-step guides for using StackWeaver. These guides walk you through common tasks and workflows.

## Getting Started

- **[Your First Terraform Workspace](./user-guides/your-first-terraform-workspace.md)** - Set up and run your first Terraform workspace from scratch
- **[Running Your First Ansible Job](./user-guides/your-first-ansible-job.md)** - Get started with Ansible automation in StackWeaver

## Terraform Workflows

- **[Understanding Terraform Runs](./user-guides/understanding-terraform-runs.md)** - Learn how to read plan and apply outputs, understand resource changes, and track run history
- **[Managing Workspace Variables](./user-guides/managing-workspace-variables.md)** - Set up and organize variables across workspaces and projects

> [!NOTE]
> More user guides are coming soon. See [Features](../features/README.md) for documentation on platform features.

## Ansible Workflows

> [!NOTE]
> Ansible user guides are coming soon. See [Ansible Documentation](../features/ansible/README.md) for complete Ansible integration documentation.

## Organization and Access

- **[Single Sign-On (SSO)](./sso/README.md)** - Federated authentication with external identity providers
  - **[Azure AD / Entra ID](./sso/azure-ad.md)** - Configure Microsoft Entra ID as an SSO provider
  - **[Okta](./sso/okta.md)** - Configure Okta as an SSO provider
  - **[AWS Cognito](./sso/aws-cognito.md)** - Configure AWS Cognito as an SSO provider
  - **[Generic OIDC Provider](./sso/generic-oidc.md)** - Configure any OIDC-compliant provider
  - **[SSO Team Mapping](./sso/team-mapping.md)** - Automatically assign users to teams based on IdP group claims

## Azure Integration

- **[Azure OIDC Configuration](./azure-oidc-configuration.md)** - Configure keyless authentication from Terraform and Ansible runs to Azure using OpenID Connect workload identity

## Infrastructure and Execution

- **[Self-Hosted Runners](./user-guides/self-hosted-runners.md)** - Run Terraform and Ansible workloads on your own infrastructure using agent pools and self-hosted runners
- **[Kubernetes Pull Secret for GHCR](./kubernetes-pull-secret-ghcr.md)** - Create and configure a Kubernetes image pull secret so your cluster can pull StackWeaver images from the private GHCR registry

## Common Tasks

- **[Troubleshooting Common Issues](./user-guides/troubleshooting-common-issues.md)** - Solutions for frequent problems and questions
