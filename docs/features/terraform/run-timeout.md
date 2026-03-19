# Run Timeout

StackWeaver includes a configurable timeout feature that automatically cancels long-running apply operations to prevent jobs from getting stuck indefinitely.

## Overview

Run timeout is a StackWeaver-specific extension that automatically cancels apply operations that exceed the configured duration. This helps prevent:

- Jobs stuck waiting for resource provisioning
- Unnecessary resource consumption
- Manual intervention to cancel stuck runs

## Default Settings

- **Default Timeout**: 2 hours (7200 seconds)
- **Minimum Recommended**: 30 minutes (1800 seconds)
- **Maximum Recommended**: 24 hours (86400 seconds)

You can configure any value that fits your workflow, though most applies should complete well within the default 2-hour window.

## Configuring Timeout

### Via Web Interface

When creating or editing a workspace:

1. Open workspace settings
2. Find the "Run Timeout" field
3. Enter the timeout value in seconds
4. Save the workspace

### Via API

The timeout can be set when creating or updating a workspace through the API using the `run-timeout` attribute in JSON:API format.

## How It Works

When an apply operation runs longer than the configured timeout:

1. StackWeaver automatically cancels the run
2. The run status is set to `cancelled`
3. Any resources that were already created remain (no automatic rollback)
4. You can review what was completed before cancellation

> [!NOTE]
> Run timeout applies only to apply operations. Plan operations don't have timeouts since they're typically faster and don't modify infrastructure.

## Choosing a Timeout Value

Consider these factors when setting your timeout:

- **Infrastructure complexity**: Larger environments with many resources take longer to apply
- **Provider speed**: Some cloud providers provision resources faster than others
- **Network conditions**: Slow networks can extend apply times
- **Typical apply duration**: Base timeout on your historical apply times with some buffer

Start with the default 2 hours and adjust based on your actual apply durations. If you regularly see applies approaching the timeout, consider increasing it.

## Related Documentation

- [Workspace Editing](./workspace-editing.md) - How to edit workspace settings
- [Run Cancellation](./run-cancellation.md) - Manual run cancellation
