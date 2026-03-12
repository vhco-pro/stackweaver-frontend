# Troubleshooting Common Issues

Solutions for the most frequent problems and questions when using StackWeaver.

## Terraform Issues

### Workspace Won't Start a Run

**Symptoms**: Run stays queued or fails immediately without running Terraform.

**Possible causes and solutions:**

- **VCS connection issue**: Verify your GitHub connection is active in organization settings. Try disconnecting and reconnecting.
- **Repository access**: Ensure StackWeaver has access to the repository. Check repository permissions in GitHub.
- **Working directory**: If your Terraform files aren't in the repo root, verify the working directory path is correct.
- **Runner unavailable**: Check if there are any runner issues. Check `docker compose -f deploy/docker-compose.yml logs runner` for errors. If runs consistently fail to start, review the orchestrator logs as well.

### Plan Shows Unexpected Changes

**Symptoms**: Plan indicates resources will be destroyed or recreated when you didn't change anything.

**This usually means:**

- **State drift**: Infrastructure was changed outside Terraform (manually or by another tool)
- **Provider version change**: Provider behavior changed between versions
- **Code sync issue**: Workspace is using a different branch or commit than expected

**To fix:**

1. Review the plan carefully - are the changes actually needed?
2. Check the configuration version shown in the run metadata
3. If state drifted, consider refreshing or importing the current state
4. Compare to your last successful run to see what changed

### Apply Fails with Provider Error

**Symptoms**: Run fails with errors like "authentication failed" or "resource not found".

**Common solutions:**

- **Check credentials**: Verify your cloud provider credentials are correct and not expired
- **Review permissions**: Ensure the credentials have sufficient permissions for the resources you're creating
- **Provider version**: Try pinning your provider version if using latest
- **Region/endpoint**: Verify you're using the correct region and API endpoints

### State Lock Errors

**Symptoms**: Error message about state being locked by another run.

**What's happening:**

Terraform locks state during runs to prevent concurrent modifications. This error means another run is already using the state.

**To resolve:**

- Wait for the other run to complete (usually just a few minutes)
- If the lock persists, check if a run is stuck and cancel it
- In rare cases, you may need to manually unlock (be very careful with this)

> [!WARNING]
> Never force-unlock state unless you're certain no other operations are running. This can corrupt state.

## Ansible Issues

### Job Fails: Host Unreachable

**Symptoms**: Job fails immediately with connection errors.

**Check these:**

1. **Inventory addresses**: Verify host IPs or hostnames are correct in your inventory
2. **Network access**: Ensure StackWeaver runners can reach your target servers
3. **SSH configuration**: Check that SSH ports (usually 22) are open
4. **Credentials**: Verify SSH keys or passwords are correct in your credentials

**For private networks:**

If your servers aren't publicly accessible, you'll need to use self-hosted runners that have network access to your infrastructure.

### Job Hangs or Times Out

**Symptoms**: Job runs for a long time then fails with a timeout.

**Possible causes:**

- **Network issues**: Slow or unreliable connection to target servers
- **Task complexity**: Individual tasks taking longer than expected
- **Resource constraints**: Servers under heavy load responding slowly

**Solutions:**

1. Increase the job timeout in your job template settings
2. Reduce the number of forks (parallel execution) to avoid overwhelming servers
3. Break large playbooks into smaller, focused playbooks
4. Add task timeouts in your Ansible playbooks for individual tasks

### Playbook File Not Found

**Symptoms**: Error when trying to select a playbook in job template.

**Verify:**

- **File path**: The path should be relative to your repository root
- **File extension**: Playbooks should be `.yml` or `.yaml`
- **Repository branch**: Ensure you're looking at the correct branch
- **VCS connection**: Confirm the repository is connected and accessible

### Credential Permission Errors

**Symptoms**: Job runs but tasks fail with "permission denied" or sudo errors.

**Check:**

- **SSH user permissions**: The SSH user needs appropriate permissions
- **Sudo configuration**: For tasks requiring sudo, verify the user can run sudo commands
- **Become method**: If using become/privilege escalation, check the become method in your playbook
- **File permissions**: Ensure SSH keys have correct permissions (should be 600)

## General Issues

### Can't Access Organization or Workspace

**Symptoms**: Getting "access denied" or "not found" errors.

**This is usually a permissions issue:**

1. **Check team membership**: Verify you're a member of the organization
2. **Review workspace access**: Ensure your team has access to the workspace (if using teams)
3. **Organization role**: Check your role in the organization (owner, member, etc.)
4. **Contact admin**: If you should have access, ask an organization owner to verify your permissions

### VCS Webhook Not Triggering

**Symptoms**: Pull requests or pushes don't automatically trigger runs.

**Troubleshooting steps:**

1. **Webhook configuration**: Verify webhooks are set up in your VCS provider (GitHub, etc.)
2. **Repository permissions**: Ensure StackWeaver app has webhook permissions
3. **Webhook events**: Check that the right events are enabled (pull requests, pushes, etc.)
4. **Webhook URL**: Verify the webhook URL is correct in your VCS settings
5. **Check webhook logs**: Review webhook delivery logs in your VCS provider

### Dashboard Shows Wrong Counts

**Symptoms**: Dashboard metrics don't match what you see in workspaces or projects.

**Common causes:**

- **Timing**: Dashboard data is fetched live from the API. Try refreshing the page.
- **Filter scope**: Check if filters are applied that might exclude some resources
- **Permission filtering**: Dashboard only shows resources you have access to

### Imported State Missing Resources

**Symptoms**: After importing state, some resources don't appear or state seems incomplete.

**Check:**

- **Import completeness**: Ensure all resources were successfully imported
- **State version**: Verify you're looking at the correct state version
- **Workspace connection**: Confirm the imported state matches the workspace configuration
- **Resource names**: Check that resource names in state match your Terraform code

## Getting More Help

If you're still stuck:

1. **Check the error details**: Expand failed resources or tasks to see detailed error messages
2. **Review raw output**: Switch to raw output tab for full logs and stack traces
3. **Compare to working runs**: See what changed between successful and failed runs
4. **Search documentation**: Check other guides for related topics
5. **Open an issue**: If the issue persists, [open a GitHub issue](https://github.com/vhco-pro/stackweaver/issues) with:
   - Error messages
   - Relevant run IDs
   - Steps to reproduce
   - What you've already tried

## Reporting Issues

When reporting problems, include:

- What you were trying to do
- What actually happened
- Error messages (full text, not just screenshots)
- Run IDs or workspace names
- Steps to reproduce
- Any relevant configuration (workspace settings, job template settings, etc.)

This information helps us diagnose and fix issues faster.
