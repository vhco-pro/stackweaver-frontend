<!-- Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->
# Brand logos

Logos shown next to documentation headings, page titles, sidebar entries and overview cards. The
registry that maps names to these files is `src/lib/brands.ts`. A `-dark` file is the variant for the
dark theme, used where the light artwork would disappear on a dark background.

Each logo is a trademark of its owner and is used only to refer to that product. Which logos a public
page may show is decided per brand by the owner's published policy, recorded in
`docs/internal/research/brand-logo-usage-policies.md` and applied through each brand's `usage`.
Terraform is deliberately absent: Stackweaver runs OpenTofu.

| File | Source | License of the artwork file |
|------|--------|-----------------------------|
| `opentofu.svg`, `opentofu-dark.svg` | [opentofu/brand-artifacts](https://github.com/opentofu/brand-artifacts), `symbol-only/transparent/SVG` on-light and on-dark | Project brand artifacts |
| `zitadel.svg`, `zitadel-dark.svg` | [zitadel/zitadel](https://github.com/zitadel/zitadel), `apps/login/public/logo/zitadel-logo-solo-*design.svg` | Apache-2.0 repository |
| `azure.svg`, `azure-devops.svg` | Microsoft [Azure architecture icons](https://learn.microsoft.com/en-us/azure/architecture/icons/) V25: `10018-icon-service-Azure-A.svg`, `10261-icon-service-Azure-DevOps.svg`, unmodified | Microsoft icon terms: documentation, diagrams and training only |
| `microsoft-entra.svg` | Microsoft [Entra architecture icons](https://learn.microsoft.com/en-us/entra/architecture/architecture-icons), October 2023: `Microsoft Entra ID color icon.svg`, unmodified | Microsoft icon terms, not in marketing |
| `ansible.svg`, `flux.svg` | [simple-icons](https://github.com/simple-icons/simple-icons) 16.38.0, in the brand colour it records | CC0-1.0 |
| All other files | [gilbarbara/logos](https://github.com/gilbarbara/logos) via `@iconify-json/logos` 1.2.20 | CC0-1.0 |

Dark variants of AWS, GitHub, Helm, Okta, Auth0 and Vault recolour the dark parts of the light
artwork to white or the brand's on-dark colour; the light Vault file uses HashiCorp's black mark for
light backgrounds.
