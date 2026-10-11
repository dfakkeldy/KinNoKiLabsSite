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
    // styles.css shows the sun or moon icon from [data-theme].
    forEachElement(document.querySelectorAll('.theme-toggle'), function (btn) {
      btn.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
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
    var burgers = document.querySelectorAll('.nav-burger');
    // Every DOM call below is guarded: older WebViews (and the unit-test
    // doubles) may lack focus(), querySelector(), or a style object.
    function focusFirst(el) {
      if (el && typeof el.focus === 'function') el.focus();
    }
    function setMenuOpen(open, returnFocus) {
      if (open) menu.classList.add('open'); else menu.classList.remove('open');
      forEachElement(burgers, function (btn) {
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      if (document.body && document.body.style) document.body.style.overflow = open ? 'hidden' : '';
      // Keep keyboard focus inside the open menu: the page behind it is inert.
      // (Un-inert before focusing the burger, which lives in the header.)
      forEachElement(document.querySelectorAll('body > header, body > main, body > footer'), function (el) {
        if (typeof el.toggleAttribute === 'function') el.toggleAttribute('inert', open);
      });
      if (open && typeof menu.querySelector === 'function') focusFirst(menu.querySelector('.menu-close'));
      if (!open && returnFocus) focusFirst(burgers[0]);
    }
    forEachElement(burgers, function (btn) {
      btn.addEventListener('click', function () { setMenuOpen(true); });
    });
    forEachElement(menu.querySelectorAll('.menu-close, nav a, .mobile-menu-cta'), function (el) {
      el.addEventListener('click', function () { setMenuOpen(false, el.classList && el.classList.contains && el.classList.contains('menu-close')); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('open')) setMenuOpen(false, true);
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
