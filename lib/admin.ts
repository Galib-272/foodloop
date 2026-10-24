import { getDb, nowIso } from './db';
import { audit, notify } from './audit';
import { badRequest, notFound } from './api';
import type { SessionUser } from './auth';
import { platformAnalytics } from './analytics';
import { evaluatedForecasts, loadModel, modelError } from './forecast';
import { loadMatchModel, matchModelError } from './ml/matching';
import { VERIFICATION_LABEL, type Verification } from './constants';

export function adminOverview() {
  const db = getDb();
  const n = (sql: string, ...p: unknown[]) => Number(db.prepare(sql).get(...p)!.n);
  return {
    totalUsers: n('SELECT COUNT(*) AS n FROM users'),
    pendingVerifications: n(`SELECT COUNT(*) AS n FROM organizations WHERE verification_status = 'pending'`),
    activeDonations: n(`SELECT COUNT(*) AS n FROM donations WHERE status IN ('available','requested','accepted','scheduled','collected')`),
    completedDonations: n(`SELECT COUNT(*) AS n FROM donations WHERE status = 'delivered'`),
    reportedIssues: n(`SELECT COUNT(*) AS n FROM reports WHERE status = 'open'`),
    failedCollections: n(`SELECT COUNT(*) AS n FROM donations WHERE status = 'failed'`),
    platform: platformAnalytics(),
  };
}

export function listUsers(f: { q?: string; role?: string; verification?: string }) {
  const where: string[] = [];
  const params: string[] = [];
  if (f.q) {
    where.push('(u.full_name LIKE ? OR u.email LIKE ? OR o.organization_name LIKE ?)');
    const like = `%${f.q.replace(/[%_]/g, '')}%`;
    params.push(like, like, like);
  }
  if (f.role) { where.push('u.role = ?'); params.push(f.role); }
  if (f.verification) { where.push('o.verification_status = ?'); params.push(f.verification); }
  return getDb()
    .prepare(
      `SELECT u.id, u.full_name, u.email, u.role, u.account_status, u.phone, u.created_at, u.is_demo,
              o.id AS org_id, o.organization_name, o.organization_type, o.area, o.verification_status, o.verification_details, o.verification_note,
              o.accepted_categories, o.storage_capabilities, o.receiving_capacity, o.contact_person, o.address
       FROM users u LEFT JOIN organizations o ON o.user_id = u.id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY u.created_at DESC LIMIT 500`
    )
    .all(...params);
}

export function setVerification(admin: SessionUser, userId: number, status: Verification, reason?: string) {
  const db = getDb();
  const org = db.prepare('SELECT id, organization_name, verification_status FROM organizations WHERE user_id = ?').get(userId);
  if (!org) throw notFound('This user has no organization profile.');
  if ((status === 'rejected' || status === 'suspended') && !reason?.trim()) throw badRequest('A reason is required.', { reason: 'Required.' });
  db.prepare('UPDATE organizations SET verification_status = ?, verification_note = ?, updated_at = ? WHERE id = ?').run(status, reason || null, nowIso(), org.id);
  audit(admin.id, `verification.${status === 'verified' ? 'approve' : status}`, 'user', userId, reason, { from: org.verification_status, to: status });
  notify(
    userId,
    status === 'verified' ? 'Account verification completed' : `Verification status: ${VERIFICATION_LABEL[status]}`,
    status === 'verified'
      ? `${org.organization_name} is now verified.`
      : `${org.organization_name} is now ${VERIFICATION_LABEL[status].toLowerCase()}.${reason ? ' Reason: ' + reason : ''}`,
    '/app/settings'
  );
  return { ok: true };
}

export function setAccountStatus(admin: SessionUser, userId: number, status: 'active' | 'suspended', reason: string) {
  if (userId === admin.id) throw badRequest('You cannot change the status of your own account.');
  const db = getDb();
  const u = db.prepare('SELECT account_status FROM users WHERE id = ?').get(userId);
  if (!u) throw notFound('User not found.');
  db.prepare('UPDATE users SET account_status = ?, updated_at = ? WHERE id = ?').run(status, nowIso(), userId);
  if (status === 'suspended') db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  audit(admin.id, status === 'suspended' ? 'user.suspend' : 'user.reactivate', 'user', userId, reason, { from: u.account_status, to: status });
  if (status === 'active') notify(userId, 'Account reactivated', 'Your account has been reactivated.', '/app');
  return { ok: true };
}

export function resolveReport(admin: SessionUser, id: number, status: 'resolved' | 'dismissed', resolution: string) {
  const db = getDb();
  const r = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
  if (!r) throw notFound('Report not found.');
  db.prepare('UPDATE reports SET status = ?, resolution = ?, resolved_by = ?, resolved_at = ? WHERE id = ?').run(status, resolution, admin.id, nowIso(), id);
  audit(admin.id, `report.${status}`, 'report', id, resolution, { donation_id: r.donation_id });
  notify(Number(r.reporter_id), 'Report reviewed', `Your report was ${status}: ${resolution}`, r.donation_id ? `/app/donations/${r.donation_id}` : '/app');
  return { ok: true };
}

export function listReports() {
  return getDb()
    .prepare(
      `SELECT r.*, u.full_name AS reporter_name, u.role AS reporter_role, d.item_name, d.status AS donation_status, a.full_name AS resolver_name
       FROM reports r JOIN users u ON u.id = r.reporter_id LEFT JOIN donations d ON d.id = r.donation_id LEFT JOIN users a ON a.id = r.resolved_by
       ORDER BY CASE r.status WHEN 'open' THEN 0 ELSE 1 END, r.created_at DESC`
    )
    .all();
}

export function auditLogs(f: { entity?: string; q?: string }) {
  const where: string[] = [];
  const params: string[] = [];
  if (f.entity) { where.push('a.entity_type = ?'); params.push(f.entity); }
  if (f.q) { where.push('(a.action LIKE ? OR a.reason LIKE ? OR u.full_name LIKE ?)'); const l = `%${f.q.replace(/[%_]/g, '')}%`; params.push(l, l, l); }
  return getDb()
    .prepare(
      `SELECT a.*, u.full_name AS actor_name, u.role AS actor_role FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY a.timestamp DESC, a.id DESC LIMIT 300`
    )
    .all(...params);
}

export function modelMonitoring() {
  const db = getDb();
  const w = loadModel();
  const m = loadMatchModel();
  const counts: Record<string, number> = {};
  for (const r of db.prepare('SELECT validation_status, COUNT(*) AS n FROM forecast_records GROUP BY validation_status').all())
    counts[String(r.validation_status)] = Number(r.n);
  const evaluated = evaluatedForecasts(null, 500);
  const liveMae = evaluated.length ? evaluated.reduce((s, r) => s + r.error, 0) / evaluated.length : null;
  const testMae = w?.leftover.test.MAE ?? null;
  let drift: { status: 'insufficient_data' | 'stable' | 'watch' | 'drift'; message: string };
  if (evaluated.length < 20 || liveMae == null || testMae == null) {
    drift = { status: 'insufficient_data', message: `${evaluated.length} forecasts have recorded outcomes so far; at least 20 are needed to assess drift.` };
  } else {
    const ratio = liveMae / testMae;
    drift = ratio > 1.5
      ? { status: 'drift', message: `Live error is ${ratio.toFixed(2)}× the test error. Review recent data and consider retraining.` }
      : ratio > 1.2
        ? { status: 'watch', message: `Live error is ${ratio.toFixed(2)}× the test error. Keep monitoring.` }
        : { status: 'stable', message: `Live error is ${ratio.toFixed(2)}× the test error.` };
  }
  return {
    waste: w ? {
      version: w.version, trained_at: w.trained_at, dataset: w.dataset, cleaning: w.cleaning, leakage: w.leakage_columns_removed, features: w.features,
      leftover: { approach: w.leftover.approach, algorithm: w.leftover.algorithm, test: w.leftover.test, comparison_test: w.leftover.comparison_test, interval: w.leftover.interval },
      level: { algorithm: w.waste_level.algorithm, imbalance: w.waste_level.imbalance_strategy, test: w.waste_level.test, labels: w.waste_level.labels,
        confusion_matrix: w.waste_level.confusion_matrix, report: w.waste_level.report, comparison_test: w.waste_level.comparison_test,
        feature_importance: w.waste_level.feature_importance },
    } : null,
    matching: m ? {
      version: m.version, trained_at: m.trained_at, synthetic: m.synthetic, dataset: m.dataset, cleaning: m.cleaning, algorithm: m.algorithm,
      imbalance: m.imbalance_strategy, test: m.test, labels: m.labels, confusion_matrix: m.confusion_matrix, comparison_test: m.comparison_test,
      ranking_test: m.ranking_test, feature_importance: m.feature_importance,
    } : null,
    loadErrors: { waste: w ? null : modelError(), matching: m ? null : matchModelError() },
    counts: {
      predictions: counts.valid ?? 0,
      failures: counts.model_unavailable ?? 0,
      validationFailures: counts.invalid_input ?? 0,
    },
    recent: db
      .prepare(
        `SELECT f.id, f.prediction_timestamp, f.food_category, f.forecast_quantity, f.lower_bound, f.upper_bound, f.unit, f.forecast_date,
                f.model_version, f.validation_status, f.error, f.evaluation_or_uncertainty_metadata AS meta, o.organization_name
         FROM forecast_records f LEFT JOIN organizations o ON o.user_id = f.donor_id ORDER BY f.prediction_timestamp DESC LIMIT 25`
      )
      .all(),
    live: { evaluated: evaluated.length, mae: liveMae == null ? null : Math.round(liveMae * 100) / 100 },
    drift,
  };
}
