import Link from 'next/link';
import { Card, PageHeader } from '@/components/app/ui';
import { SettingsForm } from './settings-client';
import { getSetting } from '@/lib/db';
import { CSV_MAX_BYTES, FOOD_CATEGORIES, UNITS } from '@/lib/constants';
import { WEIGHTS, KG_EQUIVALENT } from '@/lib/matching';
import { ActionButton } from '@/components/app/action-button';
import { automationConfigured } from '@/lib/automation';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Platform Settings — FoodSphere AI' };

export default function AdminSettings() {
  const kb = Math.round(Number(getSetting('csv_max_bytes', String(CSV_MAX_BYTES))) / 1024);
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Platform Settings" description="Changes are recorded in the audit log." />
      <Card title="General"><SettingsForm csvMaxKb={kb} demoMode={getSetting('demo_mode', '0') === '1'} /></Card>
      <Card title="Food categories & units" description="Used for validation, matching and analytics. Changing them requires a code change and data migration.">
        <div className="flex flex-wrap gap-2">{FOOD_CATEGORIES.map((c) => <span key={c} className="rounded-full bg-muted px-3 py-1 text-sm">{c}</span>)}</div>
        <p className="mt-3 text-sm text-muted-foreground">Units: {UNITS.join(', ')}. Capacity checks use an explicit kg-equivalent rule: {Object.entries(KG_EQUIVALENT).map(([u, f]) => `1 ${u} = ${f} kg-eq`).join(', ')}.</p>
      </Card>
      <Card title="Matching weights" description="Transparent weighted scoring used after eligibility rules.">
        <ul className="grid gap-2 text-sm sm:grid-cols-4">{Object.entries(WEIGHTS).map(([k, w]) => <li key={k} className="rounded-lg border p-3"><span className="block text-xs capitalize text-muted-foreground">{k}</span><span className="text-lg font-semibold">{Math.round(w * 100)}%</span></li>)}</ul>
      </Card>
      <Card title="Workflow automation (n8n)" description="Urgent events (deadline approaching, expired donation, failed collection) are sent to an n8n workflow, which notifies all administrators."
        action={automationConfigured() ? <ActionButton endpoint="/api/admin/automation/test" label="Send test event" success="Test event sent. Watch for an [n8n] notification." variant="outline" /> : undefined}>
        <p className="text-sm text-muted-foreground">
          {automationConfigured()
            ? <>Connected to <code>{process.env.N8N_WEBHOOK_URL}</code>. Events: donation created, deadline approaching, expired, collection failed, delivered.</>
            : <>Not configured. Set <code>N8N_WEBHOOK_URL</code> and <code>N8N_SHARED_SECRET</code>, then import <code>automation/n8n/foodsphere-alerts.workflow.json</code> into n8n.</>}
        </p>
      </Card>
      <Card title="Content">
        <p className="text-sm text-muted-foreground">FAQs and the <Link href="/guidelines" className="font-medium text-secondary hover:underline">Food Donation Guidelines</Link> are maintained in <code>components/landing/sections.tsx</code> and <code>app/guidelines/page.tsx</code>.</p>
      </Card>
    </div>
  );
}
