---
icon: aws
title: "AWS"
nav_order: 2
description: "Let OpenTofu runs assume an AWS role without access keys: an IAM OIDC provider and a role that trusts Stackweaver's web-identity token."
covers:
  - "backend/internal/executor/identity/aws_oidc.go"
  - "backend/internal/api/v2/handlers/aws_oidc_configuration.go"
  - "backend/internal/api/v2/handlers/oidc_configuration_dispatch.go"
---

# Configure workload identity for AWS

Keyless auth to AWS uses an IAM OIDC identity provider plus a role whose trust policy accepts Stackweaver's web-identity token (`AssumeRoleWithWebIdentity`). The token audience is `sts.amazonaws.com`. Check [the prerequisites](./README.md#before-you-start) first.

## Step 1: Create an IAM OIDC Identity Provider

1. In the AWS Console, go to **IAM** > **Identity providers** > **Add provider**.
2. Select **OpenID Connect**.
3. **Provider URL**: the public URL of your Stackweaver instance, e.g. `https://stackweaver.example.com`. Click **Get thumbprint**.
4. **Audience**: `sts.amazonaws.com`.
5. Click **Add provider**.

## Step 2: Create an IAM Role with a Web-Identity Trust Policy

Create a role your automation will assume, trusting the provider from Step 1 and restricting it to your run's [subject](./token-subjects.md):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::123456789012:oidc-provider/stackweaver.example.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "stackweaver.example.com:aud": "sts.amazonaws.com",
        "stackweaver.example.com:sub": "organization:main:project:infra:workspace:production:run_phase:apply"
      }
    }
  }]
}
```

Add a condition entry for each subject you want to allow (`plan` and `apply` are distinct), or use `StringLike` with a wildcard. Attach whatever resource-management permissions your automation needs to the role.

## Step 3: Register AWS in Stackweaver

```hcl
resource "stackweaver_aws_oidc_configuration" "main" {
  organization = "your-org-name"
  role_arn     = "arn:aws:iam::123456789012:role/stackweaver-oidc"
}
```

After apply, confirm the registration exists and its returned identifiers match the intended target before starting a run. To register through the API instead, send an `aws-oidc-configurations` body to the endpoint shown in the [Azure API example](./azure.md#register-through-the-api); [the API explorer](/docs/api-reference/explorer) has the schema.

## Step 4: Configure the aws Provider in Your Workspaces

With no conflicting static credentials configured, the `aws` provider performs `AssumeRoleWithWebIdentity` automatically from the injected environment. The job's process writes the token to a file and sets:

| Variable | Description |
|----------|-------------|
| `AWS_ROLE_ARN` | The `role_arn` you registered |
| `AWS_WEB_IDENTITY_TOKEN_FILE` | Path to the short-lived JWT (the AWS SDK reads the token from a file, not an env value) |
| `AWS_ROLE_SESSION_NAME` | A per-run session name (`stackweaver-<run-id>`) |

## Verify a workload

Use a test workspace and review a plan with the intended identity. Check that AWS accepts the issuer, exact subject and audience and permits the required read operations. Confirm apply-phase trust separately before approving changes: plan and apply have different subjects. A saved registration alone does not prove federation or resource permissions work.

If AWS rejects the token, see [Troubleshooting](./troubleshooting.md).
