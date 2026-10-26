terraform {
  required_providers {
    keycloak = {
      source  = "keycloak/keycloak"
      version = "~> 5.10"
    }
  }
}

provider "keycloak" {}

resource "keycloak_openid_client" "stackweaver" {
  realm_id              = var.realm_id
  client_id             = "stackweaver"
  name                  = "Stackweaver"
  access_type           = "CONFIDENTIAL"
  standard_flow_enabled = true
  valid_redirect_uris   = [var.zitadel_callback_url]
}

resource "keycloak_openid_client_scope" "groups" {
  realm_id = var.realm_id
  name     = "groups"
}

resource "keycloak_openid_group_membership_protocol_mapper" "groups" {
  realm_id            = var.realm_id
  client_scope_id     = keycloak_openid_client_scope.groups.id
  name                = "Stackweaver groups"
  claim_name          = "groups"
  full_path           = false
  add_to_id_token     = true
  add_to_access_token = true
  add_to_userinfo     = true
}

resource "keycloak_openid_client_optional_scopes" "stackweaver" {
  realm_id        = var.realm_id
  client_id       = keycloak_openid_client.stackweaver.id
  optional_scopes = concat(var.other_optional_scopes, [keycloak_openid_client_scope.groups.name])
}
