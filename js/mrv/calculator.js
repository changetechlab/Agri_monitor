/**
 * calculator.js — Agri Monitor Carbon Calculation Engine
 * CHANGE TechLab | Uttarakhand
 *
 * Implements emission factor math for all 6 interventions.
 * Emission factors loaded from data/emission_factors.json
 */

'use strict';

const MRVCalculator = (() => {

  let EF = null; // emission_factors.json data

  async function loadEF() {
    if (EF) return EF;
    try {
      const res = await fetch('./data/emission_factors.json');
      EF = await res.json();
    } catch (e) {
      console.warn('EF load failed, using defaults', e);
      EF = _defaultEF();
    }
    return EF;
  }

  // ─── Individual Intervention Calculators ─────────────────────

  function calcAWD({ area_ha = 0, seasons = 1, drainage_events = 1 }) {
    if (!area_ha || area_ha <= 0) return 0;
    const ef = EF?.awd || {};
    const ef_continuous   = ef.ef_ch4_continuous   || 1.30;
    const ef_intermittent = ef.ef_ch4_intermittent  || 0.52;
    const gwp             = ef.gwp_ch4              || 28;
    const reduction       = (ef_continuous - ef_intermittent) * drainage_events;
    const tco2e           = reduction * gwp * area_ha * seasons;
    return Math.max(0, +tco2e.toFixed(4));
  }

  function calcSOC({ area_ha = 0, compost_tons = 0, fym_tons = 0, vermicompost_tons = 0 }) {
    if (!area_ha || area_ha <= 0) return 0;
    const ef = EF?.soc || {};
    const seq_rate = ef.sequestration_rate_ha_yr || 0.35;
    const perm     = ef.permanence_factor         || 0.85;

    const organic_bonus =
      (compost_tons     * (ef.ef_per_ton_compost       || 0.18)) +
      (fym_tons         * (ef.ef_per_ton_fym            || 0.12)) +
      (vermicompost_tons* (ef.ef_per_ton_vermicompost   || 0.22));

    const base_seq = area_ha * seq_rate * perm;
    return Math.max(0, +(base_seq + organic_bonus).toFixed(4));
  }

  function calcBiochar({ amount_tons = 0, feedstock = 'rice_husk', temp_c = 550 }) {
    if (!amount_tons || amount_tons <= 0) return 0;
    const ef = EF?.biochar || {};
    const ff = (ef.feedstock_factors || {})[feedstock] || (ef.ef_per_ton_biochar || 2.38);
    const stability = temp_c >= 550 ? (ef.stability_factor || 0.90) : 0.70;
    return Math.max(0, +(amount_tons * ff * stability).toFixed(4));
  }

  function calcAgroforestry({ tree_count = 0, species = 'other', age_years = 1 }) {
    if (!tree_count || tree_count <= 0) return 0;
    const ef = EF?.agroforestry || {};
    const sp = (ef.species_factors || {})[species] || ef.species_factors?.other || { seq_per_tree_yr: 0.015 };
    const bg_ratio = ef.below_ground_ratio || 0.26;
    const above    = tree_count * sp.seq_per_tree_yr * age_years;
    const total    = above * (1 + bg_ratio);
    return Math.max(0, +total.toFixed(4));
  }

  function calcCompost({ amount_tons = 0 }) {
    if (!amount_tons || amount_tons <= 0) return 0;
    const ef = EF?.compost || {};
    const n2o_factor = (ef.n2o_avoidance_per_ton || 0.0125) * (ef.gwp_n2o || 265);
    const soc_factor = ef.soc_benefit_per_ton || 0.08;
    return Math.max(0, +(amount_tons * (n2o_factor + soc_factor)).toFixed(4));
  }

  function calcResidue({ amount_tons = 0, management = 'incorporate' }) {
    if (!amount_tons || amount_tons <= 0) return 0;
    const ef = EF?.residue || {};
    const burning_ef  = ef.ef_burning_per_ton   || 0.19;
    const incorp_ef   = ef.soc_incorporation_factor || 0.12;
    // Avoided burning + SOC benefit from incorporation
    const avoided = management === 'incorporate'
      ? (amount_tons * burning_ef) + (amount_tons * incorp_ef)
      : amount_tons * burning_ef;
    return Math.max(0, +avoided.toFixed(4));
  }

  // ─── Master Calculator ────────────────────────────────────────

  async function calculate(interventions, options = {}) {
    await loadEF();
    const prices = EF?.carbon_price_reference || {};

    const breakdown = {
      awd_tco2e:          interventions.awd?.enabled        ? calcAWD(interventions.awd)                   : 0,
      soc_tco2e:          interventions.soc?.enabled        ? calcSOC(interventions.soc)                   : 0,
      biochar_tco2e:      interventions.biochar?.enabled    ? calcBiochar(interventions.biochar)            : 0,
      agroforestry_tco2e: interventions.agroforestry?.enabled ? calcAgroforestry(interventions.agroforestry) : 0,
      compost_tco2e:      interventions.compost?.enabled    ? calcCompost(interventions.compost)            : 0,
      residue_tco2e:      interventions.residue?.enabled    ? calcResidue(interventions.residue)            : 0
    };

    const gross_tco2e = Object.values(breakdown).reduce((a, b) => a + b, 0);
    const leakage     = options.leakage_factor  ?? 0.05;
    const permanence  = options.permanence_factor ?? 0.85;
    const net_tco2e   = +(gross_tco2e * (1 - leakage) * permanence).toFixed(4);

    const price_inr   = options.price_per_tco2e_inr || prices.india_ccts_inr_per_tco2e || 600;
    const price_usd   = options.price_per_tco2e_usd || prices.voluntary_market_usd_per_tco2e || 15;
    const usd_rate    = prices.currency_inr_per_usd || 83.5;

    return {
      breakdown,
      gross_tco2e:      +gross_tco2e.toFixed(4),
      leakage_factor:   leakage,
      permanence_factor: permanence,
      net_tco2e,
      credit_value_inr: +(net_tco2e * price_inr).toFixed(0),
      credit_value_usd: +(net_tco2e * price_usd).toFixed(2),
      price_per_tco2e_inr: price_inr,
      calculation_date: new Date().toISOString(),
      ef_version: EF?.version || '1.0.0'
    };
  }

  // ─── Market Price Scenarios ──────────────────────────────────

  async function scenarios(net_tco2e) {
    await loadEF();
    const p = EF?.carbon_price_reference || {};
    const r = p.currency_inr_per_usd || 83.5;
    return [
      { market: 'India CCTS',       price_inr: p.india_ccts_inr_per_tco2e || 600,  value_inr: Math.round(net_tco2e * (p.india_ccts_inr_per_tco2e || 600)) },
      { market: 'Voluntary Market', price_inr: Math.round((p.voluntary_market_usd_per_tco2e || 15) * r), value_inr: Math.round(net_tco2e * (p.voluntary_market_usd_per_tco2e || 15) * r) },
      { market: 'Gold Standard',    price_inr: Math.round((p.gold_standard_usd_per_tco2e   || 25) * r), value_inr: Math.round(net_tco2e * (p.gold_standard_usd_per_tco2e   || 25) * r) },
      { market: 'JCM Japan-India',  price_inr: Math.round((p.jcm_japan_usd_per_tco2e      || 20) * r), value_inr: Math.round(net_tco2e * (p.jcm_japan_usd_per_tco2e      || 20) * r) }
    ];
  }

  function _defaultEF() {
    return {
      awd:       { ef_ch4_continuous: 1.30, ef_ch4_intermittent: 0.52, gwp_ch4: 28, permanence_factor: 0.85 },
      soc:       { sequestration_rate_ha_yr: 0.35, permanence_factor: 0.85, ef_per_ton_compost: 0.18, ef_per_ton_fym: 0.12, ef_per_ton_vermicompost: 0.22 },
      biochar:   { ef_per_ton_biochar: 2.38, stability_factor: 0.90, feedstock_factors: { rice_husk: 2.1, wheat_straw: 1.9 } },
      agroforestry: { below_ground_ratio: 0.26, species_factors: { other: { seq_per_tree_yr: 0.015 } } },
      compost:   { n2o_avoidance_per_ton: 0.0125, gwp_n2o: 265, soc_benefit_per_ton: 0.08 },
      residue:   { ef_burning_per_ton: 0.19, soc_incorporation_factor: 0.12 },
      carbon_price_reference: { india_ccts_inr_per_tco2e: 600, voluntary_market_usd_per_tco2e: 15, gold_standard_usd_per_tco2e: 25, jcm_japan_usd_per_tco2e: 20, currency_inr_per_usd: 83.5 },
      version: '1.0.0-fallback'
    };
  }

  return { loadEF, calculate, scenarios, calcAWD, calcSOC, calcBiochar, calcAgroforestry, calcCompost, calcResidue };

})();

window.MRVCalculator = MRVCalculator;
