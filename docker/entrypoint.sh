#!/bin/sh
set -e

echo "[entrypoint] Applying Prisma migrations..."
npx --no-install prisma migrate deploy

echo "[entrypoint] Starting: $*"
exec "$@"
