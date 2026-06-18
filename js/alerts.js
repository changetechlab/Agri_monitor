/**
 * Agri Monitor — js/alerts.js
 * Rule-based alert engine: NDVI stress, inactive fields, flood/fire risk
 * Stores alerts in Supabase + renders alert cards in sidebar
 */

window.AgriAlerts = (() => {
  let alerts = [];

  // ============================================================
  // Load alerts from Supabase or dummy data
  // ============================================================
  async function loadAlerts() {
    if (window.AgriDB) {
      try {
        const { data, error } = await window.AgriDB
          .from('alerts')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!error && data) {
          alerts = data;
        }
      } catch (err) {
        console.warn('[Alerts] Load failed, using demo data:', err);
        alerts = window.DummyData.alerts;
      }
    } else {
      alerts = window.DummyData.alerts;
    }

    runAlertEngine();
    renderAlerts();
    updateAlertBadge();
  }

  // ============================================================
  // Alert Engine — rule-based checks
  // ============================================================
  function runAlertEngine() {
    const fields = window.AgriFarmers.getFields();
    const farmers = window.AgriFarmers.getFarmers();
    const now = Date.now();
    const INACTIVE_DAYS = (window.AgriConfig || {}).INACTIVE_FIELD_DAYS || 15;
    const NDVI_STRESS = (window.AgriConfig || {}).NDVI_STRESS_THRESHOLD || 0.25;

    const newAlerts = [];

    fields.forEach(field => {
      const farmer = farmers.find(f => f.id === field.farmer_id);
      if (!field.updated_at) return;

      const daysSinceUpdate = (now - new Date(field.updated_at).getTime()) / 86400000;

      // Rule 1: Inactive field
      if (daysSinceUpdate > INACTIVE_DAYS) {
        const existing = alerts.find(a =>
          a.field_id === field.id && a.alert_type === 'inactive_field' && a.is_active
        );
        if (!existing) {
          newAlerts.push({
            id: 'gen_' + field.id + '_inactive',
            field_id: field.id,
            farmer_id: field.farmer_id,
            alert_type: 'inactive_field',
            severity: daysSinceUpdate > 30 ? 'high' : 'medium',
            title: `${Math.floor(daysSinceUpdate)} दिन से कोई अपडेट नहीं`,
            title_hindi: `${Math.floor(daysSinceUpdate)} दिन से कोई अपडेट नहीं`,
            message: `${farmer?.name_hindi || farmer?.name || 'किसान'} का खेत "${field.name || 'खेत'}" ${Math.floor(daysSinceUpdate)} दिनों से अपडेट नहीं हुआ।`,
            is_active: true,
            is_read: false,
            created_at: new Date().toISOString()
          });
        }
      }

      // Rule 2: NDVI stress
      if (field.last_ndvi_value !== null && field.last_ndvi_value !== undefined) {
        if (field.last_ndvi_value < NDVI_STRESS && field.health_status !== 'healthy') {
          const existing = alerts.find(a =>
            a.field_id === field.id && a.alert_type === 'ndvi_stress' && a.is_active
          );
          if (!existing) {
            newAlerts.push({
              id: 'gen_' + field.id + '_ndvi',
              field_id: field.id,
              farmer_id: field.farmer_id,
              alert_type: 'ndvi_stress',
              severity: field.last_ndvi_value < 0.15 ? 'critical' : 'high',
              title: `NDVI ${field.last_ndvi_value.toFixed(2)} — गंभीर तनाव`,
              title_hindi: `NDVI ${field.last_ndvi_value.toFixed(2)} — गंभीर तनाव`,
              message: `${farmer?.name_hindi || ''} के "${field.name || 'खेत'}" में NDVI बहुत कम है। ${window.DummyData.cropLabels?.[field.crop_type] || field.crop_type} में पानी की कमी हो सकती है।`,
              is_active: true,
              is_read: false,
              created_at: new Date().toISOString()
            });
          }
        }
      }
    });

    // Add generated alerts to list (prepend)
    alerts = [...newAlerts, ...alerts];
  }

  // ============================================================
  // Create alert from field observation
  // ============================================================
  async function createFromObservation({ field_id, farmer_id, issue_type, location }) {
    const alertTypeMap = {
      water_stress: 'irrigation_stress',
      disease: 'crop_decline',
      pest: 'crop_decline',
      flood: 'flood_risk'
    };

    const alertType = alertTypeMap[issue_type] || 'ndvi_stress';
    const field = window.AgriFarmers.getFields().find(f => f.id === field_id);
    const farmer = window.AgriFarmers.getFarmers().find(f => f.id === farmer_id);

    const newAlert = {
      id: 'obs_' + Date.now(),
      field_id,
      farmer_id,
      alert_type: alertType,
      severity: 'medium',
      title: `${issue_type === 'water_stress' ? 'सिंचाई की कमी' : 'फसल समस्या'} रिपोर्ट`,
      message: `${farmer?.name_hindi || 'किसान'} ने "${field?.name || 'खेत'}" में ${issue_type} की सूचना दी।`,
      lat: location?.lat,
      lng: location?.lng,
      is_active: true,
      is_read: false,
      created_at: new Date().toISOString()
    };

    alerts.unshift(newAlert);

    if (window.AgriDB) {
      try {
        await window.AgriDB.from('alerts').insert({
          ...newAlert,
          id: undefined
        });
      } catch (err) {
        await window.AgriOffline.queueOperation('insert', 'alerts', newAlert);
      }
    }

    renderAlerts();
    updateAlertBadge();
  }

  // ============================================================
  // Render alert cards in sidebar
  // ============================================================
  function renderAlerts(filter = 'all') {
    const container = document.getElementById('alerts-list');
    if (!container) return;

    let filtered = alerts.filter(a => a.is_active);
    if (filter === 'unread') filtered = filtered.filter(a => !a.is_read);
    if (filter !== 'all' && filter !== 'unread') filtered = filtered.filter(a => a.alert_type === filter);

    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-state">✅ कोई अलर्ट नहीं</div>';
      return;
    }

    const severityConfig = {
      critical: { icon: '🚨', color: '#dc2626', label: 'गंभीर' },
      high:     { icon: '⚠️', color: '#f59e0b', label: 'उच्च' },
      medium:   { icon: '🔔', color: '#3b82f6', label: 'मध्यम' },
      low:      { icon: 'ℹ️', color: '#6b7280', label: 'कम' }
    };

    const typeIcons = {
      ndvi_stress: '🛰️',
      irrigation_stress: '💧',
      inactive_field: '⏰',
      flood_risk: '🌊',
      fire_risk: '🔥',
      landslide_risk: '⛰️',
      pest_risk: '🐛',
      crop_decline: '🌾',
      weather_alert: '⛅'
    };

    container.innerHTML = filtered.map(alert => {
      const sev = severityConfig[alert.severity] || severityConfig.medium;
      const typeIcon = typeIcons[alert.alert_type] || '🔔';
      const timeAgo = getTimeAgo(alert.created_at);

      return `
        <div class="alert-card severity-${alert.severity} ${alert.is_read ? 'read' : 'unread'}" data-alert-id="${alert.id}">
          <div class="alert-header">
            <div class="alert-icon" style="color:${sev.color}">${sev.icon} ${typeIcon}</div>
            <div class="alert-meta">
              <span class="alert-severity" style="color:${sev.color}">${sev.label}</span>
              <span class="alert-time">${timeAgo}</span>
            </div>
          </div>
          <div class="alert-title">${alert.title_hindi || alert.title}</div>
          ${alert.message ? `<div class="alert-message">${alert.message}</div>` : ''}
          <div class="alert-actions">
            ${alert.field_id ? `<button class="alert-btn" onclick="AgriFarmers.showFarmerDetail('${alert.farmer_id}')">👤 किसान</button>` : ''}
            ${(alert.lat && alert.lng) ? `<button class="alert-btn" onclick="AgriMap.flyTo(${alert.lat},${alert.lng},15)">🗺️ देखें</button>` : ''}
            <button class="alert-btn dismiss" onclick="AgriAlerts.dismissAlert('${alert.id}')">✓ ठीक है</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // ============================================================
  // Dismiss / resolve an alert
  // ============================================================
  async function dismissAlert(alertId) {
    alerts = alerts.map(a => a.id === alertId ? { ...a, is_active: false, is_read: true } : a);

    if (window.AgriDB && !alertId.startsWith('gen_') && !alertId.startsWith('obs_')) {
      try {
        await window.AgriDB.from('alerts').update({ is_active: false, resolved_at: new Date().toISOString() }).eq('id', alertId);
      } catch (err) {
        console.warn('[Alerts] Dismiss sync failed:', err);
      }
    }

    renderAlerts();
    updateAlertBadge();
  }

  // ============================================================
  // Mark all as read
  // ============================================================
  function markAllRead() {
    alerts = alerts.map(a => ({ ...a, is_read: true }));
    renderAlerts();
    updateAlertBadge();
  }

  // ============================================================
  // Update badge count in sidebar nav
  // ============================================================
  function updateAlertBadge() {
    const unread = alerts.filter(a => a.is_active && !a.is_read).length;
    const badge = document.getElementById('alert-badge');
    if (badge) {
      badge.textContent = unread;
      badge.style.display = unread > 0 ? 'inline-flex' : 'none';
    }

    // Also update stat card
    const statStress = document.getElementById('stat-stress-alerts');
    if (statStress) statStress.textContent = alerts.filter(a => a.is_active && ['critical','high'].includes(a.severity)).length;
  }

  // ============================================================
  // Helper: time ago string
  // ============================================================
  function getTimeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 60) return `${mins} मिनट पहले`;
    if (hours < 24) return `${hours} घंटे पहले`;
    return `${days} दिन पहले`;
  }

  // ============================================================
  // Bind filter controls
  // ============================================================
  function bindEvents() {
    document.querySelectorAll('.alert-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.alert-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderAlerts(btn.dataset.filter || 'all');
      });
    });

    const markReadBtn = document.getElementById('btn-mark-all-read');
    if (markReadBtn) markReadBtn.addEventListener('click', markAllRead);
  }

  return {
    init: async () => { bindEvents(); await loadAlerts(); },
    loadAlerts,
    renderAlerts,
    dismissAlert,
    markAllRead,
    updateAlertBadge,
    createFromObservation,
    getAlerts: () => alerts
  };
})();
