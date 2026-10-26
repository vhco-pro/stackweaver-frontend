output "oidc_idp_client_id" {
  value = keycloak_openid_client.stackweaver.client_id
}

output "oidc_idp_client_secret" {
  value     = keycloak_openid_client.stackweaver.client_secret
  sensitive = true
}
