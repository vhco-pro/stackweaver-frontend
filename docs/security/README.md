<!--
Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
-->
---
nav_order: 50
description: "Public security documentation for Stackweaver. Covers how to cryptographically verify a release artefact and how code reaches the public satellite repositories. Aimed at users, security researchers, and external auditors performing an independent review of the project's supply-chain controls."
---

# Security

Review release signatures, the satellite publication boundary and OSPS evidence. The guides distinguish publicly inspectable artifacts and source from settings or review records that require maintainer access.

Internal operational documents (access policies, vulnerability management runbooks, audit workbooks) are not published here, because they are workflow artefacts rather than user-facing material.

For vulnerability disclosure, follow the [organisation-wide security policy](https://github.com/vhco-pro/.github/blob/main/SECURITY.md). Do not file public issues for suspected vulnerabilities.

## Organisation

Each page in this section is self-contained and answers a single question an external reviewer might bring to the project:

* **"Is this artefact really from Stackweaver?"** - covered in [Verifying a Release](./verifying-releases.md).
* **"How does code actually reach the satellite repositories I'm building?"** - covered in [Sync Architecture](./sync-architecture.md).
* **"How does the project measure up against the OpenSSF OSPS Baseline?"** - covered in [OSPS security evidence](./osps-baseline-compliance.md).

The guides identify required access and how to interpret verification failures. An API access error alone is not proof of a security problem. For suspected vulnerabilities, use the private reporting route in the security policy.

## Contents

| Name | Description |
|------|-------------|
| [verifying-releases.md](./verifying-releases.md) | How to cryptographically verify a Stackweaver release - container image signatures, SLSA build provenance, and SBOM attestations. Uses Sigstore keyless signing; no long-lived signing keys are involved. |
| [sync-architecture.md](./sync-architecture.md) | Publication flow, signing and review identities, actual merge controls and limits of public audit evidence. |
| [osps-baseline-compliance.md](./osps-baseline-compliance.md) | Versioned control mapping, evidence access and known assessment gaps. This is an evidence guide, not a certification. |
