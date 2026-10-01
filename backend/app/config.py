import os
from pathlib import Path
from typing import Dict, Any

# Base directories
BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_ARTIFACTS_DIR = BACKEND_DIR / "artifacts"
ARTIFACTS_DIR = Path(os.getenv("ARTIFACTS_DIR", str(DEFAULT_ARTIFACTS_DIR)))

# Server & Environment Settings
APP_ENV = os.getenv("APP_ENV", "development").lower()
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

# Scheduler Multi-Worker Concurrency Guard
ENABLE_SCHEDULER = os.getenv("ENABLE_SCHEDULER", "true").lower() in ("true", "1", "yes")

# Auth JWT Secret Configuration
AUTH_JWT_SECRET = os.getenv("AUTH_JWT_SECRET", "varsha-setu-secure-auth-jwt-token-secret-2026-production-sih")
if APP_ENV == "production":
    if not os.getenv("AUTH_JWT_SECRET") or os.getenv("AUTH_JWT_SECRET") == "varsha-setu-secure-auth-jwt-token-secret-2026-production-sih":
        raise ValueError("CRITICAL: AUTH_JWT_SECRET must be explicitly configured when APP_ENV=production.")

# Voice API Protection (Optional external API key for server-to-server integrators)
ADVISORY_AUDIO_API_KEY = os.getenv("ADVISORY_AUDIO_API_KEY", "")

# Google Gemini API Key for Multilingual AI Assistant
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Config-driven CORS origins
raw_cors = os.getenv("CORS_ORIGINS")
parsed_env_origins = []

if raw_cors:
    import json
    raw_str = raw_cors.strip()
    try:
        loaded = json.loads(raw_str)
        if isinstance(loaded, list):
            for item in loaded:
                if isinstance(item, str) and item.strip():
                    parsed_env_origins.append(item.strip().rstrip("/"))
        elif isinstance(loaded, str):
            for item in loaded.split(","):
                if item.strip():
                    parsed_env_origins.append(item.strip().rstrip("/"))
    except Exception:
        for item in raw_str.split(","):
            if item.strip():
                parsed_env_origins.append(item.strip().rstrip("/"))

# Effective allowed origins including production Vercel URL and localhost development ports
DEFAULT_CORS_ORIGINS = [
    "https://varsha-setu-six.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
]

# Merge and deduplicate while preserving order
CORS_ORIGINS = list(dict.fromkeys(DEFAULT_CORS_ORIGINS + parsed_env_origins))

if APP_ENV == "production" and "*" in CORS_ORIGINS:
    raise ValueError("CRITICAL: Wildcard CORS origin '*' is strictly prohibited in production mode.")

# Karnataka Geographic Bounding Box (IMD / KSNMDC spatial envelope)
KARNATAKA_LAT_MIN = 11.5
KARNATAKA_LAT_MAX = 18.6
KARNATAKA_LON_MIN = 74.0
KARNATAKA_LON_MAX = 78.6

# Sanity distance threshold: maximum allowed distance (km) between an OSM-geocoded
# point inside Karnataka and the nearest verified taluk node.
NOMINATIM_MAX_DISTANCE_KM = float(os.getenv("NOMINATIM_MAX_DISTANCE_KM", "60.0"))

# API Clients, Timeouts & In-Memory Caching TTLs (seconds)
OPEN_METEO_TIMEOUT_SECONDS = float(os.getenv("OPEN_METEO_TIMEOUT_SECONDS", "8.0"))
NOMINATIM_TIMEOUT_SECONDS = float(os.getenv("NOMINATIM_TIMEOUT_SECONDS", "6.0"))
TELECONNECTIONS_TIMEOUT_SECONDS = float(os.getenv("TELECONNECTIONS_TIMEOUT_SECONDS", "6.0"))

TELECONNECTIONS_CACHE_TTL = int(os.getenv("TELECONNECTIONS_CACHE_TTL", "86400"))  # 24h
WEATHER_CACHE_TTL = int(os.getenv("WEATHER_CACHE_TTL", "600"))                    # 10m
LOCATION_CACHE_TTL = int(os.getenv("LOCATION_CACHE_TTL", "600"))                  # 10m
AUDIO_CACHE_TTL = int(os.getenv("AUDIO_CACHE_TTL", "86400"))                      # 24h

OSM_USER_AGENT = "SIH26086_Karnataka_Monsoon_Universal/3.0"

# ---------------------------------------------------------------------------
# REGIONAL SOIL WATER RETENTION & AWC DATABASE (ALL 31 KARNATAKA DISTRICTS)
# Sourced from NBSS&LUP & Karnataka State Watershed Development Department
# ---------------------------------------------------------------------------
DISTRICT_SOIL_MAP: Dict[str, Dict[str, Any]] = {
    # Deep Black Soils (Vertisols: High Retention ~180-220 mm/m)
    'Bagalkote': {'type': 'Deep Black Soil (Vertisol)', 'awc': 200, 'buffer_days': 10, 'drainage': 'Slow / High Retention'},
    'Vijayapura': {'type': 'Deep Black Soil (Vertisol)', 'awc': 200, 'buffer_days': 10, 'drainage': 'Slow / High Retention'},
    'Kalaburagi': {'type': 'Deep Black Clay', 'awc': 210, 'buffer_days': 12, 'drainage': 'Very Slow / Waterlogging Prone'},
    'Yadgir': {'type': 'Deep Black Clay', 'awc': 200, 'buffer_days': 10, 'drainage': 'Slow / High Retention'},
    'Bidar': {'type': 'Deep Black Clay & Laterite', 'awc': 200, 'buffer_days': 11, 'drainage': 'Slow / High Moisture Holding'},
    'Raichur': {'type': 'Medium to Deep Black Soil', 'awc': 190, 'buffer_days': 9, 'drainage': 'Moderate-Slow'},
    'Koppal': {'type': 'Mixed Red and Black Soil', 'awc': 140, 'buffer_days': 7, 'drainage': 'Moderate'},
    'Gadag': {'type': 'Medium Deep Black Soil', 'awc': 170, 'buffer_days': 8, 'drainage': 'Moderate-Slow'},
    'Dharwad': {'type': 'Medium Black Soil', 'awc': 160, 'buffer_days': 8, 'drainage': 'Moderate'},
    'Belagavi': {'type': 'Deep Black & Lateritic Blend', 'awc': 160, 'buffer_days': 8, 'drainage': 'Moderate'},
    'Ballari': {'type': 'Black Cotton & Red Sandy Loam', 'awc': 150, 'buffer_days': 7, 'drainage': 'Moderate'},
    'Vijayanagara': {'type': 'Mixed Red-Black Soil', 'awc': 140, 'buffer_days': 7, 'drainage': 'Moderate'},
    
    # Red Sandy Loam / Gravelly Soils (Alfisols: Low Retention ~60-90 mm/m)
    'Tumakuru': {'type': 'Red Sandy Loam', 'awc': 80, 'buffer_days': 4, 'drainage': 'Rapid / Drought Prone'},
    'Kolar': {'type': 'Red Sandy Loam', 'awc': 75, 'buffer_days': 3, 'drainage': 'Very Rapid / Drought Prone'},
    'Chikkaballapura': {'type': 'Red Sandy Loam', 'awc': 75, 'buffer_days': 3, 'drainage': 'Very Rapid / Drought Prone'},
    'Ramanagara': {'type': 'Red Loam & Sandy Clay', 'awc': 85, 'buffer_days': 4, 'drainage': 'Rapid'},
    'Bengaluru Rural': {'type': 'Red Sandy Clay Loam', 'awc': 90, 'buffer_days': 5, 'drainage': 'Moderate-Rapid'},
    'Bengaluru Urban': {'type': 'Red Clay Loam', 'awc': 95, 'buffer_days': 5, 'drainage': 'Moderate'},
    'Mandya': {'type': 'Red Sandy Loam', 'awc': 85, 'buffer_days': 4, 'drainage': 'Rapid'},
    'Mysuru': {'type': 'Red Loam & Medium Black', 'awc': 120, 'buffer_days': 6, 'drainage': 'Moderate'},
    'Chamarajanagara': {'type': 'Red Sandy Loam & Black Soil', 'awc': 110, 'buffer_days': 5, 'drainage': 'Moderate'},
    'Chitradurga': {'type': 'Red Sandy Loam & Shallow Black', 'awc': 100, 'buffer_days': 5, 'drainage': 'Moderate'},
    'Davanagere': {'type': 'Medium Black & Red Loam', 'awc': 130, 'buffer_days': 6, 'drainage': 'Moderate'},
    'Haveri': {'type': 'Medium Black & Red Loam', 'awc': 140, 'buffer_days': 7, 'drainage': 'Moderate'},
    
    # Malnad / Lateritic Soils
    'Shivamogga': {'type': 'Laterite & Red Clay Loam', 'awc': 120, 'buffer_days': 6, 'drainage': 'Good'},
    'Chikkamagaluru': {'type': 'Laterite & Forest Loam', 'awc': 115, 'buffer_days': 6, 'drainage': 'Good'},
    'Hassan': {'type': 'Red Sandy Loam & Laterite', 'awc': 105, 'buffer_days': 5, 'drainage': 'Moderate'},
    'Kodagu': {'type': 'Laterite & Forest Hill Soil', 'awc': 130, 'buffer_days': 6, 'drainage': 'Good'},
    
    # Coastal Sands / Alluvium
    'Dakshina Kannada': {'type': 'Coastal Alluvial & Sandy Laterite', 'awc': 70, 'buffer_days': 3, 'drainage': 'Excessive Percolation'},
    'Udupi': {'type': 'Coastal Sandy Alluvium', 'awc': 65, 'buffer_days': 3, 'drainage': 'Excessive Percolation'},
    'Uttara Kannada': {'type': 'Coastal Alluvial & Forest Loam', 'awc': 80, 'buffer_days': 4, 'drainage': 'Rapid'}
}

DEFAULT_SOIL_PROFILE = {
    'type': 'Medium Red Loam',
    'awc': 100,
    'buffer_days': 5,
    'drainage': 'Moderate'
}

# Crop & Stage Enumerations matching prototype
VALID_CROPS = [
    'Finger Millet (Ragi)',
    'Maize',
    'Groundnut',
    'Sugarcane',
    'Paddy',
    'Cotton'
]

VALID_STAGES = [
    'Pre-Sowing / Land Preparation',
    'Sowing & Germination',
    'Vegetative Growth',
    'Flowering / Grain Formation',
    'Harvesting'
]

VALID_LANGUAGES = [
    'English',
    'ಕನ್ನಡ (Kannada)',
    'हिन्दी (Hindi)',
    'en',
    'kn',
    'hi'
]
