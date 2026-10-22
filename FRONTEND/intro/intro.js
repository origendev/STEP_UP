/* StepUp intro.
 *
 * Plays on portal-access.html before the portal cards appear:
 *   "StepUp" is revealed left to right with a soft glow -> one flash
 *   -> the word zooms through and the real page opens behind it.
 *
 * Whether it plays is decided by the tiny snippet in <head> of portal-access.html
 * (it adds the "su-intro" class to <html>). Add ?intro to the URL to force it.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  if (!root.classList.contains('su-intro')) return;

  var EXIT_AT = 2500;      // ms after the logo has loaded: word starts to zoom through
  var LEAVE_MS = 950;      // must cover the zoom / fade / page-in animations in intro.css
  var script = document.currentScript;
  var base = script && script.src ? script.src.replace(/[^\/]*$/, '') : 'intro/';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var el, timers = [], finished = false, left = false;

  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

  function markup() {
    return '' +
      '<div class="su-glow"></div>' +
      '<div class="su-bloom"></div>' +
      '<div class="su-word">' +
        '<div class="su-word-fx">' +
          '<img alt="StepUp" src="' + base + 'word.png" draggable="false">' +
          '<div class="su-edge"><i></i></div>' +
        '</div>' +
      '</div>';
  }

  /* start of the exit: page is revealed underneath while the word zooms and the overlay fades */
  function leave() {
    if (left || finished) return; left = true;
    root.classList.add('su-opening');
    root.classList.remove('su-intro');                         // reveal the real page underneath
    el.classList.add('su-leave');
    later(finish, LEAVE_MS);
    setTimeout(function () { root.classList.remove('su-opening'); }, LEAVE_MS + 150);
  }

  function finish() {
    if (finished) return; finished = true;
    timers.forEach(clearTimeout);
    root.classList.remove('su-intro');
    el.classList.add('su-out');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 600);
    window.dispatchEvent(new CustomEvent('stepup:intro-done'));
  }

  function play() {
    el.classList.remove('su-wait');                            // animations run from here
    if (reduce) { later(finish, 900); return; }
    later(leave, EXIT_AT);
  }

  function start() {
    el = document.createElement('div');
    el.id = 'su-intro';
    el.className = 'su-wait';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', 'StepUp is loading');
    el.innerHTML = markup();
    document.body.appendChild(el);

    el.addEventListener('click', finish);                      // click or tap to skip
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') finish();
    });

    var img = el.querySelector('img');
    var started = false;
    function go() { if (started) return; started = true; play(); }
    if (img.complete && img.naturalWidth) go();
    else { img.addEventListener('load', go); img.addEventListener('error', finish); later(go, 1500); }
  }

  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
