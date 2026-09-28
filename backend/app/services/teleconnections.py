import logging
import threading
import time
import requests
import numpy as np
from typing import Dict, Any, Optional
from app.config import TELECONNECTIONS_CACHE_TTL, TELECONNECTIONS_TIMEOUT_SECONDS

logger = logging.getLogger("varsha_setu.teleconnections")

# Global thread-safe state container
_lock = threading.Lock()
_tele_cache: Optional[Dict[str, Any]] = None
_last_updated: float = 0.0
_is_fetching: bool = False

# High-fidelity baseline defaults (documented historical climatological baseline)
DEFAULT_TELECONNECTIONS: Dict[str, Any] = {
    'oni': 0.20,
    'dmi': 0.05,
    'mjo_amp': 1.20,
    'mjo_phase': 3,
    'sin_mjo': float(np.sin(2 * np.pi * 3 / 8.0)),
    'cos_mjo': float(np.cos(2 * np.pi * 3 / 8.0)),
    'is_el_nino': 0,
    'is_pos_iod': 0,
    'data_source': 'climatological_baseline',
    'last_updated_iso': None,
    'is_cached': True
}

def update_teleconnections_in_background() -> Dict[str, Any]:
    """
    Executes live network fetching from NOAA ONI, NOAA PSL DMI, and Australia BOM RMM MJO.
    Designed to be run by background schedulers or startup workers.
    Never blocks user request threads.
    """
    global _tele_cache, _last_updated, _is_fetching

    with _lock:
        if _is_fetching:
            logger.debug("Teleconnections background update already in progress; skipping duplicate.")
            return _tele_cache or DEFAULT_TELECONNECTIONS
        _is_fetching = True

    try:
        logger.info("Executing background teleconnection indices fetch (NOAA & BOM)...")
        oni = 0.20
        dmi = 0.05
        mjo_amp = 1.20
        mjo_phase = 3
        sources = []

        # 1. Live NOAA ONI (ENSO)
        try:
            r = requests.get(
                'https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt',
                timeout=min(4.0, TELECONNECTIONS_TIMEOUT_SECONDS)
            )
            if r.status_code == 200:
                lines = [line.strip().split() for line in r.text.strip().split('\n') if line.strip()]
                for p in reversed(lines):
                    if len(p) >= 4 and p[0].isdigit():
                        oni = float(p[3])
                        sources.append("noaa_cpc_oni")
                        break
        except Exception as e:
            logger.warning("Background NOAA ONI fetch failed (%s); using baseline: %.2f", e, oni)

        # 2. Live NOAA PSL DMI (IOD)
        try:
            r2 = requests.get(
                'https://psl.noaa.gov/gcos_wgsp/Timeseries/Data/dmi.long.data',
                timeout=min(4.0, TELECONNECTIONS_TIMEOUT_SECONDS)
            )
            if r2.status_code == 200:
                for line in reversed(r2.text.strip().split('\n')):
                    p = line.strip().split()
                    if len(p) == 13 and p[0].isdigit():
                        vals = [float(v) for v in p[1:] if float(v) > -900]
                        if vals:
                            dmi = vals[-1]
                            sources.append("noaa_psl_dmi")
                            break
        except Exception as e:
            logger.warning("Background NOAA PSL DMI fetch failed (%s); using baseline: %.2f", e, dmi)

        # 3. Live Australia BOM RMM MJO Index
        try:
            mjo_url = 'http://www.bom.gov.au/climate/mjo/graphics/rmm.74toRealtime.txt'
            r3 = requests.get(
                mjo_url,
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'},
                timeout=min(4.0, TELECONNECTIONS_TIMEOUT_SECONDS)
            )
            if r3.status_code == 200:
                lines = [line.strip().split() for line in r3.text.strip().split('\n') if line.strip() and not line.startswith('#')]
                for p in reversed(lines):
                    if len(p) >= 7 and p[0].isdigit():
                        mjo_phase = int(p[5])
                        mjo_amp = float(p[6])
                        sources.append("australia_bom_mjo")
                        break
        except Exception as e:
            logger.warning("Background BOM MJO fetch failed (%s); using baseline: Amp=%.2f, Phase=%d", e, mjo_amp, mjo_phase)

        sin_mjo = float(np.sin(2 * np.pi * mjo_phase / 8.0))
        cos_mjo = float(np.cos(2 * np.pi * mjo_phase / 8.0))
        is_el_nino = 1 if oni >= 0.5 else 0
        is_pos_iod = 1 if dmi >= 0.4 else 0

        now = time.time()
        import datetime
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

        result = {
            'oni': oni,
            'dmi': dmi,
            'mjo_amp': mjo_amp,
            'mjo_phase': mjo_phase,
            'sin_mjo': sin_mjo,
            'cos_mjo': cos_mjo,
            'is_el_nino': is_el_nino,
            'is_pos_iod': is_pos_iod,
            'data_source': "+".join(sources) if sources else "climatological_baseline",
            'last_updated_iso': now_iso,
            'is_cached': True
        }

        with _lock:
            _tele_cache = result
            _last_updated = now
        logger.info("Successfully updated teleconnection cache: ONI=%.2f, DMI=%.2f, MJO=%.2f (Phase %d)", oni, dmi, mjo_amp, mjo_phase)
        return result
    finally:
        with _lock:
            _is_fetching = False

def get_teleconnections(force_refresh: bool = False) -> Dict[str, Any]:
    """
    Returns planetary teleconnection indices instantly (<0.1ms).
    NEVER blocks for external network requests during user forecast calculations.
    Serves from in-memory cache. If cache is empty, returns safe climatological baseline
    and triggers a non-blocking background refresh.
    """
    global _tele_cache, _last_updated
    now = time.time()

    with _lock:
        cached = _tele_cache
        last_up = _last_updated

    # Return cached data if valid
    if cached is not None and not force_refresh and (now - last_up < TELECONNECTIONS_CACHE_TTL):
        return cached

    # If stale or empty, trigger background refresh thread asynchronously without blocking caller
    threading.Thread(target=update_teleconnections_in_background, daemon=True).start()

    # Return current cache if available, else standard fallback baseline
    if cached is not None:
        return cached
    return DEFAULT_TELECONNECTIONS

