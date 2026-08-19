// Copyright (c) 2026 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Link } from 'react-router-dom';
import type { AnalyticsTopTemplate, AnalyticsTopWorkspace } from '@/api/client';
import { formatDuration, formatRate, useChartPalette } from '../chartTheme';
import { EmptyState } from '@/components/ui/analytics-card';

/** Busiest workspaces, most runs first. Each row links to the workspace it describes. */
export function TopWorkspaces({ rows, orgName }: { rows: AnalyticsTopWorkspace[]; orgName: string }) {
  if (rows.length === 0) {
    return <EmptyState message="No workspace runs in this period." />;
  }
  return (
    <Table
      headers={['Workspace', 'Runs', 'Success', 'Avg']}
      rows={rows.map(row => ({
        key: row.workspace_id,
        name: (
          <Link
            to={`/app/${orgName}/workspaces/${row.workspace_name}`}
            className="font-medium text-foreground hover:text-purple-500 hover:underline"
          >
            {row.workspace_name}
          </Link>
        ),
        sub: row.project_name,
        count: row.run_count,
        rate: row.success_rate,
        duration: row.avg_duration_seconds,
      }))}
    />
  );
}

/** Busiest job templates. Ad hoc jobs carry no template and are not listed here. */
export function TopTemplates({ rows }: { rows: AnalyticsTopTemplate[] }) {
  if (rows.length === 0) {
    return <EmptyState message="No template-launched jobs in this period." />;
  }
  return (
    <Table
      headers={['Template', 'Jobs', 'Success', 'Avg']}
      rows={rows.map(row => ({
        key: row.template_id,
        name: <span className="font-medium text-foreground">{row.template_name}</span>,
        count: row.job_count,
        rate: row.success_rate,
        duration: row.avg_duration_seconds,
      }))}
    />
  );
}

interface Row {
  key: string;
  name: React.ReactNode;
  sub?: string;
  count: number;
  rate: number | null;
  duration: number;
}

function Table({ headers, rows }: { headers: string[]; rows: Row[] }) {
  const palette = useChartPalette();
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th
                key={header}
                scope="col"
                className={`border-b border-white/10 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ${
                  index === 0 ? 'text-left' : 'text-right'
                }`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.key} className="border-b border-white/5 last:border-0">
              <td className="py-2.5 pr-3">
                <div className="truncate">{row.name}</div>
                {row.sub && <div className="truncate text-xs text-muted-foreground">{row.sub}</div>}
              </td>
              <td className="py-2.5 text-right tabular-nums text-foreground">{row.count}</td>
              <td className="py-2.5 pl-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <div className="h-[5px] w-16 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${row.rate ?? 0}%`,
                        backgroundColor: row.rate !== null && row.rate < 80 ? palette.failed : palette.succeeded,
                      }}
                    />
                  </div>
                  <span className="w-12 text-right tabular-nums text-muted-foreground">{formatRate(row.rate)}</span>
                </div>
              </td>
              <td className="py-2.5 pl-3 text-right tabular-nums text-muted-foreground">
                {formatDuration(row.duration)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
