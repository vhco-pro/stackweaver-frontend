// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

// eslint-disable-next-line no-restricted-imports -- legitimate dependency-based effect
import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, CheckCircle2, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

import { config } from '@/config';

const API_BASE_URL = config.apiUrl;
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const HEALTH_CHECK_TIMEOUT = 10000; // 10 seconds

type ConnectionState = 'connected' | 'disconnected' | 'reconnecting';

export function ConnectionStatus() {
  const [connectionState, setConnectionState] = useState<ConnectionState>('connected');
  const [isVisible, setIsVisible] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [showRestored, setShowRestored] = useState(false);

  // Hide the restored badge on any interaction
  const hideRestoredBadge = useCallback(() => {
    if (connectionState === 'connected' && showRestored) {
      setIsVisible(false);
      setShowRestored(false);
    }
  }, [connectionState, showRestored]);

  // Listen for focus and click events to hide the "restored" badge
  useEffect(() => {
    if (!showRestored) return;

    const handleInteraction = () => hideRestoredBadge();
    
    window.addEventListener('focus', handleInteraction);
    window.addEventListener('click', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    
    return () => {
      window.removeEventListener('focus', handleInteraction);
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, [showRestored, hideRestoredBadge]);

  const checkHealth = async (): Promise<boolean> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

    try {
      // Use the root health endpoint, not the API v2 path
      const healthUrl = String(API_BASE_URL).replace('/api/v2', '/health');
      const response = await fetch(healthUrl, {
        method: 'HEAD',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      clearTimeout(timeoutId);
      return false;
    }
  };

  useEffect(() => {
    let mounted = true;

    const runHealthCheck = async () => {
      const isHealthy = await checkHealth();
      
      if (!mounted) return;

      if (isHealthy) {
        if (connectionState !== 'connected') {
          setConnectionState('connected');
          setIsVisible(true);
          setShowRestored(true);
          // Auto-hide the "connected" message after 5 seconds if no interaction
          setTimeout(() => {
            if (mounted) {
              setIsVisible(false);
              setShowRestored(false);
            }
          }, 5000);
        }
        setFailCount(0);
      } else {
        setFailCount(prev => prev + 1);
        // Only show disconnected after 2 consecutive failures
        if (failCount >= 1) {
          setConnectionState('disconnected');
          setIsVisible(true);
        } else {
          setConnectionState('reconnecting');
          setIsVisible(true);
        }
      }
    };

    // Initial check after a short delay
    const initialTimeout = setTimeout(() => { void runHealthCheck(); }, 2000);
    
    // Periodic checks
    const intervalId = setInterval(() => { void runHealthCheck(); }, HEALTH_CHECK_INTERVAL);

    return () => {
      mounted = false;
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
  }, [connectionState, failCount]);

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-lg transition-all duration-300',
        {
          'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300': connectionState === 'connected',
          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300': connectionState === 'reconnecting',
          'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300': connectionState === 'disconnected',
        }
      )}
    >
      {connectionState === 'connected' && (
        <>
          <CheckCircle2 className="h-4 w-4" />
          <span>Connection restored</span>
        </>
      )}
      {connectionState === 'reconnecting' && (
        <>
          <AlertTriangle className="h-4 w-4 animate-pulse" />
          <span>Reconnecting to server...</span>
        </>
      )}
      {connectionState === 'disconnected' && (
        <>
          <WifiOff className="h-4 w-4" />
          <span>Connection lost - check your network</span>
          <button
            onClick={() => window.location.reload()}
            className="ml-2 rounded-sm bg-red-200 px-2 py-1 text-xs hover:bg-red-300 dark:bg-red-800 dark:hover:bg-red-700"
          >
            Reload
          </button>
        </>
      )}
    </div>
  );
}
