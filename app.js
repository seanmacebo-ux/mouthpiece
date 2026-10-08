/* MOUTHPIECE — vanilla JS, no build step.
   Two things per pillar, nothing else:
     NEWS   = what happened. Items Claude has read carry a brief (synopsis + the interesting bits + sources),
              and every item shows a trail of where it's at.
     VIDEOS = what Sean says about it. Each names who it's for, where it goes, and whether Sean has agreed it.
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
    stage:  "mouthpiece.stage.v1",  // { cardId: "recorded" } — only recorded matters now
    agree:  "mouthpiece.agree.v1",  // { cardId: "YYYY-MM-DD" } — Sean signed off on this video
  };

  const PILLARS = ["SEM", "SEO", "SMA", "AI"];
  const PILLAR_SUB = {
    SEM: "Google Ads + Microsoft Ads",
    SEO: "Organic, local, and AI answers",
    SMA: "Meta, TikTok, LinkedIn",
    AI:  "How a marketer actually uses it",
  };
  const PLATFORM_LABEL = { tiktok: "TikTok", meta: "Reels", linkedin: "LinkedIn" };
  // Legacy topic → pillar (old drops in localStorage may still carry a topic).
  const TOPIC_TO_PILLAR = { "paid-media": "SEM", "seo": "SEO", "ai": "AI", "content": "SEO", "social-ads": "SMA" };

  // Talk-time estimate: a talking point riffed on camera runs ~20s.
  const SECONDS_PER_POINT = 20;

  let cards = [];
  let news = [];

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
    const [baseCards, baseNews] = await Promise.all([
      fetchJson("data/cards.json"),
      fetchJson("data/news.json"),
    ]);

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

  // Where a video sits:
  //   ready    = Sean agreed it + it has talking points + receipts
  //   signoff  = has talking points + receipts, waiting on Sean
  //   research = missing receipts (or talking points)
  function videoState(c) {
    if (c.status === "skipped") return "skipped";
    if (c.recorded) return "recorded";
    const researched = has(c.beats) && has(c.facts);
    if (researched && c.agreed) return "ready";
    if (researched) return "signoff";
    return "research";
  }

  function setAgreed(id, on) {
    const overlay = lsGet(LS.agree, {});
    if (on) overlay[id] = new Date().toISOString().slice(0, 10); else delete overlay[id];
    lsSet(LS.agree, overlay);
    const card = cards.find(c => c.id === id);
    if (card) card.agreed = on ? overlay[id] : null;
  }

  function setRecorded(id, on) {
    const overlay = lsGet(LS.stage, {});
    if (on) overlay[id] = "recorded"; else delete overlay[id];
    lsSet(LS.stage, overlay);
    // clear a legacy "recorded" status so un-recording sticks
    const status = lsGet(LS.status, {});
    if (status[id] === "recorded") { status[id] = "fresh"; lsSet(LS.status, status); }
    const card = cards.find(c => c.id === id);
    if (card) { card.recorded = on; if (card.status === "recorded") card.status = "fresh"; }
  }

  function setStatus(id, status) {
    const overlay = lsGet(LS.status, {});
    overlay[id] = status;
    lsSet(LS.status, overlay);
    const card = cards.find(c => c.id === id);
    if (card) card.status = status;
  }

  function setPillar(id, pillar) {
    const overlay = lsGet(LS.pillar, {});
    overlay[id] = pillar;
    lsSet(LS.pillar, overlay);
    const card = cards.find(c => c.id === id);
    if (card) card.pillar = pillar;
  }

  function getTicks(id, len) {
    const all = lsGet(LS.beats, {});
    const ticks = Array.isArray(all[id]) ? all[id] : [];
    return Array.from({ length: len }, (_, i) => !!ticks[i]);
  }
  function toggleTick(id, index, len) {
    const all = lsGet(LS.beats, {});
    const ticks = getTicks(id, len);
    ticks[index] = !ticks[index];
    all[id] = ticks;
    lsSet(LS.beats, all);
    return ticks[index];
  }

  function addDrop(text, pillar) {
    const now = new Date();
    const card = {
      id: "drop-" + now.getTime(),
      created: now.toISOString().slice(0, 10),
      type: "idea",
      pillar: pillar || null,
      subject: null,
      title: text.length > 64 ? text.slice(0, 61).trimEnd() + "…" : text,
      story: text,
      source: null,
      angle: null,
      beats: [],
      note: "Talking points pending — talk it through with Claude.",
      status: "fresh",
      platforms: ["tiktok", "linkedin", "meta"],
    };
    const drops = lsGet(LS.drops, []);
    drops.unshift(card);
    lsSet(LS.drops, drops);
    cards.unshift({ ...card, recorded: false, agreed: null });
    return card;
  }

  // ---- derived labels ----

  function talkSeconds(c) {
    const points = (has(c.beats) ? c.beats.length : 0) + (has(c.your_points) ? c.your_points.length : 0);
    return points * SECONDS_PER_POINT;
  }
  function fmtTime(s) {
    const m = Math.floor(s / 60), r = s % 60;
    return "~" + m + ":" + String(r).padStart(2, "0");
  }
  function whereLabel(c) {
    const p = (c.platforms || []).map(x => PLATFORM_LABEL[x]).filter(Boolean);
    return p.length ? p.join(" + ") : null;
  }
  function stateLabel(c) {
    return { ready: "Agreed", signoff: "Not agreed", research: "Needs research",
             recorded: "Recorded", skipped: "Skipped" }[videoState(c)];
  }
  function fmtDate(d) {
    if (!d) return "";
    const dt = new Date(d + "T00:00:00");
    return isNaN(dt) ? d : dt.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
  }

  // ---- counts ----

  function pillarNews(p) {
    return news.filter(n => n.pillar === p && n.status !== "ignored");
  }

  function pillarCounts(p) {
    const inPillar = cards.filter(c => c.pillar === p);
    const n = s => inPillar.filter(c => videoState(c) === s).length;
    return { ready: n("ready"), signoff: n("signoff"), research: n("research"), news: pillarNews(p).length };
  }

  // ---- rendering helpers ----

  const $ = sel => document.querySelector(sel);

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function urlHost(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
  }

  function extLink(cls, text, url) {
    const a = el("a", cls, text);
    a.href = url; a.target = "_blank"; a.rel = "noopener";
    return a;
  }

  function label(text) { return el("span", "label", text); }

  function sec(title, ...children) {
    const s = el("div", "sec");
    s.append(label(title), ...children);
    return s;
  }

  // facts line: [["For", "Business owners"], [null, "~1:20"]]
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

  // ---- home ----

  function renderHome() {
    $("#pillar-tiles").replaceChildren(...PILLARS.map(p => {
      const n = pillarCounts(p);
      const a = el("a", "pillar-row");
      a.href = "#/pillar/" + p;
      a.append(el("h2", null, p), el("p", null, PILLAR_SUB[p]));
      a.append(factsLine([
        [null, n.ready + " ready", n.ready ? "hot" : null],
        [null, n.signoff + " need your OK"],
        [null, n.research + " need research"],
        [null, n.news + " news"],
      ]));
      return a;
    }));

    const unfiled = cards.filter(c => !c.pillar && videoState(c) !== "skipped" && !c.recorded);
    const row = $("#unfiled-row");
    row.hidden = unfiled.length === 0;
    row.textContent = unfiled.length + " unfiled drop" + (unfiled.length === 1 ? "" : "s") + " — tap to file";
  }

  // ---- pillar view: Videos | News ----

  function videoRow(c, fromPillar) {
    const li = el("li");
    const a = el("a", "row");
    a.href = "#/card/" + encodeURIComponent(c.id) + (fromPillar ? "?from=" + fromPillar : "");
    const secs = talkSeconds(c);
    a.append(el("h3", null, c.title), factsLine([
      ["For", c.audience],
      [null, secs ? fmtTime(secs) : null],
      [null, stateLabel(c)],
    ]));
    li.append(a);
    return li;
  }

  function group(title, hint, list, fromPillar, folded) {
    const wrap = el(folded ? "details" : "section", "group");
    const head = el(folded ? "summary" : "span", "label");
    head.append(el("span", null, title + " · " + list.length));
    wrap.append(head);
    if (hint && !folded) wrap.append(el("p", "group-hint", hint));
    if (list.length) {
      const ul = el("ul", "feed");
      ul.append(...list.map(c => videoRow(c, fromPillar)));
      wrap.append(ul);
    } else if (!folded) {
      wrap.append(el("p", "quiet", "Nothing here yet."));
    }
    return wrap;
  }

  function renderVideos(p) {
    const isUnfiled = p === "unfiled";
    const inPillar = cards.filter(c => (isUnfiled ? !c.pillar : c.pillar === p));
    const by = s => inPillar.filter(c => videoState(c) === s);
    const from = isUnfiled ? "unfiled" : p;
    $("#tab-videos").replaceChildren(
      group("Ready to record", "You've agreed these and they have receipts.", by("ready"), from, false),
      group("Needs your OK", "Researched, with receipts. Read it, then agree or change it.", by("signoff"), from, false),
      group("Needs research", "No receipts yet — Claude researches before you record.", by("research"), from, false),
      group("Recorded", null, by("recorded"), from, true),
      group("Skipped", null, by("skipped"), from, true),
    );
  }

  // Broken-down items first, then official sources, newest first within each.
  function newsRank(n) { return (n.brief ? 0 : 2) + (n.official ? 0 : 1); }

  function renderNews(p) {
    const items = pillarNews(p).slice().sort((a, b) =>
      newsRank(a) - newsRank(b) || (b.date || "").localeCompare(a.date || ""));
    if (!items.length) {
      $("#tab-news").replaceChildren(el("p", "quiet", "No news for this pillar yet."));
      return;
    }
    const ul = el("ul", "feed");
    ul.append(...items.map(n => {
      const li = el("li");
      const a = el("a", "row");
      a.href = "#/news/" + encodeURIComponent(n.id);
      a.append(el("h3", null, n.title));
      if (n.brief) a.append(el("p", null, n.brief.synopsis));
      a.append(factsLine([
        [null, (n.official ? "Official · " : "") + (n.source || ""), n.official ? "official" : null],
        [null, fmtDate(n.date)],
        [null, n.brief ? "Breakdown ready" : "Headline only"],
      ]));
      li.append(a);
      return li;
    }));
    $("#tab-news").replaceChildren(ul);
  }

  function renderPillar(p, tab) {
    const isUnfiled = p === "unfiled";
    $("#pillar-title").textContent = isUnfiled ? "Unfiled drops" : p;

    const tabs = $("#pillar-tabs");
    tabs.hidden = isUnfiled;
    const showNews = !isUnfiled && tab === "news";

    if (!isUnfiled) {
      const videoCount = cards.filter(c => c.pillar === p && ["ready", "signoff", "research"].includes(videoState(c))).length;
      tabs.replaceChildren(
        tabLink("Videos · " + videoCount, "#/pillar/" + p, !showNews),
        tabLink("News · " + pillarNews(p).length, "#/pillar/" + p + "/news", showNews),
      );
    }

    $("#tab-videos").hidden = showNews;
    $("#tab-news").hidden = !showNews;
    if (showNews) renderNews(p); else renderVideos(p);
  }

  function tabLink(text, href, on) {
    const a = el("a", "tab" + (on ? " on" : ""), text);
    a.href = href;
    a.setAttribute("role", "tab");
    a.setAttribute("aria-selected", String(on));
    return a;
  }

  // ---- news breakdown view ----

  // Where this news item is at: pulled in → Claude read it → breakdown → talk it through → video.
  function newsTrail(n) {
    const b = n.brief;
    const card = n.card ? cards.find(c => c.id === n.card) : null;
    const official = b && has(b.sources) ? b.sources.find(s => s.official) : null;
    const steps = [
      ["Pulled in", [fmtDate(n.date), n.source].filter(Boolean).join(" · "), "done"],
      ["Claude read it", b ? [fmtDate(b.read), official ? "the platform's own docs" : "the source"].filter(Boolean).join(" · ") : "Not yet", b ? "done" : "now"],
      ["Breakdown written", b ? fmtDate(b.read) : "—", b ? "done" : "todo"],
    ];
    const agreed = card && card.agreed;
    steps.push(["Talk it through", agreed ? "Done — you agreed the video" : (b ? "Waiting on you" : "—"),
      agreed ? "done" : (b ? "now" : "todo")]);
    steps.push(["Video", card ? stateLabel(card) === "Not agreed" ? "Claude's draft" : stateLabel(card) : "None yet",
      card && card.recorded ? "done" : "todo"]);
    const ul = el("ul", "trail");
    steps.forEach(([t, d, s]) => {
      const li = el("li", s);
      const txt = el("span");
      txt.append(el("b", null, t), el("small", null, d));
      li.append(el("span", "dot"), txt);
      ul.append(li);
    });
    return ul;
  }

  function renderNewsDetail(id) {
    const n = news.find(x => x.id === id);
    const root = $("#news-detail");
    $("#news-back").href = n ? "#/pillar/" + n.pillar + "/news" : "#/";
    if (!n) { root.replaceChildren(el("p", "empty", "News item not found.")); return; }

    const meta = el("div", "meta");
    if (n.official) meta.append(el("span", "hi", "Official · "));
    meta.append([n.source, fmtDate(n.date)].filter(Boolean).join(" · "));
    root.replaceChildren(meta, el("h1", null, n.title), sec("Where this is at", newsTrail(n)));

    const b = n.brief;
    if (!b) {
      root.append(sec("Breakdown", el("p", "quiet", "Not broken down yet — ask Claude to read it.")));
      if (n.url) {
        const srcs = el("ul", "srcs");
        const li = el("li", null, n.source || urlHost(n.url));
        li.append(el("br"), extLink("src-link", "Open source", n.url));
        srcs.append(li);
        root.append(sec("Source", srcs));
      }
      return;
    }

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

    if (n.card && cards.some(c => c.id === n.card)) {
      const a = el("a", "go");
      a.href = "#/card/" + encodeURIComponent(n.card) + "?from=" + n.pillar;
      a.append(el("span", null, "The video draft"), el("span", null, "→"));
      root.append(a);
    }
  }

  // ---- video (card) view ----

  function renderCard(id, from) {
    const c = cards.find(x => x.id === id);
    const root = $("#card-detail");
    const backTo = from || (c && c.pillar) || (c && !c.pillar ? "unfiled" : null);
    $("#card-back").href = backTo ? "#/pillar/" + backTo : "#/";
    if (!c) { root.replaceChildren(el("p", "empty", "Video not found.")); return; }

    const state = videoState(c);
    const meta = el("div", "meta");
    if (c.pillar) meta.append(el("span", "hi", c.pillar));
    if (c.subject) meta.append(" · " + c.subject.replace(/-/g, " "));
    root.replaceChildren(meta, el("h1", null, c.title));

    const secs = talkSeconds(c);
    root.append(factsLine([
      ["For", c.audience],
      [null, whereLabel(c)],
      [null, secs ? fmtTime(secs) : null],
    ]));

    // agreement — the consensus line
    if (state !== "skipped") {
      const ag = el("div", "agree" + (c.agreed ? " yes" : ""));
      const txt = c.agreed ? "You agreed this · " + fmtDate(c.agreed)
        : (state === "research" ? "Claude's draft · needs research before you agree" : "Claude's draft · you haven't agreed this yet");
      const btn = el("button", null, c.agreed ? "Undo" : "Agree →");
      btn.type = "button";
      btn.addEventListener("click", () => { setAgreed(c.id, !c.agreed); renderCard(c.id, from); });
      ag.append(el("span", null, txt), btn);
      root.append(ag);
    }

    // unfiled drop: one tap files it under a pillar
    if (!c.pillar) {
      const row = el("div", "drop-pillars");
      PILLARS.forEach(p => {
        const b = el("button", "pillar-btn", p);
        b.type = "button";
        b.addEventListener("click", () => { setPillar(c.id, p); location.hash = "#/pillar/" + p; });
        row.append(b);
      });
      root.append(sec("File under", row));
    }

    root.append(sec("Synopsis", el("p", "syn", c.synopsis || c.story)));

    // my talking points — numbered, tick as you nail them
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
      root.append(sec("My talking points", ul));
    } else {
      root.append(sec("My talking points", el("p", "quiet", c.note || "Talking points pending — talk it through with Claude.")));
    }

    if (has(c.your_points)) {
      const ul = el("ul", "plain");
      c.your_points.forEach(t => ul.append(el("li", null, t)));
      root.append(sec("Your points", ul));
    } else {
      root.append(sec("Your points", el("p", "quiet", "Nothing yet. Tell Claude what you want said.")));
    }

    if (has(c.lines)) {
      const ul = el("ul", "lines");
      c.lines.forEach(l => {
        const li = el("li");
        li.append(el("span", "label k", l.kind || ""), el("q", null, l.text || l));
        ul.append(li);
      });
      root.append(sec("Things to say", ul));
    } else {
      root.append(sec("Things to say", el("p", "quiet", "Hook, punch line and closer — once we've talked it through.")));
    }

    // folded extras: receipts, the angle, the breakdown link
    const extras = el("div", "sec");
    const r = el("details", "more");
    const rs = el("summary");
    rs.append(el("span", null, "Receipts"), el("span", null, (has(c.facts) ? c.facts.length : 0) + " +"));
    r.append(rs);
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
    r.append(rb);
    extras.append(r);

    if (c.angle) {
      const d = el("details", "more");
      const s = el("summary");
      s.append(el("span", null, "The angle"), el("span", null, "+"));
      d.append(s, el("p", "more-body", c.angle));
      extras.append(d);
    }
    if (c.newsRef && news.some(n => n.id === c.newsRef)) {
      const a = el("a", "more");
      a.href = "#/news/" + encodeURIComponent(c.newsRef);
      a.append(el("span", null, "The breakdown this came from"), el("span", null, "→"));
      extras.append(a);
    }
    root.append(extras);

    // actions: recorded toggle + skip off-ramp
    const actions = el("div", "actions");
    if (state !== "skipped") {
      const rec = el("button", "rec", c.recorded ? "Not recorded yet" : "Mark recorded");
      rec.type = "button";
      rec.addEventListener("click", () => { setRecorded(c.id, !c.recorded); renderCard(c.id, from); });
      actions.append(rec);
    }
    const skip = el("button", state === "skipped" ? "rec" : "skip", state === "skipped" ? "Bring it back" : "Skip");
    skip.type = "button";
    skip.addEventListener("click", () => {
      if (state === "skipped") { setStatus(c.id, "fresh"); renderCard(c.id, from); }
      else { setStatus(c.id, "skipped"); location.hash = backTo ? "#/pillar/" + backTo : "#/"; }
    });
    actions.append(skip);
    root.append(actions);
  }

  // ---- drop view ----

  function wireDrop() {
    const box = $("#drop-text");
    const row = $("#drop-pillars");

    const save = (pillar) => {
      const text = box.value.trim();
      if (!text) return;
      addDrop(text, pillar);
      box.value = "";
      // straight to where it landed — no ceremony
      location.hash = pillar ? "#/pillar/" + pillar : "#/";
    };

    row.replaceChildren(...PILLARS.map(p => {
      const b = el("button", "pillar-btn", p);
      b.type = "button";
      b.addEventListener("click", () => save(p));
      return b;
    }));

    $("#drop-skip").addEventListener("click", () => save(null));
  }

  // ---- routing ----

  function route() {
    const hash = location.hash || "#/";
    const views = {
      home: $("#view-home"), pillar: $("#view-pillar"),
      card: $("#view-card"), news: $("#view-news"), drop: $("#view-drop"),
    };
    Object.values(views).forEach(v => { v.hidden = true; });

    const cardMatch = hash.match(/^#\/card\/([^?]+)(?:\?from=([A-Za-z]+))?$/);
    const newsMatch = hash.match(/^#\/news\/([^?]+)$/);
    const pillarMatch = hash.match(/^#\/pillar\/([A-Za-z]+)(?:\/(news|videos))?$/);

    if (cardMatch) {
      renderCard(decodeURIComponent(cardMatch[1]), cardMatch[2] || null);
      views.card.hidden = false;
    } else if (newsMatch) {
      renderNewsDetail(decodeURIComponent(newsMatch[1]));
      views.news.hidden = false;
    } else if (pillarMatch && (PILLARS.includes(pillarMatch[1]) || pillarMatch[1] === "unfiled")) {
      renderPillar(pillarMatch[1], pillarMatch[2] || "videos");
      views.pillar.hidden = false;
    } else if (hash === "#/drop") {
      views.drop.hidden = false;
      $("#drop-text").focus();
    } else {
      renderHome();
      views.home.hidden = false;
    }
    window.scrollTo(0, 0);
  }

  // ---- boot ----

  async function main() {
    wireDrop();
    await loadData();
    route();
    window.addEventListener("hashchange", route);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => { /* fine on file:// */ });
    }
  }

  main();
})();
