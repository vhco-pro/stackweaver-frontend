---
title: "OpenTofu"
layout: overview
description: "Read and act on runs, manage workspace variables, add run tasks, track change requests and migrate from Terraform Cloud."
covers:
  - "frontend/src/pages/Workspace*"
  - "frontend/src/pages/RunDetail.tsx"
  - "backend/internal/api/v2/handlers/terraform/**"
---

# OpenTofu

Manage OpenTofu workspaces: read a run's plan before you apply it, give workspaces their variables, hook external checks into runs, and track follow-up work. Moving from Terraform Cloud or Terraform Enterprise keeps your CLI and `tfe` provider workflows.

New to OpenTofu on Stackweaver? Start with [your first OpenTofu workspace](../../get-started/your-first-opentofu-workspace.md).
