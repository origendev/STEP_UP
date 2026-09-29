import { esc } from '../core/dom.js';
import { navigate } from '../core/router.js';

const API_BASE_URL = window.STEPUP_API_BASE_URL || 'http://localhost:3000/api';

function stripHtmlNoise(text = '') {
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

function formatDate(value) {
  if (!value) return 'Today';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Today';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function articleImage(item) {
  if (item?.image) return item.image;
  const fallback = [
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?auto=format&fit=crop&w=1200&q=80'
  ];
  return fallback[Math.abs(String(item?.title || '').length) % fallback.length];
}

export function mount() {
  const root = document.getElementById('newsArticleRoot');
  const backBtn = document.getElementById('backToDemandsBtn');
  if (backBtn) backBtn.addEventListener('click', () => navigate('demands'));

  if (!root) return;

  let article = null;
  try {
    article = JSON.parse(sessionStorage.getItem('stepupNewsArticle') || 'null');
  } catch {
    article = null;
  }

  if (!article) {
    root.innerHTML = `
      <div class="news-article-empty">
        <h3>No article selected</h3>
        <p>Choose a headline from the Demands page to read the full story.</p>
      </div>
    `;
    return;
  }

  const description = stripHtmlNoise(article.description || article.meta || 'Market update for career planning.');
  const title = article.title || 'Business update';
  const source = article.source || 'Industry Pulse';

  root.innerHTML = `
    <div class="news-article-hero">
      <img id="newsArticleImage" src="${esc(articleImage(article))}" alt="${esc(title)}" />
    </div>
    <div class="news-article-meta">
      <span class="news-article-tag">${esc(article.category || 'Market Update')} · ${esc(source)}</span>
      <span class="news-article-date">${esc(formatDate(article.publishedAt))}</span>
    </div>
    <h1 class="news-article-title">${esc(title)}</h1>
    <div class="news-article-body">
      <h2>Story overview</h2>
      <p id="newsArticleSummary">Loading the publisher's story overview…</p>
      <p class="news-publisher-note">This overview is based on the publisher's available description. Open the full report for the complete article.</p>
    </div>
    <div class="news-article-actions">
      <button class="news-back-btn" type="button" id="backToDemandsBtnInline">← Back to Demands</button>
      ${article.url && article.url !== '#' ? `<a class="news-read-btn" id="newsPublisherLink" href="${esc(article.url)}" target="_blank" rel="noopener noreferrer">Open full story</a>` : ''}
    </div>
  `;

  const inlineBackBtn = document.getElementById('backToDemandsBtnInline');
  inlineBackBtn?.addEventListener('click', () => navigate('demands'));

  const summary = document.getElementById('newsArticleSummary');
  const publisherLink = document.getElementById('newsPublisherLink');
  if (!article.id) {
    summary.textContent = description || 'The publisher overview is unavailable. Open the source page for the full report.';
    return;
  }

  fetch(`${API_BASE_URL}/demand-news/article/${encodeURIComponent(article.id)}`, {
    headers: { Accept: 'application/json' }
  })
    .then(response => response.ok ? response.json() : Promise.reject(new Error('Article details unavailable')))
    .then(result => {
      const fullStory = result.data;
      summary.textContent = stripHtmlNoise(fullStory.description || description || 'The publisher overview is unavailable. Open the source page for the full report.');
      if (publisherLink && fullStory.url) {
        publisherLink.href = fullStory.url;
        publisherLink.textContent = `Open full story at ${fullStory.publisher || source}`;
      }
      const image = document.getElementById('newsArticleImage');
      if (image && fullStory.image) image.src = fullStory.image;
    })
    .catch(() => {
      summary.textContent = description || 'The publisher overview is unavailable. Open the source page for the full report.';
    });
}
