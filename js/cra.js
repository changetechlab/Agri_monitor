/**
 * Agri Monitor — js/cra.js
 * GP-level Climate Risk Assessment (CRA) Engine
 */

(function () {
  'use strict';

  const SCORE_HIGH   = 'high';
  const SCORE_MEDIUM = 'medium';
  const SCORE_LOW    = 'low';

  function scoreLevel(value) {
    if (value >= 2.4) return SCORE_HIGH;
    if (value >= 1.5) return SCORE_MEDIUM;
    return SCORE_LOW;
  }

  function cropStressScore(ndvi) {
    const val = parseFloat(ndvi) || 0.4;
    if (val < 0.30) return { score: 3, level: SCORE_HIGH,   label: 'अत्यधिक तनाव' };
    if (val < 0.45) return { score: 2, level: SCORE_MEDIUM, label: 'मध्यम तनाव' };
    return                 { score: 1, level: SCORE_LOW,    label: 'सामान्य / स्वस्थ' };
  }

  function waterStressScore(gp) {
    const avail = gp.water_availability;
    const sources = gp.water_sources || [];
    const onlyRainFed = sources.length === 1 && sources[0] === 'rain_fed';

    if (avail === 'scarce' || onlyRainFed) return { score: 3, level: SCORE_HIGH,   label: 'गंभीर जल तनाव' };
    if (avail === 'seasonal')              return { score: 2, level: SCORE_MEDIUM, label: 'मौसमी जल तनाव' };
    return                                        { score: 1, level: SCORE_LOW,    label: 'पर्याप्त जल' };
  }

  function slopeErosionScore(slope) {
    const map = { very_steep: 3, steep: 2, moderate: 1, low: 1 };
    const s = map[slope] || 1;
    const labels = { 3: 'अत्यधिक ढलान खतरा', 2: 'मध्यम ढलान खतरा', 1: 'कम ढलान खतरा' };
    return { score: s, level: scoreLevel(s), label: labels[s] };
  }

  function drainageScore(drainage) {
    const map = { very_poor: 3, poor: 2, moderate: 2, good: 1 };
    const s = map[drainage] || 1;
    const labels = { very_poor: 'बहुत खराब जल निकासी', poor: 'खराब जल निकासी', moderate: 'मध्यम जल निकासी', good: 'अच्छी जल निकासी' };
    return { score: s, level: scoreLevel(s), label: labels[drainage] || 'मध्यम' };
  }

  function climateHazardScore(gp) {
    const hazards = gp.climate_hazards || [];
    const droughtFreq = gp.drought_frequency || 'low';
    let s = 1;
    if (hazards.length >= 3) s = 3;
    else if (hazards.length >= 2) s = 2;
    if (droughtFreq === 'high') s = Math.max(s, 3);
    if (droughtFreq === 'moderate') s = Math.max(s, 2);
    const label = s === 3 ? 'उच्च जलवायु खतरा' : s === 2 ? 'मध्यम जलवायु खतरा' : 'कम जलवायु खतरा';
    return { score: s, level: scoreLevel(s), label };
  }

  function agriPotentialScore(gp) {
    const agriPct = (gp.land_use && gp.land_use.agri_pct) || 25;
    const ndvi = parseFloat(gp.avg_ndvi) || 0.4;
    let s = 1;
    if (agriPct >= 35 && ndvi >= 0.50) s = 3;
    else if (agriPct >= 20 && ndvi >= 0.35) s = 2;
    const labels = { 3: 'उच्च कृषि क्षमता', 2: 'मध्यम कृषि क्षमता', 1: 'सीमित कृषि क्षमता' };
    return { score: s, level: scoreLevel(s), label: labels[s] };
  }

  function calculateCRAScore(gp) {
    const crop    = cropStressScore(gp.avg_ndvi);
    const water   = waterStressScore(gp);
    const slope   = slopeErosionScore(gp.slope);
    const drain   = drainageScore(gp.drainage);
    const climate = climateHazardScore(gp);
    const agri    = agriPotentialScore(gp);

    const riskScores = [crop.score, water.score, slope.score, drain.score, climate.score];
    const avg = riskScores.reduce((a, b) => a + b, 0) / riskScores.length;

    let overallLevel, overallLabel, overallColor;
    if (avg >= 2.3) {
      overallLevel = SCORE_HIGH;
      overallLabel = 'उच्च प्राथमिकता (High Risk)';
      overallColor = '#ef4444';
    } else if (avg >= 1.6) {
      overallLevel = SCORE_MEDIUM;
      overallLabel = 'मध्यम प्राथमिकता (Moderate Risk)';
      overallColor = '#f59e0b';
    } else {
      overallLevel = SCORE_LOW;
      overallLabel = 'कम प्राथमिकता (Low Risk)';
      overallColor = '#22c55e';
    }

    return {
      indicators: [
        { key: 'crop_stress',    icon: '🌾', name: 'फसल तनाव (Crop Stress)',     ...crop    },
        { key: 'water_stress',   icon: '💧', name: 'जल तनाव (Water Stress)',       ...water   },
        { key: 'slope_erosion',  icon: '⛰️', name: 'ढलान/क्षरण जोखिम',             ...slope   },
        { key: 'drainage',       icon: '🌊', name: 'जल निकासी (Drainage)',         ...drain   },
        { key: 'climate_hazard', icon: '🌩️', name: 'जलवायु खतरा (Climate Hazard)', ...climate },
        { key: 'agri_potential', icon: '🌱', name: 'कृषि क्षमता (Agri Potential)', ...agri    },
      ],
      overall: { score: avg.toFixed(1), level: overallLevel, label: overallLabel, color: overallColor }
    };
  }

  const INTERVENTIONS = {
    contour_bunds: {
      id: 'contour_bunds', icon: '〰️', category: 'land',
      name: 'Contour Bunds & Grass Strips', name_hindi: 'समोच्च मेड़ और घास-पट्टी',
      desc: 'Rule 1: ढलान > 15% पर कंटूर मेड़बंदी व नेपियर घास रोपण ताकि मृदा क्षरण रुके।',
      benefit: 'Reduced soil loss, improved water infiltration',
      mrv_kpi: '% of fields with contour bunds installed (geo-referenced)',
      evidence: 'Uttarakhand SAPCC (2024)'
    },
    terracing: {
      id: 'terracing', icon: '⛰️', category: 'land',
      name: 'Terracing & Multi-tier Forestry', name_hindi: 'सीढ़ीदार खेत और बहु-स्तरीय वानिकी',
      desc: 'Rule 2: अत्यधिक तीव्र ढलान पर सीढ़ीदार खेतों की मरम्मत व वृक्षारोपण।',
      benefit: 'Stabilised slopes, enhanced organic matter',
      mrv_kpi: '% of terraced area measured via GIS',
      evidence: 'Uttarakhand SAPCC (2024)'
    },
    irrigation_mulching: {
      id: 'irrigation_mulching', icon: '💧', category: 'water',
      name: 'Supplemental Irrigation & Mulching', name_hindi: 'पूरक सिंचाई और मल्चिंग',
      desc: 'Rule 3: प्री-मानसून नमी तनाव (NDVI < 0.3) में ड्रिप/स्प्रिंकलर व मल्चिंग का उपयोग।',
      benefit: 'Improved crop vigor, higher yields',
      mrv_kpi: '% of pixels with NDVI < 0.3 receiving irrigation',
      evidence: 'NDVI-based monitoring'
    },
    raised_beds: {
      id: 'raised_beds', icon: '🛏️', category: 'water',
      name: 'Raised Beds & Sub-surface Drainage', name_hindi: 'उठी हुई क्यारियां और जल निकासी',
      desc: 'Rule 5: जलभराव व गदेरे के पास की भूमि में उठी हुई क्यारियों पर खेती।',
      benefit: 'Faster drainage, reduced root rot disease',
      mrv_kpi: '% of fields < 200m with raised-bed implementation',
      evidence: 'Uttarakhand SAPCC (2024)'
    },
    millets_drip: {
      id: 'millets_drip', icon: '🌾', category: 'crop',
      name: 'Millets, Pulses & Drip Irrigation', name_hindi: 'मोटे अनाज, दालें और ड्रिप सिंचाई',
      desc: 'Rule 6 & 10: सूखा-प्रवण व वर्षा आधारित भूमि पर परंपरागत फसलों का सघन उत्पादन।',
      benefit: 'Sustained production under water stress',
      mrv_kpi: '% of farms adopting millet/pulse intercropping',
      evidence: 'Uttarakhand SAPCC (2024)'
    },
    conservation_agri: {
      id: 'conservation_agri', icon: '🌿', category: 'soil',
      name: 'Conservation Agriculture (No-till)', name_hindi: 'संरक्षण कृषि (नो-टिल व कवर फसलें)',
      desc: 'Rule 7: जैविक कार्बन वृद्धि के लिए नो-टिल खेती व कवर फसलों का रोपण।',
      benefit: 'Increased SOC, better moisture retention',
      mrv_kpi: 'SOC increase measured by periodic soil sampling',
      evidence: 'Uttarakhand SAPCC (2024)'
    },
    agroforestry: {
      id: 'agroforestry', icon: '🌳', category: 'land',
      name: 'Agro-forestry (Tree hedgerows)', name_hindi: 'कृषि-वानिकी (पेड़ों की बाड़)',
      desc: 'Rule 8: खेतों की सीमाओं पर बांझ, माल्टा, अखरोट व भीमल की बाड़ लगाना।',
      benefit: 'Soil protection, diversified income',
      mrv_kpi: '% of marginal farms with agro-forestry trees',
      evidence: 'Uttarakhand SAPCC (2024)'
    },
    rainwater_harvesting: {
      id: 'rainwater_harvesting', icon: '🪣', category: 'water',
      name: 'Community Tanks & Farm Ponds', name_hindi: 'सामुदायिक टैंक और खेत तालाब',
      desc: 'Rule 9: वर्षा जल संचयन के लिए रिज पर चाल-खाल व खेतों के पास पक्के/कच्चे तालाब।',
      benefit: 'Augmented water supply for irrigation',
      mrv_kpi: 'Number of tanks per GP (field-survey)',
      evidence: 'Uttarakhand SAPCC (2024)'
    }
  };

  function getRecommendedInterventions(gp, scores) {
    const list = [];
    const hazards = gp.climate_hazards || [];
    const ndvi = parseFloat(gp.avg_ndvi) || 0.4;

    if (gp.slope === 'steep' || gp.slope === 'very_steep') list.push({ ...INTERVENTIONS.contour_bunds, priority: 3 });
    if (gp.slope === 'very_steep') list.push({ ...INTERVENTIONS.terracing, priority: 3 });
    if (ndvi < 0.35) list.push({ ...INTERVENTIONS.irrigation_mulching, priority: 3 });
    if (gp.drainage === 'poor' || gp.drainage === 'very_poor') list.push({ ...INTERVENTIONS.raised_beds, priority: 3 });
    if (gp.water_availability === 'scarce' || hazards.includes('drought')) list.push({ ...INTERVENTIONS.millets_drip, priority: 3 });
    if (ndvi < 0.42) list.push({ ...INTERVENTIONS.conservation_agri, priority: 2 });
    if (gp.land_use && gp.land_use.forest_pct < 55) list.push({ ...INTERVENTIONS.agroforestry, priority: 2 });
    list.push({ ...INTERVENTIONS.rainwater_harvesting, priority: 3 });

    const seen = new Set();
    return list.filter(i => {
      if (seen.has(i.id)) return false;
      seen.add(i.id);
      return true;
    }).sort((a, b) => b.priority - a.priority);
  }

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
    const srcMap = { spring: 'झरना/नौला', stream: 'नदी/नाला', rain_fed: 'वर्षाआधारित', canal: 'नहर', drip: 'ड्रिप' };
    const waterSrc = (gp.water_sources || []).map(s => srcMap[s] || s).join(', ');
    const slopeMap = { very_steep: 'अत्यधिक तीव्र ढलान', steep: 'तीव्र ढलान', moderate: 'मध्यम ढलान', low: 'सामान्य' };
    const drainMap = { very_poor: 'बहुत खराब', poor: 'खराब', moderate: 'मध्यम', good: 'अच्छी' };
    const ndviColor = gp.avg_ndvi < 0.3 ? '#ef4444' : gp.avg_ndvi < 0.45 ? '#f59e0b' : '#22c55e';
    const crops = Array.isArray(gp.primary_crops) ? gp.primary_crops.join(', ') : (gp.primary_crops || 'मंडुआ, झंगोरा, दालें');

    return `
      <div class="cra-profile-card">
        <div class="cra-profile-header">
          <div>
            <h3 class="cra-profile-title">📍 ${gp.name_hindi || gp.name}</h3>
            <div class="cra-profile-subtitle">${gp.block_hindi || gp.block} · ${gp.district_hindi || gp.district} · कोड: ${gp.gp_code}</div>
          </div>
          <div class="cra-profile-tag">GP Profile</div>
        </div>

        <div class="cra-profile-grid">
          <div class="cra-profile-item">
            <span class="cra-pi-label">🏘️ गाँव संख्या</span>
            <span class="cra-pi-val">${gp.village_count || 1} गाँव</span>
            <span class="cra-pi-sub">${(gp.villages || []).join(', ')}</span>
          </div>
          <div class="cra-profile-item">
            <span class="cra-pi-label">🌾 कृषि क्षेत्र</span>
            <span class="cra-pi-val">${gp.agri_area_ha || 113} हेक्टेयर</span>
            <span class="cra-pi-sub">${gp.total_farmers || 150} किसान</span>
          </div>
          <div class="cra-profile-item">
            <span class="cra-pi-label">📡 NDVI औसत</span>
            <span class="cra-pi-val" style="color:${ndviColor}">${gp.avg_ndvi}</span>
            <span class="cra-pi-sub">फसल स्वास्थ्य सूचक</span>
          </div>
          <div class="cra-profile-item">
            <span class="cra-pi-label">⛰️ ढलान</span>
            <span class="cra-pi-val">${slopeMap[gp.slope] || gp.slope}</span>
            <span class="cra-pi-sub">ऊंचाई: ${gp.elevation_m || 1150} मी</span>
          </div>
          <div class="cra-profile-item">
            <span class="cra-pi-label">💧 जल स्रोत</span>
            <span class="cra-pi-val">${waterSrc || 'वर्षाआधारित'}</span>
            <span class="cra-pi-sub">उपलब्धता: ${gp.water_availability === 'adequate' ? 'पर्याप्त' : 'मौसमी'}</span>
          </div>
          <div class="cra-profile-item">
            <span class="cra-pi-label">🌊 औसत वर्षा</span>
            <span class="cra-pi-val">${gp.avg_rainfall_mm || 1250} मिमी/वर्ष</span>
            <span class="cra-pi-sub">निकासी: ${drainMap[gp.drainage] || 'मध्यम'}</span>
          </div>
        </div>

        <div class="cra-hazard-row" style="margin-top:8px;">
          <span class="cra-hazard-label">⚠️ जलवायु खतरे:</span>
          ${(gp.climate_hazards || ['drought']).map(h => `<span class="cra-hazard-chip">${h}</span>`).join(' ')}
        </div>

        <div class="cra-crop-row" style="margin-top:6px;">
          <span class="cra-hazard-label">🌱 मुख्य फसलें:</span>
          <span class="cra-pi-sub" style="font-weight:600; color:#15803d;">${crops}</span>
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
          <td><span style="color:${starsColor};letter-spacing:2px;font-size:13px">${stars}</span></td>
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
        <div class="cra-overall-row" style="border-left:4px solid ${overall.color}; padding:8px; margin-top:8px; background:#f9fafb; border-radius:4px;">
          <span class="cra-overall-label" style="font-weight:600;">🎯 Overall CRA Priority:</span>
          <span class="cra-overall-val" style="color:${overall.color}; font-weight:bold; margin-left:6px;">
            ${overall.level === 'high' ? '🔴' : overall.level === 'medium' ? '🟡' : '🟢'}
            ${overall.label}
            <span style="font-size:11px; opacity:0.8;">(Risk Score: ${overall.score}/3)</span>
          </span>
        </div>
      </div>`;
  }

  function renderInterventions(list) {
    const catColor = { water: '#38bdf8', soil: '#a3e635', crop: '#4ade80', land: '#fb923c' };
    const catLabel = { water: 'जल', soil: 'मिट्टी', crop: 'फसल', land: 'भूमि' };

    const cards = list.map((inv, idx) => `
      <div class="cra-int-card" style="display:flex; flex-direction:column; gap:4px; padding:10px; border:1px solid #e5e7eb; border-radius:6px; margin-bottom:8px; background:#ffffff;">
        <div class="cra-int-top" style="display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:18px;">${inv.icon}</span>
            <div>
              <div style="font-weight:bold; font-size:13px; color:#1f2937;">${inv.name_hindi}</div>
              <div style="font-size:11px; color:#6b7280;">${inv.name}</div>
            </div>
          </div>
          <span style="background:${catColor[inv.category] || '#4ade80'}22; color:${catColor[inv.category] || '#15803d'}; font-size:11px; font-weight:bold; padding:2px 8px; border-radius:12px;">${catLabel[inv.category] || inv.category}</span>
        </div>
        <div style="font-size:11.5px; color:#374151; margin-top:4px;">${inv.desc}</div>
        <div style="font-size:11.5px; color:#15803d; font-weight:500;">✅ <b>अपेक्षित लाभ:</b> ${inv.benefit}</div>
        <div style="font-size:10.5px; background:#f8fafc; padding:6px; border-radius:4px; margin-top:4px; border:1px solid #f1f5f9;">
          <strong>📏 MRV KPI:</strong> <span style="color:#475569;">${inv.mrv_kpi}</span> | 
          <strong>📚 Evidence:</strong> <span style="color:#475569;">${inv.evidence}</span>
        </div>
      </div>`).join('');

    return `
      <div class="cra-interventions-card">
        <h4 class="cra-section-title">🎯 वैज्ञानिक आधार पर अनुशंसित हस्तक्षेप (Evidence-based Interventions)</h4>
        <p class="cra-int-count" style="font-size:12px; color:#6b7280; margin-bottom:8px;">Uttarakhand SAPCC (2024) के आधार पर <strong>${list.length} हस्तक्षेप</strong> सुझाए गए हैं:</p>
        <div class="cra-int-list">${cards}</div>
      </div>`;
  }
  /* ═══════════════════════════════════════════════════════════
     4.  LEAFLET MINI-MAP (Fixed Invalidation)
  ═══════════════════════════════════════════════════════════ */

  let _currentGP = null;
  let _currentScores = null;
  let _currentInterventions = null;
  let _craMap = null;

  function renderCRAMiniMap(gp, scores) {
    const mapEl = document.getElementById('cra-mini-map');
    if (!mapEl || !window.L) return;

    if (_craMap) {
      _craMap.remove();
      _craMap = null;
    }

    const lat = gp.lat || 30.39;
    const lng = gp.lng || 79.03;

    _craMap = L.map('cra-mini-map', {
      zoomControl: true,
      scrollWheelZoom: false
    }).setView([lat, lng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(_craMap);

    const color = (scores && scores.overall && scores.overall.color) || '#ef4444';

    const icon = L.divIcon({
      className: '',
      html: `<div style="background:${color};width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);"></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });

    L.marker([lat, lng], { icon })
      .addTo(_craMap)
      .bindPopup(`<b>${gp.name_hindi || gp.name}</b><br>प्राथमिकता: ${scores.overall.label}`)
      .openPopup();

    L.circle([lat, lng], {
      radius: 2500,
      color: color,
      fillColor: color,
      fillOpacity: 0.15,
      weight: 2
    }).addTo(_craMap);

    // Map container layout fix
    setTimeout(() => {
      if (_craMap) _craMap.invalidateSize();
    }, 300);
  }


  /* ═══════════════════════════════════════════════════════════
     5.  TAB CONTROLLER & PDF DISPATCHER
  ═══════════════════════════════════════════════════════════ */

  function populateGPDropdowns() {
    const blockSel = document.getElementById('cra-block-select');
    const gpSel    = document.getElementById('cra-gp-select');
    if (!blockSel || !gpSel || !window.GP_CRA_DATA) return;

    const blocks = window.GP_CRA_DATA.getBlocks();
    blockSel.innerHTML = '<option value="">-- ब्लॉक चुनें --</option>' +
      blocks.map(b => `<option value="${b}">${window.GP_CRA_DATA.getBlockHindi(b)} (${b})</option>`).join('');

    blockSel.addEventListener('change', () => {
      const gps = window.GP_CRA_DATA.getByBlock(blockSel.value);
      gpSel.innerHTML = '<option value="">-- GP चुनें --</option>' +
        gps.map(gp => `<option value="${gp.id}">${gp.name_hindi || gp.name}</option>`).join('');
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
    setStep(2);

    const profileSec = document.getElementById('cra-profile-section');
    if (profileSec) { profileSec.innerHTML = renderCRAProfile(gp); profileSec.style.display = 'block'; }

    _currentScores = calculateCRAScore(gp);
    const scoresSec = document.getElementById('cra-scores-section');
    if (scoresSec) { scoresSec.innerHTML = renderCRAScores(_currentScores); scoresSec.style.display = 'block'; }
    
    _currentInterventions = getRecommendedInterventions(gp, _currentScores);

    // --- Himalayan Extension ---
    let finalScores = _currentScores;
    let finalInterventions = _currentInterventions;
    
    if (window.HimalayanCRA) {
      const extendedScores = window.HimalayanCRA.calculateExtendedScores(gp);
      finalScores = extendedScores; // store for PDF generator
      
      const himalayanAssessmentHTML = window.HimalayanCRA.renderHimalayanAssessment(gp, extendedScores);
      const himalayanSec = document.getElementById('himalayan-assessment-section');
      if (himalayanSec) {
        himalayanSec.innerHTML = himalayanAssessmentHTML;
        himalayanSec.style.display = 'block';
      }

      const himalayanInterventions = window.HimalayanCRA.getHimalayanInterventions(gp, extendedScores);
      finalInterventions = [..._currentInterventions, ...himalayanInterventions];
      
      const intSec = document.getElementById('cra-interventions-section');
      if (intSec) {
        const baseHTML = renderInterventions(_currentInterventions);
        const himalayanHTML = window.HimalayanCRA.renderHimalayanInterventions(himalayanInterventions);
        intSec.innerHTML = baseHTML + himalayanHTML;
        intSec.style.display = 'block';
      }
    } else {
      const intSec = document.getElementById('cra-interventions-section');
      if (intSec) { intSec.innerHTML = renderInterventions(_currentInterventions); intSec.style.display = 'block'; }
    }
    // ---------------------------

    const mapSec = document.getElementById('cra-map-section');
    if (mapSec) mapSec.style.display = 'block';

    const actSec = document.getElementById('cra-actions-section');
    if (actSec) actSec.style.display = 'flex';

    renderCRAMiniMap(gp, _currentScores);
    setStep(3);
  }

  function setStep(n) {
    document.querySelectorAll('.cra-step-dot').forEach((el, i) => {
      el.classList.toggle('active', i < n);
      el.classList.toggle('done', i < n - 1);
    });
  }

  function initCRATab() {
    populateGPDropdowns();

    const pdfBtn = document.getElementById('cra-btn-pdf');
    if (pdfBtn) {
      pdfBtn.addEventListener('click', () => {
        if (!_currentGP) { alert('कृपया पहले ग्राम पंचायत चुनें।'); return; }

        // Prefer 2-Page visual CRAReport generator if available
        if (window.CRAReport && typeof window.CRAReport.generate === 'function') {
          let scoresForPdf = _currentScores;
          let interventionsForPdf = _currentInterventions;
          
          if (window.HimalayanCRA) {
            scoresForPdf = window.HimalayanCRA.calculateExtendedScores(_currentGP);
            const himalayanInts = window.HimalayanCRA.getHimalayanInterventions(_currentGP, scoresForPdf);
            interventionsForPdf = [..._currentInterventions, ...himalayanInts];
          }
          
          window.CRAReport.generate(_currentGP, scoresForPdf, interventionsForPdf);
        } else {
          alert('Generating default print view...');
          window.print();
        }
      });
    }

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

    document.addEventListener('tabChanged', (e) => {
      if (e.detail && e.detail.tab === 'cra') {
        setTimeout(() => { if (_craMap) _craMap.invalidateSize(); }, 300);
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
    initCRATab
  };

})();