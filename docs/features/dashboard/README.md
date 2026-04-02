---
description: "Dashboard page documentation covering stats endpoint, organization cards, and getting-started guide"
covers:
  - "backend/internal/api/v2/handlers/dashboard*"
  - "frontend/src/pages/Dashboard/**"
---

# Dashboard Documentation

The user dashboard (`/dashboard`) is the main landing page for authenticated users in StackWeaver. It provides an overview of the user's infrastructure, operations, and quick access to common tasks.

## Overview

The dashboard serves as a central hub where users can:
- View aggregated metrics across all their organizations
- Monitor active and completed operations (both Terraform and Ansible)
- Access quick actions for common tasks
- See recent activity across all organizations
- Get guided setup suggestions for new users

## Implementation

**Backend Endpoint**: `GET /api/v2/dashboard/stats`  
**Handler Implementation**: See `backend/internal/api/v2/handlers/dashboard.go`  
**Route Registration**: See `backend/internal/api/v2/routes/routes.go:1064-1087`  
**Frontend Component**: See `frontend/src/pages/Dashboard.tsx`  
**Frontend API Client**: See `frontend/src/api/client.ts` (dashboardApi)

### Features

1. **Summary Cards**: Display total projects, Terraform workspaces, active operations (Terraform + Ansible), and completed operations this month
2. **Organization Cards**: Show statistics for each organization the user belongs to, including:
   - Projects count
   - Terraform workspaces count
   - Active operations (Terraform runs + Ansible jobs)
   - Completed operations this month (Terraform + Ansible)
3. **Quick Actions**: Shortcuts to create organizations, view organizations, and manage settings
4. **Recent Activity**: Timeline of recent actions across all organizations
5. **Dynamic Getting Started**: Step-by-step guide that automatically hides suggestions when resources are created:
   - "Create Organization" hides when user has organizations
   - "Create Project" hides when user has projects
   - "Create Workspace" hides when user has workspaces
   - Entire section hides when all resources exist

### Key Improvements

1. ✅ **Multi-Platform Support**: Dashboard now includes both Terraform and Ansible metrics
2. ✅ **User-Specific Metrics**: All runs and jobs are filtered by the authenticated user (server-side)
3. ✅ **Dynamic Getting Started**: Suggestions automatically hide based on existing resources
4. ✅ **Comprehensive Organization View**: Shows data for all organizations the user belongs to
5. ✅ **Optimized Performance**: Single API call with server-side aggregation using efficient database queries

## API Details

### Dashboard Stats Endpoint

**Endpoint**: `GET /api/v2/dashboard/stats`  
**Authentication**: Required (JWT or TFE token)  
**Response Format**: JSON:API compatible

**Response Structure**:
```json
{
  "data": {
    "type": "dashboard-stats",
    "attributes": {
      "projects": 5,
      "terraform_workspaces": 12,
      "ansible_playbooks": 8,
      "active_terraform_runs": 2,
      "active_ansible_jobs": 1,
      "completed_terraform_runs_this_month": 45,
      "completed_ansible_jobs_this_month": 23,
      "organizations": [
        {
          "id": "...",
          "name": "main",
          "description": "...",
          "projects": 3,
          "terraform_workspaces": 5,
          "ansible_playbooks": 2,
          "active_terraform_runs": 1,
          "active_ansible_jobs": 0,
          "completed_terraform_runs_this_month": 10,
          "completed_ansible_jobs_this_month": 2
        }
      ]
    }
  }
}
```

**User Filtering**: All runs and jobs are automatically filtered by the authenticated user's database UUID (extracted from authentication context).

**Repository Methods Used**:
- `OrganizationRepository.ListByUser()` - Get user's organizations
- `RunRepository.ListByOrganizationAndUser()` - Get user's Terraform runs per organization
- `AnsibleJobRepository.ListByOrganizationAndUser()` - Get user's Ansible jobs per organization

## Related Documentation

- **Frontend Architecture**: See `docs/architecture/frontend-v2-design.md:134-177` for dashboard behavior specification
- **API Reference**: See `docs/api-reference/backend-api-reference.md` for backend endpoints
- **Activity System**: See `backend/internal/services/activity/service.go` for activity tracking
