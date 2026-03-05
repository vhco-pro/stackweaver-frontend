<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Get Started with StackWeaver

Welcome to StackWeaver! This guide will help you get started with the platform.  
StackWeaver can be used in two main ways: as a self-hosted solution on your own infrastructure, or through StackWeaver Cloud, our managed SaaS offering.

## Self-Hosted

> [!IMPORTANT]
> Self hosted is **free for companies > 20 employees**. Any additional support or extras are on a paid basis; contact us at `support@stackweaver.co` for any inquiries.

Self-hosting StackWeaver gives you complete control over your infrastructure and data. You deploy and manage the platform on your own infrastructure using Docker or Kubernetes. This option is ideal for:

- Organizations with strict data residency requirements
- Teams that need full control over the deployment and configuration
- Users who want to avoid vendor lock-in
- Environments with existing infrastructure investments

**Getting Started**: See the [Self-Hosting Setup](#self-hosting-setup) section below for detailed setup guides.

## StackWeaver Cloud (SaaS)

StackWeaver Cloud is our fully managed SaaS offering that eliminates the need for infrastructure management. With StackWeaver Cloud, you can:

- Start using StackWeaver immediately without any setup
- Focus on your infrastructure workflows instead of platform maintenance
- Benefit from automatic updates and scaling
- Get dedicated support and monitoring

**Getting Started**: Sign up at [StackWeaver Cloud](https://cloud.stackweaver.co) (coming soon) or contact our sales team for enterprise deployments.

## Self-Hosting Setup

If you're self-hosting StackWeaver, follow these guides to set up your instance:

### Table of Contents

#### Authentication Setup

- **[Zitadel Setup Guide](self-hosting/ZITADEL_SETUP.md)**: Complete guide to setting up Zitadel for authentication and identity management in your StackWeaver instance. Covers automated bootstrap, manual configuration, OIDC app setup, and integration with the StackWeaver platform.

#### VCS Integration

- **[GitHub App Setup Guide](self-hosting/GITHUB_APP_SETUP.md)**: Step-by-step instructions for configuring GitHub App integration for self-service VCS connections. Includes creating the GitHub App, configuring webhooks, setting environment variables, and testing the integration.

### Quick Start Checklist

For a quick deployment, follow these steps in order:

1. **Deploy StackWeaver**
   - **Kubernetes**: Follow the [Kubernetes Deployment Guide](self-hosting/kubernetes.md) — a single `helm install` generates all secrets, initializes Zitadel, and starts all services automatically.
   - **Docker Compose**: Run `docker compose up -d --build` then `docker compose run --rm zitadel-init`. See the [Zitadel Setup Guide](self-hosting/ZITADEL_SETUP.md#docker-compose-deployment) for details.
2. **Configure GitHub App** - Enable VCS integration ([GitHub App Setup Guide](self-hosting/GITHUB_APP_SETUP.md))
3. **Create your first organization** - Set up your workspace and start managing infrastructure

## Next Steps

Once you have StackWeaver set up (either self-hosted or via StackWeaver Cloud), you can:

- Explore the [Architecture documentation](../architecture/README.md) to understand how StackWeaver works
- Review the [API Reference](../internal/api-reference/backend-api-reference.md) for integrating with StackWeaver programmatically
- Check out the [Terraform documentation](../features/terraform/workspace-editing.md) or [Ansible documentation](../features/ansible/README.md) for tool-specific guides

## Need Help?

- **Self-Hosting Issues**: Check the troubleshooting sections in each setup guide
- **Documentation**: Browse the full [documentation index](../README.md)
- **Community**: Join our community discussions (links coming soon)
