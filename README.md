# MOUTHPIECE

Personal content engine. Topic → news → angle → talking points → video.

A static PWA for Sean's personal brand (AI × digital marketing). Content is organised by four pillars; each pillar tracks the news we're following, the angles we're going with, and the cards ready to record. Each card is one potential video: the story, the angle, and the beats to say to camera. Built for the rolling-take recording method — open a card, hit record, repeat each beat until it's clean, tick it off, next beat.

## Run it

No build step, no npm, no framework.

```sh
cd ~/Workspace/projects/mouthpiece
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly also works (the service worker just won't register on `file://`).

## How it works

The pipeline is **Topic → News → Angle → Talking points**:

- **Home** — four pillar tiles, nothing else: **SEM** (all Google things live here), **SEO**, **SMA**, **AI**. Each tile shows three counts: fresh news, angles ready, cards ready to record. One tap into a pillar. If any drops are unfiled, a quiet row under the tiles links to them.
- **Pillar** — three stacked sections:
  - **News we're tracking** — from `data/news.json`. Empty until the harvester is wired.
  - **Angles** — from `data/angles.json`. The stances we're going with, per subject.
  - **Ready to record** — the cards for this pillar, filtered To record / Recorded / Skipped.
- **Card** — the full card: story, source, THE ANGLE (the money section), then beats as a tappable checklist for recording. Save / Recorded / Skip set the status. An unfiled drop shows four pillar buttons to file it.
- **Drop** — big textarea to throw a raw idea, then one tap on a pillar files it (or "file later" to skip). It lands as a `fresh` idea card with beats pending.

Canonical data lives in `data/`. Status changes, beat ticks, dropped ideas, and pillar assignments live in `localStorage`, overlaid on the JSON at load. Editing the JSON never clobbers your statuses.

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
  "angle": "why a marketer running real accounts should care — blunt, first-person",
  "beats": ["3-6 things to SAY to camera, not sentences to read"],
  "status": "fresh | saved | recorded | skipped",
  "platforms": ["tiktok", "linkedin", "meta"]
}
```

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
  "status": "new | angled | ignored"
}
```

### `data/angles.json`

```json
{
  "id": "slug",
  "pillar": "SEM | SEO | SMA | AI",
  "subject": "pillar subject",
  "stance": "the take, one or two sentences",
  "status": "proposed | agreed | recorded",
  "newsRefs": ["news ids this angle came from"]
}
```

## Files

- `index.html` / `app.js` / `styles.css` — the app, vanilla JS
- `manifest.webmanifest` + `icon.svg` — installable PWA
- `sw.js` — service worker: cache-first for the shell, network-first for `data/*.json`
- `data/cards.json` — the card deck (canonical)
- `data/news.json` — news we're tracking (harvester writes here; empty until wired)
- `data/angles.json` — the angles we're going with

## Phase 2

- **News harvester pipeline** — a script that watches official platform sources (Google, Meta, TikTok, LinkedIn, Microsoft) and writes items into `data/news.json`
- **Cross-device status sync** — localStorage is per-device; statuses set on the phone don't reach the laptop yet
- **GitHub Pages deploy** — remote + Pages so the phone installs it from a URL
- **SSH to Mac Mini** — run the harvester on the always-on machine
