---
description: "Run OpenTofu runs and Ansible jobs in images of your own: run images and registry credentials, the registry allowlist, Ansible execution environments, and how a run image, identity binding and run timeout are inherited from the project, the organization and the platform"
covers:
  - "frontend/src/pages/Settings/RunImages.tsx"
  - "frontend/src/components/settings/RunPlacementFields.tsx"
  - "frontend/src/components/settings/OrgRunDefaults.tsx"
  - "frontend/src/components/project/EditProjectDialog.tsx"
  - "frontend/src/pages/Ansible/Credentials.tsx"
  - "backend/internal/api/v2/handlers/run_images.go"
  - "backend/internal/api/v2/handlers/effective_settings.go"
  - "backend/internal/api/v2/handlers/runner_agent_images.go"
  - "core/settings/**"
  - "core/models/run_image*"
  - "backend/internal/executor/ansibleexec/**"
  - "backend/internal/launcher/driver/**"
  - "runner-images/**"
---

# Run images and execution environments

Every OpenTofu run and Ansible job runs in an image. Unless you choose otherwise it is its engine's job image: `stackweaver-opentofu-runner` for OpenTofu runs and `stackweaver-ansible-runner` for Ansible jobs, or the images the launcher's `RUNNER_TOFU_IMAGE` and `RUNNER_ANSIBLE_IMAGE` name. A **run image** is an image of your own that a workspace, job template, inventory source, project or organization selects instead: an image with cloud CLIs or provisioning tools, a toolchain pinned for compliance, or an Ansible execution environment you already use with AWX.

## How a run image runs

Stackweaver needs nothing of its own inside your image. When a job resolves a run image, the launcher's driver copies Stackweaver's job program (`stackweaver-executor`) into the job's container or pod from that engine's job image and starts it as the entrypoint, so the image's own `ENTRYPOINT` and `CMD` are not used. That program then fetches the job from the API, runs `tofu` or `ansible-playbook` from your image, and reports the result.

What an image needs depends on the engine.

| Engine | What the image needs |
|--------|----------------------|
| OpenTofu | A Linux image with CA certificates and the tools your configurations call (for example `git` for git module sources, or a cloud CLI for a `local-exec` provisioner). It does not need OpenTofu: the job installs the version the workspace asks for from the organization's cache or the release mirror. |
| Ansible | A Linux image with `ansible-playbook` and `ansible-galaxy` on its path, and `sshpass` if jobs log in to hosts with an SSH password. Stackweaver writes its own event callback into every job, so an execution environment without the `ansible.posix` collection reports the same live events as the Ansible job image. |

The image must run as a non-root user. A container-driver launcher refuses an image whose user is root unless it was started with `RUNNER_ALLOW_ROOT=true`. On the Kubernetes driver, a job pod runs as the image's user when it is numeric and as the launcher's `RUNNER_JOB_UID` otherwise.

Run images need a launcher that places jobs in containers or pods. A launcher with the in-process driver runs every job in its own image, so a job that resolves any other image fails on that pool with an event that says so. The hosted capacity of a Docker Compose installation uses the container driver, and a Helm installation uses the Kubernetes driver unless `launcher.driver` is `inprocess`, so their jobs can use run images.

## Add a run image

Run images belong to an organization and are managed under **Settings > Run Images**.

1. Go to **Settings > Run Images** and click **Add run image**.
2. Give the image a **Name**, for example `tofu-aws-tools`.
3. Choose the **Engine**: **OpenTofu** for runs of workspaces, or **Ansible** for jobs and syncs, which makes it an execution environment. The engine cannot be changed later.
4. Enter the **Image** reference with an optional tag, for example `ghcr.io/acme/tofu-aws:1.9`.
5. Optionally enter a **Digest** (`sha256:...`) to run exactly that image, whatever the tag points at later.
6. Choose a **Registry credential** for a private registry, or **None** for a public image.
7. Add a **Description** and save.

The same resource is available over the API at `GET` and `POST /api/v2/organizations/:name/run-images` and at `GET`, `PATCH` and `DELETE /api/v2/run-images/:id`, with the attributes `name`, `kind` (`tofu` or `ansible`), `image`, `digest`, `registry-credential-id` and `description`. Deleting a run image clears it from every workspace, template, inventory source, project and organization that selected it, and they then inherit their image as described under [Where a setting comes from](#where-a-setting-comes-from).

### Registry credentials

A run image from a private registry names a **Container registry** credential. Create one under **Settings > Credentials** with the registry's username and a password or token. It works with any registry that accepts a username and password or token, including GitHub Container Registry, Docker Hub, Harbor, Azure Container Registry and other OCI registries.

Only the launcher that places the job uses the credential. A container-driver launcher fetches it from the API with its launcher token, pulls the image with it, and never passes it into the job container. A Kubernetes-driver launcher creates a pull Secret for the one job pod, owned by that pod and deleted with it, which the pod references as its image pull secret without mounting it. The job itself never receives the credential.

### The registry allowlist

The installation can restrict where run images come from with `IMAGES_ALLOWED_REGISTRIES` on the API, a comma-separated list of registries or registry paths such as `ghcr.io/acme,registry.example.com`. When the list is set, saving a run image from a registry outside it is refused, and a job whose resolved image is outside it fails before it starts. An image without a registry host counts as `docker.io`. When the list is empty, which is the default, any registry is allowed. The allowlist is shown read-only on the Agent Pools page under **Deployment settings**.

## Ansible execution environments

The default Ansible path is the platform Ansible image plus the project's `requirements.yml`, installed from the organization's verified cache before every job (see [Galaxy collections](../features/ansible/galaxy-collections.md)). That covers collections and roles, which is what most execution environments are built for, and it needs no image of your own.

An execution environment built with `ansible-builder` for AWX is an optional compatibility path. It runs unchanged as a run image of the Ansible engine: Stackweaver injects its job program and event callback, so nothing needs to be rebuilt. What an execution environment adds beyond collections, such as a pinned `ansible-core`, Python packages or system packages, belongs in your own image: either your existing execution environment, or a small Dockerfile on top of the Ansible job image.

| What the AWX EE contains | Do this on Stackweaver |
|---|---|
| Only collections and roles (a `galaxy` section) | Drop the EE; commit the same list as `requirements.yml` in the project; the Ansible job image installs it from the verified cache |
| Python packages, system packages, or a pinned ansible-core | Keep it as a run image of the Ansible engine; Stackweaver's job program is injected, nothing is rebuilt |
| Anything above plus collections | Keep the image for the packages; collections may stay in the image or move to `requirements.yml`, both work |
| A need to pin ansible-core without any image at all | Not supported: a job runs the `ansible-core` its image ships, and a job template cannot choose an `ansible-core` version |

An execution environment applies to the jobs of the templates that select it and to the dynamic inventory source syncs that select it. Syncs that capture a snapshot from your VCS provider, rebuild a constructed inventory or read an inventory file from a repository always run in the Ansible job image, because they run no code from your repositories.

## Where a setting comes from

A run image, an identity binding and a run timeout can each be set at more than one level, and every one of them is resolved by the same rule: the most specific level that sets a value wins. The order is the launching object (the workspace for an OpenTofu run, the job template for an Ansible job, the inventory source for its dynamic syncs), then its project, then its organization, then the platform default. A level left empty defers to the next one.

| Setting | Launching object | Project | Organization | Platform default |
|---------|------------------|---------|--------------|------------------|
| Run image | Workspace, job template or inventory source | **Edit project** dialog, one per engine | **Run Defaults** in Settings > Organization, one per engine | The engine's job image |
| Identity binding | Workspace, job template or inventory source | **Edit project** dialog | **Run Defaults** | The platform identity |
| Run timeout | Workspace (`run-timeout` over the API), job template (**Timeout (seconds)**) or inventory source (**Sync timeout (seconds)**) | **Edit project** dialog | **Run Defaults** | `STACKWEAVER_RUN_TIMEOUT_DEFAULT` (two hours unless set); for an inventory source, `STACKWEAVER_SYNC_TIMEOUT` (one hour unless set) |
| Cache size limit | | | **Run Defaults** | `CACHE_SIZE_LIMIT` (50 GiB unless set) |

The controls sit where the rest of each object's settings are. The workspace create and edit dialogs have **Run image** and **Identity binding** beside the execution mode. The job template edit dialog has **Execution environment** and **Identity binding** beside the agent pool and the timeout. The inventory source edit dialog has a **Placement** section with **Execution environment** and **Identity binding**. The project page's **Edit project** dialog has the project's default execution mode and agent pool, its run timeout, its **OpenTofu run image**, its **Ansible execution environment** and its identity binding. The **Run Defaults** card in **Settings > Organization** has the organization's run timeout, its cache size limit, both run images and its identity binding.

When a control is left to inherit, a hint under it says where the value comes from and what it is, for example "Inherited from the project: tofu-aws-tools" or "Inherited from the platform default: 2h". A timeout of `0` at the launching level means inherit, like an empty selection.

A sync of the platform's own kind (a snapshot capture, a VCS inventory file sync or a constructed rebuild) has no launching object and is bounded by the installation's `STACKWEAVER_SYNC_TIMEOUT` (one hour unless set) instead.

### Read the effective settings

The resolved values, each with the level it came from, are available over the API at `GET /api/v2/workspaces/:id/effective-settings`, `GET /api/v2/ansible/job-templates/:id/effective-settings` and `GET /api/v2/ansible/inventory-sources/:id/effective-settings`. Each attribute of the `effective-settings` resource has a `value` and a `level` (`workspace`, `job-template`, `inventory-source`, `project`, `organization` or `deployment`). A workspace's settings include `execution-mode`, `agent-pool-id`, `tofu-version`, `run-timeout`, `run-image-id` and `identity-binding-id`. A `run-image-id` of `null` at the `deployment` level is the engine's job image, and an `identity-binding-id` of `null` is the platform identity.

The image a job actually ran in is recorded on the job. The **Placement** panel of a run or job page shows the image and its digest, the level it came from, the identity binding and the node.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| A job fails because of its image on an in-process pool. | The job resolved a run image, and the pool's launchers use the in-process driver, which runs only its own job image. | Run that pool's launchers with the container or Kubernetes driver, or clear the run image at the level that set it. The inherited hint shows which level that is. |
| A job fails because its image runs as root. | The image's user is root. | Set a non-root `USER` in the image. A launcher on the container driver accepts root images only when started with `RUNNER_ALLOW_ROOT=true`. |
| Saving a run image is refused with a message about `images.allowed_registries`. | The installation restricts run images to the registries the message lists. | Push the image to one of them, or ask your installation's administrator to add the registry to `IMAGES_ALLOWED_REGISTRIES`. |
| The image cannot be pulled. | The registry credential is missing or invalid, or the registry is unreachable. | Check that the run image names a Container registry credential with a valid password or token, and that the launcher host or cluster can reach the registry. |
