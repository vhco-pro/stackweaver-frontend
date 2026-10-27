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

## Automate Azure DevOps registration

The Azure DevOps guide includes a [Terraform setup module](./azure-devops.md#terraform-setup) for the Microsoft Entra ID app registration. Follow the provider guide for permissions and callback configuration before connecting repositories.
