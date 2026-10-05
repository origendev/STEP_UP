import { $ } from '../core/dom.js';
import { demands as researchBaseline } from '../data/demands.data.js';

const API_BASE_URL = window.STEPUP_API_BASE_URL || 'http://localhost:3000/api';
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;
let laborData = null;
let roleOutlookData = null;
let activeMarket = 'india';
let activeFeedMarket = 'india';
let isLoading = false;
let isLoadingRoleOutlook = false;
let refreshTimer = null;

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function formatUpdated(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Update time unavailable' : `Updated ${date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`;
}

function safeArticleUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
  } catch {
    return '#';
  }
}

function renderRoleOutlook(result) {
  const content = $('#roleOutlookContent');
  const outlookSection = document.querySelector('.ai-outlook-section');
  const roles = result.data || [];
  const marketLabel = activeMarket === 'india' ? 'India' : 'Global';
  outlookSection.classList.toggle('is-fallback', Boolean(result.fallback));
  outlookSection.setAttribute('aria-busy', 'false');
  $('#geminiSetupLink').hidden = !result.setupRequired;
  $('#roleOutlookSummary').textContent = result.summary || 'AI outlook grounded in recent reporting and workforce research.';
  $('#outlookModeLabel').textContent = result.fallback
    ? 'RESEARCH BASELINE'
    : result.source === 'gemini-free-tier' ? 'GEMINI FREE TIER' : 'AI OUTLOOK';
  $('#forecastHorizonLabel').textContent = result.fallback ? 'AI PREDICTION PAUSED' : `NEXT ${(result.forecastHorizon || '2 MONTHS').toUpperCase()}`;
  $('#roleOutlookUpdated').textContent = result.fallback
    ? result.fallbackReason || 'Saved research · AI setup required'
    : result.stale
      ? `Showing cached outlook · ${formatUpdated(result.generatedAt)}`
      : result.source === 'gemini-free-tier'
        ? `Gemini · ${result.model || 'free tier'} · ${formatUpdated(result.generatedAt)}`
        : `AI outlook · ${formatUpdated(result.generatedAt)}`;
  $('#roleOutlookDisclaimer').textContent = result.fallback
    ? `Saved World Economic Forum · Future of Jobs 2025 baseline is long-term research, not a two-month forecast. Live company news continues to update; ${(result.fallbackReason || 'configure the free Gemini API to resume AI predictions').replace(/[.!?]+$/, '')}.`
    : 'AI-generated directional guidance grounded in recent reporting and workforce research, not a guarantee of vacancies or employment.';

  if (!roles.length) {
    content.innerHTML = '<p class="outlook-empty">No role outlook is available for this update.</p>';
    return;
  }

  content.innerHTML = roles.map((role, index) => {
    const marketOutlook = role[activeMarket === 'india' ? 'india' : 'international'];
    const jobTitles = (role.roles || []).slice(0, 4);
    const skills = (role.skills || []).slice(0, 5);
    const twoMonthOutlook = result.fallback
      ? 'A reliable two-month forecast is not available from the research baseline.'
      : role.twoMonthOutlook || 'No evidence-based two-month forecast is available for this role.';
    const sources = (role.evidence || []).slice(0, 2).map((source) => {
      const label = source.source || source.label || 'Research source';
      const title = source.title || source.label || label;
      return `<a href="${esc(safeArticleUrl(source.url))}" target="_blank" rel="noopener noreferrer" title="${esc(title)}">${esc(label)} <span aria-hidden="true">↗</span></a>`;
    }).join('');

    return `
      <article class="outlook-card" style="--outlook-order:${index}">
        <div class="outlook-row-role">
          <span class="outlook-index">${String(index + 1).padStart(2, '0')}</span>
          <div class="outlook-card-title">
            <p>${esc(role.name)}</p>
            <h3>${esc(jobTitles[0] || role.name)}</h3>
          </div>
          <span class="outlook-market-tag">${marketLabel}</span>
        </div>
        <div class="outlook-row-prediction">
          <span class="outlook-field-label">${result.fallback ? 'Forecast unavailable' : 'Next two months'}</span>
          <p>${esc(twoMonthOutlook)}</p>
        </div>
        <details class="outlook-details">
          <summary>Details</summary>
          <div class="outlook-details-panel">
            <div class="outlook-signal-block">
              <span class="outlook-field-label">${result.fallback ? 'Research signal' : 'Current demand signal'}</span>
              <p>${esc(role.signal)}</p>
            </div>
            <p class="outlook-market-copy"><strong>${marketLabel}</strong> · ${esc(marketOutlook || 'No regional outlook is available.')}</p>
            <div class="outlook-list-block">
              <span class="outlook-field-label">Roles to explore</span>
              <ul class="outlook-role-list">${jobTitles.map((title) => `<li>${esc(title)}</li>`).join('')}</ul>
            </div>
            <div class="outlook-list-block">
              <span class="outlook-field-label">Skills to build</span>
              <ul class="outlook-skill-list">${skills.map((skill) => `<li>${esc(skill)}</li>`).join('')}</ul>
            </div>
            <div class="outlook-sources"><span class="outlook-field-label">Evidence</span>${sources || '<span>Workforce research baseline</span>'}</div>
          </div>
        </details>
      </article>
    `;
  }).join('');
}

async function loadRoleOutlook(refresh = false) {
  if (isLoadingRoleOutlook) return;
  isLoadingRoleOutlook = true;
  const section = document.querySelector('.ai-outlook-section');
  section.setAttribute('aria-busy', 'true');
  if (!roleOutlookData) $('#roleOutlookUpdated').textContent = 'Updating AI outlook…';
  try {
    const response = await fetch(`${API_BASE_URL}/demand-roles${refresh ? '?refresh=true' : ''}`, {
      headers: { Accept: 'application/json' }
    });
    const result = await response.json();
    if (!response.ok) {
      const error = new Error(result.error || `AI outlook returned ${response.status}`);
      error.code = result.code;
      error.provider = result.provider;
      throw error;
    }
    roleOutlookData = result;
    renderRoleOutlook(result);
  } catch (error) {
    section.setAttribute('aria-busy', 'false');
    if (error.code === 'ai_provider_unconfigured' || error.code === 'ai_provider_quota_limited' || error.code === 'ai_provider_temporarily_busy' || error.message.toLowerCase().includes('credit')) {
      if (roleOutlookData && !roleOutlookData.fallback) {
        renderRoleOutlook({ ...roleOutlookData, stale: true });
        $('#roleOutlookUpdated').textContent = 'AI refresh unavailable · showing saved outlook';
        return;
      }
      const fallbackReason = error.code === 'ai_provider_unconfigured'
        ? 'Add a free Gemini API key to enable AI predictions.'
        : error.provider === 'openai'
          ? 'OpenAI credits are unavailable. Add a free Gemini API key to continue.'
          : error.code === 'ai_provider_temporarily_busy'
            ? 'Gemini is temporarily busy. Keeping the research baseline; automatic refresh will retry.'
          : 'Gemini free-tier limit reached; retry after it resets.';
      roleOutlookData = {
        data: researchBaseline.map((role) => ({ ...role, evidence: [role.source] })),
        summary: 'The saved workforce-research baseline is shown below. Current news updates continue, but live AI forecasts are paused.',
        forecastHorizon: '2 months',
        fallbackReason,
        setupRequired: error.code === 'ai_provider_unconfigured',
        fallback: true
      };
      renderRoleOutlook(roleOutlookData);
      return;
    }
    $('#roleOutlookUpdated').textContent = roleOutlookData
      ? 'Refresh unavailable · showing previous update'
      : 'AI outlook unavailable';
    if (roleOutlookData) {
      renderRoleOutlook({ ...roleOutlookData, stale: true });
    } else {
      $('#roleOutlookSummary').textContent = 'The AI outlook could not be updated.';
      $('#roleOutlookContent').innerHTML = `<p class="outlook-empty">${esc(error.message)} Use Refresh outlook to try again.</p>`;
    }
  } finally {
    isLoadingRoleOutlook = false;
  }
}

function renderMetrics(data) {
  const items = [
    { label: 'Hiring reports', value: data.hiringReports, note: 'Last 30 days', tone: 'hiring' },
    { label: 'Layoff reports', value: data.layoffReports, note: 'Last 30 days', tone: 'layoffs' },
    { label: 'Unique company reports', value: data.reports.length, note: 'Source-linked articles', tone: 'total' }
  ];
  $('#marketMetrics').innerHTML = items.map((item) => `
    <article class="labor-metric metric-${item.tone}">
      <span>${esc(item.label)}</span>
      <strong>${Number(item.value).toLocaleString()}</strong>
      <small>${esc(item.note)}</small>
    </article>
  `).join('');
}

function renderChart(rows, metricA, metricB) {
  const chart = $('#laborChart');
  const caption = $('#chartCaption');
  caption.textContent = metricA.caption;
  if (!rows.length) {
    chart.setAttribute('aria-label', 'No weekly report data is available.');
    chart.innerHTML = '<p class="chart-empty">No chart data is available for this period.</p>';
    return;
  }

  const width = 720;
  const height = 280;
  const plot = { left: 48, right: 18, top: 20, bottom: 42 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const highest = Math.max(1, ...rows.flatMap((row) => [Number(row[metricA.key]) || 0, Number(row[metricB.key]) || 0]));
  const tickStep = Math.max(1, Math.ceil(highest / 4));
  const scaleMax = tickStep * 4;
  const pointX = (index) => rows.length === 1 ? plot.left + plotWidth / 2 : plot.left + index * plotWidth / (rows.length - 1);
  const pointY = (value) => plot.top + plotHeight - value / scaleMax * plotHeight;
  const series = [
    { key: metricA.key, label: metricA.label, color: 'hiring', values: rows.map((row) => Math.max(0, Number(row[metricA.key]) || 0)) },
    { key: metricB.key, label: metricB.label, color: 'layoffs', values: rows.map((row) => Math.max(0, Number(row[metricB.key]) || 0)) }
  ];
  const ticks = Array.from({ length: 5 }, (_, index) => index * tickStep);
  const grid = ticks.map((tick) => {
    const y = pointY(tick);
    return `
      <line class="trend-gridline" x1="${plot.left}" y1="${y}" x2="${width - plot.right}" y2="${y}" />
      <text class="trend-axis-label" x="${plot.left - 10}" y="${y + 4}" text-anchor="end">${tick}</text>
    `;
  }).join('');
  const paths = series.map((item) => {
    const points = item.values.map((value, index) => ({ x: pointX(index), y: pointY(value), value, label: rows[index].label }));
    const line = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
    const area = `${line} L ${points.at(-1).x} ${plot.top + plotHeight} L ${points[0].x} ${plot.top + plotHeight} Z`;
    return `
      <path class="trend-area trend-area-${item.color}" d="${area}" />
      <path class="trend-line trend-line-${item.color}" pathLength="1" d="${line}" />
      ${points.map((point, index) => `
        <g class="trend-point-group" style="--point-delay:${index * 70}ms">
          <circle class="trend-point trend-point-${item.color}" cx="${point.x}" cy="${point.y}" r="4">
            <title>${esc(`${point.label}: ${item.label} ${point.value}`)}</title>
          </circle>
        </g>
      `).join('')}
    `;
  }).join('');
  const weekLabels = rows.map((row, index) => `
    <text class="trend-axis-label" x="${pointX(index)}" y="${height - 12}" text-anchor="middle">${esc(row.label)}</text>
  `).join('');
  const accessibleSummary = rows.map((row) => `${row.label}: ${metricA.label} ${row[metricA.key] || 0}, ${metricB.label} ${row[metricB.key] || 0}`).join('. ');

  chart.setAttribute('aria-label', `${metricA.label} and ${metricB.label} by week. ${accessibleSummary}`);
  chart.innerHTML = `
    <div class="trend-chart">
      <div class="trend-legend">
        <span><i class="legend-swatch hiring-swatch"></i>${esc(metricA.label)}</span>
        <span><i class="legend-swatch layoffs-swatch"></i>${esc(metricB.label)}</span>
      </div>
      <svg class="trend-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
        ${grid}
        <line class="trend-axis" x1="${plot.left}" y1="${plot.top}" x2="${plot.left}" y2="${plot.top + plotHeight}" />
        ${paths}
        ${weekLabels}
      </svg>
    </div>
  `;
}

function renderCoverageSummary(data) {
  const hiring = Math.max(0, Number(data.hiringReports) || 0);
  const layoffs = Math.max(0, Number(data.layoffReports) || 0);
  const lead = hiring === layoffs ? 'Coverage was balanced' : hiring > layoffs ? 'Hiring led coverage' : 'Layoffs led coverage';
  const difference = Math.abs(hiring - layoffs);
  const comparison = hiring === layoffs
    ? 'Hiring and layoff reports appeared in equal numbers.'
    : `${difference.toLocaleString()} more ${hiring > layoffs ? 'hiring' : 'layoff'} reports in the last 30 days.`;
  const peakWeek = (data.weekly || []).reduce((peak, week) => {
    const activity = (Number(week.hiringReports) || 0) + (Number(week.layoffReports) || 0);
    return activity > peak.activity ? { label: week.label, activity } : peak;
  }, { label: 'Not available', activity: -1 });
  $('#coverageSummary').innerHTML = `
    <div class="coverage-lead">
      <span>Overall pattern</span>
      <strong>${lead}</strong>
      <p>${comparison}</p>
    </div>
    <div class="coverage-peak">
      <span>Most active week</span>
      <strong>${esc(peakWeek.label)}</strong>
      <small>${Math.max(0, peakWeek.activity).toLocaleString()} report mentions</small>
      </div>
    <p class="coverage-note">Report volume tracks news coverage, not confirmed job totals.</p>
  `;
}

function renderReports(reports, market) {
  const list = $('#newsFeedList');
  $('#newsFeedCount').textContent = `${reports.length} ${reports.length === 1 ? 'report' : 'reports'}`;
  $('#newsFeedCaption').textContent = `${market === 'india' ? 'India' : 'Global'} · company reports from the last 30 days`;
  if (!reports.length) {
    list.innerHTML = '<p class="reports-empty">No matching reports were found in this refresh window.</p>';
    return;
  }
  list.innerHTML = reports.map((report) => {
    const date = new Date(report.publishedAt);
    const dateLabel = Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
    const typeLabel = report.type === 'mixed' ? 'Hiring + layoffs' : report.type === 'layoffs' ? 'Layoffs' : 'Hiring';
    return `
      <article class="report-row">
        <div class="report-thumb ${report.image ? 'has-image' : ''}" aria-hidden="true">
          ${report.image ? `<img src="${esc(report.image)}" alt="" loading="lazy" />` : ''}
          <span>${report.type === 'layoffs' ? 'WORKFORCE' : 'CAREERS'}</span>
        </div>
        <div class="report-type-column">
          <span class="report-type ${report.type === 'layoffs' ? 'report-type-layoff' : report.type === 'mixed' ? 'report-type-mixed' : 'report-type-hiring'}">${typeLabel}</span>
          <span class="report-date">${esc(dateLabel)}</span>
        </div>
        <div class="report-copy">
          <a href="${esc(safeArticleUrl(report.url))}" target="_blank" rel="noopener noreferrer">${esc(report.title)} <span class="report-open-mark" aria-hidden="true">↗</span></a>
          ${report.description ? `<p>${esc(report.description.slice(0, 180))}${report.description.length > 180 ? '…' : ''}</p>` : ''}
          <span class="report-source">${esc(report.source)}</span>
        </div>
      </article>
    `;
  }).join('');
  list.querySelectorAll('.report-thumb img').forEach((image) => {
    image.addEventListener('error', () => image.parentElement.classList.remove('has-image'), { once: true });
  });
}

function renderReportPreview(reports) {
  const preview = $('#reportPreviewList');
  if (!reports.length) {
    preview.innerHTML = '<p class="report-preview-empty">No recent reports found.</p>';
    return;
  }
  preview.innerHTML = reports.slice(0, 3).map((report) => {
    const date = new Date(report.publishedAt);
    const dateLabel = Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString([], { day: 'numeric', month: 'short' });
    const typeLabel = report.type === 'mixed' ? 'Hiring + layoffs' : report.type === 'layoffs' ? 'Layoffs' : 'Hiring';
    const typeClass = report.type === 'mixed' ? 'mixed' : report.type === 'layoffs' ? 'layoff' : 'hiring';
    return `
      <article class="report-preview">
        <div class="report-preview-meta">
          <span class="report-type report-type-${typeClass}">${typeLabel}</span>
          <time>${esc(dateLabel)}</time>
        </div>
        <a class="report-preview-title" href="${esc(safeArticleUrl(report.url))}" target="_blank" rel="noopener noreferrer">${esc(report.title)} <span aria-hidden="true">↗</span></a>
        <span class="report-preview-source">${esc(report.source)}</span>
      </article>
    `;
  }).join('');
}

function renderNewsFeed(market = activeMarket) {
  if (!laborData) return;
  activeFeedMarket = market;
  const label = $('#newsFeedMarketLabel');
  if (label) label.textContent = market === 'india' ? 'India' : 'Global';
  const reports = laborData[market === 'india' ? 'india' : 'overseas']?.reports || [];
  renderReports(reports, market);
}

function renderMarket(market) {
  if (!laborData) return;
  activeMarket = market;
  const isIndia = market === 'india';
  const data = isIndia ? laborData.india : laborData.overseas;
  document.querySelectorAll('.market-tab').forEach((tab) => {
    const selected = tab.dataset.market === market;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', String(selected));
  });

  $('#marketEyebrow').textContent = `${isIndia ? 'INDIA' : 'GLOBAL'} · LAST 30 DAYS`;
  $('#marketTitle').textContent = isIndia ? 'Hiring and layoffs in India' : 'Hiring and layoffs worldwide';
  $('#marketDescription').textContent = isIndia
    ? 'Recent company news reports.'
    : 'Recent international company news reports.';
  $('#marketSource').href = isIndia
    ? (data.reports?.[0]?.url || 'https://www.epfo.gov.in/')
    : (data.source || 'https://www.bls.gov/jlt/');
  $('#marketSource').textContent = isIndia
    ? (data.reports?.length ? 'View source ↗' : 'EPFO ↗')
    : 'View sources ↗';
  $('#marketDefinition').textContent = isIndia
    ? 'Counts are news reports, not worker totals. India coverage is not nationally representative.'
    : 'Counts are news reports, not worker totals.';

  renderMetrics(data);
  $('#chartTitle').textContent = 'Hiring and layoff reports by week';
  renderChart(data.weekly, {
    key: 'hiringReports',
    label: 'Hiring reports',
    caption: 'Weekly counts of company news by report type.'
  }, { key: 'layoffReports', label: 'Layoff reports' });
  renderCoverageSummary(data);

  $('#reportsTitle').textContent = 'Latest reports';
  $('#reportsCaption').textContent = isIndia ? 'Recent company news from India.' : 'Recent international company news.';
  renderReportPreview(data.reports || []);
  if (roleOutlookData) renderRoleOutlook(roleOutlookData);
  $('#marketSource').href = isIndia
    ? (data.reports?.[0]?.url || 'https://www.epfo.gov.in/')
    : (data.source || 'https://news.google.com/');
  renderNewsFeed(market);
}

async function loadLaborData(refresh = false) {
  if (isLoading) return;
  isLoading = true;
  $('#laborUpdated').textContent = 'Refreshing labor-market sources…';
  try {
    const response = await fetch(`${API_BASE_URL}/labor-market${refresh ? '?refresh=true' : ''}`, {
      headers: { Accept: 'application/json' }
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Labor-market API returned ${response.status}`);
    laborData = result;
    $('#laborUpdated').textContent = formatUpdated(result.updatedAt);
    $('#newsFeedUpdated').textContent = `Updated ${formatUpdated(result.updatedAt).replace(/^Updated /, '')} · last 30 days`;
    renderMarket(activeMarket);
  } catch (error) {
    $('#laborUpdated').textContent = 'Live data unavailable';
    $('#marketMetrics').innerHTML = '<p class="reports-empty">Live report totals are unavailable.</p>';
    $('#coverageSummary').innerHTML = `<p class="reports-empty">${esc(error.message)}. Check that the backend is running, then refresh.</p>`;
    $('#laborChart').innerHTML = '';
    $('#newsFeedList').innerHTML = '';
    $('#reportPreviewList').innerHTML = '<p class="report-preview-empty">Recent reports are unavailable. Check the connection and refresh.</p>';
  } finally {
    isLoading = false;
  }
}

async function refreshDashboard(forceRefresh = false) {
  const button = $('#refreshLaborBtn');
  if (button.disabled) return;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  try {
    await Promise.all([loadLaborData(forceRefresh), loadRoleOutlook(forceRefresh)]);
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

export function mount() {
  document.querySelectorAll('.market-tab').forEach((tab) => {
    tab.addEventListener('click', () => renderMarket(tab.dataset.market));
  });
  const modal = $('#newsFeedModal');
  const openFeedButtons = [$('#openNewsFeed'), $('#openNewsFeedInline')];
  const closeFeed = () => {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };
  const openFeed = () => {
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    renderNewsFeed(activeMarket);
    $('#closeNewsFeed').focus();
  };
  openFeedButtons.forEach((button) => button.addEventListener('click', openFeed));
  $('#closeNewsFeed').addEventListener('click', closeFeed);
  modal.querySelector('[data-close-feed="true"]').addEventListener('click', closeFeed);
  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeFeed();
  });
$('#refreshNewsFeed').addEventListener('click', () => refreshDashboard(true));
  $('#refreshLaborBtn').addEventListener('click', () => refreshDashboard(true));
  loadLaborData();
  loadRoleOutlook();
  if (!refreshTimer) refreshTimer = window.setInterval(() => {
    if ($('#view-demands')) {
      loadLaborData();
      loadRoleOutlook();
    }
  }, REFRESH_INTERVAL_MS);
}