---
title: "Identity bindings and pull Secrets"
nav_order: 7
description: "Run an agent pool's job pods as a ServiceAccount a cloud trusts, and keep long-lived registry pull Secrets in the job namespace."
covers:
  - "backend/internal/api/v2/handlers/identity_binding*"
  - "backend/internal/api/v2/handlers/pull_secret*"
  - "backend/cmd/api/hosted_identity*"
  - "core/repository/identity_binding*"
  - "core/runnerdriver/kubernetes/**"
  - "core/services/vcs/**"
  - "core/services/ansible/work_items.go"
---

# Identity bindings and pull Secrets

## Identity bindings

A job always receives the platform identity: for each cloud the organization has an [OIDC configuration](../workload-identity/README.md) for, Stackweaver mints a short-lived token for that run or job and hands it to the job's process. [Workload Identity](../workload-identity/README.md) describes it.

A pool can also offer identity bindings, which run its job pods as a Kubernetes ServiceAccount that a cloud's pod identity mechanism trusts. Add them in the **Identity bindings** section of the pool's expanded row. A binding has a name, a mechanism (`aws-irsa`, `aws-pod-identity`, `gcp-workload-identity` or `azure-workload-identity`), a ServiceAccount name with the annotations the mechanism reads, and one of three ways of handling the ServiceAccount: **Create it**, where the launcher creates the account with those annotations; **Create one per job**, where the launcher creates a copy of it for every job and removes it with the pod; or **Reference an existing one**, where the account is declared elsewhere and the launcher never writes it. When the launcher finds that something other than Stackweaver manages a ServiceAccount, for example a GitOps controller, the binding is marked as declared outside Stackweaver and becomes read-only.

A workspace, job template or inventory source selects a binding in its **Identity binding** control, a VCS inventory through the `identity-binding-id` attribute of `PATCH /api/v2/ansible/inventories/:id`, and a project or organization can set a default (see [Run Images and Execution Environments](./run-images-and-execution-environments.md#where-a-setting-comes-from)). Only a launcher on the Kubernetes driver applies a binding. A job is refused its job token, with the reason, when its resolved binding belongs to another pool than the one it runs on, when the claiming launcher runs strict hosted isolation, or when the launcher uses the container or in-process driver. The organization's bindings, with each one's pool, are listed at `GET /api/v2/organizations/:name/identity-bindings`, a page at a time; `filter[inventory]=<id>` lists only the bindings that inventory may use.

A job keeps the identity it was given when it started: a later change to the binding, or to which binding is selected, applies to the next run, job or sync, not to one already running.

## Where a VCS inventory's file sync runs

A VCS inventory's file sync runs where its binding places it: on the binding's agent pool when the inventory, its project or its organization selects one, and on the hosted capacity otherwise. The agent pool must let the inventory's project use it, as for a workspace: an organization-wide pool lets every inventory use it, and any other pool only inventories of the projects it allows. That pool's launchers then need to reach the repository to clone it.

A sync request that the pool or the repository credential does not allow is refused with the reason. **Sync now** answers with the reason and leaves the inventory's sync status as it was, and a sync that a new inventory or a push requests records the reason as the inventory's last sync error. When the selection changes, the next sync request replaces a sync that is still waiting on the old pool. A sync that has already started on a pool that no longer lets the inventory use it fails with the reason.

## Repository credentials on agent pools

A file sync that runs on an agent pool receives the credential it clones the repository with:

- **GitHub App connection.** Every file sync, on an agent pool or on the hosted capacity, gets a token that reaches only the inventory's repository and can only read its contents. When GitHub refuses that token, for example because the repository is no longer in the App's installation, the sync fails with GitHub's reason.
- **Stored credential.** The credential of a GitHub token, GitLab, Bitbucket or Azure DevOps connection reaches every repository the connection can reach, so Stackweaver cannot limit it to one repository. A file sync of an inventory whose connection holds a stored credential runs on an agent pool only when the organization turns on **Allow stored VCS credentials on agent pools**. It is off by default. Organization owners set it with the `allow-stored-vcs-credentials-on-agent-pools` attribute of `PATCH /api/v2/organizations/:name`. While it is off, such a sync request is refused with the reason, and a sync already waiting on the pool fails when it starts.

File syncs on the hosted capacity receive the connection's credential whatever the setting.

## Set up Azure workload identity

These steps give an AKS agent pool one Azure identity through a ServiceAccount.

1. Enable the OIDC issuer and workload identity on the AKS cluster, and note its OIDC issuer URL.
2. Create a user-assigned managed identity and note its client ID.
3. Add a federated credential to the managed identity with the cluster's OIDC issuer URL, the subject `system:serviceaccount:<job namespace>:<service account>`, where the job namespace is the pool launcher's job namespace, and the audience `api://AzureADTokenExchange`.
4. Grant the managed identity the roles its jobs need, for example **Reader** on a subscription for an `azure_rm` inventory and **Key Vault Secrets User** on a vault for a playbook that reads secrets.
5. Add an identity binding to the pool with the mechanism `azure-workload-identity`, the ServiceAccount name from step 3 and the annotation `azure.workload.identity/client-id` set to the client ID.
6. Select the binding on the source, job template, project or organization whose jobs need the identity, or on a VCS inventory through its `identity-binding-id` attribute.

The AKS webhook gives a job pod that selects the binding `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` and `AZURE_FEDERATED_TOKEN_FILE`, which the Azure collections and SDKs read. An `azure_rm` inventory file and a cloud source with `auth_method: workload_identity` authenticate with it and need no credential. AKS reads the ServiceAccount's client ID when it admits the pod, so changing that annotation changes the identity of pods admitted afterwards.

## Registry pull Secrets

On the Kubernetes driver a job whose run image comes from a private registry is pulled with a dockerconfigjson Secret. By default the launcher writes one for each job from the run image's registry credential and the pod deletes it with itself. A pool can instead keep a long-lived pull Secret per registry in its job namespace: add it in the **Registry pull Secrets** section of the pool's expanded row, with a name, the registry host (such as `ghcr.io` or `registry.example:5000`), the Secret's name, and one of two ways of handling it. **Create it** has the launcher create and keep the Secret from an organization registry credential (from **Settings > Credentials**); **Reference an existing one** uses a Secret declared elsewhere, in git, a Helm value or a plain manifest, which the launcher never writes. A job of the pool whose run image comes from that registry then runs with the Secret, and the launcher reads no credential for it. The same requests are available over the API at `GET` and `POST /api/v2/agent-pools/:id/pull-secrets` and `GET`, `PATCH` and `DELETE /api/v2/pull-secrets/:id`.

Pull Secrets follow the same rules as identity bindings. Creating one whose Secret name another tool already manages in the namespace (Argo CD, Flux, Helm, or another server-side apply manager) is refused with an error naming that manager; reference it by name instead. When the launcher finds that a Secret it created has been taken over, for example because it was committed to git and is now applied by Argo CD or Flux, the pull Secret is marked as managed outside Stackweaver, the launcher stops writing to it, and its Kubernetes fields can no longer be edited or the entry deleted here; jobs keep using it. A Secret the launcher reports missing is shown as such, and jobs fall back to a Secret written for each job until it exists again. Deleting a pull Secret leaves the Kubernetes Secret the launcher created in the namespace for you to remove.

An Argo CD project that warns on orphaned resources should permit only the kinds the job namespace declares in git, or ignore `Pod sw-job-*`: a job pod has no owner, and an object created in the UI counts as an orphan until it is committed to git.
