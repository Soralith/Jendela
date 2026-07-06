'use client';

import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['#DC2626', '#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

function shortenLabel(label: string, max = 18): string {
  return label.length > max ? label.slice(0, max - 2) + '..' : label;
}

interface ChartRendererProps {
  type: 'bar' | 'pie';
  data: Record<string, unknown>[];
  xKey?: string;
  bars?: string[];
  nameKey?: string;
  valueKey?: string;
  title?: string;
}

export function DataBarChart({ data, xKey, bars }: { data: Record<string, unknown>[]; xKey: string; bars: string[] }) {
  const chartData = data.slice(0, 15).map((row) => {
    const entry: Record<string, unknown> = {};
    entry[xKey] = shortenLabel(String(row[xKey] ?? ''), 14);
    for (const b of bars) {
      entry[b] = typeof row[b] === 'number' ? row[b] : parseFloat(String(row[b] ?? 0));
    }
    return entry;
  });

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, Math.min(300, chartData.length * 24 + 40))}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 80 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
        <YAxis type="category" dataKey={xKey} tick={{ fontSize: 9, fill: '#64748b' }} width={76} />
        <Tooltip
          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
          labelStyle={{ fontWeight: 600 }}
        />
        {bars.map((b, i) => (
          <Bar key={b} dataKey={b} fill={COLORS[i % COLORS.length]} radius={[0, 3, 3, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PieChartCard({ data, nameKey, valueKey, title }: ChartRendererProps) {
  const chartData = data.slice(0, 8).map((row) => ({
    name: shortenLabel(String(row[nameKey ?? 'name'] ?? ''), 16),
    value: typeof row[valueKey ?? 'value'] === 'number' ? row[valueKey ?? 'value'] : parseFloat(String(row[valueKey ?? 'value'] ?? 0)),
  }));
  const total = chartData.reduce((s, d) => s + (d.value as number), 0);
  if (total === 0) return null;

  return (
    <div>
      {title && <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">{title}</p>}
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            outerRadius={72}
            innerRadius={36}
            dataKey="value"
            nameKey="name"
            label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

interface Phase1ChartProps {
  headers: string[];
  rows: Record<string, unknown>[];
}

export function Phase1Charts({ headers, rows }: Phase1ChartProps) {
  if (!rows || rows.length === 0 || !headers || headers.length < 2) {
    return <p className="text-[11px] text-slate-400 dark:text-slate-500 italic mt-2">Data tidak memiliki cukup kolom untuk ditampilkan sebagai grafik.</p>;
  }

  const textCols: string[] = [];
  const numCols: string[] = [];

  for (const h of headers) {
    const sample = rows.find((r) => r[h] !== undefined && r[h] !== null && r[h] !== '');
    if (sample) {
      const v = sample[h];
      if (typeof v === 'number' || (!isNaN(Number(v)) && String(v).trim() !== '')) {
        numCols.push(h);
      } else {
        textCols.push(h);
      }
    }
  }

  if (numCols.length === 0) {
    return <p className="text-[11px] text-slate-400 dark:text-slate-500 italic mt-2">Tidak ditemukan data numerik yang bisa divisualisasikan sebagai grafik.</p>;
  }

  const xKey = textCols.length > 0 ? textCols[0] : 'index';
  const bars = numCols.slice(0, 3);
  const relData = textCols.length > 0 ? rows : rows.map((r, i) => ({ index: `#${i + 1}`, ...r }));

  return (
    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
      <p className="text-[10px] font-medium text-merah-500 dark:text-merah-400 mb-2 uppercase tracking-wider">Visualisasi Data</p>
      <DataBarChart data={relData} xKey={xKey} bars={bars} />
    </div>
  );
}

interface Phase2ChartProps {
  packages: { name: string; budget: number; severity: string }[];
  regionName: string;
}

export function Phase2Charts({ packages, regionName }: Phase2ChartProps) {
  if (!packages || packages.length < 2) return null;

  const barData = packages.filter((p) => p.budget > 0).map((p) => ({
    name: p.name,
    budget: p.budget / 1_000_000,
  }));

  if (barData.length < 2) return null;

  const sevCount: Record<string, number> = {};
  for (const p of packages) {
    const s = p.severity || 'unknown';
    sevCount[s] = (sevCount[s] || 0) + 1;
  }
  const pieData = Object.entries(sevCount).map(([name, value]) => ({ name, value }));

  return (
    <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-700">
      <p className="text-[10px] font-medium text-amber-500 dark:text-amber-400 mb-1 uppercase tracking-wider">Grafik — {regionName}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <p className="text-[9px] text-slate-500 dark:text-slate-400 mb-1">Anggaran per Paket (jt Rp)</p>
          <DataBarChart data={barData} xKey="name" bars={['budget']} />
        </div>
        <div>
          <PieChartCard
            type="pie"
            data={pieData}
            nameKey="name"
            valueKey="value"
            title="Distribusi Severity"
          />
        </div>
      </div>
    </div>
  );
}

export function ChartFallback({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 mt-2">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400 shrink-0">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
      <span className="text-[11px] text-slate-500 dark:text-slate-400 italic">{message}</span>
    </div>
  );
}
