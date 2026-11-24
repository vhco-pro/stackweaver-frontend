---
title: "Start a launcher"
nav_order: 2
description: "Start a launcher with Docker, Podman, Kubernetes or as a binary on a Linux host, with the in-process, container or Kubernetes driver."
covers:
  - "backend/cmd/launcher/**"
  - "backend/internal/launcher/**"
  - "core/runnercontract/**"
  - "core/runnerdriver/**"
  - "frontend/src/pages/Settings/Runners.tsx"
  - "runner-images/**"
---

# Start a launcher

One launcher binary serves OpenTofu runs, Ansible jobs and syncs. Started with a pool ID and a registration token, it serves that pool and runs each job with its driver. It ships in three forms:

| Form | Use it for |
|------|------------|
| The launcher image, `ghcr.io/vhco-pro/stackweaver-launcher` | The container and Kubernetes drivers. It carries no OpenTofu or Ansible: each job runs in its engine's job image. |
| The job images, `ghcr.io/vhco-pro/stackweaver-opentofu-runner` and `ghcr.io/vhco-pro/stackweaver-ansible-runner` | The in-process driver in Docker or Kubernetes. Each carries its engine's toolchain and starts a launcher for that engine. They are also the images the container and Kubernetes drivers run jobs in. |
| The `stackweaver-launcher` binary | The in-process driver on a Linux host with OpenTofu, Ansible or both installed (see [Linux host, in-process driver](#linux-host-in-process-driver)). |

A launcher serves these engines:

- `RUNNER_ENGINES` (`tofu`, `ansible` or `tofu,ansible`) restricts it to the engines it names. An in-process launcher refuses to start when a named engine's toolchain is missing.
- Otherwise an in-process launcher serves the engines whose toolchain answers on its host (`tofu version`, `ansible --version`), and refuses to start when neither does.
- Otherwise a container or Kubernetes launcher serves both engines. It places each OpenTofu run in `RUNNER_TOFU_IMAGE` and each Ansible job and sync in `RUNNER_ANSIBLE_IMAGE`, both the published job images' `latest` by default.

## Required values

Before starting a launcher, gather the following values.

| Value | Where to find it | Example |
|-------|-------------------|---------|
| **Agent pool ID** | Agent Pools UI (pool detail page or URL) | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| **Registration token** | The [registration credential](./agent-pools.md#create-a-registration-credential) you created for the pool | `tfe-xxx...` |
| **Stackweaver server** | Your Stackweaver URL | `https://app.stackweaver.io` |

## Docker, in-process driver

The simplest launcher runs each job as a child process of its own container and needs nothing from the host but Docker. Pick the tab for the workload your pool serves, and replace `<pool-uuid>`, `<your-token>`, and the server URL with your actual values.

::: code-group
```bash [OpenTofu launcher]
docker run -d --restart unless-stopped --stop-timeout 390 \
  -e RUNNER_AGENT_POOL_ID="<pool-uuid>" \
  -e STACKWEAVER_TOKEN="<your-token>" \
  -e STACKWEAVER_SERVER=https://your-stackweaver.example.com \
  -e RUNNER_NAME=my-tofu-launcher \
  ghcr.io/vhco-pro/stackweaver-opentofu-runner:latest
```
```bash [Ansible launcher]
docker run -d --restart unless-stopped --stop-timeout 390 \
  -e RUNNER_AGENT_POOL_ID="<pool-uuid>" \
  -e STACKWEAVER_TOKEN="<your-token>" \
  -e STACKWEAVER_SERVER=https://your-stackweaver.example.com \
  -e RUNNER_NAME=my-ansible-launcher \
  ghcr.io/vhco-pro/stackweaver-ansible-runner:latest
```
:::

`--stop-timeout 390` gives a stopping launcher time to let its jobs finish (see [Drivers and isolation](./drivers-and-network-modes.md#drivers-and-isolation)); Docker's default of 10 seconds would kill it first. Each job image serves its own engine. An in-process launcher runs one job at a time unless you raise `RUNNER_MAX_CONCURRENT_JOBS`. Its jobs share the launcher's filesystem, user and network, and they run only in its own image. Use the container driver when jobs need isolation from one another or a [run image](./run-images-and-execution-environments.md) of their own.

## Docker or Podman, container driver

With the container driver, the launcher creates a fresh, hardened container for every job through the engine's socket. Each job container runs as a non-root user with a read-only root filesystem and a writable `/tmp`, drops every Linux capability, forbids privilege escalation and is removed when the job ends. The socket is root-equivalent on the host, which is why the launcher itself never runs user code.

```bash
docker run -d --restart unless-stopped --stop-timeout 390 --user root \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v stackweaver-launcher-cache:/var/cache/stackweaver-launcher \
  -v "$PWD/registry-auth.json:/etc/stackweaver/registry-auth.json:ro" \
  -e RUNNER_AGENT_POOL_ID="<pool-uuid>" \
  -e STACKWEAVER_TOKEN="<your-token>" \
  -e STACKWEAVER_SERVER=https://your-stackweaver.example.com \
  -e RUNNER_NAME=my-launcher \
  -e RUNNER_DRIVER=container \
  -e RUNNER_TOFU_IMAGE=ghcr.io/vhco-pro/stackweaver-opentofu-runner:latest \
  -e RUNNER_ANSIBLE_IMAGE=ghcr.io/vhco-pro/stackweaver-ansible-runner:latest \
  -e RUNNER_DOCKER_CONFIG=/etc/stackweaver/registry-auth.json \
  -e RUNNER_FIREWALL_IMAGE=ghcr.io/vhco-pro/stackweaver-launcher:latest \
  -e RUNNER_NETWORK=stackweaver-jobs \
  -e RUNNER_MAX_CONCURRENT_JOBS=4 \
  -e RUNNER_CACHE_DIR=/var/cache/stackweaver-launcher \
  -e RUNNER_CACHE_VOLUME=stackweaver-launcher-cache \
  ghcr.io/vhco-pro/stackweaver-launcher:latest
```

This launcher serves both engines. `RUNNER_TOFU_IMAGE` and `RUNNER_ANSIBLE_IMAGE` are the job images: a job that names no [run image](./run-images-and-execution-environments.md) runs in its engine's job image, and a custom run image gets the job's `stackweaver-executor` program copied from it. The launcher pulls a job image every time it places a job (`RUNNER_JOB_IMAGE_PULL=always`), so a host keeps running the current image after a tag moves; `missing` pulls only an absent image and `never` uses only images already on the host. When the registry cannot be reached, a job whose default job image is cached runs that copy, with a warning in its output; a run image never runs from the cache, and neither does an image the registry refused.

`RUNNER_DOCKER_CONFIG` names the launcher's registry credential for private job images: one or more Docker config files, comma separated, or a directory of `.json` files. The launcher uses each file's inline `auths` entries (`auth`, `username` and `password`, or `identitytoken`) to pull the job images and the firewall image, never a job's run image, which is pulled with its own credential. `credsStore` and `credHelpers` are not supported, and the launcher warns about them at start. Your `~/.docker/config.json` is usually readable only by you, so give the launcher a file of its own, for example:

```json
{ "auths": { "ghcr.io": { "auth": "<base64 of username:token>" } } }
```

`RUNNER_FIREWALL_IMAGE` is the image the launcher writes the jobs network's firewall rules from, which needs `nft` and `iptables`; the launcher image carries both, and it is pulled only when missing. Unset, the launcher uses the OpenTofu job image. `RUNNER_NETWORK` names the jobs network the launcher creates and firewalls (see [Network modes](./drivers-and-network-modes.md#network-modes)); leave it out and jobs run on the engine's default network without the firewall. `RUNNER_CACHE_DIR` and `RUNNER_CACHE_VOLUME` give the launcher a node-local copy of the organization's cache that job containers mount read-only (see [The node-local cache](./caches.md#the-node-local-cache)). Add `-e RUNNER_ENGINES=tofu` or `ansible` to serve one engine only.

Jobs reach the API at the address in `STACKWEAVER_SERVER`, from the jobs network. Use an address a job container can resolve, never `localhost`. When the API runs on the same host, use `http://host.docker.internal:<api-port>`, and add `--add-host host.docker.internal:host-gateway` and `-e RUNNER_EXTRA_HOSTS=host.docker.internal:host-gateway` to the command above so the launcher and its jobs both resolve that name.

### Use Podman instead of Docker

The driver speaks the Docker Engine API, which Podman also serves.

1. Start Podman's API socket: `sudo systemctl enable --now podman.socket` for rootful Podman (`/run/podman/podman.sock`), or `systemctl --user enable --now podman.socket` for rootless Podman (`$XDG_RUNTIME_DIR/podman/podman.sock`).
2. Mount that socket into the launcher. When the path inside the launcher container is not `/var/run/docker.sock`, set `RUNNER_DOCKER_SOCKET` to it. A rootful socket must be readable by the user the launcher runs as.
3. On a host that also runs Docker, let rootful Podman's jobs network past Docker's `FORWARD` drop policy, or run one engine per host. Start the launcher once so it creates the network, read the subnet from `podman network inspect stackweaver-jobs`, and add it to Docker's `DOCKER-USER` chain:

   ```bash
   sudo iptables -I DOCKER-USER -s <jobs subnet> -j ACCEPT
   sudo iptables -I DOCKER-USER -d <jobs subnet> -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
   ```

   These rules last until the next reboot; save them with your distribution's firewall tooling.

On rootful Podman the launcher firewalls the jobs network with an nftables table, so the firewall image (`RUNNER_FIREWALL_IMAGE`) needs `nft`, which the launcher image and the OpenTofu job image carry. Rootless Podman cannot program the host firewall, so the jobs network has no firewall there. Every job then checks at start whether a cloud metadata endpoint answers from its network, and refuses to run if one does.

CPU and memory limits are applied on engines with cgroup v2. On an engine that cannot enforce them, the job runs without them, unless the pool requires limits.

On Docker 26 or later (Engine API 1.45), each job mounts its organization's part of the node-local cache volume. Podman's API cannot mount part of a volume, so on Podman and on older Docker the launcher mounts that part from the volume's directory on the host instead, which needs the `local` volume driver. Where neither works, jobs fetch every cache entry through the API. The cache is mounted read-only with the shared SELinux container label, so jobs can read it on hosts that enforce SELinux, such as Fedora with Podman.

## Kubernetes

Create the target namespace first. Store the registration credential in a Secret, then deploy the launcher with `launcher.yaml`. Pin the launcher image to a reviewed release for a repeatable deployment; `latest` below is an example tag. Avoid entering real tokens in shared shell history, and use your secret-management tooling for production.

### Create a Secret for the registration token

```bash
kubectl create secret generic stackweaver-runner-token \
  --namespace "<runner-namespace>" \
  --from-literal=token="<your-token>"
```

### Deploy the launcher

The manifest below runs an OpenTofu launcher with the in-process driver from the OpenTofu job image, which needs no permissions in the cluster. For an Ansible launcher, use the `ghcr.io/vhco-pro/stackweaver-ansible-runner` image. It deploys a single replica; increase `replicas` to run more launchers in the same pool.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: stackweaver-tofu-launcher
  namespace: <runner-namespace>
spec:
  replicas: 1
  selector:
    matchLabels:
      app: stackweaver-tofu-launcher
  template:
    metadata:
      labels:
        app: stackweaver-tofu-launcher
    spec:
      containers:
        - name: launcher
          image: ghcr.io/vhco-pro/stackweaver-opentofu-runner:latest
          env:
            - name: RUNNER_AGENT_POOL_ID
              value: "<pool-uuid>"
            - name: STACKWEAVER_SERVER
              value: "https://your-stackweaver.example.com"
            - name: RUNNER_NAME
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
            - name: STACKWEAVER_TOKEN
              valueFrom:
                secretKeyRef:
                  name: stackweaver-runner-token
                  key: token
          ports:
            - name: health
              containerPort: 9090
          livenessProbe:
            httpGet:
              path: /healthz
              port: health
          readinessProbe:
            httpGet:
              path: /readyz
              port: health
          resources:
            requests:
              cpu: 200m
              memory: 256Mi
            limits:
              cpu: "1"
              memory: 1Gi
```

Apply the manifest with `kubectl apply -f launcher.yaml`. The pod starts, registers with the API, and appears in **Settings > Launchers**. Confirm its pool and **Online** status before routing work. `/healthz` answers while the process is up, and `/readyz` answers once the launcher is registered, its heartbeat is fresh and its driver can place jobs.

> [!TIP]
> Use `RUNNER_NAME` with `fieldRef: metadata.name` so each pod gets a distinct registration name. A Deployment replacement changes the pod name and can leave an old offline row. For stable fleet identities, use a deployment model with stable names and verify registrations after replacement.

### Run every job in a pod of its own

The Kubernetes driver gives every job a fresh pod. The launcher then needs a ServiceAccount and a Role in the job namespace. Save the following as `launcher-rbac.yaml` and replace `<runner-namespace>`:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: stackweaver-launcher
  namespace: <runner-namespace>
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: stackweaver-launcher
  namespace: <runner-namespace>
rules:
  - apiGroups: [""]
    resources: ["pods", "secrets", "serviceaccounts"]
    verbs: ["get", "list", "create", "patch", "delete"]
  - apiGroups: [""]
    resources: ["pods/log", "configmaps"]
    verbs: ["get"]
  # Only while the launcher manages the job NetworkPolicy (RUNNER_MANAGE_NETWORK_POLICY unset).
  - apiGroups: ["networking.k8s.io"]
    resources: ["networkpolicies"]
    verbs: ["get", "create", "patch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: stackweaver-launcher
  namespace: <runner-namespace>
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: stackweaver-launcher
subjects:
  - kind: ServiceAccount
    name: stackweaver-launcher
    namespace: <runner-namespace>
```

The Role grants no `exec` and nothing cluster-scoped. If you manage the job namespace's NetworkPolicy yourself, set `RUNNER_MANAGE_NETWORK_POLICY=false` and remove the `networkpolicies` rule; the Helm chart does this for its own launchers.

Then change `launcher.yaml`:

1. Add `serviceAccountName: stackweaver-launcher` to the pod `spec`.
2. Change the container's `image` to `ghcr.io/vhco-pro/stackweaver-launcher:latest`, which serves both engines and places each job in its engine's job image.
3. Add these entries to the container's `env`, with your cluster's pod and service ranges:

   ```yaml
   - name: RUNNER_DRIVER
     value: kubernetes
   - name: RUNNER_TOFU_IMAGE
     value: ghcr.io/vhco-pro/stackweaver-opentofu-runner:latest
   - name: RUNNER_ANSIBLE_IMAGE
     value: ghcr.io/vhco-pro/stackweaver-ansible-runner:latest
   - name: RUNNER_CLUSTER_CIDRS
     value: "10.244.0.0/16,10.96.0.0/12"
   ```

4. Check that `STACKWEAVER_SERVER` resolves from a job pod. Job pods reach the API at the same address as the launcher.

Job pods pull their job image every time (`imagePullPolicy: Always`, from `RUNNER_JOB_IMAGE_PULL`). For a private job image, mount a dockerconfigjson Secret into the launcher pod and name the file in `RUNNER_DOCKER_CONFIG`: the launcher copies the matching registry's credential into a pull Secret of each job's own, keyed by the job image's repository, so no run image receives it. Use `auth`, or `username` and `password`, entries; an `identitytoken` entry cannot reach a job pod. A job pod whose main container or an init container reports `ErrImagePull` or `ImagePullBackOff` fails once it is older than `RUNNER_PLACEMENT_TIMEOUT` (5 minutes by default, counted from the pod's creation); a pod still waiting for its image without either error is not affected.

Apply both files with `kubectl apply -f launcher-rbac.yaml -f launcher.yaml`.

Jobs run in the launcher's namespace, or in the one `RUNNER_JOB_NAMESPACE` names. For a separate job namespace, create the Role and RoleBinding there, keep the RoleBinding's subject in the launcher's namespace, and use a namespace-qualified API address such as `http://stackweaver-api.stackweaver.svc:8022`. Each job pod satisfies the restricted Pod Security Standard, runs under `RUNNER_JOB_UID` when its image's user is not numeric, and carries no ServiceAccount token unless its identity needs one. `RUNNER_RUNTIME_CLASS` runs job pods under a sandboxed runtime such as gVisor or Kata. At start the launcher applies a NetworkPolicy to the job namespace that blocks the cluster ranges in `RUNNER_CLUSTER_CIDRS` and the cloud metadata ranges.

## Linux host, in-process driver

On a Linux host or VM without Docker, the launcher binary runs each job as a child process on the host's own OpenTofu, Ansible or both. Each launcher release attaches static binaries for amd64 and arm64, a `SHA256SUMS` file and a build provenance attestation to its [GitHub release](https://github.com/vhco-pro/stackweaver-launcher/releases).

1. Install OpenTofu, Ansible or both, so that `tofu version` and `ansible --version` answer for the user the launcher runs as. The launcher serves the engines whose toolchain answers. A run that needs exactly the version your host's `tofu` reports uses it as is; a run that needs another version downloads that version once into `~/.tofu-versions`. Installing the installation default (normally the version the published job image bakes) avoids the download for workspaces that set no version.
2. Download the binary for your architecture and `SHA256SUMS` from the release, check them, and verify the attestation with the GitHub CLI:

   ```bash
   sha256sum --check --ignore-missing SHA256SUMS
   gh attestation verify stackweaver-launcher_<version>_linux_amd64 --repo vhco-pro/stackweaver-launcher
   sudo install -m 0755 stackweaver-launcher_<version>_linux_amd64 /usr/local/bin/stackweaver-launcher
   ```

   The attestation is what proves the binary's origin; `SHA256SUMS` only guards the download.
3. Create a user for the launcher and a file it alone can read, `/etc/stackweaver/launcher.env`, with the required values:

   ```bash
   STACKWEAVER_SERVER=https://your-stackweaver.example.com
   STACKWEAVER_TOKEN=<your-token>
   RUNNER_AGENT_POOL_ID=<pool-uuid>
   RUNNER_NAME=my-vm-launcher
   ```

4. Run it under systemd with `/etc/systemd/system/stackweaver-launcher.service`, then `sudo systemctl enable --now stackweaver-launcher`:

   ```ini
   [Unit]
   Description=Stackweaver launcher
   After=network-online.target
   Wants=network-online.target

   [Service]
   User=stackweaver
   EnvironmentFile=/etc/stackweaver/launcher.env
   ExecStart=/usr/local/bin/stackweaver-launcher
   Restart=on-failure
   TimeoutStopSec=390

   [Install]
   WantedBy=multi-user.target
   ```

   `TimeoutStopSec=390` lets a stopping launcher finish its jobs, as `--stop-timeout 390` does for Docker. Jobs share the launcher user's filesystem and network.

## Use your own job image

A job image of your own replaces a published job image for every job of that engine that selects no run image. Most changes do not need one:

- For extra Galaxy collections and roles, commit a `requirements.yml` to the project; see [Galaxy collections](../../features/ansible/galaxy-collections.md).
- For Python packages, system packages or your own CA certificates, select an image of your own per template, inventory source, project or organization; see [Run images and execution environments](./run-images-and-execution-environments.md).

Replace the job image only when every job of an engine on a launcher needs the change. Build it `FROM` the published job image of the same release, so that it keeps what the launcher relies on:

| Requirement | Why |
|-------------|-----|
| The launcher binary at `/usr/local/bin/stackweaver-launcher`, as an executable file rather than a link. | The container and Kubernetes drivers start every job as `/usr/local/bin/stackweaver-launcher executor`, and copy that file into a job's run image as its `stackweaver-executor` program. |
| A link to it at the engine's earlier path: `/usr/local/bin/ansible-runner` for Ansible, `/usr/local/bin/runner` for OpenTofu. | A launcher of an earlier release starts the job through that path. |
| `ansible-playbook` and `ansible-galaxy` on the path for Ansible, `tofu` for OpenTofu. | The job runs the engine from the image. |
| `/bin/sh`, `cp` and `chmod`. | The container driver copies the `stackweaver-executor` program into a run image with `/bin/sh -c` running `cp` and `chmod`; the Kubernetes driver runs `cp` directly. |
| A non-root user. | A container-driver launcher refuses a root image unless it was started with `RUNNER_ALLOW_ROOT=true`, as for [run images](./run-images-and-execution-environments.md#how-a-run-image-runs). |

An image built from an Ansible job image of a release before launchers has no `/usr/local/bin/stackweaver-launcher`, so every job placed in it fails to start. Rebuild it from the current job image. Check an image before you configure it:

```bash
docker run --rm --entrypoint sh registry.example.com/acme/ansible-job:1.0 -c '
  test -x /usr/local/bin/stackweaver-launcher && test ! -L /usr/local/bin/stackweaver-launcher &&
  readlink -f /usr/local/bin/ansible-runner && command -v ansible-playbook && command -v ansible-galaxy'
```

The command prints `/usr/local/bin/stackweaver-launcher` and the two Ansible paths. For an OpenTofu image, check `/usr/local/bin/runner` and `tofu` instead.

Configure the image with `RUNNER_ANSIBLE_IMAGE` or `RUNNER_TOFU_IMAGE` on a container or Kubernetes launcher, or with `launcher.jobImages.ansible` and `launcher.jobImages.opentofu` (`repository` and `tag`) in the Helm chart. On the in-process driver the job image is the launcher's own image: run it with its default command.

## Launcher environment variables

These variables work with Docker, Podman and Kubernetes. The [environment variables reference](../../get-started/self-hosting/environment-variables.md#launchers) lists every launcher variable.

| Variable | Description | Default |
|----------|-------------|---------|
| `STACKWEAVER_SERVER` | Base URL of the Stackweaver API. Job containers and pods use the same address, so it must resolve where they run: with `RUNNER_JOB_NAMESPACE` set, use a namespace-qualified Service name such as `http://stackweaver-api.stackweaver.svc:8022`. | (required) |
| `STACKWEAVER_TOKEN` | Agent token or API key the launcher registers with. | (required) |
| `RUNNER_AGENT_POOL_ID` | ID of the agent pool the launcher joins. | (required) |
| `RUNNER_NAME` | Name shown in the UI; it must be unique per launcher. | Hostname |
| `RUNNER_LABELS` | Comma-separated labels reported with the launcher (e.g. `production,gpu`). | (none) |
| `RUNNER_MAX_CONCURRENT_JOBS` | Jobs the launcher runs at once. | `1` |
| `RUNNER_DRIVER` | `inprocess`, `container` or `kubernetes`. | `inprocess` |
| `RUNNER_ENGINES` | The engines the launcher serves: `tofu`, `ansible` or `tofu,ansible`. | In-process: the toolchains on the host. Container and Kubernetes: both |
| `RUNNER_TOFU_IMAGE`, `RUNNER_ANSIBLE_IMAGE` | Job image of each engine, which jobs without a run image run in and custom run images get the `stackweaver-executor` program from. | The published OpenTofu and Ansible images, `latest` |
| `RUNNER_JOB_IMAGE_PULL` | When job images are pulled: `always`, `missing` or `never`. | `always`; with only `RUNNER_IMAGE` set, no policy: pulled when missing on the container driver, the cluster's default on Kubernetes |
| `RUNNER_DOCKER_CONFIG` | Docker config files, comma separated, or a directory of them, holding the launcher's credential for private job images. | (none) |
| `RUNNER_FIREWALL_IMAGE` | Image the container driver writes the jobs network's firewall rules from; pulled only when missing. | The OpenTofu job image |
| `RUNNER_PLACEMENT_TIMEOUT` | How old a Kubernetes job pod may be, counted from its creation, before an `ErrImagePull` or `ImagePullBackOff` in its main container or an init container fails its job. Every launcher reads it at start; only the Kubernetes driver uses it. | `5m` |
| `RUNNER_IMAGE` | Deprecated: the one image of every job, used when neither job image is set. Set the job images instead. | (none) |
| `RUNNER_NETWORK` | Jobs network of the container driver. | (none) |
| `RUNNER_NETWORK_MODE` | `platform` or `host-identity` (see [Network modes](./drivers-and-network-modes.md#network-modes)). | `platform` |
| `RUNNER_DRAIN_GRACE` | How long a stopping launcher waits for its jobs to finish. | `5m` |
| `STACKWEAVER_RUN_ENV_PASSTHROUGH` | Comma-separated names of further launcher variables handed to the jobs of an in-process launcher. | (none) |

The jobs a launcher places do not inherit its environment, which holds its registration and launcher tokens. They receive their own variables from Stackweaver plus a fixed allowlist of the launcher's, listed in [Launcher variables that reach runs](../../get-started/self-hosting/environment-variables.md#launcher-variables-that-reach-runs). On an in-process launcher, name any further variable your jobs rely on in `STACKWEAVER_RUN_ENV_PASSTHROUGH`; on the container and Kubernetes drivers, give a job its settings through workspace or variable-set variables, or its job template's extra variables.

After the launcher starts, it registers with the API and appears under **Settings > Launchers** with status **Online** once its heartbeat is answered. You can open it from the list to see details, labels, and recent jobs.

> [!NOTE]
> The **Add a launcher** dialog in **Settings > Launchers** picks the agent pool and recommends that pool's agent token, with a link to the pool's **Agent tokens** section; an organization key with the **Launcher registration** scope is the alternative. It then shows Docker commands with the pool ID and the API's address filled in: a container driver command that runs the launcher image and serves both engines, and an in-process command for each engine that runs that engine's job image. Use the copy button there as a starting point, then replace `<registration-token>` with your agent token or organization key. For Kubernetes, use the Docker commands as a reference for the environment variables to include in your manifest.
