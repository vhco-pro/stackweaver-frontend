---
description: "Configure email (SMTP) for sign-up verification, password reset and email login codes, choose who may sign up, and what an install without SMTP offers"
covers:
  - "scripts/zitadel-init/**"
  - "deploy/sso.env.example"
  - "deploy/helm/stackweaver/values.yaml"
  - "deploy/helm/stackweaver/templates/zitadel/**"
  - "backend/cmd/api/**"
  - "backend/internal/api/v2/handlers/auth_proxy.go"
  - "backend/internal/services/auth/**"
---

# Email (SMTP) and sign-up

StackWeaver signs people in through Zitadel, and Zitadel sends every email the sign-in flow needs: the code that verifies a new account's address, the link that resets a forgotten password, and email login codes for two-factor authentication. You give it an SMTP server to send them through. This page explains how to configure one for Docker Compose and for Kubernetes, who may create an account, and what an install without SMTP offers instead.

Auth codes are only ever delivered by Zitadel. The API never returns a verification or reset code to the browser that asked for it, so nobody can reset someone else's password or verify an address they do not own.

## Choosing an SMTP provider

Any transactional email provider that offers SMTP submission works, on port 587 with STARTTLS or port 465 with TLS. Examples include Brevo, Mailjet, Resend, SMTP2GO, Postmark, Mailgun, Scaleway Transactional Email and Amazon SES; most have a free tier large enough for sign-in mail. Use a sending domain you control, for example `mail.example.com`, and add the SPF, DKIM and DMARC records your provider gives you, or receiving servers will treat the mail as spam.

Keep this sending identity for sign-in mail only. Newsletters and product announcements belong in your provider's marketing or broadcast product, sent from a different subdomain, so that a spam complaint about a newsletter never affects the delivery of a password reset.

## Docker Compose

Put the SMTP settings in `sso.env` in your Compose directory. Both `zitadel-init` and the API read that file. The full list of settings is in `sso.env.example`:

| Variable | Meaning |
|---|---|
| `SMTP_HOST` | The SMTP submission server as `host:port`, for example `smtp.example.com:587`. Leave it empty to run without SMTP. |
| `SMTP_USER` | The SMTP username. Leave it empty for a server that needs no authentication. |
| `SMTP_PASSWORD` | The SMTP password or API key. |
| `SMTP_SENDER_ADDRESS` | The From address, for example `noreply@mail.example.com`. Required when `SMTP_HOST` is set. |
| `SMTP_SENDER_NAME` | The From display name. Defaults to `Stackweaver`. |
| `SMTP_TLS` | Whether to use TLS. Defaults to `true`. |
| `STACKWEAVER_SELF_REGISTRATION` | Whether anyone may create an account (see [Who can sign up](#who-can-sign-up)). Defaults to `false`. |

Run `zitadel-init` again after changing these values (`docker compose run --rm --no-deps zitadel-init`); a one-off run reads `sso.env` afresh and leaves Zitadel and the other services running. It configures the provider in Zitadel, activates it and applies the matching login settings, and it stops with an error if `SMTP_HOST` is set without `SMTP_SENDER_ADDRESS` or a value cannot be parsed, so a misconfiguration is visible immediately.

## Kubernetes (Helm)

Set the SMTP settings in the chart's `smtp` values and keep the password in a Kubernetes Secret:

| Value | Meaning |
|---|---|
| `smtp.host` | The SMTP submission server as `host:port`. Leave it empty to run without SMTP. |
| `smtp.user` | The SMTP username. Leave it empty for a server that needs no authentication. |
| `smtp.senderAddress` | The From address. Required when `smtp.host` is set. |
| `smtp.senderName` | The From display name. Defaults to `Stackweaver`. |
| `smtp.tls` | Whether to use TLS. Defaults to `true`. |
| `smtp.secretName` | An existing Secret that holds the SMTP password. |
| `smtp.keys.password` | The key of the password inside that Secret. Defaults to `smtp-password`. |
| `signup.selfRegistration` | Whether anyone may create an account. Defaults to `false`. |

Create the Secret before you install or upgrade:

```bash
kubectl create secret generic stackweaver-smtp -n stackweaver --from-literal=smtp-password='<password or API key>'
```

A Job runs after every `helm install` and `helm upgrade` and applies these settings to the bundled Zitadel. If a value is unusable, for example `smtp.host` without `smtp.senderAddress`, the Job fails and so does the `helm` command, while Zitadel keeps serving sign-ins with the settings it had. Changing any of these values takes effect on the next `helm upgrade`, including a password you rotated inside the same Secret. With Argo CD the Job runs as a PostSync hook on every sync. With Flux it runs whenever the HelmRelease is installed or upgraded. Rotating a Secret alone triggers neither, so after a rotation start a sync (Argo CD) or force an upgrade of the HelmRelease (Flux).

The Job configures only the Zitadel the chart bundles. With an external Zitadel (`zitadel.bundled: false`), configure its SMTP provider and login policy in that Zitadel yourself. The API runs in email mode either way.

## Who can sign up

Public sign-up is off by default. Turn it on with `STACKWEAVER_SELF_REGISTRATION=true` in Compose or `signup.selfRegistration: true` in Helm. It takes effect only when an SMTP provider is configured, because a new account must verify its email address before it can use StackWeaver; without SMTP the verification code could never arrive, so sign-up stays off and `zitadel-init` logs a warning.

With sign-up off, people get an account in one of these ways:

- **Single sign-on.** A first sign-in through an identity provider you configured (Azure AD, Okta or another OIDC provider, see the [SSO guides](../../user-guides/sso/README.md)) creates the account, with its email marked as verified, whether or not public sign-up is on. Configuring the provider is what allows its users in, so use a provider that only your organisation's people can sign in to. For Azure AD that means setting `AZURE_AD_TENANT_ID` (Helm: `sso.azureAd.tenantId`); without it `zitadel-init` stops with an error unless you set `AZURE_AD_ALLOW_MULTI_TENANT=true` (Helm: `sso.azureAd.allowMultiTenant`), which lets any Microsoft account create an account. Public providers such as Google, GitHub, GitLab.com or Apple do the same.
- **An administrator creates the account** in the Zitadel console with an initial password. Tick **Email verified** when creating it: StackWeaver only lets in accounts whose email is verified, and without SMTP the user has no way to verify it later. The user is asked to change the password at first sign-in.

Someone who already has an account with a password and then signs in through single sign-on with the same email address is asked to sign in with their password first.

An account whose email is not verified cannot use StackWeaver. The API answers it with "verify your email address to continue", and the web app shows a page telling the person to sign in again and enter the code from their verification email when asked. An invitation to an organisation is only accepted by an account that has verified the invited address.

## What an install without SMTP offers

Without an SMTP provider, StackWeaver switches off every flow that waits for an email: the sign-in page shows no "Create account" and no "Forgot password?", and two-factor setup does not offer email codes (authenticator apps, security keys and passkeys remain available). People get in through single sign-on or an administrator-created account as described above, and a forgotten password is reset by an administrator in the Zitadel console.

## Settings StackWeaver manages

`zitadel-init` (in Kubernetes, the Job) manages four Zitadel login settings on the instance and on every organisation with its own login policy, and restores them on every run. It allows registration only when public sign-up is on and email can be delivered. It hides "Forgot password?" when email cannot be delivered. It removes email codes as a second factor when email cannot be delivered, and adds them back when it can, wherever another second factor is already allowed. It removes SMS codes as a second factor while no SMS provider is active.

Change them through the settings on this page, not in the Zitadel console: a console edit to any of them is reverted the next time `zitadel-init` runs. Every other login setting is yours to change in the console and is left as you set it.

## Notification mode

The API's `STACKWEAVER_NOTIFICATION_MODE` is `email`, and that is the only value a deployed instance uses. The value `return_code`, which shows codes in the browser instead of mailing them, exists for development machines only: the API refuses to start with it unless `STACKWEAVER_ALLOW_RETURN_CODE=true` is also set, refuses it in every case when `GIN_MODE=release`, which the Helm chart always sets, and refuses any value it does not recognise. Neither the Compose example nor the chart sets that switch. If your configuration sets `api.auth.notificationMode: return_code` or `STACKWEAVER_NOTIFICATION_MODE=return_code`, remove it and configure SMTP as described above. To check which mode a running API uses, read the `notification_mode` field of the API's `GET /auth/health/auth-proxy` response (see `AuthProxy.HealthAuthProxy()` in `backend/internal/api/v2/handlers/auth_proxy.go`).
