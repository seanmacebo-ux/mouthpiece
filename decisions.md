# Mouthpiece — Decisions

## 2026-10-07 — Stage pipeline + facts layer (evening steers)

- **Stages replace fresh/saved as the primary pipeline.** Sean: "we need to know how to shift these things." Every card sits at one of four visible stages — **idea → researched → ready → recorded** — shown as a tappable 4-segment row on the card (tap a stage to set it) and as filter chips + badges in the pillar's pipeline section. Overlay key: `mouthpiece.stage.v1` (canonical JSON untouched). `skipped` survives as the off-ramp only (status overlay), with a "Back in the pipeline" button to un-skip; Save/Recorded buttons are gone.
- **Stage derivation for existing cards:** legacy `recorded` status → recorded; beats present → ready; facts only (no beats) → researched; nothing → idea. Facts are what MAKE a card researched — a card can be ready without facts, but the UI nudges "no receipts yet".
- **Facts layer: receipts before takes.** Sean: "it needs to be more based on facts, we have to do research before we just start saying these things." Cards carry an optional `facts` array of `{claim, source}`; rendered between THE ANGLE and the beats as "THE FACTS — receipts before takes", each claim with a prominent tappable source link. App renders only — facts content comes from research sessions, never invented by the app.
- **News front and center.** Sean: "show me the news... I need to see your sources." Source name is a badge; `official: true` (docs/changelogs/platform blogs) gets an accent OFFICIAL badge; every item renders a visible "Read the source — {host}" link; items sort newest first; the section label carries the count. Links show the hostname, not the raw URL — tappable beats readable-but-ignored.
- **Home tile counts: news / in pipeline / ready.** "In pipeline" = not recorded, not skipped; "ready" = stage ready. The tile now answers "what's moving" instead of "what's unwatched".

## 2026-10-07 — Pillar restructure (IA rebuild)

- **Flat card deck rejected; four pillars are the spine.** Sean's steer: "my topics are SEM, SEO, SMA... all Google things live under SEM... I need topics, I need us to have news that we're tracking, I want us to have the angles that we're going with, and then you can give me my talking points." The content pipeline is **Topic → News → Angle → Talking points**, and the app now mirrors it.
- **Home = four pillar tiles, nothing else** (SEM / SEO / SMA / AI), each showing fresh-news / angles-ready / ready-to-record counts. Pillar view = three stacked sections: News we're tracking (`data/news.json`, shipped empty for the harvester), Angles (`data/angles.json`), Ready to record (the cards). Card view unchanged — the beats checklist works for the rolling-take method and stays as is.
- **Cards carry `pillar` + `subject` instead of `topic`.** Migration: paid-media → SEM, seo → SEO, ai → AI, content → SEO. Exception: `evergreen-merchant-center-mistakes` was topic `seo` but went to **SEM** — Merchant Centre is a Google/Shopping thing and "all Google things live under SEM". Subject taxonomy per pillar is labels/filters only, kept lightweight (see README).
- **Drop asks which pillar — one tap, skippable.** The pillar buttons ARE the save action (no separate confirm). Skipped drops land unfiled, surface as a quiet row on home, and get filed with one tap from the card view (`mouthpiece.pillar.v1` overlay in localStorage — canonical JSON untouched).
- **Angle statuses:** proposed → agreed → recorded. The 7 seed angles were extracted from existing cards' angle fields and marked `agreed`, since cards with beats already exist for them.

## 2026-10-07 — Pillar definitions + AI stance (Sean's corrections)

- **SEM = Google Ads + Microsoft Ads. "Literally that simple."** Search Console and Webmaster Tools are organic tools → SEO, never SEM.
- **SEO = Google + Microsoft organic, plus AI search surfaces nowadays.**
- **Social media is a different ball game** — its own pillar, its own failure modes (content, demographics, personas, hooks, volume).
- **AI stance: practitioner, not expert.** The frame is "how I've utilised AI in my world as a marketer, and what I ran into" — never positioning Sean as an AI guru. Credibility angle doubles for SEO/social: "we used to post shit about being SEO experts; now I can show you what I've done to get rankings higher."

## 2026-10-07 — Content direction (recovery session)

- **The thesis (positioning line):** most marketing advice is filtered-out bullshit — three articles saying the same thing, nobody giving real feedback. Digital marketing is sold as "trackable" but the attribution truth is you can't track shit as cleanly as promised. Sean shows what he's actually running and testing. Goal is nothing more than getting his name out there.
- **Four formats identified** (not locked, "Issues I See" likely the starter):
  1. **Issues I See** — day-to-day observations, framed as "you can use this, but here's what to consider."
  2. **Video audits** — walking through real issues on websites / ads / content.
  3. **Real shit we build** — the build log (pipelines, AI system, apps).
  4. **Client echoes** — things heard in client meetings/recordings (anonymised).
- **Underlying teaching angle:** being a marketer means considering a LOT of factors at once — the thing Sean teaches new hires. This is the connective tissue across formats.
- **Platforms refined:** Instagram + TikTok definite, LinkedIn maybe. Content is TAILORED per platform (different cuts/hooks per platform climate), not one video blasted to all three.

## 2026-10-07 — Founding decisions

- **Personal brand, not Top Click.** This is Sean's face and voice at the AI × digital-marketing intersection. Top Click stays out of the framing; client names stay out of all content.
- **Primary platforms: Meta + TikTok + LinkedIn.** Every card carries a `platforms` array; these three are the default set.
- **Git, not a server.** Static PWA in a git repo, no backend, no database. Hosting later via GitHub Pages (phase 2); canonical data is `data/cards.json` in the repo.
- **Rolling-take recording method (Josh-style).** One continuous take; repeat each beat until it comes out clean; cut the flubs in edit. The card view's tappable beats checklist exists specifically to support this.
- **Beats, not scripts.** Cards carry 3–6 punchy talking points to riff on camera, never sentences to read. Reading kills the delivery; the angle carries the take.
- **localStorage overlay, not JSON mutation.** Status changes / beat ticks / drops persist per-device in localStorage, overlaid on `cards.json` at load. Cross-device sync is explicitly deferred to phase 2.
- **Scar seeds reconstructed from memory-index lessons** (not `scars.json` — the file didn't exist on disk). Flagged in state.md for Sean to verify voice + facts before recording.
- **Speed-to-the-idea beats polish (Sean's steer, same day).** Simplicity and quick access win every UI tradeoff: feed opens straight on Fresh, one tap to a card's beats, big tap targets (44/48px), no onboarding, no animations beyond 150ms background feedback, no ceremony (drop saves and returns to feed instantly). UI follows `system/ui-ux-doctrine.md` as the baseline.
