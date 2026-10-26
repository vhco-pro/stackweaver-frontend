# Stackweaver Entra ID app registration for Azure DevOps integration
#
# Provisions everything required for Stackweaver to authenticate with Azure DevOps via OAuth2:
#   - Azure DevOps enterprise application (service principal) in the tenant
#   - App registration with vso.code, vso.code_status, and vso.project API permissions
#   - Client secret
#
# Prerequisites:
#   - Entra ID administrator permissions
#   - Azure CLI installed and authenticated: az login
#
# Usage:
#   terraform init
#   terraform apply -var='redirect_uris=["https://your-stackweaver-domain/vcs/azure-devops/callback"]'
#
# After apply, copy outputs into vcs.env and recreate api, orchestrator and ansible-runner.
# Variables and outputs are defined in their adjacent files.

terraform {
  required_providers {
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 3.0"
    }
  }
}

provider "azuread" {
  # Authenticates via Azure CLI (az login) or ARM_* environment variables.
}

data "azuread_client_config" "current" {}

# ---------------------------------------------------------------------------
# Azure DevOps service principal
#
# Provisions the Azure DevOps enterprise application into this tenant.
# Required if Azure DevOps has not previously been used in the tenant.
# Resolves: AADSTS650052 "organization lacks a service principal for Azure DevOps".
# ---------------------------------------------------------------------------

resource "azuread_service_principal" "azure_devops" {
  client_id    = "499b84ac-1321-427f-aa17-267ca6975798" # Azure DevOps (global Microsoft app)
  use_existing = true                                   # Use existing SP if already provisioned
}

# Resolve delegated permission scope GUIDs from the Azure DevOps service principal.
# Using a data source avoids hardcoding GUIDs that Microsoft could rotate.
data "azuread_service_principal" "azure_devops" {
  client_id  = "499b84ac-1321-427f-aa17-267ca6975798"
  depends_on = [azuread_service_principal.azure_devops]
}

locals {
  # vso.code - read source code, commits, branches; inherits vso.hooks_write (service hooks)
  vso_code_id = one([
    for s in data.azuread_service_principal.azure_devops.oauth2_permission_scopes :
    s.id if s.value == "vso.code"
  ])

  # vso.code_status - read and write commit/pull request status (PR status checks)
  vso_code_status_id = one([
    for s in data.azuread_service_principal.azure_devops.oauth2_permission_scopes :
    s.id if s.value == "vso.code_status"
  ])

  # vso.project - read projects and teams, required to list repositories across all projects
  vso_project_id = one([
    for s in data.azuread_service_principal.azure_devops.oauth2_permission_scopes :
    s.id if s.value == "vso.project"
  ])
}

# ---------------------------------------------------------------------------
# App registration
# ---------------------------------------------------------------------------

resource "azuread_application" "stackweaver" {
  display_name = var.display_name

  web {
    redirect_uris = var.redirect_uris
  }

  required_resource_access {
    resource_app_id = "499b84ac-1321-427f-aa17-267ca6975798" # Azure DevOps

    resource_access {
      id   = local.vso_code_id
      type = "Scope"
    }

    resource_access {
      id   = local.vso_code_status_id
      type = "Scope"
    }

    resource_access {
      id   = local.vso_project_id
      type = "Scope"
    }
  }
}

# ---------------------------------------------------------------------------
# Client secret
# ---------------------------------------------------------------------------

resource "azuread_application_password" "stackweaver" {
  application_id = azuread_application.stackweaver.id
  display_name   = "${var.display_name} client secret"
  end_date       = var.secret_end_date
}
