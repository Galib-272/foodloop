import Link from 'next/link';
import { Card, PageHeader } from '@/components/app/ui';
import { requireUser } from '@/lib/auth';
import { FAQS } from '@/components/landing/sections';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Help & Support — FoodSphere AI' };

const GUIDES: Record<string, string[]> = {
  donor: ['Import history on CSV Data Import (download the template first).', 'Run AI Surplus Forecast, then use Create Donation to prefill a donation. Always confirm the real quantity.', 'Review Recipient Matches and accept a request or send an offer.', 'Schedule pickup, hand over the food, and the recipient confirms receipt.'],
  recipient: ['Make sure your accepted categories, storage and capacity are correct in Organization Profile.', 'Browse Available Donations or Recommended Matches and request what you can use.', 'When accepted, schedule a pickup (optionally ask for a volunteer).', 'After collecting, confirm the quantity received — this is what counts as food rescued.'],
  volunteer: ['Open Available Tasks and accept one you can complete before the deadline.', 'Mark “I’m at pickup”, then confirm pickup with the quantity collected.', 'Record the delivered quantity; the recipient confirms receipt.', 'If something goes wrong, use Report failure with a reason.'],
  admin: ['Review Verification Requests and approve or reject with a reason.', 'Resolve Reported Issues and record corrections — all are audit-logged.', 'Monitor model performance and prediction failures in ML Model Monitoring.'],
};

export default function Help() {
  const user = requireUser();
  return (
    <div className="max-w-4xl">
      <PageHeader title="Help & Support" />
      <Card className="mb-6" title="Getting started">
        <ol className="list-decimal space-y-2 pl-5 text-sm">{GUIDES[user.role].map((g) => <li key={g}>{g}</li>)}</ol>
      </Card>
      <Card className="mb-6" title="Frequently asked questions" bodyClassName="px-5 py-1">
        <Accordion type="single" collapsible>
          {FAQS.map(([q, a], i) => (
            <AccordionItem key={q} value={`f${i}`} className={i === FAQS.length - 1 ? 'border-b-0' : ''}>
              <AccordionTrigger className="text-left">{q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>
      <Card title="Contact support">
        <p className="text-sm text-muted-foreground">Include your registered email ({user.email}) and any donation ID. To report a problem with a specific donation, use “Report an issue” on its page so it reaches an administrator. See also the <Link href="/guidelines" className="font-medium text-secondary hover:underline">Food Donation Guidelines</Link>.</p>
      </Card>
    </div>
  );
}
