'use client';

import { useState, useEffect, useRef } from 'react';
import { Icons } from "@/constants";

const EmployeesTab = () => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchEmployees = async () => {
    setIsLoading(true);
    const res = await fetch('/api/employees');
    const data = await res.json();
    setEmployees(data.employees || []);
    setIsLoading(false);
  };

  useEffect(() => { fetchEmployees(); }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/payroll/upload', { method: 'POST', body: formData });
    const data = await res.json();

    if (data.success) {
      setNotification({ type: 'success', message: data.message });
      fetchEmployees();
    } else {
      setNotification({ type: 'error', message: data.error });
    }
    setIsLoading(false);
  };

  const handleAction = async (action: 'approve' | 'deny', advanceId: string, employeeName: string) => {
    const res = await fetch(`/api/advances/${advanceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });

    const data = await res.json();

    if (data.success) {
      setNotification({ type: 'success', message: `${action === 'approve' ? 'Approved' : 'Denied'} advance for ${employeeName}` });
      fetchEmployees();
    } else {
      setNotification({ type: 'error', message: data.error || 'Failed' });
    }
    setOpenDropdownId(null);
  };

  const filtered = (employees || []).filter(e => 
    e?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div className="w-full md:w-auto">
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Workforce Management</h3>
          <p className="text-sm text-slate-500">Managing {employees.length} active enrollments</p>
        </div>

        <div className="flex space-x-2 w-full md:w-auto">
          <button className="grow md:grow-0 px-6 py-3 bg-white border border-slate-200 text-slate-900 font-bold rounded-xl text-sm hover:bg-slate-50 flex items-center justify-center">
            <Icons.Link2 className="mr-2" size={16} /> Sync HRIS
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="grow md:grow-0 px-6 py-3 bg-green-600 text-white font-bold rounded-xl text-sm hover:bg-green-700 shadow-lg shadow-green-100 flex items-center justify-center"
          >
            <Icons.Plus className="mr-2" size={16} /> {isLoading ? 'Uploading...' : 'Add New'}
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.csv" onChange={handleFileUpload} className="hidden" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-green-50/50">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search by name, role, or department..." 
              className="pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm w-full outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Icons.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-green-400 w-5 h-5" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-green-400 text-[10px] uppercase font-black tracking-widest">
              <tr>
                <th className="px-8 py-5">Employee</th>
                <th className="px-8 py-5">Department</th>
                <th className="px-8 py-5">Monthly Salary</th>
                <th className="px-8 py-5">Accessed (MTD)</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((employee: any) => (
                <tr key={employee.id} className="hover:bg-green-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-green-600 text-xs">
                        {employee.name.split(' ').map((n: string) => n[0]).join('')}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{employee.name}</div>
                        <div className="text-[10px] text-slate-400 font-bold">ID: EW-{employee.id.slice(0,8)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-xs font-bold text-green-600 px-3 py-1 bg-slate-100 rounded-lg">{employee.department}</span>
                  </td>
                  <td className="px-8 py-5 text-sm text-green-900 font-bold">
                    ${employee.salary.toLocaleString()}
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-green-600">
                        ${employee.withdrawnThisMonth.toLocaleString()}
                      </span>
                      <div className="w-24 h-1 bg-slate-100 rounded-full mt-1">
                        <div 
                          className="h-full bg-green-500 rounded-full"
                          style={{ 
                            width: `${Math.min(100, (employee.withdrawnThisMonth / (employee.maxAccess || employee.salary * 0.5)) * 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${
                      employee.status === 'Approved' ? 'bg-emerald-50 text-emerald-600' : 
                      employee.status === 'Pending' ? 'bg-amber-50 text-amber-600' : 
                      'bg-red-50 text-red-600'
                    }`}>
                      {employee.status}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right relative">
                    <button
                      onClick={() => setOpenDropdownId(openDropdownId === employee.id ? null : employee.id)}
                      className="text-green-400 hover:text-green-600 transition-colors p-2 hover:bg-blue-50 rounded-xl"
                    >
                      <Icons.MoreVertical size={16} />
                    </button>

                    {openDropdownId === employee.id && (
                      <div className="absolute right-8 top-12 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 w-48 z-50">
                        <button 
                          onClick={() => { setNotification({ type: 'success', message: `Message to ${employee.name} opened` }); setOpenDropdownId(null); }}
                          className="w-full text-left px-6 py-3 hover:bg-slate-50 text-sm font-medium flex items-center gap-3"
                        >
                          <Icons.MessageSquare size={18} /> Message
                        </button>

                        {employee.pendingAdvanceId && (
                          <>
                            <button
                              onClick={() => handleAction('approve', employee.pendingAdvanceId, employee.name)}
                              className="w-full text-left px-6 py-3 hover:bg-emerald-50 text-emerald-700 text-sm font-medium flex items-center gap-3"
                            >
                              <Icons.Check size={18} /> Approve Advance
                            </button>
                            <button
                              onClick={() => handleAction('deny', employee.pendingAdvanceId, employee.name)}
                              className="w-full text-left px-6 py-3 hover:bg-red-50 text-red-700 text-sm font-medium flex items-center gap-3"
                            >
                              <Icons.X size={18} /> Deny Advance
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notification popup */}
      {notification && (
        <div className={`fixed bottom-6 right-6 px-8 py-4 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-semibold transition-all ${
          notification.type === 'success' ? 'bg-green-900 text-white' : 'bg-red-600 text-white'
        }`}>
          {notification.type === 'success' ? <Icons.Check size={20} /> : <Icons.TriangleAlert size={20} />}
          {notification.message}
        </div>
      )}
    </div>
  );
};

export default EmployeesTab;