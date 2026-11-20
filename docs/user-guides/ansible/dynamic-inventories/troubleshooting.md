---
title: "Troubleshooting"
nav_order: 4
description: "Fix dynamic inventory syncs that fail, find no hosts or leave stale hosts behind."
covers:
  - "core/services/ansible/**"
  - "backend/internal/executor/syncexec/**"
  - "backend/internal/api/v2/handlers/runner_agent_work_items.go"
  - "backend/internal/api/v2/handlers/ansible/**"
  - "frontend/src/pages/Ansible/**"
  - "frontend/src/components/ansible/**"
  - "backend/cmd/launcher/**"
  - "backend/internal/api/v2/handlers/runner_agent.go"
---

# Troubleshoot dynamic inventories


| Symptom | Check next |
|---|---|
| Authentication fails | Credential provider/organization, expiry, runtime identity and cloud permissions. For Azure federation, also verify issuer, audience and the source-name subject. |
| Success with no hosts | Provider scope and filters. Set explicit GCP projects; no projects can produce a successful sync that contacts nothing. |
| Hosts disappear after sync | Overwrite, successful empty results and overlapping host/group names. A VCS sync removes every host no cloud source owns that the inventory file does not list, hand-added ones included; a host a cloud source owns follows that source's Overwrite setting. Review the source's output before retrying. |
| A plugin warning appears | Read the captured output in **Syncs**. An amber indicator can accompany a successful result. Check options against the installed collection's documentation. |
| `azure_cloud` is undefined | The image the sync runs in lacks the Azure collection's `azure-cli-core` dependency. If the source selects an execution environment of your own, add `azure-cli-core` to that image and rebuild it. |
| Desired grouping, hostname or region control is absent or ineffective | Use VCS plugin YAML or source API `config`; the generic form fields do not configure those provider options. |
