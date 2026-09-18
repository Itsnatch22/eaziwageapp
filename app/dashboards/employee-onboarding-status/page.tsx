import Link from "next/link";

export default function EmployeeOnboardingStatusPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12 dark:bg-slate-950">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-white/5">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          Your onboarding is still under review
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
          We are reviewing your employee details and documents. Your dashboard
          will become available once your onboarding has been approved.
        </p>
        <Link
          href="/dashboards/employee-dashboard/onboarding"
          className="mt-6 inline-flex rounded-xl bg-emerald-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-600"
        >
          View onboarding
        </Link>
      </section>
    </main>
  );
}
