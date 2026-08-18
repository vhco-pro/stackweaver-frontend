---
description: "Real-time OpenTofu plan and apply output streaming with persistent log storage"
covers:
  - "backend/cmd/runner/**"
  - "core/queue/**"
---

# Run Output Streaming

StackWeaver provides real-time, live streaming of OpenTofu output during plan and apply operations. Watch your infrastructure changes happen in real time without waiting for the entire operation to complete.

## Overview

Running the CLI directly shows output only after a command completes. StackWeaver streams output line-by-line as OpenTofu executes, giving you immediate visibility into what's happening during long-running operations.

## How It Works

When you start a run (plan or apply), StackWeaver:

1. **Streams Output in Real Time**: Each line of OpenTofu output appears in the UI as soon as OpenTofu produces it
2. **Captures All Output**: Both stdout and stderr are captured and streamed to your browser
3. **Preserves Complete Logs**: All output is saved for later review, even after the run completes

## Benefits

- **Faster Feedback**: See what Terraform is doing immediately, not just when it finishes
- **Early Problem Detection**: Spot issues as they occur rather than waiting for the operation to fail
- **Better Visibility**: Monitor long-running applies without wondering if the system is working
- **Debugging**: Real-time output makes it easier to understand what's happening during complex operations

## During Plan Operations

When running `terraform plan`, you'll see:

- Resource refresh status as Terraform queries providers
- Plan calculations as Terraform determines what changes are needed
- Resource count summaries (add, change, destroy)
- Any warnings or errors as they're detected

The streaming output appears in the run detail view, updating automatically as new output arrives.

## During Apply Operations

During `terraform apply`, streaming provides:

- Resource creation progress as providers provision infrastructure
- Real-time status updates for each resource being modified
- Provider logs and diagnostic information
- Error messages immediately when something fails

This is especially valuable for long-running applies where resources take time to provision.

## Using Streaming Output

Streaming output is **automatic** - no configuration needed. When viewing a run in progress:

1. Open the run detail page
2. The output panel automatically updates as new output arrives
3. Output scrolls automatically, keeping you on the latest information
4. You can manually scroll up to review earlier output

## Output Persistence

All streamed output is saved permanently:

- **During Execution**: Output is streamed incrementally to the run detail page, which fetches the bytes it has not seen yet every couple of seconds
- **After Completion**: Complete logs are stored in object storage for long-term access
- **Review Later**: You can view the complete output history for any run, even days or weeks later

## Technical Details

The runner captures Terraform's stdout and stderr line by line and appends each line to a short-lived log buffer as it is produced. The run detail page polls the run-log endpoint every two seconds and requests only the bytes it has not seen yet, so output appears incrementally while the run is still executing.

This means output appears within a couple of seconds of Terraform producing it, rather than only after the command finishes.

## Related Documentation

- [Understanding Terraform Runs](../../user-guides/understanding-terraform-runs.md) - Learn how to read run outputs
- [Run Cancellation](./run-cancellation.md) - Cancel runs while they're streaming
- [Workspace Editing](./workspace-editing.md) - Workspace configuration and management
