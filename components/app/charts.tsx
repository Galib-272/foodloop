'use client';

import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell,
} from 'recharts';

// Validated palette (scripts/validate_palette.js): green / amber / blue. Predicted series are also dashed (secondary encoding).
export const C = { green: '#16804a', amber: '#c97a0a', blue: '#2f7fc4', band: '#c97a0a', grid: '#e7e3da', ink: '#5b625e' };

const axis = { fontSize: 12, fill: C.ink };
const tooltipStyle = { borderRadius: 10, border: '1px solid #e2ddd2', fontSize: 12, boxShadow: '0 4px 14px rgba(0,0,0,.08)' };

export type SurplusPoint = { date: string; label: string; historical?: number | null; predicted?: number | null; range?: [number, number] | null; actual?: number | null };

/** Historical (solid green) vs predicted (dashed amber, with 80% band). */
export function SurplusChart({ data, unit = 'kg', height = 340 }: { data: SurplusPoint[]; unit?: string; height?: number }) {
  return (
    <div role="img" aria-label={`Daily leftover in ${unit}: actual values as a solid line and the AI estimate as a dashed line, with an 80% range for future days.`}>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: C.grid }} minTickGap={18} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={56} unit={` ${unit}`} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown, name: string) => {
            if (Array.isArray(v)) return [`${v[0]}–${v[1]} ${unit}`, name];
            return [v == null ? '—' : `${v} ${unit}`, name];
          }} />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
          <Area dataKey="range" name="80% range (forecast)" stroke="none" fill={C.band} fillOpacity={0.14} connectNulls={false} isAnimationActive={false} legendType="square" />
          <Line dataKey="historical" name="Actual leftover" stroke={C.green} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
          <Line dataKey="actual" name="Observed" stroke={C.blue} strokeWidth={0} dot={{ r: 4, fill: C.blue, stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false} />
          <Line dataKey="predicted" name="AI estimate" stroke={C.amber} strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3, fill: C.amber }} connectNulls={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SimpleBars({ data, height = 240, unit = '', horizontal = false, color = C.green }: {
  data: { name: string; value: number }[]; height?: number; unit?: string; horizontal?: boolean; color?: string;
}) {
  return (
    <div role="img" aria-label={data.map((d) => `${d.name}: ${d.value}${unit}`).join(', ')}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 16, bottom: 0, left: horizontal ? 8 : -16 }} barCategoryGap="22%">
          <CartesianGrid stroke={C.grid} horizontal={!horizontal} vertical={horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={axis} tickLine={false} axisLine={false} width={120} />
            </>
          ) : (
            <>
              <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={{ stroke: C.grid }} interval={0} />
              <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
            </>
          )}
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,0,0,.04)' }} formatter={(v: number) => [`${v}${unit}`, 'Value']} />
          <Bar dataKey="value" radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} isAnimationActive={false}
            label={{ position: horizontal ? 'right' : 'top', fontSize: 11, fill: C.ink }}>
            {data.map((_, i) => <Cell key={i} fill={color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthlyChart({ data, unit = 'kg', height = 260, labels = { published: 'Published', delivered: 'Delivered (confirmed)' } }: {
  data: { month: string; published?: number; delivered: number }[]; unit?: string; height?: number; labels?: { published?: string; delivered: string };
}) {
  const hasPublished = data.some((d) => d.published != null);
  return (
    <div role="img" aria-label={`Monthly quantities in ${unit}`}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="24%">
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="month" tick={axis} tickLine={false} axisLine={{ stroke: C.grid }} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={56} unit={` ${unit}`} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,0,0,.04)' }} formatter={(v: number, n: string) => [`${v} ${unit}`, n]} />
          <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
          {hasPublished && <Bar dataKey="published" name={labels.published} fill={C.blue} radius={[4, 4, 0, 0]} isAnimationActive={false} />}
          <Bar dataKey="delivered" name={labels.delivered} fill={C.green} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
