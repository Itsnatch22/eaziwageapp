import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="flex justify-between"><div className="space-y-2"><Skeleton className="h-8 w-72 rounded-md" /><Skeleton className="h-4 w-80 rounded-md" /></div><Skeleton className="h-10 w-28 rounded-xl" /></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="rounded-2xl border p-5 space-y-3"><Skeleton className="h-12 w-12 rounded-xl" /><Skeleton className="h-8 w-16 rounded-md" /><Skeleton className="h-4 w-28 rounded-md" /></div>)}</div>
      <div className="flex gap-4"><Skeleton className="h-10 flex-1 rounded-lg" /><Skeleton className="h-10 w-32 rounded-lg" /></div>
      <div className="grid md:grid-cols-2 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="rounded-2xl border p-5 space-y-4"><div className="flex gap-3"><Skeleton className="h-12 w-12 rounded-xl" /><div className="space-y-2"><Skeleton className="h-5 w-40 rounded-md" /><Skeleton className="h-4 w-28 rounded-md" /></div></div><Skeleton className="h-16 w-full rounded-xl" /><div className="flex gap-2"><Skeleton className="h-9 flex-1 rounded-md" /><Skeleton className="h-9 flex-1 rounded-md" /></div></div>)}</div>
    </div>
  );
}
