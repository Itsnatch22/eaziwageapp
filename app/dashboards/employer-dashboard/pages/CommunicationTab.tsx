// Your original file, now functional
'use client';

import { useState } from 'react';
import { Icons } from '@/constants';

const CommunicationTab = () => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSubmit = async (action: 'draft' | 'send') => {
    if (!title.trim() || !content.trim()) {
      setNotification({ type: 'error', message: 'Title and message are required' });
      return;
    }

    setIsLoading(true);
    setNotification(null);

    try {
      const res = await fetch('/api/communications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, action }),
      });

      const data = await res.json();

      if (res.ok) {
        setNotification({ type: 'success', message: data.message });
        if (action === 'send') {
          setTitle('');
          setContent('');
        }
      } else {
        setNotification({ type: 'error', message: data.error || 'Something went wrong' });
      }
    } catch (err) {
      setNotification({ type: 'error', message: 'Failed to connect to server' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in duration-500">
      {/* Broadcast Center */}
      <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-sm">
        <h3 className="text-2xl font-black text-green-900 mb-6 tracking-tight">Broadcast Center</h3>

        <div className="space-y-6">
          <div>
            <label className="text-xs font-black text-green-400 uppercase tracking-widest block mb-3">
              Announcement Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="e.g. Payroll Update for May 2024"
            />
          </div>

          <div>
            <label className="text-xs font-black text-green-400 uppercase tracking-widest block mb-3">
              Message Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium outline-none h-40 focus:ring-2 focus:ring-blue-100"
              placeholder="Type your message to all EaziWage enrolled employees..."
            />
          </div>

          <div className="flex space-x-4">
            <button
              onClick={() => handleSubmit('send')}
              disabled={isLoading}
              className="px-8 py-4 bg-green-900 text-white font-black rounded-2xl hover:bg-green-600 transition-all disabled:opacity-50 flex-1"
            >
              {isLoading ? 'Sending...' : 'Send to All Employees'}
            </button>

            <button
              onClick={() => handleSubmit('draft')}
              disabled={isLoading}
              className="px-8 py-4 bg-slate-100 text-green-600 font-bold rounded-2xl hover:bg-slate-200 transition-all disabled:opacity-50"
            >
              Save Draft
            </button>
          </div>
        </div>
      </div>

      {/* Success / Error Popup Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 px-8 py-4 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-semibold transition-all ${
            notification.type === 'success'
              ? 'bg-green-900 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {notification.type === 'success' ? <Icons.Check size={20} /> : <Icons.TriangleAlert size={20} />}
          {notification.message}
        </div>
      )}

      {/* Template Preview Card (unchanged) */}
      <div className="bg-blue-50 p-8 rounded-3xl border border-blue-100 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div className="w-12 h-12 bg-blue-100 text-green-600 rounded-xl flex items-center justify-center">
            <Icons.Bell size={24} />
          </div>
          <div>
            <h4 className="font-bold text-green-900">Communication Template</h4>
            <p className="text-xs text-green-700">Send educational materials about financial wellness provided by EaziWage.</p>
          </div>
        </div>
        <button className="px-6 py-3 bg-white text-green-600 font-bold rounded-xl text-xs hover:bg-blue-100 transition-all">
          PREVIEW TEMPLATE
        </button>
      </div>
    </div>
  );
};

export default CommunicationTab;