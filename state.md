# Mouthpiece — State

**Updated:** 2026-10-08

## What this is

Personal content-engine PWA for Sean's personal brand (AI × digital marketing). The pipeline is Topic → News → Angle → Talking points: four pillars (SEM / SEO / SMA / AI), each tracking news, angles, and cards ready to record. Cards = potential videos (story + angle + beats). Supports the rolling-take recording method: one take, repeat each beat until clean, tick beats off in the app.

## Current state

- **Full board + harvester + facts LIVE 2026-10-07 (overnight batch).** 48 cards across the four pillars (Sean's ~50 topics; "search integration issues" unwritten — Sean to define it). News harvester built and wired: `scripts/harvest_news.py` (stdlib, rerunnable, merge-on-rerun), 118 items from 15 feeds (DGtD's vetted registry + official platform blogs), 53 flagged `official: true`. Facts research done for 10 priority cards: 44 verified facts with source URLs merged into `data/cards.json`; 3 factually wrong beats CORRECTED before recording (PMax "three controls" outdated since 2025 negatives/brand-exclusions; SKAG literal-exactness dead since close variants; "asking AI instead of Googling" overstated — Google still ~170x AI referral clicks per Similarweb). SMA news pillar is thin (6 items): TikTok Newsroom serves HTML not RSS, LinkedIn blog has no feed — browser-kit harvesting is the known fix.
- **GitHub: PUBLIC repo `seanmacebo-ux/mouthpiece`, branch `public` (default).** History squashed clean — client names scrubbed from BACKLOG before going public; full pre-public history only in local branch `archive/pre-public`. **Pages LIVE 2026-10-08** (Sean approved) at https://seanmacebo-ux.github.io/mouthpiece/ — branch `public`, root, legacy build. Verified: index 200, sw.js 200, `data/cards.json` serves 48 cards. All asset paths are relative, so the `/mouthpiece/` sub-path works. Every push to `public` redeploys.
- **Stage pipeline + facts layer + news upgrade shipped 2026-10-07 (evening steers).** Cards now move through a visible stage pipeline: idea → researched → ready → recorded, with skip as the off-ramp. Card view has a tappable 4-segment stage row (overlay key `mouthpiece.stage.v1`); pillar "Ready to record" section became "The pipeline" with stage filter chips (default Ready) and stage badges per row; home tile counts are now news / in pipeline / ready. Cards support an optional `facts` array ({claim, source}) rendered as "THE FACTS — receipts before takes" between the angle and the beats, tappable source links, quiet nudge when empty ("No receipts yet — research with Claude before recording"). News section: source badge + OFFICIAL accent badge (`official: true` field), visible "Read the source" link per item, newest-first sort, count in the label. Save/Recorded buttons removed (stage row covers them); skipped cards get "Back in the pipeline". SW cache bumped to v3. Facts content itself NOT written — facts-researcher agent owns that.
- **Pillar restructure shipped 2026-10-07 (same day as MVP).** Sean rejected the flat card deck. New IA: home = four pillar tiles (SEM/SEO/SMA/AI) with counts; pillar view = News we're tracking + Angles + Ready to record; card view unchanged; drop now asks which pillar (one tap, skippable — unfiled drops surface on home and can be filed from the card view). New data files: `data/news.json` (empty, harvester lands here) + `data/angles.json` (7 seeds from existing cards' angles). Cards migrated: `topic` → `pillar` + `subject`. SW cache bumped to v2.
- **MVP scaffold built 2026-10-07.** Static PWA, vanilla JS, no build step: beats checklist, localStorage overlay for statuses + ticks + dropped ideas (+ pillar assignments since the restructure). Service worker (cache-first shell, network-first data) + manifest + SVG icon.
- **Seeded with 10 cards** in `data/cards.json`: 4 scar, 3 build, 3 evergreen. All first-person, no client names.
  - ⚠️ Scar seeds were reconstructed from logged lessons in the memory index (destructive-ops £58, backfill wipe, unverified tracking, live-account experiments) — `dummies-guide-site/data/scars.json` did not exist on disk at build time. Verify the details read true before recording.
- ~~Local git repo only, no GitHub remote~~ — superseded: public remote + Pages live (see above).
- **2026-10-08 — Sean rejected the 4 `scar-*` cards.** They were meant to be HORROR STORIES in his own words (things he's seen/lived in marketing), not Claude's dev mistakes reconstructed from memory notes. "None of those are applicable." To be removed; real horror stories being mined from his conversation logs.
- **2026-10-08 — Card format change requested (not built yet):** synopsis / talking points / things to say, plus a target length per card. Proposed: Short 45–60s (~150 words spoken) and Mid 90s–2min; nothing over 2 min. Awaiting Sean on: key lines vs full script for "things to say"; daily harvester schedule vs Claude news digest.

## Next

1. ~~Sean opens it~~ — DONE 2026-10-07, served on :8065, verdict "perfect".
2. ~~Phone access~~ — DONE 2026-10-08, Pages live.
3. **News harvester (spec firmed 2026-10-07):** official-source news feed into the per-pillar "News we're tracking" section. Pull what Google, Meta, TikTok, LinkedIn, Microsoft are changing — official docs/changelogs/blogs, not commentary. "We need to be on top of that shit." Harvester script → `data/news.json` (schema in README, shipped empty) → committed → Pages redeploys.
4. Record the first video off one card; see if the beats checklist holds up mid-take.

## Open questions

- ~~Drop cards have no topic~~ — RESOLVED 2026-10-07: drop asks which pillar (one tap, skippable); unfiled drops can be filed later from the card view.
- Cross-device sync approach undecided (git-backed JSON vs tiny API vs manual export).
- Angles currently live only in `data/angles.json` (edited by hand / with Claude) — no in-app way to promote a news item to an angle yet. Decide if that stays a Claude-session job or gets UI.
