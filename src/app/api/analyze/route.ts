import { searchDatasets, getDatasetDetail, downloadData } from '@/lib/data-go-id';
import { parseXlsx, parseCsv } from '@/lib/xlsx-parser';
import { askGemini, askGeminiFallback, extractSearchTerms } from '@/lib/gemini';
import { searchAnomalies } from '@/lib/nemesis';
import { searchPublicOpinion } from '@/lib/web-search';

export const maxDuration = 120;

function send(controller: ReadableStreamDefaultController, encoder: TextEncoder, data: unknown) {
  try {
    controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
  } catch {
  }
}

function finish(controller: ReadableStreamDefaultController) {
  try {
    controller.close();
  } catch {
  }
}

export async function POST(request: Request) {
  try {
    const { message } = await request.json();
    if (!message || typeof message !== 'string') {
      return Response.json({ error: 'Message is required' }, { status: 400 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let closed = false;
        const safeSend = (data: unknown) => { if (!closed) send(controller, encoder, data); };
        const safeClose = () => { if (!closed) { closed = true; finish(controller); } };

        try {
          safeSend({ type: 'phase-start', phase: 1, label: 'Data Resmi', source: 'data.go.id' });
          safeSend({ type: 'status', text: 'Menganalisis pertanyaan...' });

          const searchTerms = await extractSearchTerms(message);
          const allTerms = [message, ...searchTerms.filter(t => t.toLowerCase() !== message.toLowerCase())];

          const seenSlugs = new Set<string>();
          const rankedCandidates: { slug: string; title: string; score: number }[] = [];

          for (const term of allTerms) {
            const datasets = await searchDatasets(term);
            for (const d of datasets) {
              if (seenSlugs.has(d.slug)) continue;
              seenSlugs.add(d.slug);
              const words = message.toLowerCase().split(/\s+/).filter(w => w.length > 2);
              let score = 0;
              const title = d.title.toLowerCase();
              for (const w of words) { if (title.includes(w)) score += 2; }
              if (d.description) { for (const w of words) { if (d.description.toLowerCase().includes(w)) score += 1; } }
              rankedCandidates.push({ slug: d.slug, title: d.title, score });
            }
          }

          let phase1Data: Record<string, unknown> | null = null;

          if (rankedCandidates.length > 0) {
            rankedCandidates.sort((a, b) => b.score - a.score);

            for (const candidate of rankedCandidates) {
              safeSend({ type: 'status', text: `Dataset: ${candidate.title}` });
              const detail = await getDatasetDetail(candidate.slug);
              if (!detail || detail.resources.length === 0) continue;

              const preferredFormats = ['JSON', 'CSV', 'XLSX', 'XLS'];
              let chosen = detail.resources[0];
              for (const fmt of preferredFormats) {
                const found = detail.resources.find(r => r.format.toUpperCase() === fmt && r.url);
                if (found) { chosen = found; break; }
              }

              try {
                const buffer = await downloadData(chosen.url);
                const parsed = chosen.format.toUpperCase() === 'CSV' ? await parseCsv(buffer) : await parseXlsx(buffer);
                if (parsed.totalRows > 0) {
                  phase1Data = {
                    title: detail.title,
                    organization: detail.organization,
                    description: detail.notes,
                    totalRows: parsed.totalRows,
                    headers: parsed.headers,
                    rows: parsed.rows.slice(0, 30),
                    source: detail.source || `https://data.go.id/dataset/dataset/${detail.slug}`,
                  };
                  break;
                }
              } catch {
                continue;
              }
            }
          }

          safeSend({ type: 'phase-result', phase: 1, data: phase1Data ? { found: true, ...phase1Data } : { found: false } });
          safeSend({ type: 'phase-done', phase: 1 });

          safeSend({ type: 'phase-start', phase: 2, label: 'Deteksi Kejanggalan', source: 'nemesis.assai.id' });
          safeSend({ type: 'status', text: 'Mencari anomali pengadaan...' });

          let phase2Data: Record<string, unknown> | null = null;
          try {
            const nemesis = await searchAnomalies(message);
            phase2Data = {
              totalFlagged: nemesis.totalFlagged,
              totalPotentialWaste: nemesis.totalPotentialWaste,
              topRegions: nemesis.topRegions.map(r => ({
                name: r.region.displayName,
                province: r.region.provinceName,
                flaggedPackages: r.region.totalFlaggedPackages,
                potentialWaste: r.region.totalPotentialWaste,
                avgRiskScore: r.region.avgRiskScore,
                packages: r.flagged.map(p => ({
                  name: p.packageName,
                  budget: p.budget,
                  severity: p.audit?.severity || 'unknown',
                  riskScore: p.audit?.riskScore || 0,
                  satker: p.satker || '',
                })),
              })),
            };
          } catch {
            phase2Data = { found: false };
          }

          safeSend({ type: 'phase-result', phase: 2, data: phase2Data });
          safeSend({ type: 'phase-done', phase: 2 });

          safeSend({ type: 'phase-start', phase: 3, label: 'Opini Publik', source: 'Multi-Sumber' });
          safeSend({ type: 'status', text: 'Mencari liputan media dan opini publik...' });

          let phase3Data: Record<string, unknown> | null = null;
          try {
            const opinion = await searchPublicOpinion(message);
            phase3Data = {
              totalFound: opinion.totalFound,
              articles: opinion.news.map(n => ({
                title: n.title,
                source: n.source,
                snippet: n.snippet,
                url: n.url,
              })),
            };
          } catch {
            phase3Data = { found: false };
          }

          safeSend({ type: 'phase-result', phase: 3, data: phase3Data });
          safeSend({ type: 'phase-done', phase: 3 });

          safeSend({ type: 'phase-start', phase: 4, label: 'Sintesis AI', source: '' });
          safeSend({ type: 'status', text: 'Menyintesis semua temuan...' });

          const synthesisPrompt = `Kamu adalah asisten AI Jendela Deep Analyze. Tugasmu adalah menyintesis temuan dari 3 fase analisis dan memberikan kesimpulan mendalam.

PERTANYAAN PENGGUNA: ${message}

--- FASE 1: DATA RESMI (data.go.id) ---
${JSON.stringify(phase1Data || { found: false, note: 'Tidak ada dataset yang ditemukan' }, null, 2)}

--- FASE 2: DETEKSI KEJANGGALAN (Nemesis) ---
${JSON.stringify(phase2Data || { found: false, note: 'Data Nemesis tidak tersedia' }, null, 2)}

--- FASE 3: OPINI PUBLIK ---
${JSON.stringify(phase3Data || { found: false, note: 'Data opini publik tidak tersedia' }, null, 2)}

Tugasmu:
1. Sintesis semua temuan dari ketiga fase di atas
2. Identifikasi kejanggalan, inkonsistensi, atau pola menarik antar sumber
3. Berikan kesimpulan yang balanced, jangan bias
4. Akhiri dengan confidence score (0-100%) yang mencerminkan seberapa yakin kamu dengan kesimpulan ini, dengan format: "Confidence: X%"

Gunakan bahasa Indonesia yang santai tapi profesional. RESPON DALAM BAHASA INDONESIA.`;

          let synthesis = '';
          try {
            for await (const chunk of askGemini(message, `SISTEM: ${synthesisPrompt}`)) {
              synthesis += chunk;
              safeSend({ type: 'chunk', text: chunk });
            }
          } catch {
            for await (const chunk of askGeminiFallback(message)) {
              synthesis += chunk;
              safeSend({ type: 'chunk', text: chunk });
            }
          }

          const confMatch = synthesis.match(/Confidence:\s*(\d+)/i);
          const confidence = confMatch ? parseInt(confMatch[1]) : null;

          safeSend({ type: 'phase-result', phase: 4, data: { synthesis, confidence } });
          safeSend({ type: 'phase-done', phase: 4 });

          safeSend({ type: 'done', confidence, synthesis });
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan';
          safeSend({ type: 'error', text: errorMessage });
        } finally {
          safeClose();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan';
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
