// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { Routes, Route, Navigate } from 'react-router-dom';
import LoginName from './LoginName';
import Password from './Password';
import Passkey from './Passkey';
import PasskeySet from './PasskeySet';
import Otp from './Otp';
import OtpSet from './OtpSet';
import U2f from './U2f';
import U2fSet from './U2fSet';
import MfaPicker from './MfaPicker';
import MfaSet from './MfaSet';
import AuthenticatorSet from './AuthenticatorSet';
import Register from './Register';
import RegisterPassword from './RegisterPassword';
import PasswordReset from './PasswordReset';
import PasswordSet from './PasswordSet';
import PasswordChange from './PasswordChange';
import Verify from './Verify';
import VerifySuccess from './VerifySuccess';
import Accounts from './Accounts';
import Logout from './Logout';
import LogoutDone from './LogoutDone';
import SignedIn from './SignedIn';
import IdpSelect from './IdpSelect';
import IdpProcess from './IdpProcess';
import IdpFailure from './IdpFailure';
import IdpAccountNotFound from './IdpAccountNotFound';
import IdpCompleteRegistration from './IdpCompleteRegistration';
import IdpLinkingFailed from './IdpLinkingFailed';
import IdpRegistrationFailed from './IdpRegistrationFailed';
import LoginError from './LoginError';

/**
 * LoginRouter - complete route dispatch for /login/* pages.
 *
 * Forced-flow branching per D7 is implemented in the Password page handler:
 * after password check succeeds, the handler checks session state for
 * forced flows (password expiry, MFA, email verification) and redirects
 * to the appropriate page before finalizing the auth request.
 */
export default function LoginRouter() {
  return (
    <Routes>
      {/* Core auth flow */}
      <Route path="loginname" element={<LoginName />} errorElement={<LoginError />} />
      <Route path="password" element={<Password />} errorElement={<LoginError />} />
      <Route path="passkey" element={<Passkey />} errorElement={<LoginError />} />
      <Route path="passkey/set" element={<PasskeySet />} errorElement={<LoginError />} />

      {/* MFA */}
      <Route path="otp/:method" element={<Otp />} errorElement={<LoginError />} />
      <Route path="otp/:method/set" element={<OtpSet />} errorElement={<LoginError />} />
      <Route path="u2f" element={<U2f />} errorElement={<LoginError />} />
      <Route path="u2f/set" element={<U2fSet />} errorElement={<LoginError />} />
      <Route path="mfa" element={<MfaPicker />} errorElement={<LoginError />} />
      <Route path="mfa/set" element={<MfaSet />} errorElement={<LoginError />} />
      <Route path="authenticator/set" element={<AuthenticatorSet />} errorElement={<LoginError />} />

      {/* Registration */}
      <Route path="register" element={<Register />} errorElement={<LoginError />} />
      <Route path="register/password" element={<RegisterPassword />} errorElement={<LoginError />} />

      {/* Password reset + forced rotation (F19) */}
      <Route path="password-reset" element={<PasswordReset />} errorElement={<LoginError />} />
      <Route path="password/set" element={<PasswordSet />} errorElement={<LoginError />} />
      <Route path="password/change" element={<PasswordChange />} errorElement={<LoginError />} />

      {/* Email verification */}
      <Route path="verify" element={<Verify />} errorElement={<LoginError />} />
      <Route path="verify/success" element={<VerifySuccess />} errorElement={<LoginError />} />

      {/* External IdP flow */}
      <Route path="idp" element={<IdpSelect />} errorElement={<LoginError />} />
      <Route path="idp/:provider/process" element={<IdpProcess />} errorElement={<LoginError />} />
      <Route path="idp/:provider/failure" element={<IdpFailure />} errorElement={<LoginError />} />
      <Route path="idp/:provider/account-not-found" element={<IdpAccountNotFound />} errorElement={<LoginError />} />
      <Route path="idp/:provider/complete-registration" element={<IdpCompleteRegistration />} errorElement={<LoginError />} />
      <Route path="idp/:provider/linking-failed" element={<IdpLinkingFailed />} errorElement={<LoginError />} />
      <Route path="idp/:provider/registration-failed" element={<IdpRegistrationFailed />} errorElement={<LoginError />} />

      {/* Session management */}
      <Route path="accounts" element={<Accounts />} errorElement={<LoginError />} />
      <Route path="logout" element={<Logout />} errorElement={<LoginError />} />
      <Route path="logout/done" element={<LogoutDone />} />
      <Route path="signedin" element={<SignedIn />} />

      {/* Default: redirect to loginname.
        * Round 27 Wave 13 (browser-test 2026-05-09): MUST be an
        * absolute path. With the relative `to="loginname"` (no
        * leading `/`), an unknown URL like `/login/password/reset`
        * resolved the redirect against the current location →
        * `/login/password/reset/loginname` → catch-all again →
        * `/login/password/reset/loginname/loginname` → infinite
        * loop until React's `Maximum update depth exceeded` blew
        * up the page. Anyone deep-linking an unknown `/login/*`
        * URL (or a stale bookmark, or a 404 from a renamed route)
        * crashed the SPA. Absolute path resolves to /login/loginname
        * regardless of the current path. */}
      <Route path="*" element={<Navigate to="/login/loginname" replace />} />
    </Routes>
  );
}
