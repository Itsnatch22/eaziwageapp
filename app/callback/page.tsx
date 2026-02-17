import { redirect } from 'next/navigation';

type SearchParams = Record<string, string | string[] | undefined>;

type CallbackPageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function CallbackPage({ searchParams }: CallbackPageProps) {
  const params = await searchParams;
  const qs = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((v) => {
        if (v !== undefined) qs.append(key, v);
      });
      return;
    }
    if (value !== undefined) qs.set(key, value);
  });

  const query = qs.toString();
  redirect(`/api/auth/google/callback${query ? `?${query}` : ''}`);
}
