<!--
Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
-->
---
description: "Stackweaver's machine-readable OpenAPI 3 description, how to fetch it from a running server, what it describes for requests, responses and query parameters, and what it does not promise. Aimed at anyone writing automation, generating a client, or checking Terraform Enterprise compatibility."
covers:
  - "backend/cmd/openapi-gen/**"
  - "backend/internal/api/v2/openapi/**"
  - "backend/internal/api/v2/routes/**"
  - "backend/internal/api/v2/jsonapi/**"
  - "backend/internal/api/v2/handlers/organizations.go"
  - "backend/internal/api/v2/handlers/terraform/runs.go"
  - "backend/internal/api/v2/handlers/webhook_events.go"
---

# API Reference

Stackweaver publishes a machine-readable description of its entire HTTP API as an OpenAPI 3 document. It covers every route the server registers. For each one it gives the response, the query parameters the endpoint reads, and, for an endpoint that changes something, the request body it takes with an example the server accepted and the response a successful call returns. It is the one API reference: there is no second, hand-written description of any part of the API to disagree with it. If you are writing automation against Stackweaver, generating a client library, or checking how far the Terraform Enterprise compatibility goes, this document is the authoritative answer.

## Reading it

Every Stackweaver deployment renders the document at
[`/docs/api-reference/explorer`](/docs/api-reference/explorer), grouped by resource and
searchable, so you can read the API without a tool of your own. An operation is listed under the
resource it addresses, wherever that resource sits in the URL: creating an inventory is under
`ansible/inventories` although its path begins with the organization, and only operations on an
organization or a project itself are listed under `organizations` and `projects`. The **API Reference** link in the
top navigation of the landing page and every docs page opens it directly. The page is public and needs no
login, and it renders entirely in your browser: it reaches no third-party service, which is
checked by a test rather than asserted here.

## Fetching it

Every running Stackweaver server serves its own description, and the endpoint needs no authentication, because a client that cannot read the API description before authenticating cannot generate a client at all.

```
curl https://your-stackweaver-host/openapi/stable.json
```

The path matches the one `hashicorp/go-tfe` fetches from a Terraform Enterprise server, so a go-tfe client can discover Stackweaver the same way it discovers HashiCorp's. That is a compatibility affordance, not a claim to be Terraform Enterprise: the document identifies itself as Stackweaver, and it describes what Stackweaver actually implements rather than the full Terraform Enterprise surface.

The endpoint supports conditional requests. Send `If-Modified-Since` with the value of the `Last-Modified` header you were given, and an unchanged document answers `304 Not Modified` with no body, so a client does not re-download half a megabyte on every start.

The same file is published alongside this page as `openapi.json`, if you would rather read it without a server to hand.

## Request and response format

Every resource endpoint under `/api/v2` speaks JSON:API, the format Terraform Enterprise uses. A request that creates or changes a resource carries a document with a single top-level member, `data`, which holds the resource's `type`, its `attributes` and, where the resource points at others, its `relationships`:

```
{"data": {"type": "organizations", "attributes": {"name": "acme", "email": "ops@example.com"}}}
```

A response carries the resource in the same form under `data`, with its `id`, and a collection carries a list of resources under `data` together with the `meta.pagination` block described under [What it does not promise](#what-it-does-not-promise). Where a resource exists in Terraform Enterprise its attribute names are the ones used there, which are dash-case, as in `auto-apply` and `default-execution-mode`. The OpenAPI document gives the members of each request body operation by operation, and this section describes what the requests have in common.

A collection is paged with the `page[number]` and `page[size]` query parameters. Pages are numbered from 1, and a request that names no page receives the first. An operation declares the two parameters only when its endpoint reads them: a collection that is always returned whole declares neither, and still reports a `meta.pagination` block with a single page. The Ansible collections return 20 resources per page by default and at most 100, with three exceptions: the job queue and the list of a workflow's runs return 50 by default, and a job's events return 100 by default and at most 500.

An error is a JSON:API error document: `{"errors": [{"status": "400", "title": "Bad Request", "detail": "..."}]}`. The `status` member repeats the HTTP status code as a string, and `detail` says what was wrong with the request in terms a client can act on. A request whose declared body size exceeds the limit of the endpoint it is sent to is answered with `413` and a document of the same form.

Requests may be sent as `application/vnd.api+json`, which is what `hashicorp/go-tfe` and the `tfe` Terraform provider send, or as `application/json`. Every endpoint that takes a JSON body accepts both, and JSON responses are served as `application/json`.

An authenticated endpoint reads the caller's token from the `Authorization` header as `Bearer <token>`. The token is an API token or the access token of a signed-in session, and a request without the header, or with the header in another form, is answered with `401`.

The attributes of a resource are read from `data.attributes` and its relationships from `data.relationships`, and from nowhere else. A body that carries them at the top level is not a document. Creating or updating an organization and creating a run answer such a body with `400 Bad Request` and a `detail` that names the document they expect, and they answer 400 as well when `data.type` is missing or names another resource. Set `data.type` to the type of the resource the endpoint manages on every write: the other endpoints that check it, among them projects, teams, variable sets and agent pools, also answer 400 when it differs.

Creating a run takes its intent from three attributes, the ones Terraform Enterprise defines. `plan-only: true` creates a speculative run that cannot be applied, `is-destroy: true` creates a destroy run, and `auto-apply: true` applies the run as soon as its plan finishes. A run created with none of them plans and then waits for a confirmation. The workspace is named by the `workspace` relationship and the configuration version, when one is given, by the `configuration-version` relationship. The configuration version must belong to that workspace: a run that names one the workspace does not have is rejected with 404 and the detail `Configuration version not found`, and no run is created. This endpoint is stricter than Terraform Enterprise in one respect: it answers 400 when `workspace_id`, `configuration_version_id`, `operation` or `auto_apply_after_plan` appears at the top level beside `data`, instead of ignoring the member, because a client that relies on one of them would otherwise get a different kind of run than it asked for.

A destroy run can be refused by the workspace it targets. Every workspace has an `allow-destroy-plan` attribute, on by default, that says whether destroy plans can be queued on it. Creating a run with `is-destroy: true` on a workspace where the attribute is `false` answers `422 Unprocessable Entity` with the error document `{"errors": [{"status": "422", "title": "Unprocessable Entity", "detail": "Destroy plans are not allowed on this workspace: its allow-destroy-plan setting is off. Turn the setting on to queue a destroy run."}]}` and creates no run. Runs that are not destroys are accepted whatever the attribute says. A caller who is not allowed to create runs on the workspace receives the `403` or `404` it would receive for any run, and a locked workspace answers `409`, before this rule is considered. The attribute is accepted when the workspace is created and when it is updated, and the value sent is the value stored.

### Endpoints that do not use JSON:API by design

Some endpoints implement a protocol that defines its own bodies, and they follow that protocol. The run log endpoints return plain text, `GET /api/v2/ping` returns the text `pong`, and state downloads, the plan's JSON output, configuration version downloads and the inventory exports return the file itself. A configuration version upload takes a raw `tar.gz` body and registry uploads take multipart form data. The run action endpoints answer `202 Accepted`: discard, cancel, force-cancel and force-execute with an empty body, and apply with the updated run. Locking a workspace and overriding a task stage take the small plain JSON bodies Terraform Enterprise defines for them (`{"reason": "..."}` and `{"comment": "..."}`). The runner control plane under `/api/v2/runner` exchanges flat JSON with the runners and still reports errors in the JSON:API error document. Webhooks are received in the format the sender defines, which covers the GitHub and Azure DevOps receivers, the identity provider's action callbacks and the Ansible provisioning callback. The Terraform login endpoints and the Azure DevOps OAuth callback follow OAuth 2.0. Outside `/api/v2`, the health check, the `/.well-known` documents, `/openapi/stable.json`, the module and provider registry protocol under `/v1` and the `/auth` proxy each follow their own specification.

### Endpoints that take or return plain JSON

A number of endpoints that belong to Stackweaver alone, with no Terraform Enterprise counterpart to match, take or return plain JSON objects instead of JSON:API documents. Their errors are JSON:API error documents like everyone else's.

In the Ansible area these are updating a schedule, validating a cron expression, listing cron presets and the schedule's enable, disable and run-now actions; creating, updating and attaching notifications; attaching a credential to a job template and launching a workflow; and the playbook bulk import, find-or-create, VCS file listing and job output endpoints.

Elsewhere they are `POST /api/v2/tokens`; creating a VCS connection, the repository, project, branch and file listings of a connection and the two install-URL endpoints; creating a registry module and deleting all modules; creating a state version, listing state versions and removing a resource from state; the list of platform variable names; and everything under `/api/v2/settings`, which covers the profile, two-factor setup, sessions and API keys. `GET /api/v2/activities` returns JSON:API resources with the different pagination block noted below. Reading one file of a connected repository with `GET /api/v2/vcs-connections/:id/repositories/:owner/:repo/contents/*path` answers `{"data": {"content": "...", "path": "...", "ref": "..."}}`, where `content` is the text of the file and `ref` repeats the `ref` query parameter. That parameter names a branch or a commit, and without it the file is read from the repository's default branch.

The explorer and the OpenAPI document show the exact request and response of each of these endpoints. The exceptions are covered under [What it does not promise](#what-it-does-not-promise).

## What the document is derived from

Nothing in the document is transcribed by hand, and nothing is written from annotations. Each part comes from the server itself.

The responses are recordings. A test harness drives every registered route against a freshly seeded database and records exactly what came back, and the response schemas are built from those recordings.

The requests are recordings too. For every endpoint that changes something, the harness sends a request the server accepts, each against its own copy of the seeded data, and records the request and the answer. The example an operation shows is that accepted request, with identifiers, timestamps and secrets replaced by placeholders such as `<uuid>`, `<timestamp>` and `<secret>`, so it shows the shape to send and is not a request to replay byte for byte. A recording is refused unless the server answered it with success, so an example here is never a request the server rejects.

A request body's schema says where it comes from. Where the server decodes the body into a typed value, the schema is that type: it lists every member the endpoint accepts, including the ones the example does not send, and marks a member required where the type requires it. A rule the server enforces in its own code, such as one member being needed only beside another, is not part of the type and is not shown. Where the server reads the body another way, as with the login proxy's pass-through bodies, form posts and inbound webhooks, the schema is the shape of the accepted example and says so, because a member that example does not send may still be accepted. An endpoint recorded succeeding with no body says that it takes none, and an upload is described as the binary body it is.

The query parameters are read from the code. An operation declares exactly the parameters its endpoint reads by name, in the handler and in the functions the handler hands the request to. A filter an endpoint does not read is therefore not listed for it, however natural it would be to expect one.

That matters when you are deciding how much to trust the document. It cannot describe a response the server does not give or a request the server does not accept, because both were produced from an actual exchange.

## What it does not promise

Some things are honestly marked rather than quietly glossed:

- **Some resource families are not present in the seeded data** the read recordings were made against, so reading them is described from the not-found response rather than a populated one. They are VCS connections, state versions, configuration versions, plans and applies. The route, method and error shape of those reads are right; the payload of a successful read is not described. Creating a configuration version, uploading to it and creating a state version are recorded like every other write, and show their real responses.
- **Reading your own account and credentials is described from its refusal.** Everything under `/api/v2/settings` manages the signed-in person's own account, `/api/v2/tokens` manages that person's personal API tokens, and `POST /api/v2/oauth/authorize` is the step of `terraform login` that the browser performs. All of these require an interactive sign-in, and a request authenticated with an API token of any kind, personal tokens included, is answered `403 Forbidden` with a JSON:API error document. The reads among them are recorded with an API token, so that `403` is the response the document shows for them. The writes among them are recorded as a signed-in person and show their real requests and responses.
- **A few writes are named instead of recorded,** because a successful call needs something a recording cannot supply, and each says which in its description. Completing a sign-in through an external identity provider, connecting a GitHub App installation and finishing the Azure DevOps authorization need the other service to answer. Finishing the registration of a passkey or a security key needs the authenticator to sign the challenge. Self sign-up and starting a sign-in through an external identity provider depend on how the identity provider of the installation is configured. For these the route, method and error shape are right, and neither the request body nor the success response is described.
- **An example shows one kind of request.** Some endpoints accept several, chosen by a member of the body: a credential's `credential-type`, a schedule's `schedule-type`, a notification's `destination-type`, the provider of a workload identity configuration. The schema lists every member the endpoint accepts, and the example shows one of the kinds.
- **The run log endpoints, `GET /api/v2/ping` and the INI export of an inventory return plain text**, not JSON, and are documented as such.
- **`GET /.well-known/jwks`** publishes key material that changes with each server process, so its schema is written out rather than recorded.
- **One endpoint paginates differently.** Every collection returns the Terraform Enterprise `meta.pagination` block except `GET /api/v2/activities`, which reports `{limit, offset, total}` instead. The document records what each endpoint actually returns, and an integration test fails if a second one drifts.

## Keeping it honest

The document is committed to the repository and regenerated by `go run ./cmd/openapi-gen`. Continuous integration fails if the committed copy differs from what the generator produces, and an integration test builds the real router and compares it operation by operation, in both directions: a route with no operation fails, and an operation for a route nobody serves fails too.

The write recordings are checked where they can be made: on a developer's machine, against a queue, a bucket and an identity provider of its own, as part of the integration run every backend change goes through before it is merged. That run fails when an endpoint that changes something has neither a recording nor a stated reason for lacking one, when a recorded request stops being accepted or its answer changes, when a request body's schema differs from the type the server decodes into, and when the query parameters an operation declares differ from the ones its endpoint reads.
