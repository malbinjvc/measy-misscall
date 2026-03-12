#!/usr/bin/env bash
# ============================================================
# Measy MissCall — Deploy to Cloud Run
# ============================================================
# Builds Docker image, pushes to Artifact Registry, deploys.
#
# Usage:
#   bash scripts/deploy.sh              # Deploy latest
#   bash scripts/deploy.sh v1.2.0       # Deploy with tag
# ============================================================

set -euo pipefail

# ── Configuration ───────────────────────────────────────────
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
REGION="northamerica-northeast2"
SERVICE_NAME="measy-misscall"
REPO_NAME="measy"
VPC_CONNECTOR="measy-vpc-connector"

TAG="${1:-latest}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}:${TAG}"

# Get Cloud SQL connection name
SQL_CONNECTION=$(gcloud sql instances describe measy-db --format="value(connectionName)" 2>/dev/null || echo "")

echo "========================================="
echo "  Deploying Measy MissCall"
echo "========================================="
echo "Project:  $PROJECT_ID"
echo "Region:   $REGION"
echo "Image:    $IMAGE"
echo "========================================="
echo ""

# ── Step 1: Build & Push Docker Image ──────────────────────
echo "▸ Step 1/3: Building Docker image..."
docker build --platform linux/amd64 -t "$IMAGE" .

echo "▸ Step 1b: Pushing to Artifact Registry..."
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet 2>/dev/null
docker push "$IMAGE"
echo "  Image pushed: $IMAGE"
echo ""

# ── Step 2: Deploy to Cloud Run ────────────────────────────
echo "▸ Step 2/3: Deploying to Cloud Run..."

gcloud run deploy $SERVICE_NAME \
  --image="$IMAGE" \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --cpu=1 \
  --memory=512Mi \
  --min-instances=1 \
  --max-instances=5 \
  --concurrency=80 \
  --timeout=60s \
  --cpu-boost \
  --execution-environment=gen2 \
  --vpc-connector=$VPC_CONNECTOR \
  --vpc-egress=private-ranges-only \
  --set-cloudsql-instances="$SQL_CONNECTION" \
  --set-secrets="\
DATABASE_URL=database-url:latest,\
NEXTAUTH_SECRET=nextauth-secret:latest,\
NEXTAUTH_URL=nextauth-url:latest,\
STRIPE_SECRET_KEY=stripe-secret-key:latest,\
STRIPE_PUBLISHABLE_KEY=stripe-publishable-key:latest,\
STRIPE_WEBHOOK_SECRET=stripe-webhook-secret:latest,\
CRON_SECRET=cron-secret:latest,\
ENCRYPTION_KEY=encryption-key:latest,\
GCS_BUCKET_NAME=gcs-bucket-name:latest,\
REDIS_URL=redis-url:latest,\
NEXT_PUBLIC_APP_URL=next-public-app-url:latest,\
NEXT_PUBLIC_APP_NAME=next-public-app-name:latest" \
  --quiet

echo ""

# ── Step 3: Verify Deployment ──────────────────────────────
echo "▸ Step 3/3: Verifying deployment..."

SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --format="value(status.url)")

echo "  Service URL: $SERVICE_URL"
echo ""

# Health check
echo "  Running health check..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}/api/health" 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
  echo "  Health check: PASSED"
  curl -s "${SERVICE_URL}/api/health" | python3 -m json.tool 2>/dev/null || true
else
  echo "  Health check: FAILED (HTTP $HTTP_STATUS)"
  echo "  Check logs: gcloud run logs read $SERVICE_NAME --region=$REGION --limit=50"
fi

echo ""
echo "========================================="
echo "  Deployment Complete"
echo "========================================="
echo "  URL: $SERVICE_URL"
echo ""
echo "  Useful commands:"
echo "    Logs:    gcloud run logs read $SERVICE_NAME --region=$REGION --limit=50"
echo "    Stream:  gcloud run logs tail $SERVICE_NAME --region=$REGION"
echo "    Revisions: gcloud run revisions list --service=$SERVICE_NAME --region=$REGION"
echo "========================================="
