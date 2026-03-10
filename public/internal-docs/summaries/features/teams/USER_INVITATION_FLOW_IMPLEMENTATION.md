<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# User Invitation Flow Implementation Plan

## Overview

This document outlines the implementation plan for improving the user creation and invitation flow in StackWeaver. The goal is to integrate with Zitadel's Management API to automatically invite users when they are added to an organization, while maintaining the current IDP-centric architecture where Zitadel is the source of truth for user authentication.

## Current State

### Current Flow (Placeholder User Creation)

1. Admin adds user by email in StackWeaver UI
2. StackWeaver creates placeholder user with `zitadel_subject = "invited-{uuid}"`
3. User is added to organization with a role
4. **Issue**: No invitation email is sent - user must be manually created in Zitadel first
5. When user logs in, `GetOrCreateByZitadelSubject()` finds placeholder by email and updates with real subject

### Problems with Current Approach

1. **Manual Step Required**: Admin must manually create user in Zitadel before they can log in
2. **Poor UX**: No invitation email sent - users don't know they've been added
3. **Data Inconsistency Risk**: Placeholder users with `invited-*` subjects may never be claimed
4. **Duplication Risk**: Potential for duplicate users if admin creates in both systems

## Design Goals

1. **IDP-Centric**: Zitadel remains the source of truth for user authentication
2. **Automated Invitation**: Users receive invitation email automatically when added to organization
3. **Seamless Onboarding**: Users can accept invitation, set password, and immediately access StackWeaver
4. **Data Consistency**: Placeholder users are automatically linked to real Zitadel users on first login
5. **Backward Compatible**: Existing placeholder users continue to work

## Proposed Solution: Placeholder + Zitadel Invitation (Option C)

### Flow

1. Admin adds user by email in StackWeaver UI
2. StackWeaver creates placeholder user with `zitadel_subject = "invited-{uuid}"`
3. StackWeaver calls Zitadel Management API to:
   - Create user in Zitadel
   - Send invitation email with activation link
4. User receives email, clicks link, sets password in Zitadel
5. User logs in to StackWeaver → `GetOrCreateByZitadelSubject()` finds placeholder by email and updates with real subject
6. Placeholder user is now linked to real Zitadel user

### Benefits

- ✅ **Clean UX**: Single action (add to org) triggers invitation email
- ✅ **Automated**: No manual steps required
- ✅ **IDP-Centric**: Users are created in Zitadel, not just StackWeaver
- ✅ **Consistent**: Placeholder users are always linked on first login
- ✅ **Fallback**: If Zitadel API call fails, placeholder user still works (user can be manually created)

## Implementation Phases

### Phase 1: Research & Setup

**Status**: 🚧 **IN PROGRESS**

**Tasks**:
1. ✅ Research Zitadel Management API authentication methods
   - Service account setup
   - Personal Access Token (PAT) setup
   - OAuth2 client credentials flow
2. ⏳ Test Zitadel Management API endpoints:
   - `POST /management/v1/users/human` - Create human user
   - `POST /management/v1/users/{userId}/resend/email_verification` - Resend verification email
   - `POST /management/v1/users/{userId}/password_reset` - Reset password (for invitations)
3. ⏳ Determine authentication method for StackWeaver backend:
   - Service account (recommended for production)
   - PAT (for testing/development)
4. ⏳ Configure Zitadel project for Management API access:
   - Create service account or PAT
   - Grant necessary permissions (user creation, email sending)

**Deliverables**:
- ✅ Zitadel Management API research document
- ⏳ Working API authentication setup
- ⏳ Test user creation via API

### Phase 2: Zitadel Management API Client

**Status**: ⏳ **NOT STARTED**

**Tasks**:
1. Create Zitadel Management API client in StackWeaver backend:
   - Location: `backend/internal/services/zitadel/client.go`
   - Support service account and PAT authentication
   - Handle API errors gracefully
2. Implement user creation method:
   - `CreateHumanUser(email, name string) (*User, error)`
   - Creates user with email, sends invitation email
   - Returns Zitadel user ID
3. Implement invitation email method (if separate from creation):
   - `SendInvitationEmail(userID string) error`
   - Resends invitation email for existing users
4. Add configuration for Zitadel Management API:
   - Service account credentials (via environment variables)
   - API endpoint URL
   - Authentication method (service account vs PAT)

**Deliverables**:
- ✅ Zitadel Management API client
- ✅ User creation method
- ✅ Invitation email method
- ✅ Configuration documentation

### Phase 3: Integrate with Membership Creation

**Status**: ⏳ **NOT STARTED**

**Tasks**:
1. Update `OrganizationMembershipHandlerV2.Create()`:
   - After creating placeholder user, call Zitadel API to create user
   - If Zitadel API call succeeds, update placeholder with real `zitadel_subject` (optional - can keep `invited-*` until first login)
   - If Zitadel API call fails, log error but continue (fallback to placeholder)
2. Handle Zitadel API errors gracefully:
   - User already exists in Zitadel → Link placeholder to existing user
   - Email already in use → Return appropriate error to frontend
   - API unavailable → Continue with placeholder user (log warning)
3. Add error handling for invitation failures:
   - Show appropriate error message to admin
   - Suggest manual invitation if API fails

**Deliverables**:
- ✅ Updated membership creation handler
- ✅ Error handling for Zitadel API failures
- ✅ Graceful fallback to placeholder user

### Phase 4: UI Enhancements

**Status**: ⏳ **NOT STARTED**

**Tasks**:
1. Update "Add User" dialog:
   - Show invitation status after adding user
   - Display "Invitation email sent" success message
   - Show error message if invitation fails
2. Add "Pending Invitation" status badge:
   - Show for users with `zitadel_subject` starting with `invited-`
   - Display in organization memberships list
   - Tooltip: "User has been invited but not yet logged in"
3. Add "Resend Invitation" action:
   - Button in user row for pending invitations
   - Calls Zitadel API to resend invitation email
   - Shows success/error toast notification
4. Update user status display:
   - "Active" for users who have logged in
   - "Pending Invitation" for invited users
   - "Invited" badge in UI

**Deliverables**:
- ✅ Updated "Add User" dialog with invitation status
- ✅ "Pending Invitation" status badge in UI
- ✅ "Resend Invitation" functionality
- ✅ Updated user status display

### Phase 5: Testing & Documentation

**Status**: ⏳ **NOT STARTED**

**Tasks**:
1. End-to-end testing:
   - Test user invitation flow
   - Test invitation email delivery
   - Test first login after invitation acceptance
   - Test fallback behavior when Zitadel API is unavailable
   - Test duplicate user handling
2. Error scenario testing:
   - User already exists in Zitadel
   - Email already in use
   - Invalid email format
   - Zitadel API unavailable
3. Documentation:
   - Update user management documentation
   - Document Zitadel Management API setup
   - Document invitation flow
   - Document fallback behavior

**Deliverables**:
- ✅ Test coverage for invitation flow
- ✅ Error scenario test coverage
- ✅ Updated documentation

## Technical Details

### Zitadel Management API Authentication

**Option 1: Service Account (Recommended for Production)**
- Create service account in Zitadel project
- Grant `user:write` permission
- Use service account credentials for API authentication
- More secure, can be rotated via Zitadel UI

**Option 2: Personal Access Token (PAT) (For Development/Testing)**
- Generate PAT in Zitadel user settings
- Store in environment variable
- Simpler setup, less secure
- Useful for development and testing

### API Endpoints

**Create Human User**:
```
POST /management/v1/users/human
{
  "userName": "user@example.com",
  "email": {
    "email": "user@example.com",
    "isEmailVerified": false
  },
  "profile": {
    "firstName": "John",
    "lastName": "Doe"
  },
  "password": {
    "changeRequired": true,
    "hashedPassword": null // Let Zitadel generate password reset token
  }
}
```

**Send Invitation Email** (if separate):
```
POST /management/v1/users/{userId}/resend/email_verification
```

**Reset Password** (alternative invitation method):
```
POST /management/v1/users/{userId}/password_reset
{
  "sendLink": true,
  "urlTemplate": "https://stackweaver.example.com/auth/callback?userId={userId}"
}
```

### Error Handling

**User Already Exists**:
- Check if user exists by email before creating
- If exists, link placeholder to existing user's `zitadel_subject`
- Skip invitation email (user already has account)

**Email Already in Use**:
- Zitadel returns error indicating email conflict
- Return 409 Conflict to frontend
- Show error message: "User with this email already exists"

**API Unavailable**:
- Log warning and continue with placeholder user
- Show warning message to admin (optional)
- Admin can manually create user in Zitadel later

### Database Considerations

**Placeholder Users**:
- Keep `invited-*` prefix in `zitadel_subject` until first login
- On first login, `GetOrCreateByZitadelSubject()` updates with real subject
- Placeholder users that are never claimed can be cleaned up periodically (future task)

**User Status Tracking**:
- Consider adding `status` field to `users` table:
  - `active`: User has logged in at least once
  - `invited`: User has been invited but not yet logged in
  - `pending`: Placeholder user created but invitation not sent (fallback)
- Alternatively, check `zitadel_subject` prefix: `invited-*` = invited, real subject = active

## Known Issues / Future Work

### Current Limitations

1. **No Cleanup Mechanism**: Placeholder users that are never claimed remain in database
   - **Future**: Add periodic cleanup job for unclaimed invitations (e.g., after 30 days)
2. **No Invitation Expiry**: Invitations don't expire automatically
   - **Future**: Add expiry date tracking and automatic expiration
3. **No Bulk Invitations**: Must invite users one at a time
   - **Future**: Add bulk invitation support

### Future Enhancements

1. **Custom Invitation Email Template**: Allow admins to customize invitation email content
2. **Invitation Link Customization**: Customize invitation link to include organization context
3. **Invitation Analytics**: Track invitation acceptance rates
4. **Re-invitation Reminders**: Automatically remind users who haven't accepted invitations

## References

- Zitadel Management API Documentation: https://zitadel.com/docs/apis/resources/mgmt
- Zitadel User Management: https://zitadel.com/docs/guides/integrate/user-management
- Current User Creation Flow: `docs/architecture/USER_CREATION_FLOW_SITREP.md`

## Migration Notes

### For Existing Placeholder Users

Existing placeholder users with `invited-*` subjects will continue to work:
1. When they log in, `GetOrCreateByZitadelSubject()` will find them by email
2. Their `zitadel_subject` will be updated with the real subject
3. No manual intervention required

### For New Users

New users added after implementation will:
1. Receive invitation email automatically
2. Set password in Zitadel
3. Log in to StackWeaver seamlessly

## Timeline Estimate

- **Phase 1**: 2-3 days (research, setup, testing)
- **Phase 2**: 3-5 days (API client implementation)
- **Phase 3**: 2-3 days (integration)
- **Phase 4**: 3-4 days (UI enhancements)
- **Phase 5**: 2-3 days (testing, documentation)

**Total**: ~12-18 days

## Priority

**Priority**: 🟡 **MEDIUM**

This is not blocking the current teams feature, but will significantly improve user onboarding experience. Recommended to implement after teams feature is merged to main.
