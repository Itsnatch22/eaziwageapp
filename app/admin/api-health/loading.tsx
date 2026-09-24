import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="flex justify-between"><div className="space-y-2"><Skeleton className="h-8 w-64 rounded-md" /><Skeleton className="h-4 w-80 rounded-md" /></div><Skeleton className="h-10 w-28 rounded-xl" /></div>
      <div className="rounded-2xl border p-6 grid lg:grid-cols-[1.4fr_1fr] gap-6"><div className="flex gap-4 items-center"><Skeleton className="h-14 w-14 rounded-xl" /><div className="space-y-2"><Skeleton className="h-6 w-56 rounded-md" /><Skeleton className="h-4 w-64 rounded-md" /></div></div><div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="p-4 border rounded-xl space-y-2"><Skeleton className="h-3 w-20 rounded-md" /><Skeleton className="h-7 w-16 rounded-md" /></div>)}</div></div>
      <div className="grid md:grid-cols-2 gap-6">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="rounded-2xl border overflow-hidden p-5 space-y-5"><div className="flex justify-between"><div className="flex gap-3"><Skeleton className="h-12 w-12 rounded-xl" /><div className="space-y-2"><Skeleton className="h-5 w-32 rounded-md" /><Skeleton className="h-4 w-24 rounded-md" /></div></div><Skeleton className="h-7 w-24 rounded-full" /></div><Skeleton className="h-20 w-full rounded-xl" /><Skeleton className="h-4 w-full rounded-md" /></div>)}</div>
    </div>
  );
}
