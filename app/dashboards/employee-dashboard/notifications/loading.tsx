import { ListSkeleton } from '@/components/shared/Skeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="rounded-3xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
        <ListSkeleton rows={6} />
      </div>
    </div>
  );
}
