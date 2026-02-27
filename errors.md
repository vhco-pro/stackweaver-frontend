<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

> frontend@0.0.0 build
> tsc -b && vite build

src/api/ansible.ts(1083,7): error TS2554: Expected 1 arguments, but got 2.
src/api/client.ts(385,9): error TS2783: 'organization_id' is specified more than once, so this usage will be overwritten.
src/api/client.ts(385,60): error TS2339: Property 'data' does not exist on type '{}'.
src/api/client.ts(720,35): error TS2345: Argument of type '(item: JsonApiResource) => VariableSet' is not assignable to parameter of type '(value: VariableSetListResponse, index: number, array: VariableSetListResponse[]) => VariableSet'.
  Types of parameters 'item' and 'value' are incompatible.
    Type 'VariableSetListResponse' is missing the following properties from type 'JsonApiResource': type, attributes
src/api/client.ts(739,66): error TS2339: Property 'map' does not exist on type 'JsonApiResourceIdentifier | JsonApiResourceIdentifier[]'.
  Property 'map' does not exist on type 'JsonApiResourceIdentifier'.
src/api/client.ts(742,22): error TS2339: Property 'attributes' does not exist on type 'JsonApiResourceIdentifier'.
src/api/client.ts(743,24): error TS2339: Property 'attributes' does not exist on type 'JsonApiResourceIdentifier'.
src/api/client.ts(744,28): error TS2339: Property 'attributes' does not exist on type 'JsonApiResourceIdentifier'.
src/api/client.ts(746,27): error TS2339: Property 'attributes' does not exist on type 'JsonApiResourceIdentifier'.
src/api/client.ts(747,22): error TS2339: Property 'attributes' does not exist on type 'JsonApiResourceIdentifier'.
src/api/client.ts(748,30): error TS2339: Property 'attributes' does not exist on type 'JsonApiResourceIdentifier'.
src/api/client.ts(754,69): error TS2339: Property 'map' does not exist on type 'JsonApiResourceIdentifier | JsonApiResourceIdentifier[]'.
  Property 'map' does not exist on type 'JsonApiResourceIdentifier'.
src/api/client.ts(758,25): error TS2339: Property 'attributes' does not exist on type 'JsonApiResourceIdentifier'.
src/api/client.ts(759,32): error TS2339: Property 'attributes' does not exist on type 'JsonApiResourceIdentifier'.
src/api/client.ts(767,73): error TS2339: Property 'map' does not exist on type 'JsonApiResourceIdentifier | JsonApiResourceIdentifier[]'.
  Property 'map' does not exist on type 'JsonApiResourceIdentifier'.
src/api/client.ts(770,25): error TS2339: Property 'attributes' does not exist on type 'JsonApiResourceIdentifier'.
src/api/client.ts(771,32): error TS2339: Property 'attributes' does not exist on type 'JsonApiResourceIdentifier'.
src/api/client.ts(788,9): error TS6133: 'organizationName' is declared but its value is never read.
src/api/client.ts(803,20): error TS2339: Property 'attributes' does not exist on type 'VariableSetResponse'.
src/api/client.ts(804,27): error TS2339: Property 'attributes' does not exist on type 'VariableSetResponse'.
src/api/client.ts(806,22): error TS2339: Property 'attributes' does not exist on type 'VariableSetResponse'.
src/api/client.ts(810,26): error TS2339: Property 'attributes' does not exist on type 'VariableSetResponse'.
src/api/client.ts(811,26): error TS2339: Property 'attributes' does not exist on type 'VariableSetResponse'.
src/api/client.ts(821,22): error TS2339: Property 'attributes' does not exist on type 'JsonApiResourceIdentifier'.
src/api/client.ts(822,24): error TS2339: Property 'attributes' does not exist on type 'JsonApiResourceIdentifier'.
src/api/client.ts(823,30): error TS2339: Property 'attributes' does not exist on type 'JsonApiResourceIdentifier'.
src/api/client.ts(824,27): error TS2339: Property 'attributes' does not exist on type 'JsonApiResourceIdentifier'.
src/api/client.ts(825,22): error TS2339: Property 'attributes' does not exist on type 'JsonApiResourceIdentifier'.
src/api/client.ts(826,28): error TS2339: Property 'attributes' does not exist on type 'JsonApiResourceIdentifier'.
src/api/client.ts(837,23): error TS2339: Property 'attributes' does not exist on type 'JsonApiResourceIdentifier'.
src/api/client.ts(838,30): error TS2339: Property 'attributes' does not exist on type 'JsonApiResourceIdentifier'.
src/api/client.ts(849,23): error TS2339: Property 'attributes' does not exist on type 'JsonApiResourceIdentifier'.
src/api/client.ts(850,30): error TS2339: Property 'attributes' does not exist on type 'JsonApiResourceIdentifier'.
src/api/client.ts(883,12): error TS6133: 'organizationName' is declared but its value is never read.
src/api/client.ts(899,12): error TS6133: 'organizationName' is declared but its value is never read.
src/api/client.ts(902,21): error TS6133: 'organizationName' is declared but its value is never read.
src/api/client.ts(912,23): error TS6133: 'organizationName' is declared but its value is never read.
src/api/client.ts(914,76): error TS2554: Expected 1 arguments, but got 2.
src/api/client.ts(922,19): error TS6133: 'organizationName' is declared but its value is never read.
src/api/client.ts(932,21): error TS6133: 'organizationName' is declared but its value is never read.
src/api/client.ts(934,74): error TS2554: Expected 1 arguments, but got 2.
src/api/client.ts(943,19): error TS6133: 'organizationName' is declared but its value is never read.
src/api/client.ts(962,20): error TS6133: 'organizationName' is declared but its value is never read.
src/api/client.ts(1001,20): error TS6133: 'organizationName' is declared but its value is never read.
src/api/client.ts(1018,20): error TS2339: Property 'hcl' does not exist on type '{ key?: string | undefined; value?: string | undefined; sensitive?: boolean | undefined; encrypted?: boolean | undefined; category?: string | undefined; description?: string | undefined; }'.
src/api/client.ts(1018,53): error TS2339: Property 'hcl' does not exist on type '{ key?: string | undefined; value?: string | undefined; sensitive?: boolean | undefined; encrypted?: boolean | undefined; category?: string | undefined; description?: string | undefined; }'.
src/api/client.ts(1039,20): error TS6133: 'organizationName' is declared but its value is never read.
src/api/client.ts(1303,9): error TS2783: 'organization_id' is specified more than once, so this usage will be overwritten.
src/api/client.ts(1329,9): error TS2783: 'organization_id' is specified more than once, so this usage will be overwritten.
src/api/client.ts(1382,9): error TS2783: 'organization_id' is specified more than once, so this usage will be overwritten.
src/api/client.ts(1394,9): error TS2783: 'organization_id' is specified more than once, so this usage will be overwritten.
src/components/RunRedirect.tsx(24,18): error TS2339: Property 'workspace_id' does not exist on type 'JsonApiResponse<JsonApiResource>'.
src/components/RunRedirect.tsx(42,72): error TS2339: Property 'workspace_id' does not exist on type 'JsonApiResponse<JsonApiResource>'.
src/components/animate-ui/primitives/animate/code-block.tsx(92,21): error TS2503: Cannot find namespace 'NodeJS'.
src/components/gdpr/CookieConsent.tsx(58,9): error TS2367: This comparison appears to be unintentional because the types '"analytics" | "marketing"' and '"necessary"' have no overlap.
src/components/layout/Layout.tsx(1,10): error TS1484: 'ReactNode' is a type and must be imported using a type-only import when 'verbatimModuleSyntax' is enabled.
src/components/routes/OrganizationGuard.tsx(1,10): error TS1484: 'ReactNode' is a type and must be imported using a type-only import when 'verbatimModuleSyntax' is enabled.
src/components/runs/CollapsibleSection.tsx(1,20): error TS1484: 'ReactNode' is a type and must be imported using a type-only import when 'verbatimModuleSyntax' is enabled.
src/components/runs/PhaseBox.tsx(1,20): error TS1484: 'ReactNode' is a type and must be imported using a type-only import when 'verbatimModuleSyntax' is enabled.
src/components/runs/PhaseBox.tsx(160,27): error TS2339: Property 'createdAt' does not exist on type '{ terraformVersion?: string | undefined; agent?: string | undefined; startedAt?: string | undefined; finishedAt?: string | undefined; }'.
src/components/runs/PhaseBox.tsx(163,50): error TS2339: Property 'createdAt' does not exist on type '{ terraformVersion?: string | undefined; agent?: string | undefined; startedAt?: string | undefined; finishedAt?: string | undefined; }'.
src/components/runs/ResourceDiffView.tsx(819,13): error TS2322: Type '{ lines: DiffLine[]; onToggleUnchanged: () => void; onCopy: () => void; }' is not assignable to type 'IntrinsicAttributes & { lines: DiffLine[]; onToggleUnchanged: () => void; }'.
  Property 'onCopy' does not exist on type 'IntrinsicAttributes & { lines: DiffLine[]; onToggleUnchanged: () => void; }'.
src/components/runs/UnifiedPhaseTimeline.tsx(1,10): error TS1484: 'ReactNode' is a type and must be imported using a type-only import when 'verbatimModuleSyntax' is enabled.
src/components/runs/UnifiedPhaseTimeline.tsx(220,15): error TS2353: Object literal may only specify known properties, and 'createdAt' does not exist in type '{ terraformVersion?: string | undefined; agent?: string | undefined; startedAt?: string | undefined; finishedAt?: string | undefined; }'.
src/components/runs/UnifiedPhaseTimeline.tsx(273,15): error TS2353: Object literal may only specify known properties, and 'createdAt' does not exist in type '{ terraformVersion?: string | undefined; agent?: string | undefined; startedAt?: string | undefined; finishedAt?: string | undefined; }'.
src/components/runs/UnifiedPhaseTimeline.tsx(298,15): error TS2353: Object literal may only specify known properties, and 'createdAt' does not exist in type '{ terraformVersion?: string | undefined; agent?: string | undefined; startedAt?: string | undefined; finishedAt?: string | undefined; }'.
src/components/runs/VerticalRunTimeline.tsx(192,25): error TS2591: Cannot find name 'process'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
src/contexts/AuthContext.tsx(1,58): error TS1484: 'ReactNode' is a type and must be imported using a type-only import when 'verbatimModuleSyntax' is enabled.
src/contexts/NotificationContext.tsx(1,60): error TS1484: 'ReactNode' is a type and must be imported using a type-only import when 'verbatimModuleSyntax' is enabled.
src/contexts/ThemeContext.tsx(1,67): error TS1484: 'ReactNode' is a type and must be imported using a type-only import when 'verbatimModuleSyntax' is enabled.
src/hooks/useActivityNotifications.ts(9,34): error TS2503: Cannot find namespace 'NodeJS'.
src/hooks/useActivityNotifications.ts(113,18): error TS2339: Property 'status' does not exist on type '{}'.
src/hooks/useActivityNotifications.ts(113,41): error TS2339: Property 'status' does not exist on type '{}'.
src/hooks/useRunPolling.ts(38,34): error TS2503: Cannot find namespace 'NodeJS'.
src/pages/Activities.tsx(92,17): error TS2552: Cannot find name 'Activity'. Did you mean 'activity'?
src/pages/Activities.tsx(96,17): error TS2552: Cannot find name 'Activity'. Did you mean 'activity'?
src/pages/Activities.tsx(131,14): error TS2304: Cannot find name 'Activity'.
src/pages/Ansible/Inventories.tsx(101,33): error TS2352: Conversion of type 'JsonApiListResponse<JsonApiResource> | { data: never[]; meta: { pagination: { 'total-count': number; }; }; }' to type 'JsonApiResponse<JsonApiResource>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
  Type '{ data: never[]; meta: { pagination: { 'total-count': number; }; }; }' is not comparable to type 'JsonApiResponse<JsonApiResource>'.
    Types of property 'data' are incompatible.
      Type 'never[]' is missing the following properties from type 'JsonApiResource': id, type, attributes
src/pages/Ansible/Inventories.tsx(102,34): error TS2352: Conversion of type 'JsonApiListResponse<JsonApiResource> | { data: never[]; meta: { pagination: { 'total-count': number; }; }; }' to type 'JsonApiResponse<JsonApiResource>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
  Type '{ data: never[]; meta: { pagination: { 'total-count': number; }; }; }' is not comparable to type 'JsonApiResponse<JsonApiResource>'.
    Types of property 'data' are incompatible.
      Type 'never[]' is missing the following properties from type 'JsonApiResource': id, type, attributes
src/pages/Ansible/JobDetail.tsx(354,47): error TS2339: Property 'address' does not exist on type '{}'.
src/pages/Ansible/JobDetail.tsx(355,63): error TS2339: Property 'address' does not exist on type '{}'.
src/pages/Ansible/JobDetail.tsx(382,17): error TS2322: Type '{}' is not assignable to type 'string'.
src/pages/Ansible/JobDetail.tsx(383,17): error TS2322: Type '{}' is not assignable to type 'string'.
src/pages/Ansible/JobDetail.tsx(384,17): error TS2322: Type '{}' is not assignable to type 'string'.
src/pages/Ansible/JobDetail.tsx(385,17): error TS2322: Type '{}' is not assignable to type 'string'.
src/pages/Ansible/JobDetail.tsx(386,17): error TS2322: Type '{}' is not assignable to type 'string'.
src/pages/Ansible/JobDetail.tsx(390,17): error TS2322: Type '{}' is not assignable to type 'number'.
src/pages/Ansible/JobDetail.tsx(391,17): error TS2322: Type '{}' is not assignable to type 'number'.
src/pages/Ansible/JobDetail.tsx(394,56): error TS2339: Property 'real' does not exist on type '{}'.
src/pages/Ansible/JobDetail.tsx(398,17): error TS2322: Type 'unknown' is not assignable to type 'number | undefined'.
src/pages/Ansible/JobDetail.tsx(399,17): error TS2322: Type 'unknown' is not assignable to type 'string | undefined'.
src/pages/Ansible/JobDetail.tsx(902,17): error TS2322: Type 'RefObject<HTMLPreElement | null>' is not assignable to type 'Ref<HTMLDivElement> | undefined'.
  Type 'RefObject<HTMLPreElement | null>' is not assignable to type 'RefObject<HTMLDivElement | null>'.
    Type 'HTMLPreElement | null' is not assignable to type 'HTMLDivElement | null'.
      Property 'align' is missing in type 'HTMLPreElement' but required in type 'HTMLDivElement'.
src/pages/Ansible/JobDetail.tsx(1101,47): error TS7053: Element implicitly has an 'any' type because expression of type 'string' can't be used to index type '{}'.
  No index signature with a parameter of type 'string' was found on type '{}'.
src/pages/Ansible/JobDetail.tsx(1107,29): error TS2322: Type 'unknown' is not assignable to type 'ReactNode'.
src/pages/Ansible/PlaybookDetail.tsx(210,38): error TS2503: Cannot find namespace 'NodeJS'.
src/pages/Ansible/PlaybookDetail.tsx(405,26): error TS2339: Property 'message' does not exist on type '{}'.
src/pages/Ansible/Playbooks.tsx(438,26): error TS2339: Property 'message' does not exist on type '{}'.
src/pages/Ansible/Workflows.tsx(64,47): error TS2339: Property 'id' does not exist on type 'JsonApiResourceIdentifier | JsonApiResourceIdentifier[]'.
  Property 'id' does not exist on type 'JsonApiResourceIdentifier[]'.
src/pages/Ansible/Workflows.tsx(65,37): error TS2339: Property 'id' does not exist on type 'JsonApiResourceIdentifier | JsonApiResourceIdentifier[]'.
  Property 'id' does not exist on type 'JsonApiResourceIdentifier[]'.
src/pages/Ansible/Workflows.tsx(66,41): error TS2339: Property 'id' does not exist on type 'JsonApiResourceIdentifier | JsonApiResourceIdentifier[]'.
  Property 'id' does not exist on type 'JsonApiResourceIdentifier[]'.
src/pages/Landing.tsx(365,29): error TS2322: Type '{ value: number; duration: number; className: string; }' is not assignable to type 'IntrinsicAttributes & Omit<DetailedHTMLProps<HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>, "children"> & { ...; } & UseIsInViewOptions'.
  Property 'value' does not exist on type 'IntrinsicAttributes & Omit<DetailedHTMLProps<HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>, "children"> & { ...; } & UseIsInViewOptions'.
src/pages/Landing.tsx(430,52): error TS18048: 'containerRect' is possibly 'undefined'.
src/pages/Landing.tsx(610,21): error TS2322: Type '(el: HTMLDivElement | null) => HTMLDivElement | null' is not assignable to type 'Ref<HTMLDivElement> | undefined'.
  Type '(el: HTMLDivElement | null) => HTMLDivElement | null' is not assignable to type '(instance: HTMLDivElement | null) => void | (() => VoidOrUndefinedOnly)'.
    Type 'HTMLDivElement | null' is not assignable to type 'void | (() => VoidOrUndefinedOnly)'.
      Type 'null' is not assignable to type 'void | (() => VoidOrUndefinedOnly)'.
src/pages/Registry/ModuleDetail.tsx(349,28): error TS18048: 'outputs.outputs.length' is possibly 'undefined'.
src/pages/Registry/ModuleDetail.tsx(349,64): error TS18048: 'outputs' is possibly 'undefined'.
src/pages/Registry/ModuleDetail.tsx(349,64): error TS18048: 'outputs.outputs' is possibly 'undefined'.
src/pages/Registry/ModuleDetail.tsx(360,33): error TS18048: 'dependencies.dependencies.length' is possibly 'undefined'.
src/pages/Registry/ModuleDetail.tsx(360,79): error TS18048: 'dependencies' is possibly 'undefined'.
src/pages/Registry/ModuleDetail.tsx(360,79): error TS18048: 'dependencies.dependencies' is possibly 'undefined'.
src/pages/Registry/ModuleDetail.tsx(371,30): error TS18048: 'resources.resources.length' is possibly 'undefined'.
src/pages/Registry/ModuleDetail.tsx(371,70): error TS18048: 'resources' is possibly 'undefined'.
src/pages/Registry/ModuleDetail.tsx(371,70): error TS18048: 'resources.resources' is possibly 'undefined'.
src/pages/Registry/ModuleDetail.tsx(463,20): error TS18048: 'outputs.outputs.length' is possibly 'undefined'.
src/pages/Registry/ModuleDetail.tsx(465,24): error TS18048: 'outputs' is possibly 'undefined'.
src/pages/Registry/ModuleDetail.tsx(465,24): error TS18048: 'outputs.outputs' is possibly 'undefined'.
src/pages/Registry/ModuleDetail.tsx(485,20): error TS18048: 'dependencies.dependencies.length' is possibly 'undefined'.
src/pages/Registry/ModuleDetail.tsx(487,24): error TS18048: 'dependencies' is possibly 'undefined'.
src/pages/Registry/ModuleDetail.tsx(487,24): error TS18048: 'dependencies.dependencies' is possibly 'undefined'.
src/pages/Registry/ModuleDetail.tsx(501,20): error TS18048: 'resources.resources.length' is possibly 'undefined'.
src/pages/Registry/ModuleDetail.tsx(503,24): error TS18048: 'resources' is possibly 'undefined'.
src/pages/Registry/ModuleDetail.tsx(503,24): error TS18048: 'resources.resources' is possibly 'undefined'.
src/pages/RunDetail.tsx(651,21): error TS2322: Type '{ logs: string; title: string; showJsonViewer: true; planOutput: Record<string, unknown> | undefined; isApplying: boolean; }' is not assignable to type 'IntrinsicAttributes & ApplyOutputViewerProps'.
  Property 'title' does not exist on type 'IntrinsicAttributes & ApplyOutputViewerProps'.
src/pages/RunDetail.tsx(675,21): error TS2322: Type '{ logs: string; title: string; showJsonViewer: true; planOutput: Record<string, unknown> | undefined; }' is not assignable to type 'IntrinsicAttributes & ApplyOutputViewerProps'.
  Property 'title' does not exist on type 'IntrinsicAttributes & ApplyOutputViewerProps'.
src/pages/Settings/Security.tsx(9,20): error TS7016: Could not find a declaration file for module 'qrcode'. '/home/boris/stackweaver/frontend/node_modules/qrcode/lib/index.js' implicitly has an 'any' type.
  Try `npm i --save-dev @types/qrcode` if it exists or add a new declaration (.d.ts) file containing `declare module 'qrcode';`
src/pages/Settings/Sessions.tsx(43,7): error TS2552: Cannot find name 'setSuccess'. Did you mean 'success'?
src/pages/Settings/Sessions.tsx(45,7): error TS2552: Cannot find name 'setSuccess'. Did you mean 'success'?
src/pages/Usage.tsx(1377,37): error TS2339: Property 'organization_name' does not exist on type 'Run'.
src/pages/Usage.tsx(1378,43): error TS2339: Property 'workspace_name' does not exist on type 'Run'.
src/pages/WorkspaceDetail.tsx(109,37): error TS2345: Argument of type 'Date' is not assignable to parameter of type 'string'.
src/pages/WorkspaceDetail.tsx(324,61): error TS2339: Property 'actions' does not exist on type '{}'.
src/pages/WorkspaceDetail.tsx(325,41): error TS2339: Property 'actions' does not exist on type '{}'.
src/pages/WorkspaceDetail.tsx(359,80): error TS18004: No value exists in scope for the shorthand property 'params'. Either declare one or provide an initializer.
src/pages/WorkspaceDetail.tsx(508,24): error TS2339: Property 'status' does not exist on type '{}'.
src/pages/WorkspaceDetail.tsx(509,26): error TS2339: Property 'response' does not exist on type '{}'.
src/pages/WorkspaceDetail.tsx(622,7): error TS2322: Type '"destroy" | "plan-only" | "plan-and-apply"' is not assignable to type '"plan" | "apply" | "destroy" | undefined'.
  Type '"plan-only"' is not assignable to type '"plan" | "apply" | "destroy" | undefined'.
src/pages/WorkspaceDetail.tsx(722,34): error TS2339: Property 'message' does not exist on type '{}'.
src/pages/WorkspaceDetail.tsx(950,27): error TS2367: This comparison appears to be unintentional because the types '"pending" | "planning" | "planned" | "applying" | "applied" | "failed" | "canceled" | "running" | "completed"' and '"errored"' have no overlap.
src/pages/WorkspaceDetail.tsx(1090,66): error TS7053: Element implicitly has an 'any' type because expression of type '"resources"' can't be used to index type '{}'.
  Property 'resources' does not exist on type '{}'.
src/pages/WorkspaceDetail.tsx(1091,36): error TS7053: Element implicitly has an 'any' type because expression of type '"resources"' can't be used to index type '{}'.
  Property 'resources' does not exist on type '{}'.
src/pages/WorkspaceDetail.tsx(1092,43): error TS7053: Element implicitly has an 'any' type because expression of type 'string' can't be used to index type '{}'.
  No index signature with a parameter of type 'string' was found on type '{}'.
src/pages/WorkspaceDetail.tsx(1093,51): error TS7053: Element implicitly has an 'any' type because expression of type 'string' can't be used to index type '{}'.
  No index signature with a parameter of type 'string' was found on type '{}'.
src/pages/WorkspaceDetail.tsx(1421,59): error TS2345: Argument of type '{}' is not assignable to parameter of type 'string'.
src/pages/WorkspaceDetail.tsx(1454,49): error TS2345: Argument of type '{}' is not assignable to parameter of type 'string'.
src/pages/WorkspaceDetail.tsx(1459,37): error TS2339: Property 'root_module' does not exist on type 'object'.
src/pages/WorkspaceDetail.tsx(1460,44): error TS2339: Property 'root_module' does not exist on type 'object'.
src/pages/WorkspaceDetail.tsx(1483,46): error TS2769: No overload matches this call.
  Overload 1 of 4, '(value: string | number | Date): Date', gave the following error.
    Argument of type '{}' is not assignable to parameter of type 'string | number | Date'.
  Overload 2 of 4, '(value: string | number): Date', gave the following error.
    Argument of type '{}' is not assignable to parameter of type 'string | number'.
src/pages/WorkspaceDetail.tsx(1484,46): error TS2769: No overload matches this call.
  Overload 1 of 4, '(value: string | number | Date): Date', gave the following error.
    Argument of type '{}' is not assignable to parameter of type 'string | number | Date'.
  Overload 2 of 4, '(value: string | number): Date', gave the following error.
    Argument of type '{}' is not assignable to parameter of type 'string | number'.
src/pages/WorkspaceDetail.tsx(1548,76): error TS2339: Property 'toLowerCase' does not exist on type '{}'.
src/pages/WorkspaceDetail.tsx(1549,70): error TS2339: Property 'toLowerCase' does not exist on type '{}'.
src/pages/WorkspaceDetail.tsx(1550,78): error TS2339: Property 'toLowerCase' does not exist on type '{}'.
src/pages/WorkspaceDetail.tsx(1558,72): error TS2322: Type 'unknown' is not assignable to type 'ReactNode'.
src/pages/WorkspaceDetail.tsx(1561,99): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'string | undefined'.
src/pages/WorkspaceDetail.tsx(1564,62): error TS2322: Type 'unknown' is not assignable to type 'ReactNode'.
src/pages/WorkspaceDetail.tsx(1567,84): error TS2322: Type '{}' is not assignable to type 'ReactNode'.
src/pages/WorkspaceDetail.tsx(1570,96): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'string | undefined'.
src/pages/WorkspaceDetail.tsx(1638,47): error TS2339: Property 'sensitive' does not exist on type '{}'.
src/pages/WorkspaceDetail.tsx(1642,66): error TS2339: Property 'value' does not exist on type '{}'.
src/pages/WorkspaceDetail.tsx(1649,76): error TS2339: Property 'type' does not exist on type 'object'.
src/pages/WorkspaceDetail.tsx(1649,96): error TS2339: Property 'type' does not exist on type 'object'.
src/pages/WorkspaceDetail.tsx(1649,119): error TS2339: Property 'value' does not exist on type '{}'.
src/pages/WorkspaceDetail.tsx(1825,43): error TS2367: This comparison appears to be unintentional because the types '"pending" | "planning" | "planned" | "applying" | "applied" | "failed" | "canceled" | "running" | "completed"' and '"errored"' have no overlap.
src/pages/WorkspaceDetail.tsx(1901,19): error TS2322: Type '(date: Date) => string' is not assignable to type '(date: string) => string'.
  Types of parameters 'date' and 'date' are incompatible.
    Type 'string' is not assignable to type 'Date'.
src/pages/Workspaces.tsx(184,62): error TS2367: This comparison appears to be unintentional because the types '"apply" | "destroy"' and '"plan-only"' have no overlap.
src/pages/Workspaces.tsx(295,64): error TS2367: This comparison appears to be unintentional because the types '"apply" | "destroy"' and '"plan-only"' have no overlap.
src/pages/Workspaces.tsx(407,11): error TS2367: This comparison appears to be unintentional because the types '"plan" | "apply" | "destroy"' and '"plan-only"' have no overlap.
src/pages/Workspaces.tsx(486,52): error TS2367: This comparison appears to be unintentional because the types '"apply" | "destroy"' and '"plan-only"' have no overlap.
src/pages/Workspaces.tsx(514,13): error TS2322: Type 'boolean | undefined' is not assignable to type 'boolean'.
  Type 'undefined' is not assignable to type 'boolean'.
