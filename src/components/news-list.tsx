'use client';

import { ExternalLink } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { useStockNews } from '@/src/hooks/useStockDetail';

export interface NewsListProps {
  symbol: string;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diffMinutes = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function NewsList({ symbol }: NewsListProps) {
  const { data, isLoading, error } = useStockNews(symbol);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Latest news</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-muted h-14 animate-pulse rounded" />
            ))}
          </div>
        ) : error ? (
          <p className="text-destructive text-sm">Couldn&apos;t load news right now.</p>
        ) : !data?.configured ? (
          <p className="text-muted-foreground text-sm">
            Company news requires a Finnhub API key. Set{' '}
            <code className="font-mono">FINNHUB_API_KEY</code> to enable this panel.
          </p>
        ) : data.articles.length === 0 ? (
          <p className="text-muted-foreground text-sm">No recent headlines for {symbol}.</p>
        ) : (
          <ul className="divide-border divide-y" aria-label={`Recent news for ${symbol}`}>
            {data.articles.slice(0, 10).map((article) => (
              <li key={article.id} className="py-3 first:pt-0 last:pb-0">
                <a
                  href={article.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="group block"
                >
                  <div className="text-foreground group-hover:text-primary text-sm font-medium transition-colors">
                    {article.headline}
                    <ExternalLink className="ml-1 inline h-3 w-3 opacity-60" aria-hidden />
                  </div>
                  <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                    <span>{article.source}</span>
                    <span aria-hidden>·</span>
                    <span>{formatRelative(article.datetime)}</span>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
