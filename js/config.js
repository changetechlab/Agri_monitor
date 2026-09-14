/**
 * Agri Monitor — js/config.js
 * App configuration — public, non-secret settings only.
 *
 * SECURITY REMINDER:
 *   Do NOT put GEE credentials, private keys, or API secrets here.
 *   This file is public and committed to GitHub.
 *   All secrets live in Vercel environment variables only.
 */

window.AgriConfig = {
  // Supabase credentials — get from supabase.com project settings
  SUPABASE_URL:     'https://your-project-ref.supabase.co',
  SUPABASE_ANON_KEY:'your-anon-key-here',
  USE_SUPABASE:     false,

  // App info
  APP_NAME:    'Agri Monitor',
  APP_VERSION: '1.0.0',
  TAGLINE:     'Satellite + Field Data + Local Intelligence for Mountain Farming',

  // Default map center — Rudraprayag district
  MAP_CENTER:      [30.3985, 79.0561],
  MAP_ZOOM:        11,
  MAP_ZOOM_MOBILE: 10,

  // ─── Satellite / GEE ──────────────────────────────────────────
  // EOX Sentinel-2 Cloudless 2020 — always available as base/fallback
  SENTINEL_TILE_URL: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',

  // GEE Serverless API endpoint (Vercel function)
  // This is the public path to /api/gee-tiles — not a secret.
  // Actual GEE credentials are in Vercel env vars (never here).
  GEE_API_ENDPOINT: '/api/gee-tiles',

  // GEE project ID (non-secret — appears in GEE tile URLs anyway)
  GEE_PROJECT_ID: 'change-krishi-bot',

  // Default pilot district for GEE AOI
  GEE_PILOT_DISTRICT: 'rudraprayag',

  // Use which satellite layer by default
  ACTIVE_SATELLITE: 'sentinel',  // 'sentinel' | 'index'

  // ─── Pilot area ───────────────────────────────────────────────
  PILOT_DISTRICT: 'rudraprayag',
  PILOT_BLOCKS: ['Ukhimath', 'Jakholi', 'Augustyamuni'],

  // ─── Alert thresholds ─────────────────────────────────────────
  NDVI_STRESS_THRESHOLD:   0.25,
  NDVI_MODERATE_THRESHOLD: 0.45,
  INACTIVE_FIELD_DAYS:     15,
  NDVI_DECLINE_THRESHOLD:  0.10,

  // ─── Image upload ─────────────────────────────────────────────
  IMAGE_MAX_SIZE_KB: 400,
  IMAGE_QUALITY:     0.75,

  // ─── IndexedDB ────────────────────────────────────────────────
  IDB_NAME:    'agri_monitor_offline',
  IDB_VERSION: 1,
};
