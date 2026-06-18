/**
 * Agri Monitor — js/ndvi.js
 * NDVI satellite tile integration with date selection and opacity control
 * Supports: EOX Sentinel-2 (free), TiTiler NDVI, GEE endpoints
 */

window.AgriNDVI = (() => {
  let tileLayer = null;
  let sentinelLayer = null;
  let activeDate = new Date().toISOString().slice(0, 10);
  let opacity = 0.8;
  let currentMode = 'sentinel'; // 'sentinel' | 'ndvi' | 'off'
  let isVisible = false;

  // ============================================================
  // NDVI Color Scale (Red → Yellow → Green: -1 to +1)
  // ============================================================
  const NDVI_COLORMAP = [
    { val: -1.0, r: 139, g: 0,   b: 0   },  // Dark red (bare soil/water)
    { val: -0.5, r: 200, g: 50,  b: 50  },  // Red
    { val:  0.0, r: 210, g: 180, b: 140 },  // Tan (bare soil)
    { val:  0.1, r: 240, g: 230, b: 100 },  // Yellow (sparse vegetation)
    { val:  0.25,r: 200, g: 230, b: 80  },  // Yellow-green
    { val:  0.45,r: 120, g: 200, b: 60  },  // Light green (moderate)
    { val:  0.65,r: 60,  g: 160, b: 30  },  // Green (healthy)
    { val:  1.0, r: 0,   g: 100, b: 0   },  // Dark green (dense vegetation)
  ];

  function ndviToRgb(value) {
    const v = Math.max(-1, Math.min(1, value));
    for (let i = 0; i < NDVI_COLORMAP.length - 1; i++) {
      const c1 = NDVI_COLORMAP[i], c2 = NDVI_COLORMAP[i + 1];
      if (v >= c1.val && v <= c2.val) {
        const t = (v - c1.val) / (c2.val - c1.val);
        return {
          r: Math.round(c1.r + t * (c2.r - c1.r)),
          g: Math.round(c1.g + t * (c2.g - c1.g)),
          b: Math.round(c1.b + t * (c2.b - c1.b))
        };
      }
    }
    return { r: 0, g: 100, b: 0 };
  }

  // ============================================================
  // Build tile URLs
  // ============================================================
  function getSentinelTileUrl() {
    // EOX Sentinel-2 Cloudless — real, free satellite imagery
    return 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg';
  }

  function getNdviTileUrl(date) {
    const cfg = window.AgriConfig || {};

    // If GEE tile URL provided (dynamic, set by GEE script)
    if (cfg.GEE_TILE_URL && cfg.GEE_TILE_URL !== 'null') {
      return cfg.GEE_TILE_URL;
    }

    // TiTiler NDVI endpoint (self-hosted or public instance)
    if (cfg.NDVI_TILE_URL && !cfg.NDVI_TILE_URL.includes('titiler.xyz')) {
      return cfg.NDVI_TILE_URL;
    }

    // Placeholder — styled tile showing what NDVI would look like
    // In production, replace with real GEE endpoint
    // Format: {z}/{x}/{y}?date=YYYY-MM-DD&bands=NDVI&colormap=rdylgn
    return `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg`;
    // NOTE: ^ This shows actual Sentinel-2 imagery. For real NDVI colors,
    // deploy a TiTiler instance with Sentinel-2 COGs, or use GEE:
    // https://developers.google.com/earth-engine/tutorials/tutorial_api_06
  }

  // ============================================================
  // Add/Update tile layer
  // ============================================================
  function setTileLayer(url, options = {}) {
    const m = window.AgriMap.getMap();
    if (!m) return;

    if (tileLayer) {
      m.removeLayer(tileLayer);
      tileLayer = null;
    }

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
  // Show Sentinel-2 cloudless imagery
  // ============================================================
  function showSentinel() {
    currentMode = 'sentinel';
    setTileLayer(getSentinelTileUrl(), {
      attribution: '© <a href="https://eox.at">EOX</a> — Sentinel-2 Cloudless 2020'
    });
    updateUI();
  }

  // ============================================================
  // Show NDVI layer for selected date
  // ============================================================
  function showNDVI(date) {
    if (date) activeDate = date;
    currentMode = 'ndvi';
    const url = getNdviTileUrl(activeDate);
    setTileLayer(url, {
      attribution: '© Sentinel-2 NDVI via GEE/TiTiler'
    });
    updateUI();
    renderColorLegend();
  }

  // ============================================================
  // Toggle layer visibility
  // ============================================================
  function toggle(visible) {
    const m = window.AgriMap.getMap();
    if (!m) return;

    if (!visible) {
      if (tileLayer) {
        m.removeLayer(tileLayer);
        isVisible = false;
      }
    } else {
      if (currentMode === 'ndvi') showNDVI(activeDate);
      else showSentinel();
    }
  }

  // ============================================================
  // Set opacity
  // ============================================================
  function setOpacity(value) {
    opacity = parseFloat(value);
    if (tileLayer) tileLayer.setOpacity(opacity);
  }

  // ============================================================
  // Set date and reload
  // ============================================================
  function setDate(date) {
    activeDate = date;
    if (currentMode === 'ndvi' && isVisible) {
      showNDVI(date);
    }
    // Update date display
    const dateDisplay = document.getElementById('ndvi-date-display');
    if (dateDisplay) dateDisplay.textContent = formatDate(date);
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('hi-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // ============================================================
  // Render NDVI color scale legend
  // ============================================================
  function renderColorLegend() {
    const canvas = document.getElementById('ndvi-color-scale');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.offsetWidth || 200;
    const h = canvas.height = 20;

    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    NDVI_COLORMAP.forEach(point => {
      const stop = (point.val + 1) / 2; // Map -1..1 to 0..1
      gradient.addColorStop(stop, `rgb(${point.r},${point.g},${point.b})`);
    });

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // Labels
    ctx.fillStyle = '#fff';
    ctx.font = '10px Inter';
    ctx.textAlign = 'left';
    ctx.fillText('-1', 2, 14);
    ctx.textAlign = 'center';
    ctx.fillText('0', w / 2, 14);
    ctx.textAlign = 'right';
    ctx.fillText('+1', w - 2, 14);
  }

  // ============================================================
  // Date comparison mode (before/after slider)
  // ============================================================
  let compareLayer = null;
  function startDateComparison(date1, date2) {
    const m = window.AgriMap.getMap();
    if (!m) return;

    showNDVI(date1);

    if (compareLayer) m.removeLayer(compareLayer);

    // Show second date layer at reduced opacity on top
    compareLayer = L.tileLayer(getNdviTileUrl(date2), {
      opacity: 0.5,
      attribution: `© Sentinel-2 NDVI ${date2}`
    });
    compareLayer.addTo(m);

    // Update labels
    const label = document.getElementById('compare-label');
    if (label) label.innerHTML = `
      <span style="color:#22c55e">📅 ${formatDate(date1)}</span> →
      <span style="color:#f59e0b">📅 ${formatDate(date2)}</span>
    `;
  }

  function stopDateComparison() {
    const m = window.AgriMap.getMap();
    if (compareLayer && m) {
      m.removeLayer(compareLayer);
      compareLayer = null;
    }
    const label = document.getElementById('compare-label');
    if (label) label.innerHTML = '';
  }

  // ============================================================
  // Initialize NDVI controls in sidebar
  // ============================================================
  function initControls() {
    // Mode toggle buttons
    const btnSentinel = document.getElementById('btn-sentinel');
    const btnNDVI = document.getElementById('btn-ndvi');

    if (btnSentinel) btnSentinel.addEventListener('click', () => {
      document.querySelectorAll('.satellite-mode-btn').forEach(b => b.classList.remove('active'));
      btnSentinel.classList.add('active');
      showSentinel();
    });

    if (btnNDVI) btnNDVI.addEventListener('click', () => {
      document.querySelectorAll('.satellite-mode-btn').forEach(b => b.classList.remove('active'));
      btnNDVI.classList.add('active');
      showNDVI(activeDate);
    });

    // Date picker
    const datePicker = document.getElementById('ndvi-date');
    if (datePicker) {
      datePicker.value = activeDate;
      datePicker.max = new Date().toISOString().slice(0, 10);
      datePicker.addEventListener('change', () => setDate(datePicker.value));
    }

    // Opacity slider
    const opacitySlider = document.getElementById('ndvi-opacity');
    const opacityValue = document.getElementById('ndvi-opacity-value');
    if (opacitySlider) {
      opacitySlider.value = opacity;
      opacitySlider.addEventListener('input', () => {
        setOpacity(opacitySlider.value);
        if (opacityValue) opacityValue.textContent = `${Math.round(opacitySlider.value * 100)}%`;
      });
    }

    // Date comparison
    const compareBtn = document.getElementById('btn-compare-dates');
    const compareDate1 = document.getElementById('compare-date1');
    const compareDate2 = document.getElementById('compare-date2');
    const stopCompareBtn = document.getElementById('btn-stop-compare');

    if (compareBtn) compareBtn.addEventListener('click', () => {
      if (compareDate1 && compareDate2) {
        startDateComparison(compareDate1.value, compareDate2.value);
      }
    });

    if (stopCompareBtn) stopCompareBtn.addEventListener('click', stopDateComparison);

    // Set default date inputs
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (compareDate1) compareDate1.value = thirtyDaysAgo.toISOString().slice(0, 10);
    if (compareDate2) compareDate2.value = today.toISOString().slice(0, 10);

    // Time-Lapse Player
    const playTimelapseBtn = document.getElementById('btn-timelapse-play');
    const stopTimelapseBtn = document.getElementById('btn-timelapse-stop');

    if (playTimelapseBtn) playTimelapseBtn.addEventListener('click', startTimelapse);
    if (stopTimelapseBtn) stopTimelapseBtn.addEventListener('click', stopTimelapse);

    // Initialize with sentinel view
    setTimeout(() => {
      showSentinel();
      renderColorLegend();
    }, 500);
  }

  // ============================================================
  // NDVI Time-Lapse Player Logic
  // ============================================================
  let timelapseInterval = null;
  let timelapseIndex = 0;
  const TIMELAPSE_DATES = [
    '2025-12-01',
    '2026-01-01',
    '2026-02-01',
    '2026-03-01',
    '2026-04-01',
    '2026-05-01'
  ];

  function startTimelapse() {
    if (timelapseInterval) stopTimelapse();
    
    // Switch to NDVI mode automatically
    const btnNDVI = document.getElementById('btn-ndvi');
    if (btnNDVI && !btnNDVI.classList.contains('active')) {
      btnNDVI.click();
    }

    const playBtn = document.getElementById('btn-timelapse-play');
    const stopBtn = document.getElementById('btn-timelapse-stop');
    const statusText = document.getElementById('time-lapse-status');
    const speedSelect = document.getElementById('timelapse-speed');

    if (playBtn) playBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = false;
    if (statusText) {
      statusText.textContent = '▶️ Playing…';
      statusText.style.color = '#22c55e'; // Green
    }

    const intervalMs = speedSelect ? parseInt(speedSelect.value) : 1000;
    timelapseIndex = 0;

    const tick = () => {
      if (timelapseIndex >= TIMELAPSE_DATES.length) {
        timelapseIndex = 0; // Loop forever
      }

      const currentDate = TIMELAPSE_DATES[timelapseIndex];
      setDate(currentDate);
      
      // Update date picker input value
      const datePicker = document.getElementById('ndvi-date');
      if (datePicker) datePicker.value = currentDate;

      // Update progress bar
      const progress = document.getElementById('timelapse-progress');
      if (progress) {
        const pct = ((timelapseIndex + 1) / TIMELAPSE_DATES.length) * 100;
        progress.style.width = `${pct}%`;
      }

      // Dynamic map polygon color simulation
      simulateFieldNdviForDate(currentDate);

      timelapseIndex++;
    };

    tick(); // Run first tick immediately
    timelapseInterval = setInterval(tick, intervalMs);
  }

  function stopTimelapse() {
    if (timelapseInterval) {
      clearInterval(timelapseInterval);
      timelapseInterval = null;
    }

    const playBtn = document.getElementById('btn-timelapse-play');
    const stopBtn = document.getElementById('btn-timelapse-stop');
    const statusText = document.getElementById('time-lapse-status');
    const progress = document.getElementById('timelapse-progress');

    if (playBtn) playBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;
    if (statusText) {
      statusText.textContent = '⏹️ Stopped';
      statusText.style.color = '#eab308'; // Yellow
    }
    if (progress) progress.style.width = '0%';

    // Restore original field values from dummy data
    if (window.AgriFarmers) {
      window.AgriFarmers.loadData().catch(() => {});
    }
  }

  function simulateFieldNdviForDate(dateStr) {
    if (!window.AgriFarmers) return;

    const fields = window.AgriFarmers.getFields();
    const month = parseInt(dateStr.split('-')[1]);

    fields.forEach(field => {
      const seed = field.id ? parseInt(field.id.replace(/\D/g, '')) || 5 : 5;
      let ndviValue = 0.45;
      let health = 'moderate';

      if (month === 12) { // Sowing stage
        ndviValue = 0.22 + (seed % 3) * 0.04;
        health = ndviValue < 0.25 ? 'stress' : 'moderate';
      } else if (month === 1) { // Early vegetative
        ndviValue = 0.35 + (seed % 4) * 0.05;
        health = ndviValue >= 0.45 ? 'healthy' : 'moderate';
      } else if (month === 2) { // Peak healthy vegetative growth (Green)
        ndviValue = 0.58 + (seed % 3) * 0.08;
        health = 'healthy';
      } else if (month === 3) { // Sudden frost dry spell (High stress color shift)
        if (seed % 2 === 0) {
          ndviValue = 0.14 + (seed % 3) * 0.03;
          health = 'stress'; // High Red representation
        } else {
          ndviValue = 0.38 + (seed % 3) * 0.04;
          health = 'moderate'; // Yellow
        }
      } else if (month === 4) { // Pre-harvest yellowing
        ndviValue = 0.32 + (seed % 3) * 0.05;
        health = ndviValue >= 0.45 ? 'healthy' : 'moderate';
      } else if (month === 5) { // Post-harvest regrowth
        ndviValue = 0.44 + (seed % 4) * 0.05;
        health = ndviValue >= 0.48 ? 'healthy' : 'moderate';
      }

      field.last_ndvi_value = ndviValue;
      field.health_status = health;
    });

    // Refresh map polygons
    window.AgriFarmers.showFieldsOnMap();
    window.AgriFarmers.updateStats();
  }

  // ============================================================
  // Update UI state
  // ============================================================
  function updateUI() {
    const modeLabel = document.getElementById('satellite-mode-label');
    if (modeLabel) {
      modeLabel.textContent = currentMode === 'ndvi' ? '🛰️ NDVI मोड' : '🛰️ Sentinel-2 मोड';
    }
    const dateDisplay = document.getElementById('ndvi-date-display');
    if (dateDisplay) dateDisplay.textContent = formatDate(activeDate);
  }

  return {
    init: initControls,
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
    getActiveDate: () => activeDate,
    getCurrentMode: () => currentMode,
  };
})();
