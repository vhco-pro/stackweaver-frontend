---
description: "Self-hosting index linking to Docker Compose, Kubernetes, and environment variable docs"
covers: []
---

# Self-Hosting StackWeaver

Choose your deployment method:

- **[Docker Compose](./docker-compose/)**: deploy on a single machine. Quickest way to get started for development, evaluation, or small-scale production.
  - [Cloudflare Tunnel](./docker-compose/cloud-flare-tunnel.md): expose your Docker Compose stack publicly with a static hostname

- **[Kubernetes](./kubernetes/)**: deploy on Kubernetes using the official Helm chart. Recommended for production.
  - [Kubernetes Pull Secret for GHCR](./kubernetes/kubernetes-pull-secret-ghcr.md): pull StackWeaver images in a private cluster

- **[Email (SMTP) and sign-up](./email.md)**: configure email for sign-up verification, password reset and email login codes, and choose who may create an account

- **[Environment Variables Reference](./environment-variables.md)**: all environment variables for every service, regardless of deployment method
