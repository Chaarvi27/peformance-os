/**
 * campaigns.js — Meridian campaigns table component
 * Depends on: mock.js (window.MeridianData)
 * Exposes:    window.MeridianCampaigns.mount(el)
 *
 * Features:
 *  - Filter by status (all / live / paused / draft)
 *  - Sort by any column (click header, toggle asc/desc)
 *  - Row expand: shows CPC, ROAS, Clicks + quick actions
 *  - Inline status transitions (pause / resume / launch)
 *  - Duplicate campaign
 *  - Delete campaign
 *  - Export visible rows as CSV
 */

(function () {
  'use strict';

  /* ── State ─────────────────────────────────────────── */
  let _campaigns   = [];
  let _filter      = 'all';
  let _sortCol     = null;
  let _sortDir     = 1;
  let _expandedId  = null;
  let _mountEl     = null;

  /* ── Formatters ────────────────────────────────────── */
  const fmt$ = n  => n == null ? '—' : '$' + n.toLocaleString('en-US');
  const fmtPct = n => n == null ? '—' : n.toFixed(1) + '%';
  const fmtNum = n => n == null ? '—' : n.toLocaleString('en-US');

  /* ── Data helpers ──────────────────────────────────── */
  function filtered() {
    if (_filter === 'all') return _campaigns;
    return _campaigns.filter(c => c.status === _filter);
  }

  function sorted(arr) {
    if (!_sortCol) return arr;
    return [...arr].sort((a, b) => {
      const av = a[_sortCol], bv = b[_sortCol];
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av > bv ? 1 : av < bv ? -1 : 0) * _sortDir;
    });
  }

  /* ── CSV export ────────────────────────────────────── */
  function exportCsv() {
    const rows = sorted(filtered());
    const headers = ['Name', 'Status', 'Budget', 'Spend', 'CVR (%)', 'Progress (%)', 'CPC', 'ROAS', 'Clicks'];
    const lines = rows.map(c => [
      '"' + c.name + '"',
      c.status,
      c.budget   ?? '',
      c.spend    ?? '',
      c.cvr      ?? '',
      c.progress ?? '',
      c.cpc      ?? '',
      c.roas     ?? '',
      c.clicks   ?? '',
    ].join(','));
    const csv = [headers.join(','), ...lines].join('\n');
    const a = document.createElement('a');
    a.href     = 'data:text/csv,' + encodeURIComponent(csv);
    a.download = 'campaigns-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
  }

  /* ── HTML builders ─────────────────────────────────── */
  function statusDotClass(status) {
    return { live: 'dot-live', paused: 'dot-paused', draft: 'dot-draft' }[status] || '';
  }

  function statusLabel(status) {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  function rowActions(c) {
    const btns = [];
    if (c.status === 'live')   btns.push(`<button class="act-btn" data-action="pause"   data-id="${c.id}">Pause</button>`);
    if (c.status === 'paused') btns.push(`<button class="act-btn" data-action="resume"  data-id="${c.id}">Resume</button>`);
    if (c.status === 'draft')  btns.push(`<button class="act-btn" data-action="launch"  data-id="${c.id}">Launch</button>`);
    btns.push(`<button class="act-btn"        data-action="duplicate" data-id="${c.id}">Duplicate</button>`);
    btns.push(`<button class="act-btn"        data-action="report"    data-id="${c.id}">View report</button>`);
    btns.push(`<button class="act-btn danger" data-action="delete"    data-id="${c.id}">Delete</button>`);
    return btns.join('');
  }

  function buildHTML() {
    const rows = sorted(filtered());
    const sortArrow = dir => dir === 1 ? '↑' : '↓';

    const thSort = (col, label, width) => {
      const isSorted = _sortCol === col;
      return `<th style="width:${width}" data-col="${col}" class="${isSorted ? 'sorted' : ''}" scope="col">
        ${label} <span class="sort-icon">${isSorted ? sortArrow(_sortDir) : '↕'}</span>
      </th>`;
    };

    const tableRows = rows.length === 0
      ? `<tr><td colspan="7" class="empty-row">No campaigns match this filter.</td></tr>`
      : rows.map(c => {
        const isExp = _expandedId === c.id;
        const mainRow = `<tr class="data-row${isExp ? ' is-expanded' : ''}" data-id="${c.id}" tabindex="0" role="row">
          <td class="name-cell">${c.name}</td>
          <td>
            <span class="status-badge">
              <span class="dot ${statusDotClass(c.status)}" aria-hidden="true"></span>
              ${statusLabel(c.status)}
            </span>
          </td>
          <td class="num-cell">${fmt$(c.budget)}</td>
          <td class="num-cell">${fmt$(c.spend)}</td>
          <td class="num-cell">${fmtPct(c.cvr)}</td>
          <td>
            <div class="bar-wrap" role="progressbar"
              aria-valuenow="${c.progress}" aria-valuemin="0" aria-valuemax="100"
              aria-label="${c.progress}% spent">
              <div class="bar-fill" style="width:${c.progress}%"></div>
            </div>
          </td>
          <td class="chevron-cell">
            <span class="chevron${isExp ? ' open' : ''}" aria-hidden="true">&#8964;</span>
          </td>
        </tr>`;

        const expandRow = isExp ? `<tr class="expand-row">
          <td colspan="7">
            <div class="expand-inner">
              <div class="stat-mini"><span class="stat-mini-label">Budget</span><span class="stat-mini-val">${fmt$(c.budget)}</span></div>
              <div class="stat-mini"><span class="stat-mini-label">Spend</span><span class="stat-mini-val">${fmt$(c.spend)}</span></div>
              <div class="stat-mini"><span class="stat-mini-label">CVR</span><span class="stat-mini-val">${fmtPct(c.cvr)}</span></div>
              <div class="stat-mini"><span class="stat-mini-label">CPC</span><span class="stat-mini-val">${c.cpc != null ? '$' + c.cpc.toFixed(2) : '—'}</span></div>
              <div class="stat-mini"><span class="stat-mini-label">ROAS</span><span class="stat-mini-val">${c.roas != null ? c.roas.toFixed(1) + 'x' : '—'}</span></div>
              <div class="stat-mini"><span class="stat-mini-label">Clicks</span><span class="stat-mini-val">${fmtNum(c.clicks)}</span></div>
            </div>
            <div class="expand-actions">${rowActions(c)}</div>
          </td>
        </tr>` : '';

        return mainRow + expandRow;
      }).join('');

    return `
    <style>
      .c-tbl-wrap *{box-sizing:border-box;margin:0;padding:0}
      .c-tbl-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--border);gap:12px;flex-wrap:wrap}
      .c-tbl-title{font-weight:600;font-size:.9rem}
      .c-tbl-sub{font-size:.75rem;color:var(--text-muted);margin-top:2px}
      .c-chips{display:flex;gap:6px;flex-wrap:wrap}
      .c-chip{font-size:.74rem;padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:none;color:var(--text-secondary);cursor:pointer;font-family:var(--font-body);transition:background .12s,color .12s}
      .c-chip.active{background:var(--accent-subtle);color:var(--accent);border-color:transparent}
      .c-chip:hover:not(.active){background:var(--bg-hover)}
      .c-export{font-size:.74rem;padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:none;color:var(--text-secondary);cursor:pointer;font-family:var(--font-body);transition:background .12s}
      .c-export:hover{background:var(--bg-hover);color:var(--text-primary)}
      .c-tbl{width:100%;border-collapse:collapse;font-size:.83rem;table-layout:fixed}
      .c-tbl th{text-align:left;padding:10px 14px;font-size:.7rem;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted);border-bottom:1px solid var(--border);cursor:pointer;user-select:none;white-space:nowrap}
      .c-tbl th:hover{color:var(--text-primary)}
      .c-tbl th.sorted .sort-icon{color:var(--accent)}
      .sort-icon{opacity:.45;margin-left:3px;font-size:.7rem}
      .sorted .sort-icon{opacity:1}
      .c-tbl td{padding:12px 14px;border-bottom:1px solid var(--border);color:var(--text-secondary);vertical-align:middle}
      .c-tbl tr:last-child td{border-bottom:none}
      .data-row{cursor:pointer;transition:background .1s}
      .data-row:hover,.data-row.is-expanded{background:var(--bg-hover)}
      .name-cell{color:var(--text-primary);font-weight:500}
      .num-cell{font-family:var(--font-mono);font-size:.8rem}
      .status-badge{display:inline-flex;align-items:center;gap:5px;font-size:.78rem}
      .dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
      .dot-live{background:var(--green)}
      .dot-paused{background:var(--amber)}
      .dot-draft{background:var(--text-muted)}
      .bar-wrap{background:var(--bg);border-radius:3px;height:4px;width:76px;overflow:hidden}
      .bar-fill{height:100%;border-radius:3px;background:var(--accent);transition:width .5s cubic-bezier(.19,1,.22,1)}
      .chevron-cell{text-align:center;width:32px}
      .chevron{display:inline-block;font-size:.75rem;color:var(--text-muted);transition:transform .2s;line-height:1}
      .chevron.open{transform:rotate(180deg)}
      .expand-row td{padding:0;border-bottom:1px solid var(--border)}
      .expand-inner{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;padding:14px 18px;background:var(--bg)}
      .stat-mini{background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:10px 12px}
      .stat-mini-label{display:block;font-size:.7rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px}
      .stat-mini-val{font-size:1.1rem;font-weight:600;font-family:var(--font-display);color:var(--text-primary)}
      .expand-actions{display:flex;gap:8px;padding:0 18px 14px;flex-wrap:wrap}
      .act-btn{font-size:.74rem;padding:5px 12px;border-radius:6px;border:1px solid var(--border);background:none;color:var(--text-secondary);cursor:pointer;font-family:var(--font-body);transition:background .12s,color .12s}
      .act-btn:hover{background:var(--bg-hover);color:var(--text-primary)}
      .act-btn.danger{border-color:rgba(248,113,113,.3);color:var(--red)}
      .act-btn.danger:hover{background:rgba(248,113,113,.08)}
      .empty-row{padding:32px;text-align:center;color:var(--text-muted);font-size:.82rem}
    </style>

    <div class="c-tbl-wrap">
      <div class="c-tbl-header">
        <div>
          <div class="c-tbl-title">Campaigns</div>
          <div class="c-tbl-sub" id="c-count">Showing ${rows.length} campaign${rows.length !== 1 ? 's' : ''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <div class="c-chips" id="c-chips" role="group" aria-label="Filter by status">
            <button class="c-chip ${_filter === 'all'    ? 'active' : ''}" data-status="all">All</button>
            <button class="c-chip ${_filter === 'live'   ? 'active' : ''}" data-status="live">Live</button>
            <button class="c-chip ${_filter === 'paused' ? 'active' : ''}" data-status="paused">Paused</button>
            <button class="c-chip ${_filter === 'draft'  ? 'active' : ''}" data-status="draft">Draft</button>
          </div>
          <button class="c-export" id="c-export-btn" aria-label="Export campaigns as CSV">Export CSV</button>
        </div>
      </div>

      <div style="overflow-x:auto">
        <table class="c-tbl" aria-label="Campaigns">
          <thead>
            <tr>
              ${thSort('name',     'Campaign', '28%')}
              ${thSort('status',   'Status',   '10%')}
              ${thSort('budget',   'Budget',   '12%')}
              ${thSort('spend',    'Spend',    '12%')}
              ${thSort('cvr',      'CVR',      '9%')}
              <th style="width:16%" scope="col">Progress</th>
              <th style="width:4%"  scope="col" aria-label="Expand row"></th>
            </tr>
          </thead>
          <tbody id="c-tbody">${tableRows}</tbody>
        </table>
      </div>
    </div>`;
  }

  /* ── Render ────────────────────────────────────────── */
  function render() {
    if (!_mountEl) return;
    _mountEl.innerHTML = buildHTML();
    bindEvents();
  }

  /* ── Event binding ─────────────────────────────────── */
  function bindEvents() {
    /* Filter chips */
    const chips = _mountEl.querySelector('#c-chips');
    if (chips) {
      chips.addEventListener('click', e => {
        const chip = e.target.closest('[data-status]');
        if (!chip) return;
        _filter     = chip.dataset.status;
        _expandedId = null;
        render();
      });
    }

    /* Sort headers */
    _mountEl.querySelectorAll('th[data-col]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        _sortDir  = _sortCol === col ? _sortDir * -1 : 1;
        _sortCol  = col;
        render();
      });
    });

    /* Row click — expand / collapse */
    const tbody = _mountEl.querySelector('#c-tbody');
    if (tbody) {
      tbody.addEventListener('click', e => {
        /* Action buttons take priority */
        const actionBtn = e.target.closest('[data-action]');
        if (actionBtn) {
          e.stopPropagation();
          handleAction(actionBtn.dataset.action, actionBtn.dataset.id);
          return;
        }
        const row = e.target.closest('.data-row');
        if (!row) return;
        _expandedId = _expandedId === row.dataset.id ? null : row.dataset.id;
        render();
      });

      /* Keyboard: enter/space on row */
      tbody.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const row = e.target.closest('.data-row');
        if (!row) return;
        e.preventDefault();
        _expandedId = _expandedId === row.dataset.id ? null : row.dataset.id;
        render();
      });
    }

    /* Export */
    const exportBtn = _mountEl.querySelector('#c-export-btn');
    if (exportBtn) exportBtn.addEventListener('click', exportCsv);
  }

  /* ── Action handler ────────────────────────────────── */
  function handleAction(action, id) {
    const c = _campaigns.find(x => x.id === id);
    if (!c) return;

    switch (action) {
      case 'pause':
        c.status = 'paused';
        _expandedId = null;
        break;
      case 'resume':
        c.status = 'live';
        _expandedId = null;
        break;
      case 'launch':
        c.status   = 'live';
        c.progress = Math.max(c.progress, 1);
        _expandedId = null;
        break;
      case 'duplicate': {
        const copy = {
          ...c,
          id:       'c' + Date.now(),
          name:     c.name + ' (copy)',
          status:   'draft',
          spend:    null,
          progress: 0,
          clicks:   null,
        };
        _campaigns.push(copy);
        break;
      }
      case 'delete': {
        const idx = _campaigns.indexOf(c);
        if (idx > -1) _campaigns.splice(idx, 1);
        _expandedId = null;
        break;
      }
      case 'report':
        document.dispatchEvent(new CustomEvent('meridian:navigate', {
          detail: { view: 'reports', campaignId: id },
        }));
        return;
    }

    render();
  }

  /* ══════════════════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════════════════ */

  window.MeridianCampaigns = {
    /**
     * Mount the campaigns table into a DOM element.
     * @param {HTMLElement} el
     */
    mount(el) {
      if (!el) { console.error('campaigns.js: mount() requires a DOM element'); return; }
      _mountEl = el;

      /* Load data from mock — or pass in externally via setData() */
      if (window.MeridianData) {
        _campaigns = window.MeridianData.getCampaigns().map(c => ({ ...c }));
      } else {
        console.warn('campaigns.js: MeridianData not found, using empty list');
        _campaigns = [];
      }

      render();
    },

    /**
     * Replace campaign data (useful when connecting a real API).
     * @param {Array} data
     */
    setData(data) {
      _campaigns  = data.map(c => ({ ...c }));
      _expandedId = null;
      render();
    },

    /** Programmatically set the status filter. */
    setFilter(status) {
      _filter     = status;
      _expandedId = null;
      render();
    },
  };

})();
