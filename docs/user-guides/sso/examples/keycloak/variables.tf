variable "realm_id" {
  description = "Existing target realm. It can differ from the management authentication realm."
  type        = string
}

variable "zitadel_callback_url" {
  description = "Public Zitadel /idps/callback URL."
  type        = string
}

variable "other_optional_scopes" {
  description = "Complete desired optional-scope list besides groups. This assignment is authoritative."
  type        = list(string)
}
