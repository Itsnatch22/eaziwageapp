import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto space-y-10">
      {/* Header */}
      <div className="space-y-3">
        <Skeleton className="h-3 w-44 rounded-md mb-6" />
        <Skeleton className="h-8 w-80 rounded-md" />
        <div className="space-y-1 max-w-2xl">
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-3/4 rounded-md" />
        </div>
      </div>

      {/* Resource Categories */}
      {Array.from({ length: 3 }).map((_, catIndex) => (
        <div key={catIndex} className="space-y-4">
          <Skeleton className="h-3 w-36 rounded-md px-1" />
          <div className="grid sm:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, cardIndex) => (
              <div
                key={cardIndex}
                className="bg-white/50 dark:bg-white/3 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-white/10 p-5 flex items-start gap-4"
              >
                <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-40 rounded-md" />
                  <Skeleton className="h-3 w-full rounded-md" />
                  <Skeleton className="h-3 w-4/5 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
