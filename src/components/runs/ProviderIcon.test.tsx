// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { OpenTofuIcon, ProviderIcon } from './ProviderIcon';
import { providerIconSource } from './providerIconSource';

describe('providerIconSource', () => {
  it('reads the provider type from every form a plan names it in', () => {
    const aws = { kind: 'brand', id: 'aws' };
    expect(providerIconSource('registry.opentofu.org/hashicorp/aws')).toEqual(aws);
    expect(providerIconSource('provider["registry.opentofu.org/hashicorp/aws"]')).toEqual(aws);
    expect(providerIconSource('registry.terraform.io/module.net:aws')).toEqual(aws);
    expect(providerIconSource('aws_instance')).toEqual(aws);
    expect(providerIconSource(undefined, 'aws_instance')).toEqual(aws);
    expect(providerIconSource('google-beta')).toEqual({ kind: 'file', src: '/icons/google.svg' });
  });

  it('gives the engine its OpenTofu mark and never a Terraform logo', () => {
    expect(providerIconSource('terraform.io/builtin/terraform')).toEqual({ kind: 'brand', id: 'opentofu' });
    expect(providerIconSource(undefined, 'terraform_data')).toEqual({ kind: 'brand', id: 'opentofu' });
  });

  it('marks tfe resources as Stackweaver objects', () => {
    expect(providerIconSource('registry.terraform.io/hashicorp/tfe')).toEqual({ kind: 'stackweaver' });
    expect(providerIconSource(undefined, 'tfe_workspace')).toEqual({ kind: 'stackweaver' });
  });

  it('shows the neutral icon for a provider without artwork of its own', () => {
    for (const name of ['registry.opentofu.org/hashicorp/oci', 'random_id', 'null_resource', 'registry.opentofu.org/hashicorp/time', '']) {
      expect(providerIconSource(name)).toEqual({ kind: 'generic' });
    }
  });

  it('only names icon files that exist and are images', () => {
    const icons = path.resolve(__dirname, '../../../public/icons');
    const files = fs.readdirSync(icons).filter((f) => f.endsWith('.svg'));
    expect(files).not.toContain('terraform.svg');
    for (const file of files) {
      const source = providerIconSource(file.replace(/\.svg$/, ''));
      if (source.kind === 'brand') continue; // drawn from the brand registry instead
      expect(source).toEqual({ kind: 'file', src: `/icons/${file}` });
      expect(fs.readFileSync(path.join(icons, file), 'utf8').slice(0, 400)).toMatch(/<svg/i);
    }
  });
});

describe('ProviderIcon', () => {
  it('renders the light and dark OpenTofu artwork for outputs', () => {
    const { container } = render(<OpenTofuIcon />);
    expect(container.querySelectorAll('img')).toHaveLength(2);
  });

  it('renders the neutral icon without an image request for an unknown provider', () => {
    const { container } = render(<ProviderIcon providerName="registry.opentofu.org/hashicorp/oci" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
