import streamlit as st
import pandas as pd
import numpy as np
import requests
import joblib
import datetime
import urllib.parse
from gtts import gTTS
import io
import os
import warnings

warnings.filterwarnings('ignore')

st.set_page_config(page_title='Karnataka Hyperlocal Monsoon AI', page_icon='🌾', layout='wide')

# ---------------------------------------------------------------------------
# 1. REGIONAL SOIL WATER RETENTION & AWC DATABASE (ALL 31 DISTRICTS COVERED)
# ---------------------------------------------------------------------------
DISTRICT_SOIL_MAP = {
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

def get_soil_info(district):
    return DISTRICT_SOIL_MAP.get(district, {'type': 'Medium Red Loam', 'awc': 100, 'buffer_days': 5, 'drainage': 'Moderate'})

# ---------------------------------------------------------------------------
# 2. LOAD SYSTEM ARTIFACTS
# ---------------------------------------------------------------------------
@st.cache_resource
def load_all_artifacts():
    models = joblib.load('karnataka_multitarget_models.pkl')
    features = joblib.load('feature_columns.pkl')
    raw_thresh = joblib.load('optimal_thresholds.pkl') if os.path.exists('optimal_thresholds.pkl') else {}
    clean_thresholds = {}
    for k, v in raw_thresh.items():
        clean_thresholds[k] = float(v.get('cutoff', v.get('threshold', 0.45))) if isinstance(v, dict) else float(v)
    taluks = pd.read_csv('karnataka_taluks_verified.csv')
    village_cols = ['name', 'label', 'taluk', 'district', 'lat', 'lon']
    if os.path.exists('karnataka_offline_villages_master.csv'):
        villages = pd.read_csv('karnataka_offline_villages_master.csv')
        for col in village_cols:
            if col not in villages.columns:
                villages[col] = ''
    else:
        villages = pd.DataFrame(columns=village_cols)
    return models, features, clean_thresholds, taluks, villages

models_bundle, feature_cols, opt_thresholds, karnataka_taluks, offline_villages = load_all_artifacts()

st.title('🌾 Hyperlocal Monsoon Outlook & Soil-Aware Advisory')
st.caption(f'SIH 26086 | Universal Village & Panchayat Coverage across all {len(karnataka_taluks)} Official Taluks')

# ---------------------------------------------------------------------------
# 3. LIVE CLIMATE TELECONNECTIONS (NOAA ONI + PSL DMI + BOM LIVE RMM MJO)
# ---------------------------------------------------------------------------
@st.cache_data(ttl=86400)
def get_teleconnections():
    oni, dmi, mjo_amp, mjo_phase = 0.20, 0.05, 1.2, 3
    # 1. Live NOAA ONI (ENSO)
    try:
        r = requests.get('https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt', timeout=5)
        if r.status_code == 200:
            lines = [l.strip().split() for l in r.text.strip().split('\n') if l.strip()]
            for p in reversed(lines):
                if len(p) >= 4 and p[0].isdigit():
                    oni = float(p[3]); break
    except Exception:
        pass

    # 2. Live NOAA PSL DMI (IOD)
    try:
        r2 = requests.get('https://psl.noaa.gov/gcos_wgsp/Timeseries/Data/dmi.long.data', timeout=5)
        if r2.status_code == 200:
            for line in reversed(r2.text.strip().split('\n')):
                p = line.strip().split()
                if len(p) == 13 and p[0].isdigit():
                    vals = [float(v) for v in p[1:] if float(v) > -900]
                    if vals:
                        dmi = vals[-1]; break
    except Exception:
        pass

    # 3. Live Australia BOM RMM MJO Index
    try:
        mjo_url = 'http://www.bom.gov.au/climate/mjo/graphics/rmm.74toRealtime.txt'
        r3 = requests.get(mjo_url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=5)
        if r3.status_code == 200:
            lines = [l.strip().split() for l in r3.text.strip().split('\n') if l.strip() and not l.startswith('#')]
            for p in reversed(lines):
                if len(p) >= 7 and p[0].isdigit():
                    mjo_phase = int(p[5])
                    mjo_amp = float(p[6])
                    break
    except Exception:
        pass

    sin_mjo = np.sin(2 * np.pi * mjo_phase / 8.0)
    cos_mjo = np.cos(2 * np.pi * mjo_phase / 8.0)
    return {
        'oni': oni, 'dmi': dmi, 'mjo_amp': mjo_amp, 'mjo_phase': mjo_phase,
        'sin_mjo': sin_mjo, 'cos_mjo': cos_mjo,
        'is_el_nino': 1 if oni >= 0.5 else 0,
        'is_pos_iod': 1 if dmi >= 0.4 else 0
    }

tele = get_teleconnections()

# ---------------------------------------------------------------------------
# 4. SIDEBAR NAVIGATION
# ---------------------------------------------------------------------------
st.sidebar.header('📍 Location & Farm Context')
query_mode = st.sidebar.radio('Location Mode:', ['Administrative Hierarchy (District/Taluk)', 'Search Any Village / GP / Hobli'])
crop_type = st.sidebar.selectbox('Crop Selection:', ['Finger Millet (Ragi)', 'Maize', 'Groundnut', 'Sugarcane', 'Paddy', 'Cotton'])
crop_stage = st.sidebar.selectbox('Growth Stage:', ['Pre-Sowing / Land Preparation', 'Sowing & Germination', 'Vegetative Growth', 'Flowering / Grain Formation', 'Harvesting'])
language = st.sidebar.selectbox('Advisory Language / ಭಾಷೆ:', ['English', 'ಕನ್ನಡ (Kannada)'])

st.sidebar.markdown('---')
st.sidebar.markdown('### 🌐 Planetary Climate Teleconnections')
st.sidebar.caption(f"**ENSO (ONI):** `{tele['oni']:+.2f}` ({'El Niño' if tele['is_el_nino'] else 'Neutral/La Niña'})")
st.sidebar.caption(f"**IOD (DMI):** `{tele['dmi']:+.2f}` ({'+IOD active' if tele['is_pos_iod'] else 'Neutral/-IOD'})")
st.sidebar.caption(f"**MJO Index (BOM Live):** Amp `{tele['mjo_amp']:.2f}` | Phase `{tele['mjo_phase']}`")

target_lat, target_lon = None, None
target_title, parent_taluk, parent_dist, scale_tag = '', '', '', ''
resolution_error = None

if query_mode == 'Administrative Hierarchy (District/Taluk)':
    selected_dist = st.sidebar.selectbox('Select District:', sorted(karnataka_taluks['district'].unique()))
    taluk_opts = sorted(karnataka_taluks[karnataka_taluks['district'] == selected_dist]['taluk_name'].unique())
    selected_taluk = st.sidebar.selectbox('Select Taluk:', taluk_opts)
    row = karnataka_taluks[(karnataka_taluks['district'] == selected_dist) & (karnataka_taluks['taluk_name'] == selected_taluk)].iloc[0]
    target_lat, target_lon = float(row['lat']), float(row['lon'])
    target_title, parent_taluk, parent_dist = selected_taluk, selected_taluk, selected_dist
    scale_tag = 'Administrative Taluk Node'
else:
    v_query = st.sidebar.text_input('Enter ANY Village/Panchayat name in Karnataka:', value='Sonda')
    v_clean = v_query.strip().lower()
    exact = offline_villages[offline_villages['name'].astype(str).str.lower() == v_clean] if len(offline_villages) > 0 else pd.DataFrame()
    if len(exact) > 1:
        st.sidebar.warning(f'Multiple entries found for {v_query}.')
        choice = st.sidebar.radio('Select Intended Location:', range(len(exact)), format_func=lambda i: f"{exact.iloc[i]['label']} ({exact.iloc[i]['district']} Dist)")
        r = exact.iloc[choice]
        target_lat, target_lon = float(r['lat']), float(r['lon'])
        target_title, parent_taluk, parent_dist = str(r['label']), str(r['taluk']), str(r['district'])
        scale_tag = 'Village Cluster (Disambiguated Offline)'
    elif len(exact) == 1:
        r = exact.iloc[0]
        target_lat, target_lon = float(r['lat']), float(r['lon'])
        target_title, parent_taluk, parent_dist = str(r['label']), str(r['taluk']), str(r['district'])
        scale_tag = 'Village Cluster (Offline Verified)'
    else:
        enc_query = urllib.parse.quote(f'{v_query}, Karnataka, India')
        headers = {'User-Agent': 'SIH26086_Karnataka_Monsoon_Universal/3.0'}
        try:
            geo_res = requests.get(f'https://nominatim.openstreetmap.org/search?q={enc_query}&format=json&limit=1', headers=headers, timeout=6).json()
            if geo_res:
                cand_lat = float(geo_res[0]['lat'])
                cand_lon = float(geo_res[0]['lon'])
                if 11.5 <= cand_lat <= 18.6 and 74.0 <= cand_lon <= 78.6:
                    target_lat = cand_lat
                    target_lon = cand_lon
                    target_title = str(v_query).strip().title()
                    distances = np.sqrt((karnataka_taluks['lat'] - target_lat)**2 + (karnataka_taluks['lon'] - target_lon)**2)
                    nearest = karnataka_taluks.iloc[distances.argmin()]
                    parent_taluk, parent_dist = str(nearest['taluk_name']), str(nearest['district'])
                    scale_tag = 'Hyperlocal Village (Live Geocoded OSM)'
                else:
                    resolution_error = f'{v_query} resolved outside Karnataka boundaries.'
            else:
                resolution_error = f'Village {v_query} could not be located.'
        except Exception as e:
            resolution_error = f'Geocoding error: {str(e)}'

# ---------------------------------------------------------------------------
# 5. WEATHER & PREDICTION
# ---------------------------------------------------------------------------
if target_lat is None:
    st.error(resolution_error or 'Unable to resolve location.')
else:
    soil_data = get_soil_info(parent_dist)
    w_url = f'https://api.open-meteo.com/v1/forecast?latitude={target_lat}&longitude={target_lon}&daily=precipitation_sum&past_days=21&forecast_days=1&timezone=Asia%2FKolkata'
    try:
        res = requests.get(w_url, timeout=8).json()
        p_vals = res.get('daily', {}).get('precipitation_sum', [0.0]*22)
        p_s = pd.Series(p_vals).fillna(0.0).clip(lower=0.0)
    except Exception:
        p_s = pd.Series([0.0]*22)

    p_today = float(p_s.iloc[-1])
    p_3d = float(p_s.tail(3).sum())
    p_7d = float(p_s.tail(7).sum())
    p_14d = float(p_s.tail(14).sum())
    p_21d = float(p_s.tail(21).sum())
    p_l1 = float(p_s.iloc[-2]) if len(p_s) >= 2 else p_today
    p_l2 = float(p_s.iloc[-3]) if len(p_s) >= 3 else p_today
    p_l3 = float(p_s.iloc[-4]) if len(p_s) >= 4 else p_today

    doy = datetime.date.today().timetuple().tm_yday
    sin_doy = np.sin(2 * np.pi * doy / 365.25)
    cos_doy = np.cos(2 * np.pi * doy / 365.25)
    anomaly_7d = p_7d - 25.0

    f_vec = pd.DataFrame([[
        p_today, p_3d, p_7d, p_14d, p_21d, p_l1, p_l2, p_l3, anomaly_7d,
        sin_doy, cos_doy, tele['oni'], tele['dmi'], tele['mjo_amp'],
        tele['sin_mjo'], tele['cos_mjo'], tele['is_el_nino'], tele['is_pos_iod']
    ]], columns=feature_cols)

    def infer_event(tgt):
        m = models_bundle[tgt]
        prob = float(0.60 * m['xgb'].predict_proba(f_vec)[0][1] + 0.40 * m['rf'].predict_proba(f_vec)[0][1])
        cutoff = opt_thresholds.get(tgt, 0.45)
        return prob, cutoff, prob >= cutoff

    p_onset, cut_onset, trig_onset = infer_event('target_onset_next14d')
    w1_break, c1_b, t1_b = infer_event('target_break_w1')
    w1_active, c1_a, t1_a = infer_event('target_active_w1')
    w1_heavy, c1_h, t1_h = infer_event('target_heavy_w1')
    w2_break, c2_b, t2_b = infer_event('target_break_w2')
    w2_active, c2_a, t2_a = infer_event('target_active_w2')
    w2_heavy, c2_h, t2_h = infer_event('target_heavy_w2')
    w3_break, c3_b, t3_b = infer_event('target_break_w3')
    w3_active, c3_a, t3_a = infer_event('target_active_w3')
    w3_heavy, c3_h, t3_h = infer_event('target_heavy_w3')
    w4_break, c4_b, t4_b = infer_event('target_break_w4')
    w4_active, c4_a, t4_a = infer_event('target_active_w4')
    w4_heavy, c4_h, t4_h = infer_event('target_heavy_w4')

    st.subheader(f'📍 Location Profile: {target_title}')
    c1, c2, c3, c4 = st.columns(4)
    c1.metric('Spatial Node', scale_tag)
    c2.metric('Taluk', parent_taluk)
    c3.metric('District', parent_dist)
    c4.metric('Coordinates', f'{target_lat:.3f}°N, {target_lon:.3f}°E')

    st.markdown('---')
    st.markdown('### 🧱 Regional Soil Moisture & Retention Profile')
    s1, s2, s3, s4 = st.columns(4)
    s1.metric('Soil Texture', str(soil_data['type']))
    s2.metric('Available Water Capacity', f"{soil_data['awc']} mm/m")
    s3.metric('Dry-Spell Buffer', f"~{soil_data['buffer_days']} Days")
    s4.metric('Drainage Property', str(soil_data['drainage']))

    st.markdown('---')
    st.markdown('### 🌧️ Monsoon Onset Arrival Outlook')
    col_on1, col_on2 = st.columns([1, 2])
    with col_on1:
        st.metric('14-Day Onset Probability', f'{p_onset * 100:.1f}%')
        status_tag = '🔴 ONSET ACTIVE' if trig_onset else '🟢 PRE-MONSOON PHASE'
        st.caption(f'Status: **{status_tag}** (Calibrated Cutoff: {cut_onset * 100:.1f}%)')
    with col_on2:
        normal_date = 'June 05 - June 09' if ('Dakshina' in parent_dist or 'Udupi' in parent_dist) else 'June 08 - June 14'
        driver_txt = 'Onset spell favored by planetary indices' if trig_onset else 'Standard pre-monsoon progression'
        st.info(f'**Climatological Normal Onset for {parent_dist}:** {normal_date}\n\n**Current Driver Outlook:** {driver_txt}')

    st.markdown('---')
    st.markdown('### 📊 Complete 7–30 Day Probabilistic Outlook (All Horizons)')
    def render_badge(trig): return '⚠️ **ALERT**' if trig else '✔️ Normal'

    h1, h2, h3, h4 = st.columns(4)
    with h1:
        st.markdown('#### Week 1 (1–7 Days)')
        st.metric('Break Spell Risk', f'{w1_break * 100:.1f}%')
        st.caption(f'Break: {render_badge(t1_b)} ({c1_b * 100:.0f}%)\n\nActive: **{w1_active * 100:.1f}%** ({render_badge(t1_a)})\n\nHeavy: **{w1_heavy * 100:.1f}%** ({render_badge(t1_h)})')
    with h2:
        st.markdown('#### Week 2 (8–14 Days)')
        st.metric('Break Spell Risk', f'{w2_break * 100:.1f}%')
        st.caption(f'Break: {render_badge(t2_b)} ({c2_b * 100:.0f}%)\n\nActive: **{w2_active * 100:.1f}%** ({render_badge(t2_a)})\n\nHeavy: **{w2_heavy * 100:.1f}%** ({render_badge(t2_h)})')
    with h3:
        st.markdown('#### Week 3 (15–21 Days)')
        st.metric('Break Spell Risk', f'{w3_break * 100:.1f}%')
        st.caption(f'Break: {render_badge(t3_b)} ({c3_b * 100:.0f}%)\n\nActive: **{w3_active * 100:.1f}%** ({render_badge(t3_a)})\n\nHeavy: **{w3_heavy * 100:.1f}%** ({render_badge(t3_h)})')
    with h4:
        st.markdown('#### Week 4 (22–30 Days)')
        st.metric('Break Spell Risk', f'{w4_break * 100:.1f}%')
        st.caption(f'Break: {render_badge(t4_b)} ({c4_b * 100:.0f}%)\n\nActive: **{w4_active * 100:.1f}%** ({render_badge(t4_a)})\n\nHeavy: **{w4_heavy * 100:.1f}%** ({render_badge(t4_h)})')

    # ---------------------------------------------------------------------------
    # 6. SOIL-AWARE ADVISORY (BILINGUAL KANNADA & ENGLISH ENGINE)
    # ---------------------------------------------------------------------------
    st.markdown('---')
    st.markdown('### 🌾 Soil-Aware Agronomic Advisory / ಕೃಷಿ ಸಲಹೆ')
    is_low_retention = soil_data['awc'] <= 90

    if t1_b:
        if is_low_retention:
            action_en = f"CRITICAL MOISTURE STRESS: Break spell alert ({w1_break * 100:.1f}%) on {soil_data['type']} (only {soil_data['buffer_days']} days buffer). Suspend sowing of {crop_type} and apply biomass mulching immediately to prevent root scorch."
            action_kn = f"ತೀವ್ರ ತೇವಾಂಶ ಕೊರತೆ ಎಚ್ಚರಿಕೆ: {soil_data['type']} ಮಣ್ಣಿನಲ್ಲಿ ಮಳೆ ಕೊರತೆ ({w1_break * 100:.1f}%) ಉಂಟಾಗಲಿದೆ (ತೇವಾಂಶ ಧಾರಣ ಸಾಮರ್ಥ್ಯ ಕೇವಲ {soil_data['buffer_days']} ದಿನಗಳು). {crop_type} ಬಿತ್ತನೆಯನ್ನು ತಕ್ಷಣ ಮುಂದೂಡಿ ಮತ್ತು ಹೊದಿಕೆ (ಮಲ್ಚಿಂಗ್) ಮಾಡಿ."
        else:
            action_en = f"MODERATE DRY SPELL WATCH: Break spell forecast ({w1_break * 100:.1f}%), but {soil_data['type']} retains moisture for ~{soil_data['buffer_days']} days. Standing {crop_type} can sustain without emergency irrigation; delay nitrogen top-dressing until showers resume."
            action_kn = f"ಮಧ್ಯಮ ಮಳೆ ಕೊರತೆ: {soil_data['type']} ಮಣ್ಣು ಸುಮಾರು {soil_data['buffer_days']} ದಿನಗಳ ಕಾಲ ತೇವಾಂಶವನ್ನು ಹಿಡಿದಿಟ್ಟುಕೊಳ್ಳುತ್ತದೆ. {crop_type} ಬೆಳೆಗೆ ತಕ್ಷಣದ ನೀರಿನ ಕೊರತೆ ಇರುವುದಿಲ್ಲ; ರಾಸಾಯನಿಕ ಗೊಬ್ಬರ ಸಿಂಪರಣೆಯನ್ನು ಮುಂದೂಡಿ."
    elif t1_h:
        if 'Black' in soil_data['type']:
            action_en = f"WATERLOGGING HAZARD: Heavy downpour alert ({w1_heavy * 100:.1f}%) on swelling {soil_data['type']}. High risk of soil aeration deficit and root rot in {crop_type}. Open deep perimeter drainage trenches immediately."
            action_kn = f"ಜಮೀನಿನಲ್ಲಿ ನೀರು ನಿಲ್ಲುವ ಅಪಾಯ: {soil_data['type']} ಮಣ್ಣಿನಲ್ಲಿ ಭಾರೀ ಮಳೆ ({w1_heavy * 100:.1f}%) ಮುನ್ಸೂಚನೆ. {crop_type} ಬೆಳೆಯ ಬೇರು ಕೊಳೆಯದಂತೆ ತಕ್ಷಣ ಆಳವಾದ ಬಸಿಗಾಲುವೆಗಳನ್ನು ತೆರೆಯಿರಿ."
        else:
            action_en = f"Heavy rain alert ({w1_heavy * 100:.1f}%) on {soil_data['type']}. Clean field drainage furrows for {crop_type}."
            action_kn = f"ಭಾರೀ ಮಳೆಯಾಗುವ ಮುನ್ಸೂಚನೆ ({w1_heavy * 100:.1f}%). {crop_type} ಜಮೀನಿನ ಹೊರಭಾಗದಲ್ಲಿ ಹೆಚ್ಚುವರಿ ನೀರು ಹರಿದುಹೋಗಲು ಕಾಲುವೆ ಸರಿಪಡಿಸಿ."
    else:
        action_en = f"Favorable active monsoon conditions ({w1_active * 100:.1f}%). Soil moisture balance in {soil_data['type']} optimal for standard intercultural operations in {crop_type}."
        action_kn = f"ಉತ್ತಮ ಮುಂಗಾರು ಮಳೆ ಮುಂದುವರಿಯಲಿದೆ ({w1_active * 100:.1f}%). {soil_data['type']} ಮಣ್ಣಿನಲ್ಲಿ ತೇವಾಂಶ ಸೂಕ್ತವಾಗಿದ್ದು, {crop_type} ಬೆಳೆಯ ಕೃಷಿ ಚಟುವಟಿಕೆಗಳನ್ನು ಮುಂದುವರಿಸಿ."

    advisory_text = action_kn if language == 'ಕನ್ನಡ (Kannada)' else action_en
    st.info(f"**Field Advisory ({crop_type} - {crop_stage} | {soil_data['type']}):**\n\n{advisory_text}")

    audio_buf = io.BytesIO()
    tts = gTTS(text=advisory_text, lang='kn' if language == 'ಕನ್ನಡ (Kannada)' else 'en')
    tts.write_to_fp(audio_buf)
    audio_buf.seek(0)
    st.audio(audio_buf, format='audio/mp3')

st.markdown('---')
st.subheader('🗺️ Karnataka Regional Risk Gradient (Synchronized 236-Taluk Map)')
if os.path.exists('karnataka_final_risk_map.html'):
    with open('karnataka_final_risk_map.html', 'r', encoding='utf-8') as f_map:
        st.components.v1.html(f_map.read(), height=420)
