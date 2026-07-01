'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface NemesisPackage {
  name: string;
  budget: number;
  severity: string;
  riskScore: number;
  satker: string;
}

interface NemesisRegion {
  name: string;
  province: string;
  flaggedPackages: number;
  potentialWaste: number;
  avgRiskScore: number;
  packages: NemesisPackage[];
}

interface MediaArticle {
  title: string;
  source: string;
  snippet: string;
  url: string;
}

export interface PhaseDataMap {
  [phase: number]: {
    status: 'loading' | 'data' | 'done';
    label: string;
    source: string;
    data?: Record<string, unknown>;
  };
}

interface AnalysisResultProps {
  phases: PhaseDataMap;
  synthesis?: string;
  confidence?: number | null;
  onCopy?: () => void;
}

const mdComponents: Components = {
  strong: ({ children }) => <span className="font-semibold text-slate-900 dark:text-slate-100">{children}</span>,
  em: ({ children }) => <em className="italic text-slate-600 dark:text-slate-400">{children}</em>,
  code: ({ children, className }) => {
    if (!className) return <code className="bg-slate-100 dark:bg-slate-800 text-merah-600 dark:text-merah-400 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>;
    return <pre className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono"><code>{children}</code></pre>;
  },
  ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2 text-sm">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2 text-sm">{children}</ol>,
  li: ({ children }) => <li className="text-slate-700 dark:text-slate-300 leading-relaxed">{children}</li>,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-merah-600 dark:text-merah-400 hover:underline font-medium">{children}</a>,
  p: ({ children }) => <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-2 last:mb-0">{children}</p>,
  h1: ({ children }) => <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-3 mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-3 mb-2">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-2 mb-1">{children}</h3>,
  hr: () => <hr className="my-2 border-slate-200 dark:border-slate-700" />,
  table: ({ children }) => <div className="overflow-x-auto my-3"><table className="min-w-full border-collapse border border-slate-200 dark:border-slate-700 text-xs">{children}</table></div>,
  thead: ({ children }) => <thead className="bg-slate-50 dark:bg-slate-800">{children}</thead>,
  th: ({ children }) => <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">{children}</th>,
  td: ({ children }) => <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-slate-600 dark:text-slate-400">{children}</td>,
};

function PhaseNumber({ phase }: { phase: number }) {
  const colors = ['bg-merah-600 dark:bg-merah-500', 'bg-emas-500', 'bg-biru-500', 'bg-slate-600 dark:bg-slate-400'];
  return (
    <div className={`w-6 h-6 rounded-full ${colors[phase - 1]} text-white flex items-center justify-center text-[10px] font-bold shrink-0`}>
      {phase}
    </div>
  );
}

function PhaseHeader({ phase, label, source }: { phase: number; label: string; source: string }) {
  const accentColors = [
    'text-merah-700 dark:text-merah-300',
    'text-emas-700 dark:text-emas-300',
    'text-biru-700 dark:text-biru-300',
    'text-slate-700 dark:text-slate-300',
  ];
  const sourceColors = [
    'text-merah-600 dark:text-merah-400',
    'text-emas-600 dark:text-emas-400',
    'text-biru-600 dark:text-biru-400',
    'text-slate-500 dark:text-slate-400',
  ];

  return (
    <div className="flex items-center gap-2 mb-3">
      <PhaseNumber phase={phase} />
      <span className={`text-xs font-semibold ${accentColors[phase - 1]} uppercase tracking-wider`}>
        {label}
      </span>
      {source && (
        <span className={`text-[10px] font-medium ${sourceColors[phase - 1]}`}>
          · {source}
        </span>
      )}
    </div>
  );
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const segments = 5;
  const filled = Math.round((confidence / 100) * segments);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-400 dark:text-slate-500">Confidence Score:</span>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: segments }).map((_, i) => {
          let color = 'bg-slate-200 dark:bg-slate-700';
          if (i < filled) {
            if (confidence >= 80) color = 'bg-amber-400';
            else if (confidence >= 60) color = 'bg-amber-400';
            else color = 'bg-amber-300';
          }
          return <div key={i} className={`w-4 h-1.5 rounded-full ${color} transition-colors duration-500`} />;
        })}
      </div>
      <span className={`text-[10px] font-medium ${
        confidence >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
        confidence >= 60 ? 'text-amber-600 dark:text-amber-400' :
        'text-slate-500 dark:text-slate-400'
      }`}>
        {confidence}%
      </span>
    </div>
  );
}

function Phase1Data({ data }: { data: Record<string, unknown> }) {
  if (!data.found) {
    return <p className="text-sm text-slate-500 dark:text-slate-400 italic">Tidak ada dataset yang ditemukan untuk pertanyaan ini.</p>;
  }

  const r = data as unknown as {
    title: string;
    organization: string;
    totalRows: number;
    headers: string[];
    rows: Record<string, unknown>[];
    source: string;
  };

  return (
    <div className="space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
      {r.organization && (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-merah-50 dark:bg-merah-950/40 rounded-lg p-2.5 border border-merah-100 dark:border-merah-900/50">
            <span className="block text-[10px] text-merah-500 dark:text-merah-400 font-medium">Dataset</span>
            <span className="block text-xs font-semibold text-merah-700 dark:text-merah-300">{r.title}</span>
          </div>
          <div className="bg-merah-50 dark:bg-merah-950/40 rounded-lg p-2.5 border border-merah-100 dark:border-merah-900/50">
            <span className="block text-[10px] text-merah-500 dark:text-merah-400 font-medium">Organisasi</span>
            <span className="block text-xs font-semibold text-merah-700 dark:text-merah-300">{r.organization}</span>
          </div>
        </div>
      )}
      <div className="bg-white dark:bg-slate-800/40 rounded-lg p-2.5 border border-slate-200 dark:border-slate-700">
        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Total baris data: {r.totalRows}</span>
        {r.headers && r.headers.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {r.headers.slice(0, 8).map((h: string, i: number) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">
                {h}
              </span>
            ))}
            {r.headers.length > 8 && <span className="text-[10px] text-slate-400">+{r.headers.length - 8} kolom</span>}
          </div>
        )}
      </div>
      {r.source && (
        <a
          href={r.source}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-merah-600 dark:text-merah-400 hover:underline font-medium mt-1"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          Lihat sumber
        </a>
      )}
    </div>
  );
}

function Phase2Data({ data }: { data: Record<string, unknown> }) {
  const r = data as { totalFlagged?: number; totalPotentialWaste?: number; topRegions?: NemesisRegion[] };

  if (!r.topRegions || r.topRegions.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400 italic">Tidak ada anomali signifikan terdeteksi.</p>;
  }

  const waste =
    r.totalPotentialWaste && r.totalPotentialWaste > 1_000_000_000
      ? `Rp ${(r.totalPotentialWaste / 1_000_000_000).toFixed(1)} miliar`
      : r.totalPotentialWaste
        ? `Rp ${(r.totalPotentialWaste / 1_000_000).toFixed(1)} juta`
        : null;

  return (
    <div className="space-y-2.5">
      {r.totalFlagged && r.totalFlagged > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">
            {r.totalFlagged} paket terflag
          </span>
          {waste && (
            <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">
              Potensi kerugian: {waste}
            </span>
          )}
        </div>
      )}
      {r.topRegions.slice(0, 3).map((region, ri) => (
        <div key={ri} className="bg-amber-50 dark:bg-amber-900/10 rounded-lg p-2.5 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">{region.name}</span>
            <span className="text-[10px] text-amber-600 dark:text-amber-400">{region.province}</span>
          </div>
          {region.packages && region.packages.length > 0 && (
            <div className="space-y-1.5">
              {region.packages.slice(0, 4).map((pkg, pi) => (
                <div key={pi} className="flex items-start gap-2 text-xs">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400 shrink-0 mt-0.5">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <div>
                    <span className="text-slate-700 dark:text-slate-300">{pkg.name}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      {pkg.severity && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                          pkg.severity === 'critical' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                          'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                        }`}>
                          Severity: {pkg.severity}
                        </span>
                      )}
                      {pkg.budget && pkg.budget > 0 && (
                        <span className="text-[9px] text-slate-400">
                          Budget: Rp {(pkg.budget / 1_000_000).toLocaleString('id-ID')} jt
                        </span>
                      )}

                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Phase3Data({ data }: { data: Record<string, unknown> }) {
  const r = data as { totalFound?: number; articles?: MediaArticle[] };

  if (!r.articles || r.articles.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400 italic">Tidak ditemukan liputan media untuk topik ini.</p>;
  }

  return (
    <div className="space-y-2">
      {r.articles.slice(0, 6).map((article, i) => (
        <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-biru-50 dark:bg-biru-900/20 border border-biru-200 dark:border-biru-800">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-biru-500 shrink-0 mt-0.5">
            <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /><polyline points="22 6 12 13 2 6" />
          </svg>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium text-biru-700 dark:text-biru-300 shrink-0">{article.source}</span>
              <span className="text-[9px] text-slate-400 shrink-0">•</span>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-medium text-slate-600 dark:text-slate-400 hover:text-biru-600 dark:hover:text-biru-400 hover:underline truncate min-w-0"
              >
                {article.title}
              </a>
            </div>
            {article.snippet && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed truncate">{article.snippet}</p>
            )}
          </div>
        </div>
      ))}
      {r.totalFound && r.totalFound > 6 && (
        <p className="text-[10px] text-slate-400 text-center">+{r.totalFound - 6} liputan lainnya</p>
      )}
    </div>
  );
}

export default function AnalysisResult({ phases, synthesis, confidence, onCopy }: AnalysisResultProps) {
  const phaseConfigs = [
    { key: 1, label: 'Data Resmi', source: 'data.go.id' },
    { key: 2, label: 'Deteksi Kejanggalan', source: 'nemesis.assai.id' },
    { key: 3, label: 'Opini Publik', source: 'Multi-Sumber' },
    { key: 4, label: 'Sintesis AI', source: '' },
  ];

  const phaseColors = [
    'border-slate-100 dark:border-slate-800/60',
    'border-slate-100 dark:border-slate-800/60',
    'border-slate-100 dark:border-slate-800/60',
    'border-transparent',
  ];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-md overflow-hidden">
      {phaseConfigs.map(({ key, label, source }) => {
        const p = phases[key];
        if (!p) return null;
        const isDone = p.status === 'done';

        return (
          <div
            key={key}
            className={`phase-in px-4 md:px-6 py-4 md:py-5 ${key < 4 ? 'border-b' : ''} ${phaseColors[key - 1]} ${key === 2 ? 'bg-amber-50/30 dark:bg-amber-900/5' : ''} ${key === 4 ? 'analyze-gradient' : ''}`}
          >
            <PhaseHeader phase={key} label={label} source={source} />

            {isDone && p.data && key === 1 && <Phase1Data data={p.data as Record<string, unknown>} />}
            {isDone && p.data && key === 2 && <Phase2Data data={p.data as Record<string, unknown>} />}
            {isDone && p.data && key === 3 && <Phase3Data data={p.data as Record<string, unknown>} />}

            {isDone && key === 4 && synthesis && (
              <div className="text-sm md:text-[15px] text-slate-700 dark:text-slate-300 space-y-3 leading-relaxed">
                <div className="p-3 md:p-4 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                    {synthesis}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {isDone && key === 4 && (
              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
                {confidence && <ConfidenceBar confidence={confidence} />}
                <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-slate-400" />
                    {Object.values(phases).filter(p2 => p2.status === 'done').length} sumber
                  </span>
                  <span>|</span>
                  <span>Satu putaran</span>
                </div>
              </div>
            )}

            {isDone && key === 4 && (
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 rounded font-medium text-merah-600 dark:text-merah-400 bg-merah-50 dark:bg-merah-950">data.go.id</span>
                <span className="text-[10px] px-2 py-0.5 rounded font-medium text-emas-600 dark:text-emas-400 bg-emas-50 dark:bg-emas-900/30">nemesis.assai.id</span>
                <span className="text-[10px] px-2 py-0.5 rounded font-medium text-biru-600 dark:text-biru-400 bg-biru-50 dark:bg-biru-900/20">Multi-Sumber</span>
              </div>
            )}

            {isDone && key === 4 && (
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {onCopy && (
                    <button onClick={onCopy} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" title="Salin analisis">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Salin
                    </button>
                  )}
                  <button onClick={() => window.print()} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" title="Cetak">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
                    </svg>
                    Cetak
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
