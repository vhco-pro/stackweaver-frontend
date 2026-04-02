---
description: "Real-time Terraform plan and apply output streaming via SSE with persistent log storage"
covers:
  - "backend/cmd/runner/**"
  - "core/queue/**"
---

# Terraform Output Streaming

StackWeaver provides real-time, live streaming of Terraform output during plan and apply operations. Watch your infrastructure changes happen in real time without waiting for the entire operation to complete.

## Overview

Traditional Terraform execution shows output only after a command completes. StackWeaver streams output line-by-line as Terraform executes, giving you immediate visibility into what's happening during long-running operations.

## How It Works

When you start a Terraform run (plan or apply), StackWeaver:

1. **Streams Output in Real Time**: Each line of Terraform output appears in the UI as soon as Terraform produces it
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

- **During Execution**: Output streams live via Server-Sent Events (SSE)
- **After Completion**: Complete logs are stored in object storage for long-term access
- **Review Later**: You can view the complete output history for any run, even days or weeks later

## Technical Details

StackWeaver uses Server-Sent Events (SSE) to push output updates to your browser in real time. The backend captures Terraform's stdout and stderr streams and immediately forwards each line to connected clients.

This means you get output as fast as Terraform produces it, with minimal latency between Terraform execution and what you see in the UI.

## Related Documentation

- [Understanding Terraform Runs](../../user-guides/understanding-terraform-runs.md) - Learn how to read run outputs
- [Run Cancellation](./run-cancellation.md) - Cancel runs while they're streaming
- [Workspace Editing](./workspace-editing.md) - Workspace configuration and management
