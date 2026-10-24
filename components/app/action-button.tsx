'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/client';

type Props = {
  endpoint: string;
  method?: string;
  body?: Record<string, unknown>;
  label: React.ReactNode;
  success?: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
  /** Show a confirmation dialog first. */
  confirm?: { title: string; description?: string; confirmLabel?: string; reason?: { label: string; required?: boolean; field?: string }; number?: { label: string; field: string; defaultValue?: number; max?: number }; destructive?: boolean };
  redirectTo?: string;
};

export function ActionButton({ endpoint, method = 'POST', body = {}, label, success, variant, size = 'sm', className, confirm, redirectTo }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [num, setNum] = useState<string>(confirm?.number?.defaultValue != null ? String(confirm.number.defaultValue) : '');
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setErr(null);
    let payload: Record<string, unknown> = confirm?.reason ? { ...body, [confirm.reason.field ?? 'reason']: reason } : { ...body };
    if (confirm?.number) payload = { ...payload, [confirm.number.field]: num === '' ? undefined : Number(num) };
    const { error } = await apiFetch(endpoint, { method, body: payload });
    setLoading(false);
    if (error) {
      const fieldMsg = error.fields ? Object.values(error.fields)[0] : null;
      if (open) setErr(fieldMsg ?? error.message);
      else toast({ title: 'Action failed', description: fieldMsg ?? error.message, variant: 'destructive' });
      return;
    }
    setOpen(false);
    setReason('');
    if (success) toast({ title: success });
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  if (!confirm)
    return (
      <Button variant={variant} size={size} className={className} disabled={loading} onClick={run}>
        {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
        {label}
      </Button>
    );

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setErr(null); }}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>{label}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{confirm.title}</DialogTitle>
          {confirm.description && <DialogDescription>{confirm.description}</DialogDescription>}
        </DialogHeader>
        {confirm.number && (
          <div className="space-y-1.5">
            <Label htmlFor="action-number">{confirm.number.label}</Label>
            <Input id="action-number" type="number" min={0} max={confirm.number.max} step="0.1" value={num} onChange={(e) => setNum(e.target.value)} />
          </div>
        )}
        {confirm.reason && (
          <div className="space-y-1.5">
            <Label htmlFor="action-reason">{confirm.reason.label}{confirm.reason.required && <span className="text-destructive"> *</span>}</Label>
            <Textarea id="action-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        )}
        {err && <p role="alert" className="text-sm font-medium text-destructive">{err}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Back</Button>
          <Button variant={confirm.destructive ? 'destructive' : 'default'} disabled={loading || (!!confirm.reason?.required && !reason.trim())} onClick={run}>
            {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {confirm.confirmLabel ?? 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
