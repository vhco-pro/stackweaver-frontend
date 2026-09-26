---
description: "How to cryptographically verify a Stackweaver release - container image signatures, SLSA build provenance, and SBOM attestations. Uses Sigstore keyless signing; no long-lived signing keys are involved."
covers:
  - ".github/workflows/**"
  - "deploy/helm/**"
---

<!--
Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
-->

# Verifying a Stackweaver Release

Stackweaver follows a **Sigstore-only signing policy**: there are no long-lived PGP or cosign keys to download, and no public-key fingerprint to compare against. Every signed artefact is bound to the GitHub Actions workflow that produced it via a short-lived Fulcio certificate and recorded in the Rekor public transparency log. Verification therefore proves both "this artefact really came out of the Stackweaver release pipeline" and "the transparency log agrees", in a single command, with no project-specific key material.

This page only documents what has been **verified to actually work today** against the live releases on the `vhco-pro` organisation. All eight satellites are public and fully verifiable, including the runner satellite [`stackweaver-opentofu-runner`](https://github.com/vhco-pro/stackweaver-opentofu-runner), whose releases carry the same Sigstore signature plus GitHub-native SLSA provenance and SBOM attestations as the rest of the fleet. The retired private `stackweaver-runner` repository is not part of the release surface.

If any documented verification fails against an artefact you obtained from an official location (`ghcr.io/vhco-pro/*` or a `vhco-pro/stackweaver-*` GitHub Release page), treat the artefact as untrusted and report it via a [Private Vulnerability Report](https://github.com/vhco-pro/.github/security/policy) or to `contact@vhco.pro`.

For background on how code actually reaches the satellite repositories (the trust boundary between the private monorepo and the public satellites that produce these artefacts), see [Sync Architecture](./sync-architecture.md).

## What's Verifiable Today

| Artefact | Mechanism | Status |
|----------|-----------|--------|
| Container image signature (`cosign verify`) | Sigstore keyless, signed by satellite `release.yml` workflow | ✅ **Live today** on all docker satellites |
| Sync-commit identity (`gitsign verify`) | Sigstore keyless, signed by monorepo `sync-<component>.yml` workflow | ✅ **Live today** on sync commits (not on chart-releaser auto-bumps) |
| SLSA Build L3 provenance (`gh attestation verify`) | `actions/attest-build-provenance` from satellite `release.yml`, gated on `visibility == 'public'` | ✅ **Live today** on all docker satellites |
| SBOM attestation (SPDX) | `actions/attest-sbom` from satellite `release.yml`, gated on `visibility == 'public'` | ✅ **Live today** on all docker satellites |
| OpenVEX attestation (`gh attestation verify`) | `actions/attest` from satellite `release.yml` over `security/vex/*.openvex.json`, gated on `visibility == 'public'` | ✅ **Live today** on all docker satellites |
| Helm chart `cosign verify` (Sigstore keyless) | `stackweaver-helm/.github/workflows/release.yml` runs `cosign sign` against the OCI chart ref after `helm push` | ✅ **Live today** for chart versions ≥ `0.6.8` |
| Helm chart SLSA L3 + SBOM (SPDX) + OpenVEX (`gh attestation verify`) | `actions/attest-build-provenance` / `actions/attest-sbom` / `actions/attest` from `stackweaver-helm/.github/workflows/release.yml`, gated on `visibility == 'public'` | ✅ **Live today** for chart versions ≥ `0.7.8` (the helm satellite is public) |

## Tools

Install once and reuse for every release. No project-specific configuration is required.

| Tool | Used for | Install |
|------|---------|--------|
| `cosign` | Container-image signature verification | `go install github.com/sigstore/cosign/v2/cmd/cosign@latest` or see <https://docs.sigstore.dev/cosign/system_config/installation/> |
| `gh` (GitHub CLI) | SLSA + SBOM attestation verification | <https://cli.github.com/> |
| `gitsign` | Sync-commit identity verification | `go install github.com/sigstore/gitsign@latest` or see <https://github.com/sigstore/gitsign#installation> |

Verified working with `cosign v2`, `gh 2.87+`, `gitsign v0.13+`.

## Verifying a Container Image (Live Today)

Replace `<component>` with one of `api`, `orchestrator`, `opentofu-runner`, `ansible-runner`, `frontend`, `zitadel-init` and `<tag>` with the release tag.

```bash
IMAGE=ghcr.io/vhco-pro/stackweaver-<component>:<tag>

cosign verify \
  --certificate-identity-regexp "^https://github\.com/vhco-pro/stackweaver-<component>/\.github/workflows/release\.yml@refs/tags/.+$" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  "$IMAGE"
```

The command succeeds only if (a) the image bears a cosign signature, (b) the signing certificate was issued by Fulcio to a GitHub Actions workflow whose path matches the regular expression above, and (c) the signature is present in the Rekor transparency log. A successful run prints a JSON payload containing the image digest and the OCI reference - keep both for your audit trail.

For production deployments you may want to pin to one exact tag rather than allowing any tag. Replace the trailing `.+$` in the regex with the literal tag, for example `v1\.4\.2$`.

> **Note on GHCR access.** The OCI packages on `ghcr.io/vhco-pro/*` are configured to be pullable without authentication. You do **not** need to `docker login` to GHCR to run `cosign verify`.

### A real, working example

The following command produces a successful verification at the time of writing:

```bash
cosign verify \
  --certificate-identity-regexp "^https://github\.com/vhco-pro/stackweaver-api/\.github/workflows/release\.yml@refs/tags/.+$" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  ghcr.io/vhco-pro/stackweaver-api:0.6.8
```

## Verifying SLSA Build Provenance (Live Today)

Every release from the docker satellites publishes a [SLSA Build L3 provenance attestation](https://slsa.dev/spec/v1.0/levels#build-l3) binding the released container digest to the upstream monorepo commit SHA and the workflow run that built it. The `attest-build-provenance` step is gated on `github.event.repository.visibility == 'public'`, which holds for every satellite, including the OpenTofu runner: `gh attestation verify oci://ghcr.io/vhco-pro/stackweaver-opentofu-runner:<tag> --repo vhco-pro/stackweaver-opentofu-runner` succeeds against its published releases.

The earliest tags of each satellite carry no attestations. For the API satellite, provenance is present from `0.6.11` onward - older tags such as `0.6.8` return `404`, so always verify against a recent tag.

Replace `<component>` with one of `api`, `orchestrator`, `opentofu-runner`, `ansible-runner`, `frontend`, `zitadel-init` and `<tag>` with the release tag:

```bash
gh attestation verify \
  -R vhco-pro/stackweaver-<component> \
  "oci://ghcr.io/vhco-pro/stackweaver-<component>:<tag>"
```

Note the `-R owner/repo` form - `--repo stackweaver-<component>` (just the name) is **not** accepted by `gh attestation verify`. You can also omit `-R` and pass `--owner vhco-pro` to verify against any repository in the organisation.

A successful verification proves four things in one shot: the image digest exists, an attestation was published for that exact digest, the attestation was issued by a workflow in the named repository, and the issuer's certificate (again from Sigstore Fulcio) is logged in Rekor.

### A real, working example

The following command produces a successful verification at the time of writing:

```bash
gh attestation verify \
  -R vhco-pro/stackweaver-api \
  "oci://ghcr.io/vhco-pro/stackweaver-api:0.6.32"
```

## Verifying the SBOM (Live Today)

The SBOM is published as a Sigstore-signed attestation in SPDX format, **not** as a GitHub Release asset. The verification command is identical to the SLSA one, with one additional flag selecting the predicate type:

```bash
gh attestation verify \
  -R vhco-pro/stackweaver-<component> \
  --predicate-type https://spdx.dev/Document \
  "oci://ghcr.io/vhco-pro/stackweaver-<component>:<tag>"
```

This is subject to the same `visibility == 'public'` gate as the SLSA attestation, so it is live on every docker satellite.

## Verifying the OpenVEX Document (Live Today)

Every release also publishes a signed [OpenVEX](https://openvex.dev/) document as a Sigstore-keyless attestation, binding the released image digest to the project's machine-readable statements about which known vulnerabilities do (or do not) affect it. Verify it by selecting the OpenVEX predicate type:

```bash
gh attestation verify \
  -R vhco-pro/stackweaver-<component> \
  --predicate-type https://openvex.dev/ns/v0.2.0 \
  "oci://ghcr.io/vhco-pro/stackweaver-<component>:<tag>"
```

For example:

```bash
gh attestation verify \
  --owner vhco-pro \
  --predicate-type https://openvex.dev/ns/v0.2.0 \
  "oci://ghcr.io/vhco-pro/stackweaver-frontend:0.12.2"
```

Like the SLSA and SBOM attestations, the OpenVEX attestation is gated on `visibility == 'public'`, so it is live on every docker satellite.

## Verifying the Helm Chart

The Helm chart is published as an OCI artefact at:

```
ghcr.io/vhco-pro/charts/stackweaver:<chart-version>
```

(Note the path: `charts/stackweaver`, **not** `stackweaver-helm/charts/stackweaver`.)

The chart is pullable without authentication. Every chart version from **`0.6.8`** onward is Sigstore-signed with `cosign sign`. From chart version **`0.7.8`** the SBOM, SLSA L3 provenance, and OpenVEX are published as **GitHub-native attestations** (`actions/attest-*`), verified with `gh attestation verify`. Chart versions `0.6.8` to `0.7.0` instead carry a cosign-attested SPDX SBOM (`cosign verify-attestation`); versions `0.7.1` to `0.7.7` did not publish successfully and should not be used. Earlier chart versions are unsigned and can only be integrity-checked by digest comparison against the matching [GitHub Release](https://github.com/vhco-pro/stackweaver-helm/releases).

> **Why two attestation methods?** cosign v3 makes the Sigstore bundle format mandatory for keyless signing, and `cosign attest` of the chart's SPDX/OpenVEX predicates fails under it (`invalid attestation: decoding json`). Charts from `0.7.8` therefore use the same GitHub-native attestation path as the docker satellites. The chart *signature* is verified with `cosign verify` for every signed version.

### Verify the chart signature

```bash
cosign verify \
  --certificate-identity-regexp "^https://github\.com/vhco-pro/stackweaver-helm/\.github/workflows/release\.yml@refs/tags/.+$" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  ghcr.io/vhco-pro/charts/stackweaver:<chart-version>
```

A successful run prints the three Sigstore claims (cosign claims valid, Rekor entry exists, certificate chains to Fulcio) followed by the signed payload as JSON.

### Verify the chart attestations (SLSA provenance, SBOM, OpenVEX)

For chart versions **≥ `0.7.8`** the chart's SLSA L3 provenance, SPDX SBOM, and OpenVEX are GitHub-native attestations bound to the chart digest, verified with `gh attestation verify`:

```bash
# SLSA Build L3 provenance (default predicate)
gh attestation verify \
  -R vhco-pro/stackweaver-helm \
  "oci://ghcr.io/vhco-pro/charts/stackweaver:<chart-version>"

# SPDX SBOM
gh attestation verify \
  -R vhco-pro/stackweaver-helm \
  --predicate-type https://spdx.dev/Document \
  "oci://ghcr.io/vhco-pro/charts/stackweaver:<chart-version>"

# OpenVEX
gh attestation verify \
  -R vhco-pro/stackweaver-helm \
  --predicate-type https://openvex.dev/ns/v0.2.0 \
  "oci://ghcr.io/vhco-pro/charts/stackweaver:<chart-version>"
```

This is the same `gh attestation verify` form (and the same predicate types) used for the docker satellite images, so one command shape works fleet-wide.

> **Older charts (`0.6.8` to `0.7.0`).** These carry the SBOM as a *cosign* attestation instead. Verify those with `cosign verify-attestation --type "https://spdx.dev/Document/v2.3" …` and the same certificate-identity regexp as the signature command above. Charts from `0.7.8` onward do **not** have this cosign attestation - use `gh attestation verify` instead.

## Verifying Sync-Commit Identity

Satellites are deterministic re-publications of the private monorepo, pushed by the `stackweaver-release-bot` GitHub App. The bot's sync commit is signed with `gitsign`, so its author identity is bound to the same Sigstore OIDC chain as the container signatures.

There is one important subtlety: the certificate identity on a sync commit points at the **monorepo workflow that produced the sync**, not at the satellite. The signing identity is therefore `https://github.com/michielvha/stackweaver/.github/workflows/sync-<component>.yml@<ref>`, **not** `https://github.com/vhco-pro/...`. The signature is still cryptographically valid and the Rekor entry is still public; this just reflects the fact that the sync is driven by a workflow that lives in the upstream monorepo.

A second subtlety matters for *where* to find the signed commit. Sync changes land on a satellite through a pull request that is **squash-merged**. Squash-merging discards the bot's original commit and writes a brand-new commit onto `main` that is signed by GitHub's own web-flow GPG key (`committer = GitHub`) with the bot preserved only as the *author*. That squashed `main` commit is therefore **not** gitsign-signed - running `gitsign verify` against it fails with `unsupported signature type: not a PEM block`. The gitsign-signed commit still exists; it lives on the pull-request head ref (`refs/pull/<n>/head`). Verify that commit instead:

```bash
git clone https://github.com/vhco-pro/stackweaver-<component>
cd stackweaver-<component>

# Sync PRs are squash-merged, so the commit on `main` is a GitHub-signed
# squash commit (committer "GitHub"). The bot's gitsign-signed commit lives
# on the pull-request head ref. Pick a merged sync PR and fetch its head.
PR=$(gh pr list -R vhco-pro/stackweaver-<component> --state merged \
       --author app/stackweaver-release-bot --json number --jq '.[0].number')
git fetch origin "refs/pull/$PR/head:sync-head"

gitsign verify \
  --certificate-identity-regexp "^https://github\.com/michielvha/stackweaver/\.github/workflows/sync-<component>\.yml@.+$" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  sync-head
```

A successful run prints the Rekor log index, the Fulcio certificate ID, the signing workflow URL, and the four lines:

```
Validated Git signature: true
Validated Rekor entry: true
Validated Certificate claims: true
```

### Known caveats

**Verify the PR head, not `main`.** Because sync PRs are squash-merged, the commit you see on `main` is GitHub's web-flow GPG signature, which the GitHub UI shows as a green `Verified` badge attributed to GitHub. That is GitHub's signature on the squash commit, not the bot's gitsign signature. The bot's gitsign-signed commit is the pull-request head ref fetched above; pointing `gitsign verify` at a `main` commit returns `not a PEM block` and is expected.

**GitHub UI badge.** When you view the gitsign-signed PR head commit directly, the GitHub web UI shows it with a yellow `Unverified` (`bad_cert`) badge because GitHub's verified-CA list does not yet include Sigstore Fulcio. The `gitsign verify` command above, together with the Rekor entry it prints, is the authoritative check. This is a documented Sigstore-GitHub interop gap, not a Stackweaver-specific problem.

**Monorepo source visibility.** The cert subject points at a workflow that lives in `michielvha/stackweaver`, which is intentionally private (see the OSPS audit's `D-CORE` decision and the `core/` audit-access procedure). Until the monorepo is opened, external consumers verifying a sync commit can prove the signature came from the Stackweaver sync pipeline but cannot independently inspect what that pipeline does. The Stackweaver threat model and the rationale for keeping the monorepo private are published at <https://github.com/vhco-pro/.github/blob/main/SECURITY.md>.

**Non-sync commits.** Commits made by other identities - for example chart-releaser's `github-actions[bot]` README updates on `stackweaver-helm`, or direct maintainer commits - are not gitsign-signed and will fail verification. Always pick a merged sync pull request authored by `stackweaver-release-bot[bot]` and verify its head ref as shown above.

## What's Deliberately Not Here

You may have seen verification guides that recommend importing a project GPG key, comparing checksums against a SHA256SUMS file, or downloading a long-lived `cosign.pub`. None of those steps apply to Stackweaver:

- We do not publish standalone binaries - distribution is container-only (plus the Helm chart) - so there is no archive to checksum-sign, and the monorepo's `.goreleaser.yml` does not run in CI.
- We do not publish a project GPG key. The OSPS audit decision **D-SIG-NOKEY** explicitly rules out long-lived signing keys, on the grounds that key custody and rotation are the most common failure modes in supply-chain attacks and Sigstore eliminates the key-custody problem entirely.
- We do not publish a long-lived cosign public key. The signing identity for every release is the GitHub Actions workflow that produced it, observable in the Fulcio certificate subject and the Rekor log entry shown by every `cosign verify` / `gh attestation verify` run.
- We do not publish the SBOM as a GitHub Release asset. The SBOM is a Sigstore-signed OCI attestation (`--predicate-type https://spdx.dev/Document`); if you need the raw SPDX document, extract it from the attestation rather than expecting it on the Releases page.

## Reporting a Verification Failure

If `cosign verify`, `gh attestation verify`, or `gitsign verify` fail on an artefact that you obtained from an official location, file a [Private Vulnerability Report](https://github.com/vhco-pro/.github/security/policy) on the affected satellite immediately, or email `contact@vhco.pro` with the artefact reference, the failing command output, and the Rekor log index if one was returned. Do not open a public issue.

The full project security policy lives at [github.com/vhco-pro/.github/blob/main/SECURITY.md](https://github.com/vhco-pro/.github/blob/main/SECURITY.md).
