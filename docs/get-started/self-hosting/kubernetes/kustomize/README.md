---
description: "GitOps deployment guide using Kustomize with Argo CD or Flux CD"
covers:
  - "deploy/helm/**"
---

# GitOps with Kustomize

This guide shows how to deploy StackWeaver using Kustomize in a GitOps workflow with Argo CD or Flux CD.
The approach uses Kustomize's `helmCharts` feature to render the StackWeaver Helm chart, paired with a base/overlay directory structure that lets you manage multiple environments from a single Git repository.

## Directory Structure

The example below shows a minimal but complete layout.
The `base` layer declares the namespace and any shared resources.
Each `overlays/<env>` directory supplies the environment-specific `values.yaml` for the Helm chart, along with any platform-specific resources such as PersistentVolumes.

::: code-explorer ./example
:::

## How It Works

Kustomize will expand the `helmCharts` entry in `overlays/production/kustomization.yaml` by fetching the chart from the OCI registry and rendering it with the supplied `values.yaml`.
The `../../base` resource reference pulls in the namespace declaration so Kustomize produces a self-contained set of manifests.

Both Argo CD and Flux CD support this pattern natively.
Neither tool needs any special plugins; Helm chart expansion via Kustomize is built into both.

## Adapting the Example

Open `overlays/production/values.yaml` and replace the example host names and TLS secret names with your own:

- `ingress.hosts.app`: the domain where the StackWeaver UI will be served.
- `ingress.hosts.auth`: the domain for the Zitadel authentication service.
- `ingress.provider`: the ingress controller type (`nginx-inc`, `community-nginx`, `traefik`, or `none`). See [Ingress Controller Provider](../README.md#ingress-controller-provider) for details.
- `ingress.tls.secretName` and `ingress.tls.authSecretName`: the names of the Kubernetes TLS secrets for each domain.

For persistent storage, `overlays/production/pv-pvc.yaml` contains an Azure Blob CSI example.
If your cluster uses a different storage provider (AWS EFS, an NFS server, or a dynamic provisioner), replace the `csi` block with the appropriate driver configuration.
The PVC name `runner-workspaces-pvc` must match the value you set for `runnerWorkspaces.existingClaim` in `values.yaml`.

## Secrets

The example `values.yaml` leaves all `secrets.*` fields empty, which causes the chart to auto-generate credentials.
For production GitOps you should manage secrets externally.
Provision secrets ahead of time using the External Secrets Operator, Sealed Secrets, or your platform's secrets store, then set `secrets.<component>.secretName` to the pre-existing Secret name.
When all four secret names are populated the chart creates zero Secret resources, making the overlay fully declarative and safe to store in Git.

See the [Kubernetes deployment guide](../README.md#secrets) for the full list of secret fields and example `kubectl create secret` commands.

## Argo CD

Create an `Application` resource pointing at the overlay directory in your Git repository.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: stackweaver
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/your-org/your-gitops-repo
    targetRevision: main
    path: overlays/production
  destination:
    server: https://kubernetes.default.svc
    namespace: stackweaver
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

Argo CD requires Helm chart expansion to be explicitly enabled.
Add `--enable-helm` to the Kustomize build options in your Argo CD config, or set the following field on the Application's source:

```yaml
    kustomize:
      enableHelm: true
```

## Flux CD

Create a `Kustomization` resource that points at the overlay directory.

```yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: stackweaver
  namespace: flux-system
spec:
  interval: 10m
  path: ./overlays/production
  prune: true
  sourceRef:
    kind: GitRepository
    name: your-gitops-repo
  targetNamespace: stackweaver
```

Flux enables Helm chart expansion in Kustomize by default.
No additional configuration is required.

## Image Pull Secret

The StackWeaver images are hosted on GHCR and require an image pull secret.
See [Kubernetes Pull Secret for GHCR](../kubernetes-pull-secret-ghcr.md) for instructions on creating the secret.
Once created, add its name to `global.imagePullSecrets` in the example `values.yaml`, which ships as an empty list.
