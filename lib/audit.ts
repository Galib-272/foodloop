import { getDb, nowIso } from './db';

export function audit(
  actorUserId: number | null,
  action: string,
  entityType: string,
  entityId: number | null,
  reason?: string | null,
  metadata?: Record<string, unknown>
) {
  getDb()
    .prepare(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, timestamp, reason, relevant_metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(actorUserId, action, entityType, entityId, nowIso(), reason ?? null, metadata ? JSON.stringify(metadata) : null);
}

export function notify(
  userId: number,
  title: string,
  message: string,
  link?: string,
  related?: { type: string; id: number }
) {
  getDb()
    .prepare(
      `INSERT INTO notifications (user_id, title, message, link, related_entity_type, related_entity_id, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
    )
    .run(userId, title, message, link ?? null, related?.type ?? null, related?.id ?? null, nowIso());
}
