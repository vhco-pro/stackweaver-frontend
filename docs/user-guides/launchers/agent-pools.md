---
title: "Agent pools and registration"
nav_order: 1
description: "Create an agent pool, hand launchers a registration credential, rotate it, and manage pools as code or through the API."
covers:
  - "backend/internal/api/v2/handlers/agent*"
  - "backend/internal/api/v2/handlers/runner_agent_authz.go"
  - "frontend/src/pages/Settings/AgentPools.tsx"
---

# Agent pools and registration

## Create an agent pool

Agent pools are managed per organization under **Settings > Agent Pools**.

1. In your organization, go to **Settings** (from the sidebar or org menu).
2. Open **Agent Pools**.
3. Choose **New Agent Pool**.
4. Give the pool a name (e.g. `production-runners` or `ansible-pool`).
5. Choose **Organization-scoped** or **Restricted**:
   - **Organization-scoped**: The pool is available to all workspaces in the organization unless you exclude specific workspaces.
   - **Restricted**: The pool is available only to workspaces or projects you explicitly allow.
6. If restricted, add the allowed workspaces or projects.
7. Save the pool.

You can later edit the pool to change allowed or excluded workspaces and projects, and its job placement settings (see [Pool settings](./hosted-capacity-and-pool-settings.md#pool-settings)). Expanding a pool on the page lists its launchers with the driver, network mode and node cache each one reported when it registered.

> [!TIP]
> Create separate pools for different environments (e.g. `dev-pool` and `prod-pool`) so you can assign workspaces to the right launchers.

## Create a registration credential

A launcher registers with a registration credential and then switches to a launcher token the API issues to it, which it uses for every heartbeat and claim afterwards. That means you can safely revoke the registration credential once your launchers are up; they keep working until they next restart and need to register again.

The safest registration credential is a **pool-scoped agent token**. Expand the pool on the **Settings > Agent Pools** page and use its **Agent tokens** section: create a token with a description, copy the value once, and revoke it when you are done. A launcher presenting an agent token can only join that pool, so it is the safest way to hand out registration access per environment. This is the Terraform-compatible `tfe_agent_token` resource, so you can also manage these tokens with the `hashicorp/tfe` provider.

You can also use an organization API key that may register launchers. Creating one needs the same permission as creating an agent token: owner of the organization, or a team with permission to manage agent pools.

1. Go to **Settings > API Keys**.
2. Create a new API key and choose the **Launcher registration** scope.
3. For the organization, select the same organization that owns the agent pool.
4. Save the key and **copy the token** (e.g. `tfe-xxx...`). You will not see it again.

The registration key must explicitly carry `org:<organization-id>:runner:register`.
A general-purpose key with no scopes or wildcard scopes cannot register a launcher. Pool-bound
keys must match that pool; an unreadable binding is an error, not unrestricted access. Such a key registers launchers into any pool of that organization, so prefer an agent token when a launcher should only ever join one pool.

Protect the registration credential and supply it only to the launcher. Revoking it does not stop already-registered launchers, because they use their own launcher tokens; a restart needs a valid registration credential again. Everything below works the same whichever kind of registration credential you use.

### Rotating an agent token

1. Expand the pool's **Agent tokens** section and choose **Rotate** on the token row.
2. Choose the grace period: 24 hours by default, up to 7 days, or immediate retirement. Copy the new token when shown; its value is displayed once.
3. Within the grace period, update each launcher's `STACKWEAVER_TOKEN` and restart it. Keep its intended `RUNNER_NAME` and pool. Replace launchers individually and keep enough remaining capacity for work during each restart.
4. Confirm each launcher is Online in the intended pool and verify a test workload before retiring the old credential across the fleet.

The old registration token works until its grace period ends; its row shows the expiry. A launcher that registers again under the same `RUNNER_NAME` in the same organization keeps its identity, labels and pool. Rotating an already-retiring token never extends its expiry. Choose immediate retirement only when you are ready for restarts to require the new credential.

Rotation is also available through this API action, with an optional `grace-period-hours` attribute (0 to 168):

```text
POST /api/v2/authentication-tokens/:id/actions/rotate
```

Replace `:id` with the agent token ID. The response carries the new token and, in its `meta`, the id and expiry of the token it replaced. This action is a Stackweaver extension: the TFE agent token API has no rotate operation, so the `hashicorp/tfe` provider cannot drive it, and a token managed by that provider is rotated by replacing the resource instead.

## Configure pools and routing as code

Configure [the Stackweaver provider](../terraform-provider.md) and save `runner-pool.tf`. Use an authorized organization credential for management; keep the resulting registration token private:

```hcl
resource "stackweaver_agent_pool" "production" {
  organization        = "your-org"
  name                = "production-runners"
  organization_scoped = true
}

resource "stackweaver_agent_token" "production" {
  agent_pool_id = stackweaver_agent_pool.production.id
  description   = "Production runner registration"
}

resource "stackweaver_organization_default_settings" "execution" {
  organization           = "your-org"
  default_execution_mode = "agent"
  default_agent_pool_id  = stackweaver_agent_pool.production.id
}
```

This makes the pool eligible organization-wide and sets the OpenTofu organization default; review that scope before apply. Use allowed/excluded workspace and project resources for narrower eligibility. Workspace/project overrides still take precedence. Provider state contains the token, even though the attribute is sensitive. Obtain the token through your protected deployment workflow rather than a public output.

For a specific workspace, set `execution_mode = "agent"` and `agent_pool_id` on its provider resource. An Ansible template's `agent_pool_id` is a separate setting; see [playbook management](../ansible/managing-ansible-playbooks.md) for source selection and the provider reference for the complete template schema. The compatible TFE pool, token and organization-default resource families can also manage the corresponding OpenTofu settings.

## Create a pool through the API

Set `STACKWEAVER_URL` to the origin without a trailing slash, `STACKWEAVER_TOKEN` to an organization credential authorized to manage pools, and `ORG` to its name. Save `agent-pool.json`:

```json
{
  "data": {
    "type": "agent-pools",
    "attributes": {
      "name": "production-runners",
      "organization-scoped": true
    }
  }
}
```

```bash
curl --fail-with-body --silent --show-error \
  --header "Authorization: Bearer $STACKWEAVER_TOKEN" \
  --header 'Content-Type: application/vnd.api+json' \
  --data @agent-pool.json \
  "$STACKWEAVER_URL/api/v2/organizations/$ORG/agent-pools"
```

Record the returned pool ID and verify its access scope. List pools before retrying an uncertain create. Create a pool token in the UI or provider path above; [the API explorer](/docs/api-reference/explorer) documents token creation, rotation and routing schemas. Launcher deployment itself uses the Docker environment or Kubernetes YAML shown above, not a Stackweaver management-YAML resource.
