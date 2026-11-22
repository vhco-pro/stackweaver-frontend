---
title: "Caches"
nav_order: 8
description: "The organization's verified cache of OpenTofu releases, providers, Galaxy content and git sources, and the node-local copy a launcher keeps."
covers:
  - "backend/internal/launcher/readbody/**"
  - "backend/internal/api/middleware/runner_read_response.go"
  - "backend/internal/launcher/**"
  - "core/runnerdriver/**"
  - "backend/internal/executor/cache.go"
  - "backend/internal/executor/client.go"
  - "backend/internal/api/v2/handlers/runner_agent_cache.go"
---

# Caches

## The organization's cache

Every organization has a verified cache of the OpenTofu releases, provider packages, Galaxy collections and roles, and git sources its jobs install, so a job does not download the same artifact again. A job only reads the cache. When a job installs something the cache did not supply, it reports it, and the launcher that ran it fetches the artifact again from its source and verifies it before adding it: an OpenTofu release against its signed `SHA256SUMS`, a provider against the registry's signed checksums and the configuration's lock file, a Galaxy collection against the checksum the Galaxy server publishes, and a role or git source by its commit. An artifact that does not match what the job reported is dropped. The run log says what the cache supplied, for example "From the organization's cache: OpenTofu 1.10.6, provider registry.opentofu.org/hashicorp/null 3.2.4".

The cache lives in the installation's object storage, under a prefix of its own for each organization, and no organization reads another's entries. The oldest entries are removed first once it reaches the organization's cache size limit, set under **Run Defaults** in **Settings > Organization**, or the deployment's `CACHE_SIZE_LIMIT` (50 GiB by default).

OpenTofu releases are verified with `cosign`, which consults the Sigstore transparency log; the OpenTofu job image includes `cosign`. A launcher that cannot reach the log, on an air-gapped network, can be started with `CACHE_VERIFY_TRANSPARENCY_LOG=false`; it then verifies the release's GPG signature against OpenTofu's release key, which the launcher carries, and records the entry as verified offline. A launcher under Strict hosted isolation (`STACKWEAVER_HOSTED_STRICT`) refuses that setting.

A job allows up to two minutes to acquire an optional remote cache entry. After a read exhausts
that allowance, later remote entries use their original sources for the rest of that job.
Verified node-local copies remain available. Each new job starts with a fresh remote-read allowance.

Once a cache response starts, a progressing transfer can finish after the acquisition allowance,
within the job timeout and size limit. A transfer with no body progress for 30 seconds is closed.
Its partial data is discarded, and retries use only the original acquisition allowance.

## The node-local cache

A launcher keeps local copies of cache entries so later jobs can reuse verified entries. Only the launcher writes the copy: it fetches each entry under its launcher token, checks its digest, and mounts the job's organization's part of it read-only into the job. The job checks the digest of every entry it reads and tries missing entries through the API while its remote-read allowance remains available. A run log line that ends in "(node-local copy)" says every entry came from it.

If another job is warming the local copy, a new job proceeds without waiting for that warm-up. The new job may fetch an entry that the other job is still acquiring.

| Driver | Where the copy lives |
|--------|----------------------|
| `inprocess` | `RUNNER_CACHE_DIR`, by default under the launcher user's cache directory |
| `container` | The named volume `RUNNER_CACHE_VOLUME`, mounted into the launcher at `RUNNER_CACHE_DIR`. A launcher that runs in a container needs both, or jobs read every entry through the API. |
| `kubernetes` | None. A job pod under the restricted profile cannot mount a node directory, so it reads its entries through the API. |

`RUNNER_CACHE_LOCAL_SIZE_LIMIT` bounds the copy (20Gi by default), and the least recently used entries are removed first. `RUNNER_CACHE_DIR=off` turns the copy off for a launcher, and the pool setting **Keep a node-local copy of the organization's cache** turns it off for a pool.
