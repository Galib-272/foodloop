'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Field, FormAlert } from '@/components/forms/field';
import { apiFetch } from '@/lib/client';
import { useToast } from '@/hooks/use-toast';

export function SettingsForm({ csvMaxKb, demoMode }: { csvMaxKb: number; demoMode: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [kb, setKb] = useState(String(csvMaxKb));
  const [demo, setDemo] = useState(demoMode);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await apiFetch('/api/admin/settings', { method: 'PATCH', body: { csv_max_kb: Number(kb), demo_mode: demo } });
    setLoading(false);
    if (error) return setErr(error.fields?.csv_max_kb ?? error.message);
    setErr(null);
    toast({ title: 'Settings saved' });
    router.refresh();
  }
  return (
    <form onSubmit={save} className="space-y-5">
      <FormAlert message={err} />
      <Field id="csv-kb" label="Maximum CSV upload size (KB)" hint="Between 50 and 10,240 KB.">
        <Input id="csv-kb" type="number" min={50} max={10240} value={kb} onChange={(e) => setKb(e.target.value)} className="max-w-xs" />
      </Field>
      <label className="flex max-w-xl items-start justify-between gap-4 text-sm">
        <span><span className="font-medium">Label public statistics as demo data</span><span className="block text-muted-foreground">Keep this on while the platform contains seeded or simulated records, so no figures are presented as real-world impact.</span></span>
        <Switch checked={demo} onCheckedChange={setDemo} aria-label="Demo data label" />
      </label>
      <Button type="submit" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save settings</Button>
    </form>
  );
}
