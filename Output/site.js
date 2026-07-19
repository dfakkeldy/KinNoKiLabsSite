/* KinNoKi Labs — site behavior (theme, a11y font, mobile menu, reveal)
   Load with <script src="/site.js?v=20260719" defer></script>.
   IMPORTANT: also inline the no-flash snippet in <head> BEFORE styles.css:

   <script>
     document.documentElement.classList.add('js');
     try {
       var t = localStorage.getItem('kinnoki-theme');
       document.documentElement.setAttribute('data-theme',
         (t === 'light' || t === 'dark') ? t : 'dark');   // dark is the default
     } catch (e) { document.documentElement.setAttribute('data-theme', 'dark'); }
   </script>
*/

(function () {
  'use strict';

  // Some Safari/WebView versions expose querySelectorAll results without
  // NodeList.prototype.forEach. A plain indexed loop keeps every control from
  // losing its handler when that compatibility method is unavailable.
  function forEachElement(collection, callback) {
    for (var index = 0; index < collection.length; index += 1) {
      callback(collection[index]);
    }
  }

  function initializeSite() {
    var root = document.documentElement;

  /* ── Theme toggle (dark default, explicit choice persisted) ── */
  function currentTheme() {
    return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }
  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    try { localStorage.setItem('kinnoki-theme', t); } catch (e) {}
    forEachElement(document.querySelectorAll('.theme-toggle'), function (btn) {
      btn.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
      var sun = btn.querySelector('.icon-sun'), moon = btn.querySelector('.icon-moon');
      if (sun) sun.style.display = t === 'dark' ? 'block' : 'none';
      if (moon) moon.style.display = t === 'dark' ? 'none' : 'block';
    });
  }
  forEachElement(document.querySelectorAll('.theme-toggle'), function (btn) {
    btn.addEventListener('click', function () {
      applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    });
  });
  applyTheme(currentTheme()); // sync icons on load

  /* ── OpenDyslexic toggle (persisted) ───────────────── */
  function applyFont(on) {
    document.body.classList.toggle('font-opendyslexic', on);
    try { localStorage.setItem('kinnoki-dyslexic', on ? 'true' : 'false'); } catch (e) {}
    forEachElement(document.querySelectorAll('.font-toggle'), function (btn) {
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  try { applyFont(localStorage.getItem('kinnoki-dyslexic') === 'true'); } catch (e) {}
  forEachElement(document.querySelectorAll('.font-toggle'), function (btn) {
    btn.addEventListener('click', function () {
      applyFont(!document.body.classList.contains('font-opendyslexic'));
    });
  });

  /* ── Mobile menu ────────────────────────────────────── */
  var menu = document.querySelector('.mobile-menu');
  if (menu) {
    forEachElement(document.querySelectorAll('.nav-burger'), function (btn) {
      btn.addEventListener('click', function () { menu.classList.add('open'); });
    });
    forEachElement(menu.querySelectorAll('.menu-close, nav a'), function (el) {
      el.addEventListener('click', function () { menu.classList.remove('open'); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') menu.classList.remove('open');
    });
  }

  /* ── Reveal on scroll ───────────────────────────────── */
  if ('IntersectionObserver' in window &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    forEachElement(document.querySelectorAll('.reveal'), function (el) { io.observe(el); });
  } else {
    forEachElement(document.querySelectorAll('.reveal'), function (el) { el.classList.add('revealed'); });
  }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSite);
  } else {
    initializeSite();
  }
})();
