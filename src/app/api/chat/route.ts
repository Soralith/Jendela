import { searchDatasets, getDatasetDetail, downloadData, scoreRelevance } from '@/lib/data-go-id';
import type { DatasetSummary } from '@/lib/data-go-id';
import { parseXlsx, parseCsv } from '@/lib/xlsx-parser';
import { askGemini, askGeminiFallback, extractSearchTerms } from '@/lib/gemini';

export const maxDuration = 60;

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

        const safeSend = (data: unknown) => {
          if (closed) return;
          send(controller, encoder, data);
        };

        const safeClose = () => {
          if (closed) return;
          closed = true;
          finish(controller);
        };

        try {
          safeSend({ type: 'status', text: 'Menganalisis pertanyaan...' });

          const searchTerms = await extractSearchTerms(message);
          const allTerms = [message, ...searchTerms.filter(t => t.toLowerCase() !== message.toLowerCase())];

          const seenSlugs = new Set<string>();
          const rankedCandidates: { dataset: DatasetSummary; score: number }[] = [];

          for (const term of allTerms) {
            safeSend({ type: 'status', text: `🔍 Mencoba: ${term}` });

            const datasets = await searchDatasets(term);

            for (const dataset of datasets) {
              if (seenSlugs.has(dataset.slug)) continue;
              seenSlugs.add(dataset.slug);

              const score = scoreRelevance(message, dataset);
              rankedCandidates.push({ dataset, score });
            }
          }

          let succeeded = false;

          if (rankedCandidates.length === 0) {
            safeSend({
              type: 'status',
              text: 'Tidak menemukan dataset yang sesuai dengan kata kunci apapun.',
            });
          } else {
            rankedCandidates.sort((a, b) => b.score - a.score);

            for (const { dataset } of rankedCandidates) {
            safeSend({
              type: 'status',
              text: `Dataset ditemukan: ${dataset.title}`,
            });

            const detail = await getDatasetDetail(dataset.slug);

            if (!detail || detail.resources.length === 0) {
              safeSend({
                type: 'status',
                text: `"${dataset.title}" tidak memiliki file yang bisa diunduh. Coba dataset lain...`,
              });
              continue;
            }

            const preferredFormats = ['JSON', 'CSV', 'XLSX', 'XLS'];
            let chosenResource = detail.resources[0];
            for (const fmt of preferredFormats) {
              const found = detail.resources.find(
                (r) => r.format.toUpperCase() === fmt && r.url
              );
              if (found) {
                chosenResource = found;
                break;
              }
            }

            safeSend({
              type: 'status',
              text: `Mengunduh data (${chosenResource.format}) dari ${detail.organization}...`,
            });

            const buffer = await downloadData(chosenResource.url);

            safeSend({ type: 'status', text: 'Memproses data...' });

            let parsed;
            const fmt = chosenResource.format.toUpperCase();
            if (fmt === 'CSV') {
              parsed = await parseCsv(buffer);
            } else {
              parsed = await parseXlsx(buffer);
            }

            if (parsed.totalRows === 0) {
              safeSend({
                type: 'status',
                text: `"${dataset.title}" gagal diproses. Coba dataset lain...`,
              });
              continue;
            }

            succeeded = true;

            const dataPreview = {
              dataset: detail.title,
              organization: detail.organization,
              description: detail.notes,
              totalRows: parsed.totalRows,
              headers: parsed.headers,
              rows: parsed.rows.slice(0, 50),
              tags: detail.tags,
              source: detail.source || `https://data.go.id/dataset/dataset/${detail.slug}`,
            };

            const dataContext = JSON.stringify(dataPreview, null, 2);

            safeSend({ type: 'status', text: 'Menganalisis dengan AI...' });

            let answer = '';
            for await (const chunk of askGemini(message, dataContext)) {
              answer += chunk;
              safeSend({ type: 'chunk', text: chunk });
            }

            safeSend({
              type: 'done',
              text: answer,
              metadata: {
                title: detail.title,
                organization: detail.organization,
                slug: detail.slug,
                source: dataPreview.source,
                totalRows: parsed.totalRows,
              },
            });

            break;
          }
          }

          if (!succeeded) {
            safeSend({
              type: 'status',
              text: 'Dataset tidak ditemukan di data.go.id. Mencoba menjawab berdasarkan pengetahuan...',
            });

            let fallbackAnswer = '';
            for await (const chunk of askGeminiFallback(message)) {
              fallbackAnswer += chunk;
              safeSend({ type: 'chunk', text: chunk });
            }

            safeSend({ type: 'done', text: fallbackAnswer });
          }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan';
        safeSend({
          type: 'error',
          text: `Gagal memproses pertanyaan: ${errorMessage}`,
        });
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
