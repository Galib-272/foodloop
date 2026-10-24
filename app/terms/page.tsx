import type { Metadata } from 'next';
import { InfoPage } from '@/components/site/info-page';

export const metadata: Metadata = { title: "Terms of Service \u2014 FoodSphere AI" };

const sections = [
  {
    "heading": "Using the platform",
    "body": [
      [
        "Provide accurate information about yourself, your organization and any food you donate.",
        "Use the platform only for lawful food donation and collection.",
        "Do not attempt to access data or features that your role does not permit."
      ]
    ]
  },
  {
    "heading": "Donor responsibilities",
    "body": [
      "Donors are responsible for the accuracy of food information, including the safe-use deadline, storage requirements and allergens, and for following applicable food-safety requirements."
    ]
  },
  {
    "heading": "Recipient responsibilities",
    "body": [
      "Recipients are responsible for inspecting food on receipt, storing it correctly and confirming the quantity actually received."
    ]
  },
  {
    "heading": "Forecasts and recommendations",
    "body": [
      "AI forecasts and match scores are estimates to support decisions. They are not guarantees of demand, quantity, safety or successful delivery."
    ]
  },
  {
    "heading": "Suspension",
    "body": [
      "Administrators may suspend accounts that provide false information or misuse the platform. Every suspension is recorded with a reason."
    ]
  }
];

export default function TermsPage() {
  return (
    <InfoPage
      eyebrow="Legal"
      title="Terms of Service"
      intro="By creating an account you agree to these terms."
      updated="October 2026"
      sections={sections}
    />
  );
}
