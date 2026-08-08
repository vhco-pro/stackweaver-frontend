---
status: stable
status_description: "Authoritative map of the Stackweaver multi-repo topology: private monorepo + closed `core/` module + seven public satellite distribution repos. Drafted 2026-05-23 for OSPS QA-04.01."
description: "Codebase map for Stackweaver. Names every repository in scope (monorepo, closed module, satellites, org-defaults repo), the directionality of sync between them, the licence per component, and the review boundary that human changes must cross. Required reading for any contributor, auditor, or operator."
author: "Michiel VH"
created: 2026-05-23
covers:
  - ".github/"
  - "core/"
  - "backend/"
  - "frontend/"
  - "deploy/"
  - "scripts/zitadel-init/"
  - "runner-images/"
---

# Repositories

> The Stackweaver source is split across several repositories. This page
> is the canonical map. It satisfies OSPS Baseline **QA-04.01** (multi-
> repo: document the list of codebases).

## 1. Repository map

| Tier | Repo | Visibility | Audit scope | Contents |
|------|------|------------|-------------|----------|
| **Upstream monorepo** | `michielvha/stackweaver` | Private (permanent) | Internal upstream gate - not audited directly | All source, including the closed `core/` Go module |
| **Closed Go module** | `core/` (inside monorepo) | Private (BSL when published) | Argued deviation under NDA - see [`core-auditor-access.md`](../internal/security/core-auditor-access.md) | Shared GORM models, repositories, queue, storage, plugin contracts |
| **Satellite - API**           | `vhco-pro/stackweaver-api`            | Planned public | ✅ | `backend/cmd/api`, `backend/internal/{api,services}`, `backend/config` |
| **Satellite - Orchestrator**  | `vhco-pro/stackweaver-orchestrator`   | Planned public | ✅ | `backend/cmd/orchestrator` |
| **Satellite - Terraform Runner** | `vhco-pro/stackweaver-runner`      | Planned public | ✅ | `backend/cmd/runner`, `runner-images/terraform/Dockerfile` |
| **Satellite - Ansible Runner**| `vhco-pro/stackweaver-ansible-runner` | Planned public | ✅ | `backend/cmd/ansible-runner`, `runner-images/ansible/*`, OIDC inventory script |
| **Satellite - Frontend**      | `vhco-pro/stackweaver-frontend`       | Planned public | ✅ | `frontend/`, `docs/` (excluding `docs/internal/`) |
| **Satellite - Helm chart**    | `vhco-pro/stackweaver-helm`           | Public         | ✅ | `deploy/helm/stackweaver/` |
| **Satellite - Zitadel Init**  | `vhco-pro/stackweaver-zitadel-init`   | Planned public | ✅ | `scripts/zitadel-init/` |
| **Org-defaults repo**         | `vhco-pro/.github`                    | Public (created 2026-05-23, empty) | Provides defaults - not audited directly | Community-health files, reusable workflows |

## 2. Sync directionality

```
       michielvha/stackweaver  (private monorepo, source of truth)
                  │
                  │  sync-*.yml (push, one-way; no PRs on satellites)
                  ▼
    vhco-pro/stackweaver-api
    vhco-pro/stackweaver-orchestrator
    vhco-pro/stackweaver-runner
    vhco-pro/stackweaver-ansible-runner
    vhco-pro/stackweaver-frontend
    vhco-pro/stackweaver-helm
    vhco-pro/stackweaver-zitadel-init
```

- Sync is performed by the `stackweaver-release-bot` GitHub App
  (replacing the legacy `SATELLITE_REPO_TOKEN` PAT - planned, see
  [`secrets-policy.md`](../internal/security/secrets-policy.md)).
- No human pushes to satellite `main`. The org-level branch ruleset
  (planned) enforces this with the release-bot as the sole bypass
  principal.
- Each satellite commit is Sigstore-signed and accompanied by a SLSA L3
  provenance attestation referencing the upstream monorepo commit SHA.
  See [`release-verification.md`](../internal/security/release-verification.md).

## 3. Synced vs satellite-owned files

| File / dir | Satellites that own it locally | Satellites where it's synced from monorepo |
|------------|--------------------------------|---------------------------------------------|
| `LICENSE`            | all (today)         | all (planned - `licenses/` canonical, see [`sync-pipeline-audit.md`](../internal/security/sync-pipeline-audit.md)) |
| `NOTICE`             | none (today)        | runner, ansible-runner (planned) |
| `README.md`          | all (today)         | all except helm (planned; helm `sed`s its README at release time) |
| `gitversion.yml`     | all                 | - (uniform; could be synced, low priority) |
| `.github/`           | all                 | - (caller workflows live with the runner - see §5) |
| Top-level Dockerfile | api / orchestrator / zitadel-init / frontend (intentional, hand-maintained) | runner, ansible-runner (synced from `runner-images/*/Dockerfile`) |
| Source tree          | - | every satellite's body is wiped-and-filled or full-mirrored from monorepo |

## 4. Licence per component

See [`license-strategy.md`](../internal/security/license-strategy.md). One-line summary:

- BSL 1.1 + Apache-2.0 Change Date + SaaS-exclusion AUG → api, orchestrator,
  frontend, helm, zitadel-init, `core/`
- Apache-2.0 + `NOTICE` declaring the BSL `core/` linkage → runner,
  ansible-runner

## 5. Review boundary

Authoritative human review happens **upstream** in the monorepo:

- Every change reaches a satellite only via a monorepo PR with ≥ 1
  non-author CODEOWNERS approval and passing CI.
- Satellites are immutable distribution mirrors; their content is a
  deterministic re-publication of a reviewed monorepo commit.
- See [`osps-baseline-audit.md` §10](../internal/security/osps-baseline-audit.md)
  for the public deviation argument against AC-03.01 / QA-07.02 that
  this model rests on, and `threat-model.md` §5 for the underlying threat
  analysis.

## 6. Where to file an issue

- **Bug in API / Orchestrator / Runner / Frontend / Zitadel init / Helm
  chart** → file on the satellite. The satellite's issue templates route
  appropriately.
- **Security report** → use GitHub Private Vulnerability Reporting on the
  satellite where you observed the issue, or email the published security
  mailbox (`vhco-pro/.github/SECURITY.md`).
- **Cross-component / architectural** → file on the satellite you think
  is most affected; maintainers triage.
