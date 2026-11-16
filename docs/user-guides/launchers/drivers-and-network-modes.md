---
title: "Drivers and network modes"
nav_order: 4
description: "How each driver isolates a job, what happens when a launcher stops or disappears, and what jobs can reach in each network mode."
covers:
  - "core/runnerdriver/**"
  - "backend/internal/launcher/driver/**"
---

# Drivers and network modes

## Drivers and isolation

| Driver | Where a job runs | Isolation | Limits |
|--------|------------------|-----------|--------|
| `inprocess` | A child process of the launcher | The job sees an allowlisted environment and a fresh working directory, and cannot read the launcher's memory. It shares the launcher's user, filesystem and network. | Not applied; a pool that requires limits refuses the job. |
| `container` | A fresh container per job on the launcher's Docker or Podman engine | Own filesystem, non-root user, no capabilities, read-only root filesystem, the firewalled jobs network | Applied where the engine supports cgroup v2 |
| `kubernetes` | A fresh pod per job in the job namespace | Own filesystem, restricted Pod Security Standard, the job namespace's NetworkPolicy, optional sandboxed runtime class | Applied as pod resource limits |

On every driver the job's process writes the credentials it needs (inventory secrets, SSH keys, vault passwords, cloud token files, CLI configuration) with owner-only permissions into a directory that exists for that job, and removes it on every exit path before a failed container or pod is kept for inspection. A container or Kubernetes job image must run as a non-root user; a launcher on the container driver accepts a root image only with `RUNNER_ALLOW_ROOT=true`.

When a launcher stops (`SIGTERM`), it stops claiming, lets its jobs finish for up to `RUNNER_DRAIN_GRACE` (5 minutes), stops what is left with a 60-second grace and then deregisters. Whatever stops it must wait that long: the Compose files set `stop_grace_period: 6m30s` on every launcher service, the chart sets `terminationGracePeriodSeconds: 390` on the launcher pods (`launcher.terminationGracePeriodSeconds`), and a `docker run` launcher needs `--stop-timeout 390`. Raise these when you raise `RUNNER_DRAIN_GRACE`. A launcher killed before it drains leaves its jobs to the rule below. If a launcher disappears in the middle of a job, Stackweaver handles the job by what is safe to repeat: a plan or a sync is offered again as a new attempt, while an apply ends as failed with the message "launcher lost during apply" (its apply reported as errored to Terraform clients) and an Ansible job ends as errored with "launcher lost during job". Neither is retried on its own: **Re-queue apply** on the run page (or `POST /api/v2/runs/:id/actions/apply`) applies the run's saved plan as a new attempt, and is refused if the workspace state moved meanwhile; relaunch the job to run it again. Each attempt has its own job token, and the token of an earlier attempt is refused, so an orphaned job can neither finish nor upload state. A restarted launcher reattaches to the job containers or pods it still owns.

## Network modes

The installer sets a launcher's network mode with `RUNNER_NETWORK_MODE` (chart value `launcher.network`). The pool page shows it read-only for each launcher, and nothing in the API or the UI can widen it.

| Mode | What jobs can reach |
|------|---------------------|
| `platform` (default) | The API, DNS and the internet. Inbound traffic, the cloud metadata ranges (`169.254.0.0/16`, `fd00:ec2::/64`, `fd20:ce::/64`), the other networks on the engine and, on Kubernetes, the cluster ranges in `RUNNER_CLUSTER_CIDRS` are blocked. Jobs get cloud access from the platform identity or an identity binding, never from the node. |
| `host-identity` | The same, plus the cloud metadata endpoints, so jobs can use the node's or VM's own identity. It applies to the container and Kubernetes drivers; on the container driver the job skips its metadata check in this mode. A launcher under Strict hosted isolation (`STACKWEAVER_HOSTED_STRICT`) refuses this mode. |

On the container driver, the launcher creates the network `RUNNER_NETWORK` names and, on a rootful engine, programs the host firewall for it through a short-lived container from the firewall image (`RUNNER_FIREWALL_IMAGE`): a chain under Docker's `DOCKER-USER` on Docker, and an nftables table of its own on Podman and on Docker's nftables backend. Before it writes them, it removes any rules for the same subnet that another jobs network left behind, for example when a launcher stopped without removing its own. Rules you add yourself, such as a `DOCKER-USER` allowance for Podman's jobs network, stay. Jobs never reach `168.63.129.16`, Azure's platform address, in any network mode; they resolve names through the engine's resolver. Jobs on the network cannot reach each other, the engine's gateway or any port the host publishes, except the API, whether it listens on the host or runs in a container behind a port the host publishes. `RUNNER_DENY_CIDRS` adds ranges no job may reach, such as your database's subnet. `RUNNER_ALLOW_TCP` lists `host:port` endpoints, or `http` and `https` URLs, that jobs may reach even inside a denied range, which is how jobs on an air-gapped install reach mirrors on the same host or network; the launcher resolves each name when it starts. On the Kubernetes driver, `RUNNER_ALLOW_TCP` adds the same endpoints as allowed peers of the job NetworkPolicy the launcher manages. On rootful Podman it creates the network through Podman's own API, without Podman's isolation between networks, so a job reaches an allowed endpoint that a container on another Podman network publishes; the nftables table refuses everything else.

The in-process driver has no network isolation: its jobs reach whatever the launcher can reach, including the metadata endpoint of the host.
