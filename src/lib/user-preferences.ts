import type { UserPreferences } from '@prisma/client';

import { prisma } from '@/src/lib/prisma';

export interface UserPreferencesView {
  displayName: string | null;
  displayCurrency: string;
}

export const SUPPORTED_DISPLAY_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'CAD',
  'AUD',
  'CHF',
  'HKD',
  'SGD',
  'INR',
  'CNY',
] as const;

export type SupportedCurrency = (typeof SUPPORTED_DISPLAY_CURRENCIES)[number];

export function isSupportedCurrency(code: string): code is SupportedCurrency {
  return (SUPPORTED_DISPLAY_CURRENCIES as readonly string[]).includes(code);
}

function toView(prefs: UserPreferences | null): UserPreferencesView {
  return {
    displayName: prefs?.displayName ?? null,
    displayCurrency: prefs?.displayCurrency ?? 'USD',
  };
}

export async function getUserPreferences(userId: string): Promise<UserPreferencesView> {
  const prefs = await prisma.userPreferences.findUnique({ where: { userId } });
  return toView(prefs);
}

export async function updateUserPreferences(
  userId: string,
  input: Partial<UserPreferencesView>,
): Promise<UserPreferencesView> {
  const data: Record<string, unknown> = {};
  if (input.displayName !== undefined) data.displayName = input.displayName;
  if (input.displayCurrency !== undefined) data.displayCurrency = input.displayCurrency;

  const updated = await prisma.userPreferences.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  return toView(updated);
}
