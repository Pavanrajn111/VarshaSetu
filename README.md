# Varsha Setu — Hyperlocal Monsoon AI & S2S Advisory Platform (SIH 26086)

Varsha Setu is a sub-seasonal to seasonal (S2S) monsoon forecasting and agronomic advisory platform designed for Karnataka's 236 taluks. It bridges machine learning meteorology, macro-climatic teleconnections (ENSO/IOD/MJO), and district-level soil hydrology to deliver actionable, trilingual advisories for farmers and agricultural officers.

---

## Architecture Overview

- **ML Inference Serving Layer (`backend/`)**:
  - FastAPI async serving pipeline with SlowAPI per-IP rate limiting.
  - Frozen pre-trained dual-model ensemble ($0.60 \times \text{XGBoost} + 0.40 \times \text{Random Forest}$) calibrated across 13 forward meteorological targets.
  - 18 strictly verified features (hydro-climatic lags, anomalies, DOY harmonics, and global teleconnection indices).
  - 3-tier precipitation retrieval cascade (Live Open-Meteo API $\rightarrow$ verified 86,376-row taluk DOY climatology parquet artifact $\rightarrow$ statewide seasonal harmonic model).
  - Multi-source 7–30 day outlook service (GFS, ICON, ECMWF) running via APScheduler with configurable worker concurrency guards (`ENABLE_SCHEDULER`).
  - Trilingual advisory generation (English `en`, Kannada `kn`, Hindi `hi`) with rate-limited text-to-speech voice synthesis.
  - SQLite databases (`outlook_log.db`, `users.db`) operating with Write-Ahead Logging (`PRAGMA journal_mode=WAL;`).

- **Frontend Application (`src/`)**:
  - Built with TanStack Start, React 19, TypeScript, Tailwind CSS, and Framer Motion.
  - Authoritative dashboard at `/dashboard` with per-target fault isolation and dynamic health monitoring.
  - Location picker with 3-tier spatial resolution (Administrative taluk picker, verified village search, and Nominatim fallback).
  - Trilingual crop advisories and accessible audio synthesis streaming.
  - Deterministic context-grounded agronomic assistant widget.
  - Simulated SMS & WhatsApp last-mile notification preview.

---

## Getting Started

### 1. Backend Setup (FastAPI)

```bash
cd backend
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive Swagger API Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)

### 2. Frontend Setup (TanStack Start / Vite)

```bash
# In the root repository:
npm install
cp .env.example .env
npm run dev
```

The application runs by default on [http://localhost:8080](http://localhost:8080) (or Vite assigned port).

---

## Environment Configuration

### Frontend (`.env`)

```env
VITE_API_BASE_URL=http://localhost:8000
```

### Backend (`backend/.env`)

```env
APP_ENV=development
PORT=8000
AUTH_JWT_SECRET=your_secure_random_jwt_secret
ENABLE_SCHEDULER=true
```

> **Security Note**: Audio synthesis (`POST /advisory/audio`) is rate-limited on the backend (10 requests/min per IP) and does NOT require client-side API secrets. Never commit private keys to frontend environment variables.

---

## Machine Learning & Data Contract

1. **Spatial Coverage**: All 236 official taluks across 31 Karnataka districts with 956+ offline verified villages.
2. **Dataset**: Pre-trained on 10-year daily CHIRPS high-resolution rainfall observations (2015–2024).
3. **Targets (13)**:
   - `target_onset_next14d`: 14-day monsoon onset arrival probability.
   - `target_break_w1` .. `w4`: Break / dry-spell risk (<5 mm) across 4 weekly horizons.
   - `target_active_w1` .. `w4`: Active monsoon conditions ($\ge 30$ mm) across 4 weekly horizons.
   - `target_heavy_w1` .. `w4`: Severe downpour risk ($\ge 64.5$ mm) across 4 weekly horizons.
4. **Feature Vector**: Exact 18 features asserted on startup:
   `precip`, `precip_3d_sum`, `precip_7d_sum`, `precip_14d_sum`, `precip_21d_sum`, `precip_lag1`, `precip_lag2`, `precip_lag3`, `precip_7d_anomaly`, `sin_doy`, `cos_doy`, `oni`, `dmi`, `mjo_amplitude`, `sin_mjo_phase`, `cos_mjo_phase`, `is_el_nino`, `is_positive_iod`.

---

## Testing & Quality Assurance

- **Backend Test Suite**:
  ```bash
  python -m pytest backend/tests -v
  ```
- **Frontend Linter & Type Check**:
  ```bash
  npm run lint
  npm run build
  ```
