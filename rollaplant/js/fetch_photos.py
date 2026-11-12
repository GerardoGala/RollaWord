#!/usr/bin/env python3
"""
RollAnimal photo fetcher.  Run it ON YOUR COMPUTER, from the rollanimal folder:

    python3 fetch_photos.py --limit 5        # try the first 5 animals
    python3 fetch_photos.py                  # then do the whole list

It needs only Python 3 (nothing to install) and an internet connection.

For every animal in js/animal-data.csv it
  1. finds the animal's Wikipedia article and takes its main photo,
  2. checks the photo's licence on Wikimedia Commons and keeps it only if it is
     CC0, public domain, or CC BY (attribution only). CC BY-SA is skipped unless you add --allow-sa,
  3. saves a 640-pixel-wide copy as img/a001.jpg, a002.jpg ... (the number is the row in the CSV,
     the same number the Clue button sends as ?r=, so the file name never gives the answer away),
  4. fills the Image and Credit columns of js/animal-data.csv (the old file is kept as animal-data.csv.bak).

It also writes
  review.html   look at this in your browser and check every photo before you publish
  credits.html  the public photo-credits page (clue.html links to it)

Animals that fail (no photo, wrong licence, ambiguous name) are listed at the end. Fix one with
    python3 fetch_photos.py --only "Seal" --override "Seal=File:Harbour_seal.jpg"
where File:... is the name of any photo you picked on commons.wikimedia.org (check its licence first!).
To replace a photo you did not like, add --redo.  Safe to run again: finished animals are skipped.
"""
import argparse, csv, html, json, os, re, shutil, sys, time
import urllib.error, urllib.parse, urllib.request

UA = "RollAnimalPhotoFetcher/1.0 (https://www.rollaword.com; educational word game)"
WIDTH = 640
PAUSE = 0.4                      # seconds between requests, to be polite to Wikimedia

# Wikipedia article to use when the plain animal name is ambiguous or has a poor lead photo.
TITLES = {
    "Panda": "Giant panda", "Grizzly": "Grizzly bear", "Seal": "Harbor seal", "Crane": "Crane (bird)",
    "Turkey": "Wild turkey", "Cricket": "Cricket (insect)", "Mole": "Mole (animal)", "Robin": "European robin",
    "Python": "Pythonidae", "Mamba": "Black mamba", "Seagull": "Gull", "Dove": "Mourning dove",
    "Condor": "Andean condor", "Magpie": "Eurasian magpie", "Swallow": "Barn swallow",
    "Ladybug": "Coccinella septempunctata", "Honeybee": "Western honey bee", "Carabao": "Water buffalo",
    "Bangus": "Milkfish", "Great White": "Great white shark", "Hammerhead": "Hammerhead shark",
    "Beluga": "Beluga whale", "Bullfrog": "American bullfrog", "Basilisk": "Basiliscus",
    "Sunfish": "Ocean sunfish", "Nautilus": "Chambered nautilus", "Tree Frog": "Red-eyed tree frog",
    "Raven": "Common raven", "Eagle": "Bald eagle", "Opossum": "Virginia opossum", "Rabbit": "European rabbit",
    "Alligator": "American alligator", "Anaconda": "Green anaconda", "Cobra": "Indian cobra",
    "Viper": "Viperidae", "Iguana": "Green iguana", "Flying Fish": "Exocoetidae", "Stick Insect": "Phasmatodea",
    "Firefly": "Lampyridae", "Fennec Fox": "Fennec fox", "Komodo Dragon": "Komodo dragon",
}
MIME_EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


def fetch(url, tries=5):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=40) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and i < tries - 1:
                time.sleep(3 * (i + 1)); continue
            raise
        except urllib.error.URLError:
            if i < tries - 1:
                time.sleep(3 * (i + 1)); continue
            raise


def api(host, **params):
    params.update(format="json", formatversion="2")
    data = fetch("https://%s/w/api.php?%s" % (host, urllib.parse.urlencode(params)))
    time.sleep(PAUSE)
    return json.loads(data)


def licence_ok(short, allow_sa):
    s = (short or "").strip().lower().replace("–", "-")
    if s.startswith("cc0") or s.startswith("public domain") or s.startswith("pd") or "no known copyright" in s:
        return True
    m = re.match(r"cc[ -]by(-sa)?[ -]\d", s)
    if m:
        return allow_sa if m.group(1) else True
    return False


def clean(v, limit=110):
    v = html.unescape(re.sub(r"<[^>]+>", "", v or ""))
    v = re.sub(r"\s+", " ", v).strip()
    return v if len(v) <= limit else v[: limit - 1].rstrip() + "…"


def lead_image(title):
    """-> (file name without 'File:', None) or (None, reason)"""
    d = api("en.wikipedia.org", action="query", titles=title, redirects="1",
            prop="pageimages|pageprops", piprop="name", ppprop="disambiguation")
    pages = d.get("query", {}).get("pages", [])
    if not pages or pages[0].get("missing"):
        return None, 'no Wikipedia article called "%s"' % title
    p = pages[0]
    if "disambiguation" in (p.get("pageprops") or {}):
        return None, '"%s" is a disambiguation page (add a TITLES entry or --override)' % title
    if not p.get("pageimage"):
        return None, 'the article "%s" has no main photo' % title
    return p["pageimage"], None


def commons_info(file_name):
    """-> (info dict, None) or (None, reason)"""
    d = api("commons.wikimedia.org", action="query", titles="File:" + file_name, prop="imageinfo",
            iiprop="url|mime|size|extmetadata", iiurlwidth=str(WIDTH),
            iiextmetadatafilter="LicenseShortName|Artist|Credit")
    pages = d.get("query", {}).get("pages", [])
    if not pages or pages[0].get("missing") or not pages[0].get("imageinfo"):
        return None, "%s is not on Commons (probably a fair-use image)" % file_name
    ii = pages[0]["imageinfo"][0]
    meta = {k: v.get("value", "") for k, v in (ii.get("extmetadata") or {}).items()}
    return {
        "thumb": ii.get("thumburl") or ii.get("url"), "mime": ii.get("mime", ""),
        "licence": clean(meta.get("LicenseShortName"), 40),
        "author": clean(meta.get("Artist")) or clean(meta.get("Credit")) or "Unknown author",
    }, None


def credit_line(info, file_name):
    url = "https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(file_name.replace(" ", "_"), safe="_()")
    return "%s, %s, %s" % (info["author"], info["licence"], url)


def process(animal, title, override, allow_sa):
    """-> (image bytes, extension, credit) or raises ValueError(reason)"""
    if override:
        name = re.sub(r"^(file|image):", "", override.strip(), flags=re.I)
    else:
        name, why = lead_image(title)
        if why: raise ValueError(why)
    info, why = commons_info(name)
    if why: raise ValueError(why)
    if info["mime"] not in MIME_EXT:
        raise ValueError("%s is a %s file, not a photo" % (name, info["mime"] or "unknown"))
    if not licence_ok(info["licence"], allow_sa):
        raise ValueError('%s has the licence "%s", which is not allowed%s' % (
            name, info["licence"] or "unknown", " (CC BY-SA needs --allow-sa)" if "sa" in info["licence"].lower() else ""))
    data = fetch(info["thumb"]); time.sleep(PAUSE)
    if len(data) < 2000:
        raise ValueError("the download of %s was empty" % name)
    return data, MIME_EXT[info["mime"]], credit_line(info, name)


def write_csv(path, head, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n"); w.writerow(head); w.writerows(rows)


def write_review(path, head, rows, notes, outdir):
    iA, iG, iI, iC = (head.index(c) for c in ("Animal", "Group", "Image", "Credit"))
    cards = []
    for n, r in enumerate(rows, 1):
        img = ('<img loading="lazy" src="%s" alt="">' % html.escape(r[iI])) if r[iI] else '<div class="none">no photo</div>'
        why = notes.get(n)
        cards.append('<figure>%s<figcaption><b>%d. %s</b> <i>%s</i><br><small>%s</small>%s</figcaption></figure>' % (
            img, n, html.escape(r[iA]), html.escape(r[iG]), html.escape(r[iC]),
            ('<br><span class="bad">%s</span>' % html.escape(why)) if why else ""))
    open(path, "w", encoding="utf-8").write(
        '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        '<meta name="robots" content="noindex"><title>RollAnimal photo review</title><style>'
        'body{font:14px system-ui,sans-serif;margin:12px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}'
        'figure{margin:0;border:1px solid #ccc}img,.none{width:100%;height:170px;object-fit:cover;display:block;background:#eee}'
        '.none{display:flex;align-items:center;justify-content:center;color:#999}figcaption{padding:6px;overflow-wrap:anywhere}'
        '.bad{color:#b00020}</style></head><body><h1>RollAnimal photo review</h1>'
        '<p>Check each photo is a clear picture of the named animal. To replace one, use <code>--only "Name" --override "Name=File:...jpg"</code> or <code>--redo</code>.</p>'
        '<div class="g">@@CARDS@@</div></body></html>'.replace("@@CARDS@@", "".join(cards)))


def write_credits(path, head, rows):
    iA, iI, iC = (head.index(c) for c in ("Animal", "Image", "Credit"))
    items = []
    for r in rows:
        if not r[iI] or not r[iC]: continue
        text = html.escape(r[iC])
        text = re.sub(r"(https?://[^\s]+)", r'<a href="\1" rel="noopener">source</a>', text)
        items.append("<li><b>%s</b>: %s</li>" % (html.escape(r[iA]), text))
    open(path, "w", encoding="utf-8").write(
        '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">'
        '<title>RollAnimal - Photo Credits</title><meta name="description" content="Photo credits and licences for the animal pictures used in RollAnimal.">'
        '<link rel="stylesheet" href="/css/style.css"></head><body><div style="max-width:42rem;margin:24px auto;padding:0 10px">'
        '<h1 class="h1">RollAnimal Photo Credits</h1><p>Animal photos come from Wikimedia Commons and are used under their free licences '
        '(CC0, public domain or Creative Commons Attribution). Thank you to the photographers.</p><ul>@@ITEMS@@</ul>'
        '<p><a href="index.html" class="btn">&larr; RollAnimal</a></p></div></body></html>'.replace("@@ITEMS@@", "\n".join(items)))


def main():
    ap = argparse.ArgumentParser(description="Fill js/animal-data.csv with licence-safe animal photos.")
    ap.add_argument("--csv", default="js/animal-data.csv"); ap.add_argument("--out", default="img")
    ap.add_argument("--only", action="append", default=[], help="only this animal (repeatable)")
    ap.add_argument("--override", action="append", default=[], help='"Animal=File:Name.jpg" use this Commons photo')
    ap.add_argument("--limit", type=int, default=0, help="stop after this many animals")
    ap.add_argument("--redo", action="store_true", help="fetch again even if the animal already has a photo")
    ap.add_argument("--allow-sa", action="store_true", help="also accept CC BY-SA photos")
    a = ap.parse_args()
    overrides = dict(o.split("=", 1) for o in a.override if "=" in o)

    with open(a.csv, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    head = rows.pop(0)
    iA, iI, iC = head.index("Animal"), head.index("Image"), head.index("Credit")
    os.makedirs(a.out, exist_ok=True)
    if not os.path.exists(a.csv + ".bak"): shutil.copyfile(a.csv, a.csv + ".bak")

    notes, done, tried = {}, 0, 0
    for n, r in enumerate(rows, 1):
        r += [""] * (len(head) - len(r))
        animal = r[iA]
        if a.only and animal not in a.only: continue
        if r[iI] and os.path.exists(os.path.join(os.path.dirname(a.csv) or ".", "..", r[iI])) and not a.redo and animal not in overrides:
            continue
        if a.limit and tried >= a.limit: break
        tried += 1
        try:
            data, ext, credit = process(animal, TITLES.get(animal, animal), overrides.get(animal), a.allow_sa)
            for old in os.listdir(a.out):                      # a re-run may change the file type
                if old.startswith("a%03d." % n): os.remove(os.path.join(a.out, old))
            fname = "a%03d%s" % (n, ext)
            open(os.path.join(a.out, fname), "wb").write(data)
            r[iI], r[iC] = "%s/%s" % (os.path.basename(a.out.rstrip("/\\")), fname), credit
            done += 1; print("ok    %3d %-16s %s" % (n, animal, credit[:70]))
        except (ValueError, urllib.error.URLError, OSError) as e:
            notes[n] = str(e); print("FAIL  %3d %-16s %s" % (n, animal, e))
        write_csv(a.csv, head, rows)                           # saved after every animal, so a stop loses nothing

    missing = {n: "no photo yet" for n, r in enumerate(rows, 1) if not r[iI] and n not in notes}
    base = os.path.dirname(os.path.abspath(a.csv))
    write_review("review.html", head, rows, {**missing, **notes}, a.out)
    write_credits("credits.html", head, rows)
    print("\n%d photos saved, %d failed, %d animals still without a photo." % (done, len(notes), len(missing) + len(notes)))
    if notes:
        print("\nNeeds attention (fix with --only \"Name\" --override \"Name=File:...\"):")
        for n, why in notes.items(): print("  %3d %s: %s" % (n, rows[n - 1][iA], why))
    print("\nOpen review.html in your browser and check the photos. credits.html is the public credits page.")


if __name__ == "__main__":
    main()
