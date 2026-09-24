import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2"><Skeleton className="h-9 w-64 rounded-md" /><Skeleton className="h-4 w-80 rounded-md" /></div>
      <Skeleton className="h-11 w-full rounded-xl" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="rounded-2xl border p-5 space-y-3"><Skeleton className="h-7 w-16 rounded-md" /><Skeleton className="h-4 w-28 rounded-md" /></div>)}</div>
      <div className="grid lg:grid-cols-[1fr_280px] gap-6"><div className="grid md:grid-cols-2 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="rounded-2xl border p-5 space-y-3"><Skeleton className="h-10 w-10 rounded-xl" /><Skeleton className="h-5 w-44 rounded-md" /><Skeleton className="h-4 w-full rounded-md" /><Skeleton className="h-4 w-2/3 rounded-md" /></div>)}</div><div className="rounded-2xl border p-5 space-y-4"><Skeleton className="h-6 w-32 rounded-md" />{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div></div>
    </div>
  );
}
