// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { describe, expect, it } from 'vitest';
import { launcherCommand, launcherServer } from './runnerCommand';

describe('launcherServer', () => {
  it('is the origin of the API the browser calls, not the page origin', () => {
    expect(launcherServer('https://api.sw.example.com/api/v2', 'https://sw.example.com')).toBe('https://api.sw.example.com');
  });

  it('resolves a relative API URL against the page and keeps plain HTTP', () => {
    expect(launcherServer('/api/v2', 'http://localhost:5173')).toBe('http://localhost:5173');
    expect(launcherServer('http://localhost:8022/api/v2', 'http://localhost:5173')).toBe('http://localhost:8022');
  });
});

describe('launcherCommand', () => {
  const base = { poolId: 'pool-1', server: 'https://api.example.com' };

  it('runs the in-process driver with the pool, token and server', () => {
    const cmd = launcherCommand({ ...base, engine: 'tofu', driver: 'in-process' });
    expect(cmd).toContain('-e RUNNER_AGENT_POOL_ID=pool-1');
    expect(cmd).toContain('-e STACKWEAVER_TOKEN=<registration-token>');
    expect(cmd).toContain('-e STACKWEAVER_SERVER=https://api.example.com');
    expect(cmd).not.toContain('RUNNER_DRIVER');
    expect(cmd.startsWith('docker run -d --restart unless-stopped --stop-timeout 390')).toBe(true);
    expect(cmd.trim().endsWith('ghcr.io/vhco-pro/stackweaver-opentofu-runner:latest')).toBe(true);
  });

  it('gives the container driver the socket, the jobs network, the cache and its own image', () => {
    const cmd = launcherCommand({ ...base, engine: 'ansible', driver: 'container' });
    for (const part of [
      '--user root',
      '-v /var/run/docker.sock:/var/run/docker.sock',
      '-v stackweaver-launcher-cache:/var/cache/stackweaver-launcher',
      '-e RUNNER_DRIVER=container',
      '-e RUNNER_IMAGE=ghcr.io/vhco-pro/stackweaver-ansible-runner:latest',
      '-e RUNNER_NETWORK=stackweaver-jobs',
      '-e RUNNER_CACHE_DIR=/var/cache/stackweaver-launcher',
      '-e RUNNER_CACHE_VOLUME=stackweaver-launcher-cache',
      '-e RUNNER_NAME=my-ansible-launcher',
    ]) {
      expect(cmd).toContain(part);
    }
  });

  it('shows a placeholder until a pool is chosen', () => {
    expect(launcherCommand({ ...base, poolId: '', engine: 'tofu', driver: 'in-process' })).toContain('RUNNER_AGENT_POOL_ID=<pool-uuid>');
  });
});
