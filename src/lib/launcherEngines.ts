// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

/** The engines a launcher runs jobs for, in words, from the runner_type it registered with. */
export function engineLabel(type: string): string {
  switch (type) {
    case 'tofu':
      return 'OpenTofu';
    case 'ansible':
      return 'Ansible';
    case 'combined':
      return 'OpenTofu and Ansible';
    default:
      return type;
  }
}
