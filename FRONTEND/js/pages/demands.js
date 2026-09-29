/* ============================================================
   demands.js — Trending roles and industry demand page
   Renders practical market-demand cards from js/data/demands.data.js
============================================================ */

import { $, esc, renderList } from '../core/dom.js';
import { navigate } from '../core/router.js';
import { demands } from '../data/demands.data.js';

const API_BASE_URL = window.STEPUP_API_BASE_URL || 'http://localhost:3000/api';
const LIVE_REFRESH_MS = 60 * 60 * 1000;

function getNewsImage(item, fallbackIndex = 0){
  if (item?.image) return item.image;
  const fallbackImages = [
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?auto=format&fit=crop&w=900&q=80'
  ];
  return fallbackImages[fallbackIndex % fallbackImages.length];
}

function formatNewsDate(value){
  if (!value) return 'Today';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Today';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderHeadlineList(items){
  const list = $('#newsList');
  const detail = $('#newsDetail');
  if (!list || !detail) return;

  list.classList.remove('news-hidden');
  detail.classList.add('hidden');
  detail.innerHTML = '';

  if (!items.length) {
    list.innerHTML = '<p class="news-empty">No live headlines are available right now. Check the backend news API key and refresh later.</p>';
    return;
  }

  list.innerHTML = items.map((item, index) => `
    <button class="news-headline-card" data-index="${index}" type="button">
      <div class="news-headline-thumb">
        <img src="${getNewsImage(item, index)}" alt="${esc(item.title || 'News headline')}" loading="lazy" />
      </div>
      <div>
        <div class="news-headline-meta">
          <span class="news-tag">${esc(item.category || 'Market Update')}</span>
          <span class="news-time">${esc(formatNewsDate(item.publishedAt))}</span>
        </div>
        <div class="news-source-label">${esc(item.source || 'News publisher')}</div>
        <h4>${esc(item.title || 'Business update')}</h4>
        <p>${esc((item.description || item.meta || 'Market update for career planning.').slice(0, 120))}${((item.description || item.meta || '').length > 120) ? '…' : ''}</p>
      </div>
    </button>
  `).join('');

  list.querySelectorAll('.news-headline-card').forEach((button) => {
    button.addEventListener('click', () => {
      const idx = Number(button.dataset.index);
      const selected = items[idx];
      if (!selected) return;
      sessionStorage.setItem('stepupNewsArticle', JSON.stringify(selected));
      navigate('news-detail');
    });
  });
}

function stripHtmlNoise(text = ''){
  return String(text)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&rsquo;/g, '’')
    .replace(/&lsquo;/g, '‘')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderDetailView(item){
  const list = $('#newsList');
  const detail = $('#newsDetail');
  if (!list || !detail) return;

  list.classList.add('news-hidden');
  detail.classList.remove('hidden');

  const articleText = stripHtmlNoise(item.description || item.meta || 'Market update for career planning.');
  const contentHtml = `<p>${esc(articleText)}</p>`;

  detail.innerHTML = `
    <div class="news-detail-header">
      <button class="news-back-btn" type="button" id="newsBackBtn">← Back</button>
      <span class="news-tag">${esc(item.category || 'Market Update')}</span>
    </div>
    <div class="news-detail-hero">
      <img src="${getNewsImage(item)}" alt="${esc(item.title || 'News headline')}" />
    </div>
    <div class="news-detail-header">
      <h4>${esc(item.title || 'Business update')}</h4>
    </div>
    <div class="news-detail-meta">${esc(formatNewsDate(item.publishedAt))}</div>
    <div class="news-detail-body">${contentHtml}</div>
    <div class="news-detail-actions">
      <button class="news-back-btn" type="button" id="newsBackBtnSecondary">Back to headlines</button>
      ${item.url && item.url !== '#' ? `<a href="${item.url}" target="_blank" rel="noreferrer"><button class="news-read-btn" type="button">Read full article</button></a>` : ''}
    </div>
  `;

  const backBtn = detail.querySelector('#newsBackBtn');
  const backBtnSecondary = detail.querySelector('#newsBackBtnSecondary');
  [backBtn, backBtnSecondary].forEach((btn) => btn?.addEventListener('click', () => renderHeadlineList(itemsToRender)));
}

function demandCard(d){
  return `
    <article class="role-card">
      <header class="role-card-header">
        <span class="role-index">${esc(d.code)}</span>
        <div>
          <p class="role-kicker">Career track</p>
          <h3>${esc(d.name)}</h3>
        </div>
        <span class="role-market-label">India + global</span>
      </header>
      <p class="role-signal">${esc(d.signal)}</p>
      <section class="role-card-section">
        <h4>Roles to explore</h4>
        <ul class="role-title-list">${d.roles.map(role => `<li>${esc(role)}</li>`).join('')}</ul>
      </section>
      <div class="role-region-grid">
        <section class="role-region">
          <h4>India</h4>
          <p>${esc(d.india)}</p>
        </section>
        <section class="role-region">
          <h4>International</h4>
          <p>${esc(d.international)}</p>
        </section>
      </div>
      <footer class="role-card-footer">
        <div class="role-skill-block">
          <h4>Skills to start building</h4>
          <div class="role-skill-list">${d.skills.map(skill => `<span>${esc(skill)}</span>`).join('')}</div>
        </div>
        <a class="role-source-link" href="${esc(d.source.url)}" target="_blank" rel="noopener noreferrer">${esc(d.source.label)} ↗</a>
      </footer>
    </article>`;
}

function newsCard(item){
  return `
    <article class="news-item">
      <div class="news-head">
        <span class="news-tag">${esc(item.source || 'Industry Pulse')}</span>
        <span class="news-time">Today</span>
      </div>
      <h4>${esc(item.title || 'Business update')}</h4>
      <p>${esc(item.description || item.meta || 'Market update for career planning.')}</p>
    </article>`;
}

let itemsToRender = [];

async function loadDemandNews(){
  const container = $('#newsList');
  try {
    const res = await fetch(`${API_BASE_URL}/demand-news`, {
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) throw new Error(`Demand news API returned ${res.status}`);

    const result = await res.json();
    const items = Array.isArray(result.data) ? result.data : [];
    itemsToRender = items.map((item, index) => ({
      ...item,
      image: item.image || getNewsImage(item, index),
      source: item.source || 'News publisher',
      category: item.category || 'Market Update',
      description: item.description || ''
    }));

    const summaryEl = container.parentElement.querySelector('.news-summary');
    if (summaryEl) summaryEl.remove();

    if (result.summary) {
      container.insertAdjacentHTML('afterend', `<div class="news-summary">${esc(result.summary)}</div>`);
    }

    const updatedText = $('#lastUpdatedText');
    if (updatedText) {
      updatedText.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    renderHeadlineList(itemsToRender);
  } catch (err) {
    console.error(err);
    itemsToRender = [];
    renderHeadlineList(itemsToRender);
  }
}

export function mount(){
  renderList($('#demandList'), demands, demandCard);
  loadDemandNews();

  const modal = $('#newsModal');
  const newsBtn = $('#newsBtn');
  const closeBtn = $('#closeNewsModal');
  const refreshBtn = $('#refreshNewsBtn');

  const openNews = () => {
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    if (itemsToRender.length) renderHeadlineList(itemsToRender);
  };

  const closeNews = () => {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  };

  newsBtn.addEventListener('click', openNews);
  closeBtn.addEventListener('click', closeNews);
  refreshBtn?.addEventListener('click', () => loadDemandNews());
  modal.addEventListener('click', (e) => {
    if (e.target.dataset.close === 'true') closeNews();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeNews();
  });

  window.setInterval(() => {
    loadDemandNews();
  }, LIVE_REFRESH_MS);
}
