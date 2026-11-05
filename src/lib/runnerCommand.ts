// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/** The workload a launcher serves, which picks its image. */
export type LauncherEngine = 'tofu' | 'ansible';
/** How the launcher runs each job: as its own child process, or in a fresh container. */
export type LauncherDriver = 'in-process' | 'container';

const IMAGES: Record<LauncherEngine, string> = {
  tofu: 'ghcr.io/vhco-pro/stackweaver-opentofu-runner:latest',
  ansible: 'ghcr.io/vhco-pro/stackweaver-ansible-runner:latest',
};

/**
 * The address a launcher registers with: the origin of the API the browser itself calls (the
 * configured API URL, resolved against the page), so a deployment that serves the API on its own
 * host, as tunnel mode does, gets the API's host and not the app's.
 */
export function launcherServer(apiUrl: string, pageOrigin: string): string {
  try {
    return new URL(apiUrl, pageOrigin).origin;
  } catch {
    return pageOrigin;
  }
}

/** The `docker run` command that starts a launcher for a pool, as the self-hosted runner guide gives it. */
export function launcherCommand(o: { engine: LauncherEngine; driver: LauncherDriver; poolId: string; server: string }): string {
  const image = IMAGES[o.engine];
  // A stopping launcher drains its jobs for up to 5 minutes, then stops what is left within 60 s;
  // Docker's default stop timeout of 10 s would kill it first.
  const lines = ['docker run -d --restart unless-stopped --stop-timeout 390'];
  if (o.driver === 'container') {
    lines.push(
      '--user root',
      '-v /var/run/docker.sock:/var/run/docker.sock',
      '-v stackweaver-launcher-cache:/var/cache/stackweaver-launcher',
    );
  }
  lines.push(
    `-e RUNNER_AGENT_POOL_ID=${o.poolId || '<pool-uuid>'}`,
    '-e STACKWEAVER_TOKEN=<registration-token>',
    `-e STACKWEAVER_SERVER=${o.server}`,
    `-e RUNNER_NAME=my-${o.engine}-launcher`,
  );
  if (o.driver === 'container') {
    lines.push(
      '-e RUNNER_DRIVER=container',
      `-e RUNNER_IMAGE=${image}`,
      '-e RUNNER_NETWORK=stackweaver-jobs',
      '-e RUNNER_MAX_CONCURRENT_JOBS=4',
      '-e RUNNER_CACHE_DIR=/var/cache/stackweaver-launcher',
      '-e RUNNER_CACHE_VOLUME=stackweaver-launcher-cache',
    );
  }
  lines.push(image);
  return lines.join(' \\\n  ');
}
