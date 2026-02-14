"use client"
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Icons } from '@/constants';
import WellnessTab from './pages/WellnessTab';
import HelpTab from './pages/HelpTab';
import SettingsTab from './pages/SettingsTab';
import InsightsTab from './pages/InsightsTab';
import WalletTab from './pages/WalletTab';
import { TabButton, NotificationItem } from './UIComponents';

const EmployeeDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Wallet');
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [amount, setAmount] = useState('0');
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Performance metrics used for advance eligibility calculation
  const performanceMetrics = {
    daysWorked: 18,
    overtimeHours: 12,
    officeAttendance: 95, // percentage
    dailyRate: 300,
    overtimeRate: 45
  };

  // Mock Savings Goal
  const savingsGoal = {
    title: "House Downpayment",
    target: 50000,
    current: 12450,
    monthlyContribution: 500
  };

  // Eligibility Calculation
  const calculatedEligibility = useMemo(() => {
    const earnedFromDays = performanceMetrics.daysWorked * performanceMetrics.dailyRate;
    const earnedFromOvertime = performanceMetrics.overtimeHours * performanceMetrics.overtimeRate;
    const attendanceFactor = performanceMetrics.officeAttendance / 100;
    return (earnedFromDays + earnedFromOvertime) * 0.7 * attendanceFactor;
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'Wellness':
        return <WellnessTab />;
      case 'Help':
        return <HelpTab />;
      case 'Insights':
        return <InsightsTab performanceMetrics={performanceMetrics} />;
      case 'Settings':
        return <SettingsTab />;
      default:
        return (
          <WalletTab 
            calculatedEligibility={calculatedEligibility}
            performanceMetrics={performanceMetrics}
            savingsGoal={savingsGoal}
            onRequestAdvance={() => setShowWithdrawModal(true)}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">E</span>
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">EaziWage</span>
          </Link>
          <div className="flex items-center space-x-4">
             <div className="hidden md:block text-right">
              <p className="text-sm font-bold text-slate-900">Sarah Jenkins</p>
              <p className="text-xs text-slate-500">Software Engineer</p>
            </div>
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-green-600 transition-all shadow-sm"
              >
                <Icons.Bell size={20} />
                <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-slate-50 rounded-full"></span>
              </button>
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                   <h4 className="font-bold text-slate-900 mb-4 px-2">Notifications</h4>
                   <div className="space-y-2">
                     <NotificationItem text="Your advance of $450 was approved." time="2h ago" type="success" />
                     <NotificationItem text="Payroll verification for May completed." time="5h ago" type="info" />
                     <NotificationItem text="New Wellness article: Budgeting for 2024." time="1d ago" type="info" />
                   </div>
                </div>
              )}
            </div>
            <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold border-2 border-white shadow-sm">
              SJ
            </div>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-10 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm w-fit">
          <TabButton active={activeTab === 'Wallet'} label="My Wallet" onClick={() => setActiveTab('Wallet')} />
          <TabButton active={activeTab === 'Insights'} label="Insights" onClick={() => setActiveTab('Insights')} />
          <TabButton active={activeTab === 'Wellness'} label="Wellness" onClick={() => setActiveTab('Wellness')} />
          <TabButton active={activeTab === 'Help'} label="Help & Support" onClick={() => setActiveTab('Help')} />
          <TabButton active={activeTab === 'Settings'} label="Settings" onClick={() => setActiveTab('Settings')} />
        </div>

        {renderContent()}

        {/* Withdrawal/Advance Modal */}
        {showWithdrawModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 md:p-10 shadow-2xl animate-in fade-in zoom-in duration-300 border border-slate-100">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Icons.Wallet size={32} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2">Request Advance</h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed px-4">
                  Requesting a performance-based advance. Funds transfer typically takes 15-30 minutes.
                </p>
              </div>
              
              <div className="mb-10">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-3">Amount to Request</label>
                <div className="relative group">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-4xl font-bold text-slate-300 group-focus-within:text-emerald-500 transition-colors">$</span>
                  <input 
                    type="number" 
                    className="w-full pl-14 pr-6 py-8 bg-slate-50 border-2 border-transparent rounded-3xl text-5xl font-black focus:ring-0 focus:border-emerald-100 focus:bg-white outline-none transition-all placeholder-slate-200"
                    placeholder="0"
                    autoFocus
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                
                <div className="mt-6 p-5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest mb-3">
                    <span className="text-green-400">Eligibility Limit</span>
                    <span className="text-slate-900">${calculatedEligibility.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ease-out ${parseFloat(amount) > calculatedEligibility ? 'bg-red-500' : 'bg-emerald-500'}`} 
                      style={{ width: `${Math.min(100, (parseFloat(amount) || 0) / calculatedEligibility * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setShowWithdrawModal(false)}
                  className="py-5 bg-slate-100 text-green-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    alert(`Request for $${amount} submitted!`);
                    setShowWithdrawModal(false);
                  }}
                  disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > calculatedEligibility}
                  className="py-5 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 disabled:opacity-30 disabled:shadow-none"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeDashboard;