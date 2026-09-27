import logging
import time
import requests
import numpy as np
from typing import Dict, Any
from app.config import TELECONNECTIONS_CACHE_TTL, TELECONNECTIONS_TIMEOUT_SECONDS

logger = logging.getLogger("varsha_setu.teleconnections")

_tele_cache: Dict[str, Any] | None = None
_cache_timestamp: float = 0.0

def get_teleconnections(force_refresh: bool = False) -> Dict[str, Any]:
    """
    Fetches real-time planetary climate teleconnection indices:
    1. NOAA ONI (Oceanic Niño Index for ENSO)
    2. NOAA PSL DMI (Dipole Mode Index for Indian Ocean Dipole)
    3. Australia BOM RMM MJO (Madden-Julian Oscillation amplitude and phase)

    Caches results in-memory with a 24-hour TTL and falls back to documented
    climatological baseline values if any upstream data provider is unavailable.
    """
    global _tele_cache, _cache_timestamp

    now = time.time()
    if not force_refresh and _tele_cache is not None and (now - _cache_timestamp < TELECONNECTIONS_CACHE_TTL):
        return _tele_cache

    # Baseline defaults (documenting fallback values)
    oni = 0.20
    dmi = 0.05
    mjo_amp = 1.2
    mjo_phase = 3

    # 1. Live NOAA ONI (ENSO)
    try:
        r = requests.get(
            'https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt',
            timeout=TELECONNECTIONS_TIMEOUT_SECONDS
        )
        if r.status_code == 200:
            lines = [line.strip().split() for line in r.text.strip().split('\n') if line.strip()]
            for p in reversed(lines):
                if len(p) >= 4 and p[0].isdigit():
                    oni = float(p[3])
                    break
            logger.info("Successfully fetched live NOAA ONI: %.2f", oni)
    except Exception as e:
        logger.warning("Could not fetch live NOAA ONI (%s). Using fallback: %.2f", e, oni)

    # 2. Live NOAA PSL DMI (IOD)
    try:
        r2 = requests.get(
            'https://psl.noaa.gov/gcos_wgsp/Timeseries/Data/dmi.long.data',
            timeout=TELECONNECTIONS_TIMEOUT_SECONDS
        )
        if r2.status_code == 200:
            for line in reversed(r2.text.strip().split('\n')):
                p = line.strip().split()
                if len(p) == 13 and p[0].isdigit():
                    vals = [float(v) for v in p[1:] if float(v) > -900]
                    if vals:
                        dmi = vals[-1]
                        break
            logger.info("Successfully fetched live NOAA PSL DMI: %.2f", dmi)
    except Exception as e:
        logger.warning("Could not fetch live NOAA PSL DMI (%s). Using fallback: %.2f", e, dmi)

    # 3. Live Australia BOM RMM MJO Index
    try:
        mjo_url = 'http://www.bom.gov.au/climate/mjo/graphics/rmm.74toRealtime.txt'
        r3 = requests.get(
            mjo_url,
            headers={'User-Agent': 'Mozilla/5.0'},
            timeout=TELECONNECTIONS_TIMEOUT_SECONDS
        )
        if r3.status_code == 200:
            lines = [line.strip().split() for line in r3.text.strip().split('\n') if line.strip() and not line.startswith('#')]
            for p in reversed(lines):
                if len(p) >= 7 and p[0].isdigit():
                    mjo_phase = int(p[5])
                    mjo_amp = float(p[6])
                    break
            logger.info("Successfully fetched live BOM MJO: Amp=%.2f, Phase=%d", mjo_amp, mjo_phase)
    except Exception as e:
        logger.warning("Could not fetch live BOM MJO (%s). Using fallback: Amp=%.2f, Phase=%d", e, mjo_amp, mjo_phase)

    sin_mjo = float(np.sin(2 * np.pi * mjo_phase / 8.0))
    cos_mjo = float(np.cos(2 * np.pi * mjo_phase / 8.0))
    is_el_nino = 1 if oni >= 0.5 else 0
    is_pos_iod = 1 if dmi >= 0.4 else 0

    result = {
        'oni': oni,
        'dmi': dmi,
        'mjo_amp': mjo_amp,
        'mjo_phase': mjo_phase,
        'sin_mjo': sin_mjo,
        'cos_mjo': cos_mjo,
        'is_el_nino': is_el_nino,
        'is_pos_iod': is_pos_iod
    }

    _tele_cache = result
    _cache_timestamp = now
    return result
