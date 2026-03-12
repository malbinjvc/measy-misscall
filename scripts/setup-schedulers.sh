#!/usr/bin/env bash
# ============================================================
# Measy MissCall — Create Cloud Scheduler Cron Jobs
# ============================================================
# Creates/updates the 4 cron jobs that replace Vercel crons.
#
# Usage:
#   bash scripts/setup-schedulers.sh
# ============================================================

set -euo pipefail

PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
REGION="northamerica-northeast2"
SERVICE_NAME="measy-misscall"

# Get Cloud Run service URL
CLOUD_RUN_URL=$(gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --format="value(status.url)" 2>/dev/null || echo "")

if [ -z "$CLOUD_RUN_URL" ]; then
  echo "ERROR: Cloud Run service '$SERVICE_NAME' not found in $REGION."
  echo "Deploy the app first: bash scripts/deploy.sh"
  exit 1
fi

# Get CRON_SECRET from Secret Manager
CRON_SECRET=$(gcloud secrets versions access latest --secret="cron-secret" 2>/dev/null || echo "")

if [ -z "$CRON_SECRET" ]; then
  echo "ERROR: Could not read cron-secret from Secret Manager."
  exit 1
fi

echo "========================================="
echo "  Setting Up Cloud Scheduler Jobs"
echo "========================================="
echo "Service URL: $CLOUD_RUN_URL"
echo ""

create_or_update_job() {
  local name=$1
  local schedule=$2
  local description=$3
  local uri="${CLOUD_RUN_URL}/api/cron/${name}"

  echo "▸ Job: $name"
  echo "  Schedule: $schedule"
  echo "  URI: $uri"

  if gcloud scheduler jobs describe "$name" --location=$REGION &>/dev/null; then
    gcloud scheduler jobs update http "$name" \
      --location=$REGION \
      --schedule="$schedule" \
      --time-zone="America/Toronto" \
      --uri="$uri" \
      --http-method=GET \
      --headers="Authorization=Bearer ${CRON_SECRET}" \
      --attempt-deadline=120s \
      --description="$description" \
      --quiet
    echo "  Updated."
  else
    gcloud scheduler jobs create http "$name" \
      --location=$REGION \
      --schedule="$schedule" \
      --time-zone="America/Toronto" \
      --uri="$uri" \
      --http-method=GET \
      --headers="Authorization=Bearer ${CRON_SECRET}" \
      --attempt-deadline=120s \
      --description="$description" \
      --quiet
    echo "  Created."
  fi
  echo ""
}

# ── Create Jobs ─────────────────────────────────────────────

create_or_update_job \
  "twilio-cleanup" \
  "*/30 * * * *" \
  "Retry failed Twilio number releases (every 30 min)"

create_or_update_job \
  "appointment-reminders" \
  "*/30 * * * *" \
  "Send SMS reminders 12hrs before confirmed appointments (every 30 min)"

create_or_update_job \
  "cleanup-verifications" \
  "0 3 * * *" \
  "Delete expired phone verification records (daily 3 AM)"

create_or_update_job \
  "cleanup-logs" \
  "0 4 * * *" \
  "Clean up old admin logs (daily 4 AM)"

echo "========================================="
echo "  Cloud Scheduler Setup Complete"
echo "========================================="
echo ""
echo "  List jobs:  gcloud scheduler jobs list --location=$REGION"
echo "  Test a job: gcloud scheduler jobs run twilio-cleanup --location=$REGION"
echo "========================================="
