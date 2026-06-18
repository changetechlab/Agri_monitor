/**
 * Agri Monitor — js/farmers.js
 * Farmer CRUD, field polygon drawing, Supabase/offline storage
 * and map visualization with health-colored polygons
 */

window.AgriFarmers = (() => {
  let farmers = [];
  let fields = [];
  let fieldLayer = L.layerGroup();
  let farmerLayer = L.layerGroup();
  let drawingActive = false;
  let pendingGeoJSON = null;
  let pendingAreaSqm = null;

  // ============================================================
  // Load data (Supabase → offline cache → dummy data)
  // ============================================================
  async function loadData() {
    if (window.AgriDB) {
      try {
        const [fResult, fdResult] = await Promise.all([
          window.AgriDB.from('farmers').select('*, villages(name, name_hindi)').limit(200),
          window.AgriDB.from('fields').select('*, farmers(name, name_hindi, village_name)').limit(500)
        ]);

        if (!fResult.error) {
          farmers = fResult.data;
          await window.AgriOffline.cacheData('farmers_cache', farmers);
        }
        if (!fdResult.error) {
          fields = fdResult.data;
          await window.AgriOffline.cacheData('fields_cache', fields);
        }
      } catch (err) {
        console.error('[Farmers] Supabase load failed, using cache:', err);
        farmers = await window.AgriOffline.getCachedData('farmers_cache');
        fields = await window.AgriOffline.getCachedData('fields_cache');
      }
    } else {
      // Demo mode — use dummy data
      farmers = window.DummyData.farmers;
      fields = window.DummyData.fields;
    }

    renderFarmerList();
    showFieldsOnMap();
    updateStats();
    window.AgriCharts && window.AgriCharts.renderAll({ farmers, fields, clf_clusters: window.DummyData.clf_clusters });

    return { farmers, fields };
  }

  // ============================================================
  // Show field polygons on map
  // ============================================================
  function showFieldsOnMap() {
    const m = window.AgriMap.getMap();
    if (!m) return;

    // Clear existing
    fieldLayer.clearLayers();
    if (!m.hasLayer(fieldLayer)) fieldLayer.addTo(m);

    const healthColors = {
      healthy: '#22c55e', moderate: '#f59e0b', stress: '#ef4444', unknown: '#6b7280'
    };

    fields.forEach(field => {
      if (!field.geojson) return;

      const farmer = farmers.find(f => f.id === field.farmer_id);
      
      // Filter by block if active
      if (window.AgriApp && window.AgriApp.state.currentBlock && window.AgriApp.state.currentBlock !== 'all') {
        if (farmer && farmer.block !== window.AgriApp.state.currentBlock) return;
      }

      const color = healthColors[field.health_status] || '#6b7280';
      const cropLabel = (window.DummyData.cropLabels || {})[field.crop_type] || field.crop_type || '';

      try {
        const layer = L.geoJSON({
          type: 'Feature',
          geometry: field.geojson,
          properties: { ...field, farmer_name: farmer?.name_hindi || farmer?.name || '' }
        }, {
          style: {
            color,
            fillColor: color,
            fillOpacity: 0.25,
            weight: 2
          },
          onEachFeature: (feature, lyr) => {
            const p = feature.properties;
            const ndviVal = p.last_ndvi_value ? p.last_ndvi_value.toFixed(2) : 'N/A';
            const healthLabel = (window.DummyData.healthLabels || {})[p.health_status] || '';
            const daysSince = p.updated_at ? Math.floor((Date.now() - new Date(p.updated_at)) / 86400000) : '?';

            lyr.bindPopup(`
              <div class="field-popup">
                <div class="popup-header">
                  <span class="health-dot" style="background:${color}"></span>
                  <strong>${p.name || 'खेत'}</strong>
                </div>
                <div class="popup-body">
                  <div>👨‍🌾 <strong>${p.farmer_name}</strong></div>
                  <div>🌱 ${cropLabel}</div>
                  <div>📏 ${p.area_sqm ? (p.area_sqm / 10000).toFixed(3) + ' हे.' : 'N/A'}</div>
                  <div>📊 NDVI: <strong>${ndviVal}</strong></div>
                  <div>🏥 स्वास्थ्य: <span class="badge-${p.health_status}">${healthLabel}</span></div>
                  <div>📅 ${daysSince} दिन पहले अपडेट</div>
                </div>
                <div class="popup-actions">
                  <button class="popup-btn primary" onclick="AgriUpload.openSurveyForField('${p.id}')">📷 सर्वे</button>
                  <button class="popup-btn" onclick="AgriFarmers.showFarmerDetail('${p.farmer_id}')">👤 किसान</button>
                </div>
              </div>
            `);

            lyr.on('mouseover', () => lyr.setStyle({ fillOpacity: 0.5, weight: 3 }));
            lyr.on('mouseout', () => lyr.setStyle({ fillOpacity: 0.25, weight: 2 }));
          }
        });
        fieldLayer.addLayer(layer);
      } catch (err) {
        console.warn('[Farmers] Could not render field:', field.id, err);
      }
    });
  }

  // ============================================================
  // Toggle field layer visibility
  // ============================================================
  function toggleFieldLayer(visible) {
    const m = window.AgriMap.getMap();
    if (!m) return;
    if (visible) fieldLayer.addTo(m);
    else m.removeLayer(fieldLayer);
  }

  // ============================================================
  // Render farmer list in sidebar
  // ============================================================
  function renderFarmerList(filterText = '', filterBlock = '') {
    const container = document.getElementById('farmer-list');
    if (!container) return;

    let filtered = farmers;
    if (filterText) {
      const q = filterText.toLowerCase();
      filtered = filtered.filter(f =>
        (f.name || '').toLowerCase().includes(q) ||
        (f.name_hindi || '').includes(q) ||
        (f.village_name || '').toLowerCase().includes(q) ||
        (f.mobile || '').includes(q)
      );
    }
    if (filterBlock && filterBlock !== 'all') {
      filtered = filtered.filter(f => f.block === filterBlock);
    }

    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-state">कोई किसान नहीं मिला</div>';
      return;
    }

    container.innerHTML = filtered.map(farmer => {
      const fieldCount = fields.filter(f => f.farmer_id === farmer.id).length;
      const cropLabel = (window.DummyData.cropLabels || {})[farmer.primary_crop] || farmer.primary_crop || '—';
      const hasStress = fields.some(f => f.farmer_id === farmer.id && f.health_status === 'stress');
      const irrigLabel = (window.DummyData.irrigationLabels || {})[farmer.irrigation_source] || farmer.irrigation_source || '—';

      return `
        <div class="farmer-card ${hasStress ? 'has-stress' : ''}" data-farmer-id="${farmer.id}" onclick="AgriFarmers.showFarmerDetail('${farmer.id}')">
          <div class="farmer-card-header">
            <div class="farmer-avatar">${farmer.is_organic ? '🌱' : '👨‍🌾'}</div>
            <div class="farmer-info">
              <div class="farmer-name">${farmer.name_hindi || farmer.name}</div>
              <div class="farmer-village">📍 ${farmer.village_name || farmer.block}</div>
            </div>
            ${hasStress ? '<span class="stress-badge">⚠️</span>' : ''}
          </div>
          <div class="farmer-card-details">
            <span>🌱 ${cropLabel}</span>
            <span>📏 ${farmer.land_holding_ha ? farmer.land_holding_ha + ' हे.' : '—'}</span>
            <span>🗺️ ${fieldCount} खेत</span>
            <span>💧 ${irrigLabel}</span>
          </div>
          <div class="farmer-card-tags">
            ${farmer.is_organic ? '<span class="tag organic">जैविक</span>' : ''}
            ${farmer.has_polyhouse ? '<span class="tag polyhouse">पॉलीहाउस</span>' : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // ============================================================
  // Show farmer detail modal
  // ============================================================
  function showFarmerDetail(farmerId) {
    const farmer = farmers.find(f => f.id === farmerId);
    if (!farmer) return;

    const farmerFields = fields.filter(f => f.farmer_id === farmerId);
    const cropLabel = (window.DummyData.cropLabels || {})[farmer.primary_crop] || farmer.primary_crop || '—';
    const irrigLabel = (window.DummyData.irrigationLabels || {})[farmer.irrigation_source] || farmer.irrigation_source || '—';

    const modal = document.getElementById('farmer-detail-modal');
    const body = document.getElementById('farmer-detail-body');
    if (!modal || !body) return;

    body.innerHTML = `
      <div class="farmer-detail">
        <div class="farmer-detail-header">
          <div class="farmer-avatar-large">${farmer.is_organic ? '🌱' : '👨‍🌾'}</div>
          <div>
            <h2>${farmer.name_hindi || farmer.name}</h2>
            <p>${farmer.name}</p>
            <div class="farmer-tags">
              ${farmer.is_organic ? '<span class="tag organic">जैविक किसान</span>' : ''}
              ${farmer.has_polyhouse ? '<span class="tag polyhouse">पॉलीहाउस</span>' : ''}
            </div>
          </div>
        </div>

        <div class="detail-grid">
          <div class="detail-item"><span>📞 मोबाइल</span><strong>${farmer.mobile || '—'}</strong></div>
          <div class="detail-item"><span>📍 गाँव</span><strong>${farmer.village_name || '—'}</strong></div>
          <div class="detail-item"><span>🏢 ब्लॉक</span><strong>${farmer.block || '—'}</strong></div>
          <div class="detail-item"><span>🌱 मुख्य फसल</span><strong>${cropLabel}</strong></div>
          <div class="detail-item"><span>📏 भूमि</span><strong>${farmer.land_holding_ha || '—'} हे.</strong></div>
          <div class="detail-item"><span>💧 सिंचाई</span><strong>${irrigLabel}</strong></div>
        </div>

        <div class="fields-section">
          <h3>🗺️ खेत (${farmerFields.length})</h3>
          ${farmerFields.map(f => {
            const hc = { healthy:'#22c55e', moderate:'#f59e0b', stress:'#ef4444', unknown:'#6b7280' }[f.health_status] || '#6b7280';
            const hl = (window.DummyData.healthLabels || {})[f.health_status] || '—';
            const cl = (window.DummyData.cropLabels || {})[f.crop_type] || f.crop_type || '—';
            return `
              <div class="field-item">
                <div class="field-health-bar" style="background:${hc}"></div>
                <div class="field-item-info">
                  <strong>${f.name || 'खेत'}</strong>
                  <span>${cl} · ${f.area_sqm ? (f.area_sqm/10000).toFixed(3) + ' हे.' : '—'}</span>
                  <span class="badge-${f.health_status}">${hl}</span>
                </div>
                <div class="field-ndvi">
                  <span>NDVI</span>
                  <strong style="color:${hc}">${f.last_ndvi_value?.toFixed(2) || 'N/A'}</strong>
                </div>
              </div>
            `;
          }).join('') || '<p class="empty-state">खेत नहीं जोड़ा</p>'}
        </div>

        <div class="farmer-actions">
          <button class="btn-action primary" onclick="AgriUpload.openSurveyForFarmer('${farmer.id}')">📷 फील्ड सर्वे</button>
          <button class="btn-action" onclick="AgriReport.generateFarmerPDF('${farmer.id}')">📄 रिपोर्ट</button>
          <button class="btn-action" onclick="AgriFarmers.focusFarmerOnMap('${farmer.id}')">🗺️ नक्शे पर देखें</button>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
  }

  // ============================================================
  // Focus on farmer's fields on map
  // ============================================================
  function focusFarmerOnMap(farmerId) {
    const farmer = farmers.find(f => f.id === farmerId);
    const farmerFields = fields.filter(f => f.farmer_id === farmerId);

    // Close modal first
    const modal = document.getElementById('farmer-detail-modal');
    if (modal) modal.classList.add('hidden');

    if (farmerFields.length > 0 && farmerFields[0].geojson) {
      // Extract center of first field
      const coords = farmerFields[0].geojson.coordinates[0];
      if (coords && coords.length > 0) {
        const avgLat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
        const avgLng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
        window.AgriMap.flyTo(avgLat, avgLng, 16);
      }
    } else if (farmer) {
      const village = window.DummyData.villages.find(v => v.id === farmer.village_id);
      if (village) window.AgriMap.flyTo(village.lat, village.lng, 13);
    }
  }

  // ============================================================
  // Add new farmer modal
  // ============================================================
  function openAddFarmerModal() {
    if (!window.AgriAuth.isLoggedIn()) {
      window.AgriAuth.showLoginModal();
      return;
    }

    const modal = document.getElementById('farmer-modal');
    if (modal) modal.classList.remove('hidden');

    // Populate village dropdown
    const villageSelect = document.getElementById('farmer-village');
    if (villageSelect) {
      const villages = window.DummyData.villages;
      villageSelect.innerHTML = '<option value="">गाँव चुनें</option>' +
        villages.map(v => `<option value="${v.id}" data-lat="${v.lat}" data-lng="${v.lng}">${v.name_hindi} — ${v.name}</option>`).join('');
    }

    // Populate CLF dropdown
    const clfSelect = document.getElementById('farmer-clf');
    if (clfSelect) {
      const clfs = window.DummyData.clf_clusters;
      clfSelect.innerHTML = '<option value="">CLF/SHG चुनें</option>' +
        clfs.map(c => `<option value="${c.id}">${c.name_hindi} — ${c.type}</option>`).join('');
    }

    // Reset drawing state
    drawingActive = false;
    pendingGeoJSON = null;
    pendingAreaSqm = null;
    updateDrawingStatus('❓ खेत का नक्शा अभी नहीं बना');
  }

  // ============================================================
  // Start drawing field polygon
  // ============================================================
  function startFieldDrawing() {
    const m = window.AgriMap.getMap();
    if (!m) return;

    // Close farmer modal temporarily to see map
    document.getElementById('farmer-modal').classList.add('hidden');
    drawingActive = true;

    // Show drawing instructions toast
    showToast('🗺️ नक्शे पर टैप करके खेत बनाएं। डबल क्लिक से खत्म करें।', 'info', 5000);

    window.AgriMap.startDrawing((geojson, areaSqm) => {
      pendingGeoJSON = geojson;
      pendingAreaSqm = areaSqm;
      drawingActive = false;

      // Reopen modal
      document.getElementById('farmer-modal').classList.remove('hidden');
      updateDrawingStatus(`✅ खेत बना: ${(areaSqm / 10000).toFixed(3)} हे. (${Math.round(areaSqm)} वर्ग मी.)`);

      // Auto-fill area
      const areaInput = document.getElementById('field-area');
      if (areaInput) areaInput.value = (areaSqm / 10000).toFixed(4);
    });
  }

  function updateDrawingStatus(msg) {
    const el = document.getElementById('drawing-status');
    if (el) el.textContent = msg;
  }

  // ============================================================
  // Save new farmer + field
  // ============================================================
  async function saveFarmer() {
    const name = document.getElementById('farmer-name').value.trim();
    const nameHindi = document.getElementById('farmer-name-hindi').value.trim();
    const mobile = document.getElementById('farmer-mobile').value.trim();
    const villageId = document.getElementById('farmer-village').value;
    const clfId = document.getElementById('farmer-clf').value;
    const primaryCrop = document.getElementById('farmer-crop').value;
    const landHolding = parseFloat(document.getElementById('farmer-land').value) || 0;
    const isOrganic = document.getElementById('farmer-organic').checked;
    const irrigationSource = document.getElementById('farmer-irrigation').value;
    const cropType = document.getElementById('field-crop').value;
    const sowingDate = document.getElementById('field-sowing').value;
    const fieldName = document.getElementById('field-name').value.trim();

    if (!name || !mobile || !villageId) {
      showToast('❌ नाम, मोबाइल और गाँव जरूरी है', 'error');
      return;
    }
    if (mobile.length < 10) {
      showToast('❌ सही मोबाइल नंबर डालें', 'error');
      return;
    }

    const village = window.DummyData.villages.find(v => v.id === villageId);
    const villageSelect = document.getElementById('farmer-village');
    const villageOpt = villageSelect.options[villageSelect.selectedIndex];

    const farmerData = {
      id: 'f' + Date.now(),
      name,
      name_hindi: nameHindi || name,
      mobile,
      village_id: villageId,
      village_name: village?.name || '',
      block: village?.block || '',
      district: 'rudraprayag',
      clf_id: clfId || null,
      land_holding_ha: landHolding,
      primary_crop: primaryCrop,
      is_organic: isOrganic,
      irrigation_source: irrigationSource,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const saveBtn = document.getElementById('btn-save-farmer');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'सहेज रहे हैं...'; }

    try {
      if (window.AgriDB) {
        const { data, error } = await window.AgriDB
          .from('farmers')
          .insert({ ...farmerData, id: undefined })
          .select()
          .single();

        if (error) throw error;
        farmerData.id = data.id;

        // Save field if polygon drawn
        if (pendingGeoJSON) {
          const fieldData = {
            farmer_id: farmerData.id,
            name: fieldName || 'मुख्य खेत',
            geojson: pendingGeoJSON,
            area_sqm: pendingAreaSqm,
            crop_type: cropType,
            sowing_date: sowingDate || null,
            irrigation_type: irrigationSource,
            health_status: 'unknown',
            updated_at: new Date().toISOString()
          };
          await window.AgriDB.from('fields').insert(fieldData);
        }
      } else {
        // Offline mode — queue for later sync
        await window.AgriOffline.queueOperation('insert', 'farmers', farmerData);

        if (pendingGeoJSON) {
          const fieldData = {
            id: 'fd' + Date.now(),
            farmer_id: farmerData.id,
            name: fieldName || 'मुख्य खेत',
            geojson: pendingGeoJSON,
            area_sqm: pendingAreaSqm,
            crop_type: cropType,
            sowing_date: sowingDate || null,
            health_status: 'unknown',
            updated_at: new Date().toISOString()
          };
          await window.AgriOffline.queueOperation('insert', 'fields', fieldData);
          fields.push(fieldData);
        }
      }

      // Update local state
      farmers.push(farmerData);

      // Re-render
      renderFarmerList();
      showFieldsOnMap();
      updateStats();

      // Close modal and clear draw
      closeAddFarmerModal();
      window.AgriMap.clearDrawLayer();
      pendingGeoJSON = null;

      showToast(`✅ किसान ${nameHindi || name} जोड़ा गया!`, 'success');

    } catch (err) {
      console.error('[Farmers] Save failed:', err);
      showToast('❌ सहेजने में त्रुटि: ' + err.message, 'error');
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'किसान सहेजें'; }
    }
  }

  // ============================================================
  // Search and filter
  // ============================================================
  function initSearch() {
    const searchInput = document.getElementById('farmer-search');
    const blockFilter = document.getElementById('farmer-block-filter');

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        renderFarmerList(searchInput.value, blockFilter?.value || '');
      });
    }
    if (blockFilter) {
      blockFilter.addEventListener('change', () => {
        renderFarmerList(searchInput?.value || '', blockFilter.value);
      });
    }
  }

  // ============================================================
  // Stats update
  // ============================================================
  function updateStats() {
    const totalFarmerEl = document.getElementById('stat-total-farmers');
    const totalFieldEl = document.getElementById('stat-total-fields');
    const stressEl = document.getElementById('stat-stress-alerts');
    const organicEl = document.getElementById('stat-organic');

    const stressCount = fields.filter(f => f.health_status === 'stress').length;
    const organicCount = farmers.filter(f => f.is_organic).length;

    if (totalFarmerEl) animateCounter(totalFarmerEl, farmers.length);
    if (totalFieldEl) animateCounter(totalFieldEl, fields.length);
    if (stressEl) animateCounter(stressEl, stressCount);
    if (organicEl) animateCounter(organicEl, organicCount);
  }

  function animateCounter(el, target) {
    const start = parseInt(el.textContent) || 0;
    const duration = 600;
    const startTime = Date.now();
    const update = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      el.textContent = Math.round(start + (target - start) * progress);
      if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  }

  // ============================================================
  // Modal helpers
  // ============================================================
  function closeAddFarmerModal() {
    const modal = document.getElementById('farmer-modal');
    if (modal) modal.classList.add('hidden');
  }

  function closeFarmerDetailModal() {
    const modal = document.getElementById('farmer-detail-modal');
    if (modal) modal.classList.add('hidden');
  }

  function showToast(msg, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, duration);
  }

  // ============================================================
  // Bind all events
  // ============================================================
  function bindEvents() {
    // Add farmer button
    const addBtn = document.getElementById('btn-add-farmer');
    if (addBtn) addBtn.addEventListener('click', openAddFarmerModal);

    // Draw field button inside modal
    const drawBtn = document.getElementById('btn-draw-field');
    if (drawBtn) drawBtn.addEventListener('click', startFieldDrawing);

    // Save farmer
    const saveBtn = document.getElementById('btn-save-farmer');
    if (saveBtn) saveBtn.addEventListener('click', saveFarmer);

    // Cancel / close modal
    const cancelBtn = document.getElementById('btn-cancel-farmer');
    if (cancelBtn) cancelBtn.addEventListener('click', () => { closeAddFarmerModal(); window.AgriMap.clearDrawLayer(); });

    const closeDetailBtn = document.getElementById('close-farmer-detail');
    if (closeDetailBtn) closeDetailBtn.addEventListener('click', closeFarmerDetailModal);

    // Search
    initSearch();
  }

  return {
    init: async () => { bindEvents(); await loadData(); },
    loadData,
    renderFarmerList,
    showFarmerDetail,
    focusFarmerOnMap,
    toggleFieldLayer,
    showFieldsOnMap,
    updateStats,
    openAddFarmerModal,
    getFarmers: () => farmers,
    getFields: () => fields
  };
})();
