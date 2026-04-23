import { z } from 'zod';

export const SYMBOL_RE = /^[A-Z0-9.\-]{1,10}$/;

export const symbolSchema = z.string().trim().toUpperCase().regex(SYMBOL_RE, 'Invalid symbol');

export const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Invalid currency code');

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
  currency: currencySchema.optional(),
  portfolioId: z.string().trim().min(1).optional(),
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
  currency: currencySchema.optional(),
});

const numericString = z.union([z.number(), z.string()]).transform((value) => Number(value));

export const transactionInputSchema = z.object({
  symbol: symbolSchema,
  type: z.enum(['BUY', 'SELL']),
  shares: numericString.pipe(z.number().positive().max(1_000_000_000)),
  price: numericString.pipe(z.number().nonnegative().max(1_000_000)),
  fee: numericString.pipe(z.number().nonnegative().max(1_000_000)).optional(),
  currency: currencySchema.optional(),
  executedAt: z
    .union([z.string(), z.date()])
    .transform((value) => (value instanceof Date ? value : new Date(value)))
    .refine((d) => !Number.isNaN(d.getTime()), 'Invalid executedAt'),
  notes: z.string().max(500).optional(),
  portfolioId: z.string().trim().min(1).optional(),
});

export const transactionPatchSchema = z.object({
  shares: numericString.pipe(z.number().positive().max(1_000_000_000)).optional(),
  price: numericString.pipe(z.number().nonnegative().max(1_000_000)).optional(),
  fee: numericString.pipe(z.number().nonnegative().max(1_000_000)).optional(),
  currency: currencySchema.optional(),
  executedAt: z
    .union([z.string(), z.date()])
    .transform((value) => (value instanceof Date ? value : new Date(value)))
    .refine((d) => !Number.isNaN(d.getTime()), 'Invalid executedAt')
    .optional(),
  notes: z.string().max(500).optional(),
  type: z.enum(['BUY', 'SELL']).optional(),
});

export const alertInputSchema = z.object({
  symbol: symbolSchema,
  direction: z.enum(['ABOVE', 'BELOW']),
  threshold: numericString.pipe(z.number().positive().max(1_000_000_000)),
  note: z.string().max(200).optional(),
  active: z.boolean().optional(),
});

export const alertPatchSchema = z.object({
  direction: z.enum(['ABOVE', 'BELOW']).optional(),
  threshold: numericString.pipe(z.number().positive().max(1_000_000_000)).optional(),
  note: z.string().max(200).optional(),
  active: z.boolean().optional(),
});

export const preferencesPatchSchema = z.object({
  displayName: z.string().trim().min(1).max(80).nullable().optional(),
  displayCurrency: currencySchema.optional(),
});

export const portfolioInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
});

export const portfolioPatchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
});
