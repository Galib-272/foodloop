import type { Metadata } from 'next';
import { InfoPage } from '@/components/site/info-page';

export const metadata: Metadata = { title: "Food Safety Disclaimer \u2014 FoodSphere AI" };

const sections = [
  {
    "heading": "What the platform checks",
    "body": [
      [
        "That required safety fields are filled in before a donation is published.",
        "That the declared safe-use deadline has not already passed.",
        "That recipients can store the food type and receive it before the deadline."
      ]
    ]
  },
  {
    "heading": "What the platform does not check",
    "body": [
      "The platform cannot inspect food. It does not verify temperature, freshness, contamination or allergen content. Recipients should inspect food on arrival and decline anything that appears unsafe."
    ]
  }
];

export default function FoodSafetyPage() {
  return (
    <InfoPage
      eyebrow="Legal"
      title="Food Safety Disclaimer"
      intro="FoodSphere AI assists with coordination and prioritization. It does not certify food safety. Donors remain responsible for providing accurate food information and following applicable food-safety requirements."
      sections={sections}
    />
  );
}
