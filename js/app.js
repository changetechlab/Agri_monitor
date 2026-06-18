/**
 * Agri Monitor — js/app.js
 * ─────────────────────────────────────────────────────────────
 * Purpose  : Main bootstrap + global state + event coordinator.
 *            Initializes all modules in dependency order.
 *            Acts as the single source of truth for app data.
 * Depends  : ALL other js/ modules (must be loaded last)
 * Exposes  : window.AgriApp (state, init, onLogin, showToast, etc.)
 */

window.AgriApp = (() => {

  // ── Global app state ─────────────────────────────────────
  const state = {
    farmers:      [],
    fields:       [],
    alerts:       [],
    clf_clusters: [],
    villages:     [],
    activeTab:    'dashboard',
    surveyMode:   false,
    currentDistrict: 'rudraprayag',
    isLoaded:     false,
    isDemo:       true,
  };

  // ── District map centers ──────────────────────────────────
  const DISTRICT_CENTERS = {
    rudraprayag: [30.3985, 79.0561],
    chamoli:     [30.4007, 79.3216],
    tehri:       [30.3786, 78.4797],
    uttarkashi:  [30.7268, 78.4354],
    pauri:       [29.8827, 79.0034],
  };

  // ═══════════════════════════════════════════════════════════
  // BOOTSTRAP SEQUENCE
  // ═══════════════════════════════════════════════════════════
  async function init() {
    console.log('[App] Agri Monitor initializing…');

    registerServiceWorker();

    // 1. Offline IndexedDB
    try { await AgriOffline.init(); } catch (e) { console.warn('[App] Offline init skipped:', e); }

    // 2. Auth — session check / demo fallback
    try { await AgriAuth.init(); } catch (e) { console.warn('[App] Auth skipped:', e); }

    // 3. Map — must precede layers/NDVI
    AgriMap.init();

    // 4. Data — Supabase with dummyData fallback
    await loadData();

    // 5. Feature modules receive data slices
    initFeatureModules();

    // 5b. Weather & Warning Widget
    try { AgriWeather.init(); } catch (e) { console.warn('[App] Weather init skipped:', e); }

    // 6. Layer system + NDVI controls
    AgriLayers.init();
    AgriNDVI.init();

    // 7. Charts
    AgriCharts.renderAll({
      farmers:      state.farmers,
      fields:       state.fields,
      clf_clusters: state.clf_clusters,
    });

    // 8. All UI event bindings
    bindUIEvents();

    // 9. Network watcher + pending sync count
    try {
      AgriOffline.initNetworkWatcher();
      AgriOffline.refreshPendingCount();
    } catch (e) {}

    state.isLoaded = true;
    showToast('✅ Agri Monitor तैयार है', 'success');
    console.log('[App] Boot complete — farmers:', state.farmers.length, '| fields:', state.fields.length);
  }

  // ═══════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════
  async function loadData() {
    if (window.AgriDB && AgriConfig.USE_SUPABASE) {
      try {
        await loadFromSupabase();
        state.isDemo = false;
        return;
      } catch (err) {
        console.warn('[App] Supabase load failed — using demo data:', err.message);
      }
    }
    loadDemoData();
  }

  async function loadFromSupabase() {
    const [f, fi, al, cl, vi] = await Promise.all([
      AgriDB.from('farmers').select('*').eq('district', state.currentDistrict),
      AgriDB.from('fields').select('*'),
      AgriDB.from('alerts').select('*').eq('is_active', true).order('created_at', { ascending: false }),
      AgriDB.from('clf_clusters').select('*').eq('district', state.currentDistrict),
      AgriDB.from('villages').select('*').eq('district', state.currentDistrict),
    ]);
    if (f.error || fi.error) throw new Error(f.error?.message || fi.error?.message);
    state.farmers      = f.data  || [];
    state.fields       = fi.data || [];
    state.alerts       = al.data || [];
    state.clf_clusters = cl.data || [];
    state.villages     = vi.data || [];
    // Cache locally for offline use
    AgriOffline.cacheData('farmers_cache', state.farmers).catch(() => {});
    AgriOffline.cacheData('fields_cache',  state.fields).catch(() => {});
    AgriOffline.cacheData('alerts_cache',  state.alerts).catch(() => {});
  }

  function loadDemoData() {
    const d = window.DummyData;
    state.farmers      = d.farmers      || [];
    state.fields       = d.fields       || [];
    state.alerts       = d.alerts       || [];
    state.clf_clusters = d.clf_clusters || [];
    state.villages     = d.villages     || [];
    state.isDemo       = true;
    console.log('[App] Demo data loaded');
  }

  // ═══════════════════════════════════════════════════════════
  // FEATURE MODULE INITIALIZATION
  // ═══════════════════════════════════════════════════════════
  function initFeatureModules() {
    if (window.AgriFarmers) {
      AgriFarmers.init({
        farmers:      state.farmers,
        fields:       state.fields,
        villages:     state.villages,
        clf_clusters: state.clf_clusters,
      });
    }
    if (window.AgriAlerts) AgriAlerts.init(state.alerts);
    if (window.AgriCLF)    AgriCLF.init(state.clf_clusters);
    if (window.AgriUpload) AgriUpload.init();
    if (window.AgriVillages) window.AgriVillages.init();
    renderDashboardStats();
  }

  // ── Dashboard stat cards ──────────────────────────────────
  function renderDashboardStats() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const totalAreaHa   = state.fields.reduce((s, f) => s + (f.area_sqm || 0), 0) / 10000;
    const healthyCount  = state.fields.filter(f => f.health_status === 'healthy').length;
    const unreadAlerts  = state.alerts.filter(a => a.is_active && !a.is_read).length;
    const totalMembers  = state.clf_clusters.reduce((s, c) => s + (c.total_members  || 0), 0);
    const activeMembers = state.clf_clusters.reduce((s, c) => s + (c.active_members || 0), 0);

    set('stat-farmers',        state.farmers.length);
    set('stat-fields',         state.fields.length);
    set('stat-healthy',        healthyCount);
    set('stat-alerts',         unreadAlerts);
    set('stat-clfs',           state.clf_clusters.length);
    set('stat-area',           totalAreaHa.toFixed(1));
    set('stat-total-members',  totalMembers);
    set('stat-active-members', activeMembers);
  }

  // ═══════════════════════════════════════════════════════════
  // UI EVENT BINDINGS
  // ═══════════════════════════════════════════════════════════
  function bindUIEvents() {
    bindTabSwitcher();
    bindSidebarToggle();
    bindModalClose();
    bindDistrictSelector();
    bindBlockSelector();
    bindChat();
    bindSyncButton();
    bindAddFieldFAB();
  }

  // ── Tab switching ─────────────────────────────────────────
  function bindTabSwitcher() {
    document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
  }

  function switchTab(tabId) {
    document.querySelectorAll('.tab-btn[data-tab]').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tabId);
      b.setAttribute('aria-selected', b.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-content').forEach(panel => {
      const active = panel.id === `tab-${tabId}`;
      panel.style.display = active ? 'flex' : 'none';
      panel.classList.toggle('active', active);
    });
    state.activeTab = tabId;
    // Lazy-render on first open
    if (tabId === 'satellite') {
      AgriNDVI.renderColorLegend();
      AgriCharts.renderCropDistribution(state.fields);
    }
  }

  // ── Sidebar toggle (desktop collapse / mobile overlay) ────
  function bindSidebarToggle() {
    const btn     = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    if (!btn || !sidebar) return;

    btn.addEventListener('click', () => {
      const mobile = window.innerWidth <= 768;
      sidebar.classList.toggle(mobile ? 'open' : 'collapsed');
      if (!mobile) setTimeout(() => AgriMap.getMap()?.invalidateSize(), 360);
    });

    // Tap outside on mobile closes sidebar
    document.addEventListener('click', (e) => {
      if (window.innerWidth > 768) return;
      if (sidebar.classList.contains('open') &&
          !sidebar.contains(e.target) &&
          !btn.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }

  // ── Generic modal close (data-modal attr + backdrop) ─────
  function bindModalClose() {
    document.querySelectorAll('[data-modal]').forEach(el => {
      el.addEventListener('click', () => {
        document.getElementById(el.dataset.modal)?.classList.add('hidden');
      });
    });
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });
    });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
      document.getElementById('chat-panel')?.classList.add('hidden');
    });
  }

  // ── District selector ─────────────────────────────────────
  function bindDistrictSelector() {
    const sel = document.getElementById('district-select');
    if (!sel) return;
    sel.addEventListener('change', () => {
      state.currentDistrict = sel.value;
      const center = DISTRICT_CENTERS[sel.value] || DISTRICT_CENTERS.rudraprayag;
      AgriMap.flyTo(center[0], center[1], 11);
      
      // Sync weather alerts and temperature
      if (window.AgriWeather) AgriWeather.updateWeather(sel.value);
      
      showToast(`📍 ${sel.options[sel.selectedIndex].text}`, 'success');
    });
  }

  // ── Block selector ────────────────────────────────────────
  function bindBlockSelector() {
    const sel = document.getElementById('block-select');
    if (!sel) return;

    const BLOCK_CENTERS = {
      all:          [30.3985, 79.0561],
      Ukhimath:     [30.4855, 79.2437],
      Jakholi:      [30.3267, 79.0978],
      Augustyamuni: [30.3820, 79.0567]
    };

    sel.addEventListener('change', () => {
      const block = sel.value;
      state.currentBlock = block;

      // 1. Zoom & Center on Map
      const center = BLOCK_CENTERS[block] || BLOCK_CENTERS.all;
      const zoom = block === 'all' ? 11 : 12;
      window.AgriMap.flyTo(center[0], center[1], zoom);

      // 2. Notify villages module
      if (window.AgriVillages) {
        window.AgriVillages.setBlockFilter(block);
      }

      // 3. Filter farmers list in sidebar
      const farmerBlockFilter = document.getElementById('farmer-block-filter');
      if (farmerBlockFilter) {
        farmerBlockFilter.value = block;
        farmerBlockFilter.dispatchEvent(new Event('change'));
      }

      if (window.AgriFarmers) {
        window.AgriFarmers.showFieldsOnMap();
      }
      if (window.AgriCLF) {
        window.AgriCLF.showCLFOnMap();
      }
      if (window.AgriLayers) {
        window.AgriLayers.refreshLayers();
      }

      // 5. Update stats & charts with filtered data
      updateFilteredStatsAndCharts(block);

      showToast(`📍 ब्लॉक: ${sel.options[sel.selectedIndex].text}`, 'success');
    });
  }

  function updateFilteredStatsAndCharts(block) {
    const filteredFarmers = block === 'all' ? state.farmers : state.farmers.filter(f => f.block === block);
    const farmerIds = new Set(filteredFarmers.map(f => f.id));
    const filteredFields = block === 'all' ? state.fields : state.fields.filter(f => farmerIds.has(f.farmer_id));
    const filteredCLFs = block === 'all' ? state.clf_clusters : state.clf_clusters.filter(c => c.block === block);
    const filteredAlerts = block === 'all' ? state.alerts : state.alerts.filter(a => {
      if (a.farmer_id) {
        const farmer = state.farmers.find(f => f.id === a.farmer_id);
        return farmer && farmer.block === block;
      }
      return (a.title_hindi && a.title_hindi.includes(block)) || (a.message_hindi && a.message_hindi.includes(block));
    });

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const animate = (id, target) => {
      const el = document.getElementById(id);
      if (!el) return;
      const start = parseInt(el.textContent) || 0;
      const duration = 500;
      const startTime = Date.now();
      const tick = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        el.textContent = Math.round(start + (target - start) * progress);
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const healthyCount = filteredFields.filter(f => f.health_status === 'healthy').length;
    const stressCount = filteredFields.filter(f => f.health_status === 'stress').length;
    const organicCount = filteredFarmers.filter(f => f.is_organic).length;
    const polyhouseCount = filteredFarmers.filter(f => f.has_polyhouse || filteredFields.some(fd => fd.id === 'fd7' && f.id === fd.farmer_id)).length;
    const unreadAlerts = filteredAlerts.filter(a => a.is_active && !a.is_read).length;

    // Average NDVI
    const ndvis = filteredFields.filter(f => f.last_ndvi_value !== null && f.last_ndvi_value !== undefined).map(f => f.last_ndvi_value);
    const avgNDVI = ndvis.length > 0 ? ndvis.reduce((s, v) => s + v, 0) / ndvis.length : null;

    animate('stat-total-farmers', filteredFarmers.length);
    animate('stat-total-fields', filteredFields.length);
    animate('stat-stress-alerts', stressCount);
    animate('stat-organic', organicCount);
    animate('stat-clf-count', filteredCLFs.length);
    animate('stat-polyhouse', polyhouseCount);

    const ndviAvgEl = document.getElementById('stat-ndvi-avg');
    if (ndviAvgEl) {
      ndviAvgEl.textContent = avgNDVI ? avgNDVI.toFixed(2) : '—';
      ndviAvgEl.style.color = avgNDVI >= 0.45 ? 'var(--green)' : avgNDVI >= 0.25 ? 'var(--yellow)' : avgNDVI ? 'var(--red)' : 'var(--text-muted)';
    }

    if (window.AgriCharts) {
      window.AgriCharts.renderAll({
        farmers: filteredFarmers,
        fields: filteredFields,
        clf_clusters: filteredCLFs
      });
    }

    const badge = document.getElementById('alert-badge');
    if (badge) {
      badge.textContent = unreadAlerts;
      badge.style.display = unreadAlerts > 0 ? 'inline-flex' : 'none';
    }
  }

  // ── Chat panel ────────────────────────────────────────────
  function bindChat() {
    const toggle = document.getElementById('btn-chat-toggle');
    const panel  = document.getElementById('chat-panel');
    const close  = document.getElementById('chat-close');
    const send   = document.getElementById('chat-send');
    const input  = document.getElementById('chat-input');

    toggle?.addEventListener('click', () => panel?.classList.toggle('hidden'));
    close?.addEventListener('click',  () => panel?.classList.add('hidden'));

    const sendMsg = () => {
      const msg = input?.value.trim();
      if (!msg) return;
      appendChat(msg, 'user');
      input.value = '';
      setTimeout(() => appendChat(getChatReply(msg), 'bot'), 500);
    };
    send?.addEventListener('click', sendMsg);
    input?.addEventListener('keydown', e => { if (e.key === 'Enter') sendMsg(); });
  }

  function appendChat(text, type) {
    const box = document.getElementById('chat-messages');
    if (!box) return;
    const div = document.createElement('div');
    div.className = `chat-msg ${type}`;
    div.innerHTML = `<div class="msg-content hi">${text}</div>`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  function getChatReply(msg) {
    const m = msg.toLowerCase();
    if (m.includes('किसान') || m.includes('farmer'))
      return `👨‍🌾 ${state.farmers.length} किसान पंजीकृत हैं रुद्रप्रयाग में।`;
    if (m.includes('ndvi') || m.includes('फसल'))
      return `🌾 ${state.fields.filter(f => f.health_status === 'healthy').length}/${state.fields.length} खेत स्वस्थ हैं। Satellite tab में NDVI देखें।`;
    if (m.includes('अलर्ट') || m.includes('alert'))
      return `⚠️ ${state.alerts.filter(a => !a.is_read).length} अपठित अलर्ट हैं।`;
    if (m.includes('clf') || m.includes('समूह'))
      return `🏘️ ${state.clf_clusters.length} CLF/FPO — ${state.clf_clusters.reduce((s, c) => s + c.total_members, 0)} कुल सदस्य।`;
    if (m.includes('सिंचाई') || m.includes('water'))
      return `💧 ${state.farmers.filter(f => f.irrigation_source === 'spring').length} किसान प्राकृतिक स्रोत से सिंचाई करते हैं।`;
    return `नमस्ते! 🙏 किसान, खेत, NDVI, CLF, या अलर्ट के बारे में पूछें।`;
  }

  // ── Sync button ───────────────────────────────────────────
  function bindSyncButton() {
    document.getElementById('btn-sync')?.addEventListener('click', async () => {
      const result = await AgriOffline.syncAll().catch(() => ({ synced: 0, failed: 0 }));
      showToast(`✅ ${result.synced} रिकॉर्ड सिंक हुए`, 'success');
    });
  }

  // ── Add Field FAB ─────────────────────────────────────────
  function bindAddFieldFAB() {
    document.getElementById('btn-add-field')?.addEventListener('click', () => {
      if (!AgriAuth.isLoggedIn()) { AgriAuth.showLoginModal(); return; }
      window.AgriFarmers?.openAddFarmerModal();
    });
  }

  // ═══════════════════════════════════════════════════════════
  // AUTH CALLBACKS (called by auth.js)
  // ═══════════════════════════════════════════════════════════
  function onLogin(user) {
    const fab    = document.getElementById('btn-add-field');
    const addBtn = document.getElementById('btn-add-farmer');
    if (fab)    fab.style.display = 'flex';
    if (addBtn) addBtn.disabled   = false;
    showToast('✅ लॉगिन सफल', 'success');
  }

  function onLogout() {
    const fab = document.getElementById('btn-add-field');
    if (fab) fab.style.display = 'none';
    showToast('👋 लॉगआउट', 'default');
  }

  // ═══════════════════════════════════════════════════════════
  // TOAST NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════
  function showToast(message, type = 'default') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  // ── Service worker ────────────────────────────────────────
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('[SW] Registered:', reg.scope))
        .catch(err => console.warn('[SW] Failed:', err));
    }
  }

  // ── Public API ────────────────────────────────────────────
  return {
    init,
    state,
    onLogin,
    onLogout,
    loadDemoData,
    showToast,
    renderDashboardStats,
    switchTab,
    updateFilteredStatsAndCharts,
  };

})();

// Auto-boot on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => AgriApp.init());
