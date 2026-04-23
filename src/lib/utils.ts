import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatPercentage(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function formatNumber(value: number): string {
  if (value >= 1e9) {
    return `${(value / 1e9).toFixed(2)}B`;
  }
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(2)}M`;
  }
  if (value >= 1e3) {
    return `${(value / 1e3).toFixed(2)}K`;
  }
  return value.toString();
}

export function getChangeColor(change: number): string {
  if (change > 0) return 'text-emerald-600 dark:text-emerald-400';
  if (change < 0) return 'text-rose-600 dark:text-rose-400';
  return 'text-muted-foreground';
}

export function getChangeBgColor(change: number): string {
  if (change > 0) return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  if (change < 0) return 'bg-rose-500/10 text-rose-700 dark:text-rose-300';
  return 'bg-muted text-muted-foreground';
}
