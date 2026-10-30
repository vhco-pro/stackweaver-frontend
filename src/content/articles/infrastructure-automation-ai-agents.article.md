---
title: "Infrastructure automation with AI agents: keeping the work in Git"
description: "How Stackweaver connects AI agents to reviewable infrastructure workflows through documented interfaces and Git."
canonical: /blog/infrastructure-automation-ai-agents
author: Michiel VH
status: published
published: 2026-10-30
updated: 2026-10-30
topics: [AI agents, GitOps, Ansible, OpenTofu]
---
An AI agent can write a Terraform configuration or an Ansible playbook.
Getting that code into a workflow a team can trust takes more than generating the right files.
Someone still needs to review the change and decide where it can run.
The result has to be available to the next person working on the infrastructure.

That is where I want Stackweaver to fit.
I want agents to work with the same infrastructure automation platform the team uses, through interfaces that make sense for the job.
The work should stay understandable when you open the repository without the conversation that produced it.

![An agent proposes a change for a shared review process.](/blog/images/agents-and-review.svg "AI assistance fits into the workflow your team can review.")

## Infrastructure code still belongs in Git

My starting point is the same whether a person or an agent writes the code: put the intended change in version control.
A pull request gives the team something concrete to review.
It also means the next run can start from a known revision, rather than from files left over in someone's agent session.

For example, suppose an agent is helping add a service to an environment.
It can propose the OpenTofu configuration in a branch and explain the expected change in the pull request.
The workspace produces a plan against its current state.
A reviewer can inspect what that plan would actually do before allowing the apply.
If the service also needs configuration, an Ansible job can run the playbook kept in that repository.

The plan matters even when the generated code looks perfectly reasonable.
The code describes an intention.
The plan shows how that intention relates to the state the workspace is managing.

I want the agent to help with this process, including reading a failed run and proposing a correction.
I also want another engineer to be able to pick up the work without recreating the agent's chat history.
Git provides that shared starting point, and Stackweaver keeps the execution results with the relevant job or workspace.

![Stackweaver's OpenTofu run view, showing a finished plan phase and resource-level apply progress.](/docs/features/opentofu/images/run-live-output.png "The run view keeps the finished plan phase beside resource-level apply progress.")

## Give agents an interface they can work with

A platform that can only be operated by clicking through pages creates unnecessary work for automation.
An agent should be able to use a documented interface to ask for a run and inspect what happened.

Stackweaver's API is the foundation for that.
The [API reference][api-reference] describes the requests and responses, so an integration can use the platform directly.
The same approach works for a small script or an existing CI pipeline.

For agents working through Model Context Protocol, the MCP integration makes Stackweaver operations available through tools the agent can call.
The CLI gives terminal-based agents and operators a way to work with the platform from their existing environment.
These interfaces connect to Stackweaver's API and use the permissions of the identity making the request.

> I don't want the choice of agent to decide where your infrastructure has to live.
>
> <cite>Michiel VH, founder of Stackweaver</cite>

A team should be able to change the agent it uses while keeping its repositories and the automation around them.
An API and documented interfaces make that a practical choice.

![CLI, provider, MCP and operator clients connect through the Stackweaver API.](/blog/images/interfaces-shared-platform.svg "The API connects the platform to the tools your team uses.")

## Declare the platform configuration too

There are two kinds of infrastructure-as-code work here.
Your workspace configuration describes the infrastructure you want OpenTofu to manage.
The configuration of Stackweaver itself can also live in Git.

The [Stackweaver Terraform provider][provider-guide] lets you declare platform resources with Terraform or OpenTofu.
An agent can propose a change to that configuration through the same review process as other infrastructure code.
The provider manages the supported platform resources through the API.
It does not install the Stackweaver server or turn every operational action into a resource you need to keep in state.

The Kubernetes operator provides another declarative path for teams that manage their platform through Kubernetes.
It reconciles the Stackweaver resource definitions you keep in Git.
Teams already using a GitOps controller can include those definitions in their existing process.

I want both paths to be useful in their own environments.
If your team manages platform configuration with Terraform, use the provider.
If Kubernetes resources are how you declare that configuration, use the operator.
Self-hosting Stackweaver itself remains a separate deployment choice, with Docker Compose and Helm covered in the [installation guides][self-hosting].

## Keep permission separate from a good suggestion

Giving an agent access to the platform is an access-control decision.
A convincing explanation of a change does not tell you whether that agent should be allowed to apply it to production.

I would start an integration with the access it needs for the task.
An agent helping investigate a failed run needs to inspect the relevant results.
That does not automatically mean it needs permission to launch another run or change the workspace's configuration.
Use [API tokens and permissions][tokens] for the identity connecting to Stackweaver, and keep the approval step appropriate to the environment.

The data you send back to an agent needs the same attention.
A run log or plan can contain details about your infrastructure.
Self-hosting the automation platform does not make those details private if you then send them to an external model service.
Decide which context the agent needs and which model service your team is willing to give it to.

For production changes, I want a workflow where the team can inspect the proposed action before it happens.
An agent can help prepare the change and investigate the result, while the platform remains the place where execution is coordinated.

## Put the integration around the workflow

There are useful jobs for agents throughout infrastructure work.
They can help write a playbook, or explain why a plan failed and propose the next change.
I want that help to fit the way a team already manages its infrastructure.

Stackweaver gives those interactions a common platform, with Ansible jobs alongside OpenTofu workspaces.
The API and its clients make that platform usable from an agent as well as from the browser.
The repository keeps the intended configuration available to the whole team.

That is the AI integration I care about: an agent can do useful work, and the team can still understand what it ran.
For the broader business and product vision, read [why I'm building Stackweaver][founder].

[api-reference]: /docs/api-reference/explorer
[provider-guide]: /docs/user-guides/terraform-provider
[self-hosting]: /docs/get-started/self-hosting
[tokens]: /docs/user-guides/terraform-provider
[founder]: /blog/why-i-built-stackweaver
