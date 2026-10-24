import { getDb } from './db';

export type Org = {
  id: number;
  user_id: number;
  kind: 'donor' | 'recipient';
  organization_name: string;
  organization_type: string;
  address: string;
  area: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  contact_person: string | null;
  verification_status: 'pending' | 'verified' | 'rejected' | 'suspended';
  verification_details: string | null;
  verification_note: string | null;
  accepted_categories: string[];
  storage_capabilities: string[];
  receiving_capacity: number;
  required_quantity: number;
  operating_hours_open: string;
  operating_hours_close: string;
  created_at: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseOrg(row: Record<string, any> | undefined): Org | null {
  if (!row) return null;
  return {
    ...(row as Org),
    accepted_categories: JSON.parse(row.accepted_categories || '[]'),
    storage_capabilities: JSON.parse(row.storage_capabilities || '[]'),
  };
}

export function getOrgByUser(userId: number): Org | null {
  return parseOrg(getDb().prepare('SELECT * FROM organizations WHERE user_id = ?').get(userId));
}

export function getOrg(id: number): Org | null {
  return parseOrg(getDb().prepare('SELECT * FROM organizations WHERE id = ?').get(id));
}
