---
icon: google-cloud
title: "GCP"
nav_order: 3
description: "Let OpenTofu runs impersonate a GCP service account without a key file: a Workload Identity Pool with an OIDC provider that trusts Stackweaver."
covers:
  - "backend/internal/executor/identity/gcp_oidc.go"
  - "backend/internal/api/v2/handlers/gcp_oidc_configuration.go"
  - "backend/internal/api/v2/handlers/oidc_configuration_dispatch.go"
---

# Configure workload identity for GCP

Keyless auth to GCP uses Workload Identity Federation: a Workload Identity Pool with an OIDC provider that trusts Stackweaver, bound to a service account your automation impersonates. Check [the prerequisites](./README.md#before-you-start) first. The token audience uses the full provider resource name:

```text
//iam.googleapis.com/<workload-provider-name>
```

## Step 1: Create a Workload Identity Pool and OIDC Provider

```bash
gcloud iam workload-identity-pools create stackweaver \
  --location=global --display-name="Stackweaver"

gcloud iam workload-identity-pools providers create-oidc stackweaver \
  --location=global --workload-identity-pool=stackweaver \
  --issuer-uri="https://stackweaver.example.com" \
  --attribute-mapping="google.subject=assertion.sub" \
  --allowed-audiences="//iam.googleapis.com/projects/123456789012/locations/global/workloadIdentityPools/stackweaver/providers/stackweaver"
```

Note the numeric **project number** and the full **provider resource name**. Register both in Step 3. The resource name has this form:

```text
projects/<number>/locations/global/workloadIdentityPools/<pool>/providers/<provider>
```

## Step 2: Bind the Service Account

Grant the pool's identities permission to impersonate the service account your automation uses, scoped to the run [subject](./token-subjects.md):

```bash
gcloud iam service-accounts add-iam-policy-binding \
  stackweaver@my-project.iam.gserviceaccount.com \
  --role=roles/iam.workloadIdentityUser \
  --member="principal://iam.googleapis.com/projects/123456789012/locations/global/workloadIdentityPools/stackweaver/subject/organization:main:project:infra:workspace:production:run_phase:apply"
```

Add a binding per subject you want to allow (`plan` and `apply` are distinct), or bind on a mapped attribute. Grant the service account itself whatever resource-management roles your automation needs.

## Step 3: Register GCP in Stackweaver

```hcl
resource "stackweaver_gcp_oidc_configuration" "main" {
  organization           = "your-org-name"
  service_account_email  = "stackweaver@my-project.iam.gserviceaccount.com"
  project_number         = "123456789012"
  workload_provider_name = "projects/123456789012/locations/global/workloadIdentityPools/stackweaver/providers/stackweaver"
}
```

After apply, confirm the registration exists and its returned identifiers match the intended target before starting a run. To register through the API instead, send a `gcp-oidc-configurations` body to the endpoint shown in the [Azure API example](./azure.md#register-through-the-api); [the API explorer](/docs/api-reference/explorer) has the schema.

## Step 4: Configure the google Provider in Your Workspaces

No provider block credentials are required - the `google` provider reads an external-account credential configuration automatically from the injected environment. The job's process writes the token and a credential-config file and sets:

| Variable | Description |
|----------|-------------|
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to an `external_account` credential-config JSON (references the token file + STS token-exchange and impersonation URLs) |
| `TFC_GCP_PROVIDER_AUTH` | `true` |
| `TFC_GCP_RUN_SERVICE_ACCOUNT_EMAIL` | The `service_account_email` you registered |
| `TFC_GCP_WORKLOAD_PROVIDER_NAME` | The `workload_provider_name` you registered |
| `TFC_GCP_PROJECT_NUMBER` | The `project_number` you registered |

Set the `project` (and `region`) in your `google` provider block as usual.

## Verify a workload

Use a test workspace and review a plan with the intended identity. Check that GCP accepts the issuer, exact subject and audience and permits the required read operations. Confirm apply-phase trust separately before approving changes: plan and apply have different subjects. A saved registration alone does not prove federation or resource permissions work.

If GCP rejects the token, see [Troubleshooting](./troubleshooting.md).
