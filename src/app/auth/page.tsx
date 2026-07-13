'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LogIn, UserPlus } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AuthPage() {
  const router = useRouter();
  const callbackURL = '/dashboard';
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState('');

  const submit = async (mode: 'login' | 'signup', formData: FormData) => {
    setIsPending(true);
    setError('');
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '');
    const name = String(formData.get('name') || '').trim();

    const result = mode === 'signup'
      ? await authClient.signUp.email({ email, password, name, callbackURL })
      : await authClient.signIn.email({ email, password, callbackURL, rememberMe: true });

    if (result.error) {
      setError(result.error.message || 'Authentication failed. Please check your details.');
      setIsPending(false);
      return;
    }
    router.push(callbackURL);
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="flex justify-center"><Logo /></div>
        <Card>
          <CardHeader>
            <CardTitle>Welcome to eKheti</CardTitle>
            <CardDescription>Sign in to keep your farm profile, conversations, and reminders synchronized.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" onValueChange={() => setError('')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <AuthForm mode="login" pending={isPending} error={error} onSubmit={submit} />
              </TabsContent>
              <TabsContent value="signup">
                <AuthForm mode="signup" pending={isPending} error={error} onSubmit={submit} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground">Your password is securely hashed. eKheti never stores the original password.</p>
      </div>
    </main>
  );
}

function AuthForm({ mode, pending, error, onSubmit }: {
  mode: 'login' | 'signup';
  pending: boolean;
  error: string;
  onSubmit: (mode: 'login' | 'signup', data: FormData) => Promise<void>;
}) {
  return (
    <form action={data => onSubmit(mode, data)} className="mt-5 space-y-4">
      {mode === 'signup' && (
        <div className="space-y-2">
          <Label htmlFor="signup-name">Name</Label>
          <Input id="signup-name" name="name" autoComplete="name" required maxLength={100} />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor={`${mode}-email`}>Email</Label>
        <Input id={`${mode}-email`} name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${mode}-password`}>Password</Label>
        <Input id={`${mode}-password`} name="password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={8} maxLength={128} required />
        {mode === 'signup' && <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button className="w-full" disabled={pending}>
        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : mode === 'signup' ? <UserPlus className="mr-2 h-4 w-4" /> : <LogIn className="mr-2 h-4 w-4" />}
        {mode === 'signup' ? 'Create account' : 'Sign in'}
      </Button>
    </form>
  );
}
