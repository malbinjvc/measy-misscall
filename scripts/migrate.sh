#!/usr/bin/env bash
# ============================================================
# Measy MissCall — Run Database Migrations on Cloud SQL
# ============================================================
# Connects via Cloud SQL Auth Proxy and runs Prisma migrations.
#
# Usage:
#   bash scripts/migrate.sh              # Run pending migrations
#   bash scripts/migrate.sh seed         # Run migrations + seed
# ============================================================

set -euo pipefail

PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
REGION="northamerica-northeast2"
DB_INSTANCE_NAME="measy-db"

echo "========================================="
echo "  Database Migration"
echo "========================================="
echo ""

# Get connection info from Secret Manager
DATABASE_URL=$(gcloud secrets versions access latest --secret="database-url" 2>/dev/null || echo "")

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: Could not read database-url from Secret Manager."
  echo "Make sure you've run scripts/gcp-setup.sh first."
  exit 1
fi

# Get Cloud SQL connection name
SQL_CONNECTION=$(gcloud sql instances describe $DB_INSTANCE_NAME --format="value(connectionName)")

echo "▸ Starting Cloud SQL Auth Proxy..."
echo "  Instance: $SQL_CONNECTION"

# Check if cloud-sql-proxy is installed
if ! command -v cloud-sql-proxy &>/dev/null; then
  echo ""
  echo "cloud-sql-proxy not found. Install it:"
  echo "  brew install cloud-sql-proxy"
  echo ""
  echo "Or download from:"
  echo "  https://cloud.google.com/sql/docs/postgres/sql-proxy#install"
  exit 1
fi

# Start proxy in background on a Unix socket
PROXY_DIR=$(mktemp -d)
cloud-sql-proxy "$SQL_CONNECTION" \
  --unix-socket="$PROXY_DIR" \
  --quiet &
PROXY_PID=$!

# Wait for proxy to be ready
sleep 3

# Build the local DATABASE_URL pointing to the proxy socket
LOCAL_DB_URL="postgresql://measy_app:$(
  gcloud secrets versions access latest --secret=database-url 2>/dev/null | \
  sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p'
)@localhost/${DB_INSTANCE_NAME##*:}?host=${PROXY_DIR}/${SQL_CONNECTION}&connection_limit=5"

# Fallback: use the direct DATABASE_URL from Secret Manager
export DATABASE_URL="$DATABASE_URL"

echo ""
echo "▸ Running Prisma migrations..."
npx prisma migrate deploy

if [ "${1:-}" = "seed" ]; then
  echo ""
  echo "▸ Running seed..."
  npx tsx prisma/seed.ts
fi

echo ""
echo "▸ Stopping Cloud SQL Auth Proxy..."
kill $PROXY_PID 2>/dev/null || true
rm -rf "$PROXY_DIR"

echo ""
echo "========================================="
echo "  Migration Complete"
echo "========================================="
