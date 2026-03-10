<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Plan: User-Facing Docs Restructure

> **Status:** Draft
> **Goal:** Separate "how to deploy" from "how to use". Get-started covers deployment, authentication bootstrap, VCS setup, and first-use guides; user-guides becomes the authoritative location for configuration, integration, and operational reference.

---

## Problems with the Current Structure

### 1. VCS guides are split across two locations

| File | Current location | Problem |
|---|---|---|
| `GITHUB_APP_SETUP.md` | `get-started/self-hosting/` | Admin setup guide buried in deployment section |
| `azure-devops.md` | `user-guides/vcs/` | VCS guides in two different top-level sections |

The GitHub App setup is not referenced from the user-guides VCS section. The get-started checklist doesn't mention Azure DevOps at all.

### 2. `get-started/self-hosting/` mixes two kinds of docs

Deployment guides (`kubernetes.md`, `docker-compose.md`) sit alongside deep integration reference guides (`ZITADEL_SETUP.md`, `GITHUB_APP_SETUP.md`). A new operator reading get-started has to navigate a mix of "run this to deploy" and "deep Zitadel internals".

### 3. `user-guides/README.md` has broken relative paths

Links use `./user-guides/your-first-terraform-workspace.md` but the file is in the same directory — they should be `./your-first-terraform-workspace.md`.

### 4. `docs/README.md` puts auth/VCS setup in "Get Started" not "User Guides"

The top-level index lists `ZITADEL_SETUP.md` and `GITHUB_APP_SETUP.md` under the Get Started section, not under User Guides.

### 5. Inconsistent file naming

`GITHUB_APP_SETUP.md`, `ZITADEL_SETUP.md` use SCREAMING_SNAKE_CASE while all other user-facing guides use `kebab-case.md`.

### 6. `zitadel-custom-domain.md` is a loose file in `user-guides/` root

It belongs in a `user-guides/authentication/` subfolder alongside the Zitadel setup guide.

### 7. `your-first-*` guides and deployment-adjacent files are in `user-guides/`

`your-first-terraform-workspace.md` and `your-first-ansible-job.md` are onboarding action guides — they belong in `get-started/`, not alongside operational reference docs. `kubernetes-pull-secret-ghcr.md` is a prerequisite for pulling StackWeaver's own images in Kubernetes, so it belongs in `get-started/self-hosting/`. `cloud-flare-tunnel.md` is an infrastructure-level guide for exposing a Docker Compose stack publicly — it also belongs in `get-started/self-hosting/`, not alongside workspace and Ansible configuration guides.

---

## Proposed Structure

```
docs/
├── README.md                            (top-level index — update links)
├── get-started/
│   ├── README.md                        (5-step journey: deploy → auth → VCS → first tf → first ansible)
│   ├── your-first-terraform-workspace.md  (MOVED from user-guides/)
│   ├── your-first-ansible-job.md          (MOVED from user-guides/)
│   └── self-hosting/
│       ├── README.md                    (deployment overview: choose your path)
│       ├── docker-compose.md            (unchanged)
│       ├── kubernetes.md                (unchanged)
│       ├── environment-variables.md     (unchanged)
│       ├── kubernetes-pull-secret-ghcr.md  (MOVED from user-guides/)
│       └── cloud-flare-tunnel.md           (MOVED from user-guides/)
├── user-guides/
│   ├── README.md                        (comprehensive index — fix broken links)
│   ├── authentication/                  (NEW subfolder)
│   │   ├── README.md                    (NEW — auth overview, links to Zitadel + SSO)
│   │   ├── zitadel-setup.md             (MOVED from get-started/self-hosting/ZITADEL_SETUP.md)
│   │   └── zitadel-custom-domain.md     (MOVED from user-guides/zitadel-custom-domain.md)
│   ├── vcs/
│   │   ├── README.md                    (UPDATE — add GitHub App link, overview of both providers)
│   │   ├── github-app.md                (MOVED from get-started/self-hosting/GITHUB_APP_SETUP.md)
│   │   └── azure-devops.md              (unchanged)
│   ├── sso/                             (unchanged)
│   ├── understanding-terraform-runs.md
│   ├── managing-workspace-variables.md
│   ├── azure-oidc-configuration.md
│   ├── dynamic-inventories.md
│   ├── self-hosted-runners.md
│   └── troubleshooting-common-issues.md
└── features/                            (unchanged — technical reference)
```

---

## File Changes

### Moves (content unchanged, just new location)

| From | To |
|---|---|
| `get-started/self-hosting/ZITADEL_SETUP.md` | `user-guides/authentication/zitadel-setup.md` |
| `get-started/self-hosting/GITHUB_APP_SETUP.md` | `user-guides/vcs/github-app.md` |
| `user-guides/zitadel-custom-domain.md` | `user-guides/authentication/zitadel-custom-domain.md` |
| `user-guides/your-first-terraform-workspace.md` | `get-started/your-first-terraform-workspace.md` |
| `user-guides/your-first-ansible-job.md` | `get-started/your-first-ansible-job.md` |
| `user-guides/kubernetes-pull-secret-ghcr.md` | `get-started/self-hosting/kubernetes-pull-secret-ghcr.md` |
| `user-guides/cloud-flare-tunnel.md` | `get-started/self-hosting/cloud-flare-tunnel.md` |

### New files

| File | Contents |
|---|---|
| `user-guides/authentication/README.md` | Authentication overview: Zitadel setup, custom domain, SSO (links to each) |
| `user-guides/vcs/README.md` (update) | VCS overview — link to both GitHub App and Azure DevOps guides |

### Link updates required

| File | Change needed |
|---|---|
| `docs/README.md` | Move Zitadel + GitHub App links from "Get Started" to "User Guides" section; update file paths for all moved files |
| `get-started/readme.md` | Rewrite as 5-step journey (see below); update all links to moved files |
| `get-started/self-hosting/kubernetes.md` | Update links to `ZITADEL_SETUP.md` → `user-guides/authentication/zitadel-setup.md`; add link to `./kubernetes-pull-secret-ghcr.md` |
| `get-started/self-hosting/docker-compose.md` | Update links to `ZITADEL_SETUP.md` → `user-guides/authentication/zitadel-setup.md` |
| `user-guides/README.md` | Fix broken relative paths (`./user-guides/X.md` → `./X.md`); add authentication section; add VCS section; remove moved files (`your-first-*`, `kubernetes-pull-secret-ghcr.md`, `cloud-flare-tunnel.md`) |

---

## What get-started/readme.md Should Look Like After

The page becomes a 5-step onboarding journey:

1. **Deploy StackWeaver** — links to `self-hosting/kubernetes.md` or `self-hosting/docker-compose.md`
2. **Configure authentication** — link to `user-guides/authentication/zitadel-setup.md`
3. **Connect a VCS provider** — links to `user-guides/vcs/github-app.md` and `user-guides/vcs/azure-devops.md`
4. **Create your first Terraform workspace** — link to `./your-first-terraform-workspace.md`
5. **Create your first Ansible job** — link to `./your-first-ansible-job.md`

No deep configuration content in get-started itself — it all lives in user-guides.

---

## What user-guides/README.md Should Look Like After

Organized by topic:

- **Authentication** — Zitadel setup, custom domain, SSO providers
- **VCS Integration** — GitHub App, Azure DevOps
- **Terraform** — understanding runs, managing variables
- **Ansible** — dynamic inventories
- **Azure Integration** — OIDC, workload identity
- **Infrastructure** — self-hosted runners
- **Troubleshooting**

---

## Implementation Order

1. Create `user-guides/authentication/README.md`
2. Move (git mv) all seven files listed in the moves table
3. Update `user-guides/vcs/README.md` to cover both GitHub and Azure DevOps
4. Update links in `docs/README.md`, `get-started/readme.md`, `get-started/self-hosting/kubernetes.md`, `get-started/self-hosting/docker-compose.md`, `user-guides/README.md`
5. Verify no dead links remain

---

## What This Does NOT Change

- All content — no rewriting, just moving and linking
- `features/` — untouched
- `docs/internal/` — untouched
- `user-guides/sso/` — already well-organised, no changes
- `get-started/self-hosting/kubernetes.md` and `docker-compose.md` — content unchanged, just link updates
- `user-guides/understanding-terraform-runs.md` — conceptual reference, stays in user-guides
