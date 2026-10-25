#!/usr/bin/env node
// One command to run the FoodSphere n8n workflow locally:  npm run n8n
//  1. makes sure .env.local has N8N_WEBHOOK_URL and N8N_SHARED_SECRET (creates a random secret the first time)
//  2. imports automation/n8n/foodsphere-alerts.workflow.json into a project-local n8n and activates it
//  3. starts n8n on http://localhost:5678 (editor) — keep this terminal open, and run `npm run dev` in another one
import { spawnSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const envFile = path.join(root, '.env.local');
const readEnv = () =>
  Object.fromEntries(
    (existsSync(envFile) ? readFileSync(envFile, 'utf8') : '')
      .split('\n').map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')])
  );

let env = readEnv();
if (!env.N8N_SHARED_SECRET) {
  const secret = randomBytes(24).toString('hex');
  appendFileSync(envFile, `\n# n8n workflow automation (added by npm run n8n)\nN8N_WEBHOOK_URL=http://localhost:5678/webhook/foodsphere-events\nN8N_SHARED_SECRET=${secret}\n`);
  console.log('[n8n] added N8N_WEBHOOK_URL and N8N_SHARED_SECRET to .env.local — restart `npm run dev` so the app picks them up.');
  env = readEnv();
}

const n8nEnv = {
  ...process.env,
  N8N_USER_FOLDER: path.join(root, 'automation', 'n8n', '.n8n-data'),
  FOODSPHERE_N8N_SECRET: env.N8N_SHARED_SECRET,
  FOODSPHERE_APP_URL: process.env.FOODSPHERE_APP_URL || env.FOODSPHERE_APP_URL || 'http://localhost:3000',
  N8N_BLOCK_ENV_ACCESS_IN_NODE: 'false',
  N8N_DIAGNOSTICS_ENABLED: 'false',
  N8N_PERSONALIZATION_ENABLED: 'false',
  N8N_RUNNERS_ENABLED: 'false',
  N8N_SECURE_COOKIE: 'false',
  N8N_LISTEN_ADDRESS: process.env.N8N_LISTEN_ADDRESS || '127.0.0.1', // only reachable from this computer
  N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS: 'true',
  DB_SQLITE_POOL_SIZE: '2',
  N8N_GIT_NODE_DISABLE_BARE_REPOS: 'true',
};
const bin = process.env.N8N_BIN ? [process.env.N8N_BIN] : ['npx', '-y', 'n8n@1'];
const n8n = (args, opts = {}) => spawnSync(bin[0], [...bin.slice(1), ...args], { stdio: 'inherit', env: n8nEnv, shell: process.platform === 'win32', ...opts });

const wf = path.join(root, 'automation', 'n8n', 'foodsphere-alerts.workflow.json');
console.log('[n8n] importing the FoodSphere workflow (the first run downloads n8n, this can take a few minutes)…');
if (n8n(['import:workflow', `--input=${wf}`]).status) process.exit(1);
if (n8n(['update:workflow', '--id=foodsphereAlerts', '--active=true']).status) process.exit(1);
console.log(`[n8n] workflow active. It calls the app at ${n8nEnv.FOODSPHERE_APP_URL}. Starting n8n on http://localhost:5678 …`);
const child = spawn(bin[0], [...bin.slice(1), 'start'], { stdio: 'inherit', env: n8nEnv, shell: process.platform === 'win32' });
child.on('exit', (code) => process.exit(code ?? 0));
