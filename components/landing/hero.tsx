'use client';

import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  MapPin,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;
const up = (delay: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: EASE, delay },
});

export function Hero() {
  return (
    <section className="bg-grain relative overflow-hidden">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:pb-28 lg:pt-20">
        <div>
          <motion.p {...up(0)} className="inline-flex items-center gap-2 rounded-full border border-secondary/30 bg-white/70 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
            AI-assisted food rescue for Bangladesh
          </motion.p>
          <motion.h1 {...up(0.08)} className="text-balance mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Turn Surplus Food Into{' '}
            <span className="text-secondary">Community Impact.</span>
          </motion.h1>
          <motion.p {...up(0.16)} className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            FoodSphere AI helps businesses predict surplus food, connect with
            suitable recipient organizations, and coordinate food rescue before
            edible food goes to waste.
          </motion.p>
          <motion.div {...up(0.24)} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 px-7 text-base">
              <Link href="/register">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 bg-white/70 px-7 text-base"
            >
              <a href="#how-it-works">Explore How It Works</a>
            </Button>
          </motion.div>
          <motion.p {...up(0.32)} className="mt-6 text-sm font-medium text-muted-foreground">
            Smarter food rescue. Better coordination. Less waste.
          </motion.p>
        </div>

        {/* Product-oriented visual — illustrative data only */}
        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-secondary/20 to-transparent blur-2xl" />
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.3 }}
              whileHover={{ y: -4 }}
              className="rounded-2xl border bg-card p-5 shadow-xl shadow-primary/5"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                  <CheckCircle2 className="h-4 w-4 text-secondary" aria-hidden="true" />
                  Donation Match Found
                </span>
                <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
                  Recommended
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Food</dt>
                  <dd className="font-semibold">Fresh vegetables</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Quantity</dt>
                  <dd className="font-semibold">25 kg</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Recipient</dt>
                  <dd className="font-semibold">Verified Community Kitchen</dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-3 border-t pt-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> ~2.4 km
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Safe until
                  6:00 PM
                </span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.45 }}
              className="grid grid-cols-5 gap-4"
            >
              <div className="col-span-3 rounded-2xl border bg-card p-4 shadow-lg shadow-primary/5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Predicted surplus
                </p>
                <p className="mt-1 text-2xl font-bold">12–16 kg</p>
                <p className="text-xs text-muted-foreground">Bakery items · estimate</p>
                <svg
                  viewBox="0 0 160 48"
                  className="mt-3 h-12 w-full"
                  role="img"
                  aria-label="Illustrative surplus trend chart"
                >
                  <motion.polyline
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1, ease: EASE, delay: 0.7 }}
                    fill="none"
                    stroke="hsl(152 46% 22%)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points="2,34 22,28 42,32 62,20 82,24 102,14"
                  />
                  <motion.polyline
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.7, ease: EASE, delay: 1.6 }}
                    fill="none"
                    stroke="hsl(138 52% 40%)"
                    strokeWidth="2.5"
                    strokeDasharray="5 5"
                    strokeLinecap="round"
                    points="102,14 122,18 142,8 158,12"
                  />
                </svg>
              </div>
              <div className="col-span-2 flex flex-col justify-between rounded-2xl bg-primary p-4 text-primary-foreground shadow-lg">
                <TrendingUp className="h-5 w-5 text-green-300" aria-hidden="true" />
                <div>
                  <p className="text-xl font-bold">3 steps</p>
                  <p className="text-xs text-white/75">Publish → Match → Rescue</p>
                </div>
              </div>
            </motion.div>
            <p className="text-center text-xs text-muted-foreground">
              Illustrative example — not live platform data.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
