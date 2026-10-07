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

The pipeline is **Topic → News → Angle → Facts → Talking points**, and every card moves through four stages:

**idea → researched → ready → recorded** (skip is the off-ramp, not a stage)

- **Home** — four pillar tiles, nothing else: **SEM** (all Google things live here), **SEO**, **SMA**, **AI**. Each tile shows three counts: fresh news, cards in the pipeline (not yet recorded), cards ready to record. One tap into a pillar. If any drops are unfiled, a quiet row under the tiles links to them.
- **Pillar** — three stacked sections:
  - **News we're tracking** — from `data/news.json`, newest first, with a count in the label. Source name is a badge; official sources (docs / changelogs / platform blogs) get an accent OFFICIAL badge; every item's URL is a visible, tappable "Read the source" link.
  - **Angles** — from `data/angles.json`. The stances we're going with, per subject.
  - **The pipeline** — the cards for this pillar, filtered by stage chips: Idea / Researched / Ready / Recorded / Skipped (defaults to Ready). Every card row carries its stage badge.
- **Card** — the full card: story, source, a tappable **stage row** (tap a stage to shift the card there), THE ANGLE (the money section), **THE FACTS — receipts before takes** (claims with tappable source links; a quiet nudge when there are none yet), then beats as a tappable checklist for recording. Skip off-ramps the card; a skipped card gets a "Back in the pipeline" button. An unfiled drop shows four pillar buttons to file it.
- **Drop** — big textarea to throw a raw idea, then one tap on a pillar files it (or "file later" to skip). It lands as an idea-stage card with beats pending.

**Stage derivation** for cards with no stored stage: `recorded` status → recorded; beats present → ready (facts are what MAKE a card researched, but beats mean it's recordable — a ready card without facts gets a "no receipts yet" nudge); facts only → researched; otherwise idea.

Canonical data lives in `data/`. Stage shifts (`mouthpiece.stage.v1`), skip status, beat ticks, dropped ideas, and pillar assignments live in `localStorage`, overlaid on the JSON at load. Editing the JSON never clobbers your stages or statuses.

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
  "facts": [
    { "claim": "a verifiable statement backing the take", "source": "https://where-it-came-from" }
  ],
  "beats": ["3-6 things to SAY to camera, not sentences to read"],
  "status": "fresh | saved | recorded | skipped",
  "platforms": ["tiktok", "linkedin", "meta"]
}
```

`facts` is optional: the receipts behind the take, researched BEFORE recording. Each fact is a claim plus the URL it came from — the card view renders them between the angle and the beats with tappable source links. The live stage (idea / researched / ready / recorded) is a localStorage overlay (`mouthpiece.stage.v1`), derived from the fields above on first load; `status` remains for the skip off-ramp and legacy recorded state.

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
  "status": "new | angled | ignored"
}
```

`official` marks first-party sources — platform docs, changelogs, official blogs (`true`) vs commentary/press (`false`). Official items get an accent OFFICIAL badge in the news section.

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
