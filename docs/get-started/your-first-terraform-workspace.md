---
description: "Step-by-step tutorial for creating a Terraform workspace and running a plan"
covers:
  - "frontend/src/pages/Workspaces.tsx"
  - "frontend/src/pages/WorkspaceDetail.tsx"
  - "frontend/src/pages/RunDetail.tsx"
---

# Your First Terraform Workspace

Learn how to create and run your first Terraform workspace in StackWeaver. By the end of this guide, you'll have successfully executed a plan and understand the basics of workspace management.

## What You'll Need

Before you start, make sure you have:

| Requirement | Description |
|------------|-------------|
| **StackWeaver account** | Sign up if you haven't already |
| **Organization access** | Create an organization or get access to an existing one |
| **GitHub repository** | A repository containing Terraform code (we'll use this for your workspace) |
| **Terraform basics** | Basic understanding of Terraform concepts helps but isn't required |

## Step 1: Create an Organization

> [!NOTE]
> If you already have an organization, you can skip this step.

When you first sign in, you'll need to create an organization. Organizations help you group related projects and control access.

1. Click "Create Organization" from the dashboard
2. Give it a name (like "my-company" or "my-department")
3. Optionally add a description
4. Click "Create"

## Step 2: Create a Project (Optional but Recommended)

Projects help you organize workspaces. For example, you might have separate projects for team A or team B

1. Navigate to your organization
2. Click "New Project"
3. Give it a name like "getting-started"
4. Create the project

## Step 3: Connect to GitHub

Before creating a workspace, you'll need to connect StackWeaver to your GitHub account.

1. Go to your organization's VCS settings
2. Click "Connect GitHub"
3. Authorize StackWeaver to access your repositories
4. Select the repositories you want to use (or allow access to all)

> [!TIP]
> You can always change repository access later in your organization settings.

## Step 4: Create Your Workspace

> [!IMPORTANT] GitOps Strategy
> Stackweaver is build around the core gitops concepts. When modeling your git repos you should take into account some pointers that will make your life easier
> 1. Folder per environment, no need to split up environments across repositories - just use the working directory feature, this way you can have 1 repo with several environments organised in their respective subdirectory

Now for the main event - creating your workspace.

1. Navigate to your organization and project
2. Click "New Workspace"
3. Give it a name (like "example-infrastructure")
4. Select your GitHub repository
5. Choose the branch (usually "main" or "master")
6. Set the working directory (leave blank if Terraform is in the repo root)
7. Add a description if helpful

The workspace will be created and ready to use.

## Step 5: Configure Variables (If Needed)

If your Terraform code needs variables, you'll need to set them up.

1. Open your workspace
2. Go to the "Variables" tab
3. Add any required variables
4. Mark sensitive variables as such (they'll be encrypted)

## Step 6: Run Your First Plan

Time to see Terraform in action. In your workspace, click "Queue Plan" and choose your run reason. For testing, select "Testing" from the dropdown. Click "Queue Plan" to start the run.

You'll see the plan run start and watch as Terraform analyzes your code. The output shows what Terraform plans to create, modify, or destroy; giving you a preview of changes before you apply them.

## Step 7: Review the Plan

Once the plan completes, review the resource changes shown in the plan output. Each resource appears as a card showing what will be created (marked with `+`), modified (`~`), or destroyed (`-`). Check for any errors or warnings - errors will prevent the apply from running, while warnings are issues that won't block the run but might cause problems.

Expand any resource card to see detailed attribute changes. If you need more detail, switch to the "Raw Output" tab to see the full Terraform terminal output or structured JSON.

> [!IMPORTANT]
> Plans show what *would* happen. Nothing is actually created until you run an apply.

## Step 8: Apply Your Changes (Optional)

If you're satisfied with the plan:

1. Click "Confirm and Apply"
2. Review the confirmation dialog
3. Click "Apply"

The apply will run and show real-time progress as resources are created or modified.

## What's Next?

Now that you've run your first workspace:

- Learn about [managing workspace variables](../user-guides/managing-workspace-variables.md)
- Read about [understanding Terraform run outputs](../user-guides/understanding-terraform-runs.md)
- Explore [workspace editing](../features/terraform/workspace-editing.md)
- Set up [VCS path filtering](../features/terraform/vcs-path-filtering.md) for automated runs

## Common Questions

**Q: Can I run Terraform locally instead?**  
A: Yes, workspaces can be configured for local execution, but cloud runs offer better collaboration and history tracking.

**Q: What happens if a run fails?**  
A: Failed runs are logged with full output. You can review what went wrong and retry after fixing issues.

**Q: How do I update my Terraform code?**  
A: Push changes to your connected repository. For automatic runs, create a pull request. For manual runs, queue a new plan.
