---
title: "Constructed inventories"
nav_order: 3
description: "Combine existing inventories and derive groups, variables and a host subset for a job."
covers:
  - "core/services/ansible/**"
  - "backend/internal/executor/syncexec/**"
  - "backend/internal/api/v2/handlers/runner_agent_work_items.go"
  - "backend/internal/api/v2/handlers/ansible/**"
  - "frontend/src/pages/Ansible/**"
  - "frontend/src/components/ansible/**"
  - "backend/cmd/launcher/**"
  - "backend/internal/api/v2/handlers/runner_agent.go"
capabilities: [
  {
    "id": "constructed-inventories",
    "name": "Constructed inventories",
    "summary": "Combine existing inventories and derive groups, variables and a host subset for a job.",
    "area": "ansible",
    "availability": "available",
    "limitations": "Hosts and groups are derived from input inventories, not edited directly.",
    "evidence": [
      "backend/internal/executor/syncexec/run.go",
      "backend/internal/executor/syncexec/constructed_integration_test.go"
    ]
  }
]
---

<a id="constructed-inventories" style="scroll-margin-top: 7rem"></a>

# Build a constructed inventory

Choose **Constructed** when creating an inventory to derive hosts from other inventories
instead of querying a cloud. Select ordered inputs, optional `compose`, `groups` and
`keyed_groups` rules, and a host limit. Use **Rebuild** and inspect **Syncs** to verify it.
It also rebuilds before job launches, subject to its cache timeout.

## Define constructed rules

Save as `constructed-rules.yml` and paste its contents into **Constructed rules (YAML)**
when creating or editing the constructed inventory. Select the AWS inventory as an input.
These rules use the `ec2_tags` and `ec2_region` variables produced by an AWS cloud source.

```yaml
compose:
  deployment_region: ec2_region | default('unknown')
groups:
  production: (ec2_tags | default({})).get('Environment', '') == 'production'
keyed_groups:
  - key: ec2_region | default('unknown')
    prefix: region
```

The build adds a `production` group for tagged hosts, a `region_...` group per region and
a `deployment_region` host variable. Set **Limit** to `production` if only those hosts
should remain in the result. Leave it empty to keep all input hosts.

With the Terraform definition above, add this resource to `main.tf` and keep
`constructed-rules.yml` beside it:

```hcl
resource "stackweaver_ansible_inventory" "production_hosts" {
  organization        = "my-org"
  name                = "production-hosts"
  type                = "constructed"
  input_inventory_ids = [stackweaver_ansible_inventory.production.id]
  source_vars         = file("${path.module}/constructed-rules.yml")
  constructed_limit   = "production"
}
```

Creation queues a build; wait for a successful result before using its hosts. It derives
hosts from the stored input, so sync the AWS source first if that input has no hosts yet.

Through the API, create an inventory with `inventory-type: "constructed"`, the rules as
the `source-vars` YAML string, and an ordered `input-inventory-ids` array. Terraform exposes
the same settings as `type = "constructed"`, the `source_vars` file content and
`input_inventory_ids`. Neither path takes a cloud source on the constructed inventory.


Inputs must be in the same organization and cannot themselves be constructed inventories.
The result is derived: edit input data or rules to change it. Manual host/group creation
and source additions are blocked. Successful rebuilds replace the derived host set; failed
builds retain the last successful result. A disabled/deleted derived host or deleted group
can reappear on rebuild. Move any manually maintained entries to an input inventory before
rebuilding if you need to preserve them.
