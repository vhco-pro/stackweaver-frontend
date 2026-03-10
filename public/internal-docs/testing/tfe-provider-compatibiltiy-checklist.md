<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Done 



## resources

### To verify

### Verified

- tfe_team_project_access
- tfe_project
- tfe_team
- tfe_team_access
- tfe_workspace


- [x] [tfe_variable_set](https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/variable_set)
- [x] [tfe_variable](https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/variable)
- [x] [tfe_workspace_variable_set](https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/workspace_variable_set)

- [organization_membership](https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/organization_membership)
    - ⚠️ **Email Lookup**: The initial email lookup failure may not have been a case sensitivity issue. The implementation includes case-insensitive fallback and placeholder user creation, but the root cause needs proper investigation and testing to ensure existing users are found correctly.

- [x] [team_organization_member](https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/team_organization_member)
- [x] [team_organization_members](https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/team_organization_members)

---

https://developer.hashicorp.com/terraform/cloud-docs/api-docs/variables
https://developer.hashicorp.com/terraform/cloud-docs/api-docs/variable-sets
https://developer.hashicorp.com/terraform/cloud-docs/api-docs/workspace-variables


https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/project_variable_set
https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/stack_variable_set
https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/tfe_test_variable
https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/project_variable_set


## Data

### To verify

### Verified

- tfe_workspace


---
https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/data-sources/variable_set
https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/data-sources/variables

**API Reference:**
- https://developer.hashicorp.com/terraform/enterprise/api-docs/workspaces


https://developer.hashicorp.com/terraform/enterprise/workspaces/run/ui - UI and VCS-driven run workflow
https://developer.hashicorp.com/terraform/enterprise/workspaces/run/api - The API-driven run workflow