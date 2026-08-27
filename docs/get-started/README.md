---
description: "Top-level getting started guide with deployment options and setup steps"
covers: []
---

# Get Started with StackWeaver

Welcome to **StackWeaver**, the open-source DevOps platform for orchestrating infrastructure and configuration at scale. Whether you run it yourself or let us handle it, you'll be up and running in minutes.

## Choose your deployment

Getting started with Stackweaver is easy, just choose between these 2 options:

### Self-Hosted
> [!IMPORTANT] 
> deploy on your own infrastructure with Docker Compose or Kubernetes. Your data never leaves your environment. See the [Self-Hosting Setup](#self-hosting-setup) section below to get started.

### StackWeaver Cloud
> [!TIP] 
> our managed SaaS offering, no infrastructure to maintain. [Sign up](https://cloud.stackweaver.co) (coming soon) or reach out at `support@stackweaver.co` for early access.

Common sense should dictate your decision, we offer a small comparison below;

#### Comparison

| | Self-Hosted | StackWeaver Cloud |
|---|---|---|
| **Cost** | Free | Coming soon |
| **Setup** | ~15 minutes (Docker or Helm) | Sign up and go |
| **Data control** | Fully yours | Managed by us |
| **Updates** | Self-managed | Automatic |
| **Support** | Community + optional paid | Dedicated |
| **Best for** | Full control, air-gapped, compliance | Fastest path to production |



## Self-Hosting Setup

If you're self-hosting StackWeaver, follow these steps in order:

1. **Deploy StackWeaver**
   - **Kubernetes**: Follow the [Kubernetes Deployment Guide](self-hosting/kubernetes/), a single `helm install` generates all secrets, initialises Zitadel, and starts all services automatically.
   - **Docker Compose**: Follow the [Docker Compose Deployment Guide](self-hosting/docker-compose/), run `docker compose up -d` to start all services.
2. **Configure authentication** See the [Zitadel Setup Guide](../user-guides/authentication/zitadel-setup.md) for both deployment paths. For custom domains see [Custom Domain](../user-guides/authentication/zitadel-custom-domain.md).
3. **Connect a VCS provider** [GitHub App](../user-guides/vcs/github-app.md) or [Azure DevOps](../user-guides/vcs/azure-devops.md).
4. **Create your first OpenTofu workspace** Follow [Your First OpenTofu Workspace](./your-first-opentofu-workspace.md).
5. **Create your first Ansible job** Follow [Running Your First Ansible Job](./your-first-ansible-job.md).

## Next Steps

Once you have StackWeaver set up (either self-hosted or via StackWeaver Cloud), you can:

- Explore the [Architecture documentation](../architecture/README.md) to understand how StackWeaver works
- Review the [API Reference](../internal/api-reference/backend-api-reference.md) for integrating with StackWeaver programmatically
- Check out the [OpenTofu documentation](../features/opentofu/workspace-editing.md) or [Ansible documentation](../features/ansible/README.md) for tool-specific guides

## Need Help?

- **Self-Hosting Issues**: Check the troubleshooting sections in each setup guide
- **Documentation**: Browse the full [documentation index](../README.md)
- **Community**: Join our community discussions (links coming soon)
