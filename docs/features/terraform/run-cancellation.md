---
description: "How to cancel queued, planning, or applying Terraform runs and what happens to partial infrastructure changes"
covers:
  - "backend/cmd/runner/**"
  - "core/queue/**"
---

# Run Cancellation

StackWeaver allows you to cancel runs that are in progress, whether they're still queued, planning, applying infrastructure changes, or waiting on run task stages (external checks at plan/apply boundaries). Cancelling a run that is waiting on run tasks also cancels its outstanding task stages and results, so a late verdict from the external service cannot resurrect it.

## When Can Runs Be Cancelled?

You can cancel runs in the following states:

- **Queued**: Run hasn't started yet
- **Pending**: Run is waiting to start
- **Planning**: Terraform is creating the execution plan
- **Applying**: Terraform is making infrastructure changes

Once a run completes (succeeds, fails, or is cancelled), it can no longer be cancelled.

## Cancelling a Run

To cancel a run:

1. Open the run detail page
2. Click "Cancel" in the run header
3. Confirm the cancellation

The run status will update to `cancelled` and any active operations will be stopped.

## What Happens When You Cancel?

### During Planning

If cancelled during plan phase:

- No infrastructure changes are made
- The plan output up to cancellation is preserved
- You can review what was planned before cancellation

### During Applying

If cancelled during apply phase:

- **Resources already created remain** - there's no automatic rollback
- The apply stops at the point of cancellation
- Run status shows `cancelled` and which resources were successfully created
- You may need to manually clean up partial changes

> [!WARNING]
> Cancelled applies leave infrastructure in whatever state was reached before cancellation. Review the run output to see what was created, and manually clean up if needed.

## Automatic Cancellation

Runs are also automatically cancelled if they exceed the configured [run timeout](./run-timeout.md). This prevents jobs from getting stuck indefinitely.

## Use Cases

Common scenarios for cancelling runs:

- **Wrong configuration**: Realize you're applying to the wrong environment
- **Outdated plan**: New changes were pushed while the run was queued
- **Testing**: Cancel a test run that's taking too long
- **Emergency stop**: Need to immediately stop infrastructure changes

## Related Documentation

- [Run Timeout](./run-timeout.md) - Automatic timeout cancellation
- [Understanding Terraform Runs](../../user-guides/understanding-terraform-runs.md) - How to read run outputs
- [Troubleshooting](../../user-guides/troubleshooting-common-issues.md) - Solutions for common issues
