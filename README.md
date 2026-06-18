# 🌾 Agri Monitor — CHANGE TechLab

> **Satellite + Field Data + Local Intelligence for Mountain Farming**

A Hindi-first, mobile-optimized agriculture intelligence platform for farmers, CLFs, SHGs, NGOs, and district monitoring teams in Uttarakhand, India.

---

## ✨ Features

| Feature | Status | Notes |
|---------|--------|-------|
| 📊 Hindi Dashboard | ✅ Done | Stats, charts, analytics |
| 🛰️ Sentinel-2 Imagery | ✅ Done | Real EOX tile layer |
| 🟢 NDVI Integration | ✅ Done | Date selection, opacity, comparison |
| 👨‍🌾 Farmer CRUD | ✅ Done | Add, search, view, map |
| 🗺️ Field Polygon Drawing | ✅ Done | Leaflet.Draw, area calculation |
| 📷 Photo Upload | ✅ Done | Camera, GPS, compression |
| 🔔 Alert Engine | ✅ Done | Rule-based NDVI + inactive checks |
| 👥 CLF Dashboard | ✅ Done | Analytics, CSV export |
| 📄 PDF Reports | ✅ Done | Farmer profile, CLF summary |
| 📲 PWA (Android) | ✅ Done | Installable, offline support |
| 💾 Offline Sync | ✅ Done | IndexedDB queue |
| 🔐 Auth (OTP) | ✅ Done | Phone + Email, demo mode |

---

## 🚀 Quick Start (No Build Required)

This is a **static HTML app** — no Node.js, no build step needed.

### Option 1: Open directly in browser
```
Double-click index.html
```
> Works immediately in demo mode with sample Uttarakhand data.

### Option 2: Local server (recommended for PWA features)
```bash
# Python 3
python -m http.server 8080

# Node.js
npx serve .

# PHP
php -S localhost:8080
```
Then open: `http://localhost:8080`

---

## 🗄️ Supabase Setup (for real data)

### 1. Create Supabase project
- Go to [supabase.com](https://supabase.com)
- Create new project (free tier available)
- Note your **Project URL** and **anon public key**

### 2. Run the database schema
```sql
-- In Supabase SQL Editor, run:
-- supabase/schema.sql
```

### 3. Create storage bucket
```sql
-- In Supabase SQL Editor:
INSERT INTO storage.buckets (id, name, public) 
VALUES ('field-images', 'field-images', true);
```

### 4. Enable phone auth (for OTP login)
- Go to Supabase Dashboard → Authentication → Providers
- Enable **Phone** provider
- Configure Twilio or other SMS provider

### 5. Configure the app
Edit `js/config.js`:
```javascript
window.AgriConfig = {
  SUPABASE_URL: 'https://your-project-ref.supabase.co',
  SUPABASE_ANON_KEY: 'your-anon-key',
  USE_SUPABASE: true,  // ← Set to true
  ...
};
```

---

## 🛰️ NDVI Satellite Setup

### Option A: EOX Sentinel-2 Cloudless (Free, already working)
No setup needed — shows real Sentinel-2 satellite imagery.

### Option B: Real-time NDVI via Google Earth Engine
1. Sign up at [code.earthengine.google.com](https://code.earthengine.google.com)
2. Create a service account
3. Deploy this GEE script to get a tile URL:
```javascript
// GEE Script
var s2 = ee.ImageCollection('COPERNICUS/S2_SR')
  .filterDate('2024-01-01', '2024-05-01')
  .filterBounds(ee.Geometry.Point([79.05, 30.38]))
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
  .median();

var ndvi = s2.normalizedDifference(['B8', 'B4']).rename('NDVI');
var ndviParams = { min: -0.2, max: 0.8, palette: ['red','yellow','green'] };

Map.addLayer(ndvi, ndviParams, 'NDVI');
```
4. Get the tile URL and set `GEE_TILE_URL` in `js/config.js`

### Option C: TiTiler (Self-hosted)
```bash
# Deploy TiTiler on Railway/Render (free):
docker pull ghcr.io/developmentseed/titiler:latest
docker run -p 8000:8000 ghcr.io/developmentseed/titiler:latest
```
Set `NDVI_TILE_URL` in `js/config.js`

---

## 🚀 Deployment to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from project folder
cd c:\Users\admin\OneDrive\Desktop\Agri_monitor
vercel

# Or connect GitHub repo at vercel.com
```

The `vercel.json` config is already set up for static deployment.

---

## 📱 PWA Installation (Android)

1. Open the app in Chrome on Android
2. Tap the **"📲 Install"** button in the top bar
3. Or: Chrome menu → "Add to Home Screen"
4. App installs with offline support

---

## 🗃️ Database Tables

| Table | Purpose |
|-------|---------|
| `farmers` | Farmer profiles with crop and land data |
| `fields` | Field polygons with GeoJSON + health status |
| `field_images` | Photos with GPS coordinates and issue type |
| `crop_records` | Season-wise production records |
| `clf_clusters` | CLF/SHG/FPO cluster data |
| `alerts` | Rule-based and manual alerts |
| `villages` | Village reference data |
| `satellite_cache` | NDVI values per field per date |

---

## 📁 Project Structure

```
Agri_monitor/
├── index.html              ← Main app (single page)
├── manifest.json           ← PWA manifest
├── sw.js                   ← Service worker (offline)
├── vercel.json             ← Deployment config
├── .env.example            ← Environment variables
├── css/
│   └── style.css           ← Complete dark GIS theme
├── js/
│   ├── config.js           ← App configuration ← EDIT THIS
│   ├── app.js              ← Main orchestrator
│   ├── map.js              ← Leaflet map + GPS
│   ├── layers.js           ← 10 map layers
│   ├── ndvi.js             ← NDVI + Sentinel-2 tiles
│   ├── farmers.js          ← Farmer CRUD + polygon drawing
│   ├── upload.js           ← Camera + GPS + compression
│   ├── alerts.js           ← Rule-based alert engine
│   ├── clf.js              ← CLF cluster analytics
│   ├── charts.js           ← Chart.js visualizations
│   ├── report.js           ← PDF + CSV export
│   ├── auth.js             ← Supabase auth (OTP)
│   ├── offline.js          ← IndexedDB offline queue
│   └── dummyData.js        ← Demo data (Rudraprayag)
└── supabase/
    └── schema.sql          ← Database schema (run in Supabase)
```

---

## 🔧 Configuration Reference

Key settings in `js/config.js`:

```javascript
USE_SUPABASE: false,          // Set true when Supabase is ready
MAP_CENTER: [30.3985, 79.0561], // Rudraprayag center
NDVI_STRESS_THRESHOLD: 0.25,  // Below this = stress alert
INACTIVE_FIELD_DAYS: 15,      // Days without update = alert
IMAGE_MAX_SIZE_KB: 400,       // Image compression target (2G-friendly)
IMAGE_QUALITY: 0.75,          // JPEG quality
```

---

## 👥 User Roles

| Role | Capabilities |
|------|-------------|
| **Guest** | View demo data, explore map |
| **Farmer** | Login via OTP, add own fields, upload photos |
| **CLF** | View all farmers in cluster, generate reports |
| **Admin** | Full access, all reports, delete records |

---

## 📡 Offline Capabilities

- ✅ App shell cached by service worker
- ✅ Map tiles cached (stale-while-revalidate)
- ✅ Pending farmer records stored in IndexedDB
- ✅ Pending photos stored as blobs in IndexedDB
- ✅ Auto-sync when internet returns
- ✅ Background sync via Service Worker SyncManager

---

## 🔮 Phase 2 Roadmap

- [ ] Real-time GEE NDVI tile integration
- [ ] Weather alerts (OpenWeatherMap)
- [ ] Pest risk prediction layer
- [ ] Voice note support (Hindi)
- [ ] Offline PDF generation
- [ ] WhatsApp alert integration
- [ ] District admin dashboard
- [ ] Carbon footprint tracking

---

## 🙏 Credits

**Built by CHANGE TechLab**

*"पहाड़ के लोग, पहाड़ की बोली, पहाड़ का नक्शा"*

Product Owner: Anupam Rayal  
Focus: Mountain Agriculture + Rural Intelligence + Geospatial Monitoring

---

## 📞 Support

For setup help, open an issue or contact CHANGE TechLab.

Pilot area: Rudraprayag District, Uttarakhand  
Blocks: Ukhimath · Jakholi · Augustyamuni
