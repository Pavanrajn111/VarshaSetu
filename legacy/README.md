# Varsha Setu — Legacy Prototype Directory

This directory preserves early exploratory artifacts and initial prototyping scripts developed during the initial hackathon discovery phase:

- `legacy/streamlit_prototype/app.py`: Initial monolithic Streamlit prototype used to test raw Folium choropleths, Open-Meteo REST calls, and mock layout ideas before the decoupled full-stack architecture was implemented.

## Authoritative Production Stack

For all active development, evaluation, and deployment, refer to:

- **Serving Layer (`backend/`)**: FastAPI, SlowAPI rate-limiting, SQLite persistence with WAL mode, and serving pipeline for pre-trained dual XGBoost/Random Forest models.
- **Client Application (`src/`)**: TanStack Start / React 19 production web application with Tailwind CSS, Recharts, Framer Motion, and trilingual support.
