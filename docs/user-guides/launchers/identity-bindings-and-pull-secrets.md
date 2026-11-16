---
title: "Identity bindings and pull Secrets"
nav_order: 7
description: "Run an agent pool's job pods as a ServiceAccount a cloud trusts, and keep long-lived registry pull Secrets in the job namespace."
covers:
  - "backend/internal/api/v2/handlers/identity_binding*"
  - "backend/internal/api/v2/handlers/pull_secret*"
  - "core/runnerdriver/kubernetes/**"
---

# Identity bindings and pull Secrets

## Identity bindings

A job always receives the platform identity: for each cloud the organization has an [OIDC configuration](../workload-identity/README.md) for, Stackweaver mints a short-lived token for that run or job and hands it to the job's process. [Workload Identity](../workload-identity/README.md) describes it.

A pool can also offer identity bindings, which run its job pods as a Kubernetes ServiceAccount that a cloud's pod identity mechanism trusts. Add them in the **Identity bindings** section of the pool's expanded row. A binding has a name, a mechanism (`aws-irsa`, `aws-pod-identity`, `gcp-workload-identity` or `azure-workload-identity`), a ServiceAccount name with the annotations the mechanism reads, and one of three ways of handling the ServiceAccount: **Create it**, where the launcher creates the account with those annotations; **Create one per job**, where the launcher creates a copy of it for every job and removes it with the pod; or **Reference an existing one**, where the account is declared elsewhere and the launcher never writes it. When the launcher finds that something other than Stackweaver manages a ServiceAccount, for example a GitOps controller, the binding is marked as declared outside Stackweaver and becomes read-only.

A workspace, job template or inventory source selects a binding in its **Identity binding** control, and a project or organization can set a default (see [Run Images and Execution Environments](./run-images-and-execution-environments.md#where-a-setting-comes-from)). A job whose resolved binding belongs to a pool other than the one it runs on is refused, and hosted capacity offers no bindings. Bindings apply to jobs placed by a launcher on the Kubernetes driver. This guide does not cover the cloud-side setup of each mechanism; [Workload Identity](../workload-identity/README.md) describes the platform identity, which needs none.

## Registry pull Secrets

On the Kubernetes driver a job whose run image comes from a private registry is pulled with a dockerconfigjson Secret. By default the launcher writes one for each job from the run image's registry credential and the pod deletes it with itself. A pool can instead keep a long-lived pull Secret per registry in its job namespace: add it in the **Registry pull Secrets** section of the pool's expanded row, with a name, the registry host (such as `ghcr.io` or `registry.example:5000`), the Secret's name, and one of two ways of handling it. **Create it** has the launcher create and keep the Secret from an organization registry credential (from **Settings > Credentials**); **Reference an existing one** uses a Secret declared elsewhere, in git, a Helm value or a plain manifest, which the launcher never writes. A job of the pool whose run image comes from that registry then runs with the Secret, and the launcher reads no credential for it. The same requests are available over the API at `GET` and `POST /api/v2/agent-pools/:id/pull-secrets` and `GET`, `PATCH` and `DELETE /api/v2/pull-secrets/:id`.

Pull Secrets follow the same rules as identity bindings. Creating one whose Secret name another tool already manages in the namespace (Argo CD, Flux, Helm, or another server-side apply manager) is refused with an error naming that manager; reference it by name instead. When the launcher finds that a Secret it created has been taken over, for example because it was committed to git and is now applied by Argo CD or Flux, the pull Secret is marked as managed outside Stackweaver, the launcher stops writing to it, and its Kubernetes fields can no longer be edited or the entry deleted here; jobs keep using it. A Secret the launcher reports missing is shown as such, and jobs fall back to a Secret written for each job until it exists again. Deleting a pull Secret leaves the Kubernetes Secret the launcher created in the namespace for you to remove.

An Argo CD project that warns on orphaned resources should permit only the kinds the job namespace declares in git, or ignore `Pod sw-job-*`: a job pod has no owner, and an object created in the UI counts as an orphan until it is committed to git.
