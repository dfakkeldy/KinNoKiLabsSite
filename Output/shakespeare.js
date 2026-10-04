/* Keyboard support for the shared menu, scoped to the Shakespeare page. */
(function () {
  'use strict';
  if (!document.body.classList.contains('page-shakespeare')) return;
  var menu = document.querySelector('.mobile-menu');
  var opener = document.querySelector('.nav-burger');
  if (!menu || !opener) return;
  var background = document.querySelectorAll('.site-header, .shakespeare-main, .site-footer');
  var wasInert = [];
  var open = false;
  menu.setAttribute('id', 'shakespeare-site-menu');
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-label', 'Site navigation');
  menu.setAttribute('aria-modal', 'true');
  opener.setAttribute('aria-controls', 'shakespeare-site-menu');
  opener.setAttribute('aria-expanded', 'false');

  opener.addEventListener('click', function () {
    if (open) return;
    open = true;
    opener.setAttribute('aria-expanded', 'true');
    for (var index = 0; index < background.length; index += 1) {
      wasInert[index] = background[index].inert;
      background[index].inert = true;
    }
    menu.querySelector('.menu-close').focus();
  });
  function closeMenu() {
    if (!open) return;
    open = false;
    opener.setAttribute('aria-expanded', 'false');
    for (var index = 0; index < background.length; index += 1) {
      background[index].inert = wasInert[index];
    }
    opener.focus();
  }
  var closers = menu.querySelectorAll('.menu-close, nav a');
  for (var index = 0; index < closers.length; index += 1) {
    closers[index].addEventListener('click', closeMenu);
  }
  document.addEventListener('keydown', function (event) {
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
    } else if (event.key === 'Tab') {
      var controls = menu.querySelectorAll('a[href], button');
      var first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
})();
