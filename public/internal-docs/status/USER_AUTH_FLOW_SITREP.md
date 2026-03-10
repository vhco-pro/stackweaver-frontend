<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# User Authentication Flow Situation Report

**Date**: 2024-12-XX  
**Last Updated**: 2026-01-12  
**Status**: ✅ **RESOLVED** - Bug fixed in user creation flow

> **Note**: This document describes a bug that was identified and fixed. The issue has been resolved. Kept for historical reference.

## Problem Summary

When a user is added to an organization via TFE provider (terraform-provider-tfe), a placeholder user is created with:
- `ZitadelSubject: "invited-{uuid}"` (temporary)
- `Email: "user@example.com"`

When the user logs in for the first time:
1. `GetOrCreateByZitadelSubject` is called with the real Zitadel subject from JWT
2. It finds the placeholder user by email
3. **BUG**: It doesn't update the ZitadelSubject because it's not empty (it's "invited-{uuid}")
4. User record has mismatched ZitadelSubject
5. Subsequent authentications may fail

## Root Cause

**Location**: `backend/internal/repository/user.go:86-98`

The `GetOrCreateByZitadelSubject` function has this logic:
```go
if user.ZitadelSubject == "" {
    user.ZitadelSubject = subject
}
```

This only updates the subject if it's empty, but placeholder users have `ZitadelSubject = "invited-{uuid}"`, so it never gets updated to the real Zitadel subject.

## Additional Issues

1. **User Creation Error**: When a user logs in and their email doesn't match any existing user (or the email lookup fails), the function tries to create a new user. If the email is empty in the JWT token, this may fail.

2. **Organization Listing**: The organization listing endpoint (`GET /api/v2/organizations`) now uses `ListByUser()` which filters by organization membership. This should work correctly, but needs verification after the user creation bug is fixed.

## Fix Required

1. Update `GetOrCreateByZitadelSubject` to handle placeholder users (users with `ZitadelSubject` starting with "invited-")
2. When a placeholder user is found by email, update the `ZitadelSubject` to the real one, not just if it's empty
3. Ensure error handling is robust for edge cases (empty email, etc.)

## Current State

- ✅ Organization listing filters by user membership (fixed in previous commit)
- ✅ Organization deletion requires permission (fixed in previous commit)
- 🔴 **User authentication failing** - placeholder users not being updated correctly
- ⚠️ User visibility - users added via TFE provider may not see organizations until they log in and their user record is fixed

## Testing Checklist

After fix:
- [ ] New user can log in after being added via TFE provider
- [ ] Placeholder user's ZitadelSubject gets updated on first login
- [ ] User can see organizations they're a member of
- [ ] User can create organizations (if they have permission)
- [ ] Activities endpoint works for authenticated users
