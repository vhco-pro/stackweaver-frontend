---
description: "Step-by-step tutorial for creating an Ansible inventory, credentials, job template, and running a job"
covers:
  - "frontend/src/pages/Ansible/**"
---

# Your First Ansible Job

Get started with Ansible automation in StackWeaver. This guide walks you through creating your first playbook, inventory, and running a job.

## What You'll Need

- A StackWeaver account and organization
- A GitHub repository with Ansible playbooks (or we'll create a simple one)
- SSH access to at least one target server (or use localhost for testing)
- Basic understanding of Ansible concepts

## Step 1: Create an Inventory

Inventories tell Ansible which servers to manage.

### Option A: Static Inventory (Quickest for Testing)

Navigate to your organization's Ansible section and click "New Inventory". Choose "Static" as the type and give it a name like "my-servers". 

Enter your server details in INI format. For a single server, use `server1 ansible_host=192.168.1.100`. For multiple servers, group them like this:

```ini
[web]
web1 ansible_host=192.168.1.10
web2 ansible_host=192.168.1.11

[db]
db1 ansible_host=192.168.1.20
```

Groups let you target specific sets of servers in your playbooks. Once you've entered your servers, save the inventory.

### Option B: VCS-Synced Inventory

If you keep your inventory in a GitHub repository, choose "VCS" instead of "Static" when creating the inventory. Select your GitHub connection, then pick the repository and file path where your inventory lives. Choose the branch you want to use (usually `main` or `master`).

This approach keeps your inventory automatically synced with your repository, any changes you push to GitHub will be reflected in StackWeaver. This is especially useful for teams that version control their infrastructure.

## Step 2: Set Up Credentials

Ansible needs credentials to connect to your servers. StackWeaver securely stores and encrypts these credentials at rest, so only users with access to your organization can use them.

Go to the Credentials section and click "New Credential". Choose the credential type that matches your setup:

| Credential Type | When to Use |
|----------------|-------------|
| **SSH Key** | Key-based authentication (recommended for most cases) |
| **Username/Password** | Password authentication (less secure but sometimes needed) |
| **Cloud credentials** | For AWS, Azure, GCP cloud provider authentication |

Enter your credentials and give it a descriptive name like "production-ssh-keys" or "aws-east-credentials". This makes it easier to select the right credential when creating job templates.

> [!IMPORTANT]
> Credentials are encrypted at rest. Only users with access to your organization can view or use them.

## Step 3: Connect Your Playbook Repository

If you haven't already, connect the repository containing your Ansible playbooks:

1. Ensure your GitHub connection is set up in VCS settings
2. The repository should contain your `.yml` or `.yaml` playbook files

When you create the playbook, you also choose its **Source**. In the default cached mode, StackWeaver runs from a snapshot of the playbook and its dependencies that it captures when the playbook syncs, so the playbook keeps running even if its repository is temporarily unreachable at job time. The first run with no snapshot yet syncs one automatically and then runs from it. Choose the fresh option instead if you want every run to clone the latest commit from the repository at runtime. You can change the source at any time on the playbook form, and trigger a sync manually to refresh the cached snapshot.

## Step 4: Create a Job Template

Job templates define how jobs should run - which playbook, inventory, and credentials to use. This lets you save common configurations and reuse them, rather than entering the same settings every time.

Go to Job Templates and click "New Job Template". Fill in the required details:

| Field | Description |
|-------|-------------|
| **Name** | Something descriptive like "deploy-web-app" or "backup-databases" |
| **Playbook** | Select your playbook from the VCS repository |
| **Inventory** | Choose the inventory you created earlier |
| **Credentials** | Select the credential(s) needed to connect to servers |
| **Verbosity** | Start with 0 (normal output), increase for more debugging detail |

You can also set optional settings like forks (how many servers to run on simultaneously), timeout (maximum job runtime), or extra variables to pass to the playbook. Once configured, save the template and it's ready to use.

## Step 5: Run Your First Job

Now let's execute the job:

1. Open your job template
2. Click "Launch Job"
3. Review the settings (you can override inventory, credentials, or variables here)
4. Click "Launch"

The job will start running and you'll see live output.

## Step 6: Watch the Job Run

As the job runs, you'll see real-time updates. The **Run** tab opens by default and lays the run out as a grid: one row per host, one column per task, and one cell per result, filling in as hosts report back. Each cell carries both a colour and a glyph, so results stay readable at a glance:

- **Green check**: Task completed successfully
- **Amber refresh**: Task made changes (modified something)
- **Red alert**: Task failed
- **Magenta bolt**: Host was unreachable
- **Cyan ban**: Task was skipped on that host
- **Faint dot**: Task did not run on that host

These are the same icons and colours the job list and a template's run history use, so a result looks the same wherever you meet it. The colours follow Ansible's own terminal output, where changed is yellow and skipped is cyan.

Every task column header shows how long that task took and how its hosts came out, so a single failing host inside an otherwise successful task is visible without scrolling. Clicking a cell opens the full result for that host and task - the module that ran, the file and line it came from, its message, output, and any diff it made. Clicking a host name shows everything that ran on that host in order, and clicking a task column shows how the whole fleet fared on that task.

The same run has two other views, switched with the Matrix / Timeline / Stream buttons. **Timeline** puts each task on the job clock, which answers where a slow run spent its time. **Stream** is the run as chronological terminal-style lines, each one expandable to the raw event behind it; anything the viewer cannot interpret shows up there verbatim, so nothing the runner printed is ever lost. Its **Raw** toggle swaps those lines for the runner's own output, unmodified, still filtered and searchable.

The status strip above the grid reads out how the fleet came out; the legend beneath it doubles as the filter, so pressing a status narrows every view to it. The search box matches host names, task names, and the full result of every task, so searching for the text of an error finds the hosts that hit it. Press `/` to jump to the search box. Task names are shortened to keep the whole run on screen; drag a column's right edge when you want to read one in full, and double-click that edge to put it back.

## Step 7: Review the Results

After the job completes:

1. Check the overall status (success, failed, or changed)
2. Scan the Run grid for red or magenta cells to see exactly which hosts and tasks went wrong
3. Look at the summary showing how many tasks ran, succeeded, and changed
4. Switch to Stream and expand a line for the raw event behind it, or copy the job's whole raw output with the button beside the search box

## Troubleshooting Your First Job

**Job failed with "host unreachable"**  
- Check your inventory host addresses
- Verify SSH credentials are correct
- Ensure the target server allows SSH connections

**Job failed with "permission denied"**  
- Check that the SSH user has the right permissions
- For sudo tasks, ensure the user can run sudo commands
- Review the credential configuration

**Can't find the playbook file**  
- Verify the playbook path matches your repository structure
- Check that you've selected the correct branch
- Ensure the file is a valid YAML playbook

## What's Next?

- Explore [Ansible Documentation](../features/ansible/README.md) for complete Ansible integration documentation
- Set up [VCS sync for playbooks](../features/ansible-playbook-webhook-sync.md) to automatically sync playbooks from your repository
