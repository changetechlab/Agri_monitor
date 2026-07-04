/**
 * utils.js — Agri Monitor MRV Utilities
 * CHANGE TechLab | Uttarakhand
 *
 * Provides: ID generation, validation, formatting, geo utilities
 */

'use strict';

const MRVUtils = (() => {

  // ─── ID Generation ───────────────────────────────────────────
  // Format: CTL-MRV-UK-RPG-2026-000001
  // CTL = CHANGE TechLab | MRV = Module | UK = State
  // RPG = Project Code | YYYY = Year | NNNNNN = Sequential

  const PROJECT_CODES = {
    rudraprayag:   'RPG',
    tehri:         'TRG',
    chamoli:       'CML',
    uttarkashi:    'UTK',
    almora:        'ALM',
    pithoragarh:   'PTH',
    pauri:         'PGW',
    haridwar:      'HDW',
    dehradun:      'DDN',
    default:       'UKD'
  };

  const BLOCK_CODES = {
    Ukhimath: 'UKM', Jakholi: 'JKL', Augustyamuni: 'AGM',
    Pratapnagar: 'PRT', Kirtinagar: 'KRT', Jaunpur: 'JNP',
    Jhakhanidhar: 'JKD', Bhilangana: 'BLG', Narendranagar: 'NRN',
    Thauldhar: 'TLD', Devprayag: 'DVP', Chamba: 'CHB'
  };

  function generateMRVId(district = 'rudraprayag', existingCount = 0) {
    const year  = new Date().getFullYear();
    const proj  = PROJECT_CODES[district.toLowerCase()] || PROJECT_CODES.default;
    const seq   = String(existingCount + 1).padStart(6, '0');
    return `CTL-MRV-UK-${proj}-${year}-${seq}`;
  }

  function generateAuditId() {
    return `AUD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }

  // ─── Validation ──────────────────────────────────────────────

  function validatePhone(phone) {
    return /^[6-9]\d{9}$/.test(phone.replace(/\s/g, ''));
  }

  function validateAadhaarLast4(val) {
    return /^\d{4}$/.test(val);
  }

  function validateCoords(lat, lng) {
    const la = parseFloat(lat), lo = parseFloat(lng);
    return !isNaN(la) && !isNaN(lo) &&
      la >= 8 && la <= 38 &&     // India latitude range
      lo >= 68 && lo <= 98;      // India longitude range
  }

  function validatePolygon(coords) {
    return Array.isArray(coords) && coords.length >= 3;
  }

  // ─── Area Calculation ────────────────────────────────────────

  // Shoelace / Haversine-based geodesic area in m²
  function calcPolygonArea(latlngs) {
    if (!latlngs || latlngs.length < 3) return 0;
    const R = 6378137;
    let area = 0;
    for (let i = 0, j = latlngs.length - 1; i < latlngs.length; j = i++) {
      const xi = latlngs[i].lng * Math.PI / 180;
      const xj = latlngs[j].lng * Math.PI / 180;
      const yi = latlngs[i].lat * Math.PI / 180;
      const yj = latlngs[j].lat * Math.PI / 180;
      area += (xj - xi) * (2 + Math.sin(yi) + Math.sin(yj));
    }
    return Math.abs(area * R * R / 2);
  }

  function sqmToHectares(sqm) { return sqm / 10000; }
  function sqmToAcres(sqm)    { return sqm / 4046.86; }
  function sqmToBigha(sqm)    { return sqm / 2529.29; }  // Uttarakhand Bigha

  function formatArea(sqm) {
    const ha   = sqmToHectares(sqm);
    const acre = sqmToAcres(sqm);
    const bgh  = sqmToBigha(sqm);
    return {
      sqm:    Math.round(sqm),
      ha:     +ha.toFixed(4),
      acres:  +acre.toFixed(3),
      bigha:  +bgh.toFixed(2),
      display: `${ha.toFixed(3)} ha  |  ${acre.toFixed(2)} acres  |  ${bgh.toFixed(1)} बीघा`
    };
  }

  // ─── GeoJSON Helpers ─────────────────────────────────────────

  function latlngsToGeoJSON(latlngs, properties = {}) {
    if (!latlngs || latlngs.length < 3) return null;
    const coords = latlngs.map(ll => [
      parseFloat((ll.lng || ll[1]).toFixed(7)),
      parseFloat((ll.lat || ll[0]).toFixed(7))
    ]);
    coords.push(coords[0]); // close ring
    return {
      type: 'Feature',
      properties,
      geometry: {
        type: 'Polygon',
        coordinates: [coords]
      }
    };
  }

  function parseGeoJSONPolygon(geojson) {
    try {
      const g = typeof geojson === 'string' ? JSON.parse(geojson) : geojson;
      const coords = g.geometry?.coordinates?.[0] || g.coordinates?.[0];
      if (!coords) return null;
      return coords.map(c => ({ lat: c[1], lng: c[0] }));
    } catch { return null; }
  }

  // ─── Formatting ──────────────────────────────────────────────

  function formatDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('hi-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function formatDateISO(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.toISOString().split('T')[0];
  }

  function formatDateTime() {
    return new Date().toISOString();
  }

  function formatCurrency(amount, symbol = '₹') {
    return `${symbol}${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  }

  function formatTCO2(val) {
    return `${Number(val).toFixed(3)} tCO₂e`;
  }

  // ─── File helpers ────────────────────────────────────────────

  function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    _triggerDownload(blob, filename);
  }

  function downloadGeoJSON(geojson, filename) {
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
    _triggerDownload(blob, filename);
  }

  function downloadCSV(rows, headers, filename) {
    const lines = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))];
    const blob  = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    _triggerDownload(blob, filename);
  }

  function _triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a   = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
  }

  // ─── Geolocation ─────────────────────────────────────────────

  function getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        err => reject(err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  // ─── Misc ─────────────────────────────────────────────────────

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function debounce(fn, ms = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  function sanitize(str) {
    return String(str || '').replace(/[<>"'&]/g, c =>
      ({ '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":"&#x27;", '&':'&amp;' }[c]));
  }

  function getBlockCode(block) {
    return BLOCK_CODES[block] || 'UNK';
  }

  function getProjectCode(district) {
    return PROJECT_CODES[district?.toLowerCase()] || PROJECT_CODES.default;
  }

  // ─── Public API ───────────────────────────────────────────────

  return {
    generateMRVId,
    generateAuditId,
    validatePhone,
    validateAadhaarLast4,
    validateCoords,
    validatePolygon,
    calcPolygonArea,
    sqmToHectares,
    sqmToAcres,
    sqmToBigha,
    formatArea,
    latlngsToGeoJSON,
    parseGeoJSONPolygon,
    formatDate,
    formatDateISO,
    formatDateTime,
    formatCurrency,
    formatTCO2,
    downloadJSON,
    downloadGeoJSON,
    downloadCSV,
    getCurrentPosition,
    deepClone,
    debounce,
    sanitize,
    getBlockCode,
    getProjectCode,
    PROJECT_CODES,
    BLOCK_CODES
  };

})();

window.MRVUtils = MRVUtils;
