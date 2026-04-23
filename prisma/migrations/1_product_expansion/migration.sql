-- Product expansion: Portfolio groupings, Transactions, Alerts, UserPreferences,
-- and per-holding currency. Backwards-compatible: every existing Holding is
-- moved under a freshly-created "Default" Portfolio for its user.

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "AlertDirection" AS ENUM ('ABOVE', 'BELOW');

-- CreateTable UserPreferences
CREATE TABLE "UserPreferences" (
    "userId" TEXT NOT NULL,
    "displayName" TEXT,
    "displayCurrency" TEXT NOT NULL DEFAULT 'USD',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("userId")
);

-- CreateTable Portfolio
CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex Portfolio
CREATE INDEX "Portfolio_userId_idx" ON "Portfolio"("userId");
CREATE UNIQUE INDEX "Portfolio_userId_name_key" ON "Portfolio"("userId", "name");

-- AddForeignKey Portfolio
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed a Default portfolio for every existing user. gen_random_uuid() ships with
-- pgcrypto — we stringify it so IDs collate with Prisma's cuid-looking TEXT PKs.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

INSERT INTO "Portfolio" ("id", "userId", "name", "isDefault", "createdAt", "updatedAt")
SELECT
    replace(gen_random_uuid()::text, '-', ''),
    u."id",
    'Default',
    true,
    NOW(),
    NOW()
FROM "User" u;

-- AlterTable Holding — add portfolioId + currency nullable, backfill, then enforce NOT NULL
ALTER TABLE "Holding" ADD COLUMN "portfolioId" TEXT;
ALTER TABLE "Holding" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD';

UPDATE "Holding" h
SET "portfolioId" = p."id"
FROM "Portfolio" p
WHERE p."userId" = h."userId" AND p."isDefault" = true;

ALTER TABLE "Holding" ALTER COLUMN "portfolioId" SET NOT NULL;

-- Swap the unique constraint: (userId, symbol) → (portfolioId, symbol).
-- Keeps the invariant "one row per position inside a portfolio" while letting
-- a user hold the same symbol in multiple portfolios.
DROP INDEX "Holding_userId_symbol_key";
CREATE UNIQUE INDEX "Holding_portfolioId_symbol_key" ON "Holding"("portfolioId", "symbol");
CREATE INDEX "Holding_portfolioId_idx" ON "Holding"("portfolioId");

ALTER TABLE "Holding" ADD CONSTRAINT "Holding_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable Transaction
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "shares" DECIMAL(18,6) NOT NULL,
    "price" DECIMAL(18,6) NOT NULL,
    "fee" DECIMAL(18,6),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "executedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex Transaction
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");
CREATE INDEX "Transaction_portfolioId_symbol_idx" ON "Transaction"("portfolioId", "symbol");
CREATE INDEX "Transaction_symbol_idx" ON "Transaction"("symbol");

-- AddForeignKey Transaction
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable Alert
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "direction" "AlertDirection" NOT NULL,
    "threshold" DECIMAL(18,6) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex Alert
CREATE INDEX "Alert_userId_idx" ON "Alert"("userId");
CREATE INDEX "Alert_symbol_idx" ON "Alert"("symbol");
CREATE INDEX "Alert_active_idx" ON "Alert"("active");

-- AddForeignKey Alert
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey UserPreferences
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
