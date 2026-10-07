#!/usr/bin/env python3
"""
Mouthpiece news harvester — pulls digital-marketing news from official platform
feeds + reputable industry commentary, classifies into pillars, emits news.json.

Usage:
    python3 harvest_news.py [path/to/news.json]

If the path exists, existing items keep their ids and statuses; only new items
are added. Default output: news.json next to this script.

stdlib only. Source roster grounded in the DGtD vetted-source registry:
~/Workspace/claude-memory/projects/tcp-framework/knowledge-base/SOURCES.md
(Tier 1 official / Tier 2 vetted practitioners / Tier 3 trade press).
All feed URLs probed live 2026-10-07.
"""

import hashlib
import json
import os
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/129.0 Safari/537.36")
TIMEOUT = 15
MAX_AGE_DAYS = 45
PER_SOURCE_CAP = 10   # keep daily publishers from drowning the rest
TOTAL_CAP = 120

ATOM = "{http://www.w3.org/2005/Atom}"
DC = "{http://purl.org/dc/elements/1.1/}"

# ---------------------------------------------------------------------------
# Source roster
# (name, feed_url, default_pillar, require_regex_or_None)
# require_regex: item is dropped unless title+summary matches (relevance gate
# for broad newsrooms that publish plenty of non-marketing news).
#
# OFFICIAL (DGtD Tier 1 + "platform-change radar" additions):
#   Google Ads & Commerce blog, Google Search Central blog, Google Ads
#   Developer Blog, Google AI blog, Microsoft Advertising blog, Meta Newsroom,
#   OpenAI News.
# COMMENTARY (DGtD Tier 2/3, feed lanes verified in _freshness-harvest-design):
#   Search Engine Land, Search Engine Roundtable, Search Engine Journal,
#   Backlinko, Solutions 8, SEMrush, Ahrefs, Moz.
#
# DEAD / no feed — probed 2026-10-07, dropped:
#   TikTok Newsroom   https://newsroom.tiktok.com/en-us/rss.xml — URL serves an
#                     HTML SPA page, not XML; unparseable without a browser.
#   LinkedIn Marketing blog — no RSS endpoint found (404 on /rss).
#   Anthropic News    https://www.anthropic.com/rss.xml — 404, no public feed.
#   Google Search Central alt rss.xml — 404 (feedburner mirror used instead).
#   seroundtable feedburner mirror — SSL EOF (site's own index.xml used).
#   ZATO Marketing (Tier 2) — no RSS (/feed 301s to homepage per DGtD notes);
#                     needs sitemap-delta, out of scope for a feed harvester.
# ---------------------------------------------------------------------------
SOURCES = [
    # --- official ---
    ("Google Ads & Commerce Blog", "https://blog.google/products/ads-commerce/rss/", "SEM", None),
    ("Google Search Central Blog", "https://feeds.feedburner.com/blogspot/amDG", "SEO", None),
    ("Google Ads Developer Blog", "https://ads-developers.googleblog.com/feeds/posts/default?alt=rss", "SEM", None),
    ("Google AI Blog", "https://blog.google/technology/ai/rss/", "AI", None),
    ("Microsoft Advertising Blog", "https://about.ads.microsoft.com/en/blog/rss", "SEM", None),
    ("Meta Newsroom", "https://about.fb.com/news/feed/", "SMA",
     r"ads?\b|advertis|business|marketing|commerce|creator|brand|ai|instagram|whatsapp|monetiz"),
    ("OpenAI News", "https://openai.com/news/rss.xml", "AI", None),
    # --- commentary ---
    ("Search Engine Land", "https://searchengineland.com/feed", "SEO", None),
    ("Search Engine Roundtable", "https://www.seroundtable.com/index.xml", "SEO", None),
    ("Search Engine Journal", "https://www.searchenginejournal.com/feed/", "SEO", None),
    ("Backlinko", "https://backlinko.com/feed", "SEO", None),
    ("Solutions 8", "https://sol8.com/feed", "SEM", None),
    ("SEMrush Blog", "https://www.semrush.com/blog/feed/", "SEO", None),
    ("Ahrefs Blog", "https://ahrefs.com/blog/feed/", "SEO", None),
    ("Moz Blog", "https://moz.com/posts/rss/blog", "SEO", None),
]

# ---------------------------------------------------------------------------
# Pillar classification — regex-first, no LLM.
# Phrase overrides run first (most specific wins), then keyword scoring,
# then the source default.
# ---------------------------------------------------------------------------
OVERRIDES = [
    (r"\bai\s*overviews?\b|\bai\s*mode\b", "SEO"),      # search features, not AI products
    (r"\bai\s*max\b", "SEM"),                            # Google Ads AI Max
    (r"\badvantage\+|\bandromeda\b", "SMA"),
    (r"\bperformance\s*max\b|\bpmax\b", "SEM"),
]

PILLAR_PATTERNS = {
    "SEM": r"google ads|microsoft advertis|bing ads|\bppc\b|paid search|search ads"
           r"|\bpmax\b|performance max|demand gen|merchant center|shopping (ads|campaign|feed)"
           r"|smart bidding|\bbidding\b|\btcpa\b|\btroas\b|quality score|\brsa\b"
           r"|responsive search|ad rank|\bcpc\b|search partner|broad match|negative keyword"
           r"|google shopping|product feed|\bdv360\b|display campaign",
    "SEO": r"\bseo\b|search console|core (update|web vitals)|algorithm update|\bserp\b"
           r"|rank(ing|ings|s)?\b|organic (traffic|search)|backlinks?\b|link build"
           r"|crawl(ing|er|ed)?\b|index(ing|ed)?\b|structured data|schema markup"
           r"|sitemaps?\b|canonical|e-e-a-t|\beeat\b|googlebot|search results"
           r"|featured snippet|local (seo|pack)|keyword research|content strateg",
    "SMA": r"meta ads?\b|facebook|instagram|tiktok|\breels\b|\bthreads\b|whatsapp"
           r"|linkedin|snapchat|pinterest|social (media|ads|campaign)|advantage\+"
           r"|creator|influencer|\bugc\b|stories ads|messenger|audience network",
    "AI":  r"\bai\b|artificial intelligence|\bllms?\b|\bgpt-?\d|chatgpt|openai|anthropic"
           r"|claude|gemini|copilot|\bagents?\b|agentic|machine learning|\bgenai\b"
           r"|generative|deep ?mind|\bsora\b|midjourney|stable diffusion|chatbot",
}

# Conservative note templates — only when the headline makes the meaning obvious.
NOTE_RULES = [
    (r"core update", "Google core algorithm update — watch client rankings and traffic."),
    (r"performance max|\bpmax\b", "PMax change — check against our PMax playbook."),
    (r"\bai\s*overviews?\b", "AI Overviews shift — affects organic CTR expectations."),
    (r"\bai\s*mode\b", "Google AI Mode — changes how search results get consumed."),
    (r"deprecat|sunset(ting)?\b|shut(ting)? down|retir(ing|ement)", "Something is being switched off — check client dependencies."),
    (r"release notes|\bapi\b.*(version|v\d+)|new version", "Platform API/version change — may affect our tooling."),
    (r"advantage\+", "Meta Advantage+ update — relevant to all Meta ad accounts."),
    (r"merchant center|product feed", "Feed/Merchant Center change — relevant to e-com clients."),
]

PILLAR_ORDER = ["SEM", "SMA", "SEO", "AI"]  # tie-break priority: specific before broad


def classify(title, summary, source_default):
    text = f"{title} {summary}".lower()
    for pat, pillar in OVERRIDES:
        if re.search(pat, text):
            return pillar
    scores = {p: len(re.findall(pat, text)) for p, pat in PILLAR_PATTERNS.items()}
    best = max(scores.values())
    if best == 0:
        return source_default
    tied = [p for p in PILLAR_ORDER if scores[p] == best]
    if source_default in tied:
        return source_default
    return tied[0]


def make_note(title, summary):
    text = f"{title} {summary}".lower()
    for pat, note in NOTE_RULES:
        if re.search(pat, text):
            return note
    return None


def parse_date(raw):
    if not raw:
        return None
    raw = raw.strip()
    try:
        return parsedate_to_datetime(raw)
    except Exception:
        pass
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except Exception:
        pass
    for fmt in ("%B %d, %Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw, fmt).replace(tzinfo=timezone.utc)
        except Exception:
            pass
    return None


def strip_html(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s or "")).strip()


def fetch(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    })
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return r.read()


def parse_feed(data):
    """Return list of dicts {title, url, summary, date} from RSS or Atom bytes."""
    root = ET.fromstring(data)
    out = []
    if root.findall(".//item"):  # RSS / RDF
        for it in root.findall(".//item"):
            out.append({
                "title": strip_html(it.findtext("title")),
                "url": (it.findtext("link") or "").strip(),
                "summary": strip_html(it.findtext("description") or "")[:500],
                "date": parse_date(it.findtext("pubDate") or it.findtext(f"{DC}date")),
            })
    else:  # Atom
        for it in root.findall(f".//{ATOM}entry"):
            link = ""
            for l in it.findall(f"{ATOM}link"):
                if l.get("rel") in (None, "alternate"):
                    link = l.get("href") or ""
                    break
            out.append({
                "title": strip_html(it.findtext(f"{ATOM}title")),
                "url": link.strip(),
                "summary": strip_html(it.findtext(f"{ATOM}summary") or it.findtext(f"{ATOM}content") or "")[:500],
                "date": parse_date(it.findtext(f"{ATOM}published") or it.findtext(f"{ATOM}updated")),
            })
    return out


def item_id(url):
    return hashlib.sha256(url.strip().lower().rstrip("/").encode()).hexdigest()[:12]


def harvest():
    cutoff = datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)
    items, errors = [], []
    for name, url, default_pillar, require in SOURCES:
        try:
            entries = parse_feed(fetch(url))
        except Exception as e:
            errors.append(f"{name}: {type(e).__name__}: {e}")
            continue
        kept = 0
        for e in sorted(entries, key=lambda x: x["date"] or cutoff, reverse=True):
            if kept >= PER_SOURCE_CAP:
                break
            if not e["url"] or not e["title"]:
                continue
            if e["date"] is None or e["date"] < cutoff:
                continue
            blob = f'{e["title"]} {e["summary"]}'
            if require and not re.search(require, blob, re.I):
                continue
            items.append({
                "id": item_id(e["url"]),
                "pillar": classify(e["title"], e["summary"], default_pillar),
                "date": e["date"].strftime("%Y-%m-%d"),
                "source": name,
                "title": e["title"],
                "url": e["url"],
                "note": make_note(e["title"], e["summary"]),
                "status": "new",
            })
            kept += 1
    return items, errors


def main():
    out_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "news.json")

    existing = {}
    if os.path.exists(out_path):
        try:
            with open(out_path) as f:
                for it in json.load(f):
                    existing[it["id"]] = it
        except Exception as e:
            print(f"warning: could not read existing {out_path}: {e}", file=sys.stderr)

    fresh, errors = harvest()
    seen = set()
    merged = []
    for it in fresh:
        if it["id"] in seen:
            continue
        seen.add(it["id"])
        merged.append(existing.get(it["id"], it))  # existing item keeps its status/note
    for iid, it in existing.items():               # keep prior items feeds no longer list
        if iid not in seen:
            merged.append(it)
            seen.add(iid)

    cutoff = (datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)).strftime("%Y-%m-%d")
    merged = [it for it in merged if it.get("date", "") >= cutoff]
    merged.sort(key=lambda it: it.get("date", ""), reverse=True)
    merged = merged[:TOTAL_CAP]

    with open(out_path, "w") as f:
        json.dump(merged, f, indent=2, ensure_ascii=False)

    counts = {}
    for it in merged:
        counts[it["pillar"]] = counts.get(it["pillar"], 0) + 1
    print(f"wrote {len(merged)} items -> {out_path}")
    print("pillars:", json.dumps(counts))
    print("sources:", len({it['source'] for it in merged}))
    for err in errors:
        print("feed error:", err, file=sys.stderr)


if __name__ == "__main__":
    main()
