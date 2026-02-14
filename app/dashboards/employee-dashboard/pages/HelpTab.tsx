'use client';

import { useState, useEffect, useMemo } from 'react';
import { Icons } from '@/constants';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

const HelpTab = () => {
  const [search, setSearch] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<string>('All');
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [activeAdvance, setActiveAdvance] = useState<any>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Static FAQs (easy to move to Supabase later)
  const faqs = [
    { 
      q: "How fast do I receive my advance?", 
      a: "Approved requests are disbursed to your M-Pesa or bank account within 15–30 minutes during business hours.",
      topic: "Eligibility"
    },
    { 
      q: "Do you charge interest?", 
      a: "Never. We only charge a small fixed transaction fee (2–4% depending on amount). No hidden interest.",
      topic: "Fees"
    },
    { 
      q: "When will my advance be repaid?", 
      a: "Repayment is fully automatic on your next payday. It will be deducted from your salary before it hits your account.",
      topic: "Repayment"
    },
    { 
      q: "What happens if I don’t have enough salary on payday?", 
      a: "We’ll roll over the balance to the next cycle with a small extension fee. You’ll never be in debt with your employer.",
      topic: "Repayment"
    },
    { 
      q: "Can my employer see how much I’ve requested?", 
      a: "No. Your employer only sees the total advanced amount, never individual requests or what you used the money for.",
      topic: "Privacy"
    },
    { 
      q: "What are the weekly and monthly limits?", 
      a: "Kenya: 60% of salary | Uganda: 40% | Rwanda: 50% | Tanzania: 45%. Limits reset after full repayment.",
      topic: "Limits"
    },
    { 
      q: "How do I settle an advance early?", 
      a: "Go to your Wallet → select the advance → tap ‘Settle Now’. You can pay via M-Pesa or bank transfer.",
      topic: "Repayment"
    },
    { 
      q: "What if my payroll is delayed?", 
      a: "Contact support immediately. We can pause deductions and give you a short extension.",
      topic: "Settlement"
    },
  ];

  // Fetch active advance (for contextual help)
  useEffect(() => {
    const fetchActive = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('advances')
        .select('amount, requested_at, status')
        .eq('employee_id', user.id)
        .eq('status', 'approved')
        .is('repaid_at', null)
        .single();

      setActiveAdvance(data);
    };
    fetchActive();
  }, []);

  // Filter FAQs
  const filteredFaqs = useMemo(() => {
    return faqs.filter(faq => {
      const matchesSearch = 
        faq.q.toLowerCase().includes(search.toLowerCase()) ||
        faq.a.toLowerCase().includes(search.toLowerCase());
      const matchesTopic = selectedTopic === 'All' || faq.topic === selectedTopic;
      return matchesSearch && matchesTopic;
    });
  }, [search, selectedTopic]);

  const topics = ['All', 'Eligibility', 'Fees', 'Repayment', 'Limits', 'Privacy', 'Settlement'];

  const toggleAccordion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const startChat = () => {
    // TODO: Wire to Zoom / Tawk.to / Intercom later
    setNotification({ type: 'success', message: 'Opening live chat...' });
    window.open('https://wa.me/254700000000', '_blank'); // placeholder WhatsApp
  };

  return (
    <div className="grid lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
      {/* LEFT COLUMN - FAQs */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900 mb-6">How can we help you today?</h3>

          {/* Topic Chips */}
          <div className="flex flex-wrap gap-2 mb-6">
            {topics.map(topic => (
              <button
                key={topic}
                onClick={() => setSelectedTopic(topic)}
                className={`px-5 py-2 text-xs font-bold rounded-2xl transition-all ${
                  selectedTopic === topic 
                    ? 'bg-green-600 text-white' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {topic}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative mb-8">
            <Icons.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search for answers..." 
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-green-100"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Contextual Active Advance */}
          {activeAdvance && (
            <div className="mb-8 p-5 bg-amber-50 border border-amber-200 rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
                  <Icons.AlertCircle size={22} className="text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold text-amber-900">
                    You have an active advance of KES {Number(activeAdvance.amount).toLocaleString()}
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    It will be automatically deducted on your next payday. No action needed from you.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Accordion FAQs */}
          <div className="space-y-3">
            {filteredFaqs.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                No results found. Try different keywords.
              </div>
            ) : (
              filteredFaqs.map((faq, i) => (
                <div 
                  key={i}
                  onClick={() => toggleAccordion(i)}
                  className="bg-slate-50 border border-transparent hover:border-slate-200 rounded-3xl overflow-hidden transition-all cursor-pointer group"
                >
                  <div className="p-6 flex justify-between items-center">
                    <div className="font-medium text-slate-900 pr-8">{faq.q}</div>
                    <Icons.ChevronRight 
                      size={20} 
                      className={`text-slate-400 transition-transform duration-300 ${openIndex === i ? 'rotate-90' : ''}`} 
                    />
                  </div>
                  
                  <div className={`overflow-hidden transition-all duration-300 ${openIndex === i ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="px-6 pb-6 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
                      {faq.a}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Trust micro-copy */}
          <div className="mt-10 text-[11px] text-slate-500 space-y-1">
            <p>• We never charge interest. Ever.</p>
            <p>• Your employer cannot see individual requests.</p>
            <p>• Repayment is 100% automatic and secure.</p>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN - Support & Emergency */}
      <div className="space-y-6">
        {/* Live Support */}
        <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Support Online</span>
          </div>
          
          <h4 className="text-xl font-bold mb-2">Need help right now?</h4>
          <p className="text-slate-400 text-sm mb-8">Average wait time: <span className="text-emerald-400 font-medium">2 minutes</span></p>
          
          <button 
            onClick={startChat}
            className="w-full py-4 bg-white text-slate-900 font-bold rounded-2xl hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
          >
            <Icons.MessageCircle size={18} />
            Start Live Chat
          </button>

          <div className="mt-6 grid grid-cols-2 gap-3 text-xs">
            <button className="bg-white/10 hover:bg-white/20 py-3 rounded-2xl transition-all">Report Payroll Issue</button>
            <button className="bg-white/10 hover:bg-white/20 py-3 rounded-2xl transition-all">Dispute Transaction</button>
          </div>
        </div>

        {/* Emergency Actions */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h4 className="font-bold text-slate-900 mb-5">Quick Emergency Actions</h4>
          
          <div className="space-y-3">
            <button className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-red-50 group transition-all">
              <div className="w-10 h-10 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center">
                <Icons.AlertTriangle size={22} />
              </div>
              <div className="text-left">
                <div className="font-semibold text-sm">Payroll was delayed</div>
                <div className="text-xs text-slate-500">Request extension</div>
              </div>
            </button>

            <button className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-amber-50 group transition-all">
              <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center">
                <Icons.CreditCard size={22} />
              </div>
              <div className="text-left">
                <div className="font-semibold text-sm">Advance not received</div>
                <div className="text-xs text-slate-500">Check status</div>
              </div>
            </button>

            <button className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-blue-50 group transition-all">
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                <Icons.HelpCircle size={22} />
              </div>
              <div className="text-left">
                <div className="font-semibold text-sm">Incorrect deduction</div>
                <div className="text-xs text-slate-500">Raise a ticket</div>
              </div>
            </button>
          </div>
        </div>

        {/* Help Center */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Icons.HelpCircle size={24} />
          </div>
          <h4 className="font-bold text-slate-900 mb-2">Full Help Center</h4>
          <p className="text-xs text-slate-500 mb-6">Detailed guides, policies, and video tutorials.</p>
          <button className="text-sm font-bold text-green-600 hover:underline">Browse Documentation →</button>
        </div>
      </div>

      {/* Notification popup */}
      {notification && (
        <div className={`fixed bottom-6 right-6 px-8 py-4 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-semibold transition-all ${notification.type === 'success' ? 'bg-green-900' : 'bg-red-600'} text-white`}>
          {notification.message}
        </div>
      )}
    </div>
  );
};

export default HelpTab;