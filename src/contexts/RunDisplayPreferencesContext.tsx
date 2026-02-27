// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface RunDisplayPreferences {
  showActionText: boolean;
  showTotalChangesBadge: boolean;
  showTerminalDuringPlanning: boolean; // Optional terminal view during plan phase (default: false, uses spinner)
  jsonStringColor: 'green' | 'white'; // Color for JSON strings in syntax highlighting (default: green)
}

const defaultPreferences: RunDisplayPreferences = {
  showActionText: false, // Default to icon-only (current state)
  showTotalChangesBadge: true, // Default to showing it
  showTerminalDuringPlanning: false, // Default to spinner (current behavior)
  jsonStringColor: 'green', // Default to green (can be changed to white for better visibility/accessibility)
};

const STORAGE_KEY = 'run-display-preferences';

interface RunDisplayPreferencesContextType {
  preferences: RunDisplayPreferences;
  setPreferences: (prefs: RunDisplayPreferences) => void;
  updatePreference: <K extends keyof RunDisplayPreferences>(
    key: K,
    value: RunDisplayPreferences[K]
  ) => void;
}

const RunDisplayPreferencesContext = createContext<RunDisplayPreferencesContextType | undefined>(undefined);

export function RunDisplayPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferencesState] = useState<RunDisplayPreferences>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<RunDisplayPreferences>;
        return { ...defaultPreferences, ...parsed };
      }
    } catch (error) {
      console.error('Failed to load run display preferences:', error);
    }
    return defaultPreferences;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error('Failed to save run display preferences:', error);
    }
  }, [preferences]);

  const setPreferences = (prefs: RunDisplayPreferences) => {
    setPreferencesState(prefs);
  };

  const updatePreference = <K extends keyof RunDisplayPreferences>(
    key: K,
    value: RunDisplayPreferences[K]
  ) => {
    setPreferencesState((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <RunDisplayPreferencesContext.Provider value={{ preferences, setPreferences, updatePreference }}>
      {children}
    </RunDisplayPreferencesContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRunDisplayPreferences() {
  const context = useContext(RunDisplayPreferencesContext);
  if (context === undefined) {
    throw new Error('useRunDisplayPreferences must be used within a RunDisplayPreferencesProvider');
  }
  return context;
}


