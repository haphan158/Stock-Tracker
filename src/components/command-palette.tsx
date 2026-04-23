'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import { BarChart3, Bell, Briefcase, Eye, Search, Settings, TrendingUp } from 'lucide-react';

import { useDebouncedValue } from '@/src/hooks/useDebouncedValue';
import { useStockSearch } from '@/src/hooks/useStocks';
import { formatCurrency, formatPercentage } from '@/src/lib/utils';

type NavItem = {
  kind: 'nav';
  id: string;
  label: string;
  hint: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

type StockItem = {
  kind: 'stock';
  id: string;
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
};

type Item = NavItem | StockItem;

const NAV_ITEMS: NavItem[] = [
  { kind: 'nav', id: 'nav-dash', label: 'Dashboard', hint: 'Home', href: '/', icon: TrendingUp },
  {
    kind: 'nav',
    id: 'nav-portfolio',
    label: 'Portfolio',
    hint: 'Holdings',
    href: '/portfolio',
    icon: Briefcase,
  },
  {
    kind: 'nav',
    id: 'nav-watchlist',
    label: 'Watchlist',
    hint: 'Starred stocks',
    href: '/watchlist',
    icon: Eye,
  },
  {
    kind: 'nav',
    id: 'nav-analytics',
    label: 'Analytics',
    hint: 'Charts',
    href: '/analytics',
    icon: BarChart3,
  },
  {
    kind: 'nav',
    id: 'nav-alerts',
    label: 'Alerts',
    hint: 'Price alerts',
    href: '/alerts',
    icon: Bell,
  },
  {
    kind: 'nav',
    id: 'nav-settings',
    label: 'Settings',
    hint: 'Preferences',
    href: '/settings',
    icon: Settings,
  },
];

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const debounced = useDebouncedValue(query.trim(), 200);
  const { data: searchData } = useStockSearch(debounced);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K always opens.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      // `/` opens when not already typing in a field.
      if (!open && e.key === '/' && !isEditable(e.target)) {
        e.preventDefault();
        setOpen(true);
      }
      if (open && e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setActiveIndex(0);
      // Focus on the next frame so the input exists in the DOM first.
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQuery('');
    }
  }, [open]);

  const filteredNav = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NAV_ITEMS;
    return NAV_ITEMS.filter((n) => n.label.toLowerCase().includes(q));
  }, [query]);

  const stockItems: StockItem[] = useMemo(() => {
    if (!searchData || debounced.length === 0) return [];
    return searchData.slice(0, 8).map((s) => ({
      kind: 'stock',
      id: `stock-${s.symbol}`,
      symbol: s.symbol,
      name: s.name,
      price: s.currentPrice,
      changePercent: s.changePercent,
    }));
  }, [searchData, debounced]);

  const items: Item[] = useMemo(() => [...filteredNav, ...stockItems], [filteredNav, stockItems]);

  useEffect(() => {
    if (activeIndex >= items.length) setActiveIndex(0);
  }, [items.length, activeIndex]);

  const activate = useCallback(
    (item: Item) => {
      setOpen(false);
      if (item.kind === 'nav') {
        router.push(item.href);
      } else {
        router.push(`/stocks/${encodeURIComponent(item.symbol)}`);
      }
    },
    [router],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = items[activeIndex];
      if (item) activate(item);
      else if (query.trim()) {
        // No match — treat the query as a literal ticker.
        router.push(`/stocks/${encodeURIComponent(query.trim().toUpperCase())}`);
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  useEffect(() => {
    // Keep the active item visible as the user arrows through.
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="bg-card border-border w-full max-w-xl overflow-hidden rounded-lg border shadow-2xl">
        <div className="border-border flex items-center gap-2 border-b px-3 py-2">
          <Search className="text-muted-foreground h-4 w-4" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search stocks or jump to a page…"
            aria-label="Command palette search"
            className="text-foreground placeholder:text-muted-foreground h-9 flex-1 bg-transparent outline-none"
          />
          <kbd className="text-muted-foreground hidden rounded border px-1.5 py-0.5 text-xs sm:inline">
            Esc
          </kbd>
        </div>
        <ul
          ref={listRef}
          role="listbox"
          aria-label="Results"
          className="max-h-80 overflow-y-auto py-1"
        >
          {items.length === 0 ? (
            <li className="text-muted-foreground px-4 py-6 text-center text-sm">
              {query.trim()
                ? `Press Enter to open “${query.trim().toUpperCase()}”.`
                : 'Start typing to search.'}
            </li>
          ) : (
            items.map((item, index) => {
              const active = index === activeIndex;
              if (item.kind === 'nav') {
                const Icon = item.icon;
                return (
                  <li
                    key={item.id}
                    role="option"
                    aria-selected={active}
                    data-active={active}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      activate(item);
                    }}
                    className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm ${
                      active ? 'bg-accent text-accent-foreground' : 'text-foreground'
                    }`}
                  >
                    <Icon className="text-muted-foreground h-4 w-4" />
                    <span className="flex-1">{item.label}</span>
                    <span className="text-muted-foreground text-xs">{item.hint}</span>
                  </li>
                );
              }
              return (
                <li
                  key={item.id}
                  role="option"
                  aria-selected={active}
                  data-active={active}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    activate(item);
                  }}
                  className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm ${
                    active ? 'bg-accent text-accent-foreground' : 'text-foreground'
                  }`}
                >
                  <span className="text-foreground w-16 font-semibold">{item.symbol}</span>
                  <span className="text-muted-foreground flex-1 truncate">{item.name}</span>
                  <span className="text-foreground text-xs">{formatCurrency(item.price)}</span>
                  <span
                    className={`text-xs ${
                      item.changePercent >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {formatPercentage(item.changePercent)}
                  </span>
                </li>
              );
            })
          )}
        </ul>
        <div className="border-border text-muted-foreground flex items-center justify-between gap-4 border-t px-3 py-2 text-xs">
          <span>
            <kbd className="rounded border px-1.5 py-0.5">↑↓</kbd> to navigate
          </span>
          <span>
            <kbd className="rounded border px-1.5 py-0.5">Enter</kbd> to open
          </span>
          <span>
            <kbd className="rounded border px-1.5 py-0.5">/</kbd> or{' '}
            <kbd className="rounded border px-1.5 py-0.5">⌘K</kbd> to toggle
          </span>
        </div>
      </div>
    </div>
  );
}
