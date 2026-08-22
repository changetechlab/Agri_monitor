/**
 * Himalayan CRA Data (Climate Resilient Agriculture)
 * DEMO / PLACEHOLDER DATA for Rudraprayag District, Uttarakhand.
 * 
 * NOTE: This data is mocked for demonstration purposes and is NOT for operational
 * decisions without thorough field validation.
 */

window.HIMALAYAN_CRA_DATA = {
    // 12. Global metadata object
    metadata: {
        district: 'Rudraprayag',
        state: 'Uttarakhand',
        data_status: 'DEMO / PLACEHOLDER',
        disclaimer: 'This data is for demonstration purposes only. Do not use for operational decisions without field validation.',
        generated: '2026-08-22',
        layers: {
            landslide: { source: 'Demo Data', resolution: '30m', date: '2026', method: 'slope + drainage + terrain', confidence: 'Medium', field_validation_status: 'Pending' },
            springs: { source: 'Demo Data', resolution: 'Point', date: '2026', method: 'Field Survey Mock', confidence: 'High', field_validation_status: 'Pending' },
            spring_recharge: { source: 'Demo Data', resolution: 'Polygon', date: '2026', method: 'Indicative Recharge Zone', confidence: 'Low', field_validation_status: 'Pending' },
            van_panchayat: { source: 'Demo Data', resolution: 'Polygon', date: '2026', method: 'Admin records mock', confidence: 'Medium', field_validation_status: 'Pending' },
            forest_fire: { source: 'Demo Data', resolution: '30m', date: '2026', method: 'Derived / Indicative', confidence: 'Medium', field_validation_status: 'Pending' },
            fallow_terrace: { source: 'Demo Data', resolution: '10m', date: '2026', method: 'Derived / Indicative', confidence: 'Medium', field_validation_status: 'Pending' },
            wildlife_conflict: { source: 'Demo Data', resolution: 'Point', date: '2026', method: 'Field-Reported / Administrative', confidence: 'High', field_validation_status: 'Pending' },
            road_network: { source: 'Demo Data', resolution: 'Line', date: '2026', method: 'Digitized Mock', confidence: 'High', field_validation_status: 'Pending' },
            market_access: { source: 'Demo Data', resolution: 'Point', date: '2026', method: 'Admin records mock', confidence: 'High', field_validation_status: 'Pending' },
            baranaja: { source: 'Demo Data', resolution: 'GP Level', date: '2026', method: 'Agronomic Model Mock', confidence: 'Medium', field_validation_status: 'Pending' },
            khanti: { source: 'Demo Data', resolution: 'Point', date: '2026', method: 'Terrain Analysis Mock', confidence: 'Medium', field_validation_status: 'Pending' }
        }
    },
    
    // 1. getLandslideData
    getLandslideData: function() {
        return {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[79.05, 30.45], [79.06, 30.46], [79.07, 30.45], [79.06, 30.44], [79.05, 30.45]]]
                    },
                    "properties": {
                        "name": "Zone Alpha",
                        "risk": "high",
                        "slope_deg": 45,
                        "drainage_proximity": "near",
                        "methodology": "slope + drainage + terrain",
                        "data_quality": "Derived / Indicative"
                    }
                },
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[79.15, 30.55], [79.16, 30.56], [79.17, 30.55], [79.16, 30.54], [79.15, 30.55]]]
                    },
                    "properties": {
                        "name": "Zone Beta",
                        "risk": "moderate",
                        "slope_deg": 35,
                        "drainage_proximity": "medium",
                        "methodology": "slope + drainage + terrain",
                        "data_quality": "Derived / Indicative"
                    }
                },
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[78.98, 30.35], [78.99, 30.36], [79.00, 30.35], [78.99, 30.34], [78.98, 30.35]]]
                    },
                    "properties": {
                        "name": "Zone Gamma",
                        "risk": "very_high",
                        "slope_deg": 55,
                        "drainage_proximity": "very near",
                        "methodology": "slope + drainage + terrain",
                        "data_quality": "Derived / Indicative"
                    }
                },
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[79.25, 30.65], [79.26, 30.66], [79.27, 30.65], [79.26, 30.64], [79.25, 30.65]]]
                    },
                    "properties": {
                        "name": "Zone Delta",
                        "risk": "low",
                        "slope_deg": 25,
                        "drainage_proximity": "far",
                        "methodology": "slope + drainage + terrain",
                        "data_quality": "Derived / Indicative"
                    }
                }
            ]
        };
    },

    // 2. getSpringData
    getSpringData: function() {
        return [
            { name: "Naula 1", name_hindi: "नौला 1", lat: 30.40, lng: 79.00, status: "active", type: "perennial", discharge_lps: 0.5, recharge_zone_id: "RZ1", gp_id: "GP1" },
            { name: "Dhara 2", name_hindi: "धारा 2", lat: 30.41, lng: 79.02, status: "inactive", type: "seasonal", discharge_lps: 0.0, recharge_zone_id: "RZ1", gp_id: "GP1" },
            { name: "Naula 3", name_hindi: "नौला 3", lat: 30.45, lng: 79.10, status: "active", type: "perennial", discharge_lps: 1.2, recharge_zone_id: "RZ2", gp_id: "GP2" },
            { name: "Dhara 4", name_hindi: "धारा 4", lat: 30.46, lng: 79.12, status: "active", type: "seasonal", discharge_lps: 0.3, recharge_zone_id: "RZ2", gp_id: "GP2" },
            { name: "Naula 5", name_hindi: "नौला 5", lat: 30.50, lng: 79.20, status: "inactive", type: "seasonal", discharge_lps: 0.0, recharge_zone_id: "RZ3", gp_id: "GP3" },
            { name: "Dhara 6", name_hindi: "धारा 6", lat: 30.52, lng: 79.21, status: "active", type: "perennial", discharge_lps: 0.8, recharge_zone_id: "RZ3", gp_id: "GP3" },
            { name: "Naula 7", name_hindi: "नौला 7", lat: 30.60, lng: 79.15, status: "active", type: "perennial", discharge_lps: 1.5, recharge_zone_id: "RZ4", gp_id: "GP4" },
            { name: "Dhara 8", name_hindi: "धारा 8", lat: 30.62, lng: 79.16, status: "active", type: "seasonal", discharge_lps: 0.4, recharge_zone_id: "RZ4", gp_id: "GP4" }
        ];
    },

    // 3. getSpringRechargeData
    getSpringRechargeData: function() {
        return {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[79.00, 30.42], [79.02, 30.42], [79.01, 30.44], [79.00, 30.42]]]
                    },
                    "properties": {
                        "name": "RZ1",
                        "spring_count": 2,
                        "forest_cover_pct": 60,
                        "slope_class": "moderate",
                        "data_quality": "Indicative Recharge Zone"
                    }
                },
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[79.10, 30.47], [79.12, 30.47], [79.11, 30.49], [79.10, 30.47]]]
                    },
                    "properties": {
                        "name": "RZ2",
                        "spring_count": 2,
                        "forest_cover_pct": 80,
                        "slope_class": "steep",
                        "data_quality": "Indicative Recharge Zone"
                    }
                },
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[79.20, 30.53], [79.22, 30.53], [79.21, 30.55], [79.20, 30.53]]]
                    },
                    "properties": {
                        "name": "RZ3",
                        "spring_count": 2,
                        "forest_cover_pct": 40,
                        "slope_class": "gentle",
                        "data_quality": "Indicative Recharge Zone"
                    }
                },
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[79.15, 30.63], [79.17, 30.63], [79.16, 30.65], [79.15, 30.63]]]
                    },
                    "properties": {
                        "name": "RZ4",
                        "spring_count": 2,
                        "forest_cover_pct": 75,
                        "slope_class": "moderate",
                        "data_quality": "Indicative Recharge Zone"
                    }
                }
            ]
        };
    },

    // 4. getVanPanchayatData
    getVanPanchayatData: function() {
        return {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[79.03, 30.38], [79.05, 30.38], [79.05, 30.40], [79.03, 30.40], [79.03, 30.38]]]
                    },
                    "properties": {
                        "name": "VP Alpha",
                        "name_hindi": "वन पंचायत अल्फा",
                        "area_ha": 150,
                        "gp_overlap": ["GP1", "GP5"],
                        "overlap_area_ha": 120,
                        "forest_type": "Oak",
                        "governance_warning": "Proposed intervention overlaps Van Panchayat area \u2014 verify applicable permission/convergence before implementation."
                    }
                },
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[79.13, 30.48], [79.15, 30.48], [79.15, 30.50], [79.13, 30.50], [79.13, 30.48]]]
                    },
                    "properties": {
                        "name": "VP Beta",
                        "name_hindi": "वन पंचायत बीटा",
                        "area_ha": 200,
                        "gp_overlap": ["GP2"],
                        "overlap_area_ha": 200,
                        "forest_type": "Pine",
                        "governance_warning": "Proposed intervention overlaps Van Panchayat area \u2014 verify applicable permission/convergence before implementation."
                    }
                },
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[79.23, 30.58], [79.25, 30.58], [79.25, 30.60], [79.23, 30.60], [79.23, 30.58]]]
                    },
                    "properties": {
                        "name": "VP Gamma",
                        "name_hindi": "वन पंचायत गामा",
                        "area_ha": 180,
                        "gp_overlap": ["GP3", "GP6"],
                        "overlap_area_ha": 150,
                        "forest_type": "Mixed",
                        "governance_warning": "Proposed intervention overlaps Van Panchayat area \u2014 verify applicable permission/convergence before implementation."
                    }
                }
            ]
        };
    },

    // 5. getForestFireData
    getForestFireData: function() {
        return {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[79.08, 30.42], [79.10, 30.42], [79.10, 30.44], [79.08, 30.44], [79.08, 30.42]]]
                    },
                    "properties": {
                        "name": "Fire Risk Zone 1",
                        "risk": "very_high",
                        "forest_type": "Pine",
                        "chir_pine_pct": 85,
                        "is_pirul_belt": true,
                        "fire_history_events": 5,
                        "data_quality": "Derived / Indicative"
                    }
                },
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[79.18, 30.52], [79.20, 30.52], [79.20, 30.54], [79.18, 30.54], [79.18, 30.52]]]
                    },
                    "properties": {
                        "name": "Fire Risk Zone 2",
                        "risk": "high",
                        "forest_type": "Mixed",
                        "chir_pine_pct": 50,
                        "is_pirul_belt": false,
                        "fire_history_events": 2,
                        "data_quality": "Derived / Indicative"
                    }
                },
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[78.96, 30.32], [78.98, 30.32], [78.98, 30.34], [78.96, 30.34], [78.96, 30.32]]]
                    },
                    "properties": {
                        "name": "Fire Risk Zone 3",
                        "risk": "moderate",
                        "forest_type": "Oak",
                        "chir_pine_pct": 10,
                        "is_pirul_belt": false,
                        "fire_history_events": 1,
                        "data_quality": "Derived / Indicative"
                    }
                }
            ]
        };
    },

    // 6. getFallowTerraceData
    getFallowTerraceData: function() {
        return {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[79.01, 30.39], [79.02, 30.39], [79.02, 30.40], [79.01, 30.40], [79.01, 30.39]]]
                    },
                    "properties": {
                        "name": "Terrace Block 1",
                        "gp_id": "GP1",
                        "status": "fallow_candidate",
                        "area_ha": 5.2,
                        "fallow_years_est": 4,
                        "note": "Fallow/abandonment is an indicative remote-sensing classification and requires field validation.",
                        "data_quality": "Derived / Indicative"
                    }
                },
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[79.11, 30.49], [79.12, 30.49], [79.12, 30.50], [79.11, 30.50], [79.11, 30.49]]]
                    },
                    "properties": {
                        "name": "Terrace Block 2",
                        "gp_id": "GP2",
                        "status": "seasonal_low",
                        "area_ha": 3.8,
                        "fallow_years_est": 1,
                        "note": "Fallow/abandonment is an indicative remote-sensing classification and requires field validation.",
                        "data_quality": "Derived / Indicative"
                    }
                },
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[79.21, 30.59], [79.22, 30.59], [79.22, 30.60], [79.21, 30.60], [79.21, 30.59]]]
                    },
                    "properties": {
                        "name": "Terrace Block 3",
                        "gp_id": "GP3",
                        "status": "fallow_candidate",
                        "area_ha": 7.5,
                        "fallow_years_est": 6,
                        "note": "Fallow/abandonment is an indicative remote-sensing classification and requires field validation.",
                        "data_quality": "Derived / Indicative"
                    }
                },
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[78.99, 30.33], [79.00, 30.33], [79.00, 30.34], [78.99, 30.34], [78.99, 30.33]]]
                    },
                    "properties": {
                        "name": "Terrace Block 4",
                        "gp_id": "GP4",
                        "status": "non_agricultural",
                        "area_ha": 10.1,
                        "fallow_years_est": 10,
                        "note": "Fallow/abandonment is an indicative remote-sensing classification and requires field validation.",
                        "data_quality": "Derived / Indicative"
                    }
                }
            ]
        };
    },

    // 7. getWildlifeConflictData
    getWildlifeConflictData: function() {
        return [
            { lat: 30.39, lng: 79.01, village: "Village A", gp_id: "GP1", conflict_type: "monkey", severity: "high", year: 2025, season: "kharif", affected_crop: "Maize", data_quality: "Field-Reported / Administrative" },
            { lat: 30.40, lng: 79.02, village: "Village B", gp_id: "GP1", conflict_type: "wild_boar", severity: "moderate", year: 2025, season: "rabi", affected_crop: "Wheat", data_quality: "Field-Reported / Administrative" },
            { lat: 30.49, lng: 79.11, village: "Village C", gp_id: "GP2", conflict_type: "monkey", severity: "moderate", year: 2026, season: "zaid", affected_crop: "Vegetables", data_quality: "Field-Reported / Administrative" },
            { lat: 30.50, lng: 79.12, village: "Village D", gp_id: "GP2", conflict_type: "other", severity: "low", year: 2024, season: "kharif", affected_crop: "Paddy", data_quality: "Field-Reported / Administrative" },
            { lat: 30.59, lng: 79.21, village: "Village E", gp_id: "GP3", conflict_type: "wild_boar", severity: "high", year: 2025, season: "rabi", affected_crop: "Potato", data_quality: "Field-Reported / Administrative" },
            { lat: 30.60, lng: 79.22, village: "Village F", gp_id: "GP3", conflict_type: "monkey", severity: "high", year: 2026, season: "kharif", affected_crop: "Millets", data_quality: "Field-Reported / Administrative" }
        ];
    },

    // 8. getRoadNetworkData
    getRoadNetworkData: function() {
        return {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[78.95, 30.30], [79.05, 30.35], [79.15, 30.40]]
                    },
                    "properties": {
                        "name": "NH-107",
                        "type": "national_highway",
                        "surface": "paved",
                        "width_m": 7
                    }
                },
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[79.05, 30.35], [79.10, 30.45], [79.15, 30.50]]
                    },
                    "properties": {
                        "name": "SH-34",
                        "type": "state_highway",
                        "surface": "paved",
                        "width_m": 5
                    }
                },
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[79.10, 30.45], [79.08, 30.48], [79.12, 30.52]]
                    },
                    "properties": {
                        "name": "MDR-12",
                        "type": "district_road",
                        "surface": "gravel",
                        "width_m": 4
                    }
                },
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[79.08, 30.48], [79.06, 30.50]]
                    },
                    "properties": {
                        "name": "PMGSY Road",
                        "type": "village_road",
                        "surface": "kuccha",
                        "width_m": 3
                    }
                }
            ]
        };
    },

    // 9. getMarketAccessData
    getMarketAccessData: function() {
        return [
            { name: "Agastyamuni Mandi", name_hindi: "अगस्त्यमुनि मंडी", lat: 30.39, lng: 79.02, type: "mandi", nearest_road_km: 0.1 },
            { name: "Ukhimath Collection Centre", name_hindi: "ऊखीमठ संग्रहण केंद्र", lat: 30.52, lng: 79.12, type: "collection_centre", nearest_road_km: 0.5 },
            { name: "Guptkashi Cold Storage", name_hindi: "गुप्तकाशी कोल्ड स्टोरेज", lat: 30.55, lng: 79.08, type: "cold_storage", nearest_road_km: 1.0 },
            { name: "Jakholi Mandi", name_hindi: "जखोली मंडी", lat: 30.35, lng: 78.96, type: "mandi", nearest_road_km: 0.2 },
            { name: "Phata Collection Centre", name_hindi: "फाटा संग्रहण केंद्र", lat: 30.58, lng: 79.04, type: "collection_centre", nearest_road_km: 0.8 }
        ];
    },

    // 10. getBaranajaData
    getBaranajaData: function() {
        return [
            { gp_id: "GP1", suitability: "high", rationale: "Optimal altitude and traditionally practiced mixed cropping.", recommended_crops: ["Mandua", "Jhangora", "Gahat", "Rajma"], field_validation_required: true },
            { gp_id: "GP2", suitability: "moderate", rationale: "Lower altitude, suitable for some pulses but millets yield less.", recommended_crops: ["Gahat", "Bhatt", "local pulses"], field_validation_required: true },
            { gp_id: "GP3", suitability: "high", rationale: "Rainfed terraces with good traditional seed diversity.", recommended_crops: ["Mandua", "Rajma", "oilseeds", "Jhangora"], field_validation_required: true },
            { gp_id: "GP4", suitability: "low", rationale: "High incidence of wildlife conflict and steep slopes.", recommended_crops: ["Bhatt", "Gahat"], field_validation_required: true },
            { gp_id: "GP5", suitability: "moderate", rationale: "Partial irrigation available, farmers shifting to cash crops.", recommended_crops: ["Rajma", "local pulses", "Mandua"], field_validation_required: true },
            { gp_id: "GP6", suitability: "high", rationale: "Community interest in reviving traditional agriculture.", recommended_crops: ["Mandua", "Jhangora", "Gahat", "Bhatt", "Rajma", "oilseeds", "local pulses"], field_validation_required: true }
        ];
    },

    // 11. getKhantiData
    getKhantiData: function() {
        return [
            { gp_id: "GP1", site_name: "Site Alpha", lat: 30.40, lng: 79.01, type: "khanti", slope_class: "moderate", potential_convergence: ["MGNREGA", "Watershed Programme"], convergence_note: "Potential convergence \u2014 verify scheme norms." },
            { gp_id: "GP2", site_name: "Site Beta", lat: 30.50, lng: 79.11, type: "contour_trench", slope_class: "steep", potential_convergence: ["MGNREGA", "REAP"], convergence_note: "Potential convergence \u2014 verify scheme norms." },
            { gp_id: "GP3", site_name: "Site Gamma", lat: 30.60, lng: 79.21, type: "contour_bund", slope_class: "gentle", potential_convergence: ["PMKSY"], convergence_note: "Potential convergence \u2014 verify scheme norms." },
            { gp_id: "GP4", site_name: "Site Delta", lat: 30.35, lng: 78.98, type: "khanti", slope_class: "moderate", potential_convergence: ["MGNREGA"], convergence_note: "Potential convergence \u2014 verify scheme norms." },
            { gp_id: "GP5", site_name: "Site Epsilon", lat: 30.45, lng: 79.08, type: "contour_trench", slope_class: "steep", potential_convergence: ["Watershed Programme", "REAP"], convergence_note: "Potential convergence \u2014 verify scheme norms." },
            { gp_id: "GP6", site_name: "Site Zeta", lat: 30.55, lng: 79.18, type: "contour_bund", slope_class: "moderate", potential_convergence: ["PMKSY", "MGNREGA"], convergence_note: "Potential convergence \u2014 verify scheme norms." }
        ];
    }
};
