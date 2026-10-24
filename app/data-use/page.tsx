import type { Metadata } from 'next';
import { InfoPage } from '@/components/site/info-page';

export const metadata: Metadata = { title: "Data Use Policy \u2014 FoodSphere AI" };

const sections = [
  {
    "heading": "Uploaded CSV files",
    "body": [
      [
        "CSV files are validated and treated as untrusted data. They are never executed as code.",
        "File size and row counts are limited.",
        "Exported files are protected against spreadsheet formula injection."
      ]
    ]
  },
  {
    "heading": "Forecasting",
    "body": [
      "Your imported records are used to generate forecasts for your own account. Forecast requests are logged with the model version and timestamp so model performance can be monitored."
    ]
  },
  {
    "heading": "Analytics",
    "body": [
      "Public impact figures are aggregated across the platform and never reveal an individual organization's records. Food rescued counts only quantities confirmed as delivered."
    ]
  },
  {
    "heading": "Retention",
    "body": [
      "Import validation reports are kept so you can review past imports. You can ask for your account data to be deleted by contacting support."
    ]
  }
];

export default function DataUsePage() {
  return (
    <InfoPage
      eyebrow="Legal"
      title="Data Use Policy"
      intro="How operational data and uploaded files are used inside FoodSphere AI."
      updated="October 2026"
      sections={sections}
    />
  );
}
