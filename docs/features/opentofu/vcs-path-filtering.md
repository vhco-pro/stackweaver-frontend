---
description: "Choose working-directory, prefix or glob rules, configure them with Terraform/API and verify monorepo triggering."
covers:
  - "backend/internal/api/v2/handlers/vcs_path_filtering.go"
  - "backend/internal/api/v2/handlers/vcs_app_installation.go"
  - "backend/internal/api/v2/handlers/terraform/workspaces.go"
capabilities: [
  {
    "id": "workspace-path-filters",
    "name": "Repository path filters",
    "summary": "Trigger workspace runs only when monitored files change, using directories or glob patterns.",
    "area": "opentofu",
    "availability": "available",
    "limitations": "Turning file triggers off ignores path filters; branch and automatic-queue gates still apply.",
    "evidence": [
      "backend/internal/api/v2/handlers/vcs_path_filtering.go",
      "backend/internal/api/v2/handlers/vcs_path_filtering_test.go"
    ]
  }
]
---

# Filter runs by changed paths

When several workspaces share a repository, path filters decide which of them should run
for a push or pull request. Start with each workspace's working directory, then add shared
directories or replace directory matching with explicit patterns.

## Start with the working directory

For this repository, give the production workspace `environments/production` as its working
directory and the staging workspace `environments/staging`:

```text
environments/
  production/main.tf
  staging/main.tf
modules/
  network/main.tf
```

A production-only change then matches production. A shared module change needs an extra
prefix or pattern; path filtering does not discover your module dependency graph for you.

The UI can edit the working directory. Configure file-trigger enablement, extra prefixes
and patterns through Terraform or the TFE-compatible API.

## Matching precedence

| Setting | Matching rule |
|---|---|
| File triggers disabled | Every relevant repository change matches; directory, prefix and pattern filters are ignored. |
| Patterns present | Only the patterns are consulted. The working directory is **not** added automatically. |
| Prefixes present | Match those directories plus a non-root working directory. |
| Neither list present | Match the working directory. Empty or `/` means the repository root. |

For a root workspace with explicit prefixes, those prefixes narrow the match; the empty
working directory does not add a match-all rule. Without prefixes or patterns, the root
still matches every changed path.

Directory prefixes match boundaries: `modules/net` matches files below that directory,
but not `modules/network/main.tf`. Subdirectories are included. The same workspace
matching rules apply to GitHub push/PR handling and Azure DevOps deliveries. If an event
provides no changed-file list, Stackweaver can trigger conservatively rather than assume
nothing changed.

<a id="configuration" style="scroll-margin-top: 7rem"></a>

### Configure directory prefixes with Terraform

Use your existing [Stackweaver provider](../../user-guides/terraform-provider.md) management
configuration. Add the settings to the workspace resource you already manage:

```hcl
resource "stackweaver_workspace" "production" {
  name              = "production"
  organization      = "example-platform"
  working_directory = "environments/production"

  file_triggers_enabled = true
  trigger_prefixes      = ["modules/network", "modules/database"]
}
```

Retain your resource's VCS connection/repository settings and other managed attributes.
For an existing workspace not yet in state, import it before applying this resource.
Review the plan so that adopting path settings does not create a duplicate workspace.
The upstream `tfe_workspace` alias uses the corresponding field names.

<a id="common-use-cases" style="scroll-margin-top: 7rem"></a>

### Use patterns instead of prefixes

Replace `trigger_prefixes` with this attribute in that resource:

```hcl
trigger_patterns = [
  "environments/production/**",
  "modules/**/*.tf"
]
```

| Pattern | Meaning |
|---|---|
| `**/*.tf` | Terraform files at any depth, including the root. |
| `modules/*/main.tf` | A `main.tf` one directory below `modules`. |
| `modules/network/` | Everything below that directory. |
| `services/?/infra/**` | A one-character service directory, then its infrastructure tree. |

`**` can span directory separators, `*` stays within one segment, and `?` matches one
character. Patterns are relative to the repository root. Include environment files
explicitly if they must trigger runs alongside shared modules.

Prefixes and patterns are mutually exclusive. Sending both nonempty lists is rejected
with `422`. Setting a nonempty list can replace the other kind already stored.

## Update filters through the API

Set the API origin, token and `WORKSPACE_ID`. The request must include the intended
`working-directory`; omitting it on the current update path can clear it to the root.
Save this as `path-filters.json`:

```json
{
  "data": {
    "type": "workspaces",
    "id": "ws-replace-with-id",
    "attributes": {
      "working-directory": "environments/production",
      "file-triggers-enabled": true,
      "trigger-prefixes": ["modules/network", "modules/database"]
    }
  }
}
```

Replace the document ID with the same workspace ID as the request URL, then apply and read back:

```bash
curl --fail-with-body --request PATCH \
  --header "Authorization: Bearer $STACKWEAVER_TOKEN" \
  --header 'Content-Type: application/vnd.api+json' \
  --data-binary @path-filters.json \
  "$STACKWEAVER_API_URL/api/v2/workspaces/$WORKSPACE_ID"
curl --fail-with-body \
  --header "Authorization: Bearer $STACKWEAVER_TOKEN" \
  "$STACKWEAVER_API_URL/api/v2/workspaces/$WORKSPACE_ID"
```

To use patterns, replace the `trigger-prefixes` key with `trigger-patterns`. To stop filtering,
set `file-triggers-enabled` to `false`; this broadens triggering, it does not stop automation.
There is no separate repository YAML definition for these workspace settings.

<a id="gitops-benefits" style="scroll-margin-top: 7rem"></a>

## Verify the result

1. Read back the stored working directory and filters.
2. In a test repository, push one matching and one unrelated change to the tracked branch.
3. Check webhook delivery and the workspace's resulting runs. Matching paths do not bypass
   repository/branch selection, automatic-queue settings or other launch requirements.
4. For PRs, check the organization's [pull request behavior](../../user-guides/organization-settings.md#pull-request-behavior).
   Passing statuses for untriggered workspaces and aggregated monorepo status checks are
   separate organization policies.

The same pattern applies to environment workspaces, service subtrees and team directories.
Keep each resource's working directory correct even when patterns decide triggering: it
still determines where OpenTofu executes. See [Workspace editing](./workspace-editing.md)
and [GitHub App setup](../../user-guides/vcs/github-app.md).
