#!/usr/bin/env bash
# ============================================================
# Measy MissCall — GCP Infrastructure Setup
# ============================================================
# Run once to create all GCP resources.
# Prerequisites: gcloud CLI installed, authenticated, project set.
#
# Usage:
#   gcloud auth login
#   gcloud config set project YOUR_PROJECT_ID
#   bash scripts/gcp-setup.sh
# ============================================================

set -euo pipefail

# ── Configuration ───────────────────────────────────────────
# Change these to match your setup
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
REGION="northamerica-northeast2"       # Toronto
SERVICE_NAME="measy-misscall"
DB_INSTANCE_NAME="measy-db"
DB_NAME="measy_misscall"
DB_USER="measy_app"
DB_TIER="db-custom-1-3840"            # 1 vCPU, 3.75 GB RAM (launch tier)
REDIS_INSTANCE="measy-redis"
REDIS_SIZE_GB=1
GCS_BUCKET="${PROJECT_ID}-uploads"
VPC_CONNECTOR="measy-vpc-connector"
REPO_NAME="measy"                      # Artifact Registry repo

echo "========================================="
echo "  Measy MissCall — GCP Setup"
echo "========================================="
echo "Project:  $PROJECT_ID"
echo "Region:   $REGION"
echo "========================================="
echo ""

# ── Step 1: Enable APIs ────────────────────────────────────
echo "▸ Step 1/9: Enabling GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  storage.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com \
  vpcaccess.googleapis.com \
  compute.googleapis.com \
  --quiet

echo "  APIs enabled."
echo ""

# ── Step 2: Create VPC Connector ───────────────────────────
echo "▸ Step 2/9: Creating VPC connector..."
if gcloud compute networks vpc-access connectors describe $VPC_CONNECTOR --region=$REGION &>/dev/null; then
  echo "  VPC connector already exists, skipping."
else
  gcloud compute networks vpc-access connectors create $VPC_CONNECTOR \
    --region=$REGION \
    --range="10.8.0.0/28" \
    --min-instances=2 \
    --max-instances=3 \
    --machine-type=f1-micro \
    --quiet
  echo "  VPC connector created."
fi
echo ""

# ── Step 3: Create Cloud SQL ───────────────────────────────
echo "▸ Step 3/9: Creating Cloud SQL PostgreSQL instance..."
if gcloud sql instances describe $DB_INSTANCE_NAME &>/dev/null; then
  echo "  Cloud SQL instance already exists, skipping."
else
  gcloud sql instances create $DB_INSTANCE_NAME \
    --database-version=POSTGRES_15 \
    --tier=$DB_TIER \
    --region=$REGION \
    --storage-type=SSD \
    --storage-size=20GB \
    --storage-auto-increase \
    --backup-start-time="04:00" \
    --enable-point-in-time-recovery \
    --availability-type=zonal \
    --no-assign-ip \
    --network=default \
    --quiet
  echo "  Cloud SQL instance created."
fi
echo ""

# Create database and user
echo "▸ Step 3b: Creating database and user..."
gcloud sql databases create $DB_NAME --instance=$DB_INSTANCE_NAME --quiet 2>/dev/null || echo "  Database already exists."

DB_PASSWORD=$(openssl rand -base64 24)
gcloud sql users create $DB_USER \
  --instance=$DB_INSTANCE_NAME \
  --password="$DB_PASSWORD" \
  --quiet 2>/dev/null || echo "  User already exists (password not changed)."

# Get the Cloud SQL connection name
SQL_CONNECTION=$(gcloud sql instances describe $DB_INSTANCE_NAME --format="value(connectionName)")
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}?host=/cloudsql/${SQL_CONNECTION}&connection_limit=5"

echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Connection: $SQL_CONNECTION"
echo ""

# ── Step 4: Create Memorystore (Redis) ─────────────────────
echo "▸ Step 4/9: Creating Memorystore Redis instance..."
if gcloud redis instances describe $REDIS_INSTANCE --region=$REGION &>/dev/null; then
  echo "  Redis instance already exists, skipping."
  REDIS_HOST=$(gcloud redis instances describe $REDIS_INSTANCE --region=$REGION --format="value(host)")
else
  gcloud redis instances create $REDIS_INSTANCE \
    --region=$REGION \
    --size=$REDIS_SIZE_GB \
    --redis-version=redis_7_0 \
    --tier=basic \
    --connect-mode=private-service-access \
    --quiet
  REDIS_HOST=$(gcloud redis instances describe $REDIS_INSTANCE --region=$REGION --format="value(host)")
  echo "  Redis created at $REDIS_HOST"
fi
REDIS_URL="redis://${REDIS_HOST}:6379"
echo ""

# ── Step 5: Create GCS Bucket ──────────────────────────────
echo "▸ Step 5/9: Creating Cloud Storage bucket..."
if gsutil ls "gs://$GCS_BUCKET" &>/dev/null; then
  echo "  Bucket already exists, skipping."
else
  gsutil mb -l $REGION "gs://$GCS_BUCKET"
  # Set CORS for browser uploads
  gsutil cors set /dev/stdin "gs://$GCS_BUCKET" <<'CORS'
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type", "Cache-Control"],
    "maxAgeSeconds": 86400
  }
]
CORS
  # Set lifecycle: delete temp files after 1 day
  echo "  Bucket created: gs://$GCS_BUCKET"
fi

# Make uploads publicly readable (for IVR audio and review photos)
gsutil iam ch allUsers:objectViewer "gs://$GCS_BUCKET"
echo ""

# ── Step 6: Create Artifact Registry ──────────────────────
echo "▸ Step 6/9: Creating Artifact Registry repository..."
if gcloud artifacts repositories describe $REPO_NAME --location=$REGION &>/dev/null; then
  echo "  Repository already exists, skipping."
else
  gcloud artifacts repositories create $REPO_NAME \
    --repository-format=docker \
    --location=$REGION \
    --quiet
  echo "  Repository created."
fi
echo ""

# ── Step 7: Store Secrets ──────────────────────────────────
echo "▸ Step 7/9: Storing secrets in Secret Manager..."

NEXTAUTH_SECRET=$(openssl rand -base64 32)
CRON_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

store_secret() {
  local name=$1
  local value=$2
  if gcloud secrets describe "$name" &>/dev/null; then
    echo "$value" | gcloud secrets versions add "$name" --data-file=- --quiet
    echo "  Updated: $name"
  else
    echo "$value" | gcloud secrets create "$name" --data-file=- --replication-policy=automatic --quiet
    echo "  Created: $name"
  fi
}

store_secret "database-url" "$DATABASE_URL"
store_secret "nextauth-secret" "$NEXTAUTH_SECRET"
store_secret "nextauth-url" "https://your-domain.com"
store_secret "cron-secret" "$CRON_SECRET"
store_secret "encryption-key" "$ENCRYPTION_KEY"
store_secret "gcs-bucket-name" "$GCS_BUCKET"
store_secret "redis-url" "$REDIS_URL"
store_secret "next-public-app-url" "https://your-domain.com"
store_secret "next-public-app-name" "Measy MissCall"

# Placeholder secrets — you must update these manually
store_secret "stripe-secret-key" "sk_live_REPLACE_ME"
store_secret "stripe-publishable-key" "pk_live_REPLACE_ME"
store_secret "stripe-webhook-secret" "whsec_REPLACE_ME"

echo ""

# ── Step 8: Grant Cloud Run access to secrets ──────────────
echo "▸ Step 8/9: Granting IAM permissions..."

# Get the default compute service account
SA_EMAIL=$(gcloud iam service-accounts list \
  --filter="displayName:Compute Engine default" \
  --format="value(email)" 2>/dev/null)

if [ -z "$SA_EMAIL" ]; then
  # Cloud Run default service account
  PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
  SA_EMAIL="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
fi

# Secret accessor
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet >/dev/null

# Cloud SQL client
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudsql.client" \
  --quiet >/dev/null

# Storage admin (for GCS uploads)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.objectAdmin" \
  --quiet >/dev/null

echo "  IAM permissions granted to $SA_EMAIL"
echo ""

# ── Step 9: Summary ────────────────────────────────────────
echo "========================================="
echo "  Setup Complete!"
echo "========================================="
echo ""
echo "Resources created:"
echo "  Cloud SQL:    $DB_INSTANCE_NAME ($SQL_CONNECTION)"
echo "  Redis:        $REDIS_HOST:6379"
echo "  GCS Bucket:   gs://$GCS_BUCKET"
echo "  VPC:          $VPC_CONNECTOR"
echo "  Artifact Reg: $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME"
echo ""
echo "Secrets stored in Secret Manager:"
echo "  database-url, nextauth-secret, cron-secret, encryption-key,"
echo "  redis-url, gcs-bucket-name, stripe-*, next-public-*"
echo ""
echo "========================================="
echo "  IMPORTANT: Manual Steps Required"
echo "========================================="
echo ""
echo "1. Update these secrets with real values:"
echo "   gcloud secrets versions add stripe-secret-key --data-file=-"
echo "   gcloud secrets versions add stripe-publishable-key --data-file=-"
echo "   gcloud secrets versions add stripe-webhook-secret --data-file=-"
echo ""
echo "2. Update your domain:"
echo "   gcloud secrets versions add nextauth-url --data-file=-"
echo "   gcloud secrets versions add next-public-app-url --data-file=-"
echo ""
echo "3. Run the database migration:"
echo "   bash scripts/migrate.sh"
echo ""
echo "4. Deploy the app:"
echo "   bash scripts/deploy.sh"
echo ""
echo "5. Set up Cloud Scheduler cron jobs:"
echo "   bash scripts/setup-schedulers.sh"
echo ""

# Save credentials to a local file (gitignored)
cat > .gcp-credentials.local <<EOF
# AUTO-GENERATED — DO NOT COMMIT
# Created by gcp-setup.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")

PROJECT_ID=$PROJECT_ID
REGION=$REGION
SQL_CONNECTION=$SQL_CONNECTION
DATABASE_URL=$DATABASE_URL
DB_PASSWORD=$DB_PASSWORD
REDIS_URL=$REDIS_URL
GCS_BUCKET=$GCS_BUCKET
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
CRON_SECRET=$CRON_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY
EOF

echo "Credentials saved to .gcp-credentials.local (gitignored)"
echo "KEEP THIS FILE SAFE — it contains your database password and encryption key."
