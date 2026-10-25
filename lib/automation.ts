/**
 * Workflow automation: FoodSphere AI sends important events to an n8n webhook.
 * n8n (automation/n8n/foodsphere-alerts.workflow.json) checks the shared secret, writes the alert text and,
 * for urgent events, calls back /api/integrations/n8n so every administrator gets an in-app notification.
 *
 * Configure (both sides use the same secret):
 *   N8N_WEBHOOK_URL    e.g. http://localhost:5678/webhook/foodsphere-events
 *   N8N_SHARED_SECRET  any long random string
 * When N8N_WEBHOOK_URL is not set, events are skipped and the app works as before.
 */

export type FoodSphereEvent =
  | 'donation.created'
  | 'donation.deadline_soon'
  | 'donation.expired'
  | 'collection.failed'
  | 'donation.delivered'
  | 'automation.test';

export type EmitResult = { sent: boolean; status?: number; error?: string };

export function automationConfigured() {
  return Boolean(process.env.N8N_WEBHOOK_URL);
}

/** Send one event. Never throws: automation must not break the donation workflow. */
export async function emitEvent(event: FoodSphereEvent, data: Record<string, unknown>): Promise<EmitResult> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return { sent: false, error: 'N8N_WEBHOOK_URL is not set' };
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-foodsphere-secret': process.env.N8N_SHARED_SECRET ?? '' },
      body: JSON.stringify({ event, occurredAt: new Date().toISOString(), source: 'foodsphere-ai', data }),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) console.warn(`[automation] n8n answered ${r.status} for ${event}`);
    return { sent: r.ok, status: r.status };
  } catch (e) {
    console.warn(`[automation] could not reach n8n for ${event}:`, (e as Error).message);
    return { sent: false, error: (e as Error).message };
  }
}

/** Donation fields shared by every donation event. */
export function donationPayload(d: {
  id: number; item_name: string; food_category: string; quantity_available: number; unit: string; safe_until: string; area?: string | null; status: string;
}) {
  return {
    id: d.id, item_name: d.item_name, food_category: d.food_category, quantity: d.quantity_available, unit: d.unit,
    safe_until: d.safe_until, area: d.area ?? null, status: d.status,
  };
}
