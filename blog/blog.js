/* San Juan Coastline blog - plain browser JavaScript, no build step.
   Edit the BLOG settings below ONCE (your GitHub repo name). */
(function () {
  'use strict';

  const BLOG = {
    repo: 'GerardoGala/RollaWord',   // <-- EDIT: same value as in config.yml
    branch: 'main',                        // <-- EDIT if not "main"
    siteName: 'San Juan Coastline',
    siteUrl: 'https://rollaword.com',
    homeUrl: '/',                          // page whose header, footer and CSS we reuse
    postsApiPath: 'blog/posts',
    postsUrl: '/blog/posts/',
    cacheMinutes: 5
  };

  const BASE = location.origin + BLOG.homeUrl;
  const abs = (u) => { try { return new URL(u, BASE).href; } catch (e) { return u; } };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (d) => d
    ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  /* ---------- Site header, footer, CSS: copied live from the home page ---------- */

  function fixUrls(root) {
    root.querySelectorAll('[href]').forEach((el) => {
      const v = el.getAttribute('href');
      if (v && v.charAt(0) !== '#') el.setAttribute('href', abs(v));
    });
    root.querySelectorAll('[src]').forEach((el) => el.setAttribute('src', abs(el.getAttribute('src'))));
  }

  async function loadChrome() {
    const hdr = document.getElementById('site-header');
    const ftr = document.getElementById('site-footer');
    try {
      const r = await fetch(BLOG.homeUrl, { cache: 'no-cache' });
      if (!r.ok) throw new Error('home page ' + r.status);
      const doc = new DOMParser().parseFromString(await r.text(), 'text/html');

      // 1. the site's own stylesheets, placed before blog.css so blog.css can fine-tune
      const ours = document.getElementById('blog-css');
      doc.querySelectorAll('head link[rel~="stylesheet"], head style').forEach((n) => {
        const c = document.importNode(n, true);
        if (c.tagName === 'LINK') c.setAttribute('href', abs(c.getAttribute('href')));
        document.head.insertBefore(c, ours);
      });
      doc.querySelectorAll('head link[rel~="icon"]').forEach((n) => {
        const c = document.importNode(n, true);
        c.setAttribute('href', abs(c.getAttribute('href')));
        document.head.appendChild(c);
      });

      // 2. header and footer
      const h = doc.querySelector('header');
      const footers = doc.querySelectorAll('footer');
      const f = footers.length ? footers[footers.length - 1] : null;
      if (h) { fixUrls(h); hdr.innerHTML = h.outerHTML; }
      if (f) { fixUrls(f); ftr.innerHTML = f.outerHTML; }

      // 3. the site's menu scripts (mobile menu, dropdowns), minus ad/analytics scripts
      const skip = /adsbygoogle|googletagmanager|google-analytics|gtag/i;
      const srcs = Array.from(doc.querySelectorAll('script[src]'))
        .map((s) => abs(s.getAttribute('src')))
        .filter((s) => !skip.test(s));
      for (const src of srcs) {
        await new Promise((res) => {
          const s = document.createElement('script');
          s.src = src; s.onload = res; s.onerror = res;
          document.body.appendChild(s);
        });
      }
      // theme scripts usually wait for this event, which has already happened
      document.dispatchEvent(new Event('DOMContentLoaded'));
    } catch (e) {
      console.warn('Could not copy the site header:', e);
      hdr.innerHTML = '<nav style="padding:1rem;text-align:center"><a href="' + BLOG.homeUrl +
        '">' + esc(BLOG.siteName) + '</a> &middot; <a href="/blog/index.html">Blog</a></nav>';
    }
  }

  /* ---------- Posts ---------- */

  function parsePost(slug, text) {
    const m = text.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    let meta = {};
    let body = text;
    if (m) {
      try { meta = jsyaml.load(m[1]) || {}; } catch (e) { meta = {}; }
      body = m[2];
    }
    let date = meta.date ? new Date(meta.date) : null;
    if (date && isNaN(date.getTime())) date = null;
    return {
      slug: slug,
      title: meta.title || slug,
      date: date,
      author: meta.author || '',
      summary: meta.summary || '',
      image: meta.image || '',
      imageAlt: meta.image_alt || '',
      draft: meta.draft === true,
      body: body
    };
  }

  async function listPosts() {
    const KEY = 'sjcBlogIndex.v1';
    try {
      const c = JSON.parse(localStorage.getItem(KEY));
      if (c && Date.now() - c.t < BLOG.cacheMinutes * 60000) {
        return c.posts.map((p) => Object.assign({}, p, { date: p.date ? new Date(p.date) : null }));
      }
    } catch (e) { /* no cache, carry on */ }

    // The list of files comes from GitHub (works for a public repo); each post is then read from this site.
    const api = 'https://api.github.com/repos/' + BLOG.repo + '/contents/' + BLOG.postsApiPath +
      '?ref=' + encodeURIComponent(BLOG.branch);
    const r = await fetch(api, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) throw new Error('GitHub listing failed: ' + r.status);
    const files = (await r.json()).filter((f) => f.type === 'file' && /\.md$/i.test(f.name));

    const all = await Promise.all(files.map(async (f) => {
      try {
        const res = await fetch(BLOG.postsUrl + encodeURIComponent(f.name), { cache: 'no-cache' });
        if (!res.ok) return null;   // just pushed, not deployed yet
        return parsePost(f.name.replace(/\.md$/i, ''), await res.text());
      } catch (e) { return null; }
    }));

    const posts = all.filter((p) => p && !p.draft)
      .sort((a, b) => (b.date ? b.date.getTime() : 0) - (a.date ? a.date.getTime() : 0));
    posts.forEach((p) => { delete p.body; });

    try {
      localStorage.setItem(KEY, JSON.stringify({
        t: Date.now(),
        posts: posts.map((p) => Object.assign({}, p, { date: p.date ? p.date.toISOString() : null }))
      }));
    } catch (e) { /* storage unavailable, fine */ }
    return posts;
  }

  async function renderIndex() {
    const box = document.getElementById('blog-list');
    try {
      const posts = await listPosts();
      if (!posts.length) {
        box.innerHTML = '<p class="blog-msg">No posts yet. Please check back soon.</p>';
        return;
      }
      box.innerHTML = '<div class="blog-grid">' + posts.map((p) => {
        const href = 'post.html?post=' + encodeURIComponent(p.slug);
        const img = p.image
          ? '<a href="' + href + '"><img src="' + esc(p.image) + '" alt="' + esc(p.imageAlt) + '" loading="lazy"></a>'
          : '';
        return '<article class="blog-card">' + img +
          '<div class="blog-card-body"><h2><a href="' + href + '">' + esc(p.title) + '</a></h2>' +
          '<div class="blog-meta">' + esc(fmtDate(p.date)) + (p.author ? ' &middot; ' + esc(p.author) : '') + '</div>' +
          '<p>' + esc(p.summary) + '</p></div></article>';
      }).join('') + '</div>';
    } catch (e) {
      console.error(e);
      box.innerHTML = '<p class="blog-msg">Sorry, the posts could not be loaded right now. Please try again later.</p>';
    }
  }

  /* ---------- Single post page ---------- */

  function setMeta(attr, key, val) {
    let el = document.head.querySelector('meta[' + attr + '="' + key + '"]');
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', val);
  }

  function notFound(box) {
    setMeta('name', 'robots', 'noindex');
    box.innerHTML = '<p class="blog-msg">Sorry, we could not find that post.</p>' +
      '<p><a class="blog-back" href="index.html">&larr; Back to the blog</a></p>';
  }

  async function renderPost() {
    const box = document.getElementById('blog-post');
    const slug = new URLSearchParams(location.search).get('post') || '';
    if (!/^[A-Za-z0-9_-]+$/.test(slug)) return notFound(box);

    let post;
    try {
      const res = await fetch(BLOG.postsUrl + slug + '.md', { cache: 'no-cache' });
      if (!res.ok) return notFound(box);
      post = parsePost(slug, await res.text());
    } catch (e) { return notFound(box); }
    if (post.draft) return notFound(box);

    const html = DOMPurify.sanitize(marked.parse(post.body));
    const cover = post.image
      ? '<img class="blog-cover" src="' + esc(post.image) + '" alt="' + esc(post.imageAlt) + '">'
      : '';
    box.innerHTML = '<a class="blog-back" href="index.html">&larr; All posts</a>' +
      '<article><h1>' + esc(post.title) + '</h1>' +
      '<div class="blog-meta">' + esc(fmtDate(post.date)) + (post.author ? ' &middot; ' + esc(post.author) : '') + '</div>' +
      cover + '<div class="blog-content">' + html + '</div></article>';
    box.querySelectorAll('.blog-content img').forEach((i) => { i.loading = 'lazy'; });

    // Per-post search and sharing information
    const url = BLOG.siteUrl + '/blog/post.html?post=' + slug;
    const desc = post.summary || box.querySelector('.blog-content').textContent.trim().slice(0, 155);
    const img = post.image ? (post.image.charAt(0) === '/' ? BLOG.siteUrl + post.image : post.image) : '';
    document.title = post.title + ' - ' + BLOG.siteName;
    setMeta('name', 'description', desc);
    setMeta('property', 'og:type', 'article');
    setMeta('property', 'og:site_name', BLOG.siteName);
    setMeta('property', 'og:title', post.title);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:url', url);
    if (img) setMeta('property', 'og:image', img);
    let canon = document.head.querySelector('link[rel="canonical"]');
    if (!canon) {
      canon = document.createElement('link');
      canon.rel = 'canonical';
      document.head.appendChild(canon);
    }
    canon.href = url;

    const ld = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: desc,
      mainEntityOfPage: url,
      author: { '@type': 'Person', name: post.author || BLOG.siteName },
      publisher: { '@type': 'Organization', name: BLOG.siteName }
    };
    if (post.date) ld.datePublished = post.date.toISOString();
    if (img) ld.image = img;
    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify(ld);
    document.head.appendChild(s);
  }

  /* ---------- Start ---------- */

  const page = document.body.getAttribute('data-page');
  loadChrome();
  if (page === 'index') renderIndex();
  else if (page === 'post') renderPost();
})();