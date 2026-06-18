/**
 * Agri Monitor — js/config.js
 * App configuration — replace values with your credentials
 * For production: set via environment variables
 */

window.AgriConfig = {
  // Supabase credentials — get from supabase.com project settings
  SUPABASE_URL: 'https://your-project-ref.supabase.co',
  SUPABASE_ANON_KEY: 'your-anon-key-here',

  // Set to true when Supabase is configured
  USE_SUPABASE: false,

  // App info
  APP_NAME: 'Agri Monitor',
  APP_VERSION: '1.0.0',
  TAGLINE: 'Satellite + Field Data + Local Intelligence for Mountain Farming',

  // Default map center — Rudraprayag district
  MAP_CENTER: [30.3985, 79.0561],
  MAP_ZOOM: 11,
  MAP_ZOOM_MOBILE: 10,

  // NDVI Tile URL
  // Option A: EOX Sentinel-2 Cloudless (free, actual satellite imagery)
  SENTINEL_TILE_URL: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',

  // Option B: TiTiler NDVI endpoint (replace with your instance)
  NDVI_TILE_URL: 'https://titiler.xyz/cog/tiles/{z}/{x}/{y}?url={cogUrl}&bidx=1&colormap_name=rdylgn&rescale=-1,1',

  // Option C: GEE tile endpoint (replace with your dynamic URL from GEE)
  GEE_TILE_URL: null,

  // Use which satellite layer by default
  ACTIVE_SATELLITE: 'sentinel', // 'sentinel' | 'ndvi' | 'gee'

  // Pilot block/district
  PILOT_DISTRICT: 'rudraprayag',
  PILOT_BLOCKS: ['Ukhimath', 'Jakholi', 'Augustyamuni'],

  // Alert thresholds
  NDVI_STRESS_THRESHOLD: 0.25,       // Below this = stress
  NDVI_MODERATE_THRESHOLD: 0.45,     // Below this = moderate
  INACTIVE_FIELD_DAYS: 15,           // Days without update = inactive alert
  NDVI_DECLINE_THRESHOLD: 0.10,      // Drop of this amount = alert

  // Image upload
  IMAGE_MAX_SIZE_KB: 400,            // Max image size after compression (rural network)
  IMAGE_QUALITY: 0.75,               // JPEG compression quality

  // IndexedDB
  IDB_NAME: 'agri_monitor_offline',
  IDB_VERSION: 1,
};
