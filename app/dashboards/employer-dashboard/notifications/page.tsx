"use client"
import React, { useState, useEffect, useCallback } from 'react';
import { EmployerPortalLayout } from '@/components/employer/EmployerLayout';
import { Bell, CreditCard, Users, CheckCircle2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import pusherClient from '@/lib/pusher-client';
import { useAuthStore } from '@/lib/stores/auth';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  time?: string;
}

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const user = useAuthStore((state) => state.user);

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await fetch('/api/employer-dashboard/notifications');
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notifications || []);
            }
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();

        if (user?.id && pusherClient) {
            const channel = pusherClient.subscribe(`employer-${user.id}`);
            
            channel.bind('new-notification', (data: Record<string, string>) => {
                toast(data.title, {
                    description: data.message,
                    icon: <Bell className="w-5 h-5 text-primary" />
                });
                fetchNotifications();
            });

            channel.bind('notification-deleted', (data: { id: string }) => {
                setNotifications(prev => prev.filter(n => String(n.id) !== String(data.id)));
            });

            return () => {
                pusherClient!.unsubscribe(`employer-${user.id}`);
            };
        }
    }, [user?.id, fetchNotifications]);

    const markAsRead = async (id?: string) => {
        try {
            const res = await fetch('/api/employer-dashboard/notifications', {
                method: 'PUT',
                body: JSON.stringify({ id })
            });
            if (res.ok) {
                toast.success(id ? 'Marked notification as read' : 'All notifications marked as read');
                fetchNotifications();
            }
        } catch {
            toast.error('Failed to update notifications');
        }
    };

    const deleteNotification = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        try {
            const res = await fetch(`/api/employer-dashboard/notifications?id=${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setNotifications(prev => prev.filter(n => n.id !== id));
                toast.success('Notification deleted');
            }
        } catch {
            toast.error('Failed to delete notification');
        }
    };

    if (loading) {
        return (
            <EmployerPortalLayout employer={null}>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="w-14 h-14 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
            </EmployerPortalLayout>
        );
    }

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <EmployerPortalLayout employer={null}>
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Bell className="w-6 h-6 text-primary" />
                            Notifications
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">
                            Stay updated with your company&apos;s latest alerts and activity.
                        </p>
                    </div>
                    {unreadCount > 0 && (
                        <Button 
                            variant="outline" 
                            onClick={() => markAsRead()} 
                            className="bg-white dark:bg-slate-900"
                        >
                            Mark all as read
                        </Button>
                    )}
                </div>

                <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
                    {notifications.length === 0 ? (
                        <div className="p-12 text-center text-slate-500">
                            <Bell className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p>You have no notifications at this time.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {notifications.map((notif) => (
                                <div 
                                    key={notif.id}
                                    className={cn(
                                        "p-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-start gap-4 cursor-pointer relative group",
                                        !notif.read && "bg-primary/5"
                                    )}
                                    onClick={() => !notif.read && markAsRead(notif.id)}
                                >
                                    <div className={cn(
                                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                                        notif.type === 'advance' && "bg-primary/10",
                                        notif.type === 'system' && "bg-amber-100 dark:bg-amber-500/20",
                                        notif.type === 'employee' && "bg-blue-100 dark:bg-blue-500/20"
                                    )}>
                                        {notif.type === 'advance' && <CreditCard className="w-6 h-6 text-primary" />}
                                        {notif.type === 'system' && <Bell className="w-6 h-6 text-amber-600" />}
                                        {notif.type === 'employee' && <Users className="w-6 h-6 text-blue-600" />}
                                    </div>
                                    <div className="flex-1 min-w-0 pr-8">
                                        <div className="flex items-center justify-between">
                                            <p className={cn(
                                                "text-base font-semibold",
                                                notif.read ? "text-slate-700 dark:text-slate-300" : "text-slate-900 dark:text-white"
                                            )}>
                                                {notif.title}
                                            </p>
                                            <span className="text-xs text-slate-400 font-medium">
                                                {notif.time || (notif.created_at && new Date(notif.created_at).toLocaleTimeString())}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                            {notif.message}
                                        </p>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        {!notif.read ? (
                                            <div className="w-3 h-3 bg-primary rounded-full shrink-0 shadow-sm" />
                                        ) : (
                                            <CheckCircle2 className="w-5 h-5 text-emerald-500/50 shrink-0" />
                                        )}
                                        
                                        <button 
                                            onClick={(e) => deleteNotification(e, notif.id)}
                                            className="p-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
                                            title="Delete notification"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </EmployerPortalLayout>
    );
}

