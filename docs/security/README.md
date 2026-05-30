<!--
Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
-->
---
description: "Public security documentation for Stackweaver. Covers how to cryptographically verify a release artefact and how code reaches the public satellite repositories. Aimed at users, security researchers, and external auditors performing an independent review of the project's supply-chain controls."
---

# Security

Public security documentation for Stackweaver. The pages in this section describe how the project's supply-chain and release-integrity controls work in enough detail that an external reviewer can verify the claims independently against the live GitHub APIs, without privileged access.

For internal operational documents (access policies, vulnerability management runbooks, audit workbooks), see `docs/internal/security/` in the source tree. Those are not published here because they are workflow artefacts rather than user-facing material.

For vulnerability disclosure, follow the [organisation-wide security policy](https://github.com/vhco-pro/.github/blob/main/SECURITY.md). Do not file public issues for suspected vulnerabilities.

## Organisation

Each page in this section is self-contained and answers a single question an external reviewer might bring to the project:

* **"Is this artefact really from Stackweaver?"** — covered in [Verifying a Release](./verifying-releases.md).
* **"How does code actually reach the satellite repositories I'm building?"** — covered in [Sync Architecture](./sync-architecture.md).

Both pages list the exact commands an external reviewer can run to verify the claims they make. If any of those commands return unexpected output against the live `vhco-pro` organisation, that is a finding worth reporting via the [Private Vulnerability Report channel](https://github.com/vhco-pro/.github/security/policy).

## Contents

| Name | Description |
|------|-------------|
| [verifying-releases.md](./verifying-releases.md) | How to cryptographically verify a Stackweaver release — container image signatures, SLSA build provenance, and SBOM attestations. Uses Sigstore keyless signing; no long-lived signing keys are involved. |
| [sync-architecture.md](./sync-architecture.md) | How code reaches the public Stackweaver satellite repositories. Documents the two-App, PR-based sync model, the four hard security gates that govern every automated merge, and the commands an external reviewer can run to verify the design is correctly deployed in production. |
