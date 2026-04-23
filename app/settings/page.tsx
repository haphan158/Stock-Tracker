'use client';

import { useEffect, useState, type FormEvent } from 'react';

import { AlertTriangle, LogOut, Save, Trash2 } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';

import { Navigation } from '@/src/components/navigation';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { usePreferences, useUpdatePreferences } from '@/src/hooks/usePreferences';

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

export default function SettingsPage() {
  const { data, isLoading } = usePreferences();
  const updatePrefs = useUpdatePreferences();
  const { theme, setTheme } = useTheme();

  const [displayName, setDisplayName] = useState('');
  const [displayCurrency, setDisplayCurrency] = useState('USD');
  const [confirmText, setConfirmText] = useState('');
  const [isSigningOutAll, setIsSigningOutAll] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (data?.preferences) {
      setDisplayName(data.preferences.displayName ?? '');
      setDisplayCurrency(data.preferences.displayCurrency);
    }
  }, [data?.preferences]);

  const handleSaveProfile = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await updatePrefs.mutateAsync({
        displayName: displayName.trim() === '' ? null : displayName.trim(),
        displayCurrency,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const handleSignOutAll = async () => {
    setIsSigningOutAll(true);
    try {
      const res = await fetch('/api/account/sessions', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to revoke sessions');
      toast.success('Signed out of all devices.');
      await signOut({ callbackUrl: '/' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sign out of all devices');
    } finally {
      setIsSigningOutAll(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmText !== 'DELETE') {
      toast.error('Type DELETE to confirm');
      return;
    }
    setIsDeleting(true);
    try {
      const res = await fetch('/api/account', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete account');
      toast.success('Account deleted.');
      await signOut({ callbackUrl: '/' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete account');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-background min-h-screen">
      <Navigation />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-foreground text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account and display preferences.</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label
                  htmlFor="display-name"
                  className="text-foreground mb-1 block text-sm font-medium"
                >
                  Display name
                </label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={isLoading ? 'Loading…' : 'How should we address you?'}
                  disabled={isLoading}
                />
              </div>
              <div>
                <label
                  htmlFor="display-currency"
                  className="text-foreground mb-1 block text-sm font-medium"
                >
                  Display currency
                </label>
                <select
                  id="display-currency"
                  value={displayCurrency}
                  onChange={(e) => setDisplayCurrency(e.target.value)}
                  disabled={isLoading}
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                >
                  {(data?.supportedCurrencies ?? ['USD']).map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
                <p className="text-muted-foreground mt-1 text-xs">
                  Portfolio totals and prices are converted to this currency at render time using
                  live FX rates.
                </p>
              </div>
              <Button
                type="submit"
                disabled={updatePrefs.isPending}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {updatePrefs.isPending ? 'Saving…' : 'Save'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <fieldset>
              <legend className="text-foreground mb-2 block text-sm font-medium">Theme</legend>
              <div className="flex gap-2" role="radiogroup">
                {THEME_OPTIONS.map((option) => {
                  const active = theme === option.value;
                  return (
                    <Button
                      key={option.value}
                      variant={active ? 'default' : 'outline'}
                      size="sm"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setTheme(option.value)}
                    >
                      {option.label}
                    </Button>
                  );
                })}
              </div>
            </fieldset>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Sessions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Revoke every active session — including this one. Useful if you signed in on a shared
              device.
            </p>
            <Button
              variant="outline"
              onClick={handleSignOutAll}
              disabled={isSigningOutAll}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              {isSigningOutAll ? 'Signing out…' : 'Sign out of all devices'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" aria-hidden /> Danger zone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Permanently delete your account and every holding, transaction, alert, and watchlist
              entry. This cannot be undone.
            </p>
            <Input
              placeholder='Type "DELETE" to confirm'
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              aria-label="Confirm account deletion"
            />
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={confirmText !== 'DELETE' || isDeleting}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {isDeleting ? 'Deleting…' : 'Delete my account & data'}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
