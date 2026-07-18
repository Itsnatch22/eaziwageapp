'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

type PushStatus = 'idle' | 'loading' | 'subscribed' | 'unsubscribed' | 'denied' | 'unsupported';

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('unsupported');
      return;
    }

    const permission = Notification.permission;
    if (permission === 'denied') {
      setStatus('denied');
      return;
    }

    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        setStatus(sub ? 'subscribed' : 'unsubscribed');
      });
    }).catch(() => setStatus('unsubscribed'));
  }, []);

  // Returns whether the subscription actually succeeded — callers that
  // persist a "push enabled" preference must check this rather than
  // assuming success, since every failure path here is caught internally
  // (to drive the denied/unsupported UI hints) instead of throwing.
  const subscribe = useCallback(async (): Promise<boolean> => {
    setError(null);
    setStatus('loading');

    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setStatus('unsupported');
        return false;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('denied');
        setError('Notification permission was denied.');
        return false;
      }

      // Reuse an existing registration to avoid a race between register() and ready
      const reg = await navigator.serviceWorker.getRegistration('/')
        ?? await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      let sub = await reg.pushManager.getSubscription();

      if (!sub) {
        const keyRes = await fetch('/api/push/vapidPublicKey');
        if (!keyRes.ok) throw new Error('Failed to fetch VAPID public key.');
        const { publicKey } = await keyRes.json();
        if (!publicKey) throw new Error('VAPID public key is not configured.');

        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });
      }

      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('User not authenticated.');

      // Purge all stale/dead subscriptions for this user before saving the new one
      // so 410-Gone push failures don't accumulate in system_push_subscriptions
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearAll: true }),
      });

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, subscription: sub.toJSON() }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to save subscription.');
      }

      setStatus('subscribed');
      return true;
    } catch (err) {
      console.error('[usePushNotifications] subscribe error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setStatus('unsubscribed');
      return false;
    }
  }, []);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setError(null);
    setStatus('loading');

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });

        await sub.unsubscribe();
      }

      setStatus('unsubscribed');
      return true;
    } catch (err) {
      console.error('[usePushNotifications] unsubscribe error:', err);
      setError(err instanceof Error ? err.message : 'Failed to unsubscribe.');
      setStatus('subscribed'); // revert
      return false;
    }
  }, []);

  return { status, error, subscribe, unsubscribe };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}