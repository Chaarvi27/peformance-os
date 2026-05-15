/**
 * mock.js — Meridian data layer
 * Swap this file for a real API adapter when ready.
 * All components import from window.MeridianData (set at bottom).
 */

const _kpis = {
  revenue:     { value: '$148,230', delta: '+12.4%', dir: 'up',   compare: 'vs last month' },
  impressions: { value: '4.82M',    delta: '+8.1%',  dir: 'up',   compare: 'vs last month' },
  cvr:         { value: '3.41%',    delta: '−0.3%',  dir: 'down', compare: 'vs last month' },
  campaigns:   { value: '12',       delta: '+3',      dir: 'up',   compare: 'this month'    },
};

const _chartSeries = {
  '7d': {
    labels:      ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    revenue:     [18200, 21400, 19800, 24600, 22100, 26800, 28430],
    impressions: [580000, 620000, 590000, 710000, 680000, 750000, 820000],
  },
  '30d': {
    labels:      ['Week 1','Week 2','Week 3','Week 4'],
    revenue:     [82000, 91000, 105000, 148230],
    impressions: [2100000, 2800000, 3400000, 4820000],
  },
  '90d': {
    labels:      ['Jan','Feb','Mar'],
    revenue:     [310000, 380000, 426460],
    impressions: [9200000, 11400000, 12820000],
  },
};

const _channels = [
  { label: 'Paid Search', pct: 38, color: '#4f7cff' },
  { label: 'Paid Social', pct: 29, color: '#7b5fff' },
  { label: 'Display',     pct: 21, color: '#34d399' },
  { label: 'Email',       pct: 12, color: '#fbbf24' },
];

const _campaigns = [
  {
    id: 'c1',
    name:     'Spring Brand Push',
    status:   'live',
    budget:   24000,
    spend:    18420,
    cvr:      4.2,
    progress: 77,
    sparkline: [8200, 9100, 8800, 9600, 10100, 9800, 10430],
  },
  {
    id: 'c2',
    name:     'Retargeting Q2',
    status:   'live',
    budget:   12500,
    spend:    6100,
    cvr:      5.8,
    progress: 49,
    sparkline: [1200, 1400, 1100, 1600, 1500, 1800, 2000],
  },
  {
    id: 'c3',
    name:     'Influencer Wave 3',
    status:   'paused',
    budget:   8000,
    spend:    7950,
    cvr:      2.1,
    progress: 99,
    sparkline: [1800, 1600, 1400, 1200, 980, 800, 600],
  },
  {
    id: 'c4',
    name:     'Summer Teaser',
    status:   'draft',
    budget:   15000,
    spend:    null,
    cvr:      null,
    progress: 0,
    sparkline: [],
  },
];

const _activity = [
  {
    id:    'a1',
    color: '#34d399',
    text:  '<strong>Spring Brand Push</strong> reached 1M impressions',
    time:  '2 min ago',
  },
  {
    id:    'a2',
    color: '#4f7cff',
    text:  'Budget increased for <strong>Retargeting Q2</strong>',
    time:  '41 min ago',
  },
  {
    id:    'a3',
    color: '#fbbf24',
    text:  '<strong>Influencer Wave 3</strong> was paused automatically',
    time:  '3 hr ago',
  },
  {
    id:    'a4',
    color: '#464d63',
    text:  '<strong>Summer Teaser</strong> draft created by Jordan R.',
    time:  'Yesterday',
  },
];

/* ── Public API ──────────────────────────────────────────── */

window.MeridianData = {
  /**
   * Returns all four KPI objects.
   * @returns {{ revenue, impressions, cvr, campaigns }}
   */
  getKpis() {
    return { ..._kpis };
  },

  /**
   * Returns chart series for a given range key.
   * @param {'7d'|'30d'|'90d'} range
   * @returns {{ labels: string[], revenue: number[], impressions: number[] }}
   */
  getChartSeries(range = '7d') {
    return _chartSeries[range] || _chartSeries['7d'];
  },

  /**
   * Returns channel allocation array.
   * @returns {{ label: string, pct: number, color: string }[]}
   */
  getChannels() {
    return [..._channels];
  },

  /**
   * Returns campaigns, optionally filtered by status.
   * @param {'live'|'paused'|'draft'|null} status
   */
  getCampaigns(status = null) {
    if (!status || status === 'all') return [..._campaigns];
    return _campaigns.filter(c => c.status === status);
  },

  /**
   * Returns the activity feed array.
   */
  getActivity() {
    return [..._activity];
  },

  /**
   * Formats a raw spend/budget number for display.
   * @param {number|null} n
   */
  formatCurrency(n) {
    if (n === null || n === undefined) return '—';
    return '$' + n.toLocaleString('en-US');
  },

  /**
   * Formats a CVR number for display.
   * @param {number|null} n
   */
  formatCvr(n) {
    if (n === null || n === undefined) return '—';
    return n.toFixed(1) + '%';
  },
};
