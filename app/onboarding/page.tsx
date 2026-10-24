import { redirect } from 'next/navigation';
import { Logo } from '@/components/site/logo';
import { OrgForm, emptyOrg } from '@/components/org/org-form';
import { requireUser } from '@/lib/auth';
import { getOrgByUser } from '@/lib/orgs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Set up your profile — FoodSphere AI' };

export default function OnboardingPage() {
  const user = requireUser();
  if (user.role !== 'donor' && user.role !== 'recipient') redirect('/app');
  if (getOrgByUser(user.id)) redirect('/app');
  const kind = user.role;
  return (
    <div className="min-h-screen bg-grain">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-4"><Logo /></div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm font-semibold uppercase tracking-wider text-secondary">Step 2 of 2</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          {kind === 'donor' ? 'Tell us about your business' : 'Tell us about your organization'}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Hi {user.full_name.split(' ')[0]}, this information is used for matching and verification.
        </p>
        <div className="mt-8 rounded-2xl border bg-card p-6 sm:p-8">
          <OrgForm kind={kind} mode="create" redirectTo="/app"
            initial={{ ...emptyOrg, contact_person: user.full_name, phone: user.phone ?? '' }} />
        </div>
      </main>
    </div>
  );
}
