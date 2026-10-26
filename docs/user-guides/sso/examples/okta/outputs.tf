output "oidc_idp_client_id" {
  value = okta_app_oauth.stackweaver.client_id
}

output "oidc_idp_client_secret" {
  value     = okta_app_oauth.stackweaver.client_secret
  sensitive = true
}
