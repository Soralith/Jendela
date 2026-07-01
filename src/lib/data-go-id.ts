const BASE_URL = 'https://data.go.id';

export interface DatasetSummary {
  title: string;
  slug: string;
  organization: string;
  format: string;
  access: string;
  description: string;
}

const stopWords = new Set([
  'berapa', 'yang', 'di', 'dan', 'dengan', 'saja', 'apa', 'bagaimana',
  'kapan', 'siapa', 'mengapa', 'dimana', 'ada', 'tidak', 'atau', 'dari',
  'ini', 'itu', 'ke', 'oleh', 'pada', 'untuk', 'dalam', 'sebagai',
  'tentang', 'bisa', 'tolong', 'saya', 'kami', 'secara', 'tersebut',
  'sudah', 'akan', 'dapat', 'lebih', 'serta', 'telah', 'juga', 'saat',
  'semua', 'setiap', 'seluruh', 'data', 'satu', 'indonesia',
]);

export function scoreRelevance(query: string, dataset: { title: string; description?: string }): number {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
  if (words.length === 0) return 0;

  const title = dataset.title.toLowerCase();
  const desc = (dataset.description || '').toLowerCase();

  let score = 0;
  for (const word of words) {
    if (title.includes(word)) score += 2;
    else if (desc.includes(word)) score += 1;
  }

  if (title.includes(query.toLowerCase())) score += 3;

  return score / words.length;
}

interface DatasetResource {
  format: string;
  url: string;
  name: string;
}

interface DatasetDetail {
  id: string;
  title: string;
  slug: string;
  notes: string;
  organization: string;
  resources: DatasetResource[];
  tags: string[];
  metadata_modified: string;
  source: string;
}

export async function searchDatasets(query: string): Promise<DatasetSummary[]> {
  const url = `${BASE_URL}/dataset?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JendelaAI/1.0)' },
  });
  const html = await res.text();

  const results: DatasetSummary[] = [];
  const seen = new Set<string>();

  let mainStart = html.indexOf('Datasets Found');
  if (mainStart === -1) mainStart = html.indexOf('DatasetsFound');
  if (mainStart === -1) mainStart = 0;
  const mainHtml = html.slice(mainStart);

  const slugRegex = /href="\/dataset\/dataset\/([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = slugRegex.exec(mainHtml)) !== null) {
    const slug = m[1];
    if (seen.has(slug)) continue;
    seen.add(slug);

    const pos = m.index;
    const context = mainHtml.slice(Math.max(0, pos - 3000), pos + 2000);

    const h3s = context.match(/<h3[^>]*>\s*([\s\S]*?)\s*<\/h3>/g);
    const title = h3s
      ? h3s.map((h) => h.replace(/<[^>]*>/g, '').trim()).filter(Boolean).pop() || slug.replace(/-/g, ' ')
      : slug.replace(/-/g, ' ');

    const orgMatch = context.match(
      /(?:Kementerian|Badan|Lembaga|Pemerintah|Dinas|Pusdatin|Otoritas|Sekretariat)[^<]{5,80}?(?:\s*<|$)/
    );
    const organization = orgMatch ? orgMatch[0].trim() : '';

    const descMatch = context.match(/<h3[^>]*>[\s\S]*?<\/h3>[\s\S]{0,500}?<p[^>]*>([\s\S]*?)<\/p>/);
    const description = descMatch ? descMatch[1].replace(/<[^>]*>/g, '').trim() : '';

    const fmtMatch = context.match(/\b(CSV|XLSX|XLS|JSON|PDF)\b/i);
    const format = fmtMatch ? fmtMatch[1].toUpperCase() : '';
    const access = context.includes('Terbatas') ? 'Terbatas' : 'Terbuka';

    if (title && title.length > 3) {
      results.push({ title, slug, organization, format, access, description });
    }

    if (results.length >= 5) break;
  }

  return results;
}

export async function getDatasetDetail(slug: string): Promise<DatasetDetail | null> {
  const url = `${BASE_URL}/dataset/dataset/${slug}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JendelaAI/1.0)' },
  });
  const html = await res.text();

  let title = slug.replace(/-/g, ' ');
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (titleMatch) {
    title = titleMatch[1].replace(/<[^>]*>/g, '').trim();
  }

  let notes = '';
  const notesMatch = html.match(
    /Banyaknya[^<]{10,300}|Jumlah[^<]{10,300}|Persentase[^<]{10,300}|Proporsi[^<]{10,300}|Data[^<]{10,300}/
  );
  if (notesMatch) {
    notes = notesMatch[0].trim();
  }

  let organization = '';
  const orgMatch = html.match(
    /(?:Kementerian|Badan|Lembaga|Pemerintah|Dinas|Pusdatin|Otoritas|Sekretariat)[^<]{5,80}(?=\s*<)/
  );
  if (orgMatch) {
    organization = orgMatch[0].trim();
  }

  const tags: string[] = [];
  const tagRegex = /class="[^"]*">([^<]+)<\/span><\/div><div class="[^"]*">(?=.*?pengadaan|pendidikan|ekonomi|kesehatan|sosial|data)/gi;

  const source = `${BASE_URL}/dataset/dataset/${slug}`;

  const resources: DatasetResource[] = [];
  const patterns = [
    /\\"download\\":\\"([^"]+\.(xlsx|csv|json))\\"/gi,
    /"download":"([^"]+\.(xlsx|csv|json))"/gi,
    /\\"url\\":\\"([^"]+\.(xlsx|csv|json))\\"/gi,
    /"url":"([^"]+\.(xlsx|csv|json))"/gi,
  ];
  const fmts: Record<string, string> = {};
  for (const regex of patterns) {
    let rm: RegExpExecArray | null;
    while ((rm = regex.exec(html)) !== null) {
      const fmt = rm[2].toUpperCase();
      if (!fmts[fmt]) {
        fmts[fmt] = rm[1];
        resources.push({
          format: fmt,
          url: rm[1].replace(/\\u0026/g, '&'),
          name: `${title} (${fmt})`,
        });
      }
    }
  }

  return {
    id: slug,
    title,
    slug,
    notes,
    organization,
    resources,
    tags,
    metadata_modified: '',
    source,
  };
}

export async function downloadData(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JendelaAI/1.0)' },
  });
  return res.arrayBuffer();
}
