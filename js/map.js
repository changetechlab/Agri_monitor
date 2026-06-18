/**
 * Agri Monitor — js/map.js
 * Leaflet map initialization, base layers, controls, and utilities
 */

window.AgriMap = (() => {
  let map = null;
  let currentBaseLayer = 'osm';
  let drawControl = null;
  let drawLayer = null;
  let clusterGroup = null;

  // ============================================================
  // Base Tile Layers
  // ============================================================
  const baseLayers = {
    osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 19,
      minZoom: 5
    }),
    topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://opentopomap.org">OpenTopoMap</a>',
      maxZoom: 17,
      minZoom: 5
    }),
    satellite: L.tileLayer(
      'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
      {
        attribution: '© <a href="https://eox.at">EOX IT Services</a> — Sentinel-2 Cloudless 2020',
        maxZoom: 18,
        minZoom: 5,
        crossOrigin: true
      }
    )
  };

  // ============================================================
  // Initialize Map
  // ============================================================
  function init() {
    const cfg = window.AgriConfig || {};
    const center = cfg.MAP_CENTER || [30.3985, 79.0561];
    const zoom = window.innerWidth < 768 ? (cfg.MAP_ZOOM_MOBILE || 10) : (cfg.MAP_ZOOM || 11);

    map = L.map('map', {
      center,
      zoom,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true, // Better performance on low-end phones
    });

    // Add default base layer
    baseLayers.osm.addTo(map);

    // Zoom control — top right on desktop, hidden on mobile (use pinch)
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Scale control
    L.control.scale({ position: 'bottomright', metric: true, imperial: false }).addTo(map);

    // Cluster group for farmers/fields markers
    if (window.L.MarkerClusterGroup) {
      clusterGroup = L.markerClusterGroup({
        maxClusterRadius: 60,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        iconCreateFunction: createClusterIcon
      });
      map.addLayer(clusterGroup);
    }

    // Draw layer (for field polygon drawing)
    drawLayer = new L.FeatureGroup();
    map.addLayer(drawLayer);

    // Map click handler
    map.on('click', onMapClick);

    // Bind base layer switcher
    bindBaseLayerSwitcher();

    // Bind my-location button
    bindLocationButton();

    console.log('[Map] Leaflet map initialized');
    return map;
  }

  // ============================================================
  // Custom cluster icon
  // ============================================================
  function createClusterIcon(cluster) {
    const count = cluster.getChildCount();
    let cls = 'cluster-small';
    if (count > 20) cls = 'cluster-large';
    else if (count > 10) cls = 'cluster-medium';

    return L.divIcon({
      html: `<div class="cluster-marker ${cls}"><span>${count}</span></div>`,
      className: '',
      iconSize: [40, 40]
    });
  }

  // ============================================================
  // Field polygon drawing (Leaflet.draw)
  // ============================================================
  function startDrawing(onComplete) {
    if (!window.L.Draw) {
      alert('Drawing tool not loaded. Please check your internet connection.');
      return;
    }

    // Remove existing draw control
    stopDrawing();

    const drawOptions = {
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true,
          metric: true,
          shapeOptions: {
            color: '#16a34a',
            fillColor: '#16a34a',
            fillOpacity: 0.25,
            weight: 2
          }
        },
        polyline: false,
        circle: false,
        rectangle: false,
        marker: false,
        circlemarker: false
      },
      edit: {
        featureGroup: drawLayer,
        remove: true
      }
    };

    drawControl = new L.Control.Draw(drawOptions);
    map.addControl(drawControl);

    // Activate polygon drawing immediately
    new L.Draw.Polygon(map, drawOptions.draw.polygon).enable();

    // Listen for draw complete
    map.on(L.Draw.Event.CREATED, (e) => {
      drawLayer.clearLayers();
      const layer = e.layer;
      drawLayer.addLayer(layer);

      const geojson = layer.toGeoJSON().geometry;
      const area = calculateArea(layer.getLatLngs()[0]);

      if (onComplete) onComplete(geojson, area);
    });
  }

  function stopDrawing() {
    if (drawControl) {
      map.removeControl(drawControl);
      drawControl = null;
    }
    map.off(L.Draw.Event.CREATED);
  }

  function clearDrawLayer() {
    if (drawLayer) drawLayer.clearLayers();
  }

  // ============================================================
  // Calculate polygon area in square meters (Shoelace formula)
  // ============================================================
  function calculateArea(latLngs) {
    if (!latLngs || latLngs.length < 3) return 0;
    // Use Leaflet's geometry utility if available
    if (window.L.GeometryUtil) {
      return L.GeometryUtil.geodesicArea(latLngs);
    }
    // Fallback: approximate using Shoelace formula
    let area = 0;
    const n = latLngs.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += latLngs[i].lat * latLngs[j].lng;
      area -= latLngs[j].lat * latLngs[i].lng;
    }
    // Convert degrees² to m² (approx for India's latitude)
    return Math.abs(area / 2) * 111319 * 111319 * Math.cos(latLngs[0].lat * Math.PI / 180);
  }

  // ============================================================
  // Base layer switcher binding
  // ============================================================
  function bindBaseLayerSwitcher() {
    // 1. Sidebar buttons
    document.querySelectorAll('.base-layer-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const layer = btn.dataset.layer;
        switchBaseLayer(layer);
        document.querySelectorAll('.base-layer-btn').forEach(b => b.classList.toggle('active', b.dataset.layer === layer));
        document.querySelectorAll('.map-type-btn').forEach(b => b.classList.toggle('active', b.dataset.layer === layer));
      });
    });

    // 2. Floating buttons
    document.querySelectorAll('.map-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const layer = btn.dataset.layer;
        switchBaseLayer(layer);
        document.querySelectorAll('.map-type-btn').forEach(b => b.classList.toggle('active', b.dataset.layer === layer));
        document.querySelectorAll('.base-layer-btn').forEach(b => b.classList.toggle('active', b.dataset.layer === layer));
      });
    });
  }

  function switchBaseLayer(layerName) {
    if (!baseLayers[layerName] || !map) return;
    if (baseLayers[currentBaseLayer]) {
      map.removeLayer(baseLayers[currentBaseLayer]);
    }
    baseLayers[layerName].addTo(map);
    currentBaseLayer = layerName;
  }

  // ============================================================
  // My Location button
  // ============================================================
  function bindLocationButton() {
    const btn = document.getElementById('btn-my-location');
    if (!btn) return;

    btn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        alert('आपका browser GPS support नहीं करता।');
        return;
      }
      btn.classList.add('loading');
      btn.title = 'लोकेशन खोज रहे हैं...';

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          map.setView([latitude, longitude], 15);

          // Show location marker
          const locMarker = L.circleMarker([latitude, longitude], {
            radius: 8,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.8,
            weight: 2
          });
          locMarker.addTo(map).bindPopup(
            `📍 आपकी स्थिति<br>सटीकता: ±${Math.round(accuracy)}m`
          ).openPopup();

          // Remove after 10s
          setTimeout(() => map.removeLayer(locMarker), 10000);
          btn.classList.remove('loading');
          btn.title = 'मेरी लोकेशन';
        },
        (err) => {
          btn.classList.remove('loading');
          console.error('[Map] GPS error:', err);
          alert('GPS लोकेशन नहीं मिली। Location permission दें।');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  // ============================================================
  // Map click handler (for field survey mode)
  // ============================================================
  function onMapClick(e) {
    // Check if survey mode is active
    if (window.AgriApp && window.AgriApp.state.surveyMode) {
      window.AgriUpload && window.AgriUpload.openSurveyAt(e.latlng);
    }
  }

  // ============================================================
  // Fly to location
  // ============================================================
  function flyTo(lat, lng, zoom = 14) {
    if (map) map.flyTo([lat, lng], zoom, { duration: 1.2 });
  }

  // ============================================================
  // Add marker to cluster group
  // ============================================================
  function addToCluster(layer) {
    if (clusterGroup) clusterGroup.addLayer(layer);
    else layer.addTo(map);
  }

  function clearCluster() {
    if (clusterGroup) clusterGroup.clearLayers();
  }

  // ============================================================
  // Field polygon on map
  // ============================================================
  function addFieldPolygon(geojson, options = {}) {
    const defaultStyle = {
      color: '#16a34a',
      fillColor: '#16a34a',
      fillOpacity: 0.2,
      weight: 2
    };

    const healthColors = {
      healthy: '#22c55e',
      moderate: '#f59e0b',
      stress: '#ef4444',
      unknown: '#6b7280'
    };

    if (options.health_status) {
      defaultStyle.color = healthColors[options.health_status] || defaultStyle.color;
      defaultStyle.fillColor = healthColors[options.health_status] || defaultStyle.fillColor;
    }

    const layer = L.geoJSON({
      type: 'Feature',
      geometry: geojson,
      properties: options
    }, {
      style: defaultStyle,
      onEachFeature: (feature, lyr) => {
        const p = feature.properties;
        const cropLabel = (window.DummyData?.cropLabels || {})[p.crop_type] || p.crop_type || '';
        const healthLabel = (window.DummyData?.healthLabels || {})[p.health_status] || '';
        lyr.bindPopup(`
          <div class="field-popup">
            <strong>${p.name || 'खेत'}</strong><br>
            👨‍🌾 ${p.farmer_name || ''}<br>
            🌱 ${cropLabel}<br>
            📊 NDVI: ${p.last_ndvi_value ? p.last_ndvi_value.toFixed(2) : 'N/A'}<br>
            <span class="health-badge ${p.health_status}">${healthLabel}</span>
            <button class="popup-btn" onclick="AgriUpload && AgriUpload.openSurveyForField('${p.field_id}')">📷 सर्वे</button>
          </div>
        `);
      }
    });

    return layer;
  }

  // ============================================================
  // Farmer point marker
  // ============================================================
  function createFarmerMarker(farmer) {
    const healthColor = {
      healthy: '#22c55e', moderate: '#f59e0b', stress: '#ef4444', unknown: '#6b7280'
    }[farmer.field_health] || '#16a34a';

    const icon = L.divIcon({
      html: `<div class="farmer-marker" style="background:${healthColor}">
               <span>👨‍🌾</span>
             </div>`,
      className: '',
      iconSize: [36, 36],
      iconAnchor: [18, 36]
    });

    const marker = L.marker([farmer.lat || 0, farmer.lng || 0], { icon });
    const cropLabel = (window.DummyData?.cropLabels || {})[farmer.primary_crop] || farmer.primary_crop;
    marker.bindPopup(`
      <div class="farmer-popup">
        <strong>${farmer.name_hindi || farmer.name}</strong><br>
        📍 ${farmer.village_name}<br>
        🌱 ${cropLabel || 'N/A'}<br>
        📞 ${farmer.mobile || ''}<br>
        <button class="popup-btn" onclick="AgriFarmers.showFarmerDetail('${farmer.id}')">विवरण देखें</button>
      </div>
    `);
    return marker;
  }

  return {
    init,
    getMap: () => map,
    flyTo,
    startDrawing,
    stopDrawing,
    clearDrawLayer,
    calculateArea,
    addToCluster,
    clearCluster,
    addFieldPolygon,
    createFarmerMarker,
    switchBaseLayer,
    getClusterGroup: () => clusterGroup
  };
})();
