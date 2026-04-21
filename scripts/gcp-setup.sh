#!/bin/bash
# Setup inicial de GCP para Moverix
# Ejecutar una sola vez: bash scripts/gcp-setup.sh

set -e

PROJECT_ID="moverix"
PROJECT_NUMBER="444229586513"
REGION="us-central1"
GITHUB_ORG="tu-org"          # ← cambia esto
GITHUB_REPO="moverix"        # ← cambia esto si el repo se llama diferente
SA_NAME="moverix-cicd"

echo "==> Configurando proyecto GCP: $PROJECT_ID"
gcloud config set project $PROJECT_ID

# ─── APIs requeridas ─────────────────────────────────────────────────────────
echo "==> Habilitando APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  sqladmin.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  cloudresourcemanager.googleapis.com

# ─── Artifact Registry ───────────────────────────────────────────────────────
echo "==> Creando Artifact Registry..."
gcloud artifacts repositories create moverix \
  --repository-format=docker \
  --location=$REGION \
  --description="Imágenes Docker de Moverix"

# ─── Service Account para CI/CD ──────────────────────────────────────────────
echo "==> Creando Service Account..."
gcloud iam service-accounts create $SA_NAME \
  --display-name="Moverix CI/CD"

SA_EMAIL="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"

# Permisos necesarios
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/iam.serviceAccountUser"

# ─── Workload Identity Federation (sin service account keys) ─────────────────
echo "==> Configurando Workload Identity Federation..."

gcloud iam workload-identity-pools create "github-pool" \
  --project=$PROJECT_ID \
  --location="global" \
  --display-name="GitHub Actions Pool"

gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --project=$PROJECT_ID \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

gcloud iam service-accounts add-iam-policy-binding $SA_EMAIL \
  --project=$PROJECT_ID \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/$GITHUB_ORG/$GITHUB_REPO"

# ─── Cloud SQL (PostgreSQL) ──────────────────────────────────────────────────
echo "==> Creando instancia Cloud SQL..."
gcloud sql instances create moverix-db \
  --database-version=POSTGRES_16 \
  --region=$REGION \
  --tier=db-f1-micro \
  --storage-type=SSD \
  --storage-size=10GB \
  --backup-start-time=03:00 \
  --availability-type=zonal

gcloud sql databases create moverix --instance=moverix-db
gcloud sql users create moverix_user \
  --instance=moverix-db \
  --password=$(openssl rand -base64 32)

# ─── Secret Manager ──────────────────────────────────────────────────────────
echo "==> Creando secrets en Secret Manager..."
echo "Crea los siguientes secrets manualmente en https://console.cloud.google.com/security/secret-manager:"
echo "  - moverix-db-url       → postgresql://moverix_user:PASSWORD@/moverix?host=/cloudsql/$PROJECT_ID:$REGION:moverix-db"
echo "  - moverix-firebase-project → moverix"

# ─── Resumen ─────────────────────────────────────────────────────────────────
echo ""
echo "✅ Setup completado!"
echo ""
echo "Agrega estos secrets en GitHub (Settings → Secrets → Actions):"
echo "  GCP_SERVICE_ACCOUNT  →  $SA_EMAIL"
echo "  NEXT_PUBLIC_API_URL  →  https://moverix-api-production-xxxx-uc.a.run.app/api/v1"
echo "  FIREBASE_API_KEY     →  (de Firebase Console)"
echo "  EXPO_TOKEN           →  (de expo.dev)"
echo ""
echo "Workload Identity Provider:"
echo "  projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
