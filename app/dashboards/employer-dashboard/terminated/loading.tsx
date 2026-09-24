import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="max-w-xl w-full bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative z-10 p-8 md:p-12 space-y-8">
        {/* Center Header */}
        <div className="text-center space-y-4">
          <Skeleton className="w-20 h-20 rounded-3xl mx-auto mb-6" />
          <Skeleton className="h-8 w-72 mx-auto rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-96 mx-auto rounded-md" />
            <Skeleton className="h-4 w-64 mx-auto rounded-md" />
          </div>
        </div>

        {/* Survey Box Skeleton */}
        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-4">
          <Skeleton className="h-3 w-28 rounded-md" />

          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-3 w-48 rounded-md" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>

            <div className="space-y-2">
              <Skeleton className="h-3 w-52 rounded-md" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}