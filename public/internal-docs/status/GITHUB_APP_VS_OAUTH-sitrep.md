<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# GitHub App vs OAuth App: Why We Need GitHub Apps

## The Problem with Current Implementation

**Current Implementation: GitHub OAuth App** ❌
- Requires platform owner to manually create an OAuth App in GitHub
- Requires manual configuration (CLIENT_ID, CLIENT_SECRET in environment variables)
- All users authorize the same OAuth App
- **NOT self-service** - users can't connect their own GitHub accounts without admin setup
- This is what's causing the error you're seeing

## What Terraform Enterprise Uses

**Terraform Enterprise: GitHub App** ✅
- Platform owner creates **ONE GitHub App** (one-time setup)
- Users can **install the app on their own organizations** (self-service)
- No manual configuration needed per user
- Better permissions model (granular permissions per installation)
- Perfect for multi-tenant scenarios

## Key Differences

### GitHub OAuth App (Current - Wrong Approach)
```
1. Platform owner creates OAuth App in GitHub
2. Platform owner configures CLIENT_ID/SECRET in environment
3. User clicks "Connect GitHub"
4. User authorizes the OAuth App
5. Platform gets access token for that user
```

**Problems:**
- Requires admin to set up OAuth App
- All users share the same OAuth App
- Not scalable for self-service

### GitHub App (Terraform Enterprise Approach - What We Need)
```
1. Platform owner creates ONE GitHub App (one-time)
2. User clicks "Connect GitHub"
3. User is redirected to GitHub App installation page
4. User chooses which org/repos to install the app on
5. GitHub sends webhook with installation details
6. Platform stores installation ID and generates installation tokens
```

**Benefits:**
- ✅ Self-service - users install on their own orgs
- ✅ Better permissions - per-installation granularity
- ✅ Scalable - no per-user configuration
- ✅ Industry standard (Terraform Enterprise, GitHub Actions, etc.)

## What We Need to Implement

### 1. Create GitHub App (One-Time Setup)
- Platform owner creates GitHub App at https://github.com/settings/apps/new
- Configure webhook URL for installation events
- Set required permissions (repo, admin:repo_hook, etc.)
- Get App ID and Private Key

### 2. GitHub App Installation Flow
- User clicks "Connect GitHub"
- Redirect to GitHub App installation page: `https://github.com/apps/{app-name}/installations/new`
- User selects organization/repositories
- GitHub redirects to webhook with installation event
- Platform stores installation ID
- Platform generates installation tokens using App ID + Private Key

### 3. Using Installation Tokens
- For each API call, generate installation token (JWT signed with private key)
- Token is scoped to the specific installation
- Tokens expire after 1 hour (GitHub requirement)
- Regenerate tokens as needed

## Implementation Plan

### Phase 1: GitHub App Setup
1. Create GitHub App (manual one-time setup)
2. Store App ID and Private Key securely
3. Configure webhook endpoint for installation events

### Phase 2: Installation Flow
1. Update frontend to redirect to GitHub App installation
2. Handle installation webhook events
3. Store installation IDs in database
4. Generate installation tokens for API calls

### Phase 3: Token Management
1. Implement JWT signing for installation tokens
2. Cache tokens (they're valid for 1 hour)
3. Auto-refresh expired tokens

## Current Status

✅ **GitHub App Integration** - Fully implemented and in use
- App installation flow working
- Repository listing and selection
- Branch listing and selection
- Token generation for API access
- Used by both Terraform workspaces and Ansible playbooks

## Future VCS Providers

### GitLab Integration (Planned)
GitLab supports a similar App model via [GitLab OAuth Applications](https://docs.gitlab.com/ee/integration/oauth_provider.html) and [GitLab Group Access Tokens](https://docs.gitlab.com/ee/user/group/settings/group_access_tokens.html).

**Approach:**
- Create GitLab OAuth Application for StackWeaver
- Use OAuth 2.0 flow for user authorization
- Store refresh tokens for long-lived access
- Similar UI pattern to GitHub (select connection → repository → branch)

### Bitbucket Integration (Planned)
Bitbucket supports [Bitbucket Apps](https://developer.atlassian.com/cloud/bitbucket/bitbucket-apps/) for workspace integrations.

**Approach:**
- Create Bitbucket App with repository read permissions
- OAuth 2.0 flow for workspace authorization
- Access to repositories via Bitbucket REST API
- Same unified UI experience

### Implementation Priority
1. GitHub (✅ Done) - Most common, already working
2. GitLab - Popular for enterprise/self-hosted
3. Bitbucket - Common in Atlassian shops

## References

- [GitHub Apps Documentation](https://docs.github.com/en/apps)
- [GitHub App Installation Flow](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/installing-github-apps)
- [Terraform Enterprise VCS Integration](https://developer.hashicorp.com/terraform/cloud-docs/vcs)
- [GitLab OAuth Provider](https://docs.gitlab.com/ee/integration/oauth_provider.html)
- [Bitbucket Apps](https://developer.atlassian.com/cloud/bitbucket/bitbucket-apps/)


