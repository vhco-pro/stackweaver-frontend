variable "redirect_uris" {
  description = "Frontend OAuth2 callback URLs."
  type        = list(string)
}

variable "display_name" {
  description = "Display name for the app registration in Entra ID."
  type        = string
  default     = "Stackweaver"
}

variable "secret_end_date" {
  description = "Expiry for the client secret (ISO 8601). Rotate before this date."
  type        = string
  default     = "2027-01-01T00:00:00Z"
}
