---
description: "Guide for creating a Kubernetes image pull secret for the private StackWeaver images on GHCR"
covers:
  - "deploy/helm/**"
---

# Creating a Kubernetes Pull Secret for GHCR

StackWeaver container images are hosted in the GitHub Container Registry (GHCR) under the `vhco-pro` organisation. The API, frontend, orchestrator, OpenTofu runner, and Zitadel init images are private packages; the Helm chart and the Ansible runner and secrets-init images are public. Because a deployment needs the private images, you must request access, create a GitHub personal access token, and register it as a Kubernetes pull secret before the StackWeaver pods can start. The same token also works with `docker login ghcr.io` for a Docker Compose installation.

## Prerequisites

Before you start, make sure you have:

- A GitHub account
- `kubectl` installed and configured to talk to your cluster
- Access to the namespace where StackWeaver will run

## Step 1: Request Access to the `vhco-pro` Organisation

The private StackWeaver images can only be pulled by members of the `vhco-pro` GitHub organisation, so you must join it before your token can pull them.

Contact the StackWeaver team at `support@stackweaver.co` and ask to be invited to the `vhco-pro` organisation on GitHub. Include the GitHub username that should receive the invitation. Once the team processes your request you will receive an email from GitHub; accept the invitation before continuing.

> [!NOTE]
> If you are deploying StackWeaver on behalf of a company rather than as an individual, ask the team to invite a dedicated machine/bot account instead of a personal account. This avoids disruptions when individuals leave.

## Step 2: Create a Personal Access Token

Once you are a member of `vhco-pro`, create a GitHub personal access token (PAT) scoped to read packages.

1. In GitHub, open **Settings → Developer settings → Personal access tokens → Tokens (classic)**.
2. Click **Generate new token (classic)**.
3. Give the token a descriptive name such as `stackweaver-k8s-pull-<cluster-name>`.
4. Set an expiry date that matches your rotation policy (90 days is a common baseline).
5. Under **Scopes**, grant **read:packages**. No other scopes are required.
6. Click **Generate token** and copy the value immediately. GitHub will not show it again.

> [!IMPORTANT]
> You must use a **classic** personal access token. Fine-grained tokens do not support the `read:packages` scope required for pulling container images from GHCR. See [GitHub's packages permissions documentation](https://docs.github.com/en/packages/learn-github-packages/about-permissions-for-github-packages) for details.

> [!WARNING]
> Store the token securely. Do not commit it to version control. Treat it like a password.

## Step 3: Create the Kubernetes Secret

Run the following command, replacing the placeholder values with your own:

```bash
kubectl create secret docker-registry ghcr-pull-secret \
  --docker-server=ghcr.io \
  --docker-username=<your-github-username> \
  --docker-password=<your-pat> \
  --namespace=<your-namespace>
```

This creates a secret of type `kubernetes.io/dockerconfigjson` that Kubernetes nodes use to authenticate against GHCR when pulling images.

You can verify the secret was created:

```bash
kubectl get secret ghcr-pull-secret -n <your-namespace>
```

## Step 4: Configure the Helm Chart to Use the Secret

Tell the StackWeaver Helm chart about the pull secret by setting `global.imagePullSecrets` in your values file:

```yaml
global:
  imagePullSecrets:
    - name: ghcr-pull-secret
```

Then install or upgrade the chart:

```bash
helm upgrade --install stackweaver oci://ghcr.io/vhco-pro/charts/stackweaver \
  -f your-values.yaml \
  --namespace <your-namespace>
```

All pods managed by the chart will now automatically use the pull secret to authenticate against GHCR.

## Rotating the Token

When your PAT expires or needs to be rotated, generate a new token following Step 2 and update the secret in place:

```bash
kubectl create secret docker-registry ghcr-pull-secret \
  --docker-server=ghcr.io \
  --docker-username=<your-github-username> \
  --docker-password=<new-pat> \
  --namespace=<your-namespace> \
  --dry-run=client -o yaml | kubectl apply -f -
```

Using `--dry-run=client -o yaml | kubectl apply` replaces the secret without deleting it first, which avoids a brief gap where running pods could fail to pull new images.

> [!TIP]
> Set a calendar reminder a few days before your token expires so you have time to rotate without any impact on running workloads.

## Related Documentation

- [Self-Hosted Runners](../../../user-guides/self-hosted-runners.md): run StackWeaver workloads on your own Kubernetes infrastructure
- [Get Started](../../README.md): overview of all setup guides
