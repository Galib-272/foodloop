import type { Role } from './constants';

export type NavItem = { label: string; href: string; icon: string };
export type NavGroup = { title?: string; items: NavItem[] };

const SHARED: NavItem[] = [
  { label: 'Notifications', href: '/app/notifications', icon: 'bell' },
  { label: 'Coordination Updates', href: '/app/messages', icon: 'messages' },
  { label: 'Profile & Settings', href: '/app/settings', icon: 'settings' },
  { label: 'Help & Support', href: '/app/help', icon: 'help' },
];

// Sidebar items are filtered by role; pages enforce the same rules on the server.
export const NAV: Record<Role, NavGroup[]> = {
  donor: [
    {
      items: [
        { label: 'Dashboard', href: '/app', icon: 'dashboard' },
        { label: 'AI Surplus Forecast', href: '/app/forecast', icon: 'forecast' },
        { label: 'Inventory', href: '/app/inventory', icon: 'inventory' },
        { label: 'My Donations', href: '/app/donations', icon: 'donations' },
        { label: 'Recipient Matches', href: '/app/matches', icon: 'matches' },
        { label: 'Donation History', href: '/app/history', icon: 'history' },
        { label: 'Impact Analytics', href: '/app/analytics', icon: 'analytics' },
        { label: 'CSV Data Import', href: '/app/import', icon: 'upload' },
      ],
    },
    { title: 'Account', items: SHARED },
  ],
  recipient: [
    {
      items: [
        { label: 'Dashboard', href: '/app', icon: 'dashboard' },
        { label: 'Available Donations', href: '/app/available', icon: 'donations' },
        { label: 'Recommended Matches', href: '/app/recommended', icon: 'matches' },
        { label: 'My Requests', href: '/app/requests', icon: 'requests' },
        { label: 'Active Collections', href: '/app/collections', icon: 'truck' },
        { label: 'Received Donations', href: '/app/received', icon: 'received' },
        { label: 'Impact Report', href: '/app/analytics', icon: 'analytics' },
      ],
    },
    { title: 'Account', items: [{ label: 'Organization Profile', href: '/app/settings', icon: 'org' }, ...SHARED.filter((s) => s.href !== '/app/settings')] },
  ],
  volunteer: [
    {
      items: [
        { label: 'Dashboard', href: '/app', icon: 'dashboard' },
        { label: 'Available Tasks', href: '/app/tasks', icon: 'tasks' },
        { label: 'Assigned Collections', href: '/app/tasks/assigned', icon: 'truck' },
        { label: 'Completed Deliveries', href: '/app/tasks/completed', icon: 'received' },
      ],
    },
    { title: 'Account', items: SHARED },
  ],
  admin: [
    {
      items: [
        { label: 'Admin Overview', href: '/app/admin', icon: 'dashboard' },
        { label: 'User Management', href: '/app/admin/users', icon: 'users' },
        { label: 'Verification Requests', href: '/app/admin/verifications', icon: 'verify' },
        { label: 'Donation Management', href: '/app/admin/donations', icon: 'donations' },
        { label: 'Reported Issues', href: '/app/admin/reports', icon: 'flag' },
        { label: 'Analytics', href: '/app/admin/analytics', icon: 'analytics' },
        { label: 'ML Model Monitoring', href: '/app/admin/model', icon: 'model' },
        { label: 'Audit Logs', href: '/app/admin/audit', icon: 'audit' },
        { label: 'Platform Settings', href: '/app/admin/settings', icon: 'sliders' },
      ],
    },
    { title: 'Account', items: SHARED },
  ],
};
