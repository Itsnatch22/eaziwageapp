'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function AuthRefresher() {
  const router = useRouter();

  useEffect(() => {
    const handler = () => router.refresh();
    window.addEventListener('auth:signed-in', handler);
    return () => window.removeEventListener('auth:signed-in', handler);
  }, [router]);

  return null;
}
