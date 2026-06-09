import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

interface AdminNotification {
  id: string;
  type: 'review_request' | 'employer_kyc' | 'flagged_advance' | 'system_alert' | 'employee';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  metadata?: Record<string, unknown>;
}

interface UseAdminNotificationsOptions {
  onInsert?: (notification: AdminNotification) => void;
  onDelete?: (id: string) => void;
  onUpdate?: (notification: AdminNotification) => void;
}

export function useAdminNotifications({
  onInsert,
  onDelete,
  onUpdate,
}: UseAdminNotificationsOptions) {
  const supabase = createClient();
  // Stable refs so the channel callback never goes stale
  const onInsertRef = useRef(onInsert);
  const onDeleteRef = useRef(onDelete);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => { onInsertRef.current = onInsert; }, [onInsert]);
  useEffect(() => { onDeleteRef.current = onDelete; }, [onDelete]);
  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);

  useEffect(() => {
    const channel = supabase
      .channel('admin_notifications_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_notifications' },
        (payload) => {
          onInsertRef.current?.(payload.new as AdminNotification);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'admin_notifications' },
        (payload) => {
          const deletedId = (payload.old as { id?: string })?.id;
          if (deletedId) onDeleteRef.current?.(deletedId);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'admin_notifications' },
        (payload) => {
          onUpdateRef.current?.(payload.new as AdminNotification);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[useAdminNotifications] Realtime connected');
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('[useAdminNotifications] Realtime channel error');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);
}