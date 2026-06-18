# Agri Monitor
## Product Requirements Document (PRD)
### By CHANGE TechLab

---

# 1. Product Overview

## Product Name
**Agri Monitor**

## Tagline
> Satellite + Field Data + Local Intelligence for Mountain Farming

## Vision
एक ऐसा Hindi-first geospatial agriculture platform बनाना जो किसानों, CLFs, NGOs, और government teams को खेत स्तर पर crop health, irrigation stress, production tracking, और advisory monitoring करने में सक्षम बनाए।

---

# 2. Problem Statement

उत्तराखंड और पर्वतीय क्षेत्रों में:

- खेत छोटे और बिखरे हुए हैं
- timely crop monitoring नहीं हो पाती
- field visits costly हैं
- irrigation stress जल्दी पता नहीं चलता
- farmer data fragmented है
- satellite data available होने के बावजूद usable tools नहीं हैं
- CLF/FPO level monitoring digital नहीं है

Current systems:
- data-heavy हैं
- English-centric हैं
- field-friendly नहीं हैं
- low-network villages में usable नहीं हैं

---

# 3. Core Objectives

## Primary Goals

### 1. Farmer Crop Health Monitoring
Satellite imagery और NDVI आधारित crop health visualization.

### 2. CLF-Level Monitoring
Cluster farming और SHG/VO/CLF production visibility.

### 3. Early Warning System
Water stress, crop decline, fire/flood risk alerts.

### 4. Field Intelligence Collection
Ground photo + notes + observations.

### 5. Decision Support
NGO/Government planning dashboard.

---

# 4. Target Users

## Primary Users

### Farmers
- crop health देखना
- field photos upload
- advisory प्राप्त करना

### CLF / VO Leaders
- cluster monitoring
- issue escalation

### NGO Field Teams
- survey
- field tracking
- intervention planning

### Government Stakeholders
- district analytics
- scheme targeting
- monitoring dashboards

---

# 5. Geographic Scope

## Phase 1
Rudraprayag, Uttarakhand

## Expansion
- Chamoli
- Tehri
- Uttarkashi
- Entire Uttarakhand

---

# 6. Core Features (MVP)

## 6.1 Farmer Field Mapping

### Features
- GPS-based field marking
- polygon drawing
- village tagging
- crop tagging

### Data Stored
- farmer name
- mobile
- crop
- sowing date
- field size

---

## 6.2 NDVI Crop Health

### Capabilities
- Sentinel-2 imagery integration
- NDVI color layers
- date-wise comparison
- vegetation stress zones

### Health Indicators
- Green → Healthy
- Yellow → Moderate
- Red → Stress

---

## 6.3 Satellite Imagery Timeline

### Features
- last 30 days imagery
- before/after comparison
- cloud filtering
- seasonal tracking

---

## 6.4 Farmer Notes & Photos

### Features
- upload field images
- voice note support
- Hindi observations
- tagged issue reporting

### Example
> “यहाँ पानी कम है”

---

## 6.5 CLF Dashboard

### Dashboard Metrics
- total farmers
- mapped fields
- crop area
- stress zones
- irrigation issues
- productivity trends

---

## 6.6 Alerts System

### Alerts
- water stress
- crop decline
- rainfall anomaly
- forest fire proximity
- flood risk

---

# 7. Advanced Features (Phase 2)

## AI Advisory Engine
- crop recommendations
- irrigation suggestions
- sowing advisory

## Weather Integration
- rainfall forecast
- temperature alerts
- frost alerts

## Pest Risk Layer
- probable infestation zones

## Offline Sync
- village-level offline data collection

## PDF Reports
- CLF reports
- district summaries
- field inspection reports

---

# 8. Technical Architecture

## Frontend
- React / Next.js
- Tailwind CSS
- Hindi-first UI
- PWA support

## GIS Engine
- Leaflet.js
- OpenStreetMap

## Satellite Data
- Sentinel-2
- Google Earth Engine

## Backend
- Supabase / PostgreSQL

## Storage
- Supabase Storage

## Hosting
- Vercel

---

# 9. Existing Project Reuse

Current CHANGE TechLab GIS project components to reuse:

- Leaflet map engine
- layer controls
- district dashboards
- sidebar analytics
- chart system
- Hindi UI framework
- modal system
- export tools

Estimated reuse:
> 40–50%

---

# 10. Data Layers

## Agriculture Layers
- NDVI
- crop suitability
- irrigation
- polyhouse
- organic farming
- horticulture belts

## Risk Layers
- flood zones
- landslide zones
- drought stress
- forest fire risk

## Infrastructure Layers
- roads
- markets
- cold storages
- irrigation assets

---

# 11. User Flow

## Farmer Flow
1. Login
2. Select field
3. View crop health
4. Upload photo
5. Receive advisory

## CLF Flow
1. Open dashboard
2. View cluster map
3. Identify stress zones
4. Generate reports

---

# 12. Success Metrics

## MVP KPIs
- 50 farmers onboarded
- 100 mapped fields
- weekly satellite updates
- 80% active field reporting

## Phase 2 KPIs
- 5 CLFs onboarded
- 1000+ fields mapped
- district-wide monitoring

---

# 13. Deployment Strategy

## Pilot
- 1 block
- 1 crop cluster
- 50–100 farmers

## Recommended Pilot Area
- Ukhimath
- Jakholi
- Augustyamuni

---

# 14. Risks

## Technical
- cloud-covered imagery
- poor connectivity
- GPS accuracy

## Adoption
- digital literacy
- farmer onboarding
- continuous usage

---

# 15. Long-Term Vision

Agri Monitor आगे evolve होकर बन सकता है:

- Rural Intelligence Platform
- Carbon Monitoring System
- Forest & Fire Monitoring Tool
- Disaster Monitoring Dashboard
- Climate Resilience Platform

---

# 16. Suggested MVP Timeline

## Week 1–2
- backend setup
- map integration
- field mapping

## Week 3–4
- NDVI integration
- dashboard setup

## Week 5
- alerts + testing

## Week 6
- pilot deployment

---

# 17. Ownership

## Product Owner
Anupam Rayal
Founder, CHANGE

## Organization
CHANGE TechLab

## Focus Area
Mountain agriculture + rural intelligence + geospatial monitoring.

