/* Blog admin: Google sign-in + a simple tablet-friendly editor that edits and saves HTML.
   Plain browser JavaScript. */
(function () {
  'use strict';

  /* ===== EDIT THESE TWO LINES (copy them from your old admin.js) ===== */
  const CLIENT_ID = '45397375888-0c26f3h05fdqrq2o9sl3tnhl7hpnd5et.apps.googleusercontent.com';   // <-- EDIT
  const ENDPOINT = 'https://rollaword-auth.gerardogala1959.workers.dev';
  /* ==================================================================== */

  // what a post is allowed to contain
  const PURIFY = {
    ALLOWED_TAGS: ['p', 'br', 'div', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'figure', 'figcaption', 'hr'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'dir']
  };

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let idToken = null;
  let user = null;
  let waitingForSignIn = null;   // function to call once a fresh sign-in arrives
  let post = null;               // { slug, isNew, cover, coverPreview }
  let dirty = false;
  let savedRange = null;
  let inited = false;

  /* ---------- small helpers ---------- */

  function show(name) {
    ['login', 'list', 'edit'].forEach((n) => { $('screen-' + n).hidden = n !== name; });
    window.scrollTo(0, 0);
  }

  let toastTimer = null;
  function toast(msg, isError) {
    const t = $('toast');
    t.textContent = msg;
    t.className = 'show' + (isError ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = ''; }, isError ? 7000 : 3500);
  }

  function jwtPayload(token) {
    try {
      const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (e) { return {}; }
  }

  function slugify(s) {
    const out = s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
    return out || 'post';
  }

  const todayLocal = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  const niceDate = (s) => {
    const d = new Date(s + 'T12:00:00');
    return isNaN(d) ? '' : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const markDirty = () => { dirty = true; };

  /* ---------- talking to the server ---------- */

  async function api(action, data) {
    const call = async () => {
      const r = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ action: action, idToken: idToken }, data || {}))
      });
      let j = {};
      try { j = await r.json(); } catch (e) { /* no JSON */ }
      return { r: r, j: j };
    };

    let res = await call();
    if (res.r.status === 401) {
      // sign-in timed out: ask for a new one, then try again automatically
      await new Promise((resolve) => {
        waitingForSignIn = resolve;
        $('relogin').hidden = false;
        if (window.google && google.accounts) google.accounts.id.prompt();
      });
      res = await call();
    }
    if (!res.r.ok) throw new Error(res.j.error || ('Something went wrong (' + res.r.status + ')'));
    return res.j;
  }

  /* ---------- Google sign-in ---------- */

  function onCredential(resp) {
    idToken = resp.credential;
    const p = jwtPayload(idToken);
    user = { name: p.name || p.email || '', email: p.email || '' };
    $('who').textContent = user.name;
    $('signout').hidden = false;
    $('relogin').hidden = true;
    if (waitingForSignIn) {
      const f = waitingForSignIn;
      waitingForSignIn = null;
      f();
    } else {
      loadList();
    }
  }

  function initGoogle() {
    if (inited) return;
    if (!(window.google && google.accounts && google.accounts.id)) return;
    inited = true;
    if (CLIENT_ID.indexOf('PASTE-') === 0) {
      $('login-msg').textContent = 'Google sign-in is not set up yet (the client ID is missing in admin.js).';
      return;
    }
    google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: onCredential,
      auto_select: true,
      cancel_on_tap_outside: false
    });
    const opts = { theme: 'filled_blue', size: 'large', text: 'signin_with', width: 280 };
    google.accounts.id.renderButton($('gsi-button'), opts);
    google.accounts.id.renderButton($('gsi-button2'), opts);
    google.accounts.id.prompt();
  }
  window.onGoogleLibraryLoad = initGoogle;

  $('signout').addEventListener('click', () => {
    if (dirty && !confirm('You have unsaved changes. Sign out anyway?')) return;
    if (window.google && google.accounts) google.accounts.id.disableAutoSelect();
    idToken = null; user = null; dirty = false;
    $('who').textContent = '';
    $('signout').hidden = true;
    show('login');
  });

  /* ---------- post list ---------- */

  async function loadList() {
    show('list');
    const box = $('post-list');
    box.textContent = 'Loading…';
    try {
      const res = await api('list');
      box.textContent = '';
      if (!res.posts.length) {
        box.textContent = 'No posts yet. Tap “+ New post” to write the first one.';
        return;
      }
      res.posts.forEach((r) => {
        const row = document.createElement('div');
        row.className = 'post-row';
        const info = document.createElement('div');
        info.className = 'info';
        const t = document.createElement('div');
        t.className = 't';
        t.textContent = r.title;
        const m = document.createElement('div');
        m.className = 'm';
        m.textContent = niceDate(r.date);
        if (r.draft) {
          const b = document.createElement('span');
          b.className = 'badge';
          b.textContent = 'Draft';
          m.appendChild(b);
        }
        info.appendChild(t);
        info.appendChild(m);
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.textContent = 'Edit';
        edit.addEventListener('click', () => editPost(r.slug));
        row.appendChild(info);
        row.appendChild(edit);
        if (!r.draft) {
          const a = document.createElement('a');
          a.className = 'view';
          a.href = '/blog/posts/' + encodeURIComponent(r.slug) + '.html';
          a.target = '_blank';
          a.rel = 'noopener';
          a.textContent = 'View';
          row.appendChild(a);
        }
        box.appendChild(row);
      });
    } catch (e) {
      box.textContent = e.message;
    }
  }

  /* ---------- editor form ---------- */

  function updateCover() {
    const has = !!post.coverPreview;
    $('cover-img').hidden = !has;
    if (has) $('cover-img').src = post.coverPreview;
    $('cover-remove').hidden = !has;
    $('cover-alt-wrap').hidden = !has;
    $('cover-pick').textContent = has ? 'Change cover photo' : 'Choose cover photo';
  }

  function updateSummaryCount() {
    const n = $('f-summary').value.replace(/\s+/g, ' ').trim().length;
    $('summary-count').textContent = n + ' characters (aim for 100 to 160)';
  }

  function fillForm(meta, bodyHtml) {
    $('f-title').value = meta.title || '';
    $('f-date').value = meta.date || todayLocal();
    $('f-author').value = meta.author || localStorage.getItem('blogAuthor') || (user && user.name) || '';
    $('f-summary').value = meta.summary || '';
    $('f-cover-alt').value = meta.imageAlt || '';
    $('f-draft').checked = meta.draft === true;
    $('editor').innerHTML = bodyHtml || '<p><br></p>';
    updateSummaryCount();
    updateCover();
    $('delete').hidden = post.isNew;
    dirty = false;
    show('edit');
  }

  function newPost() {
    post = { slug: null, isNew: true, cover: '', coverPreview: '' };
    fillForm({}, '');
  }

  async function editPost(slug) {
    try {
      toast('Opening…');
      const res = await api('get', { slug: slug });
      post = { slug: slug, isNew: false, cover: res.meta.image || '', coverPreview: res.meta.image || '' };
      fillForm(res.meta, DOMPurify.sanitize(res.body, PURIFY));
    } catch (e) {
      toast(e.message, true);
    }
  }

  $('new-post').addEventListener('click', newPost);
  ['f-title', 'f-date', 'f-author', 'f-summary', 'f-cover-alt', 'f-draft'].forEach((id) => {
    $(id).addEventListener('input', markDirty);
    $(id).addEventListener('change', markDirty);
  });
  $('f-summary').addEventListener('input', updateSummaryCount);

  /* ---------- the writing box and its toolbar ---------- */

  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) { /* ignore */ }

  document.addEventListener('selectionchange', () => {
    const s = window.getSelection();
    if (s.rangeCount && $('editor').contains(s.anchorNode)) savedRange = s.getRangeAt(0).cloneRange();
  });

  function focusEditor() {
    $('editor').focus();
    if (savedRange) {
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(savedRange);
    }
  }

  function run(name, value) {
    focusEditor();
    document.execCommand(name, false, value);
    markDirty();
  }

  function block(tag) {
    focusEditor();
    const cur = (document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/[<>]/g, '');
    document.execCommand('formatBlock', false, '<' + (cur === tag ? 'p' : tag) + '>');
    markDirty();
  }

  function addLink() {
    focusEditor();
    const sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) {
      toast('First select the words you want to turn into a link.', true);
      return;
    }
    let url = prompt('Web address for the link (for example https://example.com):');
    if (!url) return;
    url = url.trim();
    if (!/^(https?:|mailto:|\/)/i.test(url)) url = 'https://' + url;
    focusEditor();
    document.execCommand('createLink', false, url);
    markDirty();
  }

  function resizeImage(file, maxWidth) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That photo could not be read.')); };
      img.src = url;
    });
  }

  function addPhoto(forCover) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const f = input.files && input.files[0];
      if (!f) return;
      try {
        toast('Uploading photo…');
        const dataUrl = await resizeImage(f, 1600);
        const res = await api('upload', {
          filename: f.name.replace(/\.[^.]+$/, '') + '.jpg',
          data: dataUrl.split(',')[1]
        });
        if (forCover) {
          post.cover = res.path;
          post.coverPreview = dataUrl;
          updateCover();
        } else {
          const alt = prompt('Describe the photo in a few words (helps Google and visually impaired readers):', '') || '';
          focusEditor();
          document.execCommand('insertHTML', false,
            '<p><img src="' + dataUrl + '" data-path="' + esc(res.path) + '" alt="' + esc(alt) + '"></p>');
        }
        markDirty();
        toast('Photo added.');
      } catch (e) {
        toast(e.message, true);
      }
    };
    input.click();
  }

  // keep the text selection while a toolbar button is tapped
  $('toolbar').addEventListener('pointerdown', (e) => e.preventDefault());
  $('toolbar').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    switch (b.dataset.cmd) {
      case 'bold': run('bold'); break;
      case 'italic': run('italic'); break;
      case 'h2': block('h2'); break;
      case 'h3': block('h3'); break;
      case 'ul': run('insertUnorderedList'); break;
      case 'ol': run('insertOrderedList'); break;
      case 'quote': block('blockquote'); break;
      case 'link': addLink(); break;
      case 'photo': addPhoto(false); break;
    }
  });

  // paste as plain text so messy formatting from other apps does not come along
  $('editor').addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
  });
  $('editor').addEventListener('input', markDirty);

  $('cover-pick').addEventListener('click', () => addPhoto(true));
  $('cover-remove').addEventListener('click', () => {
    post.cover = ''; post.coverPreview = '';
    $('f-cover-alt').value = '';
    updateCover();
    markDirty();
  });

  /* ---------- save, delete, rebuild, back ---------- */

  // the post text as clean HTML, with photos pointing at their real web address
  function bodyForSave() {
    const clone = $('editor').cloneNode(true);
    clone.querySelectorAll('img').forEach((img) => {
      const p = img.getAttribute('data-path');
      if (p) { img.setAttribute('src', p); img.removeAttribute('data-path'); }
      ['style', 'width', 'height'].forEach((a) => img.removeAttribute(a));
    });
    let html = DOMPurify.sanitize(clone.innerHTML, PURIFY);
    html = html.replace(/&nbsp;/g, ' ')
      .replace(/^(\s*<p>(\s|<br>)*<\/p>)+/i, '')
      .replace(/(<p>(\s|<br>)*<\/p>\s*)+$/i, '')
      .trim();
    return html;
  }

  async function save() {
    const f = {
      title: $('f-title').value.trim(),
      date: $('f-date').value,
      author: $('f-author').value.trim(),
      summary: $('f-summary').value.replace(/\s+/g, ' ').trim(),
      coverAlt: $('f-cover-alt').value.trim(),
      draft: $('f-draft').checked,
      body: bodyForSave()
    };
    if (!f.title) return toast('Please add a title.', true);
    if (!f.date) return toast('Please choose a date.', true);
    if (!f.author) return toast('Please add the author name.', true);
    if (f.summary.length < 20 || f.summary.length > 300) {
      return toast('The short description needs 20 to 300 characters (now ' + f.summary.length + ').', true);
    }
    if (post.cover && !f.coverAlt) return toast('Please describe the cover photo in a few words.', true);
    if (!f.body || !f.body.replace(/<[^>]*>/g, '').trim() && f.body.indexOf('<img') < 0) return toast('The post is empty.', true);
    if (/src\s*=\s*["']data:/i.test(f.body)) return toast('A photo has not finished uploading. Please wait a moment and try again.', true);

    const slug = post.slug || (f.date + '-' + slugify(f.title));
    $('save').disabled = true;
    try {
      await api('save', {
        slug: slug,
        isNew: post.isNew,
        meta: { title: f.title, date: f.date, author: f.author, summary: f.summary, image: post.cover, imageAlt: f.coverAlt, draft: f.draft },
        body: f.body
      });
      post.slug = slug;
      post.isNew = false;
      dirty = false;
      $('delete').hidden = false;
      try { localStorage.setItem('blogAuthor', f.author); } catch (e) { /* ignore */ }
      toast(f.draft
        ? 'Saved as a draft. It stays hidden from the public.'
        : 'Saved! It will appear on the blog in 1 to 2 minutes.');
    } catch (e) {
      toast(e.message, true);
    } finally {
      $('save').disabled = false;
    }
  }

  async function removePost() {
    if (post.isNew || !post.slug) return;
    if (!confirm('Delete this post for good?')) return;
    try {
      await api('delete', { slug: post.slug });
      dirty = false;
      toast('Post deleted. The blog will update in 1 to 2 minutes.');
      loadList();
    } catch (e) {
      toast(e.message, true);
    }
  }

  async function rebuildAll() {
    if (!confirm('Rebuild every blog page from blog/template.html? This takes a moment.')) return;
    $('rebuild').disabled = true;
    try {
      let offset = 0;
      for (let i = 0; i < 200; i++) {
        toast('Rebuilding…');
        const r = await api('rebuild', { offset: offset });
        if (r.done) break;
        offset = r.next;
      }
      toast('All pages rebuilt. They go live in 1 to 2 minutes.');
    } catch (e) {
      toast(e.message, true);
    } finally {
      $('rebuild').disabled = false;
    }
  }

  $('save').addEventListener('click', save);
  $('delete').addEventListener('click', removePost);
  $('rebuild').addEventListener('click', rebuildAll);
  $('back').addEventListener('click', () => {
    if (dirty && !confirm('You have unsaved changes. Leave without saving?')) return;
    dirty = false;
    loadList();
  });

  window.addEventListener('beforeunload', (e) => {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ---------- start ---------- */

  show('login');
  initGoogle();   // in case the Google script finished loading first
})();