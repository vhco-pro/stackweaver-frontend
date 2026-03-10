<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Documentation Standards

## Code in Documentation

### Rule: No Duplicate Code in Documentation

**Principle**: Documentation should reference implementation files, not duplicate code.

### When to Include Code in Documentation

1. **Initial Planning Phase**:
   - ✅ Code examples are acceptable during design/planning
   - ✅ Helps communicate design intent
   - ✅ Useful for discussion and review

2. **Post-Implementation**:
   - ❌ **DO NOT** maintain code in documentation after implementation
   - ✅ **DO** replace code blocks with file references
   - ✅ Reference actual implementation files with line numbers

### Documentation Update Process

1. **During Implementation**:
   - Keep code examples in docs while implementing
   - Update examples if design changes

2. **After Implementation**:
   - Replace code blocks with file references
   - Use format: `See [Function/Class] in [file path]`
   - Include line numbers for specific implementations
   - Update status to indicate completion

### Reference Format

When referencing implemented code:

```markdown
**Implementation**: See `Team` model in `backend/internal/models/team.go`
```

For specific functions:

```markdown
**Create Method**: See `TeamRepository.Create()` in `backend/internal/repository/team.go:24-26`
```

For multiple related files:

```markdown
**Team Models**: 
- `Team` - `backend/internal/models/team.go`
- `TeamMember` - `backend/internal/models/team_member.go`
- `TeamOrganizationAccess` - `backend/internal/models/team_organization_access.go`
```

### Example: Before and After

#### ❌ Bad (After Implementation)

```markdown
### Team Model

```go
type Team struct {
    ID uuid.UUID
    Name string
    // ...
}
```
```

#### ✅ Good (After Implementation)

```markdown
### Team Model

**Implementation**: See `Team` struct in `backend/internal/models/team.go:10-32`

**Fields**:
- `ID` - UUID primary key
- `Name` - Team name (unique within organization)
- `OrganizationID` - Reference to organization
- `Visibility` - "organization" or "secret" (default: "secret")
- `AllowMemberTokenManagement` - Controls team token management
- `SSOTeamID` - Optional SSO team ID (nullable)
- `OrganizationAccess` - One-to-one relationship with `TeamOrganizationAccess`
```

### Benefits

1. **Single Source of Truth**: Code lives in source files only
2. **No Sync Issues**: Documentation never goes out of date
3. **Easier Maintenance**: Update code once, docs stay accurate
4. **Better Navigation**: Readers can jump directly to implementation

### Checklist

When updating documentation after implementation:

- [ ] Remove code blocks
- [ ] Add file references with paths
- [ ] Include line numbers for specific functions
- [ ] Update status indicators (✅ Complete, ⚠️ Partial, ❌ Not Started)
- [ ] Verify file paths are correct
- [ ] Link to relevant related files

---

**Note**: This standard applies to all architecture and design documents. Implementation details should live in code, not documentation.

