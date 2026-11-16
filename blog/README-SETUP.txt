ROLLAWORD BLOG ADMIN — SETUP GUIDE

This is a starter package. It is NOT ready to publish until configured.

FILES
- admin.html: publishing console at /blog/admin.html
- js/admin.js: Google sign-in and editor/publish actions
- js/admin-config.js: public Google Client ID and Worker URL only
- css/admin.css: console styling
- cloudflare-worker/worker.js: secure API that verifies Google ID tokens and writes to GitHub

1) COPY FRONT-END FILES
Copy admin.html, css/admin.css and js/ into your existing /blog/ folder.
Keep the existing markdown-pages.js, README.md, header.md, footer.md and pages/.

2) ADD MARKERS TO EXISTING blog/README.md
Put these exact markers immediately around the current article links:
<!-- BLOG_POSTS_START -->
- [Learning to Sail: A Beginner's First Steps](?page=learning-to-sail)
- [What's New at RollaWord](?page=rollaword-news)
<!-- BLOG_POSTS_END -->
Do not replace the rest of README.md. The Worker updates only the text between markers.

3) GOOGLE WEB CLIENT ID
In Google Cloud Console, create an OAuth Client ID of type Web application.
Add this Authorized JavaScript origin: https://www.rollaword.com
Copy the Client ID. Use the same value in admin-config.js and Worker variable GOOGLE_CLIENT_ID.

4) CLOUDFLARE WORKER
In Cloudflare > Workers & Pages, create a Worker. Paste cloudflare-worker/worker.js into its editor and deploy.
Add these TEXT variables in Worker Settings:
GOOGLE_CLIENT_ID = your Google Web Client ID
GITHUB_OWNER = GitHub account/organization owning the site repository
GITHUB_REPO = exact repository name
GITHUB_BRANCH = live publishing branch (usually main)
BLOG_README_PATH = blog/README.md
BLOG_PAGES_PATH = blog/pages
ALLOWED_ORIGIN = https://www.rollaword.com
ALLOWED_EMAILS = first@gmail.com,second@gmail.com,third@gmail.com
Replace those sample emails with the exact three authorized addresses.
Add a SECRET named GITHUB_TOKEN.

Create a GitHub fine-grained personal access token restricted to ONLY the RollaWord repository, with Repository permission Contents: Read and write. Store it as the Cloudflare Worker secret GITHUB_TOKEN. Never put it in a public file or browser code. Redeploy after setting variables/secrets.

5) CONNECT admin-config.js
Set:
window.ROLLA_BLOG_ADMIN_CONFIG = {
  googleClientId: "YOUR_GOOGLE_WEB_CLIENT_ID",
  apiBaseUrl: "https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev"
};

6) TEST
Open https://www.rollaword.com/blog/admin.html
Sign in with an allowlisted Google account.
Load the existing article slug rollaword-news.
Make a small edit and publish. Check the GitHub commit and public article.
Test a Google account not on the allowlist; it must be rejected.
Then test from the Android tablet.

LIMITS IN THIS FIRST VERSION
- GitHub token stays in Cloudflare, never in the browser.
- Google ID token signature, issuer, audience, expiry, verified-email claim and allowlist are checked server-side.
- Creates/updates Markdown and refreshes the homepage article list.
- Traven image uploading is not wired up yet; use public image URLs for now.
- The current public renderer continues to use ?page=slug URLs; this does not create static HTML article pages.
- Try a harmless test article before normal publishing.

OFFICIAL DOCUMENTATION
Traven: https://traven.dev/docs/
Google ID token verification: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
Cloudflare Worker secrets: https://developers.cloudflare.com/workers/configuration/secrets/
GitHub Contents API: https://docs.github.com/en/rest/repos/contents
