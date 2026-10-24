import { getDb } from '@/lib/db';
import { apiUser, errorResponse } from '@/lib/api';
import { toCsv } from '@/lib/csv';

export const dynamic = 'force-dynamic';

// Exportable impact report (confirmed deliveries only). Cells are protected against formula injection.
export async function GET() {
  try {
    const user = apiUser(['donor', 'recipient', 'admin']);
    const scope = user.role === 'donor' ? 'AND d.donor_id = ?' : user.role === 'recipient' ? 'AND r.recipient_id = ?' : '';
    const rows = getDb()
      .prepare(
        `SELECT d.id, d.item_name, d.food_category, d.unit, d.quantity_available, c.quantity_delivered, c.actual_delivery_time,
                dor.organization_name AS donor, ro.organization_name AS recipient
         FROM donations d JOIN collections c ON c.donation_id = d.id JOIN donation_requests r ON r.id = c.request_id
         LEFT JOIN organizations dor ON dor.user_id = d.donor_id LEFT JOIN organizations ro ON ro.user_id = r.recipient_id
         WHERE d.status = 'delivered' ${scope} ORDER BY c.actual_delivery_time DESC`
      )
      .all(...(scope ? [user.id] : []));
    const csv = toCsv(
      ['donation_id', 'item', 'category', 'unit', 'quantity_published', 'quantity_delivered_confirmed', 'delivered_at', 'donor', 'recipient'],
      rows.map((r) => [`D-${String(r.id).padStart(4, '0')}`, r.item_name, r.food_category, r.unit, r.quantity_available, r.quantity_delivered, r.actual_delivery_time, r.donor, r.recipient])
    );
    return new Response(csv, {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="foodsphere_impact_report.csv"` },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
