// Approximate area centroids used for straight-line distance estimates.
export const AREAS: { name: string; lat: number; lng: number }[] = [
  { name: 'Badda', lat: 23.7806, lng: 90.4261 },
  { name: 'Banani', lat: 23.7937, lng: 90.4066 },
  { name: 'Bashundhara', lat: 23.8193, lng: 90.4526 },
  { name: 'Dhanmondi', lat: 23.7461, lng: 90.3742 },
  { name: 'Farmgate', lat: 23.7586, lng: 90.3897 },
  { name: 'Gulshan', lat: 23.7808, lng: 90.4167 },
  { name: 'Jatrabari', lat: 23.7104, lng: 90.4348 },
  { name: 'Khilgaon', lat: 23.7516, lng: 90.4283 },
  { name: 'Lalbagh', lat: 23.7189, lng: 90.3882 },
  { name: 'Mirpur', lat: 23.8069, lng: 90.3687 },
  { name: 'Mohakhali', lat: 23.7778, lng: 90.4057 },
  { name: 'Mohammadpur', lat: 23.7662, lng: 90.3589 },
  { name: 'Motijheel', lat: 23.733, lng: 90.4172 },
  { name: 'Old Dhaka', lat: 23.7104, lng: 90.4074 },
  { name: 'Rampura', lat: 23.7612, lng: 90.4209 },
  { name: 'Tejgaon', lat: 23.7639, lng: 90.393 },
  { name: 'Uttara', lat: 23.8759, lng: 90.3795 },
  { name: 'Chattogram', lat: 22.3569, lng: 91.7832 },
  { name: 'Sylhet', lat: 24.8949, lng: 91.8687 },
  { name: 'Rajshahi', lat: 24.3745, lng: 88.6042 },
  { name: 'Khulna', lat: 22.8456, lng: 89.5403 },
];

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
