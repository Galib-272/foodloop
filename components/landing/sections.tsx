import Link from 'next/link';
import {
  BarChart3,
  Building2,
  CalendarClock,
  ClipboardCheck,
  Clock3,
  HandHeart,
  Handshake,
  HeartHandshake,
  LineChart,
  Network,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBasket,
  Store,
  Truck,
  UploadCloud,
  UserCheck,
  Users,
  Utensils,
  FileWarning,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { CountUp, Reveal, Stagger, StaggerItem, StaggerList } from '@/components/motion';

function SectionHeading({
  eyebrow,
  title,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Reveal className={cn('mx-auto max-w-2xl text-center', className)}>
      {eyebrow && (
        <p className="text-sm font-semibold uppercase tracking-wider text-secondary">
          {eyebrow}
        </p>
      )}
      <h2 className="text-balance mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
        {title}
      </h2>
      {children && (
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          {children}
        </p>
      )}
    </Reveal>
  );
}

const wrap = 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8';

/* 6.2 — Impact statistics strip. Values come from verified records only. */
export type PublicStats = {
  foodRescuedKg: number;
  foodRescuedLiters: number;
  completedDonations: number;
  activeDonors: number;
  verifiedRecipients: number;
  fulfillmentRate: number | null;
  isDemo: boolean;
};

export function StatsStrip({ stats }: { stats: PublicStats }) {
  const items = [
    { label: 'Food Rescued', value: <CountUp value={stats.foodRescuedKg} decimals={stats.foodRescuedKg % 1 ? 1 : 0} suffix=" kg" />, icon: PackageCheck },
    { label: 'Completed Donations', value: <CountUp value={stats.completedDonations} />, icon: ClipboardCheck },
    { label: 'Active Donors', value: <CountUp value={stats.activeDonors} />, icon: Store },
    { label: 'Verified Recipient Organizations', value: <CountUp value={stats.verifiedRecipients} />, icon: Building2 },
  ];
  return (
    <section aria-label="Platform statistics" className="border-y bg-card">
      <div className={cn(wrap, 'py-10')}>
        <dl className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {items.map((it) => (
            <div key={it.label} className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                <it.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <dd className="text-2xl font-bold tracking-tight sm:text-3xl">{it.value}</dd>
                <dt className="text-sm text-muted-foreground">{it.label}</dt>
              </div>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          {stats.isDemo
            ? 'Demo mode — these figures are calculated from simulated demonstration records, not real-world deliveries.'
            : 'Calculated from confirmed deliveries on the platform.'}
          {stats.foodRescuedLiters > 0 && ` Also ${stats.foodRescuedLiters.toLocaleString()} L of liquids delivered.`}
        </p>
      </div>
    </section>
  );
}

/* 6.3 */
export function ProblemSolution() {
  const problems = [
    {
      icon: LineChart,
      title: 'Uncertain Demand',
      text: 'Businesses may purchase or prepare more food than customers need.',
    },
    {
      icon: Search,
      title: 'Missed Donation Opportunities',
      text: 'Potential recipients may not learn about surplus in time.',
    },
    {
      icon: Truck,
      title: 'Difficult Coordination',
      text: 'Food may go uncollected because of capacity, timing, or transportation issues.',
    },
  ];
  return (
    <section className={cn(wrap, 'py-20')}>
      <SectionHeading eyebrow="The problem" title="Food Should Feed People, Not Landfills." />
      <Stagger className="mt-12 grid gap-6 md:grid-cols-3" itemClassName="h-full" hover>
        {problems.map((p, i) => (
          <div key={p.title} className="h-full rounded-2xl border bg-card p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <p.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-lg font-semibold">
              <span className="mr-2 text-muted-foreground">{i + 1}.</span>
              {p.title}
            </h3>
            <p className="mt-2 text-muted-foreground">{p.text}</p>
          </div>
        ))}
      </Stagger>
      <Reveal><p className="mx-auto mt-10 max-w-3xl text-center text-lg leading-relaxed text-muted-foreground">
        FoodSphere AI connects <strong className="text-foreground">forecasting</strong>,{' '}
        <strong className="text-foreground">matching</strong> and{' '}
        <strong className="text-foreground">collection management</strong> in one
        place, so surplus is spotted early and reaches the right organization in time.
      </p></Reveal>
    </section>
  );
}

/* 6.4 */
export function HowItWorks() {
  const steps = [
    { icon: UploadCloud, title: 'Predict', text: 'The donor imports historical data and receives an estimate of possible surplus.' },
    { icon: ClipboardCheck, title: 'Publish', text: 'The donor registers eligible surplus food, quantity, location, and safe-use deadline.' },
    { icon: Network, title: 'Match', text: 'The system recommends suitable recipient organizations.' },
    { icon: HandHeart, title: 'Rescue', text: 'The donor and recipient confirm the arrangement, coordinate collection, and record delivery.' },
  ];
  return (
    <section id="how-it-works" className="bg-accent/60">
      <div className={cn(wrap, 'py-20')}>
        <SectionHeading eyebrow="How it works" title="From prediction to delivery in four steps." />
        <StaggerList as="ol" gap={0.15} className="relative mt-14 grid gap-10 md:grid-cols-4 md:gap-6">
          <div
            aria-hidden="true"
            className="absolute left-6 top-6 hidden h-px w-[calc(100%-3rem)] bg-secondary/30 md:block"
          />
          <div
            aria-hidden="true"
            className="absolute bottom-6 left-6 top-6 w-px bg-secondary/30 md:hidden"
          />
          {steps.map((s, i) => (
            <StaggerItem key={s.title} className="relative flex gap-4 md:block">
              <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground ring-4 ring-accent">
                {i + 1}
              </span>
              <div className="md:mt-5">
                <s.icon className="hidden h-6 w-6 text-secondary md:block" aria-hidden="true" />
                <h3 className="text-lg font-semibold md:mt-2">Step {i + 1} — {s.title}</h3>
                <p className="mt-1.5 text-muted-foreground">{s.text}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerList>
      </div>
    </section>
  );
}

/* 6.5 */
export function AiFeatures() {
  const cards = [
    {
      icon: LineChart,
      title: 'AI Surplus Forecasting',
      text: 'Predict likely surplus from historical sales and inventory records. Every forecast is labeled as an estimate and records the model version.',
    },
    {
      icon: Network,
      title: 'Smart Recipient Matching',
      text: 'Rank recipients according to compatibility, quantity, distance, availability, and capacity. Each recommendation comes with a plain-language reason.',
    },
    {
      icon: BarChart3,
      title: 'Food Rescue Analytics',
      text: 'Measure donation completion, rescued quantities, failed collections, and estimated waste avoided. Metrics come only from confirmed records.',
    },
  ];
  return (
    <section className={cn(wrap, 'py-20')}>
      <SectionHeading eyebrow="AI features" title="Intelligence that supports people, not replaces them." />
      <Stagger className="mt-12 grid gap-6 md:grid-cols-3" itemClassName="h-full" hover>
        {cards.map((c) => (
          <article key={c.title} className="group h-full rounded-2xl border bg-card p-7 transition-shadow hover:shadow-lg">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <c.icon className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="mt-5 text-xl font-semibold">{c.title}</h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">{c.text}</p>
            <Link href="/register" className="mt-4 inline-block text-sm font-semibold text-secondary hover:underline">
              Learn more →
            </Link>
          </article>
        ))}
      </Stagger>
    </section>
  );
}

/* 6.6 */
export function UserTypes() {
  const cards: { icon: LucideIcon; type: string; benefit: string; text: string; cta: string; href: string }[] = [
    { icon: Utensils, type: 'Restaurants and Food Businesses', benefit: 'Cut waste, give with confidence', text: 'Forecast surplus and publish donations in minutes.', cta: 'Register as a Donor', href: '/register?role=donor' },
    { icon: ShoppingBasket, type: 'Grocery Shops and Markets', benefit: 'Move stock before it expires', text: 'Track shelf life and offer near-expiry items responsibly.', cta: 'Register as a Donor', href: '/register?role=donor' },
    { icon: HeartHandshake, type: 'NGOs and Community Kitchens', benefit: 'Find food that fits your needs', text: 'Get matched with donations by category, capacity and timing.', cta: 'Join as a Recipient', href: '/register?role=recipient' },
    { icon: Users, type: 'Volunteers and Collection Partners', benefit: 'Make pickups count', text: 'Help carry food from donors to recipients on time.', cta: 'Join as a Volunteer', href: '/register?role=volunteer' },
  ];
  return (
    <section id="users" className="bg-primary text-primary-foreground">
      <div className={cn(wrap, 'py-20')}>
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Built for Every Part of the Food Rescue Journey.
          </h2>
        </Reveal>
        <Stagger className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" itemClassName="h-full" hover>
          {cards.map((c) => (
            <div key={c.type} className="flex h-full flex-col rounded-2xl bg-white/10 p-6 ring-1 ring-white/15">
              <c.icon className="h-7 w-7 text-green-300" aria-hidden="true" />
              <h3 className="mt-4 text-lg font-semibold">{c.type}</h3>
              <p className="mt-1 text-sm font-medium text-green-300">{c.benefit}</p>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-white/75">{c.text}</p>
              <Button asChild variant="secondary" className="mt-5">
                <Link href={c.href}>{c.cta}</Link>
              </Button>
            </div>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

/* 6.7 */
export function ProductPreview() {
  const rows = [
    { org: 'Community Kitchen A', score: 'High', note: 'Accepts category, has capacity' },
    { org: 'Shelter B', score: 'Medium', note: 'Can receive within window' },
    { org: 'Food Bank C', score: 'Medium', note: 'Further away, large capacity' },
  ];
  const statuses = [
    ['Available', 4],
    ['Requested', 2],
    ['Accepted', 1],
    ['Delivered', 7],
  ] as const;
  return (
    <section className={cn(wrap, 'py-20')}>
      <SectionHeading eyebrow="Product preview" title="One workspace for forecasts, donations and matches." />
      <Reveal y={28} className="mt-12 overflow-hidden rounded-3xl border bg-card shadow-2xl shadow-primary/10">
        <div className="flex items-center gap-2 border-b bg-muted/60 px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-red-400" />
          <span className="h-3 w-3 rounded-full bg-amber-400" />
          <span className="h-3 w-3 rounded-full bg-green-400" />
          <span className="ml-3 text-xs text-muted-foreground">Donor dashboard · illustrative preview</span>
        </div>
        <div className="grid gap-5 p-5 md:grid-cols-3 md:p-8">
          <div className="rounded-xl border p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Surplus forecast</p>
            <p className="mt-2 text-3xl font-bold">12–16 kg</p>
            <p className="text-sm text-muted-foreground">Estimated · bakery items</p>
            <div className="mt-4 flex h-20 items-end gap-1.5" aria-hidden="true">
              {[40, 55, 35, 60, 48, 70, 52].map((h, i) => (
                <div key={i} className={cn('flex-1 rounded-t', i > 4 ? 'bg-secondary/50' : 'bg-primary')} style={{ height: `${h}%` }} />
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Solid = historical · light = predicted</p>
          </div>
          <div className="rounded-xl border p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Donation status</p>
            <ul className="mt-3 space-y-2.5">
              {statuses.map(([s, n]) => (
                <li key={s} className="flex items-center justify-between text-sm">
                  <span>{s}</span>
                  <span className="rounded-full bg-accent px-2.5 py-0.5 font-semibold text-accent-foreground">{n}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recipient recommendations</p>
            <ul className="mt-3 space-y-3">
              {rows.map((r) => (
                <li key={r.org} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{r.org}</span>
                    <span className="text-xs font-semibold text-secondary">{r.score}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{r.note}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Reveal>
      <div className="mt-8 text-center">
        <Button asChild size="lg">
          <Link href="/register">Explore the Platform</Link>
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">Preview uses illustrative records, not live data.</p>
      </div>
    </section>
  );
}

/* 6.8 */
export function TrustSafety() {
  const items = [
    { icon: UserCheck, text: 'Verified account indicators' },
    { icon: Clock3, text: 'Safe-use deadline tracking' },
    { icon: ShieldCheck, text: 'Storage and handling requirements' },
    { icon: FileWarning, text: 'Donation reporting' },
    { icon: Handshake, text: 'Clear confirmation and cancellation workflows' },
  ];
  return (
    <section className="bg-accent/60">
      <div className={cn(wrap, 'py-20')}>
        <SectionHeading eyebrow="Trust & safety" title="Responsible food donation, by design." />
        <StaggerList className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
          {items.map((it) => (
            <StaggerItem key={it.text} className="flex items-center gap-3 rounded-xl bg-card p-4 ring-1 ring-border">
              <it.icon className="h-5 w-5 shrink-0 text-secondary" aria-hidden="true" />
              <span className="font-medium">{it.text}</span>
            </StaggerItem>
          ))}
        </StaggerList>
        <p
          role="note"
          className="mx-auto mt-10 max-w-3xl rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm leading-relaxed text-amber-950"
        >
          FoodSphere AI assists with coordination and prioritization. It does not
          certify food safety. Donors remain responsible for providing accurate
          food information and following applicable food-safety requirements.
        </p>
      </div>
    </section>
  );
}

/* 6.9 */
export function ImpactSection({ stats }: { stats: PublicStats }) {
  const rate = stats.fulfillmentRate == null ? '—' : `${Math.round(stats.fulfillmentRate * 100)}%`;
  const items = [
    { label: 'Total quantity successfully delivered', value: <CountUp value={stats.foodRescuedKg} decimals={stats.foodRescuedKg % 1 ? 1 : 0} suffix=" kg" /> },
    { label: 'Completed donations', value: <CountUp value={stats.completedDonations} /> },
    { label: 'Participating organizations', value: <CountUp value={stats.activeDonors + stats.verifiedRecipients} /> },
    { label: 'Donation fulfillment rate', value: stats.fulfillmentRate == null ? rate : <CountUp value={Math.round(stats.fulfillmentRate * 100)} suffix="%" /> },
  ];
  return (
    <section id="impact" className={cn(wrap, 'py-20')}>
      <SectionHeading eyebrow="Impact" title="Measure Every Successful Rescue.">
        Food rescued means quantity confirmed as delivered — never just published or accepted.
      </SectionHeading>
      <Stagger className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" itemClassName="h-full">
        {items.map((it) => (
          <dl key={it.label} className="h-full rounded-2xl border bg-card p-6">
            <dd className="text-3xl font-bold tracking-tight text-primary">{it.value}</dd>
            <dt className="mt-1 text-sm text-muted-foreground">{it.label}</dt>
          </dl>
        ))}
      </Stagger>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        {stats.isDemo ? 'Demo mode — simulated demonstration records. ' : ''}Fulfillment rate = delivered ÷ accepted requests that reached a final outcome.
      </p>
    </section>
  );
}

/* 6.10 — no invented testimonials or logos */
export function EarlyPartners() {
  return (
    <section className="border-y bg-card">
      <Reveal className={cn(wrap, 'py-16 text-center')}>
        <CalendarClock className="mx-auto h-8 w-8 text-secondary" aria-hidden="true" />
        <h2 className="mt-3 text-2xl font-bold tracking-tight">Built for Local Communities</h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          We are onboarding our first restaurants, markets and community
          organizations. Approved partner names and feedback will appear here as
          they join.
        </p>
      </Reveal>
    </section>
  );
}

/* 6.11 */
export const FAQS = [
  ['What is FoodSphere AI?', 'FoodSphere AI is a food rescue platform. It forecasts surplus from your historical data, helps you publish donations, recommends suitable recipient organizations and tracks collection through to confirmed delivery.'],
  ['Who can donate food?', 'Restaurants, grocery shops, markets, bakeries, caterers and event organizers can register as donors. Donation permissions follow the platform’s verification policy.'],
  ['Which organizations can receive donations?', 'NGOs, community kitchens, shelters, food banks and other organizations that complete the verification process. Only verified organizations are eligible for restricted donation workflows.'],
  ['How does AI predict surplus food?', 'A regression model trained on historical inventory and sales features (such as day of week, category, shelf life and sales) estimates likely surplus. Predictions are estimates, show the model version, and never create a donation automatically.'],
  ['How are recipients matched?', 'First, ineligible recipients are removed (unverified, wrong food category or storage, cannot collect before the deadline). The rest are ranked with a transparent weighted score based on category, quantity, distance, capacity and urgency, with a reason shown for each.'],
  ['Does the system guarantee food safety?', 'No. FoodSphere AI does not certify food safety. Donors are responsible for accurate information and for following applicable food-safety requirements.'],
  ['How does food collection work?', 'After a donor accepts a request, the donor and recipient schedule a pickup. Status moves from Scheduled to Collected to Delivered, and the recipient confirms the quantity actually received.'],
  ['Can a small shop participate?', 'Yes. Any food business can join, from a neighborhood bakery to a large grocery store. You can enter inventory manually or import a CSV.'],
  ['How can an organization become verified?', 'Register as a recipient, complete the organization profile and submit verification information. An administrator reviews it and marks the account Verified or Rejected.'],
  ['How is donation data protected?', 'Passwords are hashed, access is role-based, and donor or recipient contact details are shown only to authorized users at the right stage of a donation. Important actions are recorded in audit logs.'],
];

export function Faq() {
  return (
    <section id="faq" className="bg-accent/60">
      <div className={cn(wrap, 'py-20')}>
        <SectionHeading eyebrow="FAQ" title="Frequently asked questions" />
        <Reveal className="mx-auto mt-10 max-w-3xl">
        <Accordion type="single" collapsible className="rounded-2xl bg-card px-6 ring-1 ring-border">
          {FAQS.map(([q, a], i) => (
            <AccordionItem key={q} value={`faq-${i}`}>
              <AccordionTrigger className="text-left text-base">{q}</AccordionTrigger>
              <AccordionContent className="leading-relaxed text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        </Reveal>
      </div>
    </section>
  );
}

/* 6.12 */
export function FinalCta() {
  return (
    <section className={cn(wrap, 'py-20')}>
      <Reveal y={24} className="rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground sm:px-12">
        <h2 className="text-balance mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
          Help Good Food Reach the People Who Need It.
        </h2>
        <p className="mt-3 text-white/75">Join a coordinated food rescue network.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" variant="secondary" className="h-12 px-7">
            <Link href="/register?role=donor">Start Donating Food</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 border-white/40 bg-transparent px-7 text-white hover:bg-white/10 hover:text-white">
            <Link href="/register?role=recipient">Register Your Organization</Link>
          </Button>
        </div>
      </Reveal>
    </section>
  );
}
