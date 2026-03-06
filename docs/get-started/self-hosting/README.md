<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Self-Hosting StackWeaver

Choose your deployment method:

- **[Docker Compose](./docker-compose/)** — Deploy on a single machine. Quickest way to get started for development, evaluation, or small-scale production.
  - [Cloudflare Tunnel](./docker-compose/cloud-flare-tunnel.md) — Expose your Docker Compose stack publicly with a static hostname

- **[Kubernetes](./kubernetes/)** — Deploy on Kubernetes using the official Helm chart. Recommended for production.
  - [Kubernetes Pull Secret for GHCR](./kubernetes/kubernetes-pull-secret-ghcr.md) — Pull StackWeaver images in a private cluster

- **[Environment Variables Reference](./environment-variables.md)** — All environment variables for every service, regardless of deployment method
