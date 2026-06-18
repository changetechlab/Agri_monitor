/**
 * Agri Monitor — js/upload.js
 * Camera capture, image compression, GPS geo-tagging, Supabase storage
 * Mobile-optimized for Android Chrome on 2G/3G networks
 */

window.AgriUpload = (() => {
  let currentFieldId = null;
  let currentFarmerId = null;
  let capturedImageBlob = null;
  let capturedLocation = null;

  const MAX_SIZE_KB = (window.AgriConfig || {}).IMAGE_MAX_SIZE_KB || 400;
  const QUALITY = (window.AgriConfig || {}).IMAGE_QUALITY || 0.75;

  // ============================================================
  // Open survey modal for a specific field
  // ============================================================
  function openSurveyForField(fieldId) {
    currentFieldId = fieldId;
    const field = window.AgriFarmers.getFields().find(f => f.id === fieldId);
    currentFarmerId = field?.farmer_id || null;

    const modal = document.getElementById('survey-modal');
    if (modal) modal.classList.remove('hidden');
    resetSurveyForm();
    captureGPS();
  }

  // ============================================================
  // Open survey for a specific farmer (no specific field)
  // ============================================================
  function openSurveyForFarmer(farmerId) {
    currentFarmerId = farmerId;
    currentFieldId = null;

    // Populate field selector
    const fieldSelect = document.getElementById('survey-field');
    if (fieldSelect) {
      const farmerFields = window.AgriFarmers.getFields().filter(f => f.farmer_id === farmerId);
      fieldSelect.innerHTML = '<option value="">खेत चुनें (वैकल्पिक)</option>' +
        farmerFields.map(f => `<option value="${f.id}">${f.name || 'खेत'}</option>`).join('');
      fieldSelect.style.display = farmerFields.length > 0 ? 'block' : 'none';
    }

    const modal = document.getElementById('survey-modal');
    if (modal) modal.classList.remove('hidden');
    resetSurveyForm();
    captureGPS();
  }

  // ============================================================
  // Open survey at map tap location (survey mode)
  // ============================================================
  function openSurveyAt(latlng) {
    currentFieldId = null;
    currentFarmerId = null;
    capturedLocation = { lat: latlng.lat, lng: latlng.lng, accuracy: 10 };

    const modal = document.getElementById('survey-modal');
    if (modal) modal.classList.remove('hidden');
    resetSurveyForm();
    updateGPSDisplay(capturedLocation);
  }

  // ============================================================
  // Capture GPS location
  // ============================================================
  function captureGPS() {
    if (!navigator.geolocation) {
      updateGPSDisplay(null);
      return;
    }

    const gpsStatus = document.getElementById('gps-status');
    if (gpsStatus) gpsStatus.textContent = '📡 GPS खोज रहे हैं...';

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        capturedLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
        updateGPSDisplay(capturedLocation);
      },
      (err) => {
        console.warn('[Upload] GPS error:', err);
        capturedLocation = null;
        updateGPSDisplay(null);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }

  function updateGPSDisplay(loc) {
    const gpsStatus = document.getElementById('gps-status');
    if (!gpsStatus) return;
    if (loc) {
      gpsStatus.innerHTML = `✅ GPS: ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)} (±${Math.round(loc.accuracy)}m)`;
      gpsStatus.className = 'gps-status gps-ok';
    } else {
      gpsStatus.textContent = '❌ GPS नहीं मिली';
      gpsStatus.className = 'gps-status gps-error';
    }
  }

  // ============================================================
  // Camera / file input handler
  // ============================================================
  function initCamera() {
    const cameraInput = document.getElementById('camera-input');
    const preview = document.getElementById('image-preview');
    const previewImg = document.getElementById('preview-img');
    const fileSizeEl = document.getElementById('file-size-display');

    if (!cameraInput) return;

    cameraInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Show loading
      if (preview) preview.style.display = 'block';
      if (previewImg) previewImg.src = '';
      if (fileSizeEl) fileSizeEl.textContent = 'Compress कर रहे हैं...';

      // Compress image
      capturedImageBlob = await compressImage(file, MAX_SIZE_KB, QUALITY);

      // Show preview
      const url = URL.createObjectURL(capturedImageBlob);
      if (previewImg) previewImg.src = url;

      const sizeKB = Math.round(capturedImageBlob.size / 1024);
      if (fileSizeEl) fileSizeEl.textContent = `📦 ${sizeKB} KB (compressed)`;
    });
  }

  // ============================================================
  // Image compression using Canvas API
  // ============================================================
  async function compressImage(file, maxSizeKB, quality) {
    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);

        // Calculate target dimensions (max 1200px on longest side)
        let { width, height } = img;
        const MAX_DIM = 1200;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round(height * MAX_DIM / width);
            width = MAX_DIM;
          } else {
            width = Math.round(width * MAX_DIM / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Compress iteratively until under maxSizeKB
        let q = quality;
        const compress = () => {
          canvas.toBlob((blob) => {
            if (blob.size / 1024 > maxSizeKB && q > 0.3) {
              q -= 0.1;
              compress();
            } else {
              resolve(blob);
            }
          }, 'image/jpeg', q);
        };
        compress();
      };

      img.onerror = () => {
        // If canvas fails, return original
        resolve(file);
      };

      img.src = objectUrl;
    });
  }

  // ============================================================
  // Submit survey observation
  // ============================================================
  async function submitSurvey() {
    const issueType = document.getElementById('survey-issue-type').value;
    const caption = document.getElementById('survey-caption').value.trim();
    const fieldId = document.getElementById('survey-field')?.value || currentFieldId;

    if (!capturedImageBlob) {
      showUploadError('📷 पहले फोटो लें');
      return;
    }

    const submitBtn = document.getElementById('btn-submit-survey');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'अपलोड हो रहा है...'; }

    const metadata = {
      field_id: fieldId,
      farmer_id: currentFarmerId,
      lat: capturedLocation?.lat || null,
      lng: capturedLocation?.lng || null,
      accuracy: capturedLocation?.accuracy || null,
      issue_type: issueType,
      caption,
      taken_at: new Date().toISOString()
    };

    try {
      let publicUrl = null;

      if (window.AgriDB && navigator.onLine) {
        // Upload to Supabase Storage
        const fileName = `fields/${fieldId || 'general'}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
        const { data, error: uploadError } = await window.AgriDB.storage
          .from('field-images')
          .upload(fileName, capturedImageBlob, {
            contentType: 'image/jpeg',
            upsert: false
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = window.AgriDB.storage
          .from('field-images')
          .getPublicUrl(fileName);
        publicUrl = urlData.publicUrl;

        // Insert record
        const { error: insertError } = await window.AgriDB.from('field_images').insert({
          ...metadata,
          storage_path: fileName,
          public_url: publicUrl
        });
        if (insertError) throw insertError;

      } else {
        // Offline — store in IndexedDB
        await window.AgriOffline.queueImageUpload(capturedImageBlob, metadata);
        showToast('📦 ऑफलाइन सहेजा — नेट आने पर अपलोड होगा', 'info');
      }

      // Add map marker for observation
      if (capturedLocation && window.AgriMap.getMap()) {
        addObservationMarker(capturedLocation, issueType, caption, publicUrl);
      }

      // Run alert check (NDVI decline detection)
      if (issueType === 'water_stress' || issueType === 'disease') {
        window.AgriAlerts && window.AgriAlerts.createFromObservation({
          field_id: fieldId,
          farmer_id: currentFarmerId,
          issue_type: issueType,
          location: capturedLocation
        });
      }

      closeSurveyModal();
      showToast('✅ सर्वे सफलतापूर्वक सहेजा!', 'success');

    } catch (err) {
      console.error('[Upload] Submit failed:', err);
      // Auto-fallback to offline
      await window.AgriOffline.queueImageUpload(capturedImageBlob, metadata);
      showToast('⚠️ ऑफलाइन सहेजा गया', 'info');
      closeSurveyModal();
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'सर्वे सहेजें'; }
    }
  }

  // ============================================================
  // Add observation marker on map
  // ============================================================
  function addObservationMarker(loc, issueType, caption, imageUrl) {
    const issueIcons = {
      pest: '🐛', disease: '🍂', water_stress: '💧',
      flood: '🌊', good_growth: '✅', other: '📍'
    };
    const icon = issueIcons[issueType] || '📷';
    const color = issueType === 'good_growth' ? '#22c55e' :
                  issueType === 'water_stress' ? '#3b82f6' : '#f59e0b';

    const marker = L.circleMarker([loc.lat, loc.lng], {
      radius: 10,
      color,
      fillColor: color,
      fillOpacity: 0.8,
      weight: 2
    });

    marker.bindPopup(`
      <div class="obs-popup">
        <div>${icon} <strong>${caption || 'अवलोकन'}</strong></div>
        <div>📅 ${new Date().toLocaleDateString('hi-IN')}</div>
        ${imageUrl ? `<img src="${imageUrl}" style="width:100%;max-height:120px;object-fit:cover;border-radius:4px;margin-top:4px">` : ''}
      </div>
    `);

    marker.addTo(window.AgriMap.getMap());
  }

  // ============================================================
  // UI helpers
  // ============================================================
  function resetSurveyForm() {
    capturedImageBlob = null;
    const cameraInput = document.getElementById('camera-input');
    if (cameraInput) cameraInput.value = '';
    const preview = document.getElementById('image-preview');
    if (preview) preview.style.display = 'none';
    const caption = document.getElementById('survey-caption');
    if (caption) caption.value = '';
    const issueType = document.getElementById('survey-issue-type');
    if (issueType) issueType.value = 'other';
  }

  function closeSurveyModal() {
    const modal = document.getElementById('survey-modal');
    if (modal) modal.classList.add('hidden');
    resetSurveyForm();
  }

  function showUploadError(msg) {
    const el = document.getElementById('upload-error');
    if (el) { el.textContent = msg; el.style.display = 'block'; setTimeout(() => el.style.display = 'none', 3000); }
  }

  function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
  }

  // ============================================================
  // Bind events
  // ============================================================
  function bindEvents() {
    initCamera();

    const submitBtn = document.getElementById('btn-submit-survey');
    if (submitBtn) submitBtn.addEventListener('click', submitSurvey);

    const cancelBtn = document.getElementById('btn-cancel-survey');
    if (cancelBtn) cancelBtn.addEventListener('click', closeSurveyModal);

    const closeSurveyBtn = document.getElementById('close-survey-modal');
    if (closeSurveyBtn) closeSurveyBtn.addEventListener('click', closeSurveyModal);

    // Survey mode toggle (tap map to survey)
    const surveyModeBtn = document.getElementById('btn-survey-mode');
    if (surveyModeBtn) surveyModeBtn.addEventListener('click', () => {
      if (window.AgriApp) {
        window.AgriApp.state.surveyMode = !window.AgriApp.state.surveyMode;
        surveyModeBtn.classList.toggle('active', window.AgriApp.state.surveyMode);
        surveyModeBtn.textContent = window.AgriApp.state.surveyMode ? '🗺️ सर्वे मोड ON' : '📷 सर्वे मोड';
        if (window.AgriApp.state.surveyMode) {
          showToast('🗺️ नक्शे पर कहीं टैप करें — सर्वे खुलेगा', 'info', 4000);
        }
      }
    });
  }

  return {
    init: bindEvents,
    openSurveyForField,
    openSurveyForFarmer,
    openSurveyAt,
    compressImage
  };
})();
