<!--
Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
-->
---
description: "How code reaches the public Stackweaver satellite repositories. Documents the two-App, PR-based sync model, the four hard security gates that govern every automated merge, and the commands an external reviewer can run to verify the design is correctly deployed in production."
covers:
  - ".github/workflows/sync-*.yml"
  - ".github/workflows/auto-approve-sync.yml"
---

# Sync Architecture

Stackweaver is developed as a private monorepo at `michielvha/stackweaver`. Each user-facing component is mirrored to its own public satellite repository under the `vhco-pro` organisation (`stackweaver-api`, `stackweaver-frontend`, `stackweaver-orchestrator`, `stackweaver-zitadel-init`, `stackweaver-ansible-runner`, `stackweaver-helm`, and `stackweaver-runner`). The satellites are what users build, audit and depend on; the monorepo is what we develop in.

This page documents how code travels from the monorepo to a satellite. It is the authoritative description of the trust boundary between "internal development" and "what the public consumes", so it should be read before relying on any signed artefact produced by a satellite, before performing an OSPS Baseline audit on the project, and before contributing to any sync-related workflow.

## Two GitHub Apps, two identities, two keys

The sync pipeline uses two GitHub Apps with distinct private keys and minimum-privilege permission sets. Both Apps are owned by the `vhco-pro` organisation. Their permissions are pinned in their App settings and visible to anyone via `gh api /apps/<slug>`.

| App | Permissions | Used by | What it can do |
|-----|-------------|---------|----------------|
| `stackweaver-release-bot` | `contents:write`, `pull_requests:write`, `workflows:write` | Monorepo `sync-*.yml` workflows | Create the `sync/<sha>` branch on the satellite and open the pull request. |
| `stackweaver-pr-reviewer` | `pull_requests:write`, `contents:read`, `metadata:read` | Satellite `auto-approve-sync.yml` workflow | Post an approving review and call `gh pr merge --auto --squash`. Cannot push code, cannot read secrets, cannot modify workflows, cannot change repository settings. |

Two Apps are required because GitHub explicitly forbids an App from approving its own pull requests. The author of the PR (the release-bot) and the approver of the PR (the pr-reviewer) must be different identities. This separation of duties is enforced server-side by GitHub and is the foundation of the entire model.

## Lifecycle of a sync

Every push to `main` on the monorepo triggers the following sequence for each affected satellite:

```
monorepo push to main
        │
        ▼
monorepo .github/workflows/sync-<sat>.yml         [release-bot token]
   • check out monorepo
   • copy the synced subset to a working tree
   • check out the satellite, apply the diff
   • push to branch sync/<short-sha>
   • open a PR via peter-evans/create-pull-request
        │
        ▼
satellite repo: pull request opens
        │
        │  triggers pull_request_target event
        ▼
satellite .github/workflows/auto-approve-sync.yml  [pr-reviewer token]
   evaluates four gates in order; ALL must pass:
   1. event.pull_request.user.login == "stackweaver-release-bot[bot]"
   2. startsWith(event.pull_request.head.ref, "sync/")
   3. event.pull_request.head.repo.full_name == event.pull_request.base.repo.full_name
   4. no file under .github/workflows/** appears in changed_files
   if all pass:
      gh pr review --approve
      gh pr merge --auto --squash
   otherwise:
      exit 0, leaving the PR open for manual review
        │
        ▼
branch protection on main
   • requires one approving review (provided by the gate above)
   • requires all status checks to pass (CodeQL, lint, tests)
   • dismisses stale reviews on any push to the PR
   • applies to administrators with no bypass
        │
        ▼
when CI passes AND the review is still valid
   GitHub server-side performs the squash merge
        │
        ▼
merge to main
   • triggers GitVersion Tag, then Release, then release-assets
   • the OSSF Scorecard "Code-Review" check counts the approved, merged PR
```

Typical end-to-end latency is three to five minutes, dominated by CI runtime on the satellite. Nothing in this path requires human intervention under normal operation.

## The four hard gates

The auto-approval workflow performs no other logic. It does not check out the pull request, it does not execute any code from the pull request, and it does not consult any data inside the diff. It only reads `github.event.pull_request.*` metadata and calls two GitHub REST endpoints. The four gates are:

**Gate 1: bot identity.** The pull request author must be `stackweaver-release-bot[bot]`. GitHub reserves the `[bot]` suffix for App-authored actions, so it cannot be spoofed by a human account or by another App. Even an attacker with a legitimate GitHub account named `stackweaver-release-bot` cannot match this gate because human accounts never carry the `[bot]` suffix.

**Gate 2: branch convention.** The pull request branch must start with `sync/`. This is a sanity check that pairs with gate 1 to ensure the workflow only acts on pull requests that match the sync pattern.

**Gate 3: no forks.** The pull request must originate from the satellite repository itself, not from a fork. This prevents a hypothetical attack where someone forks a satellite, creates a `sync/exploit` branch, and tries to bait the workflow into reviewing it.

**Gate 4: no workflow tampering.** The pull request must not modify any file under `.github/workflows/`. This is the most important gate, because without it a single malicious sync PR could rewrite `auto-approve-sync.yml` itself to weaken all future gates. Belt and suspenders: the pr-reviewer App lacks the `workflows:write` permission, so GitHub also rejects such merges server-side even if the gate were somehow bypassed.

## Why `pull_request_target` is safe here

GitHub Actions distinguishes between `pull_request` (the workflow runs in the context of the pull request, with read-only `GITHUB_TOKEN`, and cannot access secrets when the PR comes from a fork) and `pull_request_target` (the workflow runs in the context of the base branch, with full secrets access). The latter is notorious for privilege-escalation attacks when authors check out and execute pull request code with secrets in scope.

`auto-approve-sync.yml` uses `pull_request_target` because it needs access to the pr-reviewer App credentials. It is safe to do so because it never runs `actions/checkout` for any ref, never executes any code from the pull request, and never reads pull request file contents. Its only inputs are the metadata fields evaluated in the four gates above. Its only outputs are two API calls. The privilege-escalation pattern that makes `pull_request_target` dangerous in other contexts is structurally impossible here.

## Threat model

| # | Threat | Mitigation |
|---|--------|------------|
| T1 | External attacker opens a pull request from a fork named `sync/exploit`, hoping for auto-approval. | Gate 1 (the `[bot]` suffix is unspoofable). |
| T2 | Attacker forks a satellite, opens a PR from `sync/foo` while spoofing a display name. | Gate 3 (no forks). |
| T3 | `pull_request_target` privilege escalation. | Workflow performs zero checkout of any ref and only makes API calls; gate logic uses only event metadata, never PR file contents. |
| T4 | Malicious sync PR modifies the auto-approve workflow itself. | Gate 4 plus pr-reviewer App lacks `workflows:write`. |
| T5 | release-bot App private key leak. | Keys are gitignored, never committed; attacker still needs the satellite CI suite (CodeQL, lint, tests) to pass on their PR; GitHub audit log records every App authentication; keys are rotated annually and on suspicion of compromise. |
| T6 | pr-reviewer App private key leak. | Worst case: attacker can approve any open PR. But to be merged a PR must also match gate 1, which requires the release-bot key. A full exploit therefore requires a two-key compromise. |
| T7 | Two concurrent monorepo syncs open competing PRs. | The monorepo `sync-*.yml` workflows use `concurrency: { group: sync-<sat>, cancel-in-progress: false }`. |
| T8 | Approval survives a malicious push made after approval. | Branch protection has `dismiss_stale_reviews: true`. Any push to the PR branch invalidates the review and prevents auto-merge from firing. |
| T9 | Branch-protection bypass by an administrator. | Branch protection has `enforce_admins: true`, `allow_force_pushes: false`, `allow_deletions: false`. |

## Comparison with the previous direct-push model

Before the Wave 7 hardening described above, the monorepo sync workflows used the release-bot App to push directly to the satellite `main` branch with no review and no PR. That model had three problems: a single compromised App key was sufficient for full satellite compromise, no change had a queryable review trail, and CI ran only after the merge. The PR-based model is strictly more secure on all three counts. The cost is roughly three to five minutes of added end-to-end latency per sync and one additional App to manage credentials for.

## Independent verification

An external reviewer can verify the design above is correctly deployed in production by running the following commands. None of them require special access; they only use the public GitHub REST API and read-only `gh` CLI calls. Run them against any satellite to confirm.

```bash
# 1. Confirm pr-reviewer App permissions match the design
gh api /apps/stackweaver-pr-reviewer --jq '.permissions'
# Expect: {"contents":"read","metadata":"read","pull_requests":"write"}

# 2. Confirm both Apps are installed on the satellite
gh api /repos/vhco-pro/stackweaver-api/installation --jq '.app_slug'
# Run for each of: stackweaver-api, stackweaver-frontend, stackweaver-orchestrator,
# stackweaver-zitadel-init, stackweaver-ansible-runner, stackweaver-helm, stackweaver-runner

# 3. Confirm the auto-approve workflow has all four gates and zero PR-ref checkouts
gh api /repos/vhco-pro/stackweaver-api/contents/.github/workflows/auto-approve-sync.yml \
  --jq '.content' | base64 -d \
  | grep -E "user.login|head.ref|head.repo|workflows/|actions/checkout"
# Expect: matches for the four gate predicates, zero matches for actions/checkout

# 4. Confirm branch protection on main matches the design
gh api /repos/vhco-pro/stackweaver-api/branches/main/protection \
  --jq '{
    reviews_required: .required_pull_request_reviews.required_approving_review_count,
    dismiss_stale: .required_pull_request_reviews.dismiss_stale_reviews,
    checks: .required_status_checks.contexts,
    force_push: .allow_force_pushes.enabled,
    deletions: .allow_deletions.enabled,
    enforce_admins: .enforce_admins.enabled
  }'
# Expect: reviews_required >= 1, dismiss_stale true, checks non-empty,
#         force_push false, deletions false, enforce_admins true
```

A clean run of these four blocks against any in-scope satellite is sufficient evidence that the sync model documented on this page is the model actually enforced in production. If any check fails, treat the satellite as untrusted and report it via a [Private Vulnerability Report](https://github.com/vhco-pro/.github/security/policy) or to `contact@vhco.pro`.

## Where to look in the source

* The reusable monorepo sync workflows live under `.github/workflows/sync-*.yml` in `michielvha/stackweaver` (private; not directly browseable by external reviewers, but their behaviour is fully observable from the satellite side via the gates listed above).
* The `auto-approve-sync.yml` workflow lives under `.github/workflows/` in every satellite. It is identical across satellites.
* Branch protection settings live in repository settings and are queryable via the GitHub REST API as shown above.
* The two GitHub Apps' permission sets are pinned in their App settings under `vhco-pro/settings/apps` and are queryable via `gh api /apps/<slug>`.
