/*
  Cloudflare Worker for the San Juan Coastline blog admin.
  Paste this into the Cloudflare dashboard (Edit code). It is NOT part of your GitHub repo.

  What it does
  - Checks the visitor's Google sign-in and that their Gmail address is on the approved list.
  - On Save, builds real HTML pages (using blog/template.html, copied from a Publii post):
      blog/posts/<name>.html   the post page
      the previous/next links on the neighbouring posts
      blog/index.html          the blog listing, with the post count
      blog/sitemap.xml         the blog sitemap
      blog/posts.json          the list of posts (used by the editor)
    and saves all of them to GitHub in ONE commit, so Vercel deploys once.
  - Only writes inside the blog folder.

  Worker Variables and Secrets:
    GOOGLE_CLIENT_ID   your Google OAuth client ID
    ALLOWED_EMAILS     approved Gmail addresses, separated by commas or semicolons
    GITHUB_PAT         (Secret) fine-grained token, this repo only, Contents read and write
                       (the name GITHUB_TOKEN also works)
*/

const REPO = 'GerardoGala/RollaWord';
const BRANCH = 'main';
const ALLOWED_ORIGINS = ['https://www.rollaword.com', 'https://rollaword.com'];

const SITE = 'https://rollaword.com';
const SITE_NAME = 'San Juan Coastline';
const POSTS_DIR = 'blog/posts';
const MANIFEST = 'blog/posts.json';
const TEMPLATE = 'blog/template.html';
const INDEX_PATH = 'blog/index.html';
const SITEMAP_PATH = 'blog/sitemap.xml';
const INDEX_DESCRIPTION = 'Stories, tips and news about sailing, paddling and life on the water in San Juan, Batangas.';

const MAIN_START = '<!--SJC-MAIN-START-->';
const MAIN_END = '<!--SJC-MAIN-END-->';
const BODY_START = '<!--SJC-BODY-START-->';
const BODY_END = '<!--SJC-BODY-END-->';

const SLUG = /^[A-Za-z0-9_-]{1,150}$/;
const MAX_BODY_CHARS = 300 * 1024;
const MAX_IMAGE_B64 = 3 * 1024 * 1024;
const REBUILD_BATCH = 25;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

class Fail extends Error {
  constructor(status, message, conflict) {
    super(message);
    this.status = status;
    this.conflict = !!conflict;
  }
}

/* ---------- small helpers ---------- */

function corsHeaders(origin) {
  const h = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin' };
  if (ALLOWED_ORIGINS.indexOf(origin) >= 0) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type';
    h['Access-Control-Max-Age'] = '86400';
  }
  return h;
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  return btoa(bin);
}

function base64ToUtf8(b64) {
  const bin = atob(String(b64 || '').replace(/\s+/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function imageSignatureOk(b64) {
  let head;
  try { head = atob(b64.slice(0, 24)); } catch (e) { return false; }
  if (head.length < 12) return false;
  const c = (i) => head.charCodeAt(i);
  const jpg = c(0) === 0xff && c(1) === 0xd8 && c(2) === 0xff;
  const png = c(0) === 0x89 && head.slice(1, 4) === 'PNG';
  const gif = head.slice(0, 3) === 'GIF';
  const webp = head.slice(0, 4) === 'RIFF' && head.slice(8, 12) === 'WEBP';
  return jpg || png || gif || webp;
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const jsonForScript = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

// one pass only, so text inside values is never treated as a placeholder
function fill(str, map) {
  return str.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(map, k) ? map[k] : ''));
}

/* ---------- Google sign-in ---------- */

async function verifyGoogle(idToken, env) {
  if (typeof idToken !== 'string' || idToken.length < 20) return { error: 'signin' };
  let t;
  try {
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken));
    if (!r.ok) return { error: 'signin' };
    t = await r.json();
  } catch (e) {
    return { error: 'signin' };
  }
  const issuerOk = t.iss === 'accounts.google.com' || t.iss === 'https://accounts.google.com';
  const verified = t.email_verified === true || t.email_verified === 'true';
  const notExpired = Number(t.exp) * 1000 > Date.now();
  if (t.aud !== String(env.GOOGLE_CLIENT_ID || '').trim() || !issuerOk || !verified || !notExpired) return { error: 'signin' };
  const email = String(t.email || '').toLowerCase();
  const allowed = String(env.ALLOWED_EMAILS || '').split(/[,;\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (allowed.indexOf(email) < 0) return { error: 'forbidden' };
  return { email: email };
}

/* ---------- GitHub ---------- */

async function gh(env, path, method, payload) {
  const r = await fetch('https://api.github.com/repos/' + REPO + path, {
    method: method || 'GET',
    headers: {
      Authorization: 'Bearer ' + (env.GITHUB_TOKEN || env.GITHUB_PAT),
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'sjc-blog-admin',
      'Content-Type': 'application/json'
    },
    body: payload ? JSON.stringify(payload) : undefined
  });
  let data = null;
  try { data = await r.json(); } catch (e) { /* no body */ }
  return { status: r.status, ok: r.ok, data: data };
}

function ghFail(g) {
  if (g.status === 401 || g.status === 403) return new Fail(500, 'The server could not write to GitHub. The GitHub token may have expired.');
  if (g.status === 404) return new Fail(500, 'GitHub could not find the repository or branch. Check the token and repository settings.');
  return new Fail(502, 'GitHub said: ' + ((g.data && g.data.message) || g.status));
}

// Remember the newest commit at the start. Everything is read from it and the
// new commit is built on top of it, so a save can never overwrite a newer one.
async function openRepo(env) {
  const ref = await gh(env, '/git/ref/heads/' + BRANCH);
  if (!ref.ok) throw ghFail(ref);
  const commitSha = ref.data.object.sha;
  const c = await gh(env, '/git/commits/' + commitSha);
  if (!c.ok) throw ghFail(c);
  return { commitSha: commitSha, treeSha: c.data.tree.sha };
}

async function readFile(env, repo, path) {
  const g = await gh(env, '/contents/' + path + '?ref=' + repo.commitSha);
  if (g.status === 404) return null;
  if (!g.ok) throw ghFail(g);
  return base64ToUtf8(g.data.content);
}

async function commitChanges(env, repo, changes, message) {
  const tree = changes.map((ch) => (ch.content === null
    ? { path: ch.path, mode: '100644', type: 'blob', sha: null }
    : { path: ch.path, mode: '100644', type: 'blob', content: ch.content }));
  const t = await gh(env, '/git/trees', 'POST', { base_tree: repo.treeSha, tree: tree });
  if (!t.ok) throw ghFail(t);
  const c = await gh(env, '/git/commits', 'POST', { message: message, tree: t.data.sha, parents: [repo.commitSha] });
  if (!c.ok) throw ghFail(c);
  const u = await gh(env, '/git/refs/heads/' + BRANCH, 'PATCH', { sha: c.data.sha, force: false });
  if (u.status === 422 || u.status === 409) throw new Fail(409, 'Someone else saved at the same moment. Please tap Save again.', true);
  if (!u.ok) throw ghFail(u);
}

// runs the job; if another save landed first, starts again from the newest state
async function withRepo(env, job) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const repo = await openRepo(env);
      return await job(repo);
    } catch (e) {
      if (e instanceof Fail && e.conflict && attempt === 0) continue;
      throw e;
    }
  }
}

async function loadManifest(env, repo) {
  const text = await readFile(env, repo, MANIFEST);
  if (!text) return { posts: [] };
  try {
    const m = JSON.parse(text);
    if (!m || !Array.isArray(m.posts)) throw new Error('bad');
    return m;
  } catch (e) {
    throw new Fail(500, 'blog/posts.json could not be read. Please ask the site owner to check it.');
  }
}

async function loadTemplate(env, repo) {
  const tpl = await readFile(env, repo, TEMPLATE);
  if (!tpl) throw new Fail(500, 'blog/template.html is missing from the repository.');
  if (tpl.indexOf(MAIN_START) < 0 || tpl.indexOf(MAIN_END) < 0 || tpl.indexOf('{{BODY}}') < 0) {
    throw new Fail(500, 'blog/template.html is not in the expected format.');
  }
  return tpl;
}

/* ---------- posts, order, neighbours ---------- */

const postPath = (slug) => POSTS_DIR + '/' + slug + '.html';
const pageUrl = (slug) => SITE + '/blog/posts/' + slug + '.html';

function ordered(posts) {   // oldest first, drafts left out
  return posts.filter((p) => !p.draft).sort((a, b) =>
    (a.date < b.date ? -1 : a.date > b.date ? 1 : a.slug < b.slug ? -1 : 1));
}

function neighbours(posts, slug) {
  const o = ordered(posts);
  const i = o.findIndex((p) => p.slug === slug);
  if (i < 0) return { prev: null, next: null };
  return { prev: o[i - 1] || null, next: o[i + 1] || null };
}

function humanDate(d) {
  const p = d.split('-').map(Number);
  return MONTHS[p[1] - 1] + ' ' + p[2] + ', ' + p[0];
}

const isoDate = (d) => d + 'T12:00:00+08:00';

function extractBody(html) {
  const a = html.indexOf(BODY_START);
  const b = html.indexOf(BODY_END);
  if (a < 0 || b < a) return null;
  return html.slice(a + BODY_START.length, b);
}

/* ---------- page building ---------- */

function navHtml(kind, p) {
  if (!p) return '';
  const rel = kind === 'prev' ? 'prev' : 'next';
  const label = kind === 'prev' ? 'Previous' : 'Next';
  return '<div class="content__nav-' + rel + '"><a href="' + pageUrl(p.slug) + '" class="content__nav-link" rel="' + rel +
    '"><div><span>' + label + '</span> ' + esc(p.title) + '</div></a></div>';
}

function jsonLd(p) {
  const o = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl(p.slug) },
    headline: p.title,
    datePublished: isoDate(p.date),
    dateModified: p.modified || isoDate(p.date),
    description: p.summary,
    author: { '@type': 'Person', name: p.author },
    publisher: { '@type': 'Organization', name: SITE_NAME }
  };
  if (p.image) o.image = SITE + p.image;
  return '<script type="application/ld+json">' + jsonForScript(o) + '</script>';
}

function renderPost(tpl, p, bodyHtml, nb) {
  const cover = p.image
    ? '<figure class="post__image" style="margin:0 0 1.5rem"><img src="' + esc(p.image) + '" alt="' + esc(p.imageAlt) +
      '" style="max-width:100%;height:auto"></figure>'
    : '';
  return fill(tpl, {
    TITLE: esc(p.title),
    DESCRIPTION: esc(p.summary),
    URL: pageUrl(p.slug),
    OG_TYPE: 'article',
    OG_IMAGE: p.image ? '<meta property="og:image" content="' + SITE + esc(p.image) + '">' : '',
    ROBOTS: p.draft ? '<meta name="robots" content="noindex, nofollow">' : '',
    JSONLD: p.draft ? '' : jsonLd(p),
    BODY_CLASS: 'post-template',
    AUTHOR: esc(p.author),
    DATE_ISO: p.date + 'T12:00',
    DATE_HUMAN: humanDate(p.date),
    COVER: cover,
    BODY: bodyHtml,
    PREV: p.draft ? '' : navHtml('prev', nb.prev),
    NEXT: p.draft ? '' : navHtml('next', nb.next)
  });
}

function renderIndex(tpl, posts) {
  const list = ordered(posts).reverse();   // newest first
  const items = list.map((p) => {
    const url = pageUrl(p.slug);
    const img = p.image
      ? '<a href="' + url + '"><img src="' + esc(p.image) + '" alt="' + esc(p.imageAlt) + '" loading="lazy"></a>'
      : '';
    return '<li class="sjc-item">' + img + '<div><h2><a href="' + url + '">' + esc(p.title) + '</a></h2>' +
      '<p class="sjc-meta">' + esc(humanDate(p.date)) + ' &middot; ' + esc(p.author) + '</p><p>' + esc(p.summary) + '</p></div></li>';
  }).join('');
  const css = '<style>.sjc-list{list-style:none;margin:0;padding:0}.sjc-item{display:flex;gap:1rem;padding:1.25rem 0;' +
    'border-bottom:1px solid rgba(0,0,0,.12)}.sjc-item img{width:140px;height:95px;object-fit:cover;border-radius:6px;flex:none}' +
    '.sjc-item h2{margin:0 0 .25rem;font-size:1.3rem}.sjc-meta{font-size:.9rem;opacity:.7;margin:0 0 .5rem}' +
    '@media(max-width:560px){.sjc-item{flex-direction:column}.sjc-item img{width:100%;height:auto;aspect-ratio:16/9}}</style>';
  const main = '<main class="post"><article class="content"><div class="hero hero--noimage"><header class="hero__content"><div class="wrapper">' +
    '<h1>Blog <sup>(' + list.length + ')</sup></h1></div></header></div><div class="entry-wrapper content__entry">' + css +
    (items ? '<ul class="sjc-list">' + items + '</ul>' : '<p>No posts yet. Please check back soon.</p>') +
    '</div></article></main>';

  const a = tpl.indexOf(MAIN_START);
  const b = tpl.indexOf(MAIN_END);
  const map = {
    TITLE: 'Blog', DESCRIPTION: esc(INDEX_DESCRIPTION), URL: SITE + '/blog/index.html', OG_TYPE: 'website',
    OG_IMAGE: '', ROBOTS: '', JSONLD: '', BODY_CLASS: 'blog-index-template'
  };
  return fill(tpl.slice(0, a), map) + main + fill(tpl.slice(b + MAIN_END.length), map);
}

function renderSitemap(posts) {
  const list = ordered(posts).reverse();
  const newest = list.length ? list.map((p) => (p.modified || '').slice(0, 10) || p.date).sort().pop() : '';
  const urls = ['<url><loc>' + SITE + '/blog/index.html</loc>' + (newest ? '<lastmod>' + newest + '</lastmod>' : '') + '</url>']
    .concat(list.map((p) => '<url><loc>' + esc(pageUrl(p.slug)) + '</loc><lastmod>' +
      ((p.modified || '').slice(0, 10) || p.date) + '</lastmod></url>'));
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join('\n') + '\n</urlset>\n';
}

const manifestText = (posts) => JSON.stringify({ posts: posts }, null, 1) + '\n';

// pages for the given post names, using the current list for their prev/next links
async function renderPosts(env, repo, tpl, posts, slugs, skip) {
  const out = await Promise.all(slugs.filter((s) => s !== skip).map(async (s) => {
    const e = posts.find((p) => p.slug === s);
    if (!e) return null;
    const html = await readFile(env, repo, postPath(s));
    if (!html) return null;
    const body = extractBody(html);
    if (body === null) return null;
    return { path: postPath(s), content: renderPost(tpl, e, body, neighbours(posts, s)) };
  }));
  return out.filter(Boolean);
}

/* ---------- checks on what the editor sends ---------- */

const BAD_HTML = /<\s*(script|iframe|object|embed|style|link|meta|form|base|svg|math|input|button|textarea|select)\b|<!--|\son[a-z]+\s*=|(?:href|src|xlink:href|action|formaction)\s*=\s*["']?\s*(?:javascript|vbscript|data)\s*:|\{\{/i;

function checkMeta(m) {
  if (!m || typeof m !== 'object') throw new Fail(400, 'Missing post details.');
  const title = typeof m.title === 'string' ? m.title.replace(/\s+/g, ' ').trim() : '';
  const author = typeof m.author === 'string' ? m.author.replace(/\s+/g, ' ').trim() : '';
  const summary = typeof m.summary === 'string' ? m.summary.replace(/\s+/g, ' ').trim() : '';
  const date = typeof m.date === 'string' ? m.date : '';
  const image = typeof m.image === 'string' ? m.image : '';
  const imageAlt = typeof m.imageAlt === 'string' ? m.imageAlt.replace(/\s+/g, ' ').trim() : '';
  if (!title || title.length > 120) throw new Fail(400, 'The title needs 1 to 120 characters.');
  if (!author || author.length > 60) throw new Fail(400, 'The author name needs 1 to 60 characters.');
  if (summary.length < 20 || summary.length > 300) throw new Fail(400, 'The short description needs 20 to 300 characters.');
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const d = dm ? new Date(Date.UTC(+dm[1], +dm[2] - 1, +dm[3])) : null;
  if (!d || isNaN(d.getTime()) || d.getUTCMonth() !== +dm[2] - 1 || d.getUTCDate() !== +dm[3]) throw new Fail(400, 'The date is not valid.');
  if (image && !/^\/blog\/images\/[A-Za-z0-9._-]{1,120}$/.test(image)) throw new Fail(400, 'The cover photo is not valid.');
  if (image && (!imageAlt || imageAlt.length > 150)) throw new Fail(400, 'Please describe the cover photo in a few words.');
  return { title: title, author: author, summary: summary, date: date, image: image, imageAlt: image ? imageAlt : '', draft: m.draft === true };
}

function checkBody(body) {
  if (typeof body !== 'string' || !body.trim()) throw new Fail(400, 'The post is empty.');
  if (body.length > MAX_BODY_CHARS) throw new Fail(400, 'The post is too long.');
  if (BAD_HTML.test(body)) throw new Fail(400, 'The post contains something that is not allowed (scripts, forms or similar).');
  return body;
}

/* ---------- the Worker ---------- */

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = corsHeaders(origin);
    const send = (status, obj) => new Response(JSON.stringify(obj), { status: status, headers: headers });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers });
    if (request.method !== 'POST') return send(405, { error: 'POST only' });
    if (ALLOWED_ORIGINS.indexOf(origin) < 0) return send(403, { error: 'This page is not allowed to use the blog server.' });

    try {
      if (!(env.GITHUB_TOKEN || env.GITHUB_PAT) || !env.GOOGLE_CLIENT_ID || !env.ALLOWED_EMAILS) {
        return send(500, { error: 'The blog server is not set up yet.' });
      }

      let body = null;
      try { body = await request.json(); } catch (e) { body = null; }
      if (!body || typeof body !== 'object') return send(400, { error: 'Bad request' });

      const who = await verifyGoogle(body.idToken, env);
      if (who.error === 'signin') return send(401, { error: 'Please sign in again.' });
      if (who.error === 'forbidden') return send(403, { error: 'This Google account is not on the approved list.' });

      const action = body.action;

      if (action === 'list') {
        const repo = await openRepo(env);
        const m = await loadManifest(env, repo);
        const posts = m.posts.map((p) => ({ slug: p.slug, title: p.title, date: p.date, draft: !!p.draft }))
          .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
        return send(200, { posts: posts });
      }

      if (action === 'get') {
        if (!SLUG.test(body.slug || '')) return send(400, { error: 'Bad post name' });
        const repo = await openRepo(env);
        const m = await loadManifest(env, repo);
        const e = m.posts.find((p) => p.slug === body.slug);
        if (!e) return send(404, { error: 'That post was not found.' });
        const html = await readFile(env, repo, postPath(body.slug));
        const b = html ? extractBody(html) : null;
        if (b === null) return send(404, { error: 'That post page was not found.' });
        return send(200, {
          meta: { title: e.title, date: e.date, author: e.author, summary: e.summary, image: e.image || '', imageAlt: e.imageAlt || '', draft: !!e.draft },
          body: b
        });
      }

      if (action === 'save') {
        if (!SLUG.test(body.slug || '')) return send(400, { error: 'Bad post name' });
        const slug = body.slug;
        const meta = checkMeta(body.meta);
        const html = checkBody(body.body);
        const isNew = body.isNew === true;

        await withRepo(env, async (repo) => {
          const [manifest, tpl] = await Promise.all([loadManifest(env, repo), loadTemplate(env, repo)]);
          const old = manifest.posts;
          const exists = old.some((p) => p.slug === slug);
          if (isNew && exists) throw new Fail(409, 'A post with this name already exists. Change the title or date and try again.');
          if (!isNew && !exists) throw new Fail(404, 'That post no longer exists.');

          const entry = Object.assign({ slug: slug }, meta, { modified: new Date().toISOString() });
          const posts = old.filter((p) => p.slug !== slug).concat(entry);
          const before = exists ? neighbours(old, slug) : { prev: null, next: null };
          const after = neighbours(posts, slug);
          const others = Array.from(new Set([before.prev, before.next, after.prev, after.next].filter(Boolean).map((p) => p.slug)));

          const files = [{ path: postPath(slug), content: renderPost(tpl, entry, html, after) }]
            .concat(await renderPosts(env, repo, tpl, posts, others, slug));
          files.push({ path: INDEX_PATH, content: renderIndex(tpl, posts) });
          files.push({ path: SITEMAP_PATH, content: renderSitemap(posts) });
          files.push({ path: MANIFEST, content: manifestText(posts) });
          await commitChanges(env, repo, files, 'Blog: ' + meta.title + ' (saved by ' + who.email + ')');
        });
        return send(200, { ok: true });
      }

      if (action === 'delete') {
        if (!SLUG.test(body.slug || '')) return send(400, { error: 'Bad post name' });
        const slug = body.slug;
        await withRepo(env, async (repo) => {
          const [manifest, tpl] = await Promise.all([loadManifest(env, repo), loadTemplate(env, repo)]);
          const old = manifest.posts;
          const e = old.find((p) => p.slug === slug);
          if (!e) throw new Fail(404, 'That post was not found.');
          const posts = old.filter((p) => p.slug !== slug);
          const before = neighbours(old, slug);
          const others = [before.prev, before.next].filter(Boolean).map((p) => p.slug);

          const files = await renderPosts(env, repo, tpl, posts, others, null);
          if (await readFile(env, repo, postPath(slug))) files.push({ path: postPath(slug), content: null });
          files.push({ path: INDEX_PATH, content: renderIndex(tpl, posts) });
          files.push({ path: SITEMAP_PATH, content: renderSitemap(posts) });
          files.push({ path: MANIFEST, content: manifestText(posts) });
          await commitChanges(env, repo, files, 'Blog: delete ' + e.title + ' (by ' + who.email + ')');
        });
        return send(200, { ok: true });
      }

      if (action === 'rebuild') {
        // Rebuilds every page from blog/template.html, a few posts at a time.
        const offset = Math.max(0, parseInt(body.offset, 10) || 0);
        let result = null;
        await withRepo(env, async (repo) => {
          const [manifest, tpl] = await Promise.all([loadManifest(env, repo), loadTemplate(env, repo)]);
          const posts = manifest.posts;
          const slugs = posts.map((p) => p.slug).sort();
          const batch = slugs.slice(offset, offset + REBUILD_BATCH);
          const files = await renderPosts(env, repo, tpl, posts, batch, null);
          if (offset === 0) {
            files.push({ path: INDEX_PATH, content: renderIndex(tpl, posts) });
            files.push({ path: SITEMAP_PATH, content: renderSitemap(posts) });
          }
          if (files.length) await commitChanges(env, repo, files, 'Blog: rebuild pages (by ' + who.email + ')');
          result = { done: offset + REBUILD_BATCH >= slugs.length, next: offset + REBUILD_BATCH, total: slugs.length };
        });
        return send(200, result);
      }

      if (action === 'upload') {
        const base = String(body.filename || 'photo.jpg').toLowerCase()
          .replace(/[^a-z0-9._-]/g, '-').replace(/-+/g, '-').slice(-60);
        if (!/\.(jpg|jpeg|png|webp|gif)$/.test(base)) return send(400, { error: 'Only photos (jpg, png, webp, gif) can be uploaded.' });
        const b64 = String(body.data || '').replace(/\s+/g, '');
        if (!b64 || b64.length > MAX_IMAGE_B64 || !/^[A-Za-z0-9+/=]+$/.test(b64)) {
          return send(400, { error: 'That photo is too large or not valid.' });
        }
        if (!imageSignatureOk(b64)) return send(400, { error: 'That file does not look like a photo.' });
        const name = Date.now() + '-' + base.replace(/^[-.]+/, '');
        const g = await gh(env, '/contents/blog/images/' + name, 'PUT', {
          message: 'Blog photo: ' + name + ' (by ' + who.email + ')',
          content: b64,
          branch: BRANCH
        });
        if (!g.ok) throw ghFail(g);
        return send(200, { path: '/blog/images/' + name });
      }

      return send(400, { error: 'Unknown action' });
    } catch (e) {
      if (e instanceof Fail) return send(e.status, { error: e.message });
      console.error('blog-admin error:', e);
      return send(500, { error: 'Something went wrong on the server.' });
    }
  }
};