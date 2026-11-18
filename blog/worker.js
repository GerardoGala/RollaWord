/*
  Cloudflare Worker for the San Juan Coastline blog admin.
  This file is NOT put in your GitHub repo. You paste it into the Cloudflare dashboard,
  so the settings below are never public.

  Checks the visitor's Google sign-in, checks their email is on the approved list, then
  reads/writes ONLY blog/posts/*.md and blog/images/* in your GitHub repo.

  The GitHub token is stored as a Cloudflare SECRET named GITHUB_TOKEN (not in this file).
*/

/* Settings are read from the Worker's Variables and Secrets:
     GOOGLE_CLIENT_ID  your Google OAuth client ID
     ALLOWED_EMAILS    approved Gmail addresses, separated by commas or semicolons
     GITHUB_PAT        (Secret) fine-grained token, this repo only, Contents read and write
                       (the name GITHUB_TOKEN also works)
*/
const REPO = 'GerardoGala/RollaWord';
const BRANCH = 'main';
const ALLOWED_ORIGINS = ['https://www.rollaword.com', 'https://rollaword.com'];

const API = 'https://api.github.com/repos/' + REPO + '/contents/';
const SLUG = /^[A-Za-z0-9_-]{1,150}$/;
const MAX_POST_CHARS = 300 * 1024;
const MAX_IMAGE_B64 = 3 * 1024 * 1024;

function corsHeaders(origin) {
  const h = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Vary': 'Origin'
  };
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
  for (let i = 0; i < bytes.length; i += 8192) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  }
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

async function gh(env, path, method, payload) {
  method = method || 'GET';
  const url = API + path + (method === 'GET' ? '?ref=' + encodeURIComponent(BRANCH) : '');
  const r = await fetch(url, {
    method: method,
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

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = corsHeaders(origin);
    const send = (status, obj) => new Response(JSON.stringify(obj), { status: status, headers: headers });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers });
    if (request.method !== 'POST') return send(405, { error: 'POST only' });
    if (ALLOWED_ORIGINS.indexOf(origin) < 0) return send(403, { error: 'This page is not allowed to use the blog server.' });

    const githubFail = (g) => {
      if (g.status === 409 || g.status === 422) {
        return send(409, { error: 'That post already exists or was changed by someone else. Reload the list and try again.' });
      }
      if (g.status === 401 || g.status === 403) {
        return send(500, { error: 'The server could not write to GitHub. The GitHub token may have expired.' });
      }
      return send(502, { error: 'GitHub said: ' + ((g.data && g.data.message) || g.status) });
    };

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
        const d = await gh(env, 'blog/posts');
        if (d.status === 404) return send(200, { posts: [] });
        if (!d.ok) return githubFail(d);
        const files = (Array.isArray(d.data) ? d.data : []).filter((f) => f.type === 'file' && /^[A-Za-z0-9_-]+\.md$/.test(f.name));
        const posts = await Promise.all(files.map(async (f) => {
          const g = await gh(env, 'blog/posts/' + f.name);
          if (!g.ok) return null;
          const text = base64ToUtf8(g.data.content);
          const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
          return { slug: f.name.replace(/\.md$/, ''), sha: g.data.sha, head: m ? m[1] : '' };
        }));
        return send(200, { posts: posts.filter(Boolean) });
      }

      if (action === 'get') {
        if (!SLUG.test(body.slug || '')) return send(400, { error: 'Bad post name' });
        const g = await gh(env, 'blog/posts/' + body.slug + '.md');
        if (g.status === 404) return send(404, { error: 'That post was not found.' });
        if (!g.ok) return githubFail(g);
        return send(200, { content: base64ToUtf8(g.data.content), sha: g.data.sha });
      }

      if (action === 'save') {
        if (!SLUG.test(body.slug || '')) return send(400, { error: 'Bad post name' });
        const content = body.content;
        if (typeof content !== 'string' || content.indexOf('---') !== 0 || content.length > MAX_POST_CHARS) {
          return send(400, { error: 'The post is not in the expected format or is too long.' });
        }
        const payload = {
          message: 'Blog: ' + body.slug + ' (saved by ' + who.email + ')',
          content: utf8ToBase64(content),
          branch: BRANCH
        };
        if (typeof body.sha === 'string' && /^[0-9a-f]{40}$/.test(body.sha)) payload.sha = body.sha;
        const g = await gh(env, 'blog/posts/' + body.slug + '.md', 'PUT', payload);
        if (!g.ok) return githubFail(g);
        return send(200, { sha: g.data.content.sha });
      }

      if (action === 'delete') {
        if (!SLUG.test(body.slug || '') || !/^[0-9a-f]{40}$/.test(body.sha || '')) {
          return send(400, { error: 'Bad request' });
        }
        const g = await gh(env, 'blog/posts/' + body.slug + '.md', 'DELETE', {
          message: 'Blog: delete ' + body.slug + ' (by ' + who.email + ')',
          sha: body.sha,
          branch: BRANCH
        });
        if (!g.ok) return githubFail(g);
        return send(200, { ok: true });
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
        const g = await gh(env, 'blog/images/' + name, 'PUT', {
          message: 'Blog photo: ' + name + ' (by ' + who.email + ')',
          content: b64,
          branch: BRANCH
        });
        if (!g.ok) return githubFail(g);
        return send(200, { path: '/blog/images/' + name });
      }

      return send(400, { error: 'Unknown action' });
    } catch (e) {
      console.error('blog-admin error:', e);
      return send(500, { error: 'Something went wrong on the server.' });
    }
  }
};