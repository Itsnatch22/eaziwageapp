'use client';

import { useState, useEffect } from 'react';
import { Icons } from '@/constants';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const OverviewTab = () => {
  const router = useRouter();
  const [stats, setStats] = useState<any>({});
  const [liquidityData, setLiquidityData] = useState<any[]>([]);
  const [chartPeriod, setChartPeriod] = useState<'weekly' | 'monthly'>('monthly');
  const [approvedRequests, setApprovedRequests] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [notification, setNotification] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const [summaryRes, liquidityRes, approvedRes, pendingRes] = await Promise.all([
      fetch('/api/overview/summary'),
      fetch(`/api/overview/liquidity?period=${chartPeriod}`),
      fetch('/api/overview/approved'),
      fetch('/api/overview/approvals'),
    ]);

    setStats(await summaryRes.json());
    const liq = await liquidityRes.json();
    setLiquidityData(liq.data);
    setApprovedRequests((await approvedRes.json()).approved || []);
    setPendingApprovals((await pendingRes.json()).pendings || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [chartPeriod]);

  const markCleared = async (id: string) => {
    await fetch(`/api/advances/${id}/repaid`, { method: 'PATCH' });
    setNotification({ type: 'success', message: 'Advance marked as repaid' });
    fetchData();
  };

  const handleApproval = async (id: string, action: 'approve' | 'deny') => {
    const res = await fetch(`/api/advances/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      setNotification({ type: 'success', message: `Advance ${action}d` });
      fetchData();
    } else {
      const err = await res.json();
      setNotification({ type: 'error', message: err.error || 'Limit reached' });
    }
  };

  const exportPayroll = async () => {
    // You can expand this later
    const res = await fetch('/api/payroll/export', { method: 'POST' });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'eaziwage-payroll.csv'; a.click();
    setNotification({ type: 'success', message: 'Payroll CSV exported' });
  };

  const freezeAccount = async () => {
    await fetch('/api/organizations/freeze', { method: 'POST' });
    setNotification({ type: 'success', message: 'Account has been frozen' });
  };

  if (loading) return <div className="py-32 text-center text-slate-400">Loading live overview...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Exposure" value={`KES ${stats.totalExposure?.toLocaleString() || 0}`} change="+4.2%" trend="up" icon={<Icons.Zap size={18} className="text-blue-500"/>} />
        <StatCard title="Utilization Rate" value={`${stats.utilizationRate || 0}%`} change="+1.2%" trend="up" icon={<Icons.Activity size={18} className="text-emerald-500"/>} />
        <StatCard title="Funds Disbursed" value={`KES ${stats.fundsDisbursed?.toLocaleString() || 0}`} change="+12.5%" trend="up" icon={<Icons.Wallet size={18} className="text-amber-500"/>} />
        <StatCard title="Retention Score" value={`${stats.retentionScore || 94}/100`} change="Stable" trend="neutral" icon={<Icons.ShieldCheck size={18} className="text-indigo-500"/>} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Liquidity Forecast */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-900 text-lg">Financial Liquidity Forecast</h3>
              <div className="flex space-x-2">
                <button onClick={() => setChartPeriod('weekly')} className={`px-3 py-1 text-[10px] font-bold rounded-lg ${chartPeriod === 'weekly' ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Weekly</button>
                <button onClick={() => setChartPeriod('monthly')} className={`px-3 py-1 text-[10px] font-bold rounded-lg ${chartPeriod === 'monthly' ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Monthly</button>
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={liquidityData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none'}} />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]} fill="#43A047" barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Approved Requests */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-green-900">Approved Requests</h3>
              <Link href="/reports" className="text-xs font-bold text-green-600 hover:underline">View All</Link>
            </div>
            <div className="space-y-4">
              {approvedRequests.map((req: any) => (
                <div key={req.id} className="flex items-center justify-between p-4 rounded-2xl bg-green-50 border border-transparent hover:border-slate-100 transition-all">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-green-600 shadow-sm">
                      <Icons.CreditCard size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-green-900">
                        {req.profiles?.full_name} accessed KES {Number(req.amount).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-green-400 font-bold uppercase tracking-wider">
                        {req.profiles?.country_code || 'KE'} • {new Date(req.requested_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => markCleared(req.id)} className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-all">
                    <Icons.CheckCircle2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-green-900 text-white p-8 rounded-3xl shadow-xl">
            <h4 className="font-bold mb-4 text-xl">Quick Actions</h4>
            <div className="space-y-3">
              <ActionButton icon={<Icons.Plus size={18}/>} label="Add Employee" onClick={() => router.push('/dashboard/employees')} />
              <ActionButton icon={<Icons.ArrowDownToLine size={18}/>} label="Export Payroll CSV" onClick={exportPayroll} />
              <ActionButton icon={<Icons.Bell size={18}/>} label="Broadcast Update" onClick={() => router.push('/dashboard/communications')} />
              <ActionButton icon={<Icons.ShieldCheck size={18}/>} label="Freeze Account" onClick={freezeAccount} />
            </div>
          </div>

          {/* Manual Approvals */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-green-900">Manual Approvals</h4>
              {pendingApprovals.length > 0 && <span className="bg-red-100 text-red-600 text-[10px] font-black px-2 py-0.5 rounded-full">{pendingApprovals.length} PENDING</span>}
            </div>
            <div className="space-y-3 max-h-[420px] overflow-auto">
              {pendingApprovals.map((req: any) => (
                <ApprovalItem 
                  key={req.id}
                  name={req.profiles?.full_name || 'Employee'}
                  amount={req.amount}
                  time={new Date(req.requested_at).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}
                  onApprove={() => handleApproval(req.id, 'approve')}
                  onDeny={() => handleApproval(req.id, 'deny')}
                />
              ))}
            </div>
            {pendingApprovals.length > 4 && (
              <button className="w-full mt-4 py-3 text-xs font-bold text-green-600 hover:bg-green-50 rounded-xl transition-all">
                View {pendingApprovals.length - 4} more pending
              </button>
            )}
          </div>
        </div>
      </div>

      {notification && (
        <div className={`fixed bottom-6 right-6 px-8 py-4 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-semibold ${notification.type === 'success' ? 'bg-green-900' : 'bg-red-600'} text-white`}>
          {notification.message}
        </div>
      )}
    </div>
  );
};

const StatCard = ({ title, value, change, trend, icon }: any) => (
  <div className="p-8 bg-white rounded-4xl border border-slate-200 shadow-sm hover:border-green-200 transition-all cursor-default group">
    <div className="flex justify-between items-start mb-6">
       <div className="p-3 bg-green-50 rounded-2xl group-hover:bg-green-50 transition-colors">
          {icon}
       </div>
       <div className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${trend === 'up' ? 'text-emerald-600 bg-emerald-50' : 'text-green-400 bg-green-50'}`}>
         {change}
       </div>
    </div>
    <h4 className="text-[10px] font-black text-green-400 uppercase tracking-widest mb-1">{title}</h4>
    <div className="text-3xl font-black text-green-900 tracking-tighter">{value}</div>
  </div>
);

const ActionButton = ({ icon, label }: any) => (
  <button className="w-full flex items-center space-x-3 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group">
    <div className="p-2 bg-green-500/20 text-green-400 rounded-lg group-hover:scale-110 transition-transform">
      {icon}
    </div>
    <span className="text-xs font-bold text-white tracking-wide uppercase">{label}</span>
  </button>
);

const ApprovalItem = ({ name, amount, time }: any) => (
  <div className="flex items-center justify-between p-4 rounded-2xl bg-green-50 hover:bg-green-100 transition-all border border-transparent hover:border-green-200">
    <div className="flex items-center space-x-3">
      <div className="w-10 h-10 bg-white shadow-sm text-green-600 rounded-xl flex items-center justify-center font-black text-xs">
        {name.split(' ').map((n: string) => n[0]).join('')}
      </div>
      <div>
        <div className="text-sm font-bold text-green-900">{name}</div>
        <div className="text-[10px] text-green-500 font-bold uppercase">${amount} • {time}</div>
      </div>
    </div>
    <div className="flex space-x-2">
      <button className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all">
        <Icons.LogOut size={16} className="rotate-180" />
      </button>
      <button className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all">
        <Icons.CheckCircle2 size={16} />
      </button>
    </div>
  </div>
);

export default OverviewTab;