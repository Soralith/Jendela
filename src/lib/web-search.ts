export interface NewsItem {
  title: string;
  source: string;
  snippet: string;
  url: string;
  date: string;
}

export interface PublicOpinionResult {
  news: NewsItem[];
  totalFound: number;
}

export async function searchPublicOpinion(query: string): Promise<PublicOpinionResult> {
  const news: NewsItem[] = [];

  const sources = [
    { name: 'Google News', url: `https://news.google.com/rss/search?q=${encodeURIComponent(query)}+Indonesia&hl=id&gl=ID&ceid=ID:id` },
  ];

  for (const source of sources) {
    try {
      const res = await fetch(source.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JendelaAI/1.0)' },
        signal: AbortSignal.timeout(8000),
      });
      const xml = await res.text();

      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let m: RegExpExecArray | null;
      while ((m = itemRegex.exec(xml)) !== null) {
        const item = m[1];
        const title = item.match(/<title>([^<]*)<\/title>/)?.[1] || '';
        const link = item.match(/<link>([^<]*)<\/link>/)?.[1] || '';
        const snippet = item.match(/<description[^>]*>([^<]*)<\/description>/)?.[1] || '';
        const pubDate = item.match(/<pubDate>([^<]*)<\/pubDate>/)?.[1] || '';

        if (title) {
          news.push({
            title: title.replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
            source: source.name,
            snippet: snippet.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, '').trim().slice(0, 200),
            url: link,
            date: pubDate,
          });
        }
      }
    } catch {
      continue;
    }
  }

  return {
    news: news.slice(0, 8),
    totalFound: news.length,
  };
}
