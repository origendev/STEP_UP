/* ============================================================
   router.js — hash based router

   Responsibilities:
     1. fetch the HTML partial for a route from /pages
     2. inject it into #app
     3. run that page's mount() function so its JS binds to the
        freshly injected DOM
     4. keep the nav link highlight and the URL hash in sync

   Register pages from js/app.js with register(name, mountFn).
============================================================ */

const routes = {};     // name -> mount function (may be undefined for static pages)

let appEl = null;
let currentRoute = null;
let defaultRoute = 'home';

/** Register a page and its optional mount function. */
export function register(name, mount){
  routes[name] = mount || null;
}

/** Fetch the current page partial. */
async function loadHTML(name){
  const res = await fetch(`pages/${name}.html`, { cache: 'no-store' });
  if(!res.ok) throw new Error(`Could not load pages/${name}.html (${res.status})`);

  return res.text();
}

/** Highlight the matching nav link. */
function setActiveLink(name){
  document.querySelectorAll('.navlink').forEach(link => {
    link.classList.toggle('active', link.dataset.tab === name);
  });
}

/** Swap to a route. Called by nav clicks, [data-goto] elements and the hash. */
export async function navigate(name, { updateHash = true } = {}){
  if(!(name in routes)) name = defaultRoute;
  if(name === currentRoute) return;

  setActiveLink(name);   // highlight the tab that was touched straight away

  try{
    appEl.innerHTML = await loadHTML(name);
  }catch(err){
    console.error(err);
    setActiveLink(currentRoute);
    appEl.innerHTML = `
      <div class="empty-state">
        <h3>Couldn't load this page</h3>
        <p>${err.message}. If you opened index.html directly, start a local
        server instead — in VS Code, right click index.html and pick "Open with Live Server".</p>
      </div>`;
    return;
  }

  currentRoute = name;
  setActiveLink(name);

  // Run the page's own JS against the DOM that was just injected
  const mount = routes[name];
  if(typeof mount === 'function') mount();

  // Anything inside the new page that jumps to another page
  bindGotoLinks();

  if(updateHash && window.location.hash.slice(2) !== name){
    history.pushState(null, '', `#/${name}`);
  }
  window.scrollTo({ top:0, behavior:'instant' });
}

/** Wire up [data-goto="jobs"] style shortcuts inside a page. */
function bindGotoLinks(){
  appEl.querySelectorAll('[data-goto]').forEach(el => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => navigate(el.dataset.goto));
  });
}

function routeFromHash(){
  return window.location.hash.replace(/^#\/?/, '') || defaultRoute;
}

/** Start the router. Call once, after all pages are registered. */
export function start({ mountSelector = '#app', fallback = 'home' } = {}){
  appEl = document.querySelector(mountSelector);
  defaultRoute = fallback;

  document.querySelectorAll('.navlink').forEach(link => {
    link.addEventListener('click', () => navigate(link.dataset.tab));
  });

  window.addEventListener('popstate', () => navigate(routeFromHash(), { updateHash:false }));

  navigate(routeFromHash(), { updateHash:false });
}
