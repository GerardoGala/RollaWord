// =========================================================================
// ROLLAWORD SHARED NAV MENU  (/js/nav.js)
// One copy of the site menu for every page. On narrow screens it becomes a
// burger button; on wide screens it is the normal row of links.
//
// Use it on a page by putting this where the menu should appear:
//     <nav id="site-nav"></nav>
//     <script src="/js/nav.js"></script>
// (the script goes right after the nav so the menu appears with no flash)
//
// To add, remove or rename a menu item, edit LINKS below. Nothing else.
// Use root paths (starting with "/") so the links work from any folder.
// =========================================================================
(function () {
  'use strict';

  var LINKS = [
    ['Play RollaWord',  '/index.html'],
    ['Play RollaSail',  '/rollasail/index.html'],
    ['Play Thesaurus',  '/thesaurus/index.html'],
    ['Bible Genealogy', '/bible/index.html'],
    ['T&C',             '/toc.html'],
    ['Privacy Policy',  '/privacy.html'],
    ['About',           '/about.html'],
    ['Contact',         '/contact.html'],
    ['FAQ',             '/faq.html']
  ];

  // Below this width (in pixels) the menu turns into a burger.
  // Set it to 100000 to use the burger on every screen size.
  var BREAKPOINT = 720;

  // ---- styles (same look as the old menu: blue bold links, grey rule below) ----
  var CSS =
    '#site-nav{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;padding:12px 0;' +
      'border-bottom:1px solid #ddd;margin-bottom:24px}' +
    '#site-nav .nav-list{display:flex;flex-wrap:wrap;gap:8px 16px;margin:0;padding:0;list-style:none}' +
    '#site-nav .nav-list li{margin:0;padding:0}' +
    '#site-nav a{color:#1a56a0;text-decoration:none;font-weight:600}' +
    '#site-nav a[aria-current="page"]{color:#222;border-bottom:2px solid #1a56a0}' +
    '#site-nav a:focus-visible,#site-nav .nav-toggle:focus-visible{outline:2px solid #1a56a0;outline-offset:2px}' +
    '#site-nav .nav-toggle{display:none;align-items:center;gap:8px;background:none;border:1px solid #ddd;' +
      'border-radius:6px;padding:8px 12px;font:inherit;font-weight:600;color:#1a56a0;cursor:pointer}' +
    '#site-nav .nav-toggle svg{width:20px;height:20px;stroke:currentColor;stroke-width:2;stroke-linecap:round;fill:none}' +
    '#site-nav .nav-toggle .icon-close{display:none}' +
    '#site-nav.open .nav-toggle .icon-open{display:none}' +
    '#site-nav.open .nav-toggle .icon-close{display:block}' +
    '@media (max-width:' + (BREAKPOINT - 1) + 'px){' +
      '#site-nav .nav-toggle{display:inline-flex}' +
      '#site-nav .nav-list{display:none;flex-direction:column;flex-wrap:nowrap;gap:0;width:100%}' +
      '#site-nav.open .nav-list{display:flex}' +
      '#site-nav .nav-list a{display:block;padding:12px 4px;border-top:1px solid #eee}' +
      '#site-nav a[aria-current="page"]{border-bottom:0;border-left:3px solid #1a56a0;padding-left:8px}' +
    '}';

  if (!document.getElementById('site-nav-style')) {
    var style = document.createElement('style');
    style.id = 'site-nav-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  // ---- find (or create) the nav element ----
  var nav = document.getElementById('site-nav');
  if (!nav) {
    nav = document.createElement('nav');
    nav.id = 'site-nav';
    document.body.insertBefore(nav, document.body.firstChild);
  }
  nav.setAttribute('aria-label', 'Main menu');
  nav.innerHTML = '';

  // "/thesaurus/" and "/thesaurus/index.html" are the same page
  function samePage(path) {
    function clean(p) { return p.replace(/index\.html$/i, '').toLowerCase(); }
    return clean(path) === clean(location.pathname);
  }

  // ---- build the burger button and the list of links ----
  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'nav-toggle';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'site-nav-list');
  button.innerHTML =
    '<svg class="icon-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>' +
    '<svg class="icon-close" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
    '<span>Menu</span>';

  var list = document.createElement('ul');
  list.className = 'nav-list';
  list.id = 'site-nav-list';

  LINKS.forEach(function (item) {
    var li = document.createElement('li');
    var a = document.createElement('a');
    a.textContent = item[0];
    a.href = item[1];
    if (samePage(item[1])) a.setAttribute('aria-current', 'page');
    li.appendChild(a);
    list.appendChild(li);
  });

  nav.appendChild(button);
  nav.appendChild(list);

  // ---- open and close ----
  function setOpen(open) {
    nav.classList.toggle('open', open);
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  button.addEventListener('click', function () {
    setOpen(!nav.classList.contains('open'));
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('open')) {
      setOpen(false);
      button.focus();
    }
  });

  document.addEventListener('click', function (e) {
    if (nav.classList.contains('open') && !nav.contains(e.target)) setOpen(false);
  });
})();
