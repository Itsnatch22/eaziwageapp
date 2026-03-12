import { AdminPortalLayout } from '@/components/admin/AdminLayout';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminPortalLayout>{children}</AdminPortalLayout>;
}
