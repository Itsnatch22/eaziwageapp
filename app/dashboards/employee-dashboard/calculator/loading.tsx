import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-56 rounded-md" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
      </div>

      {/* Amount input card */}
      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-3xl border border-slate-200/50 dark:border-slate-700/30 p-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-28 rounded-md" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-12 rounded-md" />
            <Skeleton className="h-10 w-44 rounded-md" />
          </div>
        </div>

        {/* Slider & limits */}
        <div className="space-y-2.5">
          <Skeleton className="w-full h-2 rounded-full" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-20 rounded-md" />
            <Skeleton className="h-3 w-20 rounded-md" />
          </div>
        </div>
      </div>

      {/* Breakdown card */}
      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-3xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 space-y-4">
          <Skeleton className="h-3 w-36 rounded-md" />
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-4 w-20 rounded-md" />
            </div>
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-36 rounded-md" />
              <Skeleton className="h-4 w-16 rounded-md" />
            </div>
            <div className="border-t border-dashed border-slate-200 dark:border-slate-700 pt-3 flex justify-between items-center">
              <Skeleton className="h-5 w-28 rounded-md" />
              <Skeleton className="h-6 w-24 rounded-md" />
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Repayment */}
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <div className="flex items-center gap-3">
              <Skeleton className="w-4 h-4 rounded-md" />
              <div className="space-y-1">
                <Skeleton className="h-3 w-40 rounded-md" />
                <Skeleton className="h-4 w-28 rounded-md" />
              </div>
            </div>
            <Skeleton className="h-3 w-16 rounded-md" />
          </div>

          {/* Remaining limit */}
          <div className="p-3 rounded-xl border border-slate-200/50 dark:border-slate-700/30 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="w-4 h-4 rounded-md" />
                <Skeleton className="h-3 w-48 rounded-md" />
              </div>
              <Skeleton className="h-4 w-20 rounded-md" />
            </div>
            <Skeleton className="w-full h-1.5 rounded-full" />
            <Skeleton className="h-3 w-36 rounded-md" />
          </div>

          {/* Monthly advances counter */}
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <div className="flex items-center gap-2">
              <Skeleton className="w-4 h-4 rounded-md" />
              <Skeleton className="h-3 w-44 rounded-md" />
            </div>
            <Skeleton className="h-4 w-16 rounded-md" />
          </div>
        </div>
      </div>

      {/* Action CTA */}
      <Skeleton className="w-full h-14 rounded-2xl" />

      {/* Confirmation text */}
      <div className="flex items-center justify-center gap-2">
        <Skeleton className="w-3.5 h-3.5 rounded-full" />
        <Skeleton className="h-3 w-64 rounded-md" />
      </div>
    </div>
  );
}
