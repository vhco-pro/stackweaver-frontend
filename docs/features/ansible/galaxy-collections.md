---
description: "Ansible Galaxy collection support including pre-installed collections and auto-install from requirements.yml"
covers:
  - "backend/cmd/ansible-runner/**"
  - "runner-images/ansible/**"
---

# Ansible Galaxy Collections

## Overview

Ansible Galaxy is the official hub for sharing Ansible content. StackWeaver's Ansible runner comes with essential collections pre-installed. The runner also **automatically installs additional collections** from `requirements.yml` in your playbook repository, whether the job runs on the platform runner or on a self-hosted agent pool.

## Pre-Installed Collections

The runner image installs the `ansible` community package, and the collections that package bundles are the pre-installed set. The ones most playbooks reach for are listed below, and the package bundles many more.

| Collection | Purpose |
|------------|---------|
| `amazon.aws` | AWS EC2, S3, IAM, dynamic inventory |
| `azure.azcollection` | Azure resources, dynamic inventory |
| `google.cloud` | GCP compute, storage, dynamic inventory |
| `community.vmware` | VMware vSphere |
| `community.general` | 1000+ general-purpose modules |
| `ansible.posix` | POSIX operations, JSONL callback |
| `ansible.netcommon` | Network automation base |

The version of each collection is the one the installed `ansible` release ships. The image pins that release in `runner-images/ansible/pyproject.toml` and `runner-images/ansible/uv.lock`, so the `ansible` version is what decides the pre-installed set: a newer `ansible` release brings newer bundled collections with it.

To see every installed collection with its version:
```bash
docker exec ansible-runner ansible-galaxy collection list
```

## Auto-Install from requirements.yml ✅

Collections and roles are automatically installed from `requirements.yml` before playbook execution, on the platform runner and on self-hosted runners alike.

The runner checks these locations in order:
1. `requirements.yml` (repo root)
2. `collections/requirements.yml`
3. `roles/requirements.yml`

The job output shows the install as it happens. A `galaxy_install` entry announces the requirements file that was found, and a `galaxy_install_complete` entry carries the `ansible-galaxy` output once the install has finished. When the collection install fails, for example because a collection name cannot be resolved or the Galaxy server cannot be reached, a `galaxy_install_failed` entry carries the `ansible-galaxy` output and is marked as failed, and the play still runs. A play that needs the missing collection then fails at the first task that uses it, and a play that does not need it completes normally.

Each job installs into its own staging directory, seeded from a cache that the runner keeps per project, so a later job for the same project finds the collections already present and one project's collections are never served to another. When a job's staging directory was seeded from that cache, the job output carries a `galaxy_cache_seeded` entry ahead of `galaxy_install`, naming whether collections, roles or both were reused. A job that starts from an empty cache has no such entry.

**Code Reference**: `backend/cmd/ansible-runner/galaxy.go` - `installGalaxyRequirements()`

### Where a job looks for collections and roles

The platform runner and self-hosted runners resolve collections and roles by the same rule. When a job installed requirements, the runner places the job's installed collections and the playbook's own `collections/` directory in front of the collections path that is already in effect: the value of `ANSIBLE_COLLECTIONS_PATH` when it is set in the runner's environment, otherwise the `collections_path` from the `ansible.cfg` the job uses, otherwise Ansible's default of `~/.ansible/collections:/usr/share/ansible/collections`. Roles are resolved the same way through `ANSIBLE_ROLES_PATH` and `roles_path`. A job whose repository has no `requirements.yml` runs with both variables exactly as the runner's environment and `ansible.cfg` define them, so Ansible searches the playbook's own `collections/` and `roles/` directories and then the configured or default paths. In every case the collections bundled with the `ansible` package are searched last, which is why anything found earlier takes precedence over the bundled copy.

Installed requirements belong to the jobs of the repository that declares them. A job whose repository has no `requirements.yml`, and an ad hoc command, does not search the project's Galaxy cache, so content that only another repository of the project installs is not available to it: the play stops at the first task that needs it with `couldn't resolve module/action '<name>'`, or with `the role '<name>' was not found` for a role. A repository gets such content by declaring it in its own `requirements.yml`.

An ad hoc command has no repository to declare requirements in and takes its content from the search path in effect. That leaves three routes to a collection or role the `ansible` package does not bundle, on either runner. The first is an image built on top of the runner image that installs it into `/usr/share/ansible/collections`, as described under [Adding a Collection or a Newer Version](#adding-a-collection-or-a-newer-version). The second is a collections or roles search path in the `ansible.cfg` stored for the project or organization, which the runner writes into every job, ad hoc commands included. The third is the search path variable set on the runner container. On the platform runner the `ansible.cfg` route can name the project's own cache directory, `galaxy-cache/<project id>/collections` and `galaxy-cache/<project id>/roles` under `WORKSPACES_DIR`. That directory holds what the project's repositories last installed, and the runner removes it once no job has installed requirements for the project for `GALAXY_CACHE_TTL_DAYS` days, so prefer the image for content an ad hoc command must always find.

**Code Reference**: `backend/cmd/ansible-runner/ansible_cfg.go` - `withJobSearchPaths()`

### Self-hosted runners

A self-hosted runner installs requirements from inside your network, so the runner host needs a route to wherever the collections come from. That is `galaxy.ansible.com` for public collections, your Git host for entries of `type: git`, or a private Automation Hub or Galaxy server. To use a private server, add a `[galaxy]` section with a `server_list` to the `ansible.cfg` stored for the project or organization in Stackweaver: the runner writes that file into the job and `ansible-galaxy` reads it during the install. `ANSIBLE_GALAXY_SERVER_*` environment variables set on the runner reach `ansible-galaxy` only when you name each one in `STACKWEAVER_RUN_ENV_PASSTHROUGH`, because a runner hands its jobs only an allowlist of its own environment (see [Runner variables that reach runs](../../get-started/self-hosting/environment-variables.md#runner-variables-that-reach-runs)).

The per-project cache lives under the directory named by `GALAXY_CACHE_DIR`, which defaults to `galaxy-cache` under `WORKSPACES_DIR`. Without a volume the cache lasts as long as the runner container. Mount a volume at that path to keep it across restarts. Dedicate the directory to the runner and keep nothing else in it: the runner creates one subdirectory per project, named after the project's ID, and removes a project's subdirectory once it has not been used for `GALAXY_CACHE_TTL_DAYS` days (14 by default). Setting the value to `0` turns the cleanup off.

Collections you have installed on the runner host yourself stay available, because a job's installed requirements are placed in front of the search path already in effect rather than replacing it, as described under [Where a job looks for collections and roles](#where-a-job-looks-for-collections-and-roles).

## Using Collections in Playbooks

Collections are automatically available in playbooks. Use the Fully Qualified Collection Name (FQCN):

```yaml
---
- hosts: all
  tasks:
    - name: Install package using community.general
      community.general.pacman:
        name: nginx
        state: present

    - name: Create AWS EC2 instance
      amazon.aws.ec2_instance:
        name: "webserver"
        instance_type: t3.micro
        image_id: ami-12345678
```

## Custom Collections via requirements.yml

Create a `requirements.yml` in your playbook repository:

```yaml
# requirements.yml
collections:
  - name: cisco.ios
    version: ">=5.0.0"
  - name: f5networks.f5_modules
  - name: paloaltonetworks.panos
  - name: ansible.windows
    version: "2.0.0"

roles:
  - name: geerlingguy.docker
  - name: geerlingguy.nginx
```

An entry's `version` is how you pin a collection or a role. Job templates carry no collection list or version pin of their own: a job installs what its repository's `requirements.yml` declares, so pinning a version for a template means pinning it in the `requirements.yml` of the repository the template's playbook comes from.

**How It Works**:
1. When a job starts, the runner clones the playbook repository
2. Checks for `requirements.yml` in common locations
3. Runs `ansible-galaxy collection install -r requirements.yml`
4. Runs `ansible-galaxy role install -r requirements.yml`
5. Creates job events to track installation progress
6. Proceeds with playbook execution

**Events in UI**:
- "Installing Galaxy Requirements" - shown at job start
- "Galaxy Requirements Installed" - on success
- "Galaxy Installation Failed" - on error (job continues)

## Adding a Collection or a Newer Version

There are three ways to run a play against a collection the bundle lacks, or against a newer version of one it has. All three work the same on the platform runner and on self-hosted runners.

The first, and the right one for most projects, is a `requirements.yml` in the playbook repository, as described above. It is installed for each job and searched ahead of everything else, so it needs no image change and it can differ per repository.

The second is a newer `ansible` release in the image, for when you build the runner image from this repository yourself. Raise the `ansible` version in `runner-images/ansible/pyproject.toml`, refresh the lock file with `uv lock --upgrade-package ansible` in that directory, and rebuild the image. Every bundled collection moves to the version that release ships.

```bash
docker compose -f deploy/docker-compose.yml build ansible-runner
docker compose -f deploy/docker-compose.yml up -d ansible-runner
```

The third is an image of your own, built on top of the runner image, that installs the collections you want into `/usr/share/ansible/collections`. That directory is on Ansible's default collections path, the runner user can read it, and a collection found there takes precedence over the bundled copy. Install as `root` with the Galaxy client's `--collections-path /usr/share/ansible/collections` option, then switch back to the `stackweaver` user. A collection installed without that option lands in the home directory of the user who ran the install, and the runner user cannot read the home directory of `root`. A collections path you configure yourself replaces Ansible's default, so include `/usr/share/ansible/collections` in it if you set one.

## Collection Search

Browse available collections at [Galaxy Hub](https://galaxy.ansible.com/):
- Search by keyword, author, or category
- View documentation and examples
- Check compatibility with Ansible versions

## Private Collections

For private collections (internal Galaxy servers or Git repos):

```yaml
# requirements.yml
collections:
  - name: https://github.com/myorg/my-collection.git
    type: git
    version: main
  
  - name: my_namespace.my_collection
    source: https://galaxy.internal.company.com
```

**Note**: Private collections require VCS credentials to be configured.

## Platform Integration Status

### ✅ Completed
- Pre-installed essential collections in runner image
- Auto-detect `requirements.yml` from playbook repos
- Install collections before job execution
- Events logged for Galaxy installation
- Per-project collection caching on a dedicated cache volume (isolated from the terraform runner and from each job's scratch dir), reused across jobs to avoid re-downloading. Each project's cache is namespaced separately so collections are never shared across tenants, and a background janitor evicts caches left idle beyond a configurable TTL (`GALAXY_CACHE_TTL_DAYS`, default 14 days) so the volume cannot grow without bound.

### 🔄 Planned
- [ ] Show installed collections in UI
- [ ] Organization-level collection management

### 💡 Future
- [ ] Private Galaxy server support
- [ ] Collection usage analytics
- [ ] "Collection Store" UI for browsing available collections

## Troubleshooting

### Collection Not Found
```
ERROR! couldn't resolve module/action 'community.mysql.mysql_db'
```

**Solution**: Check if collection is installed:
```bash
docker exec ansible-runner ansible-galaxy collection list | grep mysql
```

If it is not installed, add it to a `requirements.yml` in the playbook repository, as described under [Custom Collections via requirements.yml](#custom-collections-via-requirementsyml).

### Version Conflicts
```
ERROR! Collection version 2.0.0 requires ansible-core >= 2.14
```

**Solution**: Check Ansible version compatibility:
```bash
docker exec ansible-runner ansible --version
```

### Collection Installation Errors
```
ERROR! Failed to download collection
```

**Possible causes**:
1. Network issues in container
2. Galaxy Hub rate limiting
3. Invalid collection name

**Debug**:
```bash
docker exec ansible-runner ansible-galaxy collection install -vvv collection.name
```
