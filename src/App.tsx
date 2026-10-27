// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.
import { BrowserRouter, matchRoutes, useLocation, useRoutes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/config';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { NotificationProvider, useNotifications } from '@/contexts/NotificationContext';
import { RunDisplayPreferencesProvider } from '@/contexts/RunDisplayPreferencesContext';
import { NotificationContainer } from '@/components/notifications/NotificationContainer';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { preloadRoute } from '@/components/routes/preloadRoute';
import { appRoutes } from './appRoutes';

function AppRoutes() {
  const location = useLocation();
  for (const match of matchRoutes(appRoutes, location) ?? []) preloadRoute(match.route.element);
  return useRoutes(appRoutes);
}

function AppContent() {
  const { notifications, dismissNotification } = useNotifications();
  return (
    <BrowserRouter basename={config.basePath}>
      <div className="min-h-screen bg-background">
        <NotificationContainer notifications={notifications} onDismiss={dismissNotification} />
        <ConnectionStatus />
        <AppRoutes />
        <Toaster />
      </div>
    </BrowserRouter>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <RunDisplayPreferencesProvider>
              <AppContent />
            </RunDisplayPreferencesProvider>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
