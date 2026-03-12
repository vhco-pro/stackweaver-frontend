# VCS Integration

Connect a version control system so StackWeaver can trigger Terraform runs from code pushes and pull requests.

## Providers

- **[GitHub App](./github-app.md)** — Create and configure a GitHub App to enable self-service VCS connections for GitHub repositories.
- **[Azure DevOps](./azure-devops.md)** — Connect Azure DevOps repositories using Microsoft Entra ID OAuth2.

## Terraform Helpers

- **[Entra ID Setup Module](./entra-setup/)** — A Terraform module that provisions the Microsoft Entra ID App Registration needed for the Azure DevOps VCS connection.
