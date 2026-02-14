import React from 'react';

const SettingsTab = () => {
  return (
    <div className="bg-white p-8 rounded-3xl border border-slate-200 animate-in fade-in duration-500 space-y-8">
      <div>
        <h3 className="font-bold text-green-900 mb-1">Account Preferences</h3>
        <p className="text-sm text-slate-500">Manage how you receive your earnings</p>
      </div>
      
      <div className="space-y-6">
        <section>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-3">Linked Bank Account</label>
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center group hover:border-blue-200 transition-colors cursor-pointer">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-8 bg-slate-900 rounded flex items-center justify-center">
                <span className="text-[10px] text-white font-bold">VISA</span>
              </div>
              <div>
                <div className="text-sm font-bold text-green-900">Chase Savings Account</div>
                <div className="text-xs text-slate-500">Account ending in •••• 4242</div>
              </div>
            </div>
            <button className="text-green-600 font-bold text-xs hover:underline">Change</button>
          </div>
        </section>

        <section>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-3">Security</label>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
              <span className="text-sm font-bold text-green-900">Biometric Verification</span>
              <div className="w-10 h-5 bg-emerald-500 rounded-full relative cursor-pointer">
                 <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
              <span className="text-sm font-bold text-green-900">Two-Factor Authentication</span>
              <div className="w-10 h-5 bg-slate-300 rounded-full relative cursor-pointer">
                 <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full"></div>
              </div>
            </div>
          </div>
        </section>
      </div>
      
      <button className="w-full py-4 bg-green-900 text-white font-bold rounded-2xl hover:bg-black transition-all">
        Save Settings
      </button>
    </div>
  );
};

export default SettingsTab;