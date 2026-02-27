// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Settings } from 'lucide-react';
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

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      // Show after a small delay for better UX
      setTimeout(() => setShow(true), 1000);
    }
  }, []);

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

  const togglePreference = (key: 'analytics' | 'marketing' | 'necessary') => {
    if (key === 'necessary') return; // Can't disable necessary cookies
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (!show) return null;

  return (
    <div className="sticky bottom-0 left-0 right-0 z-40 border-t border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-2xl-inverted">
      <div className="max-w-7xl mx-auto px-3 py-1.5 md:px-4 md:py-2">
        {!showSettings ? (
          <div className="flex items-center gap-2 md:gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-600 dark:text-gray-300 leading-tight">
                We use cookies.{' '}
                <Link to="/privacy" className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 underline">Learn more</Link>
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleAcceptAll}
                className="group relative h-8 px-4 rounded-md overflow-hidden font-medium text-xs text-white transition-all duration-300 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 50%, #8b5cf6 100%)',
                  backgroundSize: '200% 200%',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundPosition = '100% 0%';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundPosition = '0% 0%';
                }}
              >
                <span className="relative z-10">Accept All</span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              </button>
              
              <button
                onClick={handleAcceptNecessary}
                className="group relative h-8 px-4 rounded-md font-medium text-xs transition-all duration-300 hover:scale-105 active:scale-95 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10 hover:border-slate-300 dark:hover:border-white/20 shadow-sm"
              >
                <span className="relative z-10">Necessary</span>
              </button>
              
              <button
                onClick={() => setShowSettings(true)}
                className="h-8 w-8 flex items-center justify-center rounded-md transition-all duration-300 hover:scale-110 active:scale-95 bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20 text-purple-600 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-500/20 hover:border-purple-200 dark:hover:border-purple-500/30"
                aria-label="Cookie Settings"
              >
                <Settings className="h-4 w-4" />
              </button>
              
              <button
                onClick={() => setShow(false)}
                className="h-8 w-8 flex items-center justify-center rounded-md transition-all duration-300 hover:scale-110 active:scale-95 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 hover:border-red-200 dark:hover:border-red-500/30"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Cookie Preferences</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-slate-400 dark:text-gray-400 hover:text-slate-600 dark:hover:text-white transition-colors p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Necessary Cookies */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <div className="flex-1 min-w-0 pr-2">
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-white">Necessary</h4>
                  <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-0.5">Required for the site to work.</p>
                </div>
                <div className="flex-shrink-0">
                  <div className="h-5 w-9 rounded-full bg-blue-600 flex items-center justify-end px-0.5 opacity-50 cursor-not-allowed">
                    <div className="h-4 w-4 bg-white rounded-full shadow-sm" />
                  </div>
                </div>
              </div>

              {/* Analytics Cookies */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <div className="flex-1 min-w-0 pr-2">
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-white">Analytics</h4>
                  <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-0.5">Help us improve our site.</p>
                </div>
                <div className="flex-shrink-0">
                  <button
                    onClick={() => togglePreference('analytics')}
                    className={cn(
                      "h-5 w-9 rounded-full transition-colors flex items-center px-0.5",
                      preferences.analytics ? "bg-blue-600 justify-end" : "bg-slate-300 dark:bg-gray-600 justify-start"
                    )}
                  >
                    <div className="h-4 w-4 bg-white rounded-full shadow-sm" />
                  </button>
                </div>
              </div>

              {/* Marketing Cookies */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <div className="flex-1 min-w-0 pr-2">
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-white">Marketing</h4>
                  <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-0.5">Personalized advertisements.</p>
                </div>
                <div className="flex-shrink-0">
                  <button
                    onClick={() => togglePreference('marketing')}
                    className={cn(
                      "h-5 w-9 rounded-full transition-colors flex items-center px-0.5",
                      preferences.marketing ? "bg-blue-600 justify-end" : "bg-slate-300 dark:bg-gray-600 justify-start"
                    )}
                  >
                    <div className="h-4 w-4 bg-white rounded-full shadow-sm" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleSavePreferences}
                className="group relative flex-1 h-9 rounded-md overflow-hidden font-medium text-xs text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-md"
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 50%, #8b5cf6 100%)',
                  backgroundSize: '200% 200%',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundPosition = '100% 0%';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundPosition = '0% 0%';
                }}
              >
                <span className="relative z-10">Save Preferences</span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              </button>
              
              <button
                onClick={() => setShowSettings(false)}
                className="group relative px-4 h-9 rounded-md font-medium text-xs transition-all duration-300 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20"
              >
                <span>Cancel</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

