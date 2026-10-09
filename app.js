/* MOUTHPIECE — vanilla JS, no build step.
   Council design (Codex + Antigravity, 2026-10-09): action-first.
     TODAY  = what needs Sean, by urgency: record next → needs your OK → news worth your time.
     VIDEOS = every video, pillar as a filter chip. Card leads with the take ("What I'd tell a client"),
              sticky Agree bar, then Studio mode for recording.
     NEWS   = every item, pillar as a filter chip. Broken-down items open a breakdown.
   A video is READY only when Sean has agreed it AND it has receipts.
   Data = data/cards.json + data/news.json (canonical)
   + localStorage overlay (agreed, recorded, skip, point ticks, dropped ideas, pillar assignments). */

(() => {
  "use strict";

  const LS = {
    status: "mouthpiece.status.v1", // { cardId: "fresh"|"skipped"|... } — only "skipped" (and legacy "recorded") still matter
    beats:  "mouthpiece.beats.v1",  // { cardId: [bool, ...] }
    drops:  "mouthpiece.drops.v1",  // [ card, ... ] (type "idea", beats [])
    pillar: "mouthpiece.pillar.v1", // { cardId: "SEM"|"SEO"|"SMA"|"AI" } — assigns a pillar to unfiled drops
    stage:  "mouthpiece.stage.v1",  // { cardId: "recorded" }
    agree:  "mouthpiece.agree.v1",  // { cardId: "YYYY-MM-DD" } — Sean signed off on this video
  };

  const PILLARS = ["SEM", "SEO", "SMA", "AI"];
  const PLATFORM_LABEL = { tiktok: "TikTok", meta: "Reels", linkedin: "LinkedIn" };
  const TOPIC_TO_PILLAR = { "paid-media": "SEM", "seo": "SEO", "ai": "AI", "content": "SEO", "social-ads": "SMA" };
  const SECONDS_PER_POINT = 20; // a talking point riffed on camera runs ~20s

  let cards = [];
  let news = [];
  let wakeLock = null;

  // ---- storage helpers (fail-open: app must work with storage blocked) ----

  function lsGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked — session-only */ }
  }

  // ---- data ----

  async function fetchJson(path) {
    try {
      const res = await fetch(path, { cache: "no-cache" });
      if (res.ok) return await res.json();
    } catch { /* offline + nothing cached — the rest still works */ }
    return [];
  }

  async function loadData() {
    const [baseCards, baseNews] = await Promise.all([fetchJson("data/cards.json"), fetchJson("data/news.json")]);
    const drops = lsGet(LS.drops, []);
    const statusOverlay = lsGet(LS.status, {});
    const pillarOverlay = lsGet(LS.pillar, {});
    const stageOverlay = lsGet(LS.stage, {});
    const agreeOverlay = lsGet(LS.agree, {});

    cards = drops.concat(Array.isArray(baseCards) ? baseCards : []).map(c => {
      const status = statusOverlay[c.id] || c.status || "fresh";
      return {
        ...c,
        pillar: pillarOverlay[c.id] || c.pillar || TOPIC_TO_PILLAR[c.topic] || null,
        status,
        recorded: stageOverlay[c.id] === "recorded" || status === "recorded",
        agreed: agreeOverlay[c.id] || c.agreed || null,
      };
    });
    cards.sort((a, b) => (b.created || "").localeCompare(a.created || ""));
    news = Array.isArray(baseNews) ? baseNews : [];
  }

  function has(arr) { return Array.isArray(arr) && arr.length > 0; }

  // ready = agreed + talking points + receipts · signoff = researched, waiting on Sean · research = no receipts
  function videoState(c) {
    if (c.status === "skipped") return "skipped";
    if (c.recorded) return "recorded";
    const researched = has(c.beats) && has(c.facts);
    if (researched && c.agreed) return "ready";
    if (researched) return "signoff";
    return "research";
  }

  function setAgreed(id, on) {
    const o = lsGet(LS.agree, {});
    if (on) o[id] = new Date().toISOString().slice(0, 10); else delete o[id];
    lsSet(LS.agree, o);
    const c = cards.find(x => x.id === id);
    if (c) c.agreed = on ? o[id] : null;
  }
  function setRecorded(id, on) {
    const o = lsGet(LS.stage, {});
    if (on) o[id] = "recorded"; else delete o[id];
    lsSet(LS.stage, o);
    const s = lsGet(LS.status, {});
    if (s[id] === "recorded") { s[id] = "fresh"; lsSet(LS.status, s); }
    const c = cards.find(x => x.id === id);
    if (c) { c.recorded = on; if (c.status === "recorded") c.status = "fresh"; }
  }
  function setStatus(id, status) {
    const o = lsGet(LS.status, {});
    o[id] = status;
    lsSet(LS.status, o);
    const c = cards.find(x => x.id === id);
    if (c) c.status = status;
  }
  function setPillar(id, pillar) {
    const o = lsGet(LS.pillar, {});
    o[id] = pillar;
    lsSet(LS.pillar, o);
    const c = cards.find(x => x.id === id);
    if (c) c.pillar = pillar;
  }
  function getTicks(id, len) {
    const all = lsGet(LS.beats, {});
    const t = Array.isArray(all[id]) ? all[id] : [];
    return Array.from({ length: len }, (_, i) => !!t[i]);
  }
  function toggleTick(id, i, len) {
    const all = lsGet(LS.beats, {});
    const t = getTicks(id, len);
    t[i] = !t[i];
    all[id] = t;
    lsSet(LS.beats, all);
    return t[i];
  }

  function addDrop(text, pillar) {
    const now = new Date();
    const card = {
      id: "drop-" + now.getTime(), created: now.toISOString().slice(0, 10), type: "idea",
      pillar: pillar || null, subject: null,
      title: text.length > 64 ? text.slice(0, 61).trimEnd() + "…" : text,
      story: text, source: null, angle: null, beats: [],
      note: "Talking points pending — talk it through with Claude.",
      status: "fresh", platforms: ["tiktok", "linkedin", "meta"],
    };
    const drops = lsGet(LS.drops, []);
    drops.unshift(card);
    lsSet(LS.drops, drops);
    cards.unshift({ ...card, recorded: false, agreed: null });
    return card;
  }

  // ---- derived labels ----

  // The take = one sentence Sean would say to a client. Until he writes one, use the
  // first sentence of the angle (the opinion), not the synopsis (the summary).
  const firstSentence = s => (s || "").split(/(?<=[.!?])\s+/)[0];
  const take = c => c.take || firstSentence(c.angle) || c.synopsis || c.story || "";
  function talkSeconds(c) {
    return ((has(c.beats) ? c.beats.length : 0) + (has(c.your_points) ? c.your_points.length : 0)) * SECONDS_PER_POINT;
  }
  function fmtTime(s) { return "~" + Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
  function whereLabel(c) {
    const p = (c.platforms || []).map(x => PLATFORM_LABEL[x]).filter(Boolean);
    return p.length ? p.join(" + ") : null;
  }
  function stateLabel(c) {
    return { ready: "Agreed", signoff: "Waiting on your OK", research: "Needs research",
             recorded: "Recorded", skipped: "Skipped" }[videoState(c)];
  }
  function fmtDate(d) {
    if (!d) return "";
    const dt = new Date(d.length === 10 ? d + "T00:00:00" : d);
    return isNaN(dt) ? d : dt.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
  }
  const newsRank = n => (n.brief ? 0 : 2) + (n.official ? 0 : 1);
  const sortNews = list => list.slice().sort((a, b) => newsRank(a) - newsRank(b) || (b.date || "").localeCompare(a.date || ""));

  // ---- DOM helpers ----

  const $ = sel => document.querySelector(sel);
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function link(cls, text, href) { const a = el("a", cls, text); a.href = href; return a; }
  function extLink(cls, text, url) { const a = link(cls, text, url); a.target = "_blank"; a.rel = "noopener"; return a; }
  function urlHost(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } }
  function label(text) { return el("span", "label", text); }
  function sec(title, ...kids) { const s = el("div", "sec"); s.append(label(title), ...kids); return s; }
  function factsLine(parts) {
    const d = el("div", "facts");
    parts.filter(p => p && p[1]).forEach(([pre, val, cls]) => {
      const s = el("span");
      if (pre) s.append(pre + " ");
      s.append(el("b", cls || null, val));
      d.append(s);
    });
    return d;
  }
  function metaLine(...bits) { return el("div", "meta", bits.filter(Boolean).join(" · ")); }

  // ---- rows ----

  function videoRow(c) {
    const li = el("li");
    const a = link("row", null, "#/card/" + encodeURIComponent(c.id));
    const secs = talkSeconds(c);
    a.append(
      metaLine(c.pillar || "Unfiled", c.audience ? "For " + c.audience : null),
      el("h3", null, c.title),
      el("p", null, take(c)),
      factsLine([[null, secs ? fmtTime(secs) : null], [null, stateLabel(c), "need"]]),
    );
    li.append(a);
    return li;
  }

  function newsRow(n) {
    const li = el("li");
    const a = link("row", null, "#/news/" + encodeURIComponent(n.id));
    a.append(
      metaLine(n.official ? "Official" : null, n.source, fmtDate(n.date), n.pillar),
      el("h3", null, n.title),
    );
    if (n.brief) {
      a.append(el("p", null, n.brief.bits && n.brief.bits[0] ? n.brief.bits[0] : n.brief.synopsis));
      a.append(factsLine([[null, "Breakdown ready", "need"]]));
    } else if (n.note) {
      a.append(el("p", null, n.note));
    }
    li.append(a);
    return li;
  }

  function feed(items, rowFn) {
    const ul = el("ul", "feed");
    ul.append(...items.map(rowFn));
    return ul;
  }

  // ---- TODAY ----

  function renderToday() {
    const root = $("#view-today");
    const live = cards.filter(c => c.pillar);
    const ready = live.filter(c => videoState(c) === "ready");
    const waiting = live.filter(c => videoState(c) === "signoff");
    const unfiled = cards.filter(c => !c.pillar && !["skipped", "recorded"].includes(videoState(c)));

    const head = el("div", "desk-head");
    head.append(el("h2", null, "On your desk"),
      el("p", null, ready.length + " ready to record · " + waiting.length + " waiting on your OK"));
    root.replaceChildren(head);

    // lead: record next if anything's agreed, otherwise review next
    const lead = ready[0] || waiting[0];
    if (lead) {
      const isRecord = videoState(lead) === "ready";
      const box = el("section", "lead");
      box.append(
        el("span", "label", isRecord ? "Record next" : "Review next"),
        metaLine(lead.pillar, lead.audience ? "For " + lead.audience : null, whereLabel(lead)),
        el("h3", null, lead.title),
        el("p", "take", take(lead)),
      );
      const btn = link("primary", null, isRecord ? "#/studio/" + encodeURIComponent(lead.id) : "#/card/" + encodeURIComponent(lead.id));
      btn.append(el("span", null, isRecord ? "Enter studio" : "Review & agree"), el("span", null, "→"));
      box.append(btn);
      root.append(box);
    } else {
      root.append(el("p", "quiet", "Nothing researched yet. Ask Claude to research a video."));
    }

    const moreReady = ready.slice(1, 4);
    if (moreReady.length) root.append(block("Ready to record", "#/videos", "All " + ready.length, feed(moreReady, videoRow)));

    const moreWaiting = waiting.filter(c => c !== lead).slice(0, 3);
    if (moreWaiting.length) root.append(block("Needs your OK", "#/videos", "All " + waiting.length, feed(moreWaiting, videoRow)));

    const briefed = sortNews(news.filter(n => n.brief)).slice(0, 2);
    const fresh = briefed.length >= 2 ? briefed : briefed.concat(sortNews(news.filter(n => !n.brief && n.official)).slice(0, 2 - briefed.length));
    if (fresh.length) root.append(block("News worth your time", "#/news", "All " + news.length, feed(fresh, newsRow)));

    if (unfiled.length) root.append(block("Unfiled ideas", "#/videos", null, feed(unfiled, videoRow)));
  }

  function block(title, href, linkText, content) {
    const b = el("section", "block");
    const h = el("div", "block-head");
    h.append(label(title));
    if (linkText) h.append(link(null, linkText + " →", href));
    b.append(h, content);
    return b;
  }

  // ---- chips ----

  function chips(container, base, current) {
    container.replaceChildren(...["All", ...PILLARS].map(p => {
      const on = (p === "All" && !current) || p === current;
      return link("chip" + (on ? " on" : ""), p, p === "All" ? base : base + "/" + p);
    }));
  }

  // ---- VIDEOS ----

  function group(title, list, folded) {
    const wrap = el(folded ? "details" : "section", "group");
    const head = el(folded ? "summary" : "span", "label");
    head.append(el("span", null, title + " · " + list.length));
    wrap.append(head);
    if (list.length) wrap.append(feed(list, videoRow));
    else if (!folded) wrap.append(el("p", "quiet", "Nothing here."));
    return wrap;
  }

  function renderVideos(pillar) {
    chips($("#videos-chips"), "#/videos", pillar);
    const pool = pillar ? cards.filter(c => c.pillar === pillar) : cards;
    const by = s => pool.filter(c => c.pillar && videoState(c) === s);
    const unfiled = pillar ? [] : cards.filter(c => !c.pillar && !["skipped", "recorded"].includes(videoState(c)));
    const parts = [
      group("Needs your OK", by("signoff"), false),
      group("Ready to record", by("ready"), false),
      group("Needs research", by("research"), true),
    ];
    if (unfiled.length) parts.push(group("Unfiled ideas", unfiled, false));
    parts.push(group("Recorded + skipped", by("recorded").concat(by("skipped")), true));
    $("#videos-list").replaceChildren(...parts);
  }

  // ---- NEWS ----

  function renderNews(pillar) {
    chips($("#news-chips"), "#/news", pillar);
    const items = sortNews(news.filter(n => n.status !== "ignored" && (!pillar || n.pillar === pillar)));
    const briefed = items.filter(n => n.brief);
    const rest = items.filter(n => !n.brief);
    const parts = [];
    if (briefed.length) {
      const s = el("section", "group");
      s.append(el("span", "label", "Broken down · " + briefed.length), feed(briefed, newsRow));
      parts.push(s);
    }
    const s2 = el("section", "group");
    s2.append(el("span", "label", "Headlines only · " + rest.length), feed(rest, newsRow));
    parts.push(s2);
    $("#news-list").replaceChildren(...parts);
  }

  function renderItem(id) {
    const n = news.find(x => x.id === id);
    const root = $("#item-detail");
    $("#item-back").href = n ? "#/news/" + n.pillar : "#/news";
    if (!n) { root.replaceChildren(el("p", "empty", "News item not found.")); return; }

    root.replaceChildren(metaLine(n.official ? "Official" : null, n.source, fmtDate(n.date), n.pillar), el("h1", null, n.title));
    const b = n.brief;
    const card = n.card ? cards.find(c => c.id === n.card) : null;

    if (b) {
      root.append(sec("Synopsis", el("p", "syn", b.synopsis)));
      if (has(b.bits)) {
        const ol = el("ol", "bits");
        b.bits.forEach(t => ol.append(el("li", null, t)));
        root.append(sec("The interesting bits", ol));
      }
      if (has(b.sources)) {
        const ul = el("ul", "srcs");
        b.sources.forEach(s => {
          const li = el("li");
          if (s.official) li.append(el("span", "off", "OFFICIAL"));
          li.append(s.label);
          if (s.url) li.append(el("br"), extLink("src-link", "Open source", s.url));
          ul.append(li);
        });
        root.append(sec("What Claude read", ul));
      }
      if (card) {
        const a = link("primary", null, "#/card/" + encodeURIComponent(card.id));
        a.append(el("span", null, "The video draft"), el("span", null, "→"));
        const w = el("div", "sec");
        w.append(a);
        root.append(w);
      }
    } else {
      root.append(sec("Breakdown", el("p", "quiet", "Not broken down yet — ask Claude to read it.")));
      if (n.url) {
        const ul = el("ul", "srcs");
        const li = el("li", null, n.source || urlHost(n.url));
        li.append(el("br"), extLink("src-link", "Open source", n.url));
        ul.append(li);
        root.append(sec("Source", ul));
      }
    }

    // where this is at — compact, at the bottom (the breakdown comes first)
    const agreed = card && card.agreed;
    const steps = [
      ["Pulled in", "done"],
      ["Claude read it", b ? "done" : "now"],
      ["Breakdown", b ? "done" : ""],
      ["Talk it through", agreed ? "done" : (b ? "now" : "")],
      ["Video", card && card.recorded ? "done" : (agreed ? "now" : "")],
    ];
    const ul = el("ul", "trail");
    steps.forEach(([t, s]) => ul.append(el("li", s || null, t)));
    root.append(sec("Where this is at", ul));
  }

  // ---- VIDEO (card) ----

  function renderCard(id) {
    const c = cards.find(x => x.id === id);
    const root = $("#card-detail");
    $("#card-back").href = c && c.pillar ? "#/videos/" + c.pillar : "#/videos";
    if (!c) { root.replaceChildren(el("p", "empty", "Video not found.")); return; }

    const secs = talkSeconds(c);
    root.replaceChildren(
      metaLine(c.pillar || "Unfiled", c.subject ? c.subject.replace(/-/g, " ") : null),
      el("h1", null, c.title),
      factsLine([["For", c.audience], [null, whereLabel(c)], [null, secs ? fmtTime(secs) : null]]),
    );

    const tb = el("div", "take-block");
    tb.append(label(c.take ? "What I'd tell a client" : "What I'd tell a client · Claude's draft"), el("p", null, take(c)));
    root.append(tb);

    if (!c.pillar) {
      const row = el("div", "file-under");
      PILLARS.forEach(p => {
        const b = el("button", null, p);
        b.type = "button";
        b.addEventListener("click", () => { setPillar(c.id, p); renderCard(c.id); });
        row.append(b);
      });
      root.append(sec("File under", row));
    }

    if (has(c.beats)) {
      const ul = el("ul", "points");
      const ticks = getTicks(c.id, c.beats.length);
      c.beats.forEach((beat, i) => {
        const li = el("li");
        const btn = el("button", "point" + (ticks[i] ? " done" : ""));
        btn.type = "button";
        btn.setAttribute("aria-pressed", String(!!ticks[i]));
        btn.append(el("span", "n", String(i + 1).padStart(2, "0")), el("span", "t", beat));
        btn.addEventListener("click", () => {
          const on = toggleTick(c.id, i, c.beats.length);
          btn.classList.toggle("done", on);
          btn.setAttribute("aria-pressed", String(on));
        });
        li.append(btn);
        ul.append(li);
      });
      root.append(sec("Talking points", ul));
    } else {
      root.append(sec("Talking points", el("p", "quiet", c.note || "Talking points pending — talk it through with Claude.")));
    }

    if (has(c.your_points)) {
      const ul = el("ul", "plain");
      c.your_points.forEach(t => ul.append(el("li", null, t)));
      root.append(sec("Sean's additions", ul));
    } else {
      root.append(sec("Sean's additions", el("p", "quiet", "Nothing yet. Tell Claude what you want said.")));
    }

    if (has(c.lines)) {
      const ul = el("ul", "lines");
      c.lines.forEach(l => {
        const li = el("li");
        li.append(el("span", "label k", l.kind || ""), el("q", null, l.text || l));
        ul.append(li);
      });
      root.append(sec("Hook · punch · closer", ul));
    }

    const extras = el("div", "sec");
    const r = el("details", "more");
    const rs = el("summary");
    rs.append(el("span", null, "Receipts"), el("span", null, (has(c.facts) ? c.facts.length : 0) + " +"));
    const rb = el("div", "more-body");
    if (has(c.facts)) {
      const ul = el("ul", "facts-list");
      c.facts.forEach(f => {
        const li = el("li", null, f.claim);
        if (f.source) li.append(el("br"), extLink("src-link", "Source — " + urlHost(f.source), f.source));
        ul.append(li);
      });
      rb.append(ul);
    } else {
      rb.append(el("p", "quiet", "No receipts yet — research with Claude before recording."));
    }
    r.append(rs, rb);
    extras.append(r);
    if (c.angle) {
      const d = el("details", "more");
      const s = el("summary");
      s.append(el("span", null, "The full angle"), el("span", null, "+"));
      d.append(s, el("p", "more-body", c.angle));
      extras.append(d);
    }
    if (c.newsRef && news.some(n => n.id === c.newsRef)) {
      const a = link("more", null, "#/news/" + encodeURIComponent(c.newsRef));
      a.append(el("span", null, "The news breakdown"), el("span", null, "→"));
      extras.append(a);
    }
    root.append(extras);

    renderActionbar(c);
  }

  function renderActionbar(c) {
    const bar = $("#actionbar");
    const st = videoState(c);
    const ghost = (text, fn, danger) => {
      const b = el("button", "ghost" + (danger ? " danger" : ""), text);
      b.type = "button";
      b.addEventListener("click", fn);
      return b;
    };
    const rerender = () => renderCard(c.id);
    bar.replaceChildren();
    if (st === "signoff") {
      const p = el("button", "primary");
      p.type = "button";
      p.append(el("span", null, "Agree this version"), el("span", null, "✓"));
      p.addEventListener("click", () => { setAgreed(c.id, true); rerender(); });
      bar.append(p, ghost("Skip", () => { setStatus(c.id, "skipped"); rerender(); }, true));
    } else if (st === "ready") {
      bar.append(ghost("Undo OK", () => { setAgreed(c.id, false); rerender(); }));
      const p = link("primary", null, "#/studio/" + encodeURIComponent(c.id));
      p.append(el("span", null, "Enter studio"), el("span", null, "→"));
      bar.append(p);
    } else if (st === "research") {
      bar.append(el("span", "state", "Needs receipts before you agree. Ask Claude to research it."),
        ghost("Skip", () => { setStatus(c.id, "skipped"); rerender(); }, true));
    } else if (st === "recorded") {
      bar.append(el("span", "state", "Recorded."), ghost("Not recorded", () => { setRecorded(c.id, false); rerender(); }));
    } else {
      bar.append(el("span", "state", "Skipped."), ghost("Bring it back", () => { setStatus(c.id, "fresh"); rerender(); }));
    }
    bar.hidden = false;
  }

  // ---- STUDIO (recording mode) ----

  async function holdScreen() {
    try { if ("wakeLock" in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request("screen"); } catch { /* not supported */ }
  }
  function releaseScreen() {
    try { if (wakeLock) wakeLock.release(); } catch { /* ignore */ }
    wakeLock = null;
  }

  function renderStudio(id) {
    const c = cards.find(x => x.id === id);
    const root = $("#view-studio");
    if (!c) { root.replaceChildren(el("p", "empty", "Video not found.")); return; }
    const lines = has(c.lines) ? c.lines : [];
    const hook = lines.find(l => l.kind === "hook");
    const closer = lines.find(l => l.kind === "closer");
    const beats = has(c.beats) ? c.beats : [];
    const ticks = getTicks(c.id, beats.length);

    const top = el("div", "studio-top");
    const progress = el("span", "progress");
    const updateProgress = () => { progress.textContent = getTicks(c.id, beats.length).filter(Boolean).length + " / " + beats.length; };
    top.append(link(null, "← Exit studio", "#/card/" + encodeURIComponent(c.id)), progress);
    root.replaceChildren(top);

    root.append(el("span", "label", "Hook"), el("p", "say", hook ? hook.text : c.title));
    root.append(el("span", "label", "Talking points — tap as you nail them"));
    const ul = el("ul", "studio-points");
    beats.forEach((b, i) => {
      const li = el("li");
      const btn = el("button", ticks[i] ? "done" : null, b);
      btn.type = "button";
      btn.addEventListener("click", () => { btn.classList.toggle("done", toggleTick(c.id, i, beats.length)); updateProgress(); });
      li.append(btn);
      ul.append(li);
    });
    root.append(ul);
    if (closer) root.append(el("span", "label", "Closer"), el("p", "say closer", closer.text));
    const done = el("button", "primary done-btn");
    done.type = "button";
    done.append(el("span", null, "Done — mark recorded"), el("span", null, "✓"));
    done.addEventListener("click", () => { setRecorded(c.id, true); location.hash = "#/card/" + encodeURIComponent(c.id); });
    root.append(done);
    updateProgress();
    holdScreen();
  }

  // ---- DROP ----

  function wireDrop() {
    const box = $("#drop-text");
    const save = pillar => {
      const text = box.value.trim();
      if (!text) return;
      const card = addDrop(text, pillar);
      box.value = "";
      location.hash = "#/card/" + encodeURIComponent(card.id);
    };
    $("#drop-pillars").replaceChildren(...PILLARS.map(p => {
      const b = el("button", "pillar-btn", p);
      b.type = "button";
      b.addEventListener("click", () => save(p));
      return b;
    }));
    $("#drop-skip").addEventListener("click", () => save(null));
  }

  // ---- routing ----

  function route() {
    let hash = location.hash || "#/";
    // legacy routes from the pillar-page design
    const legacy = hash.match(/^#\/pillar\/([A-Za-z]+)(\/news)?$/);
    if (legacy) {
      const p = PILLARS.includes(legacy[1]) ? "/" + legacy[1] : "";
      location.replace((legacy[2] ? "#/news" : "#/videos") + p);
      return;
    }
    hash = hash.replace(/\?from=[A-Za-z]+$/, "");

    const views = ["today", "videos", "news", "item", "card", "studio", "drop"];
    views.forEach(v => { $("#view-" + v).hidden = true; });
    $("#actionbar").hidden = true;

    let show = "today", tab = "today";
    let m;
    if ((m = hash.match(/^#\/videos(?:\/([A-Za-z]+))?$/))) {
      show = tab = "videos"; renderVideos(PILLARS.includes(m[1]) ? m[1] : null);
    } else if ((m = hash.match(/^#\/news(?:\/([^/?]+))?$/))) {
      tab = "news";
      if (m[1] && !PILLARS.includes(m[1])) { show = "item"; renderItem(decodeURIComponent(m[1])); }
      else { show = "news"; renderNews(m[1] || null); }
    } else if ((m = hash.match(/^#\/card\/(.+)$/))) {
      show = "card"; tab = "videos"; renderCard(decodeURIComponent(m[1]));
    } else if ((m = hash.match(/^#\/studio\/(.+)$/))) {
      show = "studio"; tab = null; renderStudio(decodeURIComponent(m[1]));
    } else if (hash === "#/drop") {
      show = "drop"; tab = null;
      setTimeout(() => $("#drop-text").focus(), 0);
    } else {
      renderToday();
    }

    if (show !== "studio") releaseScreen();
    if (show !== "card") $("#actionbar").hidden = true;
    $("#view-" + show).hidden = false;
    const studio = show === "studio";
    $("#topbar").hidden = studio;
    $("#bottomnav").hidden = studio;
    document.querySelectorAll("#bottomnav a").forEach(a => a.classList.toggle("on", a.dataset.tab === tab));
    window.scrollTo(0, 0);
  }

  // ---- boot ----

  async function main() {
    $("#today-date").textContent = new Date().toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
    wireDrop();
    await loadData();
    route();
    window.addEventListener("hashchange", route);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && !$("#view-studio").hidden) holdScreen();
    });
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => { /* fine on file:// */ });
    }
  }

  main();
})();
