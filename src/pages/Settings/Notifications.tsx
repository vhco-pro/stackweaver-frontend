// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { Bell, Mail, Smartphone, MessageSquare } from 'lucide-react';
import { GradientButton } from '@/components/ui/gradient-button';
import { Page } from '@/components/layout/Page';
import { PageHeader } from '@/components/layout/PageHeader';
import { cn } from '@/lib/utils';

interface NotificationSetting {
  id: string;
  label: string;
  description: string;
  email: boolean;
  push: boolean;
  inApp: boolean;
}

export default function NotificationSettings() {
  const [settings, setSettings] = useState<NotificationSetting[]>([
    {
      id: 'runs',
      label: 'Run Status Updates',
      description: 'Get notified when runs start, complete, or fail',
      email: true,
      push: true,
      inApp: true,
    },
    {
      id: 'workspace',
      label: 'Workspace Changes',
      description: 'Notifications for workspace updates and changes',
      email: true,
      push: false,
      inApp: true,
    },
    {
      id: 'team',
      label: 'Team Activity',
      description: 'Updates when team members make changes',
      email: false,
      push: false,
      inApp: true,
    },
    {
      id: 'security',
      label: 'Security Alerts',
      description: 'Important security notifications and alerts',
      email: true,
      push: true,
      inApp: true,
    },
    {
      id: 'projects',
      label: 'Project Updates',
      description: 'Notifications about project changes',
      email: false,
      push: false,
      inApp: true,
    },
  ]);

  const toggleSetting = (id: string, type: 'email' | 'push' | 'inApp') => {
    setSettings(prev =>
      prev.map(setting =>
        setting.id === id
          ? { ...setting, [type]: !setting[type] }
          : setting
      )
    );
  };

  const ToggleSwitch = ({ enabled, onChange, label }: { enabled: boolean; onChange: () => void; label: string }) => (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      onClick={onChange}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
        enabled ? 'bg-gradient-to-r from-indigo-500 to-blue-500' : 'bg-gray-300 dark:bg-gray-600'
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
          enabled ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  );

  return (
    <Page ramp="notifications" className="space-y-8">
      <PageHeader
        icon={Bell}
        title="Notification Settings"
        subtitle="Configure email and in-app notification preferences"
        backTo={{ to: '/settings', label: 'Back to Settings' }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Notification Channels */}
          <div className={cn(
            'rounded-2xl',
            'bg-gradient-to-br from-white/90 via-white/75 to-white/60 dark:from-black/10 dark:via-black/5 dark:to-transparent',
            'backdrop-blur-md border border-gray-300/80 dark:border-white/10',
            'p-6 shadow-lg shadow-purple-500/10'
          )}>
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Bell className="h-5 w-5 text-indigo-500" />
              Notification Channels
            </h3>
            
            <div className="space-y-4">
              {settings.map((setting) => (
                <div
                  key={setting.id}
                  className="p-4 rounded-xl border border-white/10 dark:border-white/5 bg-white/5 dark:bg-black/5"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-medium mb-1">{setting.label}</h4>
                      <p className="text-sm text-muted-foreground">{setting.description}</p>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Email</span>
                      <ToggleSwitch
                        enabled={setting.email}
                        onChange={() => toggleSetting(setting.id, 'email')}
                        label={`${setting.label}: Email`}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Push</span>
                      <ToggleSwitch
                        enabled={setting.push}
                        onChange={() => toggleSetting(setting.id, 'push')}
                        label={`${setting.label}: Push`}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">In-App</span>
                      <ToggleSwitch
                        enabled={setting.inApp}
                        onChange={() => toggleSetting(setting.id, 'inApp')}
                        label={`${setting.label}: In-App`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end">
            <GradientButton ramp="app" className="w-auto px-4 py-2">
              Save Preferences
            </GradientButton>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className={cn(
            'rounded-2xl',
            'bg-gradient-to-br from-white/90 via-white/75 to-white/60 dark:from-black/10 dark:via-black/5 dark:to-transparent',
            'backdrop-blur-md border border-gray-300/80 dark:border-white/10',
            'p-6 shadow-lg shadow-purple-500/10'
          )}>
            <h3 className="font-semibold mb-3">Notification Preferences</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Choose how you want to receive notifications. You can enable or disable each channel for different types of events.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>Email notifications are sent to your registered email address</span>
              </div>
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <span>Push notifications require browser permission</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span>In-app notifications appear in the application</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}

