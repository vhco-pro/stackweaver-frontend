// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './Auth/Login';
import Callback from './Auth/Callback';

// /auth/* — pre-Zitadel-handoff routes:
//   /auth/login    "Sign in with Zitadel" entry button (kicks off PKCE)
//   /auth/callback OIDC callback handler (token exchange)
//
// The previous /auth/register page was removed during the custom-
// login-ui cleanup (G5). Self-registration is now served by
// /login/register (F7), reached via the "Create account" button on
// /login/loginname or via OIDC `prompt=create` (F15). Anyone with
// a bookmark to /auth/register lands on /auth/login via the
// catch-all below.
export default function Auth() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route path="callback" element={<Callback />} />
      <Route path="*" element={<Navigate to="/auth/login" replace />} />
    </Routes>
  );
}

