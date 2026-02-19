type ApiResponse<T = any> = { data: T };

async function request<T = any>(url: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error((data as any)?.message || 'Request failed'), {
      response: { status: res.status, data },
    });
  }
  return { data: data?.data ?? data };
}

export const employerApi = {
  getMe: () => request('/api/profile'),
  getSectors: () => request('/api/company/search'),
  uploadDocument: (formData: FormData) =>
    request('/api/employer/documents', { method: 'POST', body: formData }),
  createOnboarding: (payload: any) =>
    request('/api/employer/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  updateOnboardingStep: (step: number) =>
    request('/api/employer/onboarding/step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step }),
    }),
};

export const employeeApi = {
  list: () => request('/api/employees'),
};

export const dashboardApi = {
  getEmployerDashboard: () => request('/api/employer/dashboard'),
};

export const advanceApi = {
  list: () => request('/api/advances'),
};

export const payrollApi = {
  getHistory: () => request('/api/payroll/summary'),
  process: (payload: any) =>
    request('/api/payroll/statement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  upload: (formData: FormData) =>
    request('/api/payroll/export', {
      method: 'POST',
      body: formData,
    }),
};

