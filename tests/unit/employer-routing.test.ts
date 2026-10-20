import { describe, expect, it } from 'vitest';
import { getEmployerRouteDecision } from '@/lib/server/mfa-enforcement';

type Scenario = {
  name: string;
  pathname: string;
  tab?: string | null;
  isApi?: boolean;
  onboardingPending: boolean;
  needsMfa: boolean;
  expectedType: 'allow' | 'forbid' | 'redirect';
  expectedTo?: string;
};

const scenarios: Scenario[] = [
  {
    name: 'allows pending employer onboarding page',
    pathname: '/dashboards/employer-dashboard/onboarding',
    onboardingPending: true,
    needsMfa: true,
    expectedType: 'allow',
  },
  {
    name: 'allows pending employer security tab',
    pathname: '/dashboards/employer-dashboard/settings',
    tab: 'security',
    onboardingPending: true,
    needsMfa: true,
    expectedType: 'allow',
  },
  {
    name: 'routes pending employer dashboard to onboarding',
    pathname: '/dashboards/employer-dashboard',
    onboardingPending: true,
    needsMfa: true,
    expectedType: 'allow',
    expectedTo: '/dashboards/employer-dashboard/onboarding',
  },
  {
    name: 'routes pending employer non-security settings to onboarding',
    pathname: '/dashboards/employer-dashboard/settings',
    tab: 'profile',
    onboardingPending: true,
    needsMfa: true,
    expectedType: 'allow',
    expectedTo: '/dashboards/employer-dashboard/onboarding',
  },
  ...[
    '/api/employer-dashboard/onboarding',
    '/api/employer-dashboard/onboarding/upload',
    '/api/employer-dashboard/profile',
    '/api/employer-dashboard/sectors',
    '/api/employer-dashboard/security/mfa',
    '/api/employer-dashboard/security/sessions',
  ].map((pathname) => ({
    name: `allows pending employer endpoint ${pathname}`,
    pathname,
    isApi: true,
    onboardingPending: true,
    needsMfa: true,
    expectedType: 'allow' as const,
  })),
  {
    name: 'forbids pending employer payroll API',
    pathname: '/api/employer-dashboard/payroll',
    isApi: true,
    onboardingPending: true,
    needsMfa: true,
    expectedType: 'forbid',
  },
  {
    name: 'routes submitted unenrolled employer to MFA settings',
    pathname: '/dashboards/employer-dashboard',
    onboardingPending: false,
    needsMfa: true,
    expectedType: 'allow',
    expectedTo: '/dashboards/employer-dashboard/settings?tab=security',
  },
  {
    name: 'allows submitted enrolled employer dashboard',
    pathname: '/dashboards/employer-dashboard',
    onboardingPending: false,
    needsMfa: false,
    expectedType: 'allow',
  },
  {
    name: 'leaves terminated path to termination handling',
    pathname: '/dashboards/employer-dashboard/terminated',
    onboardingPending: false,
    needsMfa: true,
    expectedType: 'allow',
  },
];

function followEmployerRedirects(scenario: Scenario) {
  let currentUrl = new URL(
    `${scenario.pathname}${scenario.tab ? `?tab=${scenario.tab}` : ''}`,
    'http://localhost',
  );
  const visited = new Set<string>();
  const redirects: string[] = [];

  for (let hop = 0; hop < 5; hop += 1) {
    const key = `${currentUrl.pathname}${currentUrl.search}`;
    if (visited.has(key)) throw new Error(`Employer redirect cycle at ${key}`);
    visited.add(key);

    const decision = getEmployerRouteDecision(
      currentUrl.pathname,
      currentUrl.searchParams.get('tab'),
      scenario.isApi ?? false,
      scenario.onboardingPending,
      scenario.needsMfa,
    );

    if (decision.type !== 'redirect') {
      return { decision, redirects };
    }

    redirects.push(decision.to);
    currentUrl = new URL(decision.to, 'http://localhost');
  }

  throw new Error(`Employer redirects exceeded limit: ${redirects.join(' -> ')}`);
}

describe.each(scenarios)('$name', (scenario) => {
  it('reaches the expected decision without a redirect cycle', () => {
    const { decision, redirects } = followEmployerRedirects(scenario);

    expect(decision.type).toBe(scenario.expectedType);
    if (scenario.expectedTo) {
      expect(redirects).toEqual([scenario.expectedTo]);
    } else {
      expect(redirects).toEqual([]);
    }
  });
});
