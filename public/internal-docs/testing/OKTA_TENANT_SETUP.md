<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Okta Tenant Setup for Internal OIDC Testing

This guide covers setting up your own Okta tenant for testing the StackWeaver OIDC/SSO integration. It is intended for contributors who need an IdP to verify the [Okta SSO user guide](../user-guides/sso/okta.md) and [team sync behavior](SSO_TEAM_SYNC_TESTING.md).

## Does Okta Have a Free Tier?

Yes. Okta offers the **Integrator Free Plan**, which is free for developers to build, test, and manage integrations.

| Aspect | Details |
|--------|---------|
| Cost | Free |
| Purpose | Build, test, manage integrations; test code and apps |
| Sign up | [developer.okta.com/signup](https://developer.okta.com/signup) |
| Inactivity | Access expires after 180 consecutive days of inactivity |
| Note | Not for production use; optimized for development and testing |

**Historical note:** Okta previously offered "Developer Edition" orgs. As of July 18, 2025, those are being deactivated. New signups receive the Integrator Free Plan by default.

## Step 1: Sign Up for Okta Integrator Free Plan

1. Go to [developer.okta.com/signup](https://developer.okta.com/signup).
2. Choose **Okta Integrator Free Plan** (or **Sign up for Integrator Free Plan**).
3. Fill in the form:
   - First name, last name
   - Work email
   - Country/region
4. Accept the Integrator Free Plan Agreement and Privacy Policy.
5. Click **Sign up**.
6. Okta sends a verification email; use the activate link.
7. Set a password and complete account activation.
8. You are redirected to the **Okta Admin Console** of your new org.

Your signup email and password become your admin credentials. You are created as a super administrator.

## Step 2: Find Your Okta Domain

After activation, you need your Okta org domain for the OIDC issuer URL.

1. In the Admin Console, click your name (or profile) in the upper-right.
2. The URL in your browser is `https://<your-domain>.okta.com` — this is your Okta domain.
3. Alternatively, go to **Settings** → **Customization** → **Domains**.
4. Your OIDC Issuer URL is: `https://<your-domain>.okta.com` (no trailing slash).

Example: If your domain is `integrator-1754263-admin.okta.com`, your issuer is `https://integrator-1754263-admin.okta.com`.

> [!IMPORTANT]
> if you have an url with `-admin` in it it must be left out when specifying the issuer url.

## Step 3: Create the OIDC Application in Okta

This step configures the app that Zitadel will use to authenticate users. The full instructions are in the user-facing guide.

**See: [Okta SSO Setup](../../user-guides/sso/okta.md)**

Summary of what you will do:

1. **Applications** → **Applications** → **Create App Integration**
2. Sign-in method: **OIDC - OpenID Connect**
3. Application type: **Web Application**
4. Configure redirect URI: `https://<zitadel-domain>/idps/callback` (or `http://localhost:8080/idps/callback` for local dev)
5. Note **Client ID** and **Client Secret** from the **General** tab
6. (Optional) Configure `groups` claim for team sync testing — see Step 4 in the Okta user guide

## Step 4: Create Test Users (Optional)

For OIDC login testing, your admin account is enough. For team sync testing, create at least one non-admin user and assign them to a group.

1. In Admin Console, go to **Directory** → **People**.
2. Click **Add Person**.
3. Enter First name, Last name, Primary email, Username (typically same as email).
4. Uncheck **User must change password on first login**.
5. Choose **I will set password** and enter a password.
6. For **Activation**, select **Activate now**.
7. Click **Save**.

## Step 5: Create a Group (Optional, for Team Sync)

To test [SSO team sync](SSO_TEAM_SYNC_TESTING.md), you need at least one Okta group.

1. Go to **Directory** → **Groups**.
2. Click **Add group**.
3. Name: e.g. `Engineering` or `Retailers`.
4. Description: optional.
5. Click **Save**.
6. Assign users: click the group → **Assign** → **Assign people** → select your test user(s).

For StackWeaver team mapping, use the **group name** as `sso_team_id` when creating teams (see [SSO Team Mapping](../../user-guides/sso/team-mapping.md)).

## Step 6: Configure StackWeaver

Add Okta credentials to `deploy/sso.env`:

```bash
OIDC_IDP_NAME=Okta
OIDC_IDP_ISSUER=https://<your-okta-domain>.okta.com
OIDC_IDP_CLIENT_ID=<Client ID from Okta>
OIDC_IDP_CLIENT_SECRET=<Client Secret from Okta>
```

Restart `zitadel-init` to register the provider:

```bash
cd deploy
docker compose up -d --build zitadel-init
```

## Step 7: Verify

1. Open StackWeaver in your browser.
2. Log out if needed.
3. On the login page, click **Sign in with Okta**.
4. Sign in with your Okta credentials.
5. You should be redirected back to StackWeaver and auto-provisioned.

## References

- **User guide (OIDC app setup):** [docs/user-guides/sso/okta.md](../../user-guides/sso/okta.md)
- **Team sync testing:** [docs/internal/testing/SSO_TEAM_SYNC_TESTING.md](SSO_TEAM_SYNC_TESTING.md)
- **Okta set-up org guide:** [developer.okta.com/docs/guides/set-up-org/main](https://developer.okta.com/docs/guides/set-up-org/main/)
- **Okta Integrator Free Plan signup:** [developer.okta.com/signup](https://developer.okta.com/signup)
