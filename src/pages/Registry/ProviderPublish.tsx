// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Upload, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { registryApi, type Provider, type ProviderVersion } from '@/api/client';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function ProviderPublish() {
  const params = useParams<{ orgName: string; providerName: string }>();
  const orgName = params.orgName;
  const providerName = params.providerName;
  const navigate = useNavigate();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [versions] = useState<ProviderVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [version, setVersion] = useState('');
  const [os, setOs] = useState('');
  const [arch, setArch] = useState('');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!orgName || !providerName) return;

    setLoading(true);
    void registryApi.providers.get(orgName, providerName)
      .then((providerData) => {
        setProvider(providerData);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load provider:', err);
        toast.error('Failed to load provider');
        setLoading(false);
      });
  }, [orgName, providerName]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!version.trim() || !os || !arch || !file) {
      toast.error('Version, OS, architecture, and file are required');
      return;
    }

    if (!orgName || !providerName) return;

    setUploading(true);
    try {
      await registryApi.providers.publishPlatform(orgName, providerName, version, os, arch, file);
      toast.success('Provider binary uploaded successfully');
      setVersion('');
      setOs('');
      setArch('');
      setFile(null);
      // Refresh provider data
      window.location.reload();
    } catch (err: unknown) {
      console.error('Failed to upload provider binary:', err);
      const errorMessage = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : 'Failed to upload provider binary';
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading provider...
        </div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Provider not found</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => { void Promise.resolve(navigate(orgName ? `/app/${orgName}/registry/providers` : `/organizations/${orgName}/registry/providers`)); }}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold mb-2">
          {provider.name}
          {provider.verified && (
            <Badge variant="default" className="ml-2 bg-green-500">Verified</Badge>
          )}
        </h1>
        {provider.description && (
          <p className="text-muted-foreground text-lg mb-4">{provider.description}</p>
        )}
      </div>

      {/* Upload Form */}
      <div className="border rounded-lg p-6 space-y-6">
        <h2 className="text-xl font-semibold">Publish Provider Binary</h2>
        <form onSubmit={(e) => { void handleUpload(e); }} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="version">Version *</Label>
              <Input
                id="version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="e.g., 1.0.0"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Semantic version (MAJOR.MINOR.PATCH)
              </p>
            </div>
            <div>
              <Label htmlFor="os">Operating System *</Label>
              <Select value={os} onValueChange={setOs} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select OS" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linux">Linux</SelectItem>
                  <SelectItem value="darwin">macOS</SelectItem>
                  <SelectItem value="windows">Windows</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="arch">Architecture *</Label>
              <Select value={arch} onValueChange={setArch} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select Arch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="amd64">amd64</SelectItem>
                  <SelectItem value="arm64">arm64</SelectItem>
                  <SelectItem value="386">386</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="file">Provider Binary (ZIP) *</Label>
            <Input
              id="file"
              type="file"
              accept=".zip"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Upload the provider binary as a ZIP file
            </p>
          </div>
          <Button type="submit" disabled={uploading || !version || !os || !arch || !file}>
            {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Upload className="h-4 w-4 mr-2" />
            Upload Binary
          </Button>
        </form>
      </div>

      {/* Published Versions */}
      {versions.length > 0 && (
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Published Versions</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Platforms</TableHead>
                <TableHead>Downloads</TableHead>
                <TableHead>Published</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.version}</TableCell>
                  <TableCell>
                    {v.platforms && v.platforms.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {v.platforms.map((p) => (
                          <Badge key={p.id} variant="outline">
                            {p.os}/{p.arch}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">No platforms</span>
                    )}
                  </TableCell>
                  <TableCell>{v.downloads}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(v.published_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

