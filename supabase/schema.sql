-- ============================================================
-- Agri Monitor — CHANGE TechLab
-- Supabase PostgreSQL Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable PostGIS for geospatial support
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: villages
-- ============================================================
CREATE TABLE IF NOT EXISTS villages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  name_hindi TEXT,
  block TEXT NOT NULL,
  district TEXT NOT NULL DEFAULT 'rudraprayag',
  gram_panchayat TEXT,
  pin_code TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: clf_clusters
-- ============================================================
CREATE TABLE IF NOT EXISTS clf_clusters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  name_hindi TEXT,
  type TEXT DEFAULT 'CLF' CHECK (type IN ('CLF', 'SHG', 'FPO', 'VO')),
  block TEXT,
  district TEXT DEFAULT 'rudraprayag',
  village_ids UUID[],
  contact_name TEXT,
  contact_mobile TEXT,
  total_members INT DEFAULT 0,
  active_members INT DEFAULT 0,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: farmers
-- ============================================================
CREATE TABLE IF NOT EXISTS farmers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  name_hindi TEXT,
  mobile TEXT,
  aadhaar_last4 TEXT,
  village_id UUID REFERENCES villages(id),
  village_name TEXT,
  block TEXT,
  district TEXT DEFAULT 'rudraprayag',
  clf_id UUID REFERENCES clf_clusters(id),
  land_holding_ha DOUBLE PRECISION DEFAULT 0,
  primary_crop TEXT,
  secondary_crops TEXT[],
  irrigation_source TEXT CHECK (irrigation_source IN ('rain_fed', 'canal', 'borewell', 'spring', 'drip', 'none')),
  is_organic BOOLEAN DEFAULT FALSE,
  has_polyhouse BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: fields
-- ============================================================
CREATE TABLE IF NOT EXISTS fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  name TEXT,
  geom GEOGRAPHY(POLYGON, 4326),
  geojson JSONB,
  area_sqm DOUBLE PRECISION,
  area_ha DOUBLE PRECISION GENERATED ALWAYS AS (area_sqm / 10000.0) STORED,
  crop_type TEXT,
  crop_variety TEXT,
  sowing_date DATE,
  expected_harvest_date DATE,
  irrigation_type TEXT CHECK (irrigation_type IN ('rain_fed', 'canal', 'borewell', 'spring', 'drip', 'none')),
  soil_type TEXT,
  health_status TEXT DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'moderate', 'stress', 'unknown')),
  last_ndvi_value DOUBLE PRECISION,
  last_ndvi_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spatial index on fields geometry
CREATE INDEX IF NOT EXISTS fields_geom_idx ON fields USING GIST (geom);

-- ============================================================
-- TABLE: field_images
-- ============================================================
CREATE TABLE IF NOT EXISTS field_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  field_id UUID REFERENCES fields(id) ON DELETE CASCADE,
  farmer_id UUID REFERENCES farmers(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  accuracy_m DOUBLE PRECISION,
  issue_type TEXT CHECK (issue_type IN ('pest', 'disease', 'water_stress', 'flood', 'good_growth', 'other')),
  caption TEXT,
  caption_hindi TEXT,
  taken_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: crop_records
-- ============================================================
CREATE TABLE IF NOT EXISTS crop_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  field_id UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  season TEXT CHECK (season IN ('kharif', 'rabi', 'zaid')),
  year INT NOT NULL,
  crop_name TEXT NOT NULL,
  variety TEXT,
  sowing_date DATE,
  transplanting_date DATE,
  flowering_date DATE,
  harvest_date DATE,
  yield_kg DOUBLE PRECISION,
  area_ha DOUBLE PRECISION,
  input_cost DOUBLE PRECISION,
  sale_price_per_kg DOUBLE PRECISION,
  buyer TEXT,
  quality_grade TEXT,
  observations TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: alerts
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  field_id UUID REFERENCES fields(id) ON DELETE CASCADE,
  farmer_id UUID REFERENCES farmers(id) ON DELETE CASCADE,
  clf_id UUID REFERENCES clf_clusters(id) ON DELETE CASCADE,
  district TEXT,
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'ndvi_stress', 'irrigation_stress', 'inactive_field',
    'flood_risk', 'fire_risk', 'landslide_risk',
    'pest_risk', 'crop_decline', 'weather_alert'
  )),
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  title_hindi TEXT,
  message TEXT,
  message_hindi TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  is_active BOOLEAN DEFAULT TRUE,
  is_read BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: satellite_cache
-- ============================================================
CREATE TABLE IF NOT EXISTS satellite_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  district TEXT NOT NULL,
  field_id UUID REFERENCES fields(id) ON DELETE CASCADE,
  satellite TEXT DEFAULT 'sentinel-2',
  acquisition_date DATE NOT NULL,
  ndvi_min DOUBLE PRECISION,
  ndvi_max DOUBLE PRECISION,
  ndvi_mean DOUBLE PRECISION,
  ndvi_change DOUBLE PRECISION,
  cloud_cover_pct DOUBLE PRECISION,
  tile_url TEXT,
  health_category TEXT CHECK (health_category IN ('healthy', 'moderate', 'stress', 'no_data')),
  raw_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(field_id, acquisition_date, satellite)
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE farmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE crop_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE villages ENABLE ROW LEVEL SECURITY;
ALTER TABLE satellite_cache ENABLE ROW LEVEL SECURITY;

-- Public read for villages, clf_clusters (reference data)
CREATE POLICY "villages_public_read" ON villages FOR SELECT USING (true);
CREATE POLICY "clf_clusters_public_read" ON clf_clusters FOR SELECT USING (true);
CREATE POLICY "alerts_public_read" ON alerts FOR SELECT USING (true);
CREATE POLICY "satellite_cache_public_read" ON satellite_cache FOR SELECT USING (true);

-- Authenticated users can read all farmers/fields
CREATE POLICY "farmers_authenticated_read" ON farmers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "fields_authenticated_read" ON fields FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "field_images_authenticated_read" ON field_images FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "crop_records_authenticated_read" ON crop_records FOR SELECT USING (auth.role() = 'authenticated');

-- Farmers can insert/update their own records
CREATE POLICY "farmers_insert" ON farmers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "fields_insert" ON fields FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "field_images_insert" ON field_images FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "crop_records_insert" ON crop_records FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "alerts_insert" ON alerts FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- SUPABASE STORAGE BUCKET
-- ============================================================
-- Run separately in Supabase Storage dashboard or via API:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('field-images', 'field-images', true);

-- ============================================================
-- SEED DATA — Sample Villages (Rudraprayag District)
-- ============================================================
INSERT INTO villages (name, name_hindi, block, district, gram_panchayat, lat, lng) VALUES
  ('Ukhimath', 'ऊखीमठ', 'Ukhimath', 'rudraprayag', 'Ukhimath', 30.4855, 79.2437),
  ('Jakholi', 'जखोली', 'Jakholi', 'rudraprayag', 'Jakholi', 30.3267, 79.0978),
  ('Augustyamuni', 'अगस्त्यमुनि', 'Augustyamuni', 'rudraprayag', 'Augustyamuni', 30.3820, 79.0567),
  ('Tilwara', 'तिलवाड़ा', 'Jakholi', 'rudraprayag', 'Tilwara', 30.3500, 79.0700),
  ('Kund', 'कुंड', 'Ukhimath', 'rudraprayag', 'Kund', 30.5100, 79.2600),
  ('Sari', 'सारी', 'Ukhimath', 'rudraprayag', 'Sari', 30.5200, 79.2800),
  ('Bansholi', 'बंशोली', 'Jakholi', 'rudraprayag', 'Bansholi', 30.3100, 79.1200),
  ('Chandrapuri', 'चंद्रपुरी', 'Augustyamuni', 'rudraprayag', 'Chandrapuri', 30.4100, 79.0800)
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED DATA — Sample CLF Clusters
-- ============================================================
INSERT INTO clf_clusters (name, name_hindi, type, block, district, contact_name, total_members, lat, lng) VALUES
  ('Mandakini CLF', 'मंदाकिनी CLF', 'CLF', 'Ukhimath', 'rudraprayag', 'सुमित्रा देवी', 45, 30.4855, 79.2437),
  ('Alaknanda SHG Federation', 'अलकनंदा SHG', 'SHG', 'Jakholi', 'rudraprayag', 'रमा नेगी', 32, 30.3267, 79.0978),
  ('Kedar Kisaan FPO', 'केदार किसान FPO', 'FPO', 'Augustyamuni', 'rudraprayag', 'बीरेंद्र सिंह', 68, 30.3820, 79.0567)
ON CONFLICT DO NOTHING;
