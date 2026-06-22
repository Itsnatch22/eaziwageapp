'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Bell, CheckCircle2, Shield, Building2, AlertTriangle, 
  Search, RefreshCw,  Check, 
  ArrowLeft, Clock, Trash2
} from 'lucide-react';
import { Button }                  from '@/components/ui/button';
import { Input }                   from '@/components/ui/input';
import { formatDateTime, cn }      from '@/lib/utils';
import { toast }                   from 'sonner';
import Link from 'next/link';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';


interface Notification {
  id:         string;
  type:       'review_request' | 'employer_kyc' | 'flagged_advance' | 'system_alert' | 'employee';
  title:      string;
  message:    string;
  read:       boolean;
  created_at: string;
  metadata?:  Record<string, unknown>;
}

const NotificationIcon = ({ type }: { type: string }) => {
  const config = {
    review_request:  { icon: Shield,        bg: 'bg-green-100 dark:bg-green-900/30',  text: 'text-green-600 dark:text-green-400' },
    employer_kyc:    { icon: Building2,     bg: 'bg-amber-100 dark:bg-amber-500/20',  text: 'text-amber-600' },
    flagged_advance: { icon: AlertTriangle, bg: 'bg-red-100 dark:bg-red-500/20',      text: 'text-red-600' },
    system_alert:    { icon: Bell,          bg: 'bg-blue-100 dark:bg-blue-500/20',     text: 'text-blue-600' },
    employee:        { icon: Shield,        bg: 'bg-green-100 dark:bg-green-900/30',  text: 'text-green-600 dark:text-green-400' },
  };

  const { icon: Icon, bg, text } = config[type as keyof typeof config] || config.system_alert;

  return (
    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', bg)}>
      <Icon className={cn('w-5 h-5', text)} />
    </div>
  );
};

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [searchTerm,    setSearchTerm]    = useState('');
  const [filter,        setFilter]        = useState<'all' | 'unread'>('all');

  useAdminNotifications({
  onInsert: (data) => {
    setNotifications((prev) => [data, ...prev]);
    toast.success('New notification received!');
  },
  onDelete: (id) => {
    setNotifications(prev => 
      prev.filter(n => String(n.id) !== String(id))
    );
  },
});

  const fetchNotifications = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      } else {
        toast.error('Failed to fetch notifications');
      }
    } catch (err) {
      console.error('Fetch notifications error:', err);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => fetchNotifications());
  }, [fetchNotifications]);

  const markAsRead = async (ids: string[]) => {
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_ids: ids }),
      });
      if (res.ok) {
        setNotifications(prev => 
          prev.map(n => ids.includes(n.id) ? { ...n, read: true } : n)
        );
      }
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length > 0) {
      await markAsRead(unreadIds);
      toast.success('All notifications marked as read');
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
        const res = await fetch(`/api/admin/notifications?id=${id}`, {
            method: 'DELETE'
        });
        if (res.ok) {
            setNotifications(prev => prev.filter(n => String(n.id) !== String(id)));
            toast.success('Notification deleted');
        }
    } catch {
        toast.error('Failed to delete notification');
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread' && n.read) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return n.title.toLowerCase().includes(s) || n.message.toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link 
              href="/admin" 
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                All Notifications
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">
                Stay updated with system activities
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="bg-white/60 dark:bg-slate-800/60"
              onClick={fetchNotifications}
              disabled={loading}
            >
              <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
              Refresh
            </Button>
            <Button
              variant="outline"
              className="bg-white/60 dark:bg-slate-800/60"
              onClick={markAllAsRead}
              disabled={notifications.every(n => n.read)}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Mark all as read
            </Button>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/30 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Search notifications..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-12 h-11 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setFilter('all')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                filter === 'all' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'
              )}
            >
              All
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                filter === 'unread' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'
              )}
            >
              Unread
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-3xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-10 h-10 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center py-20 px-4">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800/50 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <Bell className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">No notifications</h3>
              <p className="text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                {searchTerm || filter === 'unread' 
                  ? 'Try adjusting your search or filters'
                  : 'You are all caught up! Check back later for updates.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredNotifications.map(notif => (
                <div
                  key={notif.id}
                  className={cn(
                    'p-6 flex items-start gap-4 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30 relative group',
                    !notif.read && 'bg-green-50/30 dark:bg-green-900/10'
                  )}
                  onClick={() => !notif.read && markAsRead([notif.id])}
                >
                  <NotificationIcon type={notif.type} />
                  <div className="flex-1 min-w-0 pr-10">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className={cn(
                        'text-base font-bold text-slate-900 dark:text-white',
                        !notif.read && 'text-green-700 dark:text-green-400'
                      )}>
                        {notif.title}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Clock className="w-3 h-3" />
                        {formatDateTime(notif.created_at)}
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                      {notif.message}
                    </p>
                    <div className="flex items-center gap-3">
                      {notif.type === 'review_request' && (
                        <Button 
                          size="sm" 
                          className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs rounded-lg"
                          asChild
                        >
                          <Link href="/admin/kyc-review">Review Application</Link>
                        </Button>
                      )}
                      {notif.type === 'employer_kyc' && (
                        <Button 
                          size="sm" 
                          className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs rounded-lg"
                          asChild
                        >
                          <Link href={notif.title.toLowerCase().includes('bank') ? '/admin/review-requests' : '/admin/kyc-review'}>
                            {notif.title.toLowerCase().includes('bank') ? 'Review Bank Change' : 'Review Onboarding'}
                          </Link>
                        </Button>
                      )}
                      {notif.type === 'system_alert' && notif.title.toLowerCase().includes('risk') && (
                        <Button 
                          size="sm" 
                          className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs rounded-lg"
                          asChild
                        >
                          <Link href="/admin/fraud-detection">View Risk Alerts</Link>
                        </Button>
                      )}
                      {!notif.read && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead([notif.id]);
                          }}
                          className="text-xs font-semibold text-green-600 hover:text-green-700 flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" /> Mark read
                        </button>
                      )}
                    </div>
                  </div>

                  <button 
                        onClick={(e) => handleDelete(e, notif.id)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10"
                        title="Delete notification"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}