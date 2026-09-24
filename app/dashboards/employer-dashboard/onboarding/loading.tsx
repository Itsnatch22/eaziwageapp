import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors duration-500 relative overflow-hidden flex flex-col">
      {/* Header with centered logo */}
      <header className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex justify-center">
        <div className="flex items-center gap-3">
          <Skeleton className="w-11 h-11 rounded-xl" />
          <Skeleton className="h-7 w-28 rounded-md" />
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 max-w-2xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {/* Step Indicator */}
        <div className="mb-8 overflow-x-auto pb-2">
          <div className="flex items-center justify-between min-w-max px-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="flex items-center">
                <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                {index < 7 && (
                  <Skeleton className="h-1 mx-1 sm:mx-2 rounded-full w-5" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step subtitle text */}
        <Skeleton className="h-4 w-48 mx-auto rounded-md mb-6" />

        {/* Glass Card */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-slate-200/50 dark:border-slate-800 shadow-xl mb-8 space-y-6">
          <div className="text-center py-6 flex flex-col items-center">
            <Skeleton className="w-20 h-20 rounded-2xl mx-auto mb-6" />
            <Skeleton className="h-8 w-80 rounded-md mb-4 max-w-full" />
            <Skeleton className="h-4 w-96 rounded-md mb-8 max-w-full" />

            {/* Benefit items */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md w-full mx-auto mb-8">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-3 bg-slate-50/50 dark:bg-white/2 rounded-xl border border-slate-100 dark:border-slate-800/40"
                >
                  <Skeleton className="w-5 h-5 rounded-md" />
                  <Skeleton className="h-4 w-28 rounded-md" />
                </div>
              ))}
            </div>

            {/* Note box */}
            <div className="p-4 bg-amber-50/60 dark:bg-amber-900/20 rounded-xl border border-amber-200/60 dark:border-amber-800/30 max-w-md w-full mx-auto flex gap-3 text-left">
              <Skeleton className="w-5 h-5 rounded-full shrink-0 mt-0.5" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3 w-full rounded-md" />
                <Skeleton className="h-3 w-4/5 rounded-md" />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex justify-between gap-4">
          <Skeleton className="h-14 px-6 w-28 rounded-2xl" />
          <Skeleton className="h-14 px-8 w-36 rounded-2xl" />
        </div>
      </main>
    </div>
  );
}
