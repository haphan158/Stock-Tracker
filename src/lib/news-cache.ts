import { logger } from '@/src/lib/logger';

/**
 * Thin wrapper around Finnhub's free-tier /company-news endpoint with an
 * in-memory TTL cache so interactive navigation doesn't burn the 60/min
 * quota on repeat opens of the same symbol.
 */

const FRESH_TTL_MS = 10 * 60_000; // 10 minutes

export interface NewsArticle {
  id: string;
  headline: string;
  source: string;
  summary: string;
  url: string;
  image: string | null;
  datetime: string;
  category: string;
}

interface CacheEntry {
  articles: NewsArticle[];
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<NewsArticle[]>>();

function apiKey(): string | null {
  const key = process.env.FINNHUB_API_KEY;
  return key && key.trim().length > 0 ? key : null;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface FinnhubNewsRow {
  id: number;
  category: string;
  datetime: number;
  headline: string;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

async function fetchFromFinnhub(symbol: string): Promise<NewsArticle[]> {
  const key = apiKey();
  if (!key) return [];

  // Finnhub's /company-news needs a window; use the last 14 days for a nice
  // mix of recency and volume on symbols with fewer headlines (e.g. small-caps).
  const to = new Date();
  const from = new Date(Date.now() - 14 * 24 * 60 * 60_000);
  const url =
    `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}` +
    `&from=${formatDate(from)}&to=${formatDate(to)}&token=${encodeURIComponent(key)}`;

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Finnhub company-news ${res.status}`);
  }
  const rows = (await res.json()) as FinnhubNewsRow[];
  return rows
    .filter((r) => r && r.headline && r.url)
    .slice(0, 20)
    .map<NewsArticle>((r) => ({
      id: String(r.id),
      headline: r.headline,
      source: r.source || 'Unknown',
      summary: r.summary ?? '',
      url: r.url,
      image: r.image ? r.image : null,
      datetime: new Date(r.datetime * 1000).toISOString(),
      category: r.category ?? '',
    }));
}

function coalesce(symbol: string): Promise<NewsArticle[]> {
  const existing = inflight.get(symbol);
  if (existing) return existing;
  const promise = fetchFromFinnhub(symbol)
    .then((articles) => {
      cache.set(symbol, { articles, fetchedAt: Date.now() });
      return articles;
    })
    .catch((error) => {
      logger.warn({ err: error, symbol }, '[news-cache] failed to fetch company news');
      return [] as NewsArticle[];
    })
    .finally(() => inflight.delete(symbol));
  inflight.set(symbol, promise);
  return promise;
}

export async function getCompanyNews(symbol: string): Promise<NewsArticle[]> {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) return [];
  const now = Date.now();
  const entry = cache.get(normalized);
  if (entry && now - entry.fetchedAt < FRESH_TTL_MS) return entry.articles;
  return coalesce(normalized);
}

export function isNewsConfigured(): boolean {
  return apiKey() !== null;
}
