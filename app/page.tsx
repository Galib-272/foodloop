import { Navbar } from '@/components/site/navbar';
import { Footer } from '@/components/site/footer';
import { Hero } from '@/components/landing/hero';
import {
  AiFeatures,
  EarlyPartners,
  Faq,
  FinalCta,
  HowItWorks,
  ImpactSection,
  ProblemSolution,
  ProductPreview,
  StatsStrip,
  TrustSafety,
  UserTypes,
  type PublicStats,
} from '@/components/landing/sections';

import { publicStats } from '@/lib/analytics';

export const dynamic = 'force-dynamic';

export default function Home() {
  let stats: PublicStats;
  try {
    stats = publicStats();
  } catch {
    // Database unavailable: show zeros rather than failing the public page.
    stats = { foodRescuedKg: 0, foodRescuedLiters: 0, completedDonations: 0, activeDonors: 0, verifiedRecipients: 0, fulfillmentRate: null, isDemo: true };
  }
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <StatsStrip stats={stats} />
        <ProblemSolution />
        <HowItWorks />
        <AiFeatures />
        <UserTypes />
        <ProductPreview />
        <TrustSafety />
        <ImpactSection stats={stats} />
        <EarlyPartners />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
