#!/usr/bin/env node
/**
 * foodloop-warehouse-mcp — FoodLoop's analytics as MCP tools (stdio).
 *   list_reports        the DuckDB warehouse reports and the Delta Lake summary
 *   get_report          one report as rows (e.g. waste_by_category, match_success_by_distance)
 *   run_readonly_query  one read-only SELECT on the DuckDB star schema (data/foodsphere_warehouse.duckdb)
 * Run: npx tsx mcp/warehouse-server.ts
 */
import { ROOT, fail, json, log, tools, parseCsv, runPython } from './shared';
import fs from 'fs';
import path from 'path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ name: 'foodloop-warehouse-mcp', version: '1.0.0' });
const RO = { readOnlyHint: true, openWorldHint: false };
const tool = tools(server);
const REPORTS = path.join(ROOT, 'ml', 'warehouse', 'reports');
const LAKE = path.join(ROOT, 'ml', 'lakehouse', 'reports', 'lakehouse_summary.json');
const SYNTHETIC = new Set(['match_success_by_org_type', 'match_success_by_distance', 'match_failure_reasons', 'rescue_by_area']);

const reportNames = () => fs.readdirSync(REPORTS).filter((f) => f.endsWith('.csv')).map((f) => f.replace(/\.csv$/, '')).sort();

tool('list_reports', {
  title: 'List analytics reports',
  description: 'List FoodLoop\'s data-warehouse reports (from the DuckDB star schema) and the Delta Lake tables. Reports built from synthetic data are marked.',
  annotations: RO,
}, async () => {
  const lake = fs.existsSync(LAKE) ? JSON.parse(fs.readFileSync(LAKE, 'utf8')) : null;
  return json({
    reports: reportNames().map((name) => ({ name, data: SYNTHETIC.has(name) ? 'synthetic' : name.startsWith('app_') ? 'app database' : 'Kaggle (real)' })),
    warehouse_summary: JSON.parse(fs.readFileSync(path.join(REPORTS, 'summary.json'), 'utf8')).headline,
    lakehouse_tables: lake ? Object.fromEntries(Object.entries(lake.tables as Record<string, { rows: number; version: number }>).map(([k, v]) => [k, { rows: v.rows, version: v.version }])) : null,
  });
});

tool('get_report', {
  title: 'Get an analytics report',
  description: 'Return one warehouse report as rows, for example waste_by_category, waste_by_weekday, monthly_waste_trend, waste_reasons, match_success_by_org_type, match_success_by_distance.',
  inputSchema: { name: z.string().regex(/^[a-z0-9_]+$/).describe('Report name from list_reports') },
  annotations: RO,
}, async ({ name }) => {
  if (!reportNames().includes(name)) return fail(`Unknown report "${name}". Available: ${reportNames().join(', ')}`);
  const rows = parseCsv(fs.readFileSync(path.join(REPORTS, `${name}.csv`), 'utf8'));
  return json({ report: name, data: SYNTHETIC.has(name) ? 'synthetic' : 'real', rows });
});

tool('run_readonly_query', {
  title: 'Run a read-only warehouse query',
  description: 'Run one read-only SQL SELECT on the DuckDB warehouse. Tables: fact_inventory_waste, fact_donation_match (synthetic), fact_app_donation, dim_date, dim_food_category, dim_business_type, dim_weather, dim_waste_reason, dim_area, dim_organization. Max 200 rows.',
  inputSchema: { sql: z.string().min(6).max(2000) },
  annotations: RO,
}, async ({ sql }) => {
  const r = runPython('ml/warehouse/query.py', { sql });
  return r.ok ? json(r.data) : fail(r.error ?? 'Query failed');
});

server.connect(new StdioServerTransport()).then(() => log('foodloop-warehouse-mcp ready on stdio'));
