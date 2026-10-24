import Link from 'next/link';
import { Logo } from '@/components/site/logo';

const COLUMNS = [
  {
    title: 'Platform',
    links: [
      { label: 'How It Works', href: '/#how-it-works' },
      { label: 'For Donors', href: '/#users' },
      { label: 'For NGOs', href: '/#users' },
      { label: 'Impact', href: '/#impact' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Food Donation Guidelines', href: '/guidelines' },
      { label: 'Frequently Asked Questions', href: '/#faq' },
      { label: 'Help Center', href: '/help' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Food Safety Disclaimer', href: '/food-safety' },
      { label: 'Data Use Policy', href: '/data-use' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="max-w-xs">
            <Logo light />
            <p className="mt-4 text-sm leading-relaxed text-white/75">
              An AI-assisted food rescue platform that helps businesses predict
              surplus and connect it with verified recipient organizations in
              Bangladesh.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-white/60">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-white/85 transition-colors hover:text-white hover:underline"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-white/15 pt-6 text-sm text-white/65 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} FoodSphere AI. All rights reserved.</p>
          <p>FoodSphere AI — Food Waste Zero.</p>
        </div>
      </div>
    </footer>
  );
}
