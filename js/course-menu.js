/*
 * course-menu.js
 * Adds the site title "San Juan Coast Line" at the top of a course page.
 * The title is a link to https://rollaword.com/
 * It carries its own styling, so it needs no CSS file.
 *
 * Use: add this ONE line inside <head> of every course page:
 *   <script src="/js/course-menu.js" defer></script>
 */
(function () {
  'use strict';

  var SITE_NAME = 'San Juan Coastline';
  var SITE_URL = 'https://rollaword.com/';

  var CSS =
    '.rw-sitebar{box-sizing:border-box;width:100%;margin:0;padding:16px;background:#fff;' +
    'border-bottom:1px solid #e3e8ee;text-align:left;}' +
    '.rw-sitebar a{font-family:"Roboto Flex",Roboto,"Helvetica Neue",Arial,sans-serif;' +
    'font-size:24px;font-weight:700;line-height:1.2;color:#0069c0;text-decoration:none;}' +
    '.rw-sitebar a:hover,.rw-sitebar a:focus{text-decoration:none;}';

  function init() {
    if (document.querySelector('.rw-sitebar')) { return; } // never add twice

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var bar = document.createElement('div');
    bar.className = 'rw-sitebar';

    var link = document.createElement('a');
    link.href = SITE_URL;
    link.textContent = SITE_NAME;

    bar.appendChild(link);
    document.body.insertBefore(bar, document.body.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();