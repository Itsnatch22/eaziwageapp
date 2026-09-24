import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-9 w-60 rounded-md" />
          <Skeleton className="h-4 w-96 rounded-md max-w-full" />
        </div>

        <div className="flex bg-white/50 dark:bg-slate-900/50 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-700/30">
          <div className="px-4 py-2 space-y-1 text-center flex flex-col items-center">
            <Skeleton className="h-2.5 w-12 rounded-md" />
            <Skeleton className="h-4 w-16 rounded-md" />
          </div>
          <div className="w-px bg-slate-200 dark:bg-slate-700 mx-2" />
          <div className="px-4 py-2 space-y-1 text-center flex flex-col items-center">
            <Skeleton className="h-2.5 w-16 rounded-md" />
            <Skeleton className="h-4 w-8 rounded-md" />
          </div>
        </div>
      </div>

      {/* Main 12-col grid */}
      <div className="grid lg:grid-cols-12 gap-8">
        {/* Left: Upload Center & Guidelines */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-32 rounded-md" />
                <Skeleton className="h-3 w-40 rounded-md" />
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <Skeleton className="h-3 w-28 rounded-md" />
                <Skeleton className="w-full h-12 rounded-xl" />
              </div>

              <div className="space-y-2">
                <Skeleton className="h-3 w-44 rounded-md" />
                <Skeleton className="w-full h-12 rounded-xl" />
              </div>

              <div className="space-y-2">
                <Skeleton className="h-3 w-24 rounded-md" />
                <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-8 flex flex-col items-center justify-center space-y-2">
                  <Skeleton className="w-10 h-10 rounded-xl mb-1" />
                  <Skeleton className="h-4 w-24 rounded-md" />
                  <Skeleton className="h-3 w-36 rounded-md" />
                </div>
              </div>

              <Skeleton className="w-full h-14 rounded-2xl" />
            </div>
          </div>

          {/* Guidelines */}
          <div className="p-6 bg-slate-900 dark:bg-slate-800 rounded-3xl space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded-lg" />
              <Skeleton className="h-4 w-24 rounded-md" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Skeleton className="w-2 h-2 rounded-full" />
                  <Skeleton className="h-3.5 w-5/6 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Document Vault & Category summary cards */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <Skeleton className="h-5 w-44 rounded-md" />
              </div>
              <Skeleton className="w-8 h-8 rounded-lg" />
            </div>

            <div className="p-6 space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-white/40 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-700/50 gap-4"
                >
                  <div className="flex items-center gap-4">
                    <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-36 rounded-md" />
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-3 w-20 rounded-md" />
                        <Skeleton className="h-3 w-16 rounded-md" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="w-8 h-8 rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4 category cards */}
          <div className="grid sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="p-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <Skeleton className="h-4 w-14 rounded-full" />
                </div>
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="h-3 w-40 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
