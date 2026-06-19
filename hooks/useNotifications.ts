"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/realtime-js';
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
      // swallow here; components may log
      // eslint-disable-next-line no-console
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
    type SupabaseWithChannel = { channel: (name: string) => RealtimeChannel; removeChannel: (c: RealtimeChannel) => void };

    const channel = ((supabase as unknown as SupabaseWithChannel)
      .channel(`realtime:notifications-hook-${userId}`) as unknown as any)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}`
      } as Record<string, unknown>, (payload: { new: Notification }) => {
        const n = payload.new;
        setNotifications(prev => [n, ...prev].slice(0, 50));
        try { if (onToast) onToast(n); }
        catch {}
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}`
      } as Record<string, unknown>, (payload: { new: Notification }) => {
        const n = payload.new;
        setNotifications(prev => prev.map(p => (p.id === n.id ? n : p)));
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}`
      } as Record<string, unknown>, (payload: { old?: Notification }) => {
        const oldRow = payload.old;
        if (oldRow?.id) setNotifications(prev => prev.filter(n => String(n.id) !== String(oldRow.id)));
      })
      .subscribe();

    return () => {
      (supabase as unknown as SupabaseWithChannel).removeChannel(channel);
    };
  }, [userId, onToast]);

  const markAsRead = useCallback(async (id?: string) => {
    // optimistic update
    if (id) setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    else setNotifications(prev => prev.map(n => ({ ...n, read: true })));

    try {
      // Most server endpoints accept POST { notification_ids: string[] } to mark read.
      const ids = id ? [id] : notifications.filter(n => !n.read).map(n => n.id);
      if (ids.length === 0) return;
      await fetch(apiPath, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notification_ids: ids }) });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('markAsRead failed', err);
    }
  }, [apiPath, notifications]);

  const deleteNotification = useCallback(async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    try {
      await fetch(`${apiPath}?id=${id}`, { method: 'DELETE' });
      toast.success('Notification removed');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('deleteNotification failed', err);
      void fetchNotifications();
    }
  }, [apiPath, fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, loading, unreadCount, markAsRead, deleteNotification, refresh: fetchNotifications };
}
