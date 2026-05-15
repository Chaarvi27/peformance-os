/**
 * app.js — Meridian router & orchestrator
 * Listens to meridian:* events from index.html.
 * Delegates rendering to view modules and component initializers.
 * Depends on: mock.js, charts.js, campaigns.js
 */

(function () {
  'use strict';

  if (!window.Meridian) {
    console.error('app.js: window.Meridian not found — ensure index.html bootstrap ran first.');
    return;
  }

  const M = window.Meridian;

  /* ══════════════════════════════════════════════════════
     VIEW REGISTRY
     Each entry maps a nav key to a render function.
     Add new views here as you build them.
  ══════════════════════════════════════════════════════ */

  const VIEWS = {
    dashboard: renderDashboard,
    campaigns: renderCampaigns,
    insights:  renderPlaceholder('Insights',  'Cohort analysis, funnels & top performers coming soon.'),
    audiences: renderPlaceholder('Audiences', 'Segment cards & overlap analysis coming soon.'),
    reports:   renderPlaceholder('Reports',   'Report builder & export coming soon.'),
    settings:  renderPlaceholder('Settings',  'Account, integrations & notifications coming soon.'),
  };

  /* ══════════════════════════════════════════════════════
     ROUTER
  ══════════════════════════════════════════════════════ */

  function navigate(view) {
    if (!VIEWS[view]) {
      console.warn('app.js: no view registered for', view);
      return;
    }

    M.state.view = view;

    /* Update page title + subtitle */
    const meta = {
      dashboard: { title: 'Good morning, Jordan.',          sub: "Here's what's happening across your active campaigns." },
      campaigns: { title: 'Campaigns',                       sub: 'Manage, filter and export your active campaigns.'       },
      insights:  { title: 'Insights',                        sub: 'Understand performance trends and audience behaviour.'   },
      audiences: { title: 'Audiences',                       sub: 'Define and analyse your target segments.'               },
      reports:   { title: 'Reports',                         sub: 'Build, schedule and export custom reports.'             },
      settings:  { title: 'Settings',                        sub: 'Configure your account, integrations and preferences.'  },
    };

    const m = meta[view] || { title: view, sub: '' };
    const titleEl = document.getElementById('page-title');
    const subEl   = document.getElementById('page-subtitle');
    if (titleEl) titleEl.textContent = m.title;
    if (subEl)   subEl.textContent   = m.sub;

    /* Render view into #main */
    VIEWS[view]();
  }

  /* ══════════════════════════════════════════════════════
     DASHBOARD VIEW
     Restores the original index.html main content and
     re-initialises charts after the DOM is ready.
  ══════════════════════════════════════════════════════ */

  function renderDashboard() {
    const main = M.dom.main;
    if (!main) return;

    main.innerHTML = getDashboardHTML();

    /* Re-mount charts after innerHTML swap */
    requestAnimationFrame(() => {
      if (window.Meridian.charts) {
        window.Meridian.charts.rebuildPerf(M.state.range || '7d');
        window.Meridian.charts.rebuildDonut();
      }

      /* Re-wire range chips (they're now new DOM nodes) */
      main.querySelectorAll('[data-range]').forEach(btn => {
        btn.addEventListener('click', function () {
          main.querySelectorAll('[data-range]').forEach(b => b.classList.remove('active'));
          this.classList.add('active');
          document.dispatchEvent(new CustomEvent('meridian:range-change', {
            detail: { range: this.dataset.range },
          }));
        });
      });

      /* Re-wire KPI clicks */
      main.querySelectorAll('.kpi-card').forEach(card => {
        card.addEventListener('click', function () {
          document.dispatchEvent(new CustomEvent('meridian:kpi-click', {
            detail: { kpi: this.dataset.kpi },
          }));
        });
      });
    });
  }

  /* ══════════════════════════════════════════════════════
     CAMPAIGNS VIEW
  ══════════════════════════════════════════════════════ */

  function renderCampaigns() {
    const main = M.dom.main;
    if (!main) return;

    main.innerHTML = '<div id="campaigns-view"></div>';

    requestAnimationFrame(() => {
      if (window.MeridianCampaigns) {
        window.MeridianCampaigns.mount(document.getElementById('campaigns-view'));
      } else {
        console.warn('app.js: campaigns.js not loaded yet.');
      }
    });
  }

  /* ══════════════════════════════════════════════════════
     PLACEHOLDER VIEW FACTORY
  ══════════════════════════════════════════════════════ */

  function renderPlaceholder(name, message) {
    return function () {
      const main = M.dom.main;
      if (!main) return;
      main.innerHTML = `
        <div style="
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          min-height:320px;gap:12px;text-align:center;
          color:var(--text-secondary);
        ">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="1.4" stroke-linecap="round"
            stroke-linejoin="round" style="opacity:.35" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="3"/>
            <path d="M3 9h18M9 21V9"/>
          </svg>
          <p style="font-size:.95rem;font-weight:500;color:var(--text-primary)">${name}</p>
          <p style="font-size:.82rem;max-width:320px">${message}</p>
        </div>`;
    };
  }

  /* ══════════════════════════════════════════════════════
     EVENT BUS — listen to all meridian:* events
  ══════════════════════════════════════════════════════ */

  document.addEventListener('meridian:navigate', e => {
    navigate(e.detail.view);
  });

  document.addEventListener('meridian:range-change', e => {
    M.state.range = e.detail.range;
  });

  document.addEventListener('meridian:kpi-click', e => {
    /* Future: open drill-down panel for e.detail.kpi */
    console.log('KPI clicked:', e.detail.kpi);
  });

  document.addEventListener('meridian:new-campaign', () => {
    /* Future: open New Campaign modal */
    console.log('New campaign triggered');
  });

  document.addEventListener('meridian:search', e => {
    /* Future: global search overlay */
    console.log('Search query:', e.detail.query);
  });

  document.addEventListener('meridian:notifications-open', () => {
    /* Future: notifications panel */
    console.log('Notifications opened');
  });

  /* ══════════════════════════════════════════════════════
     DASHBOARD HTML TEMPLATE
     Extracted here so renderDashboard() can restore it
     after a view swap. Keep in sync with index.html.
  ══════════════════════════════════════════════════════ */

  function getDashboardHTML() {
    return `
    <section id="kpi-section" aria-label="Key performance indicators">
      <div class="kpi-card" data-kpi="revenue">
        <div class="kpi-top">
          <span class="kpi-label">Revenue</span>
          <div class="kpi-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
        </div>
        <div class="kpi-value">$148,230</div>
        <div class="kpi-footer">
          <span class="delta up">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>
            +12.4%
          </span>
          <span class="kpi-compare">vs last month</span>
        </div>
        <svg class="sparkline" viewBox="0 0 90 40" preserveAspectRatio="none" aria-hidden="true">
          <polyline points="0,38 15,30 30,32 45,20 55,22 70,10 90,5" fill="none" stroke="var(--accent)" stroke-width="2"/>
        </svg>
      </div>

      <div class="kpi-card" data-kpi="impressions">
        <div class="kpi-top">
          <span class="kpi-label">Impressions</span>
          <div class="kpi-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </div>
        </div>
        <div class="kpi-value">4.82M</div>
        <div class="kpi-footer">
          <span class="delta up">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>
            +8.1%
          </span>
          <span class="kpi-compare">vs last month</span>
        </div>
        <svg class="sparkline" viewBox="0 0 90 40" preserveAspectRatio="none" aria-hidden="true">
          <polyline points="0,35 20,28 35,30 50,18 65,14 90,8" fill="none" stroke="var(--accent)" stroke-width="2"/>
        </svg>
      </div>

      <div class="kpi-card" data-kpi="cvr">
        <div class="kpi-top">
          <span class="kpi-label">Conv. Rate</span>
          <div class="kpi-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
        </div>
        <div class="kpi-value">3.41%</div>
        <div class="kpi-footer">
          <span class="delta down">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
            −0.3%
          </span>
          <span class="kpi-compare">vs last month</span>
        </div>
        <svg class="sparkline" viewBox="0 0 90 40" preserveAspectRatio="none" aria-hidden="true">
          <polyline points="0,15 20,12 40,10 55,16 70,20 90,25" fill="none" stroke="var(--red)" stroke-width="2"/>
        </svg>
      </div>

      <div class="kpi-card" data-kpi="campaigns">
        <div class="kpi-top">
          <span class="kpi-label">Active</span>
          <div class="kpi-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
        </div>
        <div class="kpi-value">12</div>
        <div class="kpi-footer">
          <span class="delta up">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>
            +3
          </span>
          <span class="kpi-compare">this month</span>
        </div>
      </div>
    </section>

    <div id="content-grid">
      <div id="main-panel">
        <div class="panel" id="performance-panel">
          <div class="panel-header">
            <div>
              <div class="panel-title">Performance Overview</div>
              <div class="panel-subtitle">Revenue &amp; impressions over time</div>
            </div>
            <div class="panel-actions" role="group" aria-label="Date range filter">
              <button class="chip active" data-range="7d">7D</button>
              <button class="chip" data-range="30d">30D</button>
              <button class="chip" data-range="90d">90D</button>
            </div>
          </div>
          <div class="panel-body">
            <div id="chart-performance" style="position:relative;width:100%;height:260px;"></div>
          </div>
        </div>

        <div class="panel" id="campaigns-panel" style="margin-top:20px;">
          <div class="panel-header">
            <div>
              <div class="panel-title">Active Campaigns</div>
              <div class="panel-subtitle">Real-time status across channels</div>
            </div>
          </div>
          <div class="panel-body" style="padding:0;" id="campaigns-table-mount"></div>
        </div>
      </div>

      <div class="side-stack" id="side-panels">
        <div class="panel" id="activity-panel">
          <div class="panel-header">
            <div>
              <div class="panel-title">Activity</div>
              <div class="panel-subtitle">Recent events</div>
            </div>
          </div>
          <div class="panel-body" style="padding:0 22px;" id="activity-feed"></div>
        </div>

        <div class="panel" id="channel-panel">
          <div class="panel-header">
            <div>
              <div class="panel-title">Channels</div>
              <div class="panel-subtitle">Budget allocation</div>
            </div>
          </div>
          <div class="panel-body">
            <div id="chart-channels" style="position:relative;width:100%;height:160px;"></div>
            <div class="mini-stats" style="margin-top:18px;" id="channel-stats"></div>
          </div>
        </div>
      </div>
    </div>`;
  }

  /* ══════════════════════════════════════════════════════
     BOOT
     Dashboard is already rendered by index.html on first
     load, so we only need to expose navigate globally.
  ══════════════════════════════════════════════════════ */

  M.navigate = navigate;
  console.log('app.js ready — Meridian v' + M.version);

})();
