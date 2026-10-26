variable "zitadel_callback_url" {
  description = "Public Zitadel callback registered on the confidential web app."
  type        = string
}

variable "auth_server_id" {
  description = "Existing custom authorization server. default preserves the documented issuer."
  type        = string
  default     = "default"
}

variable "assigned_group_id" {
  description = "Existing Okta group containing the test users allowed to use this app."
  type        = string
}

variable "policy_priority" {
  description = "Available policy priority after reviewing the existing server's policy order."
  type        = number
}
