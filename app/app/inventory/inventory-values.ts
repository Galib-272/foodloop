import { toLocalInput } from '@/lib/format';

export type InvValues = { id?: number; item_name: string; food_category: string; quantity: string; unit: string; recorded_date: string; safe_until: string; shelf_life_days: string; storage_requirement: string };

export const toInvValues = (r: Record<string, unknown>): InvValues => ({
  id: Number(r.id), item_name: String(r.item_name), food_category: String(r.food_category), quantity: String(r.quantity), unit: String(r.unit),
  recorded_date: String(r.recorded_date).slice(0, 10), safe_until: r.safe_until ? toLocalInput(String(r.safe_until)) : '', shelf_life_days: r.shelf_life_days != null ? String(r.shelf_life_days) : '',
  storage_requirement: String(r.storage_requirement),
});
