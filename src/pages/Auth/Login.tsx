// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const { login, loading } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleLogin = async () => {
    setIsRedirecting(true);
    try {
      await login();
    } catch (error) {
      console.error('Login error:', error);
      setIsRedirecting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <img
              src="/logo.png"
              alt="Stackweaver"
              className="h-24 w-24"
            />
          </div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 dark:text-foreground bg-clip-text text-transparent">Welcome back</h2>
          <p className="mt-2 text-muted-foreground">
            Sign in to your account to continue
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <div className="relative inline-flex w-full rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 p-[3px] dark:p-[2.5px]">
            <Button
              variant="ghost"
              onClick={() => { void handleLogin(); }}
              disabled={loading || isRedirecting}
              className="w-full bg-white dark:bg-slate-900/80 dark:backdrop-blur-xs text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-900/90 border-0 whitespace-nowrap rounded-[calc(0.75rem-3px)] dark:rounded-[calc(0.75rem-2.5px)] px-8 py-3 transition-colors duration-200"
              size="lg"
            >
              {isRedirecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redirecting to Zitadel...
                </>
              ) : (
                'Sign in with Zitadel'
              )}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            By signing in, you agree to our terms of service and privacy policy.
          </p>
        </div>
      </div>
    </div>
  );
}




