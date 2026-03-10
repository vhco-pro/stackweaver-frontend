<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Phase 3: Rollback Mechanism Research

## Question
**Do we need a rollback mechanism when cancelling apply operations, or is Terraform's idempotency sufficient?**

## User's Valid Point
Terraform is idempotent by design. If an apply is cancelled mid-execution:
1. Some resources may have been created/modified
2. Re-running the apply will:
   - Read the current state (including partially applied resources)
   - Compare to desired state
   - Only apply the differences (remaining resources)

**This means re-running should handle partial applies automatically.**

## Potential Edge Cases to Consider

### 1. Resource Dependencies
**Scenario**: Resource B depends on Resource A. Apply is cancelled after A is created but before B.
- **Terraform behavior**: Next apply will create B (A already exists)
- **Risk**: Low - Terraform handles dependencies correctly

### 2. State Inconsistencies
**Scenario**: Partial apply leaves resources in inconsistent state
- **Terraform behavior**: `terraform plan` will show drift, next apply will fix it
- **Risk**: Medium - May require manual intervention in rare cases

### 3. State Locking
**Scenario**: Cancelled apply may leave state lock
- **Terraform behavior**: State locks expire after timeout (default 5 minutes)
- **Risk**: Low - Locks are automatically released

### 4. Provider-Specific Issues
**Scenario**: Some providers may not handle partial applies gracefully
- **Terraform behavior**: Varies by provider
- **Risk**: Low - Most providers are idempotent

## Terraform Enterprise Behavior (Research Findings)

### Answers to Research Questions:

1. **Does TFE implement rollback for cancelled applies?**
   - **Answer**: No, TFE does NOT automatically rollback cancelled applies
   - TFE simply stops the apply operation when cancelled
   - Partial resources remain in infrastructure
   - Users must manually handle partial applies

2. **What does TFE do when an apply is cancelled?**
   - **Answer**: TFE stops the apply operation and marks the run as `canceled`
   - Does NOT automatically rollback
   - Leaves partial state (resources that were created before cancellation remain)
   - No automatic cleanup or rollback mechanism
   - If a run becomes stuck in "applying" state, TFE provides a "force cancel" option

3. **Are there any TFE-specific features for handling partial applies?**
   - **State Versioning**: TFE maintains a history of state versions
   - **Manual State Rollback**: Users can manually roll back to a previous state version via UI or API
   - **No Automatic Rollback**: TFE does not provide automatic rollback for cancelled applies
   - **Manual Process**: Users must manually duplicate a previous state version and set it as current

### Key Finding:
**TFE does NOT provide automatic rollback for cancelled applies. Users must manually roll back using state versioning if they want to revert changes.**

## Current Implementation Plan (Phase 3)

The current plan proposes:
1. **State Rollback**: Restore previous state version from state storage
2. **Automatic Rollback**: Trigger rollback when apply is cancelled

### Concerns with Current Plan:
1. **State Rollback is Risky**: 
   - Restoring old state doesn't actually destroy resources
   - State file and actual infrastructure would be out of sync
   - Would require `terraform refresh` or `terraform apply` to reconcile

2. **Terraform Destroy is Dangerous**:
   - Destroying resources that were created could break dependencies
   - Could destroy resources that were successfully created before cancellation

3. **Refresh-Only Doesn't Rollback**:
   - `terraform apply -refresh-only` only syncs state, doesn't revert changes

## Recommended Approach (Based on Research and User Feedback)

### Option 1: Optional Rollback with User Choice (RECOMMENDED)
**This is a feature that TFE does NOT have - a competitive advantage!**

- **Implementation**: When cancelling an apply, offer two options:
  1. **Cancel Only**: Stop the apply, leave partial resources (matches TFE behavior)
  2. **Cancel with Rollback**: Stop the apply AND automatically rollback to previous state
  
- **Pros**:
  - Gives users control and flexibility
  - Provides a feature TFE doesn't have
  - Leverages Terraform's idempotency for "Cancel Only" option
  - Safe rollback option available when needed
  - Can be disabled/optional per workspace or user preference
  
- **Cons**:
  - More complex implementation (requires state versioning integration)
  - Rollback option requires careful implementation to avoid state inconsistencies

- **User Experience**:
  - When user clicks "Cancel" during apply, show a dialog:
    - "Cancel Apply" button (just stop, leave partial resources)
    - "Cancel and Rollback" button (stop and revert to previous state)
  - Default to "Cancel Apply" (safer, matches TFE behavior)
  - Make rollback option clearly marked as "Advanced" or "Destructive"

### Option 2: No Automatic Rollback (TFE-Compatible)
- **Pros**: 
  - Simple implementation
  - Leverages Terraform's idempotency
  - No risk of breaking infrastructure
  - Matches TFE behavior exactly
- **Cons**:
  - Partial applies remain in infrastructure
  - Requires manual re-run to complete
  - No competitive advantage over TFE

### Option 3: State Versioning + Manual Rollback Only
- **Pros**:
  - Safe (user-initiated)
  - Provides audit trail
  - Matches TFE's manual rollback approach
- **Cons**:
  - Requires manual intervention
  - Doesn't provide automatic rollback option

## Research Tasks

1. [x] Review TFE API documentation for cancellation behavior
   - **Finding**: TFE does NOT automatically rollback cancelled applies
2. [x] Test TFE cancellation behavior (if possible)
   - **Finding**: TFE stops apply and marks as cancelled, leaves partial resources
3. [x] Review Terraform documentation on partial applies
   - **Finding**: Terraform's idempotency handles partial applies on re-run
4. [x] Check if there are any known issues with partial applies
   - **Finding**: State locks expire automatically, most providers handle idempotency well
5. [x] Review community discussions about cancellation and rollback
   - **Finding**: Manual state rollback is the standard approach

## Next Steps

1. [x] **Investigate TFE behavior** - Determine if TFE implements rollback
   - **Result**: TFE does NOT automatically rollback cancelled applies
2. [x] **Test Terraform idempotency** - Verify that re-running handles partial applies correctly
   - **Result**: Terraform's idempotency handles partial applies correctly on re-run
3. [x] **Document findings** - Create decision document based on research
   - **Result**: Research document created with findings
4. [ ] **Update implementation plan** - Modify Phase 3 based on research findings
   - **Action**: Implement optional rollback feature (Cancel Only vs Cancel with Rollback)

## Implementation Plan for Optional Rollback Feature

### Phase 3.1: Cancel Dialog Enhancement
- Add dialog when cancelling apply operations
- Offer two options:
  1. **Cancel Apply** (default): Stop apply, leave partial resources
  2. **Cancel and Rollback**: Stop apply and revert to previous state version

### Phase 3.2: Rollback Implementation
- Before starting apply, save current state version - **Note**: Not needed - the state version is already there in versions. We can just use the last one before the one we are creating in that apply run.
- When "Cancel and Rollback" is selected:
  1. Stop the apply operation (context cancellation)
  2. Load previous state version from state storage
  3. Write previous state to current state
  4. Run `terraform refresh` to sync state with infrastructure
  5. Update run status with rollback information

### Phase 3.3: State Versioning Integration
- Ensure state versions are properly saved before apply
- Implement state version retrieval and restoration
- Add rollback logging and audit trail

### Phase 3.4: UI/UX Polish
- Clear messaging about what each option does
- Warning messages for rollback option
- Progress indicators during rollback
- Success/failure notifications

## References

- [Terraform Enterprise API - Cancel Run](https://developer.hashicorp.com/terraform/enterprise/api-docs/run#cancel-a-run)
- [Terraform State Management](https://developer.hashicorp.com/terraform/language/state)
- [Terraform Idempotency](https://developer.hashicorp.com/terraform/intro#infrastructure-as-code)
