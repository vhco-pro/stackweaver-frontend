// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
export interface NavigationConnection extends EventTarget { saveData?: boolean; effectiveType?: string }
export function navigationConnection() { return (navigator as Navigator & { connection?: NavigationConnection }).connection; }
export function unrestrictedConnection() {
  const connection = navigationConnection();
  return navigator.onLine !== false && !connection?.saveData && !['slow-2g', '2g'].includes(connection?.effectiveType ?? '');
}
