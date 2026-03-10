<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

---
name: Add Trivy Security Scanning
overview: Add Trivy security scanning to CI/CD to detect container image vulnerabilities, npm dependencies, IaC misconfigurations, and secrets - complementing existing linters that focus on code-level security.
todos:
  - id: add-trivy-ci
    content: Add Trivy scanning jobs to .github/workflows/ci.yml - scan container images, npm dependencies, and Dockerfiles
    status: pending
  - id: create-trivyignore
    content: Create .trivyignore file for known false positives and acceptable vulnerabilities
    status: pending
  - id: add-sbom-generation
    content: Add SBOM generation step in CI using Trivy for Go and npm dependencies
    status: pending
  - id: document-trivy-setup
    content: Create docs/security/trivy-setup.md documenting Trivy usage and configuration
    status: pending
---

# Adding Trivy Security Scanning to StackWeaver

## Overview

Trivy will complement your existing security tooling by scanning **container images**, **npm dependencies**, **IaC configurations**, and **secrets** - areas not covered by your current linters.

## Current Security Coverage vs. Trivy

### What you have now:

- **Go code**: `govulncheck` + `gosec` (via golangci-lint) - scans Go modules and code patterns
- **TypeScript code**: `eslint` - basic code quality checks
- **Gap**: No container image scanning, no npm audit, no IaC config scanning

### What Trivy adds:

1. **Container image scanning** - OS packages and base image CVEs (Alpine 3.23, etc.)
2. **npm dependency scanning** - npm package vulnerabilities
3. **IaC scanning** - Dockerfile best practices, Kubernetes misconfigurations
4. **Secret scanning** - Detects accidentally committed secrets
5. **SBOM generation** - Software bill of materials for compliance

## Implementation Plan

### 1. Add Trivy to GitHub Actions CI

Update `.github/workflows/ci.yml` to add Trivy scanning:

**Backend job:**

- Scan Go module dependencies (already covered by govulncheck, but Trivy provides different/additional checks)
- Scan Dockerfiles for misconfigurations
- Generate SBOM for Go modules

**Frontend job:**

- Scan npm dependencies (replaces/additional to npm audit)
- Scan Dockerfiles for misconfigurations
- Generate SBOM for npm packages

**New container scanning job:**

- Scan built Docker images (after building)
- Target: `backend/Dockerfile`, `frontend/Dockerfile.dev`, runner images
- Fail on HIGH/CRITICAL vulnerabilities
- Optionally scan on PR, always on main branch

### 2. Configuration Files

Create `.trivyignore` file for:

- False positives that are acceptable
- Vulnerabilities in dev-only dependencies
- Known issues being tracked

### 3. Scan Targets

**Container Images:**

- `backend/Dockerfile` (Alpine 3.23 base)
- `frontend/Dockerfile.dev`
- `runner-images/terraform/Dockerfile`
- `runner-images/ansible/Dockerfile`

**File Scans:**

- All Dockerfiles for misconfigurations
- `frontend/package.json` and `package-lock.json`
- Repository root for secrets

**IaC:**

- `deploy/*.yaml` (Kubernetes manifests if any)
- Docker Compose files

### 4. Integration Strategy

**Option A: Fail on HIGH/CRITICAL (Recommended)**

- Block PRs if HIGH/CRITICAL vulnerabilities found
- Only scan changed files on PRs for faster feedback
- Full scan on main branch

**Option B: Warning only (Softer)**

- Report vulnerabilities but don't block
- Good for initial rollout to assess impact
- Can migrate to Option A later

### 5. Output Format

- SARIF format for GitHub Security tab integration
- JSON reports saved as artifacts
- Console output for immediate feedback

## Files to Modify

1. `.github/workflows/ci.yml` - Add Trivy jobs
2. `.trivyignore` (new) - Ignore known false positives
3. `docs/security/trivy-setup.md` (new) - Document Trivy setup and usage

## Benefits

1. **Catch OS-level vulnerabilities** in Alpine/Docker base images before deployment
2. **npm dependency vulnerabilities** currently not checked in CI
3. **Dockerfile misconfigurations** (running as root, missing healthchecks, etc.)
4. **Secret leakage prevention** - catch before commit reaches main
5. **SBOM generation** - Required for EU Cyber Resilience Act compliance (mentioned in certs.md)

## Considerations

- Trivy scans can add 2-5 minutes to CI depending on image sizes
- May surface many vulnerabilities initially - use `.trivyignore` strategically
- Container scanning requires building images (or using `--input` with pre-built images)
- Consider caching Trivy DB to speed up scans

## Questions to Decide

1. **Fail on HIGH/CRITICAL only, or all vulnerabilities?** (Recommend: HIGH/CRITICAL)
2. **Scan on every PR or only on main branch pushes?** (Recommend: Every PR)
3. **Build images for scanning, or scan Dockerfiles only?** (Recommend: Build + scan images for comprehensive coverage)
4. **Generate SBOMs and store as artifacts?** (Recommend: Yes, for compliance)