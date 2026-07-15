---
description: "Guide for filing change requests against workspaces so teams know what needs fixing, and archiving them once the work is done"
covers:
  - "core/models/change_request*"
  - "core/repository/change_request*"
  - "backend/internal/api/v2/handlers/terraform/change_requests*"
  - "frontend/src/components/workspace/WorkspaceChangeRequests*"
  - "frontend/src/pages/Settings/ChangeRequests*"
---

# Change Requests

A change request is an action item recorded on a workspace. It is how a platform administrator tells the team that owns a workspace that something needs attention, without leaving the platform or opening a ticket somewhere else.

## Overview

Change requests are deliberately small. A request has a subject, a message, and one of two states: open, or archived. An administrator files a request against one or more workspaces, the teams with access to those workspaces can see it on the workspace itself, and a team member archives it once the work is done. There is no assignment, no priority, and no comment thread.

The typical use is governance work that a platform team spots while reviewing an estate: a module version that has reached end of life, a security update that needs applying, a workspace that has drifted from a compliance baseline. Rather than chasing each workspace owner individually, you file one request against every affected workspace at once and let each team close out its own.

Filing a change request requires the `org:manage-workspaces` permission, which is the permission that stands in for an administrator here. Members of the owners team always have it. Archiving only requires write access to the workspace, so the team doing the work can close the request without needing administrator rights.

## Filing a change request

Open the Workspaces list, find the workspace that needs attention, and choose **File change request** from the actions menu at the end of its row, alongside Edit and Delete. The menu item only appears if you have permission to file. The dialog names the workspace you picked, so there is never any doubt about what you are filing against.

Only the subject is required. The message is optional and is rendered as Markdown, so you can include a link to a runbook or a migration guide.

To cover several workspaces, file a request on each one. They are independent from that point on: each owning team archives its own, which is what lets you track partial progress across an estate rather than an all-or-nothing task.

## Seeing and archiving requests

Each workspace has a **Change Requests** tab listing everything filed against it. Open requests appear first, and archived ones are collapsed into a separate section below so a long history does not bury current work. Archiving is a single click, and the request records who archived it and when.

Archiving is not destructive and it is not reversible from the interface. An archived request remains visible in its collapsed section as a record that the work was done.

## Triaging across the organization

The per-workspace tab answers "what does this workspace need", but an administrator usually needs the opposite view: what is still outstanding everywhere. **Settings → Change Requests** lists every open request across the organization, grouped by workspace, with the same archive action inline. Each workspace name links straight to that workspace's Change Requests tab. The page only lists open requests, so it empties out as teams complete the work, and it is only visible to users who can file requests in the first place.

## API compatibility

The change request endpoints match HCP Terraform's, so scripts written against Terraform Cloud work unchanged. The resource type on the wire is `workspace_change_requests`, and a request is open exactly when its `archived-by` and `archived-at` attributes are null.

Requests are created through HCP Terraform's bulk action endpoint, which takes a single subject and message together with a list of target workspaces. The endpoint accepts many targets, matching HCP Terraform, even though the interface files against one workspace at a time; if you want to file the same request across an estate, script it against the API with several target ids in one call. See the handler in `backend/internal/api/v2/handlers/terraform/change_requests.go` for the exact request and response shapes, and the route registrations in `backend/internal/api/v2/routes/routes.go` for the full endpoint list.

There are two deliberate differences from HCP Terraform. The bulk action endpoint also accepts an Explorer query in place of an explicit list of workspaces, which Stackweaver rejects with a clear error because it does not implement the Explorer; pass target workspace ids instead. Stackweaver also adds an endpoint to delete a change request outright and an endpoint listing an organization's open requests, neither of which HCP Terraform provides.

There is no Terraform provider resource for change requests, in Stackweaver or in HCP Terraform, so they cannot be managed from Terraform configuration.
