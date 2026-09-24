import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="flex justify-between"><div className="space-y-2"><Skeleton className="h-9 w-64 rounded-md" /><Skeleton className="h-4 w-96 rounded-md" /></div><div className="flex gap-3"><Skeleton className="h-10 w-32 rounded-xl" /><Skeleton className="h-10 w-36 rounded-xl" /></div></div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="rounded-2xl border p-6 space-y-4"><div className="flex gap-4"><Skeleton className="h-12 w-12 rounded-xl" /><div className="space-y-2"><Skeleton className="h-4 w-28 rounded-md" /><Skeleton className="h-7 w-32 rounded-md" /></div></div><Skeleton className="h-3 w-48 rounded-md" /></div>)}</div>
      <div className="grid lg:grid-cols-2 gap-8">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="rounded-2xl border p-6 space-y-6"><Skeleton className="h-6 w-40 rounded-md" /><Skeleton className="h-72 w-full rounded-xl" /></div>)}</div>
      <div className="grid lg:grid-cols-2 gap-8">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="rounded-2xl border p-6 space-y-4"><Skeleton className="h-6 w-52 rounded-md" />{Array.from({ length: 5 }).map((_, j) => <Skeleton key={j} className="h-12 w-full rounded-lg" />)}</div>)}</div>
    </div>
  );
}
