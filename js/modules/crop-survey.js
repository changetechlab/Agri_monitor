/**
 * Agri Monitor — js/modules/crop-survey.js
 * Phase 3.3 — Ground-Truth Crop Field Survey & Verification Module
 * ─────────────────────────────────────────────────────────────
 * Purpose  : Collects and verifies ground-truth crop field polygons
 *            for future Sentinel-2 ML classification.
 *
 * Data Rules:
 *   - REAL      : Submitted by real field users via survey interface.
 *   - VERIFIED  : Reviewed and confirmed ground-truth observations.
 *   - DRAFT     : Incomplete/unsubmitted field survey.
 *   - REJECTED : Declined survey entry.
 *
 * Exposes  : window.AgriCropSurvey
 */

window.AgriCropSurvey = (() => {

  const STORAGE_KEY = 'agri_gt_surveys';
  let activeSurveys = [];
  let drawControl = null;
  let drawnItems = null;
  let activePolygonGeoJSON = null;
  let activeAreaHa = 0;

  // Pilot Crop Catalogue
  const PILOT_CROPS = [
    { id: 'mandua', name: 'मंडुआ (Mandua / Finger Millet)', category: 'cereal', season: 'Kharif' },
    { id: 'wheat', name: 'गेहूं (Wheat)', category: 'cereal', season: 'Rabi' },
    { id: 'jhangora', name: 'झंगोरा (Jhangora / Barnyard Millet)', category: 'cereal', season: 'Kharif' },
    { id: 'paddy', name: 'धान (Paddy)', category: 'cereal', season: 'Kharif' },
    { id: 'rajma', name: 'राजमा (Rajma / Pulses)', category: 'pulse', season: 'Kharif' },
    { id: 'potato', name: 'आलू (Potato)', category: 'vegetable', season: 'Rabi' },
    { id: 'mustard', name: 'सरसों (Mustard)', category: 'oilseed', season: 'Rabi' },
    { id: 'apple', name: 'सेब / फल (Apple / Horticulture)', category: 'horticulture', season: 'Perennial' }
  ];

  // ═══════════════════════════════════════════════════════════
  // 1. INITIALIZATION
  // ═══════════════════════════════════════════════════════════
  async function init() {
    console.log('[AgriCropSurvey] Phase 3.3 Ground-Truth Survey Module initializing…');
    loadLocalSurveys();
    setupMapDrawTool();
    bindUIEvents();
    renderDashboard();
  }

  function loadLocalSurveys() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      activeSurveys = raw ? JSON.parse(raw) : [];
    } catch (e) {
      activeSurveys = [];
    }
  }

  function saveLocalSurveys() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(activeSurveys));
    } catch (e) {}
  }

  // ═══════════════════════════════════════════════════════════
  // 2. LEAFLET POLYGON DRAW TOOL
  // ═══════════════════════════════════════════════════════════
  function setupMapDrawTool() {
    const map = window.AgriMap && window.AgriMap.getMap();
    if (!map || window.L === undefined) return;

    if (!drawnItems) {
      drawnItems = new L.FeatureGroup();
      map.addLayer(drawnItems);
    }

    if (L.Control && L.Control.Draw && !drawControl) {
      drawControl = new L.Control.Draw({
        draw: {
          polygon: { allowIntersection: false, showArea: true },
          polyline: false, rectangle: true, circle: false, marker: false, circlemarker: false
        },
        edit: { featureGroup: drawnItems }
      });
      map.addControl(drawControl);

      map.on(L.Draw.Event.CREATED, (event) => {
        const layer = event.layer;
        drawnItems.clearLayers();
        drawnItems.addLayer(layer);
        
        activePolygonGeoJSON = layer.toGeoJSON();
        activeAreaHa = calculatePolygonAreaHa(layer);

        // Populate area in survey form
        const areaInput = document.getElementById('gt-area-display');
        if (areaInput) {
          areaInput.value = `${activeAreaHa} Ha (${(activeAreaHa * 10000).toFixed(0)} m²)`;
        }

        if (window.AgriApp && window.AgriApp.showToast) {
          window.AgriApp.showToast(`✅ खेत सीमा खींची गई — क्षेत्रफल: ${activeAreaHa} Ha`, 'success');
        }
      });
    }
  }

  /**
   * Geodesic Area calculation in Hectares
   */
  function calculatePolygonAreaHa(layer) {
    if (!layer) return 0;
    let areaSqm = 0;
    if (L.GeometryUtil && L.GeometryUtil.geodesicArea) {
      areaSqm = L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
    } else {
      // Fallback coordinate polygon area
      const latlngs = layer.getLatLngs()[0];
      areaSqm = Math.abs(approximateAreaSqm(latlngs));
    }
    return parseFloat((areaSqm / 10000.0).toFixed(3));
  }

  function approximateAreaSqm(latlngs) {
    let area = 0;
    const R = 6378137;
    if (latlngs.length < 3) return 0;
    for (let i = 0; i < latlngs.length; i++) {
      const p1 = latlngs[i];
      const p2 = latlngs[(i + 1) % latlngs.length];
      area += (p2.lng - p1.lng) * (2 + Math.sin(p1.lat * Math.PI / 180) + Math.sin(p2.lat * Math.PI / 180));
    }
    return area * R * R * Math.PI / 360;
  }

  // ═══════════════════════════════════════════════════════════
  // 3. UI BINDINGS & FORM HANDLING
  // ═══════════════════════════════════════════════════════════
  function bindUIEvents() {
    const btnOpen = document.getElementById('btn-open-gt-survey');
    if (btnOpen) {
      btnOpen.addEventListener('click', openSurveyModal);
    }

    const dSel = document.getElementById('gt-district');
    if (dSel) {
      dSel.addEventListener('change', updateBlocks);
    }

    const bSel = document.getElementById('gt-block');
    if (bSel) {
      bSel.addEventListener('change', updateGPs);
    }

    const gSel = document.getElementById('gt-gp');
    if (gSel) {
      gSel.addEventListener('change', updateVillages);
    }

    const form = document.getElementById('gt-survey-form');
    if (form) {
      form.addEventListener('submit', handleFormSubmit);
    }
  }

  function openSurveyModal() {
    const modal = document.getElementById('gt-survey-modal');
    if (modal) modal.classList.remove('hidden');
    resetForm();
  }

  function resetForm() {
    activePolygonGeoJSON = null;
    activeAreaHa = 0;
    if (drawnItems) drawnItems.clearLayers();
    const areaInput = document.getElementById('gt-area-display');
    if (areaInput) areaInput.value = 'मानचित्र पर खेत का पोलिगोन खींचें';
    const form = document.getElementById('gt-survey-form');
    if (form) form.reset();
    populateDistricts();
  }

  function populateDistricts() {
    const dSel = document.getElementById('gt-district');
    if (!dSel) return;
    dSel.innerHTML = `
      <option value="">-- जिला चुनें --</option>
      <option value="Rudra Prayag">रुद्रप्रयाग (Rudraprayag)</option>
      <option value="Chamoli">चमोली (Chamoli)</option>
      <option value="Tehri Garhwal">टिहरी गढ़वाल (Tehri)</option>
      <option value="Uttar Kashi">उत्तरकाशी (Uttarkashi)</option>
    `;
  }

  function updateBlocks() {
    const dSel = document.getElementById('gt-district');
    const bSel = document.getElementById('gt-block');
    if (!dSel || !bSel) return;
    const district = dSel.value;
    if (district && window.GP_CRA_DATA && window.GP_CRA_DATA.getBlocksByDistrict) {
      const blocks = window.GP_CRA_DATA.getBlocksByDistrict(district);
      bSel.innerHTML = '<option value="">-- ब्लॉक चुनें --</option>' +
        blocks.map(b => `<option value="${b}">${b}</option>`).join('');
      bSel.disabled = false;
    } else {
      bSel.innerHTML = '<option value="">-- पहले जिला चुनें --</option>';
      bSel.disabled = true;
    }
    updateGPs();
  }

  function updateGPs() {
    const dSel = document.getElementById('gt-district');
    const bSel = document.getElementById('gt-block');
    const gSel = document.getElementById('gt-gp');
    if (!gSel) return;
    const district = dSel ? dSel.value : '';
    const block = bSel ? bSel.value : '';

    if (district && block && window.ALL_UTTARAKHAND_GPS) {
      const filtered = window.ALL_UTTARAKHAND_GPS.filter(g =>
        (g.district || '').toLowerCase() === district.toLowerCase() &&
        (g.block || '').toLowerCase() === block.toLowerCase()
      );
      const gpNames = Array.from(new Set(filtered.map(g => g.gp_name))).sort();
      gSel.innerHTML = '<option value="">-- ग्राम पंचायत चुनें --</option>' +
        gpNames.map(g => `<option value="${g}">${g}</option>`).join('');
      gSel.disabled = false;
    } else {
      gSel.innerHTML = '<option value="">-- पहले ब्लॉक चुनें --</option>';
      gSel.disabled = true;
    }
    updateVillages();
  }

  function updateVillages() {
    const gSel = document.getElementById('gt-gp');
    const vSel = document.getElementById('gt-village');
    if (!vSel) return;
    const gp = gSel ? gSel.value : '';

    if (gp && window.VILLAGE_GPS_DATA) {
      const filtered = window.VILLAGE_GPS_DATA.filter(v => (v.gp_name || v.gp || '').toLowerCase() === gp.toLowerCase());
      const vNames = Array.from(new Set(filtered.map(v => v.name))).sort();
      vSel.innerHTML = '<option value="">-- गांव चुनें --</option>' +
        vNames.map(v => `<option value="${v}">${v}</option>`).join('');
      vSel.disabled = false;
    } else {
      vSel.innerHTML = '<option value="">-- पहले GP चुनें --</option>';
      vSel.disabled = true;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 4. QUALITY CONTROL & FORM SUBMISSION
  // ═══════════════════════════════════════════════════════════
  async function handleFormSubmit(e) {
    e.preventDefault();

    const district = document.getElementById('gt-district').value;
    const block = document.getElementById('gt-block').value;
    const gp = document.getElementById('gt-gp').value;
    const village = document.getElementById('gt-village').value;
    const cropId = document.getElementById('gt-crop-select').value;
    const collectorName = document.getElementById('gt-collector-name').value;
    const surveyDate = document.getElementById('gt-survey-date').value;
    const sowingDate = document.getElementById('gt-sowing-date').value;
    const photoUrl = document.getElementById('gt-photo-url').value;

    // Quality Control Validation Rules
    if (!district || !block || !gp || !village) {
      alert('⚠️ कृपया संपूर्ण भौगोलिक श्रेणी (जिला, ब्लॉक, GP, गांव) चुनें।');
      return;
    }

    if (!cropId) {
      alert('⚠️ कृपया फसल का चयन करें।');
      return;
    }

    if (!collectorName) {
      alert('⚠️ कृपया सर्वेक्षक का नाम दर्ज करें।');
      return;
    }

    if (!activePolygonGeoJSON || activeAreaHa <= 0) {
      alert('⚠️ कृपया मानचित्र पर खेत की सीमा (Polygon) खींचें। क्षेत्रफल शून्य नहीं हो सकता।');
      return;
    }

    const cropObj = PILOT_CROPS.find(c => c.id === cropId) || { name: cropId, category: 'other', season: 'Kharif' };

    const record = {
      id: 'gt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      district_name: district,
      block_name: block,
      gp_name: gp,
      village_name: village,
      crop_name: cropObj.name,
      crop_category: cropObj.category,
      season: cropObj.season,
      sowing_date: sowingDate || null,
      geometry: activePolygonGeoJSON,
      area_ha: activeAreaHa,
      survey_date: surveyDate || new Date().toISOString().slice(0, 10),
      collector_name: collectorName,
      photo_evidence: photoUrl || null,
      verification_status: 'SUBMITTED', // Initial status upon submission
      verification_notes: 'क्षेत्रीय सर्वेक्षक द्वारा प्रस्तुत - समीक्षा प्रतीक्षित',
      source: 'Agri Monitor Ground Truth Survey Module',
      created_at: new Date().toISOString()
    };

    // Attempt Supabase Insert if configured
    let savedOnline = false;
    if (window.AgriConfig && window.AgriConfig.SUPABASE_URL && window.supabaseClient) {
      try {
        const { error } = await window.supabaseClient.from('ground_truth_surveys').insert([record]);
        if (!error) savedOnline = true;
      } catch (err) {
        console.warn('[AgriCropSurvey] Supabase insert failed, saving locally:', err);
      }
    }

    activeSurveys.unshift(record);
    saveLocalSurveys();

    const modal = document.getElementById('gt-survey-modal');
    if (modal) modal.classList.add('hidden');

    if (window.AgriApp && window.AgriApp.showToast) {
      window.AgriApp.showToast(`✅ ग्राउंड-ट्रुथ सर्वे दर्ज किया गया (${savedOnline ? 'Supabase' : 'Offline Queue'})`, 'success');
    }

    renderDashboard();
  }

  // ═══════════════════════════════════════════════════════════
  // 5. VERIFICATION WORKFLOW (DRAFT → SUBMITTED → VERIFIED / REJECTED)
  // ═══════════════════════════════════════════════════════════
  function updateRecordStatus(recordId, newStatus, notes) {
    const rec = activeSurveys.find(r => r.id === recordId);
    if (!rec) return;

    rec.verification_status = newStatus;
    rec.verification_notes = notes || (newStatus === 'VERIFIED' ? 'सत्यापित ग्राउंड-ट्रुथ डेटा' : 'अस्वीकृत सर्वे');
    rec.updated_at = new Date().toISOString();

    saveLocalSurveys();
    renderDashboard();

    if (window.AgriApp && window.AgriApp.showToast) {
      window.AgriApp.showToast(`स्थिति अपडेट: ${newStatus}`, newStatus === 'VERIFIED' ? 'success' : 'info');
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 6. PILOT DASHBOARD & RECORD RENDERING
  // ═══════════════════════════════════════════════════════════
  function renderDashboard() {
    const totalEl = document.getElementById('gt-stat-total');
    const draftEl = document.getElementById('gt-stat-draft');
    const subEl = document.getElementById('gt-stat-submitted');
    const verEl = document.getElementById('gt-stat-verified');
    const rejEl = document.getElementById('gt-stat-rejected');
    const manduaEl = document.getElementById('gt-stat-mandua');
    const wheatEl = document.getElementById('gt-stat-wheat');
    const areaEl = document.getElementById('gt-stat-verified-area');

    const total = activeSurveys.length;
    const draft = activeSurveys.filter(s => s.verification_status === 'DRAFT').length;
    const submitted = activeSurveys.filter(s => s.verification_status === 'SUBMITTED').length;
    const verified = activeSurveys.filter(s => s.verification_status === 'VERIFIED');
    const rejected = activeSurveys.filter(s => s.verification_status === 'REJECTED').length;

    const manduaVer = verified.filter(s => s.crop_name.toLowerCase().includes('mandua') || s.crop_name.includes('मंडुआ')).length;
    const wheatVer = verified.filter(s => s.crop_name.toLowerCase().includes('wheat') || s.crop_name.includes('गेहूं')).length;

    const verifiedArea = verified.reduce((acc, curr) => acc + (parseFloat(curr.area_ha) || 0), 0);

    if (totalEl) totalEl.textContent = total;
    if (draftEl) draftEl.textContent = draft;
    if (subEl) subEl.textContent = submitted;
    if (verEl) verEl.textContent = verified.length;
    if (rejEl) rejEl.textContent = rejected;
    if (manduaEl) manduaEl.textContent = manduaVer;
    if (wheatEl) wheatEl.textContent = wheatVer;
    if (areaEl) areaEl.textContent = `${verifiedArea.toFixed(2)} Ha`;

    renderSurveyTable();
  }

  function renderSurveyTable() {
    const tbody = document.getElementById('gt-survey-table-body');
    if (!tbody) return;

    if (activeSurveys.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;padding:16px;color:var(--text-muted);">
            कोई ग्राउंड-ट्रुथ सर्वे दर्ज नहीं है। <strong>"➕ नया सर्वे दर्ज करें"</strong> बटन पर क्लिक करके नया खेत पंजीकृत करें।
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = activeSurveys.map(s => `
      <tr>
        <td><strong>${s.village_name}</strong><br><small style="color:var(--text-muted)">${s.gp_name}, ${s.district_name}</small></td>
        <td><strong>${s.crop_name}</strong></td>
        <td>${s.area_ha} Ha</td>
        <td>${s.collector_name}<br><small style="color:var(--text-muted)">${s.survey_date}</small></td>
        <td>
          <span class="ai-status-tag ${
            s.verification_status === 'VERIFIED' ? 'tag-real' :
            s.verification_status === 'SUBMITTED' ? 'tag-derived' :
            s.verification_status === 'REJECTED' ? 'risk-high' : 'tag-placeholder'
          }">
            ${s.verification_status === 'VERIFIED' ? 'GROUND TRUTH — VERIFIED' : s.verification_status}
          </span>
        </td>
        <td>
          ${s.verification_status !== 'VERIFIED' ? `
            <button class="btn-primary" style="font-size:9.5px;padding:2px 6px;" onclick="window.AgriCropSurvey.updateRecordStatus('${s.id}', 'VERIFIED')">Approve</button>
            <button class="btn-secondary" style="font-size:9.5px;padding:2px 6px;" onclick="window.AgriCropSurvey.updateRecordStatus('${s.id}', 'REJECTED')">Reject</button>
          ` : '✅ Confirmed'}
        </td>
      </tr>
    `).join('');
  }

  return {
    init,
    openSurveyModal,
    updateRecordStatus,
    getSurveys: () => activeSurveys,
    getVerifiedSurveys: () => activeSurveys.filter(s => s.verification_status === 'VERIFIED')
  };

})();
