---
title: "Self-hosting"
layout: overview
description: "Choose Docker Compose or Kubernetes, then configure your installation."
covers: []
---

# Self-hosting

## Choose a deployment

**Docker Compose** runs the stack on one machine. **Kubernetes** uses the Helm chart. Each deployment guide covers its own prerequisites, identity setup and checks.

After deployment, configure [email and sign-up](./email.md) and use the [environment variables reference](./environment-variables.md) for service settings. For a public hostname over a tunnel, see [Cloudflare Tunnel](./docker-compose/cloud-flare-tunnel.md). For image-pull failures, see [Kubernetes pull secrets](./kubernetes/kubernetes-pull-secret-ghcr.md).

To set the address used by public pages and opt in to search indexing, see
[Public pages and search indexing](./public-site.md). Installations request exclusion from
search by default.
