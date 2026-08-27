<!--
Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
-->
---
description: "OSPS Baseline (Level 1 + Level 3) compliance statement for Stackweaver, mapped control-by-control to public evidence with copy-paste verification commands. Aimed at any independent security auditor performing a supply-chain review of the public satellite repositories, without privileged access. Also explains the current OpenSSF Scorecard scores and the project's argued deviations."
covers:
  - ".github/workflows/**"
  - "deploy/helm/**"
  - "licenses/**"
---

# OSPS Baseline Compliance

This page is Stackweaver's compliance statement against the **[OpenSSF Open Source Project Security (OSPS) Baseline](https://baseline.openssf.org/)**, checklist version `2026.02.19`, at **Level 1 and Level 3**. It is written so that any independent auditor can confirm each claim against the live GitHub APIs, with no privileged access and no project-specific key material.

The OSPS Baseline is a general, vendor-neutral catalogue of security controls for open source projects, it is not specific to any one auditor or customer. Every control below is quoted (paraphrased) from that catalogue, followed by how Stackweaver satisfies it and a command you can run yourself to verify.

**Coverage at a glance.** This document maps **every** control in the checklist: all **24 Level 1** controls and all **21 Level 3** controls, with no item left unaddressed. Where a control is not a plain ✅, the reason is stated inline and expanded under [§ Argued deviations](#argued-deviations).

> **Companion pages.** Two sibling documents go deeper on the two areas auditors probe most:
> [Verifying a Release](./verifying-releases.md) (cryptographic verification of every published artefact) and
> [Sync Architecture](./sync-architecture.md) (the trust boundary between the private monorepo and the public satellites). This page references both rather than repeating them.

---

## How to read this document

| Symbol | Meaning |
|:------:|---------|
| ✅ | Met. Verifiable from the live public APIs. |
| ⚠️ | Met via a **documented, argued deviation**. OSPS explicitly permits this when the deviation is recorded and compensated; the rationale and compensating control are given in [§ Argued deviations](#argued-deviations). |
| 🟡 | Partial: a residual gap with a known, bounded plan. Disclosed honestly rather than hidden. |

Each control is evaluated against the **eight in-scope public satellites** collectively (`stackweaver-api`, `stackweaver-orchestrator`, `stackweaver-ansible-runner`, `stackweaver-opentofu-runner`, `stackweaver-frontend`, `stackweaver-helm`, `stackweaver-zitadel-init`, `stackweaver-secrets-init`). A status reflects the **worst** satellite, so a ✅ means every in-scope satellite meets it. The former exclusion - the runner, held private while its image still bundled the Terraform CLI - was resolved by the OpenTofu rewrite; it is public and in scope like the rest.

---

## Scope and repository topology

Stackweaver is developed in a single **private monorepo** (`michielvha/stackweaver`) and published as **eight independent satellite repositories** under the [`vhco-pro`](https://github.com/vhco-pro) GitHub organisation. The satellites are what users build, deploy, and audit; the monorepo is an internal development and review gate that is not itself an audit target. Code crosses the boundary through a hardened, two-App, PR-based sync pipeline described in [Sync Architecture](./sync-architecture.md).

| Satellite | Visibility | Contents | Licence |
|-----------|:----------:|----------|:-------:|
| [`stackweaver-api`](https://github.com/vhco-pro/stackweaver-api) | public | REST API server | BSL 1.1 |
| [`stackweaver-orchestrator`](https://github.com/vhco-pro/stackweaver-orchestrator) | public | Job scheduler | BSL 1.1 |
| [`stackweaver-ansible-runner`](https://github.com/vhco-pro/stackweaver-ansible-runner) | public | Ansible execution runner | Apache-2.0 |
| [`stackweaver-frontend`](https://github.com/vhco-pro/stackweaver-frontend) | public | React SPA + public docs | BSL 1.1 |
| [`stackweaver-helm`](https://github.com/vhco-pro/stackweaver-helm) | public | Helm chart | Apache-2.0 |
| [`stackweaver-zitadel-init`](https://github.com/vhco-pro/stackweaver-zitadel-init) | public | Identity-provider bootstrap | BSL 1.1 |
| [`stackweaver-secrets-init`](https://github.com/vhco-pro/stackweaver-secrets-init) | public | Secret bootstrap for the chart | BSL 1.1 |
| [`stackweaver-opentofu-runner`](https://github.com/vhco-pro/stackweaver-opentofu-runner) | public | OpenTofu execution runner | Apache-2.0 |

The two-track licensing (original product under BSL 1.1 with an Apache-2.0 change date; ecosystem tooling under Apache-2.0 from day one) is the project's deliberate model. GitHub's licence classifier reports `NOASSERTION` for the BSL satellites because BSL 1.1 is not an OSI-approved SPDX identifier; this is expected and does not indicate a missing licence file.

---

## Current OpenSSF Scorecard scores

Every satellite runs OpenSSF Scorecard on a schedule and exposes a **live badge**. The badges below always reflect the most recent run; no score is hard-coded in this page, so whatever a badge shows is the current truth. Click any badge for the full per-check breakdown in the Scorecard viewer.

| Satellite | OpenSSF Scorecard (live) |
|-----------|--------------------------|
| stackweaver-api | [![Scorecard](https://api.scorecard.dev/projects/github.com/vhco-pro/stackweaver-api/badge)](https://scorecard.dev/viewer/?uri=github.com/vhco-pro/stackweaver-api) |
| stackweaver-orchestrator | [![Scorecard](https://api.scorecard.dev/projects/github.com/vhco-pro/stackweaver-orchestrator/badge)](https://scorecard.dev/viewer/?uri=github.com/vhco-pro/stackweaver-orchestrator) |
| stackweaver-ansible-runner | [![Scorecard](https://api.scorecard.dev/projects/github.com/vhco-pro/stackweaver-ansible-runner/badge)](https://scorecard.dev/viewer/?uri=github.com/vhco-pro/stackweaver-ansible-runner) |
| stackweaver-frontend | [![Scorecard](https://api.scorecard.dev/projects/github.com/vhco-pro/stackweaver-frontend/badge)](https://scorecard.dev/viewer/?uri=github.com/vhco-pro/stackweaver-frontend) |
| stackweaver-helm | [![Scorecard](https://api.scorecard.dev/projects/github.com/vhco-pro/stackweaver-helm/badge)](https://scorecard.dev/viewer/?uri=github.com/vhco-pro/stackweaver-helm) |
| stackweaver-zitadel-init | [![Scorecard](https://api.scorecard.dev/projects/github.com/vhco-pro/stackweaver-zitadel-init/badge)](https://scorecard.dev/viewer/?uri=github.com/vhco-pro/stackweaver-zitadel-init) |
| stackweaver-secrets-init | [![Scorecard](https://api.scorecard.dev/projects/github.com/vhco-pro/stackweaver-secrets-init/badge)](https://scorecard.dev/viewer/?uri=github.com/vhco-pro/stackweaver-secrets-init) |

For scripted checks, the same data is available as JSON:

```bash
# Live aggregate score for any in-scope satellite
curl -s https://api.scorecard.dev/projects/github.com/vhco-pro/stackweaver-api \
  | jq '.score'
```

A handful of individual Scorecard checks sit below 10 for **structural** reasons that are inherent to a secure automated-publication model rather than gaps in the controls. These are disclosed in full in [§ OpenSSF Scorecard - structural ceilings](#openssf-scorecard---structural-ceilings) so that a low sub-score is not mistaken for an unaddressed weakness.

---

## OSPS Baseline - Level 1

### Access Control

| ID | Requirement (paraphrased) | Status | Evidence & verification |
|----|---------------------------|:------:|-------------------------|
| AC-01.01 | MFA required to modify the authoritative repository | ✅ | Org-wide two-factor **enforcement** is enabled and every member is enrolled. `gh api orgs/vhco-pro --jq .two_factor_requirement_enabled` → `true` |
| AC-02.01 | New collaborators default to least privilege | ✅ | Org base permission is `none`. `gh api orgs/vhco-pro --jq .default_repository_permission` → `none` |
| AC-03.01 | Direct commits to the primary branch are prevented | ✅ | Every in-scope satellite requires a pull request to land on `main`. `gh api repos/vhco-pro/stackweaver-api/branches/main/protection --jq '.required_pull_request_reviews.required_approving_review_count'` → `>= 1` |
| AC-03.02 | Deletion of the primary branch is prevented | ✅ | `gh api repos/vhco-pro/stackweaver-api/branches/main/protection --jq '.allow_deletions.enabled'` → `false` |

### Build & Release Protection

| ID | Requirement | Status | Evidence & verification |
|----|-------------|:------:|-------------------------|
| BR-01.01 | Untrusted CI metadata is sanitised before use | ✅ | Release workflows trigger on tag push (internal, not attacker-controlled). The one `pull_request_target` workflow (`auto-approve-sync.yml`) never checks out or executes PR code and reads only event metadata - see [Sync Architecture § Why `pull_request_target` is safe here](./sync-architecture.md#why-pull_request_target-is-safe-here). |
| BR-01.03 | Untrusted code snapshots cannot access privileged CI credentials | ✅ | No satellite workflow exposes secrets to fork PRs; the OpenSSF Scorecard `Dangerous-Workflow` check scores **10** on all in-scope satellites. |
| BR-03.01 | Official project channels use encrypted transport | ✅ | All channels are HTTPS (GitHub, GHCR, `sw.vhco.pro` docs). |
| BR-03.02 | The official distribution channel is authenticated against adversary-in-the-middle attacks | ✅ | TLS plus Sigstore keyless signing binds every artefact to its producing workflow - see [Verifying a Release](./verifying-releases.md). |
| BR-07.01 | Unencrypted secrets are kept out of version control | ✅ | Secret scanning **and** push protection are enabled on every in-scope satellite. `gh api repos/vhco-pro/stackweaver-api --jq '.security_and_analysis.secret_scanning_push_protection.status'` → `enabled` |

### Documentation

| ID | Requirement | Status | Evidence & verification |
|----|-------------|:------:|-------------------------|
| DO-01.01 | Documentation includes user guides for basic functionality | ✅ | Published at `sw.vhco.pro/docs`; the frontend satellite carries the docs source under `docs/`. |
| DO-02.01 | Documentation includes a defect-reporting guide | ✅ | Org-wide issue templates and a routing `config.yml` are provided via [`vhco-pro/.github`](https://github.com/vhco-pro/.github/tree/main/.github/ISSUE_TEMPLATE), inherited by every satellite. |

### Governance

| ID | Requirement | Status | Evidence & verification |
|----|-------------|:------:|-------------------------|
| GV-02.01 | A mechanism exists for public discussion | ✅ | GitHub Discussions are enabled on every satellite. `gh api repos/vhco-pro/stackweaver-api --jq .has_discussions` → `true` |
| GV-03.01 | The contribution process is documented | ✅ | [`vhco-pro/.github/CONTRIBUTING.md`](https://github.com/vhco-pro/.github/blob/main/CONTRIBUTING.md), inherited org-wide. |

### Licensing

| ID | Requirement | Status | Evidence & verification |
|----|-------------|:------:|-------------------------|
| LE-02.01 | The source-code licence meets the OSI/FSF definition | ⚠️ | Apache-2.0 satellites pass cleanly. The BSL 1.1 satellites are an argued deviation: BSL converts to Apache-2.0 at a fixed change date and its Additional Use Grant permits all use except offering the product as a competing hosted service - see [§ Argued deviations](#argued-deviations). |
| LE-02.02 | The released-asset licence meets the OSI/FSF definition | ⚠️ | Same as LE-02.01; the licence (and a `NOTICE` for Apache satellites) ships inside each container image and chart package. |
| LE-03.01 | The licence is maintained in a `LICENSE` file in the repository | ✅ | Every satellite carries a `LICENSE` file. `gh api repos/vhco-pro/stackweaver-helm --jq .license.spdx_id` → `Apache-2.0` (BSL satellites report `NOASSERTION`, as noted above). |
| LE-03.02 | The licence is included in the released asset bundle | ✅ | Each container image embeds `LICENSE` (and `NOTICE` where applicable); the Helm chart package includes its licence. |

### Quality Assurance

| ID | Requirement | Status | Evidence & verification |
|----|-------------|:------:|-------------------------|
| QA-01.01 | The source repository is publicly readable at a static URL | ⚠️ | All eight satellites are public. The sole remaining deviation is the closed `core/` module, covered by an NDA-gated auditor-access procedure - see [§ Argued deviations](#argued-deviations). |
| QA-01.02 | There is a public record of every change (who and when) | ✅ | Full git history on each satellite. The link to the human reviewer lives upstream in the monorepo and is cryptographically bound to each satellite commit by SLSA provenance referencing the monorepo commit SHA - see [Verifying a Release](./verifying-releases.md). |
| QA-02.01 | The repository contains a list of direct dependencies | ✅ | `go.mod`, `package.json` + lockfile, `pyproject.toml` + `uv.lock`, and `Chart.yaml` are present in the relevant satellites. |
| QA-04.01 | A multi-repository project documents its list of codebases | ✅ | This page (§ Scope and repository topology) and the [`vhco-pro` org profile](https://github.com/vhco-pro) enumerate all eight satellites and the closed `core/` module. |
| QA-05.01 | No generated executable artefacts are stored in version control | ✅ | Build outputs and `node_modules` are gitignored and excluded from sync; the OpenSSF `Binary-Artifacts` check scores **10** on all in-scope satellites. |
| QA-05.02 | No unreviewable binary artefacts are stored in version control | ✅ | Confirmed by the same `Binary-Artifacts` check (score **10**). |

### Vulnerability Management

| ID | Requirement | Status | Evidence & verification |
|----|-------------|:------:|-------------------------|
| VM-02.01 | Documentation contains security contacts | ✅ | [`vhco-pro/.github/SECURITY.md`](https://github.com/vhco-pro/.github/blob/main/SECURITY.md) (inherited org-wide) plus Private Vulnerability Reporting on every satellite. `gh api repos/vhco-pro/stackweaver-api/private-vulnerability-reporting --jq .enabled` → `true` |

---

## OSPS Baseline - Level 3

### Access Control & Build

| ID | Requirement | Status | Evidence & verification |
|----|-------------|:------:|-------------------------|
| AC-04.02 | CI jobs run with the minimum privileges necessary | ✅ | Workflows declare `permissions: {}` at the top level and raise scopes per job. The OpenSSF `Token-Permissions` check scores **10** on all in-scope satellites. |
| BR-01.04 | Trusted-collaborator CI input is sanitised before use | ✅ | The sync pipeline's auto-approval workflow uses only event metadata and refuses any PR touching `.github/workflows/**` - see [Sync Architecture § The four hard gates](./sync-architecture.md#the-four-hard-gates). |
| BR-02.02 | Release assets are clearly associated with the release identifier | ✅ | Every container image is tagged with both `vX.Y.Z` and `sha-<commit>`; release assets (`provenance.intoto.jsonl`, `sbom.spdx.intoto.jsonl`, `checksums.txt`) are attached to the matching GitHub Release. |
| BR-07.02 | A policy exists for managing secrets and credentials | ✅ | Public summary in [`vhco-pro/.github/SECURITY.md`](https://github.com/vhco-pro/.github/blob/main/SECURITY.md); custody, rotation cadence, and compromise response are maintained internally. |

### Documentation (release-time)

| ID | Requirement | Status | Evidence & verification |
|----|-------------|:------:|-------------------------|
| DO-03.01 | Documentation explains how to verify release integrity and authenticity | ✅ | [Verifying a Release](./verifying-releases.md) - `cosign verify` + `gh attestation verify`, live-verified end-to-end on every in-scope satellite. |
| DO-03.02 | Documentation explains how to verify the identity of the release author | ✅ | Same page: identity is the workflow OIDC subject in the Fulcio certificate and Rekor entry shown by each verification command. |
| DO-04.01 | A statement of support scope and duration accompanies each release | ✅ | Supported-versions table in [`vhco-pro/.github/SECURITY.md`](https://github.com/vhco-pro/.github/blob/main/SECURITY.md). |
| DO-05.01 | A statement describes when releases stop receiving security updates | ✅ | End-of-life policy section of the same SECURITY.md. |

### Governance & Quality Assurance

| ID | Requirement | Status | Evidence & verification |
|----|-------------|:------:|-------------------------|
| GV-04.01 | Collaborators are reviewed before being granted escalated permissions | ✅ | Documented in the org access policy; base permission is `none` and escalation is review-gated. |
| QA-02.02 | Compiled released assets are delivered with a software bill of materials | ✅ | Every release attaches an SPDX SBOM attestation. `gh attestation verify -R vhco-pro/stackweaver-api --predicate-type https://spdx.dev/Document oci://ghcr.io/vhco-pro/stackweaver-api:<tag>` |
| QA-04.02 | Subprojects enforce security requirements at least as strict as the primary | ✅ | All satellites share the same upstream gate (lint, tests, govulncheck, Trivy, CodeQL) and the same reusable Scorecard/CodeQL workflows - see [Sync Architecture](./sync-architecture.md). |
| QA-06.02 | Documentation clearly describes how tests are run | ✅ | Each satellite README documents `go test ./...` / `npm test` as applicable; the monorepo `Makefile` is the canonical entrypoint. |
| QA-06.03 | A policy requires major changes to add or update automated tests | ✅ | Stated in [`vhco-pro/.github/CONTRIBUTING.md`](https://github.com/vhco-pro/.github/blob/main/CONTRIBUTING.md). |
| QA-07.01 | Primary-branch commits require at least one non-author human approval | ⚠️ | Authoritative human review happens upstream in the monorepo; satellite commits are a deterministic, signed re-publication bound to the reviewed monorepo commit by SLSA provenance. Satellites additionally require an approving review on every PR. See [§ Argued deviations](#argued-deviations). |

### Security Architecture

| ID | Requirement | Status | Evidence & verification |
|----|-------------|:------:|-------------------------|
| SA-03.02 | A threat model and attack-surface analysis is performed | ✅ | A STRIDE threat model covers each component and the satellite-sync trust boundary; the public portion is documented in [Sync Architecture § Threat model](./sync-architecture.md#threat-model). |

### Vulnerability Management

| ID | Requirement | Status | Evidence & verification |
|----|-------------|:------:|-------------------------|
| VM-04.02 | A VEX document accompanies releases for non-affecting vulnerabilities | ✅ | Every release publishes a signed OpenVEX document as a keyless cosign/Sigstore attestation (predicate type `https://openvex.dev/ns/v0.2.0`) alongside the image, verifiable with `gh attestation verify`. Non-affecting findings are recorded in `security/vex/*.openvex.json` and attested at release time. |
| VM-05.01 | A policy defines remediation thresholds for SCA findings | ✅ | Remediation SLOs (Critical / High / Medium / Low) are defined and wired into the release gate. |
| VM-05.02 | A policy requires SCA violations to be addressed prior to release | ✅ | `govulncheck` and Trivy run as blocking upstream checks; a release cannot ship with an outstanding blocking finding. |
| VM-05.03 | Changes are automatically evaluated against a malicious-dependency / known-vulnerability policy and blocked on violation | ✅ | `govulncheck` + Trivy + Dependency-Review run on every change; the OpenSSF `Vulnerabilities` and `Dependency-Update-Tool` checks score **10**. |
| VM-06.01 | A policy defines remediation thresholds for SAST findings | ✅ | Defined in the vulnerability-management policy; CodeQL findings are tracked to closure (the late-audit CodeQL sweep closed all 21 findings across the public satellites). |
| VM-06.02 | Changes are automatically evaluated against a SAST policy and blocked on violation | ✅ | CodeQL runs on every sync PR and is a required status check before merge; the OpenSSF `SAST` check scores **10** on the Go satellites. |

---

## Argued deviations

OSPS Baseline explicitly permits a control to be satisfied by a documented, compensated deviation. Stackweaver relies on three, all disclosed here in full.

### 1. The `core/` shared module is not public (LE-02.01, QA-01.01, QA-04.02)

The shared Go module `core/` is kept private until Stackweaver is an established commercial entity, on the grounds that a permissive source licence alone is not considered sufficient protection against AI-assisted re-implementation. **Compensating control:** an auditor is granted read-only access to a `core/` mirror under a one-off NDA, together with a reproducible-build recipe, so the closed module can be reviewed without being published. This converts the affected controls from open findings into argued deviations. The process is referenced from the public [`SECURITY.md`](https://github.com/vhco-pro/.github/blob/main/SECURITY.md).

### 2. Satellite commits are an automated re-publication, not human-authored (QA-07.01, Scorecard `Code-Review`)

The monorepo→satellite sync is automated and bot-authored by design, because PR-review automation on the *publication* step has repeatedly been a supply-chain breach vector. Authoritative human review happens **upstream** on the private monorepo, and each satellite commit is cryptographically bound to its reviewed monorepo origin by a Sigstore-signed commit plus SLSA Build L3 provenance. On the satellite side, every sync still flows through a pull request that is gated by four hard security checks, approved, and merged under branch protection that requires a review, dismisses stale reviews, enforces admins, and blocks force-pushes and deletions - the complete model is in [Sync Architecture](./sync-architecture.md).

Because the approving reviewer on the satellite is a GitHub App (`stackweaver-pr-reviewer[bot]`) and the authoritative human review is on the *private* upstream that an external tool cannot see, the OpenSSF Scorecard `Code-Review` check scores 0 on the satellites even though every change is in fact reviewed. This is a structural property of the model, not an unreviewed-change finding.

### 3. ~~`stackweaver-runner` is held private~~ - resolved (QA-01.01)

**Resolved.** The runner was private because its image bundled the Terraform CLI, which the project will not redistribute under BUSL-1.1. It has since been rewritten on OpenTofu (MPL-2.0) and published as [`stackweaver-opentofu-runner`](https://github.com/vhco-pro/stackweaver-opentofu-runner), which is public and carries the identical sync pipeline, branch protection, and attestation set as the rest of the fleet - so this deviation no longer applies. The legacy private repository is retired and referenced by no workflow. See [Sync Architecture § Formerly excluded: the OpenTofu runner](./sync-architecture.md#formerly-excluded-the-opentofu-runner).

---

## OpenSSF Scorecard - structural ceilings

A few Scorecard checks cannot reach 10 under a secure automated-publication model. They are disclosed here so that a low sub-score (visible by expanding any badge above) is read correctly: it reflects a heuristic that assumes a human-PR workflow, not an unaddressed control.

| Check | Why it is capped | Is it a real gap? |
|-------|------------------|-------------------|
| `Code-Review` | Scorecard does not credit approvals authored by a GitHub App, and the authoritative human review is on the private upstream it cannot see. | No - see argued deviation 2. Every change is reviewed upstream and bound by provenance. |
| `Branch-Protection` | The highest tiers require ≥ 2 reviewers, which is incompatible with the single automated reviewer identity. Force-push and deletion are already blocked, admins enforced, stale reviews dismissed, and PRs + status checks required. | Partly improvable (up-to-date-branches, last-push-approval, CODEOWNERS are candidate levers under evaluation); the ≥ 2-reviewer tier is structurally out of reach. |
| `Packaging` | Scorecard cannot introspect a reusable-workflow caller, so it does not detect the container-publish step that lives in the shared workflow. | No - packages are published and signed; this is a known Scorecard static-analysis limitation, reported upstream. |
| `CII-Best-Practices` | Requires self-registration of each satellite at bestpractices.dev. | No - an administrative task in progress; `stackweaver-api` is already registered. |
| `Contributors` | Counts distinct contributing organisations; the project currently has one. | No - rises naturally as external contributions arrive. |

Pushing the aggregate higher would require re-introducing a human reviewer into every automated publication step, which the threat model in [Sync Architecture](./sync-architecture.md) deliberately rejects.

---

## One-shot independent verification

The following block requires no privileged access. A clean run against any in-scope satellite confirms the controls above are live in production.

```bash
SAT=stackweaver-api   # try any of: api, orchestrator, ansible-runner, frontend, helm, zitadel-init

# Live Scorecard score
curl -s "https://api.scorecard.dev/projects/github.com/vhco-pro/$SAT" | jq '.score'

# Repository posture: discussions, secret scanning, push protection, PVR
gh api repos/vhco-pro/$SAT --jq '{discussions: .has_discussions, secret_scanning: .security_and_analysis.secret_scanning.status, push_protection: .security_and_analysis.secret_scanning_push_protection.status}'
gh api repos/vhco-pro/$SAT/private-vulnerability-reporting --jq '{pvr_enabled: .enabled}'

# Branch protection on main
gh api repos/vhco-pro/$SAT/branches/main/protection --jq '{reviews_required: .required_pull_request_reviews.required_approving_review_count, dismiss_stale: .required_pull_request_reviews.dismiss_stale_reviews, force_push: .allow_force_pushes.enabled, deletions: .allow_deletions.enabled, enforce_admins: .enforce_admins.enabled}'

# Org base permission (least privilege)
gh api orgs/vhco-pro --jq '{default_repository_permission, two_factor_requirement_enabled}'
```

For artefact-level verification (signatures, SLSA provenance, SBOM) and the full sync-pipeline threat model, follow [Verifying a Release](./verifying-releases.md) and [Sync Architecture](./sync-architecture.md). If any documented check fails against an artefact from an official location, treat it as untrusted and report it via a [Private Vulnerability Report](https://github.com/vhco-pro/.github/security/policy) or to `contact@vhco.pro`.
