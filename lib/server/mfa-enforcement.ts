const EMPLOYER_SECURITY_SETTINGS_PATH = '/dashboards/employer-dashboard/settings';
const EMPLOYER_ONBOARDING_PATH = '/dashboards/employer-dashboard/onboarding';
const EMPLOYER_TERMINATED_PATH = '/dashboards/employer-dashboard/terminated';
const ADMIN_SECURITY_SETTINGS_PATH = '/admin/settings';

export type EmployerRouteDecision =
  | { type: 'allow' }
  | { type: 'redirect'; to: string }
  | { type: 'forbid' };

const EMPLOYER_ONBOARDING_API_PATHS = new Set([
  '/api/employer-dashboard/onboarding',
  '/api/employer-dashboard/onboarding/upload',
  '/api/employer-dashboard/profile',
  '/api/employer-dashboard/sectors',
]);

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

export function getEmployerRouteDecision(
  pathname: string,
  tab: string | null,
  isApi: boolean,
  onboardingPending: boolean,
  needsMfa: boolean,
): EmployerRouteDecision {
  if (pathname === EMPLOYER_TERMINATED_PATH) return { type: 'allow' };

  if (onboardingPending) {
    if (isApi) {
      return EMPLOYER_ONBOARDING_API_PATHS.has(pathname) || isEmployerMfaSetupApiAllowed(pathname)
        ? { type: 'allow' }
        : { type: 'forbid' };
    }

    if (pathname === EMPLOYER_ONBOARDING_PATH) return { type: 'allow' };
    if (pathname === EMPLOYER_SECURITY_SETTINGS_PATH && tab === 'security') return { type: 'allow' };
    if (
      pathname === '/dashboards/employer-dashboard'
      || pathname.startsWith('/dashboards/employer-dashboard/')
    ) {
      return { type: 'redirect', to: EMPLOYER_ONBOARDING_PATH };
    }

    return { type: 'allow' };
  }

  if (!needsMfa) return { type: 'allow' };

  if (isApi) {
    return isEmployerMfaSetupApiAllowed(pathname)
      ? { type: 'allow' }
      : { type: 'forbid' };
  }

  const redirect = getEmployerMfaEnrollmentRedirect(pathname, tab);
  return redirect ? { type: 'redirect', to: redirect } : { type: 'allow' };
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
