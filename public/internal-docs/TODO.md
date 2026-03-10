<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# TO DO

> [!NOTE]
> We cannot go commercial while we are offering managed terraform - opentofu will be first class citizen on our platform

> [!IMPORTANT]
> VCS Provider support can be ripped from:
> - https://docs.otf.ninja/vcs_providers/
> - https://docs.otf.ninja/vcs_providers/forgejo/

## issues found / potential improvements

- we need to rename the package from iac-platform to stackweaver

- OIDC integration !!
  - Azure Done
    - SSO
    - Workload identity execution
  - Okta Done

- [ ] When editing job template, the verbosity is not a dropdown. now you can only enter number 0-4

- [ ] it would be nice if we were able to enable / disable the main features in the sidebar for organisations - just a visual cosmetic thing in the UI, that would make the org view look cleaner for people that do not want to use it. we should have them enabled by default tho but when we create the org it would be cool if we can configure it there with a checkbox ? wwe should then also be able to edit the organization to re enable it - again its just a cosmetic thing for the frontend should be able to somewhere in the orgs settings

- [x] add option to edit ansible.cfg
  
- currently we only allow 1 vcs connection to the same VCS platform - we should allow for multiple connections enabling multi tenancy for orgs with multiple github orgs / accounts for example

## Requesting feedback


## General

- change checkboxes into shadcn switches

- Fully test out all the features - automate some of it ?

- For our SaaS version we will need to implement some kind of metering module that can be easily added and removed from the codebase so that we can only use that on our platform and not in the distributed images for self hosting.

---

- we need to verify that both frontend and backend are using JSON:API and not that simplified format !! I think its using a mix of this stuff everywhere we need to get rid of that simple format, agent audit said this

```js
// Install a JSON:API helper (or use your existing getRelationship util)
import { Jsona } from 'jsona'; // or json-api-normalizer
const dataFormatter = new Jsona();

// Simplify all your API functions
export const workspacesApi = {
  list: (organizationName: string) =>
    apiClient.get<JsonApiResponse>(`/organizations/${organizationName}/workspaces`)
      .then(res => dataFormatter.deserialize(res)),
  
  get: (organizationName: string, workspaceName: string) =>
    apiClient.get<JsonApiResponse>(`/organizations/${organizationName}/workspaces/${workspaceName}`)
      .then(res => dataFormatter.deserialize(res.data)),
};
```

7. ⚠️ **TODO**: Add permission auditing/logging for security compliance
8. ⚠️ **TODO**: Add unit tests for permission enforcement


---

- the individual delete of a terraform state resource is not working / full delete is working

<!-- - the main user dashboard needs to be updated with ansible things -->

- I will need some kind of cleaning function that will remove output from plans and job runs etc after a sensible time so we are not incurring data for no reason - configurable by the user ofcourse

## Cosmetic Styling

- use highlighting with the same gradient as our logo - currently not consitent not even on our logo :D we need to find the single gradient we will be using everywhere

- we need to fix the light mode the dark black highlights and buttons is way to contrasting with our gradients... we need to make that better so it fits with the standard gradient, what dou you think? add the gradient instead of the white/black thing on all the highlighted buttons?

- **Icon Colors**: See `docs/frontend/icon-color-guidelines.md` for consistent icon color standards. All icons must use semantic colors except buttons, which keep default styling.

## Terraform

- fix apply output to look more like tfe [check](image.png) on how they do it we just need to take out the time and put it next to the thing and remove the rest of the text for the time but keep the id in a nicer parsed way save on vertical space and allow to extend to see full string if multiline

- A status check for a pull request on github.com when running speculative plan from a branch

- run details filter on:
  - operation
  - source
  - [x] status

- we are missing a bunch of operation types:
  - save plan
  - refresh only
  - empty apply

- on pr speculative plan add some extra details about which VCS provider was used (once we do more providers then just github) also which branch it was triggered from could be useful

- We currently only have remote execution on our platform managed runners, we should make it easy for people to self host them just like on TFE
    - create a fully separated component ? This would allow us to distribute a custom image, not sure currently tho we need to think a bout the bests ways to do this kind of stuff.

- ~~when we get deprecation warnings they should be show in a separate card with a warning icon and in yellow translucent color - similar to how we did it for ansible~~ **Done** — `WarningDisplay` component shows warnings/deprecations in yellow/orange cards with file/line info for all run types
    - add a deprecated resource to stackweaver-tests so we will be able to test it
    - add a new directory with envs/prd so we can test if setting another defautl direcotry works I never tested that

- verify our github apps endpoint is compatible with the provider: https://developer.hashicorp.com/terraform/cloud-docs/api-docs/github-app-installations

- offer the same functionality as digger: users can run in their own pipelines easily - should be easily handled by our self hosted runners mechanisme

### Runs / workspaces

- when a plan and apply run gets cancelled when it was in planned state we are not seeing the cancelled icons on the resource detail cards in the apply phase, its putting the pending icon above, this is incorrectly representing the state and should use the cancelled icon in those places.

- we should allow to force delete a workspace, currently if a workspace has infra it cannot be deleted but we should allow for a force delete option

- we should parse terminal output to add color coding to it, I am thinking colored icons for the + - and tilde icons, similar to how terraform adds color coding to it's terminal output only makes sense to make it match because right now its just white/black text depending on dark/light mode

- when on the workspace detail view we should be able to edit the description inline by simply clicking on the text instead of having to go through the edit menu

- we should add a summary of the resource impact to the run detail cards in the workspace detail next to the badges on the right side so we can easily see the impact each run had instead of having to select it and open the cards - probably also add the summary on the rundetail in the header so its easy to get it in 1 glance we already have a resource impact component on the latest run card we should reuse that one

- in raw output viewer on the apply card we should load the terminal output by default because the json output takes a long time to parse 
  - there is a bug that it is also doing that on the plan card but on the plan card it should show the plan by default

- The JSON viewer lag when clicking the JSON tab in raw output is an issue... could we increase performance here somehow currently the UI lags for a couple of seconds when we click that button


- investigate the execution modes and figure out if we can somehow easily plug into existing CI/CD runners like github actions or whatever, should be only running a container action for github for example...

- on the error output viewer we could get rid of the redundant error: add the beginning the icon should be enough 

- on run detail remove the redudant status icon on the right side of the plan and apply cards and integrate them into the phases, for the plans make it the big circle that is grey now make that one blue and for the apply its already showing the blue loading statusses on the objects so its fine, this will remove redundant icons which is good for the experience. - figure out what to do with this there can be many ways we could also remove the icons from the time things... not sure but we need less redundant icons.

- on the error parsing we need to check if its parsing the 'with module.resource...' so we know in which module call the error occored not sure if it already does that need to test with a module.

- MAYBE ?? when no changes are detected in the plan phase could we alos add the view raw output section to the botton of the card ?

- we should remove the "-,_" and special chars from the ID generator.

- on the run detail view we have a started at time pointing to finished time, it would be great if we add a = and then how much time it actuall took because now we kinda have to calculate the difference ourselves which is not very intuitive

- on the run details we need a section for resource impact just like on the last run card that shows the summary of changes at the top so  you can get that info at a quick glance.
  - we also need a current badge as in tfe for the current applied state, we dont get have the concept of a current run yet but we should this can only be a plan and apply run or destroy run not a plan only run - check tfe run detail for example its different from the latest run that is on the main workspace overview, this one is only visible on the runs overview at the top it has a separate section - investigate

- verify that state model is correctly created with same structure as original TFE: https://developer.hashicorp.com/terraform/cloud-docs/api-docs/state-versions

- we should show the readme.md that is in the working directory of the workspace in the workspace detail - tfe also does this under the resources table - just like for modules

- we need to implement run triggers: https://developer.hashicorp.com/terraform/enterprise/api-docs/run-triggers

- properly test the flow end to end including all edge cases
    - it's possible that there is a bug when we delete states a lot - see if we can reproduce and fix if needed

- e2e tests for the new and improved variable(sets) configs need to be done

- the resource changes header on both applied and plan detail view seems rather redundant aswell

- we need to save on virtical space

- when a run is finished, on run detail the frontend keeps calling the backend every second this seems to be unintentional and should probably not be done if the run is clearly in a finished state - we need to make sure we are not breaking anything here tho in terms of the workspace flows

- The latest run card now dynamically fetches and displays plan duration, apply duration, and resources changed metrics. Cost change and policy check fields remain placeholders for future implementation when those features are built out.


#### Plan phase

- when we have the plan phase card the diff of the resource we are currently unable to expand the unchanged atributes- we should be able to expand them to show them for clarity its good that they are hidden on default but we should be able to show everything when we click on it that iss curently not possible

#### Destroy runs
- the destroy view needs to be changed to the apply output view - it is using the plan noiw but what would be better is if we show a list of all the items that will be removed and then while its applying do the same flow as the apply output viewer weher they get updated concurrently I think that would be ebtter then the flow we have right now whicih is just a spinning icon and then everytyhing removed at once maybe its better if we change the flow to showing the plan of everythign that will be removed and then traansitioning into a destroy phase after we have clicked confirm mathcing more the plan and apply flow instead of what we have now
  - I checked the way TFE implemented this and they have it hidden away in the settings - I think I should be able to do better, terraform entreprise is doing: Queuing a destroy plan will redirect to a new plan that will destroy all of the infrastructure managed by Terraform. It is equivalent to running terraform plan -destroy -out=destroy.tfplan followed by terraform apply destroy.tfplan locally. This means it is instead a plan and apply flow so we can enhance our experience for that to match better the plan and apply flow and also allow to cancel it mid run etc currently its not properly being cancelled I think bhecause i clicked cancelled and it still removed all the state
- the resource overview on workspace detail should also be cleared by creating a new empty state object - if this is tfe behaviour


- IGNORE OLD: when the destroy run is runnig it is not showing the loading state as the plan is doing its showing no resources impacted which is inccorect as it later prints resourcesthat were removed once finished so we need to add a proper pending / loading state there on par with how we do it for a plan when that is plannig


#### Apply phase

- for the apply phase we should parse the ID out of the output better and parse that cleaner next to the text for an easy copy instead of only on viewing the details of the resource card on the apply card


### variables

- test compatibility with terraform provider - https://registry.terraform.io/providers/hashicorp/tfe/latest/docs/resources/variable requires full compatibility

### state & lock

- [x] we need to show vcs config on states created via vcs push just like we do on run cards

- investigate if when we run a destroy run we also want to wipe all the states - not sure how to handle this
- [ ] **Destroy run flow improvement**: Destroy runs should work like plan-and-apply runs with confirmation before moving to destroying state. Currently destroy runs execute immediately without showing plan output or requiring confirmation. See GitHub issue #89 for details.

- verify if we want to keep the state #1 #2 pattern or just use the ID of the state in its place

- [x] verify that the locking function also works when we are running applies on the state via the runners to prevent state corruption and is not just the manual feature that we have correctly implemented at the moment - and make sure this is compatible with terraform entreprise: https://developer.hashicorp.com/terraform/enterprise/api-docs/workspaces#create-a-workspace
  - [ ] should be okey but needs some extra prod testing

- [x] verify that the state thing is fully tfe compatible: https://developer.hashicorp.com/terraform/cloud-docs/api-docs/state-version-outputs / https://developer.hashicorp.com/terraform/cloud-docs/api-docs/state-versions
  - [ ] should be okey but needs some testing

### Drift

- we need to verify if the current drift detection implementation is the same as terraform entreprise because if it isn't then we cannot use their provider to configure it which is bad we need to use the exact same semantics: https://developer.hashicorp.com/terraform/enterprise/api-docs/workspaces
 - I am also not seeing anything in the UI to configure it - We are missing the UI implementation

## Ansible

- [ ] checkout terminal-output-implementation-plan.md for improved ansible output

- we have normal rbac for the moment on ansible resources (read write admin) we will need to go more fine grained just like we did for terraform entreprise

- the collections view should be made dynamic when we have the managed runners feature in the UI we should parse the images periodically of the runners for which extensions they have installed so we can offer a nice dynamic view

- when importing an inventory with the same group keys and host keys we are passing it as succesfull, we should show an error that ansible is not able to do this

- [x] when making commit to ansible inventory repo we should auto update via webhook

- when changes are made to inventory and they are already linked in a job template the inventory does not auto update in the job template with the new values, this must happen since they are not static - can we review the implementation and make sure that this is dynamicly updated. We need to fully remove the inventory and job template before we can launch with the new inventory context

- now that we have a proper streaming architecture for the terraform runners we should do the same for the ansible runners the current polling feature has a 2 second delay which is not optimal, the platform should feel realtime so we need to go the redis route

- check which awx features we are missing here and which we want to adopt here: https://legacy-controller-docs.ansible.com/automation-controller/4.7/html/controllercli/

- show inventory example ?

See [docs/features/ansible/](../features/ansible/) for all Ansible documentation:
- [Implementation Status](../summaries/features/ansible/implementation-status.md) - current feature completion
- [Roadmap](../features/ansible/roadmap.md) - future features and AWX comparison

## Usage

might need to do some minor moving around of the fields so they fit better into the grid - but overal functionality is working

## CI/D

- Create proper CI/CD
    - build binaries & containers with custom action.
    - We need to think about how we will distribute the product, I guess mono repo is fine we just distribute the components separately - think we need some refactor here before we can distribute effectively.
    - add proper testing and scanning in CI
    - CI That runs on PR and push to main, deploy not sure yet how we will tackle...

- we need to have something parse the commit messages to create a changelog on push to main - important implement this ASAP ! this will help in releasing the version tags right now we tag but with no info / release

- [x] we need to add some githook that will run the linters on each commit with the --fix option to make sure we catch easy issues like formatting early before commiting

## Completed

### Terraform

- [x] when making a PR to main branch in workspace linked git repo we should run a speculative plan (plan only)

- [x] when the plan is running in run detail (showing its blue state) the middle plannig animation with the spinning circle is now blue to be consistent with the rest of the theming, it's grey on pending state

- [x] added info about vcs to states and run cards if triggerd from vcs - which commit which branch etc should already be there for run cards but we need it on state cards aswell

- [x] ANSI chars are now filtered out of raw text (terminal) output so users get clear feedback

- [x] phases now dynamically update and parse state incrementally so no more having to wait untill the end of the process to write to minIO we fetch state incrementally and dynamically from redis endpoint (implemented in #51)

- [x] Legacy models removed - RunOperationPlan and RunOperationApply have been removed from models and all code paths cleaned up.
- [x] The change summary cards are now configurable through user preferences. allow to configure more verbose or leaner output
- [x] workspaces can now be edited after initial creation
- [x] we now have extensive icon integration for all of the most common provider brand icons.

- [x] **Terraform Workspace Run UI Enhancement**: See `docs/terraform/workspace-run-ui-enhancement.md` for comprehensive implementation plan to unify timeline and output sections into a space-efficient, Terraform Enterprise-inspired layout.
- [x] the output raw json of the applied card is not properly being parsed - but for the applied card its fine so just check the diference I am seing everything wrapped in a logs : {} for the applied...

### Ansible

- [x] When editing a job template, it does not show the current configured credentials, and also not able to select any existing credentials.
- [x] inventories from vcs could be cool for bulk creation and programmability 
- [x] when ansible inventory is synced from VCS we are not given a notification only that the sync started not when it completed - we should make that more obvious by sending a notification to the UI like we do for when it starts
- [x] the current inventory from vcs flow in the UI is incorrect, its the same as a static invenotry - we should allow to select VCS connection just like we do in onther components and select the inveotry file from there - like we do in playbooks etc - would be nice if it also auto fils the dropdown with all possible files in the inventory format I think thats yaml right ? or what type of file does it expect ? look at how we did it for playbooks - have a look here at the official docs for all the things we can parse out of those inventory files: https://docs.ansible.com/projects/ansible/devel/inventory_guide/intro_inventory.html

<!-- - Fix the workspace detail to show correct details when triggering a run, currently all runs show triggerd via CLI but the VCS runs should show who did it with commit context and runs via the portal should say 'triggered via UI' - there is a field for that in the basic spec that should cover it just like we are using in other run scenarios = https://developer.hashicorp.com/terraform/cloud-docs/api-docs/run#run-sources

- Drift detection functionality in the terraform workspaces to run plans on schedule to detect drift - See `backend/internal/services/terraform/drift_detection.go` for implementation

- The locking functionality - when a workspace is running it should lock the state and when done unlock - See `backend/cmd/runner/main.go` for implementation (locks at run start, unlocks at completion/failure/cancellation)

- Can't delete a workspace after applying runs - Workspaces with applied runs are now protected from deletion. See `backend/internal/api/v2/handlers/terraform/workspaces.go:758+` for implementation -->

**competitor:** Spacelift, Scalr, env0, cloudposse

**similiar open source project**: 
- https://docs.otf.ninja/
  - https://github.com/leg100/otf
- https://www.reddit.com/r/Terraform/comments/15p2p32/impact_of_new_licensing_on_open_source/
  - https://www.hashicorp.com/en/license-faq

### Reference projects
https://github.com/ansible/awx-operator


# **Potential Enhancements**

Below are various enhancements that can be added to the project at a later stage

## Terraform

- Policy engine integrations

- for the terraform provider we will first try to match the existing tfe provider as close as possible and afterwards add our own implementation to it when we fully fork their product

## Ansible
- ansible galaxy private / public registry integration

- we will not be maintaining compatiblity with the existing awx collection since the project is canned and fully deprecated we will make our own implementation
  - a list of modules we should potentially support can be found here: https://docs.ansible.com/projects/ansible/latest/collections/awx/awx/#modules

## Long Term

- Split orchestrator, runner and api into separate code bases ?

## Decide on dns name

stackweaver.app / .org / .co / .me / .pro / .eu / .be / .cc / .build / .gg / .it / .run / .tech / .vip / .sh

# Possible expensions on our current offering:

- bicep ?
- pulumi ?
- CDK ? ACK ? ASO ? Crossplane ?
- I guess chef and puppet are dead so we shouldn't bother


landing page inspiration: https://devtron.ai/
- use a blue/purple hue