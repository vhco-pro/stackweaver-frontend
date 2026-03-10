<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Kubernetes Deployment

This guide walks through deploying StackWeaver on Kubernetes using the official Helm chart.
The chart deploys all StackWeaver components and their dependencies (PostgreSQL, Redis, MinIO, Zitadel) in a single release.

## Prerequisites

- Kubernetes 1.27+ cluster
- Helm 3.12+
- An ingress controller (nginx-ingress recommended)
- Two DNS records pointing to your ingress (one for the app, one for Zitadel auth)
- TLS certificates (cert-manager recommended, or provide your own)
- A Kubernetes image pull secret for GHCR (see [Kubernetes Pull Secret for GHCR](./kubernetes-pull-secret-ghcr.md))

## Architecture Overview

The chart deploys the following resources.

| Component | Kind | Description |
|---|---|---|
| API | Deployment | Go REST API (port 8022) |
| Frontend | Deployment | React SPA served by nginx (port 80) |
| Orchestrator | Deployment | Job scheduler (no external port) |
| Terraform Runner | Deployment | Executes Terraform operations |
| Ansible Runner | Deployment | Executes Ansible playbooks |
| PostgreSQL | StatefulSet | Database |
| Redis | Deployment | Job queue and pubsub |
| MinIO | StatefulSet | Object storage |
| Zitadel | Deployment | OIDC identity provider |
| Login UI | Deployment | Zitadel login interface |
| Ingress (app) | Ingress | Routes frontend + API traffic |
| Ingress (auth) | Ingress | Routes Zitadel + Login UI traffic |

All services communicate via internal Kubernetes DNS names.
No service uses `localhost`; the Helm chart automatically configures the correct internal addresses.

## Chart Distribution

The Helm chart is published to an OCI registry and does not require cloning any repository.
Check the [releases page](https://github.com/vhco-pro/stackweaver-helm/releases) for the latest version, then substitute it into the commands below.

## Zero-Config Install

The quickest way to get started. The chart auto-generates all required passwords, keys, and credentials.
You only need to provide your domain names.

```bash
helm install stackweaver oci://ghcr.io/vhco-pro/charts/stackweaver \
  --version 0.3.12 \
  --namespace stackweaver --create-namespace \
  --set ingress.hosts.app=stackweaver.example.com \
  --set ingress.hosts.auth=auth.stackweaver.example.com
```

That is it.
The chart generates random secrets for PostgreSQL, MinIO, the encryption key, and Zitadel, and persists them in Kubernetes Secrets that survive upgrades and uninstalls.

The frontend is configured automatically; its API URL, Zitadel issuer, and OAuth2 redirect URI are all derived from the ingress host names.

## Using a Values File

For anything beyond the minimal install, create a `values.yaml` file.

```yaml
ingress:
  enabled: true
  className: nginx
  tls:
    enabled: true
    secretName: stackweaver-tls
    authSecretName: stackweaver-auth-tls
  hosts:
    app: stackweaver.example.com
    auth: auth.stackweaver.example.com
```

Install with the file.

```bash
helm install stackweaver oci://ghcr.io/vhco-pro/charts/stackweaver \
  --version 0.3.12 \
  --namespace stackweaver --create-namespace \
  --values my-values.yaml
```

## Secrets

By default the chart auto-generates all secrets.
For production or GitOps workflows (ArgoCD, Flux), you can provide your own pre-existing Kubernetes Secrets instead.

### Auto-Generated (Default)

When you leave `secrets.<component>.secretName` empty, the chart creates a Secret with random credentials.
These secrets have the `helm.sh/resource-policy: keep` annotation, which means they are preserved even if you run `helm uninstall`.
Values are also preserved across `helm upgrade`, because the chart checks for existing secrets before generating new ones.

To view an auto-generated password:

```bash
kubectl get secret stackweaver-postgresql -n stackweaver \
  -o jsonpath='{.data.password}' | base64 -d
```

### Bring Your Own Secrets

Create the secrets in advance and reference them in your values file.

> [!IMPORTANT] 
> If you create secrets manually with `kubectl create`, you must reference all four of them via `secretName` in your values file before running `helm install`. If you run `helm install` without those references, Helm will attempt to create and own the same secrets, which conflicts with the `kubectl-create` field manager and causes the installation to fail.

```bash
NAMESPACE=stackweaver
kubectl create namespace $NAMESPACE

# PostgreSQL password
kubectl create secret generic my-db-secret \
  --namespace $NAMESPACE \
  --from-literal=password="$(openssl rand -base64 24)"

# MinIO credentials
kubectl create secret generic my-minio-secret \
  --namespace $NAMESPACE \
  --from-literal=access-key=minioadmin \
  --from-literal=secret-key="$(openssl rand -base64 32)"

# Encryption key (32-byte hex string)
kubectl create secret generic my-encryption-secret \
  --namespace $NAMESPACE \
  --from-literal=encryption-key="$(openssl rand -hex 32)"

# Zitadel credentials
kubectl create secret generic my-zitadel-secret \
  --namespace $NAMESPACE \
  --from-literal=masterkey="$(openssl rand -hex 16)" \
  --from-literal=admin-password="$(openssl rand -base64 16)" \
  --from-literal=client-id="" \
  --from-literal=client-secret="" \
  --from-literal=login-service-user-token="" \
  --from-literal=frontend-client-id="" \
  --from-literal=webhook-idp-sync-key="" \
  --from-literal=webhook-complement-token-key=""
```

Reference them in your values file.

```yaml
secrets:
  postgresql:
    secretName: my-db-secret
  minio:
    secretName: my-minio-secret
  encryption:
    secretName: my-encryption-secret
  zitadel:
    secretName: my-zitadel-secret
```

When all four `secretName` values are set, the chart creates zero Secret resources, which is safe for GitOps.

## Complete Zitadel Initialization

After Zitadel starts, a post-install Job called `zitadel-init` runs automatically.
It creates the OIDC apps, service users, and webhooks that StackWeaver needs, then writes the generated credentials directly into the Zitadel Kubernetes Secret and triggers rolling restarts of the API, frontend, and login-ui.
No manual steps are required.

To monitor progress:

```bash
kubectl logs -f job/stackweaver-zitadel-init --namespace stackweaver
```

## Frontend Runtime Configuration

The frontend is a generic container image with no domain-specific configuration baked in at build time.
Instead, the Helm chart generates an `env.js` file at deploy time with the correct URLs derived from your ingress hosts.

This means:

- The same frontend image works for any deployment (staging, production, different domains).
- Changing configuration only requires a Helm upgrade, not an image rebuild.
- The Zitadel client ID is injected from the Zitadel secret automatically.

The generated `env.js` sets these values:

| Variable | Derived From |
|---|---|
| `VITE_API_URL` | `https://<ingress.hosts.app>/api/v2` |
| `VITE_ZITADEL_ISSUER` | `https://<ingress.hosts.auth>` |
| `VITE_ZITADEL_REDIRECT_URI` | `https://<ingress.hosts.app>/auth/callback` |
| `VITE_ZITADEL_CLIENT_ID` | `secrets.zitadel` Secret (injected at pod start) |

## Using External Dependencies

To use an existing PostgreSQL, Redis, or MinIO instance instead of the bundled ones, disable the in-cluster deployment and provide external connection details.

```yaml
# External PostgreSQL
postgresql:
  enabled: false
  external:
    host: my-postgres.example.com
    port: 5432
    username: stackweaver
    database: stackweaver
    sslmode: require

# External Redis
redis:
  enabled: false
  external:
    host: my-redis.example.com
    port: 6379

# External MinIO / S3
minio:
  enabled: false
  external:
    endpoint: s3.amazonaws.com
    useSSL: true

storage:
  provider: s3
  s3:
    region: eu-west-1
```

## Upgrading

```bash
helm upgrade stackweaver oci://ghcr.io/vhco-pro/charts/stackweaver \
  --version 0.3.12 \
  --namespace stackweaver \
  --values my-values.yaml
```

Auto-generated secrets are preserved across upgrades.
Pods are automatically restarted when ConfigMaps change (via checksum annotations).

## Uninstalling

```bash
helm uninstall stackweaver --namespace stackweaver
```

Auto-generated secrets are **not** deleted on uninstall (due to `helm.sh/resource-policy: keep`).
PersistentVolumeClaims for PostgreSQL, MinIO, runner workspaces, and Zitadel PAT are also not deleted automatically.
Remove them manually if no longer needed.

```bash
kubectl delete pvc -l app.kubernetes.io/instance=stackweaver -n stackweaver
kubectl delete secret -l app.kubernetes.io/managed-by=Helm -n stackweaver
```

## Troubleshooting

### Installation fails with "Apply failed with conflicts: conflicts with kubectl-create"

This error occurs when secrets already exist in the namespace that were created with `kubectl create` (rather than by Helm). Helm uses server-side apply and cannot take ownership of fields managed by a different field manager.

This happens if you ran `kubectl create secret generic` commands manually and then ran `helm install` without providing the `secretName` references in your values file, or if a previous install attempt left behind secrets.

To resolve, delete the conflicting secrets and re-run the install. Helm will recreate them with the correct field manager.

```bash
kubectl delete secret stackweaver-zitadel stackweaver-minio \
  stackweaver-postgresql stackweaver-encryption \
  -n stackweaver
```

Then re-run `helm install`.
