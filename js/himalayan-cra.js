(function() {
    'use strict';

    const SCORE_HIGH = 'high', SCORE_MEDIUM = 'medium', SCORE_LOW = 'low';

    // Transparent, changeable weight configuration
    const WEIGHT_CONFIG = {
      hazard_risk:       { weight: 0.25, components: ['climate_hazard', 'slope_erosion', 'landslide', 'fire_risk'] },
      water_opportunity: { weight: 0.20, components: ['water_stress', 'spring_recharge'] },
      agri_opportunity:  { weight: 0.20, components: ['agri_potential', 'fallow_recovery'] },
      livelihood:        { weight: 0.15, components: ['crop_stress', 'wildlife_conflict'] },
      accessibility:     { weight: 0.10, components: ['road_access'] },
      governance:        { weight: 0.10, components: ['van_panchayat'] }
    };

    function landslideRiskScore(gp) {
        const risk = (gp.landslide_risk || '').toLowerCase();
        if (risk === 'very_high' || risk === 'high') return { score: 3, level: SCORE_HIGH, label: 'अत्यधिक भूस्खलन खतरा' };
        if (risk === 'moderate') return { score: 2, level: SCORE_MEDIUM, label: 'मध्यम भूस्खलन खतरा' };
        return { score: 1, level: SCORE_LOW, label: 'कम भूस्खलन खतरा' };
    }

    function forestFireRiskScore(gp) {
        const risk = (gp.fire_risk_class || '').toLowerCase();
        let score = 1;
        let label = 'कम वन अग्नि खतरा';
        let level = SCORE_LOW;

        if (risk === 'very_high' || risk === 'high') {
            score = 3; level = SCORE_HIGH; label = 'अत्यधिक वन अग्नि खतरा';
        } else if (risk === 'moderate') {
            score = 2; level = SCORE_MEDIUM; label = 'मध्यम वन अग्नि खतरा';
        }

        if (gp.chir_pine_belt) {
            score = Math.min(3, score + 1);
            if (score === 3) { level = SCORE_HIGH; label = 'अत्यधिक वन अग्नि खतरा (चीड़ वन)'; }
            else if (score === 2) { level = SCORE_MEDIUM; label = 'मध्यम वन अग्नि खतरा (चीड़ वन)'; }
        }
        return { score, level, label };
    }

    function fallowOpportunityScore(gp) {
        const fallow = gp.fallow_pct || 0;
        if (fallow >= 30) return { score: 3, level: SCORE_HIGH, label: 'उच्च परती पुनर्स्थापना अवसर' };
        if (fallow >= 15) return { score: 2, level: SCORE_MEDIUM, label: 'मध्यम परती पुनर्स्थापना अवसर' };
        return { score: 1, level: SCORE_LOW, label: 'कम परती पुनर्स्थापना अवसर' };
    }

    function wildlifeConflictScore(gp) {
        const conflict = (gp.wildlife_conflict_index || '').toLowerCase();
        if (conflict === 'high') return { score: 3, level: SCORE_HIGH, label: 'उच्च वन्यजीव संघर्ष' };
        if (conflict === 'moderate') return { score: 2, level: SCORE_MEDIUM, label: 'मध्यम वन्यजीव संघर्ष' };
        return { score: 1, level: SCORE_LOW, label: 'कम वन्यजीव संघर्ष' };
    }

    function roadAccessScore(gp) {
        const access = (gp.road_access_class || '').toLowerCase();
        if (access === 'very_low' || access === 'low') return { score: 3, level: SCORE_HIGH, label: 'बहुत कम सड़क पहुँच' };
        if (access === 'moderate') return { score: 2, level: SCORE_MEDIUM, label: 'मध्यम सड़क पहुँच' };
        return { score: 1, level: SCORE_LOW, label: 'अच्छी सड़क पहुँच' };
    }

    function springRechargeScore(gp) {
        const active = gp.active_springs || 0;
        const total = gp.total_springs || 1; // avoid division by zero
        const ratio = active / total;
        if (ratio < 0.3) return { score: 3, level: SCORE_HIGH, label: 'उच्च जल स्रोत पुनर्भरण आवश्यकता' };
        if (ratio < 0.6) return { score: 2, level: SCORE_MEDIUM, label: 'मध्यम जल स्रोत पुनर्भरण आवश्यकता' };
        return { score: 1, level: SCORE_LOW, label: 'कम जल स्रोत पुनर्भरण आवश्यकता' };
    }

    function vanPanchayatScore(gp) {
        if (gp.van_panchayat_overlap) {
            if ((gp.van_panchayat_area_ha || 0) > 30) return { score: 2, level: SCORE_MEDIUM, label: 'महत्वपूर्ण वन पंचायत क्षेत्र' };
            return { score: 1.5, level: SCORE_LOW, label: 'आंशिक वन पंचायत क्षेत्र' };
        }
        return { score: 1, level: SCORE_LOW, label: 'कोई वन पंचायत क्षेत्र नहीं' };
    }

    function calculateExtendedScores(gp) {
        const baseScores = (window.CRA && typeof window.CRA.calculateCRAScore === 'function') ? window.CRA.calculateCRAScore(gp) : [];
        
        const himalayanIndicators = [
            { id: 'landslide', name: 'Landslide Risk', ...landslideRiskScore(gp) },
            { id: 'fire_risk', name: 'Forest Fire Risk', ...forestFireRiskScore(gp) },
            { id: 'fallow_recovery', name: 'Fallow Restoration', ...fallowOpportunityScore(gp) },
            { id: 'wildlife_conflict', name: 'Wildlife Conflict', ...wildlifeConflictScore(gp) },
            { id: 'road_access', name: 'Road/Market Access', ...roadAccessScore(gp) },
            { id: 'spring_recharge', name: 'Spring Recharge', ...springRechargeScore(gp) },
            { id: 'van_panchayat', name: 'Van Panchayat Governance', ...vanPanchayatScore(gp) }
        ];

        let totalWeighted = 0;
        let totalWeight = 0;
        let categories = {};

        // Combine base indicators and himalayan for weight calculation
        const allIndicators = {};
        if (Array.isArray(baseScores)) {
            baseScores.forEach(i => allIndicators[i.id] = i.score);
        } else {
            // fallback if baseScores is object
            Object.values(baseScores).forEach(i => { if (i && i.id) allIndicators[i.id] = i.score; });
        }
        himalayanIndicators.forEach(i => allIndicators[i.id] = i.score);

        for (const [catName, catConfig] of Object.entries(WEIGHT_CONFIG)) {
            let catSum = 0;
            let catCount = 0;
            catConfig.components.forEach(comp => {
                if (allIndicators[comp] !== undefined) {
                    catSum += allIndicators[comp];
                    catCount++;
                }
            });
            const catAvg = catCount > 0 ? catSum / catCount : 0;
            if (catCount > 0) {
                totalWeighted += catAvg * catConfig.weight;
                totalWeight += catConfig.weight;
                categories[catName] = { score: catAvg, level: catAvg >= 2.3 ? 'high' : catAvg >= 1.5 ? 'medium' : 'low' };
            }
        }

        const finalScore = totalWeight > 0 ? totalWeighted / totalWeight : 0;
        const overallLevel = finalScore >= 2.3 ? 'high' : finalScore >= 1.5 ? 'medium' : 'low';

        return {
            baseIndicators: baseScores,
            himalayanIndicators,
            weightedOverall: { score: finalScore, level: overallLevel },
            categories
        };
    }

    const HIMALAYAN_INTERVENTIONS = {
        baranaja: {
            id: 'baranaja',
            icon: '🌾', category: 'crop',
            name: 'Baranaja (Traditional Mixed-Cropping)', name_hindi: 'बारहनाजा (पारंपरिक मिश्रित फसल)',
            desc: 'Rule-based traditional mixed cropping system for spreading climatic risk, increasing crop diversification, and resilience.',
            components: ['Mandua', 'Jhangora', 'Gahat', 'Rajma', 'Bhatt', 'local pulses', 'oilseeds'],
            benefit: 'Risk diversification, soil health, nutritional security',
            mrv_kpi: 'Area under mixed cropping',
            evidence: 'Traditional ecological knowledge, ICRISAT studies',
            field_validation_required: true
        },
        khanti_contour: {
            id: 'khanti_contour',
            icon: '⛏️', category: 'land',
            name: 'Khanti / Contour Trench', name_hindi: 'खंती / कंटूर ट्रेंच',
            desc: 'Continuous contour trenches for moisture conservation and runoff velocity reduction on slopes.',
            potential_convergence: ['MGNREGA', 'REAP'],
            convergence_note: 'Potential convergence — verify scheme norms.'
        },
        chal_khal: {
            id: 'chal_khal',
            icon: '💧', category: 'water',
            name: 'Chal-Khal', name_hindi: 'चाल-खाल (जल संचय गड्ढे)',
            desc: 'Micro-percolation pits or ponds to catch surface runoff and augment spring recharge.',
            potential_convergence: ['MGNREGA', 'REAP', 'PMKSY']
        },
        pine_needle_mgmt: {
            id: 'pine_needle_mgmt',
            icon: '🌲', category: 'land',
            name: 'Pine Needle / Pirul Management', name_hindi: 'पिरूल प्रबंधन / बायोचार',
            desc: 'Collection of Chir Pine needles (Pirul) to reduce fire risk and convert to briquettes or biochar.'
        },
        wildlife_resilient_crop: {
            id: 'wildlife_resilient_crop',
            icon: '🐒', category: 'crop',
            name: 'Wildlife-Resilient Crop Selection', name_hindi: 'वन्यजीव-प्रतिरोधी फसल चयन',
            desc: 'Cultivation of crops less prone to wildlife depredation (e.g., turmeric, ginger, aromatic plants).'
        },
        fallow_restoration: {
            id: 'fallow_restoration',
            icon: '🏗️', category: 'land',
            name: 'Fallow Terrace Restoration', name_hindi: 'परती सीढ़ीदार खेत पुनर्स्थापना',
            desc: 'Reclaiming abandoned terraced fields with agroforestry or resilient crops.'
        }
    };

    function getHimalayanInterventions(gp, extendedScores) {
        const interventions = [];
        const indicators = extendedScores.himalayanIndicators || [];
        const baseScores = extendedScores.baseIndicators || [];
        
        const getScore = (id) => {
            const ind = indicators.find(i => i.id === id) || baseScores.find(i => i.id === id);
            return ind ? ind.score : 1;
        };

        const hasVanPanchayat = gp.van_panchayat_overlap;

        // landslide risk high/very_high (score >= 3)
        if (getScore('landslide') >= 3) {
            interventions.push({
                ...HIMALAYAN_INTERVENTIONS.khanti_contour,
                why: 'High landslide/erosion risk on slopes',
                where: 'Sloped agricultural land and commons',
                data_basis: 'Landslide hazard index',
                confidence: 'high',
                field_validation_required: true,
                warning: hasVanPanchayat ? 'Van Panchayat overlap: requires community consultation.' : null
            });
        }

        // fire risk high + chir_pine_belt
        if (getScore('fire_risk') >= 3 && gp.chir_pine_belt) {
            interventions.push({
                ...HIMALAYAN_INTERVENTIONS.pine_needle_mgmt,
                why: 'High fire risk in Chir Pine belt',
                where: 'Forest fringes and agroforestry plots',
                data_basis: 'Fire risk class + Chir Pine presence',
                confidence: 'high',
                field_validation_required: true,
                warning: hasVanPanchayat ? 'Van Panchayat overlap: governance synergy possible.' : null
            });
        }

        // fallow_pct > 20
        if ((gp.fallow_pct || 0) > 20) {
            interventions.push({
                ...HIMALAYAN_INTERVENTIONS.fallow_restoration,
                why: 'High proportion of fallow land',
                where: 'Abandoned terraces',
                data_basis: `Fallow percentage: ${gp.fallow_pct}%`,
                confidence: 'high',
                field_validation_required: true,
                warning: hasVanPanchayat ? 'Van Panchayat overlap: check land tenure.' : null
            });
            interventions.push({
                ...HIMALAYAN_INTERVENTIONS.baranaja,
                why: 'Resilient cropping for restored fallows',
                where: 'Restored agricultural land',
                data_basis: 'Fallow restoration suitability',
                confidence: 'medium',
                field_validation_required: true
            });
        } else if (getScore('agri_potential') >= 2) { 
             interventions.push({
                ...HIMALAYAN_INTERVENTIONS.baranaja,
                why: 'Suitable for crop diversification',
                where: 'Rainfed agricultural land',
                data_basis: 'Agri opportunity score',
                confidence: 'medium',
                field_validation_required: true
            });
        }

        // wildlife conflict high
        const wlScore = getScore('wildlife_conflict');
        if (wlScore >= 3) {
            interventions.push({
                ...HIMALAYAN_INTERVENTIONS.wildlife_resilient_crop,
                why: 'High incidence of wildlife conflict',
                where: 'Fields near forest edges',
                data_basis: 'Wildlife conflict index',
                confidence: 'high',
                field_validation_required: true
            });
        }

        // water stress high or spring recharge need high
        if (getScore('spring_recharge') >= 3 || getScore('water_stress') >= 3) {
            interventions.push({
                ...HIMALAYAN_INTERVENTIONS.chal_khal,
                why: 'Critical need for groundwater/spring recharge',
                where: 'Catchment areas and recharge zones',
                data_basis: 'Spring discharge/water stress data',
                confidence: 'high',
                field_validation_required: true,
                warning: hasVanPanchayat ? 'Van Panchayat overlap: coordinate with VP for catchment protection.' : null
            });
        }

        // ROAD ACCESS WARNING
        const roadScore = getScore('road_access');
        if (roadScore >= 3) {
            interventions.forEach(inv => {
                if (inv.category === 'crop' && inv.id !== 'baranaja') {
                    inv.warning = (inv.warning ? inv.warning + ' | ' : '') + 'WARNING: Low road access. Avoid perishable-only crop recommendations.';
                }
            });
        }

        // Deduplicate
        const unique = [];
        const seen = new Set();
        for (const inv of interventions) {
            if (!seen.has(inv.id)) {
                seen.add(inv.id);
                unique.push(inv);
            }
        }
        return unique;
    }

    function renderHimalayanAssessment(gp, extendedScores) {
        if (!extendedScores) return '';
        const html = `
        <div class="card himalayan-cra-card">
            <h4>🏔️ Himalayan-Specific CRA Assessment</h4>
            <div class="data-quality-notice" style="color: #856404; background-color: #fff3cd; padding: 10px; margin-bottom: 15px; border: 1px solid #ffeeba; border-radius: 4px;">
                ⚠️ DEMO / PLACEHOLDER — All Himalayan indicators use demonstration data and require field validation.
            </div>
            <table class="cra-table">
                <thead>
                    <tr><th>Indicator</th><th>Score</th><th>Level</th></tr>
                </thead>
                <tbody>
                    ${extendedScores.himalayanIndicators.map(ind => `
                    <tr>
                        <td>${ind.name}</td>
                        <td>${ind.score >= 3 ? '●●●' : ind.score >= 2 ? '●●○' : ind.score > 1 ? '●○○' : '○○○'}</td>
                        <td><span class="badge badge-${ind.level}">${ind.label}</span></td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="overall-priority" style="margin-top: 15px;">
                <h5>Weighted Overall Priority: <span class="badge badge-${extendedScores.weightedOverall.level}">${extendedScores.weightedOverall.score.toFixed(2)}</span></h5>
                <p>Categories: ${Object.entries(extendedScores.categories).map(([k, v]) => `${k} (${v.score.toFixed(1)})`).join(', ')}</p>
            </div>
        </div>
        `;
        return html;
    }

    function renderHimalayanInterventions(list) {
        if (!list || !list.length) return '<p>No specific Himalayan interventions recommended.</p>';
        return list.map(inv => `
        <div class="intervention-card" style="border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 5px;">
            <h5>${inv.icon} ${inv.name} / ${inv.name_hindi}</h5>
            <p>${inv.desc}</p>
            <ul>
                <li><strong>WHY:</strong> ${inv.why}</li>
                <li><strong>WHERE:</strong> ${inv.where}</li>
                <li><strong>DATA BASIS:</strong> ${inv.data_basis}</li>
                <li><strong>CONFIDENCE:</strong> <span class="badge badge-${inv.confidence}">${inv.confidence.toUpperCase()}</span></li>
                <li><strong>FIELD VALIDATION REQUIRED:</strong> ${inv.field_validation_required ? 'Yes' : 'No'}</li>
            </ul>
            ${inv.potential_convergence ? `<div class="convergence-note" style="background: #e9ecef; padding: 10px; border-radius: 4px;">📋 Potential Convergence: ${inv.potential_convergence.join(', ')} — ${inv.convergence_note || 'Verify scheme norms.'}</div>` : ''}
            ${inv.warning ? `<div class="warning-alert" style="color: #856404; background-color: #fff3cd; padding: 10px; margin-top: 10px; border: 1px solid #ffeeba; border-radius: 4px;">⚠️ ${inv.warning}</div>` : ''}
        </div>
        `).join('');
    }

    function renderHimalayanReportSection(gp, extendedScores, interventions) {
        return `
        <div class="report-section">
            <h3>🏔️ Himalayan-Specific CRA Assessment</h3>
            <div class="compact-indicators">
                ${extendedScores.himalayanIndicators.map(ind => `
                    <div class="indicator-item"><strong>${ind.name}:</strong> ${ind.label} (Score: ${ind.score})</div>
                `).join('')}
                <div class="indicator-item"><strong>Fallow Agriculture:</strong> ${gp.fallow_pct || 0}% fallow</div>
            </div>
            
            <h4>Data Quality Metadata</h4>
            <table class="data-quality-table">
                <tr><th>Notice</th><td>⚠️ DEMO / PLACEHOLDER — All Himalayan indicators use demonstration data and require field validation.</td></tr>
            </table>

            <h4>Recommended CRA Practices</h4>
            <table class="practices-table" style="width: 100%; border-collapse: collapse; margin-top: 10px;" border="1">
                <thead>
                    <tr style="background: #f8f9fa;">
                        <th>Practice</th><th>WHY</th><th>WHERE</th><th>DATA BASIS</th><th>CONFIDENCE</th><th>FIELD VALIDATION</th>
                    </tr>
                </thead>
                <tbody>
                    ${interventions.map(inv => `
                    <tr>
                        <td>${inv.name}</td>
                        <td>${inv.why}</td>
                        <td>${inv.where}</td>
                        <td>${inv.data_basis}</td>
                        <td>${inv.confidence}</td>
                        <td>${inv.field_validation_required ? 'Yes' : 'No'}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        `;
    }

    function init() {
        if (!window.HIMALAYAN_CRA_DATA) {
            console.warn("HIMALAYAN_CRA_DATA not loaded yet");
        }
        console.log("HimalayanCRA module initialized");
    }

    let _layerGroups = {};

    function toggleLayer(id, visible) {
        if (!window.AgriMap || !window.AgriMap.map) return;
        const map = window.AgriMap.map();
        
        if (visible) {
            if (!_layerGroups[id]) {
                const group = L.layerGroup();
                let data = null;
                
                // Fetch lazy data from HIMALAYAN_CRA_DATA
                if (window.HIMALAYAN_CRA_DATA) {
                    if (id === 'landslide_susceptibility') data = window.HIMALAYAN_CRA_DATA.getLandslideData();
                    else if (id === 'springs') data = window.HIMALAYAN_CRA_DATA.getSpringData();
                    else if (id === 'spring_recharge') data = window.HIMALAYAN_CRA_DATA.getSpringRechargeData();
                    else if (id === 'van_panchayat') data = window.HIMALAYAN_CRA_DATA.getVanPanchayatData();
                    else if (id === 'fallow_terraces') data = window.HIMALAYAN_CRA_DATA.getFallowTerraceData();
                    else if (id === 'wildlife_conflict') data = window.HIMALAYAN_CRA_DATA.getWildlifeConflictData();
                    else if (id === 'road_network') data = window.HIMALAYAN_CRA_DATA.getRoadNetworkData();
                    else if (id === 'market_access') data = window.HIMALAYAN_CRA_DATA.getMarketAccessData();
                    // markers like baranaja and khanti might just use GP coords
                    else if (id === 'cra_baranaja') data = window.HIMALAYAN_CRA_DATA.getBaranajaData();
                    else if (id === 'cra_khanti') data = window.HIMALAYAN_CRA_DATA.getKhantiData();
                }

                // Render logic based on data structure
                if (data && data.type === 'FeatureCollection') {
                    L.geoJSON(data, {
                        style: (feature) => ({
                            color: '#2563eb', weight: 2, fillOpacity: 0.3
                        }),
                        onEachFeature: (f, l) => l.bindPopup(f.properties.name || id)
                    }).addTo(group);
                } else if (Array.isArray(data)) {
                    data.forEach(item => {
                        const marker = L.circleMarker([item.lat || 30.5, item.lng || 79.1], {
                            color: '#eab308', radius: 6, fillOpacity: 0.8
                        });
                        marker.bindPopup(item.name || item.site_name || id);
                        marker.addTo(group);
                    });
                }
                
                _layerGroups[id] = group;
            }
            if (!map.hasLayer(_layerGroups[id])) {
                map.addLayer(_layerGroups[id]);
            }
        } else {
            if (_layerGroups[id] && map.hasLayer(_layerGroups[id])) {
                map.removeLayer(_layerGroups[id]);
            }
        }
    }

    window.HimalayanCRA = {
        calculateExtendedScores,
        getHimalayanInterventions,
        renderHimalayanAssessment,
        renderHimalayanInterventions,
        renderHimalayanReportSection,
        toggleLayer,
        WEIGHT_CONFIG,
        init
    };

})();
