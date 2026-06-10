// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// Pure formatting for activity-feed notifications, extracted from
// useActivityNotifications so the (action -> title/message/type) mapping is
// unit-testable without rendering the hook. Behaviour is verbatim from the
// original switch — see activityFormat.test.ts for the locked-in cases.

export interface ActivityAttributes {
  action: string;
  resource_type?: unknown;
  details?: Record<string, unknown> | null;
}

export interface ActivityNotificationContent {
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export function formatActivityNotification(attrs: ActivityAttributes): ActivityNotificationContent {
  const details = attrs.details || {};
  const resourceNameRaw = details.resource_name || attrs.resource_type;
  let resourceNameStr = '';
  if (resourceNameRaw) {
    if (typeof resourceNameRaw === 'string') {
      resourceNameStr = resourceNameRaw;
    } else if (typeof resourceNameRaw !== 'object' && resourceNameRaw !== null) {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      resourceNameStr = String(resourceNameRaw);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      resourceNameStr = String(resourceNameRaw);
    }
  }

  let title: string;
  let message: string;
  let type: 'success' | 'error' | 'info' | 'warning';

  switch (attrs.action) {
    case 'create':
      title = `${String(attrs.resource_type)} Created`;
      message = resourceNameStr ? `"${resourceNameStr}" was created` : `New ${String(attrs.resource_type)} created`;
      type = 'success';
      break;
    case 'update':
      title = `${String(attrs.resource_type)} Updated`;
      message = resourceNameStr ? `"${resourceNameStr}" was updated` : `${String(attrs.resource_type)} updated`;
      type = 'info';
      break;
    case 'delete':
      title = `${String(attrs.resource_type)} Deleted`;
      message = resourceNameStr ? `"${resourceNameStr}" was deleted` : `${String(attrs.resource_type)} deleted`;
      type = 'warning';
      break;
    case 'run_plan':
    case 'run_apply':
    case 'run_destroy': {
      title = 'Run Started';
      const operationRaw = details.operation || attrs.action;
      const statusRaw = details.status || 'started';
      const operationStr = typeof operationRaw === 'string'
        ? operationRaw
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        : (operationRaw != null && typeof operationRaw !== 'object' ? String(operationRaw) : '');
      const statusStr = typeof statusRaw === 'string'
        ? statusRaw
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        : (statusRaw != null && typeof statusRaw !== 'object' ? String(statusRaw) : 'started');
      message = `${operationStr} run ${statusStr}`;
      type = details.status === 'completed' ? 'success' : 'info';
      break;
    }
    default:
      title = 'Activity';
      message = `${String(attrs.action)} ${String(attrs.resource_type)}`;
      type = 'info';
  }

  return { title, message, type };
}
