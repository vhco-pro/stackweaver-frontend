---
description: "Index page for VCS integration guides"
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

# VCS Integration

Connect a version control system so StackWeaver can trigger OpenTofu runs from code pushes and pull requests.

## Providers

- **[GitHub App](./github-app.md)** - Create and configure a GitHub App to enable self-service VCS connections for GitHub repositories.
- **[Azure DevOps](./azure-devops.md)** - Connect Azure DevOps repositories using Microsoft Entra ID OAuth2.

## Terraform Helpers

- **[Entra ID Setup Module](./azure-devops.md#terraform-setup-declarative)** - A Terraform module that provisions the Microsoft Entra ID App Registration needed for the Azure DevOps VCS connection.
