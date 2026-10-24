import { z } from 'zod';
import { BUSINESS_TYPES, FOOD_CATEGORIES, ORG_TYPES, STORAGE, UNITS } from './constants';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24-hour).');
const trimmed = (min: number, max: number, label: string) =>
  z.string().trim().min(min, `${label} is required.`).max(max, `${label} is too long.`);

export const registerSchema = z
  .object({
    full_name: trimmed(2, 100, 'Full name'),
    email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(160),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters.')
      .max(128)
      .regex(/[A-Za-z]/, 'Password must contain a letter.')
      .regex(/\d/, 'Password must contain a number.'),
    confirm_password: z.string(),
    role: z.enum(['donor', 'recipient', 'volunteer'], {
      errorMap: () => ({ message: 'Choose an account type.' }),
    }),
    phone: z
      .string()
      .trim()
      .max(20)
      .regex(/^$|^\+?[0-9\s-]{7,20}$/, 'Enter a valid phone number.')
      .optional(),
    accept_terms: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the Terms and Privacy Policy.' }),
    }),
  })
  .refine((d) => d.password === d.confirm_password, {
    path: ['confirm_password'],
    message: 'Passwords do not match.',
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

const orgBase = {
  organization_name: trimmed(2, 120, 'Name'),
  address: trimmed(5, 200, 'Address'),
  area: trimmed(2, 80, 'Area or city'),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
  phone: z.string().trim().max(20).optional(),
  contact_person: trimmed(2, 100, 'Contact person'),
  operating_hours_open: time,
  operating_hours_close: time,
  verification_details: z.string().trim().max(500).optional(),
};

export const donorOrgSchema = z.object({
  ...orgBase,
  organization_type: z.enum(BUSINESS_TYPES, { errorMap: () => ({ message: 'Choose a business type.' }) }),
});

export const recipientOrgSchema = z.object({
  ...orgBase,
  organization_type: z.enum(ORG_TYPES, { errorMap: () => ({ message: 'Choose an organization type.' }) }),
  accepted_categories: z.array(z.enum(FOOD_CATEGORIES)).min(1, 'Choose at least one food category.'),
  storage_capabilities: z.array(z.enum(STORAGE)).min(1, 'Choose at least one storage capability.'),
  receiving_capacity: z.coerce.number().positive('Capacity must be greater than 0.').max(100000),
  required_quantity: z.coerce.number().min(0).max(100000),
});

export const inventorySchema = z.object({
  item_name: trimmed(2, 120, 'Item name'),
  food_category: z.enum(FOOD_CATEGORIES),
  quantity: z.coerce.number().min(0, 'Quantity cannot be negative.').max(1_000_000),
  unit: z.enum(UNITS),
  recorded_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.'),
  safe_until: z.string().optional().nullable(),
  shelf_life_days: z.coerce.number().min(0).max(3650).optional().nullable(),
  storage_requirement: z.enum(STORAGE),
});

export const donationSchema = z
  .object({
    item_name: trimmed(2, 120, 'Food item name'),
    food_category: z.enum(FOOD_CATEGORIES, { errorMap: () => ({ message: 'Choose a food category.' }) }),
    quantity_available: z.coerce.number().positive('Quantity must be greater than 0.').max(100000),
    unit: z.enum(UNITS),
    prepared_at: z.string().optional().nullable(),
    available_from: z.string().min(1, 'Available-from time is required.'),
    safe_until: z.string().min(1, 'A verified safe-use deadline is required.'),
    storage_requirement: z.enum(STORAGE),
    pickup_address: trimmed(5, 200, 'Pickup address'),
    area: z.string().trim().max(80).optional(),
    latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
    longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
    description: z.string().trim().max(1000).optional(),
    packaging: trimmed(2, 200, 'Packaging information'),
    allergens: z.string().trim().max(200).optional(),
    handling_instructions: z.string().trim().max(500).optional(),
    contact_method: trimmed(2, 120, 'Contact method'),
    notes: z.string().trim().max(500).optional(),
    forecast_id: z.coerce.number().int().positive().optional().nullable(),
    inventory_id: z.coerce.number().int().positive().optional().nullable(),
    safety_checks: z
      .array(z.string())
      .refine((a) => a.length >= 4, 'Please confirm every food-safety statement.'),
  })
  .superRefine((d, ctx) => {
    const safe = Date.parse(d.safe_until);
    const from = Date.parse(d.available_from);
    if (Number.isNaN(safe)) ctx.addIssue({ code: 'custom', path: ['safe_until'], message: 'Invalid date/time.' });
    else if (safe <= Date.now())
      ctx.addIssue({ code: 'custom', path: ['safe_until'], message: 'The safe-use deadline has already passed.' });
    if (Number.isNaN(from)) ctx.addIssue({ code: 'custom', path: ['available_from'], message: 'Invalid date/time.' });
    else if (!Number.isNaN(safe) && from >= safe)
      ctx.addIssue({ code: 'custom', path: ['available_from'], message: 'Must be before the safe-use deadline.' });
  });

export const SAFETY_CHECKS = [
  'The food has been stored at the correct temperature since preparation.',
  'The food has not been served to customers or left out unsafely.',
  'The safe-use deadline entered is accurate and verified by me.',
  'Allergen and packaging information is complete to the best of my knowledge.',
];
