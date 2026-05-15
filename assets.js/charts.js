/**
 * charts.js — Meridian chart components
 * Depends on: Chart.js (vendor/chart.min.js), mock.js (window.MeridianData)
 * Mounts into: #chart-performance, #chart-channels
 */

(function () {
  'use strict';

  /* ── Design tokens (must match index.html :root) ──────── */
  const T = {
    accent:      '#4f7cff',
    accentAlt:   '#7b5fff',
    green:       '#34d399',
    amber:       '#fbbf24',
    gridLine:    'rgba(255,255,255,0.06)',
    tickColor:   'rgba(255,255,255,0.35)',
    tooltipBg:   '#1e2333',
    tooltipBorder:'rgba(255,255,255,0.1)',
  };

  /* ── Shared Chart.js defaults ─────────────────────────── */
  Chart.defaults.font.family   = "'DM Sans', sans-serif";
  Chart.defaults.font.size     = 12;
  Chart.defaults.color         = T.tickColor;

  /* ══════════════════════════════════════════════════════
     1. PERFORMANCE LINE CHART
     Mount: #chart-performance
  ══════════════════════════════════════════════════════ */

  let _perfChart = null;

  function buildPerfChart(range) {
    const el = document.getElementById('chart-performance');
    if (!el) return;

    const d = window.MeridianData.getChartSeries(range);

    /* Destroy previous instance before re-creating */
    if (_perfChart) {
      _perfChart.destroy();
      _perfChart = null;
    }

    /* Clear placeholder markup so canvas renders cleanly */
    el.innerHTML = '';
    el.style.cssText = 'position:relative;width:100%;height:260px;';

    const canvas = document.createElement('canvas');
    canvas.id = 'canvas-performance';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label',
      'Line chart showing revenue and impressions over the selected period');
    canvas.textContent = 'Revenue and impressions trend data.';
    el.appendChild(canvas);

    _perfChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: d.labels,
        datasets: [
          {
            label:            'Revenue',
            data:             d.revenue,
            yAxisID:          'yRevenue',
            borderColor:      T.accent,
            backgroundColor:  'rgba(79,124,255,0.08)',
            fill:             true,
            tension:          0.4,
            pointRadius:      4,
            pointHoverRadius: 6,
            pointBackgroundColor: T.accent,
            borderWidth:      2,
          },
          {
            label:            'Impressions',
            data:             d.impressions,
            yAxisID:          'yImpressions',
            borderColor:      T.green,
            backgroundColor:  'transparent',
            borderDash:       [5, 3],
            tension:          0.4,
            pointRadius:      4,
            pointHoverRadius: 6,
            pointStyle:       'rectRot',
            pointBackgroundColor: T.green,
            borderWidth:      2,
          },
        ],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },

        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor:  T.tooltipBg,
            borderColor:      T.tooltipBorder,
            borderWidth:      1,
            padding:          10,
            titleColor:       'rgba(255,255,255,0.8)',
            bodyColor:        'rgba(255,255,255,0.6)',
            callbacks: {
              label(ctx) {
                if (ctx.datasetIndex === 0) {
                  return '  Revenue: $' + ctx.parsed.y.toLocaleString('en-US');
                }
                const m = (ctx.parsed.y / 1_000_000).toFixed(2);
                return '  Impressions: ' + m + 'M';
              },
            },
          },
        },

        scales: {
          x: {
            grid:  { color: T.gridLine },
            ticks: {
              color:       T.tickColor,
              maxRotation: 0,
              autoSkip:    false,
            },
          },
          yRevenue: {
            position: 'left',
            grid:     { color: T.gridLine },
            ticks: {
              color: T.tickColor,
              callback(v) {
                if (v >= 1000) return '$' + Math.round(v / 1000) + 'k';
                return '$' + v;
              },
            },
          },
          yImpressions: {
            position: 'right',
            grid:     { drawOnChartArea: false },
            ticks: {
              color: T.tickColor,
              callback(v) {
                return (v / 1_000_000).toFixed(1) + 'M';
              },
            },
          },
        },
      },
    });
  }

  /* ══════════════════════════════════════════════════════
     2. CHANNEL DONUT CHART
     Mount: #chart-channels
  ══════════════════════════════════════════════════════ */

  let _donutChart = null;

  function buildDonutChart() {
    const el = document.getElementById('chart-channels');
    if (!el) return;

    const channels = window.MeridianData.getChannels();

    if (_donutChart) {
      _donutChart.destroy();
      _donutChart = null;
    }

    el.innerHTML = '';
    el.style.cssText = 'position:relative;width:100%;height:160px;';

    const canvas = document.createElement('canvas');
    canvas.id = 'canvas-channels';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label',
      'Donut chart: Paid Search 38%, Paid Social 29%, Display 21%, Email 12%');
    canvas.textContent = channels.map(c => c.label + ' ' + c.pct + '%').join(', ');
    el.appendChild(canvas);

    _donutChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels:   channels.map(c => c.label),
        datasets: [{
          data:            channels.map(c => c.pct),
          backgroundColor: channels.map(c => c.color),
          borderWidth:     0,
          hoverOffset:     5,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        cutout:              '68%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: T.tooltipBg,
            borderColor:     T.tooltipBorder,
            borderWidth:     1,
            padding:         10,
            bodyColor:       'rgba(255,255,255,0.7)',
            callbacks: {
              label(ctx) {
                return '  ' + ctx.label + ': ' + ctx.parsed + '%';
              },
            },
          },
        },
      },
    });

    /* Centre label: total spend */
    const plugin = {
      id: 'centreLabel',
      afterDraw(chart) {
        const { ctx, chartArea: { width, height, left, top } } = chart;
        ctx.save();
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        const cx = left + width / 2;
        const cy = top  + height / 2;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font      = "600 16px 'DM Sans', sans-serif";
        ctx.fillText('$59.5k', cx, cy - 8);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font      = "400 11px 'DM Sans', sans-serif";
        ctx.fillText('total spend', cx, cy + 10);
        ctx.restore();
      },
    };

    _donutChart.options._plugins = [plugin];
    Chart.register(plugin);
    _donutChart.update();
  }

  /* ══════════════════════════════════════════════════════
     3. INIT + EVENT WIRING
  ══════════════════════════════════════════════════════ */

  function init() {
    if (!window.MeridianData) {
      console.error('charts.js: MeridianData not found — load mock.js first.');
      return;
    }
    if (typeof Chart === 'undefined') {
      console.error('charts.js: Chart.js not found — load vendor/chart.min.js first.');
      return;
    }

    const initialRange = (window.Meridian && window.Meridian.state.range) || '7d';
    buildPerfChart(initialRange);
    buildDonutChart();

    /* React to range chip changes dispatched by index.html */
    document.addEventListener('meridian:range-change', (e) => {
      buildPerfChart(e.detail.range);
      if (window.Meridian) window.Meridian.state.range = e.detail.range;
    });

    /* Expose for app.js / external use */
    if (window.Meridian) {
      window.Meridian.charts = {
        rebuildPerf:  buildPerfChart,
        rebuildDonut: buildDonutChart,
      };
    }
  }

  /* Run after DOM is ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
