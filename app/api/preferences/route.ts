import { NextResponse, type NextRequest } from 'next/server';

import { guardRequest } from '@/src/lib/api-guard';
import { loggerFromRequest } from '@/src/lib/logger';
import {
  getUserPreferences,
  isSupportedCurrency,
  SUPPORTED_DISPLAY_CURRENCIES,
  updateUserPreferences,
} from '@/src/lib/user-preferences';
import { preferencesPatchSchema } from '@/src/lib/validators';

export async function GET(request: NextRequest) {
  const guard = await guardRequest(request, {
    rateLimit: { limit: 60, windowMs: 60_000 },
  });
  if (!guard.ok) return guard.response;
  const userId = guard.userId!;
  const prefs = await getUserPreferences(userId);
  return NextResponse.json({
    preferences: prefs,
    supportedCurrencies: SUPPORTED_DISPLAY_CURRENCIES,
  });
}

export async function PATCH(request: NextRequest) {
  const guard = await guardRequest(request, {
    rateLimit: { limit: 20, windowMs: 60_000 },
  });
  if (!guard.ok) return guard.response;
  const userId = guard.userId!;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = preferencesPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.displayCurrency && !isSupportedCurrency(parsed.data.displayCurrency)) {
    return NextResponse.json(
      {
        error: 'Unsupported currency',
        supportedCurrencies: SUPPORTED_DISPLAY_CURRENCIES,
      },
      { status: 400 },
    );
  }

  try {
    const updateData: { displayName?: string | null; displayCurrency?: string } = {};
    if (parsed.data.displayName !== undefined) {
      updateData.displayName = parsed.data.displayName;
    }
    if (parsed.data.displayCurrency !== undefined) {
      updateData.displayCurrency = parsed.data.displayCurrency;
    }
    const preferences = await updateUserPreferences(userId, updateData);
    return NextResponse.json({ preferences });
  } catch (error) {
    loggerFromRequest(request).error({ err: error, userId }, 'Failed to update preferences');
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  }
}
