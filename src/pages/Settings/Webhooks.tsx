// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { 
  Webhook,
  Copy,
  CheckCircle2,
  AlertCircle,
  Info,
  ExternalLink,
  RefreshCw,
  Shield,
  Clock,
  Activity,
  ArrowLeft,
  Loader2,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { getVcsProviderIcon } from '@/lib/vcs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiClient } from '@/api/client';

// Parse workspace names from message like "2 workspace(s) triggered: ws1, ws2"
function parseWorkspacesFromMessage(message?: string): { summary: string; workspaces: string[] } {
  if (!message) return { summary: '-', workspaces: [] };
  
  // Pattern: "X workspace(s) triggered: name1, name2" or "PR #N: X workspace(s) triggered: name1, name2"
  const match = message.match(/(\d+)\s+workspace\(s\)\s+triggered(?::\s*(.+))?$/);
  if (match) {
    const count = match[1];
    const workspaceList = match[2];
    if (workspaceList) {
      const workspaces = workspaceList.split(',').map(s => s.trim()).filter(Boolean);
      // Check if message has PR prefix
      const prMatch = message.match(/^PR #(\d+):/);
      const summary = prMatch 
        ? `PR #${prMatch[1]}: ${count} workspace(s)`
        : `${count} workspace(s) triggered`;
      return { summary, workspaces };
    }
    return { summary: message, workspaces: [] };
  }
  
  return { summary: message, workspaces: [] };
}

// Component to display webhook message with expandable workspace list
function WebhookMessageCell({ message }: { message?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const { summary, workspaces } = parseWorkspacesFromMessage(message);
  
  if (workspaces.length === 0) {
    return <span className="max-w-[250px] truncate block" title={message}>{summary}</span>;
  }
  
  return (
    <div>
      <button 
        onClick={() => { setIsOpen(!isOpen); }}
        className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer group text-left"
      >
        {isOpen ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
        )}
        <span className="text-green-600 dark:text-green-400 font-medium">{summary}</span>
      </button>
      {isOpen && (
        <div className="pl-5 pt-1 space-y-0.5">
          {workspaces.map((ws, i) => (
            <div key={i} className="text-xs font-mono text-muted-foreground flex items-center gap-1">
              <span className="text-muted-foreground/50">→</span>
              {ws}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface WebhookDelivery {
  id: string;
  event_type: string;
  status: 'success' | 'failed' | 'ignored' | 'pending';
  provider: string;
  repository?: string;
  branch?: string;
  commit?: string;
  delivered_at: string;
  response_code?: number;
  message?: string;
}

export default function Webhooks() {
  const { orgName } = useParams<{ orgName: string }>();
  const [copied, setCopied] = useState(false);
  const [copiedAdo, setCopiedAdo] = useState(false);

  const { data: recentDeliveries = [], isLoading: loading, refetch: fetchDeliveries } = useQuery({
    queryKey: ['webhook-deliveries', orgName],
    queryFn: async () => {
      const response = await apiClient.get<{ data: WebhookDelivery[] }>(
        `/organizations/${orgName}/webhook-events?format=simple&page[size]=20`
      );
      return response.data || [];
    },
    enabled: !!orgName,
  });

  // Construct webhook URLs
  const baseUrl = window.location.origin;
  const webhookUrl = `${baseUrl}/api/v2/vcs-connections/github/webhook`;
  const adoWebhookUrl = `${baseUrl}/api/v2/vcs-connections/azure-devops/webhook`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      toast.success('Webhook URL copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const copyAdoToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(adoWebhookUrl);
      setCopiedAdo(true);
      toast.success('Azure DevOps webhook URL copied to clipboard');
      setTimeout(() => setCopiedAdo(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to={orgName ? `/app/${orgName}/settings` : '/settings'}>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/10 dark:hover:bg-black/10 transition-colors"
            aria-label="Back to Settings"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Webhooks
          </h1>
          <p className="text-muted-foreground">
            Configure webhook endpoints for automatic syncing when code changes are pushed
          </p>
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-lg">How Webhooks Work</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Webhooks allow GitHub to notify Stackweaver when code is pushed to repositories. 
            When a push event is received, Stackweaver automatically syncs affected playbooks and triggers runs for connected workspaces.
          </p>
        </CardContent>
      </Card>

      {/* Webhook Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600">
              <Webhook className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>GitHub Webhook URL</CardTitle>
              <CardDescription>
                Configure this URL in your GitHub App or repository settings
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Webhook URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Payload URL</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-4 py-3 rounded-lg bg-muted/50 border border-border text-sm font-mono overflow-x-auto">
                {webhookUrl}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => { void copyToClipboard(); }}
                className={cn(
                  "shrink-0 transition-colors",
                  copied && "bg-green-500/10 border-green-500/50"
                )}
              >
                {copied ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Webhook Settings Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted/30 border border-border/50 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Shield className="h-4 w-4 text-muted-foreground" />
                Content Type
              </div>
              <code className="text-sm font-mono text-muted-foreground">application/json</code>
            </div>
            <div className="p-4 rounded-lg bg-muted/30 border border-border/50 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Activity className="h-4 w-4 text-muted-foreground" />
                Events
              </div>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">push</Badge>
                <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">ping</Badge>
                <Badge variant="outline" className="text-xs bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20">installation</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Azure DevOps Webhook Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-800">
              <Webhook className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>Azure DevOps Webhook URL</CardTitle>
              <CardDescription>
                Automatically registered when you link a workspace or Ansible resource to an Azure DevOps repository
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Payload URL (Service Hook Receiver)</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-4 py-3 rounded-lg bg-muted/50 border border-border text-sm font-mono overflow-x-auto">
                {adoWebhookUrl}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => { void copyAdoToClipboard(); }}
                className={cn(
                  "shrink-0 transition-colors",
                  copiedAdo && "bg-green-500/10 border-green-500/50"
                )}
              >
                {copiedAdo ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted/30 border border-border/50 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Shield className="h-4 w-4 text-muted-foreground" />
                Authentication
              </div>
              <p className="text-sm font-mono text-muted-foreground">HMAC-SHA1 (auto-registered)</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/30 border border-border/50 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Activity className="h-4 w-4 text-muted-foreground" />
                Events
              </div>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">git.push</Badge>
                <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">pullrequest.created</Badge>
                <Badge variant="outline" className="text-xs bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20">pullrequest.updated</Badge>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-4">
            <p className="text-sm text-muted-foreground">
              Service hook subscriptions for Azure DevOps are registered automatically when you create or update a workspace,
              inventory, or playbook linked to an Azure DevOps repository — no manual configuration required.
              Requires <code className="text-xs bg-muted px-1 rounded-sm">STACKWEAVER_WEBHOOK_BASE_URL</code> to be set in <code className="text-xs bg-muted px-1 rounded-sm">deploy/vcs.env</code>.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-gray-700 to-gray-900">
              {getVcsProviderIcon('github', 'h-5 w-5 text-white')}
            </div>
            <div>
              <CardTitle>Setup Instructions</CardTitle>
              <CardDescription>
                Follow these steps to configure webhooks in GitHub
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* GitHub App Method */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Badge className="bg-green-500">Recommended</Badge>
              GitHub App Webhooks
            </h4>
            <p className="text-sm text-muted-foreground">
              If you're using the Stackweaver GitHub App, webhooks are automatically configured when you install the app.
              No additional setup is required.
            </p>
            <div className="pl-4 border-l-2 border-green-500/50 space-y-2">
              <p className="text-sm">
                <span className="font-medium">1.</span> Go to Settings → VCS Connections
              </p>
              <p className="text-sm">
                <span className="font-medium">2.</span> Click "Connect GitHub" to install the Stackweaver GitHub App
              </p>
              <p className="text-sm">
                <span className="font-medium">3.</span> Select the repositories you want to connect
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">
                ✓ Webhooks are automatically configured!
              </p>
            </div>
          </div>

          <div className="border-t my-6" />

          {/* Manual Method */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Badge variant="outline">Alternative</Badge>
              Manual Repository Webhooks
            </h4>
            <p className="text-sm text-muted-foreground">
              If you need to configure webhooks manually for a specific repository:
            </p>
            <div className="pl-4 border-l-2 border-muted space-y-2">
              <p className="text-sm">
                <span className="font-medium">1.</span> Go to your GitHub repository → Settings → Webhooks
              </p>
              <p className="text-sm">
                <span className="font-medium">2.</span> Click "Add webhook"
              </p>
              <p className="text-sm">
                <span className="font-medium">3.</span> Set the Payload URL to: <code className="text-xs bg-muted px-1 rounded-sm">{webhookUrl}</code>
              </p>
              <p className="text-sm">
                <span className="font-medium">4.</span> Set Content type to: <code className="text-xs bg-muted px-1 rounded-sm">application/json</code>
              </p>
              <p className="text-sm">
                <span className="font-medium">5.</span> Select "Just the push event" or individual events as needed
              </p>
              <p className="text-sm">
                <span className="font-medium">6.</span> Click "Add webhook"
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a 
                href="https://docs.github.com/en/developers/webhooks-and-events/webhooks/creating-webhooks" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2"
              >
                GitHub Webhooks Documentation
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Deliveries */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle>Recent Deliveries</CardTitle>
                <CardDescription>
                  View recent webhook events received from GitHub
                </CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" disabled={loading} onClick={() => { void fetchDeliveries(); }}>
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : recentDeliveries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium mb-1">No recent webhook deliveries</p>
              <p className="text-sm">
                Webhook events will appear here when GitHub sends push notifications
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Repository</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentDeliveries.map((delivery) => (
                  <TableRow key={delivery.id}>
                    <TableCell>
                      <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">
                        {delivery.event_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {delivery.repository || '-'}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {delivery.branch || '-'}
                    </TableCell>
                    <TableCell>
                      {delivery.status === 'success' ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Success
                        </Badge>
                      ) : delivery.status === 'failed' ? (
                        <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Failed
                        </Badge>
                      ) : delivery.status === 'ignored' ? (
                        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20">
                          Ignored
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <WebhookMessageCell message={delivery.message} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(delivery.delivered_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Troubleshooting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Troubleshooting
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">Webhook not triggering syncs?</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Ensure the playbook or workspace is linked to the correct repository and branch</li>
              <li>Check that the GitHub App has permission to access the repository</li>
              <li>Verify the webhook URL is publicly accessible (not localhost)</li>
              <li>For playbooks, ensure the changed files are within the playbook's path</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">Testing webhooks locally?</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Use a tool like ngrok to expose your local server to the internet</li>
              <li>Update the webhook URL in GitHub to point to your ngrok URL</li>
              <li>Check the backend logs for incoming webhook events</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
