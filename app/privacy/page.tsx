import type { Metadata } from 'next';
import { InfoPage } from '@/components/site/info-page';

export const metadata: Metadata = { title: "Privacy Policy \u2014 FoodSphere AI" };

const sections = [
  {
    "heading": "Information we collect",
    "body": [
      [
        "Account details: name, email address, phone number (optional) and role.",
        "Organization details: name, type, address, approximate location, contact person, capacity and operating hours.",
        "Operational records: inventory, forecasts, donations, requests, collections and notifications.",
        "Technical data needed to keep you signed in securely."
      ]
    ]
  },
  {
    "heading": "How we use it",
    "body": [
      [
        "To run the food rescue workflow: matching, coordination and delivery confirmation.",
        "To produce impact analytics from confirmed records.",
        "To verify organizations and keep the platform trustworthy."
      ]
    ]
  },
  {
    "heading": "Who can see your information",
    "body": [
      "Contact details and pickup addresses are shown only to authorized users at the appropriate stage of a donation, for example after a request is accepted. Administrators can view records to verify accounts and resolve issues, and their actions are recorded in audit logs."
    ]
  },
  {
    "heading": "Security",
    "body": [
      "Passwords are stored as salted hashes, never in plain text. Access is controlled by role on the server. Uploaded files are treated as untrusted data and never executed."
    ]
  },
  {
    "heading": "Your choices",
    "body": [
      "You can update your profile at any time from Profile and Settings. To request a copy of your data or account deletion, contact support."
    ]
  }
];

export default function PrivacyPage() {
  return (
    <InfoPage
      eyebrow="Legal"
      title="Privacy Policy"
      intro="This policy explains what personal information FoodSphere AI collects, why, and how it is protected."
      updated="October 2026"
      sections={sections}
    />
  );
}
