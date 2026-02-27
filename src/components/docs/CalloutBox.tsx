// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { AlertCircle, AlertTriangle, Lightbulb, Info, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CalloutType = 'note' | 'tip' | 'important' | 'warning' | 'caution';

interface CalloutBoxProps {
  type: CalloutType;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const calloutConfig: Record<
  CalloutType,
  { icon: typeof Info; styles: string; codeBg: string; codeFg: string; markStyles: string; defaultTitle: string }
> = {
  note: {
    icon: Info,
    styles: 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400',
    codeBg: '[&_code]:bg-blue-500/20 dark:[&_code]:bg-blue-500/15',
    codeFg: '[&_code]:text-blue-800 dark:[&_code]:text-blue-300',
    markStyles: '[&_mark]:bg-blue-600/25 [&_mark]:text-blue-900 dark:[&_mark]:bg-blue-500/20 dark:[&_mark]:text-blue-300',
    defaultTitle: 'Note',
  },
  tip: {
    icon: Lightbulb,
    styles: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-700 dark:text-cyan-400',
    codeBg: '[&_code]:bg-cyan-500/20 dark:[&_code]:bg-cyan-500/15',
    codeFg: '[&_code]:text-cyan-800 dark:[&_code]:text-cyan-300',
    markStyles: '[&_mark]:bg-cyan-600/25 [&_mark]:text-cyan-900 dark:[&_mark]:bg-cyan-500/20 dark:[&_mark]:text-cyan-300',
    defaultTitle: 'Tip',
  },
  important: {
    icon: AlertCircle,
    styles: 'bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-400',
    codeBg: '[&_code]:bg-purple-500/20 dark:[&_code]:bg-purple-500/15',
    codeFg: '[&_code]:text-purple-800 dark:[&_code]:text-purple-300',
    markStyles: '[&_mark]:bg-purple-600/25 [&_mark]:text-purple-900 dark:[&_mark]:bg-purple-500/20 dark:[&_mark]:text-purple-300',
    defaultTitle: 'Important',
  },
  warning: {
    icon: AlertTriangle,
    styles: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400',
    codeBg: '[&_code]:bg-yellow-500/20 dark:[&_code]:bg-yellow-500/15',
    codeFg: '[&_code]:text-yellow-800 dark:[&_code]:text-yellow-200',
    markStyles: '[&_mark]:bg-yellow-600/25 [&_mark]:text-yellow-900 dark:[&_mark]:bg-yellow-500/20 dark:[&_mark]:text-yellow-200',
    defaultTitle: 'Warning',
  },
  caution: {
    icon: Zap,
    styles: 'bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-400',
    codeBg: '[&_code]:bg-orange-500/20 dark:[&_code]:bg-orange-500/15',
    codeFg: '[&_code]:text-orange-800 dark:[&_code]:text-orange-300',
    markStyles: '[&_mark]:bg-orange-600/25 [&_mark]:text-orange-900 dark:[&_mark]:bg-orange-500/20 dark:[&_mark]:text-orange-300',
    defaultTitle: 'Caution',
  },
};

/**
 * CalloutBox - Renders admonition/callout boxes matching design system
 * 
 * Matches the pattern from NotificationToast:
 * - Blurry background (backdrop-blur-md)
 * - Colored border and text
 * - Icon from lucide-react
 * - Rounded corners
 */
export function CalloutBox({ type, title, children, className }: CalloutBoxProps) {
  const config = calloutConfig[type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'relative p-4 rounded-lg border backdrop-blur-md shadow-sm',
        config.styles,
        className
      )}
      role="alert"
    >
      {title ? (
        <>
          <div className="flex items-start gap-3">
            <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <span className="font-semibold text-sm leading-5">{title}</span>
          </div>
          <div
            className={cn(
              'text-sm mt-1 ml-8 [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ol]:mb-2 [&>ul]:ml-4 [&>ol]:ml-4 [&>ul]:list-disc [&>ol]:list-decimal [&>p]:opacity-90 [&_*]:text-current [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded',
              config.codeBg,
              config.codeFg,
              config.markStyles
            )}
          >
            {children}
          </div>
        </>
      ) : (
        <div className="flex items-start gap-3">
          <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div
            className={cn(
              'flex-1 min-w-0 text-sm [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ol]:mb-2 [&>ul]:ml-4 [&>ol]:ml-4 [&>ul]:list-disc [&>ol]:list-decimal [&>p]:opacity-90 [&_*]:text-current [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded',
              config.codeBg,
              config.codeFg,
              config.markStyles
            )}
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
