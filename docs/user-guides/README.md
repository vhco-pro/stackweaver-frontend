---
description: "Index page for all user guides"
covers: []
---

# User Guides

Practical, step-by-step guides for using StackWeaver. These guides walk you through common tasks and workflows.

## Authentication

- **[Authentication Overview](./authentication/README.md)** - Zitadel setup, custom domain, and SSO federation
  - **[Zitadel Setup](./authentication/zitadel-setup.md)** - How Zitadel is initialised in Docker Compose and Kubernetes deployments
  - **[Custom Domain](./authentication/zitadel-custom-domain.md)** - Run StackWeaver on a custom domain with internal service communication on localhost

## VCS Integration

- **[VCS Overview](./vcs/README.md)** - Connect a version control system to trigger Terraform runs from code pushes
  - **[GitHub App](./vcs/github-app.md)** - Create and configure a GitHub App for self-service VCS connections
  - **[Azure DevOps](./vcs/azure-devops.md)** - Connect Azure DevOps repositories using Microsoft Entra ID OAuth2

## Terraform Workflows

- **[Understanding Terraform Runs](./understanding-terraform-runs.md)** - Learn how to read plan and apply outputs, understand resource changes, and track run history
- **[Managing Workspace Variables](./managing-workspace-variables.md)** - Set up and organize variables across workspaces and projects
- **[Change Requests](./change-requests.md)** - File action items against workspaces so teams know what needs fixing, and archive them once the work is done

## Platform as Code

- **[Managing StackWeaver with Terraform](./terraform-provider.md)** - Use the official [`vhco-pro/stackweaver`](https://registry.terraform.io/providers/vhco-pro/stackweaver/latest) Terraform provider to manage organizations, workspaces, teams, variables, agent pools, and the Ansible surface as code, and to migrate from `terraform-provider-tfe`

## Ansible Workflows

> [!NOTE]
> Ansible user guides are coming soon. See [Ansible Documentation](../features/ansible/README.md) for complete Ansible integration documentation.

- **[Dynamic Inventories](./dynamic-inventories.md)** - Configure dynamic inventory sources for Ansible jobs
- **[Managing Ansible Playbooks](./managing-ansible-playbooks.md)** - Register playbooks one at a time, bulk-import them from a repository, or pick them straight from a repository in job template forms
- **[Azure Key Vault from Playbooks](./azure-key-vault-from-playbooks.md)** - Read Key Vault secrets in playbooks via workload identity, with no static credentials on runners

## Monitoring and Reporting

- **[Reading the Dashboard](./reading-the-dashboard.md)** - Get the most out of the landing page: what needs your attention, what is running right now, whether delivery is healthy, and how the focus organization works
- **[Usage & Analytics](./usage-analytics.md)** - Read an organization's delivery health: success rates, run and job durations, busiest workspaces and templates, recent failures, and audit activity

## Organization and Access

- **[Single Sign-On (SSO)](./sso/README.md)** - Federated authentication with external identity providers
  - **[Azure AD / Entra ID](./sso/azure-ad.md)** - Configure Microsoft Entra ID as an SSO provider
  - **[Okta](./sso/okta.md)** - Configure Okta as an SSO provider
  - **[AWS Cognito](./sso/aws-cognito.md)** - Configure AWS Cognito as an SSO provider
  - **[Generic OIDC Provider](./sso/generic-oidc.md)** - Configure any OIDC-compliant provider
  - **[SSO Team Mapping](./sso/team-mapping.md)** - Automatically assign users to teams based on IdP group claims

## Cloud Integration

- **[OIDC Configuration](./oidc-configuration.md)** - Configure keyless authentication from Terraform and Ansible runs to Azure, AWS, and GCP using OpenID Connect workload identity

## Infrastructure

- **[Self-Hosted Runners](./self-hosted-runners.md)** - Run Terraform and Ansible workloads on your own infrastructure using agent pools and self-hosted runners

## Troubleshooting

- **[Troubleshooting Common Issues](./troubleshooting-common-issues.md)** - Solutions for frequent problems and questions
