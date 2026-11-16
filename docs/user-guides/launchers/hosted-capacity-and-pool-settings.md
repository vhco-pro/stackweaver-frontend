---
title: "Hosted capacity and pool settings"
nav_order: 6
description: "The installation's hosted capacity, its per-organization cap and placement groups, and the job placement settings of an agent pool."
covers:
  - "backend/internal/api/v2/handlers/hosted_capacity.go"
  - "backend/internal/api/v2/handlers/agent*"
  - "frontend/src/pages/Settings/AgentPools.tsx"
---

# Hosted capacity and pool settings

## Hosted capacity

Each organization has hosted capacity that runs everything in `remote` execution mode and every snapshot sync. On a self-hosted install its launchers are the `launcher` service of the Docker Compose bundle, or the launcher Deployment of the Helm chart. It is shown read-only as **Hosted capacity** at the top of **Settings > Agent Pools**, with the jobs in flight, the jobs queued, the hosted launchers online and the placement group it is served from. Its launchers belong to the installation, so they are counted rather than named. Hosted capacity cannot be renamed, deleted or selected as a workspace's agent pool, and it does not appear in the TFE agent pools API.

A platform administrator can cap how many jobs of one organization the hosted capacity runs at once, and choose which placement group serves it, through `max-concurrent-jobs` and `placement-group` on `PATCH /api/v2/agent-pools/:id`; the pool's ID is the `pool-id` of `GET /api/v2/organizations/:name/hosted-capacity`. An organization admin's request for those fields is refused. When hosted capacity sets no cap, the deployment's `STACKWEAVER_HOSTED_DEFAULT_MAX_CONCURRENT_JOBS` applies, and `0` means unlimited. A run or job waiting on the cap stays `pending`, and its timeline says "Waiting for hosted capacity" with the slots in use. A hosted launcher serves only the hosted capacity whose placement group equals its own `STACKWEAVER_HOSTED_GROUP` (`default` when unset), so a group can be dedicated capacity for one organization, a region, or a set of nodes with stricter controls. Work on hosted capacity whose group has no launcher online waits until one comes online.

## Pool settings

The pool's edit dialog on **Settings > Agent Pools** has a **Job placement** section, and the expanded pool row shows the same values read-only.

| Setting | Effect |
|---------|--------|
| **CPU limit** and **Memory limit** | Limits applied to each job container or pod, in Kubernetes quantities such as `1500m` and `2Gi`. |
| **Refuse a job whose limits the launcher cannot enforce** | A job is refused, rather than run without limits, on a launcher that cannot apply them (the in-process driver, or an engine without cgroup v2). |
| **Keep a failed job for (minutes)** | Leaves a failed job's container or pod in place this long for inspection. The job has already removed every credential it wrote. A canceled job is not a failure and is removed at once. When unset, the launcher's `RUNNER_KEEP_FAILED_FOR` applies. |
| **Keep a node-local copy of the organization's cache** | On by default. Turn it off to have every job read its cache entries through the API. |

The expanded row also has a read-only **Deployment settings** panel with the values the installer set for the whole installation: the allowed image registries, the default run timeout, the sync timeout, the job log cap, the cache size limit, the hosted default cap, the request limits of launchers and jobs, and the mirrors, proxy and extra CA certificates jobs use. The same values are the `deployment` attribute of `GET /api/v2/platform/settings`.
