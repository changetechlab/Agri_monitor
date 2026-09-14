/**
 * Agri Monitor -- js/satellite-engine.js
 * Multi-Index Satellite Analysis Engine
 * Supports: NDVI, NDRE, NDWI, NDBI
 *
 * DATA SOURCES
 * ─────────────────────────────────────────────────────────────
 * REAL (when GEE configured):
 *   Frontend -> /api/gee-tiles -> GEE -> COPERNICUS/S2_SR_HARMONIZED
 *   -> SCL cloud mask -> Index -> Dynamic tile URL -> Leaflet
 *
 * FALLBACK (current / no GEE):
 *   EOX Sentinel-2 Cloudless 2020 (pre-rendered RGB, no individual bands)
 *   Field values: DEMO/SIMULATED only (clearly labelled)
 *
 * To enable real GEE tiles:
 *   Set in Vercel environment variables (NEVER in this file or config.js):
 *   GEE_SERVICE_ACCOUNT_EMAIL and GEE_PRIVATE_KEY
 *
 * Exposes: window.SatelliteEngine (pure logic, no DOM)
 */

window.SatelliteEngine = (() => {

  // ============================================================
  // CENTRAL INDEX CONFIGURATION
  // ============================================================
  const INDEX_CONFIG = {

    ndvi: {
      id: 'ndvi',
      name: 'NDVI',
      fullName: 'Normalized Difference Vegetation Index',
      nameHi: 'वनस्पति सूचकांक (NDVI)',
      emoji: 'green',
      formula: '(B8 - B4) / (B8 + B4)',
      requiredBands: ['B4', 'B8'],
      bandDetail: 'B8 = NIR 842 nm (10 m) | B4 = Red 665 nm (10 m)',
      description: 'Measures green vegetation density and photosynthetic activity. Higher values = more/healthier vegetation.',
      descriptionHi: 'हरी वनस्पति और प्रकाश संश्लेषण की माप। अधिक मान = अधिक/स्वस्थ वनस्पति।',
      range: [-1, 1],
      dataStatus: 'available',
      colormap: [
        { val: -1.00, r: 139, g:   0, b:   0 },
        { val: -0.50, r: 200, g:  50, b:  50 },
        { val:  0.00, r: 210, g: 180, b: 140 },
        { val:  0.10, r: 240, g: 230, b: 100 },
        { val:  0.25, r: 200, g: 230, b:  80 },
        { val:  0.45, r: 120, g: 200, b:  60 },
        { val:  0.65, r:  60, g: 160, b:  30 },
        { val:  1.00, r:   0, g: 100, b:   0 },
      ],
      legendRanges: [
        { min: -1.0, max:  0.0, label: '< 0.0',      labelHi: 'जल / बंजर भूमि',   color: '#8b0000' },
        { min:  0.0, max:  0.2, label: '0.0 - 0.2',  labelHi: 'विरल वनस्पति',     color: '#d97706' },
        { min:  0.2, max:  0.4, label: '0.2 - 0.4',  labelHi: 'मध्यम वनस्पति',   color: '#84cc16' },
        { min:  0.4, max:  0.6, label: '0.4 - 0.6',  labelHi: 'स्वस्थ वनस्पति',  color: '#22c55e' },
        { min:  0.6, max:  1.0, label: '> 0.6',      labelHi: 'घनी वनस्पति',     color: '#15803d' },
      ],
      thresholds: { stress: 0.25, moderate: 0.45 },
    },

    ndre: {
      id: 'ndre',
      name: 'NDRE',
      fullName: 'Normalized Difference Red-Edge Index',
      nameHi: 'रेड-एज सूचकांक (NDRE)',
      emoji: 'lime',
      formula: '(B8A - B5) / (B8A + B5)',
      requiredBands: ['B5', 'B8A'],
      bandDetail: 'B8A = Narrow NIR 865 nm (20 m) | B5 = Red-Edge 705 nm (20 m)',
      description: 'More sensitive to chlorophyll and early crop stress than NDVI. Better for dense canopies where NDVI saturates.',
      descriptionHi: 'NDVI से पहले फसल तनाव पहचानता है। घने पत्तों में chlorophyll की बेहतर माप।',
      range: [-1, 1],
      dataStatus: 'requires_band_source',
      colormap: [
        { val: -1.00, r: 139, g:   0, b:   0 },
        { val: -0.20, r: 220, g:  80, b:  50 },
        { val:  0.00, r: 230, g: 200, b: 130 },
        { val:  0.15, r: 200, g: 220, b:  80 },
        { val:  0.30, r: 100, g: 190, b:  60 },
        { val:  0.50, r:  30, g: 150, b:  40 },
        { val:  1.00, r:   0, g:  90, b:  20 },
      ],
      legendRanges: [
        { min: -1.0, max:  0.0,  label: '< 0.0',        labelHi: 'उच्च तनाव / बंजर',    color: '#dc2626' },
        { min:  0.0, max:  0.2,  label: '0.0 - 0.2',    labelHi: 'तनाव में फसल',        color: '#f97316' },
        { min:  0.2, max:  0.35, label: '0.2 - 0.35',   labelHi: 'मध्यम Chlorophyll',   color: '#a3e635' },
        { min:  0.35,max:  0.5,  label: '0.35 - 0.5',   labelHi: 'स्वस्थ Chlorophyll',  color: '#22c55e' },
        { min:  0.5, max:  1.0,  label: '> 0.5',        labelHi: 'उच्च Chlorophyll',    color: '#15803d' },
      ],
      thresholds: { stress: 0.20, moderate: 0.35 },
    },

    ndwi: {
      id: 'ndwi',
      name: 'NDWI',
      fullName: 'Normalized Difference Water Index',
      nameHi: 'जल सूचकांक (NDWI)',
      emoji: 'blue',
      formula: '(B3 - B8) / (B3 + B8)',
      requiredBands: ['B3', 'B8'],
      bandDetail: 'B3 = Green 560 nm (10 m) | B8 = NIR 842 nm (10 m)',
      description: 'Detects surface water bodies and vegetation moisture content. Positive values indicate open water.',
      descriptionHi: 'नदी, तालाब और वनस्पति में नमी का पता लगाता है। धनात्मक मान = खुला जल।',
      range: [-1, 1],
      dataStatus: 'requires_band_source',
      colormap: [
        { val: -1.00, r: 139, g:  90, b:  43 },
        { val: -0.30, r: 210, g: 160, b:  90 },
        { val:  0.00, r: 200, g: 200, b: 200 },
        { val:  0.10, r: 147, g: 210, b: 240 },
        { val:  0.30, r:  59, g: 130, b: 246 },
        { val:  0.60, r:  29, g:  78, b: 216 },
        { val:  1.00, r:  30, g:  58, b: 138 },
      ],
      legendRanges: [
        { min: -1.0, max: -0.2, label: '< -0.2',       labelHi: 'शुष्क मिट्टी',       color: '#92400e' },
        { min: -0.2, max:  0.0, label: '-0.2 - 0.0',   labelHi: 'कम नमी',             color: '#d97706' },
        { min:  0.0, max:  0.2, label: '0.0 - 0.2',    labelHi: 'मध्यम नमी',          color: '#93c5fd' },
        { min:  0.2, max:  0.5, label: '0.2 - 0.5',    labelHi: 'उच्च नमी',           color: '#3b82f6' },
        { min:  0.5, max:  1.0, label: '> 0.5',        labelHi: 'खुला जल (नदी/तालाब)', color: '#1e3a8a' },
      ],
      thresholds: { stress: -0.1, moderate: 0.1 },
    },

    ndbi: {
      id: 'ndbi',
      name: 'NDBI',
      fullName: 'Normalized Difference Built-up Index',
      nameHi: 'निर्मित भूमि सूचकांक (NDBI)',
      emoji: 'orange',
      formula: '(B11 - B8) / (B11 + B8)',
      requiredBands: ['B8', 'B11'],
      bandDetail: 'B11 = SWIR 1610 nm (20 m) | B8 = NIR 842 nm (10 m)',
      description: 'Identifies built-up/urban areas and settlement boundaries. Positive values indicate built-up surfaces.',
      descriptionHi: 'बस्ती, सड़क और पक्की जमीन का पता लगाता है। धनात्मक मान = निर्मित क्षेत्र।',
      range: [-1, 1],
      dataStatus: 'requires_band_source',
      colormap: [
        { val: -1.00, r:   0, g: 100, b:   0 },
        { val: -0.20, r:  80, g: 160, b:  60 },
        { val:  0.00, r: 200, g: 200, b: 180 },
        { val:  0.10, r: 200, g: 180, b: 140 },
        { val:  0.25, r: 200, g: 140, b:  80 },
        { val:  0.50, r: 180, g:  80, b:  40 },
        { val:  1.00, r: 130, g:  40, b:  20 },
      ],
      legendRanges: [
        { min: -1.0, max: -0.1, label: '< -0.1',      labelHi: 'वन / प्राकृतिक',      color: '#15803d' },
        { min: -0.1, max:  0.0, label: '-0.1 - 0.0',  labelHi: 'कृषि / मिश्रित',      color: '#84cc16' },
        { min:  0.0, max:  0.2, label: '0.0 - 0.2',   labelHi: 'अर्ध-निर्मित',        color: '#d97706' },
        { min:  0.2, max:  0.5, label: '0.2 - 0.5',   labelHi: 'निर्मित क्षेत्र',     color: '#ea580c' },
        { min:  0.5, max:  1.0, label: '> 0.5',       labelHi: 'घनी बस्ती / शहरी',   color: '#7f1d1d' },
      ],
      thresholds: { stress: 0.2, moderate: 0.0 },
    },

  };

  // ============================================================
  // TILE CACHE (sessionStorage)
  // Key: gee_tile_{index}_{date}_{district}
  // Clears automatically when session ends or tile expires
  // ============================================================
  const CACHE_KEY_PREFIX = 'gee_tile_';

  function _cacheKey(index, date, district) {
    return CACHE_KEY_PREFIX + index + '_' + date + '_' + (district || 'rudraprayag');
  }

  function _cacheGet(index, date, district) {
    try {
      const raw = sessionStorage.getItem(_cacheKey(index, date, district));
      if (!raw) return null;
      const entry = JSON.parse(raw);
      // Respect GEE tile expiry
      if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
        sessionStorage.removeItem(_cacheKey(index, date, district));
        return null;
      }
      return entry;
    } catch (e) { return null; }
  }

  function _cacheSet(index, date, district, data) {
    try {
      sessionStorage.setItem(_cacheKey(index, date, district), JSON.stringify(data));
    } catch (e) { /* sessionStorage full -- ignore */ }
  }

  // ============================================================
  // ASYNC TILE FETCH (GEE via Vercel API, or EOX fallback)
  // ============================================================

  /**
   * Returns the GEE tile URL for a given index and date.
   * Checks sessionStorage cache first; falls back to EOX on API failure.
   *
   * @param {string} indexType  ndvi | ndre | ndwi | ndbi
   * @param {string} date       YYYY-MM-DD
   * @param {string} [district] rudraprayag (default)
   * @returns {Promise<{tileUrl, isReal, meta}>}
   */
  async function fetchTileUrl(indexType, date, district) {
    district = district || 'rudraprayag';

    // 1. Check session cache
    const cached = _cacheGet(indexType, date, district);
    if (cached && cached.tileUrl) {
      return cached;
    }

    const appCfg = window.AgriConfig || {};
    const apiEndpoint = appCfg.GEE_API_ENDPOINT || '/api/gee-tiles';

    // 2. If no API endpoint configured, return EOX fallback immediately
    if (!apiEndpoint) {
      return _eoxFallback();
    }

    // 3. Fetch from Vercel serverless function
    try {
      const params = new URLSearchParams({ index: indexType, date, district });
      const resp   = await fetch(apiEndpoint + '?' + params.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(25000),  // 25s timeout (function max is 30s)
      });

      if (!resp.ok) {
        console.warn('[SatelliteEngine] GEE API HTTP ' + resp.status + ' — falling back to EOX');
        return _eoxFallback();
      }

      const data = await resp.json();

      if (!data.success || !data.tileUrl) {
        // API responded but no imagery — surface the real message
        console.info('[SatelliteEngine] GEE: ' + (data.message || 'no imagery'));
        return { tileUrl: null, isReal: false, meta: data };
      }

      // Cache successful result
      _cacheSet(indexType, date, district, data);
      return data;

    } catch (err) {
      console.warn('[SatelliteEngine] GEE API fetch error:', err.message, '— falling back to EOX');
      return _eoxFallback();
    }
  }

  function _eoxFallback() {
    return {
      tileUrl: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
      isReal: false,
      isFallback: true,
      meta: { source: 'EOX Sentinel-2 Cloudless 2020 (RGB fallback)' },
    };
  }

  /** Synchronous check: is GEE configured and did it previously succeed? */
  function isGEEConfigured() {
    const cfg = window.AgriConfig || {};
    return !!(cfg.GEE_API_ENDPOINT && cfg.GEE_API_ENDPOINT !== '');
  }

  // ============================================================
  // PURE CALCULATION FUNCTIONS (for future field polygon analytics)
  // ============================================================
  function _nd(a, b) { const d = a + b; return d === 0 ? null : (a - b) / d; }
  function calculateNDVI(b8, b4)   { return _nd(b8, b4); }
  function calculateNDRE(b8a, b5)  { return _nd(b8a, b5); }
  function calculateNDWI(b3, b8)   { return _nd(b3, b8); }
  function calculateNDBI(b11, b8)  { return _nd(b11, b8); }

  function calculateIndex(indexType, bands) {
    switch (indexType) {
      case 'ndvi': return calculateNDVI(bands.B8,  bands.B4);
      case 'ndre': return calculateNDRE(bands.B8A, bands.B5);
      case 'ndwi': return calculateNDWI(bands.B3,  bands.B8);
      case 'ndbi': return calculateNDBI(bands.B11, bands.B8);
      default: console.warn('[SatelliteEngine] Unknown index:', indexType); return null;
    }
  }

  // ============================================================
  // COLORMAP
  // ============================================================
  function getColorForValue(indexType, value) {
    const cfg = INDEX_CONFIG[indexType];
    if (!cfg) return { r: 128, g: 128, b: 128 };
    const cm = cfg.colormap;
    const v  = Math.max(cfg.range[0], Math.min(cfg.range[1], value));
    for (let i = 0; i < cm.length - 1; i++) {
      const c1 = cm[i], c2 = cm[i + 1];
      if (v >= c1.val && v <= c2.val) {
        const t = (v - c1.val) / (c2.val - c1.val);
        return {
          r: Math.round(c1.r + t * (c2.r - c1.r)),
          g: Math.round(c1.g + t * (c2.g - c1.g)),
          b: Math.round(c1.b + t * (c2.b - c1.b)),
        };
      }
    }
    const last = cm[cm.length - 1];
    return { r: last.r, g: last.g, b: last.b };
  }

  function getCssColor(indexType, value) {
    const { r, g, b } = getColorForValue(indexType, value);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  // ============================================================
  // CLASSIFICATION
  // ============================================================
  function classifyValue(indexType, value) {
    const t = (INDEX_CONFIG[indexType] || {}).thresholds || {};
    if (indexType === 'ndbi') {
      if (value >= (t.stress   || 0.2))  return 'stress';
      if (value >= (t.moderate || 0.0))  return 'moderate';
      return 'healthy';
    }
    if (value < (t.stress   || 0.25)) return 'stress';
    if (value < (t.moderate || 0.45)) return 'moderate';
    return 'healthy';
  }

  // ============================================================
  // SIMULATION (DEMO ONLY -- NOT satellite-derived)
  // ============================================================
  function _simNDVI(seed, month) {
    if (month === 12) return 0.22 + (seed % 3) * 0.04;
    if (month ===  1) return 0.35 + (seed % 4) * 0.05;
    if (month ===  2) return 0.58 + (seed % 3) * 0.08;
    if (month ===  3) return seed % 2 === 0 ? 0.14 + (seed % 3) * 0.03 : 0.38 + (seed % 3) * 0.04;
    if (month ===  4) return 0.32 + (seed % 3) * 0.05;
    if (month ===  5) return 0.44 + (seed % 4) * 0.05;
    return 0.45;
  }
  function _simNDRE(seed, month) {
    return Math.max(-0.5, Math.min(0.8, _simNDVI(seed, month) - 0.05 - (seed % 5) * 0.02));
  }
  function _simNDWI(seed, month) {
    const monsoon = [6, 7, 8, 9];
    return Math.max(-0.8, Math.min(0.8, (monsoon.includes(month) ? 0.15 : -0.10) + (seed % 5) * 0.04 - 0.08));
  }
  function _simNDBI(seed) {
    return Math.max(-0.7, Math.min(0.4, -0.25 + (seed % 7) * 0.05));
  }

  function simulateValue(indexType, seed, month) {
    switch (indexType) {
      case 'ndvi': return _simNDVI(seed, month);
      case 'ndre': return _simNDRE(seed, month);
      case 'ndwi': return _simNDWI(seed, month);
      case 'ndbi': return _simNDBI(seed, month);
      default:     return 0;
    }
  }

  // ============================================================
  // CANVAS GRADIENT RENDERING
  // ============================================================
  function renderColormapToCanvas(indexType, canvas) {
    if (!canvas) return;
    const cfg = INDEX_CONFIG[indexType];
    if (!cfg) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.offsetWidth || 200;
    const h = canvas.height = 20;
    const [rMin, rMax] = cfg.range;
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    cfg.colormap.forEach(pt => {
      const stop = Math.max(0, Math.min(1, (pt.val - rMin) / (rMax - rMin)));
      grad.addColorStop(stop, 'rgb(' + pt.r + ',' + pt.g + ',' + pt.b + ')');
    });
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'left';   ctx.fillText(rMin.toString(), 2, 14);
    ctx.textAlign = 'center'; ctx.fillText('0', w / 2, 14);
    ctx.textAlign = 'right';  ctx.fillText('+' + rMax, w - 2, 14);
  }

  // ============================================================
  // PUBLIC API
  // ============================================================
  return {
    INDEX_CONFIG,
    getConfig:      (type) => INDEX_CONFIG[type] || null,
    getAllIndices:   () => Object.keys(INDEX_CONFIG),

    // Tile routing (async -- calls Vercel function)
    fetchTileUrl,
    isGEEConfigured,

    // Pure calculation (ready for field polygon analytics)
    calculateIndex,
    calculateNDVI, calculateNDRE, calculateNDWI, calculateNDBI,

    // Color / classification
    getColorForValue, getCssColor, classifyValue,

    // Legend
    getLegendRanges: (type) => (INDEX_CONFIG[type] || {}).legendRanges || [],
    getThresholds:   (type) => (INDEX_CONFIG[type] || {}).thresholds   || {},

    // Simulation (DEMO only -- NOT satellite-derived)
    simulateValue,

    // Rendering
    renderColormapToCanvas,
  };

})();
