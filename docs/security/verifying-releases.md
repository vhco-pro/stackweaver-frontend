<!--
Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
-->
---
description: "How to cryptographically verify a Stackweaver release — container images today, SLSA build provenance and SBOM attestations once Wave 6 of the OSPS audit completes. Uses Sigstore keyless signing; no long-lived signing keys are involved."
covers:
  - ".github/workflows/**"
  - "deploy/helm/**"
---

# Verifying a Stackweaver Release

Stackweaver follows a **Sigstore-only signing policy**: there are no long-lived PGP or cosign keys to download, and no public-key fingerprint to compare against. Every signed artefact is bound to the GitHub Actions workflow that produced it via a short-lived Fulcio certificate and recorded in the Rekor public transparency log. Verification therefore proves both "this artefact really came out of the Stackweaver release pipeline" and "the transparency log agrees", in a single command, with no project-specific key material.

This page only documents what has been **verified to actually work today** against the live releases on the `vhco-pro` organisation. Anything that is wired but not yet active (because it is gated on the Wave-6 visibility flip described in the [OSPS Baseline audit](https://github.com/vhco-pro/.github/blob/main/SECURITY.md)) is called out explicitly so you do not waste time running commands that are guaranteed to 404 today.

If any documented verification fails against an artefact you obtained from an official location (`ghcr.io/vhco-pro/*` or a `vhco-pro/stackweaver-*` GitHub Release page), treat the artefact as untrusted and report it via a [Private Vulnerability Report](https://github.com/vhco-pro/.github/security/policy) or to `contact@vhco.pro`.

For background on how code actually reaches the satellite repositories (the trust boundary between the private monorepo and the public satellites that produce these artefacts), see [Sync Architecture](./sync-architecture.md).

## What's Verifiable Today vs After the Wave-6 Flip

| Artefact | Mechanism | Status |
|----------|-----------|--------|
| Container image signature (`cosign verify`) | Sigstore keyless, signed by satellite `release.yml` workflow | ✅ **Live today** on all 6 docker satellites |
| Sync-commit identity (`gitsign verify`) | Sigstore keyless, signed by monorepo `sync-<component>.yml` workflow | ✅ **Live today** on sync commits (not on chart-releaser auto-bumps) |
| SLSA Build L3 provenance (`gh attestation verify`) | `actions/attest-build-provenance` from satellite `release.yml`, gated on `visibility == 'public'` | ⏳ **Active after Wave 6** — workflow steps are wired but skipped while satellites are private |
| SBOM attestation (SPDX) | `actions/attest-sbom` from satellite `release.yml`, gated on `visibility == 'public'` | ⏳ **Active after Wave 6** — same gate |
| Helm chart `cosign verify` (Sigstore keyless) | `stackweaver-helm/.github/workflows/release.yml` runs `cosign sign` against the OCI chart ref after `helm push` | ✅ **Live today** for chart versions ≥ `0.6.8` |
| Helm chart SBOM (`cosign verify-attestation`, SPDX) | Same workflow runs `syft scan` → `cosign attest --type spdx` | ✅ **Live today** for chart versions ≥ `0.6.8` |
| Helm chart `gh attestation verify` (SLSA + SBOM) | Plumbed in the same workflow but gated on `visibility == 'public'` | ⏳ **Activates on Wave-6 flip** (no code change pending) |

## Tools

Install once and reuse for every release. No project-specific configuration is required.

| Tool | Used for | Install |
|------|---------|--------|
| `cosign` | Container-image signature verification | `go install github.com/sigstore/cosign/v2/cmd/cosign@latest` or see <https://docs.sigstore.dev/cosign/system_config/installation/> |
| `gh` (GitHub CLI) | SLSA + SBOM attestation verification (post-Wave 6) | <https://cli.github.com/> |
| `gitsign` | Sync-commit identity verification | `go install github.com/sigstore/gitsign@latest` or see <https://github.com/sigstore/gitsign#installation> |

Verified working with `cosign v2`, `gh 2.87+`, `gitsign v0.13+`.

## Verifying a Container Image (Live Today)

Replace `<component>` with one of `api`, `orchestrator`, `runner`, `ansible-runner`, `frontend`, `zitadel-init` and `<tag>` with the release tag.

```bash
IMAGE=ghcr.io/vhco-pro/stackweaver-<component>:<tag>

cosign verify \
  --certificate-identity-regexp "^https://github\.com/vhco-pro/stackweaver-<component>/\.github/workflows/release\.yml@refs/tags/.+$" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  "$IMAGE"
```

The command succeeds only if (a) the image bears a cosign signature, (b) the signing certificate was issued by Fulcio to a GitHub Actions workflow whose path matches the regular expression above, and (c) the signature is present in the Rekor transparency log. A successful run prints a JSON payload containing the image digest and the OCI reference — keep both for your audit trail.

For production deployments you may want to pin to one exact tag rather than allowing any tag. Replace the trailing `.+$` in the regex with the literal tag, for example `v1\.4\.2$`.

> **Note on GHCR access.** The OCI packages on `ghcr.io/vhco-pro/*` are configured to be pullable without authentication even where the parent GitHub repository is still private. You do **not** need to `docker login` to GHCR to run `cosign verify`.

### A real, working example

The following command produces a successful verification at the time of writing:

```bash
cosign verify \
  --certificate-identity-regexp "^https://github\.com/vhco-pro/stackweaver-api/\.github/workflows/release\.yml@refs/tags/.+$" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  ghcr.io/vhco-pro/stackweaver-api:0.6.8
```

## Verifying SLSA Build Provenance (Available After Wave 6)

Once the 6 currently-private docker satellites flip to public during Wave 6 of the OSPS audit, every release will additionally publish a [SLSA Build L3 provenance attestation](https://slsa.dev/spec/v1.0/levels#build-l3) binding the released container digest to the upstream monorepo commit SHA and the workflow run that built it. The `attest-build-provenance` step is already present in every satellite `release.yml` but is gated on `github.event.repository.visibility == 'public'`, so it currently no-ops on the 6 private satellites and there is no attestation to fetch yet.

When live, the verification command will be:

```bash
gh attestation verify \
  -R vhco-pro/stackweaver-<component> \
  "oci://ghcr.io/vhco-pro/stackweaver-<component>:<tag>"
```

Note the `-R owner/repo` form — `--repo stackweaver-<component>` (just the name) is **not** accepted by `gh attestation verify`. You can also omit `-R` and pass `--owner vhco-pro` to verify against any repository in the organisation.

A successful verification proves four things in one shot: the image digest exists, an attestation was published for that exact digest, the attestation was issued by a workflow in the named repository, and the issuer's certificate (again from Sigstore Fulcio) is logged in Rekor.

## Verifying the SBOM (Available After Wave 6)

The SBOM is published as a Sigstore-signed attestation in SPDX format, **not** as a GitHub Release asset. The verification command is identical to the SLSA one, with one additional flag selecting the predicate type:

```bash
gh attestation verify \
  -R vhco-pro/stackweaver-<component> \
  --predicate-type https://spdx.dev/Document \
  "oci://ghcr.io/vhco-pro/stackweaver-<component>:<tag>"
```

Subject to the same Wave-6 gating as the SLSA attestation.

## Verifying the Helm Chart

The Helm chart is published as an OCI artefact at:

```
ghcr.io/vhco-pro/charts/stackweaver:<chart-version>
```

(Note the path: `charts/stackweaver`, **not** `stackweaver-helm/charts/stackweaver`.)

The chart is pullable today without authentication. As of chart version **`0.6.8`** (released 2026-05-24), every chart push is Sigstore-signed and ships with an SPDX SBOM attestation — both produced keylessly by the `stackweaver-helm` release workflow. Earlier chart versions are unsigned and can only be integrity-checked by digest comparison against the matching [GitHub Release](https://github.com/vhco-pro/stackweaver-helm/releases).

### Verify the chart signature

```bash
cosign verify \
  --certificate-identity-regexp "^https://github\.com/vhco-pro/stackweaver-helm/\.github/workflows/release\.yml@refs/tags/.+$" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  ghcr.io/vhco-pro/charts/stackweaver:<chart-version>
```

A successful run prints the three Sigstore claims (cosign claims valid, Rekor entry exists, certificate chains to Fulcio) followed by the signed payload as JSON.

### Verify the chart SBOM attestation

```bash
cosign verify-attestation \
  --certificate-identity-regexp "^https://github\.com/vhco-pro/stackweaver-helm/\.github/workflows/release\.yml@refs/tags/.+$" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  --type "https://spdx.dev/Document/v2.3" \
  ghcr.io/vhco-pro/charts/stackweaver:<chart-version>
```

The decoded payload is an in-toto Statement whose `predicate` is the full SPDX-2.3 SBOM of the packaged `stackweaver-<version>.tgz` produced by syft.

### GitHub-native SLSA + SBOM attestations

The same workflow also produces `actions/attest-build-provenance` (SLSA L3) and `actions/attest-sbom` records, but the GitHub attestation API requires GHAS on private repositories, so these steps are gated on `github.event.repository.visibility == 'public'`. Once the satellite flips public in Wave 6, `gh attestation verify -R vhco-pro/stackweaver-helm oci://ghcr.io/vhco-pro/charts/stackweaver:<version>` will resolve for any chart cut after the flip.

## Verifying Sync-Commit Identity

Satellites are deterministic re-publications of the private monorepo, pushed by the `stackweaver-release-bot` GitHub App. Every sync commit is signed with `gitsign`, so its author identity is bound to the same Sigstore OIDC chain as the container signatures.

There is one important subtlety: the certificate identity on a sync commit points at the **monorepo workflow that produced the sync**, not at the satellite. The signing identity is therefore `https://github.com/michielvha/stackweaver/.github/workflows/sync-<component>.yml@<ref>`, **not** `https://github.com/vhco-pro/...`. The signature is still cryptographically valid and the Rekor entry is still public; this just reflects the fact that the sync is driven by a workflow that lives in the upstream monorepo.

```bash
git clone https://github.com/vhco-pro/stackweaver-<component>
cd stackweaver-<component>

# Pick an actual sync commit, not a chart-releaser auto-bump. Sync commits
# are authored by "stackweaver-release-bot[bot]"; on most satellites HEAD
# is a sync commit, but on stackweaver-helm HEAD may be a chart-releaser
# README bump which is not gitsign-signed.
SYNC_COMMIT=$(git log --format='%H %ae' | grep stackweaver-release-bot | head -1 | awk '{print $1}')

gitsign verify \
  --certificate-identity-regexp "^https://github\.com/michielvha/stackweaver/\.github/workflows/sync-<component>\.yml@.+$" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  "$SYNC_COMMIT"
```

A successful run prints the Rekor log index, the Fulcio certificate ID, the signing workflow URL, and the four lines:

```
Validated Git signature: true
Validated Rekor entry: true
Validated Certificate claims: true
```

### Known caveats

**GitHub UI badge.** The GitHub web UI shows gitsign-signed commits with a yellow `Unverified` (`bad_cert`) badge because GitHub's verified-CA list does not yet include Sigstore Fulcio. The `gitsign verify` command above, together with the Rekor entry it prints, is the authoritative check. This is a documented Sigstore-GitHub interop gap, not a Stackweaver-specific problem.

**Monorepo source visibility.** The cert subject points at a workflow that lives in `michielvha/stackweaver`, which is intentionally private (see the OSPS audit's `D-CORE` decision and the `core/` audit-access procedure). Until the monorepo is opened, external consumers verifying a sync commit can prove the signature came from the Stackweaver sync pipeline but cannot independently inspect what that pipeline does. The Stackweaver threat model and the rationale for keeping the monorepo private are published at <https://github.com/vhco-pro/.github/blob/main/SECURITY.md>.

**Non-sync commits.** Commits made by other identities — for example chart-releaser's `github-actions[bot]` README updates on `stackweaver-helm`, or direct maintainer commits — are not currently gitsign-signed and will fail verification. Always pick a `stackweaver-release-bot[bot]` commit as your verification target.

## What's Deliberately Not Here

You may have seen verification guides that recommend importing a project GPG key, comparing checksums against a SHA256SUMS file, or downloading a long-lived `cosign.pub`. None of those steps apply to Stackweaver:

- We do not publish standalone binaries — distribution is container-only (plus the Helm chart) — so there is no archive to checksum-sign, and the monorepo's `.goreleaser.yml` does not run in CI.
- We do not publish a project GPG key. The OSPS audit decision **D-SIG-NOKEY** explicitly rules out long-lived signing keys, on the grounds that key custody and rotation are the most common failure modes in supply-chain attacks and Sigstore eliminates the key-custody problem entirely.
- We do not publish a long-lived cosign public key. The signing identity for every release is the GitHub Actions workflow that produced it, observable in the Fulcio certificate subject and the Rekor log entry shown by every `cosign verify` / `gh attestation verify` run.
- We do not publish the SBOM as a GitHub Release asset. The SBOM is a Sigstore-signed OCI attestation (`--predicate-type https://spdx.dev/Document`); if you need the raw SPDX document, extract it from the attestation rather than expecting it on the Releases page.

## Reporting a Verification Failure

If `cosign verify`, `gh attestation verify`, or `gitsign verify` fail on an artefact that you obtained from an official location, file a [Private Vulnerability Report](https://github.com/vhco-pro/.github/security/policy) on the affected satellite immediately, or email `contact@vhco.pro` with the artefact reference, the failing command output, and the Rekor log index if one was returned. Do not open a public issue.

The full project security policy lives at [github.com/vhco-pro/.github/blob/main/SECURITY.md](https://github.com/vhco-pro/.github/blob/main/SECURITY.md).
