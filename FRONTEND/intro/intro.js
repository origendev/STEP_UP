/* StepUp intro.
 *
 * Plays on portal-access.html before the portal cards appear:
 *   big StepUp logo -> robot hops in, hand on the "p", tablet in the other hand
 *   -> tablet shows a live copy of this page, gets tapped -> zooms to full screen
 *   -> the real page is revealed (it is identical, so the hand-off is seamless).
 *
 * Whether it plays is decided by the tiny snippet in <head> of portal-access.html
 * (it adds the "su-intro" class to <html>). Add ?intro to the URL to force it.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  if (!root.classList.contains('su-intro')) return;

  var ZOOM_AT = 4900;      // ms after start: tablet begins to zoom
  var ZOOM_MS = 1500;      // must match the tablet transition in intro.css
  var script = document.currentScript;
  var base = script && script.src ? script.src.replace(/[^\/]*$/, '') : 'intro/';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var el, timers = [], finished = false;

  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

  function markup() {
    return '' +
      '<div class="su-scene" id="su-scene">' +
        '<div class="su-float"></div>' +
        '<div class="su-glow"></div>' +
        '<div class="su-logo"><img alt="StepUp" src="' + base + 'logo.jpg"></div>' +
        '<div class="su-robot-box">' +
          '<div class="su-shadow"></div>' +
          '<img class="su-robot" alt="" src="' + base + 'robot.jpg">' +
          '<div class="su-carrier">' +
            '<div class="su-tablet">' +
              '<div class="su-screen">' +
                '<div class="su-load"><i></i><i></i><i></i></div>' +
                '<iframe class="su-frame" tabindex="-1" aria-hidden="true" title="" loading="eager"></iframe>' +
              '</div>' +
              '<div class="su-grip"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function arrows(box) {
    if (!box || reduce) return;
    for (var i = 0; i < 18; i++) {
      var s = document.createElement('span');
      s.style.left = (Math.random() * 100) + '%';
      s.style.setProperty('--s', (10 + Math.random() * 16) + 'px');
      s.style.setProperty('--d', (5 + Math.random() * 5) + 's');
      s.style.setProperty('--w', (Math.random() * 5) + 's');
      box.appendChild(s);
    }
  }

  /* tablet shape follows the window shape, so the zoom lands exactly on the page */
  function fitTablet(scene) {
    var a = Math.max(0.7, Math.min(1.78, window.innerWidth / window.innerHeight));
    var sw = a >= 1.43 ? 9.6 : 6.7 * a;       // screen size in u
    var sh = sw / a;
    var ow = sw + 0.9, oh = sh + 0.9;         // plus bezel
    scene.style.setProperty('--tw', ow);
    scene.style.setProperty('--th', oh);
    scene.style.setProperty('--tl', 26.7 - ow / 2);
    scene.style.setProperty('--tt', 13 - oh / 2);
  }

  function setupFrame() {
    var scr = el.querySelector('.su-screen');
    var fr = el.querySelector('.su-frame');
    var vw = window.innerWidth, vh = window.innerHeight;
    var k = Math.min(scr.offsetWidth / vw, scr.offsetHeight / vh);
    fr.style.width = vw + 'px';
    fr.style.height = vh + 'px';
    fr.style.marginLeft = (-vw / 2) + 'px';
    fr.style.marginTop = (-vh / 2) + 'px';
    fr.style.transform = 'scale(' + k + ')';
    el.__k = k;

    var u = new URL(window.location.href);
    u.search = '?nointro=1'; u.hash = '';
    fr.addEventListener('load', function () {
      var x = vw * 0.2, y = vh * 0.72;                         // fallback tap spot
      try {                                                    // tap the first portal button
        var b = fr.contentDocument.querySelector('.portal-button').getBoundingClientRect();
        x = b.left + b.width / 2; y = b.top + b.height / 2;
      } catch (e) {}
      var tap = document.createElement('div');                 // tap ripple, in tablet-screen space
      tap.className = 'su-tap';
      tap.style.left = (scr.offsetWidth / 2 + (x - vw / 2) * k) + 'px';
      tap.style.top = (scr.offsetHeight / 2 + (y - vh / 2) * k) + 'px';
      scr.appendChild(tap);
    });
    fr.src = u.pathname.split('/').pop() + u.search;
  }

  function zoom() {
    var tab = el.querySelector('.su-tablet');
    var scr = el.querySelector('.su-screen');
    if (!tab || !scr) return;
    var r = scr.getBoundingClientRect();
    var dx = window.innerWidth / 2 - (r.left + r.width / 2);
    var dy = window.innerHeight / 2 - (r.top + r.height / 2);
    var s = 1 / el.__k;                                        // frame ends at exactly 1:1
    tab.classList.add('su-zoom');
    tab.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(0deg) scale(' + s + ')';
    ['.su-robot', '.su-shadow', '.su-glow', '.su-float', '.su-logo img'].forEach(function (q) {
      var n = el.querySelector(q); if (n) n.style.opacity = '0';
    });
  }

  function finish() {
    if (finished) return; finished = true;
    timers.forEach(clearTimeout);
    root.classList.remove('su-intro');                         // reveal the real page underneath
    el.classList.add('su-out');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 650);
    window.dispatchEvent(new CustomEvent('stepup:intro-done'));
  }

  function start() {
    el = document.createElement('div');
    el.id = 'su-intro';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', 'StepUp is loading');
    el.innerHTML = markup();
    document.body.appendChild(el);

    fitTablet(el.querySelector('.su-scene'));
    arrows(el.querySelector('.su-float'));
    setupFrame();

    el.addEventListener('click', finish);                      // click or tap to skip
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') finish();
    });
    window.addEventListener('resize', finish);

    if (reduce) { later(finish, 1200); return; }
    later(zoom, ZOOM_AT);
    later(finish, ZOOM_AT + ZOOM_MS + 100);
  }

  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
