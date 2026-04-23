#!/bin/sh
set -e

echo "[entrypoint] Running prisma migrate deploy..."
npx --no-install prisma migrate deploy || {
  echo "[entrypoint] No migrations found or migrate failed; falling back to prisma db push."
  npx --no-install prisma db push --accept-data-loss
}

echo "[entrypoint] Starting: $*"
exec "$@"
