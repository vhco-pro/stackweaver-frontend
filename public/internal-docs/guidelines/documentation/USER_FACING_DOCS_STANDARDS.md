<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# User-Facing Documentation Standards

This document defines the standards for user-facing documentation in StackWeaver. User-facing documentation is displayed in the public documentation viewer and must be written for end users, operators, and contributors - not internal implementation details.

## What is User-Facing Documentation?

User-facing documentation includes:
- **Setup guides** - How to install and configure the platform
- **API references** - How to use the APIs
- **Feature documentation** - How to use platform features
- **Architecture overviews** - High-level system design (for operators and contributors)
- **Authentication guides** - How authentication works for users/operators
- **Ansible/Terraform guides** - How to use platform features for these tools

## What is NOT User-Facing Documentation?

The following are internal documentation and should NOT appear in the docs viewer:
- Implementation plans (`*-plan.md`, `*_PLAN.md`)
- Analysis documents (`*-analysis.md`, `*_ANALYSIS.md`)
- Research documents (`*-research.md`, `*_RESEARCH.md`)
- Status reports (`*-status.md`, `*_SITREP.md`)
- Checklists (`*-checklist.md`)
- Audits (`*-audit.md`)
- Implementation details (`*implementation*.md`)
- Internal TODOs and notes

These internal documents remain in the repository but are automatically excluded from the docs viewer by the build script.

## Writing Style for User-Facing Documentation

### 1. Use Full Sentences

**❌ BAD - Bullet Points Only:**
```markdown
## Setup
- Install Docker
- Configure environment
- Run make up
```

**✅ GOOD - Full Sentences with Context:**
```markdown
## Setup

StackWeaver can be installed using Docker Compose for local development. First, ensure Docker and Docker Compose are installed on your system. Then configure your environment variables and run the setup commands.

### Prerequisites

Before you begin, make sure you have Docker and Docker Compose installed. StackWeaver requires Docker version 20.10 or later.

### Installation Steps

1. **Install Docker**: Follow the [Docker installation guide](https://docs.docker.com/get-docker/) for your operating system.

2. **Configure Environment**: Copy the example environment file and set your configuration values.

3. **Start Services**: Run `make up` to start all StackWeaver services.
```

### 2. Provide Context and Explanation

**❌ BAD - No Context:**
```markdown
## Configuration
- Set `DATABASE_URL`
- Configure `ZITADEL_URL`
```

**✅ GOOD - With Context:**
```markdown
## Configuration

StackWeaver requires several environment variables to be configured before it can run. These settings control database connections, authentication, and other core services.

### Database Configuration

The `DATABASE_URL` environment variable specifies the PostgreSQL database connection string. This is required for StackWeaver to store metadata about organizations, workspaces, and runs. The connection string should follow the PostgreSQL URI format: `postgresql://user:password@host:port/database`.
```

### 3. Write for Your Audience

- **End Users**: Focus on "how to use" rather than "how it's implemented"
- **Operators**: Include configuration details and operational considerations
- **Contributors**: Provide enough architecture context to understand the system

### 4. Use Clear, Descriptive Headings

**❌ BAD:**
```markdown
## Setup
## Config
## API
```

**✅ GOOD:**
```markdown
## Installation and Setup
## Configuration Options
## API Reference
```

### 5. Include Examples

Always include practical examples when documenting features:

```markdown
### Creating a Workspace

You can create a new Terraform workspace through the API or the web interface.

#### Example API Request

```bash
curl -X POST https://stackweaver.example.com/api/v2/organizations/my-org/workspaces \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "type": "workspaces",
      "attributes": {
        "name": "production-infrastructure",
        "description": "Production infrastructure workspace"
      }
    }
  }'
```
```

### 6. Use Proper Markdown Formatting

- Use proper heading hierarchy (h1 for page title, h2 for major sections, h3 for subsections)
- Use code blocks with language identifiers for syntax highlighting
- Use lists for sequences of steps or related items
- Use tables for structured data
- Use callout boxes for important notes (see below)

### 7. Callout Boxes for Important Information

Use callout boxes to highlight important information:

```markdown
> [!NOTE]
> This feature requires authentication. Make sure you have a valid API token before proceeding.

> [!WARNING]
> Deleting a workspace will permanently remove all associated state data. This action cannot be undone.

> [!TIP]
> You can use environment variables to store sensitive configuration values instead of hardcoding them.
```

Available callout types:
- `[!NOTE]` - Informational notes
- `[!TIP]` - Helpful tips
- `[!IMPORTANT]` - Critical information
- `[!WARNING]` - Warnings about potential issues
- `[!CAUTION]` - Safety-related cautions

### 8. Link to Related Documentation

Always link to related documentation sections:

```markdown
For more information about authentication, see [Authentication Documentation](../internal/overviews/authentication.md) or [Architecture Overview](../architecture/README.md).

For API endpoint details, refer to the [API Reference](../internal/api-reference/backend-api-reference.md).
```

## Structure Guidelines

### Page Structure

Each documentation page should follow this structure:

1. **Title** (h1) - Clear, descriptive page title
2. **Introduction** - Brief overview of what this page covers
3. **Sections** (h2) - Major topics covered
4. **Subsections** (h3-h6) - Detailed information
5. **Examples** - Practical examples where relevant
6. **Related Links** - Links to related documentation

### Organization

- **Setup guides** go in `setup/`
- **API documentation** goes in `api-reference/`
- **Feature documentation** goes in `features/` (but exclude implementation/plan/research docs)
- **Architecture docs** go in `architecture/` (high-level only, exclude analysis/research/status)
- **Ansible docs** go in `ansible/` (user-facing guides)
- **Terraform docs** go in `terraform/` (user-facing guides)

## Review Checklist

Before adding documentation to the user-facing docs:

- [ ] Is this document intended for end users, operators, or contributors?
- [ ] Does it use full sentences and provide context?
- [ ] Does it explain "how to use" rather than "how it's implemented"?
- [ ] Are there practical examples included?
- [ ] Is the markdown properly formatted with clear headings?
- [ ] Are important notes highlighted with callout boxes?
- [ ] Are related documents linked?
- [ ] Does it follow the structure guidelines above?
- [ ] Would this be helpful for someone trying to use or operate StackWeaver?

## File Naming Conventions

User-facing documentation files should have descriptive names:
- `setup-guide.md` ✅
- `authentication.md` ✅
- `terraform-workspaces.md` ✅
- `ansible-inventories.md` ✅

Avoid patterns that indicate internal docs:
- `*-plan.md` ❌
- `*-analysis.md` ❌
- `*-research.md` ❌
- `*-implementation.md` ❌

The build script automatically excludes files matching internal documentation patterns from the docs viewer.

## Images

The docs viewer supports embedded images using standard markdown syntax. Images are co-located with their markdown files inside `docs/` and are automatically copied and losslessly optimised during the documentation build.

### Placing Images

Place image files in the same directory as the markdown file that references them. Reference them with an explicit relative prefix:

```markdown
![Workspace run list](./workspace-run-list.png)
```

Use descriptive filenames — `workspace-run-list.png`, not `screenshot1.png`. Prefer `.png` for UI screenshots and `.svg` for diagrams.

### Captions

Add a caption using the `title` attribute (the third element of the image syntax). The viewer renders it as a centred caption below the image:

```markdown
![Architecture overview](./arch.png "Figure 1: High-level architecture")
```

### Dark-Mode Variants

To supply a dark-mode version of an image, place a file with `-dark` before the extension in the same directory: `screenshot.png` → `screenshot-dark.png`. The viewer picks the right file automatically based on the active theme. If no dark variant is present, the light image is used in both modes. Dark variants are optional — most screenshots do not need one unless the UI looks significantly different in dark mode.

### Shared Images

Images shared across multiple pages can go in `docs/images/`. Reference them with a relative path: `../../images/logo.png` or the absolute path `/docs/images/logo.png`.

### What Gets Published

Images under `docs/internal/` are never published to the docs viewer, matching the same rules as markdown files.

## Questions?

If you're unsure whether a document should be user-facing:
1. Ask: "Would an end user, operator, or contributor benefit from this?"
2. Check: Does it explain how to *use* something rather than how it's *implemented*?
3. Verify: Does it use full sentences and provide context?

Internal implementation details, plans, and analysis should remain in the repository but are automatically excluded from the public documentation viewer.
