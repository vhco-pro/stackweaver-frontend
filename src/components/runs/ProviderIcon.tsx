// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Cloud } from 'lucide-react';
import { useState, useEffect } from 'react';

interface ProviderIconProps {
    providerName?: string;
    resourceType?: string;
    className?: string;
}

import { cn } from '@/lib/utils';

export function ProviderIcon({ providerName, resourceType, className = "h-4 w-4" }: ProviderIconProps) {
    const [iconSrc, setIconSrc] = useState<string | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let key = '';

        // Normalize provider name
        const provider = providerName?.toLowerCase() || '';
        const type = resourceType?.toLowerCase() || '';

        // Determine provider key
        if (provider) {
            // Direct matches or known aliases
            if (provider.includes('aws')) key = 'aws';
            else if (provider.includes('azure') || provider.includes('azurerm')) key = 'azurerm';
            else if (provider.includes('google') || provider.includes('gcp')) key = 'google';
            else if (provider.includes('digitalocean')) key = 'digitalocean';
            else if (provider.includes('kubernetes')) key = 'kubernetes';
            else if (provider.includes('helm')) key = 'helm';
            else if (provider.includes('cloudflare')) key = 'cloudflare';
            else if (provider.includes('github')) key = 'github';
            else if (provider.includes('gitlab')) key = 'gitlab';
            else if (provider.includes('datadog')) key = 'datadog';
            else if (provider.includes('docker')) key = 'docker';
            else if (provider.includes('hcp')) key = 'hcp';
            else if (provider.includes('vault')) key = 'vault';
            else if (provider.includes('nomad')) key = 'nomad';
            else if (provider.includes('consul')) key = 'consul';
            else if (provider.includes('tfe')) key = 'terraform';

            else if (
                provider.includes('random') ||
                provider.includes('null') ||
                provider.includes('tls') ||
                provider.includes('time') ||
                provider.includes('local') ||
                provider.includes('http') ||
                provider.includes('archive') ||
                provider.includes('dns') ||
                provider.includes('external')
            ) key = 'terraform';
            else if (provider.includes('1password')) key = '1password';

            else if (provider.includes('jetbrains')) key = 'jetbrains';
            else if (provider.includes('talos')) key = 'talos';
            else if (provider.includes('splunk')) key = 'splunk';
            else if (provider.includes('spectrocloud')) key = 'spectrocloud';
            else if (provider.includes('snyk')) key = 'snyk';
            else if (provider.includes('nutanix')) key = 'nutanix';
            else if (provider.includes('pagerduty')) key = 'pagerduty';
            else if (provider.includes('proxmox')) key = 'proxmox';
            else if (provider.includes('grafana')) key = 'grafana';
            else if (provider.includes('mongodb')) key = 'mongodb';
            else if (provider.includes('netapp')) key = 'netapp';
            else if (provider.includes('netlify')) key = 'netlify';
            else if (provider.includes('ngrok')) key = 'ngrok';
            else if (provider.includes('okta')) key = 'okta';
            else if (provider.includes('octopusdeploy')) key = 'octopusdeploy';
            else if (provider.includes('ovh')) key = 'ovh';
            else if (provider.includes('cloudsmith')) key = 'cloudsmith';
            else if (provider.includes('codefresh')) key = 'codefresh';

            else if (provider.includes('elastic')) key = 'elastic';
            else if (provider.includes('hashicorp') || provider.includes('terraform')) key = 'terraform';
            // Use the provider name directly if no specific logic
            else key = provider;
        } else if (type) {
            // Determine from resource type prefix
            if (type.startsWith('aws_')) key = 'aws';
            else if (type.startsWith('azurerm_') || type.startsWith('azuread_')) key = 'azurerm';
            else if (type.startsWith('google_')) key = 'google';
            else if (type.startsWith('digitalocean_')) key = 'digitalocean';
            else if (type.startsWith('kubernetes_')) key = 'kubernetes';
            else if (type.startsWith('helm_')) key = 'helm';
            else if (type.startsWith('cloudflare_')) key = 'cloudflare';
            else if (type.startsWith('github_')) key = 'github';
            else if (type.startsWith('gitlab_')) key = 'gitlab';
            else if (type.startsWith('datadog_')) key = 'datadog';
            else if (type.startsWith('docker_')) key = 'docker';
            else if (type.startsWith('hcp_')) key = 'hcp';
            else if (type.startsWith('vault_')) key = 'vault';
            else if (type.startsWith('nomad_')) key = 'nomad';
            else if (type.startsWith('consul_')) key = 'consul';
            else if (type.startsWith('tfe_')) key = 'terraform';
            else if (type.startsWith('proxmox_')) key = 'proxmox';
            else if (type.startsWith('random_')) key = 'terraform';
            else if (type.startsWith('null_')) key = 'terraform';
            else if (type.startsWith('tls_')) key = 'terraform';
            else if (type.startsWith('time_')) key = 'terraform';
            else if (type.startsWith('local_')) key = 'terraform';
            else if (type.startsWith('http_')) key = 'terraform';
            else if (type.startsWith('archive_')) key = 'terraform';
            else if (type.startsWith('dns_')) key = 'terraform';
            else if (type.startsWith('external_')) key = 'terraform';
            else {
                // Try to extract provider from type (e.g. "provider_resource")
                const parts = type.split('_');
                if (parts.length > 1) {
                    key = parts[0];
                }
            }
        }

        if (key) {
            // Use setTimeout to avoid setState during render
            setTimeout(() => {
                setIconSrc(`/icons/${key}.svg`);
                setError(false);
            }, 0);
        } else {
            setTimeout(() => {
                setIconSrc(null);
            }, 0);
        }
    }, [providerName, resourceType]);

    if (error || !iconSrc) {
        return <Cloud className={cn("text-muted-foreground", className)} />;
    }

    return (
        <img
            src={iconSrc}
            alt={providerName || 'Provider'}
            className={cn("object-contain", className)}
            onError={() => setError(true)}
        />
    );
}
