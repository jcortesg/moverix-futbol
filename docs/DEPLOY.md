# Moverix — Deployment

Infraestructura en GCP proyecto `moverix` (ID: 444229586513). Actualizado 2026-05-05.

## Arquitectura

```
Internet
   │
   ▼
[moverix-proxy] VM f1-micro (35.232.54.40)
   │  nginx reverse proxy + Let's Encrypt SSL
   │
   ├─► https://admin.moverix.co  → Cloud Run: moverix-admin-production (port 3000)
   └─► https://api-ftb.moverix.co → Cloud Run: moverix-api-production (port 3001)
                                          │
                                          ▼
                                   [moverix-db] Cloud SQL PostgreSQL 16 (db-f1-micro)
                                   IP: 35.225.31.7
```

## Servicios Cloud Run

| Servicio | Imagen | Puerto | URL interna |
|----------|--------|--------|-------------|
| `moverix-admin-production` | `us-central1-docker.pkg.dev/moverix/moverix/admin:manual-deploy` | 3000 | `https://moverix-admin-production-444229586513.us-central1.run.app` |
| `moverix-api-production` | `us-central1-docker.pkg.dev/moverix/moverix/api:manual-deploy` | 3001 | `https://moverix-api-production-444229586513.us-central1.run.app` |

### Configuración API (env vars / secrets)

| Variable | Fuente | Valor |
|----------|--------|-------|
| `NODE_ENV` | env | `production` |
| `API_BASE_URL` | env | `https://api-ftb.moverix.co` |
| `DATABASE_URL` | secret `moverix-db-url` | Connection string Cloud SQL |
| `FIREBASE_PROJECT_ID` | secret `moverix-firebase-project` | `moverix` |
| `CORS_ORIGINS` | secret `moverix-cors-origins` | Dominios permitidos |
| `GCS_BUCKET` | secret `moverix-gcs-bucket` | Bucket de assets |

Cloud SQL connector: `moverix:us-central1:moverix-db`

### Configuración Admin (build args)

| Variable | Valor |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://api-ftb.moverix.co/ftb/v1` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `AIzaSyD5qwrQf-dSU8qtaDunCYtMpBLsRsQWJc8` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `moverix` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `moverix.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `moverix.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `444229586513` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:444229586513:web:a470442690e2ed708c3270` |

## VM Proxy

| Campo | Valor |
|-------|-------|
| Nombre | `moverix-proxy` |
| Zona | `us-central1-a` |
| Tipo | `f1-micro` (free tier) |
| IP externa | `35.232.54.40` |
| SO | Probablemente Debian/Ubuntu con nginx + certbot |

Nginx hace reverse proxy a los URLs internos de Cloud Run con SSL via Let's Encrypt.

## Cloud SQL

| Campo | Valor |
|-------|-------|
| Nombre | `moverix-db` |
| Motor | PostgreSQL 16 |
| Tier | `db-f1-micro` |
| IP pública | `35.225.31.7` |
| Región | `us-central1-f` |

## Costos (~$14-18/mes)

| Servicio | Costo |
|----------|-------|
| GCE VM (f1-micro) | $0 (free tier) |
| Cloud SQL (db-f1-micro) | ~$11 |
| IP estática VM | ~$3 |
| Cloud Run | ~$0-3 |
| Otros (storage, egress) | ~$0.50 |

## Deploy manual (desde local)

### 1. Build de imágenes (Cloud Build)

```bash
cd "moverix futbol"

# API
gcloud builds submit --config apps/api/cloudbuild.yaml --project moverix

# Admin
gcloud builds submit --config apps/admin/cloudbuild.yaml --project moverix
```

Esto construye las imágenes Docker y las pushea a Artifact Registry con tag `manual-deploy` y `latest`.

### 2. Actualizar Cloud Run

```bash
# API
gcloud run services update moverix-api-production \
  --image us-central1-docker.pkg.dev/moverix/moverix/api:manual-deploy \
  --region us-central1 --project moverix

# Admin
gcloud run services update moverix-admin-production \
  --image us-central1-docker.pkg.dev/moverix/moverix/admin:manual-deploy \
  --region us-central1 --project moverix
```

### 3. Verificar

```bash
# Health check API
curl https://api-ftb.moverix.co/ftb/v1/health

# Admin (abre en navegador)
open https://admin.moverix.co
```

## Migraciones de BD

Las migraciones se ejecutan manualmente vía Cloud SQL proxy o directamente contra la IP pública de Cloud SQL:

```bash
cd apps/api
# Con las credenciales de DATABASE_URL de producción
pnpm db:migrate
```

## Rollback

Para revertir a una imagen anterior:

```bash
# Ver revisiones
gcloud run revisions list --service moverix-api-production --region us-central1 --project moverix

# Rutear tráfico a una revisión anterior
gcloud run services update-traffic moverix-api-production \
  --to-revisions=REVISION_NAME=100 \
  --region us-central1 --project moverix
```
