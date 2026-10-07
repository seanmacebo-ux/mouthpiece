# Idea Backlog — raw dumps, not yet cards

Captured from Sean's voice dumps (2026-10-07 session + recovery session). These are stubs waiting to be talked through and turned into cards in `data/cards.json`. Don't delete a line — mark it `→ card: <id>` when it graduates.

## Dump 4 — 2026-10-07 (recovery session, cont.)

**Paid media / targeting:**
- Issues with targeting on PMax, Meta, TikTok, etc. — and the lessons learned from those
- Issues with Advantage+ — when you SHOULD use it, when you shouldn't
- Parameters — people not checking parameters

**AI / vibe-coding:**

> **Positioning locked 2026-10-07:** Sean is NOT trying to be the AI expert. The frame is "how I've utilised AI in my world as a marketer, and what I ran into." Practitioner, not guru.

- Not having skills — and especially not having plugins
- Not understanding how to build in your workflows *(Sean: "probably the biggest thing")*
- Not understanding the little jobs and how much they actually take
- Not knowing how to verify your own APIs / how to work APIs
- File management, retrieval, deduplication, caching — the unglamorous plumbing
- The feature firehose: what Claude, Gemini, Codex and local AIs keep shipping — and what it means for marketers
- How WE actually use AI: content writing, posting, reporting, creation, systems, workflows
- Relying on AI too much *(the counterweight video — from the SMA dump but it's an AI story)*
- Issues with not understanding how to set up skills
- Issues with not understanding how to set up jobs *(scheduled/automated runs — set-and-verify, not set-and-forget)*
- Issues with not knowing how to verify your own code, or write it — not understanding what you're building *(Sean's whole verify-don't-trust system is the receipts here)*
- Issues with pushing things *(shipping without checking — pairs with the £58 scar card)*
- Issues with not understanding the jargon
- Issues with not understanding what it means *(jargon + meaning = "marketers drowning in dev vocabulary" video)*
- Issues with APIs
- Issues with NOT having APIs *(platforms/tools that lock you out — the other side of the coin)*

**Analytics:**
- Issues with reporting *(second mention — it keeps coming up, strong signal)*
- Issues with analysing analytics

**SMA (social is its own ball game — Sean, 2026-10-07):**
- Lack of content / lack of ORGANIC content
- "My audience isn't on that platform" is a myth — you just don't know how to talk to them yet. *(Sean's honesty angle: "we were the same — we used to post shit about being SEO experts. Now I can sit down and show you what I've done to get rankings higher.")*
- Not understanding the demographics you're targeting
- Not knowing how to target your people / personas
- Not having enough hooks
- Not having enough content, full stop
- Tracking issues on social
- Relying on AI too much *(for content — the soulless-feed problem)*

**Platform ecosystem / local presence:**
- Microsoft (Bing) vs Google Ads — paid media compare *(SEM)*
- Search Console vs Webmaster Tools — the organic compare *(SEO — Sean's correction: these are organic tools, NEVER file under SEM. SEM = Google Ads + Microsoft Ads, literally that simple. SEO = Google + Microsoft organic + AI search surfaces nowadays)*
- Bing Places, Apple Maps, Google Maps, and all the other profiles you should be building — the "invisible online" fix, practical edition *(pairs with the visibility idea in SEO strand)*

**Client echoes:**
- Things we hear from clients — mined from meetings and recordings *(Fathom recordings are the source pool; anonymise hard)*

**News / current:**
- General news-reactive content — new things as they drop *(this is the news-harvester pool from the app's phase 2)*

**E-com / feeds:**
- Issues with catalogues
- Issues with product feeds *(overlaps `evergreen-merchant-center-mistakes` — feeds strand is growing: Merchant Centre + catalogues + feeds + attributes could be its own mini-series)*
- Issues with people's product attributes

**SEO:**
- Issues with being seen online — being visible at all. A lot of people are just invisible online. *(possible umbrella/opener for the whole SEO strand — the "you don't exist" hook)*
- Issues with lack of content
- Lack of PR
- Issues with website structure
- Not knowing how to speak about your own product/service on your site — not clearly explaining it to clients *(messaging/positioning failure, not a technical one)*
- Lack of social proofing
- Lack of reviews and reputation

## Dump 3 — 2026-10-07 (recovery session)

- Issues I see on Merchant Centre *(overlaps `evergreen-merchant-center-mistakes` — but "issues I see" angle may be a separate, spicier video)*
- Issues I see with PMax *(overlaps `evergreen-what-pmax-actually-is`)*
- Issues I see with search campaigns
- Issues I see with AI Max — how people build them
- Issues I see with tracking *(overlaps `scar-tracking-launched-unverified`)*
- Issues I see with reporting *(overlaps `build-reporting-pipeline`)*
- Issues I see with page titles
- Issues I see with keyword research
- Issues I see with file management for AI
- Issues I see with retrieval for AI
- "Just stupid things like that" — the pattern here is an **"Issues I See" series**: one recurring format, platform by platform

## Dump 2 — 2026-10-07 (lost session, last message before cutoff)

- Search integration issues
- SKAGs vs STAGs *(was transcribed "Skype vs. Stack" 😂 — confirmed 2026-10-07. Sean's stance: SKAG default, STAG exception. "Everyone says SKAGs are dead" = perfect thesis-format video)*
- How things work — most advice out there is filtered-out bullshit; you need to actually TEST things *(this is a thesis/positioning statement, not just a video)*
- Claude's features and what they mean — e.g. bots talking to other bots (agent-to-agent)

## Dump 1 — 2026-10-07 (lost session, opening)

Broad pillars, not videos yet:
- SEO
- Social media ads
- Content itself
- AI
- Paid media (CPC / PPC)

## Mined from memory — 2026-10-07 (Sean: "go through our memory, the things we've built and why")

Every one of these is a logged, lived lesson in `~/Workspace/claude-memory/`. Client names stripped — stories go out anonymised. Source pointer per line for the deep-dive when we flesh the card.

**Paid media receipts:**
- The docs are wrong: 7 Microsoft Ads API quirks that contradict Microsoft's own documentation → `feedback/microsoft-ads-v13-quirks` *(pure thesis fuel: "I tested it, the docs lie")*
- 30 errors I hit building PMax campaigns through the API — and the fixes → `feedback/feedback_google_ads_api_pmax`
- Your PMax "win" is 30%+ your own brand name — cap it and watch the truth come out → a fragrance client's lesson, pairs with `evergreen-what-pmax-actually-is`
- AI Max quietly blew past the CPC ceiling — R57 clicks against a R50 max → a pest-control client's lesson (anonymise)
- Your ROAS is double-counted: stacked conversion values showing 5.89x when reality was 1.25x → an education client's audit (anonymise)
- 73% of this account's "conversions" were people asking for directions → a workshop client's lesson (anonymise): define what a conversion IS before optimising to it
- Meta targeting IDs repeat across countries — I targeted the wrong country's audience and only read-back caught it → `feedback/meta-ads-targeting-validation`
- The Shopping bidding ladder: brand/non-brand split + when to climb → `docs/google-shopping-playbook`
- Feed attributes are separate jobs: product_type ≠ Google category ≠ brand ≠ MPN, custom labels LAST → `feedback/feed-attributes-are-mutually-exclusive` *(feeds the e-com strand)*

**SEO receipts:**
- 6,953 clicks in Search Console, 4 sessions in GA4 — the site was ranking and nobody could prove it → a sports-media client's lesson (anonymise): untracked SEO is unpaid SEO
- They removed one plugin and lost 95 page titles and metas overnight → a lodge client's Yoast lesson (anonymise): your SEO lives in a plugin you don't back up

**AI for marketers (the "file management / retrieval" ideas, answered from our own build):**
- Regex first, AI last: 95% of "AI tasks" don't need AI → `system/regex-vs-llm`
- How I gave my AI a memory that survives: per-client state files, decisions, lessons → the whole claude-memory architecture (extends `build-claude-operations`)
- Retrieval isn't search: the 4-phase progressive refinement we actually use → `system/iterative-retrieval`
- Never let AI say "done" without proof: the verification protocol → `system/verification-protocol` + `feedback/read-back-before-claiming-state`
- Direct APIs vs MCP hype: why we ripped MCP out and built wrappers → `system/mcp-policy`, `feedback/pipelines-over-mcp` *(spicy, current, contrarian)*
- The 3-strikes debugging rule and why AI needs it more than you do → `system/debugging-protocol`
- Wrong endpoint ≠ missing data: exhaust the API before declaring a gap → `feedback/wrong-endpoint-not-missing-data`
- Token economics: what it actually costs to run AI all day and where the waste hides → `system/context-budget`

## Standing context (from lost session)

- This is **Sean personally**, not Top Click. Platforms: Meta, TikTok, LinkedIn (primary).
- Recording method: Josh-style rolling take — repeat each beat until clean, edit later. Beats checklist in the app supports this.
- Matt Peacock's glossary lives on the Mac Mini — no SSH route yet, fetch later.
- App stays on git (no server), so it's reachable from the other Mac Mini.
