// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pins what the public landing page says and where it points: every GitHub link at the
// public organization, no claim the product does not ship, the two sections that explain
// compatibility and the license, and no hand-registered scroll listener.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Landing from './Landing';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: null }) }));
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', resolvedTheme: 'dark', setTheme: () => undefined }),
}));
vi.mock('@/components/gdpr/CookieConsent', () => ({ CookieConsent: () => null }));

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');
const LANDING_COMPONENTS = readdirSync(join(SRC, 'components/landing'))
  .filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f))
  .map((f) => `components/landing/${f}`);
const LANDING_SOURCES = ['pages/Landing.tsx', ...LANDING_COMPONENTS];
const LINK_SOURCES = [
  ...LANDING_SOURCES,
  'components/navigation/PublicNav.tsx',
  'components/layout/Footer.tsx',
  '../public/.well-known/security.txt',
];

const renderPage = () =>
  render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>
  );

describe('Landing: links', () => {
  it('points every GitHub link in the landing sources at the public organization', () => {
    const offenders: string[] = [];
    let seen = 0;
    for (const file of LINK_SOURCES) {
      for (const url of read(file).match(/https?:\/\/github\.com\/[^\s'"`)<>]*/g) ?? []) {
        seen += 1;
        if (!/^https:\/\/github\.com\/vhco-pro(\/|$)/.test(url)) offenders.push(`${file}: ${url}`);
      }
    }
    expect(seen).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });

  it('gives security.txt a policy and the two contacts the public policy names', () => {
    const txt = read('../public/.well-known/security.txt');
    expect(txt).toMatch(/^Policy: https:\/\/github\.com\/vhco-pro\/\.github\/blob\/main\/SECURITY\.md$/m);
    expect(txt).toMatch(/^Contact: https:\/\/github\.com\/vhco-pro\/stackweaver-frontend\/security\/advisories\/new$/m);
    expect(txt).toMatch(/^Contact: mailto:contact@vhco\.pro$/m);
    expect(txt).toMatch(/^Expires: /m);
  });
});

describe('Landing: copy', () => {
  it('shows the tagline', () => {
    const { container } = renderPage();
    expect(container.textContent).toContain('Your one-stop shop for all infrastructure automation');
  });

  it('makes no claim the product does not ship', () => {
    const { container } = renderPage();
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/10x faster/i);
    expect(text).not.toMatch(/policy-as-code/i);
    expect(text).not.toMatch(/\bOPA\b/);
    expect(text).not.toMatch(/Sentinel/i);
    expect(text).not.toContain('Open Source Orchestration');
    expect(text).toContain('A look behind the login');
  });

  it('never presents Stackweaver as shipping or running the terraform binary', () => {
    const { container } = renderPage();
    const text = container.textContent ?? '';
    expect(text).toContain('Stackweaver itself does not ship or run the Terraform binary');
    const rest = text.replace('Stackweaver itself does not ship or run the Terraform binary', '');
    expect(rest).not.toMatch(/(ships?|runs?|bundles?|includes?|hosts?|manages?) (the )?terraform (binary|cli|runs?)/i);
    expect(rest).not.toMatch(/managed terraform/i);
  });
});

describe('Landing: Compatibility section', () => {
  it('says what stays, what changes and that runs execute on OpenTofu', () => {
    const { container } = renderPage();
    const section = container.querySelector('#compat') as HTMLElement;
    expect(section).not.toBeNull();
    const s = within(section);
    expect(s.getAllByText('Stays')).toHaveLength(2);
    expect(s.getAllByText('Changes')).toHaveLength(2);
    expect(section.textContent).toMatch(/the CLI you already use, terraform or tofu/);
    expect(section.textContent).toMatch(/Runs execute on OpenTofu/);
    expect(section.textContent).toMatch(/TFE_HOSTNAME/);
    expect(section.textContent).toMatch(/terraform login stackweaver\.example\.com/);
  });

  it('links to the migration guide in the docs and to the native provider', () => {
    const { container } = renderPage();
    const section = within(container.querySelector('#compat') as HTMLElement);
    expect(section.getByRole('link', { name: /Migration guide/ })).toHaveAttribute(
      'href',
      '/docs/user-guides/migrating-from-terraform-cloud'
    );
    expect(section.getByRole('link', { name: 'terraform-provider-stackweaver' })).toHaveAttribute(
      'href',
      'https://github.com/vhco-pro/terraform-provider-stackweaver'
    );
  });

  it('switches the code card between its four tabs', () => {
    const { container } = renderPage();
    const section = within(container.querySelector('#compat') as HTMLElement);
    const tabs = section.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['cloud', 'provider', 'discovery', 'login']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });
});

describe('Landing: License & Security section', () => {
  it('states the license as published, signed releases and where data lives', () => {
    const { container } = renderPage();
    const section = container.querySelector('#trust') as HTMLElement;
    expect(section).not.toBeNull();
    const text = section.textContent ?? '';
    expect(text).toMatch(/Business Source License 1\.1/);
    expect(text).toMatch(/as long as you do not offer it to others as a managed service/);
    expect(text).toMatch(/Apache 2\.0 within four years of its release/);
    expect(text).not.toMatch(/non-commercial|five years/i);
    expect(text).toMatch(/Sigstore/);
    expect(text).toMatch(/your database and your bucket/);
  });

  it('links to the published license and to the two security pages in the docs', () => {
    const { container } = renderPage();
    const section = within(container.querySelector('#trust') as HTMLElement);
    expect(section.getByRole('link', { name: 'Read the license' })).toHaveAttribute(
      'href',
      'https://github.com/vhco-pro/stackweaver-api/blob/main/LICENSE'
    );
    expect(section.getByRole('link', { name: 'Verify a release' })).toHaveAttribute('href', '/docs/security/verifying-releases');
    expect(section.getByRole('link', { name: 'Security overview' })).toHaveAttribute('href', '/docs/security');
  });
});

describe('Landing: structure', () => {
  it('has no roadmap section', () => {
    const { container } = renderPage();
    expect(container.querySelector('#roadmap')).toBeNull();
    expect(screen.queryByText('The Roadmap')).toBeNull();
    expect(read('pages/Landing.tsx')).not.toMatch(/roadmap/i);
  });

  it('registers no scroll listener in Landing or the landing components', () => {
    const offenders = LANDING_SOURCES.filter((f) => /addEventListener\(\s*['"]scroll['"]/.test(read(f)) || /onScroll=/.test(read(f)));
    expect(offenders).toEqual([]);
  });

  it('keeps the anchors the navigation links to', () => {
    const { container } = renderPage();
    for (const id of ['overview', 'compat', 'install', 'features']) {
      expect(container.querySelector(`#${id}`), id).not.toBeNull();
    }
  });
});
