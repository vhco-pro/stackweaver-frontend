output "AZURE_DEVOPS_CLIENT_ID" {
  description = "Set as AZURE_DEVOPS_CLIENT_ID in deploy/vcs.env"
  value       = azuread_application.stackweaver.client_id
}

output "AZURE_DEVOPS_CLIENT_SECRET" {
  description = "Set as AZURE_DEVOPS_CLIENT_SECRET in deploy/vcs.env"
  value       = azuread_application_password.stackweaver.value
  sensitive   = true
}

output "AZURE_DEVOPS_TENANT_ID" {
  description = "Set as AZURE_DEVOPS_TENANT_ID in deploy/vcs.env (single-tenant only)."
  value       = data.azuread_client_config.current.tenant_id
}
