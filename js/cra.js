/**
 * Agri Monitor — js/cra.js
 * GP-level Climate Risk Assessment (CRA) Engine
 *
 * Pure browser-side: No backend / API required
 * Uses GP_CRA_DATA from data/gp_cra_data.js
 * Uses jsPDF (already loaded via vendor) for PDF generation
 *
 * Exports (on window.CRA):
 *   calculateCRAScore(gp)          → { indicators, overall, priority }
 *   getRecommendedInterventions(gp, scores) → [ ...interventions ]
 *   renderCRAProfile(gp)           → HTML string
 *   renderCRAScores(scores)        → HTML string
 *   renderInterventions(list)      → HTML string
 *   generateCRAPlanPDF(gp, scores, interventions)
 *   initCRATab()                   → wire up the whole tab
 */

(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
     1.  SCORING ENGINE
     Converts GP baseline data → structured CRA scores
  ═══════════════════════════════════════════════════════════ */

  const SCORE_HIGH   = 'high';
  const SCORE_MEDIUM = 'medium';
  const SCORE_LOW    = 'low';

  function scoreLevel(value) {
    if (value >= 2.5) return SCORE_HIGH;
    if (value >= 1.5) return SCORE_MEDIUM;
    return SCORE_LOW;
  }

  // NDVI → Crop Stress (inverted: low NDVI = high stress)
  function cropStressScore(ndvi) {
    if (ndvi < 0.30) return { score: 3, level: SCORE_HIGH,   label: 'अत्यधिक तनाव' };
    if (ndvi < 0.45) return { score: 2, level: SCORE_MEDIUM, label: 'मध्यम तनाव' };
    return             { score: 1, level: SCORE_LOW,    label: 'सामान्य / स्वस्थ' };
  }

  // Water availability → Water Stress
  function waterStressScore(gp) {
    const avail = gp.water_availability;
    const sources = gp.water_sources || [];
    const onlyRainFed = sources.length === 1 && sources[0] === 'rain_fed';

    if (avail === 'scarce' || onlyRainFed) return { score: 3, level: SCORE_HIGH,   label: 'गंभीर जल तनाव' };
    if (avail === 'seasonal')              return { score: 2, level: SCORE_MEDIUM, label: 'मौसमी जल तनाव' };
    return                                        { score: 1, level: SCORE_LOW,    label: 'पर्याप्त जल' };
  }

  // Slope → Erosion/Slope Risk
  function slopeErosionScore(slope) {
    const map = { very_steep: 3, steep: 2, moderate: 1, low: 1 };
    const s = map[slope] || 1;
    const labels = { 3: 'अत्यधिक ढलान/क्षरण खतरा', 2: 'मध्यम ढलान खतरा', 1: 'कम ढलान खतरा' };
    return { score: s, level: scoreLevel(s), label: labels[s] };
  }

  // Drainage quality → Drainage Score
  function drainageScore(drainage) {
    const map = { very_poor: 3, poor: 2, moderate: 2, good: 1 };
    const s = map[drainage] || 1;
    const labels = { very_poor: 'बहुत खराब जल निकासी', poor: 'खराब जल निकासी', moderate: 'मध्यम जल निकासी', good: 'अच्छी जल निकासी' };
    return { score: s, level: scoreLevel(s), label: labels[drainage] || 'मध्यम' };
  }

  // Climate hazard count + drought frequency → Climate Hazard Score
  function climateHazardScore(gp) {
    const hazards = gp.climate_hazards || [];
    const droughtFreq = gp.drought_frequency || 'low';
    let s = 0;
    s += hazards.length >= 3 ? 3 : hazards.length >= 2 ? 2 : 1;
    if (droughtFreq === 'high') s = Math.max(s, 3);
    if (droughtFreq === 'moderate') s = Math.max(s, 2);
    s = Math.min(s, 3);
    const label = s === 3 ? 'उच्च जलवायु खतरा' : s === 2 ? 'मध्यम जलवायु खतरा' : 'कम जलवायु खतरा';
    return { score: s, level: scoreLevel(s), label };
  }

  // Agriculture Potential (high agri area % + good NDVI = high potential)
  function agriPotentialScore(gp) {
    const agriPct = (gp.land_use && gp.land_use.agri_pct) || 20;
    const ndvi = gp.avg_ndvi || 0.4;
    // potential is positive: we label high = good
    let s;
    if (agriPct >= 35 && ndvi >= 0.55) s = 3;
    else if (agriPct >= 25 && ndvi >= 0.40) s = 2;
    else s = 1;
    const labels = { 3: 'उच्च कृषि क्षमता', 2: 'मध्यम कृषि क्षमता', 1: 'सीमित कृषि क्षमता' };
    return { score: s, level: scoreLevel(s), label: labels[s] };
  }

  /**
   * Main: Calculate all CRA indicators for a GP
   */
  function calculateCRAScore(gp) {
    const crop    = cropStressScore(gp.avg_ndvi);
    const water   = waterStressScore(gp);
    const slope   = slopeErosionScore(gp.slope);
    const drain   = drainageScore(gp.drainage);
    const climate = climateHazardScore(gp);
    const agri    = agriPotentialScore(gp);

    // Overall: weighted average of risk scores (crop, water, slope, drain, climate)
    const riskScores = [crop.score, water.score, slope.score, drain.score, climate.score];
    const avg = riskScores.reduce((a, b) => a + b, 0) / riskScores.length;

    let overallLevel, overallLabel, overallColor;
    if (avg >= 2.4) {
      overallLevel = SCORE_HIGH;
      overallLabel = 'उच्च प्राथमिकता';
      overallColor = '#ef4444';
    } else if (avg >= 1.6) {
      overallLevel = SCORE_MEDIUM;
      overallLabel = 'मध्यम प्राथमिकता';
      overallColor = '#f59e0b';
    } else {
      overallLevel = SCORE_LOW;
      overallLabel = 'कम प्राथमिकता';
      overallColor = '#22c55e';
    }

    return {
      indicators: [
        { key: 'crop_stress',    icon: '🌾', name: 'फसल तनाव (Crop Stress)',     ...crop    },
        { key: 'water_stress',   icon: '💧', name: 'जल तनाव (Water Stress)',      ...water   },
        { key: 'slope_erosion',  icon: '⛰️', name: 'ढलान/क्षरण जोखिम',           ...slope   },
        { key: 'drainage',       icon: '🌊', name: 'जल निकासी (Drainage)',         ...drain   },
        { key: 'climate_hazard', icon: '🌩️', name: 'जलवायु खतरा (Climate)',       ...climate },
        { key: 'agri_potential', icon: '🌱', name: 'कृषि क्षमता (Agri Potential)', ...agri    },
      ],
      overall: { score: avg.toFixed(1), level: overallLevel, label: overallLabel, color: overallColor }
    };
  }


  /* ═══════════════════════════════════════════════════════════
     2.  INTERVENTION RULES ENGINE
  ═══════════════════════════════════════════════════════════ */

  /* ═══════════════════════════════════════════════════════════
     2.  INTERVENTION RULES ENGINE (Scientific Decision-Rule Library)
         Based on Uttarakhand Action Plan on Climate Change (2024)
  ═══════════════════════════════════════════════════════════ */

  const INTERVENTIONS = {
    contour_bunds: {
      id: 'contour_bunds', icon: '〰️', category: 'land',
      name: 'Contour Bunds & Grass-strip', name_hindi: 'समोच्च मेड़ और घास-पट्टी',
      desc: 'Rule 1: Soil erosion > 10 t/ha/yr. Install contour bunds & grass-strip barriers on slopes.',
      benefit: 'Reduced soil loss, improved water infiltration',
      mrv_kpi: '% of fields with contour bunds installed (geo-referenced)',
      evidence: 'Uttarakhand SAPCC (2024)'
    },
    terracing: {
      id: 'terracing', icon: '⛰️', category: 'land',
      name: 'Terracing & Multi-tier Forestry', name_hindi: 'सीढ़ीदार खेत और बहु-स्तरीय वानिकी',
      desc: 'Rule 2: Soil erosion > 40 t/ha/yr (Severe). Multi-tier forest plantations for moisture conservation.',
      benefit: 'Stabilised slopes, enhanced organic matter',
      mrv_kpi: '% of terraced area measured via GIS',
      evidence: 'Uttarakhand SAPCC (2024)'
    },
    irrigation_mulching: {
      id: 'irrigation_mulching', icon: '💧', category: 'water',
      name: 'Supplemental Irrigation & Mulching', name_hindi: 'पूरक सिंचाई और मल्चिंग',
      desc: 'Rule 3: Pre-monsoon crop stress (NDVI < 0.3). Apply supplemental irrigation and mulching.',
      benefit: 'Improved crop vigor, higher yields',
      mrv_kpi: '% of pixels with NDVI < 0.3 receiving irrigation',
      evidence: 'NDVI-based monitoring'
    },
    contour_farming: {
      id: 'contour_farming', icon: '🚜', category: 'land',
      name: 'Contour Farming & Strip Cropping', name_hindi: 'समोच्च खेती और पट्टीदार खेती',
      desc: 'Rule 4: Slope > 15%. Cultivation along contour lines to prevent runoff.',
      benefit: 'Reduced runoff velocity, lower erosion',
      mrv_kpi: '% of agricultural area on slopes > 15% with contour lines',
      evidence: 'RUSLE-based assessment (2021)'
    },
    raised_beds: {
      id: 'raised_beds', icon: '🛏️', category: 'water',
      name: 'Raised Beds & Sub-surface Drainage', name_hindi: 'उठी हुई क्यारियां और जल निकासी',
      desc: 'Rule 5: Poor drainage or distance to drainage < 200m. Drain out excess water.',
      benefit: 'Faster drainage, reduced root rot disease',
      mrv_kpi: '% of fields < 200m with raised-bed implementation',
      evidence: 'Uttarakhand SAPCC (2024)'
    },
    millets_drip: {
      id: 'millets_drip', icon: '🌾', category: 'crop',
      name: 'Millets, Pulses & Drip Irrigation', name_hindi: 'मोटे अनाज, दालें और ड्रिप सिंचाई',
      desc: 'Rule 6 & 10: Rainfall deficit / >70% rain-fed area. Promote drought-tolerant crops.',
      benefit: 'Sustained production under water stress',
      mrv_kpi: '% of farms adopting millet/pulse intercropping',
      evidence: 'Uttarakhand SAPCC (2024)'
    },
    conservation_agri: {
      id: 'conservation_agri', icon: '🌿', category: 'soil',
      name: 'Conservation Agriculture (No-till)', name_hindi: 'संरक्षण कृषि (नो-टिल व कवर फसलें)',
      desc: 'Rule 7: Soil organic carbon < 1%. Apply soil moisture conservation regime.',
      benefit: 'Increased SOC, better moisture retention',
      mrv_kpi: 'SOC increase measured by periodic soil sampling',
      evidence: 'Uttarakhand SAPCC (2024)'
    },
    agroforestry: {
      id: 'agroforestry', icon: '🌳', category: 'land',
      name: 'Agro-forestry (Tree hedgerows)', name_hindi: 'कृषि-वानिकी (पेड़ों की बाड़)',
      desc: 'Rule 8: < 10% forest-crop mosaic on marginal hills. Plant tree-based hedgerows.',
      benefit: 'Soil protection, diversified income',
      mrv_kpi: '% of marginal farms with agro-forestry trees',
      evidence: 'Uttarakhand SAPCC (2024)'
    },
    rainwater_harvesting: {
      id: 'rainwater_harvesting', icon: '🪣', category: 'water',
      name: 'Community Tanks & Farm Ponds', name_hindi: 'सामुदायिक टैंक और खेत तालाब',
      desc: 'Rule 9: Absence of rainwater harvesting. Build structures to reduce dry spell stress.',
      benefit: 'Augmented water supply for irrigation',
      mrv_kpi: 'Number of tanks per GP (field-survey)',
      evidence: 'Uttarakhand SAPCC (2024)'
    },
    early_harvest: {
      id: 'early_harvest', icon: '✂️', category: 'crop',
      name: 'Early Harvesting & Storage', name_hindi: 'जल्दी कटाई और सुरक्षित भंडारण',
      desc: 'Rule 11: Post-monsoon NDVI < 0.4 (incomplete grain filling). Early harvest if 80% matured.',
      benefit: 'Reduced post-harvest losses',
      mrv_kpi: '% of fields harvested early',
      evidence: 'Uttarakhand SAPCC (2024)'
    },
    flood_tolerant: {
      id: 'flood_tolerant', icon: '🌊', category: 'crop',
      name: 'Flood-tolerant Rice / Crops', name_hindi: 'बाढ़ सहिष्णु फसल किस्में',
      desc: 'Rule 12: Flood-prone districts. Use submergence tolerant varieties.',
      benefit: 'Sustained yields during floods',
      mrv_kpi: '% of farms using flood-tolerant varieties',
      evidence: 'Uttarakhand SAPCC (2024)'
    }
  };

  /**
   * Apply Scientific Rules (1-12) based on GP baseline indicators
   */
  function getRecommendedInterventions(gp, scores) {
    const list = [];
    const hazards = gp.climate_hazards || [];
    const water_sources = gp.water_sources || [];

    // Rule 1 & 4: Slope > 15% (steep or very_steep) -> Contour Bunds, Contour Farming
    if (gp.slope === 'steep' || gp.slope === 'very_steep') {
      list.push({ ...INTERVENTIONS.contour_bunds, priority: 3 });
      list.push({ ...INTERVENTIONS.contour_farming, priority: 2 });
    }

    // Rule 2: Soil erosion > 40 t/ha/yr (very_steep) -> Terracing
    if (gp.slope === 'very_steep') {
      list.push({ ...INTERVENTIONS.terracing, priority: 3 });
    }

    // Rule 3: Pre-monsoon stress / NDVI < 0.3 -> Irrigation & Mulching
    if (gp.avg_ndvi < 0.35) { // 0.3 threshold
      list.push({ ...INTERVENTIONS.irrigation_mulching, priority: 3 });
    }

    // Rule 11: Post-monsoon NDVI < 0.4 -> Early harvesting
    if (gp.avg_ndvi >= 0.35 && gp.avg_ndvi < 0.45) {
      list.push({ ...INTERVENTIONS.early_harvest, priority: 2 });
    }

    // Rule 5: Poor drainage -> Raised Beds
    if (gp.drainage === 'poor' || gp.drainage === 'very_poor') {
      list.push({ ...INTERVENTIONS.raised_beds, priority: 3 });
    }

    // Rule 6 & 10: Rain-fed > 70% or drought risk -> Millets & Pulses
    if (water_sources.includes('rain_fed') || hazards.includes('drought') || gp.water_availability === 'scarce') {
      list.push({ ...INTERVENTIONS.millets_drip, priority: 3 });
    }

    // Rule 7: SOC < 1% (Assumed low if NDVI is low and slope is high)
    if (gp.avg_ndvi < 0.4) {
      list.push({ ...INTERVENTIONS.conservation_agri, priority: 2 });
    }

    // Rule 8: Forest-crop mosaic < 10% (Assumed if forest_pct is low)
    if (gp.land_use && gp.land_use.forest_pct < 45) {
      list.push({ ...INTERVENTIONS.agroforestry, priority: 2 });
    }

    // Rule 9: Absence of RWH
    if (!gp.existing_interventions || !gp.existing_interventions.some(i => i.toLowerCase().includes('pond') || i.toLowerCase().includes('tank'))) {
      list.push({ ...INTERVENTIONS.rainwater_harvesting, priority: 3 });
    }

    // Rule 12: Flood-prone districts
    if (hazards.includes('flood')) {
      list.push({ ...INTERVENTIONS.flood_tolerant, priority: 3 });
    }

    // Deduplicate and sort
    const seen = new Set();
    const unique = list.filter(i => {
      if (seen.has(i.id)) return false;
      seen.add(i.id);
      return true;
    });
    unique.sort((a, b) => b.priority - a.priority);

    return unique;
  }


  /* ═══════════════════════════════════════════════════════════
     3.  HTML RENDERERS
  ═══════════════════════════════════════════════════════════ */

  function levelBadge(level, label) {
    const cfg = {
      high:   { bg: 'rgba(239,68,68,0.18)',   color: '#ef4444', icon: '🔴' },
      medium: { bg: 'rgba(245,158,11,0.18)',  color: '#f59e0b', icon: '🟡' },
      low:    { bg: 'rgba(34,197,94,0.18)',   color: '#22c55e', icon: '🟢' },
    };
    const c = cfg[level] || cfg.medium;
    return `<span class="cra-badge cra-badge-${level}" style="background:${c.bg};color:${c.color}">${c.icon} ${label || level.toUpperCase()}</span>`;
  }

  function renderCRAProfile(gp) {
    const srcMap = { spring: 'झरना/नौला', stream: 'नदी/नाला', rain_fed: 'वर्षाआधारित', canal: 'नहर', drip: 'ड्रिप', pond: 'तालाब' };
    const waterSrc = (gp.water_sources || []).map(s => srcMap[s] || s).join(', ');
    const slopeMap = { very_steep: 'अत्यधिक ढलान', steep: 'तीव्र ढलान', moderate: 'मध्यम ढलान', low: 'सामान्य' };
    const drainMap = { very_poor: 'बहुत खराब', poor: 'खराब', moderate: 'मध्यम', good: 'अच्छी' };
    const ndviClass = gp.avg_ndvi < 0.3 ? 'cra-badge-high' : gp.avg_ndvi < 0.45 ? 'cra-badge-medium' : 'cra-badge-low';
    const ndviColor = gp.avg_ndvi < 0.3 ? '#ef4444' : gp.avg_ndvi < 0.45 ? '#f59e0b' : '#22c55e';

    return `
      <div class="cra-profile-card">
        <div class="cra-profile-header">
          <div>
            <h3 class="cra-profile-title">📍 ${gp.name_hindi}</h3>
            <div class="cra-profile-subtitle">${gp.block_hindi} · ${gp.district_hindi} · GP ID: ${gp.gp_code}</div>
          </div>
          <div class="cra-profile-tag">GP Profile</div>
        </div>

        <div class="cra-profile-grid">
          <div class="cra-profile-item">
            <span class="cra-pi-label">🏘️ गाँव</span>
            <span class="cra-pi-val">${gp.village_count} गाँव</span>
            <span class="cra-pi-sub">${gp.villages.join(', ')}</span>
          </div>
          <div class="cra-profile-item">
            <span class="cra-pi-label">🌾 कृषि क्षेत्र</span>
            <span class="cra-pi-val">${gp.agri_area_ha} हेक्टेयर</span>
            <span class="cra-pi-sub">${gp.total_farmers} किसान</span>
          </div>
          <div class="cra-profile-item">
            <span class="cra-pi-label">📡 NDVI औसत</span>
            <span class="cra-pi-val" style="color:${ndviColor}">${gp.avg_ndvi}</span>
            <span class="cra-pi-sub">फसल स्वास्थ्य सूचक</span>
          </div>
          <div class="cra-profile-item">
            <span class="cra-pi-label">⛰️ ढलान</span>
            <span class="cra-pi-val">${slopeMap[gp.slope] || gp.slope}</span>
            <span class="cra-pi-sub">${gp.elevation_m} मीटर ऊंचाई</span>
          </div>
          <div class="cra-profile-item">
            <span class="cra-pi-label">💧 जल स्रोत</span>
            <span class="cra-pi-val">${waterSrc}</span>
            <span class="cra-pi-sub">उपलब्धता: ${gp.water_availability === 'adequate' ? 'पर्याप्त' : gp.water_availability === 'seasonal' ? 'मौसमी' : 'अपर्याप्त'}</span>
          </div>
          <div class="cra-profile-item">
            <span class="cra-pi-label">🌊 जल निकासी</span>
            <span class="cra-pi-val">${drainMap[gp.drainage] || gp.drainage}</span>
            <span class="cra-pi-sub">वर्षा: ${gp.avg_rainfall_mm} मिमी/वर्ष</span>
          </div>
        </div>

        <div class="cra-hazard-row">
          <span class="cra-hazard-label">⚠️ जलवायु खतरे:</span>
          ${(gp.climate_hazards || []).map(h => `<span class="cra-hazard-chip">${h}</span>`).join('')}
        </div>

        <div class="cra-existing-row">
          <span class="cra-hazard-label">✅ मौजूदा हस्तक्षेप:</span>
          <span class="cra-pi-sub">${(gp.existing_interventions || []).join(', ')}</span>
        </div>

        <div class="cra-crop-row">
          <span class="cra-hazard-label">🌱 मुख्य फसलें:</span>
          ${(gp.primary_crops || []).map(c => `<span class="cra-crop-chip">${c}</span>`).join('')}
        </div>
      </div>`;
  }

  function renderCRAScores(scores) {
    const rows = scores.indicators.map(ind => {
      const stars = '●'.repeat(ind.score) + '○'.repeat(3 - ind.score);
      const starsColor = ind.level === SCORE_HIGH ? '#ef4444' : ind.level === SCORE_MEDIUM ? '#f59e0b' : '#22c55e';
      return `
        <tr class="cra-score-row">
          <td class="cra-score-indicator">${ind.icon} ${ind.name}</td>
          <td><span style="color:${starsColor};letter-spacing:2px;font-size:14px">${stars}</span></td>
          <td>${levelBadge(ind.level, ind.label)}</td>
        </tr>`;
    }).join('');

    const overall = scores.overall;
    return `
      <div class="cra-scores-card">
        <h4 class="cra-section-title">📊 CRA Priority Scores</h4>
        <table class="cra-score-table">
          <thead>
            <tr>
              <th>संकेतक (Indicator)</th>
              <th>स्तर</th>
              <th>स्थिति</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="cra-overall-row" style="border-color:${overall.color}">
          <span class="cra-overall-label">🎯 Overall CRA Priority</span>
          <span class="cra-overall-val" style="color:${overall.color}">
            ${overall.level === 'high' ? '🔴' : overall.level === 'medium' ? '🟡' : '🟢'}
            ${overall.label}
            <span style="font-size:11px;opacity:0.7">(Score: ${overall.score}/3)</span>
          </span>
        </div>
      </div>`;
  }

  function renderInterventions(list) {
    const catColor = { water: '#38bdf8', soil: '#a3e635', crop: '#4ade80', land: '#fb923c' };
    const catLabel = { water: 'जल', soil: 'मिट्टी', crop: 'फसल', land: 'भूमि' };

    const cards = list.map((inv, idx) => `
      <div class="cra-int-card" style="display:flex; flex-direction:column; gap:6px;">
        <div class="cra-int-top">
          <span class="cra-int-icon">${inv.icon}</span>
          <div class="cra-int-meta">
            <div class="cra-int-name">${inv.name_hindi}</div>
            <div class="cra-int-en">${inv.name}</div>
          </div>
          <span class="cra-int-cat" style="background:${catColor[inv.category] || '#4ade80'}20;color:${catColor[inv.category] || '#4ade80'}">${catLabel[inv.category] || inv.category}</span>
        </div>
        <div class="cra-int-desc" style="margin-top:2px; font-size:12px;">${inv.desc}</div>
        <div class="cra-int-benefit" style="font-size:12px; margin-top:0;">✅ <b>लाभ:</b> ${inv.benefit}</div>
        <div class="cra-int-mrv" style="font-size:11px; background:#f3f4f6; padding:6px; border-radius:4px; margin-top:4px;">
          <strong style="color:#4b5563;">📏 MRV KPI:</strong> <span style="color:#374151;">${inv.mrv_kpi}</span><br/>
          <strong style="color:#4b5563;">📚 Evidence:</strong> <span style="color:#374151;">${inv.evidence}</span>
        </div>
      </div>`).join('');

    return `
      <div class="cra-interventions-card">
        <h4 class="cra-section-title">🎯 वैज्ञानिक आधार पर अनुशंसित हस्तक्षेप (Evidence-based Interventions)</h4>
        <p class="cra-int-count">इस GP के लिए Uttarakhand Action Plan (2024) के नियमों के आधार पर <strong>${list.length} हस्तक्षेप</strong> सुझाए गए हैं:</p>
        <div class="cra-int-list">${cards}</div>
      </div>`;
  }


  /* ═══════════════════════════════════════════════════════════
     4.  PDF GENERATOR
  ═══════════════════════════════════════════════════════════ */

  function generateCRAPlanPDF(gp, scores, interventions) {
    // jsPDF is loaded globally from vendor/jspdf.umd.min.js
    const { jsPDF } = window.jspdf || window;
    if (!jsPDF) { alert('PDF library load नहीं हुई। Page refresh करें।'); return; }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    let y = 15;

    // ── Helpers ──
    const line = (txt, size = 10, bold = false, color = [30, 30, 30]) => {
      doc.setFontSize(size);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setTextColor(...color);
      doc.text(txt, 15, y);
      y += size * 0.45 + 2;
    };
    const rule = (c = [200, 200, 200]) => {
      doc.setDrawColor(...c);
      doc.line(15, y, W - 15, y);
      y += 4;
    };
    const checkPage = (needed = 20) => {
      if (y + needed > 280) { doc.addPage(); y = 15; }
    };

    // ── Header ──
    doc.setFillColor(22, 163, 74);
    doc.rect(0, 0, W, 22, 'F');
    doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
    doc.text('GP CRA Plan - CHANGE TechLab', 15, 10);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text('Climate Risk Assessment & Recommended Interventions', 15, 17);
    y = 28;

    // ── GP Info ──
    line(`GP: ${gp.name_hindi} (${gp.name})`, 12, true, [22, 163, 74]);
    line(`Block: ${gp.block_hindi}  |  District: ${gp.district_hindi}  |  GP Code: ${gp.gp_code}`, 9);
    line(`Villages: ${gp.villages.join(', ')}`, 9);
    line(`Agri Area: ${gp.agri_area_ha} ha  |  Farmers: ${gp.total_farmers}  |  Elevation: ${gp.elevation_m}m`, 9);
    line(`Generated: ${new Date().toLocaleDateString('hi-IN')}`, 8, false, [120, 120, 120]);
    rule([22, 163, 74]);

    // ── Baseline ──
    line('GP Baseline Profile', 11, true, [22, 163, 74]);
    line(`NDVI Avg: ${gp.avg_ndvi}  |  Slope: ${gp.slope}  |  Drainage: ${gp.drainage}`, 9);
    line(`Water Sources: ${(gp.water_sources || []).join(', ')}  |  Availability: ${gp.water_availability}`, 9);
    line(`Rainfall: ${gp.avg_rainfall_mm}mm/yr  |  Hazards: ${(gp.climate_hazards || []).join(', ')}`, 9);
    line(`Primary Crops: ${(gp.primary_crops || []).join(', ')}`, 9);
    y += 2; rule();

    // ── CRA Scores ──
    checkPage(60);
    line('CRA Priority Scores', 11, true, [22, 163, 74]);
    scores.indicators.forEach(ind => {
      checkPage(8);
      const lvlText = ind.level === 'high' ? 'HIGH [!!!]' : ind.level === 'medium' ? 'MEDIUM [!!]' : 'LOW [.]';
      const color = ind.level === 'high' ? [220, 38, 38] : ind.level === 'medium' ? [202, 138, 4] : [22, 163, 74];
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50);
      doc.text(`${ind.icon}  ${ind.name}`, 15, y);
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...color);
      doc.text(lvlText, 130, y);
      y += 6;
    });

    // Overall
    y += 2;
    const oc = scores.overall.level === 'high' ? [220, 38, 38] : scores.overall.level === 'medium' ? [202, 138, 4] : [22, 163, 74];
    doc.setFillColor(...oc.map(v => Math.min(v + 180, 255)));
    doc.rect(15, y - 4, W - 30, 10, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...oc);
    doc.text(`Overall CRA Priority: ${scores.overall.label} (Score: ${scores.overall.score}/3)`, 18, y + 2);
    y += 12; rule();

    // ── Interventions ──
    checkPage(20);
    line('Recommended Interventions', 11, true, [22, 163, 74]);
    interventions.forEach((inv, idx) => {
      checkPage(18);
      doc.setFillColor(245, 250, 245);
      doc.rect(15, y - 4, W - 30, 14, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30, 30, 30);
      doc.text(`${idx + 1}. ${inv.icon} ${inv.name_hindi}`, 18, y + 1);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(80, 80, 80);
      const descLines = doc.splitTextToSize(inv.desc, W - 40);
      doc.text(descLines[0], 18, y + 6);
      doc.setTextColor(22, 163, 74);
      doc.text(`Benefit: ${inv.benefit}`, 18, y + 10);
      y += 18;
    });

    // ── Footer ──
    const pages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 150);
      doc.text('CHANGE TechLab | Agri Monitor | changetechlab@outlook.com', 15, 292);
      doc.text(`Page ${p}/${pages}`, W - 25, 292);
    }

    doc.save(`CRA_Plan_${gp.name.replace(/ /g, '_')}_${Date.now()}.pdf`);
  }


  /* ═══════════════════════════════════════════════════════════
     5.  TAB CONTROLLER
  ═══════════════════════════════════════════════════════════ */

  let _currentGP = null;
  let _currentScores = null;
  let _currentInterventions = null;
  let _craMap = null;

  function populateGPDropdowns() {
    const blockSel = document.getElementById('cra-block-select');
    const gpSel    = document.getElementById('cra-gp-select');
    if (!blockSel || !gpSel || !window.GP_CRA_DATA) return;

    // Populate blocks
    const blocks = window.GP_CRA_DATA.getBlocks();
    blockSel.innerHTML = '<option value="">-- ब्लॉक चुनें --</option>' +
      blocks.map(b => `<option value="${b}">${b}</option>`).join('');

    blockSel.addEventListener('change', () => {
      const gps = window.GP_CRA_DATA.getByBlock(blockSel.value);
      gpSel.innerHTML = '<option value="">-- GP चुनें --</option>' +
        gps.map(gp => `<option value="${gp.id}">${gp.name_hindi}</option>`).join('');
      gpSel.disabled = (gps.length === 0);
      resetCRAContent();
    });

    gpSel.addEventListener('change', () => {
      if (!gpSel.value) return;
      const gp = window.GP_CRA_DATA.getById(gpSel.value);
      if (gp) runCRAAnalysis(gp);
    });
  }

  function resetCRAContent() {
    ['cra-profile-section', 'cra-scores-section', 'cra-map-section', 'cra-interventions-section', 'cra-actions-section']
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
    const status = document.getElementById('cra-status-msg');
    if (status) status.textContent = '';
    _currentGP = null;
  }

  function runCRAAnalysis(gp) {
    _currentGP = gp;

    // Update progress steps
    setStep(2);

    // Profile
    const profileSec = document.getElementById('cra-profile-section');
    if (profileSec) { profileSec.innerHTML = renderCRAProfile(gp); profileSec.style.display = 'block'; }

    // Scores
    _currentScores = calculateCRAScore(gp);
    const scoresSec = document.getElementById('cra-scores-section');
    if (scoresSec) { scoresSec.innerHTML = renderCRAScores(_currentScores); scoresSec.style.display = 'block'; }

    // Interventions
    _currentInterventions = getRecommendedInterventions(gp, _currentScores);
    const intSec = document.getElementById('cra-interventions-section');
    if (intSec) { intSec.innerHTML = renderInterventions(_currentInterventions); intSec.style.display = 'block'; }

    // Map section visibility
    const mapSec = document.getElementById('cra-map-section');
    if (mapSec) mapSec.style.display = 'block';

    // Actions
    const actSec = document.getElementById('cra-actions-section');
    if (actSec) actSec.style.display = 'flex';

    // Render mini map
    renderCRAMiniMap(gp, _currentScores);

    setStep(3);
  }

  function setStep(n) {
    document.querySelectorAll('.cra-step-dot').forEach((el, i) => {
      el.classList.toggle('active', i < n);
      el.classList.toggle('done', i < n - 1);
    });
  }

  function renderCRAMiniMap(gp, scores) {
    const mapEl = document.getElementById('cra-mini-map');
    if (!mapEl || !window.L) return;

    // Destroy previous map if any
    if (_craMap) { _craMap.remove(); _craMap = null; }

    _craMap = L.map('cra-mini-map', { zoomControl: true, scrollWheelZoom: false }).setView([gp.lat, gp.lng], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 17
    }).addTo(_craMap);

    // Color marker by priority
    const color = scores.overall.color;
    const icon = L.divIcon({
      className: '',
      html: `<div style="background:${color};width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;"></div>`,
      iconSize: [20, 20], iconAnchor: [10, 10]
    });
    L.marker([gp.lat, gp.lng], { icon })
      .addTo(_craMap)
      .bindPopup(`<b>${gp.name_hindi}</b><br>CRA: ${scores.overall.label}`)
      .openPopup();

    // Draw a rough polygon around the GP centroid (circle approximation)
    L.circle([gp.lat, gp.lng], { radius: 3500, color, fillColor: color, fillOpacity: 0.12, weight: 2 }).addTo(_craMap);

    // Fix map render
    setTimeout(() => _craMap && _craMap.invalidateSize(), 200);
  }

  function initCRATab() {
    populateGPDropdowns();

    // PDF button
    const pdfBtn = document.getElementById('cra-btn-pdf');
    if (pdfBtn) {
      pdfBtn.addEventListener('click', () => {
        if (!_currentGP) { alert('पहले GP चुनें।'); return; }
        if (window.CRAReport) {
          window.CRAReport.generate(_currentGP, _currentScores, _currentInterventions);
        } else {
          // Fallback to old jsPDF method if report generator fails to load
          generateCRAPlanPDF(_currentGP, _currentScores, _currentInterventions);
        }
      });
    }

    // Reset button
    const resetBtn = document.getElementById('cra-btn-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        document.getElementById('cra-block-select').value = '';
        const gpSel = document.getElementById('cra-gp-select');
        gpSel.innerHTML = '<option value="">-- पहले ब्लॉक चुनें --</option>';
        gpSel.disabled = true;
        resetCRAContent();
        setStep(1);
        if (_craMap) { _craMap.remove(); _craMap = null; }
      });
    }

    // Re-invalidate mini map size when CRA tab becomes active
    document.addEventListener('tabChanged', (e) => {
      if (e.detail && e.detail.tab === 'cra') {
        setTimeout(() => { if (_craMap) _craMap.invalidateSize(); }, 250);
      }
    });
  }


  /* ── Public API ── */
  window.CRA = {
    calculateCRAScore,
    getRecommendedInterventions,
    renderCRAProfile,
    renderCRAScores,
    renderInterventions,
    generateCRAPlanPDF,
    initCRATab
  };

})();
