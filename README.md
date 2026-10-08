# MOUTHPIECE

Personal content engine. News → breakdown → video.

A static PWA for Sean's personal brand (AI × digital marketing). Content is organised by four pillars, and each pillar holds just two things: **News** (what happened) and **Videos** (what Sean says about it). Built for the rolling-take recording method — open a video, hit record, tick each talking point as you nail it.

Live: https://seanmacebo-ux.github.io/mouthpiece/ (GitHub Pages, branch `public`; every push redeploys).

## Run it

No build step, no npm, no framework.

```sh
cd ~/Workspace/projects/mouthpiece
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly also works (the service worker just won't register on `file://`).

## How it works

The workflow: Claude reads the source (platform's own docs first, trade press second) → writes a **breakdown** on the news item → we argue talking points → Sean adds his own → it becomes a **video**.

- **Home** — four pillar tiles: **SEM** (all Google things live here), **SEO**, **SMA**, **AI**. Each shows: ready to record / need research / news. A quiet row links to unfiled drops when there are any.
- **Pillar** — two tabs:
  - **Videos** (default) — grouped **Ready to record** (talking points AND receipts) / **Needs research** / **Recorded** (folded) / **Skipped** (folded). Each row: subject, talk-time estimate, receipt count, 3-line synopsis.
  - **News** — items Claude has broken down first (accent border, BREAKDOWN badge, synopsis, "Read the breakdown →"), then official sources, then trade press; newest first within each.
- **Breakdown** (`#/news/<id>`) — synopsis, the interesting bits, the sources Claude actually read (official ones badged), and a button to the video made from it.
- **Video** (`#/card/<id>`) — top to bottom: **Synopsis** → **My talking points** (tick as you go) → **Your points** → **Things to say** (hook / punch / closer, word for word) → folded **The angle** and **Receipts**. Buttons: Mark recorded / Skip. Talk time = ~20s per talking point (Claude's + Sean's) — an estimate until real takes are timed.
- **Drop** — big textarea for a raw idea, one tap on a pillar files it.

Canonical data lives in `data/`. Recorded (`mouthpiece.stage.v1`, only the value `"recorded"` matters now), skip status, point ticks, dropped ideas and pillar assignments live in `localStorage`, overlaid on the JSON at load.

## Pillars & subjects

Subjects are lightweight labels/filters, not navigation:

- **SEM** — google-ads, pmax, ai-max, shopping, merchant-centre, feeds, microsoft-ads, tracking
- **SEO** — content, pr, site-structure, page-titles, visibility, local-profiles, search-console
- **SMA** — meta, tiktok, linkedin, advantage-plus, targeting, parameters
- **AI** — skills, jobs, vibe-coding, apis, retrieval, file-management

## Data schemas

### `data/cards.json`

```json
{
  "id": "slug",
  "created": "YYYY-MM-DD",
  "type": "news | idea | scar | build | evergreen",
  "pillar": "SEM | SEO | SMA | AI",
  "subject": "one of the pillar's subjects, or null",
  "title": "short punchy title",
  "story": "1-2 sentences: what happened / what this is",
  "source": "url or null",
  "synopsis": "optional — 2-3 lines on what the video is about (falls back to story)",
  "angle": "why a marketer running real accounts should care — blunt, first-person (folded on the card)",
  "facts": [
    { "claim": "a verifiable statement backing the take", "source": "https://where-it-came-from" }
  ],
  "beats": ["Claude's talking points — 3-6 things to SAY, not sentences to read"],
  "your_points": ["optional — what Sean wants said"],
  "lines": [{ "kind": "hook | punch | closer", "text": "a line worth saying word for word" }],
  "newsRef": "optional — id of the news item this video came from",
  "status": "fresh | skipped",
  "platforms": ["tiktok", "linkedin", "meta"]
}
```

`facts` are the receipts, researched BEFORE recording. A video is **ready** only when it has talking points AND receipts. `lines` are key lines only (hook, punch lines, closer), never a full script — reading kills delivery.

### `data/news.json`

```json
{
  "id": "slug",
  "pillar": "SEM | SEO | SMA | AI",
  "date": "YYYY-MM-DD",
  "source": "who published it",
  "title": "what changed",
  "url": "link",
  "note": "why it matters, one line",
  "official": true,
  "status": "new | read | used | angled | ignored",
  "brief": {
    "read": "YYYY-MM-DD",
    "synopsis": "what happened, plainly",
    "bits": ["the interesting / thought-provoking parts"],
    "sources": [{ "label": "what it is", "url": "https://…", "official": true }]
  },
  "card": "optional — id of the video made from this"
}
```

`official` marks first-party sources — platform docs, changelogs, official blogs (`true`) vs commentary/press (`false`). `brief` is written by Claude after actually reading the source; `sources` lists only what was read (say so when a page couldn't be read).

### `data/angles.json` (retired from the UI 2026-10-08)

Still on disk, no longer rendered — the angle now lives inside each video card. Kept for history.

## Files

- `index.html` / `app.js` / `styles.css` — the app, vanilla JS
- `manifest.webmanifest` + `icon.svg` — installable PWA
- `sw.js` — service worker: network-first for everything (latest deploy when online, cached copy offline)
- `data/cards.json` — the videos (canonical)
- `data/news.json` — news (harvester writes here; Claude adds briefs)
- `data/angles.json` — retired from the UI, kept for history
- `scripts/harvest_news.py` — the news harvester (stdlib, rerunnable)

## Next

- **More first-party sources** — Google Ads / Search Central YouTube (feeds + transcripts), Search Status Dashboard, Google's liaisons (Ads Liaison, Search Liaison, John Mueller — LinkedIn/X need browser-kit)
- **Cross-device status sync** — localStorage is per-device; recorded/ticks on the phone don't reach the laptop
- **SSH to Mac Mini** — run the harvester on the always-on machine
