---
description: "Guide for creating a Kubernetes image pull secret for the private StackWeaver images on GHCR"
covers:
  - "deploy/helm/**"
---

# Pull Stackweaver images from GHCR

Create a namespace-scoped pull Secret for the private images your installation needs. Public
container images can be pulled anonymously; access to a public source repository does not
establish access to its container package.

## 1. Confirm package access

The deployment currently needs private API, frontend, orchestrator, OpenTofu runner and
Zitadel-init images under `ghcr.io/vhco-pro`. The Ansible runner and secrets-init images are
public. Check the exact package and tag you will deploy if a pull is denied.

Request package access from `support@stackweaver.co`, including the GitHub username that
will pull images. Accept any organization invitation you receive. Organization membership
alone is not a guarantee: the account must have read access to the relevant packages.
For shared infrastructure, use an account whose lifecycle is managed by the operating team.

In GitHub, open **Settings > Developer settings > Personal access tokens > Tokens (classic)**.
Create a token with `read:packages`, an expiry that fits your rotation policy, and SSO
authorization if your organization requires it. Save it in a secret store. GitHub Packages
uses classic PATs for this path; see its
[container-registry authentication guidance](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry#authenticating-to-the-container-registry).

## 2. Create the Kubernetes Secret

Use `kubectl` against the intended cluster. The namespace must exist; create it before the
Secret if this is a first installation. Use the same namespace as the Helm release.

Set `GITHUB_USERNAME`, `GHCR_TOKEN` and `NAMESPACE` through your shell or secret tooling, then:

```bash
kubectl create secret docker-registry ghcr-pull-secret \
  --docker-server=ghcr.io \
  --docker-username="$GITHUB_USERNAME" \
  --docker-password="$GHCR_TOKEN" \
  --namespace="$NAMESPACE"
kubectl get secret ghcr-pull-secret --namespace "$NAMESPACE"
```

The expected type is `kubernetes.io/dockerconfigjson`. Do not commit its unencrypted YAML or
print its contents into review logs. Supplying a real token as a CLI argument can expose it
to local process inspection; use your platform's secret-management path where required.

## 3. Wire it into the chart

Save as `pull-secret-values.yaml`:

```yaml
global:
  imagePullSecrets:
    - name: ghcr-pull-secret
```

For a new release, merge this with the [Helm installation values](./README.md). For an existing
release, set `CHART_VERSION` to the installed chart version and preserve the other values:

```bash
helm upgrade stackweaver oci://ghcr.io/vhco-pro/charts/stackweaver \
  --namespace "$NAMESPACE" --version "$CHART_VERSION" \
  --reuse-values --values pull-secret-values.yaml
```

All chart-managed workload pods use this reference, including hook Jobs. The Secret must
exist before those pods need to pull images. A registry login on your laptop does not supply
credentials to Kubernetes nodes.

## 4. Verify a pull

```bash
kubectl get pods --namespace "$NAMESPACE"
kubectl describe pod POD_NAME --namespace "$NAMESPACE"
```

Replace `POD_NAME` with an affected pod. Read its image-pull events: `unauthorized` suggests
package/token access; `not found` may mean an incorrect repository or tag. Check the pod's
`imagePullSecrets` reference and that the Secret exists in the same namespace. Successful
Secret creation alone does not prove image access.

## Rotate without deleting the Secret

Generate a replacement token with the same required access, set `GHCR_TOKEN` to that value
and update the existing Secret:

```bash
kubectl create secret docker-registry ghcr-pull-secret \
  --docker-server=ghcr.io \
  --docker-username="$GITHUB_USERNAME" \
  --docker-password="$GHCR_TOKEN" \
  --namespace="$NAMESPACE" \
  --dry-run=client --output=yaml | kubectl apply -f -
```

Verify the replacement can pull the configured images before revoking the old token. Existing
running containers do not prove a future image pull will succeed. Secret names and chart values
can remain unchanged.

## Docker Compose

The same account and token can authenticate the local Docker client:

```bash
printf '%s' "$GHCR_TOKEN" | docker login ghcr.io --username "$GITHUB_USERNAME" --password-stdin
```

Then follow the [Compose installation](../docker-compose/README.md). This does not create a
Kubernetes Secret; the two clients store credentials separately.
