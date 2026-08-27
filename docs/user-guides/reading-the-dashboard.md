---
description: "Guide to reading the dashboard: a cross-organization view of what needs you, what is running, and where to go next"
covers:
  - "frontend/src/pages/Dashboard/**"
---

# Reading the Dashboard

The dashboard is where signing in lands you, and it is the one screen in StackWeaver that spans every organization you belong to. It exists to answer a question none of the other pages can: not "how is this organization doing", but "which of my organizations needs me right now".

That is why it has no organization selector. Everywhere else, choosing an organization is how you narrow down to the thing you came for. Here, being told which organization to care about is the point — if you had to pick one first, you could only ever be told about the organization you were already thinking of.

## Folding sections away

Every section folds away from its heading, and StackWeaver remembers which ones you closed, so a section you have no use for stays closed on your next visit rather than needing to be dismissed again. Closing a section also stops it fetching, so folding away live operations on a machine you leave open all day genuinely stops the polling rather than merely hiding it.

## What needs your attention

The list at the top is the page. Each row names one organization, one thing that needs doing, and how many of them there are, and takes you straight to where you would do it. Rows only appear when there is something to report, so the length of the list is the size of your problem — and an empty list is a single line telling you so, rather than a screen of zeroes.

The list covers OpenTofu and Ansible together, and the two are mixed rather than grouped, so the order tells you how urgent something is instead of which half of the product it came from.

Two rows mean **somebody is blocked on a decision right now**, so they sort to the top: an OpenTofu run that has planned and is holding until someone confirms the apply, and an Ansible workflow approval holding a workflow open until someone approves or denies it. They are the same idea under two names.

Two more mean **something has been left broken**: a workspace whose most recent run errored and which has not been run since, and a job template whose most recent job failed the same way — however long ago that was. These are the rows that surface what is quietly rotting rather than what just happened. Alongside them, **an inventory that failed to sync** means the hosts your next job would target are stale or wrong.

**Runners offline** tells you an organization has lost the capacity to execute anything at all, on either platform.

Then the recent failures, reported separately for **OpenTofu runs** and **Ansible jobs** inside a short window. These are the counterpart to "left broken": what went wrong lately, rather than what is still wrong. They are split by platform because which half of your estate is unhealthy is the actionable part, and the two take you to different places. A one-off ad-hoc job that failed shows up here but not as a "left failing" template — it was an event, not a piece of standing automation.

Last, **open change requests** are notes your team filed against workspaces.

If you do not administer an organization, you will not see its runner or change-request rows. They are omitted rather than shown as zero, because a zero would tell you nothing is wrong when the truth is that you were not shown.

## What is running right now

Live operations lists the OpenTofu runs and Ansible jobs executing anywhere you can see, oldest first so the longest-running work leads, each row naming its organization, how long it has been going and where it is in its lifecycle. It refreshes every few seconds while anything is running and slows down when your estate goes quiet, so leaving the page open is a reasonable way to watch a deploy — including one somebody else started, in an organization you were not looking at.

Runs waiting for you to confirm an apply are not listed here. They are not running, they are waiting, which is what the attention row above says about them.

## Your organizations

Below that, every organization you belong to gets a card with what it holds — projects, workspaces, playbooks — and one line saying what it is doing: what needs attention, what is running, or what succeeded this month. Organizations with something waiting are outlined, so you can see at a glance which ones are quiet.

These cards are also the navigation. There is no shortcut row on this page, because a button labelled "Workspaces" would have no organization to open; choosing which organization you mean is the step that has to come first, and selecting a card is that step.

For an organization's own numbers — success rates, durations, busiest workspaces, day-by-day volume you can drill into — open it and go to [Usage & Analytics](./usage-analytics.md). The dashboard deliberately does not repeat any of that: a smaller copy you cannot click into would be worse than the real thing one step away.

## Your recent activity

The list at the bottom is your own: the last few things you did, across organizations, with a link to the full activity log.

## When you are just getting started

Until you have an organization, a project and a workspace, the dashboard replaces the attention and live-operations sections with a three-step checklist that walks you through creating them, marking each step done as you go. A fresh installation has nothing running to report on, so the checklist is the more useful thing to show. Once all three exist, it stands down and the full dashboard takes its place.
