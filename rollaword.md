# rollaword.com: how it works

*Last updated 2026-11-21*

This document has two parts, plus a short section on Google Analytics, which covers the whole site.

- **Part 1: The games.** RollaWord, RollaSail, their leaderboard, and the leaderboard admin page (`firebaseadmin.html`).
- **Part 2: The blog.** The San Juan Coastline blog, the Cloudflare Worker behind its editor, and Google Analytics.

Both live on one website and in one GitHub repository, but they work differently, so each has its own section.

**One rule for both:** a file you edit in VSCodium only reaches the live site after you commit and push it in GitHub Desktop. (Blog posts written in the blog editor are committed by the Worker instead; see Part 2.)

---

# Google Analytics (whole site)

*Added 2026-11-21. **Confirmed working on 2026-11-21:** Realtime showed 4 active users while three people were playing the games on the live site.*

**The report to use:** the Analytics property named **rollaword** (property ID 565269591).

**Live report (Realtime). Bookmark this:**

`https://analytics.google.com/analytics/web/#/a183877144p565269591/realtime/pages`

If Analytics opens a different property, click the property name at the top left and choose **rollaword**.

**Do not use** the property named **rollaword.com** (ID 565324386). It has no data streams, so it receives nothing. Do not click "Go to stream setup" there: that would create another stream and another tag ID.

**The tag:** `GTM-5XJ53P8H`. It is one tag on every tracked page, and all of it reports into the **rollaword** property.

**What is tracked**

- The Publii pages: through Publii's Custom HTML > Head box.
- The blog: through `blog/template.html` and two hand-edited pages (details in 2.6).
- The games and the other hand-built pages: on 2026-11-21 `add-analytics.html` was run on the rollaword folder and updated 91 files.
- Not tracked on purpose: `blog/admin.html`. The 91-file run had no skip list, so check whether `firebaseadmin.html` got the snippet. If you do not want your own admin visits counted, delete its two Google tag script blocks.

**Reading the reports**

- **Realtime is the live check.** A visit shows up within about a minute.
- **Home and the Reports section lag 24 to 48 hours.** Zeros there on the first day are normal. On 2026-11-21 Home showed zeros while Realtime was showing 4 active users.
- Later, Reports > Engagement > Pages and screens lists each page by its path (for example `/sail.html`), which tells you which games are played most.

**If Realtime shows zero while people are on the site**

1. View source on the **live** address (not 127.0.0.1) and search for `GTM-5XJ53P8H`. If it is missing, the changes have not been committed, pushed and deployed yet.
2. Make sure the property open at the top left is **rollaword**.
3. Test in a private window, or on a phone using mobile data. Ad blockers and privacy extensions stop the tag.

**New pages:** a new hand-built page needs the snippet in its `<head>`, right after the AdSense line (the snippet is in 2.6). Running `add-analytics.html` on the folder does it for every page and skips pages that already have it.

---

# Part 1: The games

## 1.1 What is where

| What | Address |
|---|---|
| RollaWord | rollaword.com/rollaword/index.html |
| RollaSail | rollaword.com/sail.html |
| Leaderboard (public) | rollaword.com/leaderboard.html |
| Leaderboard admin (private, you only) | https://www.rollaword.com/firebaseadmin.html |

`firebaseadmin.html` and its script `admin.js` sit together in the site's main folder. This `admin.js` is not the same file as the blog's `blog/admin.js` in Part 2.

## 1.2 The leaderboard

- **Where scores are stored:** Firebase Firestore, in the collection `rollaword_leaderboard`. Each record has three fields: `name`, `date` (the puzzle date, written YYYYMMDD, for example 20261121) and `score`.
- **How a score gets in:** at the end of a **Daily Challenge** game, the game asks the player for a name and saves the score, but only if it makes the Top 10 for that puzzle date. Free Play scores are not saved. The saving code is `processChallengeEndgame`.
- **How it is shown:** `leaderboard.html` and the game's end-of-game popup read the same collection and list the best scores for a puzzle date. Each browser has an anonymous player ID (kept in localStorage), so duplicate names get a short tag and a player's own row shows "(you)".
- **RollaSail** has its own, separate leaderboard and word list.

Anyone can read the scores, and the game itself can add them. Fixing or removing records is what the admin page is for.

## 1.3 firebaseadmin.html: the leaderboard admin page

**What it is.** A private page for managing leaderboard records: fix a misspelled name, correct a score, add a record, or delete a rude or fake entry. It reads and writes the same Firestore collection the game uses, so a change you make there shows up on the leaderboard the next time the leaderboard loads.

**How to run it.**

1. Open **https://www.rollaword.com/firebaseadmin.html** in Chrome or Edge.
2. Click **Sign in with Google** and choose your own Google account.
3. The record form appears above the table. The table lists every record with its ID, date, name and score.

Before you sign in, the table already shows the scores, because anyone can read them. The edit tools stay hidden and the Actions column stays empty until you sign in.

**Working with records (after signing in).**

- **Create:** fill in the form and click **Save Record**. The name is up to 20 characters, the score is a number from 0 to 1,000,000, and the date is 8 digits, YYYYMMDD.
- **Edit:** click the edit link on a row, change the form, and click **Save Record**. **Cancel** backs out.
- **Delete:** click the delete link on a row.

**Does it have to run on the live site?** It does not need a server program, because it is an ordinary page that runs in the browser and talks to Firebase directly. It works on the live site because Firebase approves that domain for Google sign-in (see 1.4). Testing on your own computer also works as long as the address is on the same approved list.

## 1.4 If sign-in fails

The message `auth/unauthorized-domain` means Firebase refused Google sign-in from the address in the browser. Firebase only allows sign-in from domains on an approved list.

- **Live site:** `rollaword.com` and `www.rollaword.com` must be on the list.
- **On your computer:** `localhost` is on the list by default. `127.0.0.1` is not, and 127.0.0.1 is the address VSCodium's Live Server shows. Either open `http://localhost:5500/firebaseadmin.html` instead, or add `127.0.0.1` to the list.
- **To change the list:** Firebase console > **Authentication** > **Settings** > **Authorized domains** > **Add domain**.
- Do not open the page by double-clicking the file (a `file:///` address). Sign-in needs a real web address.

## 1.5 Security: what actually protects the leaderboard

The edit form is hidden until you sign in, but hiding it is only cosmetic. Someone could reveal it with the browser's developer tools. The real protection is the **Firestore security rules** in the Firebase console (Firestore Database > Rules).

The intended setup:

- **Anyone can read** the leaderboard.
- **Anyone can create** a record, because the game saves players' scores without a sign-in.
- **Only your Google account can update or delete** records.

If the rules are in "test mode" or say that everyone may read and write, anyone could wipe the leaderboard. Check them from time to time. Test-mode rules also expire after 30 days.

The Firebase config in the page (including its `apiKey`) is public by design and is not a secret. The page must never contain a service account key (`serviceAccount`, `private_key`) or use `firebase-admin`; those give full control of the Firebase project and belong only on a private server.

## 1.6 Loose ends to check (as of 2026-11-21)

- Confirm the Firestore rules match 1.5.
- `firebaseadmin.html` still has the AdSense line in its head and has no `noindex` tag. It has no content for readers, so the AdSense line can go, and `<meta name="robots" content="noindex, nofollow">` can be added.
- Confirm which collection `admin.js` edits. The RollaSail leaderboard is separate.

---

# Part 2: The blog (San Juan Coastline)

This is the Cloudflare Worker behind `blog/admin.html`. In this part, `admin.js` means `blog/admin.js`, not the leaderboard's `admin.js` from Part 1.

## 2.1 What the Worker is

`worker.js` is a small program that runs on Cloudflare (Worker name: `rollaword-auth`). It is NOT stored in the GitHub repo. To change it: Cloudflare dashboard > the Worker > Edit code > paste the new `worker.js` > Deploy.

The admin page (`blog/admin.html` + `admin.js`) never talks to GitHub. It only talks to this Worker. (You can still change the repository yourself any time with GitHub Desktop. The Worker is how the family's posts get in without them needing GitHub.)

## 2.2 The three things it does

**1. Checks who is signing in**

- Every request from the admin page carries the person's Google sign-in.
- The Worker asks Google to confirm it is genuine, then checks that the Gmail address is on the approved list (`ALLOWED_EMAILS`).
- Anyone else is refused. Nothing is read or saved for them.

**2. Saves the family's posts to GitHub for them**

- The family (and the admin page) have no GitHub access at all. When they save a post, the Worker writes it to the repository on their behalf.
- The Worker holds the GitHub token (`GITHUB_PAT`). The family's browsers never see it, so the only ways into the repository are: you, with GitHub Desktop, and this Worker, which acts only for people on the approved list.
- It only writes inside the blog folder.
- It saves everything for one action in ONE commit, so the site deploys once.
- If two people save at the same moment, it starts again from the newest version, so one save can never overwrite a newer one.

**3. Builds the pages**

When a post is saved, the Worker creates the finished HTML from `blog/template.html`:

- `blog/posts/<name>.html`: the post page (with its Coastline / Farmland chip)
- the Previous / Next links on the neighbouring posts
- `blog/index.html`: the blog list, with the post count
- `blog/sitemap.xml`: the blog sitemap
- `blog/posts.json`: the list of posts (what the editor reads)

It only writes the markup (the page structure and text). It does NOT contain any styling or filter script (see 2.3).

## 2.3 What it does not do any more: look and filter

- `blog/blog.css`: how the post list and the Coastline / Farmland chips look
- `blog/filter.js`: how the Section filter on the index behaves

These are ordinary files in the repo. Edit them in VSCodium, preview with Live Server, commit and push in GitHub Desktop. No Cloudflare change and no Rebuild is needed. The Worker only adds two lines to the pages that link to them.

## 2.4 What the admin page can ask the Worker to do

| Request | What it does |
|---|---|
| list | the posts for the admin list (title, date, draft, sections) |
| get | one post, to open it in the editor |
| save | create or update a post (does job 3, in one commit) |
| delete | remove a post and rebuild the neighbours, index and sitemap |
| rebuild | rewrite every page from `blog/template.html` (25 posts at a time) |
| upload | store a photo in `blog/images/` |

## 2.5 Sections (tags)

- There are exactly two: `coastline` and `farmland`. A post has one or both.
- A post with no section saved yet counts as coastline.
- The editor will not save a post with neither selected.
- Sections are stored in `blog/posts.json` and shown as a chip on each post page and as a label in the index list.

## 2.6 Google Analytics (tag ID: GTM-5XJ53P8H)

*Added 2026-11-21.*

The site-wide summary (which report to use, and the confirmed live check) is in the Google Analytics section near the top of this document. This section covers how the blog is wired up.

**What it is.** Google Analytics counts visitors, page views, countries, devices and where people came from. The tag ID is `GTM-5XJ53P8H`. Google generated it for the Analytics data stream.

**The report to use:** the Analytics property named **rollaword** (property ID 565269591). Do NOT use the property named "rollaword.com" (property ID 565324386). It was created by accident, receives nothing, and can be ignored (or moved to the Trash Can some day under Admin > Property settings).

**URL of the live report** (Realtime, rollaword property):

`https://analytics.google.com/analytics/web/#/a183877144p565269591/realtime/pages`

Bookmark it. If Analytics opens a different property, click the property name at the top left and choose "rollaword" (not "rollaword.com"). For the full reports, use the left menu on the same page: Reports > Reports snapshot (they take 24 to 48 hours to fill in).

**The snippet.** It goes inside `<head>`, straight after the AdSense line:

```html
<script async src="https://www.googletagmanager.com/gtm.js?id=GTM-5XJ53P8H"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());</script>
```

**Where it lives**

| File | Notes |
|---|---|
| `blog/template.html` | After the AdSense line in `<head>`. This covers every post. The Worker reads this file when it builds pages, so `worker.js` was NOT changed and nothing needs pasting into Cloudflare. After editing the template, press **Rebuild all pages** in `blog/admin.html` and the snippet reaches every existing post. |
| `blog/index.html` | Built by the Worker. The snippet is in the copy that was added by hand. After a Rebuild, check View page source for `GTM-5XJ53P8H`. If it has disappeared, the index head built by `worker.js` needs the snippet too. |
| `blog/post.html` | A hand-written page (loads posts in the browser). The snippet was added by hand, after the AdSense line. Edit it in VSCodium, commit and push. |
| `blog/admin.html` | Deliberately NOT tracked. It is a private editing page (noindex), and tracking it would count the family's editing as visitors. |
| The rest of rollaword.com (the Publii pages) | Publii > Tools & Plugins > Custom HTML > Head. Publii adds it to every page it makes. Re-render and sync (or commit and push) to publish. |

**Backfilling old posts** (only if Rebuild all pages does not do it). `add-analytics.html` is a one-time browser tool. It adds the snippet after `<head>` in every `.html` file in a folder you choose, and skips files that already have it.

- Run it on your own computer, after pulling the latest posts in GitHub Desktop.
- Do NOT run it through Live Server: Live Server reloads the page on the first file change and stops the run part way. Open it from disk (double-click), or add `"liveServer.settings.ignoreFiles": ["blog/posts/**"]` to the VSCodium settings.
- Do a dry run first, then untick Dry run and run it again.
- Keep the tool out of the project folder you push, so it does not end up on the live site.

**How to check it is working**

1. Open a live page, choose View page source, and search for `GTM-5XJ53P8H`.
2. Keep the page open, then look at Analytics > Reports > Realtime. A visit shows up within about a minute.
3. Ad blockers and privacy extensions stop the tag. Test in a private window or on a phone using mobile data.

Visits from Live Server previews may also be counted.

## 2.7 Settings on Cloudflare

Worker > Settings > Variables and Secrets:

| Setting | What it is |
|---|---|
| `GOOGLE_CLIENT_ID` | your Google OAuth client ID |
| `ALLOWED_EMAILS` | approved Gmail addresses, separated by commas or semicolons |
| `GITHUB_PAT` | (Secret) fine-grained token, this repo only, Contents: read and write |

Only these addresses may use the Worker: https://rollaword.com and https://www.rollaword.com

## 2.8 What to change, and where

| I want to change... | Edit | Then |
|---|---|---|
| how the chips / list look | `blog/blog.css` | commit + push |
| how the Section filter behaves | `blog/filter.js` | commit + push |
| the page frame (menu, header, footer, AdSense, Google Analytics) | `blog/template.html` | commit + push, then press Rebuild all pages |
| Google Analytics on the single-post page | `blog/post.html` | commit + push |
| the editor screen | `blog/admin.html`, `admin.js`, `admin.css` | commit + push |
| what the pages contain / how they are built, the sign-in list rules, the sections | `worker.js` (on Cloudflare) | paste into Cloudflare, deploy, then press Rebuild all pages |
| who may sign in | `ALLOWED_EMAILS` | save in Cloudflare |

## 2.9 Good to know

- Never edit `blog/index.html`, `blog/posts.json` or `blog/sitemap.xml` by hand: the Worker rewrites them on every save and your change would be lost.
- GitHub Desktop often says "pull first". That is normal: the Worker makes a commit every time a post is saved, so the server is usually ahead of your computer.
- A file only reaches the site after you save it in the editor, commit it, AND push it.
- The Google Analytics tag lives in `blog/template.html`. Do not remove it when editing the template, or new and rebuilt posts stop being counted.
