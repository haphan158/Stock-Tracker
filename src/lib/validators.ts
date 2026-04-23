import { z } from 'zod';

export const SYMBOL_RE = /^[A-Z0-9.\-]{1,10}$/;

export const symbolSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(SYMBOL_RE, 'Invalid symbol');

export const holdingInputSchema = z.object({
  symbol: symbolSchema,
  shares: z
    .union([z.number(), z.string()])
    .transform((value) => Number(value))
    .pipe(z.number().positive('shares must be positive').max(1_000_000_000)),
  averageCost: z
    .union([z.number(), z.string()])
    .transform((value) => Number(value))
    .pipe(z.number().nonnegative('averageCost must be ≥ 0').max(1_000_000)),
});

export const holdingPatchSchema = z.object({
  shares: z
    .union([z.number(), z.string()])
    .transform((value) => Number(value))
    .pipe(z.number().positive().max(1_000_000_000))
    .optional(),
  averageCost: z
    .union([z.number(), z.string()])
    .transform((value) => Number(value))
    .pipe(z.number().nonnegative().max(1_000_000))
    .optional(),
});
