terraform {
  required_providers {
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 3.10"
    }
  }
}

provider "azuread" {}

data "azuread_client_config" "current" {}

data "azuread_service_principal" "graph" {
  client_id = "00000003-0000-0000-c000-000000000000"
}

resource "azuread_application" "stackweaver" {
  display_name            = "Stackweaver SSO"
  sign_in_audience        = "AzureADMyOrg"
  owners                  = [data.azuread_client_config.current.object_id]
  group_membership_claims = ["SecurityGroup"]

  web {
    redirect_uris = [var.zitadel_callback_url]
  }

  required_resource_access {
    resource_app_id = data.azuread_service_principal.graph.client_id
    dynamic "resource_access" {
      for_each = toset(["openid", "profile", "email", "User.Read"])
      content {
        id   = data.azuread_service_principal.graph.oauth2_permission_scope_ids[resource_access.value]
        type = "Scope"
      }
    }
  }
}

resource "azuread_service_principal" "stackweaver" {
  client_id = azuread_application.stackweaver.client_id
  owners    = [data.azuread_client_config.current.object_id]
}

resource "azuread_application_password" "stackweaver" {
  application_id = azuread_application.stackweaver.id
  display_name   = "Stackweaver SSO"
  end_date       = var.secret_expiry
}
