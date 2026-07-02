/**
 * ADMConnect Admin — Governance Analytics
 * Route: /admin/analytics
 * Guards: requireAdmin
 */

import { AdminLayout } from '../../../components/layout/BaseLayout.js';
import { Button } from '../../../components/base/Button.js';
import { Modal } from '../../../components/base/Modal.js';
import { showToast, setPageLoading } from '../../../core/store.js';
import { api } from '../../../api/client.js';
import { BarChart, TopicsChart, HeatmapChart, TrendCard } from '../../../components/charts/Charts.js';

const CAL_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
const EXPORT_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
const INFO_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';

export default class AnalyticsPage extends AdminLayout {
  static styles = '/pages/admin/app/Analytics.css';

  constructor(props) {
    super({
      title: 'Governance Analytics',
      breadcrumbs: [
        { label: 'Dashboard', path: '/admin' },
        { label: 'Analytics' },
      ],
      ...props,
    });
    this._metrics = null;
    this._weekly = [];
    this._topics = [];
    this._heatmap = [];
    this._exportModal = null;
  }

  getContent() {
    return '<div id="analytics-root" class="admin-analytics-page"></div>';
  }

  async onContentReady() {
    setPageLoading(true);
    this._renderShell();

    const [metricsRes, weeklyRes, topicsRes, heatmapRes] = await Promise.all([
      api.analytics.getOverview(),
      api.analytics.getWeekly(),
      api.analytics.getTopics(),
      api.analytics.getLgaHeatmap(),
    ]);

    this._metrics = metricsRes.data || {};
    this._weekly = weeklyRes.data || [];
    this._topics = topicsRes.data || [];
    this._heatmap = heatmapRes.data || [];

    setPageLoading(false);
    this._renderContent();
  }

  _renderShell() {
    const root = document.getElementById('analytics-root');
    if (!root) return;

    root.innerHTML =
      '<div class="an-page-header">' +
      '<div>' +
      '<h1 class="an-page-header__title">Governance Analytics</h1>' +
      '<p class="an-page-header__sub">My State Real-time Engagement &amp; Sentiment Overview</p>' +
      '</div>' +
      '<div class="an-page-header__actions">' +
      '<div id="export-btn-mount"></div>' +
      '</div>' +
      '</div>' +
      '<div id="an-kpi-row" class="an-kpi-row"></div>' +
      '<div id="an-charts-row" class="an-charts-row"></div>' +
      '<div id="an-heatmap-section" class="an-section"></div>' +
      '<div id="an-topics-row" class="an-topics-row"></div>';

    // Export button
    this.addChild(new Button({
      label: 'Export Report', icon: EXPORT_ICON, iconPosition: 'left',
      variant: 'primary', size: 'md',
      onClick: () => this._openExportModal(),
    })).mount(root.querySelector('#export-btn-mount'));

    // Export modal
    this._exportModal = this.addChild(new Modal({
      title: 'Export Analytics Report',
      size: 'sm',
      body:
        '<p class="an-export-desc">Choose your preferred export format. The report includes platform metrics and a full LGA breakdown.</p>' +
        '<div class="an-export-btns">' +
        '<button class="an-export-option" id="export-csv-btn">' +
        '<span class="an-export-option__icon">📄</span>' +
        '<strong>CSV</strong>' +
        '<span>Spreadsheet format</span>' +
        '</button>' +
        '<button class="an-export-option" id="export-pdf-btn">' +
        '<span class="an-export-option__icon">📑</span>' +
        '<strong>PDF</strong>' +
        '<span>Print-ready report</span>' +
        '</button>' +
        '</div>',
      footer: '<button class="ktg-btn ktg-btn--ghost ktg-btn--md" data-modal-close>Cancel</button>',
    }));
    this._exportModal.mount(document.body, { append: true });

    this.on(document, 'click', (e) => {
      if (e.target && e.target.id === 'export-csv-btn') this._doExport('csv');
      if (e.target && e.target.id === 'export-pdf-btn') this._doExport('pdf');
    });
  }

  _renderContent() {
    const m = this._metrics;
    this._renderKpis(m);
    this._renderChartsRow();
    this._renderHeatmap();
  }

  _renderKpis(m) {
    const row = document.getElementById('an-kpi-row');
    if (!row) return;
    row.innerHTML = '';

    const kpis = [
      {
        label: 'Active Users', value: this._fmt(m.activeUsers),
        trend: m.activeUsersTrend, trendLabel: 'vs last month', trendUp: m.activeUsersTrend >= 0,
      },
      {
        label: "Number of LGA's", value: this._fmt(m.totalLgas),
        trend: null,
      },
      {
        label: 'Content Engagement Rate', value: (m.engagementRate || 0) + '%',
        trend: m.engagementTrend, trendLabel: 'vs last month', trendUp: m.engagementTrend >= 0,
      },
      {
        label: 'Flagged Content', value: this._fmt(m.flaggedCount),
        trend: null,
      },
    ];

    kpis.forEach(kpi => {
      const wrap = document.createElement('div');
      wrap.className = 'an-kpi-wrap';
      row.appendChild(wrap);
      this.addChild(new TrendCard(kpi)).mount(wrap);
    });
  }

  _renderChartsRow() {
    const row = document.getElementById('an-charts-row');
    if (!row) return;
    row.innerHTML = '';

    // Left: Weekly content activity bar chart
    const leftCard = document.createElement('div');
    leftCard.className = 'an-chart-card';
    leftCard.innerHTML =
      '<div class="an-chart-card__header">' +
      '<div>' +
      '<h3 class="an-chart-card__title">Community Sentiment Trends</h3>' +
      '<p class="an-chart-card__sub">Weekly content activity (news + reels)</p>' +
      '</div>' +
      '</div>' +
      '<div id="bar-chart-mount" class="an-chart-body"></div>';
    row.appendChild(leftCard);

    const barData = this._weekly.map(w => ({
      label: w.label,
      value: w.news,
      value2: w.reels,
    }));
    this.addChild(new BarChart({
      data: barData,
      color: 'var(--color-primary)',
      color2: 'var(--color-primary-40)',
      legend: ['News', 'Reels'],
    })).mount(leftCard.querySelector('#bar-chart-mount'));

    // Right: Top discussed topics
    const rightCard = document.createElement('div');
    rightCard.className = 'an-chart-card';
    rightCard.innerHTML =
      '<div class="an-chart-card__header">' +
      '<div>' +
      '<h3 class="an-chart-card__title">Top Discussed Topics</h3>' +
      '<p class="an-chart-card__sub">Based on news categories &amp; reel hashtags</p>' +
      '</div>' +
      '<span class="an-chart-card__info" title="Derived from published news categories and reel hashtags">' + INFO_SVG + '</span>' +
      '</div>' +
      '<div id="topics-chart-mount" class="an-chart-body"></div>';
    row.appendChild(rightCard);

    this.addChild(new TopicsChart({ data: this._topics }))
      .mount(rightCard.querySelector('#topics-chart-mount'));
  }

  _renderHeatmap() {
    const section = document.getElementById('an-heatmap-section');
    if (!section) return;

    section.innerHTML =
      '<div class="an-section-header">' +
      '<div>' +
      '<h2 class="an-section-title">LGA Engagement Heatmap</h2>' +
      '<p class="an-section-sub">Activity distribution across Local Government Areas (last 30 days)</p>' +
      '</div>' +
      '</div>' +
      '<div id="heatmap-mount"></div>';

    this.addChild(new HeatmapChart({ data: this._heatmap }))
      .mount(section.querySelector('#heatmap-mount'));
  }

  _openExportModal() {
    this._exportModal.open();
  }

  async _doExport(format) {
    this._exportModal.close();
    showToast('success', 'Preparing ' + format.toUpperCase() + ' report...');
    const res = await api.analytics.exportReport(format);
    if (res.error) showToast('error', 'Export failed. Try again.');
  }

  _fmt(n) {
    if (n == null) return '—';
    if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toLocaleString();
  }
}