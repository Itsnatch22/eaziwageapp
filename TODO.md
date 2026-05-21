# EaziWage — ESLint Issue Priority Report

> **Total: 439 problems (189 errors · 250 warnings)**  
> Organised highest → lowest impact. Fix top levels first; lower levels are largely cosmetic cleanup.

---

## 🔴 Priority 10 — Runtime Behaviour & Cascading Render Bugs

> These cause real performance degradation and unpredictable UI. React's strict mode and concurrent features make them worse over time.

**Rule:** `react-hooks/set-state-in-effect`  
Calling `setState` directly inside `useEffect` body (not in a callback) triggers cascading renders on every execution.

| File | Line | Call |
|------|------|------|
| `components/admin/AdminLayout.tsx` | 66 | `setMounted(true)` |
| `components/admin/AdminLayout.tsx` | 78 | `setAvatarUrl(newUrl)` |
| `components/employee/EmployeeLayout.tsx` | 61 | `setMounted(true)` |
| `components/employee/EmployeeLayout.tsx` | 102 | `setAvatarUrl(newUrl)` |
| `components/employee/EmployeeLayout.tsx` | 411 | `setSidebarOpen(false)` |
| `components/employer/EmployerLayout.tsx` | 151 | `setMounted(true)` |
| `components/employer/EmployerLayout.tsx` | 163 | `setAvatarUrl(newUrl)` |
| `components/employer/EmployerLayout.tsx` | 342 | `setMounted(true)` |
| `components/employer/EmployerLayout.tsx` | 422 | `setMounted(true)` |
| `components/employer/EmployerLayout.tsx` | 432 | `setAvatarUrl(newUrl)` |
| `components/ui/Confetti.tsx` | 45 | `setIsClient(true)` |
| `app/admin/review-requests/page.tsx` | 236 | `setResponse('')` |

**Fix pattern:** Move the setState call into a condition, use `useLayoutEffect`, or initialise state lazily so the effect doesn't need to set it synchronously.

```ts
// ❌ Before
useEffect(() => { setMounted(true); }, []);

// ✅ After — lazy initialiser, no effect needed
const [mounted, setMounted] = useState(() => typeof window !== 'undefined');
```

---

## 🔴 Priority 9 — Render-Phase Impurity & Ref Access During Render

> Calling impure functions or reading refs during render breaks React's rendering contract and will produce non-deterministic UI.

**Rule:** `react-hooks/purity` — impure function during render

| File | Line | Issue |
|------|------|-------|
| `app/contact/page.tsx` | 33 | `Math.random()` called inside JSX render path |

**Fix:** Move the random value outside the component or into a `useMemo`/`useRef` so it is stable across re-renders.

```ts
// ❌ Before — inside component render
duration: 10 + Math.random() * 5

// ✅ After
const duration = useRef(10 + Math.random() * 5).current;
```

---

**Rule:** `react-hooks/refs` — reading `ref.current` during render

| File | Line | Issue |
|------|------|-------|
| `components/ui/dropdown-menu.tsx` | 15–20 | `ref` passed to `cloneElement` reads value during render |

**Fix:** Access the ref only inside event handlers or effects, never in the render return.

---

## 🟠 Priority 8 — Type Safety: `no-explicit-any` in API / Lib Layer

> API routes and shared libraries are the backbone of the app. Using `any` here disables type-checking for data that crosses the network boundary — the highest-risk surface.

**Rule:** `@typescript-eslint/no-explicit-any`

**Highest-risk files (most occurrences):**

| File | Occurrences |
|------|-------------|
| `app/api/admin/reports/[id]/download/route.ts` | 30+ |
| `lib/dusupay.ts` | 9 |
| `lib/dusupay/client.ts` | 3 |
| `lib/dusupay/types.ts` | 3 |
| `lib/services/payout-service.ts` | 1 |
| `app/api/admin/billing/route.ts` | 2 |
| `app/api/webhook/dusupay/route.ts` | 4 |
| `app/api/v1/payouts/webhook/route.ts` | 2 |
| `app/api/admin/advances/[id]/disburse/route.ts` | 1 |
| `app/api/admin/advances/[id]/reject/route.ts` | 1 |
| `app/api/admin/employees/[id]/kyc/route.ts` | 1 |
| `app/api/admin/employees/[id]/route.ts` | 1 |
| `app/api/admin/employees/[id]/status/route.ts` | 1 |
| `app/api/admin/employees/route.ts` | 1 |
| `app/api/admin/payouts/fund-employer/route.ts` | 1 |
| `app/api/admin/search/route.ts` | 1 |
| `app/api/admin/dusupay/sync-balance/route.ts` | 1 |
| `app/api/admin/finances/stanbic-deposit/route.ts` | 1 |
| `app/api/admin/review-requests/[id]/route.ts` | 1 |

**Fix pattern:** Replace `any` with a proper interface or a union type. For unknown Supabase/API response shapes, use `unknown` and narrow with a type guard.

```ts
// ❌ Before
} catch (err: any) {

// ✅ After
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : 'Unknown error';
}
```

---

## 🟠 Priority 7 — Type Safety: `no-explicit-any` in UI Components & Pages

> Same rule as Priority 8 but in frontend code. Still a safety concern, lower blast radius than API layer.

**Files affected:**

| File | Occurrences |
|------|-------------|
| `components/admin/AdminLayout.tsx` | 3 |
| `components/employer/EmployerLayout.tsx` | 7 |
| `components/employee/EmployeeLayout.tsx` | 1 |
| `components/ui/AvatarUpload.tsx` | 2 |
| `components/ui/ExportButton.tsx` | 2 |
| `components/ui/dropdown-menu.tsx` | 3 |
| `components/layout/NotificationDropdown.tsx` | 1 |
| `app/admin/billing/page.tsx` | 2 |
| `app/admin/kyc-review/page.tsx` | 1 |
| `app/admin/page.tsx` | 1 |
| `app/contact/page.tsx` | 1 |
| `app/dashboards/employee-dashboard/settings/page.tsx` | 8 |
| `app/dashboards/employee-dashboard/payment-methods/page.tsx` | 1 |
| `app/dashboards/employee-dashboard/request-advance/page.tsx` | 1 |
| `app/dashboards/employer-dashboard/employees/page.tsx` | 6 |
| `app/dashboards/employer-dashboard/messages/page.tsx` | 3 |
| `app/dashboards/employer-dashboard/page.tsx` | 1 |
| `app/dashboards/employer-dashboard/wallet/page.tsx` | 1 |

---

## 🟠 Priority 6 — Stale Closure Risk: Missing `useEffect` Dependencies

> Missing deps mean effects run with stale data. Can cause silent bugs like showing outdated state or skipping re-fetches when they should run.

**Rule:** `react-hooks/exhaustive-deps`

| File | Line | Missing Dep |
|------|------|-------------|
| `app/admin/page.tsx` | 338 | `handleUpdate` |
| `app/admin/risk-scoring/page.tsx` | 499, 509 | `fetchEmployers` |
| `app/admin/settings/page.tsx` | 979 | `fetchEmployees` |
| `app/admin/settings/page.tsx` | 1604 | `fetchBlackouts` |
| `app/admin/settings/page.tsx` | 1872 | `fetchDocuments` |
| `app/admin/settings/page.tsx` | 2109 | `fetchAdmins`, `fetchAuditData` |
| `app/admin/settings/page.tsx` | 2113 | `fetchAuditLogs` |
| `app/dashboards/employee-dashboard/kyc/page.tsx` | 101 | `fetchDocuments` |
| `app/dashboards/employee-dashboard/page.tsx` | 207, 218 | `fetchStats` |
| `components/employer/EmployerLayout.tsx` | 436 | `user`, complex expression |

**Fix:** Either add the missing dependency and wrap the function in `useCallback`, or extract the dependency outside the component if it's a stable reference.

---

## 🟡 Priority 5 — Incorrect Mutability: `prefer-const`

> `let` is used for variables that are never reassigned. Small correctness issue but signals a misunderstanding of the data flow.

| File | Line | Variable |
|------|------|----------|
| `app/api/admin/employers/[id]/status/route.ts` | 74 | `employerFetchError` |
| `app/api/webhook/dusupay/route.ts` | 128 | `newStatus` |

**Fix:** Change `let` → `const`.

---

## 🟡 Priority 4 — Broken JSX: Unescaped HTML Entities

> Raw `'` in JSX text nodes can cause hydration mismatches and broken rendering in some parsers.

**Rule:** `react/no-unescaped-entities`

| File | Line |
|------|------|
| `components/admin/AdminLayout.tsx` | 547 |
| `components/employee/DeleteAccountModal.tsx` | 127 (×2) |
| `app/dashboards/employer-dashboard/employees/page.tsx` | 181 |
| `app/dashboards/employee-dashboard/settings/page.tsx` | 566 |
| `emails/ContactAutoReply.tsx` | 47, 59, 75 |
| `emails/ContactNotification.tsx` | 93 |

**Fix:** Replace `'` with `&apos;` or `{'}'` in JSX.

---

## 🟡 Priority 3 — Accessibility: Missing `alt` on `<img>`

> Screen readers cannot describe the image. A legal/compliance concern for any production app.

**Rule:** `jsx-a11y/alt-text`

| File | Line |
|------|------|
| `components/ui/avatar.tsx` | 18 |

**Fix:** Add a meaningful `alt` attribute, or `alt=""` if the image is purely decorative.

---

## 🟢 Priority 2 — Performance: `<img>` Instead of Next.js `<Image />`

> `<img>` bypasses Next.js automatic optimisation (lazy loading, format negotiation, size caching). Increases LCP and bandwidth.

**Rule:** `@next/next/no-img-element`

| File | Line |
|------|------|
| `app/dashboards/employee-dashboard/employment/page.tsx` | 113 |
| `app/dashboards/employee-dashboard/settings/page.tsx` | 691 |
| `components/ui/avatar.tsx` | 18 |

**Fix:** Import and use `<Image>` from `next/image` with `width`, `height`, and `alt` props.

---

## 🟢 Priority 1 — Dead Code: Assigned Variables Never Used

> Clutters the codebase. Dead state/values increase bundle size marginally and make reading logic harder.

**Rule:** `@typescript-eslint/no-unused-vars` — assigned values

| File | Variables |
|------|-----------|
| `app/admin/page.tsx` | `currency`, `fetchNotifications` |
| `app/admin/reports/page.tsx` | `pagination`, `newReport` |
| `app/admin/settings/page.tsx` | `admins`, `loading`, `clearFilters`, `exportAuditLog`, `getTypeColor`, `getTypeLabel` |
| `app/dashboards/employee-dashboard/kyc/page.tsx` | `showConfetti` |
| `app/dashboards/employee-dashboard/notifications/page.tsx` | `actionLoading`, `setActionLoading` |
| `app/dashboards/employee-dashboard/onboarding/page.tsx` | `selectedEmployer` |
| `app/dashboards/employee-dashboard/page.tsx` | `showConfetti` |
| `app/dashboards/employee-dashboard/settings/page.tsx` | `notificationsEnabled`, `setNotificationsEnabled`, `biometricEnabled`, `setBiometricEnabled`, `mfaEnabled`, `setMfaEnabled`, `notificationLoading`, `InfoRow` |
| `app/dashboards/employer-dashboard/page.tsx` | `showConfetti` |
| `app/dashboards/employer-dashboard/payroll/page.tsx` | `UploadResultBanner`, `isFailed`, `UploadStepCard`, `uploading`, `viewingRecord`, `handleFileSelect`, `handleUpload`, `uploadFailed`, `uploadPartial`, `uploadDone`, `hasWarnings` |
| `components/admin/AdminLayout.tsx` | `showNotifications`, `handleDelete`, `unreadCount` |
| `components/employer/EmployerLayout.tsx` | `avatarUrl` |
| `lib/stores/auth.ts` | — (see unused catch params) |

---

## 🔵 Priority 0 — Unused Imports & Parameters

> Purely cosmetic. Zero runtime impact. Fix in a dedicated cleanup PR or via `eslint --fix` where possible.

**Rule:** `@typescript-eslint/no-unused-vars` — imported names never referenced

<details>
<summary>Click to expand full list (~100 items)</summary>

| File | Unused Imports/Params |
|------|-----------------------|
| `app/admin/advances/page.tsx` | `Download` |
| `app/admin/billing/page.tsx` | `Legend` |
| `app/admin/fraud-detection/page.tsx` | `Employee`, `StatusBadge`, `err` (×2), `ruleId`, `alert` |
| `app/admin/notifications/page.tsx` | `err` |
| `app/admin/page.tsx` | `Wifi`, `Info`, `AlertCircle`, `CheckSquare` |
| `app/admin/reports/page.tsx` | `Link`, `TrendingUp`, `Filter`, `Eye`, `ChevronDown`, `ChevronRight`, `CheckCircle2`, `ArrowUp`, `ArrowDown`, `Minus`, `formatCurrency` |
| `app/admin/risk-scoring/page.tsx` | `User`, `Filter`, `CheckCircle2`, `Eye`, `MoreVertical`, `Download`, `formatCurrency`, `error` |
| `app/admin/settings/page.tsx` | `Tab`, `error` (×4), `_url` |
| `app/api/admin/audit-trail/admins/route.ts` | `req` |
| `app/api/admin/audit-trail/stats/route.ts` | `req` |
| `app/api/admin/billing/route.ts` | `topRevenueGenerators` |
| `app/api/admin/check-api-health/route.ts` | `_req` (×2) |
| `app/api/admin/dusupay/sync-balance/route.ts` | `req` |
| `app/api/admin/employees/[id]/kyc/route.ts` | `UserRoleEnum` |
| `app/api/admin/employers/route.ts` | `AdminEmployerStatus` |
| `app/api/admin/kyc/documents/route.ts` | `empAppsError` |
| `app/api/admin/me/route.ts` | `_req` |
| `app/api/admin/reports/[id]/download/route.ts` | `createClient`, `env` |
| `app/api/admin/reports/[id]/route.ts` | `createClient` |
| `app/api/admin/reports/route.ts` | `createClient` |
| `app/api/admin/review-requests/route.ts` | `pusherServer`, `req` |
| `app/api/admin/settings/blackouts/route.ts` | `req` |
| `app/api/admin/settings/employees/route.ts` | `req` |
| `app/api/admin/settings/employers/route.ts` | `req` |
| `app/api/admin/settings/legal-documents/route.ts` | `req` |
| `app/api/admin/settings/notifications/route.ts` | `req` |
| `app/api/admin/settings/platform/route.ts` | `req` |
| `app/api/admin/settings/risk/route.ts` | `req` |
| `app/api/advances/[id]/route.ts` | `error` |
| `app/api/auth/activity-logs/route.ts` | `req` |
| `app/api/auth/register/route.ts` | `employerRecord` |
| `app/api/auth/verify-email/route.ts` | `render`, `resend`, `FROM_EMAIL`, `BASE_URL`, `TOKEN_TTL_MS`, `ResendSchema`, `verifyRecaptcha` |
| `app/api/employee-dashboard/employment/route.ts` | `req`, `policyError` |
| `app/api/employee-dashboard/kyc/documents/route.ts` | `profile` |
| `app/api/employee-dashboard/payment-methods/route.ts` | `req` |
| `app/api/employee-dashboard/security/mfa/route.ts` | `data` |
| `app/api/employee-dashboard/support/route.ts` | `req`, `error` |
| `app/api/employer-dashboard/announcements/route.ts` | `req` |
| `app/api/employer-dashboard/employees/bulk-upload/route.ts` | `duplicateError` |
| `app/api/employer-dashboard/notifications/route.ts` | `req`, `err` (×2) |
| `app/api/employer-dashboard/payroll/upload/route.ts` | `PayrollRow` |
| `app/api/employer-dashboard/reports/route.ts` | `EmployeeRow`, `AdvanceRow`, `PrevAdvanceRow`, `TrendRow` |
| `app/api/employer-dashboard/seed/demo-employees/route.ts` | `COUNTRIES` |
| `app/api/employer-dashboard/settings/documents/route.ts` | `uploadData` |
| `app/api/employer-dashboard/termination/feedback/route.ts` | — |
| `app/api/employer-dashboard/termination/restore/route.ts` | `req` |
| `app/api/employer-dashboard/termination/terminate/route.ts` | `req` |
| `app/api/employer-dashboard/wallet/route.ts` | `req` |
| `app/api/employers/public/approved/route.ts` | `EmployerRow` |
| `app/api/insights/route.ts` | `request`, `empMap` |
| `app/api/integrations/route.ts` | `_request` |
| `app/api/messages/route.ts` | `err` |
| `app/api/v1/payouts/verify/route.ts` | `dusupayWebhook` |
| `app/api/v1/payouts/webhook/route.ts` | `WebhookPayload`, `signature`, `advanceError` |
| `app/contact/page.tsx` | `Alert`, `AlertDescription`, `AlertTitle`, `FloatingOrb`, `error` |
| `app/dashboards/employee-dashboard/employment/page.tsx` | `User`, `MapPin`, `formatDateTime` |
| `app/dashboards/employee-dashboard/kyc/page.tsx` | `MilestoneConfetti`, `error` (×2) |
| `app/dashboards/employee-dashboard/notifications/page.tsx` | `error`, `err` |
| `app/dashboards/employee-dashboard/onboarding/page.tsx` | `EMPLOYMENT_TYPES`, `err` |
| `app/dashboards/employee-dashboard/page.tsx` | `Clock`, `MilestoneConfetti` |
| `app/dashboards/employee-dashboard/payment-methods/page.tsx` | `CheckCircle2`, `ChevronRight`, `err` (×3) |
| `app/dashboards/employee-dashboard/settings/page.tsx` | `updateUserAvatar`, `BACKEND_URL`, `error` (×5) |
| `app/dashboards/employee-dashboard/support/page.tsx` | `Plus`, `Search`, `CheckCircle2`, `Clock`, `AlertCircle`, `err` (×2) |
| `app/dashboards/employee-dashboard/transactions/page.tsx` | `Download`, `MilestoneConfetti` |
| `app/dashboards/employer-dashboard/employees/page.tsx` | `Download`, `handleExportCSV` |
| `app/dashboards/employer-dashboard/messages/page.tsx` | `CheckCircle2`, `cn` |
| `app/dashboards/employer-dashboard/notifications/page.tsx` | `error`, `err` |
| `app/dashboards/employer-dashboard/page.tsx` | `RefreshCw`, `MilestoneConfetti`, `err` |
| `app/dashboards/employer-dashboard/payroll/page.tsx` | `Upload`, `Clock`, `err` |
| `app/dashboards/employer-dashboard/reports/page.tsx` | `bankTransferCount` |
| `app/dashboards/employer-dashboard/settings/page.tsx` | `err` |
| `app/dashboards/employer-dashboard/terminated/page.tsx` | `MessageSquare`, `Send`, `ArrowRight`, `LogOut`, `err` (×2) |
| `app/dashboards/employer-dashboard/wallet/page.tsx` | `Building2` |
| `app/forgot-password/page.tsx` | `router` |
| `app/reset-password/page.tsx` | `useRef` |
| `components/admin/AdminLayout.tsx` | `Sparkles`, `data` |
| `components/employee/DeleteAccountModal.tsx` | `User` |
| `components/employee/EmployeeLayout.tsx` | `useRef`, `Bell`, `CheckCircle2`, `Image`, `Notification`, `getPageTitle`, `data` |
| `components/employer/EmployerLayout.tsx` | `Building2`, `useRef`, `useCallback`, `EmployerNotification`, `data` |
| `components/layout/ChatWindow.tsx` | `err` (×2) |
| `components/layout/DashboardLayout.tsx` | `roleLabel` |
| `components/layout/NotificationDropdown.tsx` | `CheckCircle2`, `X`, `useAuthStore`, `userId` |
| `components/ui/button.tsx` | `_asChild` |
| `components/ui/separator.tsx` | `_decorative` |
| `hooks/useCurrency.ts` | `err` |
| `lib/services/payout-service.ts` | `formatPhoneNumber` |
| `lib/stores/auth.ts` | `e` (×2) |

</details>

---

## Recommended Fix Order (Sprint Plan)

| Sprint | Priority | Focus | Est. Effort |
|--------|----------|-------|-------------|
| 1 | 10 | Fix all `setState-in-effect` — layout & Confetti files | Medium |
| 1 | 9 | Fix render-phase impurity & ref-during-render | Small |
| 2 | 8 | Replace `any` in all API routes & lib files | Large |
| 2 | 7 | Replace `any` in UI components & pages | Medium |
| 3 | 6 | Add missing `useEffect` dependencies | Medium |
| 3 | 5 | Fix `prefer-const` (2 files, trivial) | Trivial |
| 3 | 4 | Fix unescaped JSX entities | Small |
| 4 | 3 | Add `alt` to `<img>` in `avatar.tsx` | Trivial |
| 4 | 2 | Migrate `<img>` → `<Image />` (3 files) | Small |
| 5 | 1 | Remove dead assigned-but-unused state/variables | Medium |
| 5 | 0 | Remove unused imports across all files | Large (but safe to automate) |

> **Tip:** Priority 0 unused imports can be bulk-fixed by running `eslint --fix` — it will auto-remove them where safe.