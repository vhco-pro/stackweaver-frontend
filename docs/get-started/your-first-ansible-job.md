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

As the job runs, you'll see real-time updates in the job output. Each task appears as it executes, with related tasks grouped together for easier navigation. Tasks are color-coded by result:

- **Green**: Task completed successfully
- **Yellow**: Task made changes (modified something)
- **Red**: Task failed

Each task shows timing information so you can see how long it took. Expand any task to see its detailed output, including any stdout or stderr messages from Ansible.

## Step 7: Review the Results

After the job completes:

1. Check the overall status (success, failed, or changed)
2. Review any failed tasks in red
3. Look at the summary showing how many tasks ran, succeeded, and changed
4. Use the raw output tab for full JSON output if needed

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
