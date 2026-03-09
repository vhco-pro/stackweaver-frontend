<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

---
title: "Code Examples Test"
description: "Test page for file tree, file inclusion, and code explorer features."
---

# Code Examples Test

This page exercises all three code-example features added in the docs-code-examples plan.

---

## Feature 1: File Tree

A static directory structure diagram rendered from `tree`-language fenced code blocks.

```tree
entra-setup/
├── main.tf
├── variables.tf
└── outputs.tf
```

Nested example:

```tree
stackweaver/
├── backend/
│   ├── cmd/
│   │   ├── api/
│   │   └── runner/
│   └── internal/
│       ├── models/
│       └── services/
├── frontend/
│   └── src/
│       ├── components/
│       └── pages/
└── deploy/
    ├── docker-compose.yml
    └── .env.example
```

---

## Feature 2: File Inclusion

The line below is a `<<< ./path` directive. The build script replaces it with the file contents as a fenced code block.

<<< ./user-guides/vcs/entra-setup/variables.tf

Line-range example (first 28 lines of main.tf: the header and terraform block):

<<< ./user-guides/vcs/entra-setup/main.tf#L1-L28

---

## Feature 3: Code Explorer

An interactive file browser for the `entra-setup` Terraform module. Click a file in the left panel to view it.

::: code-explorer ./user-guides/vcs/entra-setup
:::

With a default file pre-selected:

::: code-explorer ./user-guides/vcs/entra-setup default="outputs.tf"
:::

---

## Phase 4: Language Icons, Download, Fullscreen, GitHub Sources

### Feature 4: Language-Specific File Icons

The code explorer and file tree viewer now show per-language icons. Open any code explorer below and
inspect the file list to confirm `.tf` files show the Terraform diamond, `.go` files the Go gopher,
`.ts` files the TypeScript blue square, etc.

### Feature 5: ZIP Download

Each code explorer now has a **Download** button in the header. Clicking it packages all files in
the explorer into a `.zip` archive and triggers a browser download.

### Feature 7: Expand / Fullscreen Mode

Each code explorer has a **⤢** (Maximize2) button in the header. Clicking it opens the explorer in
a full-screen overlay (90vw × 90vh) for easier navigation of large file trees and long files.

---

### Combined Phase 4 test — entra-setup explorer

The explorer below exercises features 4 (file-type icons), 5 (Download), and 7 (Expand):

::: code-explorer ./user-guides/vcs/entra-setup
:::

### File tree with language icons

The `tree` block below exercises Feature 4 icon rendering in `FileTreeViewer`:

```tree
entra-setup/
├── main.tf
├── variables.tf
├── outputs.tf
├── backend.tf
└── test/
    └── terraform.tfvars
```
