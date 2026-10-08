/* MOUTHPIECE — vanilla JS, no build step.
   Two things per pillar, nothing else:
     NEWS   = what happened. Items Claude has read carry a brief (synopsis + the interesting bits + sources).
     VIDEOS = what Sean says about it. Synopsis → my talking points → your points → things to say → receipts.
   Data = data/cards.json + data/news.json (canonical)
   + localStorage overlay (recorded, skip, point ticks, dropped ideas, pillar assignments). */

(() => {
  "use strict";

  const LS = {
    status: "mouthpiece.status.v1", // { cardId: "fresh"|"skipped"|... } — only "skipped" (and legacy "recorded") still matter
    beats:  "mouthpiece.beats.v1",  // { cardId: [bool, ...] }
    drops:  "mouthpiece.drops.v1",  // [ card, ... ] (type "idea", beats [])
    pillar: "mouthpiece.pillar.v1", // { cardId: "SEM"|"SEO"|"SMA"|"AI" } — assigns a pillar to unfiled drops
    stage:  "mouthpiece.stage.v1",  // { cardId: "recorded" } — older stage values are ignored; only recorded matters now
  };

  const PILLARS = ["SEM", "SEO", "SMA", "AI"];
  const PILLAR_SUB = {
    SEM: "Search engine marketing — all Google things live here",
    SEO: "Organic: content, PR, structure, visibility",
    SMA: "Social media ads: Meta, TikTok, LinkedIn",
    AI:  "Skills, jobs, vibe-coding, APIs",
  };
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

    cards = drops.concat(Array.isArray(baseCards) ? baseCards : []).map(c => {
      const status = statusOverlay[c.id] || c.status || "fresh";
      return {
        ...c,
        pillar: pillarOverlay[c.id] || c.pillar || TOPIC_TO_PILLAR[c.topic] || null,
        status,
        recorded: stageOverlay[c.id] === "recorded" || status === "recorded",
      };
    });
    cards.sort((a, b) => (b.created || "").localeCompare(a.created || ""));

    news = Array.isArray(baseNews) ? baseNews : [];
  }

  function has(arr) { return Array.isArray(arr) && arr.length > 0; }

  // Where a video sits. Ready = has talking points AND receipts. Everything else needs research.
  function videoState(c) {
    if (c.status === "skipped") return "skipped";
    if (c.recorded) return "recorded";
    if (has(c.beats) && has(c.facts)) return "ready";
    return "research";
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
      note: "talking points pending — talk it through with Claude",
      status: "fresh",
      platforms: ["tiktok", "linkedin", "meta"],
    };
    const drops = lsGet(LS.drops, []);
    drops.unshift(card);
    lsSet(LS.drops, drops);
    cards.unshift({ ...card, recorded: false });
    return card;
  }

  // ---- talk time ----

  function talkSeconds(c) {
    const points = (has(c.beats) ? c.beats.length : 0) + (has(c.your_points) ? c.your_points.length : 0);
    return points * SECONDS_PER_POINT;
  }
  function fmtTime(s) {
    const m = Math.floor(s / 60), r = s % 60;
    return "~" + m + ":" + String(r).padStart(2, "0");
  }

  // ---- counts ----

  function pillarNews(p) {
    return news.filter(n => n.pillar === p && n.status !== "ignored");
  }

  function pillarCounts(p) {
    const inPillar = cards.filter(c => c.pillar === p);
    return {
      news: news.filter(n => n.pillar === p && n.status === "new").length,
      ready: inPillar.filter(c => videoState(c) === "ready").length,
      research: inPillar.filter(c => videoState(c) === "research").length,
    };
  }

  // ---- rendering helpers ----

  const $ = sel => document.querySelector(sel);

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function subjectLabel(s) { return s ? s.replace(/-/g, " ") : s; }

  function urlHost(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
  }

  function extLink(cls, text, url) {
    const a = el("a", cls, text);
    a.href = url; a.target = "_blank"; a.rel = "noopener";
    return a;
  }

  function label(text) { return el("p", "beats-label", text); }

  function nudge(text) { return el("p", "facts-nudge", text); }

  // ---- home ----

  function renderHome() {
    const tiles = $("#pillar-tiles");
    tiles.replaceChildren(...PILLARS.map(p => {
      const n = pillarCounts(p);
      const a = el("a", "tile");
      a.href = "#/pillar/" + p;
      a.append(el("h2", "tile-name", p));
      a.append(el("p", "tile-sub", PILLAR_SUB[p]));
      const counts = el("div", "tile-counts");
      counts.append(
        tileCount(n.ready, "ready to record"),
        tileCount(n.research, "need research"),
        tileCount(n.news, "news"),
      );
      a.append(counts);
      return a;
    }));

    const unfiled = cards.filter(c => !c.pillar && videoState(c) !== "skipped" && !c.recorded);
    const row = $("#unfiled-row");
    row.hidden = unfiled.length === 0;
    row.textContent = unfiled.length + " unfiled drop" + (unfiled.length === 1 ? "" : "s") + " — tap to file";
  }

  function tileCount(n, text) {
    const d = el("div", "tile-count" + (n > 0 ? " has" : ""));
    d.append(el("span", "n", String(n)), el("span", "l", text));
    return d;
  }

  // ---- pillar view: two tabs, Videos | News ----

  function videoRow(c, fromPillar) {
    const li = el("li");
    const a = el("a", "card");
    a.href = "#/card/" + encodeURIComponent(c.id) + (fromPillar ? "?from=" + fromPillar : "");

    const meta = el("div", "card-meta");
    if (c.subject) meta.append(el("span", "badge", subjectLabel(c.subject)));
    const secs = talkSeconds(c);
    if (secs) meta.append(el("span", "badge", fmtTime(secs)));
    if (has(c.facts)) meta.append(el("span", "badge", c.facts.length + " receipts"));

    a.append(meta, el("h3", null, c.title), el("p", "story", c.synopsis || c.story));
    li.append(a);
    return li;
  }

  function group(title, list, fromPillar, folded) {
    const wrap = folded ? el("details", "group") : el("section", "group");
    const head = el(folded ? "summary" : "h3", "section-label", title + " (" + list.length + ")");
    wrap.append(head);
    if (list.length) {
      const ul = el("ul", "feed");
      ul.append(...list.map(c => videoRow(c, fromPillar)));
      wrap.append(ul);
    } else if (!folded) {
      wrap.append(el("p", "empty-quiet", "Nothing here yet."));
    }
    return wrap;
  }

  function renderVideos(p) {
    const isUnfiled = p === "unfiled";
    const inPillar = cards.filter(c => (isUnfiled ? !c.pillar : c.pillar === p));
    const by = s => inPillar.filter(c => videoState(c) === s);
    const from = isUnfiled ? "unfiled" : p;
    $("#tab-videos").replaceChildren(
      group("Ready to record", by("ready"), from, false),
      group("Needs research", by("research"), from, false),
      group("Recorded", by("recorded"), from, true),
      group("Skipped", by("skipped"), from, true),
    );
  }

  // Official sources first, items Claude has broken down above those, newest first within each.
  function newsRank(n) { return (n.brief ? 0 : 2) + (n.official ? 0 : 1); }

  function renderNews(p) {
    const items = pillarNews(p).slice().sort((a, b) =>
      newsRank(a) - newsRank(b) || (b.date || "").localeCompare(a.date || ""));

    if (!items.length) {
      $("#tab-news").replaceChildren(el("p", "empty-quiet", "No news for this pillar yet."));
      return;
    }

    const ul = el("ul", "feed");
    ul.append(...items.map(n => {
      const li = el("li");
      const div = el(n.brief ? "a" : "div", "news-item" + (n.brief ? " briefed" : ""));
      if (n.brief) div.href = "#/news/" + encodeURIComponent(n.id);

      const meta = el("div", "card-meta");
      if (n.brief) meta.append(el("span", "badge official", "breakdown"));
      if (n.official) meta.append(el("span", "badge official", "official"));
      if (n.source) meta.append(el("span", "badge source", n.source));
      if (n.date) meta.append(el("span", "badge", n.date));
      div.append(meta, el("h3", null, n.title));

      if (n.brief) {
        div.append(el("p", "story", n.brief.synopsis));
        div.append(el("p", "news-cta", "Read the breakdown →"));
      } else {
        if (n.note) div.append(el("p", "story", n.note));
        if (n.url) div.append(extLink("news-link", "Source — " + urlHost(n.url), n.url));
      }
      li.append(div);
      return li;
    }));
    $("#tab-news").replaceChildren(ul);
  }

  function renderPillar(p, tab) {
    const isUnfiled = p === "unfiled";
    $("#pillar-title").textContent = isUnfiled ? "UNFILED DROPS" : p;

    const tabs = $("#pillar-tabs");
    tabs.hidden = isUnfiled;
    const showNews = !isUnfiled && tab === "news";

    if (!isUnfiled) {
      const videoCount = cards.filter(c => c.pillar === p && ["ready", "research"].includes(videoState(c))).length;
      const newsCount = pillarNews(p).length;
      tabs.replaceChildren(
        tabLink("Videos (" + videoCount + ")", "#/pillar/" + p, !showNews),
        tabLink("News (" + newsCount + ")", "#/pillar/" + p + "/news", showNews),
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

  function renderNewsDetail(id) {
    const n = news.find(x => x.id === id);
    const root = $("#news-detail");
    $("#news-back").href = n ? "#/pillar/" + n.pillar + "/news" : "#/";

    if (!n) {
      root.replaceChildren(el("p", "empty", "NEWS ITEM NOT FOUND."));
      return;
    }
    root.replaceChildren();

    const meta = el("div", "card-meta");
    if (n.official) meta.append(el("span", "badge official", "official"));
    if (n.source) meta.append(el("span", "badge source", n.source));
    if (n.date) meta.append(el("span", "badge", n.date));
    root.append(meta, el("h2", null, n.title));

    const b = n.brief;
    if (!b) {
      root.append(nudge("Not broken down yet — ask Claude to read it."));
      if (n.url) root.append(extLink("news-link", "Source — " + urlHost(n.url), n.url));
      return;
    }

    const syn = el("div", "angle");
    syn.append(el("p", "label", "Synopsis"), el("p", null, b.synopsis));
    root.append(syn);

    if (has(b.bits)) {
      root.append(label("The interesting bits"));
      const ol = el("ol", "bits");
      b.bits.forEach(t => ol.append(el("li", null, t)));
      root.append(ol);
    }

    if (has(b.sources)) {
      root.append(label("Sources — what Claude read"));
      const ul = el("ul", "fact-list");
      b.sources.forEach(s => {
        const li = el("li", "fact");
        if (s.official) {
          const m = el("div", "card-meta");
          m.append(el("span", "badge official", "official"));
          li.append(m);
        }
        li.append(el("p", "fact-claim", s.label));
        if (s.url) li.append(extLink("fact-source", "Open — " + urlHost(s.url), s.url));
        ul.append(li);
      });
      root.append(ul);
    }

    if (n.card && cards.some(c => c.id === n.card)) {
      const a = el("a", "btn btn-accent btn-link", "The video for this →");
      a.href = "#/card/" + encodeURIComponent(n.card) + "?from=" + n.pillar;
      root.append(a);
    }
  }

  // ---- video (card) view ----

  function renderCard(id, from) {
    const c = cards.find(x => x.id === id);
    const root = $("#card-detail");
    const backTo = from || (c && c.pillar) || (c && !c.pillar ? "unfiled" : null);
    $("#card-back").href = backTo ? "#/pillar/" + backTo : "#/";

    if (!c) {
      root.replaceChildren(el("p", "empty", "CARD NOT FOUND."));
      return;
    }

    root.replaceChildren();
    const state = videoState(c);

    const meta = el("div", "card-meta");
    if (c.pillar) meta.append(el("span", "badge pillar", c.pillar));
    if (c.subject) meta.append(el("span", "badge", subjectLabel(c.subject)));
    const secs = talkSeconds(c);
    if (secs) meta.append(el("span", "badge", fmtTime(secs) + " talk time"));
    if (state === "recorded") meta.append(el("span", "badge status-recorded", "recorded"));
    if (state === "skipped") meta.append(el("span", "badge status-skipped", "skipped"));
    root.append(meta);

    root.append(el("h2", null, c.title));

    // unfiled drop: one tap files it under a pillar
    if (!c.pillar) {
      root.append(label("File under"));
      const row = el("div", "drop-pillars");
      PILLARS.forEach(p => {
        const b = el("button", "btn pillar-btn", p);
        b.type = "button";
        b.addEventListener("click", () => {
          setPillar(c.id, p);
          location.hash = "#/pillar/" + p;
        });
        row.append(b);
      });
      root.append(row);
    }

    // 1. synopsis
    const syn = el("div", "angle");
    syn.append(el("p", "label", "Synopsis"), el("p", null, c.synopsis || c.story));
    root.append(syn);

    // 2. my talking points — tick as you nail them
    root.append(label("My talking points — tick as you go"));
    if (has(c.beats)) {
      const ul = el("ul", "beats");
      const ticks = getTicks(c.id, c.beats.length);
      c.beats.forEach((beat, i) => {
        const li = el("li");
        const btn = el("button", "beat" + (ticks[i] ? " done" : ""));
        btn.type = "button";
        btn.setAttribute("aria-pressed", String(!!ticks[i]));
        const tick = el("span", "tick", ticks[i] ? "✓" : "");
        btn.append(tick, el("span", "beat-text", beat));
        btn.addEventListener("click", () => {
          const on = toggleTick(c.id, i, c.beats.length);
          btn.classList.toggle("done", on);
          btn.setAttribute("aria-pressed", String(on));
          tick.textContent = on ? "✓" : "";
        });
        li.append(btn);
        ul.append(li);
      });
      root.append(ul);
    } else {
      root.append(nudge(c.note || "Talking points pending — talk it through with Claude."));
    }

    // 3. your points
    root.append(label("Your points"));
    if (has(c.your_points)) {
      const ul = el("ul", "plain-list");
      c.your_points.forEach(t => ul.append(el("li", null, t)));
      root.append(ul);
    } else {
      root.append(nudge("Nothing yet — tell Claude what you want said and it lands here."));
    }

    // 4. things to say — the lines worth saying word for word
    root.append(label("Things to say"));
    if (has(c.lines)) {
      const ul = el("ul", "lines");
      c.lines.forEach(l => {
        const li = el("li", "line");
        if (l.kind) li.append(el("span", "line-kind", l.kind));
        li.append(el("p", null, "“" + (l.text || l) + "”"));
        ul.append(li);
      });
      root.append(ul);
    } else {
      root.append(nudge("Hook, punch lines and closer — once we've talked it through."));
    }

    // 5. folded: the angle + receipts
    if (c.angle) {
      const d = el("details", "fold");
      d.append(el("summary", "section-label", "The angle"), el("p", "fold-body", c.angle));
      root.append(d);
    }

    const r = el("details", "fold");
    r.append(el("summary", "section-label", "Receipts (" + (has(c.facts) ? c.facts.length : 0) + ")"));
    if (has(c.facts)) {
      const ul = el("ul", "fact-list");
      c.facts.forEach(f => {
        const li = el("li", "fact");
        li.append(el("p", "fact-claim", f.claim));
        if (f.source) li.append(extLink("fact-source", "Source — " + urlHost(f.source), f.source));
        ul.append(li);
      });
      r.append(ul);
    } else {
      r.append(nudge("No receipts yet — research with Claude before recording."));
    }
    root.append(r);

    if (c.newsRef && news.some(n => n.id === c.newsRef && n.brief)) {
      const a = el("a", "news-cta block", "From the news — read the breakdown →");
      a.href = "#/news/" + encodeURIComponent(c.newsRef);
      root.append(a);
    }

    // actions: recorded toggle + skip off-ramp
    const actions = el("div", "actions");
    if (state !== "skipped") {
      const rec = el("button", "btn" + (c.recorded ? "" : " btn-accent"), c.recorded ? "Not recorded yet" : "Mark recorded");
      rec.type = "button";
      rec.addEventListener("click", () => { setRecorded(c.id, !c.recorded); renderCard(c.id, from); });
      actions.append(rec);
    }
    const skip = el("button", "btn" + (state === "skipped" ? "" : " btn-danger"),
      state === "skipped" ? "Bring it back" : "Skip");
    skip.type = "button";
    skip.addEventListener("click", () => {
      if (state === "skipped") {
        setStatus(c.id, "fresh");
        renderCard(c.id, from);
      } else {
        setStatus(c.id, "skipped");
        location.hash = backTo ? "#/pillar/" + backTo : "#/";
      }
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
      const b = el("button", "btn pillar-btn", p);
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
