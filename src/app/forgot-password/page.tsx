'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Mail } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgotPasswordPage() {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (formData: FormData) => {
    setPending(true);
    setError('');
    const email = String(formData.get('email') || '').trim();
    const result = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setPending(false);
    if (result.error) {
      setError(result.error.message || 'Unable to send the reset email. Please try again.');
      return;
    }
    setSent(true);
  };

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="flex justify-center"><Logo /></div>
        <Card>
          <CardHeader>
            <CardTitle>Reset your password</CardTitle>
            <CardDescription>Enter your account email and we will send a secure reset link.</CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-4 text-center">
                <Mail className="mx-auto h-10 w-10 text-primary" />
                <p className="text-sm">If an account exists for that email, a reset link has been sent. Check your inbox and spam folder.</p>
                <Button asChild variant="outline"><Link href="/auth">Back to sign in</Link></Button>
              </div>
            ) : (
              <form action={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input id="reset-email" name="email" type="email" autoComplete="email" required />
                </div>
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                <Button className="w-full" disabled={pending}>
                  {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send reset link
                </Button>
                <Button asChild variant="ghost" className="w-full"><Link href="/auth">Back to sign in</Link></Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
