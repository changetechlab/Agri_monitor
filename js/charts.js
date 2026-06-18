/**
 * Agri Monitor — js/charts.js
 * Chart.js visualizations for crop health, NDVI trends, CLF analytics
 */

window.AgriCharts = (() => {
  const charts = {};

  // ============================================================
  // Destroy chart if already exists (prevent duplicate)
  // ============================================================
  function destroyChart(id) {
    if (charts[id]) {
      charts[id].destroy();
      delete charts[id];
    }
  }

  // ============================================================
  // Crop Health Donut Chart
  // ============================================================
  function renderCropHealth(data) {
    const canvasId = 'chart-crop-health';
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const { healthy = 0, moderate = 0, stress = 0 } = data;
    charts[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['स्वस्थ', 'मध्यम', 'तनाव'],
        datasets: [{
          data: [healthy, moderate, stress],
          backgroundColor: ['#22c55e', '#f59e0b', '#ef4444'],
          borderColor: ['#16a34a', '#d97706', '#dc2626'],
          borderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#e2e8f0',
              font: { family: 'Inter, Noto Sans Devanagari', size: 11 },
              padding: 12,
              usePointStyle: true,
              pointStyleWidth: 10
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.raw} खेत`
            }
          }
        }
      }
    });
  }

  // ============================================================
  // NDVI Trend Line Chart (6 months)
  // ============================================================
  function renderNdviTrend(trendData) {
    const canvasId = 'chart-ndvi-trend';
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const { labels, healthy, moderate, stress } = trendData || window.DummyData.ndviTrend;

    charts[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'स्वस्थ',
            data: healthy,
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34,197,94,0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 3
          },
          {
            label: 'मध्यम',
            data: moderate,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245,158,11,0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 3
          },
          {
            label: 'तनाव',
            data: stress,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239,68,68,0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        scales: {
          x: {
            ticks: {
              color: '#94a3b8',
              font: { family: 'Noto Sans Devanagari', size: 10 }
            },
            grid: { color: 'rgba(255,255,255,0.05)' }
          },
          y: {
            min: 0, max: 1,
            ticks: {
              color: '#94a3b8',
              font: { size: 10 },
              callback: v => v.toFixed(1)
            },
            grid: { color: 'rgba(255,255,255,0.05)' },
            title: {
              display: true,
              text: 'NDVI मान',
              color: '#64748b',
              font: { size: 10 }
            }
          }
        },
        plugins: {
          legend: {
            labels: {
              color: '#94a3b8',
              font: { size: 11 },
              usePointStyle: true
            }
          }
        }
      }
    });
  }

  // ============================================================
  // CLF Comparison Bar Chart
  // ============================================================
  function renderCLFComparison(clfData) {
    const canvasId = 'chart-clf';
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = clfData.map(c => c.name_hindi || c.name);
    const totalFarmers = clfData.map(c => c.total_members || 0);
    const activeFarmers = clfData.map(c => c.active_members || 0);

    charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'कुल सदस्य',
            data: totalFarmers,
            backgroundColor: 'rgba(20,184,166,0.6)',
            borderColor: '#14b8a6',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'सक्रिय',
            data: activeFarmers,
            backgroundColor: 'rgba(34,197,94,0.6)',
            borderColor: '#22c55e',
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            ticks: {
              color: '#94a3b8',
              font: { family: 'Noto Sans Devanagari', size: 9 },
              maxRotation: 30
            },
            grid: { display: false }
          },
          y: {
            ticks: { color: '#94a3b8', font: { size: 10 } },
            grid: { color: 'rgba(255,255,255,0.05)' }
          }
        },
        plugins: {
          legend: {
            labels: { color: '#94a3b8', font: { size: 11 }, usePointStyle: true }
          }
        }
      }
    });
  }

  // ============================================================
  // Crop Type Distribution (Horizontal Bar)
  // ============================================================
  function renderCropDistribution(fields) {
    const canvasId = 'chart-crops';
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    // Count crops
    const cropCount = {};
    fields.forEach(f => {
      const crop = f.crop_type || 'unknown';
      cropCount[crop] = (cropCount[crop] || 0) + 1;
    });

    const labels = Object.keys(cropCount).map(k =>
      (window.DummyData?.cropLabels || {})[k] || k
    );
    const values = Object.values(cropCount);
    const colors = ['#22c55e','#16a34a','#f59e0b','#ef4444','#3b82f6','#a855f7','#14b8a6','#f97316'];

    charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors.slice(0, labels.length).map(c => c + 'cc'),
          borderColor: colors.slice(0, labels.length),
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (ctx) => ` ${ctx.raw} खेत` }
          }
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8', font: { size: 10 } },
            grid: { color: 'rgba(255,255,255,0.05)' }
          },
          y: {
            ticks: {
              color: '#94a3b8',
              font: { family: 'Noto Sans Devanagari', size: 10 }
            },
            grid: { display: false }
          }
        }
      }
    });
  }

  // ============================================================
  // Uttarakhand LULC Pie Chart (Based on ISRO-USAC map)
  // ============================================================
  function renderLULCState() {
    const canvasId = 'chart-lulc-state';
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    charts[canvasId] = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['वन (47%)', 'कृषि (20%)', 'बंजर (14%)', 'वसावट (2%)', 'जल (2%)', 'अन्य (15%)'],
        datasets: [{
          data: [47, 20, 14, 2, 2, 15],
          backgroundColor: ['#16a34a', '#eab308', '#ec4899', '#ef4444', '#3b82f6', '#93c5fd'],
          borderColor: 'var(--bg-card)',
          borderWidth: 1.5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#94a3b8',
              font: { family: 'Noto Sans Devanagari', size: 9 },
              boxWidth: 8,
              padding: 4
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label.split(' ')[0]}: ${ctx.raw}%`
            }
          }
        }
      }
    });
  }

  // ============================================================
  // Render all charts with current data
  // ============================================================
  function renderAll(data) {
    const { farmers = [], fields = [], clf_clusters = [] } = data || {};

    // Crop health breakdown from fields
    const healthCounts = { healthy: 0, moderate: 0, stress: 0 };
    fields.forEach(f => {
      if (healthCounts.hasOwnProperty(f.health_status)) healthCounts[f.health_status]++;
    });
    renderCropHealth(healthCounts);

    // NDVI trend from dummy data (will be replaced by real satellite cache)
    renderNdviTrend(window.DummyData.ndviTrend);

    // CLF comparison
    if (clf_clusters.length > 0) {
      renderCLFComparison(clf_clusters);
    }

    // Crop distribution
    if (fields.length > 0) {
      renderCropDistribution(fields);
    }

    // LULC state reference chart
    renderLULCState();
  }

  // ============================================================
  // Update chart theme on dark/light mode switch
  // ============================================================
  function updateTheme(isDark) {
    const textColor = isDark ? '#94a3b8' : '#475569';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';

    Object.values(charts).forEach(chart => {
      if (!chart || !chart.options) return;
      const scales = chart.options.scales || {};
      ['x', 'y'].forEach(axis => {
        if (scales[axis]) {
          if (scales[axis].ticks) scales[axis].ticks.color = textColor;
          if (scales[axis].grid) scales[axis].grid.color = gridColor;
        }
      });
      if (chart.options.plugins?.legend?.labels) {
        chart.options.plugins.legend.labels.color = textColor;
      }
      chart.update('none');
    });
  }

  return {
    renderCropHealth,
    renderNdviTrend,
    renderCLFComparison,
    renderCropDistribution,
    renderAll,
    updateTheme,
    destroyChart
  };
})();
