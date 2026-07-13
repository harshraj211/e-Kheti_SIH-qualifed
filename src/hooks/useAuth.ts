'use client';

import { authClient } from '@/lib/auth-client';

export const useAuth = () => {
  const session = authClient.useSession();
  return {
    user: session.data?.user ? {
      id: session.data.user.id,
      displayName: session.data.user.name,
      email: session.data.user.email,
      image: session.data.user.image,
    } : null,
    loading: session.isPending,
    error: session.error,
  };
};
