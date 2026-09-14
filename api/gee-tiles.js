/**
 * api/gee-tiles.js
 * ─────────────────────────────────────────────────────────────
 * Vercel Serverless Function — GEE Satellite Index Tile Provider
 *
 * Endpoint: GET /api/gee-tiles
 *
 * Query parameters:
 *   index       string  Required  ndvi | ndre | ndwi | ndbi
 *   date        string  Optional  YYYY-MM-DD  (default: today - 30 days)
 *   district    string  Optional  rudraprayag (default) | future: all Uttarakhand districts
 *
 * Response (success):
 *   {
 *     success:        true,
 *     index:          "ndvi",
 *     requestedDate:  "2026-08-15",
 *     acquiredDate:   "2026-08-12",     <- actual median date of imagery used
 *     windowDays:     15,               <- search window used (15 or 30 on fallback)
 *     tileUrl:        "https://earthengine.googleapis.com/v1/projects/.../tiles/{z}/{x}/{y}",
 *     imageCount:     4,
 *     cloudCoverPct:  8,
 *     expiresAt:      "2026-09-15T17:00:00Z",
 *     source:         "COPERNICUS/S2_SR_HARMONIZED",
 *     cloudMask:      "SCL_3_8_9_10_11",
 *     district:       "rudraprayag",
 *     isReal:         true
 *   }
 *
 * Response (no imagery):
 *   { success: false, error: "no_imagery", message: "...", fallback: "eox_rgb" }
 *
 * Security:
 *   - GEE credentials only in Vercel env vars, never in this file
 *   - CORS restricted to app domain (allow localhost for dev)
 *   - Index and date params strictly validated
 *   - Rate limiting via Vercel Edge (plan-dependent)
 */

const ee = require('@google/earthengine');
const { authenticateGEE } = require('./_gee-auth');

// ============================================================
// CONFIGURATION
// ============================================================

const GEE_PROJECT = 'change-krishi-bot';

/**
 * Area of Interest definitions per district.
 * Configurable: add districts here for future Uttarakhand expansion.
 * Format: [west, south, east, north] (WGS84)
 */
const DISTRICT_AOIS = {
  rudraprayag:  [78.70, 30.20, 79.50, 30.85],
  chamoli:      [79.20, 30.10, 80.10, 31.10],
  uttarkashi:   [77.90, 30.50, 79.20, 31.20],
  tehri:        [78.10, 30.10, 79.00, 30.80],
  pauri:        [78.50, 29.70, 79.60, 30.50],
  // Future: add remaining 8 Uttarakhand districts
};

const DEFAULT_DISTRICT = 'rudraprayag';
const DEFAULT_WINDOW_DAYS = 15;
const FALLBACK_WINDOW_DAYS = 30;
const MAX_CLOUD_COVER = 50;   // pre-filter images with >50% cloud cover

// Allowed index types (strict allowlist — never execute arbitrary params)
const VALID_INDICES = ['ndvi', 'ndre', 'ndwi', 'ndbi'];

/**
 * GEE visualization parameters per index.
 * Palette matches the colormaps in js/satellite-engine.js so colors
 * are consistent between the legend/field simulation and real tiles.
 */
const VIS_PARAMS = {
  ndvi: {
    min: -1, max: 1,
    palette: ['8b0000', 'c83232', 'd2b48c', 'f0e664', 'c8e650', '78c83c', '3ca01e', '006400'],
  },
  ndre: {
    min: -1, max: 1,
    palette: ['8b0000', 'dc5032', 'e6c882', 'c8dc50', '64be3c', '1e9628', '005a14'],
  },
  ndwi: {
    min: -1, max: 1,
    palette: ['8b5a2b', 'd2a05a', 'c8c8c8', '93d2f0', '3b82f6', '1d4ed8', '1e3a8a'],
  },
  ndbi: {
    min: -1, max: 1,
    palette: ['006400', '50a03c', 'c8c8b4', 'c8b48c', 'c88c50', 'b45028', '821414'],
  },
};

// ============================================================
// CORS HANDLING
// ============================================================
const ALLOWED_ORIGINS = [
  'https://agri-monitor.vercel.app',
  'https://agrimonitor.vercel.app',
  // Add your production domain here when known
];

function setCorsHeaders(req, res) {
  const origin = req.headers['origin'] || '';
  // Allow localhost for development
  const isLocalhost = origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1');
  const isAllowed   = ALLOWED_ORIGINS.some(o => origin.startsWith(o)) || isLocalhost;

  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // Direct server-to-server or same-origin — allow
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}

// ============================================================
// INPUT VALIDATION
// ============================================================
function validateParams(query) {
  const errors = [];

  const index = (query.index || '').toLowerCase();
  if (!VALID_INDICES.includes(index)) {
    errors.push('index must be one of: ' + VALID_INDICES.join(', '));
  }

  let date = query.date;
  if (!date) {
    // Default: 30 days ago (better chance of cloud-free imagery)
    const d = new Date();
    d.setDate(d.getDate() - 30);
    date = d.toISOString().slice(0, 10);
  } else {
    // Validate YYYY-MM-DD format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push('date must be in YYYY-MM-DD format');
    } else {
      const d = new Date(date);
      const now = new Date();
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 2);
      if (d > now) errors.push('date cannot be in the future');
      if (d < oneYearAgo) errors.push('date cannot be more than 2 years ago');
    }
  }

  const district = (query.district || DEFAULT_DISTRICT).toLowerCase();
  if (!DISTRICT_AOIS[district]) {
    errors.push('district not configured. Available: ' + Object.keys(DISTRICT_AOIS).join(', '));
  }

  return { index, date, district, errors };
}

// ============================================================
// GEE: SCL CLOUD/SHADOW MASKING
// SCL classes masked out:
//   0  = No Data
//   1  = Saturated / Defective
//   3  = Cloud Shadow
//   8  = Cloud Medium Probability
//   9  = Cloud High Probability
//   10 = Thin Cirrus
//   11 = Snow/Ice (retained for agricultural use — comment out if needed)
// ============================================================
function applyS2CloudMask(image) {
  const scl = image.select('SCL');
  const validPixel = scl.neq(0)
    .and(scl.neq(1))
    .and(scl.neq(3))
    .and(scl.neq(8))
    .and(scl.neq(9))
    .and(scl.neq(10));
  return image.updateMask(validPixel);
}

// ============================================================
// GEE: INDEX BAND COMPUTATION
// Returns an ee.Image with a single band named after the index.
// ============================================================
function computeIndex(image, indexType) {
  switch (indexType) {
    case 'ndvi':
      // (B8 - B4) / (B8 + B4)
      return image.normalizedDifference(['B8', 'B4']).rename('ndvi');

    case 'ndre':
      // (B8A - B5) / (B8A + B5)
      return image.normalizedDifference(['B8A', 'B5']).rename('ndre');

    case 'ndwi':
      // (B3 - B8) / (B3 + B8)  — McFeeters 1996, open water detection
      return image.normalizedDifference(['B3', 'B8']).rename('ndwi');

    case 'ndbi':
      // (B11 - B8) / (B11 + B8)  — Zha et al. 2003, built-up index
      return image.normalizedDifference(['B11', 'B8']).rename('ndbi');

    default:
      throw new Error('Unknown index type: ' + indexType);
  }
}

// ============================================================
// GEE: DATE WINDOW SEARCH
// Tries ±windowDays; if <2 images found, expands to FALLBACK_WINDOW_DAYS
// ============================================================
async function getIndexMapId(indexType, centreDate, district, windowDays) {
  const aoi = DISTRICT_AOIS[district];
  const geom = ee.Geometry.BBox(aoi[0], aoi[1], aoi[2], aoi[3]);

  const centre = new Date(centreDate);
  const start  = new Date(centre.getTime() - windowDays * 86400000).toISOString().slice(0, 10);
  const end    = new Date(centre.getTime() + windowDays * 86400000).toISOString().slice(0, 10);

  // Required bands per index (select only what is needed for efficiency)
  const BAND_SELECTION = {
    ndvi: ['B4', 'B8', 'SCL'],
    ndre: ['B5', 'B8A', 'SCL'],
    ndwi: ['B3', 'B8', 'SCL'],
    ndbi: ['B8', 'B11', 'SCL'],
  };

  const collection = ee
    .ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(geom)
    .filterDate(start, end)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', MAX_CLOUD_COVER))
    .select(BAND_SELECTION[indexType])
    .map(applyS2CloudMask);

  // Get image count (needed to decide fallback and report to client)
  const countInfo = await new Promise((resolve, reject) => {
    collection.size().getInfo((count, err) => {
      if (err) reject(new Error('GEE count failed: ' + err));
      else resolve(count);
    });
  });

  if (countInfo < 1) {
    return { imageCount: 0, windowDays };
  }

  // Median composite (best-pixel from all valid, cloud-free acquisitions)
  const composite = collection.median().clip(geom);

  // Compute selected index
  const indexImage = computeIndex(composite, indexType);

  // Apply colormap visualization
  const visParams = {
    ...VIS_PARAMS[indexType],
    bands: [indexType],
  };

  // Get GEE map tile URL
  const mapId = await new Promise((resolve, reject) => {
    indexImage.visualize(visParams).getMapId({}, (obj, err) => {
      if (err) reject(new Error('GEE getMapId failed: ' + err));
      else resolve(obj);
    });
  });

  // Get median acquisition date from collection (representative date)
  const dateInfo = await new Promise((resolve, reject) => {
    collection.aggregate_array('system:time_start').getInfo((dates, err) => {
      if (err) reject(new Error('GEE date query failed: ' + err));
      else resolve(dates);
    });
  });

  // Compute median acquisition date
  let acquiredDate = centreDate;
  if (dateInfo && dateInfo.length > 0) {
    const sorted = dateInfo.slice().sort((a, b) => a - b);
    const medianMs = sorted[Math.floor(sorted.length / 2)];
    acquiredDate = new Date(medianMs).toISOString().slice(0, 10);
  }

  // Build tile URL in standard {z}/{x}/{y} format for Leaflet
  // GEE returns: urlFormat like https://earthengine.googleapis.com/v1/projects/.../maps/{mapId}/tiles/{z}/{x}/{y}
  const tileUrl = mapId.urlFormat || mapId.tile_fetcher.url_;

  return { tileUrl, mapId: mapId.mapid, imageCount: countInfo, acquiredDate, windowDays };
}

// ============================================================
// MAIN HANDLER
// ============================================================
module.exports = async function handler(req, res) {
  // Set CORS headers before anything else
  setCorsHeaders(req, res);

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only GET
  if (req.method !== 'GET') {
    res.status(405).json({ success: false, error: 'method_not_allowed' });
    return;
  }

  // Validate inputs
  const { index, date, district, errors } = validateParams(req.query);
  if (errors.length > 0) {
    res.status(400).json({
      success: false,
      error: 'invalid_params',
      message: errors.join('; '),
    });
    return;
  }

  try {
    // Authenticate GEE (idempotent within the same invocation context)
    await authenticateGEE();

    // Try ±15 days first (DEFAULT_WINDOW_DAYS)
    let result = await getIndexMapId(index, date, district, DEFAULT_WINDOW_DAYS);

    // Fallback: if no imagery found, expand to ±30 days
    if (!result.tileUrl) {
      result = await getIndexMapId(index, date, district, FALLBACK_WINDOW_DAYS);
    }

    // Still nothing? Return honest error (do not fabricate URLs)
    if (!result.tileUrl) {
      res.status(200).json({
        success: false,
        error: 'no_imagery',
        message:
          'No cloud-free Sentinel-2 imagery found within ' +
          FALLBACK_WINDOW_DAYS +
          ' days of ' + date + ' over ' + district + '. Try a different date.',
        requestedDate: date,
        district,
        index,
        fallback: 'eox_rgb',
      });
      return;
    }

    // Tile URL expires in ~24 hours (GEE standard)
    const expiresAt = new Date(Date.now() + 23 * 3600 * 1000).toISOString();

    res.status(200).json({
      success:       true,
      index,
      requestedDate: date,
      acquiredDate:  result.acquiredDate,
      windowDays:    result.windowDays,
      tileUrl:       result.tileUrl,
      mapId:         result.mapId,
      imageCount:    result.imageCount,
      expiresAt,
      source:        'COPERNICUS/S2_SR_HARMONIZED',
      cloudMask:     'SCL_classes_3_8_9_10_11',
      district,
      isReal:        true,
    });

  } catch (err) {
    console.error('[GEE-Tiles] Error:', err.message);

    // Do not expose internal error details to the browser
    const isCredentialError = err.message.includes('credential') || err.message.includes('authenticat');

    res.status(500).json({
      success: false,
      error: isCredentialError ? 'auth_error' : 'gee_error',
      message: isCredentialError
        ? 'GEE authentication is not configured. Check Vercel environment variables.'
        : 'GEE computation failed. Please try again later.',
      fallback: 'eox_rgb',
    });
  }
};
