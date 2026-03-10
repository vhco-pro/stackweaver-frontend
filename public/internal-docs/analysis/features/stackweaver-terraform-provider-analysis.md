<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

## Future: StackWeaver Terraform Provider

### Rationale

We will create our own `terraform-provider-stackweaver` to:
1. **Support Ansible Resources**: Manage Ansible resources (inventories, job templates, etc.) from Terraform
2. **Extended Features**: Add StackWeaver-specific features not in TFE (unified platform features)
3. **Full Control**: Complete control over resource lifecycle and features

### Resources to Support

**Terraform Resources** (TFE-compatible):
- `stackweaver_organization`
- `stackweaver_team`
- `stackweaver_team_member`
- `stackweaver_organization_membership`
- `stackweaver_workspace`
- `stackweaver_team_workspace_access`
- etc.

**Ansible Resources** (StackWeaver-specific):
- `stackweaver_ansible_inventory`
- `stackweaver_ansible_job_template`
- `stackweaver_ansible_credential`
- `stackweaver_ansible_schedule`
- etc.

**Unified Resources**:
- `stackweaver_project`
- `stackweaver_vcs_connection`
- etc.

### Implementation Notes

- Maintain TFE compatibility for Terraform resources (use same schema where possible)
- Extend with StackWeaver-specific resources
- Use same authentication (API keys, OIDC tokens)
- Document migration path from `terraform-provider-tfe` to `terraform-provider-stackweaver`

---

## Migration Strategy

### From TFE to StackWeaver

1. **Teams**: Use `terraform-provider-tfe` to manage teams in StackWeaver (compatible API)
2. **Organization Memberships**: Use `terraform-provider-tfe` to manage memberships
3. **Workspaces**: Use `terraform-provider-tfe` to manage Terraform workspaces
4. **Ansible Resources**: Use `terraform-provider-stackweaver` (when available) for Ansible resources

### Backward Compatibility

- Existing OrganizationMember model remains unchanged
- Direct organization membership continues to work
- Teams add functionality without breaking existing features
- Permission resolution checks direct membership first (backward compatible)

---

## Testing Strategy

### Unit Tests

- Repository layer tests
- Service layer tests
- Permission resolution tests

### Integration Tests

- API endpoint tests
- TFE provider compatibility tests
- End-to-end workflow tests

### TFE Provider Testing

1. Use `terraform-provider-tfe` to create/manage teams
2. Verify API responses match TFE format
3. Test all CRUD operations
4. Test error cases
