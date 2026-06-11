---
description: "Guide for registering Ansible playbooks: single registration, bulk import from a repository, and the repository browser in job template forms"
covers:
  - "backend/internal/api/v2/handlers/ansible/**"
  - "core/services/vcs/**"
  - "frontend/src/pages/Ansible/**"
  - "frontend/src/components/ansible/**"
---

# Managing Ansible Playbooks

A playbook in Stackweaver is a registered pointer to a playbook file in a connected VCS repository: a connection, a repository, a branch, and a file path, together with a source mode that controls whether jobs run a cached snapshot or always fetch fresh from the repository. This guide covers the three ways to register playbooks and how Stackweaver discovers playbook files in your repositories.

## Registering a single playbook

On the Playbooks page, the "New Playbook" button opens a form where you pick a VCS connection, repository, and branch, then choose the playbook file. The path field suggests YAML files found in the repository, and the playbook name is generated from the repository, branch, and path unless you type your own. This is the right flow when you want full control over the name, description, and source mode of one playbook.

## Importing many playbooks at once

When a repository contains many playbooks, the "Import from repository" button on the Playbooks page opens the bulk-import wizard. After you select a connection, repository, and branch, Stackweaver scans the repository and lists every playbook candidate it finds. Files that are already registered appear disabled with the name of their existing playbook, so re-running the import is always safe: existing playbooks are skipped, never duplicated. Check the files you want (or use select-all), optionally narrow the list with the directory filter, choose a source mode, and import. Each created playbook is synced immediately, and the wizard shows a per-file result summary of what was created, skipped, or failed.

Playbook names are derived from the filename. When two files would produce the same name (for example two `site.yml` files in different directories), the name is disambiguated deterministically with the parent directory, then the repository name, then a numeric suffix. Names are unique within a project.

## Picking a playbook directly in a job template

The playbook field in the job template create and edit forms has two modes. "Registered" is the classic dropdown over playbooks that already exist. "From repository" lets you browse a connected repository and pick a playbook file directly, the way AWX users expect: choose the connection, repository, and branch, then select the file. If the file is already registered, the existing playbook is used; if not, Stackweaver registers it automatically when you save the template. Cancelling the form never creates anything.

## How playbook discovery filters files

Repository scans return YAML files (`.yml` and `.yaml`) but hide files that by convention are never playbooks. Files inside `roles/`, `group_vars/`, `host_vars/`, `vars/`, `tasks/`, `handlers/`, `templates/`, `files/`, `defaults/`, `meta/`, `collections/`, `inventories/`, `inventory/`, `molecule/`, `library/`, `filter_plugins/`, `module_utils/`, `plugins/`, `test/`, `tests/`, and CI directories such as `.github/` are excluded at any depth, as are well-known non-playbook files like `requirements.yml`, `galaxy.yml`, CI pipeline definitions, Docker Compose files, and hidden dotfiles. If a playbook you expect is missing from the list, check whether it lives inside one of these directories; you can still register it through the single-playbook form, which accepts any path.

Discovery works for GitHub and Azure DevOps connections. On very large repositories GitHub may truncate the file listing; if that happens a warning is logged on the server and the list may be incomplete — registering the missing file through the single-playbook form still works.

## Source modes

Both the wizard and the repository browser register playbooks in `cached` mode by default, meaning jobs run the snapshot captured at sync time and keep working even when the VCS provider is unreachable. Choose `fresh` when a playbook must always run the latest commit. See the changelog entry on configurable playbook sources for the full behavior.
