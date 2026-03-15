// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Palette, Languages, Clock, Layout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useRunDisplayPreferences } from '@/contexts/RunDisplayPreferencesContext';

const ToggleSwitch = ({ enabled, onChange }: { enabled: boolean; onChange: () => void }) => (
  <button
    type="button"
    onClick={onChange}
    className={cn(
      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
      enabled ? 'bg-gradient-to-r from-indigo-500 to-violet-500' : 'bg-gray-300 dark:bg-gray-600'
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

const PREFS_STORAGE_KEY = 'general-preferences';

interface GeneralPreferences {
  theme: string;
  language: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  compactMode: boolean;
}

const defaultPreferences: GeneralPreferences = {
  theme: 'system',
  language: 'en',
  timezone: 'UTC',
  dateFormat: 'YYYY-MM-DD',
  timeFormat: '24h',
  compactMode: false,
};

function loadPreferences(): GeneralPreferences {
  try {
    const stored = localStorage.getItem(PREFS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<GeneralPreferences>;
      return { ...defaultPreferences, ...parsed };
    }
  } catch {
    // ignore
  }
  return defaultPreferences;
}

export default function PreferencesSettings() {
  const { preferences: runDisplayPrefs, updatePreference: updateRunDisplayPref } = useRunDisplayPreferences();
  const [preferences, setPreferencesRaw] = useState<GeneralPreferences>(loadPreferences);

  const setPreferences: typeof setPreferencesRaw = (action) => {
    setPreferencesRaw((prev) => {
      const next = typeof action === 'function' ? action(prev) : action;
      try {
        localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
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
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-indigo-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent mb-2">
            Preferences
          </h1>
          <p className="text-muted-foreground">
            Customize your workspace and display preferences
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Appearance */}
          <div className={cn(
            'rounded-2xl',
            'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
            'dark:from-black/10 dark:via-black/5',
            'backdrop-blur-md border border-white/20 dark:border-white/10',
            'p-6 shadow-lg shadow-purple-500/10'
          )}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Palette className="h-5 w-5 text-indigo-500" />
              Appearance
            </h3>
            
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">Theme</Label>
                <div className="grid grid-cols-3 gap-3">
                  {['light', 'dark', 'system'].map((theme) => (
                    <button
                      key={theme}
                      type="button"
                      onClick={() => setPreferences(prev => ({ ...prev, theme }))}
                      className={cn(
                        'p-3 rounded-xl border-2 transition-all',
                        preferences.theme === theme
                          ? 'border-indigo-500 bg-indigo-500/10'
                          : 'border-white/10 hover:border-white/20'
                      )}
                    >
                      <div className="text-sm font-medium capitalize">{theme}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Language & Region */}
          <div className={cn(
            'rounded-2xl',
            'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
            'dark:from-black/10 dark:via-black/5',
            'backdrop-blur-md border border-white/20 dark:border-white/10',
            'p-6 shadow-lg shadow-purple-500/10'
          )}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Languages className="h-5 w-5 text-indigo-500" />
              Language & Region
            </h3>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="language" className="mb-2 block">Language</Label>
                <select
                  id="language"
                  value={preferences.language}
                  onChange={(e) => setPreferences(prev => ({ ...prev, language: e.target.value }))}
                  className={cn(
                    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                    'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                  )}
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="nl">Dutch</option>
                </select>
              </div>
              
              <div>
                <Label htmlFor="timezone" className="mb-2 block">Timezone</Label>
                <select
                  id="timezone"
                  value={preferences.timezone}
                  onChange={(e) => setPreferences(prev => ({ ...prev, timezone: e.target.value }))}
                  className={cn(
                    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                    'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                  )}
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="Europe/London">London (GMT)</option>
                  <option value="Europe/Paris">Paris (CET)</option>
                  <option value="Asia/Tokyo">Tokyo (JST)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Date & Time */}
          <div className={cn(
            'rounded-2xl',
            'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
            'dark:from-black/10 dark:via-black/5',
            'backdrop-blur-md border border-white/20 dark:border-white/10',
            'p-6 shadow-lg shadow-purple-500/10'
          )}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-indigo-500" />
              Date & Time
            </h3>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="date-format" className="mb-2 block">Date Format</Label>
                <select
                  id="date-format"
                  value={preferences.dateFormat}
                  onChange={(e) => setPreferences(prev => ({ ...prev, dateFormat: e.target.value }))}
                  className={cn(
                    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                    'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                  )}
                >
                  <option value="YYYY-MM-DD">2024-01-15</option>
                  <option value="MM/DD/YYYY">01/15/2024</option>
                  <option value="DD/MM/YYYY">15/01/2024</option>
                  <option value="DD MMM YYYY">15 Jan 2024</option>
                </select>
              </div>
              
              <div>
                <Label htmlFor="time-format" className="mb-2 block">Time Format</Label>
                <div className="grid grid-cols-2 gap-3">
                  {['12h', '24h'].map((format) => (
                    <button
                      key={format}
                      type="button"
                      onClick={() => setPreferences(prev => ({ ...prev, timeFormat: format }))}
                      className={cn(
                        'p-3 rounded-xl border-2 transition-all',
                        preferences.timeFormat === format
                          ? 'border-indigo-500 bg-indigo-500/10'
                          : 'border-white/10 hover:border-white/20'
                      )}
                    >
                      <div className="text-sm font-medium">{format}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Display Options */}
          <div className={cn(
            'rounded-2xl',
            'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
            'dark:from-black/10 dark:via-black/5',
            'backdrop-blur-md border border-white/20 dark:border-white/10',
            'p-6 shadow-lg shadow-purple-500/10'
          )}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Layout className="h-5 w-5 text-indigo-500" />
              Display Options
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Compact Mode</div>
                  <div className="text-sm text-muted-foreground">
                    Reduce spacing and padding for a more compact view
                  </div>
                </div>
                <ToggleSwitch
                  enabled={preferences.compactMode}
                  onChange={() => setPreferences(prev => ({ ...prev, compactMode: !prev.compactMode }))}
                />
              </div>
            </div>
          </div>

          {/* Run Display Options */}
          <div className={cn(
            'rounded-2xl',
            'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
            'dark:from-black/10 dark:via-black/5',
            'backdrop-blur-md border border-white/20 dark:border-white/10',
            'p-6 shadow-lg shadow-purple-500/10'
          )}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Layout className="h-5 w-5 text-indigo-500" />
              Run Display Options
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Show Action Text</div>
                  <div className="text-sm text-muted-foreground">
                    Display text labels next to action icons (Create, Update, Delete, Replace)
                  </div>
                </div>
                <ToggleSwitch
                  enabled={runDisplayPrefs.showActionText}
                  onChange={() => updateRunDisplayPref('showActionText', !runDisplayPrefs.showActionText)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Show Total Changes Badge</div>
                  <div className="text-sm text-muted-foreground">
                    Display the total changes summary badge in run details
                  </div>
                </div>
                <ToggleSwitch
                  enabled={runDisplayPrefs.showTotalChangesBadge}
                  onChange={() => updateRunDisplayPref('showTotalChangesBadge', !runDisplayPrefs.showTotalChangesBadge)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Show Terminal During Planning</div>
                  <div className="text-sm text-muted-foreground">
                    Display live terminal output during plan phase (default: spinner view)
                  </div>
                </div>
                <ToggleSwitch
                  enabled={runDisplayPrefs.showTerminalDuringPlanning}
                  onChange={() => updateRunDisplayPref('showTerminalDuringPlanning', !runDisplayPrefs.showTerminalDuringPlanning)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">JSON String Color</div>
                  <div className="text-sm text-muted-foreground">
                    Color for JSON strings in syntax highlighting (white for better visibility/accessibility)
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateRunDisplayPref('jsonStringColor', 'green')}
                    className={cn(
                      "px-3 py-1.5 text-sm rounded-md transition-colors",
                      runDisplayPrefs.jsonStringColor === 'green'
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground"
                    )}
                  >
                    Green
                  </button>
                  <button
                    onClick={() => updateRunDisplayPref('jsonStringColor', 'white')}
                    className={cn(
                      "px-3 py-1.5 text-sm rounded-md transition-colors",
                      runDisplayPrefs.jsonStringColor === 'white'
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground"
                    )}
                  >
                    White
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className={cn(
            'rounded-2xl',
            'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
            'dark:from-black/10 dark:via-black/5',
            'backdrop-blur-md border border-white/20 dark:border-white/10',
            'p-6 shadow-lg shadow-purple-500/10'
          )}>
            <h3 className="font-semibold mb-3">Preferences</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Customize how the application looks and behaves to match your preferences.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-muted-foreground" />
                <span>All preferences auto-save on change</span>
              </div>
              <div className="flex items-center gap-2">
                <Languages className="h-4 w-4 text-muted-foreground" />
                <span>Language changes require a page refresh</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

