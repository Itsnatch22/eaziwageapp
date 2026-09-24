import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8"><div className="space-y-2"><Skeleton className="h-4 w-28 rounded-md" /><Skeleton className="h-8 w-48 rounded-md" /><Skeleton className="h-4 w-80 rounded-md" /></div><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="rounded-2xl border p-5 space-y-3"><Skeleton className="h-9 w-9 rounded-xl" /><Skeleton className="h-7 w-20 rounded-md" /><Skeleton className="h-3 w-32 rounded-md" /></div>)}</div><div className="flex gap-3"><Skeleton className="h-10 flex-1 rounded-lg" /><Skeleton className="h-10 w-36 rounded-lg" /><Skeleton className="h-10 w-36 rounded-lg" /></div><div className="rounded-2xl border p-4 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div></div>;
}
