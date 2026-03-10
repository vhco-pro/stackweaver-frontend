<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# tfe_agent_token Compatibility Analysis

**TFE Registry**: https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/agent_token  
**TFE API Docs**: https://developer.hashicorp.com/terraform/cloud-docs/api-docs/agent-tokens  
**Status**: Not Implemented (Analysis Complete)

## TFE Agent Token Model

### Overview

In TFE/HCP Terraform, agent tokens are **pool-scoped authentication tokens** that agents use to authenticate with the platform. They are:

1. **Separate from user/team/org API tokens** - Different token type (`authentication-tokens`)
2. **Scoped to an agent pool** - One token can be shared by all agents in a pool
3. **Shown only once** - Secret cannot be recovered after creation
4. **ID prefix**: `at-` (e.g., `at-bonpPzYqv2bGD7vr`)

### TFE API Endpoints

```
POST   /api/v2/agent-pools/:pool_id/authentication-tokens  # Create token
GET    /api/v2/agent-pools/:pool_id/authentication-tokens  # List tokens for pool
GET    /api/v2/authentication-tokens/:id                    # Show token metadata
DELETE /api/v2/authentication-tokens/:id                    # Destroy token
```

### TFE Data Model

```json
{
  "data": {
    "id": "at-2rG2oYU9JEvfaqji",
    "type": "authentication-tokens",
    "attributes": {
      "created-at": "2020-08-10T22:29:21.907Z",
      "last-used-at": null,
      "description": "production agents",
      "token": "eHub7TsW7fz7LQ.atlasv1.cHGFcvf2..."  // Only on create
    },
    "relationships": {
      "created-by": {
        "data": { "id": "user-xxx", "type": "users" }
      }
    }
  }
}
```

### TFE Authentication Flow

```
1. Admin creates agent token in pool via UI/API
2. Admin deploys agent with TFC_AGENT_TOKEN environment variable
3. Agent uses token for all API calls (heartbeat, job polling, etc.)
4. Multiple agents can share the same pool token
5. To revoke: delete token → all agents using it lose access
```

## Security Comparison

### TFE Model: Pool-Scoped Tokens

**Pros:**
- Simple model: one token per pool, shared by all agents
- Easy to understand and manage
- Fewer tokens to track

**Cons:**
- **Large blast radius**: If token compromised, ALL agents in pool are affected
- **All-or-nothing revocation**: Revoking affects all agents, requires mass re-deployment
- **No per-agent audit trail**: Can't distinguish which agent made a request
- **Token sprawl if many pools**: Each pool needs separate token management

### Current StackWeaver Model: API Keys with Runner Scopes

**Our current implementation uses the existing `api_keys` table with runner-specific scopes.**

**Pros:**
- **Reuses existing infrastructure**: No new token type needed
- **Better audit trail**: Keys are tied to the user who created them
- **Flexible scoping**: Can have org-wide or per-runner scopes
- **Per-runner tokens possible**: Tighter blast radius on compromise

**Cons:**
- More complex than TFE's model
- Runners need to handle two keys (registration key → runner-specific key)
- Different from TFE provider expectations

### Hybrid Approach (Recommended)

We can implement TFE-compatible `tfe_agent_token` while also supporting our more secure per-runner model:

```
Option A: TFE-Compatible Pool Tokens
├── POST /agent-pools/:id/authentication-tokens → Create pool token
├── Agents use pool token (TFC_AGENT_TOKEN / STACKWEAVER_TOKEN)
├── Simple, TFE-compatible
└── Security: Pool-level blast radius

Option B: StackWeaver Enhanced (Per-Runner Tokens)  
├── Agent registers with pool token → gets runner-specific token
├── Runner-specific token used for heartbeat/jobs
├── Tighter security: revoking one runner doesn't affect others
└── Better audit trail per runner
```

## Recommendation

**Implement both:**

1. **TFE-Compatible Layer** (`tfe_agent_token`):
   - Implement `/agent-pools/:id/authentication-tokens` endpoints
   - Create `agent_pool_tokens` table (separate from `api_keys`)
   - Token format: `at-xxx.atlasv1.xxx` or our format `tfe-xxx`
   - Supports `terraform-provider-tfe` resource

2. **Enhanced Security (Optional)**:
   - After registration, generate runner-specific token
   - Runner uses this for subsequent requests
   - Original pool token only needed for registration
   - Can be enabled per-pool via `enhanced_security` flag

## Implementation Plan

### Database Schema

```sql
CREATE TABLE agent_pool_tokens (
    id VARCHAR(20) PRIMARY KEY,  -- at-xxx format
    agent_pool_id UUID NOT NULL REFERENCES agent_pools(id) ON DELETE CASCADE,
    description TEXT,
    token_hash VARCHAR(255) NOT NULL,  -- bcrypt hash
    token_prefix VARCHAR(20) NOT NULL,  -- First chars for display
    created_by_id UUID REFERENCES users(id),
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_agent_pool_tokens_pool (agent_pool_id)
);
```

### API Endpoints

```
POST   /api/v2/agent-pools/:id/authentication-tokens
GET    /api/v2/agent-pools/:id/authentication-tokens
GET    /api/v2/authentication-tokens/:id
DELETE /api/v2/authentication-tokens/:id
```

### Terraform Provider Resource

```hcl
resource "tfe_agent_token" "production" {
  agent_pool_id = tfe_agent_pool.production.id
  description   = "Production agent token"
}

output "agent_token" {
  value     = tfe_agent_token.production.token
  sensitive = true
}
```

## Current State

**Phase 1 (Implemented):**
- Runners can register using existing API keys with `runner:register` scope
- Basic registration/heartbeat/job flow working
- Frontend UI for runner management complete

**Phase 2 (TODO):**
- Implement `tfe_agent_token` resource for TFE provider compatibility
- Create `agent_pool_tokens` table
- Add token management UI in Agent Pools detail page

## References

- [TFE Agent Token API](https://developer.hashicorp.com/terraform/cloud-docs/api-docs/agent-tokens)
- [Install and run agents](https://developer.hashicorp.com/terraform/cloud-docs/agents/agents)
- [go-tfe agent_token.go](https://github.com/hashicorp/go-tfe) (for implementation details)
