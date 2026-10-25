# AI model results

FoodSphere AI uses two machine-learning models. Both are trained offline in Python notebooks, exported to JSON and run inside the web app in TypeScript.

## AI model 1: leftover amount (regression)

Trained on the real Kaggle food waste dataset (8,000 daily inventory records). The selected model is Gradient Boosting.
Test mean absolute error is 7.818 units (root mean squared error 12.393), and R squared is 0.915.
A simple average baseline has an error of 22.733 units, so the model is about three times better.
The 80% prediction range covers 81.4% of test days, and 71.1% of predictions are within 10 units.

## AI model 1: waste risk Low, Medium or High (classification)

The selected model is Random Forest. Test accuracy is 71.2% against a baseline of 53.3% (always guessing Low).
Macro precision is 0.69, macro recall 0.643, macro F1 0.66 and ROC-AUC 0.859.
Accuracy is limited because the waste level depends on how many customers actually come that day, which is unknown in the morning.

## AI model 2: recipient matching (classification)

Trained on a clearly labelled synthetic dataset of donation offers to organizations. The selected model is Gradient Boosting.
It predicts whether an offer to an organization will end in a successful delivery.
Test accuracy is 81.1% (baseline 59.3%), precision 0.733, recall 0.842, F1 0.784 and ROC-AUC 0.877.

## How the matching ranking compares

When the top-ranked organization is chosen, the share of successful deliveries is:
- AI model (top probability): 75.3%
- Rule-based weighted score: 75.6%
- Nearest organization: 73.2%
- Random eligible organization: 70.2%

Because the matching data is synthetic, these numbers show that the pipeline works; they are not real-world evidence.
