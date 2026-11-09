// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/** The engine an in-process launcher serves, which picks its job image. */
export type LauncherEngine = 'tofu' | 'ansible';

const LAUNCHER_IMAGE = 'ghcr.io/vhco-pro/stackweaver-launcher:latest';
const JOB_IMAGES: Record<LauncherEngine, string> = {
  tofu: 'ghcr.io/vhco-pro/stackweaver-opentofu-runner:latest',
  ansible: 'ghcr.io/vhco-pro/stackweaver-ansible-runner:latest',
};

/**
 * The address a launcher registers with: the configured API URL, resolved against the page,
 * without its /api/v2 suffix. A deployment that serves the API on its own host, as tunnel mode
 * does, gets the API's host and not the app's, and plain HTTP stays plain HTTP.
 */
export function launcherServer(apiUrl: string, pageOrigin: string): string {
  try {
    const url = new URL(apiUrl, pageOrigin);
    const path = url.pathname.replace(/\/+$/, '').replace(/\/api\/v2$/, '');
    return url.origin + path;
  } catch {
    return pageOrigin;
  }
}

/** The registration part every launcher command shares. */
function registration(poolId: string, server: string, name: string): string[] {
  return [
    `-e RUNNER_AGENT_POOL_ID=${poolId || '<pool-uuid>'}`,
    '-e STACKWEAVER_TOKEN=<registration-token>',
    `-e STACKWEAVER_SERVER=${server}`,
    `-e RUNNER_NAME=${name}`,
  ];
}

// A stopping launcher drains its jobs for up to 5 minutes, then stops what is left within 60 s;
// Docker's default stop timeout of 10 s would kill it first.
const DOCKER_RUN = 'docker run -d --restart unless-stopped --stop-timeout 390';

/**
 * The `docker run` command that starts a container-driver launcher for a pool from the launcher
 * image, as the self-hosted runners guide gives it: it serves both engines and places each job in
 * its engine's job image.
 */
export function containerLauncherCommand(o: { poolId: string; server: string }): string {
  return [
    `${DOCKER_RUN} --user root`,
    '-v /var/run/docker.sock:/var/run/docker.sock',
    '-v stackweaver-launcher-cache:/var/cache/stackweaver-launcher',
    '-v "$PWD/registry-auth.json:/etc/stackweaver/registry-auth.json:ro"',
    ...registration(o.poolId, o.server, 'my-launcher'),
    '-e RUNNER_DRIVER=container',
    `-e RUNNER_TOFU_IMAGE=${JOB_IMAGES.tofu}`,
    `-e RUNNER_ANSIBLE_IMAGE=${JOB_IMAGES.ansible}`,
    '-e RUNNER_DOCKER_CONFIG=/etc/stackweaver/registry-auth.json',
    `-e RUNNER_FIREWALL_IMAGE=${LAUNCHER_IMAGE}`,
    '-e RUNNER_NETWORK=stackweaver-jobs',
    '-e RUNNER_MAX_CONCURRENT_JOBS=4',
    '-e RUNNER_CACHE_DIR=/var/cache/stackweaver-launcher',
    '-e RUNNER_CACHE_VOLUME=stackweaver-launcher-cache',
    LAUNCHER_IMAGE,
  ].join(' \\\n  ');
}

/**
 * The `docker run` command that starts an in-process launcher for one engine from that engine's
 * job image, as the self-hosted runners guide gives it: each job runs as a child process of the
 * launcher's own container.
 */
export function inProcessLauncherCommand(o: { engine: LauncherEngine; poolId: string; server: string }): string {
  return [DOCKER_RUN, ...registration(o.poolId, o.server, `my-${o.engine}-launcher`), JOB_IMAGES[o.engine]].join(' \\\n  ');
}
