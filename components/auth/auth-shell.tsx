import { CheckCircle2 } from 'lucide-react';
import { Logo } from '@/components/site/logo';
import { Reveal, StaggerItem, StaggerList } from '@/components/motion';

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(0,520px)]">
      <div className="flex flex-col px-4 py-8 sm:px-10">
        <Logo tagline />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <Reveal>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-muted-foreground">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          </Reveal>
        </main>
      </div>
      <aside className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-end">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-secondary/30 blur-3xl" />
        <p className="relative text-3xl font-bold leading-tight">
          Rescue food.
          <br />
          Nourish communities.
        </p>
        <StaggerList className="relative mt-8 space-y-3 text-white/85" gap={0.12}>
          {[
            'Forecast likely surplus from your own data',
            'Publish donations with verified safe-use deadlines',
            'Get matched with verified organizations nearby',
            'Track every rescue to confirmed delivery',
          ].map((t) => (
            <StaggerItem key={t} className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-300" aria-hidden="true" />
              {t}
            </StaggerItem>
          ))}
        </StaggerList>
      </aside>
    </div>
  );
}
