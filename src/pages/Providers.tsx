// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Cloud, Package, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GradientButton } from '@/components/ui/gradient-button';
import { Page } from '@/components/layout/Page';
import { PageHeader } from '@/components/layout/PageHeader';
import { cn } from '@/lib/utils';

interface Provider {
  name: string;
  description: string;
  icon: string;
  status: 'connected' | 'not_connected';
  gradient: string;
}

const providers: Provider[] = [
  {
    name: 'AWS',
    description: 'Amazon Web Services',
    icon: '☁️',
    status: 'not_connected',
    gradient: 'from-indigo-500 to-blue-500',
  },
  {
    name: 'Azure',
    description: 'Microsoft Azure',
    icon: '🔷',
    status: 'not_connected',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    name: 'GCP',
    description: 'Google Cloud Platform',
    icon: '🌐',
    status: 'not_connected',
    gradient: 'from-cyan-500 to-blue-500',
  },
  {
    name: 'DigitalOcean',
    description: 'DigitalOcean Cloud',
    icon: '💧',
    status: 'not_connected',
    gradient: 'from-blue-500 to-indigo-500',
  },
  {
    name: 'Hetzner',
    description: 'Hetzner Cloud',
    icon: '🇩🇪',
    status: 'not_connected',
    gradient: 'from-indigo-500 to-cyan-500',
  },
  {
    name: 'Linode',
    description: 'Akamai Linode',
    icon: '🟢',
    status: 'not_connected',
    gradient: 'from-cyan-500 to-indigo-500',
  },
];

export default function Providers() {
  return (
    <Page className="space-y-8">
      <PageHeader
        icon={Package}
        title="Cloud Providers"
        subtitle="Connect and manage your cloud provider accounts"
        action={
          <GradientButton ramp="app" className="w-auto px-4 py-2">
            <Plus className="h-4 w-4 mr-2" />
            Add Provider
          </GradientButton>
        }
      />

      {/* Providers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 gap-6">
        {providers.map((provider) => (
          <div
            key={provider.name}
            className={cn(
              'group relative overflow-hidden rounded-2xl',
              'bg-gradient-to-br from-white/90 via-white/75 to-white/60 dark:from-black/10 dark:via-black/5 dark:to-transparent',
              'backdrop-blur-md border border-gray-300/80 dark:border-white/10',
              'p-6 shadow-lg shadow-purple-500/10',
              'transition-all duration-300',
              'hover:shadow-xl hover:shadow-purple-500/20 hover:scale-[1.02]',
              'hover:border-purple-500/30'
            )}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-xl',
                  `bg-gradient-to-br ${provider.gradient}`,
                  'shadow-lg group-hover:scale-110 transition-transform duration-300'
                )}>
                  <span className="text-2xl">{provider.icon}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-lg group-hover:text-primary transition-colors duration-200">
                    {provider.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {provider.description}
                  </p>
                </div>
              </div>
              {provider.status === 'connected' ? (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 border border-indigo-500/30">
                  <Check className="h-4 w-4 text-white" />
                </div>
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 border border-white/20">
                  <div className="h-2 w-2 rounded-full bg-indigo-400/50" />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-6">
              <span className={cn(
                'text-xs font-medium px-2.5 py-1 rounded-full',
                provider.status === 'connected'
                  ? 'bg-gradient-to-br from-indigo-500/20 to-blue-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'bg-white/5 text-gray-400 border border-white/10'
              )}>
                {provider.status === 'connected' ? 'Connected' : 'Not Connected'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              >
                {provider.status === 'connected' ? 'Manage' : 'Connect'}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Coming Soon Notice */}
      <div className={cn(
        'rounded-2xl',
        'bg-gradient-to-br from-white/90 via-white/75 to-white/60 dark:from-black/10 dark:via-black/5 dark:to-transparent',
        'backdrop-blur-md border border-gray-300/80 dark:border-white/10',
        'p-6 shadow-lg shadow-purple-500/10'
      )}>
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500">
            <Cloud className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold mb-1">Provider Integration Coming Soon</h3>
            <p className="text-sm text-muted-foreground">
              Connect your cloud provider accounts to enable automated infrastructure management, cost tracking, and resource discovery.
            </p>
          </div>
        </div>
      </div>
    </Page>
  );
}

