// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, expect, it } from 'vitest';
import { getVcsBranchUrl, getVcsFileUrl } from './vcs';

const pathProviders = [
  { provider: 'github', branchRoot: 'https://github.com/acme/infrastructure/tree/', fileRoot: 'https://github.com/acme/infrastructure/blob/' },
  { provider: 'gitlab', branchRoot: 'https://gitlab.com/acme/infrastructure/-/tree/', fileRoot: 'https://gitlab.com/acme/infrastructure/-/blob/' },
  { provider: 'bitbucket', branchRoot: 'https://bitbucket.org/acme/infrastructure/src/', fileRoot: 'https://bitbucket.org/acme/infrastructure/src/' },
];

describe.each(pathProviders)('$provider browse URLs', ({ provider, branchRoot, fileRoot }) => {
  it('keeps a literal hash in a branch name out of the fragment', () => {
    const url = getVcsBranchUrl(provider, 'acme/infrastructure', 'feature#ticket');
    expect(url).toBe(`${branchRoot}feature%23ticket`);
  });

  it('encodes branch data in file links', () => {
    const url = getVcsFileUrl(provider, 'acme/infrastructure', 'feature#ticket', 'inventory/prod.yml');
    expect(url).toBe(`${fileRoot}feature%23ticket/inventory/prod.yml`);
  });

  it('keeps a literal hash in a file name out of the fragment', () => {
    const url = getVcsFileUrl(provider, 'acme/infrastructure', 'main', 'inventory/prod#blue.yml');
    expect(url).toBe(`${fileRoot}main/inventory/prod%23blue.yml`);
  });

  it('preserves a literal percent sequence without creating a directory separator', () => {
    const url = getVcsFileUrl(provider, 'acme/infrastructure', 'main', 'inventory/prod%2Fblue.yml');
    expect(url).toBe(`${fileRoot}main/inventory/prod%252Fblue.yml`);
    if (url === null) throw new Error('Missing file URL');
    const filename = new URL(url).pathname.split('/').at(-1) ?? '';
    expect(decodeURIComponent(filename)).toBe('prod%2Fblue.yml');
  });

  it('encodes spaces and query characters in file names', () => {
    const url = getVcsFileUrl(provider, 'acme/infrastructure', 'main', 'inventory/prod blue?.yml');
    expect(url).toBe(`${fileRoot}main/inventory/prod%20blue%3F.yml`);
  });

  it('preserves ordinary branches and slash-separated paths', () => {
    expect(getVcsBranchUrl(provider, 'acme/infrastructure', 'feature/topic')).toBe(`${branchRoot}feature/topic`);
    expect(getVcsFileUrl(provider, 'acme/infrastructure', 'feature/topic', 'modules/network/main.tf')).toBe(`${fileRoot}feature/topic/modules/network/main.tf`);
  });

  it('retains the main fallback when the file link has no branch', () => {
    expect(getVcsFileUrl(provider, 'acme/infrastructure', '', 'main.tf')).toBe(`${fileRoot}main/main.tf`);
  });
});

describe('browse URL guards and unchanged Azure URLs', () => {
  it('returns null when a required repository, branch or file is missing', () => {
    expect(getVcsBranchUrl('github', '', 'main')).toBeNull();
    expect(getVcsBranchUrl('github', 'acme/infrastructure', '')).toBeNull();
    expect(getVcsFileUrl('github', '', 'main', 'main.tf')).toBeNull();
    expect(getVcsFileUrl('github', 'acme/infrastructure', 'main', '')).toBeNull();
  });

  it('keeps unknown providers and missing-input guards ahead of encoding', () => {
    const malformed = '\ud800';
    expect(getVcsBranchUrl('unknown', 'acme/infrastructure', malformed)).toBeNull();
    expect(getVcsFileUrl('unknown', 'acme/infrastructure', malformed, malformed)).toBeNull();
    expect(getVcsBranchUrl('github', '', malformed)).toBeNull();
    expect(getVcsFileUrl('github', 'acme/infrastructure', malformed, '')).toBeNull();
  });

  it('retains Azure branch query encoding', () => {
    expect(getVcsBranchUrl('azure_devops', 'project/repo', 'feature#ticket', 'example')).toBe('https://dev.azure.com/example/project/_git/repo?version=GBfeature%23ticket');
  });

  it('retains Azure file query encoding and raw percent identity', () => {
    expect(getVcsFileUrl('azure_devops', 'project/repo', 'feature/topic#ticket', 'inventory/prod%2F blue?.yml', 'example')).toBe('https://dev.azure.com/example/project/_git/repo?path=%2Finventory%2Fprod%252F%20blue%3F.yml&version=GBfeature%2Ftopic%23ticket');
    expect(getVcsFileUrl('azure_devops', 'project/repo', '', 'main.tf', 'example')).toBe('https://dev.azure.com/example/project/_git/repo?path=%2Fmain.tf&version=GBmain');
  });

  it('retains Azure missing-account guards', () => {
    expect(getVcsBranchUrl('azure_devops', 'project/repo', 'main')).toBeNull();
    expect(getVcsFileUrl('azure_devops', 'project/repo', 'main', 'main.tf')).toBeNull();
  });
});
