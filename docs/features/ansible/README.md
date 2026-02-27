<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Ansible Integration Documentation

This directory contains the authoritative documentation for StackWeaver's Ansible integration.

## Documentation Structure

| Document | Description |
|----------|-------------|
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
| Inventories (VCS-Backed Sources) | ✅ Complete |
| Inventory Sync Schedules | ✅ Complete |
| Credentials | ✅ Complete |
| Playbooks + VCS Sync | ✅ Complete |
| Job Templates | ✅ Complete |
| Jobs + Events | ✅ Complete |
| Schedules | ✅ Complete |
| Galaxy Auto-Install | ✅ Complete |
| Live Job Output | ✅ Complete (JSONL) |
| Task Grouping | ✅ Complete |
| Workflow Templates | 📋 Roadmap |
| Surveys | 📋 Roadmap |
| Notifications | 📋 Roadmap |

## Code Locations

| Component | Path |
|-----------|------|
| Backend Models | `backend/internal/models/ansible_*.go` |
| Backend Services | `backend/internal/services/ansible/*.go` |
| API Handlers | `backend/internal/api/v2/handlers/ansible/*.go` |
| Runner | `backend/cmd/ansible-runner/main.go` |
| Frontend Pages | `frontend/src/pages/Ansible/*.tsx` |
| API Client | `frontend/src/api/ansible.ts` |
| Docker Image | `runner-images/ansible/Dockerfile` |

## Related Documentation

- [GitHub App Setup](../../get-started/self-hosting/GITHUB_APP_SETUP.md) - VCS integration
- [Zitadel Setup](../../get-started/self-hosting/ZITADEL_SETUP.md) - Authentication
- [Frontend API Reference](../../internal/api-reference/frontend-api-reference.md) - React patterns
