// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useMountEffect } from '@/hooks/useMountEffect';
import { Link } from 'react-router-dom';
import { Cookie, X, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GradientButton } from '@/components/ui/gradient-button';
import { Switch } from '@/components/ui/switch';
import { glassSurface, glassDivider } from '@/lib/surfaces';
import { cn } from '@/lib/utils';

interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
}

export function CookieConsent() {
  const [show, setShow] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true, // Always true, can't be disabled
    analytics: false,
    marketing: false,
    timestamp: new Date().toISOString(),
  });

  useMountEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      // Show after a small delay for better UX.
      const timer = setTimeout(() => setShow(true), 1000);
      return () => clearTimeout(timer);
    }
  });

  const handleAcceptAll = () => {
    const allAccepted: CookiePreferences = {
      necessary: true,
      analytics: true,
      marketing: true,
      timestamp: new Date().toISOString(),
    };
    saveConsent(allAccepted);
  };

  const handleAcceptNecessary = () => {
    saveConsent(preferences);
  };

  const handleSavePreferences = () => {
    saveConsent(preferences);
    setShowSettings(false);
  };

  const saveConsent = (consent: CookiePreferences) => {
    localStorage.setItem('cookie-consent', JSON.stringify(consent));
    setShow(false);
    // Optionally send to backend API
    // gdprApi.updateConsents(consent);
  };

  if (!show) return null;

  return (
    <section aria-label="Cookie preferences" className="sticky bottom-0 z-40 px-3 pb-3 sm:px-6 sm:pb-6">
      <div className={cn(glassSurface, 'relative mx-auto max-w-6xl bg-white p-4 text-slate-900 dark:bg-slate-950 dark:text-white sm:p-6')}>
        {!showSettings ? (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6 lg:pr-12">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShow(false)}
              className="absolute right-3 top-3 h-11 w-11 rounded-xl text-slate-500 dark:text-slate-400 sm:right-5 sm:top-5"
              aria-label="Close"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </Button>
            <div className="flex min-w-0 flex-1 items-start gap-3 pr-12 lg:pr-0">
              <Cookie aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold">We use cookies</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  Manage your cookie preferences.{' '}
                  <Link to="/privacy" className="inline-flex min-h-11 items-center rounded-sm text-blue-600 underline underline-offset-4 hover:text-blue-700 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:text-blue-400 dark:hover:text-blue-300">Read the privacy policy</Link>
                </p>
              </div>
            </div>
            <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 sm:flex sm:gap-3 lg:shrink-0">
              <GradientButton ramp="brand" onClick={handleAcceptAll} className="h-11 px-3 sm:w-auto sm:px-5">
                Accept All
              </GradientButton>
              <Button variant="outline" onClick={handleAcceptNecessary} className="h-11 rounded-xl px-3 sm:px-5">
                Necessary
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(true)}
                className="h-11 w-11 shrink-0 rounded-xl text-slate-600 dark:text-slate-300"
                aria-label="Cookie Settings"
              >
                <Settings aria-hidden="true" className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex max-h-[calc(100dvh-10rem)] flex-col gap-5">
            <div className="flex shrink-0 items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Cookie aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
                <div>
                  <h2 className="text-lg font-semibold">Cookie Preferences</h2>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Choose which optional cookies to allow.</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(false)}
                className="h-11 w-11 shrink-0 rounded-xl text-slate-500 dark:text-slate-400"
                aria-label="Close cookie preferences"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid min-h-0 grid-cols-1 gap-3 overflow-y-auto md:grid-cols-3">
              <label htmlFor="cookie-necessary" className={cn(glassSurface, 'flex min-h-24 items-center justify-between gap-4 p-4')}>
                <span className="min-w-0">
                  <span id="cookie-necessary-label" className="block text-sm font-semibold">Necessary</span>
                  <span id="cookie-necessary-description" className="mt-1 block text-xs leading-relaxed text-slate-600 dark:text-slate-300">Required for the site to work. Always on.</span>
                </span>
                <Switch id="cookie-necessary" checked disabled aria-labelledby="cookie-necessary-label" aria-describedby="cookie-necessary-description" />
              </label>

              <label htmlFor="cookie-analytics" className={cn(glassSurface, 'flex min-h-24 cursor-pointer items-center justify-between gap-4 p-4')}>
                <span className="min-w-0">
                  <span id="cookie-analytics-label" className="block text-sm font-semibold">Analytics</span>
                  <span id="cookie-analytics-description" className="mt-1 block text-xs leading-relaxed text-slate-600 dark:text-slate-300">Help us improve our site.</span>
                </span>
                <Switch
                  id="cookie-analytics"
                  checked={preferences.analytics}
                  onCheckedChange={(checked) => setPreferences(prev => ({ ...prev, analytics: checked }))}
                  aria-labelledby="cookie-analytics-label"
                  aria-describedby="cookie-analytics-description"
                />
              </label>

              <label htmlFor="cookie-marketing" className={cn(glassSurface, 'flex min-h-24 cursor-pointer items-center justify-between gap-4 p-4')}>
                <span className="min-w-0">
                  <span id="cookie-marketing-label" className="block text-sm font-semibold">Marketing</span>
                  <span id="cookie-marketing-description" className="mt-1 block text-xs leading-relaxed text-slate-600 dark:text-slate-300">Personalized advertisements.</span>
                </span>
                <Switch
                  id="cookie-marketing"
                  checked={preferences.marketing}
                  onCheckedChange={(checked) => setPreferences(prev => ({ ...prev, marketing: checked }))}
                  aria-labelledby="cookie-marketing-label"
                  aria-describedby="cookie-marketing-description"
                />
              </label>
            </div>

            <div className={cn(glassDivider, 'flex shrink-0 flex-col gap-3 border-t pt-4 sm:flex-row sm:justify-end')}>
              <GradientButton ramp="brand" onClick={handleSavePreferences} className="h-11 sm:order-last sm:w-auto sm:px-6">
                Save Preferences
              </GradientButton>
              <Button variant="outline" onClick={() => setShowSettings(false)} className="h-11 rounded-xl sm:w-auto">
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
