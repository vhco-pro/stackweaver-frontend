// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Lock, Smartphone, Monitor, Trash2, Eye, EyeOff, Loader2, CheckCircle2, X, Key, Mail, MessageSquare, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { twoFactorApi, settingsApi, type MFADevice, type Session } from '@/api/client';
import QRCode from 'qrcode';
import { useAuth } from '@/contexts/AuthContext';

export default function SecuritySettings() {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current: '',
    new: '',
    confirm: '',
  });

  // 2FA state
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [loading2FA, setLoading2FA] = useState(true);
  const [settingUp2FA, setSettingUp2FA] = useState(false);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpUrl, setTotpUrl] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [mfaDevices, setMfaDevices] = useState<MFADevice[]>([]);
  const [loadingMfaDevices, setLoadingMfaDevices] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  useAuth(); // Suppress unused currentSession warning

  // Sessions state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordData(prev => ({ ...prev, [field]: value }));
  };

  const loadMFADevices = async () => {
    try {
      setLoadingMfaDevices(true);
      const response = await twoFactorApi.listDevices();
      setMfaDevices(response.devices);
    } catch (err) {
      console.error('Failed to load MFA devices:', err);
      // Don't show error, just leave devices empty
    } finally {
      setLoadingMfaDevices(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.new !== passwordData.confirm) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (passwordData.new.length < 8) {
      setPasswordError('New password must be at least 8 characters long');
      return;
    }

    try {
      setChangingPassword(true);
      setPasswordError(null);
      setPasswordSuccess(null);
      await settingsApi.changePassword(passwordData.current, passwordData.new);
      setPasswordSuccess('Password changed successfully!');
      setPasswordData({ current: '', new: '', confirm: '' });
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  // Load 2FA status, MFA devices, and sessions on mount
  useEffect(() => {
    void load2FAStatus();
    void loadMFADevices();
    void loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoadingSessions(true);
      setSessionsError(null);
      const response = await settingsApi.listSessions();
      setSessions(response.sessions || []);
    } catch (err) {
      console.error('Failed to load sessions:', err);
      setSessionsError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoadingSessions(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Active now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  // Use is_current field from backend instead of client-side detection

  const load2FAStatus = async () => {
    try {
      setLoading2FA(true);
      const response = await twoFactorApi.getStatus();
      setTwoFAEnabled(response.enabled);
    } catch (err) {
      console.error('Failed to load 2FA status:', err);
      // If endpoint doesn't exist, assume 2FA is not available
      setTwoFAEnabled(false);
    } finally {
      setLoading2FA(false);
    }
  };

  const start2FASetup = async () => {
    try {
      setSettingUp2FA(true);
      setError(null);
      setSuccess(null);
      const response = await twoFactorApi.start();
      setTotpSecret(response.secret);
      setTotpUrl(response.url);
      
      // Generate QR code
      if (response.url) {
        try {
          const dataUrl = await QRCode.toDataURL(response.url, {
            width: 200,
            margin: 2,
          });
          setQrCodeDataUrl(dataUrl);
        } catch (qrError) {
          console.error('Failed to generate QR code:', qrError);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start 2FA setup');
      setSettingUp2FA(false);
    }
  };

  const verify2FA = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    try {
      setVerifying(true);
      setError(null);
      await twoFactorApi.verify(verificationCode);
      setSuccess('2FA enabled successfully!');
      setTwoFAEnabled(true);
      setSettingUp2FA(false);
      setTotpSecret(null);
      setTotpUrl(null);
      setQrCodeDataUrl(null);
      setVerificationCode('');
      // Reload MFA devices to show the newly enabled TOTP
      void loadMFADevices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid verification code');
    } finally {
      setVerifying(false);
    }
  };

  const remove2FA = async () => {
    if (!confirm('Are you sure you want to disable 2FA? This will reduce your account security.')) {
      return;
    }

    try {
      setError(null);
      await twoFactorApi.remove();
      setSuccess('2FA disabled successfully');
      setTwoFAEnabled(false);
      // Reload MFA devices to reflect the change
      void loadMFADevices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable 2FA');
    }
  };

  const cancel2FASetup = () => {
    setSettingUp2FA(false);
    setTotpSecret(null);
    setTotpUrl(null);
    setQrCodeDataUrl(null);
    setVerificationCode('');
    setError(null);
    setSuccess(null);
  };

  const revokeSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to revoke this session? You will be logged out from that device.')) {
      return;
    }

    try {
      setRevoking(sessionId);
      setSessionsError(null);
      await settingsApi.revokeSession(sessionId);
      // Reload sessions to update the list
      await loadSessions();
      // If we revoked the current session, we'll be logged out automatically
    } catch (err) {
      setSessionsError(err instanceof Error ? err.message : 'Failed to revoke session');
      console.error('Failed to revoke session:', err);
    } finally {
      setRevoking(null);
    }
  };

  const ToggleSwitch = ({ enabled, onChange }: { enabled: boolean; onChange: () => void }) => (
    <button
      type="button"
      onClick={onChange}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
        enabled ? 'bg-gradient-to-r from-blue-500 to-cyan-500' : 'bg-gray-300 dark:bg-gray-600'
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
          enabled ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/settings">
          <Button 
            variant="ghost" 
            size="icon"
            className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/10 dark:hover:bg-black/10 transition-colors"
            aria-label="Back to Settings"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent mb-2">
            Security Settings
          </h1>
          <p className="text-muted-foreground">
            Manage authentication, API keys, and security settings
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Change Password */}
        <div className={cn(
          'rounded-2xl',
          'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
          'dark:from-black/10 dark:via-black/5',
          'backdrop-blur-md border border-white/20 dark:border-white/10',
          'p-6 shadow-lg shadow-purple-500/10'
        )}>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Lock className="h-5 w-5 text-blue-500" />
            Change Password
          </h3>
          
          {/* Success/Error Messages for Password */}
          {passwordSuccess && (
            <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              {passwordSuccess}
            </div>
          )}
          {passwordError && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <X className="h-4 w-4" />
              {passwordError}
            </div>
          )}
          
          <form onSubmit={(e) => { void handlePasswordSubmit(e); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={passwordData.current}
                  onChange={(e) => handlePasswordChange('current', e.target.value)}
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwordData.new}
                  onChange={(e) => handlePasswordChange('new', e.target.value)}
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={passwordData.confirm}
                  onChange={(e) => handlePasswordChange('confirm', e.target.value)}
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            
            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={changingPassword}
                className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
              >
                {changingPassword ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Changing...
                  </>
                ) : (
                  'Update Password'
                )}
              </Button>
            </div>
          </form>
        </div>

        {/* Two-Factor Authentication */}
        <div className={cn(
          'rounded-2xl',
          'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
          'dark:from-black/10 dark:via-black/5',
          'backdrop-blur-md border border-white/20 dark:border-white/10',
          'p-6 shadow-lg shadow-purple-500/10'
        )}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-blue-500" />
                Two-Factor Authentication
              </h3>
              <p className="text-sm text-muted-foreground">
                Add an extra layer of security to your account
              </p>
            </div>
            {!loading2FA && (
              <ToggleSwitch 
                enabled={twoFAEnabled} 
                onChange={() => {
                  if (twoFAEnabled) {
                    void remove2FA();
                  } else {
                    void start2FASetup();
                  }
                }} 
              />
            )}
            {loading2FA && (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Success/Error Messages */}
          {success && (
            <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              {success}
            </div>
          )}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <X className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* 2FA Setup Flow */}
          {settingUp2FA && totpUrl && (
            <div className="space-y-4 mt-4">
              <div className="p-4 rounded-xl bg-white/5 dark:bg-black/5 border border-white/10">
                <p className="text-sm text-muted-foreground mb-4">
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                </p>
                <div className="flex justify-center mb-4">
                  <div className="p-4 bg-white rounded-lg">
                    {qrCodeDataUrl ? (
                      <img src={qrCodeDataUrl} alt="TOTP QR Code" className="w-[200px] h-[200px]" />
                    ) : (
                      <div className="w-[200px] h-[200px] flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-2">Or enter this code manually:</p>
                  <code className="px-3 py-2 rounded-lg bg-white/5 dark:bg-black/10 border border-white/10 dark:border-white/5 text-sm font-mono break-all">
                    {totpSecret}
                  </code>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="totp-code">Enter verification code</Label>
                <Input
                  id="totp-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setVerificationCode(value);
                    setError(null);
                  }}
                  placeholder="000000"
                  className="text-center text-2xl tracking-widest font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={cancel2FASetup}
                  disabled={verifying}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => { void verify2FA(); }}
                  disabled={verifying || verificationCode.length !== 6}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify & Enable'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* 2FA Actions */}
          {!settingUp2FA && (
            <div className="flex gap-3">
              {twoFAEnabled ? (
                <Button
                  variant="outline"
                  onClick={() => { void remove2FA(); }}
                  className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                >
                  Disable 2FA
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => { void start2FASetup(); }}
                  disabled={loading2FA || settingUp2FA}
                >
                  {settingUp2FA ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    'Set Up 2FA'
                  )}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Active MFA Devices */}
        <div className={cn(
          'rounded-2xl',
          'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
          'dark:from-black/10 dark:via-black/5',
          'backdrop-blur-md border border-white/20 dark:border-white/10',
          'p-6 shadow-lg shadow-purple-500/10'
        )}>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            Active MFA Devices
          </h3>
          
          {loadingMfaDevices ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : mfaDevices.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No MFA devices configured</p>
              <p className="text-sm text-muted-foreground mt-2">
                Enable 2FA above to add your first MFA device
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {mfaDevices.map((device, index) => {
                const getDeviceIcon = () => {
                  switch (device.type) {
                    case 'TOTP':
                      return <Smartphone className="h-5 w-5" />;
                    case 'PASSKEY':
                      return <Key className="h-5 w-5" />;
                    case 'U2F':
                      return <Shield className="h-5 w-5" />;
                    case 'OTP_SMS':
                      return <MessageSquare className="h-5 w-5" />;
                    case 'OTP_EMAIL':
                      return <Mail className="h-5 w-5" />;
                    default:
                      return <Shield className="h-5 w-5" />;
                  }
                };

                const getDeviceColor = () => {
                  switch (device.type) {
                    case 'TOTP':
                      return 'from-blue-500 to-cyan-500';
                    case 'PASSKEY':
                      return 'from-cyan-500 to-blue-500';
                    case 'U2F':
                      return 'from-indigo-500 to-blue-500';
                    case 'OTP_SMS':
                      return 'from-purple-500 to-indigo-500';
                    case 'OTP_EMAIL':
                      return 'from-violet-500 to-purple-500';
                    default:
                      return 'from-gray-500 to-gray-600';
                  }
                };

                const isActive = device.state === 'AUTH_FACTOR_STATE_ACTIVE' || device.state === 'AUTH_FACTOR_STATE_READY';

                return (
                  <div
                    key={device.id || `${device.type}-${index}`}
                    className="flex items-center justify-between p-4 rounded-xl border border-white/10 dark:border-white/5 bg-white/5 dark:bg-black/5"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-xl',
                        `bg-gradient-to-br ${getDeviceColor()}`,
                        'text-white'
                      )}>
                        {getDeviceIcon()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{device.name}</span>
                          {isActive && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-600 dark:text-green-400">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {device.type.replace('_', ' ')}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Sessions */}
        <div className={cn(
          'rounded-2xl',
          'bg-gradient-to-br from-white/10 via-white/5 to-transparent',
          'dark:from-black/10 dark:via-black/5',
          'backdrop-blur-md border border-white/20 dark:border-white/10',
          'p-6 shadow-lg shadow-purple-500/10'
        )}>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Monitor className="h-5 w-5 text-blue-500" />
            Active Sessions
          </h3>

          {sessionsError && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <X className="h-4 w-4" />
              {sessionsError}
            </div>
          )}
          
          {loadingSessions ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No active sessions found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => {
                const isCurrent = session.is_current || false;
                return (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-white/10 dark:border-white/5 bg-white/5 dark:bg-black/5"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{session.user_agent}</span>
                        {isCurrent && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-600 dark:text-green-400">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Created: {formatDate(session.creation_date)}
                        {session.expiration_date && ` • Expires: ${formatDate(session.expiration_date)}`}
                      </div>
                      {session.factors && session.factors.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Factors: {session.factors.join(', ')}
                        </div>
                      )}
                    </div>
                    {!isCurrent && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { void revokeSession(session.id); }}
                        disabled={revoking === session.id}
                        className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      >
                        {revoking === session.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Revoking...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Revoke
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

