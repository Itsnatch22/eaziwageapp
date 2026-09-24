import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52 rounded-md" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-200/50 dark:border-slate-700/30 bg-white/60 dark:bg-slate-900/60 p-5">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <Skeleton className="mt-4 h-8 w-24 rounded-md" />
            <Skeleton className="mt-2 h-4 w-32 rounded-md" />
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/50 dark:border-slate-700/30 p-6 space-y-4">
          <Skeleton className="h-6 w-48 rounded-md" />
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
        </div>
        <div className="rounded-2xl border border-slate-200/50 dark:border-slate-700/30 p-6 space-y-4">
          <Skeleton className="h-6 w-40 rounded-md" />
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      </div>
    </div>
  );
}
