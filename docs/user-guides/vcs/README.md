---
title: "VCS integrations"
layout: overview
description: "Connect GitHub or Azure DevOps repositories for infrastructure and Ansible workflows."
covers: []
capabilities: [
  {
    "id": "vcs-connections",
    "name": "GitHub and Azure DevOps connections",
    "summary": "Connect repositories for code-driven infrastructure and Ansible workflows.",
    "area": "platform",
    "availability": "available",
    "evidence": [
      "backend/internal/api/v2/handlers/vcs_connections.go",
      "backend/internal/api/v2/handlers/vcs_app_installation.go",
      "core/services/vcs/provider.go"
    ]
  }
]
---

# VCS integrations

## Repository credentials for syncs on agent pools

A VCS inventory file sync can run on one of your agent pools, when its identity binding places it there. What the pool receives to clone the repository depends on the connection:

- A GitHub App connection gives each such sync a token that reaches only the inventory's repository and can only read it.
- A GitHub token, GitLab, Bitbucket or Azure DevOps connection holds a stored credential, which reaches every repository the connection can reach. Its file syncs run on an agent pool only when the organization turns on **Allow stored VCS credentials on agent pools**, which is off by default; organization owners set it with the `allow-stored-vcs-credentials-on-agent-pools` attribute of `PATCH /api/v2/organizations/:name`.

[Repository credentials on agent pools](../launchers/identity-bindings-and-pull-secrets.md#repository-credentials-on-agent-pools) describes what happens to a sync while the setting is off.

## Automate Azure DevOps registration

The Azure DevOps guide includes a [Terraform setup module](./azure-devops.md#terraform-setup) for the Microsoft Entra ID app registration. Follow the provider guide for permissions and callback configuration before connecting repositories.
