import type { Metadata } from 'next';
import { InfoPage } from '@/components/site/info-page';

export const metadata: Metadata = { title: "Contact \u2014 FoodSphere AI" };

const sections = [
  {
    "heading": "Support",
    "body": [
      "Signed-in users can reach the team from Help and Support in the app sidebar. Please include your registered email address and, where relevant, the donation ID."
    ]
  },
  {
    "heading": "Partnerships and verification",
    "body": [
      "Organizations that want to join as a recipient should register and complete the organization profile. Verification requests are reviewed by a platform administrator."
    ]
  },
  {
    "heading": "Reporting a problem with a donation",
    "body": [
      "Use the Report Issue option on the donation's detail page so the report is linked to the right record and reaches an administrator."
    ]
  }
];

export default function ContactPage() {
  return (
    <InfoPage
      eyebrow="Resources"
      title="Contact"
      intro="We would like to hear from restaurants, markets, NGOs and volunteers who want to take part."
      sections={sections}
    />
  );
}
