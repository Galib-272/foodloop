# Frequently asked questions and getting-started guides

## What is FoodSphere AI?

FoodSphere AI is a food rescue platform. It forecasts surplus from your historical data, helps you publish donations, recommends suitable recipient organizations and tracks collection through to confirmed delivery.

## Who can donate food?

Restaurants, grocery shops, markets, bakeries, caterers and event organizers can register as donors. Donation permissions follow the platform’s verification policy.

## Which organizations can receive donations?

NGOs, community kitchens, shelters, food banks and other organizations that complete the verification process. Only verified organizations are eligible for restricted donation workflows.

## How does AI predict surplus food?

A regression model trained on historical inventory and sales features (such as day of week, category, shelf life and sales) estimates likely surplus. Predictions are estimates, show the model version, and never create a donation automatically.

## How are recipients matched?

First, ineligible recipients are removed (unverified, wrong food category or storage, cannot collect before the deadline). The rest are ranked by an AI model that estimates the chance of a successful delivery, using distance, quantity, capacity, timing and past acceptance. If the model is unavailable, a transparent weighted score is used instead. A reason is shown for each match.

## Does the system guarantee food safety?

No. FoodSphere AI does not certify food safety. Donors are responsible for accurate information and for following applicable food-safety requirements.

## How does food collection work?

After a donor accepts a request, the donor and recipient schedule a pickup. Status moves from Scheduled to Collected to Delivered, and the recipient confirms the quantity actually received.

## Can a small shop participate?

Yes. Any food business can join, from a neighborhood bakery to a large grocery store. You can enter inventory manually or import a CSV.

## How can an organization become verified?

Register as a recipient, complete the organization profile and submit verification information. An administrator reviews it and marks the account Verified or Rejected.

## How is donation data protected?

Passwords are hashed, access is role-based, and donor or recipient contact details are shown only to authorized users at the right stage of a donation. Important actions are recorded in audit logs.

## Getting started for Donors (restaurants, shops, event organizers)

1. Import history on CSV Data Import (download the template first).
2. Run AI Surplus Forecast, then use Create Donation to prefill a donation. Always confirm the real quantity.
3. Review Recipient Matches and accept a request or send an offer.
4. Schedule pickup, hand over the food, and the recipient confirms receipt.

## Getting started for Recipient organizations (NGOs, kitchens, shelters, food banks)

1. Make sure your accepted categories, storage and capacity are correct in Organization Profile.
2. Browse Available Donations or Recommended Matches and request what you can use.
3. When accepted, schedule a pickup (optionally ask for a volunteer).
4. After collecting, confirm the quantity received — this is what counts as food rescued.

## Getting started for Volunteers

1. Open Available Tasks and accept one you can complete before the deadline.
2. Mark “I’m at pickup”, then confirm pickup with the quantity collected.
3. Record the delivered quantity; the recipient confirms receipt.
4. If something goes wrong, use Report failure with a reason.

## Getting started for Administrators

1. Review Verification Requests and approve or reject with a reason.
2. Resolve Reported Issues and record corrections — all are audit-logged.
3. Monitor model performance and prediction failures in ML Model Monitoring.
