import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Info, Package, Phone, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, DeadlineBadge, EmptyState, Notice, PageHeader, Pill, StatusBadge, VerificationBadge } from '@/components/app/ui';
import { ActionButton } from '@/components/app/action-button';
import { ConfirmReceiptForm, ReportIssue, RequestForm, ScheduleForm } from '@/components/donations/forms';
import { MatchCard } from '@/components/donations/match-card';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getDonation, redact, sweepDeadlines, viewerFor } from '@/lib/donations';
import { donationCollection, donationHistory, donationRequests } from '@/lib/donation-queries';
import { evaluate, matchesForDonation } from '@/lib/matching';
import { getOrgByUser } from '@/lib/orgs';
import { DONATION_STATUSES, DONATION_STATUS_LABEL, STORAGE_LABEL, TASK_STATUS_LABEL, type Storage, type TaskStatus } from '@/lib/constants';
import { did, fmtDateTime, qty, relTime } from '@/lib/format';
import { Stagger, StaggerItem, StaggerList } from '@/components/motion';

export const dynamic = 'force-dynamic';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-medium">{children || '—'}</dd>
    </div>
  );
}

export default function DonationDetail({ params }: { params: { id: string } }) {
  const user = requireUser();
  sweepDeadlines();
  const raw = getDonation(Number(params.id));
  if (!raw) notFound();
  const v = viewerFor(user, raw);
  const open = raw.status === 'available' || raw.status === 'requested';
  const myReq = user.role === 'recipient'
    ? (getDb().prepare('SELECT * FROM donation_requests WHERE donation_id = ? AND recipient_id = ?').get(raw.id, user.id) ?? null)
    : null;
  if (!open && !v.isOwner && !v.acceptedRecipient && !v.assignedVolunteer && user.role !== 'admin' && !myReq) redirect('/app?denied=1');

  const d = redact(raw, v);
  const history = donationHistory(d.id);
  const requests = v.isOwner || user.role === 'admin' ? donationRequests(d.id) : [];
  const col = v.canSeeContact ? donationCollection(d.id) : null;
  const donorOrg = v.canSeeContact ? getOrgByUser(raw.donor_id) : null;
  const acceptedReq = requests.find((r) => r.status === 'accepted') ?? (myReq?.status === 'accepted' ? myReq : null);
  const recipientOrg = acceptedReq && (v.isOwner || v.assignedVolunteer || user.role === 'admin') ? getOrgByUser(Number(acceptedReq.recipient_id)) : null;
  const matches = (v.isOwner || user.role === 'admin') && open ? matchesForDonation(raw) : null;
  const pendingReqs = requests.filter((r) => r.status === 'pending');
  const active = ['available', 'requested', 'accepted', 'scheduled'].includes(d.status);

  // Recipient eligibility message (shown before requesting)
  let eligibility: string | null = null;
  if (user.role === 'recipient' && open && !myReq?.status?.match(/pending|accepted|offered/)) {
    const org = getOrgByUser(user.id);
    if (!org || org.verification_status !== 'verified') eligibility = 'Your organization must be verified before requesting donations.';
    else {
      const r = evaluate(raw, org);
      if (!r.ok) eligibility = `Not eligible: ${r.reason}.`;
    }
  }

  return (
    <>
      <Link href={user.role === 'donor' ? '/app/donations' : user.role === 'recipient' ? '/app/available' : user.role === 'admin' ? '/app/admin/donations' : '/app/tasks'}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back</Link>
      <PageHeader eyebrow={`${d.food_category} · ${did(d.id)}`} title={d.item_name}
        description={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={d.status} />{active && <DeadlineBadge iso={d.safe_until} />}<span className="text-sm">Published {relTime(d.created_at)}</span></span>}
        actions={v.isOwner && d.status === 'available' && pendingReqs.length === 0 ? <Button asChild variant="outline"><Link href={`/app/donations/new?edit=${d.id}`}>Edit</Link></Button> : undefined} />

      {d.status === 'expired' && <div className="mb-6"><Notice tone="warning" title="Expired">This donation passed its safe-use deadline and can no longer be requested or collected.</Notice></div>}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Donation details">
            <dl className="divide-y">
              <Row label="Quantity">{qty(d.quantity_available, d.unit)}</Row>
              <Row label="Category">{d.food_category}</Row>
              <Row label="Description">{d.description}</Row>
              <Row label="Prepared / produced">{fmtDateTime(d.prepared_at)}</Row>
              <Row label="Available from">{fmtDateTime(d.available_from)}</Row>
              <Row label="Safe-use deadline"><span className="flex flex-wrap items-center gap-2">{fmtDateTime(d.safe_until)}<Pill tone="green"><ShieldCheck className="h-3 w-3" />Verified by donor</Pill></span></Row>
              <Row label="Storage">{STORAGE_LABEL[d.storage_requirement as Storage]}</Row>
              <Row label="Packaging">{d.packaging}</Row>
              <Row label="Allergens">{d.allergens || 'None declared'}</Row>
              <Row label="Handling">{d.handling_instructions}</Row>
              <Row label="Notes">{d.notes}</Row>
            </dl>
          </Card>

          <Card title="Pickup & donor" description={v.canSeeContact ? undefined : 'Exact address and contact details are shared after a request is accepted.'}>
            <dl className="divide-y">
              <Row label="Donor">{v.canSeeContact ? `${raw.donor_org} (${raw.donor_name})` : raw.donor_org}</Row>
              <Row label="Verification"><VerificationBadge status={raw.donor_verification} /></Row>
              <Row label="Pickup address">{d.pickup_address}</Row>
              {v.canSeeContact && <Row label="Contact"><span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{d.contact_method}{donorOrg?.phone ? ` · ${donorOrg.phone}` : ''}</span></Row>}
              {recipientOrg && <Row label="Recipient">{recipientOrg.organization_name} · {recipientOrg.address} · {recipientOrg.phone ?? recipientOrg.contact_person}</Row>}
              {col && <Row label="Pickup time">{col.scheduled_pickup_time ? fmtDateTime(String(col.scheduled_pickup_time)) : 'Not scheduled yet'}</Row>}
              {col && Number(col.needs_volunteer) === 1 && <Row label="Volunteer">{col.volunteer_name ? `${col.volunteer_name} (${TASK_STATUS_LABEL[col.task_status as TaskStatus]})` : 'Requested — waiting for a volunteer'}</Row>}
              {col && col.quantity_delivered != null && <Row label="Delivered">{qty(Number(col.quantity_delivered), d.unit)}{col.received_as_expected === 0 ? ` — discrepancy: ${col.discrepancy}` : ''}</Row>}
              {col && col.failure_reason && <Row label="Failure reason">{String(col.failure_reason)}</Row>}
            </dl>
          </Card>

          {matches && (
            <section>
              <div className="mb-3">
                <h2 className="font-semibold">Recommended recipients</h2>
                <p className="text-sm text-muted-foreground">Safety rules first remove organizations that can’t accept, store or receive this food in time. The AI model then ranks the rest by its estimated chance of a successful delivery (trained on a labelled synthetic dataset, so treat it as an estimate). If the model is unavailable, a transparent rule score is used instead.</p>
              </div>
              {matches.matches.length === 0 ? <EmptyState title="No eligible recipients right now">Recipients are excluded if they are unverified, do not accept this category or storage type, or cannot receive before the deadline.</EmptyState> : (
                <Stagger className="grid gap-4 lg:grid-cols-2" itemClassName="h-full">
                  {matches.matches.map((m) => <MatchCard key={m.recipient_user_id} m={m} donationId={d.id} unit={d.unit} canSelect={v.isOwner} />)}
                </Stagger>
              )}
              {matches.excluded.length > 0 && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-muted-foreground">{matches.excluded.length} organization(s) excluded</summary>
                  <ul className="mt-2 space-y-1 pl-4 text-muted-foreground">{matches.excluded.map((x, i) => <li key={i}>{x.organization_name}: {x.reason}</li>)}</ul>
                </details>
              )}
            </section>
          )}

          <Card title="Status timeline">
            <StaggerList as="ol" gap={0.08} className="relative space-y-5 border-l pl-6">
              {history.map((h) => (
                <StaggerItem key={h.id} className="relative">
                  <span className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background bg-secondary" aria-hidden="true" />
                  <p className="text-sm font-semibold">{h.from_status === h.to_status ? 'Update' : DONATION_STATUS_LABEL[h.to_status as keyof typeof DONATION_STATUS_LABEL] ?? h.to_status}</p>
                  <p className="text-sm text-muted-foreground">{h.note}</p>
                  <p className="text-xs text-muted-foreground">{fmtDateTime(h.created_at)} · {h.actor_name ? `${h.actor_name} (${h.actor_role})` : 'System'}</p>
                </StaggerItem>
              ))}
            </StaggerList>
          </Card>
        </div>

        {/* Action panel */}
        <div className="space-y-6">
          {v.isOwner && (
            <>
              {(d.status === 'available' || d.status === 'requested') && (
                <Card title="Requests" description={pendingReqs.length ? 'Accepting one request declines the others.' : 'No requests yet. You can also offer it to a recommended recipient.'}>
                  {requests.length === 0 ? <p className="text-sm text-muted-foreground">Waiting for requests…</p> : (
                    <ul className="space-y-3">
                      {requests.map((r) => (
                        <li key={r.id} className="rounded-lg border p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium">{r.organization_name}</p>
                            <Pill tone={r.status === 'pending' ? 'blue' : r.status === 'offered' ? 'amber' : 'default'}>{r.status === 'offered' ? 'Offer sent' : r.status}</Pill>
                          </div>
                          <p className="text-xs text-muted-foreground">{r.organization_type} · {r.area} · {relTime(String(r.request_time))}</p>
                          {r.notes && <p className="mt-1 text-sm">“{r.notes}”</p>}
                          {r.status === 'pending' && (
                            <div className="mt-2 flex gap-2">
                              <ActionButton endpoint={`/api/donations/${d.id}/accept`} body={{ request_id: r.id }} label="Accept" success="Request accepted" />
                              <ActionButton endpoint={`/api/donations/${d.id}/reject`} body={{ request_id: r.id }} label="Reject" variant="outline"
                                confirm={{ title: 'Reject this request?', reason: { label: 'Reason (shared with the organization)' }, confirmLabel: 'Reject request' }} />
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}
              {d.status === 'accepted' && <Card title="Schedule collection"><ScheduleForm donationId={d.id} safeUntil={d.safe_until} /></Card>}
              {d.status === 'scheduled' && (
                <Card title="Collection">
                  <div className="space-y-3">
                    <ScheduleForm donationId={d.id} safeUntil={d.safe_until} current={col?.scheduled_pickup_time ? String(col.scheduled_pickup_time) : null} />
                    <div className="flex flex-wrap gap-2 border-t pt-3">
                      <ActionButton endpoint={`/api/donations/${d.id}/collected`} label="Mark as collected" variant="secondary" success="Marked as collected"
                        confirm={{ title: 'Confirm pickup', number: { label: `Quantity handed over (${d.unit})`, field: 'quantity', defaultValue: d.quantity_available, max: d.quantity_available }, confirmLabel: 'Confirm' }} />
                      <ActionButton endpoint={`/api/donations/${d.id}/failed`} label="Collection failed" variant="ghost"
                        confirm={{ title: 'Record a failed collection', reason: { label: 'What happened?', required: true }, destructive: true, confirmLabel: 'Record failure' }} />
                    </div>
                  </div>
                </Card>
              )}
              {d.status === 'collected' && <Notice tone="info" title="Waiting for receipt confirmation">The recipient organization will confirm the quantity received.</Notice>}
              {active && (
                <ActionButton endpoint={`/api/donations/${d.id}/cancel`} label="Cancel donation" variant="outline" className="w-full"
                  confirm={{ title: 'Cancel this donation?', description: 'Any accepted recipient will be notified.', reason: { label: 'Reason', required: true }, destructive: true, confirmLabel: 'Cancel donation' }} />
              )}
            </>
          )}

          {user.role === 'recipient' && (
            <>
              {open && !myReq?.status?.match(/pending|accepted|offered/) && <Card title="Request this donation"><RequestForm donationId={d.id} disabledReason={eligibility} /></Card>}
              {myReq?.status === 'pending' && (
                <Card title="Your request">
                  <p className="text-sm">Sent {relTime(String(myReq.request_time))}. The donor will accept or decline.</p>
                  <div className="mt-3"><ActionButton endpoint={`/api/donations/${d.id}/withdraw`} label="Withdraw request" variant="outline" success="Request withdrawn" /></div>
                </Card>
              )}
              {myReq?.status === 'offered' && open && (
                <Card title="This donation was offered to you" className="border-secondary">
                  <div className="flex gap-2">
                    <ActionButton endpoint={`/api/donations/${d.id}/respond-offer`} body={{ accept: true }} label="Accept offer" success="Offer accepted" />
                    <ActionButton endpoint={`/api/donations/${d.id}/respond-offer`} body={{ accept: false }} label="Decline" variant="outline" confirm={{ title: 'Decline this offer?', reason: { label: 'Reason (optional)' }, confirmLabel: 'Decline' }} />
                  </div>
                </Card>
              )}
              {myReq?.status === 'rejected' && <Notice tone="info">Your request for this donation was not accepted.</Notice>}
              {v.acceptedRecipient && d.status === 'accepted' && <Card title="Schedule collection" description="Agree a pickup time with the donor."><ScheduleForm donationId={d.id} safeUntil={d.safe_until} /></Card>}
              {v.acceptedRecipient && d.status === 'scheduled' && (
                <Card title="Collection">
                  <div className="space-y-3">
                    <ScheduleForm donationId={d.id} safeUntil={d.safe_until} current={col?.scheduled_pickup_time ? String(col.scheduled_pickup_time) : null} />
                    <div className="flex flex-wrap gap-2 border-t pt-3">
                      <ActionButton endpoint={`/api/donations/${d.id}/collected`} label="We collected it" variant="secondary" success="Marked as collected"
                        confirm={{ title: 'Confirm pickup', number: { label: `Quantity collected (${d.unit})`, field: 'quantity', defaultValue: d.quantity_available, max: d.quantity_available }, confirmLabel: 'Confirm' }} />
                      <ActionButton endpoint={`/api/donations/${d.id}/failed`} label="Collection failed" variant="ghost"
                        confirm={{ title: 'Record a failed collection', reason: { label: 'What happened?', required: true }, destructive: true, confirmLabel: 'Record failure' }} />
                    </div>
                  </div>
                </Card>
              )}
              {v.acceptedRecipient && d.status === 'collected' && (
                <Card title="Confirm receipt" description="Record what you actually received. This is what counts as food rescued.">
                  <ConfirmReceiptForm donationId={d.id} max={d.quantity_available} unit={d.unit} reported={col?.quantity_delivered != null ? Number(col.quantity_delivered) : col?.quantity_collected != null ? Number(col.quantity_collected) : null} />
                </Card>
              )}
            </>
          )}

          {v.assignedVolunteer && (
            <Notice tone="info" title="You are assigned to this collection">Use <Link href="/app/tasks/assigned" className="font-semibold underline">Assigned Collections</Link> to update the task status.</Notice>
          )}

          {user.role === 'admin' && (
            <Card title="Administrative correction" description="Overrides the normal workflow. Always recorded in the audit log with your reason.">
              <div className="flex flex-wrap gap-2">
                {DONATION_STATUSES.filter((s) => s !== d.status).map((s) => (
                  <ActionButton key={s} endpoint={`/api/donations/${d.id}/admin-status`} body={{ status: s }} label={DONATION_STATUS_LABEL[s]} variant="outline"
                    confirm={{ title: `Set status to ${DONATION_STATUS_LABEL[s]}?`, reason: { label: 'Reason for correction', required: true }, confirmLabel: 'Apply correction', destructive: true }} />
                ))}
              </div>
            </Card>
          )}

          <Card title="Food safety">
            <p className="flex gap-2 text-sm text-muted-foreground"><Info className="mt-0.5 h-4 w-4 shrink-0" />FoodSphere AI assists with coordination and prioritization. It does not certify food safety. Inspect food on receipt and decline anything that appears unsafe.</p>
          </Card>
          <ReportIssue donationId={d.id} />
          {d.status === 'failed' && <Notice tone="warning"><span className="flex gap-2"><AlertTriangle className="h-4 w-4" />This collection failed. Failed collections are tracked in analytics.</span></Notice>}
          {d.status === 'delivered' && <Notice tone="success"><span className="flex gap-2"><Package className="h-4 w-4" />Delivered and confirmed by the recipient.</span></Notice>}
        </div>
      </div>
    </>
  );
}
