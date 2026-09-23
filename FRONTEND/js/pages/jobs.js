/* ============================================================
   jobs.js — Jobs page
   Live job cards from the StepUp backend.
   One card = one backend job record.
============================================================ */

const API_BASE_URL = window.STEPUP_API_BASE || 'http://localhost:3000/api';

let jobs = [];
let state = {
  search: '',
  industry: 'All',
  sort: 'az'
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function esc(value){
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[ch]));
}

function initials(name){
  const words = String(name || 'Company').trim().split(/\s+/).filter(Boolean);
  if(words.length === 1) return words[0].slice(0,3).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function formatDate(value){
  if(!value) return '—';
  const date = new Date(value);
  if(Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-GB', {
    day:'numeric', month:'short', year:'numeric'
  });
}

function storageKey(id){
  return `stepup-saved-job-${id}`;
}

function companyStorageKey(id){
  return `stepup-saved-company-${id}`;
}

function isSaved(id){
  try { return localStorage.getItem(storageKey(id)) === '1'; }
  catch { return false; }
}

function isCompanySaved(id){
  try { return localStorage.getItem(companyStorageKey(id)) === '1'; }
  catch { return false; }
}

function setSaved(id, saved){
  try {
    if(saved) localStorage.setItem(storageKey(id), '1');
    else localStorage.removeItem(storageKey(id));
  } catch {}
}

function setCompanySaved(id, saved){
  try {
    if(saved) localStorage.setItem(companyStorageKey(id), '1');
    else localStorage.removeItem(companyStorageKey(id));
  } catch {}
}

function normaliseJob(job){
  return {
    id: String(job.id),
    company_id: String(job.company_id),
    company_name: job.company_name || 'Company',
    company_website: job.company_website || job.website || '',
    title: job.title || 'Job Opportunity',
    job_type: job.job_type || '—',
    salary: job.salary || '',
    stipend: job.stipend || '',
    apply_before: job.apply_before || '',
    visit_date: job.visit_date || '',
    visit_tag: job.visit_tag || '',
    status: job.status || 'Eligible',
    status_class: job.status_class || 'status-amber',
    batch: job.batch || '',
    location: job.location || '',
    work_mode: job.work_mode || '',
    description: job.description || '',
    category: job.category || 'IT',
    created_at: job.created_at || ''
  };
}

function industryFor(job){
  const value = String(job.category || '').trim();
  if(!value || value.toLowerCase() === 'eligible') return 'IT';
  return value;
}

function filteredJobs(){
  const query = state.search.trim().toLowerCase();

  let list = jobs.filter(job => {
    if(state.industry !== 'All' && industryFor(job).toLowerCase() !== state.industry.toLowerCase()) return false;

    if(!query) return true;

    const haystack = [
      job.company_name,
      job.title,
      job.job_type,
      job.salary,
      job.stipend,
      job.location,
      job.work_mode,
      job.description,
      job.category,
      job.status,
      job.batch
    ].join(' ').toLowerCase();

    return haystack.includes(query);
  });

  list.sort((a,b) => {
    if(state.sort === 'za') return b.company_name.localeCompare(a.company_name) || b.title.localeCompare(a.title);
    if(state.sort === 'newest') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    if(state.sort === 'roles') return a.title.localeCompare(b.title) || a.company_name.localeCompare(b.company_name);
    return a.company_name.localeCompare(b.company_name) || a.title.localeCompare(b.title);
  });

  return list;
}

function jobCardHTML(job){
  const saved = isSaved(job.id);
  const industry = industryFor(job);

  return `
    <article class="company-card job-card">
      <div class="company-card-top">
        <div class="company-identity">
          <div class="company-logo">${esc(initials(job.company_name))}</div>
          <div>
            <h3 class="company-name" title="${esc(job.company_name)}">${esc(job.company_name)}</h3>
            <p class="company-meta">${esc(industry)}${job.location ? ` · ${esc(job.location)}` : ''}</p>
          </div>
        </div>
        <button class="company-save ${saved ? 'saved' : ''}" data-save-job="${esc(job.id)}"
          aria-label="${saved ? 'Remove saved job' : 'Save job'}"
          title="${saved ? 'Unsave job' : 'Save job'}">
          ${saved ? '♥' : '♡'}
        </button>
      </div>

      <div class="job-card-role">
        <h4>${esc(job.title)}</h4>
        <span class="job-card-type">${esc(job.job_type)}</span>
      </div>

      <p class="company-description">${esc(job.description || 'No additional description provided.')}</p>

      <div class="company-badges">
        ${job.salary ? `<span class="company-badge">₹ ${esc(job.salary)}</span>` : ''}
        ${job.stipend ? `<span class="company-badge">Stipend ₹ ${esc(job.stipend)}</span>` : ''}
        ${job.work_mode ? `<span class="company-badge">⌂ ${esc(job.work_mode)}</span>` : ''}
        <span class="company-badge accent">▣ ${esc(job.status)}</span>
      </div>

      <div class="job-card-meta-row">
        <span>Apply by <strong>${esc(formatDate(job.apply_before))}</strong></span>
        ${job.batch ? `<span>Batch <strong>${esc(job.batch)}</strong></span>` : ''}
      </div>

      <div class="company-card-actions">
        <button class="company-view-btn" data-view-job="${esc(job.id)}">View Details <span>›</span></button>
        <button class="company-save-text ${saved ? 'saved' : ''}" data-save-job="${esc(job.id)}">
          ${saved ? '♥ Saved' : 'Save'}
        </button>
      </div>
    </article>
  `;
}

function render(){
  const grid = $('#companyGrid');
  const empty = $('#jobsEmpty');
  const loading = $('#jobsLoading');
  if(!grid) return;

  const list = filteredJobs();

  $('#jobsCount').textContent = `${list.length} ${list.length === 1 ? 'Job' : 'Jobs'} Listed`;
  $('#jobsShowing').textContent = jobs.length
    ? `Showing ${list.length} of ${jobs.length} jobs`
    : '';

  grid.innerHTML = list.map(jobCardHTML).join('');
  empty.hidden = list.length !== 0 || jobs.length === 0;
  loading.hidden = true;

  if(jobs.length === 0){
    grid.innerHTML = '';
    empty.hidden = false;
  }

  $$('#companyGrid [data-save-job]').forEach(button => {
    button.addEventListener('click', () => toggleSaved(button.dataset.saveJob));
  });

  $$('#companyGrid [data-view-job]').forEach(button => {
    button.addEventListener('click', () => openDetails(button.dataset.viewJob));
  });
}

function toggleSaved(id){
  setSaved(id, !isSaved(id));
  render();
}

function openDetails(id){
  const job = jobs.find(item => String(item.id) === String(id));
  if(!job) return;

  const modal = $('#companyModal');
  const content = $('#companyModalContent');
  if(!modal || !content) return;

  const companySaved = isCompanySaved(job.company_id);
  const jobSaved = isSaved(job.id);
  const website = String(job.company_website || '').trim();
  const safeWebsite = /^https?:\/\//i.test(website) ? website : '';

  content.innerHTML = `
    <div class="modal-company-head">
      <div class="modal-company-logo">${esc(initials(job.company_name))}</div>
      <div>
        <h3 id="companyModalTitle">${esc(job.company_name)}</h3>
        <p>${esc(industryFor(job))}${job.location ? ` · ${esc(job.location)}` : ''}</p>
      </div>
    </div>

    <div class="modal-company-description">
      <h4>${esc(job.title)}</h4>
      <p>${esc(job.description || 'No additional description provided.')}</p>
    </div>

    <div class="modal-job">
      <div class="modal-job-head">
        <h4>Job Details</h4>
        <span class="badge badge-violet">${esc(job.job_type)}</span>
      </div>
      <div class="modal-job-meta">
        ${job.salary ? `<span>Salary: ₹ ${esc(job.salary)}</span>` : ''}
        ${job.stipend ? `<span>Stipend: ₹ ${esc(job.stipend)}</span>` : ''}
        ${job.location ? `<span>⌖ ${esc(job.location)}</span>` : ''}
        ${job.work_mode ? `<span>⌂ ${esc(job.work_mode)}</span>` : ''}
        ${job.apply_before ? `<span>Apply by ${esc(formatDate(job.apply_before))}</span>` : ''}
        ${job.visit_date ? `<span>Visit ${esc(formatDate(job.visit_date))}${job.visit_tag ? ` · ${esc(job.visit_tag)}` : ''}</span>` : ''}
        ${job.batch ? `<span>Batch ${esc(job.batch)}</span>` : ''}
        <span>Status: ${esc(job.status)}</span>
      </div>
    </div>

    <div class="modal-company-actions">
      <button class="modal-primary" id="modalSaveJob">${jobSaved ? '♥ Saved Job' : 'Save Job'}</button>
      <button class="modal-secondary" id="modalSaveCompany">${companySaved ? '♥ Company Saved' : 'Save Company'}</button>
      ${safeWebsite ? `<a class="modal-secondary" href="${esc(safeWebsite)}" target="_blank" rel="noopener noreferrer">Company Website</a>` : ''}
    </div>
  `;

  modal.hidden = false;

  $('#modalSaveJob')?.addEventListener('click', () => {
    setSaved(job.id, !isSaved(job.id));
    openDetails(job.id);
    render();
  });

  $('#modalSaveCompany')?.addEventListener('click', () => {
    setCompanySaved(job.company_id, !isCompanySaved(job.company_id));
    openDetails(job.id);
  });
}

function closeDetails(){
  const modal = $('#companyModal');
  if(modal) modal.hidden = true;
}

function setError(message){
  const grid = $('#companyGrid');
  const loading = $('#jobsLoading');
  const empty = $('#jobsEmpty');
  if(loading) loading.hidden = true;
  if(grid) grid.innerHTML = '';
  if(empty){
    empty.hidden = false;
    empty.innerHTML = `
      <div class="empty-ic">!</div>
      <h3>Couldn't load jobs</h3>
      <p>${esc(message)}</p>
      <button class="btn-outline" id="retryJobs">Try Again</button>
    `;
    $('#retryJobs')?.addEventListener('click', loadJobs);
  }
}

async function loadJobs(){
  const loading = $('#jobsLoading');
  const empty = $('#jobsEmpty');
  if(loading) loading.hidden = false;
  if(empty) empty.hidden = true;

  try{
    const response = await fetch(`${API_BASE_URL}/jobs`, { cache:'no-store' });
    if(!response.ok) throw new Error(`Jobs API returned HTTP ${response.status}.`);

    const result = await response.json();
    if(!Array.isArray(result.data)) throw new Error('Jobs API returned an invalid response.');

    jobs = result.data.map(normaliseJob);
    render();
  }catch(error){
    console.error('StepUp Jobs:', error);
    setError(`Make sure the StepUp backend is running on ${API_BASE_URL.replace('/api','')}.`);
  }
}

function bindEvents(){
  $('#jobSearch')?.addEventListener('input', event => {
    state.search = event.target.value;
    render();
  });

  $$('#industryChips .industry-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      $$('#industryChips .industry-chip').forEach(item => item.classList.remove('active'));
      chip.classList.add('active');
      state.industry = chip.dataset.industry || 'All';
      render();
    });
  });

  $$('#ddSort [data-sort]').forEach(button => {
    button.addEventListener('click', () => {
      state.sort = button.dataset.sort || 'az';
      $('#sortLabel').textContent = button.textContent.trim();
      $$('#ddSort [data-sort]').forEach(item => item.classList.toggle('sel', item === button));
      $('#ddSort')?.removeAttribute('open');
      render();
    });
  });

  $('#companyModalClose')?.addEventListener('click', closeDetails);
  $('#companyModal')?.addEventListener('click', event => {
    if(event.target.id === 'companyModal') closeDetails();
  });

  document.addEventListener('keydown', handleEscape);
}

function handleEscape(event){
  if(event.key === 'Escape') closeDetails();
}

export function mount(){
  state = { search:'', industry:'All', sort:'az' };
  bindEvents();
  loadJobs();
}
