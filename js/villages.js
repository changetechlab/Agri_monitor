/**
 * Agri Monitor — js/villages.js
 * ─────────────────────────────────────────────────────────────
 * Purpose  : Manage village GPS coordinates, compute agricultural
 *            analytics per village, and render GPS markers with popups.
 * Exposes  : window.AgriVillages
 */

window.AgriVillages = (() => {
  let villages = [];
  let villageLayer = L.layerGroup();
  let currentBlockFilter = 'all';

  // ============================================================
  // Initialize Module
  // ============================================================
  function init() {
    villages = window.DummyData.villages || [];
    computeVillageStats();
    showVillagesOnMap();
    console.log('[Villages] Module initialized with', villages.length, 'villages.');
  }

  // ============================================================
  // Compute Real-time Agricultural Analytics per Village
  // ============================================================
  function computeVillageStats() {
    const farmers = window.AgriFarmers ? window.AgriFarmers.getFarmers() : [];
    const fields = window.AgriFarmers ? window.AgriFarmers.getFields() : [];
    const cropLabels = window.DummyData.cropLabels || {};

    villages = villages.map(village => {
      // Find farmers in this village
      const villageFarmers = farmers.filter(f => f.village_id === village.id || f.village_name.toLowerCase() === village.name.toLowerCase());
      const farmerIds = new Set(villageFarmers.map(f => f.id));

      // Find fields for these farmers
      const villageFields = fields.filter(f => farmerIds.has(f.farmer_id));

      // Mapped stats
      const farmerCount = villageFarmers.length;
      const fieldCount = villageFields.length;
      const organicCount = villageFarmers.filter(f => f.is_organic).length;
      const polyhouseCount = villageFarmers.filter(f => f.has_polyhouse || villageFields.some(fd => fd.id === 'fd7' && f.id === fd.farmer_id)).length; // fallback check

      // Average NDVI
      const validNDVIs = villageFields.filter(f => f.last_ndvi_value !== null && f.last_ndvi_value !== undefined).map(f => f.last_ndvi_value);
      const avgNDVI = validNDVIs.length > 0 ? validNDVIs.reduce((s, v) => s + v, 0) / validNDVIs.length : null;

      // Primary crops
      const cropCounts = {};
      villageFarmers.forEach(f => {
        if (f.primary_crop) {
          cropCounts[f.primary_crop] = (cropCounts[f.primary_crop] || 0) + 1;
        }
      });
      let mainCrop = '—';
      let maxCount = 0;
      Object.entries(cropCounts).forEach(([crop, count]) => {
        if (count > maxCount) {
          maxCount = count;
          mainCrop = cropLabels[crop] || crop;
        }
      });

      return {
        ...village,
        farmerCount,
        fieldCount,
        organicCount,
        polyhouseCount,
        avgNDVI,
        mainCrop
      };
    });
  }

  // ============================================================
  // Show Village markers on map
  // ============================================================
  function showVillagesOnMap() {
    const m = window.AgriMap.getMap();
    if (!m) return;

    villageLayer.clearLayers();

    const ndviColor = (val) => {
      if (val === null || val === undefined) return 'var(--text-muted)';
      if (val >= 0.45) return 'var(--green)';
      if (val >= 0.25) return 'var(--yellow)';
      return 'var(--red)';
    };

    const ndviHealthText = (val) => {
      if (val === null || val === undefined) return 'अज्ञात';
      if (val >= 0.45) return 'स्वस्थ';
      if (val >= 0.25) return 'मध्यम';
      return 'तनाव';
    };

    villages.forEach(v => {
      // Filter by block
      if (currentBlockFilter !== 'all' && v.block !== currentBlockFilter) {
        return;
      }

      if (!v.lat || !v.lng) return;

      const healthColor = ndviColor(v.avgNDVI);

      // Custom Leaflet DivIcon for premium styling
      const icon = L.divIcon({
        html: `
          <div class="village-marker" style="--health-color: ${healthColor}">
            <div class="village-pin">🏡</div>
            <div class="village-label">${v.name_hindi}</div>
          </div>
        `,
        className: '',
        iconSize: [60, 48],
        iconAnchor: [30, 40]
      });

      const marker = L.marker([v.lat, v.lng], { icon });

      // Rich GPS interactive popup
      marker.bindPopup(`
        <div class="village-popup">
          <div class="popup-header">
            <strong>🏡 गाँव: ${v.name_hindi} (${v.name})</strong>
            <span class="block-badge">📍 ${v.block === 'Ukhimath' ? 'ऊखीमठ' : v.block === 'Jakholi' ? 'जखोली' : 'अगस्त्यमुनि'} ब्लॉक</span>
          </div>
          <div class="popup-body">
            <div class="popup-stat-row">
              <span>👨‍🌾 पंजीकृत किसान:</span>
              <strong>${v.farmerCount}</strong>
            </div>
            <div class="popup-stat-row">
              <span>🗺️ कुल खेत:</span>
              <strong>${v.fieldCount}</strong>
            </div>
            <div class="popup-stat-row">
              <span>🌾 मुख्य फसल:</span>
              <strong>${v.mainCrop}</strong>
            </div>
            <div class="popup-stat-row">
              <span>📊 औसत NDVI:</span>
              <strong style="color:${healthColor}">${v.avgNDVI ? v.avgNDVI.toFixed(2) : '—'} (${ndviHealthText(v.avgNDVI)})</strong>
            </div>
            <div class="popup-stat-row">
              <span>🌱 जैविक किसान:</span>
              <strong>${v.organicCount}</strong>
            </div>
            <div class="popup-stat-row">
              <span>🏗️ पॉलीहाउस:</span>
              <strong>${v.polyhouseCount}</strong>
            </div>
          </div>
          <div class="popup-actions">
            <button class="popup-btn primary" onclick="AgriVillages.filterFarmersByVillage('${v.name}', '${v.name_hindi}')">🌾 किसान सूची</button>
            <button class="popup-btn" onclick="AgriMap.flyTo(${v.lat}, ${v.lng}, 15)">🔍 ज़ूम करें</button>
          </div>
        </div>
      `);

      villageLayer.addLayer(marker);
    });

    // Ensure layer is added if active
    if (window.AgriLayers && window.AgriLayers.getState('villages') && !m.hasLayer(villageLayer)) {
      villageLayer.addTo(m);
    }
  }

  // ============================================================
  // Filter Farmer directory by Village
  // ============================================================
  function filterFarmersByVillage(villageName, villageNameHindi) {
    // Switch to Farmers tab
    if (window.AgriApp) {
      window.AgriApp.switchTab('farmers');
    }

    // Set search text to village name
    const searchInput = document.getElementById('farmer-search');
    if (searchInput) {
      searchInput.value = villageNameHindi || villageName;
      // Trigger input event to filter list
      searchInput.dispatchEvent(new Event('input'));
    }

    if (window.AgriApp) {
      window.AgriApp.showToast(`🌾 ${villageNameHindi || villageName} के किसान छाने गए`, 'info');
    }
  }

  // ============================================================
  // Toggle Layer visibility
  // ============================================================
  function toggleLayer(visible) {
    const m = window.AgriMap.getMap();
    if (!m) return;

    if (visible) {
      if (!m.hasLayer(villageLayer)) villageLayer.addTo(m);
    } else {
      if (m.hasLayer(villageLayer)) m.removeLayer(villageLayer);
    }
  }

  // ============================================================
  // Handle Block filtering
  // ============================================================
  function setBlockFilter(blockName) {
    currentBlockFilter = blockName;
    computeVillageStats();
    showVillagesOnMap();
  }

  return {
    init,
    toggleLayer,
    setBlockFilter,
    showVillagesOnMap,
    filterFarmersByVillage,
    getVillages: () => villages
  };
})();
