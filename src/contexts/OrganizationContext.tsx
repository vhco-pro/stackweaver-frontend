// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { organizationsApi, type Organization } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';

interface OrganizationContextType {
  currentOrg: Organization | null;
  organizations: Organization[];
  loading: boolean;
  setCurrentOrg: (org: Organization | null) => void;
  switchOrganization: (orgName: string) => void;
  hasAccess: (orgName: string) => boolean;
  refreshOrganizations: () => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Get auth state to know when to fetch organizations
  const { session, loading: authLoading } = useAuth();
  
  // Router hooks - MUST be called unconditionally (React hook rules)
  // This component MUST be rendered inside <BrowserRouter>
  const navigate = useNavigate();
  const location = useLocation();

  // Load organizations from API
  const refreshOrganizations = useCallback(async () => {
    // Don't fetch if not authenticated
    if (!session) {
      setOrganizations([]);
      setLoading(false);
      return;
    }
    
    try {
      const response = await organizationsApi.list();
      const orgs = response.data || [];
      setOrganizations(orgs);
      
      // Try to restore current org from localStorage if not already set
      if (!currentOrg && orgs.length > 0) {
        const savedOrgName = localStorage.getItem('currentOrganization');
        if (savedOrgName) {
          const savedOrg = orgs.find(o => o.name === savedOrgName);
          if (savedOrg) {
            setCurrentOrg(savedOrg);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load organizations:', err);
      setOrganizations([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]); // currentOrg intentionally excluded - it's checked in the function but adding it would cause infinite loop

  // Initial load - wait for auth to complete before fetching
  useEffect(() => {
    if (!authLoading) {
      void refreshOrganizations();
    }
  }, [authLoading, refreshOrganizations]);

  // Load current org from localStorage on mount
  useEffect(() => {
    if (organizations.length > 0 && !currentOrg) {
      const savedOrgName = localStorage.getItem('currentOrganization');
      if (savedOrgName) {
        const savedOrg = organizations.find(o => o.name === savedOrgName);
        if (savedOrg) {
          setCurrentOrg(savedOrg);
        }
      }
    }
  }, [organizations, currentOrg]);

  // Persist current org to localStorage
  useEffect(() => {
    if (currentOrg) {
      localStorage.setItem('currentOrganization', currentOrg.name);
    } else {
      localStorage.removeItem('currentOrganization');
    }
  }, [currentOrg]);

  // Extract organization from URL if on org-scoped route
  useEffect(() => {
    const orgScopedRoute = location.pathname.match(/^\/app\/([^/]+)/);
    if (orgScopedRoute) {
      const orgNameFromUrl = orgScopedRoute[1];
      const orgFromUrl = organizations.find(o => o.name === orgNameFromUrl);
      if (orgFromUrl && orgFromUrl.name !== currentOrg?.name) {
        setCurrentOrg(orgFromUrl);
      }
    }
  }, [location.pathname, organizations, currentOrg]);

  const switchOrganization = useCallback((orgName: string) => {
    // Try to find the org in the current list
    let org = organizations.find(o => o.name === orgName);
    
    // If not found, create a temporary org object (will be updated on next refresh)
    if (!org) {
      org = { id: '', name: orgName, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Organization;
    }
    
    setCurrentOrg(org);
    // Navigate to org's workspaces page
    void navigate(`/app/${orgName}/workspaces`);
     
  }, [organizations, navigate]); // currentOrg intentionally excluded - it's set in this function and would cause infinite loop

  const hasAccess = useCallback((orgName: string) => {
    return organizations.some(o => o.name === orgName);
  }, [organizations]);

  const handleSetCurrentOrg = useCallback((org: Organization | null) => {
    setCurrentOrg(org);
  }, []);

  return (
    <OrganizationContext.Provider
      value={{
        currentOrg,
        organizations,
        loading,
        setCurrentOrg: handleSetCurrentOrg,
        switchOrganization,
        hasAccess,
        refreshOrganizations,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}


/**
 * Hook to access organization context
 * 
 * By default, throws an error if used outside OrganizationProvider (for development safety).
 * During HMR/hot reload, the context might briefly be undefined - the component should
 * show a loading state in that case.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    // During HMR, the context tree might re-mount before the provider is ready
    // Check if we're in a potential HMR scenario by looking at module.hot or import.meta.hot
    const isHMR = typeof window !== 'undefined' && (
      '__vite_plugin_react_preamble_installed__' in window ||
      import.meta.hot
    );
    
    if (isHMR) {
      // Return a safe fallback during HMR to prevent crashes
      // The component will re-render when the provider is ready
      console.warn('useOrganization: Context undefined during HMR, returning fallback');
      return {
        currentOrg: null,
        organizations: [],
        loading: true, // Signal that we're loading
        setCurrentOrg: () => {},
        switchOrganization: () => {},
        hasAccess: () => false,
        refreshOrganizations: async () => {},
      };
    }
    
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}

