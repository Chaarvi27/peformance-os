/**
 * Meridian Performance OS — Application Controller
 * =================================================
 * Entry point and orchestrator for the dashboard shell.
 *
 * Responsibilities:
 *  - Bootstrap on DOMContentLoaded
 *  - Load and normalise mock data from assets/data.js (window.MeridianData)
 *  - Own global application state
 *  - Render and re-render all UI components (KPIs, charts, table, alerts)
 *  - Wire every DOM event + custom event to state mutations and renders
 *
 * Module map
 *  State      — single source of truth, immutable-style updates via setState()
 *  Data       — data loader, normaliser, selectors
 *  Renderer   — stateless render functions, write only to DOM refs
 *  Charts     — lightweight canvas / SVG chart helpers (no external lib required)
 *  Alerts     — alert/toast queue
 *  Controller — glues everything; event listeners live here
 */

/* ─────────────────────────────────────────────────────────────────
   GUARD — wait for the shell DOM before doing anything
───────────────────────────────────────────────────────────────── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

/* ═══════════════════════════════════════════════════════════════
   1.  STATE
   Central store. All reads come from here; all writes go through
   setState() so renders are always triggered consistently.
═══════════════════════════════════════════════════════════════ */
const State = (() => {
  /** @type {AppState} */
  let _state = {
    // navigation
    view: 'dashboard',          // 'dashboard' | 'campaigns' | 'insights' | …

    // filters
    range: '7d',                // '7d' | '30d' | '90d'
    channel: 'all',             // 'all' | 'search' | 'social' | 'display' | 'email'
    selectedCampaignId: null,   // string | null

    // data (populated after load)
    campaigns: [],
    kpis: {},
    seriesData: {},             // keyed by range ('7d'|'30d'|'90d')
    channelBreakdown: [],
    activityFeed: [],
    alerts: [],

    // ui flags
    loading: true,
    sidebarCollapsed: false,
    searchQuery: '',
  };

  /** Subscribers notified after every mutation */
  const _subscribers = new Set();

  /**
   * Read the whole state (shallow copy — don't mutate directly).
   * @returns {AppState}
   */
  function get() {
    return Object.assign({}, _state);
  }

  /**
   * Merge patch into state, then notify all subscribers.
   * @param {Partial<AppState>} patch
   */
  function set(patch) {
    _state = Object.assign({}, _state, patch);
    _subscribers.forEach(fn => fn(_state));
  }

  /** Subscribe to every state change. Returns unsubscribe fn. */
  function subscribe(fn) {
    _subscribers.add(fn);
    return () => _subscribers.delete(fn);
  }

  return { get, set, subscribe };
})();

/* ═══════════════════════════════════════════════════════════════
   2.  DATA
   Loads window.MeridianData (assets/data.js) or falls back to
   built-in mock data so the dashboard works standalone.
═══════════════════════════════════════════════════════════════ */
const Data = (() => {

  /* ── Built-in fallback mock ───────────────────────────────── */
  const MOCK = {
    kpis: {
      revenue:     { value: 148230, prev: 131900, unit: '$',  format: 'currency' },
      impressions: { value: 4820000, prev: 4458000, unit: '',   format: 'compact' },
      cvr:         { value: 3.41,   prev: 3.71,   unit: '%',  format: 'percent' },
      campaigns:   { value: 12,     prev: 9,      unit: '',   format: 'integer' },
    },

    campaigns: [
      { id: 'c1', name: 'Spring Brand Push',  status: 'live',   budget: 24000, spend: 18420, cvr: 4.2,  channel: 'search'  },
      { id: 'c2', name: 'Retargeting Q2',     status: 'live',   budget: 12500, spend: 6100,  cvr: 5.8,  channel: 'social'  },
      { id: 'c3', name: 'Influencer Wave 3',  status: 'paused', budget: 8000,  spend: 7950,  cvr: 2.1,  channel: 'social'  },
      { id: 'c4', name: 'Summer Teaser',      status: 'draft',  budget: 15000, spend: 0,     cvr: null, channel: 'display' },
      { id: 'c5', name: 'Email Re-engage',    status: 'live',   budget: 5000,  spend: 2100,  cvr: 6.4,  channel: 'email'   },
      { id: 'c6', name: 'Display Awareness',  status: 'live',   budget: 18000, spend: 9000,  cvr: 1.8,  channel: 'display' },
    ],

    seriesData: {
      '7d': {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        revenue:     [18200, 21400, 19800, 24600, 22100, 26800, 24300],
        impressions: [610000, 720000, 680000, 810000, 750000, 890000, 820000],
      },
      '30d': {
        labels: ['W1', 'W2', 'W3', 'W4'],
        revenue:     [98000, 112000, 125000, 148000],
        impressions: [2800000, 3200000, 3700000, 4820000],
      },
      '90d': {
        labels: ['Jan', 'Feb', 'Mar'],
        revenue:     [310000, 390000, 480000],
        impressions: [9200000, 11500000, 14800000],
      },
    },

    channelBreakdown: [
      { label: 'Paid Search', key: 'search',  pct: 38, color: '#4f7cff' },
      { label: 'Paid Social', key: 'social',  pct: 29, color: '#7b5fff' },
      { label: 'Display',     key: 'display', pct: 21, color: '#34d399' },
      { label: 'Email',       key: 'email',   pct: 12, color: '#fbbf24' },
    ],

    activityFeed: [
      { id: 'a1', campaignId: 'c1', type: 'milestone', color: '#34d399', text: '<strong>Spring Brand Push</strong> reached 1M impressions',          time: '2 min ago'  },
      { id: 'a2', campaignId: 'c2', type: 'update',    color: '#4f7cff', text: 'Budget increased for <strong>Retargeting Q2</strong>',               time: '41 min ago' },
      { id: 'a3', campaignId: 'c3', type: 'warning',   color: '#fbbf24', text: '<strong>Influencer Wave 3</strong> was paused automatically',        time: '3 hr ago'   },
      { id: 'a4', campaignId: 'c4', type: 'info',      color: '#464d63', text: '<strong>Summer Teaser</strong> draft created by Jordan R.',          time: 'Yesterday'  },
    ],

    alerts: [
      { id: 'al1', level: 'warning', message: 'Influencer Wave 3 budget is 99% exhausted.',           dismissible: true  },
      { id: 'al2', level: 'info',    message: 'Scheduled report for Q2 is ready to download.',        dismissible: true  },
    ],
  };

  /**
   * Load data: prefer window.MeridianData (assets/data.js),
   * fall back to MOCK.
   * Returns a Promise so the bootstrap can await it.
   */
  async function load() {
    // If assets/data.js already injected window.MeridianData — use it.
    if (window.MeridianData && typeof window.MeridianData === 'object') {
      return normalise(window.MeridianData);
    }
    // Simulate a tiny async gap (mirrors a real fetch)
    await new Promise(r => setTimeout(r, 60));
    return normalise(MOCK);
  }

  /**
   * Normalise raw data into guaranteed shape, filling missing keys
   * with safe defaults so renderers never need to null-check deeply.
   */
  function normalise(raw) {
    return {
      kpis:             raw.kpis             || MOCK.kpis,
      campaigns:        (raw.campaigns        || MOCK.campaigns).map(_normaliseCampaign),
      seriesData:       raw.seriesData        || MOCK.seriesData,
      channelBreakdown: raw.channelBreakdown  || MOCK.channelBreakdown,
      activityFeed:     raw.activityFeed      || MOCK.activityFeed,
      alerts:           raw.alerts            || MOCK.alerts,
    };
  }

  function _normaliseCampaign(c) {
    return {
      id:       c.id       || `c_${Math.random().toString(36).slice(2,7)}`,
      name:     c.name     || 'Unnamed Campaign',
      status:   c.status   || 'draft',
      budget:   c.budget   || 0,
      spend:    c.spend    || 0,
      cvr:      c.cvr      != null ? c.cvr : null,
      channel:  c.channel  || 'search',
    };
  }

  /* ── Selectors ──────────────────────────────────────────────── */

  /**
   * Return campaigns filtered by current state (channel + query).
   * @param {AppState} state
   * @returns {Campaign[]}
   */
  function selectFilteredCampaigns(state) {
    let list = state.campaigns;

    if (state.channel !== 'all') {
      list = list.filter(c => c.channel === state.channel);
    }

    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q));
    }

    return list;
  }

  /**
   * Return series data for the current range.
   * @param {AppState} state
   */
  function selectSeries(state) {
    return state.seriesData[state.range] || state.seriesData['7d'];
  }

  /**
   * Calculate a delta percentage between current and previous values.
   * @param {number} current
   * @param {number} prev
   * @returns {number}
   */
  function calcDelta(current, prev) {
    if (!prev) return 0;
    return ((current - prev) / prev) * 100;
  }

  return { load, selectFilteredCampaigns, selectSeries, calcDelta };
})();

/* ═══════════════════════════════════════════════════════════════
   3.  FORMATTERS
   Pure formatting helpers — no side effects.
═══════════════════════════════════════════════════════════════ */
const Fmt = (() => {
  function currency(n) {
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n.toLocaleString('en-US');
  }

  function compact(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toLocaleString('en-US');
  }

  function percent(n) { return n.toFixed(2) + '%'; }

  function integer(n) { return n.toLocaleString('en-US'); }

  function delta(n) {
    const abs   = Math.abs(n).toFixed(1);
    const sign  = n >= 0 ? '+' : '−';
    return `${sign}${abs}%`;
  }

  /**
   * Auto-format a KPI value by its declared format type.
   * @param {number} value
   * @param {'currency'|'compact'|'percent'|'integer'} format
   */
  function kpi(value, format) {
    switch (format) {
      case 'currency': return currency(value);
      case 'compact':  return compact(value);
      case 'percent':  return percent(value);
      case 'integer':  return integer(value);
      default:         return String(value);
    }
  }

  function progress(spend, budget) {
    if (!budget) return 0;
    return Math.min(100, Math.round((spend / budget) * 100));
  }

  return { currency, compact, percent, integer, delta, kpi, progress };
})();

/* ═══════════════════════════════════════════════════════════════
   4.  CHARTS
   Lightweight SVG chart helpers — zero dependencies.
   Each function accepts a mount element + data and returns an SVG
   node that is injected into the mount.
═══════════════════════════════════════════════════════════════ */
const Charts = (() => {

  const SVG_NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs = {}) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    return node;
  }

  /* ── Polyline area chart (Performance panel) ─────────────── */
  /**
   * @param {HTMLElement} mount
   * @param {{ labels: string[], revenue: number[], impressions: number[] }} series
   */
  function renderAreaChart(mount, series) {
    mount.innerHTML = '';

    const W = mount.clientWidth  || 560;
    const H = mount.clientHeight || 260;
    const PAD = { top: 24, right: 20, bottom: 36, left: 52 };
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top  - PAD.bottom;
    const N = series.labels.length;

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true' });

    // Defs: gradients
    const defs = el('defs');

    ['revenue', 'impressions'].forEach((key, i) => {
      const color = i === 0 ? '#4f7cff' : '#34d399';
      const grad  = el('linearGradient', { id: `grad-${key}`, x1:'0', y1:'0', x2:'0', y2:'1' });
      const s1    = el('stop', { offset:'0%',   'stop-color': color, 'stop-opacity': '0.28' });
      const s2    = el('stop', { offset:'100%', 'stop-color': color, 'stop-opacity': '0'    });
      grad.append(s1, s2);
      defs.append(grad);
    });

    svg.append(defs);

    // Helper: map data → x,y coords
    function coords(values) {
      const min = Math.min(...values) * 0.88;
      const max = Math.max(...values) * 1.08;
      return values.map((v, i) => ({
        x: PAD.left + (i / (N - 1)) * innerW,
        y: PAD.top  + (1 - (v - min) / (max - min)) * innerH,
      }));
    }

    function pointsStr(pts) { return pts.map(p => `${p.x},${p.y}`).join(' '); }

    function areaPath(pts) {
      if (!pts.length) return '';
      let d = `M ${pts[0].x} ${pts[0].y}`;
      pts.slice(1).forEach(p => { d += ` L ${p.x} ${p.y}`; });
      // close to bottom
      d += ` L ${pts[pts.length-1].x} ${PAD.top + innerH}`;
      d += ` L ${pts[0].x} ${PAD.top + innerH} Z`;
      return d;
    }

    // Grid lines
    for (let i = 0; i <= 4; i++) {
      const y = PAD.top + (i / 4) * innerH;
      const line = el('line', {
        x1: PAD.left, y1: y, x2: PAD.left + innerW, y2: y,
        stroke: 'rgba(255,255,255,0.06)', 'stroke-width': '1',
      });
      svg.append(line);
    }

    // X-axis labels
    series.labels.forEach((lbl, i) => {
      const x = PAD.left + (i / (N - 1)) * innerW;
      const t = el('text', {
        x, y: H - 6,
        'text-anchor': 'middle',
        fill: '#464d63',
        'font-size': '11',
        'font-family': "'DM Sans', sans-serif",
      });
      t.textContent = lbl;
      svg.append(t);
    });

    // Plot each series
    [
      { key: 'revenue',     color: '#4f7cff' },
      { key: 'impressions', color: '#34d399' },
    ].forEach(({ key, color }) => {
      const pts  = coords(series[key]);
      const area = el('path', {
        d: areaPath(pts),
        fill: `url(#grad-${key})`,
      });
      const line = el('polyline', {
        points: pointsStr(pts),
        fill: 'none',
        stroke: color,
        'stroke-width': '2',
        'stroke-linejoin': 'round',
        'stroke-linecap': 'round',
      });
      svg.append(area, line);

      // Dots
      pts.forEach(p => {
        const dot = el('circle', {
          cx: p.x, cy: p.y, r: '3.5',
          fill: color,
          stroke: '#0d0f14',
          'stroke-width': '1.5',
        });
        svg.append(dot);
      });
    });

    // Legend
    [
      { label: 'Revenue',     color: '#4f7cff', x: PAD.left },
      { label: 'Impressions', color: '#34d399', x: PAD.left + 90 },
    ].forEach(({ label, color, x }) => {
      const rect = el('rect', { x, y: 4, width: 12, height: 4, rx: 2, fill: color });
      const text = el('text', {
        x: x + 16, y: 10,
        fill: '#7e8599',
        'font-size': '11',
        'font-family': "'DM Sans', sans-serif",
      });
      text.textContent = label;
      svg.append(rect, text);
    });

    mount.append(svg);
  }

  /* ── Donut chart (Channels panel) ────────────────────────── */
  /**
   * @param {HTMLElement} mount
   * @param {{ label: string, pct: number, color: string }[]} segments
   */
  function renderDonut(mount, segments) {
    mount.innerHTML = '';

    const SIZE   = 120;
    const CX     = SIZE / 2;
    const CY     = SIZE / 2;
    const R      = 44;
    const INNER  = 28;
    const GAP    = 2; // degrees gap between segments

    const svg = el('svg', {
      viewBox: `0 0 ${SIZE} ${SIZE}`,
      width: SIZE,
      height: SIZE,
      'aria-hidden': 'true',
    });

    function polarToCartesian(cx, cy, r, deg) {
      const rad = (deg - 90) * (Math.PI / 180);
      return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    }

    function describeArc(startDeg, endDeg) {
      const s   = polarToCartesian(CX, CY, R, startDeg + GAP / 2);
      const e   = polarToCartesian(CX, CY, R, endDeg   - GAP / 2);
      const si  = polarToCartesian(CX, CY, INNER, startDeg + GAP / 2);
      const ei  = polarToCartesian(CX, CY, INNER, endDeg   - GAP / 2);
      const lg  = endDeg - startDeg - GAP > 180 ? 1 : 0;
      return [
        `M ${s.x} ${s.y}`,
        `A ${R} ${R} 0 ${lg} 1 ${e.x} ${e.y}`,
        `L ${ei.x} ${ei.y}`,
        `A ${INNER} ${INNER} 0 ${lg} 0 ${si.x} ${si.y}`,
        'Z',
      ].join(' ');
    }

    let start = 0;
    segments.forEach(seg => {
      const sweep = (seg.pct / 100) * 360;
      const path  = el('path', {
        d:    describeArc(start, start + sweep),
        fill: seg.color,
        opacity: '0.85',
      });
      // Hover highlight
      path.addEventListener('mouseenter', () => path.setAttribute('opacity', '1'));
      path.addEventListener('mouseleave', () => path.setAttribute('opacity', '0.85'));
      svg.append(path);
      start += sweep;
    });

    // Center label
    const label = el('text', {
      x: CX, y: CY - 4,
      'text-anchor': 'middle',
      fill: '#e8eaf0',
      'font-size': '13',
      'font-weight': '600',
      'font-family': "'DM Sans', sans-serif",
    });
    label.textContent = 'Channels';

    const sub = el('text', {
      x: CX, y: CY + 11,
      'text-anchor': 'middle',
      fill: '#7e8599',
      'font-size': '9',
      'font-family': "'DM Sans', sans-serif",
    });
    sub.textContent = 'by budget';

    svg.append(label, sub);
    mount.append(svg);
  }

  /* ── Sparkline (KPI cards) ───────────────────────────────── */
  /**
   * Inject a tiny SVG sparkline into an existing <svg class="sparkline">.
   * @param {SVGElement} svgEl
   * @param {number[]} values
   * @param {string} color
   */
  function renderSparkline(svgEl, values, color = '#4f7cff') {
    const W = 90, H = 40;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const pts   = values.map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const y = H - ((v - min) / range) * (H - 6) - 3;
      return `${x},${y}`;
    });

    svgEl.innerHTML = '';
    const poly = document.createElementNS(SVG_NS, 'polyline');
    poly.setAttribute('points', pts.join(' '));
    poly.setAttribute('fill', 'none');
    poly.setAttribute('stroke', color);
    poly.setAttribute('stroke-width', '2');
    poly.setAttribute('stroke-linejoin', 'round');
    svgEl.append(poly);
  }

  return { renderAreaChart, renderDonut, renderSparkline };
})();

/* ═══════════════════════════════════════════════════════════════
   5.  RENDERER
   Stateless functions that accept data and write to the DOM.
   No state reads inside — all data passed as arguments.
═══════════════════════════════════════════════════════════════ */
const Renderer = (() => {

  /* ── KPIs ──────────────────────────────────────────────────── */
  function renderKPIs(kpis) {
    const defs = [
      { id: 'revenue',     label: 'Revenue',     sparkColor: '#4f7cff', sparkValues: [88,92,85,95,100,110,118,124,130,148] },
      { id: 'impressions', label: 'Impressions',  sparkColor: '#4f7cff', sparkValues: [70,75,72,80,82,85,88,90,95,100] },
      { id: 'cvr',         label: 'Conv. Rate',   sparkColor: '#f87171', sparkValues: [4.0,3.9,3.8,3.7,3.7,3.6,3.5,3.5,3.4,3.41] },
      { id: 'campaigns',   label: 'Active',       sparkColor: '#4f7cff', sparkValues: null },
    ];

    defs.forEach(def => {
      const kpi = kpis[def.id];
      if (!kpi) return;

      const valEl = document.getElementById(`kpi-${def.id}-value`);
      if (valEl) valEl.textContent = Fmt.kpi(kpi.value, kpi.format);

      const d = Data.calcDelta(kpi.value, kpi.prev);
      const card = document.getElementById(`kpi-${def.id}`);
      if (!card) return;

      // Update delta display
      const deltaEl = card.querySelector('.delta');
      if (deltaEl) {
        deltaEl.className = `delta ${d >= 0 ? 'up' : 'down'}`;
        const arrow = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
          stroke-linecap="round" aria-hidden="true">
          <polyline points="${d >= 0 ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}"/></svg>`;
        deltaEl.innerHTML = arrow + Fmt.delta(d);
        deltaEl.setAttribute('aria-label', `${d >= 0 ? 'Up' : 'Down'} ${Math.abs(d).toFixed(1)} percent`);
      }

      // Sparklines
      if (def.sparkValues) {
        const sparkEl = card.querySelector('.sparkline');
        if (sparkEl) Charts.renderSparkline(sparkEl, def.sparkValues, def.sparkColor);
      }
    });
  }

  /* ── Campaigns table ───────────────────────────────────────── */
  function renderCampaignsTable(campaigns, selectedId) {
    const tbody = document.getElementById('campaigns-tbody');
    if (!tbody) return;

    if (!campaigns.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted);font-size:.83rem;">
        No campaigns match the current filters.</td></tr>`;
      return;
    }

    tbody.innerHTML = campaigns.map(c => {
      const pct     = Fmt.progress(c.spend, c.budget);
      const cvrStr  = c.cvr != null ? `${c.cvr}%` : '—';
      const spendStr = c.spend > 0 ? Fmt.currency(c.spend) : '—';
      const isSelected = c.id === selectedId;

      return `
        <tr data-campaign-id="${c.id}"
            class="${isSelected ? 'selected-row' : ''}"
            style="${isSelected ? 'background:var(--accent-subtle);' : ''}">
          <td class="primary">${_escape(c.name)}</td>
          <td><span class="status-dot ${c.status}">${_capitalize(c.status)}</span></td>
          <td>${Fmt.currency(c.budget)}</td>
          <td>${spendStr}</td>
          <td>${cvrStr}</td>
          <td>
            <div class="progress-bar-wrap"
                 role="progressbar"
                 aria-valuenow="${pct}"
                 aria-valuemin="0"
                 aria-valuemax="100"
                 aria-label="${pct}% of budget spent">
              <div class="progress-bar-fill" style="width:${pct}%"></div>
            </div>
          </td>
        </tr>`;
    }).join('');
  }

  /* ── Channel breakdown (text stats + donut) ─────────────────── */
  function renderChannelBreakdown(channels) {
    const statsEl = document.getElementById('channel-stats');
    if (statsEl) {
      statsEl.innerHTML = channels.map(ch => `
        <div class="mini-stat">
          <span class="mini-stat-label">${_escape(ch.label)}</span>
          <span class="mini-stat-value">${ch.pct}%</span>
        </div>
        <div class="mini-progress">
          <div class="mini-progress-fill"
               style="width:${ch.pct}%;background:${ch.color}"></div>
        </div>
      `).join('');
    }

    const donutMount = document.getElementById('chart-channels');
    if (donutMount) Charts.renderDonut(donutMount, channels);
  }

  /* ── Performance chart ──────────────────────────────────────── */
  function renderPerformanceChart(series) {
    const mount = document.getElementById('chart-performance');
    if (!mount) return;
    Charts.renderAreaChart(mount, series);
  }

  /* ── Activity feed ──────────────────────────────────────────── */
  function renderActivityFeed(feed) {
    const el = document.getElementById('activity-feed');
    if (!el) return;

    el.innerHTML = feed.map(item => `
      <div class="activity-item" data-activity-id="${item.id}">
        <div class="activity-dot"
             style="background:${item.color}"
             aria-hidden="true"></div>
        <div>
          <p>${item.text}</p>
          <div class="activity-time">${item.time}</div>
        </div>
      </div>
    `).join('');
  }

  /* ── Alerts banner ──────────────────────────────────────────── */
  function renderAlerts(alerts) {
    let container = document.getElementById('alerts-container');

    // Create the container if it doesn't exist yet
    if (!container) {
      container = document.createElement('div');
      container.id = 'alerts-container';
      container.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
      // Insert before #kpi-section
      const kpiSection = document.getElementById('kpi-section');
      if (kpiSection) kpiSection.parentNode.insertBefore(container, kpiSection);
    }

    container.innerHTML = alerts.map(a => {
      const colors = {
        warning: { bg: 'rgba(251,191,36,.1)',  border: 'rgba(251,191,36,.3)',  icon: '#fbbf24' },
        info:    { bg: 'rgba(79,124,255,.1)',   border: 'rgba(79,124,255,.3)',  icon: '#4f7cff' },
        error:   { bg: 'rgba(248,113,113,.1)', border: 'rgba(248,113,113,.3)', icon: '#f87171' },
      };
      const c = colors[a.level] || colors.info;

      return `
        <div class="alert-banner"
             data-alert-id="${a.id}"
             role="alert"
             style="
               display:flex;align-items:center;gap:12px;
               background:${c.bg};
               border:1px solid ${c.border};
               border-radius:10px;
               padding:10px 16px;
               font-size:.82rem;
               color:var(--text-secondary);
               animation: fadeUp .4s cubic-bezier(.19,1,.22,1) both;
             ">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
               stroke="${c.icon}" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span style="flex:1">${_escape(a.message)}</span>
          ${a.dismissible
            ? `<button
                 onclick="window.Meridian.dismissAlert('${a.id}')"
                 aria-label="Dismiss alert"
                 style="
                   background:none;border:none;cursor:pointer;
                   color:var(--text-muted);padding:2px 6px;
                   font-size:1rem;line-height:1;
                   transition:color .15s;
                 "
                 onmouseenter="this.style.color='var(--text-primary)'"
                 onmouseleave="this.style.color='var(--text-muted)'"
               >✕</button>`
            : ''}
        </div>`;
    }).join('');
  }

  /* ── Loading skeleton ───────────────────────────────────────── */
  function showLoadingSkeleton() {
    const kpiSection = document.getElementById('kpi-section');
    if (!kpiSection) return;
    kpiSection.style.opacity = '0.4';
    kpiSection.style.pointerEvents = 'none';
  }

  function hideLoadingSkeleton() {
    const kpiSection = document.getElementById('kpi-section');
    if (!kpiSection) return;
    kpiSection.style.transition = 'opacity .4s ease';
    kpiSection.style.opacity = '1';
    kpiSection.style.pointerEvents = '';
  }

  /* ── Helpers ──────────────────────────────────────────────── */
  function _escape(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  return {
    renderKPIs,
    renderCampaignsTable,
    renderChannelBreakdown,
    renderPerformanceChart,
    renderActivityFeed,
    renderAlerts,
    showLoadingSkeleton,
    hideLoadingSkeleton,
  };
})();

/* ═══════════════════════════════════════════════════════════════
   6.  ALERTS (toast queue)
   Manages ephemeral toast notifications (distinct from inline
   alert banners).
═══════════════════════════════════════════════════════════════ */
const Alerts = (() => {
  let _toastContainer = null;

  function _getContainer() {
    if (_toastContainer) return _toastContainer;
    _toastContainer = document.createElement('div');
    _toastContainer.id = 'toast-container';
    _toastContainer.setAttribute('aria-live', 'polite');
    _toastContainer.setAttribute('aria-atomic', 'false');
    _toastContainer.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      z-index: 9999;
      pointer-events: none;
    `;
    document.body.append(_toastContainer);
    return _toastContainer;
  }

  /**
   * Show a toast notification.
   * @param {string} message
   * @param {'success'|'error'|'info'|'warning'} [type='info']
   * @param {number} [duration=3500]
   */
  function show(message, type = 'info', duration = 3500) {
    const container = _getContainer();

    const colors = {
      success: '#34d399',
      error:   '#f87171',
      warning: '#fbbf24',
      info:    '#4f7cff',
    };

    const toast = document.createElement('div');
    toast.setAttribute('role', 'status');
    toast.style.cssText = `
      background: #181c27;
      border: 1px solid rgba(255,255,255,.1);
      border-left: 3px solid ${colors[type] || colors.info};
      border-radius: 10px;
      padding: 12px 18px;
      font-size: .82rem;
      color: #e8eaf0;
      font-family: 'DM Sans', sans-serif;
      max-width: 320px;
      box-shadow: 0 8px 30px rgba(0,0,0,.5);
      pointer-events: auto;
      opacity: 0;
      transform: translateX(20px);
      transition: opacity .3s ease, transform .3s ease;
    `;
    toast.textContent = message;
    container.append(toast);

    // Animate in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
      });
    });

    // Animate out and remove
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, duration);
  }

  return { show };
})();

/* ═══════════════════════════════════════════════════════════════
   7.  CONTROLLER
   Owns all event wiring. Calls Data → State → Renderer in sequence.
═══════════════════════════════════════════════════════════════ */
const Controller = (() => {

  /* ── Full re-render from current state ───────────────────── */
  function renderAll(state) {
    Renderer.renderKPIs(state.kpis);

    const filtered = Data.selectFilteredCampaigns(state);
    Renderer.renderCampaignsTable(filtered, state.selectedCampaignId);

    const series = Data.selectSeries(state);
    Renderer.renderPerformanceChart(series);

    Renderer.renderChannelBreakdown(state.channelBreakdown);
    Renderer.renderActivityFeed(state.activityFeed);
    Renderer.renderAlerts(state.alerts);
  }

  /* ── Bootstrap ───────────────────────────────────────────── */
  async function init() {
    Renderer.showLoadingSkeleton();

    let data;
    try {
      data = await Data.load();
    } catch (err) {
      console.error('[Meridian] Data load failed:', err);
      Alerts.show('Failed to load dashboard data. Please refresh.', 'error', 6000);
      Renderer.hideLoadingSkeleton();
      return;
    }

    // Hydrate state with loaded data
    State.set({
      ...data,
      loading: false,
    });

    Renderer.hideLoadingSkeleton();
  }

  /* ── Wire DOM events ─────────────────────────────────────── */
  function bindEvents() {

    // ── Custom events from shell bootstrap JS ──────────────

    // View navigation
    document.addEventListener('meridian:navigate', e => {
      State.set({ view: e.detail.view, selectedCampaignId: null });
      Alerts.show(`Navigated to ${_titleCase(e.detail.view)}`, 'info', 1800);
    });

    // Date range change
    document.addEventListener('meridian:range-change', e => {
      State.set({ range: e.detail.range });
      const series = Data.selectSeries(State.get());
      Renderer.renderPerformanceChart(series);
      Alerts.show(`Showing ${e.detail.range} data`, 'info', 1600);
    });

    // KPI card click → filter table
    document.addEventListener('meridian:kpi-click', e => {
      Alerts.show(`Drilling into ${_titleCase(e.detail.kpi)} detail…`, 'info', 2000);
    });

    // New Campaign
    document.addEventListener('meridian:new-campaign', () => {
      Alerts.show('Campaign builder coming soon.', 'info', 2500);
    });

    // Search
    document.addEventListener('meridian:search', e => {
      State.set({ searchQuery: e.detail.query });
      const filtered = Data.selectFilteredCampaigns(State.get());
      Renderer.renderCampaignsTable(filtered, State.get().selectedCampaignId);
    });

    // Notifications
    document.addEventListener('meridian:notifications-open', () => {
      Alerts.show('Notifications panel coming soon.', 'info', 2000);
    });

    // ── Campaign table row clicks ───────────────────────────
    const tbody = document.getElementById('campaigns-tbody');
    if (tbody) {
      tbody.addEventListener('click', e => {
        const row = e.target.closest('tr[data-campaign-id]');
        if (!row) return;
        const id = row.dataset.campaignId;
        const current = State.get().selectedCampaignId;
        // Toggle selection
        State.set({ selectedCampaignId: current === id ? null : id });
        const filtered = Data.selectFilteredCampaigns(State.get());
        Renderer.renderCampaignsTable(filtered, State.get().selectedCampaignId);

        if (current !== id) {
          const camp = State.get().campaigns.find(c => c.id === id);
          if (camp) Alerts.show(`Selected: ${camp.name}`, 'success', 2000);
        }
      });
    }

    // ── Channel filter (future nav hook) ───────────────────
    document.addEventListener('meridian:channel-filter', e => {
      State.set({ channel: e.detail.channel });
      const filtered = Data.selectFilteredCampaigns(State.get());
      Renderer.renderCampaignsTable(filtered, State.get().selectedCampaignId);
    });

    // ── Window resize → redraw charts ──────────────────────
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const s = State.get();
        if (s.loading) return;
        const series = Data.selectSeries(s);
        Renderer.renderPerformanceChart(series);
        Renderer.renderChannelBreakdown(s.channelBreakdown);
      }, 200);
    });
  }

  function _titleCase(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  return { init, bindEvents, renderAll };
})();

/* ═══════════════════════════════════════════════════════════════
   8.  PUBLIC API  (window.Meridian extensions)
   Extends the shell's window.Meridian stub so external scripts
   and the console have ergonomic access.
═══════════════════════════════════════════════════════════════ */
function extendPublicAPI() {
  const existing = window.Meridian || {};

  window.Meridian = Object.assign(existing, {
    // modules (for debugging / external scripts)
    State,
    Data,
    Renderer,
    Charts,
    Alerts,
    Controller,
    Fmt,

    // convenience methods
    getState:       () => State.get(),

    setFilter(key, value) {
      if (!['range', 'channel', 'view'].includes(key)) return;
      State.set({ [key]: value });
    },

    dismissAlert(id) {
      const s = State.get();
      State.set({ alerts: s.alerts.filter(a => a.id !== id) });
      Renderer.renderAlerts(State.get().alerts);
    },

    refreshData() {
      State.set({ loading: true });
      Renderer.showLoadingSkeleton();
      Data.load().then(data => {
        State.set({ ...data, loading: false });
        Renderer.hideLoadingSkeleton();
        Alerts.show('Dashboard refreshed.', 'success');
      });
    },

    toast: (msg, type, duration) => Alerts.show(msg, type, duration),
  });
}

/* ═══════════════════════════════════════════════════════════════
   9.  BOOT
   Entry point called at top of file.
═══════════════════════════════════════════════════════════════ */
function boot() {
  // Subscribe renderer to state changes
  State.subscribe(state => {
    if (!state.loading) Controller.renderAll(state);
  });

  extendPublicAPI();
  Controller.bindEvents();
  Controller.init(); // async — triggers first render via State.subscribe
}
