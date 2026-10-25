#!/usr/bin/env node
// Runs a Python script with the project's virtual environment (.venv) when it exists, otherwise python3/python.
// Usage: node scripts/py.mjs rag/eval.py --retrieval-only     |     node scripts/py.mjs --setup
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const venvPy = process.platform === 'win32' ? path.join(root, '.venv', 'Scripts', 'python.exe') : path.join(root, '.venv', 'bin', 'python');
const systemPy = process.platform === 'win32' ? 'python' : 'python3';
const run = (cmd, args) => spawnSync(cmd, args, { stdio: 'inherit', cwd: root }).status ?? 1;

const args = process.argv.slice(2);
if (args[0] === '--setup') {
  if (!existsSync(venvPy)) {
    console.log('[setup] creating .venv (a private Python environment for this project)');
    if (run(systemPy, ['-m', 'venv', '.venv'])) process.exit(1);
  }
  const reqs = ['rag/requirements.txt', 'ml/warehouse/requirements.txt'].flatMap((r) => ['-r', r]);
  process.exit(run(venvPy, ['-m', 'pip', 'install', '--upgrade', 'pip', '-q']) || run(venvPy, ['-m', 'pip', 'install', ...reqs]));
}
process.exit(run(existsSync(venvPy) ? venvPy : systemPy, args));
