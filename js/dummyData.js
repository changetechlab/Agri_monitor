/**
 * Agri Monitor — js/dummyData.js
 * Realistic seed data for Rudraprayag district, Uttarakhand
 * Used when Supabase is not configured (demo mode)
 */

window.DummyData = {

  villages: [
    { id: 'v1', name: 'Ukhimath', name_hindi: 'ऊखीमठ', block: 'Ukhimath', district: 'rudraprayag', lat: 30.4855, lng: 79.2437 },
    { id: 'v2', name: 'Jakholi', name_hindi: 'जखोली', block: 'Jakholi', district: 'rudraprayag', lat: 30.3267, lng: 79.0978 },
    { id: 'v3', name: 'Augustyamuni', name_hindi: 'अगस्त्यमुनि', block: 'Augustyamuni', district: 'rudraprayag', lat: 30.3820, lng: 79.0567 },
    { id: 'v4', name: 'Sari', name_hindi: 'सारी', block: 'Ukhimath', district: 'rudraprayag', lat: 30.5200, lng: 79.2800 },
    { id: 'v5', name: 'Tilwara', name_hindi: 'तिलवाड़ा', block: 'Jakholi', district: 'rudraprayag', lat: 30.3500, lng: 79.0700 },
    { id: 'v6', name: 'Kund', name_hindi: 'कुंड', block: 'Ukhimath', district: 'rudraprayag', lat: 30.5100, lng: 79.2600 },
    { id: 'v7', name: 'Bansholi', name_hindi: 'बंशोली', block: 'Jakholi', district: 'rudraprayag', lat: 30.3100, lng: 79.1200 },
    { id: 'v8', name: 'Chandrapuri', name_hindi: 'चंद्रपुरी', block: 'Augustyamuni', district: 'rudraprayag', lat: 30.4100, lng: 79.0800 },
  ],

  clf_clusters: [
    { id: 'c1', name: 'Mandakini CLF', name_hindi: 'मंदाकिनी CLF', type: 'CLF', block: 'Ukhimath', contact_name: 'सुमित्रा देवी', contact_mobile: '9876543210', total_members: 45, active_members: 38, lat: 30.4855, lng: 79.2437 },
    { id: 'c2', name: 'Alaknanda SHG Federation', name_hindi: 'अलकनंदा SHG', type: 'SHG', block: 'Jakholi', contact_name: 'रमा नेगी', contact_mobile: '9876543211', total_members: 32, active_members: 28, lat: 30.3267, lng: 79.0978 },
    { id: 'c3', name: 'Kedar Kisaan FPO', name_hindi: 'केदार किसान FPO', type: 'FPO', block: 'Augustyamuni', contact_name: 'बीरेंद्र सिंह', contact_mobile: '9876543212', total_members: 68, active_members: 61, lat: 30.3820, lng: 79.0567 },
  ],

  farmers: [
    { id: 'f1', name: 'Ramesh Singh Negi', name_hindi: 'रमेश सिंह नेगी', mobile: '9456781234', village_id: 'v1', village_name: 'Ukhimath', block: 'Ukhimath', clf_id: 'c1', land_holding_ha: 0.4, primary_crop: 'potato', is_organic: true, irrigation_source: 'spring', created_at: '2024-03-15' },
    { id: 'f2', name: 'Sushila Devi Rawat', name_hindi: 'सुशीला देवी रावत', mobile: '9456781235', village_id: 'v1', village_name: 'Ukhimath', block: 'Ukhimath', clf_id: 'c1', land_holding_ha: 0.25, primary_crop: 'wheat', is_organic: false, irrigation_source: 'rain_fed', created_at: '2024-03-16' },
    { id: 'f3', name: 'Gopal Prasad Bisht', name_hindi: 'गोपाल प्रसाद बिष्ट', mobile: '9456781236', village_id: 'v2', village_name: 'Jakholi', block: 'Jakholi', clf_id: 'c2', land_holding_ha: 0.6, primary_crop: 'rajma', is_organic: true, irrigation_source: 'canal', created_at: '2024-03-17' },
    { id: 'f4', name: 'Kamla Devi Semwal', name_hindi: 'कमला देवी सेमवाल', mobile: '9456781237', village_id: 'v2', village_name: 'Jakholi', block: 'Jakholi', clf_id: 'c2', land_holding_ha: 0.3, primary_crop: 'mandua', is_organic: true, irrigation_source: 'rain_fed', created_at: '2024-03-18' },
    { id: 'f5', name: 'Dinesh Lal Shah', name_hindi: 'दिनेश लाल शाह', mobile: '9456781238', village_id: 'v3', village_name: 'Augustyamuni', block: 'Augustyamuni', clf_id: 'c3', land_holding_ha: 0.8, primary_crop: 'apple', is_organic: false, irrigation_source: 'drip', created_at: '2024-04-01', has_polyhouse: true },
    { id: 'f6', name: 'Meena Rani Gusain', name_hindi: 'मीना रानी गुसाईं', mobile: '9456781239', village_id: 'v4', village_name: 'Sari', block: 'Ukhimath', clf_id: 'c1', land_holding_ha: 0.2, primary_crop: 'gahat', is_organic: true, irrigation_source: 'spring', created_at: '2024-04-05' },
    { id: 'f7', name: 'Birendra Singh Panwar', name_hindi: 'बीरेंद्र सिंह पंवार', mobile: '9456781240', village_id: 'v5', village_name: 'Tilwara', block: 'Jakholi', clf_id: 'c2', land_holding_ha: 0.5, primary_crop: 'potato', is_organic: false, irrigation_source: 'borewell', created_at: '2024-04-08' },
    { id: 'f8', name: 'Savita Bhandari', name_hindi: 'सविता भंडारी', mobile: '9456781241', village_id: 'v6', village_name: 'Kund', block: 'Ukhimath', clf_id: 'c1', land_holding_ha: 0.35, primary_crop: 'tomato', is_organic: true, irrigation_source: 'spring', created_at: '2024-04-10', has_polyhouse: true },
    { id: 'f9', name: 'Harish Chandra Joshi', name_hindi: 'हरिश चंद्र जोशी', mobile: '9456781242', village_id: 'v7', village_name: 'Bansholi', block: 'Jakholi', clf_id: 'c2', land_holding_ha: 0.45, primary_crop: 'wheat', is_organic: false, irrigation_source: 'canal', created_at: '2024-04-12' },
    { id: 'f10', name: 'Pushpa Devi Kimothi', name_hindi: 'पुष्पा देवी किमोठी', mobile: '9456781243', village_id: 'v8', village_name: 'Chandrapuri', block: 'Augustyamuni', clf_id: 'c3', land_holding_ha: 0.55, primary_crop: 'apple', is_organic: true, irrigation_source: 'drip', created_at: '2024-04-15' },
    { id: 'f11', name: 'Bhagwan Singh Butola', name_hindi: 'भगवान सिंह बुटोला', mobile: '9456781244', village_id: 'v3', village_name: 'Augustyamuni', block: 'Augustyamuni', clf_id: 'c3', land_holding_ha: 0.7, primary_crop: 'pea', is_organic: false, irrigation_source: 'rain_fed', created_at: '2024-04-18' },
    { id: 'f12', name: 'Rekha Rani Chauhan', name_hindi: 'रेखा रानी चौहान', mobile: '9456781245', village_id: 'v1', village_name: 'Ukhimath', block: 'Ukhimath', clf_id: 'c1', land_holding_ha: 0.28, primary_crop: 'capsicum', is_organic: true, irrigation_source: 'spring', created_at: '2024-05-01', has_polyhouse: true },
  ],

  fields: [
    { id: 'fd1', farmer_id: 'f1', name: 'ऊपरी खेत', crop_type: 'potato', area_sqm: 1800, health_status: 'healthy', last_ndvi_value: 0.62, sowing_date: '2024-03-10', updated_at: new Date().toISOString(),
      geojson: { type: 'Polygon', coordinates: [[[79.2420, 30.4845], [79.2435, 30.4845], [79.2435, 30.4858], [79.2420, 30.4858], [79.2420, 30.4845]]] } },
    { id: 'fd2', farmer_id: 'f2', name: 'घर का खेत', crop_type: 'wheat', area_sqm: 1200, health_status: 'moderate', last_ndvi_value: 0.38, sowing_date: '2023-11-15', updated_at: new Date(Date.now() - 18*24*60*60*1000).toISOString(),
      geojson: { type: 'Polygon', coordinates: [[[79.2440, 30.4850], [79.2450, 30.4850], [79.2450, 30.4860], [79.2440, 30.4860], [79.2440, 30.4850]]] } },
    { id: 'fd3', farmer_id: 'f3', name: 'राजमा खेत', crop_type: 'rajma', area_sqm: 2400, health_status: 'healthy', last_ndvi_value: 0.58, sowing_date: '2024-04-01', updated_at: new Date().toISOString(),
      geojson: { type: 'Polygon', coordinates: [[[79.0960, 30.3260], [79.0975, 30.3260], [79.0975, 30.3275], [79.0960, 30.3275], [79.0960, 30.3260]]] } },
    { id: 'fd4', farmer_id: 'f4', name: 'मंडुवा खेत', crop_type: 'mandua', area_sqm: 1500, health_status: 'stress', last_ndvi_value: 0.18, sowing_date: '2024-03-20', updated_at: new Date(Date.now() - 20*24*60*60*1000).toISOString(),
      geojson: { type: 'Polygon', coordinates: [[[79.0980, 30.3270], [79.0992, 30.3270], [79.0992, 30.3282], [79.0980, 30.3282], [79.0980, 30.3270]]] } },
    { id: 'fd5', farmer_id: 'f5', name: 'सेब बाग', crop_type: 'apple', area_sqm: 3200, health_status: 'healthy', last_ndvi_value: 0.71, sowing_date: '2023-12-01', updated_at: new Date().toISOString(),
      geojson: { type: 'Polygon', coordinates: [[[79.0550, 30.3810], [79.0570, 30.3810], [79.0570, 30.3830], [79.0550, 30.3830], [79.0550, 30.3810]]] } },
    { id: 'fd6', farmer_id: 'f7', name: 'आलू खेत', crop_type: 'potato', area_sqm: 2000, health_status: 'stress', last_ndvi_value: 0.21, sowing_date: '2024-03-15', updated_at: new Date(Date.now() - 16*24*60*60*1000).toISOString(),
      geojson: { type: 'Polygon', coordinates: [[[79.0690, 30.3490], [79.0705, 30.3490], [79.0705, 30.3505], [79.0690, 30.3505], [79.0690, 30.3490]]] } },
    { id: 'fd7', farmer_id: 'f8', name: 'टमाटर पॉलीहाउस', crop_type: 'tomato', area_sqm: 800, health_status: 'healthy', last_ndvi_value: 0.79, sowing_date: '2024-02-01', updated_at: new Date().toISOString(),
      geojson: { type: 'Polygon', coordinates: [[[79.2590, 30.5090], [79.2600, 30.5090], [79.2600, 30.5100], [79.2590, 30.5100], [79.2590, 30.5090]]] } },
    { id: 'fd8', farmer_id: 'f10', name: 'सेब बाग - नया', crop_type: 'apple', area_sqm: 2800, health_status: 'moderate', last_ndvi_value: 0.42, sowing_date: '2023-11-01', updated_at: new Date().toISOString(),
      geojson: { type: 'Polygon', coordinates: [[[79.0790, 30.4090], [79.0808, 30.4090], [79.0808, 30.4108], [79.0790, 30.4108], [79.0790, 30.4090]]] } },
  ],

  alerts: [
    { id: 'a1', farmer_id: 'f4', field_id: 'fd4', alert_type: 'ndvi_stress', severity: 'high', title: 'Low NDVI Detected', title_hindi: 'कम NDVI मिली', message: 'NDVI value 0.18 — severe vegetation stress in mandua field', message_hindi: 'मंडुवा खेत में गंभीर पानी की कमी। NDVI मान बहुत कम है।', is_active: true, is_read: false, created_at: new Date(Date.now() - 2*24*60*60*1000).toISOString() },
    { id: 'a2', farmer_id: 'f2', field_id: 'fd2', alert_type: 'inactive_field', severity: 'medium', title: 'No Field Update (18 days)', title_hindi: '18 दिन से कोई अपडेट नहीं', message: 'Field has not been surveyed for 18 days', message_hindi: 'इस खेत का 18 दिनों से कोई सर्वे नहीं हुआ।', is_active: true, is_read: false, created_at: new Date(Date.now() - 1*24*60*60*1000).toISOString() },
    { id: 'a3', farmer_id: 'f7', field_id: 'fd6', alert_type: 'irrigation_stress', severity: 'high', title: 'Irrigation Stress Detected', title_hindi: 'सिंचाई की कमी', message: 'Field shows signs of water stress — borewell area check needed', message_hindi: 'खेत में पानी की कमी के संकेत मिल रहे हैं। बोरवेल की जांच जरूरी।', is_active: true, is_read: false, created_at: new Date(Date.now() - 3*24*60*60*1000).toISOString() },
    { id: 'a4', farmer_id: null, field_id: null, alert_type: 'flood_risk', severity: 'medium', title: 'Flood Risk — Jakholi Block', title_hindi: 'बाढ़ का खतरा — जखोली ब्लॉक', message: 'Elevated rainfall forecast for next 48 hours in Jakholi block', message_hindi: 'जखोली ब्लॉक में अगले 48 घंटों में भारी बारिश का अनुमान।', is_active: true, is_read: true, created_at: new Date(Date.now() - 6*60*60*1000).toISOString() },
    { id: 'a5', farmer_id: null, field_id: null, alert_type: 'fire_risk', severity: 'low', title: 'Forest Fire Risk — Low', title_hindi: 'वन अग्नि जोखिम — कम', message: 'Low forest fire risk this week in surrounding areas', message_hindi: 'इस सप्ताह आसपास के क्षेत्रों में वन अग्नि का जोखिम कम है।', is_active: true, is_read: true, created_at: new Date(Date.now() - 12*60*60*1000).toISOString() },
  ],

  // NDVI trend data (last 6 months)
  ndviTrend: {
    labels: ['दिसम्बर', 'जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई'],
    healthy: [0.65, 0.60, 0.68, 0.72, 0.70, 0.64],
    moderate: [0.42, 0.38, 0.44, 0.46, 0.43, 0.40],
    stress: [0.20, 0.18, 0.22, 0.25, 0.21, 0.19],
  },

  // Crop type labels (Hindi)
  cropLabels: {
    potato: 'आलू', wheat: 'गेहूं', rajma: 'राजमा', mandua: 'मंडुवा',
    apple: 'सेब', tomato: 'टमाटर', pea: 'मटर', capsicum: 'शिमला मिर्च',
    gahat: 'गहत', rice: 'धान', maize: 'मक्का', ginger: 'अदरक',
    turmeric: 'हल्दी', mixed: 'मिश्रित'
  },

  // Health status labels
  healthLabels: { healthy: 'स्वस्थ', moderate: 'मध्यम', stress: 'तनाव', unknown: 'अज्ञात' },

  // Irrigation labels
  irrigationLabels: {
    rain_fed: 'वर्षाआधारित', canal: 'नहर', borewell: 'बोरवेल',
    spring: 'प्राकृतिक स्रोत', drip: 'ड्रिप', none: 'कोई नहीं'
  }
};
