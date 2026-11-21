/* Coastline / Farmland filter for blog/index.html.
   Tap a chip to show only that section; tap it again to show everything.
   Also understands blog/index.html?tag=coastline and ?tag=farmland (the chips on each post page link there).
   Edit this file in VSCodium and push to GitHub. No Cloudflare / Worker change is needed. */
(function () {
  'use strict';
  var cur = new URLSearchParams(location.search).get('tag');
  if (cur !== 'coastline' && cur !== 'farmland') cur = 'all';

  var items = document.querySelectorAll('.sjc-item');
  var chips = document.querySelectorAll('.sjc-filter a');

  // The theme forces link colours with !important, so the chip colours are set directly with !important too.
  function paint(chip, on) {
    var bg = on ? '#006ABC' : 'transparent';
    var fg = on ? '#fff' : '#006ABC';
    chip.className = on ? 'sjc-chip on' : 'sjc-chip';
    chip.style.setProperty('background-color', bg, 'important');
    chip.style.setProperty('color', fg, 'important');
    chip.style.setProperty('-webkit-text-fill-color', fg, 'important');
    chip.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function apply() {
    var n = 0;
    items.forEach(function (li) {
      var show = cur === 'all' || (' ' + li.getAttribute('data-tags') + ' ').indexOf(' ' + cur + ' ') >= 0;
      li.style.display = show ? '' : 'none';
      if (show) n++;
    });
    chips.forEach(function (c) { paint(c, c.getAttribute('data-f') === cur); });
    var count = document.getElementById('sjc-count');
    if (count) count.textContent = '(' + n + ')';
    var empty = document.getElementById('sjc-empty');
    if (empty) empty.style.display = n ? 'none' : '';
  }

  chips.forEach(function (c) {
    c.addEventListener('click', function (ev) {
      ev.preventDefault();
      var f = c.getAttribute('data-f');
      cur = cur === f ? 'all' : f;
      try { history.replaceState(null, '', cur === 'all' ? location.pathname : location.pathname + '?tag=' + cur); } catch (e) { /* ignore */ }
      apply();
    });
  });

  apply();
})();