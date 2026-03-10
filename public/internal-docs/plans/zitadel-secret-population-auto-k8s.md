# Plan: Automate Zitadel Secret Population in Kubernetes

**Status:** ✅ Implemented. Helm chart includes `secrets-init-job.yaml` with `zitadel-init-rbac.yaml` ServiceAccount and RBAC, enabling the init job to patch the Zitadel Secret and trigger rolling restarts automatically.

## Context

After a Helm install the `zitadel-init` Job successfully provisions all Zitadel credentials (OIDC app client IDs/secrets, service user token, webhook signing keys), but it only writes them to `deploy/.env` (for Docker Compose). In Kubernetes, the credentials land nowhere: the Zitadel Secret is created by the chart with empty values, and the NOTES.txt currently asks the operator to manually run `kubectl patch secret` and `kubectl rollout restart`. That manual step breaks any "one-command install" story.

**Goal:** The `zitadel-init` container detects when it's running inside Kubernetes, patches the Zitadel Secret directly via the in-cluster Kubernetes API, and then triggers rolling restarts of the three deployments that consume those credentials (API, frontend, login-ui). Zero manual steps.

---

## Deployments that consume the Zitadel Secret

| Deployment | Keys used | Needs restart? |
|---|---|---|
| `*-api` | `client-id`, `client-secret`, `login-service-user-token`, `webhook-idp-sync-key`, `webhook-complement-token-key` | Yes |
| `*-frontend` | `frontend-client-id` (init container) | Yes |
| `*-login-ui` | `login-service-user-token` | Yes |

All three reference the secret via `secretKeyRef` (injected at pod start), so a patch to the Secret alone is not enough; pods must be restarted to pick up the new values.

---

## Approach: In-process K8s API calls (no new dependency)

The `zitadel-init` binary uses stdlib `net/http` + `crypto/tls` to call the in-cluster Kubernetes API. No `k8s.io/client-go` needed (that dependency tree is enormous). In-cluster auth material is always mounted at:

```
/var/run/secrets/kubernetes.io/serviceaccount/token      ← bearer token
/var/run/secrets/kubernetes.io/serviceaccount/ca.crt     ← TLS CA
/var/run/secrets/kubernetes.io/serviceaccount/namespace  ← current namespace
```

K8s API server address comes from the `KUBERNETES_SERVICE_HOST` / `KUBERNETES_SERVICE_PORT` env vars (always set inside a pod).

**Detection:** `isRunningInKubernetes()` checks for the existence of the token file above.

---

## Files to Change

### 1. `scripts/zitadel-init/main.go`

Add three functions:

**`isRunningInKubernetes() bool`**
```go
_, err := os.Stat("/var/run/secrets/kubernetes.io/serviceaccount/token")
return err == nil
```

**`writeKubernetesSecret(secretName, namespace string, data map[string]string) error`**
- Reads token + CA from well-known paths
- Builds TLS-verified `http.Client`
- PATCH `https://${KUBERNETES_SERVICE_HOST}:${KUBERNETES_SERVICE_PORT}/api/v1/namespaces/{ns}/secrets/{name}`
- `Content-Type: application/merge-patch+json`
- Body: `{"stringData": { ... }}`
- 404 is fatal (secret must pre-exist, created by chart)

**`restartDeployment(name, namespace string) error`**
- Same in-cluster client
- PATCH `https://.../apis/apps/v1/namespaces/{ns}/deployments/{name}`
- Body patches `spec.template.metadata.annotations["kubectl.kubernetes.io/restartedAt"]` to `time.Now().UTC().Format(time.RFC3339)`

**Modify `writeConfigFiles()`:**
Add a branch at the top:
```go
if isRunningInKubernetes() {
    return writeKubernetesSecret(...)
}
// existing .env write logic follows unchanged
```

**Modify `main()`:**
After `writeConfigFiles()` succeeds, if in K8s mode, call `restartDeployment()` for each of the three deployments (names passed in via env vars, see below).

Preserve existing `.env` path untouched; the Docker Compose flow is unaffected.

---

### 2. `scripts/zitadel-init/go.mod`

No new direct dependencies. `net/http`, `crypto/tls`, `encoding/json` are all stdlib.

---

### 3. NEW `deploy/helm/stackweaver/templates/zitadel/zitadel-init-rbac.yaml`

```yaml
{{- if .Values.zitadel.bundled }}
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{ include "stackweaver.fullname" . }}-zitadel-init
  labels: ...
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: {{ include "stackweaver.fullname" . }}-zitadel-init
rules:
  - apiGroups: [""]
    resources: ["secrets"]
    resourceNames: ["{{ include "stackweaver.secrets.zitadel" . }}"]
    verbs: ["get", "patch"]
  - apiGroups: ["apps"]
    resources: ["deployments"]
    resourceNames:
      - "{{ include "stackweaver.fullname" . }}-api"
      - "{{ include "stackweaver.fullname" . }}-frontend"
      - "{{ include "stackweaver.fullname" . }}-login-ui"
    verbs: ["get", "patch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: {{ include "stackweaver.fullname" . }}-zitadel-init
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: {{ include "stackweaver.fullname" . }}-zitadel-init
subjects:
  - kind: ServiceAccount
    name: {{ include "stackweaver.fullname" . }}-zitadel-init
    namespace: {{ .Release.Namespace }}
{{- end }}
```

The `resourceNames` restriction is important: the init job can only touch exactly the secrets and deployments it needs. Principle of least privilege.

---

### 4. `deploy/helm/stackweaver/templates/zitadel/zitadel-init-job.yaml`

Add `serviceAccountName` and new env vars to the Job pod spec:

```yaml
serviceAccountName: {{ include "stackweaver.fullname" . }}-zitadel-init

env:
  # ... existing vars unchanged ...
  - name: K8S_SECRET_NAME
    value: {{ include "stackweaver.secrets.zitadel" . }}
  - name: K8S_NAMESPACE
    valueFrom:
      fieldRef:
        fieldPath: metadata.namespace   # Downward API; no hardcoding
  - name: K8S_API_DEPLOYMENT
    value: {{ include "stackweaver.fullname" . }}-api
  - name: K8S_FRONTEND_DEPLOYMENT
    value: {{ include "stackweaver.fullname" . }}-frontend
  - name: K8S_LOGIN_UI_DEPLOYMENT
    value: {{ include "stackweaver.fullname" . }}-login-ui
```

The namespace is injected via the Kubernetes Downward API so there's no hardcoding required.

---

### 5. `deploy/helm/stackweaver/templates/NOTES.txt`

Remove the "Then update the secret:" / `kubectl patch` / `kubectl rollout restart` block entirely. Replace with a single line noting the init job handles everything automatically.

---

## Secret Key Mapping

The `writeKubernetesSecret` function builds this map (matching exactly what the chart puts in `secrets.zitadel.keys`):

| Secret key | Source variable |
|---|---|
| `client-id` | `apiClientID` |
| `client-secret` | `apiClientSecret` |
| `login-service-user-token` | `loginServiceToken` |
| `frontend-client-id` | `frontendClientID` |
| `webhook-idp-sync-key` | `idpSyncKey` |
| `webhook-complement-token-key` | `complementTokenKey` |

The key names are the Helm defaults. If an operator overrides `secrets.zitadel.keys.*` in `values.yaml`, the key names won't match. To handle this we can pass the key names as additional env vars to the init job, OR document that custom key names require a manual step. Given the complexity tradeoff, **pass the key names as env vars** so the binary uses them at runtime:

```yaml
- name: K8S_KEY_CLIENT_ID
  value: {{ .Values.secrets.zitadel.keys.clientId }}
- name: K8S_KEY_CLIENT_SECRET
  value: {{ .Values.secrets.zitadel.keys.clientSecret }}
# ... etc for all 6 keys
```

---

## Rollout Restart Strategy

Restart order: API → frontend → login-ui (sequential, fire-and-forget patch; no waiting for rollout). The deployments converge on their own. If a deployment doesn't exist (e.g. `login-ui` when `zitadel.bundled: false`), the 404 is logged as a warning but does not fail the job.

### Reloader compatibility

[Stakater Reloader](https://github.com/stakater/Reloader) watches Secrets for changes and automatically triggers rolling restarts of annotated deployments. If both Reloader and our init job attempt a restart, the result is harmless (pods come up correctly either way) but causes two restart cycles instead of one.

To avoid the unnecessary churn, `restartDeployment()` reads the deployment's annotations before deciding to patch:

- If `reloader.stakater.com/auto: "true"` is present → skip; log that Reloader will handle it.
- If `secret.reloader.stakater.com/reload` is present and contains the Zitadel secret name → skip; log that Reloader will handle it.
- Otherwise → apply the `kubectl.kubernetes.io/restartedAt` patch as normal.

The `GET /apis/apps/v1/namespaces/{ns}/deployments/{name}` call needed to check annotations is the same one required to read the current `resourceVersion` before a strategic-merge PATCH anyway, so there is no extra round-trip cost. The Role already grants `get` on deployments.

---

## Verification

1. `helm install stackweaver ./deploy/helm/stackweaver -f values.yaml`
2. Wait for `zitadel-init` job to complete: `kubectl logs job/<release>-zitadel-init -f`
3. Confirm secret is populated: `kubectl get secret <zitadel-secret> -o jsonpath='{.data.client-id}' | base64 -d`
4. Confirm deployments restarted (new pods): `kubectl get pods -w`
5. Confirm API is functional: `curl https://<host>/health`
6. Docker Compose flow unchanged: `make up` still works, `.env` still written as before

---

## What is NOT changing

- Docker Compose flow: `writeConfigFiles()` `.env` branch is untouched
- The Zitadel Secret is still created by the chart with empty values first (the init job populates them post-install); no change to `secrets-autogenerated.yaml`
- No new Helm values are needed (everything is derived from existing values)
- The `backoffLimit: 20` retry logic on the job remains; if Zitadel isn't ready yet, the job retries and will re-patch the secret on success
