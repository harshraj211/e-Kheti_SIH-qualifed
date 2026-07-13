'use client';

import { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function AccountPage() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const changePassword = async (formData: FormData) => {
    const currentPassword = String(formData.get('currentPassword') || '');
    const newPassword = String(formData.get('newPassword') || '');
    const confirmPassword = String(formData.get('confirmPassword') || '');
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('The new password must contain at least 8 characters.');
      return;
    }

    setPending(true);
    const result = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    setPending(false);

    if (result.error) {
      setError(result.error.message || 'Could not change the password. Check your current password.');
      return;
    }

    const form = document.getElementById('change-password-form') as HTMLFormElement | null;
    form?.reset();
    toast({
      title: 'Password updated',
      description: 'Your other signed-in sessions have been securely revoked.',
    });
  };

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Account Security</h1>
        <p className="text-muted-foreground">Update your password and protect access to your farm data.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Change password</CardTitle>
          <CardDescription>You will remain signed in on this device. Other sessions will be signed out.</CardDescription>
        </CardHeader>
        <CardContent>
          <form id="change-password-form" action={changePassword} className="space-y-4">
            <PasswordField name="currentPassword" label="Current password" autoComplete="current-password" />
            <PasswordField name="newPassword" label="New password" autoComplete="new-password" />
            <PasswordField name="confirmPassword" label="Confirm new password" autoComplete="new-password" />
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update password
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function PasswordField({ name, label, autoComplete }: { name: string; label: string; autoComplete: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type="password" autoComplete={autoComplete} minLength={8} maxLength={128} required />
    </div>
  );
}
