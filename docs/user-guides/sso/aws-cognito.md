---
description: "Step-by-step guide for configuring AWS Cognito as an SSO provider"
covers:
  - "scripts/zitadel-init/**"
  - "deploy/sso.env.example"
  - "deploy/helm/**"
---

# AWS Cognito SSO Setup

This guide walks you through configuring AWS Cognito as an external identity provider for StackWeaver using the Generic OIDC integration.

## Step 1: Create a User Pool

If you do not already have a Cognito User Pool, create one:

1. Sign in to the [AWS Management Console](https://console.aws.amazon.com).
2. Navigate to **Amazon Cognito** > **User pools**.
3. Click **Create user pool**.
4. Choose your sign-in options (email, username, etc.) and configure security settings as needed.
5. Under **App integration**, configure the hosted UI domain if you have not already.
6. Complete the wizard and note the **User Pool ID** and **AWS Region**.

## Step 2: Create an App Client

1. In your User Pool, go to **App integration** > **App clients and analytics**.
2. Click **Create app client**.
3. Configure the app client:
   - **App type**: Select **Confidential client**.
   - **App client name**: `StackWeaver`
   - **Generate a client secret**: Enabled.
   - **Allowed callback URLs**: Add your Zitadel callback URL:
     ```
     https://zitadel.example.com/idps/callback
     ```
     Replace `zitadel.example.com` with your actual Zitadel domain. For a localhost-only setup, use `http://localhost:8080/idps/callback`. See the [Custom Domain guide](../zitadel-custom-domain.md) for how the callback URL is constructed.
   - **Allowed sign-out URLs**: Add your StackWeaver frontend URL (optional).
   - **OAuth 2.0 grant types**: Ensure **Authorization code grant** is selected.
   - **OpenID Connect scopes**: Select `openid`, `profile`, and `email`.
4. Click **Create app client**.

## Step 3: Note Your Application Details

After creating the app client, note the following:

| Field | Where to find it | Example |
|-------|-------------------|---------|
| Client ID | App client settings | `1a2b3c4d5e6f7g8h9i0j` |
| Client Secret | App client settings (click Show) | (copy the secret value) |
| User Pool ID | User pool overview | `us-east-1_AbCdEfGhI` |
| AWS Region | User pool overview | `us-east-1` |

Your OIDC Issuer URL follows the pattern:
```
https://cognito-idp.{region}.amazonaws.com/{user-pool-id}
```

For example: `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_AbCdEfGhI`

## Step 4: Configure Group Claims (Optional)

Cognito supports groups natively. To forward group memberships to StackWeaver:

1. In your User Pool, go to **Groups**.
2. Create groups that correspond to your StackWeaver teams (e.g., `engineering`, `platform-team`).
3. Add users to the appropriate groups.

Cognito automatically includes group memberships in the `cognito:groups` claim of the ID token. No additional configuration is required. StackWeaver's group capture action handles both the standard `groups` claim and the Cognito-specific `cognito:groups` claim.

## Step 5: Configure StackWeaver

Choose the instructions for your deployment method.

### Docker Compose

Add the following variables to **`deploy/sso.env`** (this file is not overwritten by the auto-generated `deploy/.env`):

```bash
# AWS Cognito SSO Configuration
OIDC_IDP_NAME=AWS Cognito
OIDC_IDP_ISSUER=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_AbCdEfGhI
OIDC_IDP_CLIENT_ID=1a2b3c4d5e6f7g8h9i0j
OIDC_IDP_CLIENT_SECRET=your-client-secret-value
```

Replace the example values with your actual Cognito app client details.

Then restart the `zitadel-init` service:

```bash
cd deploy
docker compose up -d --build zitadel-init
```

### Kubernetes / Helm

Create a Kubernetes Secret with the client secret:

```bash
kubectl create secret generic stackweaver-sso \
  --namespace stackweaver \
  --from-literal=oidc-idp-client-secret="your-client-secret-value"
```

Add the Cognito configuration to your Helm values file:

```yaml
sso:
  secretName: stackweaver-sso
  oidcProvider:
    name: "AWS Cognito"
    issuer: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_AbCdEfGhI"
    clientId: "1a2b3c4d5e6f7g8h9i0j"
```

Then upgrade the release:

```bash
helm upgrade stackweaver oci://ghcr.io/vhco-pro/charts/stackweaver \
  --namespace stackweaver \
  --values my-values.yaml
```

### Verify the configuration

The `zitadel-init` service will detect the OIDC environment variables and:

1. Register the OIDC provider in Zitadel with the name "AWS Cognito".
2. Add the provider to the login policy so a "Sign in with AWS Cognito" button appears.
3. Create Zitadel Actions to capture and forward group claims (including `cognito:groups`) through the JWT.

Check the logs to verify:

**Docker Compose:**
```bash
docker compose -f deploy/docker-compose.yml logs zitadel-init
```

**Kubernetes:**
```bash
kubectl logs -f deployment/stackweaver-zitadel -c zitadel-init --namespace stackweaver
```

## Step 7: Test the Integration

1. Open StackWeaver in your browser.
2. On the login page, you should see a "Sign in with AWS Cognito" button.
3. Click it to be redirected to the Cognito hosted UI.
4. Sign in with your Cognito credentials.
5. On first login, Zitadel auto-provisions the user and redirects you back to StackWeaver.

After the first login, the user is provisioned but does not have access to any organization. An admin must invite the user, or you can configure [team mapping](./team-mapping.md) for automatic access.

## Provider Behavior

| Setting | Value | Description |
|---------|-------|-------------|
| Auto-creation | Enabled | New users are automatically created in Zitadel on first login |
| Auto-update | Enabled | User profile is synced on each login |
| Account linking | Email-based | Existing users with matching email are automatically linked |
| Token mapping | Userinfo endpoint | Claims are read from the OIDC userinfo endpoint |
| Scopes | `openid`, `profile`, `email` | Standard OIDC scopes |

## Cognito-Specific Notes

### Group Claim Format

Cognito sends group memberships as `cognito:groups` rather than the standard `groups` claim. StackWeaver's Zitadel Actions are configured to handle both formats automatically. The captured groups appear as `sso_groups` in the StackWeaver JWT regardless of the original claim name.

### Hosted UI Domain

Cognito requires a configured domain for the hosted UI. If you have not set one up:

1. Go to **App integration** > **Domain name**.
2. Choose either a Cognito-provided domain (e.g., `your-domain.auth.us-east-1.amazoncognito.com`) or a custom domain.
3. The domain is used for the hosted login page that Zitadel redirects to.

### Token Endpoint Authentication

The app client must be configured as a **Confidential client** with a client secret. Public clients (without a secret) are not supported for this integration.

## Troubleshooting

### Login button does not appear

Verify that `OIDC_IDP_CLIENT_ID` is set and non-empty in `deploy/sso.env`. Re-run `zitadel-init` and check the logs.

### "Invalid redirect URI" error

Ensure the callback URL in your Cognito app client matches the callback URL that Zitadel uses:
```
https://{your-zitadel-domain}/idps/callback
```

The callback URL is constructed from the request's domain context, not directly from configuration. See the [Custom Domain guide](../zitadel-custom-domain.md) for details.

### User authenticated but no organization access

This is expected. SSO users are provisioned without organization membership. Either invite the user to an organization or configure [team mapping](./team-mapping.md).

### Groups not appearing in StackWeaver

1. Verify the user is assigned to at least one Cognito group.
2. Check that the app client has `openid` in its scopes.
3. Cognito groups are sent automatically in the `cognito:groups` claim; no additional claim configuration is needed.

> **Note:** StackWeaver uses the Generic OIDC integration for AWS Cognito. Only one Generic OIDC provider can be configured at a time through environment variables. Azure AD uses a separate dedicated integration and can be configured alongside Cognito.
