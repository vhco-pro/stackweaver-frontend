// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function Register() {
  const { loading } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleRegister = async () => {
    setIsRedirecting(true);
    try {
      // Redirect to Zitadel registration page
      // Zitadel handles registration through the same login flow
      // with a registration parameter
      const { getAuthUrl } = await import('@/lib/zitadel');
      const authUrl = await getAuthUrl();
      // Add prompt=select_account to show registration option
      const registerUrl = `${authUrl}&prompt=select_account`;
      window.location.href = registerUrl;
    } catch (error) {
      console.error('Registration error:', error);
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
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 dark:text-foreground bg-clip-text text-transparent">Create an account</h2>
          <p className="mt-2 text-muted-foreground">
            Get started with your IaC Platform account
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <div className="relative inline-flex w-full rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 p-[3px] dark:p-[2.5px]">
            <Button
              variant="ghost"
              onClick={() => { void handleRegister(); }}
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
                'Sign up with Zitadel'
              )}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Already have an account?{' '}
            <a href="/auth/login" className="text-primary hover:underline">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

