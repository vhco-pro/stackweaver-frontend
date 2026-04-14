// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useMountEffect } from '@/hooks/useMountEffect';
import { Link } from 'react-router-dom';
import { User, ArrowLeft, Save, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { settingsApi } from '@/api/client';

export default function ProfileSettings() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '',
    bio: '',
    company: '',
    location: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useMountEffect(() => {
    void loadProfile();
  });

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const profile = await settingsApi.getProfile();
      // Set form data - use empty string if value is null/undefined to allow clearing
      setFormData({
        name: profile.name ?? '',
        email: profile.email ?? '',
        username: profile.username ?? '',
        bio: profile.bio ?? '',
        company: profile.company ?? '',
        location: profile.location ?? '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setSuccess(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      
      // Build update payload - send all fields (including empty strings to clear them)
      // The backend uses pointer types, so empty strings will clear the fields
      const updatePayload: Record<string, string> = {
        name: formData.name,
        email: formData.email,
        username: formData.username,
        bio: formData.bio,
        company: formData.company,
        location: formData.location,
      };
      
      await settingsApi.updateProfile(updatePayload);
      setSuccess(true);
      // Reload profile to get updated data
      await loadProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/settings">
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
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent mb-2">
            Profile Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your personal information and preferences
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4 text-green-400">
          Profile updated successfully!
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading profile...</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-6">
            {/* Profile Picture */}
            <div className={cn(
              'rounded-2xl',
              'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
              'dark:from-black/10 dark:via-black/5',
              'backdrop-blur-md border border-white/20 dark:border-white/10',
              'p-6 shadow-lg shadow-blue-500/10'
            )}>
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="h-24 w-24 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-2xl font-bold">
                    {formData.name ? formData.name.charAt(0).toUpperCase() : '?'}
                  </div>
                  <button
                    type="button"
                    className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white shadow-lg hover:scale-110 transition-transform"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Profile Picture</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Upload a new profile picture. JPG, PNG or GIF. Max size 2MB.
                  </p>
                  <Button type="button" variant="outline" size="sm">
                    Change Photo
                  </Button>
                </div>
              </div>
            </div>

            {/* Basic Information */}
            <div className={cn(
              'rounded-2xl',
              'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
              'dark:from-black/10 dark:via-black/5',
              'backdrop-blur-md border border-white/20 dark:border-white/10',
              'p-6 shadow-lg shadow-blue-500/10 space-y-4'
            )}>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="h-5 w-5 text-blue-500" />
                Basic Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => handleChange('username', e.target.value)}
                    placeholder="johndoe"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="john.doe@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => handleChange('company', e.target.value)}
                    placeholder="Acme Corp"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => handleChange('location', e.target.value)}
                    placeholder="San Francisco, CA"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="bio">Bio</Label>
                  <textarea
                    id="bio"
                    value={formData.bio}
                    onChange={(e) => handleChange('bio', e.target.value)}
                    placeholder="Tell us about yourself..."
                    className={cn(
                      'flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                      'ring-offset-background placeholder:text-muted-foreground',
                      'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      'disabled:cursor-not-allowed disabled:opacity-50'
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => { void loadProfile(); }} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600">
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className={cn(
            'rounded-2xl',
            'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
            'dark:from-black/10 dark:via-black/5',
            'backdrop-blur-md border border-white/20 dark:border-white/10',
            'p-6 shadow-lg shadow-blue-500/10'
          )}>
            <h3 className="font-semibold mb-3">Account Information</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Member since</p>
                <p className="font-medium">January 2024</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last updated</p>
                <p className="font-medium">2 days ago</p>
              </div>
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}

