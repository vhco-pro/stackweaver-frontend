---
description: "Ansible integration index with feature status summary"
covers: []
---

# Ansible Integration Documentation

This directory contains the authoritative documentation for StackWeaver's Ansible integration.

## Documentation Structure

| Document | Description |
|----------|-------------|
| [execution-flows.md](./execution-flows.md) | How execution works: job lifecycle, runner vs agent, syncs, workflows - with diagrams |
| [roadmap.md](./roadmap.md) | Future plans, priorities, timeline |
| [api-reference.md](./api-reference.md) | REST API endpoints documentation |
| [galaxy-collections.md](./galaxy-collections.md) | Ansible Galaxy collections support |
| [changelog.md](./changelog.md) | Version history and updates |

## Quick Links

- **Getting Started**: Start with this document
- **What's Next**: Review [roadmap.md](./roadmap.md)
- **API Details**: Reference [api-reference.md](./api-reference.md)

## Feature Status Summary

| Feature | Status |
|---------|--------|
| Inventories (Static) | ✅ Complete |
| Inventories (Dynamic) | ✅ Complete |
| Inventories (Dynamic + OIDC) | ✅ Complete |
| Inventories (VCS) | ✅ Complete |
| Inventories (Constructed - combine inventories) | ✅ Complete |
| Inventory Sources: overwrite / merge / update-on-launch | ✅ Complete |
| Inventory Sync History + Live-Tail Output | ✅ Complete |
| Inventory Sync Schedules | ✅ Complete |
| Ad Hoc Commands (Run Command, module allowlist) | ✅ Complete |
| Credentials | ✅ Complete |
| Multiple Credentials per Template (multi-vault) | ✅ Complete |
| Playbooks + VCS Sync + Bulk Import | ✅ Complete |
| Job Templates | ✅ Complete |
| Template Lifecycle (enable/disable, timeout, concurrency, retention) | ✅ Complete |
| Job Slicing | ✅ Complete |
| Jobs + Events | ✅ Complete |
| Live Job Output (JSONL, incremental polling) | ✅ Complete |
| Task Grouping | ✅ Complete |
| Schedules (templates, syncs, workflows) | ✅ Complete |
| Galaxy Auto-Install | ✅ Complete |
| Workflow Execution (edges, convergence, approvals) | ✅ Complete |
| Workflow Builder UI | 📋 Roadmap (nodes/edges via API) |
| Notifications (webhook, email, Teams) | ✅ Complete |
| SCM Webhook Launches | ✅ Complete |
| Provisioning Callbacks | ✅ Complete |
| Self-Hosted Agent Execution (jobs + ad hoc) | ✅ Complete |
| Azure Workload Identity (syncs + playbook runs) | ✅ Complete |
| Surveys | 📋 Roadmap |
| Fact Storage / Caching | 📋 Roadmap |

## Code Locations

| Component | Path |
|-----------|------|
| Backend Models | `core/models/ansible_*.go` |
| Backend Services | `core/services/ansible/*.go` |
| API Handlers | `backend/internal/api/v2/handlers/ansible/*.go` |
| Runner | `backend/cmd/ansible-runner/main.go` |
| Frontend Pages | `frontend/src/pages/Ansible/*.tsx` |
| API Client | `frontend/src/api/ansible.ts` |
| Docker Image | `runner-images/ansible/Dockerfile` |

## Related Documentation

- [GitHub App Setup](../../user-guides/vcs/github-app.md) - VCS integration
- [Zitadel Setup](../../user-guides/authentication/zitadel-setup.md) - Authentication
- [Managing StackWeaver with Terraform](../../user-guides/terraform-provider.md) - Manage playbooks, inventories, credentials, job templates, and schedules as code with the official Terraform provider
- [Frontend API Reference](../../internal/api-reference/frontend-api-reference.md) - React patterns
