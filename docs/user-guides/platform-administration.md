---
description: "Guide to the platform administrator: what the install-wide role can and cannot do, the platform Settings pages, declared and granted administrators, platform admin tokens, the admin API, and recovering a lost login"
covers:
  - "backend/internal/services/platformadmin/**"
  - "backend/internal/api/v2/handlers/admin_users.go"
  - "backend/internal/api/v2/handlers/admin_organizations.go"
  - "backend/internal/api/v2/handlers/admin_tofu_versions.go"
  - "backend/internal/api/v2/handlers/platform_settings.go"
  - "backend/internal/api/v2/handlers/account.go"
  - "backend/internal/api/v2/handlers/tokens.go"
  - "backend/internal/services/apikey/scopes.go"
  - "frontend/src/pages/Settings.tsx"
  - "frontend/src/pages/Settings/TofuVersions.tsx"
  - "frontend/src/pages/Settings/Platform*"
  - "frontend/src/pages/Settings/PersonalAccessTokens.tsx"
  - "deploy/sso.env.example"
  - "deploy/helm/stackweaver/values.yaml"
---

# Platform Administration

A platform administrator manages the StackWeaver installation itself rather than any one organization in it. The role covers three things: the OpenTofu versions catalogue that every workspace on the installation chooses from, the list of platform administrators, and a read-only list of every organization on the installation. Everything else in StackWeaver belongs to an organization and is governed by that organization's teams and permissions.

## What the role can and cannot do

A platform administrator adds, enables, disables and deletes versions in the OpenTofu versions catalogue, grants and removes other platform administrators, and sees every organization on the installation with its admin email, member count, workspace count and creation date.

The role gives no access inside an organization. A platform administrator who is not a member of an organization cannot open its workspaces, runs, state, variables, teams or settings, and the organization list marks that organization "Not a member". To work inside a customer's organization, a platform administrator joins that organization's `owners` team the same way anyone else does, through an existing owner, so the membership shows up like any other owner's.

Owning organizations, even every organization on the installation, does not make someone a platform administrator either, and the install-wide pages and routes answer an organization owner as if they did not exist.

Each organization chooses its own default OpenTofu version from the catalogue. Its owners set it on the organization's general settings page, as [Organization Settings](./organization-settings.md) describes; it is not a platform setting.

## The platform Settings pages

A platform administrator sees a **Platform** section on the Settings page, below their personal settings, with three pages. Nobody else sees the section, and anyone else who opens one of these addresses gets a not-found page and no data.

**Platform Administrators** (`/settings/platform/administrators`) lists every platform administrator with their name and email address. Administrators declared by the deployment carry a "Declared by the deployment" badge and have no remove action. **Add administrator** asks for one exact email address, looks up the account that holds it and grants it the role; the dialog says "No account has this email address" when there is none, so the person must have signed in to StackWeaver at least once before you can add them. To remove a granted administrator, open the row's actions menu, choose **Remove administrator** and confirm. A read-only **Deployment settings** panel on the same page shows the installation's organization-creation setting.

**OpenTofu Versions** (`/settings/platform/terraform-versions`) manages the catalogue of OpenTofu versions available to every workspace on the installation.

**Organizations** (`/settings/platform/organizations`) is a searchable, read-only table of every organization on the installation. A row links into the organization only when you are a member of it.

## Declared and granted administrators

There are two kinds of platform administrator, and they differ in who can remove them.

A declared administrator is named by the deployment configuration: `STACKWEAVER_PLATFORM_ADMINS` in `sso.env` on Docker Compose, or the chart value `platform.admins` on Kubernetes, as a list of email addresses. When the list is unset, it holds the bootstrap admin, the first Zitadel account the installer creates (`ZITADEL_ADMIN_USERNAME` on Compose, `zitadel.init.adminUsername` with the chart's bundled Zitadel), so a fresh installation has a platform administrator as soon as that account signs in. An installation that uses its own Zitadel (`zitadel.bundled: false`) has no bootstrap admin the chart knows about and must set `platform.admins`. With an empty list, the API logs a warning at startup and nobody can reach the platform pages until the list is set.

StackWeaver matches the list, ignoring case, against the email address the identity provider reports as verified when a person signs in. A person whose address is on the list but not verified does not get the role. A declared administrator cannot be removed through the API or the UI. To remove one, take the address off the list and restart the API; the role is withdrawn when the API starts with the new list. A declared administrator who changes their verified email at the identity provider to an address that is not on the list loses the role on their next request.

Declare only addresses you control at every identity provider this installation signs people in with, and declare them before anyone else could register them. The match trusts each identity provider's verification of the address, so an address someone else could register and verify at any of those providers would make that person a platform administrator.

A granted administrator is added by another platform administrator, on the Platform Administrators page or through the API, and any platform administrator can remove them again, including themselves. The change applies to the person's next request, with no need to sign out. Because the declared administrators cannot be removed from inside StackWeaver, the installation always keeps at least the administrators its deployment names. A granted administrator whose address is then added to the declared list becomes a declared one on their next request.

Every grant, removal, declaration and withdrawal is recorded as an activity that belongs to no organization, naming who acted (the system, for the check the API runs at startup) and whose role changed.

## Platform admin tokens

The install-wide API accepts only one kind of API token: a personal token minted with the platform admin scope. On **Settings > API Tokens**, the create dialog of a platform administrator has a **Platform admin** checkbox, and a token created with it carries a "Platform admin" badge in the token list. The checkbox appears to platform administrators only, and only a signed-in platform administrator can mint such a token.

Every other token gets a not-found answer from the install-wide routes, even when its owner is a platform administrator. That covers a plain personal token, a `terraform login` token (which is always plain) and every organization or team token. Inside organizations, a platform admin token acts exactly as a plain personal token of the same person: it reaches the organizations that person belongs to, with that person's permissions, and nothing more.

A platform admin token stops working for the install-wide routes as soon as its owner stops being a platform administrator, and it keeps working everywhere else as a plain personal token. The `tfe_terraform_version` resource of the Terraform provider needs one; see [Managing StackWeaver with Terraform](./terraform-provider.md#authenticating).

## The platform API

The install-wide routes follow the shape of the Terraform Enterprise admin API. Each of them answers 404 to any caller who is not a platform administrator, whether that caller uses a browser session or a token without the platform admin scope.

| Route | What it does |
|---|---|
| `GET /api/v2/admin/users` | Looks up accounts. A call must carry `filter[admin]=true`, which lists every platform administrator, or `q` set to one full email address, which returns at most the one account that holds it. Any other call answers 400, so the route never lists every account on the installation. Each user carries `is-admin` and `platform-admin-declared`. |
| `POST /api/v2/admin/users/:id/actions/grant_admin` | Makes the user a platform administrator. Answers 400 when the user already is one. |
| `POST /api/v2/admin/users/:id/actions/revoke_admin` | Removes a granted administrator. Answers 400 when the user is not one, and 422 for a declared administrator. |
| `GET /api/v2/admin/organizations`, `GET /api/v2/admin/organizations/:name` | Lists every organization, or reads one, without its settings, members or tokens. |
| `/api/v2/admin/terraform-versions` | Manages the OpenTofu versions catalogue. |

Two routes answer every signed-in caller. `GET /api/v2/account/details` reports whether the caller is a platform administrator (`is-site-admin`), whether the deployment declared them (`platform-admin-declared`), and whether they may create organizations (`permissions.can-create-organizations`). `GET /api/v2/platform/settings` returns the installation's `organization-creation` setting, `everyone` or `platform-admins`, which the deployment sets with `STACKWEAVER_ORGANIZATION_CREATION` or `platform.organizationCreation`. [Organization Settings](./organization-settings.md#creating-organizations) explains what the setting changes.

## Recovering a lost login

StackWeaver has no recovery mechanism of its own, because signing in belongs to the identity layer. When a platform administrator cannot sign in, an operator resets their password in the Zitadel console at `/ui/console` on the auth host, as the [Zitadel Setup Guide](./authentication/zitadel-setup.md) describes.

When nobody can sign in to the console either, the `zitadel-init` machine user's personal access token still reaches Zitadel's management API. On Docker Compose it is the file `/pat/admin.pat` in the `zitadel-pat` volume; on Kubernetes it is the `admin-pat` key of the Zitadel Secret. With it you can set a new password for the account, or create a new human user that holds a declared address, marked as verified, which becomes a platform administrator at its first sign-in.

To make someone else a platform administrator without signing in at all, add their address to `STACKWEAVER_PLATFORM_ADMINS` (or `platform.admins`), restart the API, and have them sign in.
