'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-background" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const linkError = searchParams.get('error');
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState(linkError ? 'This reset link is invalid or has expired.' : '');

  const submit = async (formData: FormData) => {
    const password = String(formData.get('password') || '');
    const confirmation = String(formData.get('confirmation') || '');
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }
    if (!token) {
      setError('This reset link is invalid or has expired.');
      return;
    }
    setPending(true);
    setError('');
    const result = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);
    if (result.error) {
      setError('This reset link is invalid or has expired. Request a new one.');
      return;
    }
    setComplete(true);
  };

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="flex justify-center"><Logo /></div>
        <Card>
          <CardHeader>
            <CardTitle>Choose a new password</CardTitle>
            <CardDescription>Your new password must contain at least 8 characters.</CardDescription>
          </CardHeader>
          <CardContent>
            {complete ? (
              <div className="space-y-4 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
                <p className="text-sm">Your password has been reset successfully.</p>
                <Button asChild><Link href="/auth">Sign in</Link></Button>
              </div>
            ) : (
              <form action={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input id="new-password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <Input id="confirm-password" name="confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
                </div>
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                <Button className="w-full" disabled={pending || !token}>
                  {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Reset password
                </Button>
                {!token && <Button asChild variant="outline" className="w-full"><Link href="/forgot-password">Request a new link</Link></Button>}
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
