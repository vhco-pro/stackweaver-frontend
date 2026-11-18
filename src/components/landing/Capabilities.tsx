// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { ArrowRight, Check, Play, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import opentofu from '@/assets/brands/opentofu.svg';
import ansible from '@/assets/brands/ansible.svg';
import { navigationLogo } from '@/lib/brandAssets';
import { glassSurface } from '@/lib/surfaces';
import { cn } from '@/lib/utils';
import './capabilities.css';

const linkClass = 'capability-link inline-flex min-h-11 items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500';

export function Capabilities() {
  return (
    <section id="features" aria-labelledby="capabilities-title" className="capabilities relative scroll-mt-24 px-4 py-12 md:px-6 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="capabilities-heading">
          <div>
            <p className="capabilities-eyebrow">What you can run</p>
            <h2 id="capabilities-title" className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent dark:from-white dark:via-blue-100 dark:to-purple-200 sm:text-4xl md:text-5xl">
              OpenTofu and Ansible
            </h2>
          </div>
          <p className="capabilities-summary">OpenTofu workspaces and Ansible job templates share your organizations, teams and launchers.</p>
        </div>

        <div className="capabilities-grid">
          <article className={cn(glassSurface, 'capability-card capability-tofu')}>
            <div className="capability-engine"><img src={opentofu} alt="" width={24} height={26} /><span>OpenTofu</span></div>
            <h3>Review plans and apply changes.</h3>
            <p className="capability-description">Connect GitHub or Azure DevOps to plan changes from pull requests. Add external run checks and choose whether applies need confirmation.</p>
            <div className="capability-run" role="img" aria-label="Example OpenTofu run: commit, plan, external checks, apply. Checks and apply confirmation are configurable.">
              <div className="capability-flow" aria-hidden="true">
                <span className="capability-node">Commit</span><span className="capability-connector" />
                <span className="capability-node">Plan</span><span className="capability-connector" />
                <span className="capability-node capability-node-active">Checks</span><span className="capability-connector" />
                <span className="capability-node">Apply</span>
              </div>
              <p aria-hidden="true">An example run with external checks enabled.</p>
            </div>
            <ul className="capability-tags" aria-label="OpenTofu capabilities">
              <li>Pull request plans</li><li>State versions</li><li>Variable sets</li><li>Private modules</li>
            </ul>
            <Link to="/docs/user-guides/opentofu" className={linkClass}>OpenTofu guide <ArrowRight aria-hidden="true" className="size-4" /></Link>
          </article>

          <article className={cn(glassSurface, 'capability-card capability-ansible')}>
            <div className="capability-engine"><img src={ansible} alt="" width={24} height={24} /><span>Ansible</span></div>
            <h3>Schedule playbooks and build workflows.</h3>
            <p className="capability-description">Launch jobs on demand or on a schedule. Build workflows that sync an inventory, wait for approval, then run a job template.</p>
            <div className="capability-jobs" role="img" aria-label="Example Ansible workflow: sync inventory, wait for approval, run a job template.">
              <div className="capability-job-step"><span><RefreshCw aria-hidden="true" /></span><p>Sync inventory</p></div>
              <span className="capability-connector" aria-hidden="true" />
              <div className="capability-job-step"><span><Check aria-hidden="true" /></span><p>Approval</p></div>
              <span className="capability-connector" aria-hidden="true" />
              <div className="capability-job-step"><span><Play aria-hidden="true" /></span><p>Run job</p></div>
            </div>
            <ul className="capability-tags" aria-label="Ansible capabilities"><li>Cloud inventories</li><li>Schedules</li><li>Host and task results</li></ul>
            <Link to="/ansible" className={linkClass}>Ansible automation <ArrowRight aria-hidden="true" className="size-4" /></Link>
          </article>

          <article className={cn(glassSurface, 'capability-card capability-execution')}>
            <div>
              <p className="capability-execution-label">Launchers</p>
              <h3>Choose where jobs run.</h3>
              <p className="capability-description">Run both engines on your installation's hosted capacity, or route work to agent pools inside your network. Launchers use Linux processes, containers or Kubernetes pods.</p>
              <Link to="/docs/user-guides/launchers" className={linkClass}>Launcher guide <ArrowRight aria-hidden="true" className="size-4" /></Link>
            </div>
            <div className="capability-routing" role="img" aria-label="Launchers in your agent pool connect outbound to Stackweaver over HTTPS.">
              <div className="capability-platform"><img src={navigationLogo} width={40} height={40} alt="" /><span>Stackweaver</span></div>
              <div className="capability-outbound"><span>Outbound HTTPS</span><ArrowRight aria-hidden="true" /></div>
              <div className="capability-pool"><strong>Your agent pool</strong><span>OpenTofu and Ansible launchers</span><div className="capability-servers" aria-hidden="true"><i /><i /><i /></div></div>
            </div>
          </article>
        </div>

        <div className="capabilities-foundation">
          <div><h3>Cloud credentials</h3><p>Use OIDC for short-lived AWS, Azure and GCP credentials in jobs.</p></div>
          <div><h3>Team access</h3><p>Sign in through your identity provider and set permissions by team.</p></div>
          <div><h3>API and provider</h3><p>Manage the platform with the Stackweaver provider or its TFE-compatible API for supported workflows.</p></div>
        </div>
      </div>
    </section>
  );
}
