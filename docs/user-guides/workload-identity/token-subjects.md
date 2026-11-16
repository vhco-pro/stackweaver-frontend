---
title: "Token subjects and claims"
nav_order: 5
description: "The subject every workload identity token carries for OpenTofu runs, inventory syncs and Ansible jobs, and the immutable ID claims to pin a trust to."
covers:
  - "core/services/oidc/**"
---

# Token subjects and claims

Stackweaver embeds a subject in every workload identity token; your cloud-side trust matches on it. The format depends on the resource type.

## OpenTofu workspace runs

Plan and apply:

```
organization:<org-name>:project:<project-name>:workspace:<workspace-name>:run_phase:<plan|apply>
```

For example, the `apply` phase of the `production` workspace in project `infra` under organization `main`:

```
organization:main:project:infra:workspace:production:run_phase:apply
```

`plan` and `apply` produce **different subjects**, so where the cloud matches an exact subject you need to allow both (or use a wildcard/attribute condition where supported).

## Ansible inventory sync

StackWeaver-native format, no `run_phase:`:

```
organization:<org-name>:project:<project-name>:inventory:<name>:sync
```

For a UI-configured dynamic source using Stackweaver federation, `<name>` is the **source name**. Native tokens can also represent an inventory, but a VCS inventory file does not automatically use that trust contract. Follow the [dynamic inventory guide](../ansible/dynamic-inventories/README.md) for VCS runtime identity and plugin configuration.

## Ansible job execution

StackWeaver-native format:

```
organization:<org-name>:project:<project-name>:job:<job-name>:run
```

`<job-name>` stays the same across launches, so a cloud trust can name it exactly:

| How the job was launched | `<job-name>` |
|---|---|
| From a job template, including a relaunch or a slice of it. | The template's name. |
| As an ad hoc command, including a relaunch of it. | `adhoc-<module>`, such as `adhoc-shell`. |
| Directly, or a relaunch of a direct launch. | The name you gave the job. |

`<project-name>` is the StackWeaver project the resource belongs to, or `default` for org-scoped resources without a project.

## Pinning to immutable identifiers

The subject uses organization, project and resource names. Renaming one can break an exact cloud trust match. A name containing a colon cannot be used in a token, because it would shift the subject's segments. A run or job whose configured identity cannot be read or minted fails before it starts, and its error names the reason; it never runs without that identity. To recover from a colon, rename the organization, project, workspace, template or job the error names, then update the cloud trust. Organization names remain reserved after deletion or rename; only the same organization can reuse its prior name.

Where the target supports custom-claim conditions, pin the immutable `stackweaver_organization_id` as well as `sub`. Tokens also carry `stackweaver_project_id` and, for Terraform runs, `stackweaver_workspace_id`. Get the organization ID from its API response. Ansible tokens carry organization/project IDs rather than a Terraform workspace ID.
