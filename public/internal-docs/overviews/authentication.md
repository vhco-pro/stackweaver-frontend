<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Authentication & Login Flow

This document describes the authentication system using Zitadel OIDC/OAuth2 for the IaC Orchestration Platform.

## Overview

The platform uses **Zitadel** as the identity provider, implementing the **OAuth2 Authorization Code Flow with PKCE** (Proof Key for Code Exchange) for secure authentication. This flow is recommended for public clients (like web browsers) as it prevents authorization code interception attacks.

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Browser   │────────▶│   Frontend    │────────▶│   Backend    │
│  (User)     │         │  (React)      │         │   (Go API)   │
└─────────────┘         └──────────────┘         └─────────────┘
       │                        │                        │
       │                        │                        │
       ▼                        ▼                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Zitadel (OIDC Provider)                    │
│  - Authorization Endpoint                                     │
│  - Token Endpoint                                            │
│  - UserInfo Endpoint                                         │
│  - JWKS Endpoint                                             │
└─────────────────────────────────────────────────────────────┘
```

## Authentication Flow

### 1. User Initiates Login

When a user clicks "Sign in with Zitadel" on the login page, the `login()` function is called from `AuthContext`.

**Implementation**: 
- Login page: `frontend/src/pages/Auth/Login.tsx:10-18`
- Auth context login: `frontend/src/contexts/AuthContext.tsx:129-137`
- Zitadel auth URL generation: `frontend/src/lib/zitadel.ts:7-28`

The `login()` function in `AuthContext`:

1. Generates a **code verifier** (random 32-byte value)
2. Creates a **code challenge** (SHA-256 hash of the verifier, base64url-encoded)
3. Stores the code verifier in `sessionStorage`
4. Redirects the browser to Zitadel's authorization endpoint

**Key Implementation Details**:
- Code verifier generation: `frontend/src/lib/zitadel.ts:17` (see `generateCodeVerifier()`)
- Code challenge generation: `frontend/src/lib/zitadel.ts:18` (see `generateCodeChallenge()` at line 48)
- Session storage: `frontend/src/lib/zitadel.ts:21`
- Authorization URL construction: `frontend/src/lib/zitadel.ts:27`

**Key Parameters:**
- `client_id`: The OAuth2 client ID registered in Zitadel
- `redirect_uri`: Where Zitadel should redirect after authentication (e.g., `http://localhost:5173/auth/callback`)
- `response_type`: `code` (authorization code flow)
- `scope`: `openid profile email` (OIDC scopes)
- `code_challenge_method`: `S256` (SHA-256)
- `code_challenge`: The hashed code verifier

### 2. Zitadel Authentication

The user is redirected to Zitadel's login UI (hosted at `http://localhost:3000/ui/v2/login`):

- User enters credentials
- Zitadel validates the user
- Zitadel generates an authorization code
- User is redirected back to the frontend callback URL with the code

**Callback URL Format:**
```
http://localhost:5173/auth/callback?code=AUTHORIZATION_CODE
```

### 3. Token Exchange

The frontend callback handler receives the authorization code and exchanges it for tokens.

**Implementation**:
- Callback handler: `frontend/src/pages/Auth/Callback.tsx:19-82`
- Token exchange: `frontend/src/lib/zitadel.ts:59-99`

The `exchangeCodeForTokens()` function:

1. Retrieves the stored code verifier from `sessionStorage` (line 60)
2. Sends a POST request to Zitadel's token endpoint with:
   - `grant_type`: `authorization_code`
   - `code`: The authorization code from the URL
   - `redirect_uri`: Must match the one used in step 1
   - `code_verifier`: The original code verifier
   - `client_id`: The OAuth2 client ID

See `frontend/src/lib/zitadel.ts:59-99` for the complete implementation.

Zitadel validates:
- The authorization code is valid and not expired
- The `code_verifier` matches the `code_challenge` from step 1
- The `redirect_uri` matches

If valid, Zitadel returns:
- `access_token`: JWT token for API authentication
- `id_token`: JWT token containing user identity claims
- `refresh_token`: (optional) For token refresh
- `expires_in`: Token expiration time in seconds

### 4. Token Storage

Tokens are stored in `sessionStorage` (not `localStorage` for security).

**Implementation**: `frontend/src/lib/zitadel.ts` (see `storeTokens()` function)

**Why `sessionStorage`?**
- Tokens are cleared when the browser tab/window closes
- Reduces risk of XSS attacks accessing tokens
- Still allows tokens to persist during the session

### 5. User Info Retrieval

After storing tokens, the frontend fetches user information.

**Implementation**:
- Session check: `frontend/src/contexts/AuthContext.tsx:31-127` (see `checkSession()` function)
- User info retrieval: `frontend/src/lib/zitadel.ts:201-210` (see `getUserInfo()` function)

**UserInfo Response Format**:
The response includes standard OIDC claims: `sub`, `email`, `name`, `given_name`, `family_name`, `preferred_username`. See the `UserInfo` interface at `frontend/src/lib/zitadel.ts:102-109`.

### 6. Session Establishment

The `AuthContext` maintains the session state.

**Implementation**: `frontend/src/contexts/AuthContext.tsx`

**Session Type**: See `Session` type definition in `frontend/src/contexts/AuthContext.tsx`

The session is checked:
- On app mount: `frontend/src/contexts/AuthContext.tsx:154-155`
- Every 5 minutes (periodic refresh): `frontend/src/contexts/AuthContext.tsx:158-160`
- After login callback: `frontend/src/pages/Auth/Callback.tsx:55-82`

### 7. API Authentication

When making API requests, the frontend includes the access token.

**Implementation**: `frontend/src/api/client.ts:33-122` (see `ApiClient.request()` method)

The token is automatically retrieved and included in the Authorization header:
- Token retrieval: `frontend/src/api/client.ts:40-41`
- Header injection: `frontend/src/api/client.ts:47-50`

### 8. Backend Token Verification

The backend API verifies the JWT token on each request.

**Implementation**: 
- Auth middleware: `backend/internal/api/middleware/auth.go`
- Auth service: `backend/internal/services/auth/`

The middleware:
1. Extracts Bearer token from Authorization header
2. Verifies token using Zitadel's JWKS endpoint
3. Extracts user info and creates/updates local user record
4. Attaches user context to the request

See `backend/internal/api/middleware/auth.go` for the complete middleware implementation.

**Token Verification Process:**
1. Parse JWT token (header.payload.signature)
2. Fetch Zitadel's public keys from JWKS endpoint (`/oauth/v2/keys`)
3. Verify token signature using the public key
4. Validate token claims:
   - `iss` (issuer) matches Zitadel issuer
   - `aud` (audience) matches client ID (lenient check)
   - `exp` (expiration) is in the future
5. Extract user info from token or fetch from userinfo endpoint
6. Map Zitadel subject to local user (auto-create if needed)

See `backend/internal/services/auth/` for the token verification implementation.

## Configuration

### Frontend Configuration

Environment variables are configured in `frontend/.env` (generated by `zitadel-init` script).

**Reference**: See `frontend/.env` for configuration. The `zitadel-init` script automatically generates this file.

**Key Variables**:
- `VITE_ZITADEL_ISSUER` - Base Zitadel API URL (not the login UI URL)
- `VITE_ZITADEL_CLIENT_ID` - Frontend OAuth2 client ID
- `VITE_ZITADEL_REDIRECT_URI` - OAuth callback URL

**Important:** `VITE_ZITADEL_ISSUER` should point to the **base Zitadel API URL**, not the login UI URL. The login UI is automatically used by Zitadel for authentication.

### Backend Configuration

Environment variables are configured in `backend/config/config.yaml` or via environment variables.

**Reference**: See `backend/config/config.yaml` and `deploy/.env` for configuration.

**Key Variables**:
- `ZITADEL_API_CLIENT_ID` - Backend service account client ID
- `ZITADEL_API_CLIENT_SECRET` - Backend service account client secret
- `ZITADEL_ISSUER` - Zitadel issuer URL

### Zitadel Configuration

The Zitadel instance must be configured with:

1. **OAuth2 Application** (for frontend):
   - Type: **Web Application**
   - Redirect URIs: `http://localhost:5173/auth/callback`
   - Grant Types: `Authorization Code`
   - Response Types: `code`
   - PKCE: **Enabled** (required for public clients)
   - Scopes: `openid`, `profile`, `email`

2. **OAuth2 Application** (for backend API):
   - Type: **Service Account` or **Machine-to-Machine**
   - Grant Types: `Client Credentials` or `JWT Profile`
   - Used for backend-to-backend authentication (if needed)

3. **External Domain Configuration**:
   - `ExternalDomain`: `localhost:8080` (for browser access)
   - `ExternalPort`: `8080`
   - `TLSMode`: `disabled` (for local development)

## Token Types

### Access Token

- **Format**: JWT (JSON Web Token)
- **Purpose**: Authenticate API requests
- **Lifetime**: Typically 1 hour (configurable in Zitadel)
- **Contains**: User subject, issuer, audience, expiration
- **Storage**: `sessionStorage` in frontend

### ID Token

- **Format**: JWT
- **Purpose**: Identity verification (contains user claims)
- **Lifetime**: Typically 1 hour
- **Contains**: User subject, email, name, etc.
- **Storage**: `sessionStorage` in frontend

### Refresh Token

- **Format**: Opaque token (not JWT)
- **Purpose**: Obtain new access tokens without re-authentication
- **Lifetime**: Long-lived (days/weeks)
- **Storage**: `sessionStorage` in frontend
- **Note**: Currently not implemented in the frontend, but tokens are stored

## Security Considerations

### PKCE (Proof Key for Code Exchange)

PKCE is **required** for public clients (browsers) to prevent authorization code interception:

1. **Code Verifier**: Random 32-byte value generated by the client
2. **Code Challenge**: SHA-256 hash of the verifier, base64url-encoded
3. **Verification**: Zitadel verifies the code verifier matches the challenge

### Token Storage

- **`sessionStorage`** (not `localStorage`):
  - Cleared when browser tab closes
  - Reduces XSS attack surface
  - Still allows session persistence

### CORS Configuration

The frontend and API are on different origins (`localhost:5173` vs `localhost:8022`), so CORS must be configured:

**Frontend Solution**: Vite proxy (development)
```typescript
// frontend/vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8022',
      changeOrigin: true,
    },
  },
}
```

**Backend Solution**: CORS middleware
```go
// backend/internal/api/middleware/cors.go
func CORSMiddleware() gin.HandlerFunc {
  return func(c *gin.Context) {
    origin := c.GetHeader("Origin")
    if isAllowedOrigin(origin) {
      c.Header("Access-Control-Allow-Origin", origin)
      c.Header("Access-Control-Allow-Credentials", "true")
    }
    // ... handle preflight requests
  }
}
```

### Token Validation

The backend validates tokens on **every request**:
- Signature verification using Zitadel's public keys
- Expiration check
- Issuer validation
- Audience validation (lenient)

## Logout Flow

```typescript
// frontend/src/contexts/AuthContext.tsx
const logout = async () => {
  clearTokens();
  setSession(null);
  const logoutUrl = getLogoutUrl();
  window.location.href = logoutUrl;
};
```

The logout URL includes a post-logout redirect:

```typescript
// frontend/src/lib/zitadel.ts
export const getLogoutUrl = () => {
  const params = new URLSearchParams({
    post_logout_redirect_uri: window.location.origin,
  });
  return `${issuer}/oidc/v1/end_session?${params.toString()}`;
};
```

This:
1. Clears tokens from `sessionStorage`
2. Clears session state
3. Redirects to Zitadel's end session endpoint
4. Zitadel clears its session
5. Redirects back to the frontend

## Error Handling

### Common Errors

1. **"Code verifier not found"**
   - **Cause**: `sessionStorage` was cleared or code verifier wasn't stored
   - **Solution**: User must log in again

2. **"Token exchange failed: 400"**
   - **Cause**: Invalid authorization code or code verifier mismatch
   - **Solution**: User must log in again

3. **"Failed to get user info: 401"**
   - **Cause**: Access token expired or invalid
   - **Solution**: User must log in again (refresh token not implemented)

4. **"Invalid token" (backend)**
   - **Cause**: Token signature invalid, expired, or issuer mismatch
   - **Solution**: Frontend should redirect to login

### Error Recovery

The frontend handles errors gracefully:

```typescript
// frontend/src/pages/Auth/Callback.tsx
try {
  const tokens = await exchangeCodeForTokens(code);
  storeTokens(tokens);
  await refresh();
  navigate('/dashboard');
} catch (err) {
  setError(err.message);
  setTimeout(() => {
    navigate('/auth/login', { replace: true });
  }, 3000);
}
```

## User Auto-Creation

On first login, the backend automatically creates a local user:

```go
// backend/internal/services/auth/service.go
userInfo, err := s.verifier.FetchUserInfo(tokenString)
user, err := s.userRepo.GetByZitadelSubject(userInfo.Subject)
if err != nil {
  // User doesn't exist, create them
  user = &models.User{
    ZitadelSubject: userInfo.Subject,
    Email:          userInfo.Email,
    Name:           userInfo.Name,
  }
  s.userRepo.Create(user)
} else {
  // Update user info if changed
  user.Email = userInfo.Email
  user.Name = userInfo.Name
  s.userRepo.Update(user)
}
```

This ensures:
- Users are automatically provisioned on first login
- User information stays in sync with Zitadel
- No manual user creation required

## References

- [Zitadel OIDC Documentation](https://zitadel.com/docs/guides/integrate/login/oidc/login-users)
- [OAuth2 Authorization Code Flow with PKCE](https://oauth.net/2/pkce/)
- [Zitadel Go SDK](https://github.com/zitadel/zitadel-go)
- [Zitadel React Example](https://zitadel.com/docs/examples/login/react)

