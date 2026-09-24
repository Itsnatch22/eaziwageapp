import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 flex flex-col">
      {/* Header with centered logo */}
      <header className="w-full px-6 py-8 flex justify-center items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-2xl" />
        <Skeleton className="h-7 w-28 rounded-md" />
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 pb-24">
        {/* Step Indicator */}
        <div className="flex items-center justify-between max-w-xl mx-auto mb-12 px-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="flex items-center flex-1 last:flex-none">
              <Skeleton className="w-8 h-8 rounded-full shrink-0" />
              {index < 7 && <Skeleton className="h-1 w-full mx-2 rounded-full" />}
            </div>
          ))}
        </div>

        {/* Big Card */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl rounded-[2.5rem] p-8 md:p-12 border border-white/40 dark:border-slate-800 shadow-2xl space-y-8">
          <div className="text-center py-4 flex flex-col items-center">
            <Skeleton className="w-20 h-20 rounded-3xl mx-auto mb-8" />
            <Skeleton className="h-8 w-80 rounded-md mb-4 max-w-full" />
            <Skeleton className="h-4 w-96 rounded-md mb-10 max-w-full" />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="flex flex-col items-center gap-2 p-4 bg-slate-50/50 dark:bg-white/2 rounded-2xl border border-slate-100 dark:border-slate-800/50"
                >
                  <Skeleton className="w-6 h-6 rounded-md" />
                  <Skeleton className="h-3 w-24 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between gap-4 max-w-md mx-auto mt-8">
          <Skeleton className="h-14 w-28 rounded-2xl" />
          <Skeleton className="flex-1 h-14 rounded-2xl" />
        </div>
      </main>
    </div>
  );
}
