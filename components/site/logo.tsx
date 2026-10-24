import Link from 'next/link';
import { Leaf } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo({
  className,
  tagline = false,
  light = false,
}: {
  className?: string;
  tagline?: boolean;
  light?: boolean;
}) {
  return (
    <Link
      href="/"
      className={cn('flex items-center gap-2.5 rounded-md', className)}
      aria-label="FoodSphere AI home"
    >
      <span
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-xl',
          light ? 'bg-white/15 text-white' : 'bg-primary text-primary-foreground'
        )}
      >
        <Leaf className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="leading-tight">
        <span
          className={cn(
            'block text-[17px] font-bold tracking-tight',
            light ? 'text-white' : 'text-foreground'
          )}
        >
          FoodSphere <span className={light ? 'text-green-300' : 'text-secondary'}>AI</span>
        </span>
        {tagline && (
          <span
            className={cn(
              'hidden text-[11px] font-medium sm:block',
              light ? 'text-white/70' : 'text-muted-foreground'
            )}
          >
            Rescue Food. Nourish Communities.
          </span>
        )}
      </span>
    </Link>
  );
}
