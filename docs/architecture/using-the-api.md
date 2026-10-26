---
title: "Using the API"
description: "Connect automation to Stackweaver, follow paginated results, and use the OpenAPI description with your own tools."
covers:
  - "backend/cmd/openapi-gen/**"
  - "backend/internal/api/v2/openapi/**"
  - "backend/internal/api/v2/jsonapi/**"
  - "backend/internal/api/middleware/**"
  - "frontend/src/pages/Docs/ApiReferenceExplorer.tsx"
capabilities: [
  {
    "id": "platform-api",
    "name": "REST API and OpenAPI explorer",
    "summary": "Automate platform operations and browse request and response schemas in the API explorer.",
    "area": "platform",
    "availability": "available",
    "limitations": "Terraform-compatible operations and Stackweaver-specific endpoints have different coverage. Check the schema for the operation you use.",
    "evidence": [
      "backend/internal/api/v2/routes/routes.go",
      "frontend/src/pages/Docs/ApiReferenceExplorer.tsx"
    ]
  }
]
---
<!-- Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Using the API

[Open the API explorer](/docs/api-reference/explorer) for endpoints, request bodies, response schemas and examples. It is public, searchable and hosted by your Stackweaver deployment.

| Interface | Use it for |
|---|---|
| API explorer | Look up an operation's accepted fields, responses and examples. |
| REST API | Script individual operations or integrate another service. |
| [Terraform provider](../user-guides/terraform-provider.md) | Maintain supported Stackweaver resources as declarative configuration. Check the provider's resource schema; not every API field has a provider argument. |

<a id="connect-your-automation"></a>

## 1. Configure your connection

The main API lives at `/api/v2` on your Stackweaver API host. Send a `tfe-` API token in the `Authorization` header as `Bearer <token>`. A Zitadel access token is not an API credential. Browser sign-in uses a separate server-side session behind an `HttpOnly` cookie. See [Authenticating](../user-guides/terraform-provider.md#authenticating) for creating a personal token and using `terraform login`.

Choose a token with access to the organization and resources your automation needs. Account security operations, such as changing a password or managing sessions, require an interactive sign-in. An API token, including a personal token, receives `403 Forbidden` on those operations. Reading account details is available to API tokens.

The command examples in these guides use the following environment variables. Set the API
origin without `/api/v2`, replace the organization name, and supply `STACKWEAVER_TOKEN`
through your secret manager or shell environment. Keep the token out of saved scripts.

```bash
export STACKWEAVER_API_URL="https://stackweaver.example.com"
export STACKWEAVER_ORGANIZATION="example-org"
```

## 2. Make a request and check the result

List the first page of workspaces you can access in that organization:

```bash
curl --fail-with-body --silent --show-error --globoff \
  --header "Authorization: Bearer $STACKWEAVER_TOKEN" \
  "$STACKWEAVER_API_URL/api/v2/organizations/$STACKWEAVER_ORGANIZATION/workspaces?page[number]=1&page[size]=20"
```

Expect a JSON:API `data` array and pagination metadata. An empty array means this request
returned no visible workspaces, not that your deployment contains no workspaces.

Most resource writes use JSON:API. Put the resource type in `data.type`, fields in
`data.attributes`, and related resource identifiers in `data.relationships`. Send
`Content-Type: application/vnd.api+json` and use the operation's schema for the exact shape.
Uploads and protocol endpoints can use a different format.

### If a request fails

Read the HTTP status and the response's `errors` array. Resource errors normally provide
`status`, `title` and, where available, `detail`.
The request above uses `--fail-with-body` to keep an HTTP error's response body while still
returning a nonzero exit status.

| Status | What to check |
|---|---|
| `400` or `422` | Accepted body fields, required values, relationships and the conditions described by the operation. |
| `401` | A valid token is present in the Bearer header and has not expired or been revoked. |
| `403` | The token's organization/resource scope and permissions; some account operations require interactive sign-in. |
| `404` | The API host, path, resource identifier and whether that resource is visible to the caller. |
| `429` | Reduce the request rate before retrying. |

<a id="read-paginated-results"></a>

## 3. Read every page you need

Where an operation supports pagination, use `page[number]` and `page[size]`. Pages start at 1. Follow `meta.pagination.next-page` until it is `null` to read the whole collection.

Do not rely on a total count to decide whether to fetch another page. Collections fetched from a VCS provider can return `null` for `total-pages` and `total-count`. Defaults and page-size limits vary by operation, and some collections are returned whole.

<a id="use-the-description-with-your-own-tools"></a>

## Use the OpenAPI description with your own tools

A running API server publishes its OpenAPI description at `/openapi/stable.json`, without authentication. Fetch it from the API host of the deployment you are targeting when generating a client or checking compatibility. You can also [download the description bundled with these docs](/docs/api-reference/openapi.json).

```bash
curl --fail --silent --show-error \
  "$STACKWEAVER_API_URL/openapi/stable.json" \
  --output stackweaver-openapi.json
```

For repeated downloads, retain the `Last-Modified` response header and send it as `If-Modified-Since`. An unchanged description returns `304 Not Modified` without a body.

## Understand the reference's limits

Replace example placeholders such as `<uuid>`, `<timestamp>` and `<secret>` before sending
a request. The schema lists accepted fields; the operation can also impose validation or
permission requirements on their combination.

An example showing a refusal or a missing resource does not prove the operation is
unsupported. Check its description and requirements, then use the running deployment's
response to diagnose your request.

The description covers Stackweaver's implemented API. Its Terraform Enterprise discovery path does not imply support for every Terraform Enterprise operation. See [Migrating from Terraform Cloud](../user-guides/migrating-from-terraform-cloud.md) and [the Terraform provider guide](../user-guides/terraform-provider.md) when choosing tooling for your integration.
