<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Self-Hosted Runners

Learn how to run Terraform and Ansible workloads on your own infrastructure using StackWeaver self-hosted runners. By the end of this guide, you will know how to create agent pools, register runners, and route jobs to them.

## What Are Self-Hosted Runners?

StackWeaver can execute Terraform plans and applies and Ansible jobs in two ways:

| Execution type | Description |
|----------------|-------------|
| **Platform-hosted** | StackWeaver runs jobs in containers it manages. No infrastructure for you to operate. |
| **Self-hosted** | You run a runner container on your own servers or Kubernetes. Jobs are assigned to your runners via agent pools. |

Self-hosted runners use the **same runner images** as platform-hosted runs. The only difference is how the runner gets work: platform-hosted runners are started on demand by StackWeaver; self-hosted runners run continuously and poll for jobs. This is useful when you need workloads to run inside your network, on specific hardware, or under your own compliance and security controls.

## When to Use Self-Hosted Runners

Consider self-hosted runners when you:

- Need Terraform or Ansible to run inside your private network (e.g., to reach internal APIs or databases).
- Want to control where and how jobs run for compliance or security.
- Prefer to scale capacity yourself instead of using platform-hosted execution.
- Use the same patterns as Terraform Cloud / HCP Terraform agent pools and want compatibility with tools like the Terraform provider for TFE.

## What You'll Need

Before you start, make sure you have:

| Requirement | Description |
|-------------|-------------|
| **StackWeaver account** | Sign in to your organization. |
| **Organization admin or runner permissions** | You need permission to manage agent pools and API keys with runner scopes. |
| **Docker (or Kubernetes)** | A host where you can run the runner container. |
| **Outbound HTTPS access** | The runner must reach your StackWeaver API (e.g. `https://your-stackweaver.example.com`). |

## Overview: Agent Pools and Runners

**Agent pools** group runners and define which workspaces or projects can use them. You create a pool in Settings, then register runners into that pool. When you configure a workspace (or project) to use agent execution, you attach it to a pool; jobs for that workspace or project are then dispatched to runners in that pool.

**Runners** are the containers that poll for jobs and execute them. Each runner belongs to one agent pool and is registered using an API key with runner scopes. After registration, the runner appears in Settings > Runners and shows status (online, busy, offline), type (Terraform, Ansible, or combined), and last heartbeat.

The flow is:

1. Create an **agent pool** (and optionally restrict which workspaces or projects can use it).
2. Create an **API key** with runner scopes.
3. **Run the runner container** with that API key and the pool ID; the runner registers itself.
4. Configure **workspaces** (Terraform) or **projects** (Ansible) to use agent execution and the correct pool so jobs are routed to your runners.

---

## Step 1: Create an Agent Pool

Agent pools are managed per organization under **Settings > Agent Pools**.

1. In your organization, go to **Settings** (from the sidebar or org menu).
2. Open **Agent Pools**.
3. Click **New Agent Pool** (or the equivalent create action).
4. Give the pool a name (e.g. `production-runners` or `ansible-pool`).
5. Choose **Organization-scoped** or **Restricted**:
   - **Organization-scoped**: The pool is available to all workspaces in the organization unless you exclude specific workspaces.
   - **Restricted**: The pool is available only to workspaces or projects you explicitly allow.
6. If restricted, add the allowed workspaces or projects.
7. Save the pool.

You can later edit the pool to change allowed or excluded workspaces and projects. The list of runners in each pool is shown on the Agent Pools page.

> [!TIP]
> Create separate pools for different environments (e.g. `dev-pool` and `prod-pool`) so you can assign workspaces to the right runners.

---

## Step 2: Create an API Key with Runner Scopes

Runners authenticate using the same API key system as the rest of StackWeaver. You create a key with runner scopes and use it only when starting the runner (and optionally revoke it after runners are registered).

1. Go to **Settings > API Keys**.
2. Create a new API key.
3. For the organization, select the same organization that owns the agent pool.
4. Enable the **Runner** permissions your runners need:
   - **Runner: Register** – required so the runner can register with the API.
   - **Runner: Terraform** and/or **Runner: Ansible** (or **Runner: Combined** if one runner will do both).
5. Save the key and **copy the token** (e.g. `tfe-xxx...`). You will not see it again.

Use this token only when starting the runner container. Do not commit it to source control or share it broadly. You can revoke the key at any time in Settings > API Keys; existing registered runners will stop receiving new jobs until you register them again with a new key.

---

## Step 3: Run the Runner Container

You run the same Docker images StackWeaver uses for platform-hosted execution, but in **agent mode**. The container registers with the API, polls for jobs, and runs them locally.

### Required values

- **Agent pool ID**: The UUID of the pool you created (visible in the Agent Pools UI, e.g. when adding a runner or in the pool URL).
- **API key**: The token you created in Step 2 (e.g. `tfe-xxx...`).
- **StackWeaver server**: The base URL of your StackWeaver API (e.g. `https://app.stackweaver.io` or `https://your-stackweaver.example.com`).

Replace `<pool-uuid>`, `<your-api-key>`, and the server URL in the examples below with your actual values.

### Ansible runner

For Ansible jobs only:

```bash
docker run -d --restart unless-stopped \
  -e RUNNER_MODE=agent \
  -e RUNNER_AGENT_POOL_ID=<pool-uuid> \
  -e STACKWEAVER_TOKEN=<your-api-key> \
  -e STACKWEAVER_SERVER=https://your-stackweaver.example.com \
  -e RUNNER_NAME=my-ansible-runner \
  stackweaver/runner-ansible:latest
```

### Terraform runner

For Terraform runs only:

```bash
docker run -d --restart unless-stopped \
  -e RUNNER_MODE=agent \
  -e RUNNER_AGENT_POOL_ID=<pool-uuid> \
  -e STACKWEAVER_TOKEN=<your-api-key> \
  -e STACKWEAVER_SERVER=https://your-stackweaver.example.com \
  -e RUNNER_NAME=my-terraform-runner \
  stackweaver/runner-terraform:latest
```

### Optional environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RUNNER_NAME` | Name shown in the UI (e.g. hostname). | Hostname |
| `RUNNER_LABELS` | Comma-separated labels for targeting (e.g. `production,gpu`). | (none) |
| `MAX_CONCURRENT_JOBS` | How many jobs this runner can run at once. | 1 |

After the container starts, it registers with the API and appears under **Settings > Runners** with status **Online** once heartbeats are received. You can open a runner from the list to see details, labels, and recent jobs.

> [!NOTE]
> The **Add runner** dialog in Settings > Runners shows these same commands with your pool ID and server URL filled in. Use the copy button there to paste a ready-to-run command, then replace `<your-api-key>` with your actual token.

---

## Step 4: Route Work to Your Runners

### Terraform workspaces

For Terraform, runs are routed to a pool when the workspace uses **agent** execution mode and is associated with that pool.

1. Open the workspace you want to run on self-hosted runners.
2. Edit the workspace (e.g. **Settings** or **Edit** on the workspace).
3. Set **Execution mode** to **Agent**.
4. If your UI has an **Agent pool** (or similar) field, select the pool you created.
5. Save.

Subsequent plan and apply runs for that workspace will be assigned to runners in the selected pool instead of platform-hosted execution.

### Ansible jobs

For Ansible, job routing is typically controlled at the project or organization level via the agent pool configuration. Ensure the agent pool’s allowed workspaces or projects include the workspaces or projects where your Ansible jobs run. Jobs in those scopes will then be eligible to run on runners in that pool.

---

## Step 5: Optional – Ansible Configuration

If you use Ansible, you can customize `ansible.cfg` per organization, project, or workspace so that jobs run with your preferred settings (e.g. timeouts, SSH options, callback plugins).

1. Go to **Settings > Ansible Configuration**.
2. Choose the scope: **Organization**, or a **Project** (and optionally a workspace if supported).
3. Edit the configuration content. The UI often provides a default template; you can modify sections such as `[defaults]` and `[ssh_connection]`.
4. Save.

When a job runs (on a platform-hosted or self-hosted runner), StackWeaver injects the appropriate `ansible.cfg` into the job environment. More specific scope overrides less specific (e.g. workspace over project over organization).

---

## Managing and Monitoring Runners

### Settings > Runners

The **Runners** page lists all runners in the organization. For each runner you can see:

- **Status**: Online, Busy, Offline, or Error.
- **Type**: Terraform, Ansible, or Combined.
- **Agent pool**: Which pool the runner belongs to.
- **Hostname and IP**: Reported by the runner.
- **Last heartbeat**: How recently the runner checked in.
- **Current load**: e.g. number of jobs running vs. max concurrent.

Clicking a runner opens its detail page with system info, capabilities, labels, and recent job history.

### Runner status

Runners send heartbeats to the API on a regular interval. If heartbeats stop (e.g. container down or network issue), StackWeaver marks the runner **Offline** after a short period. No new jobs are assigned to offline runners. When the runner comes back and heartbeats again, it returns to **Online** and can receive jobs again.

### Editing and deleting

- **Edit**: From the runner list or detail page, use **Edit** to change the runner’s description and labels. Labels can be used for job targeting (e.g. route only to runners with a `gpu` label).
- **Delete**: Deleting a runner removes it from the UI. The container will no longer receive jobs. To use that host again, run the container again with the same or a new API key; it will register as a new runner.

---

## Security and Best Practices

1. **API keys**: Create API keys with the minimum scopes needed (e.g. only Runner: Register and Runner: Terraform for a Terraform-only runner). Rotate or revoke keys if they may have been exposed.
2. **Network**: Runners initiate all connections to StackWeaver (outbound only). You do not need to open inbound ports on the runner. Use TLS for the StackWeaver server URL.
3. **Pools**: Use separate pools for different trust or network boundaries (e.g. DMZ vs. internal), and restrict which workspaces or projects can use each pool.
4. **Resource limits**: Use Docker (or Kubernetes) resource limits so a single job cannot exhaust the host. Tune `MAX_CONCURRENT_JOBS` based on your host size.

---

## Common Questions

**Q: Can one runner run both Terraform and Ansible jobs?**  
A: Yes, if you use a **combined** runner image (when available) or register with scopes that allow both. Otherwise use separate Ansible and Terraform runner containers and put them in the same or different pools as needed.

**Q: What happens if all runners in a pool are offline?**  
A: New jobs that are assigned to that pool will wait until a runner in the pool is online. Ensure at least one runner in the pool is running for critical workloads, or use platform-hosted execution as a fallback by not using agent mode for that workspace.

**Q: How do I update the runner image?**  
A: Pull the new image, stop the old container, and start a new one with the same environment variables (same pool ID and a valid API key). The new container will register and appear as the same or a new runner depending on implementation; check the Runners UI after restart.

**Q: My runner stays Offline.**  
A: Check that the container is running, that `STACKWEAVER_SERVER` and `STACKWEAVER_TOKEN` are correct, and that the host can reach the StackWeaver API over HTTPS. Check container logs for registration or heartbeat errors.

---

## What's Next?

- Use [Managing Workspace Variables](./managing-workspace-variables.md) to configure variables for workspaces that run on your runners.
- Use [Understanding Terraform Runs](./understanding-terraform-runs.md) to interpret plan and apply output for runs executed on your runners.
- Use [Running Your First Ansible Job](./your-first-ansible-job.md) to run Ansible jobs that can be routed to your self-hosted Ansible runners.
