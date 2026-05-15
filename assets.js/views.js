**
 * view.js — Meridian view utilities
 * Renders dynamic sub-sections of the dashboard that aren't
 * handled by charts.js or campaigns.js.
 *
 * Responsibilities:
 *  1. Activity feed    — #activity-feed
 *  2. Channel stats    — #channel-stats
 *  3. Dashboard mini-table (Active Campaigns panel) — #campaigns-table-mount
 *  4. Toast notification system
 *  5. New Campaign modal (meridian:new-campaign)
 *  6. Notifications panel (meridian:notifications-open)
 *  7. KPI drill-down helper (meridian:kpi-click)
 *
 * Depends on: mock.js (window.MeridianData), index.html bootstrap
 * Loaded after: mock.js, charts.js, campaigns.js, app.js
 */

(function () {
  'use strict';

  /* ── Guard ─────────────────────────────────────────── */
  if (!window.MeridianData) {
    console.warn('view.js: MeridianData not found — some widgets may be empty.');
  }

  const D = () => window.MeridianData; // lazy ref so late-loads still work

  /* ══════════════════════════════════════════════════════
     1. ACTIVITY FEED
  ══════════════════════════════════════════════════════ */

  function renderActivityFeed(mountId) {
    const el = document.getElementById(mountId || 'activity-feed');
    if (!el || !D()) return;

    const items = D().getActivity();
    if (!items.length) {
      el.innerHTML = '<p style="padding:16px 0;font-size:.82rem;color:var(--text-muted)">No recent activity.</p>';
      return;
    }

    el.innerHTML = items.map(item => `
      <div class="activity-item">
        <div class="activity-dot" style="background:${escHtml(item.color)}" aria-hidden="true"></div>
        <div>
          <p>${item.text}</p>
          <div class="activity-time">${escHtml(item.time)}</div>
        </div>
      </div>`).join('');
  }

  /* ══════════════════════════════════════════════════════
     2. CHANNEL STATS (sidebar progress bars)
  ══════════════════════════════════════════════════════ */

  function renderChannelStats(mountId) {
    const el = document.getElementById(mountId || 'channel-stats');
    if (!el || !D()) return;

    const channels = D().getChannels();
    if (!channels.length) return;

    el.innerHTML = channels.map(ch => `
      <div class="mini-stat">
        <span class="mini-stat-label">${escHtml(ch.label)}</span>
        <span class="mini-stat-value">${ch.pct}%</span>
      </div>
      <div class="mini-progress">
        <div class="mini-progress-fill" style="width:${ch.pct}%;background:${escHtml(ch.color)}"></div>
      </div>`).join('');
  }

  /* ══════════════════════════════════════════════════════
     3. DASHBOARD MINI-TABLE (Active Campaigns panel)
     Renders a lightweight read-only table of campaigns
     inside #campaigns-table-mount on the dashboard view.
     Full CRUD lives in campaigns.js / Campaigns view.
  ══════════════════════════════════════════════════════ */

  function renderDashboardCampaigns(mountId) {
    const el = document.getElementById(mountId || 'campaigns-table-mount');
    if (!el || !D()) return;

    const campaigns = D().getCampaigns();
    const live = campaigns.filter(c => c.status !== 'draft');

    if (!live.length) {
      el.innerHTML = '<p style="padding:22px;font-size:.82rem;color:var(--text-muted)">No active campaigns.</p>';
      return;
    }

    const rows = live.map(c => {
      const statusClass = c.status === 'live' ? 'live' : c.status === 'paused' ? 'paused' : 'draft';
      const spendFmt    = D().formatCurrency(c.spend);
      const budgetFmt   = D().formatCurrency(c.budget);
      const cvrFmt      = D().formatCvr(c.cvr);

      return `
        <tr>
          <td class="primary">${escHtml(c.name)}</td>
          <td><span class="status-dot ${statusClass}">${capitalise(c.status)}</span></td>
          <td style="font-family:var(--font-mono);font-size:.8rem">${budgetFmt}</td>
          <td style="font-family:var(--font-mono);font-size:.8rem">${spendFmt}</td>
          <td style="font-family:var(--font-mono);font-size:.8rem">${cvrFmt}</td>
          <td>
            <div class="progress-bar-wrap">
              <div class="progress-bar-fill" style="width:${c.progress}%"></div>
            </div>
          </td>
        </tr>`;
    }).join('');

    el.innerHTML = `
      <table class="data-table" aria-label="Active campaigns summary">
        <thead>
          <tr>
            <th>Campaign</th>
            <th>Status</th>
            <th>Budget</th>
            <th>Spend</th>
            <th>CVR</th>
            <th>Progress</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  /* ══════════════════════════════════════════════════════
     4. TOAST NOTIFICATION SYSTEM
  ══════════════════════════════════════════════════════ */

  let _toastContainer = null;

  function ensureToastContainer() {
    if (_toastContainer) return _toastContainer;
    _toastContainer = document.createElement('div');
    _toastContainer.id = 'toast-container';
    document.body.appendChild(_toastContainer);
    return _toastContainer;
  }

  /**
   * Show a toast notification.
   * @param {string} message
   * @param {'success'|'error'|'info'} [type='info']
   * @param {number} [duration=3500] ms before auto-dismiss
   */
  function toast(message, type, duration) {
    type     = type     || 'info';
    duration = duration || 3500;

    const container = ensureToastContainer();
    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'polite');

    /* Icon by type */
    const icons = {
      success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
      error:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--red)"   stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      info:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    };

    el.innerHTML = (icons[type] || icons.info) + '<span>' + escHtml(message) + '</span>';
    container.appendChild(el);

    function dismiss() {
      el.classList.add('toast-out');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }

    const timer = setTimeout(dismiss, duration);
    el.addEventListener('click', () => { clearTimeout(timer); dismiss(); });
  }

  /* ══════════════════════════════════════════════════════
     5. NEW CAMPAIGN MODAL
  ══════════════════════════════════════════════════════ */

  function openNewCampaignModal() {
    /* Prevent duplicate modals */
    if (document.querySelector('.modal-backdrop')) return;

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'modal-title-nc');

    backdrop.innerHTML = `
      <div class="modal" role="document">
        <div class="modal-header">
          <span class="modal-title" id="modal-title-nc">New Campaign</span>
          <button class="modal-close" aria-label="Close modal" id="modal-close-nc">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <div class="field-group">
            <label class="field-label" for="nc-name">Campaign Name</label>
            <input class="field-input" id="nc-name" type="text"
              placeholder="e.g. Summer Brand Push" autocomplete="off" />
          </div>

          <div class="field-group">
            <label class="field-label" for="nc-channel">Channel</label>
            <select class="field-select" id="nc-channel">
              <option value="">Select a channel…</option>
              <option value="paid_search">Paid Search</option>
              <option value="paid_social">Paid Social</option>
              <option value="display">Display</option>
              <option value="email">Email</option>
              <option value="influencer">Influencer</option>
            </select>
          </div>

          <div class="field-group">
            <label class="field-label" for="nc-budget">Budget (USD)</label>
            <input class="field-input" id="nc-budget" type="number"
              placeholder="e.g. 10000" min="0" step="100" />
          </div>

          <div class="field-group">
            <label class="field-label" for="nc-start">Start Date</label>
            <input class="field-input" id="nc-start" type="date" />
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-ghost" id="modal-cancel-nc">Cancel</button>
          <button class="cta-btn"   id="modal-create-nc">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
              stroke-linecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span class="btn-label">Create Campaign</span>
          </button>
        </div>
      </div>`;

    document.body.appendChild(backdrop);

    /* Focus first input for a11y */
    requestAnimationFrame(() => {
      const first = backdrop.querySelector('#nc-name');
      if (first) first.focus();
    });

    function close() {
      backdrop.style.animation = 'fadeIn .2s ease reverse';
      backdrop.addEventListener('animationend', () => backdrop.remove(), { once: true });
    }

    backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
    backdrop.querySelector('#modal-close-nc').addEventListener('click', close);
    backdrop.querySelector('#modal-cancel-nc').addEventListener('click', close);

    backdrop.querySelector('#modal-create-nc').addEventListener('click', () => {
      const name    = backdrop.querySelector('#nc-name').value.trim();
      const channel = backdrop.querySelector('#nc-channel').value;
      const budget  = parseFloat(backdrop.querySelector('#nc-budget').value);

      if (!name) {
        toast('Please enter a campaign name.', 'error', 2500);
        backdrop.querySelector('#nc-name').focus();
        return;
      }
      if (!channel) {
        toast('Please select a channel.', 'error', 2500);
        backdrop.querySelector('#nc-channel').focus();
        return;
      }
      if (!budget || budget <= 0) {
        toast('Please enter a valid budget.', 'error', 2500);
        backdrop.querySelector('#nc-budget').focus();
        return;
      }

      /* Optimistically add to mock data */
      if (D() && typeof D().getCampaigns === 'function') {
        /* MeridianData is read-only by default — wire to real API here */
      }

      toast('"' + name + '" created as draft!', 'success');
      close();

      /* Dispatch event so other modules (campaigns.js) can refresh */
      document.dispatchEvent(new CustomEvent('meridian:campaign-created', {
        detail: { name, channel, budget },
      }));
    });

    /* Escape key */
    function onKeyDown(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKeyDown); }
    }
    document.addEventListener('keydown', onKeyDown);
  }

  /* ══════════════════════════════════════════════════════
     6. NOTIFICATIONS PANEL
  ══════════════════════════════════════════════════════ */

  const _notifications = [
    { id: 'n1', color: 'var(--green)',  text: '<strong>Spring Brand Push</strong> hit its impression goal.',  time: '2 min ago',  read: false },
    { id: 'n2', color: 'var(--amber)',  text: '<strong>Influencer Wave 3</strong> was auto-paused (budget).',  time: '3 hr ago',   read: false },
    { id: 'n3', color: 'var(--accent)', text: 'Weekly performance report is ready to download.',               time: 'Yesterday',  read: true  },
    { id: 'n4', color: 'var(--accent)', text: 'Budget alert: <strong>Retargeting Q2</strong> at 80% spend.',  time: '2 days ago', read: true  },
  ];

  function openNotificationsPanel() {
    if (document.getElementById('notif-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'notif-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Notifications');
    panel.setAttribute('aria-modal', 'false');

    Object.assign(panel.style, {
      position:     'fixed',
      top:          '70px',
      right:        '20px',
      width:        '340px',
      background:   'var(--bg-card)',
      border:       '1px solid var(--border-focus)',
      borderRadius: 'var(--radius-lg)',
      boxShadow:    '0 16px 48px rgba(0,0,0,.5)',
      zIndex:       '500',
      overflow:     'hidden',
      animation:    'modalIn .25s var(--ease-out-expo) both',
    });

    const unread = _notifications.filter(n => !n.read).length;

    const items = _notifications.map(n => `
      <div class="activity-item" style="padding:14px 18px;${n.read ? 'opacity:.6' : ''}">
        <div class="activity-dot" style="background:${n.color}" aria-hidden="true"></div>
        <div>
          <p>${n.text}</p>
          <div class="activity-time">${escHtml(n.time)}</div>
        </div>
      </div>`).join('');

    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;
        padding:16px 18px;border-bottom:1px solid var(--border);">
        <span style="font-weight:600;font-size:.9rem">
          Notifications
          ${unread ? `<span style="margin-left:6px;background:var(--accent);color:#fff;font-size:.62rem;
            font-weight:700;padding:1px 6px;border-radius:20px;font-family:var(--font-mono)">${unread}</span>` : ''}
        </span>
        <button id="notif-close" style="background:none;border:none;color:var(--text-muted);
          cursor:pointer;font-size:.78rem;font-family:var(--font-body)">
          Mark all read
        </button>
      </div>
      <div style="max-height:380px;overflow-y:auto;">
        <div class="activity-list" style="padding:0 0">${items}</div>
      </div>
      <div style="padding:12px 18px;border-top:1px solid var(--border);text-align:center;">
        <a href="#" style="font-size:.78rem;color:var(--accent);">View all notifications</a>
      </div>`;

    document.body.appendChild(panel);

    function closePanel() {
      panel.style.animation = 'toastOut .2s ease forwards';
      panel.addEventListener('animationend', () => panel.remove(), { once: true });
      document.removeEventListener('click', outsideClick);
      document.removeEventListener('keydown', onKey);
    }

    panel.querySelector('#notif-close').addEventListener('click', () => {
      _notifications.forEach(n => { n.read = true; });
      closePanel();
      /* Update dot badge on bell button */
      const dot = document.querySelector('#notifications-btn .dot');
      if (dot) dot.style.display = 'none';
    });

    function outsideClick(e) {
      const bell = document.getElementById('notifications-btn');
      if (!panel.contains(e.target) && e.target !== bell && !bell.contains(e.target)) {
        closePanel();
      }
    }

    function onKey(e) {
      if (e.key === 'Escape') closePanel();
    }

    setTimeout(() => {
      document.addEventListener('click', outsideClick);
      document.addEventListener('keydown', onKey);
    }, 0);
  }

  /* ══════════════════════════════════════════════════════
     7. KPI DRILL-DOWN (placeholder — extend as needed)
  ══════════════════════════════════════════════════════ */

  function handleKpiClick(kpi) {
    const labels = {
      revenue:     'Revenue',
      impressions: 'Impressions',
      cvr:         'Conversion Rate',
      campaigns:   'Active Campaigns',
    };
    toast('Drill-down for ' + (labels[kpi] || kpi) + ' coming soon.', 'info', 2200);
  }

  /* ══════════════════════════════════════════════════════
     8. HELPERS
  ══════════════════════════════════════════════════════ */

  function escHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function capitalise(s) {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /* ══════════════════════════════════════════════════════
     9. INIT — run once DOM is ready
  ══════════════════════════════════════════════════════ */

  function init() {
    /* Render dashboard sub-sections on first load */
    renderActivityFeed('activity-feed');
    renderChannelStats('channel-stats');
    renderDashboardCampaigns('campaigns-table-mount');

    /* ── Event listeners ──────────────────────────────── */

    /* Re-render feed/stats when navigating back to dashboard */
    document.addEventListener('meridian:navigate', function (e) {
      if (e.detail.view !== 'dashboard') return;
      /* Wait for app.js to rebuild the dashboard HTML */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          renderActivityFeed('activity-feed');
          renderChannelStats('channel-stats');
          renderDashboardCampaigns('campaigns-table-mount');
        });
      });
    });

    /* New campaign modal */
    document.addEventListener('meridian:new-campaign', openNewCampaignModal);

    /* Notifications panel */
    document.addEventListener('meridian:notifications-open', openNotificationsPanel);

    /* KPI click drill-down */
    document.addEventListener('meridian:kpi-click', function (e) {
      handleKpiClick(e.detail.kpi);
    });

    /* Search — placeholder feedback */
    document.addEventListener('meridian:search', function (e) {
      if (e.detail.query && e.detail.query.length > 1) {
        toast('Search: "' + e.detail.query + '" — global search coming soon.', 'info', 2000);
      }
    });
  }

  /* Boot after DOM & sibling scripts are ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    /* DOMContentLoaded already fired — run next tick so app.js bootstraps first */
    setTimeout(init, 0);
  }

  /* ══════════════════════════════════════════════════════
     10. PUBLIC API
  ══════════════════════════════════════════════════════ */

  window.MeridianView = {
    renderActivityFeed,
    renderChannelStats,
    renderDashboardCampaigns,
    toast,
    openNewCampaignModal,
    openNotificationsPanel,
  };

  console.log('view.js ready — MeridianView initialised.');

})();
