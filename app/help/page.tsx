import type { Metadata } from 'next';
import { InfoPage } from '@/components/site/info-page';

export const metadata: Metadata = { title: "Help Center \u2014 FoodSphere AI" };

const sections = [
  {
    "heading": "Getting started",
    "body": [
      [
        "Create an account and choose Donor, Recipient Organization or Volunteer.",
        "Complete your organization profile. Recipient organizations must be verified before they can request donations.",
        "Use the sidebar to reach your dashboard, donations and settings."
      ]
    ]
  },
  {
    "heading": "For donors",
    "body": [
      [
        "Import historical data from CSV on the CSV Data Import page. Download the template first.",
        "Open AI Surplus Forecast to get an estimate, then press Create Donation to prefill the form. You always confirm the actual quantity before publishing.",
        "Review recipient matches and accept or reject requests from My Donations."
      ]
    ]
  },
  {
    "heading": "For recipient organizations",
    "body": [
      [
        "Browse Available Donations or Recommended Matches.",
        "Request a donation, then schedule collection once the donor accepts.",
        "Confirm receipt with the quantity received so impact reports stay accurate."
      ]
    ]
  },
  {
    "heading": "Account problems",
    "body": [
      "If you cannot sign in, use Forgot Password on the sign-in page. If your account has been suspended, contact support with your registered email address."
    ]
  }
];

export default function HelpPage() {
  return (
    <InfoPage
      eyebrow="Resources"
      title="Help Center"
      intro="Answers to common questions about using FoodSphere AI. For anything else, contact the support team."
      sections={sections}
    />
  );
}
