output "azure_ad_client_id" {
  value = azuread_application.stackweaver.client_id
}

output "azure_ad_tenant_id" {
  value = data.azuread_client_config.current.tenant_id
}

output "azure_ad_client_secret" {
  value     = azuread_application_password.stackweaver.value
  sensitive = true
}
