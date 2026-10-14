const EMPLOYER_SECURITY_SETTINGS_PATH = '/dashboards/employer-dashboard/settings';
const ADMIN_SECURITY_SETTINGS_PATH = '/admin/settings';

export function getEmployerMfaEnrollmentRedirect(
  pathname: string,
  tab: string | null,
): string | null {
  if (
    pathname !== '/dashboards/employer-dashboard'
    && !pathname.startsWith('/dashboards/employer-dashboard/')
  ) return null;
  if (pathname === EMPLOYER_SECURITY_SETTINGS_PATH && tab === 'security') return null;
  return `${EMPLOYER_SECURITY_SETTINGS_PATH}?tab=security`;
}

export function isEmployerMfaSetupApiAllowed(pathname: string): boolean {
  return pathname === '/api/employer-dashboard/security/mfa'
    || pathname === '/api/employer-dashboard/security/sessions';
}

export function getAdminMfaEnrollmentRedirect(pathname: string, tab: string | null): string | null {
  const isAdminPage = pathname.startsWith('/admin')
    || pathname === '/console'
    || pathname.startsWith('/console/');
  if (!isAdminPage) return null;
  if (pathname === ADMIN_SECURITY_SETTINGS_PATH && tab === 'security') return null;
  return `${ADMIN_SECURITY_SETTINGS_PATH}?tab=security`;
}

export function isAdminMfaSetupApiAllowed(pathname: string): boolean {
  return pathname === '/api/admin/security/mfa';
}
