const API_BASE =
  process.env.NEMESIS_API_URL ||
  'https://nemesis-azure-a4fwd5fbgfb9fadv.indonesiacentral-01.azurewebsites.net/api';

export interface NemesisRegion {
  regionKey: string;
  code: string;
  provinceName: string;
  regionName: string;
  displayName: string;
  totalPackages: number;
  totalPriorityPackages: number;
  totalFlaggedPackages: number;
  totalPotentialWaste: number;
  totalBudget: number;
  avgRiskScore: number;
  maxRiskScore: number;
  dominantOwnerType: string;
}

export interface NemesisPackage {
  id: string;
  sourceId: number;
  packageName: string;
  ownerName: string;
  ownerType: string;
  satker: string;
  budget: number;
  fundingSource: string;
  procurementType: string;
  audit: {
    schemaVersion: string;
    severity: string;
    riskScore: number;
    anomalyFlags: string[];
    labels: string[];
  };
}

interface BootstrapData {
  summary: {
    totalPackages: number;
    totalPriorityPackages: number;
    totalPotentialWaste: number;
    totalBudget: number;
  };
  regions: NemesisRegion[];
}

let bootstrapCache: BootstrapData | null = null;
let cacheTime = 0;

async function getBootstrap(): Promise<BootstrapData> {
  if (bootstrapCache && Date.now() - cacheTime < 300_000) return bootstrapCache;
  const res = await fetch(`${API_BASE}/bootstrap`, {
    headers: { 'User-Agent': 'JendelaAI/1.0' },
  });
  const data = await res.json();
  bootstrapCache = {
    summary: data.summary,
    regions: data.regions,
  };
  cacheTime = Date.now();
  return bootstrapCache;
}

export async function searchAnomalies(
  query: string
): Promise<{
  totalFlagged: number;
  totalPotentialWaste: number;
  topRegions: { region: NemesisRegion; relevance: number; flagged: NemesisPackage[] }[];
}> {
  const { summary, regions } = await getBootstrap();
  const queryTerms = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);

  const stopWords = new Set([
    'berapa', 'yang', 'dengan', 'saja', 'apa', 'bagaimana', 'kapan',
    'siapa', 'ada', 'tidak', 'atau', 'dari', 'ini', 'itu', 'untuk',
    'data', 'satu', 'indonesia', 'tolong', 'coba', 'bisa', 'saya',
  ]);

  const meaningful = queryTerms.filter((t) => !stopWords.has(t));
  if (meaningful.length === 0) meaningful.push(...queryTerms);

  const scoredRegions = regions
    .map((r) => {
      const haystack = `${r.displayName} ${r.provinceName} ${r.regionName} ${r.dominantOwnerType}`.toLowerCase();
      let score = 0;
      for (const term of meaningful) {
        if (haystack.includes(term)) score += 2;
        if (r.provinceName.toLowerCase().includes(term)) score += 1;
      }
      if (r.totalFlaggedPackages > 0) score += 0.5;
      if (r.totalPotentialWaste > 1_000_000_000) score += 0.3;
      if (r.avgRiskScore > 1.5) score += 0.3;
      return { region: r, relevance: score };
    })
    .filter((r) => r.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 5);

  const topRegions = await Promise.all(
    scoredRegions.map(async ({ region, relevance }) => {
      try {
        const res = await fetch(
          `${API_BASE}/regions/${region.regionKey}/packages?page=1&size=30`,
          { headers: { 'User-Agent': 'JendelaAI/1.0' } }
        );
        const data = await res.json();
        const items: NemesisPackage[] = data.items || [];
        const flagged = items.filter(
          (p) =>
            p.audit?.severity === 'high' ||
            p.audit?.severity === 'critical' ||
            p.audit?.riskScore > 0.7 ||
            (p.audit?.anomalyFlags && p.audit.anomalyFlags.length > 0)
        );
        const queryMatched = items.filter((p) => {
          const name = p.packageName.toLowerCase();
          return meaningful.some((t) => name.includes(t));
        });
        const combined = [...new Map(
          [...flagged, ...queryMatched].map((p) => [p.id, p])
        ).values()];
        return {
          region,
          relevance,
          flagged: combined.slice(0, 8),
        };
      } catch {
        return { region, relevance, flagged: [] };
      }
    })
  );

  const totalFlagged = topRegions.reduce((s, r) => s + r.region.totalFlaggedPackages, 0);
  const totalPotentialWaste = topRegions.reduce((s, r) => s + r.region.totalPotentialWaste, 0);

  return { totalFlagged, totalPotentialWaste, topRegions };
}
