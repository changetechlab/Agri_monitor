/**
 * Agri Monitor — js/clf.js
 * CLF Cluster dashboard analytics and map visualization
 */

window.AgriCLF = (() => {
  let clfClusters = [];
  let clfLayer = L.layerGroup();

  // ============================================================
  // Load CLF data
  // ============================================================
  async function loadCLF() {
    if (window.AgriDB) {
      try {
        const { data, error } = await window.AgriDB
          .from('clf_clusters')
          .select('*');
        if (!error && data) clfClusters = data;
      } catch (err) {
        clfClusters = window.DummyData.clf_clusters;
      }
    } else {
      clfClusters = window.DummyData.clf_clusters;
    }

    // Compute analytics from farmer/field data
    computeAnalytics();
    renderCLFCards();
    showCLFOnMap();
  }

  // ============================================================
  // Compute analytics per CLF
  // ============================================================
  function computeAnalytics() {
    const farmers = window.AgriFarmers.getFarmers();
    const fields = window.AgriFarmers.getFields();

    clfClusters = clfClusters.map(clf => {
      const clfFarmers = farmers.filter(f => f.clf_id === clf.id);
      const clfFarmerIds = new Set(clfFarmers.map(f => f.id));
      const clfFields = fields.filter(f => clfFarmerIds.has(f.farmer_id));

      const stressFields = clfFields.filter(f => f.health_status === 'stress');
      const healthyFields = clfFields.filter(f => f.health_status === 'healthy');
      const moderateFields = clfFields.filter(f => f.health_status === 'moderate');
      const totalArea = clfFields.reduce((s, f) => s + (f.area_sqm || 0), 0);
      const avgNDVI = clfFields.length > 0
        ? clfFields.reduce((s, f) => s + (f.last_ndvi_value || 0), 0) / clfFields.length
        : null;
      const organicCount = clfFarmers.filter(f => f.is_organic).length;
      const polyhouseCount = clfFarmers.filter(f => f.has_polyhouse).length;

      return {
        ...clf,
        _farmers: clfFarmers,
        _fields: clfFields,
        _stressFields: stressFields.length,
        _healthyFields: healthyFields.length,
        _moderateFields: moderateFields.length,
        _totalFieldArea_ha: totalArea / 10000,
        _avgNDVI: avgNDVI,
        _organicCount: organicCount,
        _polyhouseCount: polyhouseCount
      };
    });
  }

  // ============================================================
  // Render CLF summary cards
  // ============================================================
  function renderCLFCards() {
    const container = document.getElementById('clf-list');
    if (!container) return;

    if (clfClusters.length === 0) {
      container.innerHTML = '<div class="empty-state">कोई CLF नहीं मिला</div>';
      return;
    }

    container.innerHTML = clfClusters.map(clf => {
      const stressRatio = clf._fields?.length > 0 ? clf._stressFields / clf._fields.length : 0;
      const healthColor = stressRatio > 0.4 ? '#ef4444' : stressRatio > 0.2 ? '#f59e0b' : '#22c55e';

      return `
        <div class="clf-card" onclick="AgriCLF.showCLFDetail('${clf.id}')">
          <div class="clf-card-header">
            <div class="clf-type-badge">${clf.type}</div>
            <h3>${clf.name_hindi || clf.name}</h3>
            <div class="clf-block">📍 ${clf.block}</div>
          </div>
          <div class="clf-stats-grid">
            <div class="clf-stat">
              <span class="clf-stat-value">${clf._farmers?.length || clf.total_members}</span>
              <span class="clf-stat-label">👨‍🌾 किसान</span>
            </div>
            <div class="clf-stat">
              <span class="clf-stat-value">${clf._fields?.length || 0}</span>
              <span class="clf-stat-label">🗺️ खेत</span>
            </div>
            <div class="clf-stat">
              <span class="clf-stat-value" style="color:${healthColor}">${clf._stressFields || 0}</span>
              <span class="clf-stat-label">⚠️ तनाव</span>
            </div>
            <div class="clf-stat">
              <span class="clf-stat-value">${clf._totalFieldArea_ha?.toFixed(1) || '—'}</span>
              <span class="clf-stat-label">📏 हे.</span>
            </div>
          </div>
          <div class="clf-health-bar">
            <div class="health-segment healthy" style="width:${getHealthPct(clf, 'healthy')}%"></div>
            <div class="health-segment moderate" style="width:${getHealthPct(clf, 'moderate')}%"></div>
            <div class="health-segment stress" style="width:${getHealthPct(clf, 'stress')}%"></div>
          </div>
          <div class="clf-ndvi">
            <span>औसत NDVI: </span>
            <strong style="color:${ndviColor(clf._avgNDVI)}">${clf._avgNDVI ? clf._avgNDVI.toFixed(2) : 'N/A'}</strong>
          </div>
          ${clf._organicCount > 0 ? `<div class="clf-tags"><span class="tag organic">${clf._organicCount} जैविक</span></div>` : ''}
        </div>
      `;
    }).join('');
  }

  function getHealthPct(clf, status) {
    const total = clf._fields?.length || 1;
    const count = status === 'healthy' ? clf._healthyFields :
                  status === 'moderate' ? clf._moderateFields : clf._stressFields;
    return Math.round(((count || 0) / total) * 100);
  }

  function ndviColor(val) {
    if (val === null || val === undefined) return '#6b7280';
    if (val >= 0.45) return '#22c55e';
    if (val >= 0.25) return '#f59e0b';
    return '#ef4444';
  }

  // ============================================================
  // Show CLF detail panel
  // ============================================================
  function showCLFDetail(clfId) {
    const clf = clfClusters.find(c => c.id === clfId);
    if (!clf) return;

    // Focus on map
    if (clf.lat && clf.lng) {
      window.AgriMap.flyTo(clf.lat, clf.lng, 13);
    }

    // Update tab header
    const detailPanel = document.getElementById('clf-detail-panel');
    if (detailPanel) {
      detailPanel.classList.remove('hidden');
      const body = document.getElementById('clf-detail-body');
      if (body) {
        body.innerHTML = `
          <div class="clf-detail-header">
            <button onclick="document.getElementById('clf-detail-panel').classList.add('hidden')" class="back-btn">← वापस</button>
            <h2>${clf.name_hindi || clf.name}</h2>
            <span class="clf-type-badge">${clf.type}</span>
          </div>
          <div class="clf-detail-stats">
            <div class="stat-big"><strong>${clf._farmers?.length || clf.total_members}</strong><span>कुल किसान</span></div>
            <div class="stat-big"><strong>${clf.active_members || clf._farmers?.length}</strong><span>सक्रिय</span></div>
            <div class="stat-big" style="color:${ndviColor(clf._avgNDVI)}"><strong>${clf._avgNDVI?.toFixed(2) || '—'}</strong><span>औसत NDVI</span></div>
            <div class="stat-big"><strong>${clf._totalFieldArea_ha?.toFixed(1) || '—'} हे.</strong><span>कुल क्षेत्र</span></div>
          </div>
          <div class="clf-contact">
            <strong>📞 ${clf.contact_name || '—'}</strong> · ${clf.contact_mobile || '—'}
          </div>
          <h3 style="margin:12px 0 8px">फसल स्वास्थ्य</h3>
          <div class="clf-health-detail">
            <div class="health-detail-item healthy"><span>✅ स्वस्थ</span><strong>${clf._healthyFields || 0}</strong></div>
            <div class="health-detail-item moderate"><span>⚠️ मध्यम</span><strong>${clf._moderateFields || 0}</strong></div>
            <div class="health-detail-item stress"><span>🆘 तनाव</span><strong>${clf._stressFields || 0}</strong></div>
          </div>
          <div class="clf-actions">
            <button class="btn-action primary" onclick="AgriReport.generateCLFSummary('${clf.id}')">📄 CLF रिपोर्ट</button>
            <button class="btn-action" onclick="AgriCLF.exportCSV('${clf.id}')">📊 CSV</button>
          </div>
        `;
      }
    }
  }

  // ============================================================
  // Show CLF markers on map
  // ============================================================
  function showCLFOnMap() {
    const m = window.AgriMap.getMap();
    if (!m) return;

    clfLayer.clearLayers();
    if (!m.hasLayer(clfLayer)) clfLayer.addTo(m);

    clfClusters.forEach(clf => {
      if (!clf.lat || !clf.lng) return;

      // Filter by block if active
      if (window.AgriApp && window.AgriApp.state.currentBlock && window.AgriApp.state.currentBlock !== 'all') {
        if (clf.block !== window.AgriApp.state.currentBlock) return;
      }

      const stressRatio = clf._fields?.length > 0 ? clf._stressFields / clf._fields.length : 0;
      const color = stressRatio > 0.4 ? '#ef4444' : stressRatio > 0.2 ? '#f59e0b' : '#14b8a6';

      const icon = L.divIcon({
        html: `<div class="clf-marker" style="background:${color}">
                 <span>${clf.type === 'FPO' ? '🏭' : '👥'}</span>
                 <div class="clf-marker-label">${clf.name_hindi?.split(' ')[0] || clf.name}</div>
               </div>`,
        className: '',
        iconSize: [60, 44],
        iconAnchor: [30, 44]
      });

      const marker = L.marker([clf.lat, clf.lng], { icon });
      marker.bindPopup(`
        <div class="clf-popup">
          <strong>${clf.name_hindi || clf.name}</strong><br>
          प्रकार: ${clf.type}<br>
          किसान: ${clf._farmers?.length || clf.total_members}<br>
          खेत: ${clf._fields?.length || '—'}<br>
          NDVI: ${clf._avgNDVI?.toFixed(2) || 'N/A'}<br>
          <button class="popup-btn" onclick="AgriCLF.showCLFDetail('${clf.id}')">विवरण</button>
        </div>
      `);
      clfLayer.addLayer(marker);
    });
  }

  // ============================================================
  // Toggle CLF layer
  // ============================================================
  function toggleLayer(visible) {
    const m = window.AgriMap.getMap();
    if (!m) return;
    if (visible) clfLayer.addTo(m);
    else m.removeLayer(clfLayer);
  }

  // ============================================================
  // Export CLF farmer list as CSV
  // ============================================================
  function exportCSV(clfId) {
    const clf = clfClusters.find(c => c.id === clfId);
    if (!clf) return;

    const farmers = clf._farmers || [];
    const fields = window.AgriFarmers.getFields();

    const rows = [['नाम', 'मोबाइल', 'गाँव', 'फसल', 'भूमि (हे.)', 'जैविक', 'खेत', 'स्वास्थ्य']];
    farmers.forEach(f => {
      const farmerFields = fields.filter(fd => fd.farmer_id === f.id);
      const health = farmerFields.length > 0 ? farmerFields[0].health_status : '—';
      rows.push([
        f.name, f.mobile, f.village_name,
        (window.DummyData.cropLabels || {})[f.primary_crop] || f.primary_crop || '—',
        f.land_holding_ha,
        f.is_organic ? 'हाँ' : 'नहीं',
        farmerFields.length,
        (window.DummyData.healthLabels || {})[health] || health
      ]);
    });

    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${clf.name}_farmers_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ============================================================
  // Update CLF count stat
  // ============================================================
  function updateStats() {
    const el = document.getElementById('stat-clf-count');
    if (el) el.textContent = clfClusters.length;
  }

  return {
    init: async () => { await loadCLF(); updateStats(); },
    loadCLF,
    renderCLFCards,
    showCLFDetail,
    showCLFOnMap,
    toggleLayer,
    exportCSV,
    getClusters: () => clfClusters
  };
})();
