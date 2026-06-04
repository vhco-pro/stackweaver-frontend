---
description: "Ansible Galaxy collection support including pre-installed collections and auto-install from requirements.yml"
covers:
  - "backend/cmd/ansible-runner/**"
---

# Ansible Galaxy Collections

## Overview

Ansible Galaxy is the official hub for sharing Ansible content. StackWeaver's Ansible runner comes with essential collections pre-installed and **automatically installs additional collections** from `requirements.yml` in your playbook repository.

## Pre-Installed Collections

The ansible-runner container includes these essential collections:

| Collection | Purpose |
|------------|---------|
| `amazon.aws` | AWS EC2, S3, IAM, dynamic inventory |
| `azure.azcollection` | Azure resources, dynamic inventory |
| `google.cloud` | GCP compute, storage, dynamic inventory |
| `community.vmware` | VMware vSphere |
| `community.general` | 1000+ general-purpose modules |
| `ansible.posix` | POSIX operations, JSONL callback |
| `ansible.netcommon` | Network automation base |

**Code Reference**: `runner-images/ansible/Dockerfile`

To see all installed collections:
```bash
docker exec ansible-runner ansible-galaxy collection list
```

## Auto-Install from requirements.yml ✅

**NEW**: Collections are automatically installed from `requirements.yml` before playbook execution!

The runner checks these locations in order:
1. `requirements.yml` (repo root)
2. `collections/requirements.yml`
3. `roles/requirements.yml`

**Code Reference**: `backend/cmd/ansible-runner/main.go` - `installGalaxyRequirements()`

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

## Adding Collections to Runner Image

To permanently add collections, update the Dockerfile:

**File**: `runner-images/ansible/Dockerfile`

```dockerfile
# Install additional Ansible collections
RUN ansible-galaxy collection install \
    amazon.aws \
    azure.azcollection \
    google.cloud \
    community.vmware \
    community.general \
    ansible.posix \
    ansible.netcommon \
    # Add your collections here:
    cisco.ios \
    f5networks.f5_modules
```

Then rebuild:
```bash
cd stackweaver
docker compose build ansible-runner
docker compose up -d ansible-runner
```

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
- Per-project collection caching on the shared runner workspaces volume, reused across jobs to avoid re-downloading

### 🔄 Planned
- [ ] Show installed collections in UI
- [ ] Collection version pinning per playbook/template
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

If not installed, add to runner Dockerfile or `requirements.yml`.

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
