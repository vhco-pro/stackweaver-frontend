variable "zitadel_callback_url" {
  description = "Public Zitadel /idps/callback URL, not the Stackweaver frontend callback."
  type        = string
}

variable "secret_expiry" {
  description = "Future RFC3339 expiry chosen for your credential rotation policy."
  type        = string
}
