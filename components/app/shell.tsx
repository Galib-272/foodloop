'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3, Bell, BrainCircuit, Building2, CheckCheck, ClipboardList, FileClock, Flag, HandHeart, HelpCircle, History,
  Inbox, LayoutDashboard, LineChart, ListChecks, LogOut, Menu, MessageSquare, Network, Package, Settings, ShieldCheck,
  SlidersHorizontal, Truck, Upload, Users, type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Logo } from '@/components/site/logo';
import { NAV, type NavGroup } from '@/lib/nav';
import { ROLE_LABEL, type Role } from '@/lib/constants';
import { relTime } from '@/lib/format';
import { apiFetch } from '@/lib/client';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { PopNumber } from '@/components/motion';

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard, forecast: LineChart, inventory: Package, donations: HandHeart, matches: Network, history: History,
  analytics: BarChart3, upload: Upload, bell: Bell, messages: MessageSquare, settings: Settings, help: HelpCircle, requests: ClipboardList,
  truck: Truck, received: CheckCheck, org: Building2, tasks: ListChecks, users: Users, verify: ShieldCheck, flag: Flag, model: BrainCircuit,
  audit: FileClock, sliders: SlidersHorizontal, inbox: Inbox,
};

export type ShellUser = { full_name: string; email: string; role: Role; org_name: string | null; verification_status: string | null };

function NavList({ groups, onNavigate, layoutKey = 'desktop' }: { groups: NavGroup[]; onNavigate?: () => void; layoutKey?: string }) {
  const path = usePathname();
  const active = (href: string) =>
    href === '/app' || href === '/app/admin' || href === '/app/tasks' ? path === href : path === href || path.startsWith(href + '/');
  return (
    <nav aria-label="Application" className="space-y-6">
      {groups.map((g, i) => (
        <div key={i}>
          {g.title && <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/45">{g.title}</p>}
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const Icon = ICONS[it.icon] ?? LayoutDashboard;
              const on = active(it.href);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    onClick={onNavigate}
                    aria-current={on ? 'page' : undefined}
                    className={cn(
                      'relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      on ? 'text-primary' : 'text-white/80 hover:bg-white/10 hover:text-white'
                    )}
                  >
                    {on && (
                      <motion.span layoutId={`nav-active-${layoutKey}`} className="absolute inset-0 rounded-lg bg-white shadow-sm"
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }} aria-hidden="true" />
                    )}
                    <Icon className="relative h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="relative">{it.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

type Notif = { id: number; title: string; message: string; link: string | null; is_read: number; created_at: string };

function NotificationBell() {
  const router = useRouter();
  const [data, setData] = useState<{ unread: number; notifications: Notif[] }>({ unread: 0, notifications: [] });
  const load = useCallback(async () => {
    const { data } = await apiFetch<{ unread: number; notifications: Notif[] }>('/api/notifications');
    if (data) setData(data);
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);
  async function open(n: Notif) {
    if (!n.is_read) await apiFetch('/api/notifications', { method: 'PATCH', body: { ids: [n.id] } });
    load();
    if (n.link) router.push(n.link);
  }
  async function readAll() {
    await apiFetch('/api/notifications', { method: 'PATCH', body: { all: true } });
    load();
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${data.unread ? `, ${data.unread} unread` : ''}`}>
          <Bell className="h-5 w-5" />
          {data.unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
              <PopNumber value={data.unread > 9 ? '9+' : data.unread} />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {data.unread > 0 && (
            <button onClick={readAll} className="text-xs font-medium text-secondary hover:underline">Mark all read</button>
          )}
        </div>
        <ul className="max-h-96 overflow-y-auto">
          {data.notifications.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">No notifications yet.</li>}
          {data.notifications.slice(0, 8).map((n) => (
            <li key={n.id}>
              <button onClick={() => open(n)} className={cn('flex w-full gap-3 border-b px-4 py-3 text-left hover:bg-muted', !n.is_read && 'bg-accent/50')}>
                <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.is_read ? 'bg-transparent' : 'bg-secondary')} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{n.title}{!n.is_read && <span className="sr-only"> (unread)</span>}</span>
                  <span className="block text-xs text-muted-foreground">{n.message}</span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">{relTime(n.created_at)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <Link href="/app/notifications" className="block px-4 py-2.5 text-center text-sm font-medium text-secondary hover:bg-muted">View all</Link>
      </PopoverContent>
    </Popover>
  );
}

export function AppShell({ user, today, children }: { user: ShellUser; today: string; children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const groups = NAV[user.role];
  async function logout() {
    await apiFetch('/api/auth/logout', { method: 'POST', body: {} });
    router.push('/login');
    router.refresh();
  }
  const initials = user.full_name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  const sidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col bg-primary px-3 py-5 text-primary-foreground">
      <div className="px-2"><Logo light /></div>
      <div className="mt-3 rounded-lg bg-white/10 px-3 py-2">
        <p className="truncate text-sm font-semibold">{user.org_name ?? user.full_name}</p>
        <p className="text-xs text-white/65">{ROLE_LABEL[user.role]}</p>
      </div>
      <div className="mt-6 flex-1 overflow-y-auto pr-1"><NavList groups={groups} onNavigate={onNavigate} layoutKey={onNavigate ? 'mobile' : 'desktop'} /></div>
      <button onClick={logout} className="mt-4 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white">
        <LogOut className="h-4 w-4" aria-hidden="true" /> Logout
      </button>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-screen lg:block">{sidebar()}</aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[270px] border-0 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              {sidebar(() => setOpen(false))}
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-muted-foreground">
              {today}
            </p>
          </div>
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-muted" aria-label="Profile menu">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{initials}</span>
                <span className="hidden text-sm font-medium sm:block">{user.full_name.split(' ')[0]}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p className="truncate">{user.full_name}</p>
                <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link href="/app/settings">Profile & Settings</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link href="/app/help">Help & Support</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout}>Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
