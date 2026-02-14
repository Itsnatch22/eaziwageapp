"use client"
import { useState } from 'react';
import  Link  from 'next/link';
import { Icons, MOCK_EMPLOYEES } from '@/constants';

//page imports
import OverviewTab from './pages/Overview';
import EmployeesTab from './pages/EmployeesTab';
import PayrollTab from './pages/PayrollTab';
import InsightsTab from './pages/InsightsTab';
import CommunicationTab from './pages/CommunicationTab';
import SettingsTab from './pages/SettingsTab';

// --- Main Dashboard Component ---

export default function EmployerDashboard() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [searchTerm, setSearchTerm] = useState('');

  const chartData = [
    { name: 'Jan', amount: 45000 },
    { name: 'Feb', amount: 52000 },
    { name: 'Mar', amount: 48000 },
    { name: 'Apr', amount: 61000 },
    { name: 'May', amount: 55000 },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'Employees':
        return <EmployeesTab employees={MOCK_EMPLOYEES} searchTerm={searchTerm} setSearchTerm={setSearchTerm} />;
      case 'Payroll':
        return <PayrollTab />;
      case 'Insights':
        return <InsightsTab />;
      case 'Comms':
        return <CommunicationTab />;
      case 'Settings':
        return <SettingsTab />;
      case 'Overview':
      default:
        return <OverviewTab chartData={chartData} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 hidden lg:flex flex-col sticky top-0 h-screen">
        <div className="p-8">
          <Link href="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-100">
              <span className="text-white font-black text-2xl">E</span>
            </div>
            <span className="text-2xl font-black text-green-900 tracking-tighter">EaziWage</span>
          </Link>
        </div>
        
        <nav className="grow px-4 space-y-1.5 py-6">
          <NavItem 
            icon={<Icons.LayoutDashboard size={22} />} 
            label="Dashboard" 
            active={activeTab === 'Overview'} 
            onClick={() => setActiveTab('Overview')} 
          />
          <NavItem 
            icon={<Icons.Users size={22} />} 
            label="Employees" 
            active={activeTab === 'Employees'} 
            onClick={() => setActiveTab('Employees')} 
          />
          <NavItem 
            icon={<Icons.CreditCard size={22} />} 
            label="Payroll & Funding" 
            active={activeTab === 'Payroll'} 
            onClick={() => setActiveTab('Payroll')} 
          />
          <NavItem 
            icon={<Icons.Bell size={22} />} 
            label="Communications" 
            active={activeTab === 'Comms'} 
            onClick={() => setActiveTab('Comms')} 
          />
          <NavItem 
            icon={<Icons.TrendingUp size={22} />} 
            label="Analytics Hub" 
            active={activeTab === 'Insights'} 
            onClick={() => setActiveTab('Insights')} 
          />
          <div className="pt-4 mt-4 border-t border-slate-50 px-4">
             <h5 className="text-[10px] font-black text-green-400 uppercase tracking-widest mb-4">Configuration</h5>
             <NavItem 
                icon={<Icons.Settings size={22} />} 
                label="System Settings" 
                active={activeTab === 'Settings'} 
                onClick={() => setActiveTab('Settings')} 
              />
          </div>
        </nav>

        <div className="p-8 border-t border-slate-50">
          <Link href="/" className="flex items-center text-green-500 hover:text-red-600 transition-colors group">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center mr-3 group-hover:bg-red-50 group-hover:text-red-600 transition-all">
              <Icons.LogOut size={20} />
            </div>
            <span className="text-sm font-black uppercase tracking-widest">Sign Out</span>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="grow p-6 lg:p-12 overflow-y-auto max-w-350 mx-auto w-full">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
          <div>
            <div className="flex items-center space-x-2 text-[10px] font-black text-green-600 uppercase tracking-widest mb-2 bg-green-50 px-3 py-1 rounded-lg w-fit">
               <Icons.ShieldCheck size={12} />
               <span>Enterprise Console • Secure Instance</span>
            </div>
            <h1 className="text-4xl font-black text-green-900 tracking-tighter">{activeTab}</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button className="p-3 bg-white border border-green-200 text-slate-400 hover:text-green-600 rounded-2xl transition-all shadow-sm relative">
              <Icons.Clock size={22} />
              <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
            </button>
            <div className="h-12 w-px bg-slate-200 mx-2"></div>
            <div className="flex items-center space-x-3 cursor-pointer group">
               <div className="text-right hidden sm:block">
                  <p className="text-sm font-black text-green-900 group-hover:text-green-600 transition-colors">Admin Console</p>
                  <p className="text-[10px] text-green-500 font-bold uppercase">Welcome admin.</p>
               </div>
               <div className="w-12 h-12 bg-green-900 text-white rounded-[1.2rem] flex items-center justify-center font-black shadow-lg">
                AD
               </div>
            </div>
          </div>
        </header>

        {renderContent()}
      </main>
    </div>
  );
}

// Helper Components
const NavItem = ({ icon, label, active = false, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center space-x-4 px-5 py-4 rounded-2xl transition-all group ${
      active ? 'bg-green-900 text-white shadow-xl shadow-slate-200' : 'text-green-500 hover:bg-green-50 hover:text-green-900'
    }`}
  >
    <div className={`${active ? 'text-green-400' : 'text-green-400 group-hover:text-green-600'} transition-colors`}>
      {icon}
    </div>
    <span className="text-sm font-bold tracking-tight">{label}</span>
  </button>
);

