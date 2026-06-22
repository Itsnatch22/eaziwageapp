"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Send, MessageSquare, History, Users, AlertCircle, 
  Loader2, Megaphone, Trash2, Search, Calendar, 
} from 'lucide-react';
import { EmployerPortalLayout } from '@/components/employer/EmployerLayout';
import { formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { GradientIconBox } from '@/components/employer/SharedComponents';

interface Announcement {
  id: string;
  title: string;
  message: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

interface EmployerProfile {
  id: string;
  company_name: string;
}

const MessagesPage = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [employer, setEmployer] = useState<EmployerProfile | null>(null);
  
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  const fetchData = useCallback(async (options?: { silent?: boolean }) => {

    await Promise.resolve();
    if (!options?.silent) setLoading(true);
    try {
      const [annRes, profileRes] = await Promise.all([
        fetch('/api/employer-dashboard/announcements'),
        fetch('/api/employer-dashboard/profile')
      ]);

      if (annRes.ok) {
        const data = await annRes.json();
        setAnnouncements(data.announcements);
      }

      if (profileRes.ok) {
        const data = await profileRes.json();
        setEmployer(data.profile);
      }
    } catch (err) {
      console.error('Failed to load announcements', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {

    void fetchData({ silent: true });
  }, [fetchData]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !message) return;

    setSending(true);
    try {
      const res = await fetch('/api/employer-dashboard/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send announcement');
      }

      toast.success('Announcement broadcasted successfully!');
      setTitle('');
      setMessage('');
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send announcement');
    } finally {
      setSending(false);
    }
  };

  return (
    <EmployerPortalLayout employer={employer}>
      <div className="max-w-7xl mx-auto space-y-8">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Communication Center</h1>
            <p className="text-slate-500 dark:text-slate-400">Broadcast updates and announcements to your entire workforce.</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-xl text-sm font-semibold">
                <Users className="w-4 h-4" /> Direct access to all employees
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-3xl p-6 border border-slate-200/50 dark:border-slate-700/30">
              <div className="flex items-center gap-3 mb-6">
                <GradientIconBox icon={Megaphone} size="md" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">New Announcement</h3>
              </div>

              <form onSubmit={handleSend} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Subject / Title</label>
                  <Input 
                    placeholder="e.g. Payroll Update - March 2026"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Message</label>
                  <Textarea 
                    placeholder="Type your message here..."
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    className="bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 rounded-xl min-h-37.5 resize-none"
                    required
                  />
                </div>
                
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
                   <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
                     <AlertCircle className="w-4 h-4" /> This message will be sent as a notification to all active employees.
                   </p>
                </div>

                <Button 
                  type="submit" 
                  disabled={sending || !title || !message}
                  className="w-full bg-primary text-white h-12 rounded-2xl shadow-lg shadow-primary/20"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Broadcast Message
                </Button>
              </form>
            </div>
          </div>

          
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-3xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
              <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <GradientIconBox icon={History} size="md" />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Announcement History</h3>
                </div>
                <div className="relative">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                   <Input placeholder="Search messages..." className="pl-9 bg-slate-50 dark:bg-slate-800/50 border-none h-9 text-xs w-48 rounded-lg" />
                </div>
              </div>

              <div className="divide-y divide-slate-200/50 dark:divide-slate-700/30">
                {loading ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-sm text-slate-500">Loading history...</p>
                  </div>
                ) : announcements.length === 0 ? (
                  <div className="py-20 text-center">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-4">
                       <MessageSquare className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-slate-500 font-medium">No announcements sent yet.</p>
                    <p className="text-xs text-slate-400 mt-1">Your message history will appear here.</p>
                  </div>
                ) : (
                  announcements.map((ann) => (
                    <div key={ann.id} className="p-6 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex-1">
                          <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                            {ann.title}
                          </h4>
                          <div className="flex items-center gap-3 mt-1">
                             <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <Calendar className="w-3.5 h-3.5" />
                                {formatDateTime(ann.created_at)}
                             </div>
                             <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                             <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Broadcasted</span>
                          </div>
                        </div>
                        <button className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                           <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
                        {ann.message}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </EmployerPortalLayout>
  );
};

export default MessagesPage;
