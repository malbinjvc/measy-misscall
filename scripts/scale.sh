#!/usr/bin/env bash
# ============================================================
# Measy MissCall — Scale Cloud Run Service
# ============================================================
# Quick commands to scale the service up/down.
#
# Usage:
#   bash scripts/scale.sh launch    # 0-100 tenants
#   bash scripts/scale.sh growth    # 100-1000 tenants
#   bash scripts/scale.sh scale     # 1000-10000 tenants
# ============================================================

set -euo pipefail

REGION="northamerica-northeast2"
SERVICE_NAME="measy-misscall"

PHASE="${1:-launch}"

case "$PHASE" in
  launch)
    echo "Scaling to LAUNCH tier (0-100 tenants)..."
    gcloud run services update $SERVICE_NAME \
      --region=$REGION \
      --cpu=1 \
      --memory=512Mi \
      --min-instances=1 \
      --max-instances=5 \
      --concurrency=80 \
      --quiet
    echo "Done. Cloud SQL should be: db-custom-1-3840"
    ;;

  growth)
    echo "Scaling to GROWTH tier (100-1000 tenants)..."
    gcloud run services update $SERVICE_NAME \
      --region=$REGION \
      --cpu=2 \
      --memory=1Gi \
      --min-instances=2 \
      --max-instances=20 \
      --concurrency=100 \
      --quiet
    echo "Done. Consider upgrading Cloud SQL to db-custom-2-7680 with HA + read replica."
    ;;

  scale)
    echo "Scaling to SCALE tier (1000-10000 tenants)..."
    gcloud run services update $SERVICE_NAME \
      --region=$REGION \
      --cpu=2 \
      --memory=2Gi \
      --min-instances=4 \
      --max-instances=50 \
      --concurrency=100 \
      --quiet
    echo "Done. Ensure Cloud SQL is db-custom-4-15360 with HA + 2 read replicas + PgBouncer."
    ;;

  *)
    echo "Usage: bash scripts/scale.sh [launch|growth|scale]"
    exit 1
    ;;
esac
