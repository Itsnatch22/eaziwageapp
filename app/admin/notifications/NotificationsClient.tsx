'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell, CheckCircle2, Shield, Building2, AlertTriangle,
  Search, RefreshCw, Check,
  ArrowLeft, Clock, Trash2, Activity, ChevronDown, ChevronUp,
  MailX, Wifi, WifiOff, RotateCcw,
} from 'lucide-react';
import { Button }                  from '@/components/ui/button';
import { Input }                   from '@/components/ui/input';
import { formatDateTime, cn }      from '@/lib/utils';
import { toast }                   from 'sonner';
import Link from 'next/link';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';
import { Pagination } from '@/components/shared/Pagination';

const PAGE_SIZE = 10;


interface Notification {
  id:         string;
  type:       'review_request' | 'employer_kyc' | 'flagged_advance' | 'system_alert' | 'employee';
  title:      string;
  message:    string;
  read:       boolean;
  created_at: string;
  metadata?:  Record<string, unknown>;
}

interface FailedDelivery {
  id:              string;
  user_id:         string;
  title:           string;
  type:            string;
  delivery_status: string;
  delivery_channel: string | null;
  failure_reason:  string | null;
  created_at:      string;
}

interface HealthData {
  failed:      FailedDelivery[];
  breakdown:   Record<string, number>;
  atRiskCount: number;
}

const DeliveryStatusBadge = ({ status }: { status: string }) => {
  const cfg: Record<string, { label: string; classes: string; icon: React.ReactNode }> = {
    sent:           { label: 'Push sent',    classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',  icon: <Wifi className="w-3 h-3" /> },
    fallback_email: { label: 'Email sent',   classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',      icon: <MailX className="w-3 h-3 rotate-180" /> },
    failed:         { label: 'Failed',       classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',          icon: <WifiOff className="w-3 h-3" /> },
    pending:        { label: 'Pending',      classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',  icon: <Clock className="w-3 h-3" /> },
  };
  const { label, classes, icon } = cfg[status] ?? { label: status, classes: 'bg-slate-100 text-slate-600', icon: null };
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', classes)}>
      {icon}{label}
    </span>
  );
};

function getNotificationAction(notif: Notification): { label: string; href: string } | null {
  const meta = notif.metadata ?? {};
  const title = notif.title.toLowerCase();

  switch (notif.type) {
    case 'review_request':
      if (meta.wallet_transaction_id) return { label: 'View Request', href: '/admin/wallet/topup-requests' };
      if (meta.payment_method_id) return { label: 'View Verification', href: `/admin/bank-verifications?pm=${meta.payment_method_id}` };
      if (title.includes('kyc') || title.includes('document')) return { label: 'View KYC', href: '/admin/kyc-review' };
      return { label: 'View', href: '/admin' };

    case 'employer_kyc':
      if (title.includes('bank')) return { label: 'Review Bank Change', href: '/admin/review-requests' };
      return { label: 'Review Onboarding', href: '/admin/kyc-review' };

    case 'flagged_advance':
      return { label: 'View Advance', href: '/admin/advances' };

    case 'system_alert':
      if (title.includes('risk') || title.includes('fraud')) return { label: 'View Risk Alerts', href: '/admin/fraud-detection' };
      return null;

    default:
      return null;
  }
}

const NotificationIcon = ({ type }: { type: string }) => {
  const config = {
    review_request:  { icon: Shield,        bg: 'bg-emerald-100 dark:bg-emerald-900/30',  text: 'text-emerald-600 dark:text-emerald-400' },
    employer_kyc:    { icon: Building2,     bg: 'bg-amber-100 dark:bg-amber-500/20',  text: 'text-amber-600' },
    flagged_advance: { icon: AlertTriangle, bg: 'bg-red-100 dark:bg-red-500/20',      text: 'text-red-600' },
    system_alert:    { icon: Bell,          bg: 'bg-blue-100 dark:bg-blue-500/20',     text: 'text-blue-600' },
    employee:        { icon: Shield,        bg: 'bg-emerald-100 dark:bg-emerald-900/30',  text: 'text-emerald-600 dark:text-emerald-400' },
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
  const [currentPage,   setCurrentPage]   = useState(1);

  const [health,        setHealth]        = useState<HealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [showHealth,    setShowHealth]    = useState(false);
  const [resendingId,   setResendingId]   = useState<string | null>(null);

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
    // Keeps this page in sync with actions taken from the bell dropdown
    // (components/layout/NotificationDropdown.tsx, which shares this same
    // API) and vice versa — e.g. "mark as read" clicked in the dropdown now
    // reflects here without a reload.
    onUpdate: (data) => {
      setNotifications(prev =>
        prev.map(n => (n.id === data.id ? { ...n, ...data } : n))
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

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/api/admin/notifications/health');
      if (res.ok) setHealth(await res.json());
    } catch (err) {
      console.error('Fetch health error:', err);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => fetchNotifications());
  }, [fetchNotifications]);

  useEffect(() => {
    Promise.resolve().then(() => fetchHealth());
  }, [fetchHealth]);

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
      const res = await fetch(`/api/admin/notifications?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setNotifications(prev => prev.filter(n => String(n.id) !== String(id)));
        toast.success('Notification deleted');
      }
    } catch {
      toast.error('Failed to delete notification');
    }
  };

  const handleDeleteAll = async () => {
    if (notifications.length === 0) return;
    try {
      const res = await fetch('/api/admin/notifications?all=true', { method: 'DELETE' });
      if (res.ok) {
        setNotifications([]);
        toast.success('All notifications deleted');
      } else {
        toast.error('Failed to delete all notifications');
      }
    } catch {
      toast.error('Failed to delete all notifications');
    }
  };

  const handleResend = async (notificationId: string) => {
    setResendingId(notificationId);
    try {
      const res = await fetch(`/api/admin/notifications/${notificationId}/resend`, { method: 'POST' });
      const body = await res.json() as { success?: boolean; channel?: string; error?: string };
      if (res.ok && body.success) {
        toast.success(`Re-delivered via ${body.channel}`);
        // Remove from failed list on success
        setHealth(prev => prev
          ? { ...prev, failed: prev.failed.filter(f => f.id !== notificationId) }
          : prev
        );
      } else {
        toast.error(body.error ?? 'Resend failed — check failure reason');
      }
    } catch {
      toast.error('Failed to resend notification');
    } finally {
      setResendingId(null);
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

  // safePage clamps to the new totalPages on every render, so changing the
  // search term or filter automatically lands on a valid page without a
  // separate reset effect.
  const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedNotifications = filteredNotifications.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const failedCount = health?.failed.length ?? 0;

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
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              className="flex-1 sm:flex-none bg-white/60 dark:bg-slate-800/60 text-xs sm:text-sm h-9 sm:h-10 px-3 sm:px-4"
              onClick={fetchNotifications}
              disabled={loading}
            >
              <RefreshCw className={cn('w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2', loading && 'animate-spin')} />
              Refresh
            </Button>
            <Button
              variant="outline"
              className="flex-1 sm:flex-none bg-white/60 dark:bg-slate-800/60 text-xs sm:text-sm h-9 sm:h-10 px-3 sm:px-4"
              onClick={markAllAsRead}
              disabled={notifications.every(n => n.read)}
            >
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
              Mark all read
            </Button>
            <Button
              variant="outline"
              className="flex-1 sm:flex-none bg-white/60 dark:bg-slate-800/60 text-red-600 hover:text-red-700 hover:border-red-300 text-xs sm:text-sm h-9 sm:h-10 px-3 sm:px-4"
              onClick={handleDeleteAll}
              disabled={notifications.length === 0}
            >
              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
              Delete all
            </Button>
          </div>
        </div>

        {/* Delivery Health Panel */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-5 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
            onClick={() => setShowHealth(v => !v)}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center',
                failedCount > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'
              )}>
                <Activity className={cn('w-4 h-4', failedCount > 0 ? 'text-red-600' : 'text-emerald-600')} />
              </div>
              <div className="text-left">
                <p className="font-semibold text-slate-900 dark:text-white text-sm">Delivery Health</p>
                <p className="text-xs text-slate-500">Last 24 hours</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!healthLoading && health && (
                <>
                  <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500">
                    {(health.breakdown.sent ?? 0) > 0 && (
                      <span className="flex items-center gap-1">
                        <Wifi className="w-3 h-3 text-emerald-500" />
                        {health.breakdown.sent} push
                      </span>
                    )}
                    {(health.breakdown.fallback_email ?? 0) > 0 && (
                      <span className="flex items-center gap-1">
                        <Check className="w-3 h-3 text-blue-500" />
                        {health.breakdown.fallback_email} email
                      </span>
                    )}
                    {health.atRiskCount > 0 && (
                      <span className="flex items-center gap-1 text-amber-600">
                        <WifiOff className="w-3 h-3" />
                        {health.atRiskCount} no push
                      </span>
                    )}
                  </div>
                  {failedCount > 0 && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full text-xs font-semibold">
                      {failedCount} failed
                    </span>
                  )}
                  {failedCount === 0 && (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full text-xs font-semibold">
                      All delivered
                    </span>
                  )}
                </>
              )}
              {healthLoading && (
                <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
              )}
              {showHealth
                ? <ChevronUp className="w-4 h-4 text-slate-400" />
                : <ChevronDown className="w-4 h-4 text-slate-400" />
              }
            </div>
          </button>

          {showHealth && (
            <div className="border-t border-slate-200/50 dark:border-slate-700/30">
              {healthLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                </div>
              ) : !health || health.failed.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No failed deliveries in the last 24 hours</p>
                  {health && health.atRiskCount > 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      {health.atRiskCount} active user{health.atRiskCount !== 1 ? 's' : ''} without a push subscription — email is their only delivery channel.
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  {health.atRiskCount > 0 && (
                    <div className="flex items-center gap-2 px-5 py-3 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-800/30">
                      <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        <strong>{health.atRiskCount}</strong> user{health.atRiskCount !== 1 ? 's' : ''} have no active push subscription — notifications fall back to email only.
                      </p>
                    </div>
                  )}
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {health.failed.map(notif => (
                      <div key={notif.id} className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 p-4 sm:p-5">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-0.5">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white break-words">{notif.title}</p>
                              <DeliveryStatusBadge status={notif.delivery_status} />
                            </div>
                            {notif.failure_reason && (
                              <p className="text-xs text-red-600 dark:text-red-400 mb-1">{notif.failure_reason}</p>
                            )}
                            <p className="text-xs text-slate-400">{formatDateTime(notif.created_at)}</p>
                          </div>
                        </div>
                        <div className="flex justify-end pl-11 sm:pl-0 sm:self-center shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1.5 w-full sm:w-auto"
                            onClick={() => handleResend(notif.id)}
                            disabled={resendingId === notif.id}
                          >
                            <RotateCcw className={cn('w-3 h-3', resendingId === notif.id && 'animate-spin')} />
                            {resendingId === notif.id ? 'Sending…' : 'Resend'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Search / filter bar */}
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

        {/* Admin notification list */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-3xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          ) : paginatedNotifications.length === 0 ? (
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
              {paginatedNotifications.map(notif => (
                <div
                  key={notif.id}
                  className={cn(
                    'p-4 sm:p-6 flex items-start gap-3 sm:gap-4 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30 relative group',
                    !notif.read && 'bg-emerald-50/30 dark:bg-emerald-900/10'
                  )}
                  onClick={() => !notif.read && markAsRead([notif.id])}
                >
                  <NotificationIcon type={notif.type} />
                  <div className="flex-1 min-w-0 pr-6 sm:pr-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-1 mb-1">
                      <h3 className={cn(
                        'text-base font-bold text-slate-900 dark:text-white pr-4 md:pr-0',
                        !notif.read && 'text-emerald-700 dark:text-emerald-400'
                      )}>
                        {notif.title}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-400 shrink-0">
                        <Clock className="w-3 h-3" />
                        {formatDateTime(notif.created_at)}
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3 sm:mb-4">
                      {notif.message}
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      {getNotificationAction(notif) && (() => {
                        const action = getNotificationAction(notif)!;
                        return (
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs rounded-lg w-full sm:w-auto"
                            asChild
                          >
                            <Link href={action.href}>{action.label}</Link>
                          </Button>
                        );
                      })()}
                      {!notif.read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead([notif.id]);
                          }}
                          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 py-1"
                        >
                          <Check className="w-3 h-3" /> Mark read
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDelete(e, notif.id)}
                    className="absolute right-2 top-2 sm:right-4 sm:top-5 p-2.5 text-slate-400 hover:text-red-500 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10"
                    title="Delete notification"
                  >
                    <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <Pagination
            currentPage={safePage}
            totalItems={filteredNotifications.length}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
            className="border-t border-slate-100 dark:border-slate-800"
          />
        </div>
      </div>
    </>
  );
}
