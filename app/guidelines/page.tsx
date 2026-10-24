import type { Metadata } from 'next';
import { InfoPage } from '@/components/site/info-page';

export const metadata: Metadata = { title: "Food Donation Guidelines \u2014 FoodSphere AI" };

const sections = [
  {
    "heading": "Before you publish",
    "body": [
      [
        "Only donate food that is still within its safe-use window and has been stored correctly.",
        "Enter a safe-use deadline you have verified yourself. The platform will not publish a donation whose deadline has passed.",
        "Describe the food accurately, including category, quantity, unit and packaging.",
        "List known allergens (for example nuts, dairy, gluten, eggs, shellfish)."
      ]
    ]
  },
  {
    "heading": "Storage and handling",
    "body": [
      [
        "Keep refrigerated items at or below 5°C and frozen items at or below −18°C until pickup.",
        "Keep cooked food covered and separate from raw ingredients.",
        "Use clean, food-grade, sealed containers and label them with the item name and preparation time."
      ]
    ]
  },
  {
    "heading": "Collection",
    "body": [
      [
        "Agree a pickup time with the recipient through the platform before the deadline.",
        "Hand over food only to the accepted recipient or their assigned collection partner.",
        "Recipients should check the food on arrival and record the quantity actually received."
      ]
    ]
  },
  {
    "heading": "When not to donate",
    "body": [
      [
        "Food that has been served to customers or left at unsafe temperatures.",
        "Food with damaged, swollen or leaking packaging.",
        "Food past its use-by date."
      ]
    ]
  }
];

export default function GuidelinesPage() {
  return (
    <InfoPage
      eyebrow="Resources"
      title="Food Donation Guidelines"
      intro="These guidelines help donors and recipients handle surplus food responsibly. They support, but do not replace, applicable food-safety laws and professional advice."
      sections={sections}
    />
  );
}
