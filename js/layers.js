/**
 * Agri Monitor — js/layers.js
 * All map layer definitions, toggles, and legend management
 * 10 agriculture + risk layers with realistic GIS styling
 */

window.AgriLayers = (() => {
  const map = () => window.AgriMap.getMap();
  const layerGroups = {};
  const layerStates = {};

  // ============================================================
  // Layer Definitions (realistic sample GeoJSON coverage)
  // ============================================================

  // Helper: create simple polygon covering a district area
  function districtPolygon(coords, props) {
    return {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [coords] },
      properties: props
    };
  }

  const LAYER_DEFINITIONS = {
    // 1. NDVI — handled separately by ndvi.js
    ndvi: { label: 'NDVI उपग्रह', label_hi: 'NDVI', emoji: '🛰️', managed_by: 'ndvi' },

    // 2. Crop Health (colored field polygons by health status)
    crop_health: {
      label: 'Crop Health', label_hi: 'फसल स्वास्थ्य', emoji: '🌾',
      type: 'geojson', managed_by: 'farmers'
    },

    // 3. Irrigation coverage zones
    irrigation: {
      label: 'Irrigation', label_hi: 'सिंचाई क्षेत्र', emoji: '💧',
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          districtPolygon([[79.05,30.37],[79.08,30.37],[79.08,30.41],[79.05,30.41],[79.05,30.37]], { name: 'Mandakini Canal Zone', type: 'canal', coverage_ha: 450 }),
          districtPolygon([[79.22,30.47],[79.26,30.47],[79.26,30.50],[79.22,30.50],[79.22,30.47]], { name: 'Ukhimath Irrigation Belt', type: 'spring', coverage_ha: 120 }),
          districtPolygon([[79.09,30.32],[79.12,30.32],[79.12,30.35],[79.09,30.35],[79.09,30.32]], { name: 'Jakholi Canal Area', type: 'canal', coverage_ha: 280 }),
        ]
      },
      style: { color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.2, weight: 1.5, dashArray: '4,4' },
      popup: (p) => `💧 <strong>${p.name}</strong><br>प्रकार: ${p.type}<br>क्षेत्र: ${p.coverage_ha} हे.`
    },

    // 4. Organic Farming zones
    organic: {
      label: 'Organic Farming', label_hi: 'जैविक खेती', emoji: '🌱',
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          districtPolygon([[79.24,30.48],[79.26,30.48],[79.26,30.50],[79.24,30.50],[79.24,30.48]], { name: 'Ukhimath Organic Cluster', certified: true, farmers: 18, area_ha: 22 }),
          districtPolygon([[79.09,30.31],[79.11,30.31],[79.11,30.33],[79.09,30.33],[79.09,30.31]], { name: 'Jakholi Organic Zone', certified: false, farmers: 12, area_ha: 15 }),
          districtPolygon([[79.05,30.38],[79.07,30.38],[79.07,30.40],[79.05,30.40],[79.05,30.38]], { name: 'Augustyamuni Organic Belt', certified: true, farmers: 24, area_ha: 31 }),
        ]
      },
      style: { color: '#16a34a', fillColor: '#22c55e', fillOpacity: 0.25, weight: 1.5 },
      popup: (p) => `🌱 <strong>${p.name}</strong><br>किसान: ${p.farmers}<br>क्षेत्र: ${p.area_ha} हे.<br>${p.certified ? '✅ प्रमाणित' : '⏳ प्रमाणन प्रक्रिया में'}`
    },

    // 5. Polyhouse / Protected Agriculture
    polyhouse: {
      label: 'Polyhouse', label_hi: 'पॉलीहाउस', emoji: '🏗️',
      type: 'markers',
      data: [
        { lat: 30.5095, lng: 79.2595, name: 'Savita Tomato Polyhouse', crop: 'tomato', area_sqm: 800, farmer: 'सविता भंडारी' },
        { lat: 30.4860, lng: 79.2455, name: 'Rekha Capsicum Unit', crop: 'capsicum', area_sqm: 500, farmer: 'रेखा रानी चौहान' },
        { lat: 30.3815, lng: 79.0555, name: 'Dinesh Apple Nursery', crop: 'apple', area_sqm: 1200, farmer: 'दिनेश लाल शाह' },
        { lat: 30.3825, lng: 79.0575, name: 'Pushpa Vegetable Unit', crop: 'vegetable', area_sqm: 600, farmer: 'पुष्पा देवी किमोठी' },
      ],
      markerStyle: { color: '#a855f7', fillColor: '#a855f7', radius: 8, fillOpacity: 0.8 },
      popup: (p) => `🏗️ <strong>${p.name}</strong><br>किसान: ${p.farmer}<br>फसल: ${p.crop}<br>क्षेत्र: ${p.area_sqm} वर्ग मी.`
    },

    // 6. Horticulture Belts
    horticulture: {
      label: 'Horticulture', label_hi: 'बागवानी', emoji: '🍎',
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          districtPolygon([[79.04,30.38],[79.09,30.38],[79.09,30.43],[79.04,30.43],[79.04,30.38]], { name: 'Augustyamuni Apple Belt', dominant_crop: 'apple', area_ha: 580, avg_yield_mt: 12 }),
          districtPolygon([[79.22,30.47],[79.28,30.47],[79.28,30.53],[79.22,30.53],[79.22,30.47]], { name: 'Ukhimath Horticulture Zone', dominant_crop: 'mixed fruit', area_ha: 320, avg_yield_mt: 8 }),
        ]
      },
      style: { color: '#f97316', fillColor: '#fb923c', fillOpacity: 0.2, weight: 1.5 },
      popup: (p) => `🍎 <strong>${p.name}</strong><br>मुख्य फसल: ${p.dominant_crop}<br>क्षेत्र: ${p.area_ha} हे.`
    },

    // 7. CLF/FPO Clusters
    clf_clusters: {
      label: 'CLF / FPO Clusters', label_hi: 'CLF/FPO समूह', emoji: '👩‍🌾',
      type: 'markers', managed_by: 'clf'
    },

    // 7b. Villages GPS Markers
    villages: {
      label: 'Villages', label_hi: 'गाँव (GPS लोकेटर)', emoji: '🏡',
      type: 'markers', managed_by: 'villages'
    },

    // 8. Flood Risk Zones
    flood_risk: {
      label: 'Flood Risk', label_hi: 'बाढ़ खतरा', emoji: '🌊',
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          districtPolygon([[79.06,30.36],[79.10,30.36],[79.10,30.39],[79.06,30.39],[79.06,30.36]], { name: 'Mandakini Flood Plain', risk: 'high', last_event: '2023' }),
          districtPolygon([[79.03,30.40],[79.07,30.40],[79.07,30.42],[79.03,30.42],[79.03,30.40]], { name: 'Tilwara Risk Zone', risk: 'medium', last_event: '2021' }),
        ]
      },
      style: { color: '#dc2626', fillColor: '#ef4444', fillOpacity: 0.25, weight: 1, dashArray: '6,3' },
      popup: (p) => `🌊 <strong>${p.name}</strong><br>जोखिम: ${p.risk === 'high' ? '🔴 उच्च' : '🟡 मध्यम'}<br>अंतिम घटना: ${p.last_event}`
    },

    // 9. Landslide Risk Zones
    landslide_risk: {
      label: 'Landslide Risk', label_hi: 'भूस्खलन खतरा', emoji: '⛰️',
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          districtPolygon([[79.24,30.50],[79.27,30.50],[79.27,30.53],[79.24,30.53],[79.24,30.50]], { name: 'Ukhimath Slide Zone', risk: 'high', slope_deg: 42 }),
          districtPolygon([[79.10,30.32],[79.13,30.32],[79.13,30.35],[79.10,30.35],[79.10,30.32]], { name: 'Jakholi Slope Risk', risk: 'medium', slope_deg: 28 }),
          districtPolygon([[79.07,30.41],[79.09,30.41],[79.09,30.43],[79.07,30.43],[79.07,30.41]], { name: 'Augustyamuni Cut Zone', risk: 'low', slope_deg: 18 }),
        ]
      },
      style: { color: '#ea580c', fillColor: '#f97316', fillOpacity: 0.25, weight: 1, dashArray: '4,4' },
      popup: (p) => `⛰️ <strong>${p.name}</strong><br>जोखिम: ${p.risk}<br>ढलान: ${p.slope_deg}°`
    },

    // 10. Forest Fire Risk
    fire_risk: {
      label: 'Forest Fire Risk', label_hi: 'वन अग्नि जोखिम', emoji: '🔥',
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          districtPolygon([[79.18,30.44],[79.23,30.44],[79.23,30.49],[79.18,30.49],[79.18,30.44]], { name: 'Kedarnath Buffer Fire Zone', risk: 'high', forest_type: 'pine' }),
          districtPolygon([[79.12,30.35],[79.16,30.35],[79.16,30.39],[79.12,30.39],[79.12,30.35]], { name: 'Jakholi Pine Forest', risk: 'medium', forest_type: 'pine' }),
        ]
      },
      style: { color: '#b45309', fillColor: '#f97316', fillOpacity: 0.25, weight: 1, dashArray: '4,2' },
      popup: (p) => `🔥 <strong>${p.name}</strong><br>जोखिम: ${p.risk}<br>वन प्रकार: ${p.forest_type}`
    },

    // 11. Temples & Landmarks
    temples: {
      label: 'Temples & Landmarks', label_hi: '🙏 मंदिर व धार्मिक स्थल', emoji: '🙏',
      type: 'markers',
      data: [
        { lat: 30.7352, lng: 79.0669, name: 'Kedarnath Temple', name_hi: 'श्री केदारनाथ मंदिर', block: 'Ukhimath', desc: 'द्वादश ज्योतिर्लिंगों में से एक, मंदाकिनी नदी के उद्गम पर स्थित भव्य मंदिर।' },
        { lat: 30.6433, lng: 78.9867, name: 'Triyuginarayan Temple', name_hi: 'त्रियुगीनारायण मंदिर', block: 'Ukhimath', desc: 'भगवान शिव और माता पार्वती के विवाह स्थल के रूप में प्रसिद्ध, अखंड धूनी।' },
        { lat: 30.4886, lng: 79.2173, name: 'Tungnath Temple', name_hi: 'तुंगनाथ मंदिर', block: 'Ukhimath', desc: 'विश्व का सबसे ऊँचा शिव मंदिर, तृतीय केदार।' },
        { lat: 30.6288, lng: 79.2185, name: 'Madhyamaheshwar Temple', name_hi: 'मध्यमहेश्वर मंदिर', block: 'Ukhimath', desc: 'द्वितीय केदार, चौखम्बा शिखर के चरणों में स्थित।' },
        { lat: 30.5695, lng: 79.1171, name: 'Kalimath Temple', name_hi: 'कालीमठ मंदिर', block: 'Ukhimath', desc: 'महान सिद्धपीठ, जहां माता काली की पूजा कुंड रूप में होती है।' },
        { lat: 30.4855, lng: 79.2437, name: 'Omkareshwar Temple', name_hi: 'ओंकारेश्वर मंदिर, ऊखीमठ', block: 'Ukhimath', desc: 'केदारनाथ जी का शीतकालीन गद्दी स्थल।' },
        { lat: 30.2980, lng: 79.0253, name: 'Kartik Swami Temple', name_hi: 'कार्तिक स्वामी मंदिर', block: 'Augustyamuni', desc: 'क्रौंच पर्वत पर स्थित, भगवान कार्तिकेय को समर्पित भव्य शिखर मंदिर।' },
        { lat: 30.2942, lng: 78.9890, name: 'Koteshwar Mahadev Temple', name_hi: 'कोटेश्वर महादेव', block: 'Augustyamuni', desc: 'अलकनंदा नदी के तट पर गुफा में स्थित अति प्राचीन शिव मंदिर।' }
      ],
      markerStyle: { color: '#f97316', fillColor: '#ea580c', radius: 8, fillOpacity: 0.9 },
      popup: (p) => `
        <div class="temple-popup" style="padding:4px;width:200px;font-family:var(--font-hindi)">
          <div style="border-bottom:1px solid var(--border);padding-bottom:4px;margin-bottom:6px;">
            <strong style="color:var(--orange);font-size:12px;">🙏 ${p.name_hi}</strong><br>
            <span style="font-size:9.5px;background:rgba(249,115,22,0.15);color:var(--orange);padding:1px 5px;border-radius:3px;font-weight:600;">📍 ${p.block === 'Ukhimath' ? 'ऊखीमठ' : 'अगस्त्यमुनि'} ब्लॉक</span>
          </div>
          <p style="font-size:11.5px;color:var(--text-secondary);line-height:1.4;margin:0;">${p.desc}</p>
          <button class="popup-btn" style="width:100%;margin-top:8px;font-size:10px;padding:4px;" onclick="AgriMap.flyTo(${p.lat}, ${p.lng}, 15)">🔍 ज़ूम करें</button>
        </div>
      `
    }
  };

  // ============================================================
  // Create and add a layer to map
  // ============================================================
  function createLayer(id) {
    const def = LAYER_DEFINITIONS[id];
    if (!def) return null;

    // Externally managed layers (by other modules)
    if (def.managed_by) return null;

    const group = L.layerGroup();

    if (def.type === 'geojson' && def.data) {
      L.geoJSON(def.data, {
        style: def.style,
        onEachFeature: (feature, layer) => {
          if (def.popup) {
            layer.bindPopup(def.popup(feature.properties));
          }
          // Hover effect
          layer.on('mouseover', () => layer.setStyle({ fillOpacity: (def.style.fillOpacity || 0.2) + 0.15 }));
          layer.on('mouseout', () => layer.setStyle(def.style));
        }
      }).addTo(group);
    }

    if (def.type === 'markers' && def.data) {
      def.data.forEach(item => {
        // Filter by block if active
        if (window.AgriApp && window.AgriApp.state.currentBlock && window.AgriApp.state.currentBlock !== 'all') {
          if (item.block && item.block !== window.AgriApp.state.currentBlock) return;
        }

        const marker = L.circleMarker([item.lat, item.lng], {
          ...def.markerStyle,
          weight: 2
        });
        if (def.popup) marker.bindPopup(def.popup(item));
        marker.addTo(group);
      });
    }

    return group;
  }

  // ============================================================
  // Toggle layer on/off
  // ============================================================
  function toggleLayer(id, visible) {
    const m = map();
    if (!m) return;

    // For NDVI — delegate to ndvi module
    if (id === 'ndvi') {
      if (window.AgriNDVI) window.AgriNDVI.toggle(visible);
      layerStates[id] = visible;
      return;
    }

    // For crop health — delegate to farmers module
    if (id === 'crop_health') {
      if (window.AgriFarmers) window.AgriFarmers.toggleFieldLayer(visible);
      layerStates[id] = visible;
      return;
    }

    // For CLF clusters — delegate to clf module
    if (id === 'clf_clusters') {
      if (window.AgriCLF) window.AgriCLF.toggleLayer(visible);
      layerStates[id] = visible;
      return;
    }

    // For Villages — delegate to villages module
    if (id === 'villages') {
      if (window.AgriVillages) window.AgriVillages.toggleLayer(visible);
      layerStates[id] = visible;
      renderLegend();
      return;
    }

    if (visible) {
      if (!layerGroups[id]) {
        layerGroups[id] = createLayer(id);
      }
      if (layerGroups[id] && !m.hasLayer(layerGroups[id])) {
        m.addLayer(layerGroups[id]);
      }
    } else {
      if (layerGroups[id] && m.hasLayer(layerGroups[id])) {
        m.removeLayer(layerGroups[id]);
      }
    }
    layerStates[id] = visible;
  }

  // ============================================================
  // Initialize all layer toggles from sidebar checkboxes
  // ============================================================
  function initLayerToggles() {
    document.querySelectorAll('.layer-toggle-input').forEach(input => {
      const layerId = input.dataset.layer;
      if (!layerId) return;

      // Set initial state
      layerStates[layerId] = input.checked;
      if (input.checked) toggleLayer(layerId, true);

      input.addEventListener('change', () => {
        toggleLayer(layerId, input.checked);
      });
    });
  }

  // ============================================================
  // Render legend for active layers
  // ============================================================
  function renderLegend() {
    const container = document.getElementById('map-legend-content');
    if (!container) return;

    container.innerHTML = '';

    Object.entries(LAYER_DEFINITIONS).forEach(([id, def]) => {
      if (!layerStates[id]) return;

      const item = document.createElement('div');
      item.className = 'legend-item';

      if (def.style) {
        item.innerHTML = `
          <span class="legend-swatch" style="background:${def.style.fillColor || def.style.color};opacity:${def.style.fillOpacity || 0.7};border:2px solid ${def.style.color}"></span>
          <span>${def.emoji} ${def.label_hi || def.label}</span>
        `;
      } else {
        item.innerHTML = `<span>${def.emoji} ${def.label_hi || def.label}</span>`;
      }
      container.appendChild(item);
    });

    // NDVI legend
    if (layerStates['ndvi']) {
      const ndviLegend = document.createElement('div');
      ndviLegend.className = 'legend-item ndvi-legend';
      ndviLegend.innerHTML = `
        <strong>🛰️ NDVI स्केल</strong>
        <div class="ndvi-gradient-bar"></div>
        <div class="ndvi-labels"><span>-1</span><span>0</span><span>+1</span></div>
      `;
      container.appendChild(ndviLegend);
    }

    // Crop health legend
    if (layerStates['crop_health']) {
      const cropLegend = document.createElement('div');
      cropLegend.className = 'legend-item';
      cropLegend.innerHTML = `
        <strong>🌾 फसल स्वास्थ्य</strong>
        <div class="health-legend">
          <span><i class="dot" style="background:#22c55e"></i> स्वस्थ</span>
          <span><i class="dot" style="background:#f59e0b"></i> मध्यम</span>
          <span><i class="dot" style="background:#ef4444"></i> तनाव</span>
        </div>
      `;
      container.appendChild(cropLegend);
    }
  }

  function refreshActiveLayers() {
    const m = map();
    if (!m) return;
    Object.entries(layerStates).forEach(([id, visible]) => {
      if (visible && !LAYER_DEFINITIONS[id].managed_by) {
        // Remove existing group
        if (layerGroups[id] && m.hasLayer(layerGroups[id])) {
          m.removeLayer(layerGroups[id]);
        }
        // Force recreate and add
        layerGroups[id] = createLayer(id);
        if (layerGroups[id]) {
          m.addLayer(layerGroups[id]);
        }
      }
    });
    renderLegend();
  }

  return {
    init: initLayerToggles,
    toggleLayer,
    renderLegend,
    refreshLayers: refreshActiveLayers,
    getState: (id) => layerStates[id] || false,
    LAYER_DEFINITIONS
  };
})();
