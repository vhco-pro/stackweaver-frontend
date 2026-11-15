---
title: "Troubleshooting"
nav_order: 7
description: "Fix workload identity failures: permission errors on registration, tokens a cloud rejects, keys that change on restart and Azure role-assignment errors."
covers:
  - "core/services/oidc/**"
  - "backend/internal/executor/identity/**"
---

# Troubleshoot workload identity

## `403 Forbidden` when creating the OIDC configuration

Your Stackweaver token does not have the `manage-vcs-settings` permission. Perform the configuration as an organization owner, or ask an owner to grant you that permission.

## The cloud rejects the token with "no matching identity" (e.g. Azure `AADSTS70021`, AWS web-identity authorization failure, GCP `unable to verify`)

The issuer, subject, or audience in the token does not match your cloud-side trust. Check:

- The **Issuer** configured on the cloud matches `OIDC_ISSUER_URL` (or `API_URL` if that variable is not set) exactly, with no trailing slash, and is publicly reachable.
- The **Subject** matches the run that failed - see [Token subjects and claims](./token-subjects.md). `plan` and `apply` have different subjects and each needs its own trust entry.
- The **Audience** matches the cloud: `api://AzureADTokenExchange` (Azure), `sts.amazonaws.com` (AWS), or the full provider-resource audience shown in [GCP](./gcp.md).

## Tokens are rejected only after a Stackweaver restart, or intermittently

The containers are running with `DEV_INSECURE_KEY=1` and no `OIDC_SIGNING_KEY`, so each API replica generates its own RSA key pair on every start and the replicas hold different keys. On Docker Compose, set a stable, shared `OIDC_SIGNING_KEY` in `oidc.env`, remove `DEV_INSECURE_KEY`, and recreate the services as described in [Generate and apply the signing key](./signing-key.md#generate-and-apply-the-signing-key). On Kubernetes, confirm that the API Deployment references the OIDC Secret.

## Azure: role-assignment authorization fails

Check the failed operation and service principal scope. `Contributor` cannot assign Azure RBAC roles. Grant the required role-assignment permission at the intended scope rather than switching every workload to subscription Owner.
