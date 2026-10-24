import { requireUser } from '@/lib/auth';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  requireUser(['admin']);
  return <>{children}</>;
}
