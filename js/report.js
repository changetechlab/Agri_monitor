/**
 * Agri Monitor — js/report.js
 * PDF report generation using jsPDF
 * Farmer profile, CLF summary, field inspection reports
 */

window.AgriReport = (() => {

  // ============================================================
  // Generate Farmer Profile PDF
  // ============================================================
  async function generateFarmerPDF(farmerId) {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      alert('PDF library लोड नहीं हुई। इंटरनेट चेक करें।');
      return;
    }

    const farmer = window.AgriFarmers.getFarmers().find(f => f.id === farmerId);
    if (!farmer) return;

    const farmerFields = window.AgriFarmers.getFields().filter(f => f.farmer_id === farmerId);
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    const margin = 15;
    let y = margin;

    // ---- Header ----
    doc.setFillColor(22, 163, 74); // green
    doc.rect(0, 0, 210, 32, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('AGRI MONITOR', margin, 12);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('CHANGE TechLab — Farmer Profile Report', margin, 19);
    doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, margin, 26);
    y = 42;

    // ---- Farmer Info ----
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Farmer Details', margin, y);
    y += 6;

    doc.setDrawColor(22, 163, 74);
    doc.setLineWidth(0.5);
    doc.line(margin, y, 210 - margin, y);
    y += 6;

    const infoRows = [
      ['Name', farmer.name],
      ['Name (Hindi)', farmer.name_hindi || '—'],
      ['Mobile', farmer.mobile || '—'],
      ['Village', farmer.village_name || '—'],
      ['Block', farmer.block || '—'],
      ['District', 'Rudraprayag'],
      ['Primary Crop', (window.DummyData.cropLabels || {})[farmer.primary_crop] || farmer.primary_crop || '—'],
      ['Land Holding', farmer.land_holding_ha ? `${farmer.land_holding_ha} Ha` : '—'],
      ['Irrigation', (window.DummyData.irrigationLabels || {})[farmer.irrigation_source] || farmer.irrigation_source || '—'],
      ['Organic Farming', farmer.is_organic ? 'Yes' : 'No'],
      ['Polyhouse', farmer.has_polyhouse ? 'Yes' : 'No'],
    ];

    doc.setFontSize(10);
    infoRows.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(80, 80, 80);
      doc.text(label + ':', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 30, 30);
      doc.text(String(value), 70, y);
      y += 7;
    });

    y += 4;

    // ---- Fields Section ----
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(`Field Records (${farmerFields.length})`, margin, y);
    y += 6;

    doc.setDrawColor(22, 163, 74);
    doc.line(margin, y, 210 - margin, y);
    y += 6;

    if (farmerFields.length === 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      doc.text('No fields mapped yet.', margin, y);
      y += 10;
    } else {
      // Table header
      const colWidths = [40, 30, 25, 25, 30, 30];
      const headers = ['Field Name', 'Crop', 'Area (Ha)', 'NDVI', 'Health', 'Sowing Date'];

      doc.setFillColor(240, 253, 244);
      doc.rect(margin, y - 4, 180, 8, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);

      let xPos = margin;
      headers.forEach((h, i) => {
        doc.text(h, xPos, y);
        xPos += colWidths[i];
      });
      y += 5;

      doc.setFont('helvetica', 'normal');
      farmerFields.forEach((field, idx) => {
        if (y > 260) { doc.addPage(); y = margin; }

        if (idx % 2 === 0) {
          doc.setFillColor(249, 250, 251);
          doc.rect(margin, y - 4, 180, 8, 'F');
        }

        const healthColors = { healthy: [34, 197, 94], moderate: [245, 158, 11], stress: [239, 68, 68], unknown: [107, 114, 128] };
        const hc = healthColors[field.health_status] || healthColors.unknown;
        const cropLabel = (window.DummyData.cropLabels || {})[field.crop_type] || field.crop_type || '—';
        const healthLabel = (window.DummyData.healthLabels || {})[field.health_status] || '—';

        xPos = margin;
        doc.setTextColor(30, 30, 30);
        doc.text(field.name || 'Field', xPos, y); xPos += colWidths[0];
        doc.text(cropLabel, xPos, y); xPos += colWidths[1];
        doc.text(field.area_sqm ? (field.area_sqm / 10000).toFixed(3) : '—', xPos, y); xPos += colWidths[2];
        doc.text(field.last_ndvi_value ? field.last_ndvi_value.toFixed(2) : '—', xPos, y); xPos += colWidths[3];

        doc.setTextColor(...hc);
        doc.text(healthLabel, xPos, y);
        doc.setTextColor(30, 30, 30);
        xPos += colWidths[4];
        doc.text(field.sowing_date ? new Date(field.sowing_date).toLocaleDateString('en-IN') : '—', xPos, y);
        y += 8;
      });
    }

    y += 8;

    // ---- Footer ----
    doc.setFillColor(240, 253, 244);
    doc.rect(0, 280, 210, 17, 'F');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Generated by Agri Monitor — CHANGE TechLab', margin, 287);
    doc.text('"Satellite + Field Data + Local Intelligence for Mountain Farming"', margin, 292);

    // Save
    const filename = `Farmer_${farmer.name.replace(/\s/g,'_')}_${new Date().toISOString().slice(0,10)}.pdf`;
    doc.save(filename);
  }

  // ============================================================
  // Generate CLF Summary PDF
  // ============================================================
  async function generateCLFSummary(clfId) {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      alert('PDF library लोड नहीं हुई।');
      return;
    }

    const clf = window.AgriCLF.getClusters().find(c => c.id === clfId);
    if (!clf) return;

    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const margin = 15;
    let y = margin;

    // Header
    doc.setFillColor(20, 184, 166); // teal
    doc.rect(0, 0, 210, 32, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('AGRI MONITOR', margin, 12);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`CLF Summary Report — ${clf.name}`, margin, 19);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, margin, 26);
    y = 42;

    // CLF Info
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('CLF Overview', margin, y);
    y += 6;
    doc.setDrawColor(20, 184, 166);
    doc.line(margin, y, 210 - margin, y);
    y += 6;

    const rows = [
      ['CLF Name', clf.name],
      ['Type', clf.type],
      ['Block', clf.block],
      ['District', 'Rudraprayag'],
      ['Contact', `${clf.contact_name} — ${clf.contact_mobile}`],
      ['Total Members', String(clf._farmers?.length || clf.total_members)],
      ['Mapped Fields', String(clf._fields?.length || 0)],
      ['Total Field Area', `${clf._totalFieldArea_ha?.toFixed(2) || '—'} Ha`],
      ['Average NDVI', clf._avgNDVI ? clf._avgNDVI.toFixed(3) : '—'],
      ['Organic Farmers', String(clf._organicCount || 0)],
      ['Stress Fields', String(clf._stressFields || 0)],
    ];

    doc.setFontSize(10);
    rows.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(80, 80, 80);
      doc.text(label + ':', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 30, 30);
      doc.text(String(value), 70, y);
      y += 7;
    });

    y += 6;

    // Health breakdown
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Crop Health Distribution', margin, y);
    y += 6;
    doc.setDrawColor(20, 184, 166);
    doc.line(margin, y, 210 - margin, y);
    y += 8;

    const total = clf._fields?.length || 1;
    const healthData = [
      ['Healthy', clf._healthyFields || 0, [34, 197, 94]],
      ['Moderate', clf._moderateFields || 0, [245, 158, 11]],
      ['Stress', clf._stressFields || 0, [239, 68, 68]],
    ];

    healthData.forEach(([label, count, color]) => {
      const pct = Math.round((count / total) * 100);
      const barWidth = Math.round((count / total) * 150);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 30, 30);
      doc.text(`${label}: ${count} fields (${pct}%)`, margin, y);

      doc.setFillColor(230, 230, 230);
      doc.rect(70, y - 4, 130, 6, 'F');
      doc.setFillColor(...color);
      doc.rect(70, y - 4, barWidth, 6, 'F');
      y += 10;
    });

    y += 6;

    // Farmer list
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Farmer List (${clf._farmers?.length || 0})`, margin, y);
    y += 6;
    doc.setDrawColor(20, 184, 166);
    doc.line(margin, y, 210 - margin, y);
    y += 6;

    (clf._farmers || []).slice(0, 30).forEach((farmer, i) => {
      if (y > 265) { doc.addPage(); y = margin; }
      if (i % 2 === 0) {
        doc.setFillColor(249, 250, 251);
        doc.rect(margin, y - 4, 180, 7, 'F');
      }
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 30, 30);
      const cropLabel = (window.DummyData.cropLabels || {})[farmer.primary_crop] || farmer.primary_crop || '—';
      doc.text(`${i + 1}. ${farmer.name}`, margin, y);
      doc.text(farmer.village_name || '—', 80, y);
      doc.text(cropLabel, 130, y);
      doc.text(farmer.is_organic ? 'Organic' : '', 165, y);
      y += 7;
    });

    // Footer
    doc.setFillColor(240, 253, 244);
    doc.rect(0, 280, 210, 17, 'F');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Generated by Agri Monitor — CHANGE TechLab', margin, 287);
    doc.text('Satellite + Field Data + Local Intelligence for Mountain Farming', margin, 292);

    doc.save(`CLF_${clf.name.replace(/\s/g,'_')}_Report_${new Date().toISOString().slice(0,10)}.pdf`);
  }

  // ============================================================
  // Export all farmers as CSV
  // ============================================================
  function exportAllFarmersCSV() {
    const farmers = window.AgriFarmers.getFarmers();
    const fields = window.AgriFarmers.getFields();

    const rows = [
      ['ID', 'नाम', 'मोबाइल', 'गाँव', 'ब्लॉक', 'फसल', 'भूमि (हे.)', 'जैविक', 'सिंचाई', 'खेत', 'जोड़ा गया']
    ];

    farmers.forEach(f => {
      const farmerFields = fields.filter(fd => fd.farmer_id === f.id);
      const cropLabel = (window.DummyData.cropLabels || {})[f.primary_crop] || f.primary_crop || '';
      const irrigLabel = (window.DummyData.irrigationLabels || {})[f.irrigation_source] || f.irrigation_source || '';
      rows.push([
        f.id, f.name, f.mobile, f.village_name, f.block,
        cropLabel, f.land_holding_ha || '', f.is_organic ? 'हाँ' : 'नहीं',
        irrigLabel, farmerFields.length,
        f.created_at ? new Date(f.created_at).toLocaleDateString('hi-IN') : ''
      ]);
    });

    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AgriMonitor_Farmers_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ============================================================
  // Bind report buttons
  // ============================================================
  function bindEvents() {
    const exportAllBtn = document.getElementById('btn-export-all-csv');
    if (exportAllBtn) exportAllBtn.addEventListener('click', exportAllFarmersCSV);

    const exportCLFBtn = document.getElementById('btn-export-clf-report');
    if (exportCLFBtn) exportCLFBtn.addEventListener('click', () => {
      const clfs = window.AgriCLF.getClusters();
      if (clfs.length > 0) generateCLFSummary(clfs[0].id);
    });
  }

  return {
    init: bindEvents,
    generateFarmerPDF,
    generateCLFSummary,
    exportAllFarmersCSV
  };
})();
