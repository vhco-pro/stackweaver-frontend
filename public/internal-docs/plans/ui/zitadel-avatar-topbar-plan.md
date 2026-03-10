<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Zitadel User Avatar in Admin Top Bar – Implementation Plan

## Summary

- **Zitadel source**: OIDC **UserInfo** `picture` claim (`GET ${issuer}/oidc/v1/userinfo` with Bearer token). Requires `profile` scope (already requested).
- **Backend**: Add UserInfo fetch to the **Profile API** flow. When GetProfile is called with JWT auth, call UserInfo, extract `picture`, and return it as `avatar` in the response. Reuse `fetchUserInfoFromEndpoint` (or an auth-service wrapper) in `backend/internal/services/auth/zitadel.go`.
- **Frontend**: (1) Add `picture` to UserInfo/session (from existing `getUserInfo`). (2) Add `avatar` to `UserProfile` and GetProfile response. (3) Display avatar in **Navbar** and **Sidebar** from `session.user.picture`, with fallback (initials or icon).

## Goal

Load user avatars (profile pictures) from Zitadel and display them in the top bar of the admin panels (Navbar and Sidebar). The backend must fetch the avatar data from Zitadel because it is not sent in the JWT or in the existing Zitadel integration flows. We add avatar fetching to the **same flows** we already use for user data (UserInfo and Profile API).

---

## Zitadel Source: `picture` Claim

### What to use

- **OIDC UserInfo endpoint**: `GET ${ZITADEL_ISSUER}/oidc/v1/userinfo` with `Authorization: Bearer <access_token>`
- **Claim**: `picture` – URL of the user’s profile picture (avatar)
- **Docs**: [Claims in ZITADEL](https://zitadel.com/docs/apis/openidoauth/claims), [picture url in claim profile (Discussion #4631)](https://github.com/zitadel/zitadel/discussions/4631)

### Requirements

- Request **`profile`** scope in the OIDC auth request. The frontend already requests `openid profile email` in `frontend/src/lib/zitadel.ts` (`getAuthUrl`), so no change there.
- UserInfo returns `picture` when the user has an avatar set in Zitadel. If not set, the claim is absent.

### Other Zitadel APIs (not used for avatar)

- **User Service v2 `GetUserByID`**: Used by the profile service for email/name. The Human user type in zitadel-go does not expose an avatar URL in the same way; UserInfo `picture` is the standard OIDC mechanism.
- **Management API** (e.g. Delete/Update Human Avatar): Mutations only; we need read.
- **Auth API “Get my user”** (`/users/me`): Could include avatar but uses a different client model. UserInfo is already part of our flows and is sufficient.

---

## Current State

### Backend

- **Auth** (`backend/internal/services/auth/`):
  - Verifies JWT, extracts user from claims.
  - Calls **UserInfo** only when **email is missing** from claims (`ExtractUserInfo` → `fetchUserInfoFromEndpoint` in `zitadel.go`). See `backend/internal/services/auth/zitadel.go` and `service.go`.
  - Stores `user_id`, `user_email`, `user_name`, `user_subject` in Gin context. No avatar.
- **Profile** (`backend/internal/services/profile/`, `handlers/profile.go`):
  - **GetUserProfile** uses Zitadel User Service v2 `GetUserByID` for email/name. See `backend/internal/services/profile/service.go`.
  - **GetProfile** handler merges Zitadel profile with local user and returns `id`, `email`, `name`, etc. No avatar. See `backend/internal/api/handlers/profile.go`.
- **Token**: Auth middleware reads `Authorization: Bearer <token>` and uses it for verification. The same token can be used to call UserInfo.

### Frontend

- **Session** (`frontend/src/contexts/AuthContext.tsx`):
  - `checkSession` calls `getUserInfo(accessToken)` from `frontend/src/lib/zitadel.ts` and builds `session` with `user.id`, `user.email`, `user.name`, etc. **`picture` is not read or stored.**
- **Zitadel client** (`frontend/src/lib/zitadel.ts`):
  - `UserInfo` type has `sub`, `email`, `name`, `given_name`, `family_name`, `preferred_username` and `[key: string]: unknown`. `picture` is not explicitly typed.
  - `getUserInfo` returns the full UserInfo JSON; `picture` could be present but is unused.
- **Navbar** (`frontend/src/components/Navbar.tsx`):
  - Shows `session?.user?.email` (link to `/settings/profile`), NotificationBell, ThemeToggle, Logout. **No user avatar.**
- **Sidebar** (`frontend/src/components/layout/Sidebar.tsx`):
  - Mobile section shows `session?.user?.email` and Logout. **No avatar.**
- **Profile API** (`frontend/src/api/client.ts`):
  - `UserProfile` has `id`, `email`, `name`, `username`, `bio`, `company`, `location`, etc. No `avatar`/`picture`.
- **Settings Profile page** (`frontend/src/pages/Settings/Profile.tsx`):
  - Uses `settingsApi.getProfile()`. Has “Upload a new profile picture” UI; that is separate (e.g. Zitadel upload or future feature). This plan focuses on **displaying** Zitadel avatars.

---

## Implementation Plan

### 1. Backend: Fetch `picture` and add to Profile API flow

We already call Zitadel in two places: (a) UserInfo when email is missing, (b) Profile API via `GetUserByID`. We add **UserInfo** to the **Profile API** flow to obtain `picture`, and expose it as `avatar` in the profile response.

#### 1.1 UserInfo helper (auth package)

- **Reuse** `fetchUserInfoFromEndpoint` in `backend/internal/services/auth/zitadel.go`. It already calls UserInfo with `issuer`, `tokenString`, and `httpClient`.
- **Recommended**: Add an **auth-service method** (e.g. `FetchUserInfo(token string) (map[string]interface{}, error)`) that calls `fetchUserInfoFromEndpoint(s.issuer, token, s.verifier.httpClient)` and returns the parsed JSON. The auth service already has `issuer` and `verifier.httpClient` (see `backend/internal/services/auth/service.go`). The profile handler calls this method; no need to pass issuer or HTTP client from the handler.

#### 1.2 Extract Bearer token in Profile handler

- In **GetProfile** (`backend/internal/api/handlers/profile.go`):
  - Read `Authorization` header, parse `Bearer <token>`. Use `c.Get("auth_method")`; only call UserInfo when `auth_method == "jwt"` (API key / TFE token do not work with Zitadel UserInfo).
  - If JWT and token present, call UserInfo via the auth-service helper, then read `picture` from the returned map.
  - If `picture` is a non-empty string, add it to the response as `avatar` (or `picture`; keep naming consistent with frontend).

#### 1.3 Profile response

- Add `avatar` (or `picture`) to the GetProfile JSON when available. No change to PATCH / profile update; this is read-only.

#### 1.4 Edge cases

- **API key / TFE token**: Skip UserInfo; no avatar. Profile still returns other fields.
- **UserInfo error** (e.g. network, 401): Omit avatar; do not fail the whole GetProfile request.
- **No `picture` in UserInfo**: Omit `avatar` or set to `null`/empty.

### 2. Backend: Optional – expose `picture` in auth flow

- **ExtractUserInfo** already has access to UserInfo when it’s fetched (email fallback). We could additionally extract `picture` there and add it to `UserInfo`.
- **Middleware**: When auth method is JWT, we could store `user_avatar` (or `user_picture`) in context from `ExtractUserInfo`. However, we only fetch UserInfo today when email is missing. **Always** fetching UserInfo just for avatar would add an extra HTTP call to **every** authenticated request, which may be undesirable.
- **Recommendation**: Do **not** change the global auth middleware for avatar. Keep avatar fetching **only in the Profile API** (and optionally in a future “/me” or “session” endpoint). The Navbar can use either (a) session from frontend UserInfo, or (b) Profile API; see below.

### 3. Frontend: Session and UserInfo

- **`frontend/src/lib/zitadel.ts`**:
  - Add `picture?: string` to the `UserInfo` type.
  - `getUserInfo` already returns the full JSON; ensure we use `picture` when building the session.
- **`frontend/src/contexts/AuthContext.tsx`**:
  - In `checkSession`, when building `session.user`, set `picture: userInfo.picture ?? undefined`.
  - Extend the session `user` type to include `picture?: string`.

### 4. Frontend: Profile API and UserProfile

- **`frontend/src/api/client.ts`**:
  - Add `avatar?: string` (or `picture`) to `UserProfile` so it matches the backend GetProfile response.
- **Settings Profile page**: Can later show avatar from `getProfile()` if desired (e.g. next to the upload UI). Not required for the top bar.

### 5. Frontend: Navbar and Sidebar

- **Navbar** (`frontend/src/components/Navbar.tsx`):
  - Where we show `session?.user?.email`, add a **user avatar**:
    - If `session?.user?.picture` is present: `<img src={session.user.picture} alt="" className="..." />` (appropriate size, e.g. `h-8 w-8`, rounded).
    - **Fallback**: Initials from `name` or `email`, or a default user icon (e.g. Lucide `User`).
  - Keep the link to `/settings/profile` (e.g. wrap avatar + email or make both clickable as you prefer).
- **Sidebar** (`frontend/src/components/layout/Sidebar.tsx`):
  - In the mobile user section, similarly show avatar when `session?.user?.picture` exists, with the same fallback.
- **CORS / img src**: If Zitadel’s `picture` URL is cross-origin, `<img src="...">` still works. If it requires `Authorization`, we’d need a backend proxy or a frontend fetch-with-token → blob URL. The plan assumes the URL is either public or same-origin; if not, we handle it in a follow-up.

### 6. Same flow / consistency

- **Profile API**: We already fetch from Zitadel (GetUserByID). We now **also** fetch UserInfo in the same handler when we have a JWT, and add `avatar` from `picture`. Same “get user data from Zitadel” flow, extended with avatar.
- **Frontend session**: We already call UserInfo for session. We now **also** store and use `picture` there. Same “UserInfo → session” flow, extended with avatar.

---

## Implementation Checklist

- [ ] **Backend**
  - [ ] Add auth helper or use `fetchUserInfoFromEndpoint` to fetch UserInfo by token (issuer + httpClient from existing auth setup).
  - [ ] In GetProfile handler: parse Bearer token, call UserInfo only for JWT auth, extract `picture`, add `avatar` to response.
  - [ ] Handle API key / TFE token: no UserInfo call, no avatar.
  - [ ] On UserInfo failure: skip avatar, still return 200 with rest of profile.
- [ ] **Frontend**
  - [ ] Add `picture?: string` to `UserInfo` in `zitadel.ts`; ensure `getUserInfo` result is used including `picture`.
  - [ ] Add `picture?: string` to session `user` in `AuthContext` and set it from `userInfo.picture`.
  - [ ] Add `avatar?: string` to `UserProfile` in `api/client.ts`.
  - [ ] Navbar: render avatar from `session?.user?.picture` with fallback (initials or icon).
  - [ ] Sidebar: same for mobile user section.
- [ ] **Verification**
  - [ ] Log in with a Zitadel user that has an avatar → avatar appears in Navbar (and Sidebar on mobile).
  - [ ] Log in with a user without avatar → fallback (initials or icon) works.
  - [ ] GetProfile returns `avatar` when UserInfo has `picture`; no `avatar` when not.
  - [ ] API key / TFE token auth: no avatar, no errors.

---

## File References

| Area | File |
|------|------|
| UserInfo fetch | `backend/internal/services/auth/zitadel.go` (`fetchUserInfoFromEndpoint`, `ExtractUserInfo`) |
| Auth middleware, issuer | `backend/internal/services/auth/service.go` |
| Profile handler | `backend/internal/api/handlers/profile.go` |
| Profile service (GetUserByID) | `backend/internal/services/profile/service.go` |
| Settings routes | `backend/internal/api/routes/routes.go` (e.g. `settings.GET("/profile", ...)`) |
| Zitadel client, UserInfo | `frontend/src/lib/zitadel.ts` |
| Session, checkSession | `frontend/src/contexts/AuthContext.tsx` |
| UserProfile, getProfile | `frontend/src/api/client.ts` |
| Navbar | `frontend/src/components/Navbar.tsx` |
| Sidebar | `frontend/src/components/layout/Sidebar.tsx` |

---

## Notes

- **Naming**: Use `picture` in UserInfo/session and `avatar` in Profile API if you want to distinguish “OIDC claim” vs “API field”; or use one name consistently. The plan uses `picture` for UserInfo/session and `avatar` for Profile API.
- **Profile page upload**: “Upload a new profile picture” in Settings remains a separate feature (Zitadel or our own). This plan only deals with **displaying** the Zitadel avatar.
- **Picture URL auth**: If Zitadel’s `picture` URL requires a Bearer token, we must either proxy the image via the backend or have the frontend fetch with the token and use a blob URL. That can be added as a follow-up task once we confirm the URL behaviour.
