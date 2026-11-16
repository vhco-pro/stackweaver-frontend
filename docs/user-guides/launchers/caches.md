---
title: "Caches"
nav_order: 8
description: "The organization's verified cache of OpenTofu releases, providers, Galaxy content and git sources, and the node-local copy a launcher keeps."
covers:
  - "backend/internal/launcher/**"
  - "core/runnerdriver/**"
---

# Caches

## The organization's cache

Every organization has a verified cache of the OpenTofu releases, provider packages, Galaxy collections and roles, and git sources its jobs install, so a job does not download the same artifact again. A job only reads the cache. When a job installs something the cache did not supply, it reports it, and the launcher that ran it fetches the artifact again from its source and verifies it before adding it: an OpenTofu release against its signed `SHA256SUMS`, a provider against the registry's signed checksums and the configuration's lock file, a Galaxy collection against the checksum the Galaxy server publishes, and a role or git source by its commit. An artifact that does not match what the job reported is dropped. The run log says what the cache supplied, for example "From the organization's cache: OpenTofu 1.10.6, provider registry.opentofu.org/hashicorp/null 3.2.4".

The cache lives in the installation's object storage, under a prefix of its own for each organization, and no organization reads another's entries. The oldest entries are removed first once it reaches the organization's cache size limit, set under **Run Defaults** in **Settings > Organization**, or the deployment's `CACHE_SIZE_LIMIT` (50 GiB by default).

OpenTofu releases are verified with `cosign`, which consults the Sigstore transparency log; the OpenTofu job image includes `cosign`. A launcher that cannot reach the log, on an air-gapped network, can be started with `CACHE_VERIFY_TRANSPARENCY_LOG=false`; it then verifies the release's GPG signature against OpenTofu's release key, which the launcher carries, and records the entry as verified offline. A launcher under Strict hosted isolation (`STACKWEAVER_HOSTED_STRICT`) refuses that setting.

## The node-local cache

A launcher keeps a copy of the cache entries its jobs used, so repeated jobs on the same host fetch nothing twice. Only the launcher writes the copy: it fetches each entry under its launcher token, checks its digest, and mounts the job's organization's part of it read-only into the job. The job still checks the digest of every entry it reads and fetches anything missing through the API. A run log line that ends in "(node-local copy)" says every entry came from it.

| Driver | Where the copy lives |
|--------|----------------------|
| `inprocess` | `RUNNER_CACHE_DIR`, by default under the launcher user's cache directory |
| `container` | The named volume `RUNNER_CACHE_VOLUME`, mounted into the launcher at `RUNNER_CACHE_DIR`. A launcher that runs in a container needs both, or jobs read every entry through the API. |
| `kubernetes` | None. A job pod under the restricted profile cannot mount a node directory, so it reads its entries through the API. |

`RUNNER_CACHE_LOCAL_SIZE_LIMIT` bounds the copy (20Gi by default), and the least recently used entries are removed first. `RUNNER_CACHE_DIR=off` turns the copy off for a launcher, and the pool setting **Keep a node-local copy of the organization's cache** turns it off for a pool.
