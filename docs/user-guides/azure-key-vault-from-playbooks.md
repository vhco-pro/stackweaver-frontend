---
description: "Guide for reading Azure Key Vault secrets from Ansible playbooks using workload identity (federated OIDC) - no static credentials on runners"
covers:
  - "backend/cmd/ansible-runner/**"
  - "backend/internal/api/v2/handlers/**"
  - "core/services/oidc/**"
---

# Reading Azure Key Vault Secrets from Playbooks

Playbooks frequently need secrets at run time - certificates, connection strings, API keys - and the right place for those is Azure Key Vault, not extra-vars. Stackweaver injects Azure workload-identity environment variables into every playbook run, so the `azure.azcollection` modules can authenticate to Azure with a short-lived federated token instead of a stored client secret.

## How authentication reaches your playbook

There are three ways a playbook run can obtain an Azure identity, and Stackweaver picks the first one that applies.

When the job template has an **Azure credential** attached, its service-principal details are exported as both naming schemes the Azure tooling uses: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_CLIENT_SECRET` for the azure-identity SDK, plus `AZURE_TENANT` and `AZURE_SECRET` for the `azure.azcollection` modules.

When the organization has an **Azure OIDC configuration** (the same one used for Terraform runs and dynamic inventory syncs) and no Azure credential is attached, Stackweaver mints a short-lived federated token for the job and injects `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_TENANT`, `AZURE_SUBSCRIPTION_ID`, `AZURE_FEDERATED_TOKEN`, and `AZURE_FEDERATED_TOKEN_FILE`, along with the `ARM_*` equivalents. The token's subject is `organization:<org>:project:<project>:job:<job-name>:run`, which you register as a federated credential on your Entra App Registration. This works on both platform runners and self-hosted runners.

When the runner itself runs on **AKS with Entra Workload ID**, the webhook-injected pod environment (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_FEDERATED_TOKEN_FILE`) is inherited by every playbook process, and the Azure collection reads `AZURE_TENANT_ID` natively (since `azure.azcollection` 3.20.0 it falls back to that name when the legacy `AZURE_TENANT` is unset). The runner also aliases `AZURE_TENANT_ID` to the legacy `AZURE_TENANT` name at startup, so playbooks whose own Galaxy requirements pin an older collection keep working. Nothing needs to be configured in Stackweaver at all.

## Azure setup

Grant the identity (managed identity or App Registration) the `Key Vault Secrets User` role on the vault, or a `get`/`list` secrets access policy on vaults that still use access policies. For the Stackweaver-federated variant, add a federated credential on the App Registration with your Stackweaver issuer URL, audience `api://AzureADTokenExchange`, and the job subject shown above.

## Using it in a playbook

With the environment in place, `azure.azcollection.azure_rm_keyvaultsecret_info` authenticates automatically with `auth_source: auto` (the default). A task that reads a secret and uses it later in the play looks like this - see the module documentation for all options:

```yaml
- name: Read a secret from Key Vault
  azure.azcollection.azure_rm_keyvaultsecret_info:
    vault_uri: "https://my-vault.vault.azure.net"
    name: database-password
  register: kv
  delegate_to: localhost
  no_log: true

- name: Use the secret
  ansible.builtin.set_fact:
    db_password: "{{ kv.secrets[0].secret }}"
  no_log: true
```

Add `azure.azcollection` to the job template's Galaxy requirements if your runner image does not already bundle it, and keep `no_log: true` on tasks that touch secret values so they never appear in job output.

## Timeouts and long plays

Federated tokens are short-lived. The collection re-reads `AZURE_FEDERATED_TOKEN_FILE` at authentication time, so prefer reading secrets early in the play, and set a job timeout on the template that fits within your token lifetime when running very long plays.
