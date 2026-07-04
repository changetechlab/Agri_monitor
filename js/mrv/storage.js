/**
 * storage.js — Agri Monitor MRV Storage Abstraction Layer
 * CHANGE TechLab | Uttarakhand
 *
 * Schema-identical storage that supports:
 *   - localStorage (current default)
 *   - IndexedDB (offline-first PWA)
 *   - Supabase (cloud sync — plug-in ready)
 *   - Firebase (plug-in ready)
 *   - PostgreSQL via REST API (plug-in ready)
 *
 * Usage:
 *   const storage = MRVStorage.init({ adapter: 'local' });
 *   await storage.save(record);
 *   const all = await storage.getAll();
 */

'use strict';

const MRVStorage = (() => {

  // ─── Canonical Data Schema ───────────────────────────────────
  // This schema is identical regardless of which adapter is used.
  // All adapter implementations must read/write this exact structure.

  const SCHEMA_VERSION = '1.0.0';

  function createEmptyRecord(district = 'rudraprayag') {
    const existingCount = 0; // will be resolved on save
    return {
      // ── Identity
      mrv_id:         null,       // CTL-MRV-UK-RPG-2026-000001 (set on first save)
      schema_version: SCHEMA_VERSION,
      status:         'draft',    // draft | submitted | verified | rejected
      created_at:     new Date().toISOString(),
      updated_at:     new Date().toISOString(),
      submitted_at:   null,
      verified_at:    null,

      // ── Audit Trail
      audit_log: [],              // [{ timestamp, action, user, notes }]

      // ── Step 1: Farmer Profile
      farmer: {
        name:           '',
        aadhaar_last4:  '',
        mobile:         '',
        gender:         '',
        category:       '',       // General / OBC / SC / ST
        village:        '',
        gram_panchayat: '',
        block:          '',
        tehsil:         '',
        district:       district,
        state:          'Uttarakhand',
        clf_shg:        '',
        enumerator_name:'',
        enumerator_id:  '',
        lat:            null,
        lng:            null,
        location_accuracy: null
      },

      // ── Step 2: Land / GIS Boundary
      land: {
        khasra_number:  '',
        khata_number:   '',
        village_patwari:'',
        tehsil:         '',
        district:       district,
        state:          'Uttarakhand',
        area_sqm:       0,
        area_ha:        0,
        area_acres:     0,
        area_bigha:     0,
        polygon_coords: [],       // [{lat, lng}, ...]
        geojson:        null,     // GeoJSON Feature object
        centroid:       null,     // {lat, lng}
        map_snapshot_b64: null,   // PNG base64
        entry_method:   'map'     // map | manual | import
      },

      // ── Step 3: Baseline Data
      baseline: {
        season:             '',   // kharif | rabi | zaid | perennial
        year_start:         '',
        year_end:           '',
        primary_crop:       '',
        crop_variety:       '',
        sowing_date:        '',
        harvest_date:       '',
        irrigation_source:  '',   // rainfed | canal | borewell | drip | sprinkler
        irrigation_frequency: '',
        water_source_distance_m: null,
        fertilizer_type:    '',   // none | organic | chemical | both
        fertilizer_npk_kg_ha: { n: 0, p: 0, k: 0 },
        pesticide_use:      false,
        baseline_yield_kg:  0,
        baseline_yield_unit:'kg_bigha',
        soil_type:          '',
        slope:              '',   // flat | gentle | moderate | steep
        notes:              ''
      },

      // ── Step 4: Intervention
      interventions: {
        awd:        { enabled: false, area_ha: 0, seasons: 0, drainage_events: 0 },
        soc:        { enabled: false, area_ha: 0, compost_tons: 0, fym_tons: 0, vermicompost_tons: 0 },
        biochar:    { enabled: false, area_ha: 0, amount_tons: 0, feedstock: '', temp_c: 0 },
        agroforestry:{ enabled: false, species: '', tree_count: 0, area_ha: 0, age_years: 0 },
        compost:    { enabled: false, amount_tons: 0 },
        residue:    { enabled: false, amount_tons: 0, management: 'incorporate' } // incorporate | mulch
      },

      // ── Step 5: Evidence
      evidence: {
        photos: [],     // [{ id, filename, url_b64, lat, lng, timestamp, caption, type }]
        documents: [],  // [{ id, filename, url_b64, doc_type, timestamp }]
        videos: []      // [{ id, filename, url, timestamp, caption }]
      },

      // ── Step 6: Carbon Calculation
      carbon: {
        methodology:         '',       // verra_vm0042 | verra_vm0044 | gold_standard_istss | jcm_india_awd | india_ccts
        calculation_date:    null,
        breakdown: {
          awd_tco2e:         0,
          soc_tco2e:         0,
          biochar_tco2e:     0,
          agroforestry_tco2e:0,
          compost_tco2e:     0,
          residue_tco2e:     0
        },
        gross_tco2e:         0,
        leakage_factor:      0.05,   // 5% default
        permanence_factor:   0.85,
        net_tco2e:           0,
        credit_value_inr:    0,
        credit_value_usd:    0,
        price_per_tco2e_inr: 600,    // India CCTS floor
        notes:               ''
      },

      // ── Step 7: Review (Yield + Timeline)
      yield_data: {
        actual_yield_kg:  0,
        yield_unit:       'kg_bigha',
        market_price_inr: 0,
        income_before_inr:0,
        income_after_inr: 0,
        income_delta_inr: 0
      },

      timeline: []  // [{ id, date, activity, notes, evidence_ref, user }]
    };
  }

  // ─── Adapters ────────────────────────────────────────────────

  const LOCAL_KEY = 'mrv_records_v1';

  // LocalStorage Adapter
  const LocalAdapter = {
    name: 'localStorage',

    async getAll() {
      try {
        return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
      } catch { return []; }
    },

    async getById(id) {
      const all = await this.getAll();
      return all.find(r => r.mrv_id === id) || null;
    },

    async save(record) {
      const all = await this.getAll();
      const idx = all.findIndex(r => r.mrv_id === record.mrv_id);
      if (idx >= 0) { all[idx] = record; }
      else          { all.push(record); }
      localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
      return record;
    },

    async delete(id) {
      const all  = await this.getAll();
      const next = all.filter(r => r.mrv_id !== id);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
    },

    async count() {
      const all = await this.getAll();
      return all.length;
    },

    async clear() {
      localStorage.removeItem(LOCAL_KEY);
    }
  };

  // ── Supabase Adapter stub (wire up when ready)
  const SupabaseAdapter = {
    name: 'supabase',
    _client: null,
    _table: 'mrv_records',

    init(supabaseClient) {
      this._client = supabaseClient;
      return this;
    },

    async getAll() {
      if (!this._client) throw new Error('Supabase client not initialized');
      const { data, error } = await this._client.from(this._table).select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },

    async getById(id) {
      const { data, error } = await this._client.from(this._table).select('*').eq('mrv_id', id).single();
      if (error) throw error;
      return data;
    },

    async save(record) {
      const { data, error } = await this._client.from(this._table).upsert(record, { onConflict: 'mrv_id' });
      if (error) throw error;
      return data?.[0] || record;
    },

    async delete(id) {
      const { error } = await this._client.from(this._table).delete().eq('mrv_id', id);
      if (error) throw error;
    },

    async count() {
      const { count, error } = await this._client.from(this._table).select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count;
    }
  };

  // ── Firebase Adapter stub
  const FirebaseAdapter = {
    name: 'firebase',
    _db: null,
    _collection: 'mrv_records',

    init(firestoreDb) {
      this._db = firestoreDb;
      return this;
    },

    async getAll() {
      // Implement using Firebase SDK when ready
      throw new Error('Firebase adapter not yet configured');
    },

    async save(record) {
      throw new Error('Firebase adapter not yet configured');
    }
  };

  // ─── Sync Queue (offline → cloud) ────────────────────────────

  const SYNC_KEY = 'mrv_sync_queue';

  function addToSyncQueue(action, record) {
    const q = getSyncQueue();
    q.push({ action, record_id: record.mrv_id, timestamp: new Date().toISOString() });
    localStorage.setItem(SYNC_KEY, JSON.stringify(q));
  }

  function getSyncQueue() {
    try { return JSON.parse(localStorage.getItem(SYNC_KEY) || '[]'); } catch { return []; }
  }

  function clearSyncQueue() {
    localStorage.removeItem(SYNC_KEY);
  }

  // ─── Main Interface ──────────────────────────────────────────

  let _adapter = LocalAdapter;

  function init({ adapter = 'local', client = null } = {}) {
    if (adapter === 'supabase' && client) {
      _adapter = SupabaseAdapter.init(client);
    } else if (adapter === 'firebase' && client) {
      _adapter = FirebaseAdapter.init(client);
    } else {
      _adapter = LocalAdapter;
    }
    return this;
  }

  async function saveRecord(record) {
    record.updated_at = new Date().toISOString();

    // Assign MRV-ID on first save
    if (!record.mrv_id) {
      const count = await _adapter.count();
      const district = record.farmer?.district || 'rudraprayag';
      record.mrv_id = window.MRVUtils?.generateMRVId(district, count) || `CTL-MRV-UK-UKD-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
    }

    // Append audit log entry
    record.audit_log = record.audit_log || [];
    record.audit_log.push({
      timestamp: new Date().toISOString(),
      action: 'save',
      user: record.farmer?.enumerator_id || 'local',
      status: record.status
    });

    await _adapter.save(record);
    addToSyncQueue('save', record);
    return record;
  }

  async function getAllRecords() {
    return _adapter.getAll();
  }

  async function getRecord(id) {
    return _adapter.getById(id);
  }

  async function deleteRecord(id) {
    return _adapter.delete(id);
  }

  async function getCount() {
    return _adapter.count();
  }

  async function exportAllJSON() {
    const all = await getAllRecords();
    return { export_date: new Date().toISOString(), schema_version: SCHEMA_VERSION, total: all.length, records: all };
  }

  return {
    init,
    createEmptyRecord,
    saveRecord,
    getAllRecords,
    getRecord,
    deleteRecord,
    getCount,
    exportAllJSON,
    getSyncQueue,
    clearSyncQueue,
    SCHEMA_VERSION,
    // expose adapters for future use
    adapters: { LocalAdapter, SupabaseAdapter, FirebaseAdapter }
  };

})();

window.MRVStorage = MRVStorage;
