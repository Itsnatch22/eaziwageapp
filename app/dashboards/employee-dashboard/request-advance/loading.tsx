import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="bg-white/50 dark:bg-white/4 backdrop-blur-xl rounded-2xl p-5 border border-white/60 dark:border-white/10 space-y-3"
          >
            <Skeleton className="w-9 h-9 rounded-xl" />
            <Skeleton className="h-7 w-28 rounded-md" />
            <Skeleton className="h-3 w-24 rounded-md" />
            <Skeleton className="h-3 w-20 rounded-md" />
          </div>
        ))}
      </div>

      {/* Main 5-col grid */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Left: Circular amount selector & controls */}
        <div className="lg:col-span-3">
          <div className="bg-white/50 dark:bg-white/3 backdrop-blur-xl rounded-3xl border border-white/60 dark:border-white/10 p-8 space-y-8">
            <div className="w-56 h-56 rounded-full mx-auto relative flex flex-col items-center justify-center p-4">
              <Skeleton className="w-56 h-56 rounded-full absolute inset-0" />
              <div className="relative z-10 flex flex-col items-center space-y-2">
                <Skeleton className="h-3 w-20 rounded-md" />
                <Skeleton className="h-8 w-32 rounded-md" />
                <Skeleton className="h-3 w-28 rounded-md" />
              </div>
            </div>

            <div className="space-y-5">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-3 w-24 rounded-md" />
                  <Skeleton className="h-5 w-24 rounded-md" />
                </div>
                <Skeleton className="w-full h-1.5 rounded-full" />
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-8 rounded-md" />
                  <Skeleton className="h-3 w-16 rounded-md" />
                </div>
              </div>

              {/* Quick amount pills */}
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-9 rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Summary & Destination */}
        <div className="lg:col-span-2 space-y-4">
          {/* Payout Summary */}
          <div className="bg-white/50 dark:bg-white/3 backdrop-blur-xl rounded-3xl border border-white/60 dark:border-white/10 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Skeleton className="w-4 h-4 rounded-md" />
              <Skeleton className="h-3 w-28 rounded-md" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-white/3">
                <Skeleton className="h-3 w-16 rounded-md" />
                <Skeleton className="h-4 w-20 rounded-md" />
              </div>
              <div className="flex justify-between items-center py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-white/3">
                <Skeleton className="h-3 w-16 rounded-md" />
                <Skeleton className="h-4 w-16 rounded-md" />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-white/10 flex justify-between items-center">
              <Skeleton className="h-3 w-24 rounded-md" />
              <Skeleton className="h-8 w-28 rounded-md" />
            </div>
          </div>

          {/* Destination */}
          <div className="bg-white/50 dark:bg-white/3 backdrop-blur-xl rounded-3xl border border-white/60 dark:border-white/10 p-6 space-y-3">
            <Skeleton className="h-3 w-24 rounded-md" />
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-white/3">
              <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="h-3 w-36 rounded-md" />
              </div>
            </div>
          </div>

          {/* Submit CTA */}
          <Skeleton className="w-full h-14 rounded-2xl" />

          {/* Security note */}
          <div className="flex items-center justify-center gap-1.5">
            <Skeleton className="w-3.5 h-3.5 rounded-full" />
            <Skeleton className="h-3 w-48 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
