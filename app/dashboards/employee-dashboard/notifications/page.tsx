"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Bell, CreditCard, Shield, AlertTriangle, 
  Trash2, CheckCircle2, MoreHorizontal, Settings, 
  RefreshCw, Check, Loader2, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/stores/auth';
import { EmployeePortalLayout } from '@/components/employee/EmployeeLayout';
import { Button } from '@/components/ui/button';
import type { RealtimePostgresChangesPayload } from '@supabase/realtime-js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export default function EmployeeNotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const user = useAuthStore((state) => state.user);

    const fetchNotifications = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/employee-dashboard/notifications');
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notifications || []);
            }
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
            toast.error('Could not load notifications');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void fetchNotifications();
        }, 0);

        if (!user?.id) {
            return () => window.clearTimeout(timeoutId);
        }

        const supabase = createClient();

        type NotificationRow = Notification & { user_id?: string };

        const channel = supabase
            .channel(`realtime:notifications:user-${user.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`
            }, (payload: RealtimePostgresChangesPayload<NotificationRow>) => {
                const newNotif = payload.new as Notification;
                setNotifications(prev => [newNotif, ...prev].slice(0, 50));
                toast(newNotif.title, {
                    description: newNotif.message,
                    icon: <Bell className="w-5 h-5 text-primary" />
                });
            })
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`
            }, (payload: RealtimePostgresChangesPayload<NotificationRow>) => {
                const oldRow = payload.old as Partial<Notification> | undefined;
                if (oldRow?.id) {
                    setNotifications(prev => prev.filter(n => String(n.id) !== String(oldRow.id)));
                }
            })
            .subscribe();

        return () => {
            window.clearTimeout(timeoutId);
            supabase.removeChannel(channel);
        };
    }, [user?.id, fetchNotifications]);

    const markAsRead = async (id?: string) => {
        try {
            const res = await fetch('/api/employee-dashboard/notifications', {
                method: 'PUT',
                body: JSON.stringify({ id })
            });
            if (res.ok) {
                setNotifications(prev => prev.map(n => (id && n.id !== id) ? n : { ...n, read: true }));
                if (!id) toast.success('All marked as read');
            }
        } catch {
            toast.error('Failed to update notifications');
        }
    };

    const deleteNotification = async (e: React.MouseEvent | null, id: string) => {
        if (e) e.stopPropagation();
        try {
            const res = await fetch(`/api/employee-dashboard/notifications?id=${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setNotifications(prev => prev.filter(n => n.id !== id));
                toast.success('Deleted');
            }
        } catch {
            toast.error('Error');
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'advance': return <CreditCard className="w-5 h-5 text-primary" />;
            case 'kyc':     return <Shield className="w-5 h-5 text-emerald-500" />;
            case 'system':  return <Info className="w-5 h-5 text-blue-500" />;
            case 'error':   return <AlertTriangle className="w-5 h-5 text-red-500" />;
            default:        return <Bell className="w-5 h-5 text-slate-400" />;
        }
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <EmployeePortalLayout title="Notifications">
            <div className="max-w-4xl mx-auto space-y-8">
                
                {/* Header Actions */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary w-fit border border-primary/20">
                            <Bell className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Inbox</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white">Recent Alerts</h1>
                        <p className="text-slate-500 dark:text-slate-400 max-w-lg">
                            Stay updated with your advance requests, KYC status, and platform announcements.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="rounded-xl border-slate-200 dark:border-slate-700 font-bold text-xs uppercase tracking-wider"
                                onClick={() => markAsRead()}
                            >
                                <Check className="w-4 h-4 mr-2" /> Mark all read
                            </Button>
                        )}
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-10 h-10 p-0 rounded-xl border-slate-200 dark:border-slate-700"
                            onClick={fetchNotifications}
                        >
                            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                        </Button>
                    </div>
                </div>

                {/* Notifications List */}
                <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden shadow-sm min-h-100">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-24 space-y-4">
                            <Loader2 className="w-10 h-10 text-primary animate-spin" />
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Syncing inbox...</p>
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 text-center">
                            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-4 border border-slate-100 dark:border-slate-700/50">
                                <Bell className="w-10 h-10 text-slate-200 dark:text-slate-700" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">All Caught Up</h3>
                            <p className="text-sm text-slate-500 mt-1">We&apos;ll notify you when something important happens.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {notifications.map((notif) => (
                                <div 
                                    key={notif.id}
                                    className={cn(
                                        "p-6 transition-all relative group flex gap-5 cursor-pointer",
                                        !notif.read ? "bg-primary/2 dark:bg-primary/2" : "hover:bg-slate-50/50 dark:hover:bg-white/2"
                                    )}
                                    onClick={() => !notif.read && markAsRead(notif.id)}
                                >
                                    {/* Status Indicator */}
                                    {!notif.read && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />
                                    )}

                                    {/* Icon */}
                                    <div className={cn(
                                        "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border transition-all",
                                        !notif.read 
                                            ? "bg-white dark:bg-slate-800 border-primary/20 scale-110 shadow-primary/5" 
                                            : "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800"
                                    )}>
                                        {getIcon(notif.type)}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <h3 className={cn(
                                                    "text-base font-bold leading-tight",
                                                    !notif.read ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400"
                                                )}>
                                                    {notif.title}
                                                </h3>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                    {new Date(notif.created_at).toLocaleDateString('en-US', { 
                                                        month: 'short', 
                                                        day: 'numeric', 
                                                        hour: '2-digit', 
                                                        minute: '2-digit' 
                                                    })}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                        <Button variant="ghost" size="sm" className="w-8 h-8 p-0 rounded-lg">
                                                            <MoreHorizontal className="w-4 h-4 text-slate-400" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="rounded-xl border-slate-200 dark:border-slate-700">
                                                        {!notif.read && (
                                                            <DropdownMenuItem onClick={() => markAsRead(notif.id)} className="rounded-lg">
                                                                <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" />
                                                                <span>Mark as read</span>
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuItem onClick={() => deleteNotification(null, notif.id)} className="text-red-600 rounded-lg">
                                                            <Trash2 className="w-4 h-4 mr-2" />
                                                            <span>Delete</span>
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                        
                                        <p className={cn(
                                            "mt-2 text-sm leading-relaxed",
                                            !notif.read ? "text-slate-700 dark:text-slate-300" : "text-slate-500 dark:text-slate-500"
                                        )}>
                                            {notif.message}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Settings Card */}
                <div className="bg-linear-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-32 -mt-32 group-hover:bg-primary/20 transition-colors" />
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="space-y-2 text-center md:text-left">
                            <h3 className="text-xl font-bold">Notification Preferences</h3>
                            <p className="text-slate-400 text-sm max-w-sm">
                                Choose how you want to receive updates about your wages and account security.
                            </p>
                        </div>
                        <Button 
                            className="bg-white text-slate-900 hover:bg-slate-100 rounded-2xl px-8 h-12 font-bold transition-all shadow-lg"
                            onClick={() => window.location.href = '/dashboards/employee-dashboard/settings'}
                        >
                            Open Settings <Settings className="w-4 h-4 ml-2" />
                        </Button>
                    </div>
                </div>
            </div>
        </EmployeePortalLayout>
    );
}
