# Varsha Setu — Hyperlocal Monsoon AI Backend (SIH 26086)

FastAPI serving layer for Karnataka Hyperlocal Monsoon Onset & Break Prediction. This service exposes pre-trained machine learning models as clean, production-ready REST endpoints without retraining.

---

## Live Deployment (Docker Web Service)

- **Production Engine**: Gunicorn with 2 Uvicorn async workers (`uvicorn.workers.UvicornWorker`)
- **Render / Railway Blueprint**: [`render.yaml`](file:///c:/Users/LEnobo/Downloads/varsha-setu-project-updated/backend/render.yaml)
- **Deployed Service URL**: `https://varsha-setu-backend.onrender.com` (or Railway assigned domain)
- **Health Verification**: `GET /health` -> `{"status":"ok","artifacts_loaded":true,"verified_taluks_count":236,"model_targets_count":13}`

### Required Production Environment Variables:

```env
APP_ENV=production
PORT=8000
AUTH_JWT_SECRET=<generate_a_secure_random_string>
ENABLE_SCHEDULER=true
CORS_ORIGINS=["https://<your-frontend-domain>.lovable.app","https://varsha-setu.pages.dev"]
```

> **Security Note**: Audio synthesis (`POST /advisory/audio`) is rate-limited on the backend (10/min) and does not require client-side keys.

---

## Architecture Overview

- **Inference Models**: Dual-model ensemble ($0.60 \times \text{XGBoost} + 0.40 \times \text{Random Forest}$) calibrated per target.
- **Coverage**: All 236 official taluks across 31 Karnataka districts with 956+ offline verified villages and OpenStreetMap live geocoding fallback.
- **Targets (13)**:
  - `target_onset_next14d`: 14-day monsoon onset arrival probability.
  - `target_break_w1` .. `w4`: Break/dry-spell risk (<5 mm) across 4 weekly horizons.
  - `target_active_w1` .. `w4`: Active monsoon conditions ($\ge 30$ mm) across 4 weekly horizons.
  - `target_heavy_w1` .. `w4`: Severe downpour risk ($\ge 64.5$ mm) across 4 weekly horizons.
- **Data Drivers**:
  - Live NOAA ONI (ENSO Index)
  - Live NOAA PSL DMI (Indian Ocean Dipole)
  - Live Australia BOM RMM MJO (Madden-Julian Oscillation)
  - 3-tier precipitation retrieval (Live Open-Meteo $\rightarrow$ Taluk DOY Parquet Climatology $\rightarrow$ Seasonal Harmonic Model)
- **Soil & Agronomy**:
  - 31-district regional soil database (Vertisols, Alfisols, Lateritic, Coastal Alluvium).
  - Trilingual rule-based advisory generation (English `en`, Kannada `kn`, and Hindi `hi`).
  - Text-to-speech audio streaming via Google TTS (`gTTS`) supporting English, Kannada, and Hindi.

---

## Local Setup & Execution

### 1. Requirements

- Python 3.11+
- Virtual environment (recommended)

### 2. Install Dependencies

```bash
cd backend
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
```

### 3. Ensure Artifacts Are Present

Confirm `backend/artifacts/` contains:

```
artifacts/
├── climatology_by_taluk_doy.parquet
├── feature_columns.pkl
├── karnataka_final_risk_map.html
├── karnataka_multitarget_models.pkl
├── karnataka_offline_villages_master.csv
├── karnataka_taluks_verified.csv
├── optimal_thresholds.pkl
├── outlook_log.db
└── users.db
```

> **Persistent Storage Note**: SQLite files (`outlook_log.db`, `users.db`) operate with Write-Ahead Logging (`WAL` mode). On ephemeral cloud containers (e.g. Render Free Tier), mount a persistent disk volume to `/app/artifacts/` if state must survive container redeploys.

### 4. Run the Server

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

- Interactive Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- ReDoc Documentation: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## Docker Deployment

### 1. Build Docker Image

```bash
docker build -t varsha-setu-backend:latest .
```

### 2. Run Container

```bash
docker run -p 8000:8000 --name varsha-setu varsha-setu-backend:latest
```

---

## REST Endpoints Specification

### 1. Health Check

- **Route**: `GET /health`
- **Description**: Verifies service status, artifact loading, and documented taluk coverage count.
- **Response**:

```json
{
  "status": "ok",
  "artifacts_loaded": true,
  "verified_taluks_count": 236,
  "offline_villages_count": 956,
  "model_targets_count": 13,
  "dataset_coverage": "Calibrated on real daily CHIRPS rainfall (2015-2024) across all 236 official Karnataka taluks...",
  "timestamp": "2026-09-23T17:15:00.000000Z"
}
```

---

### 2. Administrative Taluks Hierarchy

- **Route**: `GET /location/taluks`
- **Description**: Returns all 31 districts and their respective taluks for UI dropdown menus.
- **Response**:

```json
{
  "total_taluks": 236,
  "districts": [
    {
      "district": "Bagalkote",
      "taluks": [
        { "taluk_name": "Badami", "lat": 15.9189, "lon": 75.6797 },
        { "taluk_name": "Bagalkote", "lat": 16.1817, "lon": 75.6958 }
      ]
    }
  ]
}
```

---

### 3. Location Resolution

- **Route**: `GET /location/resolve?query={query}`
- **Description**: Resolves village, GP, or taluk by name with multi-tier lookup (offline villages $\rightarrow$ taluks $\rightarrow$ OSM Nominatim fallback with Karnataka bounding box check).
- **Example Response (Exact Match)**:

```json
{
  "status": "success",
  "query": "Sonda",
  "disambiguation_required": false,
  "scale_tag": "Village Cluster (Offline Verified)",
  "selected": {
    "name": "sonda",
    "label": "Sonda (Swadi) GP",
    "taluk": "Sirsi",
    "district": "Uttara Kannada",
    "lat": 14.7336,
    "lon": 74.7788
  },
  "candidates": [...]
}
```

---

### 4. Hyperlocal Forecast & Multi-Horizon Outlook

- **Route**: `POST /forecast`
- **Description**: Runs live weather fetch, builds the verified 18-feature vector, and executes the dual-model ensemble across all 13 targets.
- **Request Body**:

```json
{
  "lat": 14.7336,
  "lon": 74.7788,
  "district": "Uttara Kannada",
  "taluk": "Sirsi",
  "location_name": "Sonda GP",
  "crop_type": "Finger Millet (Ragi)",
  "crop_stage": "Sowing & Germination",
  "language": "hi"
}
```

> Supported `language` values: `"en"` / `"English"`, `"kn"` / `"ಕನ್ನಡ (Kannada)"`, `"hi"` / `"हिन्दी (Hindi)"`.

- **Response (Truncated)**:

```json
{
  "location": {
    "spatial_node": "Spatial Coordinate Node",
    "title": "Sonda GP",
    "taluk": "Sirsi",
    "district": "Uttara Kannada",
    "lat": 14.7336,
    "lon": 74.7788
  },
  "soil": {
    "type": "Coastal Alluvial & Forest Loam",
    "awc": 80,
    "buffer_days": 4,
    "drainage": "Rapid"
  },
  "onset": {
    "probability": 0.3412,
    "cutoff": 0.291,
    "triggered": true,
    "status_tag": "🔴 ONSET ACTIVE",
    "normal_date_window": "June 08 - June 14",
    "driver_outlook": "Onset spell favored by planetary indices"
  },
  "horizons": {
    "w1": {
      "week": 1,
      "horizon_label": "Week 1 (1–7 Days)",
      "break_spell": {"target": "target_break_w1", "probability": 0.12, "cutoff": 0.60, "triggered": false, "badge": "✔️ Normal"},
      "active_monsoon": {"target": "target_active_w1", "probability": 0.45, "cutoff": 0.60, "triggered": false, "badge": "✔️ Normal"},
      "heavy_rain": {"target": "target_heavy_w1", "probability": 0.08, "cutoff": 0.20, "triggered": false, "badge": "✔️ Normal"}
    }
  },
  "targets": { ... },
  "advisory_text": "अनुकूल सक्रिय मानसून परिस्थितियां (45.0%): Coastal Alluvial & Forest Loam मिट्टी में नमी का संतुलन...",
  "generated_at": "2026-09-23T17:20:00Z"
}
```

---

### 5. Agronomic Soil Advisory

- **Route**: `POST /advisory`
- **Description**: Generates standalone trilingual crop and soil-aware advisory text.
- **Request Body (Kannada Example)**:

```json
{
  "district": "Tumakuru",
  "crop_type": "Groundnut",
  "crop_stage": "Sowing & Germination",
  "language": "kn",
  "t1_break_triggered": true,
  "t1_break_prob": 0.72,
  "t1_heavy_triggered": false,
  "t1_heavy_prob": 0.05,
  "t1_active_prob": 0.1
}
```

- **Request Body (Hindi Example)**:

```json
{
  "district": "Bagalkote",
  "crop_type": "Maize",
  "crop_stage": "Vegetative Growth",
  "language": "hi",
  "t1_break_triggered": false,
  "t1_break_prob": 0.1,
  "t1_heavy_triggered": true,
  "t1_heavy_prob": 0.35,
  "t1_active_prob": 0.4
}
```

---

### 6. Advisory Audio Stream (TTS)

- **Route**: `POST /advisory/audio`
- **Description**: Generates an in-memory MP3 audio stream using Google TTS (`gTTS`).
- **Request Body**:

```json
{
  "text": "अनुकूल सक्रिय मानसून परिस्थितियां: मिट्टी में नमी का संतुलन फसल के लिए सर्वोत्तम है।",
  "language": "hi"
}
```

- **Response**: Binary stream with headers:
  - `Content-Type: audio/mpeg`
  - `Content-Disposition: inline; filename=varsha_setu_advisory.mp3`

---

### 7. Regional Risk Map

- **Route**: `GET /risk-map`
- **Description**: Serves the interactive 236-Taluk Folium risk gradient HTML map.
- **Response**: `text/html; charset=utf-8`

---

## Known Limitations & Design Rationale

1. **Spatial Coverage**: The model was trained on real daily CHIRPS rainfall observations (2015-2024) across the 236 official taluks documented in `karnataka_taluks_verified.csv`.
2. **Heavy-Rain Threshold**: The calibrated cutoff for heavy rainfall targets (`0.20`–`0.23`) reflects a deliberate precision/recall trade-off designed to detect extreme events ($\ge 64.5$ mm/day) rather than an error in model training.
3. **Feature Ordering**: Feature vector assembly explicitly verifies against `feature_columns.pkl` with assertion checks to eliminate silent prediction degradation.
