"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimePostgresChangesPayload } from '@supabase/realtime-js';
import { toast } from 'sonner';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  metadata?: Record<string, unknown>;
}

type UseNotificationsOptions = {
  userId?: string | null;
  apiPath: string;
  onToast?: (n: Notification) => void;
};

export function useNotifications({ userId, apiPath, onToast }: UseNotificationsOptions) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const onToastRef = useRef(onToast);
  useEffect(() => { onToastRef.current = onToast; }, [onToast]);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(apiPath);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.notifications || []);
        setNotifications(list.slice(0, 50));
      }
    } catch (err) {

      console.error('useNotifications fetch failed', err);
    } finally {
      setLoading(false);
    }
  }, [apiPath, userId]);

  useEffect(() => {
    if (!userId) return;
    const init = window.setTimeout(() => { void fetchNotifications(); }, 0);
    return () => window.clearTimeout(init);
  }, [fetchNotifications, userId]);

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    type NotificationRow = Notification & { user_id?: string };

    const channel = supabase
      .channel(`realtime:notifications-hook-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload: RealtimePostgresChangesPayload<NotificationRow>) => {
        const n = payload.new as Notification;
        setNotifications(prev => [n, ...prev].slice(0, 50));
        try { onToastRef.current?.(n); }
        catch {}
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload: RealtimePostgresChangesPayload<NotificationRow>) => {
        const n = payload.new as Notification;
        setNotifications(prev => prev.map(p => (p.id === n.id ? n : p)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload: RealtimePostgresChangesPayload<NotificationRow>) => {
        const oldRow = payload.old as Partial<Notification> | undefined;
        if (oldRow?.id) setNotifications(prev => prev.filter(n => String(n.id) !== String(oldRow.id)));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]); // onToast is stable via ref — no channel churn on parent re-renders

  const markAsRead = useCallback(async (id?: string) => {

    if (id) setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    else setNotifications(prev => prev.map(n => ({ ...n, read: true })));

    try {

      const ids = id ? [id] : notifications.filter(n => !n.read).map(n => n.id);
      if (ids.length === 0) return;
      await fetch(apiPath, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notification_ids: ids }) });
    } catch (err) {
      console.error('markAsRead failed', err);
    }
  }, [apiPath, notifications]);

  const deleteNotification = useCallback(async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    try {
      await fetch(`${apiPath}?id=${id}`, { method: 'DELETE' });
      toast.success('Notification removed');
    } catch (err) {
      console.error('deleteNotification failed', err);
      void fetchNotifications();
    }
  }, [apiPath, fetchNotifications]);

  const deleteAll = useCallback(async () => {
    setNotifications([]);
    try {
      await fetch(`${apiPath}?all=true`, { method: 'DELETE' });
      toast.success('All notifications cleared');
    } catch (err) {
      console.error('deleteAll failed', err);
      void fetchNotifications();
    }
  }, [apiPath, fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, loading, unreadCount, markAsRead, deleteNotification, deleteAll, refresh: fetchNotifications };
}
