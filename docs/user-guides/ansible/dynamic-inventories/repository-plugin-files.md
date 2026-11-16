---
title: "Repository plugin files"
nav_order: 1
description: "Keep an Ansible inventory plugin file in your repository and let Stackweaver refresh hosts from it, with examples for each cloud."
covers:
  - "core/services/ansible/**"
  - "backend/internal/executor/syncexec/**"
  - "backend/internal/api/v2/handlers/runner_agent_work_items.go"
  - "backend/internal/api/v2/handlers/ansible/**"
  - "frontend/src/pages/Ansible/**"
  - "frontend/src/components/ansible/**"
  - "backend/cmd/launcher/**"
  - "backend/internal/api/v2/handlers/runner_agent.go"
---

<a id="vcs-backed-recommended-for-teams" style="scroll-margin-top: 7rem"></a>
<a id="creating-a-vcs-backed-dynamic-inventory" style="scroll-margin-top: 7rem"></a>

# Use a repository plugin file

1. Commit an inventory plugin file to a repository connected to your organization.
   Use the filename suffix required by the plugin.
2. Open **Inventories > New Inventory**. Enter a name, choose **VCS**, then select the
   connection, repository, branch and **Inventory Path**.
   The connection selector offers GitHub and Azure DevOps connections. Register repository
   access as a [VCS connection](../../vcs/README.md), rather than as an Ansible credential.
3. Select **Create Inventory**, open it, and select **Sync from VCS**.
4. Check the completed sync and discovered hosts before selecting the inventory in a
   [job template](../../../get-started/your-first-ansible-job.md).

Repository-backed discovery always syncs on the hosted capacity, in the platform Ansible
image and with the platform identity, because the sync holds the repository's clone
credential. It uses your file and that environment for cloud authentication. Attaching a cloud credential to a separate dynamic source does
not authenticate a VCS inventory. For Azure, this path does not mint Stackweaver OIDC
inventory tokens; arrange runtime identity or plugin authentication with your operator.
A runtime identity from a cloud metadata service (Azure managed identity, Google
Application Default Credentials from the metadata server, an AWS instance profile) reaches
the sync only when your operator runs the hosted capacity's launchers in the
`host-identity` network mode; in the default `platform` mode the sync cannot reach the
metadata service, and a strict hosted deployment refuses `host-identity`.
Keep secrets out of the repository.

<a id="step-1-prepare-the-inventory-plugin-file" style="scroll-margin-top: 7rem"></a>
<a id="cloud-provider-detection" style="scroll-margin-top: 7rem"></a>

## Plugin YAML examples

| Provider | Plugin | Required filename ending |
|---|---|---|
| AWS | `amazon.aws.aws_ec2` | `aws_ec2.yml` or `aws_ec2.yaml` |
| Azure | `azure.azcollection.azure_rm` | `azure_rm.yml` or `azure_rm.yaml` |
| GCP | `google.cloud.gcp_compute` | `gcp_compute.yml`, `gcp_compute.yaml`, `gcp.yml` or `gcp.yaml` |

A provider icon is a UI hint, not proof that Ansible accepts the filename. These filename
requirements come from the [AWS](https://docs.ansible.com/projects/ansible/latest/collections/amazon/aws/aws_ec2_inventory.html),
[Azure](https://docs.ansible.com/projects/ansible/latest/collections/azure/azcollection/azure_rm_inventory.html)
and [GCP](https://docs.ansible.com/projects/ansible/latest/collections/google/cloud/gcp_compute_inventory.html)
plugin references; use those references for additional options and dependencies.

Save one of these files in your repository, replacing the example region, resource group
or project with your own scope. The AWS example selects running production instances;
Azure lists VMs in `rg-production`; GCP lists instances in the named project and zone.
Authentication must already be available to a sync on the hosted capacity, as described above.

::: code-group
```yaml [AWS: inventory/production.aws_ec2.yml]
plugin: amazon.aws.aws_ec2
regions:
  - eu-west-1
filters:
  instance-state-name: running
  tag:Environment: production
keyed_groups:
  - key: placement.region
    prefix: region
```
```yaml [Azure: inventory/production.azure_rm.yml]
plugin: azure.azcollection.azure_rm
auth_source: auto
include_vm_resource_groups:
  - rg-production
hostnames:
  - name
keyed_groups:
  - key: location
    prefix: region
```
```yaml [GCP: inventory/production.gcp_compute.yml]
plugin: google.cloud.gcp_compute
auth_kind: application
projects:
  - my-project-id
zones:
  - us-central1-a
keyed_groups:
  - key: labels.env
    prefix: env
```
:::

For Azure managed identity, use `auth_source: msi` instead of `auto`. Give that identity
read access to the target subscription/resource groups. For GCP, `application` uses
Application Default Credentials from the sync's environment; it does not attach a
Stackweaver credential to a VCS inventory. Both need the metadata service, which the sync
reaches only in the `host-identity` network mode described above. After syncing, check **Hosts** and **Groups**
for the intended scope before using it in a job.


The file picker hides playbooks, roles, variables, tests, hidden directories and tooling
files. If no candidates are found, it offers a typed path. If other candidates appear
but yours is missing, check the repository and branch, then use the inventory registration
operation in the [API explorer](/docs/api-reference/explorer). Not every picker accepts
an arbitrary path.
