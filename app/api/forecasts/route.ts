import { getDb } from '@/lib/db';
import { apiUser, handle } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const user = apiUser(['donor', 'admin']);
  const rows = getDb()
    .prepare(`SELECT * FROM forecast_records ${user.role === 'admin' ? '' : 'WHERE donor_id = ?'} ORDER BY prediction_timestamp DESC LIMIT 100`)
    .all(...(user.role === 'admin' ? [] : [user.id]));
  return { forecasts: rows };
});
