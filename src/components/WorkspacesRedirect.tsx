// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { organizationsApi } from '@/api/client';

export default function WorkspacesRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    void organizationsApi.list()
      .then((res) => {
        const orgs = res.data || [];
        if (orgs.length > 0) {
          // Redirect to new route structure
          void Promise.resolve(navigate(`/app/${orgs[0].name}/workspaces`, { replace: true }));
        } else {
          // No organizations, redirect to organizations page
          void Promise.resolve(navigate('/organizations', { replace: true }));
        }
      })
      .catch((err) => {
        console.error('Failed to load organizations:', err);
        void Promise.resolve(navigate('/organizations', { replace: true }));
      });
  }, [navigate]);

  return null; // Component doesn't render anything
}

