---
description: "Guide to reading the Usage & Analytics page: delivery health, success rates, durations, and audit activity for an organization"
covers:
  - "frontend/src/pages/Usage/**"
  - "backend/internal/api/v2/handlers/analytics*"
  - "core/repository/analytics*"
---

# Usage & Analytics

The Usage & Analytics page answers one question about an organization: is your automation healthy, and if not, what broke. You reach it from **Usage** in the sidebar, and everything it shows is scoped to the organization named in the page header and to the time range you select.

## Choosing what you are looking at

The time range picker in the top right offers the last 7, 30, or 90 days, or the current month to date. Every figure on the page, including the busiest-workspace tables and the audit breakdowns, is bounded by that range. Organization is chosen from the selector in the application's top bar, the same one used everywhere else; switching organization keeps you on this page, showing the new organization's figures.

The page compares the range you picked against the period of the same length immediately before it. That comparison is what drives the small change indicator beneath each headline number, and the header restates it in words so you always know what "compared with previous 30 days" is measuring.

## The headline numbers

The row of tiles across the top is the summary you can read in a glance. It shows how many Terraform runs the organization started, what share of them succeeded, how long an average run took, how many executions are in flight right now, and how many Ansible jobs ran. Each tile carries a small sparkline showing the shape of that measure across the range, and an arrow indicating whether it moved up or down against the previous period. The arrow direction is paired with colour rather than replacing it, so the direction is still readable if you cannot separate the green from the red.

A dash instead of a number is meaningful and is not an error. Success rate and average duration are only defined once something has actually finished. An organization whose runs are all still queued or in progress has no success rate to report, so the page prints a dash and explains underneath that nothing has been decided yet, rather than reporting a misleading zero percent.

## Reading the success rate

The success rate is the share of *decided* outcomes that succeeded: runs still queued, planning, or applying are excluded from both sides of the fraction, so starting a lot of work does not temporarily depress the number. A Terraform run counts as a success when it reaches `applied` or `completed`, and also when a plan-only run reaches `planned`, because a plan-only run has no apply phase to reach and is finished at that point. The same run status on a plan-and-apply run means it is waiting for you to confirm the apply, so it is counted as pending instead. For Ansible, a job counts as a success when it is `successful`, and as a failure when it is either `failed` or `error`.

## The four tabs

**Overview** leads with executions per day across both platforms, stacked so you can see at a glance how much of each day's work failed. Beneath it, the platform split shows how the period divided between Terraform and Ansible, and the recent failures list names what broke most recently. That list is the actionable part of the page: each entry links straight to the run or job that failed.

## Drilling into a day

The daily charts are not just pictures. Selecting a bar opens a panel listing the individual executions behind it, and the panel opens on precisely what you selected: choosing the red section of a day starts you on that day's failures, and doing the same on the Terraform or Ansible tab narrows it to that platform. Each row names the workspace or job, its status, what time it started, and how long it took, and links to the execution itself so you can go straight from a spike in the chart to the thing that caused it.

You are not locked into the segment you clicked. The buttons at the top of the panel move between the outcomes that day produced and the whole day, so you can start from a failure and widen out to everything that ran alongside it. They only ever offer outcomes that exist: a day with no failures has no failed button to press, and a day where everything succeeded has no filter row at all, because there is nothing to choose between. Each button carries its own count. When a day contains both Terraform runs and Ansible jobs, the panel splits them into separate sections that you can collapse independently, which lets you fold away one platform and read the other without the two interleaved by timestamp. Days with an unusually large number of executions show the most recent hundred and say so.

**Terraform** and **Ansible** are the same shape as each other. Each opens with that platform's daily volume and a status donut whose centre carries the success rate and whose legend lists every status with its count. Below them you get duration, reported both as an average and as a 95th percentile so a slow tail is visible rather than hidden inside the mean, together with the number of completed executions the figures are based on. The last card ranks the busiest workspaces or job templates for the period, with each row's own success rate and average duration. The Ansible tab closes with a count of the automation assets the organization currently holds. Jobs launched ad hoc, without a template, are not listed in the template ranking, since they belong to no template.

**Activity** covers the audit trail rather than execution. It charts recorded events per day and breaks them down two independent ways: by the action performed, and by the type of resource it touched.

## When a card is empty

Cards state plainly when a period contains nothing to show, and that is different from a failure. If the whole page fails to load, you get an explicit error with a retry button rather than a screen of zeros, so an outage is never mistaken for an idle organization.

## Who can see it

You can only open the page for an organization you belong to. This is enforced by the API for both browser sessions and API tokens, so the page cannot be used to read another tenant's delivery metrics by editing the URL.
