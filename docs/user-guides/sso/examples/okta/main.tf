terraform {
  required_providers {
    okta = {
      source  = "okta/okta"
      version = "~> 7.0"
    }
  }
}

provider "okta" {}

resource "okta_app_oauth" "stackweaver" {
  label                      = "Stackweaver"
  type                       = "web"
  grant_types                = ["authorization_code"]
  response_types             = ["code"]
  redirect_uris              = [var.zitadel_callback_url]
  token_endpoint_auth_method = "client_secret_post"
}

resource "okta_app_group_assignment" "stackweaver" {
  app_id   = okta_app_oauth.stackweaver.id
  group_id = var.assigned_group_id
}

resource "okta_auth_server_scope" "groups" {
  auth_server_id   = var.auth_server_id
  name             = "groups"
  description      = "Group memberships"
  consent          = "IMPLICIT"
  metadata_publish = "NO_CLIENTS"
}

resource "okta_auth_server_claim" "groups" {
  auth_server_id          = var.auth_server_id
  name                    = "groups"
  claim_type              = "IDENTITY"
  value_type              = "GROUPS"
  group_filter_type       = "REGEX"
  value                   = ".*"
  always_include_in_token = true
}

resource "okta_auth_server_policy" "stackweaver" {
  auth_server_id   = var.auth_server_id
  name             = "Stackweaver"
  description      = "Stackweaver browser SSO"
  priority         = var.policy_priority
  client_whitelist = [okta_app_oauth.stackweaver.client_id]
}

resource "okta_auth_server_policy_rule" "stackweaver" {
  auth_server_id       = var.auth_server_id
  policy_id            = okta_auth_server_policy.stackweaver.id
  name                 = "Allow Authorization Code"
  priority             = 1
  grant_type_whitelist = ["authorization_code"]
  group_whitelist      = [var.assigned_group_id]
  scope_whitelist      = ["openid", "profile", "email", okta_auth_server_scope.groups.name]
}
