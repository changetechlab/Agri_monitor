/**
 * mrv.js — MRV Foundation Wizard Controller
 * CHANGE TechLab | Agri Monitor
 *
 * Handles: step navigation, Leaflet map, form collection,
 * intervention toggles, evidence upload, carbon calc, export, submit
 */

'use strict';

const MRVWizard = (() => {

  // ─── State ───────────────────────────────────────────────────
  let record   = null;
  let _map     = null;
  let _drawnPolygon = null;
  let _drawControl  = null;
  let _featureGroup = null;
  let _currentStep  = 1;
  const TOTAL_STEPS = 7;

  const STEP_META = [
    { num: 1, label: '👨‍🌾\nFarmer',    title: 'Farmer Profile' },
    { num: 2, label: '🗺️\nLand',       title: 'Land Boundary' },
    { num: 3, label: '🌾\nBaseline',   title: 'Baseline Data' },
    { num: 4, label: '🌿\nIntervene',  title: 'Intervention' },
    { num: 5, label: '📷\nEvidence',   title: 'Evidence' },
    { num: 6, label: '📊\nCarbon',     title: 'Carbon Calc' },
    { num: 7, label: '✅\nReview',     title: 'Review & Export' }
  ];

  const BLOCKS = {
    rudraprayag: ['Ukhimath', 'Jakholi', 'Augustyamuni'],
    tehri:       ['Pratapnagar', 'Kirtinagar', 'Jaunpur', 'Jhakhanidhar', 'Bhilangana', 'Narendranagar', 'Thauldhar', 'Devprayag', 'Chamba'],
    chamoli:     ['Gairsain', 'Tharali', 'Karanprayag', 'Joshimath', 'Narainbagar'],
    uttarkashi:  ['Bhatwari', 'Chiniyalisaur', 'Dunda', 'Mori', 'Purola'],
    pauri:       ['Pabau', 'Ekeshwar', 'Dugadda', 'Yamkeshwar', 'Kot'],
    almora:      ['Tarikhet', 'Lamgara', 'Hawalbagh', 'Bhikiyasain', 'Salt'],
    pithoragarh: ['Munsiari', 'Dharchula', 'Gangolihat', 'Didihat', 'Berinag'],
    haridwar:    ['Khanpur', 'Laksar', 'Roorkee', 'Bhagwanpur'],
    dehradun:    ['Vikasnagar', 'Chakrata', 'Kalsi', 'Sahaspur']
  };

  const DISTRICT_CENTERS = {
    rudraprayag: [30.3985, 79.0561], tehri: [30.3786, 78.4797],
    chamoli: [30.4019, 79.3215], uttarkashi: [30.7268, 78.4354],
    pauri: [29.7737, 78.7839], almora: [29.5971, 79.6497],
    pithoragarh: [29.5822, 80.2183], haridwar: [29.9457, 78.1642],
    dehradun: [30.3165, 78.0322]
  };

  // ─── Init ─────────────────────────────────────────────────────
  async function init() {
    record = MRVStorage.createEmptyRecord();
    _buildStepTrack();
    _bindAll();
    await _initMap();
    toast('नया MRV record शुरू किया। सभी steps fill करें।', 'success');
  }

  // ─── Step Track ───────────────────────────────────────────────
  function _buildStepTrack() {
    const track = document.getElementById('step-track');
    track.innerHTML = '';
    STEP_META.forEach((s, i) => {
      if (i > 0) {
        const conn = document.createElement('div');
        conn.className = 'step-connector'; conn.id = `conn-${i}`;
        track.appendChild(conn);
      }
      const item = document.createElement('div');
      item.className = 'step-item' + (s.num === 1 ? ' active' : '');
      item.id = `step-nav-${s.num}`;
      item.innerHTML = `<div class="step-num" id="sn-${s.num}">${s.num}</div><div class="step-label">${s.label}</div>`;
      item.onclick = () => goTo(s.num);
      track.appendChild(item);
    });
    _updateProgress(1);
  }

  function _updateProgress(step) {
    STEP_META.forEach(s => {
      const item = document.getElementById(`step-nav-${s.num}`);
      const num  = document.getElementById(`sn-${s.num}`);
      if (!item) return;
      item.className = 'step-item' + (s.num < step ? ' completed' : s.num === step ? ' active' : '');
      num.textContent = s.num < step ? '✓' : s.num;
      const conn = document.getElementById(`conn-${s.num - 1}`);
      if (conn) conn.className = 'step-connector' + (s.num <= step ? ' done' : '');
    });
    const pct = Math.round(((step - 1) / TOTAL_STEPS) * 100);
    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('progress-pct').textContent = pct + '%';
  }

  function goTo(step) {
    if (step < 1 || step > TOTAL_STEPS) return;
    document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById(`step-${step}`);
    if (panel) { panel.classList.add('active'); panel.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    _currentStep = step;
    _updateProgress(step);
    if (step === 7) _buildReviewSummary();
    if (step === 2) setTimeout(() => _map?.invalidateSize(), 200);
  }

  // ─── Bindings ────────────────────────────────────────────────
  function _bindAll() {
    // Step nav buttons
    document.getElementById('s1-next')?.addEventListener('click', () => { if (_validateStep1()) goTo(2); });
    document.getElementById('s2-next')?.addEventListener('click', () => { _collectLand(); goTo(3); });
    document.getElementById('s3-next')?.addEventListener('click', () => { _collectBaseline(); goTo(4); });
    document.getElementById('s4-next')?.addEventListener('click', () => { if (_validateStep4()) goTo(5); });
    document.getElementById('s5-next')?.addEventListener('click', () => goTo(6));
    document.getElementById('s6-next')?.addEventListener('click', () => { _collectCarbon(); goTo(7); });

    // Save draft
    document.getElementById('btn-save-draft')?.addEventListener('click', _saveDraft);

    // GPS
    document.getElementById('btn-get-gps')?.addEventListener('click', _getGPS);

    // District → Block cascading
    document.getElementById('f-district')?.addEventListener('change', e => {
      _populateBlocks(e.target.value);
      const center = DISTRICT_CENTERS[e.target.value];
      if (center && _map) _map.flyTo(center, 11, { animate: true });
    });

    // Intervention checkboxes
    document.querySelectorAll('.intervention-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        const card = document.getElementById(`card-${cb.dataset.key}`);
        if (card) card.classList.toggle('selected', cb.checked);
      });
    });

    // Carbon calculate
    document.getElementById('btn-calculate')?.addEventListener('click', _runCalculation);

    // Yield comparison
    document.getElementById('yd-actual')?.addEventListener('input', _calcYield);
    document.getElementById('yd-price')?.addEventListener('input', _calcYield);

    // Map buttons
    document.getElementById('map-btn-draw')?.addEventListener('click', _startDraw);
    document.getElementById('map-btn-edit')?.addEventListener('click', _editPolygon);
    document.getElementById('map-btn-delete')?.addEventListener('click', _deletePolygon);
    document.getElementById('map-btn-locate')?.addEventListener('click', _locateUser);
    document.getElementById('map-btn-satellite')?.addEventListener('click', _toggleSatellite);

    // Map search
    const srch = document.getElementById('map-search');
    if (srch) {
      const doSearch = MRVUtils.debounce(e => _searchLocation(e.target.value), 500);
      srch.addEventListener('input', doSearch);
    }

    // Fallback toggle
    document.getElementById('fallback-toggle')?.addEventListener('click', () => {
      const body = document.getElementById('fallback-body');
      if (body) body.style.display = body.style.display === 'none' ? 'block' : 'none';
    });

    // GeoJSON import
    document.getElementById('btn-import-geojson')?.addEventListener('click', _importGeoJSON);

    // Photos
    document.getElementById('photo-input')?.addEventListener('change', _handlePhotos);
    _setupDragDrop();

    // Timeline
    document.getElementById('btn-add-timeline')?.addEventListener('click', _addTimelineEvent);

    // Exports
    document.getElementById('exp-pdf')?.addEventListener('click', () => MRVExporter.exportPDF(record));
    document.getElementById('exp-json')?.addEventListener('click', () => MRVExporter.exportJSON(record));
    document.getElementById('exp-geojson')?.addEventListener('click', () => MRVExporter.exportGeoJSON(record));
    document.getElementById('exp-csv')?.addEventListener('click', () => MRVExporter.exportCSV(record));
    document.getElementById('exp-map')?.addEventListener('click', () => MRVExporter.exportMapPNG(_map, record));

    // Submit
    document.getElementById('btn-submit-mrv')?.addEventListener('click', _submitRecord);
  }

  // ─── Step 1 Validation ───────────────────────────────────────
  function _validateStep1() {
    let ok = true;
    const name = document.getElementById('f-name').value.trim();
    const mob  = document.getElementById('f-mobile').value.trim();
    const dist = document.getElementById('f-district').value;
    const blk  = document.getElementById('f-block').value;
    const vil  = document.getElementById('f-village').value.trim();

    if (!name)  { _markError('f-name', 'नाम आवश्यक है');    ok = false; }
    if (!mob || !MRVUtils.validatePhone(mob)) { _markError('f-mobile', 'Valid 10-digit number'); ok = false; }
    if (!dist)  { _markError('f-district', 'जिला चुनें');   ok = false; }
    if (!blk)   { _markError('f-block', 'ब्लॉक चुनें');     ok = false; }
    if (!vil)   { _markError('f-village', 'ग्राम name आवश्यक है'); ok = false; }

    if (ok) _collectFarmer();
    return ok;
  }

  function _collectFarmer() {
    record.farmer = {
      ...record.farmer,
      name:           document.getElementById('f-name').value.trim(),
      mobile:         document.getElementById('f-mobile').value.trim(),
      aadhaar_last4:  document.getElementById('f-aadhaar').value.trim(),
      gender:         document.getElementById('f-gender').value,
      category:       document.getElementById('f-category').value,
      village:        document.getElementById('f-village').value.trim(),
      gram_panchayat: document.getElementById('f-gp').value.trim(),
      block:          document.getElementById('f-block').value,
      district:       document.getElementById('f-district').value,
      clf_shg:        document.getElementById('f-clf').value.trim(),
      enumerator_name:document.getElementById('f-enum-name').value.trim(),
      enumerator_id:  document.getElementById('f-enum-id').value.trim(),
      lat:            parseFloat(document.getElementById('f-lat').value) || null,
      lng:            parseFloat(document.getElementById('f-lng').value) || null
    };
    record.farmer.state = 'Uttarakhand';
  }

  function _populateBlocks(district) {
    const sel = document.getElementById('f-block');
    if (!sel) return;
    const blocks = BLOCKS[district] || [];
    sel.innerHTML = '<option value="">ब्लॉक चुनें</option>' +
      blocks.map(b => `<option value="${b}">${b}</option>`).join('');
  }

  // ─── Step 4 Validation ───────────────────────────────────────
  function _validateStep4() {
    const any = [...document.querySelectorAll('.intervention-checkbox')].some(cb => cb.checked);
    if (!any) { toast('कम से कम 1 intervention चुनें', 'error'); return false; }
    _collectInterventions();
    return true;
  }

  function _collectInterventions() {
    record.interventions = {
      awd: {
        enabled:          document.getElementById('iv-awd').checked,
        area_ha:          +document.getElementById('iv-awd-area').value  || 0,
        seasons:          +document.getElementById('iv-awd-seasons').value || 1,
        drainage_events:  +document.getElementById('iv-awd-drainage').value || 1
      },
      soc: {
        enabled:          document.getElementById('iv-soc').checked,
        area_ha:          +document.getElementById('iv-soc-area').value   || 0,
        compost_tons:     +document.getElementById('iv-soc-compost').value || 0,
        fym_tons:         +document.getElementById('iv-soc-fym').value    || 0,
        vermicompost_tons:+document.getElementById('iv-soc-vermi').value  || 0
      },
      biochar: {
        enabled:          document.getElementById('iv-biochar').checked,
        amount_tons:      +document.getElementById('iv-biochar-tons').value || 0,
        feedstock:         document.getElementById('iv-biochar-feedstock').value,
        temp_c:           +document.getElementById('iv-biochar-temp').value || 550
      },
      agroforestry: {
        enabled:          document.getElementById('iv-agroforestry').checked,
        species:           document.getElementById('iv-af-species').value,
        tree_count:       +document.getElementById('iv-af-count').value || 0,
        area_ha:          0,
        age_years:        +document.getElementById('iv-af-age').value || 1
      },
      compost: {
        enabled:          document.getElementById('iv-compost').checked,
        amount_tons:      +document.getElementById('iv-compost-tons').value || 0
      },
      residue: {
        enabled:          document.getElementById('iv-residue').checked,
        amount_tons:      +document.getElementById('iv-residue-tons').value || 0,
        management:        document.getElementById('iv-residue-mgmt').value
      }
    };
  }

  function _collectBaseline() {
    record.baseline = {
      season:           document.getElementById('b-season').value,
      primary_crop:     document.getElementById('b-crop').value,
      crop_variety:     document.getElementById('b-variety').value.trim(),
      year_start:       document.getElementById('b-year').value,
      sowing_date:      document.getElementById('b-sow-date').value,
      harvest_date:     document.getElementById('b-harvest-date').value,
      irrigation_source:document.getElementById('b-irrigation').value,
      fertilizer_type:  document.getElementById('b-fertilizer').value,
      soil_type:        document.getElementById('b-soil').value,
      slope:            document.getElementById('b-slope').value,
      baseline_yield_kg:+document.getElementById('b-yield-kg').value || 0,
      baseline_yield_unit:document.getElementById('b-yield-unit').value
    };
  }

  function _collectLand() {
    record.land = {
      ...record.land,
      khasra_number: document.getElementById('l-khasra').value.trim(),
      khata_number:  document.getElementById('l-khata').value.trim(),
      village_patwari:document.getElementById('l-village').value.trim(),
      tehsil:        document.getElementById('l-tehsil').value.trim()
    };
  }

  function _collectCarbon() {
    record.carbon.methodology = document.getElementById('c-methodology').value;
    record.yield_data.actual_yield_kg   = +document.getElementById('yd-actual').value || 0;
    record.yield_data.market_price_inr  = +document.getElementById('yd-price').value  || 0;
  }

  // ─── GPS ─────────────────────────────────────────────────────
  async function _getGPS() {
    const btn = document.getElementById('btn-get-gps');
    btn.classList.add('loading'); btn.textContent = '⏳ Getting...';
    try {
      const pos = await MRVUtils.getCurrentPosition();
      document.getElementById('f-lat').value = pos.lat.toFixed(6);
      document.getElementById('f-lng').value = pos.lng.toFixed(6);
      document.getElementById('gps-accuracy-hint').textContent = `Accuracy: ±${Math.round(pos.accuracy)}m`;
      record.farmer.lat = pos.lat; record.farmer.lng = pos.lng;
      toast('GPS location captured!', 'success');
    } catch (e) {
      toast('GPS failed: ' + e.message, 'error');
    } finally {
      btn.classList.remove('loading'); btn.textContent = '📡 Get GPS';
    }
  }

  // ─── Leaflet Map (Step 2) ─────────────────────────────────────
  async function _initMap() {
    const el = document.getElementById('mrv-map');
    if (!el || !window.L) return;

    const center = DISTRICT_CENTERS.rudraprayag;
    _map = L.map('mrv-map', { zoomControl: true, attributionControl: false }).setView(center, 12);

    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
    const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Esri' });
    osm.addTo(_map);
    _map._layers_osm = osm; _map._layers_sat = sat;
    _map._satMode = false;

    // Draw control
    _featureGroup = new L.FeatureGroup().addTo(_map);

    if (L.Control && L.Control.Draw) {
      _drawControl = new L.Control.Draw({
        edit: { featureGroup: _featureGroup },
        draw: {
          polygon:   { shapeOptions: { color: '#16a34a', fillOpacity: 0.15 } },
          rectangle: false, circle: false, circlemarker: false,
          polyline: false, marker: false
        }
      }).addTo(_map);
    }

    _map.on(L.Draw.Event.CREATED, e => {
      _featureGroup.clearLayers();
      _drawnPolygon = e.layer;
      _featureGroup.addLayer(_drawnPolygon);
      _onPolygonCreated(_drawnPolygon.getLatLngs()[0]);
    });

    _map.on(L.Draw.Event.EDITED, () => {
      _featureGroup.eachLayer(layer => {
        if (layer instanceof L.Polygon) _onPolygonCreated(layer.getLatLngs()[0]);
      });
    });

    _map.on(L.Draw.Event.DELETED, () => {
      _drawnPolygon = null;
      _clearAreaDisplay();
      record.land.polygon_coords = [];
      record.land.geojson = null;
      document.getElementById('map-container').classList.remove('has-polygon');
    });
  }

  function _onPolygonCreated(latlngs) {
    const flat = latlngs.flat ? latlngs.flat(Infinity) : latlngs;
    const coords = flat.map(ll => ({ lat: ll.lat, lng: ll.lng }));

    const sqm    = MRVUtils.calcPolygonArea(coords);
    const areas  = MRVUtils.formatArea(sqm);
    const centroid = _calcCentroid(coords);
    const geojson  = MRVUtils.latlngsToGeoJSON(coords, {
      mrv_id: record.mrv_id || 'draft',
      farmer: record.farmer?.name,
      district: record.farmer?.district,
      area_ha: areas.ha
    });

    record.land.polygon_coords = coords;
    record.land.area_sqm  = areas.sqm;
    record.land.area_ha   = areas.ha;
    record.land.area_acres = areas.acres;
    record.land.area_bigha = areas.bigha;
    record.land.centroid  = centroid;
    record.land.geojson   = geojson;
    record.land.entry_method = 'map';

    _showAreaDisplay(areas);
    document.getElementById('map-container').classList.add('has-polygon');
    document.getElementById('map-btn-draw')?.classList.remove('active');
    toast(`Area: ${areas.display}`, 'success');
  }

  function _showAreaDisplay(areas) {
    const el = document.getElementById('area-display');
    if (!el) return;
    el.style.display = 'block';
    document.getElementById('area-main-text').textContent = `${areas.ha.toFixed(3)} हेक्टेयर`;
    document.getElementById('area-sub-text').textContent  = `${areas.acres.toFixed(2)} acres  |  ${areas.bigha.toFixed(1)} बीघा  |  ${areas.sqm.toLocaleString()} m²`;
  }

  function _clearAreaDisplay() {
    const el = document.getElementById('area-display');
    if (el) el.style.display = 'none';
  }

  function _calcCentroid(coords) {
    if (!coords.length) return null;
    const lat = coords.reduce((a, c) => a + c.lat, 0) / coords.length;
    const lng = coords.reduce((a, c) => a + c.lng, 0) / coords.length;
    return { lat: +lat.toFixed(7), lng: +lng.toFixed(7) };
  }

  function _startDraw() {
    if (!_drawControl || !window.L?.Draw?.Polygon) return;
    new L.Draw.Polygon(_map, _drawControl.options.draw.polygon).enable();
    document.getElementById('map-btn-draw')?.classList.add('active');
    toast('Map पर click करके polygon बनाएं। Double-click से close करें।', 'success');
  }

  function _editPolygon() {
    if (!_drawnPolygon) { toast('पहले polygon draw करें।', 'error'); return; }
    _featureGroup.eachLayer(l => { if (l.editing) l.editing.enable(); });
    toast('Vertices drag करें। Done होने पर Save करें।', 'success');
  }

  function _deletePolygon() {
    _featureGroup.clearLayers();
    _drawnPolygon = null;
    _clearAreaDisplay();
    record.land.polygon_coords = [];
    record.land.geojson = null;
    document.getElementById('map-container')?.classList.remove('has-polygon');
    toast('Polygon हटा दिया।', 'success');
  }

  function _locateUser() {
    MRVUtils.getCurrentPosition().then(pos => {
      _map.flyTo([pos.lat, pos.lng], 15, { animate: true });
      L.circleMarker([pos.lat, pos.lng], { color: '#16a34a', radius: 8, fillColor: '#22c55e', fillOpacity: 0.8 })
       .addTo(_map).bindPopup('📡 आप यहाँ हैं').openPopup();
    }).catch(() => toast('Location access नहीं मिली।', 'error'));
  }

  function _toggleSatellite() {
    if (!_map._satMode) {
      _map.removeLayer(_map._layers_osm);
      _map._layers_sat.addTo(_map);
      _map._satMode = true;
      document.getElementById('map-btn-satellite').classList.add('active');
    } else {
      _map.removeLayer(_map._layers_sat);
      _map._layers_osm.addTo(_map);
      _map._satMode = false;
      document.getElementById('map-btn-satellite').classList.remove('active');
    }
  }

  // ─── Location Search (Nominatim) ─────────────────────────────
  async function _searchLocation(q) {
    const res = document.getElementById('map-search-results');
    if (!q || q.length < 3) { if (res) res.innerHTML = ''; return; }
    try {
      const data = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ', Uttarakhand, India')}&format=json&limit=5`).then(r => r.json());
      if (!res) return;
      res.innerHTML = data.map(d => `<div class="search-result-item" data-lat="${d.lat}" data-lon="${d.lon}">${d.display_name}</div>`).join('') || '<div class="search-result-item" style="cursor:default;color:var(--text-muted)">No results</div>';
      res.querySelectorAll('.search-result-item[data-lat]').forEach(item => {
        item.addEventListener('click', () => {
          _map.flyTo([+item.dataset.lat, +item.dataset.lon], 14);
          res.innerHTML = '';
          document.getElementById('map-search').value = '';
        });
      });
    } catch { /* offline */ }
  }

  function _importGeoJSON() {
    const raw = document.getElementById('l-geojson-paste').value.trim();
    if (!raw) return;
    const coords = MRVUtils.parseGeoJSONPolygon(raw);
    if (!coords || coords.length < 3) { toast('Invalid GeoJSON format', 'error'); return; }
    _featureGroup.clearLayers();
    const poly = L.polygon(coords.map(c => [c.lat, c.lng]), { color: '#16a34a', fillOpacity: 0.15 });
    _featureGroup.addLayer(poly);
    _drawnPolygon = poly;
    _map.fitBounds(poly.getBounds());
    _onPolygonCreated(coords);
  }

  // ─── Photo Handling ──────────────────────────────────────────
  async function _handlePhotos(e) {
    const files = Array.from(e.target.files).slice(0, 5 - record.evidence.photos.length);
    for (const file of files) {
      const b64 = await _fileToB64(file);
      let gps = null;
      try { gps = await MRVUtils.getCurrentPosition(); } catch {}
      record.evidence.photos.push({
        id: Date.now() + Math.random(),
        filename: file.name, url_b64: b64,
        lat: gps?.lat || null, lng: gps?.lng || null,
        timestamp: new Date().toISOString(),
        caption: '', type: 'field'
      });
    }
    _renderPhotos();
  }

  function _renderPhotos() {
    const grid = document.getElementById('photo-grid');
    if (!grid) return;
    grid.innerHTML = record.evidence.photos.map((p, i) => `
      <div class="photo-thumb">
        <img src="${p.url_b64}" alt="Photo ${i+1}">
        <button class="remove-photo" data-idx="${i}">✕</button>
        ${p.lat ? `<div class="photo-gps">${p.lat?.toFixed(4)}, ${p.lng?.toFixed(4)}</div>` : ''}
      </div>`).join('');
    grid.querySelectorAll('.remove-photo').forEach(btn => {
      btn.onclick = () => { record.evidence.photos.splice(+btn.dataset.idx, 1); _renderPhotos(); };
    });
  }

  function _setupDragDrop() {
    const zone = document.getElementById('photo-drop-zone');
    if (!zone) return;
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('dragover');
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      if (files.length) { const inp = document.getElementById('photo-input'); inp.files = e.dataTransfer.files; _handlePhotos({ target: inp }); }
    });
  }

  function _fileToB64(file) {
    return new Promise(res => {
      const r = new FileReader();
      r.onload = e => res(e.target.result);
      r.readAsDataURL(file);
    });
  }

  // ─── Carbon Calculation ──────────────────────────────────────
  async function _runCalculation() {
    _collectInterventions();
    const options = {
      leakage_factor:    +document.getElementById('c-leakage').value / 100,
      permanence_factor: +document.getElementById('c-permanence').value / 100,
      price_per_tco2e_inr: +document.getElementById('c-price').value,
      price_per_tco2e_usd: +document.getElementById('c-price').value / 83.5
    };
    const btn = document.getElementById('btn-calculate');
    btn.disabled = true; btn.textContent = '⏳ Calculating...';
    try {
      const result = await MRVCalculator.calculate(record.interventions, options);
      record.carbon = { ...record.carbon, ...result };
      record.carbon.methodology = document.getElementById('c-methodology').value;
      _renderCarbonResults(result);

      // Scenarios
      const scens = await MRVCalculator.scenarios(result.net_tco2e);
      _renderScenarios(scens);

      document.getElementById('carbon-results-wrap').style.display = 'block';
      toast(`Calculated: ${result.net_tco2e} tCO₂e net`, 'success');
    } catch (e) {
      toast('Calculation failed: ' + e.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = '⚡ Calculate Carbon Credits';
    }
  }

  function _renderCarbonResults(result) {
    document.getElementById('res-gross').textContent = `${result.gross_tco2e} tCO₂e`;
    document.getElementById('res-net').textContent   = `Net (after leakage ${(result.leakage_factor*100).toFixed(0)}% + permanence ${(result.permanence_factor*100).toFixed(0)}%): ${result.net_tco2e} tCO₂e`;
    document.getElementById('res-value').textContent = `₹ ${Number(result.credit_value_inr).toLocaleString('en-IN')}`;

    const names = { awd: 'AWD', soc: 'SOC', biochar: 'Biochar', agroforestry: 'Agroforestry', compost: 'Compost', residue: 'Residue' };
    const bd = document.getElementById('carbon-breakdown');
    bd.innerHTML = Object.entries(result.breakdown)
      .filter(([,v]) => v > 0)
      .map(([k, v]) => `<div class="breakdown-row"><span class="breakdown-label">${names[k.replace('_tco2e','')] || k}</span><span class="breakdown-value">${v.toFixed(4)} tCO₂e</span></div>`)
      .join('') || '<div style="color:#9ca3af;font-size:0.8rem;padding:8px">कोई intervention select नहीं है।</div>';
  }

  function _renderScenarios(scens) {
    const grid = document.getElementById('scenario-grid');
    if (!grid) return;
    grid.innerHTML = scens.map(s => `
      <div class="scenario-card">
        <div class="scenario-market">${s.market}</div>
        <div class="scenario-value">₹${s.value_inr.toLocaleString('en-IN')}</div>
        <div style="font-size:0.65rem;color:#9ca3af;margin-top:2px">@ ₹${s.price_inr}/tCO₂e</div>
      </div>`).join('');
  }

  function _calcYield() {
    const actual   = +document.getElementById('yd-actual').value  || 0;
    const price    = +document.getElementById('yd-price').value   || 0;
    const baseline = record.baseline.baseline_yield_kg || 0;

    const after    = Math.round((actual * price) / 100);  // price per quintal, yield in kg
    const before   = Math.round((baseline * price) / 100);
    const gain     = after - before;

    record.yield_data.income_after_inr  = after;
    record.yield_data.income_before_inr = before;
    record.yield_data.income_delta_inr  = gain;

    const wrap = document.getElementById('yield-comparison');
    if (actual && price) {
      wrap.style.display = 'block';
      document.getElementById('yd-before').textContent = `₹${before.toLocaleString('en-IN')}`;
      document.getElementById('yd-after').textContent  = `₹${after.toLocaleString('en-IN')}`;
      document.getElementById('yd-gain').textContent   = `₹${gain.toLocaleString('en-IN')}`;
    }
  }

  // ─── Timeline ────────────────────────────────────────────────
  function _addTimelineEvent() {
    const date     = prompt('Date (YYYY-MM-DD):') || MRVUtils.formatDateISO(new Date());
    const activity = prompt('Activity:');
    if (!activity) return;
    const notes = prompt('Notes (optional):') || '';
    record.timeline.push({ id: Date.now(), date, activity, notes, user: record.farmer?.enumerator_name || 'local' });
    _renderTimeline();
  }

  function _renderTimeline() {
    const list = document.getElementById('timeline-list');
    if (!list) return;
    if (!record.timeline.length) { list.innerHTML = '<div style="color:var(--text-muted);font-size:0.82rem;padding:8px 0">अभी कोई event नहीं। "Add Event" से जोड़ें।</div>'; return; }
    list.innerHTML = record.timeline.map(ev => `
      <div class="timeline-event">
        <div class="timeline-date">${ev.date}</div>
        <div class="timeline-activity">${ev.activity}</div>
        ${ev.notes ? `<div class="timeline-notes">${ev.notes}</div>` : ''}
      </div>`).join('');
  }

  // ─── Review Summary (Step 7) ─────────────────────────────────
  function _buildReviewSummary() {
    const f = record.farmer; const l = record.land; const c = record.carbon;
    const interventionNames = Object.entries(record.interventions)
      .filter(([,v]) => v?.enabled).map(([k]) => k.toUpperCase()).join(', ') || '—';

    document.getElementById('review-summary').innerHTML = `
      <div class="review-section">
        <div class="review-title">👨‍🌾 Farmer</div>
        <div class="review-grid">
          <div class="review-item"><span class="rlabel">Name</span><span class="rvalue">${f.name||'—'}</span></div>
          <div class="review-item"><span class="rlabel">Mobile</span><span class="rvalue">${f.mobile||'—'}</span></div>
          <div class="review-item"><span class="rlabel">Village</span><span class="rvalue">${f.village||'—'}</span></div>
          <div class="review-item"><span class="rlabel">Block / District</span><span class="rvalue">${f.block||'—'}, ${f.district||'—'}</span></div>
        </div>
      </div>
      <div class="review-section">
        <div class="review-title">🗺️ Land</div>
        <div class="review-grid">
          <div class="review-item"><span class="rlabel">Area</span><span class="rvalue">${l.area_ha||0} ha (${l.area_bigha||0} बीघा)</span></div>
          <div class="review-item"><span class="rlabel">Khasra</span><span class="rvalue">${l.khasra_number||'—'}</span></div>
          <div class="review-item"><span class="rlabel">Polygon</span><span class="rvalue">${l.polygon_coords?.length ? l.polygon_coords.length + ' vertices ✓' : 'Not drawn'}</span></div>
          <div class="review-item"><span class="rlabel">Method</span><span class="rvalue">${l.entry_method||'—'}</span></div>
        </div>
      </div>
      <div class="review-section">
        <div class="review-title">🌿 Interventions</div>
        <div class="review-grid">
          <div class="review-item" style="grid-column:1/-1"><span class="rlabel">Selected</span><span class="rvalue">${interventionNames}</span></div>
          <div class="review-item"><span class="rlabel">Gross tCO₂e</span><span class="rvalue" style="color:var(--green-light)">${c.gross_tco2e||0}</span></div>
          <div class="review-item"><span class="rlabel">Net tCO₂e</span><span class="rvalue" style="color:var(--green-light)">${c.net_tco2e||0}</span></div>
          <div class="review-item"><span class="rlabel">Credit Value</span><span class="rvalue" style="color:#fcd34d">₹${Number(c.credit_value_inr||0).toLocaleString()}</span></div>
          <div class="review-item"><span class="rlabel">Methodology</span><span class="rvalue">${c.methodology||'—'}</span></div>
        </div>
      </div>
      <div class="review-section">
        <div class="review-title">📷 Evidence</div>
        <div class="review-grid">
          <div class="review-item"><span class="rlabel">Photos</span><span class="rvalue">${record.evidence.photos.length} uploaded</span></div>
          <div class="review-item"><span class="rlabel">MRV ID</span><span class="rvalue" style="font-family:monospace;font-size:0.75rem">${record.mrv_id||'(Pending save)'}</span></div>
        </div>
      </div>`;
    _renderTimeline();
  }

  // ─── Save Draft ──────────────────────────────────────────────
  async function _saveDraft() {
    _collectFarmer();
    _collectLand();
    _collectBaseline();
    _collectInterventions();
    record.status = 'draft';
    try {
      const saved = await MRVStorage.saveRecord(record);
      record = saved;
      document.getElementById('mrv-id-display').textContent = saved.mrv_id;
      toast(`Draft saved: ${saved.mrv_id}`, 'success');
    } catch (e) { toast('Save failed: ' + e.message, 'error'); }
  }

  async function _submitRecord() {
    _collectFarmer(); _collectLand(); _collectBaseline(); _collectInterventions(); _collectCarbon();
    record.status = 'submitted'; record.submitted_at = new Date().toISOString();
    try {
      const saved = await MRVStorage.saveRecord(record);
      record = saved;
      document.getElementById('mrv-id-display').textContent = saved.mrv_id;
      toast(`✅ MRV record submitted: ${saved.mrv_id}`, 'success');
    } catch (e) { toast('Submit failed: ' + e.message, 'error'); }
  }

  // ─── Helpers ─────────────────────────────────────────────────
  function _markError(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('error');
    el.setAttribute('placeholder', msg);
    setTimeout(() => { el.classList.remove('error'); }, 3000);
  }

  function toast(msg, type = 'success') {
    const t = document.getElementById('mrv-toast');
    if (!t) return;
    t.textContent = msg; t.className = `show ${type}`;
    setTimeout(() => t.className = '', 3500);
  }

  // ─── Public API ───────────────────────────────────────────────
  return { init, goTo, toast, getRecord: () => record };

})();

// Auto-init on load
document.addEventListener('DOMContentLoaded', () => MRVWizard.init());
