"use client";

import { useEffect } from 'react';

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    return reg;
  } catch (err) {
    console.error('SW register failed', err);
    return null;
  }
}

export async function getVapidKey() {
  try {
    const res = await fetch('/api/push/vapidPublicKey');
    if (!res.ok) return null;
    const data = await res.json();
    return data.publicKey;
  } catch (err) {
    console.error('Failed to fetch VAPID key', err);
    return null;
  }
}

export async function subscribeToPush() {
  try {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return { error: 'unsupported' };

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { error: 'permission_denied' };

    const reg = await registerServiceWorker();
    if (!reg) return { error: 'sw_failed' };

    const publicKey = await getVapidKey();
    if (!publicKey) return { error: 'no_vapid' };

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    // send to server
    await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub }) });

    return { success: true };
  } catch (err) {
    console.error('subscribeToPush error', err);
    return { error: 'failed' };
  }
}

export async function unsubscribeFromPush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return { success: true };
    await fetch('/api/push/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
    await sub.unsubscribe();
    return { success: true };
  } catch (err) {
    console.error('unsubscribeFromPush', err);
    return { error: 'failed' };
  }
}

// helper
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushClient() {
  useEffect(() => {
    // lazy: register service worker if available
    registerServiceWorker().catch(() => {});
  }, []);

  return null;
}
