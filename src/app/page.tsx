'use client';

import { useState, useRef, useEffect } from 'react';
import AnalysisResult from '@/components/deep-analyze-message';
import type { PhaseDataMap } from '@/components/deep-analyze-message';

interface StreamEvent {
  type: 'phase-start' | 'status' | 'phase-result' | 'phase-done' | 'chunk' | 'done' | 'error';
  phase?: number;
  label?: string;
  source?: string;
  text?: string;
  data?: Record<string, unknown>;
  confidence?: number | null;
  synthesis?: string;
}

const initialPhases = (): PhaseDataMap => ({
  1: { status: 'loading', label: 'Data Resmi', source: 'data.go.id' },
  2: { status: 'loading', label: 'Deteksi Kejanggalan', source: 'nemesis.assai.id' },
  3: { status: 'loading', label: 'Opini Publik', source: 'Multi-Sumber' },
  4: { status: 'loading', label: 'Sintesis AI', source: '' },
});

export default function Home() {
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [phases, setPhases] = useState<PhaseDataMap | null>(null);
  const [synthesis, setSynthesis] = useState('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [dark, setDark] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const loadingQueryRef = useRef<HTMLParagraphElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('jendela-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored === 'dark' || (!stored && prefersDark);
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  const toggleDark = () => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem('jendela-theme', next ? 'dark' : 'light');
      return next;
    });
  };

  const handleAnalyze = async (q: string) => {
    if (isLoading || !q.trim()) return;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setQuestion(q);
    setIsLoading(true);
    setPhases(null);
    setSynthesis('');
    setConfidence(null);
    setActiveStep(0);

    const p = initialPhases();
    let syn = '';

    const stepTimers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < 4; i++) {
      stepTimers.push(setTimeout(() => setActiveStep(i + 1), 600 + i * 800));
      stepTimers.push(setTimeout(() => {}, 1200 + i * 800));
    }

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q }),
        signal: ac.signal,
      });

      if (!res.ok) {
        setIsLoading(false);
        setConfidence(0);
        syn = 'Terjadi kesalahan saat menghubungi server analisis.';
        setSynthesis(syn);
        Object.keys(p).forEach((k) => { p[Number(k)] = { ...p[Number(k)], status: 'done' }; });
        setPhases({ ...p });
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const event: StreamEvent = JSON.parse(line);

            switch (event.type) {
              case 'phase-start':
                if (event.phase) {
                  p[event.phase] = { status: 'loading', label: event.label || '', source: event.source || '' };
                }
                break;
              case 'phase-result':
                if (event.phase && event.data) {
                  p[event.phase] = { ...p[event.phase], data: event.data };
                }
                break;
              case 'phase-done':
                if (event.phase) {
                  p[event.phase] = { ...p[event.phase], status: 'done' };
                  stepTimers.push(setTimeout(() => setActiveStep(prev => Math.max(prev, event.phase! + 1)), 100));
                }
                break;
              case 'chunk':
                if (event.text) syn += event.text;
                break;
              case 'done':
                setPhases({ ...p });
                setSynthesis(syn);
                setConfidence(event.confidence || null);
                setIsLoading(false);
                return;
              case 'error':
                setIsLoading(false);
                setConfidence(0);
                syn = event.text || 'Terjadi kesalahan';
                setSynthesis(syn);
                Object.keys(p).forEach((k) => { p[Number(k)] = { ...p[Number(k)], status: 'done' }; });
                setPhases({ ...p });
                return;
            }
          } catch {
            continue;
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setIsLoading(false);
      setConfidence(0);
      syn = 'Gagal terhubung ke server analisis.';
      setSynthesis(syn);
      Object.keys(p).forEach((k) => { p[Number(k)] = { ...p[Number(k)], status: 'done' }; });
      setPhases({ ...p });
    } finally {
      stepTimers.forEach(clearTimeout);
      setIsLoading(false);
    }
  };

  const resetAnalysis = () => {
    setQuestion('');
    setIsLoading(false);
    setPhases(null);
    setSynthesis('');
    setConfidence(null);
    setActiveStep(0);
  };

  const copyAnalysis = async () => {
    const text = document.querySelector('#resultCard')?.textContent;
    if (text) {
      await navigator.clipboard.writeText(text);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5 group">
            <img src="/icon.png" alt="Jendela" className="w-8 h-8 rounded-lg object-cover shrink-0" />
            <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">Jendela AI</span>
          </a>

          <div className="flex items-center gap-3">
            {phases && !isLoading && (
              <button onClick={resetAnalysis} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-br from-merah-600 to-emas-600 hover:from-merah-700 hover:to-emas-700 text-white transition-all shadow-sm">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                Analisis Baru
              </button>
            )}
            <button
              onClick={toggleDark}
              className="theme-toggle-btn p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle dark mode"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={dark ? 'hidden' : 'block'}>
                <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={dark ? 'block' : 'hidden'}>
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {!isLoading && !phases && (
        <section className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-12">
          <div className="w-full max-w-3xl mx-auto text-center space-y-6 md:space-y-8">
            <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-2xl overflow-hidden shadow-lg shadow-merah-200/50 dark:shadow-merah-900/30 pulse-glow">
              <img src="/icon.png" alt="Jendela" className="w-full h-full object-cover" />
            </div>

            <div>
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
                <span className="text-merah-600 dark:text-merah-400">Jendela</span>
              </h1>
              <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 mt-3 max-w-2xl mx-auto leading-relaxed">
                Analisis satu putaran. Data resmi <span className="font-medium text-slate-700 dark:text-slate-300">data.go.id</span>, deteksi kejanggalan via <span className="font-medium text-slate-700 dark:text-slate-300">Nemesis</span>, validasi opini publik, dan sintesis AI.
              </p>
            </div>

            <div className="max-w-2xl mx-auto">
              <div className="flex items-end gap-2 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 focus-within:border-merah-400 dark:focus-within:border-merah-500 rounded-2xl px-4 md:px-5 py-3.5 md:py-4 shadow-lg shadow-slate-200/50 dark:shadow-black/30 transition-all duration-200">
                <div className="flex-1">
                  <label htmlFor="analyzeInput" className="sr-only">Masukkan topik analisis</label>
                  <input
                    id="analyzeInput"
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAnalyze(question); }}
                    placeholder="Masukkan topik atau pertanyaan untuk dianalisis..."
                    className="w-full bg-transparent text-sm md:text-base text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none border-none focus:ring-0"
                  />
                </div>
                <button
                  onClick={() => handleAnalyze(question)}
                  className="shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-merah-600 to-emas-600 hover:from-merah-700 hover:to-emas-700 text-white flex items-center justify-center transition-all active:scale-95 shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={isLoading || !question.trim()}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="md:w-5 md:h-5">
                    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              {[
                { text: 'Analisis utang Indonesia 2024', color: 'merah' },
                { text: 'Validasi data kemiskinan', color: 'emas' },
                { text: 'Kualitas udara Jabodetabek', color: 'biru' },
                { text: 'Cross-check data pemilu', color: 'slate' },
              ].map(({ text, color }) => {
                const hoverMap: Record<string, string> = {
                  merah: 'hover:border-merah-300 dark:hover:border-merah-700 hover:text-merah-600 dark:hover:text-merah-400',
                  emas: 'hover:border-emas-300 dark:hover:border-emas-700 hover:text-emas-600 dark:hover:text-emas-400',
                  biru: 'hover:border-biru-300 dark:hover:border-biru-700 hover:text-biru-600 dark:hover:text-biru-400',
                  slate: 'hover:border-slate-300 dark:hover:border-slate-600',
                };
                return (
                  <button
                    key={text}
                    onClick={() => handleAnalyze(text)}
                    className={`chip-hover px-3 py-1.5 rounded-full text-[11px] font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 transition-colors ${hoverMap[color]}`}
                  >
                    {text}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {isLoading && (
        <section className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-12">
          <div className="w-full max-w-3xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-2xl overflow-hidden shadow-lg animate-pulse">
              <img src="/icon.png" alt="Jendela" className="w-full h-full object-cover" />
            </div>

            <div>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Menganalisis...</h2>
              <p ref={loadingQueryRef} className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-lg mx-auto truncate">{question}</p>
            </div>

            <div className="max-w-md mx-auto space-y-4 text-left">
              {[
                { num: 1, label: 'Data Resmi · data.go.id', desc: 'Mengambil data dari portal data terbuka Indonesia...' },
                { num: 2, label: 'Deteksi Kejanggalan · Nemesis', desc: 'Menganalisis anomali dan diskrepansi data...' },
                { num: 3, label: 'Validasi Opini Publik', desc: 'Cross-check media, sosial media, dan sumber lain...' },
                { num: 4, label: 'Sintesis AI', desc: 'Menyusun kesimpulan dan rekomendasi...' },
              ].map((step) => {
                const isDone = activeStep > step.num;
                const isActive = activeStep === step.num;
                let circleColor = 'border-slate-300 dark:border-slate-600 text-slate-300 dark:text-slate-600';
                let textColor = 'text-slate-300 dark:text-slate-600';
                let bgClass = '';
                if (isDone) {
                  if (step.num === 1) { circleColor = 'bg-merah-600 text-white border-merah-600'; textColor = 'text-slate-700 dark:text-slate-300'; }
                  else if (step.num === 2) { circleColor = 'bg-emas-500 text-white border-emas-500'; textColor = 'text-slate-700 dark:text-slate-300'; }
                  else if (step.num === 3) { circleColor = 'bg-biru-500 text-white border-biru-500'; textColor = 'text-slate-700 dark:text-slate-300'; }
                  else { circleColor = 'bg-slate-600 dark:bg-slate-400 text-white border-slate-600 dark:border-slate-400'; textColor = 'text-slate-700 dark:text-slate-300'; }
                } else if (isActive) {
                  if (step.num === 1) { circleColor = 'border-merah-500 text-merah-500'; textColor = 'text-merah-600 dark:text-merah-400'; bgClass = 'animate-pulse'; }
                  else if (step.num === 2) { circleColor = 'border-emas-500 text-emas-500'; textColor = 'text-emas-600 dark:text-emas-400'; bgClass = 'animate-pulse'; }
                  else if (step.num === 3) { circleColor = 'border-biru-500 text-biru-500'; textColor = 'text-biru-600 dark:text-biru-400'; bgClass = 'animate-pulse'; }
                  else { circleColor = 'border-slate-500 text-slate-500'; textColor = 'text-slate-600 dark:text-slate-400'; bgClass = 'animate-pulse'; }
                }

                return (
                  <div key={step.num} className="pipeline-step flex items-center gap-3" style={{ color: textColor }}>
                    <div className={`step-circle w-7 h-7 rounded-full border-2 flex items-center justify-center text-[11px] font-bold shrink-0 transition-all duration-300 ${circleColor} ${bgClass}`}>
                      {isDone ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : step.num}
                    </div>
                    <div className="flex-1">
                      <div className={`text-sm font-medium transition-colors duration-300 ${textColor}`}>{step.label}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{isDone ? 'Selesai' : step.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-1.5">
              <span className="text-sm text-slate-400 dark:text-slate-500">Memproses</span>
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 inline-block" />
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 inline-block" />
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 inline-block" />
            </div>
          </div>
        </section>
      )}

      {phases && !isLoading && (
        <section className="px-4 py-8 md:py-12">
          <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Hasil Analisis</h2>
              <button onClick={resetAnalysis} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-br from-merah-600 to-emas-600 hover:from-merah-700 hover:to-emas-700 text-white transition-all shadow-sm">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                Analisis Baru
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 md:px-5 py-3 md:py-4">
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Pertanyaan</span>
              <p className="text-sm md:text-base text-slate-800 dark:text-slate-200 font-medium mt-1">{question}</p>
            </div>

            <div className="hidden md:flex items-center justify-center gap-0">
              {[
                { num: 1, label: 'Data Resmi', color: 'merah' },
                { num: 2, label: 'Anomali', color: 'emas' },
                { num: 3, label: 'Opini Publik', color: 'biru' },
                { num: 4, label: 'Sintesis', color: 'slate' },
              ].map((step, i) => {
                const isLast = i === 3;
                const colorMap: Record<string, { bg: string; border: string; text: string; circle: string; line: string }> = {
                  merah: { bg: 'bg-merah-50 dark:bg-merah-950', border: 'border-merah-200 dark:border-merah-800', text: 'text-merah-700 dark:text-merah-300', circle: 'bg-merah-600 dark:bg-merah-500', line: 'bg-merah-300 dark:bg-merah-700' },
                  emas: { bg: 'bg-emas-50 dark:bg-emas-900/30', border: 'border-emas-200 dark:border-emas-700', text: 'text-emas-700 dark:text-emas-300', circle: 'bg-emas-500', line: 'bg-emas-300 dark:bg-emas-600' },
                  biru: { bg: 'bg-biru-50 dark:bg-biru-900/20', border: 'border-biru-200 dark:border-biru-800', text: 'text-biru-700 dark:text-biru-300', circle: 'bg-biru-500', line: 'bg-biru-300 dark:bg-biru-700' },
                  slate: { bg: 'bg-slate-100 dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-700', text: 'text-slate-700 dark:text-slate-300', circle: 'bg-slate-600 dark:bg-slate-400', line: 'bg-slate-300 dark:bg-slate-600' },
                };
                const c = colorMap[step.color];
                return (
                  <div key={step.num} className="flex items-center">
                    <div className={`flex items-center gap-2 px-4 py-2 ${i === 0 ? 'rounded-l-lg' : ''} ${isLast ? 'rounded-r-lg' : ''} ${c.bg} ${c.border} border`}>
                      <div className={`w-5 h-5 rounded-full ${c.circle} text-white flex items-center justify-center text-[10px] font-bold`}>
                        {step.num}
                      </div>
                      <span className={`text-xs font-medium ${c.text}`}>{step.label}</span>
                    </div>
                    {!isLast && <div className={`w-6 h-0.5 ${colorMap[step.color].line}`} />}
                  </div>
                );
              })}
            </div>

            <div className="flex md:hidden items-center justify-center gap-1 text-[10px]">
              {[
                { label: 'Data', color: 'merah' },
                { label: 'Anomali', color: 'emas' },
                { label: 'Opini', color: 'biru' },
                { label: 'Sintesis', color: 'slate' },
              ].map((step, i) => {
                const bgMap: Record<string, string> = {
                  merah: 'bg-merah-100 dark:bg-merah-950 text-merah-700 dark:text-merah-300',
                  emas: 'bg-emas-100 dark:bg-emas-900/30 text-emas-700 dark:text-emas-300',
                  biru: 'bg-biru-100 dark:bg-biru-900/20 text-biru-700 dark:text-biru-300',
                  slate: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
                };
                return (
                  <span key={step.label}>
                    <span className={`px-2 py-1 rounded font-medium ${bgMap[step.color]}`}>{step.label}</span>
                    {i < 3 && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline mx-0.5 text-slate-300 dark:text-slate-600"><polyline points="9 18 15 12 9 6" /></svg>
                    )}
                  </span>
                );
              })}
            </div>

            <div id="resultCard">
              <AnalysisResult
                phases={phases}
                synthesis={synthesis}
                confidence={confidence}
                onCopy={copyAnalysis}
              />
            </div>

            <div className="text-center">
              <p className="text-[10px] md:text-xs text-slate-400 dark:text-slate-600">
                Pipeline: <span className="font-medium text-slate-500 dark:text-slate-500">data.go.id</span>
                <span className="mx-1">→</span>
                <span className="font-medium text-slate-500 dark:text-slate-500">nemesis.assai.id</span>
                <span className="mx-1">→</span>
                <span className="font-medium text-slate-500 dark:text-slate-500">Validasi Publik</span>
                <span className="mx-1">→</span>
                <span className="font-medium text-slate-500 dark:text-slate-500">Sintesis AI</span>
              </p>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
