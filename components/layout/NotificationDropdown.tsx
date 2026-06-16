"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Bell, Shield, CreditCard, Users, 
  Trash2, Loader2, Info, ExternalLink, AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
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

interface NotificationDropdownProps {
  role: 'admin' | 'employer' | 'employee';
  userId: string;
  apiPath: string;
  pusherChannel: string;
  viewAllHref: string;
  primaryColor: string; // e.g. "primary", "green-600", "purple-600"
}

export const NotificationDropdown = ({ 
  role,
  apiPath,
  pusherChannel,
  viewAllHref,
  primaryColor,
  userId
}: NotificationDropdownProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mountTimer = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(mountTimer);
  }, []);


  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiPath);
      if (res.ok) {
        const data = await res.json();
        // API response formats vary slightly between roles
        const list = Array.isArray(data) ? data : (data.notifications || []);
        setNotifications(list.slice(0, 20));
      }
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setLoading(false);
    }
  }, [apiPath]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchNotifications();
    }, 0);

    if (!userId) {
      return () => window.clearTimeout(timeoutId);
    }

    const supabase = createClient();
    type RealtimeNotificationPayload = { new: Notification; old?: Notification };

    const channel = supabase
      .channel(`realtime:notifications:dropdown-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, (payload: RealtimeNotificationPayload) => {
        const data = payload.new;
        setNotifications(prev => [data, ...prev].slice(0, 20));
        toast(data.title, {
          description: data.message,
          icon: <Bell className={cn("w-5 h-5", `text-${primaryColor}`)} />
        });
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, (payload: RealtimeNotificationPayload) => {
        const oldRow = payload.old;
        if (oldRow?.id) setNotifications(prev => prev.filter(n => String(n.id) !== String(oldRow.id)));
      })
      .subscribe();

    return () => {
      window.clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [pusherChannel, fetchNotifications, primaryColor, userId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShow(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (id?: string) => {
    // Optimistic UI
    if (id) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } else {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }

    try {
      await fetch(apiPath, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
    } catch (err) {
      console.error('Failed to mark as read', err);
    }
  };

  const deleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setNotifications(prev => prev.filter(n => n.id !== id));
    try {
      await fetch(`${apiPath}?id=${id}`, { method: 'DELETE' });
      toast.success('Notification removed');
    } catch {
      toast.error('Failed to delete');
      fetchNotifications();
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const getIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('advance') || t.includes('payout')) return <CreditCard className="w-4 h-4" />;
    if (t.includes('kyc') || t.includes('review') || t.includes('identity')) return <Shield className="w-4 h-4" />;
    if (t.includes('employee') || t.includes('user')) return <Users className="w-4 h-4" />;
    if (t.includes('alert') || t.includes('flagged') || t.includes('risk')) return <AlertTriangle className="w-4 h-4" />;
    if (t.includes('system') || t.includes('repayment')) return <Info className="w-4 h-4" />;
    return <Bell className="w-4 h-4" />;
  };

  const getIconColor = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('advance') || t.includes('payout')) return "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400";
    if (t.includes('kyc') || t.includes('review') || t.includes('identity')) return "bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400";
    if (t.includes('alert') || t.includes('flagged') || t.includes('risk') || t.includes('error')) return "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400";
    if (t.includes('employee') || t.includes('user')) return "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400";
    return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setShow(!show)}
        className={cn(
          "relative p-2.5 rounded-xl transition-all duration-200",
          "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
        )}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className={cn(
            "absolute top-1.5 right-1.5 w-4 h-4 rounded-full ring-2 ring-white dark:ring-slate-900",
            "text-[10px] font-bold text-white flex items-center justify-center animate-in zoom-in",
            role === 'admin' ? 'bg-purple-600' : role === 'employer' ? 'bg-blue-600' : 'bg-primary'
          )}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {show && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden z-50 animate-in slide-in-from-top-2 duration-200">
          <div className="p-4 border-b border-slate-200/50 dark:border-slate-700/30 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">Notifications</h3>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Stay Updated</p>
            </div>
            {unreadCount > 0 && (
              <button 
                onClick={() => markAsRead()}
                className="text-[10px] font-black uppercase text-primary hover:opacity-80 transition-opacity"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto custom-scrollbar">
            {loading && notifications.length === 0 ? (
              <div className="p-12 text-center">
                <Loader2 className="w-8 h-8 text-slate-300 animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-400">Loading your alerts...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Bell className="w-8 h-8 text-slate-200 dark:text-slate-700" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">All caught up!</h4>
                <p className="text-xs text-slate-500 mt-1">No new notifications at the moment.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {notifications.map((notif) => (
                  <div 
                    key={notif.id}
                    onClick={() => !notif.read && markAsRead(notif.id)}
                    className={cn(
                      "p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors relative group",
                      !notif.read && "bg-primary/5 dark:bg-primary/5"
                    )}
                  >
                    <div className="flex items-start gap-3 pr-8">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                        getIconColor(notif.type)
                      )}>
                        {getIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={cn(
                            "text-sm font-bold truncate",
                            notif.read ? "text-slate-600 dark:text-slate-400" : "text-slate-900 dark:text-white"
                          )}>
                            {notif.title}
                          </p>
                          <span className="text-[9px] font-medium text-slate-400 whitespace-nowrap">
                            {mounted ? new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null}
                          </span>

                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                          {notif.message}
                        </p>
                      </div>
                    </div>
                    
                    {/* Hover Actions */}
                    <button 
                      onClick={(e) => deleteNotification(e, notif.id)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    
                    {!notif.read && (
                      <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-slate-200/50 dark:border-slate-700/30">
            <Link 
              href={viewAllHref}
              className={cn(
                "flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-bold transition-all border",
                "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:text-primary"
              )}
              onClick={() => setShow(false)}
            >
              View All Notifications
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
