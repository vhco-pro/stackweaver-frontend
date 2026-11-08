---
nav_order: 40
description: "How Stackweaver's API, execution services and storage fit together, and what that means for operating a deployment."
covers:
  - "deploy/docker-compose.yml"
  - "deploy/helm/**"
  - "backend/cmd/api/**"
  - "backend/cmd/orchestrator/**"
  - "backend/cmd/launcher/**"
  - "backend/internal/launcher/**"
  - "backend/internal/executor/**"
  - "core/queue/**"
  - "core/storage/**"
  - "backend/internal/services/auth/**"
  - "backend/internal/api/middleware/**"
  - "scripts/zitadel-init/**"
---

# Architecture overview

Stackweaver coordinates OpenTofu runs and Ansible jobs through an API and separate execution
services. The API manages resources and access; launchers place each run or job in an
executor that runs the tools that change your infrastructure. You choose whether those
launchers operate alongside the platform or inside your own network.

<a id="system-architecture"></a>

## The system at a glance

```mermaid
flowchart TB
    Client["Browser"] -->|"HttpOnly session cookie + CSRF header"| API["Stackweaver API"]
    Automation["API clients"] -->|"tfe- API token"| API
    API -->|"Confidential sign-in client"| Identity["Zitadel"]
    API --> Database["PostgreSQL<br/>Resources and execution records"]
    API --> Redis["Redis<br/>Launcher wakeups and live logs"]
    API --> Storage["S3-compatible storage<br/>Configuration, state and artifacts"]
    Orchestrator["Orchestrator"] --> Database
    Orchestrator --> Redis
    Hosted["Hosted launchers<br/>(hosted capacity)"] -->|"Register, claim, job token, artifacts, output"| API
    Agent["Self-hosted launchers<br/>(agent pools)"] -->|"Register, claim, job token, artifacts, output"| API
    Hosted --> Executor["Executors<br/>One per job: in-process, container or pod"]
    Agent --> Executor
    Executor -->|"Job token"| API
    Executor --> Targets["Your infrastructure"]
```

<details>
<summary>Diagram legend: services and connections</summary>

- **Browser users** sign in through the API, which acts as a confidential Zitadel client. Later requests use the session cookie and CSRF header. **Automation clients** use API tokens.
- **API** checks access and manages resources. PostgreSQL holds records; object storage holds configuration, state and artifacts.
- **Orchestrator** routes each run to its pool, requests configuration snapshots for VCS-backed runs and releases stuck work.
- **Redis** carries the wakeups that tell a pool's launchers work is waiting, and buffers live output. Launchers and jobs never connect to it.
- **Launchers** register with the installation's hosted capacity or with an agent pool, keep one heartbeat open to the API and claim work. Their driver places an **executor** for each run, job or sync.
- **Executors** fetch that job's inputs from the API with a token valid for that job alone, run OpenTofu or Ansible against your infrastructure, and report output, state and results through the API.

The arrows show communication between services. They do not represent every request or a required network route for every execution mode.

</details>

The API handles authentication, permissions and resource operations. Launchers and their
executors run the infrastructure tools and report their results through the API, and they
hold no database, object storage or Redis credential. The browser reads status and output
through the API; it does not connect directly to the database or Redis.

For automation, use the [Terraform/OpenTofu provider](../user-guides/terraform-provider.md)
to maintain supported resources as configuration, or the [REST API](./using-the-api.md)
for integrations. Each interface supports a defined set of operations. Service configuration
belongs in the [self-hosting guides](../get-started/self-hosting/README.md).

<a id="component-overview"></a>

## What each service does

| Component | Responsibility | What matters when operating it |
|---|---|---|
| Frontend | Displays resources, run output and documentation. | Users need access to its URL and the API and sign-in endpoints. |
| API | Enforces access and manages organizations, projects, workspaces and jobs. | Automation clients and every launcher and executor connect here. |
| Zitadel | Handles user identity and issues sign-in tokens. | Issuer and callback URLs must match the deployment's public addresses. |
| Orchestrator | Routes runs to their pool, requests configuration snapshots and releases stuck work. | It uses the database and Redis; it runs no infrastructure tools. |
| Launchers and executors | Claim runs, jobs and syncs and run each one in an in-process, container or Kubernetes executor. | Executors need access to the API, providers, collections and target hosts their work uses. Configuration and playbook snapshots are captured on the hosted capacity, so its executors also need access to your VCS provider. |
| PostgreSQL | Stores resource metadata, permissions and execution records. | Include its data in your backup and recovery plan. |
| Redis | Carries launcher wakeups and buffers live output. | Keep it reachable by the API and the orchestrator. |
| S3-compatible storage | Holds configuration snapshots, state files and artifacts. | Preserve it alongside the database. Garage is the bundled option; an external compatible service can be used. |

<a id="data-flow"></a>

## From launch to result

```mermaid
flowchart TB
    Launch["Launch a run or job"] --> Checks["Check permissions and launch conditions"]
    Checks --> Pending["Route the work to its pool"]
    Pending --> Claim["A launcher of the pool claims it"]
    Claim --> Execute["An executor runs the selected configuration"]
    Execute --> Result["Record status, output and artifacts"]
    Result --> Inspect["Inspect the result in the UI or API"]
```

<details>
<summary>Diagram legend: launch and execution</summary>

1. You launch a run or job through the UI, an API client or an enabled trigger.
2. Stackweaver checks permissions and launch conditions before releasing work for execution, and stamps it with its pool: the agent pool its settings select, or the organization's hosted pool.
3. The pool's launchers are woken, and one claims the work atomically and receives a token valid for that run or job alone.
4. The launcher's driver places an executor, which fetches the inputs with that token and executes the selected configuration with that run or job's settings and credentials.
5. Status, output and artifacts are recorded so you can inspect the result through the UI or API.

Some launches wait for an inventory refresh, a configuration or playbook snapshot, approval or available execution capacity. The linked execution guides explain those paths and their failure behavior.

</details>

For OpenTofu, a workspace supplies configuration and variables. A run can plan, apply or
destroy infrastructure, subject to its settings and permissions. The configuration of a
VCS-backed workspace is captured by a snapshot sync on the hosted capacity. State versions
are stored in object storage, with their metadata in PostgreSQL. See [Understanding OpenTofu runs](../user-guides/understanding-opentofu-runs.md).

For Ansible, a job template supplies the playbook, inventory and execution settings. Launch
conditions can include inventory refreshes and concurrency limits. Workflows can add approval
steps. The executor runs the playbook from a snapshot of its repository, installs its
requirements from the organization's verified cache, and reports host and task results. See
[Ansible execution flows](../features/ansible/execution-flows.md) for the detailed paths,
including workflows and self-hosted runners.

## Choose where execution runs

The executor's network determines what a run or job can reach. Being able to open Stackweaver
in your browser does not mean an executor can reach a private target.

| Execution location | Use it when | Connections to plan for |
|---|---|---|
| Hosted capacity | The installation's execution environment can reach your targets and has the required tools. | The hosted launchers and their executors reach Stackweaver only through the API. Executors also need access to the dependencies and targets their work uses, and the snapshot syncs on the hosted capacity reach your VCS provider. |
| Agent pools (self-hosted) | Work must execute within another network or on hosts you control. | Launchers request work and report results through the API. Executors also need access to their dependencies and targets. They do not need access to the platform database, Redis or your VCS provider. |

Keep each launcher's credentials limited to the work it performs. The API coordinates
execution; it does not provide the executor's network access to target hosts. See
[Self-hosted runners](../user-guides/self-hosted-runners.md) to configure agent pools, start
launchers and choose how isolated their jobs are.

<a id="security-architecture"></a>

## Identity, access and data

The API completes sign-in with Zitadel as the confidential **Stackweaver BFF** client,
verifies and discards the tokens, and stores a browser session in PostgreSQL. The browser
receives an opaque `HttpOnly`, `Secure`, `SameSite=Strict` cookie; the SPA holds no OAuth token.
Cookie API requests carry `X-Stackweaver-CSRF: 1`, and writes also require a trusted origin.
Default session limits are one hour idle, twelve hours absolute and a five-minute Zitadel
liveness check. See [browser sessions](../user-guides/authentication/zitadel-setup.md#browser-sessions).

Stackweaver applies organization, project and resource permissions to requests; sign-in alone
does not grant access to every resource. [Platform administration](../user-guides/platform-administration.md)
controls install-wide operations without granting membership inside organizations.
Automation authenticates with `tfe-` API tokens, not Zitadel access tokens. See [Using the API](./using-the-api.md) for
integration guidance and the [API explorer](/docs/api-reference/explorer) for endpoint details.

Each executor fetches only its own job's inputs, with a token valid for that job alone that
is refused once the job has finished. On the container and Kubernetes drivers it runs in a
fresh, non-root container or pod that cannot reach the cloud metadata endpoints or Azure's
platform address `168.63.129.16`. The API
encrypts state, saved plans, configuration versions and playbook snapshots with AES-256-GCM
before they reach object storage, and the plan JSON of each run before it reaches the database;
the storage service may add its own encryption at rest.

Keep database and Redis access restricted to the services and administrators that need it.
Configure HTTPS at your deployment's public entry points.

### What to preserve for recovery

Database records and object-storage files serve different purposes. A recovery plan needs
both, along with the identity and configuration needed to use them:

- **PostgreSQL:** resource definitions, permissions and execution records.
- **Object storage:** configuration snapshots, state files and artifacts.
- **Zitadel data:** user identities and sign-in configuration.
- **Deployment configuration and encryption keys:** the settings and keys needed to restore
  service connectivity and access to stored credentials and encrypted objects.

The deployment guides describe storage setup. This overview is not a backup or restore
procedure.

<a id="deployment-architecture"></a>

## Deploy and configure

[Docker Compose](../get-started/self-hosting/docker-compose/README.md) runs the services on a
single host, and its launchers place every job in a container on a separate, firewalled jobs
network that reaches the API and cannot reach the data tier. [Kubernetes](../get-started/self-hosting/kubernetes/README.md)
provides the Helm deployment, whose launcher Deployments run each job in a pod of its own.
Follow the guide for your environment for ingress, storage and identity setup; public
addresses and ports depend on that configuration.

For a codebase-oriented view, see [Repository layout](./repositories.md). The
[environment variable reference](../get-started/self-hosting/environment-variables.md)
describes configuration settings for each service.
