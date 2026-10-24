import { getDb } from './db';

export function recipientRequests(userId: number) {
  return getDb()
    .prepare(
      `SELECT r.*, d.item_name, d.food_category, d.quantity_available, d.unit, d.status AS donation_status, d.safe_until, d.area,
              o.organization_name AS donor_org, c.scheduled_pickup_time, c.actual_delivery_time, c.quantity_delivered, c.status AS collection_status,
              c.received_as_expected, c.discrepancy, c.needs_volunteer, v.full_name AS volunteer_name
       FROM donation_requests r JOIN donations d ON d.id = r.donation_id LEFT JOIN organizations o ON o.user_id = d.donor_id
       LEFT JOIN collections c ON c.donation_id = d.id AND c.request_id = r.id LEFT JOIN users v ON v.id = c.assigned_volunteer_id
       WHERE r.recipient_id = ? ORDER BY r.request_time DESC`
    )
    .all(userId);
}
