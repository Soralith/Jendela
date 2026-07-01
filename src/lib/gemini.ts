import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
].filter((k): k is string => typeof k === 'string' && k.length > 0);

if (API_KEYS.length === 0) {
  throw new Error(
    'API HILANGGG'
  );
}

function getClient(apiKey: string) {
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
}

async function* generateFromPrompt(fullPrompt: string): AsyncGenerator<string> {
  let lastError: Error | null = null;

  for (const key of API_KEYS) {
    try {
      const model = getClient(key);
      const result = await model.generateContentStream(fullPrompt);

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield text;
        }
      }
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Unknown error');
    }
  }

  throw lastError || new Error('Semua Gemini API key gagal, limit kayaknya yak');
}

export async function* askGemini(
  question: string,
  dataContext: string
): AsyncGenerator<string> {
  const systemPrompt = `Kamu adalah asisten AI yang membantu menjawab pertanyaan berdasarkan data pemerintah Indonesia dari Portal Satu Data Indonesia (data.go.id).

Gunakan data yang diberikan untuk menjawab pertanyaan. Jika data tidak cukup untuk menjawab, jelaskan keterbatasannya.

Sertakan informasi sumber data (organisasi, dataset, tahun) dalam jawabanmu.
Gunakan bahasa Indonesia yang baik dan benar.
Jika data berbentuk tabel, sajikan dalam format yang mudah dibaca.`;

  const prompt = `${systemPrompt}

DATA:
${dataContext}

PERTANYAAN:
${question}

JAWABAN:`;

  yield* generateFromPrompt(prompt);
}

export async function* askGeminiFallback(
  question: string
): AsyncGenerator<string> {
  const systemPrompt = `Kamu adalah asisten AI bernama Jendela yang membantu menjawab pertanyaan tentang data Indonesia.

Pengguna bertanya tentang data dari portal data.go.id, tetapi kamu tidak menemukan dataset yang relevan atau datanya tidak bisa diakses di portal tersebut.

Sampaikan dengan ramah bahwa kamu belum menemukan data spesifiknya di data.go.id. Setelah itu, berikan informasi yang kamu ketahui berdasarkan pengetahuan umummu, bisa berupa fakta umum, penjelasan konsep, atau informasi terkait lainnya.

Panduan:
- Awali kalimat pertama dengan "Wah, saya belum menemukan dataset yang cocok di data.go.id untuk pertanyaan ini."
- Gunakan bahasa Indonesia yang santai dan ramah (seperti ngobrol dengan teman)
- Akui dengan jujur kalau kamu memang tidak tahu jawabannya
- Jangan membuat informasi palsu`;

  const prompt = `${systemPrompt}

PERTANYAAN PENGGUNA:
${question}

JAWABAN:`;

  yield* generateFromPrompt(prompt);
}

const stopWords = new Set([
  'berapa', 'yang', 'di', 'dan', 'dengan', 'saja', 'apa', 'bagaimana',
  'kapan', 'siapa', 'mengapa', 'dimana', 'ada', 'tidak', 'atau', 'dari',
  'ini', 'itu', 'ke', 'oleh', 'pada', 'untuk', 'dalam', 'sebagai',
  'tentang', 'bisa', 'tolong', 'saya', 'kami', 'secara', 'tersebut',
  'sudah', 'akan', 'dapat', 'lebih', 'serta', 'telah', 'juga', 'saat',
  'semua', 'setiap', 'seluruh', 'tolong', 'coba', 'carikan', 'data',
]);

function fallbackExtractTerms(query: string): string[] {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 1 && !stopWords.has(w));
  if (words.length === 0) return [query];

  const terms: string[] = [];

  if (words.length >= 2) terms.push(words.join(' '));

  for (let i = 0; i <= words.length - 3; i++) {
    terms.push(words.slice(i, i + 3).join(' '));
  }

  for (let i = 0; i <= words.length - 2; i++) {
    terms.push(words.slice(i, i + 2).join(' '));
  }

  terms.push(...[...words].sort((a, b) => b.length - a.length));

  return [...new Set(terms)].slice(0, 6);
}

export async function extractSearchTerms(query: string): Promise<string[]> {
  for (const key of API_KEYS) {
    try {
      const model = getClient(key);

      const prompt = `Buatkan 4-6 kata kunci pencarian pendek (maksimal 4 kata) dalam Bahasa Indonesia untuk mencari dataset di portal data.go.id yang paling relevan dengan pertanyaan berikut:

Pertanyaan: "${query}"

Aturan:
- Setiap kata kunci maksimal 4 kata
- Bahasa Indonesia
- Konkret dan spesifik, gunakan istilah yang mungkin muncul di judul dataset
- Prioritaskan yang paling spesifik di awal
- Variasikan: coba sinonim atau istilah terkait untuk cakupan lebih luas

Output HARUS dalam format JSON array of strings, contoh:
["SLB fasilitas listrik", "jumlah SLB", "sekolah luar biasa", "pendidikan khusus", "sarana prasarana sekolah"]

Hanya output JSON, tanpa teks lain.`;

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();

      const jsonMatch = text.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const terms: string[] = JSON.parse(jsonMatch[0]);
        if (Array.isArray(terms) && terms.length > 0) {
          return terms.slice(0, 6).map(t => t.trim()).filter(Boolean);
        }
      }
    } catch {
      continue;
    }
  }

  return fallbackExtractTerms(query);
}
