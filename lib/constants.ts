// Shared, client-safe constants and types.

export const ROLES = ['donor', 'recipient', 'volunteer', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  donor: 'Donor',
  recipient: 'Recipient Organization',
  volunteer: 'Volunteer',
  admin: 'Administrator',
};

// Same categories as the Kaggle food-waste dataset the AI model was trained on.
export const FOOD_CATEGORIES = ['Prepared Food', 'Bakery', 'Fruits', 'Vegetables', 'Dairy', 'Meat'] as const;
export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

// Quantities in different units are never added together. "units" matches the Kaggle dataset (items/packs).
export const UNITS = ['units', 'kg', 'liters', 'portions'] as const;
export type Unit = (typeof UNITS)[number];

export const STORAGE = ['ambient', 'refrigerated', 'frozen'] as const;
export type Storage = (typeof STORAGE)[number];
export const STORAGE_LABEL: Record<Storage, string> = {
  ambient: 'Ambient (room temperature)',
  refrigerated: 'Refrigerated (≤ 5°C)',
  frozen: 'Frozen (≤ −18°C)',
};

export const BUSINESS_TYPES = [
  'Restaurant',
  'Supermarket',
  'Cafeteria',
  'Cloud Kitchen',
  'Bakery',
  'Grocery Shop',
  'Food Market',
  'Caterer',
  'Hotel',
  'Event Organizer',
] as const;

// The AI model knows the four Kaggle business types; other types use the closest one.
export const MODEL_BUSINESS_TYPE: Record<string, string> = {
  Restaurant: 'Restaurant', Supermarket: 'Supermarket', Cafeteria: 'Cafeteria', 'Cloud Kitchen': 'Cloud Kitchen',
  Bakery: 'Cafeteria', 'Grocery Shop': 'Supermarket', 'Food Market': 'Supermarket', Caterer: 'Cloud Kitchen',
  Hotel: 'Restaurant', 'Event Organizer': 'Cloud Kitchen',
};
export const MODEL_ORG_TYPE: Record<string, string> = {
  NGO: 'NGO', 'Community Kitchen': 'Community Kitchen', Shelter: 'Shelter', 'Food Bank': 'Food Bank', Orphanage: 'Orphanage',
  'Other Approved Organization': 'NGO',
};

export const WEATHER = ['Sunny', 'Cloudy', 'Rainy', 'Hot'] as const;

export const ORG_TYPES = [
  'NGO',
  'Community Kitchen',
  'Shelter',
  'Food Bank',
  'Orphanage',
  'Other Approved Organization',
] as const;

export const VERIFICATION = ['pending', 'verified', 'rejected', 'suspended'] as const;
export type Verification = (typeof VERIFICATION)[number];
export const VERIFICATION_LABEL: Record<Verification, string> = {
  pending: 'Pending Verification',
  verified: 'Verified',
  rejected: 'Rejected',
  suspended: 'Suspended',
};

export const DONATION_STATUSES = [
  'available',
  'requested',
  'accepted',
  'scheduled',
  'collected',
  'delivered',
  'cancelled',
  'expired',
  'rejected',
  'failed',
] as const;
export type DonationStatus = (typeof DONATION_STATUSES)[number];

export const DONATION_STATUS_LABEL: Record<DonationStatus, string> = {
  available: 'Available',
  requested: 'Requested',
  accepted: 'Accepted',
  scheduled: 'Scheduled',
  collected: 'Collected',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  expired: 'Expired',
  rejected: 'Rejected',
  failed: 'Failed Collection',
};

export const TERMINAL_STATUSES: DonationStatus[] = [
  'delivered',
  'cancelled',
  'expired',
  'rejected',
  'failed',
];

export const REQUEST_STATUSES = ['pending', 'offered', 'accepted', 'rejected', 'withdrawn', 'cancelled'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const TASK_STATUSES = ['unassigned', 'assigned', 'accepted', 'at_pickup', 'collected', 'delivered', 'failed'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  unassigned: 'Unassigned',
  assigned: 'Assigned',
  accepted: 'Accepted',
  at_pickup: 'At Pickup',
  collected: 'Collected',
  delivered: 'Delivered',
  failed: 'Failed',
};

// Same structure as the Kaggle dataset (one row per day per food category).
export const CSV_TEMPLATE_COLUMNS = [
  'date',
  'food_category',
  'purchase_quantity',
  'units_sold',
  'waste_quantity',
  'shelf_life_days',
  'storage_temperature',
  'promotion',
  'weather',
] as const;

export const CSV_MAX_BYTES = 2 * 1024 * 1024; // 2 MB, admin-configurable via settings
export const CSV_MAX_ROWS = 20000;
