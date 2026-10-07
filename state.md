# Mouthpiece — State

**Updated:** 2026-10-07

## What this is

Personal content-engine PWA for Sean's personal brand (AI × digital marketing). The pipeline is Topic → News → Angle → Talking points: four pillars (SEM / SEO / SMA / AI), each tracking news, angles, and cards ready to record. Cards = potential videos (story + angle + beats). Supports the rolling-take recording method: one take, repeat each beat until clean, tick beats off in the app.

## Current state

- **Stage pipeline + facts layer + news upgrade shipped 2026-10-07 (evening steers).** Cards now move through a visible stage pipeline: idea → researched → ready → recorded, with skip as the off-ramp. Card view has a tappable 4-segment stage row (overlay key `mouthpiece.stage.v1`); pillar "Ready to record" section became "The pipeline" with stage filter chips (default Ready) and stage badges per row; home tile counts are now news / in pipeline / ready. Cards support an optional `facts` array ({claim, source}) rendered as "THE FACTS — receipts before takes" between the angle and the beats, tappable source links, quiet nudge when empty ("No receipts yet — research with Claude before recording"). News section: source badge + OFFICIAL accent badge (`official: true` field), visible "Read the source" link per item, newest-first sort, count in the label. Save/Recorded buttons removed (stage row covers them); skipped cards get "Back in the pipeline". SW cache bumped to v3. Facts content itself NOT written — facts-researcher agent owns that.
- **Pillar restructure shipped 2026-10-07 (same day as MVP).** Sean rejected the flat card deck. New IA: home = four pillar tiles (SEM/SEO/SMA/AI) with counts; pillar view = News we're tracking + Angles + Ready to record; card view unchanged; drop now asks which pillar (one tap, skippable — unfiled drops surface on home and can be filed from the card view). New data files: `data/news.json` (empty, harvester lands here) + `data/angles.json` (7 seeds from existing cards' angles). Cards migrated: `topic` → `pillar` + `subject`. SW cache bumped to v2.
- **MVP scaffold built 2026-10-07.** Static PWA, vanilla JS, no build step: beats checklist, localStorage overlay for statuses + ticks + dropped ideas (+ pillar assignments since the restructure). Service worker (cache-first shell, network-first data) + manifest + SVG icon.
- **Seeded with 10 cards** in `data/cards.json`: 4 scar, 3 build, 3 evergreen. All first-person, no client names.
  - ⚠️ Scar seeds were reconstructed from logged lessons in the memory index (destructive-ops £58, backfill wipe, unverified tracking, live-account experiments) — `dummies-guide-site/data/scars.json` did not exist on disk at build time. Verify the details read true before recording.
- Local git repo only. **No GitHub remote yet** (deliberate — Pages deploy is phase 2).
- Not yet opened on Sean's phone.

## Next

1. ~~Sean opens it~~ — DONE 2026-10-07, served on :8065, verdict "perfect".
2. **Phone access (phase 2 pulled forward):** Sean needs it off localhost — GitHub Pages deploy is now the priority. Precedent: kettlebell + chess-coach already live on GH Pages.
3. **News harvester (spec firmed 2026-10-07):** official-source news feed into the per-pillar "News we're tracking" section. Pull what Google, Meta, TikTok, LinkedIn, Microsoft are changing — official docs/changelogs/blogs, not commentary. "We need to be on top of that shit." Harvester script → `data/news.json` (schema in README, shipped empty) → committed → Pages redeploys.
4. Record the first video off one card; see if the beats checklist holds up mid-take.

## Open questions

- ~~Drop cards have no topic~~ — RESOLVED 2026-10-07: drop asks which pillar (one tap, skippable); unfiled drops can be filed later from the card view.
- Cross-device sync approach undecided (git-backed JSON vs tiny API vs manual export).
- Angles currently live only in `data/angles.json` (edited by hand / with Claude) — no in-app way to promote a news item to an angle yet. Decide if that stays a Claude-session job or gets UI.
