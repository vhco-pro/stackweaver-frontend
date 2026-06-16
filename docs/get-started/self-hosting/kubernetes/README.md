---
description: "Kubernetes Helm chart deployment guide with secrets, ingress, SSO, and external dependencies"
covers:
  - "deploy/helm/**"
  - "scripts/zitadel-init/**"
---

# Kubernetes Deployment

This guide walks through deploying StackWeaver on Kubernetes using the official Helm chart.
The chart deploys all StackWeaver components and their dependencies (PostgreSQL, Redis, Garage, Zitadel) in a single release.

## Prerequisites

- Kubernetes 1.27+ cluster
- Helm 3.12+
- An ingress controller (NGINX Inc, community NGINX, or Traefik)
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
| Garage | StatefulSet | S3-compatible object storage |
| Zitadel | Deployment | OIDC identity provider |
| Ingress (app) | Ingress | Routes frontend + API traffic |
| Ingress (auth) | Ingress | Routes Zitadel traffic |

All services communicate via internal Kubernetes DNS names.
No service uses `localhost`; the Helm chart automatically configures the correct internal addresses.

## Runner security and isolation

The Ansible and Terraform runners execute Infrastructure-as-Code and connect to your hosts and cloud accounts, so the chart applies several isolation controls by default. You do not need to configure any of them, but it is worth knowing what protects a multi-tenant deployment.

Each runner container runs as a non-root user with a read-only root filesystem, drops all Linux capabilities, forbids privilege escalation, and runs under the default seccomp profile. The Ansible runner needs no capabilities of its own, because privilege escalation for a playbook (Ansible `become`) happens on the target host over SSH rather than inside the runner.

The Ansible runner's per-job working directory — which briefly holds SSH keys, vault passwords, and inventory secrets while a job runs — lives on an ephemeral volume that is isolated from the Terraform runner and is removed when the job finishes. It deliberately does not share the Terraform runner's workspace volume, so a compromised run in one runner cannot read the other's staged credentials. Because run output, status, and history are persisted to PostgreSQL and object storage rather than this scratch volume, nothing you see in the UI is lost when a runner pod is rescheduled.

The Ansible runner keeps a per-project Ansible Galaxy collection cache on a dedicated PersistentVolumeClaim (`ansibleRunner.galaxyCache`, enabled by default). The cache is namespaced per project so one tenant's collections are never served to another, and a background janitor evicts any project cache that has been idle longer than `GALAXY_CACHE_TTL_DAYS` (14 days by default; set to `0` to disable) so it cannot grow without bound. The cache is purely a download optimization — set `ansibleRunner.galaxyCache.enabled` to `false` to use an ephemeral cache instead, at the cost of re-downloading collections after a pod restart. For more than one Ansible runner replica, set `ansibleRunner.galaxyCache.accessMode` to `ReadWriteMany`.

Credential encryption is enforced rather than assumed. The Ansible runner refuses to start unless it is given a real 32-byte encryption key, instead of silently falling back to an insecure all-zero key. The chart provisions a strong key automatically (see [Secrets](#secrets)); if you bring your own, it must be a 32-byte value, which is a 64-character hex string.

## Chart Distribution

The Helm chart is published to an OCI registry for distribution. Since we are already on github we have opted to use [GHCR](https://github.com/vhco-pro/stackweaver-helm/pkgs/container/charts%2Fstackweaver).

> [!IMPORTANT]
> Check the [github container registry](https://github.com/vhco-pro/stackweaver-helm/pkgs/container/charts%2Fstackweaver) for the latest version, then substitute it into the commands below.

## Zero-Config Install

The quickest way to get started. The chart auto-generates all required passwords, keys, and credentials.
You only need to provide your domain names.

```bash
helm install stackweaver oci://ghcr.io/vhco-pro/charts/stackweaver \
  --version 0.1.0 \
  --namespace stackweaver --create-namespace \
  --set ingress.hosts.app=stackweaver.example.com \
  --set ingress.hosts.auth=auth.stackweaver.example.com
```

That is it.
The chart generates random secrets for PostgreSQL, storage, the encryption key, and Zitadel, and persists them in Kubernetes Secrets that survive upgrades and uninstalls.

The frontend is configured automatically; its API URL, Zitadel issuer, and OAuth2 redirect URI are all derived from the ingress host names.

## Using a Values File

For anything beyond the minimal install, create a `values.yaml` file.

```yaml
ingress:
  enabled: true
  className: nginx
  provider: nginx-inc
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
  --version 0.1.0 \
  --namespace stackweaver --create-namespace \
  --values my-values.yaml
```

## Ingress Controller Provider

The chart supports multiple ingress controllers through the `ingress.provider` field, which selects the correct annotation presets for your controller.
Each provider maps the same logical settings (regex routing, body size limits, timeouts) to the annotation syntax your controller expects.

| Provider | Description | Default `className` |
|---|---|---|
| `nginx-inc` | NGINX Inc ingress controller (`nginx.org/*` annotations) — **default** | `nginx` |
| `community-nginx` | Community NGINX ingress controller (`nginx.ingress.kubernetes.io/*`) — sunset project | `nginx` |
| `traefik` | Traefik ingress controller (minimal annotations; use middleware CRDs for advanced config) | `traefik` |
| `none` | No controller-specific annotations — supply everything manually | *(user must set)* |

To switch provider, set `ingress.provider` in your values file:

```yaml
ingress:
  provider: traefik
  className: traefik
```

> [!NOTE]
> The default changed from community NGINX annotations to NGINX Inc annotations, reflecting the community project's sunset status.
> If you are upgrading from an earlier chart version and use the community NGINX ingress controller, set `provider: community-nginx` to preserve the previous behavior.

### Custom Annotations

User-supplied annotations are always merged on top of the provider presets, so you can override or extend any preset value.
The chart supports three levels of annotation customization:

```yaml
ingress:
  provider: nginx-inc
  annotations: {}          # applied to both app and auth ingress resources
  appAnnotations: {}       # applied only to the app ingress (merged after annotations)
  authAnnotations: {}      # applied only to the auth ingress (merged after annotations)
```

For controllers not covered by the built-in presets (HAProxy, Istio, Emissary, etc.), set `provider: none` and supply all required annotations manually.
If your controller uses entirely different resource kinds (such as Traefik `IngressRoute` CRDs or Istio `VirtualService`), set `ingress.enabled: false` and manage routing externally.

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

# Storage credentials (Garage format: access-key = GK + 24 hex, secret-key = 64 hex)
kubectl create secret generic my-storage-secret \
  --namespace $NAMESPACE \
  --from-literal=access-key="GK$(openssl rand -hex 12)" \
  --from-literal=secret-key="$(openssl rand -hex 32)"

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
  --from-literal=webhook-complement-token-key="" \
  --from-literal=admin-pat=""
```

Reference them in your values file.

```yaml
secrets:
  postgresql:
    secretName: my-db-secret
  storage:
    secretName: my-storage-secret
  encryption:
    secretName: my-encryption-secret
  zitadel:
    secretName: my-zitadel-secret
```

When all four `secretName` values are set, the chart creates zero Secret resources, which is safe for GitOps.

### BYO Zitadel Secret with External Zitadel

If you use an external Zitadel instance (`zitadel.bundled: false`), the zitadel-init sidecar does not run.
You **must** provide a BYO Zitadel secret with all derived keys pre-populated — they will not be filled in automatically.

```bash
kubectl create secret generic my-zitadel-secret \
  --namespace stackweaver \
  --from-literal=client-id="<your API app client ID>" \
  --from-literal=client-secret="<your API app client secret>" \
  --from-literal=frontend-client-id="<your frontend app client ID>" \
  --from-literal=login-service-user-token="<your service user PAT>" \
  --from-literal=masterkey="" \
  --from-literal=admin-password="" \
  --from-literal=webhook-idp-sync-key="" \
  --from-literal=webhook-complement-token-key=""
```

> [!WARNING]
> If you set `zitadel.bundled: false` without providing `secrets.zitadel.secretName`, the chart auto-generates a Zitadel secret with empty derived keys and no sidecar to populate them.
> The API and frontend will fail to start.

### Required Keys Reference

Each secret must contain specific keys. If a key is missing, the dependent pods will fail silently with empty environment variables.

| Secret | Required keys | Configurable via |
|---|---|---|
| PostgreSQL | `password` | `secrets.postgresql.keys.password` |
| Storage | `access-key`, `secret-key` | `secrets.storage.keys.accessKey`, `secrets.storage.keys.secretKey` |
| Encryption | `encryption-key` | `secrets.encryption.keys.key` |
| Zitadel (bundled) | `masterkey`, `admin-password`, `admin-username` (derived keys filled by sidecar) | `secrets.zitadel.keys.*` |
| Zitadel (external) | `client-id`, `client-secret`, `frontend-client-id`, `login-service-user-token` | `secrets.zitadel.keys.*` |

If your existing secret uses different key names, set the corresponding `secrets.<component>.keys.*` values to match.

## Complete Zitadel Initialization

A `zitadel-init` sidecar runs alongside Zitadel in the same pod.
It waits for Zitadel to become ready, then creates the OIDC apps, service users, and webhooks that StackWeaver needs, writes the generated credentials directly into the Zitadel Kubernetes Secret, and triggers rolling restarts of the API and frontend.
No manual steps are required.

On the first boot, the sidecar reads the admin PAT from a shared emptyDir volume (written by Zitadel during database initialization) and persists it to the K8s Secret.
On subsequent pod restarts, the sidecar falls back to reading the PAT from the K8s Secret, so it never crash-loops waiting for a file that won't appear.

To monitor progress:

```bash
kubectl logs -f deployment/stackweaver-zitadel -c zitadel-init --namespace stackweaver
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
| `VITE_ZITADEL_REDIRECT_URI` | `https://<ingress.hosts.app>/auth/callback` |
| `VITE_ZITADEL_CLIENT_ID` | `secrets.zitadel` Secret (injected at pod start) |

## Deploying Without Ingress (localhost / port-forward)

For local testing or environments without an ingress controller, disable ingress and override the Zitadel domain configuration.

```yaml
ingress:
  enabled: false

# Override Zitadel's ExternalDomain (normally derived from ingress.hosts.auth)
zitadel:
  config:
    ExternalDomain: localhost
    ExternalPort: 8080
    ExternalSecure: false
    # Without a reverse proxy handling TLS, Zitadel must use plain HTTP URLs
    tlsMode: disabled
    # The login UI is now served by the Stackweaver SPA itself; point
    # Zitadel's LoginV2.BaseURI at the SPA's /login route.
    loginUIBaseURL: "http://localhost:5173/login"

# Override frontend env vars (normally derived from ingress hosts)
frontend:
  env:
    VITE_API_URL: "http://localhost:8022/api/v2"
    VITE_ZITADEL_REDIRECT_URI: "http://localhost:5173/auth/callback"
```

Access the services via `kubectl port-forward`:

```bash
kubectl port-forward -n stackweaver svc/stackweaver-frontend 5173:8080 &
kubectl port-forward -n stackweaver svc/stackweaver-api 8022:8022 &
kubectl port-forward -n stackweaver svc/stackweaver-zitadel 8080:8080 &
```

Then open `http://localhost:5173`.

## Using External Dependencies

To use an existing PostgreSQL, Redis, or S3-compatible storage instance instead of the bundled ones, disable the in-cluster deployment and provide external connection details.

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

# External S3-compatible storage (AWS S3, R2, B2, MinIO, etc.)
garage:
  enabled: false

storage:
  bucket: stackweaver
  region: eu-west-1
  endpoint: ""          # empty = AWS default
  useSSL: true
  forcePathStyle: false
```

## Custom CA Certificates

If your Zitadel instance (or any other upstream service such as an external S3-compatible storage or PostgreSQL endpoint) is signed by an internal or corporate certificate authority, the Go services will refuse TLS connections with an error like `x509: certificate signed by unknown authority`.

To fix this, provide the CA certificate to the chart using one of three approaches.

**Option 1 — inline PEM in your values file** (simplest, cert is public data):

```yaml
customCA:
  cert: |
    -----BEGIN CERTIFICATE-----
    MIIDXTCCAkWgAwIBAgIJAL...
    -----END CERTIFICATE-----
```

The chart creates a ConfigMap from this value automatically.

**Option 2 — existing ConfigMap** (if you manage the cert separately):

```bash
kubectl create configmap my-ca-bundle \
  --namespace stackweaver \
  --from-file=ca.crt=/path/to/corporate-ca.crt
```

```yaml
customCA:
  existingConfigMap: my-ca-bundle
```

**Option 3 — existing Secret** (for GitOps workflows using External Secrets Operator or Sealed Secrets):

```yaml
customCA:
  existingSecret: my-ca-secret
  key: ca.crt  # key within the Secret (default: ca.crt)
```

In all cases the certificate is mounted at `/etc/ssl/certs/custom-ca.crt` using `subPath`, so the system certificate directory is not replaced.
Go's `crypto/x509` package scans `/etc/ssl/certs/` on Linux automatically — no additional environment variables are required.

The certificate is mounted into the API, Orchestrator, Terraform Runner, and Ansible Runner containers.

## SSO Configuration

The chart supports configuring an external identity provider (Azure AD, Okta, AWS Cognito, or any OIDC-compliant provider) for single sign-on. Client secrets are stored in a pre-existing Kubernetes Secret; non-secret values are set directly in the Helm values file.

Create a Secret containing the SSO client secret(s):

```bash
# Azure AD
kubectl create secret generic stackweaver-sso \
  --namespace stackweaver \
  --from-literal=azure-ad-client-secret="<your-client-secret>"

# Generic OIDC (Okta, AWS Cognito, etc.)
kubectl create secret generic stackweaver-sso \
  --namespace stackweaver \
  --from-literal=oidc-idp-client-secret="<your-client-secret>"
```

Then add the SSO configuration to your values file:

```yaml
sso:
  enableOidcTeamSync: true
  secretName: stackweaver-sso
  # Azure AD / Entra ID
  azureAd:
    clientId: "<your-azure-client-id>"
    tenantId: "<your-azure-tenant-id>"
  # OR Generic OIDC (Okta, Cognito, Keycloak, etc.)
  oidcProvider:
    name: "Okta"
    issuer: "https://dev-12345678.okta.com/oauth2/default"
    clientId: "<your-oidc-client-id>"
```

If your Secret uses different key names (for example, when managed by External Secrets Operator or Sealed Secrets), override the defaults with `sso.keys`:

```yaml
sso:
  secretName: my-existing-secret
  keys:
    azureAdClientSecret: my-azure-key       # default: azure-ad-client-secret
    oidcProviderClientSecret: my-oidc-key   # default: oidc-idp-client-secret
```

The zitadel-init sidecar picks up these values, registers the identity provider in Zitadel, and adds the SSO login button automatically. For provider-specific setup instructions (redirect URIs, group claims, etc.), see the [SSO user guides](../../../user-guides/sso/).

## Upgrading

```bash
helm upgrade stackweaver oci://ghcr.io/vhco-pro/charts/stackweaver \
  --version 0.1.0 \
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
PersistentVolumeClaims for PostgreSQL, Garage, runner workspaces, and the Ansible Galaxy cache are also not deleted automatically.
Remove them manually if no longer needed.

> [!WARNING]
> Secrets and PVCs are coupled. Deleting a secret without deleting the corresponding PVC (or vice versa) can leave the cluster in an unrecoverable state — for example, deleting the Zitadel secret removes the masterkey needed to decrypt the Zitadel database. Before any destructive operation, back up your secrets:
>
> ```bash
> kubectl get secret stackweaver-zitadel -n stackweaver -o yaml > zitadel-secret-backup.yaml
> kubectl get secret stackweaver-postgresql -n stackweaver -o yaml > postgresql-secret-backup.yaml
> ```
>
> Store these outside the cluster. If you intend a full clean start, delete the secrets **and** the PVCs together.

**What you can safely delete** (will be re-created on next install):

| Resource | Safe to delete? | Consequence |
|---|---|---|
| Deployments, Services, ConfigMaps, Jobs | Yes | Re-created by Helm |
| Secrets + PVCs together | Yes | Full clean start, all data lost |
| PVCs only (keep secrets) | Yes | Fresh databases, credentials still match — zitadel-init re-provisions OIDC apps |
| Secrets only (keep PVCs) | **No** | New random credentials don't match existing data — **unrecoverable** for masterkey and encryption-key |

For a full clean start:

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
kubectl delete secret stackweaver-zitadel stackweaver-storage \
  stackweaver-postgresql stackweaver-encryption \
  -n stackweaver
```

Then re-run `helm install`.
