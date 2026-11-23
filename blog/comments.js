/*
  comments.js: reader comments for the San Juan Coastline blog.
  Put in /blog/. Needs <div id="comments"></div> on the page, then
  <link rel="stylesheet" href="/blog/comments.css"> and <script src="/blog/comments.js" defer></script>.

  - Shows APPROVED comments only, oldest first, flat.
  - Readers type a name and a comment. They are signed in as anonymous behind the scenes,
    or they can tap "Sign in with Google" first. Every comment waits for approval.
  - The Supabase key below is the public key. The real security is in the database rules.
*/
(function () {
  'use strict';

  var SUPABASE_URL = 'https://knuatcllwictmybubjys.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_Inx5GNNrBFeNYbhIucwYnA_QWZQG5xq';
  var TURNSTILE_SITE_KEY = '';   // paste the Cloudflare Turnstile site key here later; empty = no check
  var SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  var TURNSTILE_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  var MIN_GAP_MS = 30000;        // 30 seconds between comments from one browser

  var root = document.getElementById('comments');
  if (!root) return;

  function slugOf() {
    var s = root.getAttribute('data-slug');
    if (s) return s;
    var m = location.pathname.match(/\/blog\/posts\/([^\/]+?)(?:\.html)?$/);
    if (m) return decodeURIComponent(m[1]);
    // a game page: rollaword.com/<folder>/ or /<folder>/index.html  ->  thread "game-<folder>"
    var g = location.pathname.match(/^\/([A-Za-z0-9_-]+)\/(?:index\.html)?$/);
    if (g) return 'game-' + g[1].toLowerCase();
    var q = new URLSearchParams(location.search);
    return q.get('slug') || q.get('post') || q.get('p') || '';
  }
  var slug = slugOf();
  if (!slug) return;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Could not load ' + src)); };
      document.head.appendChild(s);
    });
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;   // textContent only: comments can never run as code
    return n;
  }

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  /* ---------- build the box ---------- */
  root.textContent = '';
  root.classList.add('sjc-cm');
  // keystrokes typed in the comment box must never reach a game's own keyboard handlers
  ['keydown', 'keypress', 'keyup'].forEach(function (t) {
    root.addEventListener(t, function (e) { e.stopPropagation(); });
  });

  var title = el('h2', 'sjc-cm-title', 'Comments');
  var list = el('div', 'sjc-cm-list');
  var formTitle = el('h3', 'sjc-cm-sub', 'Leave a comment');

  var who = el('div', 'sjc-cm-who');
  var form = el('form', 'sjc-cm-form');
  form.setAttribute('novalidate', '');

  var nameLabel = el('label', null, 'Your name');
  nameLabel.setAttribute('for', 'sjc-cm-name');
  var name = el('input');
  name.id = 'sjc-cm-name'; name.type = 'text'; name.maxLength = 60; name.autocomplete = 'name';

  var bodyLabel = el('label', null, 'Your comment');
  bodyLabel.setAttribute('for', 'sjc-cm-body');
  var body = el('textarea');
  body.id = 'sjc-cm-body'; body.rows = 5; body.maxLength = 2000;

  // hidden trap field: people never see it, simple bots fill it in
  var trapWrap = el('div', 'sjc-cm-trap');
  trapWrap.setAttribute('aria-hidden', 'true');
  var trap = el('input');
  trap.type = 'text'; trap.name = 'sjc_extra_note'; trap.tabIndex = -1; trap.autocomplete = 'off';
  trapWrap.appendChild(trap);

  var tsBox = el('div', 'sjc-cm-turnstile');

  var row = el('div', 'sjc-cm-row');
  var send = el('button', 'sjc-cm-send', 'Post comment');
  send.type = 'submit';
  var google = el('button', 'sjc-cm-google', 'Sign in with Google');
  google.type = 'button';
  row.appendChild(send);
  row.appendChild(google);

  var note = el('p', 'sjc-cm-note', 'Comments appear after they have been approved.');
  var status = el('p', 'sjc-cm-status');
  status.setAttribute('role', 'status');

  // shown in place of the form once a comment has been sent
  var thanks = el('div', 'sjc-cm-thanks');
  thanks.setAttribute('role', 'status');
  thanks.hidden = true;

  form.appendChild(nameLabel); form.appendChild(name);
  form.appendChild(bodyLabel); form.appendChild(body);
  form.appendChild(trapWrap);
  form.appendChild(tsBox);
  form.appendChild(row);
  form.appendChild(status);
  form.appendChild(note);

  root.appendChild(title);
  root.appendChild(list);
  root.appendChild(formTitle);
  root.appendChild(who);
  root.appendChild(form);
  root.appendChild(thanks);

  function say(text, bad) {
    status.textContent = text || '';
    status.className = 'sjc-cm-status' + (bad ? ' sjc-cm-bad' : '');
    if (text) { try { status.scrollIntoView({ block: 'nearest' }); } catch (e) { /* ignore */ } }
  }

  function showThanks() {
    say('');
    form.hidden = true;
    thanks.textContent = '';
    thanks.appendChild(el('strong', null, 'Thank you! Your comment has been received.'));
    thanks.appendChild(el('span', null, ' It will appear here once it has been approved.'));
    thanks.appendChild(document.createElement('br'));
    var again = el('button', 'sjc-cm-link', 'Write another comment');
    again.type = 'button';
    again.addEventListener('click', function () { thanks.hidden = true; form.hidden = false; name.focus(); });
    thanks.appendChild(again);
    thanks.hidden = false;
    try { thanks.scrollIntoView({ block: 'nearest' }); } catch (e) { /* ignore */ }
  }

  /* ---------- Supabase ---------- */
  var sb = null;
  var captchaToken = '';
  var tsWidget = null;

  function renderList(rows) {
    list.textContent = '';
    if (!rows.length) {
      list.appendChild(el('p', 'sjc-cm-empty', 'No comments yet. Be the first.'));
      return;
    }
    title.textContent = 'Comments (' + rows.length + ')';
    rows.forEach(function (c) {
      var item = el('div', 'sjc-cm-item');
      var head = el('div', 'sjc-cm-head');
      head.appendChild(el('strong', null, c.author_name));
      var d = new Date(c.created_at);
      head.appendChild(el('span', 'sjc-cm-date', ' · ' + d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })));
      item.appendChild(head);
      item.appendChild(el('div', 'sjc-cm-text', c.body));
      list.appendChild(item);
    });
  }

  async function loadComments() {
    var r = await sb.from('comments')
      .select('author_name,body,created_at')
      .eq('post_slug', slug)
      .eq('approved', true)          // moderators would otherwise also see waiting ones
      .order('created_at', { ascending: true });
    if (r.error) { list.textContent = ''; list.appendChild(el('p', 'sjc-cm-empty', 'Comments could not be loaded right now.')); return; }
    renderList(r.data || []);
  }

  async function showWho() {
    var s = await sb.auth.getSession();
    var u = s.data && s.data.session && s.data.session.user;
    who.textContent = '';
    if (u && !u.is_anonymous) {
      var nm = (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || u.email || '';
      if (!name.value && nm) name.value = nm;
      who.appendChild(document.createTextNode('Signed in as ' + (u.email || nm) + '. '));
      var out = el('button', 'sjc-cm-link', 'Sign out');
      out.type = 'button';
      out.addEventListener('click', async function () { await sb.auth.signOut(); showWho(); });
      who.appendChild(out);
      google.hidden = true;
    } else {
      google.hidden = false;
    }
  }

  function resetCaptcha() {
    captchaToken = '';
    if (tsWidget !== null && window.turnstile) { try { window.turnstile.reset(tsWidget); } catch (e) { /* ignore */ } }
  }

  async function ensureSession() {
    var s = await sb.auth.getSession();
    if (s.data && s.data.session) return;
    var opts = captchaToken ? { options: { captchaToken: captchaToken } } : undefined;
    var r = await sb.auth.signInAnonymously(opts);
    if (r.error) throw r.error;
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    say('');
    if (trap.value) { showThanks(); return; }   // bots land here

    var n = name.value.replace(/\s+/g, ' ').trim();
    var b = body.value.trim();
    if (!n) { say('Please enter your name.', true); name.focus(); return; }
    if (!b) { say('Please write a comment.', true); body.focus(); return; }
    if (TURNSTILE_SITE_KEY && !captchaToken) { say('Please wait for the security check to finish, then try again.', true); return; }

    var last = parseInt(lsGet('sjc-cm-last') || '0', 10);
    if (Date.now() - last < MIN_GAP_MS) { say('Please wait a few seconds before posting again.', true); return; }

    send.disabled = true;
    try {
      await ensureSession();
      var r = await sb.from('comments').insert({ post_slug: slug, author_name: n, body: b });
      if (r.error) throw r.error;
      lsSet('sjc-cm-last', String(Date.now()));
      body.value = '';
      showThanks();
    } catch (err) {
      var msg = (err && err.message) || '';
      if (/limit/i.test(msg)) say('You have reached the daily comment limit. Please try again tomorrow.', true);
      else say('Sorry, your comment could not be sent. Please try again later.', true);
    } finally {
      send.disabled = false;
      resetCaptcha();
    }
  });

  google.addEventListener('click', async function () {
    var r = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href.split('#')[0] } });
    if (r.error) say('Google sign-in is not available right now.', true);
  });

  /* ---------- start ---------- */
  (async function start() {
    try {
      if (!window.supabase) await loadScript(SDK_URL);
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      await showWho();
      loadComments();
      if (TURNSTILE_SITE_KEY) {
        await loadScript(TURNSTILE_URL);
        tsWidget = window.turnstile.render(tsBox, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: function (t) { captchaToken = t; },
          'expired-callback': function () { captchaToken = ''; },
          'error-callback': function () { captchaToken = ''; }
        });
      }
    } catch (err) {
      list.textContent = '';
      list.appendChild(el('p', 'sjc-cm-empty', 'Comments are not available right now.'));
      form.hidden = true;
      formTitle.hidden = true;
    }
  })();
})();
