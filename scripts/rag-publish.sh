#!/bin/sh
# Rebuild and re-evaluate the assistant with your local Ollama models, check parity, then commit and push the results.
# Run: npm run rag:publish   (Ollama must be running)
set -e
npm run rag:all
npm run test:rag
git add lib/rag lib/docs rag/reports rag/context_cache.json
if git diff --cached --quiet; then
  echo "[publish] no new results to commit"
else
  git commit -m "chore(rag): re-run evaluation with local Ollama models"
fi
git push origin main
echo "[publish] done: results are on GitHub and Vercel will redeploy"
