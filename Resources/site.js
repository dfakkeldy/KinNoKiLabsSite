/* KinNoKi Labs — site behavior (theme, a11y font, mobile menu, reveal)
   Load with <script src="/site.js" defer></script>.
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

  var root = document.documentElement;

  /* ── Theme toggle (dark default, explicit choice persisted) ── */
  function currentTheme() {
    return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }
  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    try { localStorage.setItem('kinnoki-theme', t); } catch (e) {}
    document.querySelectorAll('.theme-toggle').forEach(function (btn) {
      btn.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
      var sun = btn.querySelector('.icon-sun'), moon = btn.querySelector('.icon-moon');
      if (sun) sun.style.display = t === 'dark' ? 'block' : 'none';
      if (moon) moon.style.display = t === 'dark' ? 'none' : 'block';
    });
  }
  document.querySelectorAll('.theme-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    });
  });
  applyTheme(currentTheme()); // sync icons on load

  /* ── OpenDyslexic toggle (persisted) ───────────────── */
  function applyFont(on) {
    document.body.classList.toggle('font-opendyslexic', on);
    try { localStorage.setItem('kinnoki-dyslexic', on ? 'true' : 'false'); } catch (e) {}
  }
  try { applyFont(localStorage.getItem('kinnoki-dyslexic') === 'true'); } catch (e) {}
  document.querySelectorAll('.font-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyFont(!document.body.classList.contains('font-opendyslexic'));
    });
  });

  /* ── Mobile menu ────────────────────────────────────── */
  var menu = document.querySelector('.mobile-menu');
  if (menu) {
    document.querySelectorAll('.nav-burger').forEach(function (btn) {
      btn.addEventListener('click', function () { menu.classList.add('open'); });
    });
    menu.querySelectorAll('.menu-close, nav a').forEach(function (el) {
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
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('revealed'); });
  }
})();
