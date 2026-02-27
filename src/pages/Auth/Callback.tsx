// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { exchangeCodeForTokens, storeTokens } from '@/lib/zitadel';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function Callback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const processingRef = useRef(false);
  const processedCodeRef = useRef<string | null>(null);

  useEffect(() => {
    // Prevent multiple executions
    if (processingRef.current) return;

    const handleCallback = async () => {
      const code = searchParams.get('code');
      const errorParam = searchParams.get('error');

      // Check if we've already processed this code
      if (code && processedCodeRef.current === code) {
        console.log('Code already processed, redirecting...');
        void Promise.resolve(navigate('/dashboard', { replace: true }));
        return;
      }

      processingRef.current = true;

      if (errorParam) {
        setError(errorParam);
        setTimeout(() => {
          void Promise.resolve(navigate('/auth/login', { replace: true }));
        }, 3000);
        processingRef.current = false;
        return;
      }

      if (!code) {
        setError('No authorization code received');
        setTimeout(() => {
          void Promise.resolve(navigate('/auth/login', { replace: true }));
        }, 3000);
        processingRef.current = false;
        return;
      }

      // Mark this code as being processed
      processedCodeRef.current = code;

      try {
        // Exchange authorization code for tokens
        const tokens = await exchangeCodeForTokens(code);
        
        // Store tokens
        storeTokens(tokens);
        
        // Small delay to ensure tokens are stored before checking session
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Refresh auth context to get user info
        await refresh();
        
        // Small delay to ensure session is set
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Redirect to dashboard
        void Promise.resolve(navigate('/dashboard', { replace: true }));
      } catch (err) {
        console.error('Callback error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
        // Clear the processed code on error so user can retry
        processedCodeRef.current = null;
        setTimeout(() => {
          void Promise.resolve(navigate('/auth/login', { replace: true }));
        }, 3000);
      } finally {
        processingRef.current = false;
      }
    };

    void handleCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full space-y-4 p-8 text-center">
          <div className="text-destructive">
            <h2 className="text-2xl font-bold mb-2">Authentication Error</h2>
            <p className="text-muted-foreground">{error}</p>
            <p className="text-sm text-muted-foreground mt-4">
              Redirecting to login...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">Completing authentication...</p>
      </div>
    </div>
  );
}




