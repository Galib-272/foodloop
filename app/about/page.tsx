import type { Metadata } from 'next';
import { InfoPage } from '@/components/site/info-page';

export const metadata: Metadata = { title: "Rescuing good food, one coordinated pickup at a time. \u2014 FoodSphere AI" };

const sections = [
  {
    "heading": "Why we exist",
    "body": [
      "Restaurants, grocery shops, markets and event organizers regularly end up with edible surplus, while NGOs and community kitchens often lack an efficient way to find and collect it. FoodSphere AI connects these groups before food becomes unsafe."
    ]
  },
  {
    "heading": "What the platform does",
    "body": [
      [
        "Forecasts likely surplus from a donor's historical sales and inventory records.",
        "Lets donors publish available food with quantity, location and a verified safe-use deadline.",
        "Recommends eligible, verified recipient organizations with a transparent score and a reason.",
        "Tracks every donation from publication to confirmed delivery.",
        "Reports impact using only confirmed delivery records."
      ]
    ]
  },
  {
    "heading": "What the platform does not do",
    "body": [
      "FoodSphere AI does not certify food safety, replace professional inspections, or operate a delivery fleet. Forecasts are estimates, and no donation is ever published or distributed without donor and recipient confirmation."
    ]
  }
];

export default function AboutPage() {
  return (
    <InfoPage
      eyebrow="About"
      title="Rescuing good food, one coordinated pickup at a time."
      intro="FoodSphere AI \u2014 Food Waste Zero is a food rescue platform built for Bangladesh. It combines surplus forecasting, donation management, recipient matching and delivery tracking in one place."
      sections={sections}
    />
  );
}
