/**
 * Agri Monitor -- js/ndvi.js
 * Multi-Index Satellite Visualization
 * Supports: NDVI, NDRE, NDWI, NDBI (via SatelliteEngine)
 *
 * DATA:
 *   REAL: /api/gee-tiles (Vercel) -> GEE -> S2_SR_HARMONIZED -> SCL mask -> index
 *   FALLBACK: EOX Sentinel-2 Cloudless 2020 (RGB composite, no individual bands)
 *   FIELD POLYGONS: DEMO/SIMULATED values (clearly labelled)
 *
 * All existing exports preserved for backward compatibility.
 * New: showIndex() is async; fetchTileUrl() used from SatelliteEngine.
 *
 * Exposes: window.AgriNDVI
 */

window.AgriNDVI = (() => {
  let tileLayer    = null;
  let compareLayer = null;
  let activeDate   = new Date().toISOString().slice(0, 10);
  let opacity      = 0.8;
  let currentMode  = 'sentinel';   // 'sentinel' | 'index' | 'off'
  let activeIndex  = 'ndvi';
  let isVisible    = false;
  let _lastGEEMeta = null;         // metadata from last successful GEE response

  const EOX_URL = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg';

  // ============================================================
  // ENGINE WRAPPER
  // ============================================================
  function eng() {
    if (!window.SatelliteEngine) {
      console.error('[NDVI] SatelliteEngine not loaded.');
      return null;
    }
    return window.SatelliteEngine;
  }

  // ============================================================
  // BACKWARD-COMPAT: ndviToRgb
  // ============================================================
  function ndviToRgb(value) {
    const e = eng();
    return e ? e.getColorForValue('ndvi', value) : { r: 128, g: 128, b: 128 };
  }

  // ============================================================
  // LOADING STATE
  // ============================================================
  function setLoadingState(loading) {
    const spinner  = document.getElementById('sat-loading-spinner');
    const btnIndex = document.getElementById('btn-index');
    if (spinner) spinner.style.display = loading ? 'flex' : 'none';
    if (btnIndex) btnIndex.disabled = loading;
  }

  // ============================================================
  // TILE LAYER MANAGEMENT
  // ============================================================
  function setTileLayer(url, options) {
    const m = window.AgriMap && window.AgriMap.getMap();
    if (!m) return;
    if (tileLayer) { m.removeLayer(tileLayer); tileLayer = null; }
    tileLayer = L.tileLayer(url, {
      opacity,
      maxZoom: 18,
      attribution: (options && options.attribution) || '© EOX / ESA Sentinel-2',
      crossOrigin: true,
    });
    tileLayer.addTo(m);
    isVisible = true;
  }

  // ============================================================
  // SENTINEL-2 RGB (unchanged base visual)
  // ============================================================
  function showSentinel() {
    currentMode = 'sentinel';
    setTileLayer(EOX_URL, { attribution: '© <a href="https://eox.at">EOX</a> — Sentinel-2 Cloudless 2020' });
    updateUI();
    _hideTileSourceBadge();
    const notice = document.getElementById('index-capability-notice');
    if (notice) notice.style.display = 'none';
  }

  // ============================================================
  // SHOW INDEX -- ASYNC (core new function)
  // Fetches real GEE tiles; falls back to EOX if unavailable
  // ============================================================
  async function showIndex(indexType, date) {
    const e = eng();
    if (!e) return;
    if (date) activeDate = date;
    if (indexType) activeIndex = indexType;
    currentMode = 'index';

    setLoadingState(true);
    updateUI();
    renderColorLegend();
    renderLegendRanges();
    updateIndexDescription();

    try {
      const result = await e.fetchTileUrl(activeIndex, activeDate);

      if (result && result.tileUrl) {
        const isReal = result.isReal === true;
        _lastGEEMeta = result;

        setTileLayer(result.tileUrl, {
          attribution: isReal
            ? '© GEE / ESA Copernicus — Sentinel-2 L2A | SCL masked'
            : '© EOX Sentinel-2 Cloudless 2020 (RGB proxy — ' + activeIndex.toUpperCase() + ' requires band source)',
        });

        _updateTileSourceBadge(isReal, result);
        updateCapabilityNotice(isReal, result);
        _updateAcquiredDateDisplay(isReal, result);

      } else {
        // No imagery for this date — keep current tile, show info
        const meta = (result && result.meta) || {};
        _updateNoImageryState(meta.message || 'कोई imagery नहीं मिली इस दिनांक के लिए।');
        updateCapabilityNotice(false, result);
      }
    } catch (err) {
      console.warn('[NDVI] showIndex error:', err.message);
      // EOX fallback
      setTileLayer(EOX_URL, { attribution: '© EOX Sentinel-2 Cloudless 2020 (fallback)' });
      updateCapabilityNotice(false, null);
    } finally {
      setLoadingState(false);
    }
  }

  // ============================================================
  // BACKWARD COMPAT: showNDVI
  // ============================================================
  function showNDVI(date) { return showIndex('ndvi', date); }

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
  // SET ACTIVE INDEX
  // ============================================================
  function setActiveIndex(indexType) {
    activeIndex = indexType;
    if (currentMode === 'index') showIndex(indexType, activeDate);
    renderColorLegend();
    renderLegendRanges();
    updateCapabilityNotice(false, null);
    updateIndexDescription();
  }

  // ============================================================
  // COLORMAP LEGEND BAR (canvas)
  // ============================================================
  function renderColorLegend() {
    const e = eng();
    if (!e) return;
    const canvas = document.getElementById('ndvi-color-scale');
    if (!canvas) return;
    e.renderColormapToCanvas(activeIndex, canvas);
  }

  // ============================================================
  // LEGEND RANGE ROWS
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
  // INDEX DESCRIPTION
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
  // CAPABILITY / DATA-SOURCE NOTICE
  // ============================================================
  function updateCapabilityNotice(isReal, result) {
    const e = eng();
    if (!e) return;
    const notice = document.getElementById('index-capability-notice');
    if (!notice) return;
    const cfg = e.getConfig(activeIndex) || {};

    if (isReal) {
      // Real GEE data -- show green badge (handled by _updateTileSourceBadge)
      notice.style.display = 'none';
    } else if (result && result.meta && result.meta.error === 'no_imagery') {
      notice.style.display = 'block';
      notice.className = 'index-capability-notice notice-warn';
      notice.innerHTML =
        '<strong>📅 कोई imagery नहीं</strong> — ' +
        (result.meta.message || 'इस दिनांक के लिए cloud-free Sentinel-2 imagery उपलब्ध नहीं।') +
        ' दूसरा दिनांक चुनें।';
    } else {
      notice.style.display = 'block';
      notice.className = 'index-capability-notice notice-sim';
      notice.innerHTML =
        '<strong>📊 DEMO / SIMULATED</strong> — ' +
        'खेत के रंग real satellite data नहीं हैं। ' +
        'GEE configured होने के बाद real ' + cfg.name + ' tiles load होंगे।';
    }
  }

  // ============================================================
  // TILE SOURCE BADGE (REAL SATELLITE DATA indicator)
  // ============================================================
  function _updateTileSourceBadge(isReal, result) {
    const badge = document.getElementById('sat-data-source-badge');
    if (!badge) return;

    if (isReal && result) {
      badge.style.display = 'flex';
      badge.className = 'sat-data-badge badge-real';
      const dateStr = result.acquiredDate
        ? ' | ' + result.acquiredDate + (result.windowDays > 15 ? ' (±30d)' : ' (±15d)')
        : '';
      const imgCount = result.imageCount ? ' | ' + result.imageCount + ' images' : '';
      badge.innerHTML =
        '<span class="badge-dot"></span>' +
        '<span>✅ Real Satellite Data — S2 L2A | SCL masked' + dateStr + imgCount + '</span>';
    } else {
      badge.style.display = 'none';
    }
  }

  function _hideTileSourceBadge() {
    const badge = document.getElementById('sat-data-source-badge');
    if (badge) badge.style.display = 'none';
  }

  // ============================================================
  // ACQUIRED DATE DISPLAY
  // Shows the actual imagery date when different from requested date
  // ============================================================
  function _updateAcquiredDateDisplay(isReal, result) {
    const el = document.getElementById('sat-acquired-date');
    if (!el) return;
    if (isReal && result && result.acquiredDate) {
      const requested = result.requestedDate;
      const acquired  = result.acquiredDate;
      if (requested !== acquired) {
        el.style.display = 'block';
        el.textContent = '📸 वास्तविक imagery: ' + acquired +
          ' (requested: ' + requested + ')';
      } else {
        el.style.display = 'none';
      }
    } else {
      el.style.display = 'none';
    }
  }

  // ============================================================
  // NO IMAGERY STATE
  // ============================================================
  function _updateNoImageryState(message) {
    const notice = document.getElementById('index-capability-notice');
    if (notice) {
      notice.style.display = 'block';
      notice.className = 'index-capability-notice notice-warn';
      notice.innerHTML = '<strong>📅 कोई imagery नहीं</strong> — ' + message;
    }
  }

  // ============================================================
  // UPDATE UI (mode label)
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
  // DATE COMPARISON (async)
  // ============================================================
  async function startDateComparison(date1, date2) {
    const m = window.AgriMap && window.AgriMap.getMap();
    if (!m) return;
    const e = eng();

    await showIndex(activeIndex, date1);

    if (compareLayer) m.removeLayer(compareLayer);

    // Fetch second date tile
    const result2 = e ? await e.fetchTileUrl(activeIndex, date2) : null;
    const url2    = (result2 && result2.tileUrl) ? result2.tileUrl : EOX_URL;

    compareLayer = L.tileLayer(url2, {
      opacity: 0.5,
      attribution: '© Sentinel-2 ' + activeIndex.toUpperCase() + ' ' + date2,
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
  // TIME-LAPSE
  // ============================================================
  let timelapseInterval = null;
  let timelapseIndex    = 0;
  const TIMELAPSE_DATES = [
    '2025-12-01', '2026-01-01', '2026-02-01',
    '2026-03-01', '2026-04-01', '2026-05-01'
  ];

  function startTimelapse() {
    if (timelapseInterval) stopTimelapse();

    const btnIndex = document.getElementById('btn-index');
    if (btnIndex && !btnIndex.classList.contains('active')) btnIndex.click();

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

      // Update date display and picker (don't await GEE in interval -- use simulation for timelapse)
      activeDate = currentDate;
      const dp = document.getElementById('ndvi-date');
      if (dp) dp.value = currentDate;
      const dateDisplay = document.getElementById('ndvi-date-display');
      if (dateDisplay) dateDisplay.textContent = formatDate(currentDate);

      const progress = document.getElementById('timelapse-progress');
      if (progress) progress.style.width = (((timelapseIndex + 1) / TIMELAPSE_DATES.length) * 100) + '%';

      // Simulate field colors for this date (not GEE -- timelapse uses simulation)
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
      field.last_ndvi_value = activeIndex === 'ndvi' ? val : e.simulateValue('ndvi', seed, month);
      field.health_status   = cls;
      field['last_' + activeIndex + '_value'] = val;
    });
    window.AgriFarmers.showFieldsOnMap();
    window.AgriFarmers.updateStats();
  }

  function simulateFieldNdviForDate(dateStr) { simulateFieldIndexForDate(dateStr); }

  // ============================================================
  // INIT CONTROLS
  // ============================================================
  function initControls() {
    const btnSentinel   = document.getElementById('btn-sentinel');
    const btnIndex      = document.getElementById('btn-index');
    const btnNDVILegacy = document.getElementById('btn-ndvi');
    const selector      = document.getElementById('index-selector');

    if (btnSentinel) {
      btnSentinel.addEventListener('click', () => {
        document.querySelectorAll('.satellite-mode-btn').forEach(b => b.classList.remove('active'));
        btnSentinel.classList.add('active');
        showSentinel();
      });
    }

    if (btnNDVILegacy) {
      btnNDVILegacy.addEventListener('click', () => {
        document.querySelectorAll('.satellite-mode-btn').forEach(b => b.classList.remove('active'));
        btnNDVILegacy.classList.add('active');
        setActiveIndex('ndvi');
        showIndex('ndvi', activeDate);
      });
    }

    if (btnIndex) {
      btnIndex.addEventListener('click', () => {
        document.querySelectorAll('.satellite-mode-btn').forEach(b => b.classList.remove('active'));
        btnIndex.classList.add('active');
        showIndex(activeIndex, activeDate);
      });
    }

    if (selector) {
      selector.value = activeIndex;
      selector.addEventListener('change', () => {
        setActiveIndex(selector.value);
        if (currentMode !== 'index') {
          if (btnIndex) btnIndex.click();
          else showIndex(selector.value, activeDate);
        }
      });
    }

    const datePicker = document.getElementById('ndvi-date');
    if (datePicker) {
      datePicker.value = activeDate;
      datePicker.max   = new Date().toISOString().slice(0, 10);
      datePicker.addEventListener('change', () => setDate(datePicker.value));
    }

    const opacitySlider = document.getElementById('ndvi-opacity');
    const opacityValue  = document.getElementById('ndvi-opacity-value');
    if (opacitySlider) {
      opacitySlider.value = opacity;
      opacitySlider.addEventListener('input', () => {
        setOpacity(opacitySlider.value);
        if (opacityValue) opacityValue.textContent = Math.round(opacitySlider.value * 100) + '%';
      });
    }

    const compareBtn = document.getElementById('btn-compare-dates');
    const cDate1     = document.getElementById('compare-date1');
    const cDate2     = document.getElementById('compare-date2');
    const stopCmpBtn = document.getElementById('btn-stop-compare');
    if (compareBtn) compareBtn.addEventListener('click', () => { if (cDate1 && cDate2) startDateComparison(cDate1.value, cDate2.value); });
    if (stopCmpBtn) stopCmpBtn.addEventListener('click', stopDateComparison);

    const today  = new Date();
    const minus30 = new Date(today.getTime() - 30 * 86400000);
    if (cDate1) cDate1.value = minus30.toISOString().slice(0, 10);
    if (cDate2) cDate2.value = today.toISOString().slice(0, 10);

    const playBtn = document.getElementById('btn-timelapse-play');
    const stopBtn = document.getElementById('btn-timelapse-stop');
    if (playBtn) playBtn.addEventListener('click', startTimelapse);
    if (stopBtn) stopBtn.addEventListener('click', stopTimelapse);

    setTimeout(() => {
      showSentinel();
      renderColorLegend();
      renderLegendRanges();
      updateIndexDescription();
      updateCapabilityNotice(false, null);
    }, 500);
  }

  // ============================================================
  // PUBLIC API
  // ============================================================
  return {
    init: initControls,
    // Existing exports (preserved)
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
    getActiveIndex:              () => activeIndex,
    simulateFieldIndexForDate,
    simulateFieldNdviForDate,
    getLastGEEMeta:              () => _lastGEEMeta,
  };
})();
