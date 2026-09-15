/**
 * Agri Monitor — js/cra-report.js
 * ─────────────────────────────────────────────────────────────
 * Purpose  : Generate a professional A3-landscape CRA Plan
 *            report in a new browser tab (print → PDF).
 *            Modelled after UCRRFP / CHANGE TechLab style.
 * Depends  : GP_CRA_DATA, CRA scoring engine (window.CRA)
 * Exposes  : window.CRAReport.generate(gp, scores, interventions)
 */

window.CRAReport = (() => {

  /* ── Slope distribution by GP slope category ─────────────── */
  function buildSlopeData(gp) {
    const s = gp.slope;
    const total = gp.agri_area_ha;
    if (s === 'very_steep') {
      return [
        { label: '0–5° (Very Gentle)', pct: 5,  ha: Math.round(total*0.05), color: '#22c55e' },
        { label: '5–15° (Gentle)',     pct: 10, ha: Math.round(total*0.10), color: '#84cc16' },
        { label: '15–30° (Moderate)',  pct: 20, ha: Math.round(total*0.20), color: '#facc15' },
        { label: '30–45° (Steep)',     pct: 34, ha: Math.round(total*0.34), color: '#f97316' },
        { label: '>45° (Very Steep)',  pct: 31, ha: Math.round(total*0.31), color: '#ef4444' },
      ];
    } else if (s === 'steep') {
      return [
        { label: '0–5° (Very Gentle)', pct: 10, ha: Math.round(total*0.10), color: '#22c55e' },
        { label: '5–15° (Gentle)',     pct: 22, ha: Math.round(total*0.22), color: '#84cc16' },
        { label: '15–30° (Moderate)',  pct: 34, ha: Math.round(total*0.34), color: '#facc15' },
        { label: '30–45° (Steep)',     pct: 25, ha: Math.round(total*0.25), color: '#f97316' },
        { label: '>45° (Very Steep)',  pct: 9,  ha: Math.round(total*0.09), color: '#ef4444' },
      ];
    } else {
      return [
        { label: '0–5° (Very Gentle)', pct: 20, ha: Math.round(total*0.20), color: '#22c55e' },
        { label: '5–15° (Gentle)',     pct: 35, ha: Math.round(total*0.35), color: '#84cc16' },
        { label: '15–30° (Moderate)',  pct: 30, ha: Math.round(total*0.30), color: '#facc15' },
        { label: '30–45° (Steep)',     pct: 12, ha: Math.round(total*0.12), color: '#f97316' },
        { label: '>45° (Very Steep)',  pct: 3,  ha: Math.round(total*0.03), color: '#ef4444' },
      ];
    }
  }

  /* ── NDVI zone percentages from avg_ndvi ─────────────────── */
  function buildNDVIZones(gp) {
    const n = gp.avg_ndvi;
    if (n < 0.3) {
      return { high: 45, moderate: 35, low: 14, water: 6 };
    } else if (n < 0.45) {
      return { high: 25, moderate: 40, low: 28, water: 7 };
    } else if (n < 0.6) {
      return { high: 10, moderate: 35, low: 45, water: 10 };
    } else {
      return { high: 5, moderate: 20, low: 62, water: 13 };
    }
  }

  /* ── Score badge HTML ────────────────────────────────────── */
  function scoreBadge(level) {
    const map = {
      High:   { color: '#ef4444', bg: '#fef2f2', dot: '🔴' },
      Medium: { color: '#f59e0b', bg: '#fffbeb', dot: '🟡' },
      Low:    { color: '#22c55e', bg: '#f0fdf4', dot: '🟢' },
    };
    const s = map[level] || map.Low;
    return `<span style="background:${s.bg};color:${s.color};padding:2px 10px;border-radius:20px;font-weight:700;font-size:11px;border:1px solid ${s.color}40">${s.dot} ${level}</span>`;
  }

  /* ── Intervention icon map ───────────────────────────────── */
  const INT_ICONS = {
    farm_pond:'🪣', springshed:'💧', awd:'🌊', mulching:'🌿',
    crop_diversification:'🌾', millet_promotion:'🌾', contour_bunds:'〰️',
    agroforestry:'🌳', biochar:'⬛', soc_enhancement:'🌱',
    check_dams:'🪨', polyhouse:'🏠',
  };

  /* ── Donut SVG chart (no external lib needed) ────────────── */
  function donutSVG(slices, cx, cy, r) {
    let total = slices.reduce((s, d) => s + d.pct, 0);
    let angle = -Math.PI / 2;
    let paths = '';
    for (const d of slices) {
      const sweep = (d.pct / total) * 2 * Math.PI;
      const x1 = cx + r * Math.cos(angle);
      const y1 = cy + r * Math.sin(angle);
      const x2 = cx + r * Math.cos(angle + sweep);
      const y2 = cy + r * Math.sin(angle + sweep);
      const lf = sweep > Math.PI ? 1 : 0;
      const inner = r * 0.52;
      const xi1 = cx + inner * Math.cos(angle);
      const yi1 = cy + inner * Math.sin(angle);
      const xi2 = cx + inner * Math.cos(angle + sweep);
      const yi2 = cy + inner * Math.sin(angle + sweep);
      paths += `<path d="M${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${lf},1 ${x2.toFixed(1)},${y2.toFixed(1)} L${xi2.toFixed(1)},${yi2.toFixed(1)} A${inner},${inner} 0 ${lf},0 ${xi1.toFixed(1)},${yi1.toFixed(1)} Z" fill="${d.color}" stroke="white" stroke-width="1.5"/>`;
      angle += sweep;
    }
    return paths;
  }

  /* ══════════════════════════════════════════════════════════
     MAIN REPORT HTML GENERATOR
  ══════════════════════════════════════════════════════════ */

  /* ----------------------------------------------------------
     MAIN REPORT HTML GENERATOR
  ---------------------------------------------------------- */

  /* ══════════════════════════════════════════════════════════
     MAIN REPORT HTML GENERATOR
  ══════════════════════════════════════════════════════════ */
  function buildHTML(gp, scores, interventions, gpGeoJSON) {
    const rainfall = gp.rainfall || gp.avg_rainfall_mm || (1200 + Math.floor(Math.random() * 200));
    const pCrops = Array.isArray(gp.primary_crops) ? gp.primary_crops.join(', ') : gp.primary_crops || 'मंडुवा, झंगोरा';
    const slope  = buildSlopeData(gp);
    const zones  = buildNDVIZones(gp);
    const today  = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
    const avgSlopeDeg = gp.slope === 'very_steep' ? '42°' : gp.slope === 'steep' ? '35°' : gp.slope === 'moderate' ? '22°' : '10°';
    const slopeSVG = donutSVG(slope, 90, 90, 75);

    // Pre-compute polygon script (avoids nested template literal issue)
    const gpBoundaryScript = gpGeoJSON
      ? `const gpBoundary = L.geoJSON(${JSON.stringify(gpGeoJSON)}, {
           style: { color: '#1a5276', weight: 3, opacity: 0.9, fillColor: '#1a5276', fillOpacity: 0.08 }
         }).addTo(craReportMap);
         craReportMap.fitBounds(gpBoundary.getBounds(), { padding: [10, 10] });`
      : `const pts = [
           [gpLat+0.012,gpLng-0.005],[gpLat+0.008,gpLng+0.015],
           [gpLat-0.002,gpLng+0.018],[gpLat-0.015,gpLng+0.008],
           [gpLat-0.012,gpLng-0.010],[gpLat+0.002,gpLng-0.012]
         ];
         const gpBoundary = L.polygon(pts, {
           color:'#1a5276',weight:3,opacity:0.8,fillColor:'#1a5276',fillOpacity:0.05
         }).addTo(craReportMap);
         craReportMap.fitBounds(gpBoundary.getBounds(),{padding:[10,10]});`;

    const ovLevel = scores.overall.level || scores.overall;
    const overallColor = ovLevel === 'High' ? '#ef4444' : ovLevel === 'Medium' ? '#f59e0b' : '#22c55e';

    const getInd = (k) => {
      const x = (scores.indicators || []).find(i => i.key === k);
      return x ? (x.level === 'high' ? 'High' : x.level === 'medium' ? 'Medium' : 'Low') : 'Low';
    };

    const cStress = getInd('crop_stress');
    const wStress = getInd('water_stress');
    const sErosion = getInd('slope_erosion');
    const dRisk = getInd('drainage');
    const cHazard = getInd('climate_hazard');
    const aPot = getInd('agri_potential');

    const interventionCards = interventions.slice(0, 8).map(iv => `
      <div class="int-card">
        <div class="int-icon">${iv.icon || INT_ICONS[iv.id] || '🌿'}</div>
        <div class="int-body">
          <div class="int-name">${iv.name_hindi || iv.name}</div>
          <div class="int-en">${iv.name}</div>
          <div class="int-ben">✅ <b>लाभ:</b> ${iv.benefit || ''}</div>
          ${iv.mrv_kpi ? `<div class="int-mrv" style="margin-top: 3px; font-size: 8px; color: #4b5563; background: #f3f4f6; padding: 3px; border-radius: 3px;"><b>KPI:</b> ${iv.mrv_kpi}</div>` : ''}
        </div>
      </div>`).join('');

    const scoreRows = [
      ['🌾 Crop Stress (NDVI)',    cStress],
      ['💧 Water Stress',          wStress],
      ['⛰️ Slope / Erosion Risk',  sErosion],
      ['🌊 Drainage Risk',         dRisk],
      ['🌩️ Climate Hazard',        cHazard],
      ['🌱 Agriculture Potential', aPot],
    ].map(([label, val]) => `
      <tr>
        <td class="sc-label">${label}</td>
        <td>${scoreBadge(val)}</td>
        <td class="sc-bar-cell"><div class="sc-bar" style="width:${val==='High'?90:val==='Medium'?55:25}%;background:${val==='High'?'#ef4444':val==='Medium'?'#f59e0b':'#22c55e'}"></div></td>
      </tr>`).join('');

    const villageMarkers = (gp.villages || []).map((v, i) => `
      const vLat = parseFloat(${gp.lat}) || 30.39;
      const vLng = parseFloat(${gp.lng}) || 79.03;
      L.circleMarker([vLat, vLng], {
        radius: 6, fillColor: '#1e40af', color: '#fff', weight: 2,
        fillOpacity: 0.9
      }).bindPopup('<b>${v}</b><br>Village').addTo(craReportMap);`).join('\n');

    const waterMarkers = (gp.water_sources || []).map((ws, i) => `
      L.marker([${gp.lat + (i*0.01 - 0.01)}, ${gp.lng + (i*0.012 + 0.01)}], {
        icon: L.divIcon({ html: '💧', className: '', iconSize: [20,20], iconAnchor:[10,10] })
      }).bindPopup('<b>${ws}</b>').addTo(craReportMap);`).join('\n');

    const zoneRadius = Math.sqrt((gp.agri_area_ha * 10000) / Math.PI);

    return `<!DOCTYPE html>
<html lang="hi">
<head>
<meta charset="utf-8">
<title>CRA Plan — ${gp.name_hindi} | ${gp.block_hindi} | Rudraprayag</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', 'Noto Sans Devanagari', Arial, sans-serif; background:#f5f5f5; color:#1a1a1a; font-size:11px; }

  /* ── Page layout ──────────────────────────────────── */
  .page {
    width: 420mm;
    min-height: 297mm;
    background: white;
    margin: 0 auto;
    display: grid;
    grid-template-rows: auto 1fr auto auto auto auto auto;
    box-shadow: 0 4px 24px rgba(0,0,0,0.15);
  }

  /* ── Header ────────────────────────────────────────── */
  .hdr {
    background: linear-gradient(135deg, #14532d 0%, #166534 50%, #0f766e 100%);
    color: white;
    padding: 8px 16px;
    margin-bottom: 0;
    display: grid;
    grid-template-columns: 60px 1fr auto;
    align-items: center;
    gap: 12px;
  }
  .hdr-logo {
    width: 52px; height: 52px;
    background: rgba(255,255,255,0.15);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 26px;
  }
  .hdr-title { line-height: 1.3; }
  .hdr-title h1 {
    font-size: 15px; font-weight: 800; letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .hdr-title h2 { font-size: 11px; font-weight: 400; opacity: 0.85; margin-top: 2px; }
  .hdr-sub {
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 8px;
    padding: 6px 12px;
    font-size: 10px;
    text-align: right;
    line-height: 1.6;
  }
  .hdr-sub b { font-size: 12px; display: block; }

  /* Sub-header: GP name band */
  .gp-band {
    background: #15803d;
    color: white;
    text-align: center;
    padding: 4px 10px;
    margin-bottom: 0;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
  }
  .gp-band span { font-weight: 400; font-size: 11px; opacity: 0.9; margin-left: 12px; }

  /* ── Main map + info row ────────────────────────────── */
  .map-info-row {
    display: grid;
    grid-template-columns: 1fr 200px;
    gap: 0;
    margin-top: 0;
    height: 420px;
  }
  #craReportMap { width: 100%; height: 100%; }

  .info-panel {
    background: #f9fafb;
    border-left: 3px solid #16a34a;
    display: flex;
    flex-direction: column;
    gap: 0;
    overflow: hidden;
  }
  .info-section {
    padding: 8px 10px;
    border-bottom: 1px solid #e5e7eb;
  }
  .info-section h4 {
    font-size: 9.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #15803d;
    margin-bottom: 6px;
  }

  /* Legend */
  .legend-item { display: flex; align-items: center; gap: 6px; margin: 3px 0; font-size: 9.5px; }
  .legend-box { width: 14px; height: 10px; border-radius: 2px; flex-shrink: 0; border: 1px solid rgba(0,0,0,0.15); }
  .legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

  /* CRA Priority Zones */
  .zone-item { display: flex; gap: 6px; margin: 3px 0; align-items: flex-start; }
  .zone-box { width: 12px; height: 12px; border-radius: 2px; flex-shrink: 0; margin-top: 1px; }
  .zone-text { font-size: 9px; line-height: 1.3; }
  .zone-name { font-weight: 700; }
  .zone-desc { color: #6b7280; font-size: 8.5px; }

  /* Location inset */
  .location-box {
    margin-top: auto;
    background: #1e3a5f;
    color: white;
    padding: 6px 10px;
    font-size: 9px;
  }
  .location-box b { font-size: 10px; display: block; margin-bottom: 2px; }

  /* ── GP At A Glance ─────────────────────────────────── */
  .stats-bar {
    background: #14532d;
    color: white;
    padding: 3px 12px;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .stats-row {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    border-bottom: 2px solid #16a34a;
  }
  .stat-cell {
    padding: 8px 6px;
    text-align: center;
    border-right: 1px solid #e5e7eb;
    background: #f0fdf4;
  }
  .stat-cell:last-child { border-right: none; }
  .stat-icon { font-size: 16px; display: block; margin-bottom: 2px; }
  .stat-val { font-size: 13px; font-weight: 800; color: #14532d; display: block; }
  .stat-label { font-size: 8.5px; color: #6b7280; display: block; margin-top: 1px; }

  /* ── Analysis row ───────────────────────────────────── */
  .analysis-row {
    display: grid;
    grid-template-columns: 195px 1fr 1fr;
    gap: 0;
    border-bottom: 1px solid #e5e7eb;
  }

  /* Slope */
  .slope-panel {
    padding: 10px 12px;
    border-right: 1px solid #e5e7eb;
    background: #fefefe;
  }
  .slope-panel h4 { font-size: 10px; font-weight: 700; color: #14532d; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.3px; }
  .slope-chart-wrap { display: flex; align-items: center; gap: 10px; }
  .slope-legend { flex: 1; }
  .slope-leg-item { display: flex; align-items: center; gap: 5px; margin: 3px 0; font-size: 9px; }
  .slope-leg-dot { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }
  .slope-leg-pct { margin-left: auto; font-weight: 700; color: #374151; }

  /* CRA Scores */
  .scores-panel {
    padding: 10px 12px;
    background: #fefefe;
    border-right: 1px solid #e5e7eb;
  }
  .scores-panel h4 { font-size: 10px; font-weight: 700; color: #14532d; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.3px; }
  .sc-table { width: 100%; border-collapse: collapse; }
  .sc-table tr { border-bottom: 1px solid #f3f4f6; }
  .sc-table tr:hover { background: #f9fafb; }
  .sc-label { padding: 5px 4px; font-size: 10px; color: #374151; }
  .sc-bar-cell { width: 120px; padding: 5px 4px; }
  .sc-bar { height: 8px; border-radius: 4px; transition: width 0.3s; }
  .overall-row {
    margin-top: 8px;
    padding: 6px 10px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 700;
    border: 2px solid ${overallColor};
    background: ${overallColor}15;
  }
  .overall-label { font-size: 11px; }
  .overall-val { font-size: 14px; color: ${overallColor}; }

  /* Roadmap & Budgets */
  .roadmap-panel {
    padding: 10px 12px;
    background: #fefefe;
  }
  .roadmap-panel h4 { font-size: 10px; font-weight: 700; color: #14532d; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.3px; }
  .rd-step { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px; }
  .rd-dot { width: 18px; height: 18px; border-radius: 50%; background: #16a34a; color: white; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; flex-shrink: 0; }
  .rd-text { font-size: 9px; color: #374151; padding-top: 2px; }
  
  .conv-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  .conv-table th { background: #f3f4f6; padding: 4px; text-align: left; font-size: 8.5px; color: #4b5563; font-weight: 700; border-bottom: 1px solid #d1d5db; }
  .conv-table td { padding: 4px; font-size: 8.5px; border-bottom: 1px solid #e5e7eb; color: #374151; }

  /* ── Interventions ──────────────────────────────────── */
  .int-bar {
    background: #0f766e;
    color: white;
    padding: 3px 12px;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .int-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    padding: 10px 12px;
    background: #f0fdf9;
  }
  .int-card {
    background: white;
    border: 1px solid #d1fae5;
    border-radius: 8px;
    padding: 8px;
    display: flex;
    gap: 7px;
    align-items: flex-start;
  }
  .int-icon { font-size: 18px; flex-shrink: 0; line-height: 1; }
  .int-body { flex: 1; }
  .int-name { font-size: 9.5px; font-weight: 700; color: #14532d; line-height: 1.3; }
  .int-en { font-size: 8.5px; color: #6b7280; }
  .int-ben { font-size: 8.5px; color: #0f766e; margin-top: 2px; font-weight: 600; }

  /* ── Signatures ─────────────────────────────────────── */
  .sig-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    padding: 20px 40px;
    background: white;
    border-top: 1px solid #e5e7eb;
  }
  .sig-box {
    text-align: center;
    padding-top: 40px;
    border-top: 1px dashed #9ca3af;
    font-size: 10px;
    color: #374151;
    font-weight: 600;
  }

  /* ── Footer ─────────────────────────────────────────── */
  .footer {
    background: #1e3a5f;
    color: white;
    padding: 6px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 8.5px;
  }
  .footer-left { opacity: 0.8; line-height: 1.6; }
  .footer-right { text-align: right; opacity: 0.9; line-height: 1.6; }

  /* ── NDVI badge row ─────────────────────────────────── */
  .ndvi-row {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    border-bottom: 1px solid #e5e7eb;
  }
  .ndvi-cell {
    padding: 4px 6px;
    text-align: center;
    font-size: 9px;
    font-weight: 600;
    color: white;
  }

  /* ── Print ──────────────────────────────────────────── */
  @media print {
    body { background: white; }
    .page { box-shadow: none; width: 100%; }
    .no-print { display: none !important; }
    @page { size: A3 landscape; margin: 6mm; }
  }
  .print-btn {
    position: fixed; top: 16px; right: 16px; z-index: 9999;
    background: #16a34a; color: white; border: none; border-radius: 8px;
    padding: 10px 20px; font-size: 13px; font-weight: 700; cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  }
  .print-btn:hover { background: #15803d; }
</style>
</head>
<body>

<button class="print-btn no-print" onclick="window.print()">🖨️ Print / Save PDF</button>

<div class="page">

  <!-- ══ HEADER ══════════════════════════════════════════ -->
  <div class="hdr">
    <div class="hdr-logo">🌱</div>
    <div class="hdr-title">
      <h1>Participatory Gram Panchayat–Level Climate Resilient Agriculture (CRA) Plan</h1>
      <h2>Uttarakhand Climate Resilient Rainfed Farming Project (UCRRFP) — CHANGE TechLab Agri Monitor</h2>
    </div>
    <div class="hdr-sub">
      <b>🗓️ ${today}</b>
      Sub-District: ${gp.block_hindi || gp.block}<br>
      District: ${gp.district_hindi || gp.district} | GP Code: ${gp.gp_code || '—'}
    </div>
  </div>

  <!-- GP Name Band -->
  <div class="gp-band">
    Satellite-Based Assessment Map — ${gp.name_hindi || gp.name}
    <span>Block: ${gp.block_hindi || gp.block} | District: ${gp.district_hindi || gp.district}, Uttarakhand</span>
  </div>

  <!-- Advisory / Metadata Bar -->
  <div style="background:#fffbeb; color:#92400e; padding:6px 12px; font-size:11px; font-weight:600; border-bottom:1px solid #fde68a; display:flex; justify-content:space-between; align-items:center;">
    <span>🛰️ <b>Satellite:</b> Sentinel-2 (L2A) | <b>DEM:</b> SRTM 30m | <b>Resolution:</b> 10m Pixel | <b>Assessment Year:</b> 2026</span>
    <span>⚠️ <b>Alert:</b> उच्च ढलान (>30%) और प्री-मानसून नमी तनाव वाला क्षेत्र — कंटूर बंडिंग और चाल-खाल प्राथमिकता।</span>
  </div>

  <!-- ══ MAP + INFO PANEL ══════════════════════════════ -->
  <div class="map-info-row">
    <div id="craReportMap"></div>

    <div class="info-panel">
      <!-- NDVI Legend -->
      <div class="info-section">
        <h4>🗺️ Legend</h4>
        <div class="legend-item"><div class="legend-box" style="background:#1a5276"></div> GP Boundary (Approx)</div>
        <div class="legend-item"><div class="legend-dot" style="background:#1e40af"></div> Settlements / Villages</div>
        <div class="legend-item"><div class="legend-box" style="background:#3b82f6;width:20px;height:4px"></div> Stream / Drainage (Synthetic)</div>
        <div class="legend-item" style="margin-top:6px"><b style="font-size:9px;color:#374151">NDVI — S2 B8(NIR 842nm) ÷ B4(Red 665nm)</b></div>
        <div class="legend-item"><div class="legend-box" style="background:#166534"></div> 0.6–1.0 (Very Good)</div>
        <div class="legend-item"><div class="legend-box" style="background:#86efac"></div> 0.4–0.6 (Good)</div>
        <div class="legend-item"><div class="legend-box" style="background:#fde68a"></div> 0.2–0.4 (Moderate)</div>
        <div class="legend-item"><div class="legend-box" style="background:#fb923c"></div> 0.0–0.2 (Poor)</div>
        <div class="legend-item"><div class="legend-box" style="background:#dc2626"></div> -0.3–0.0 (Very Poor)</div>
      </div>

      <!-- CRA Priority Zones -->
      <div class="info-section">
        <h4>CRA Priority Zones</h4>
        <div class="zone-item">
          <div class="zone-box" style="background:#ef4444"></div>
          <div class="zone-text"><div class="zone-name">High Risk / Degraded</div><div class="zone-desc">Low NDVI + High Slope + Erosion<br>Priority: Soil & Moisture Conservation</div></div>
        </div>
        <div class="zone-item">
          <div class="zone-box" style="background:#f59e0b"></div>
          <div class="zone-text"><div class="zone-name">Moderate Risk Zone</div><div class="zone-desc">Moderate NDVI + Rainfed Area<br>Priority: Crop Diversification, Mulching</div></div>
        </div>
        <div class="zone-item">
          <div class="zone-box" style="background:#22c55e"></div>
          <div class="zone-text"><div class="zone-name">Low Risk / Potential</div><div class="zone-desc">Higher NDVI + Moderate Slope<br>Priority: Climate-smart Intensification</div></div>
        </div>
        <div class="zone-item">
          <div class="zone-box" style="background:#3b82f6"></div>
          <div class="zone-text"><div class="zone-name">Water Conservation</div><div class="zone-desc">Springs + Drainage lines<br>Priority: Water Harvesting Structures</div></div>
        </div>
      </div>

      <!-- Location inset -->
      <div class="location-box">
        <b>📍 Location Map</b>
        Uttarakhand → Rudraprayag Dist.<br>
        Block: ${gp.block_hindi}<br>
        GP: ${gp.name_hindi}<br>
        📌 ${gp.lat.toFixed(4)}°N, ${gp.lng.toFixed(4)}°E
      </div>
    </div>
  </div>

  <!-- ══ GP AT A GLANCE ════════════════════════════════ -->
  <div class="stats-bar">📊 GP At A Glance</div>
  <div class="stats-row">
    <div class="stat-cell"><span class="stat-icon">🗺️</span><span class="stat-val">${Math.round(gp.agri_area_ha * 3.6)} ha</span><span class="stat-label">Total Area (est.)</span></div>
    <div class="stat-cell"><span class="stat-icon">🏘️</span><span class="stat-val">${gp.village_count}</span><span class="stat-label">Villages</span></div>
    <div class="stat-cell"><span class="stat-icon">🌾</span><span class="stat-val">${gp.agri_area_ha} ha</span><span class="stat-label">Agri Area</span></div>
    <div class="stat-cell"><span class="stat-icon">🌳</span><span class="stat-val">${gp.land_use?.forest_pct || 40}%</span><span class="stat-label">Forest Cover</span></div>
    <div class="stat-cell"><span class="stat-icon">🛰️</span><span class="stat-val">${gp.avg_ndvi}</span><span class="stat-label">Avg. NDVI</span></div>
    <div class="stat-cell"><span class="stat-icon">🌧️</span><span class="stat-val">${rainfall} mm</span><span class="stat-label">Rainfall (Avg.)</span></div>
    <div class="stat-cell"><span class="stat-icon">💧</span><span class="stat-val">${gp.total_springs || 5} / ${gp.active_springs || 2}</span><span class="stat-label">Springs (Total/Active)</span></div>
    <div class="stat-cell"><span class="stat-icon">🌱</span><span class="stat-val" style="font-size:11px;word-break:break-word;">${pCrops}</span><span class="stat-label">Dominant Crops</span></div>
  </div>

  <!-- ══ NDVI ZONE BAR ════════════════════════════════ -->
  <div class="ndvi-row">
    <div class="ndvi-cell" style="background:#dc2626">🔴 High Risk<br>${zones.high}% area</div>
    <div class="ndvi-cell" style="background:#f59e0b">🟡 Moderate<br>${zones.moderate}% area</div>
    <div class="ndvi-cell" style="background:#16a34a">🟢 Low Risk<br>${zones.low}% area</div>
    <div class="ndvi-cell" style="background:#2563eb">💧 Water Zone<br>${zones.water}% area</div>
    <div class="ndvi-cell" style="background:${overallColor}">⚠️ Overall CRA<br>${ovLevel} Priority</div>
  </div>

  <!-- ══ SLOPE, SCORES, & CONVERGENCE ══════════════════ -->
  <div class="analysis-row">
    <div class="slope-panel">
      <h4>⛰️ Slope Analysis (SRTM 30m)</h4>
      <div class="slope-chart-wrap">
        <svg width="180" height="180" viewBox="0 0 180 180">
          ${slopeSVG}
          <text x="90" y="84" text-anchor="middle" font-size="11" fill="#374151" font-weight="700">${avgSlopeDeg}</text>
          <text x="90" y="99" text-anchor="middle" font-size="9" fill="#6b7280">Avg. Slope</text>
        </svg>
        <div class="slope-legend">
          ${slope.map(d => `
          <div class="slope-leg-item">
            <div class="slope-leg-dot" style="background:${d.color}"></div>
            <span style="font-size:8.5px;color:#374151">${d.label.split('(')[0]}</span>
            <span class="slope-leg-pct">${d.pct}%</span>
          </div>
          <div style="font-size:8px;color:#9ca3af;margin-left:15px;margin-top:-2px;margin-bottom:1px">${d.ha} ha</div>`).join('')}
        </div>
      </div>
    </div>

    <div class="scores-panel">
      <h4>📊 CRA Priority Scores</h4>
      <table class="sc-table">
        <thead>
          <tr>
            <th style="text-align:left;padding:4px;font-size:9px;color:#6b7280;font-weight:600">Indicator</th>
            <th style="text-align:left;padding:4px;font-size:9px;color:#6b7280;font-weight:600">Severity</th>
            <th style="text-align:left;padding:4px;font-size:9px;color:#6b7280;font-weight:600">Risk Bar</th>
          </tr>
        </thead>
        <tbody>${scoreRows}</tbody>
      </table>
      <div class="overall-row">
        <span class="overall-label">🎯 Overall Priority</span>
        <span class="overall-val">${ovLevel} Risk</span>
      </div>
    </div>

    <div class="roadmap-panel">
      <h4>🛠️ Execution Roadmap & Convergence</h4>
      <div class="rd-step">
        <div class="rd-dot">1</div>
        <div class="rd-text"><b>प्री-मानसून (Pre-Monsoon):</b> चाल-खाल, कंटूर ट्रेंच और खेत तलाई का निर्माण।</div>
      </div>
      <div class="rd-step">
        <div class="rd-dot">2</div>
        <div class="rd-text"><b>मानसून (Monsoon):</b> चारागाह विकास, नेपियर घास व कृषि वानिकी रोपण।</div>
      </div>
      <div class="rd-step">
        <div class="rd-dot">3</div>
        <div class="rd-text"><b>पोस्ट-मानसून (Post-Monsoon):</b> उन्नत बीज वितरण व ड्रिप/मल्चिंग प्रदर्शन।</div>
      </div>

      <table class="conv-table">
        <thead>
          <tr>
            <th>Proposed Activity</th>
            <th>Units/Ha</th>
            <th>Est. Budget (₹)</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Water Harvesting / Farm Ponds</td>
            <td>4 Units</td>
            <td>4.50 L</td>
            <td>MGNREGA</td>
          </tr>
          <tr>
            <td>Contour Trenching</td>
            <td>12 Ha</td>
            <td>2.80 L</td>
            <td>UCRRFP</td>
          </tr>
          <tr>
            <td>Agroforestry / Orchards</td>
            <td>5 Ha</td>
            <td>1.25 L</td>
            <td>PMKSY</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- ══ INTERVENTIONS ════════════════════════════════ -->
  <div class="int-bar">🎯 Proposed CRA Interventions (Spatially Suggested — ${interventions.length} total)</div>
  <div class="int-grid">${interventionCards}</div>

  <!-- ══ HIMALAYAN SPECIFIC ═══════════════════════════ -->
  ${window.HimalayanCRA ? window.HimalayanCRA.renderHimalayanReportSection(gp, scores, interventions) : ''}

  <!-- ══ SIGNATURES ═══════════════════════════════════ -->
  <div class="sig-row">
    <div class="sig-box">
      ग्राम प्रधान / Gram Pradhan<br>
      <span style="font-weight:400;font-size:8px;color:#6b7280">Gram Panchayat: ${gp.name_hindi}</span>
    </div>
    <div class="sig-box">
      ग्राम पंचायत विकास अधिकारी (GPDO)<br>
      <span style="font-weight:400;font-size:8px;color:#6b7280">Panchayati Raj Dept, Uttarakhand</span>
    </div>
    <div class="sig-box">
      नोडल अधिकारी / Nodal Officer<br>
      <span style="font-weight:400;font-size:8px;color:#6b7280">UCRRFP / REAP, ${gp.district || 'Uttarakhand'}</span>
    </div>
  </div>

  <!-- ══ FOOTER ═══════════════════════════════════════ -->
  <div class="footer">
    <div class="footer-left">
      <b>DATA INTEGRATION:</b> Sentinel-2 (10m) Simulated | DEM: SRTM 30m | LGD Village Data | GP Baseline Survey<br>
      ⚠️ This is a participatory planning document. Field verification recommended before implementation.
    </div>
    <div class="footer-right">
      <b>CHANGE TechLab — Agri Monitor</b><br>
      Generated: ${today} | GP Code: ${gp.gp_code || 'N/A'} | Sub-District: ${gp.sub_district_code}
    </div>
  </div>

</div><!-- /page -->

<script>
  // ── Initialize Leaflet Map ──────────────────────────
  const craReportMap = L.map('craReportMap', {
    center: [${gp.lat}, ${gp.lng}],
    zoom: 14,
    zoomControl: true,
    attributionControl: false,
  });

  // Base tile
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 18, opacity: 0.85
  }).addTo(craReportMap);

  const gpLat = ${gp.lat};
  const gpLng = ${gp.lng};
  const ndvi  = ${gp.avg_ndvi};
  const agriHa = ${gp.agri_area_ha};


  // ── GP Boundary (real or synthetic fallback) ────────
  ${gpBoundaryScript}

  // ── Synthetic Drainage Line ─────────────────────────
  const drainPts = [
    [gpLat + 0.015, gpLng - 0.012],
    [gpLat + 0.005, gpLng - 0.002],
    [gpLat - 0.002, gpLng + 0.002],
    [gpLat - 0.010, gpLng + 0.015],
    [gpLat - 0.018, gpLng + 0.020]
  ];
  L.polyline(drainPts, {
    color: '#3b82f6', weight: 4, opacity: 0.9, lineCap: 'round', lineJoin: 'round'
  }).addTo(craReportMap);

  // ── Village markers ───────────────────────────────
  ${villageMarkers}

  // ── Water source markers ──────────────────────────
  ${waterMarkers}

  // ── GP center label ───────────────────────────────
  L.marker([${gp.lat}, ${gp.lng}], {
    icon: L.divIcon({
      html: '<div style="background:#14532d;color:white;padding:3px 8px;border-radius:6px;font-size:10px;font-weight:700;white-space:nowrap;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${gp.name_hindi}</div>',
      className: '', iconAnchor: [40, 12]
    })
  }).addTo(craReportMap);

  // ── Scale bar ───────────────────────
  L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(craReportMap);

  // Redraw map after load
  setTimeout(() => craReportMap.invalidateSize(), 400);
</script>
</body>
</html>`;
  }

  /* ══════════════════════════════════════════════════════════
     PUBLIC API — async generate with real GP polygon
  ══════════════════════════════════════════════════════════ */
  async function generate(gp, scores, interventions) {
    if (!gp || !scores) {
      alert('पहले GP select करें और CRA Analysis चलाएं');
      return;
    }

    // ── Try to fetch real GP polygon from GeoJSON file ─────
    let gpGeoJSON = null;
    const DISTRICT_FILE_MAP = {
      'Almora':'almora','Bageshwar':'bageshwar','Chamoli':'chamoli',
      'Champawat':'champawat','Dehradun':'dehradun','Haridwar':'haridwar',
      'Nainital':'nainital','Pauri Garhwal':'pauri_garhwal',
      'Pithoragarh':'pithoragarh','Rudra Prayag':'rudra_prayag',
      'Tehri Garhwal':'tehri_garhwal','Udam Singh Nagar':'udam_singh_nagar',
      'Uttar Kashi':'uttar_kashi'
    };
    const slug = DISTRICT_FILE_MAP[gp.district];
    if (slug && gp.gp_code) {
      try {
        const resp = await fetch(`data/gp_boundaries/${slug}_gp.geojson`);
        if (resp.ok) {
          const fc = await resp.json();
          const feat = fc.features.find(f =>
            String(f.properties.gp_code) === String(gp.gp_code) ||
            String(f.properties.gpcode)  === String(gp.gp_code)
          );
          if (feat) gpGeoJSON = feat;
        }
      } catch(e) { console.warn('[CRAReport] GeoJSON fetch failed:', e); }
    }

    const html = buildHTML(gp, scores, interventions || [], gpGeoJSON);
    const blob = new Blob(['\uFEFF' + html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank');
    if (!win) alert('Popup blocked! Browser में popup allow करें।');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  return { generate };

})();
