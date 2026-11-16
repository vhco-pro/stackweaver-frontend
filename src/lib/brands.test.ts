// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRANDS, brandById, brandForHeading } from './brands';

const docsRoot = join(__dirname, '../../../docs');
function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'internal' || entry.name === 'node_modules' ? [] : markdownFiles(path);
    return entry.name.endsWith('.md') ? [path] : [];
  });
}

describe('brand headings', () => {
  it.each([
    ['OpenTofu', 'opentofu'],
    ['Docker Compose', 'docker'],
    ['Docker, in-process driver', 'docker'],
    ['Kubernetes / Helm', 'kubernetes'],
    ['AWS Cognito SSO', 'aws-cognito'],
    ['Azure DevOps Integration', 'azure-devops'],
    ['Azure AD / Entra ID SSO Configuration', 'microsoft-entra'],
    ['Azure: role-assignment authorization fails', 'azure'],
    ['GCP job authentication', 'google-cloud'],
    ['Argo CD', 'argo'],
  ])('matches %s to %s', (heading, id) => {
    expect(brandForHeading(heading, 'all')?.id).toBe(id);
  });

  it.each(['Kubernetes-only variables', 'zitadel-init', 'Terraform setup', 'Configure workload identity for AWS', 'Helmet', 'Awsome'])('leaves %s plain', heading => {
    expect(brandForHeading(heading, 'all')).toBeUndefined();
  });

  it('looks brands up by id regardless of case and whitespace', () => {
    expect(brandById(' OpenTofu ', 'all')?.name).toBe('OpenTofu');
    expect(brandById('terraform', 'all')).toBeUndefined();
  });

  it('shows only logos whose owners permit it unless the collection allows all or none', () => {
    expect(brandForHeading('Azure DevOps Integration')?.id).toBe('azure-devops');
    expect(brandForHeading('Docker Compose')).toBeUndefined();
    expect(brandForHeading('OpenTofu')?.id).toBe('opentofu');
    expect(brandById('aws')).toBeUndefined();
    expect(brandById('zitadel')?.id).toBe('zitadel');
    expect(brandById('aws', 'all')?.id).toBe('aws');
    expect(brandById('azure', 'none')).toBeUndefined();
    expect(BRANDS.filter(brand => brand.usage === 'permitted').map(brand => brand.id).sort()).toEqual(['argo', 'auth0', 'azure', 'azure-devops', 'flux', 'github', 'helm', 'kubernetes', 'microsoft-entra', 'okta', 'opentofu', 'redis', 'zitadel']);
  });

  it('gives every brand a unique id and artwork', () => {
    expect(new Set(BRANDS.map(brand => brand.id)).size).toBe(BRANDS.length);
    for (const brand of BRANDS) expect(brand.light).toBeTruthy();
  });
});

describe('docs icon frontmatter', () => {
  it('names a known brand on every public page that sets it', () => {
    const unknown = markdownFiles(docsRoot).flatMap(file => {
      const frontmatter = /^---\n([\s\S]*?)\n---/.exec(readFileSync(file, 'utf8'))?.[1] ?? '';
      const icon = /^icon:\s*(.+)$/m.exec(frontmatter)?.[1].trim();
      return icon && !brandById(icon, 'all') ? [`${relative(docsRoot, file)}: ${icon}`] : [];
    });
    expect(unknown).toEqual([]);
  });
});
