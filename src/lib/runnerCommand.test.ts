// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, expect, it } from 'vitest';
import { containerLauncherCommand, inProcessLauncherCommand, launcherServer } from './runnerCommand';

describe('launcherServer', () => {
  it('is the API URL without its /api/v2 suffix, not the page origin', () => {
    expect(launcherServer('https://api.sw.example.com/api/v2', 'https://sw.example.com')).toBe('https://api.sw.example.com');
  });

  it('resolves a relative API URL against the page and keeps plain HTTP', () => {
    expect(launcherServer('/api/v2', 'http://localhost:5173')).toBe('http://localhost:5173');
    expect(launcherServer('http://localhost:8022/api/v2', 'http://localhost:5173')).toBe('http://localhost:8022');
  });

  it('keeps a path the API is served under', () => {
    expect(launcherServer('https://sw.example.com/stackweaver/api/v2/', 'https://sw.example.com')).toBe('https://sw.example.com/stackweaver');
  });
});

describe('containerLauncherCommand', () => {
  const base = { poolId: 'pool-1', server: 'https://api.example.com' };

  it('runs the launcher image on the container driver for both engines, as the guide does', () => {
    const cmd = containerLauncherCommand(base);
    for (const part of [
      '--user root',
      '-v /var/run/docker.sock:/var/run/docker.sock',
      '-v stackweaver-launcher-cache:/var/cache/stackweaver-launcher',
      '-e RUNNER_AGENT_POOL_ID=pool-1',
      '-e STACKWEAVER_TOKEN=<registration-token>',
      '-e STACKWEAVER_SERVER=https://api.example.com',
      '-e RUNNER_NAME=my-launcher',
      '-e RUNNER_DRIVER=container',
      '-e RUNNER_TOFU_IMAGE=ghcr.io/vhco-pro/stackweaver-opentofu-runner:latest',
      '-e RUNNER_ANSIBLE_IMAGE=ghcr.io/vhco-pro/stackweaver-ansible-runner:latest',
      '-e RUNNER_DOCKER_CONFIG=/etc/stackweaver/registry-auth.json',
      '-e RUNNER_FIREWALL_IMAGE=ghcr.io/vhco-pro/stackweaver-launcher:latest',
      '-e RUNNER_NETWORK=stackweaver-jobs',
      '-e RUNNER_CACHE_DIR=/var/cache/stackweaver-launcher',
      '-e RUNNER_CACHE_VOLUME=stackweaver-launcher-cache',
    ]) {
      expect(cmd).toContain(part);
    }
    expect(cmd).not.toContain('RUNNER_IMAGE=');
    expect(cmd.startsWith('docker run -d --restart unless-stopped --stop-timeout 390')).toBe(true);
    expect(cmd.trim().endsWith('ghcr.io/vhco-pro/stackweaver-launcher:latest')).toBe(true);
  });

  it('shows a placeholder until a pool is chosen', () => {
    expect(containerLauncherCommand({ ...base, poolId: '' })).toContain('RUNNER_AGENT_POOL_ID=<pool-uuid>');
  });
});

describe('inProcessLauncherCommand', () => {
  const base = { poolId: 'pool-1', server: 'https://api.example.com' };

  it('runs the engine job image as an in-process launcher for that engine', () => {
    const tofu = inProcessLauncherCommand({ ...base, engine: 'tofu' });
    expect(tofu).toContain('-e RUNNER_AGENT_POOL_ID=pool-1');
    expect(tofu).toContain('-e STACKWEAVER_TOKEN=<registration-token>');
    expect(tofu).toContain('-e STACKWEAVER_SERVER=https://api.example.com');
    expect(tofu).toContain('-e RUNNER_NAME=my-tofu-launcher');
    expect(tofu).not.toContain('RUNNER_DRIVER');
    expect(tofu.startsWith('docker run -d --restart unless-stopped --stop-timeout 390')).toBe(true);
    expect(tofu.trim().endsWith('ghcr.io/vhco-pro/stackweaver-opentofu-runner:latest')).toBe(true);

    const ansible = inProcessLauncherCommand({ ...base, engine: 'ansible' });
    expect(ansible).toContain('-e RUNNER_NAME=my-ansible-launcher');
    expect(ansible.trim().endsWith('ghcr.io/vhco-pro/stackweaver-ansible-runner:latest')).toBe(true);
  });
});
