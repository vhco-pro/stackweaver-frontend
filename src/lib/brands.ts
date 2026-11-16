// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import ansible from '@/assets/brands/ansible.svg';
import argo from '@/assets/brands/argo.svg';
import auth0 from '@/assets/brands/auth0.svg';
import auth0Dark from '@/assets/brands/auth0-dark.svg';
import aws from '@/assets/brands/aws.svg';
import awsDark from '@/assets/brands/aws-dark.svg';
import awsCognito from '@/assets/brands/aws-cognito.svg';
import azure from '@/assets/brands/azure.svg';
import azureDevops from '@/assets/brands/azure-devops.svg';
import cloudflare from '@/assets/brands/cloudflare.svg';
import docker from '@/assets/brands/docker.svg';
import flux from '@/assets/brands/flux.svg';
import github from '@/assets/brands/github.svg';
import githubDark from '@/assets/brands/github-dark.svg';
import gitlab from '@/assets/brands/gitlab.svg';
import google from '@/assets/brands/google.svg';
import googleCloud from '@/assets/brands/google-cloud.svg';
import helm from '@/assets/brands/helm.svg';
import helmDark from '@/assets/brands/helm-dark.svg';
import kubernetes from '@/assets/brands/kubernetes.svg';
import microsoft from '@/assets/brands/microsoft.svg';
import microsoftEntra from '@/assets/brands/microsoft-entra.svg';
import okta from '@/assets/brands/okta.svg';
import oktaDark from '@/assets/brands/okta-dark.svg';
import opentofu from '@/assets/brands/opentofu.svg';
import opentofuDark from '@/assets/brands/opentofu-dark.svg';
import postgresql from '@/assets/brands/postgresql.svg';
import redis from '@/assets/brands/redis.svg';
import vault from '@/assets/brands/vault.svg';
import vaultDark from '@/assets/brands/vault-dark.svg';
import zitadel from '@/assets/brands/zitadel.svg';
import zitadelDark from '@/assets/brands/zitadel-dark.svg';

export interface Brand {
  /** Stable id, used by the `icon` frontmatter field. */
  id: string;
  /** Display name, used as the accessible label where the logo stands alone. */
  name: string;
  /** Names a heading may start with. The id and name always match. */
  aliases: readonly string[];
  /** Artwork for the light theme. */
  light: string;
  /** Artwork for the dark theme, when the light artwork would vanish on a dark background. */
  dark?: string;
  /**
   * Whether the owner's published policy lets third parties show this logo without asking first:
   * `permitted` (conditions such as attribution, a link or click-through terms included), or `restricted`
   * when it needs permission, a licence or a written agreement. Only `permitted` logos show under the
   * default policy. Evidence per brand: docs/internal/research/brand-logo-usage-policies.md.
   */
  usage: 'permitted' | 'restricted';
}

/** Which logos a collection shows; mirrors BrandLogoPolicy in the docs framework. */
export type BrandPolicy = 'permitted' | 'all' | 'none';

/** Brands with logos. Artwork sources and licenses: src/assets/brands/SOURCES.md. Terraform is left out on purpose: the product runs OpenTofu. */
export const BRANDS: readonly Brand[] = [
  { id: 'opentofu', name: 'OpenTofu', aliases: [], light: opentofu, dark: opentofuDark, usage: 'permitted' },
  { id: 'ansible', name: 'Ansible', aliases: [], light: ansible, usage: 'restricted' },
  { id: 'aws-cognito', name: 'Amazon Cognito', aliases: ['AWS Cognito', 'Cognito'], light: awsCognito, usage: 'restricted' },
  { id: 'aws', name: 'AWS', aliases: ['Amazon Web Services'], light: aws, dark: awsDark, usage: 'restricted' },
  { id: 'azure-devops', name: 'Azure DevOps', aliases: [], light: azureDevops, usage: 'permitted' },
  { id: 'microsoft-entra', name: 'Microsoft Entra ID', aliases: ['Entra ID', 'Entra', 'Azure AD', 'Azure Active Directory'], light: microsoftEntra, usage: 'permitted' },
  { id: 'azure', name: 'Azure', aliases: ['Microsoft Azure'], light: azure, usage: 'permitted' },
  { id: 'microsoft', name: 'Microsoft', aliases: [], light: microsoft, usage: 'restricted' },
  { id: 'google-cloud', name: 'Google Cloud', aliases: ['GCP', 'Google Cloud Platform'], light: googleCloud, usage: 'restricted' },
  { id: 'google', name: 'Google', aliases: ['Google Workspace'], light: google, usage: 'restricted' },
  { id: 'github', name: 'GitHub', aliases: [], light: github, dark: githubDark, usage: 'permitted' },
  { id: 'gitlab', name: 'GitLab', aliases: [], light: gitlab, usage: 'restricted' },
  { id: 'vault', name: 'Vault', aliases: ['HashiCorp Vault'], light: vault, dark: vaultDark, usage: 'restricted' },
  { id: 'kubernetes', name: 'Kubernetes', aliases: [], light: kubernetes, usage: 'permitted' },
  { id: 'helm', name: 'Helm', aliases: [], light: helm, dark: helmDark, usage: 'permitted' },
  { id: 'docker', name: 'Docker', aliases: ['Docker Compose'], light: docker, usage: 'restricted' },
  { id: 'okta', name: 'Okta', aliases: [], light: okta, dark: oktaDark, usage: 'permitted' },
  { id: 'auth0', name: 'Auth0', aliases: [], light: auth0, dark: auth0Dark, usage: 'permitted' },
  { id: 'zitadel', name: 'Zitadel', aliases: [], light: zitadel, dark: zitadelDark, usage: 'permitted' },
  { id: 'cloudflare', name: 'Cloudflare', aliases: [], light: cloudflare, usage: 'restricted' },
  { id: 'argo', name: 'Argo CD', aliases: ['Argo', 'ArgoCD'], light: argo, usage: 'permitted' },
  { id: 'flux', name: 'Flux', aliases: ['Flux CD'], light: flux, usage: 'permitted' },
  { id: 'redis', name: 'Redis', aliases: [], light: redis, usage: 'permitted' },
  { id: 'postgresql', name: 'PostgreSQL', aliases: ['Postgres'], light: postgresql, usage: 'restricted' },
];

const byId = new Map(BRANDS.map(brand => [brand.id, brand]));

function allowed(brand: Brand | undefined, policy: BrandPolicy): Brand | undefined {
  if (!brand || policy === 'none') return undefined;
  return policy === 'all' || brand.usage === 'permitted' ? brand : undefined;
}

/** The brand with this id, when the policy lets it show. */
export function brandById(id: string | undefined, policy: BrandPolicy = 'permitted'): Brand | undefined {
  return allowed(id ? byId.get(id.trim().toLowerCase()) : undefined, policy);
}

// Longest names first, so "Azure DevOps" wins over "Azure" and "AWS Cognito" over "AWS".
const leadingNames = BRANDS.flatMap(brand => [brand.name, ...brand.aliases].map(name => ({ name: name.toLowerCase(), brand })))
  .sort((a, b) => b.name.length - a.name.length);

/**
 * The brand a heading is about: its text starts with a brand name that ends at a word break. A hyphen
 * is not a break, so "Kubernetes-only variables" or "zitadel-init" (a component) keep a plain heading.
 */
export function brandForHeading(text: string, policy: BrandPolicy = 'permitted'): Brand | undefined {
  const heading = text.trim().toLowerCase();
  return allowed(leadingNames.find(({ name }) => heading.startsWith(name) && /^(?:$|[\s:,/(])/.test(heading.slice(name.length)))?.brand, policy);
}
