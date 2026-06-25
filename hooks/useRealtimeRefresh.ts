"use client";

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface RealtimeTable {
  table: string;
  filter?: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
}

/**
 * Subscribe to one or more Supabase table changes and call `onRefresh` when
 * any of them fire. Designed to be dropped into any dashboard page — pair it
 * with the page's existing data-fetch function so changes made by other users
 * (admin actions, employee requests, etc.) appear without a manual refresh.
 *
 * The callback receives the table name so callers can show table-specific
 * toasts or selectively reload only the affected data.
 *
 * Usage:
 *   useRealtimeRefresh(
 *     [{ table: 'advances', filter: `employer_id=eq.${employerId}` }],
 *     (table) => void fetchAdvances()
 *   );
 */
export function useRealtimeRefresh(
  tables: RealtimeTable[],
  onRefresh: (table: string) => void,
) {
  // Keep a stable ref so the subscription doesn't re-fire when the caller
  // passes an inline arrow function (common pattern with useCallback).
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  // Stable key derived from the table config so the channel only re-subscribes
  // when the actual subscription config changes (e.g. employerId becomes known).
  const configKey = tables.map(t => `${t.table}:${t.filter ?? '*'}:${t.event ?? '*'}`).join('|');

  useEffect(() => {
    if (!tables.length) return;

    const supabase = createClient();
    const channelName = `realtime-refresh:${configKey}`;
    let channel = supabase.channel(channelName);

    for (const { table, filter, event = '*' } of tables) {
      channel = channel.on(
        'postgres_changes' as const,
        { event, schema: 'public', table, ...(filter ? { filter } : {}) },
        () => onRefreshRef.current(table),
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey]);
}
