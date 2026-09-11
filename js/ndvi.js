/**
 * Agri Monitor -- js/ndvi.js
 * Multi-Index Satellite Visualization
 * Supports: NDVI, NDRE, NDWI, NDBI (via SatelliteEngine)
 *
 * DATA SOURCE: EOX Sentinel-2 Cloudless 2020 (RGB tiles -- no individual bands)
 * Real per-pixel index computation requires GEE or TiTiler (see satellite-engine.js).
 * Field polygon coloring uses SIMULATED values (clearly labelled in UI).
 *
 * Preserves all existing exports for backward compatibility:
 *   showSentinel, showNDVI, toggle, setOpacity, setDate,
 *   renderColorLegend, startDateComparison, stopDateComparison,
 *   ndviToRgb, startTimelapse, stopTimelapse, getActiveDate, getCurrentMode
 *
 * New exports: showIndex, setActiveIndex, getActiveIndex
 *
 * Exposes: window.AgriNDVI
 */

window.AgriNDVI = (() => {
  let tileLayer    = null;
  let compareLayer = null;
  let activeDate   = new Date().toISOString().slice(0, 10);
  let opacity      = 0.8;
  let currentMode  = 'sentinel';   // 'sentinel' | 'index' | 'off'
  let activeIndex  = 'ndvi';       // currently selected index type
  let isVisible    = false;

  // Sentinel tile URL (unchanged from original)
  const EOX_URL = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg';

  // ============================================================
  // ENGINE SAFETY WRAPPER
  // SatelliteEngine loads before this file; guard for dev reloads
  // ============================================================
  function eng() {
    if (!window.SatelliteEngine) {
      console.error('[NDVI] SatelliteEngine not loaded. Check script order in index.html.');
      return null;
    }
    return window.SatelliteEngine;
  }

  // ============================================================
  // BACKWARD-COMPAT: ndviToRgb (delegates to engine)
  // ============================================================
  function ndviToRgb(value) {
    const e = eng();
    return e ? e.getColorForValue('ndvi', value) : { r: 128, g: 128, b: 128 };
  }

  // ============================================================
  // TILE LAYER MANAGEMENT
  // ============================================================
  function setTileLayer(url, options = {}) {
    const m = window.AgriMap && window.AgriMap.getMap();
    if (!m) return;
    if (tileLayer) { m.removeLayer(tileLayer); tileLayer = null; }
    tileLayer = L.tileLayer(url, {
      opacity,
      maxZoom: 18,
      attribution: options.attribution || '© EOX / ESA Sentinel-2',
      crossOrigin: true,
      ...options
    });
    tileLayer.addTo(m);
    isVisible = true;
  }

  // ============================================================
  // SENTINEL-2 RGB (base visual -- unchanged from original)
  // ============================================================
  function showSentinel() {
    currentMode = 'sentinel';
    setTileLayer(EOX_URL, {
      attribution: '© <a href="https://eox.at">EOX</a> -- Sentinel-2 Cloudless 2020'
    });
    updateUI();
  }

  // ============================================================
  // SHOW INDEX (generic -- replaces showNDVI internally)
  // ============================================================
  function showIndex(indexType, date) {
    const e = eng();
    if (!e) return;
    if (date) activeDate = date;
    if (indexType) activeIndex = indexType;
    currentMode = 'index';

    const url  = e.getTileUrl(activeIndex, activeDate);
    const cfg  = e.getConfig(activeIndex) || {};
    const cap  = e.getIndexCapability(activeIndex);

    setTileLayer(url, {
      attribution: cap.available
        ? '© Sentinel-2 ' + cfg.name + ' via GEE/TiTiler'
        : '© EOX Sentinel-2 Cloudless (visual proxy -- ' + cfg.name + ' requires band source)'
    });

    updateUI();
    renderColorLegend();
    renderLegendRanges();
    updateCapabilityNotice();
  }

  // ============================================================
  // BACKWARD COMPAT: showNDVI
  // ============================================================
  function showNDVI(date) {
    showIndex('ndvi', date);
  }

  // ============================================================
  // TOGGLE VISIBILITY
  // ============================================================
  function toggle(visible) {
    const m = window.AgriMap && window.AgriMap.getMap();
    if (!m) return;
    if (!visible) {
      if (tileLayer) { m.removeLayer(tileLayer); isVisible = false; }
    } else {
      if (currentMode === 'index') showIndex(activeIndex, activeDate);
      else showSentinel();
    }
  }

  // ============================================================
  // OPACITY
  // ============================================================
  function setOpacity(value) {
    opacity = parseFloat(value);
    if (tileLayer) tileLayer.setOpacity(opacity);
  }

  // ============================================================
  // DATE
  // ============================================================
  function setDate(date) {
    activeDate = date;
    if (currentMode === 'index' && isVisible) showIndex(activeIndex, date);
    const el = document.getElementById('ndvi-date-display');
    if (el) el.textContent = formatDate(date);
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('hi-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // ============================================================
  // SET ACTIVE INDEX (called by selector)
  // ============================================================
  function setActiveIndex(indexType) {
    activeIndex = indexType;
    if (currentMode === 'index') showIndex(indexType, activeDate);
    renderColorLegend();
    renderLegendRanges();
    updateCapabilityNotice();
    updateIndexDescription();
  }

  // ============================================================
  // RENDER COLORMAP LEGEND BAR (canvas)
  // ============================================================
  function renderColorLegend() {
    const e = eng();
    if (!e) return;
    const canvas = document.getElementById('ndvi-color-scale');
    if (!canvas) return;
    e.renderColormapToCanvas(activeIndex, canvas);
  }

  // ============================================================
  // RENDER LEGEND RANGE ROWS
  // ============================================================
  function renderLegendRanges() {
    const e = eng();
    if (!e) return;
    const container = document.getElementById('index-legend-ranges');
    if (!container) return;

    const ranges = e.getLegendRanges(activeIndex);
    container.innerHTML = '';
    ranges.forEach(r => {
      const row = document.createElement('div');
      row.className = 'index-legend-row';
      row.innerHTML =
        '<span class="index-legend-swatch" style="background:' + r.color + '"></span>' +
        '<span class="index-legend-label">' + r.labelHi + '</span>' +
        '<span class="index-legend-range">' + r.label + '</span>';
      container.appendChild(row);
    });
  }

  // ============================================================
  // UPDATE INDEX DESCRIPTION ROW
  // ============================================================
  function updateIndexDescription() {
    const e = eng();
    if (!e) return;
    const cfg = e.getConfig(activeIndex);
    if (!cfg) return;

    const formulaEl = document.getElementById('index-formula');
    const bandEl    = document.getElementById('index-band-detail');
    const descEl    = document.getElementById('index-description');

    if (formulaEl) formulaEl.textContent = cfg.formula;
    if (bandEl)    bandEl.textContent    = cfg.bandDetail;
    if (descEl)    descEl.textContent    = cfg.descriptionHi;
  }

  // ============================================================
  // UPDATE CAPABILITY NOTICE
  // ============================================================
  function updateCapabilityNotice() {
    const e = eng();
    if (!e) return;
    const notice = document.getElementById('index-capability-notice');
    if (!notice) return;

    const cap = e.getIndexCapability(activeIndex);
    const cfg = e.getConfig(activeIndex) || {};

    if (cap.available && cfg.dataStatus === 'available') {
      // NDVI with simulation -- show simulation notice
      notice.style.display = 'block';
      notice.className = 'index-capability-notice notice-sim';
      notice.innerHTML =
        '<strong>📊 DEMO / SIMULATED</strong> — ' +
        'खेत के रंग real satellite data नहीं हैं। ' +
        'GEE/TiTiler connect होने पर real pixel-level ' + cfg.name + ' उपलब्ध होगा।';
    } else if (!cap.available) {
      // Requires band source
      notice.style.display = 'block';
      notice.className = 'index-capability-notice notice-warn';
      notice.innerHTML =
        '<strong>⚠️ DEMO / SIMULATED</strong> — ' +
        cfg.name + ' के लिए Sentinel-2 bands (' +
        (cfg.requiredBands || []).join(', ') + ') चाहिए। ' +
        'वर्तमान source (EOX RGB) इन bands को provide नहीं करता। ' +
        'GEE या TiTiler configure करें।';
    } else {
      notice.style.display = 'none';
    }
  }

  // ============================================================
  // UPDATE UI (mode label + date)
  // ============================================================
  function updateUI() {
    const e = eng();
    const cfg = e ? e.getConfig(activeIndex) : null;

    const modeLabel = document.getElementById('satellite-mode-label');
    if (modeLabel) {
      modeLabel.textContent = currentMode === 'index'
        ? '🛰️ ' + (cfg ? cfg.name + ' मोड' : 'Index मोड')
        : '🛰️ Sentinel-2 मोड';
    }
    const dateDisplay = document.getElementById('ndvi-date-display');
    if (dateDisplay) dateDisplay.textContent = formatDate(activeDate);
  }

  // ============================================================
  // DATE COMPARISON (unchanged from original)
  // ============================================================
  function startDateComparison(date1, date2) {
    const m = window.AgriMap && window.AgriMap.getMap();
    if (!m) return;
    showIndex(activeIndex, date1);
    if (compareLayer) m.removeLayer(compareLayer);
    const e = eng();
    compareLayer = L.tileLayer(e ? e.getTileUrl(activeIndex, date2) : EOX_URL, {
      opacity: 0.5,
      attribution: '© Sentinel-2 ' + activeIndex.toUpperCase() + ' ' + date2
    });
    compareLayer.addTo(m);
    const label = document.getElementById('compare-label');
    if (label) label.innerHTML =
      '<span style="color:#22c55e">📅 ' + formatDate(date1) + '</span> &rarr; ' +
      '<span style="color:#f59e0b">📅 ' + formatDate(date2) + '</span>';
  }

  function stopDateComparison() {
    const m = window.AgriMap && window.AgriMap.getMap();
    if (compareLayer && m) { m.removeLayer(compareLayer); compareLayer = null; }
    const label = document.getElementById('compare-label');
    if (label) label.innerHTML = '';
  }

  // ============================================================
  // TIME-LAPSE (extended to handle all indices)
  // ============================================================
  let timelapseInterval = null;
  let timelapseIndex    = 0;
  const TIMELAPSE_DATES = [
    '2025-12-01', '2026-01-01', '2026-02-01',
    '2026-03-01', '2026-04-01', '2026-05-01'
  ];

  function startTimelapse() {
    if (timelapseInterval) stopTimelapse();

    // Switch to index mode
    const btnIdx = document.getElementById('btn-index');
    if (btnIdx && !btnIdx.classList.contains('active')) btnIdx.click();

    const playBtn    = document.getElementById('btn-timelapse-play');
    const stopBtn    = document.getElementById('btn-timelapse-stop');
    const statusText = document.getElementById('time-lapse-status');
    const speedSel   = document.getElementById('timelapse-speed');

    if (playBtn)    playBtn.disabled = true;
    if (stopBtn)    stopBtn.disabled = false;
    if (statusText) { statusText.textContent = '▶️ Playing…'; statusText.style.color = '#22c55e'; }

    const intervalMs = speedSel ? parseInt(speedSel.value) : 1000;
    timelapseIndex = 0;

    const tick = () => {
      if (timelapseIndex >= TIMELAPSE_DATES.length) timelapseIndex = 0;
      const currentDate = TIMELAPSE_DATES[timelapseIndex];
      setDate(currentDate);
      const dp = document.getElementById('ndvi-date');
      if (dp) dp.value = currentDate;
      const progress = document.getElementById('timelapse-progress');
      if (progress) progress.style.width = (((timelapseIndex + 1) / TIMELAPSE_DATES.length) * 100) + '%';
      simulateFieldIndexForDate(currentDate);
      timelapseIndex++;
    };

    tick();
    timelapseInterval = setInterval(tick, intervalMs);
  }

  function stopTimelapse() {
    if (timelapseInterval) { clearInterval(timelapseInterval); timelapseInterval = null; }
    const playBtn    = document.getElementById('btn-timelapse-play');
    const stopBtn    = document.getElementById('btn-timelapse-stop');
    const statusText = document.getElementById('time-lapse-status');
    const progress   = document.getElementById('timelapse-progress');
    if (playBtn)    playBtn.disabled  = false;
    if (stopBtn)    stopBtn.disabled  = true;
    if (statusText) { statusText.textContent = '⏹️ Stopped'; statusText.style.color = '#eab308'; }
    if (progress)   progress.style.width = '0%';
    if (window.AgriFarmers) window.AgriFarmers.loadData().catch(() => {});
  }

  // ============================================================
  // FIELD SIMULATION (DEMO -- NOT satellite-derived)
  // Extended from original simulateFieldNdviForDate to handle all indices
  // ============================================================
  function simulateFieldIndexForDate(dateStr) {
    if (!window.AgriFarmers) return;
    const e = eng();
    if (!e) return;

    const fields = window.AgriFarmers.getFields();
    const month  = parseInt(dateStr.split('-')[1]);

    fields.forEach(field => {
      const seed = field.id ? parseInt(field.id.replace(/\D/g, '')) || 5 : 5;
      const val  = e.simulateValue(activeIndex, seed, month);
      const cls  = e.classifyValue(activeIndex, val);

      // Always update NDVI for health_status (backward compat with field cards)
      field.last_ndvi_value = activeIndex === 'ndvi'
        ? val
        : e.simulateValue('ndvi', seed, month);
      field.health_status = cls;

      // Store index-specific value
      field['last_' + activeIndex + '_value'] = val;
    });

    window.AgriFarmers.showFieldsOnMap();
    window.AgriFarmers.updateStats();
  }

  // Backward-compat alias used by timelapse originally
  function simulateFieldNdviForDate(dateStr) {
    simulateFieldIndexForDate(dateStr);
  }

  // ============================================================
  // INIT CONTROLS
  // ============================================================
  function initControls() {
    // --- Sentinel-2 button (unchanged) ---
    const btnSentinel = document.getElementById('btn-sentinel');
    if (btnSentinel) {
      btnSentinel.addEventListener('click', () => {
        document.querySelectorAll('.satellite-mode-btn').forEach(b => b.classList.remove('active'));
        btnSentinel.classList.add('active');
        showSentinel();
        // Hide capability notice when on plain Sentinel view
        const notice = document.getElementById('index-capability-notice');
        if (notice) notice.style.display = 'none';
      });
    }

    // --- Backward-compat: old btn-ndvi button (may still exist in HTML during transition) ---
    const btnNDVILegacy = document.getElementById('btn-ndvi');
    if (btnNDVILegacy) {
      btnNDVILegacy.addEventListener('click', () => {
        document.querySelectorAll('.satellite-mode-btn').forEach(b => b.classList.remove('active'));
        btnNDVILegacy.classList.add('active');
        setActiveIndex('ndvi');
        showIndex('ndvi', activeDate);
      });
    }

    // --- New: Index button ---
    const btnIndex = document.getElementById('btn-index');
    if (btnIndex) {
      btnIndex.addEventListener('click', () => {
        document.querySelectorAll('.satellite-mode-btn').forEach(b => b.classList.remove('active'));
        btnIndex.classList.add('active');
        showIndex(activeIndex, activeDate);
      });
    }

    // --- Index Selector dropdown ---
    const selector = document.getElementById('index-selector');
    if (selector) {
      selector.value = activeIndex;
      selector.addEventListener('change', () => {
        setActiveIndex(selector.value);
        // Auto-switch to index mode if on sentinel
        if (currentMode !== 'index') {
          if (btnIndex) btnIndex.click();
          else showIndex(selector.value, activeDate);
        }
      });
    }

    // --- Date picker ---
    const datePicker = document.getElementById('ndvi-date');
    if (datePicker) {
      datePicker.value = activeDate;
      datePicker.max   = new Date().toISOString().slice(0, 10);
      datePicker.addEventListener('change', () => setDate(datePicker.value));
    }

    // --- Opacity slider ---
    const opacitySlider = document.getElementById('ndvi-opacity');
    const opacityValue  = document.getElementById('ndvi-opacity-value');
    if (opacitySlider) {
      opacitySlider.value = opacity;
      opacitySlider.addEventListener('input', () => {
        setOpacity(opacitySlider.value);
        if (opacityValue) opacityValue.textContent = Math.round(opacitySlider.value * 100) + '%';
      });
    }

    // --- Date comparison ---
    const compareBtn  = document.getElementById('btn-compare-dates');
    const cDate1      = document.getElementById('compare-date1');
    const cDate2      = document.getElementById('compare-date2');
    const stopCmpBtn  = document.getElementById('btn-stop-compare');
    if (compareBtn)  compareBtn.addEventListener('click',  () => { if (cDate1 && cDate2) startDateComparison(cDate1.value, cDate2.value); });
    if (stopCmpBtn)  stopCmpBtn.addEventListener('click',  stopDateComparison);

    const today = new Date();
    const minus30 = new Date(today.getTime() - 30 * 86400000);
    if (cDate1) cDate1.value = minus30.toISOString().slice(0, 10);
    if (cDate2) cDate2.value = today.toISOString().slice(0, 10);

    // --- Timelapse ---
    const playBtn = document.getElementById('btn-timelapse-play');
    const stopBtn = document.getElementById('btn-timelapse-stop');
    if (playBtn) playBtn.addEventListener('click', startTimelapse);
    if (stopBtn) stopBtn.addEventListener('click', stopTimelapse);

    // --- Initialize UI ---
    setTimeout(() => {
      showSentinel();
      renderColorLegend();
      renderLegendRanges();
      updateIndexDescription();
      updateCapabilityNotice();
    }, 500);
  }

  // ============================================================
  // PUBLIC API
  // ============================================================
  return {
    // Init
    init: initControls,

    // Existing exports (unchanged)
    showSentinel,
    showNDVI,
    toggle,
    setOpacity,
    setDate,
    renderColorLegend,
    startDateComparison,
    stopDateComparison,
    ndviToRgb,
    startTimelapse,
    stopTimelapse,
    getActiveDate:  () => activeDate,
    getCurrentMode: () => currentMode,

    // New exports
    showIndex,
    setActiveIndex,
    getActiveIndex: () => activeIndex,
    simulateFieldIndexForDate,
    simulateFieldNdviForDate,  // backward compat
  };
})();
