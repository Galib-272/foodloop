'use client';

/*
 * Shared Framer Motion building blocks.
 * - Subtle by design: short fades/slides, no looping motion on content (PRD §6.1, §22.6).
 * - <MotionProvider> sets reducedMotion="user", so people who ask their OS for less motion
 *   get instant transitions without transforms.
 * - Server components can use these as wrappers and pass normal children.
 */

import { Children, useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, animate, motion, useInView, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

export const EASE = [0.22, 1, 0.36, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/** Fades and slides content up the first time it scrolls into view. */
export function Reveal({ children, className, delay = 0, y = 14 }: { children: React.ReactNode; className?: string; delay?: number; y?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Staggers each direct child into view (wraps every child in a div). Ideal for card grids. */
export function Stagger({
  children, className, itemClassName, gap = 0.07, delay = 0, hover = false,
}: { children: React.ReactNode; className?: string; itemClassName?: string; gap?: number; delay?: number; hover?: boolean }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.1 }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap, delayChildren: delay } } }}
    >
      {Children.toArray(children).map((child, i) => (
        <motion.div key={i} variants={fadeUp} className={cn('min-w-0', itemClassName)}
          whileHover={hover ? { y: -4, transition: { duration: 0.2 } } : undefined}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

/** Semantic list version: use <StaggerList as="ul"> with <StaggerItem> children (rendered as <li>). */
export function StaggerList({ children, className, as = 'ul', gap = 0.06 }: { children: React.ReactNode; className?: string; as?: 'ul' | 'ol'; gap?: number }) {
  const Comp = as === 'ol' ? motion.ol : motion.ul;
  return (
    <Comp className={className} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}>
      {children}
    </Comp>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return <motion.li variants={fadeUp} className={className}>{children}</motion.li>;
}

/** Gentle lift on hover for interactive cards. */
export function HoverLift({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}>
      {children}
    </motion.div>
  );
}

/** Counts up from 0 to `value` when it first becomes visible. */
export function CountUp({ value, decimals = 0, suffix = '', className }: { value: number; decimals?: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, { duration: 1.2, ease: EASE, onUpdate: (v) => setShown(v) });
    return () => controls.stop();
  }, [inView, value]);
  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (
    <span ref={ref} className={className}>
      {/* Screen readers get the final value immediately. */}
      <span aria-hidden="true">{fmt(inView ? shown : 0)}{suffix}</span>
      <span className="sr-only">{fmt(value)}{suffix}</span>
    </span>
  );
}

/** Horizontal bar that grows to `percent` when visible (score factors, progress). */
export function GrowBar({ percent, className, barClassName }: { percent: number; className?: string; barClassName?: string }) {
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-muted', className)}>
      <motion.div className={cn('h-full rounded-full bg-secondary', barClassName)}
        initial={{ width: 0 }} whileInView={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        viewport={{ once: true }} transition={{ duration: 0.8, ease: EASE }} />
    </div>
  );
}

/** Animates content in/out when `show` toggles or `id` changes (results, alerts). */
export function Presence({ show = true, id, children, className }: { show?: boolean; id?: string | number; children: React.ReactNode; className?: string }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {show && (
        <motion.div key={id ?? 'content'} className={className}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3, ease: EASE }}>
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Small pop when a number changes (e.g. unread notification badge). */
export function PopNumber({ value, className }: { value: number | string; className?: string }) {
  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span key={String(value)} className={className}
        initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 26 }}>
        {value}
      </motion.span>
    </AnimatePresence>
  );
}

export { motion, AnimatePresence };
