---
title: "Why I'm building Stackweaver"
description: "My vision for an infrastructure automation platform people can use on their own terms, with a business built on expertise."
canonical: /blog/why-i-built-stackweaver
author: Michiel VH
status: published
published: 2026-10-30
featured: true
updated: 2026-10-30
topics: [Stackweaver, Vision]
---
I want good infrastructure automation to be accessible to people who aren't buying an enterprise software contract.
That is why I'm building Stackweaver.
The software should be useful to a developer experimenting with a project and to a team running a business.
I want to make a living from the expertise around it, while giving people a real choice about how they use the platform.

I build Stackweaver through VH & Co BV, my company based in Europe.
This is the direction I want to take it, including the parts of the business model that matter to me and why the source is available under BSL rather than an open-source license today.

![An open doorway beside a stack of infrastructure modules.](/blog/images/automation-your-terms.svg "Stackweaver is built around the choice of how you run it.")

## Start by running it yourself

A lot of the platforms I've looked at follow a familiar pattern.
There is a free tier to get started, then the product becomes more expensive as it becomes part of how your team works.
These are specialized tools, so the marketing and commercial model often aim at enterprise buyers.
Smaller teams can end up choosing between running a collection of tools themselves and adopting a service whose longer-term cost is hard to judge at the start.

I want to contribute an approachable platform that brings Ansible and OpenTofu together.

I understand that people need to get paid for building software.
I do too.
What I don't like is a business model that depends on making it increasingly difficult for customers to leave.
> I want people to keep using Stackweaver because it is useful and because they trust the people behind it.
>
> <cite>Michiel VH, founder of Stackweaver</cite>

Self-hosting is the main way to try Stackweaver at the start.
You can run it on your own infrastructure without buying a Stackweaver subscription, under the terms of its license.

I would like to offer a useful free SaaS tier later, but I need paying customers first.
Hosting the platform costs money, and someone has to maintain that infrastructure.
A free hosted tier has to be something the business can sustain, so I am not promising one at launch.

## AWX helped clarify what I wanted to build

I used to be able to install AWX and get a shared place for running Ansible.
That was an approachable way to move automation beyond one person's terminal.
The current AWX project is going through a substantial change, and I don't think teams choosing a platform should assume the old packaged experience is what comes next.

The [AWX repository][awx-repository] says releases are paused during refactoring.
The [modernization updates][awx-modernization] describe a direction built around customizable services and developer participation.
Red Hat's supported product is Ansible Automation Platform.

My reading of those updates is that participating in the upstream ecosystem and having a ready-to-run platform for your team are becoming different commitments.
I want Stackweaver to give teams a product they can use without having to assemble that wider ecosystem themselves.
The packaging and operation of the platform are part of the job I'm taking on.

There is another limitation to treating an Ansible controller as the whole answer: a team's infrastructure work rarely ends with Ansible.
Provisioning has its own state and review process.
I want those workflows to have a common home too.

## One place for infrastructure automation

Stackweaver starts with Ansible jobs and OpenTofu workspaces.
You can keep automation in Git and review infrastructure changes in a shared application.
The results stay available for your team to inspect.
The longer-term goal is broader tool support, including Pulumi and the other engines people use to manage infrastructure.
Terraform and OpenTofu workflows are part of that picture, rather than the limit of what the platform should become.

I don't want to force every team to rewrite its automation in whichever tool the platform happens to prefer.
I want to give the tools a consistent place to work together, while keeping their useful differences intact.
An Ansible job still needs its inventory.
An infrastructure workspace still needs its state and a reviewable plan.

The GitOps mindset is central to this.
Automation belongs in version control, where the team can review a change and understand what it is running.
The platform should make that work easier to coordinate and operate.
It should give people a shared view of the work without becoming the only place where their knowledge and configuration exist.

When I try to describe the ambition, I keep coming back to something like a GitHub for infrastructure automation.
The part of that comparison I care about is a common place for teams to work, while their automation stays in Git and uses the tools they choose.

![A software workspace beside a person representing the expertise around it.](/blog/images/software-and-expertise.svg "The software is free to self-host under its license. Hosting and expertise support the business around it.")

## The business is built around expertise

The SaaS is one way to use Stackweaver.
You manage your infrastructure through the hosted platform, while VH & Co operates that platform for you.
You are trusting the infrastructure experience behind the service, as well as using the application.

For customers who want more help, the relationship can go further.
VH & Co can help set up the automation or take on ongoing infrastructure work as an engagement.
That is the business I want to grow: people choosing to work with us because they trust our judgment and want our expertise involved.

Self-hosting fits that same model.
An enterprise can run Stackweaver on its own infrastructure and pay VH & Co to help deploy or maintain it.
Another team can install it and operate it themselves.
Docker Compose and the Helm chart support those different environments.
Paying for consultancy should be a choice, rather than a requirement hidden inside the installation process.

Paid hosting helps cover the costs of running the service.
I want the self-hosted software to remain free to use under its license, with paid hosting and expertise giving the business a sustainable way to support that work.
A customer should be able to understand what they are paying us to do.

## Why I chose BSL for now

Stackweaver is source-available under [Business Source License 1.1][stackweaver-license].
It is not currently OSI open source, and I want that distinction to be clear.
You can inspect the code and use the additional production-use grant to run it for your own business.
The restriction is around taking the software and offering a commercial managed Stackweaver service, or a substantially similar service, to other people without the appropriate permission.

I chose that boundary to give the project some protection while I build a sustainable business around it.
A larger company can have far more resources for packaging and selling something than the person who originally built it.
AI makes repackaging existing software easier, which makes that concern harder to ignore at an early stage.

I want to share the source and let people use the platform, while putting terms around commercially hosting that same work as a competing service.
That is the purpose of the license choice.
Trademark and logo rights are separate; BSL is the license for the software itself.

The current license already provides for each version to become available under Apache 2.0 through its change terms.
My ambition goes beyond that version-by-version transition.
> Once there is a sustainable business around Stackweaver, I would like to make the whole project fully open source.
> I don't have a date to promise for that decision, but it is the direction I want to move in.
> For now, Stackweaver is source-available.
>
> <cite>Michiel VH, founder of Stackweaver</cite>

## What I want people to choose us for

I want a developer to be able to try Stackweaver without needing a procurement process.
I want a platform team to be able to adopt it and keep control of its deployment.
When either of them needs help, I want VH & Co to be a company they choose because the expertise is worth paying for.

If this is the kind of platform you need, start with [an Ansible job][first-job] or [an OpenTofu workspace][first-workspace].
The [self-hosting guides][self-hosting] cover running it yourself.
I want Stackweaver to be something you can build on, and VH & Co to be a company you choose to work with.

[awx-repository]: https://github.com/ansible/awx
[awx-modernization]: https://forum.ansible.com/t/awx-modernization-moving-forward/45134
[stackweaver-license]: https://github.com/vhco-pro/stackweaver-api/blob/main/LICENSE
[first-job]: /docs/get-started/your-first-ansible-job
[first-workspace]: /docs/get-started/your-first-opentofu-workspace
[self-hosting]: /docs/get-started/self-hosting
