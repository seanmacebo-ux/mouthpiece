/* MOUTHPIECE — vanilla JS, no build step.
   Pipeline: Topic (pillar) → News → Angle → Talking points (cards).
   Data = data/cards.json + data/news.json + data/angles.json (canonical)
   + localStorage overlay (status changes, beat ticks, dropped ideas, pillar assignments). */

(() => {
  "use strict";

  const LS = {
    status: "mouthpiece.status.v1", // { cardId: "fresh"|"saved"|"recorded"|"skipped" }
    beats:  "mouthpiece.beats.v1",  // { cardId: [bool, ...] }
    drops:  "mouthpiece.drops.v1",  // [ card, ... ] (type "idea", beats [])
    pillar: "mouthpiece.pillar.v1", // { cardId: "SEM"|"SEO"|"SMA"|"AI" } — assigns a pillar to unfiled drops
  };

  const PILLARS = ["SEM", "SEO", "SMA", "AI"];
  const PILLAR_SUB = {
    SEM: "Search engine marketing — all Google things live here",
    SEO: "Organic: content, PR, structure, visibility",
    SMA: "Social media ads: Meta, TikTok, LinkedIn",
    AI:  "Skills, jobs, vibe-coding, APIs",
  };
  // Subject taxonomy per pillar — labels/filters only, kept lightweight.
  const SUBJECTS = {
    SEM: ["google-ads", "pmax", "ai-max", "shopping", "merchant-centre", "feeds", "microsoft-ads", "tracking"],
    SEO: ["content", "pr", "site-structure", "page-titles", "visibility", "local-profiles", "search-console"],
    SMA: ["meta", "tiktok", "linkedin", "advantage-plus", "targeting", "parameters"],
    AI:  ["skills", "jobs", "vibe-coding", "apis", "retrieval", "file-management"],
  };
  // Legacy topic → pillar (old drops in localStorage may still carry a topic).
  const TOPIC_TO_PILLAR = { "paid-media": "SEM", "seo": "SEO", "ai": "AI", "content": "SEO", "social-ads": "SMA" };

  let cards = [];
  let news = [];
  let angles = [];
  const readyFilter = { status: "torecord" }; // torecord (fresh+saved) | recorded | skipped

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
    const [baseCards, baseNews, baseAngles] = await Promise.all([
      fetchJson("data/cards.json"),
      fetchJson("data/news.json"),
      fetchJson("data/angles.json"),
    ]);

    const drops = lsGet(LS.drops, []);
    const statusOverlay = lsGet(LS.status, {});
    const pillarOverlay = lsGet(LS.pillar, {});

    cards = drops.concat(baseCards).map(c => ({
      ...c,
      pillar: pillarOverlay[c.id] || c.pillar || TOPIC_TO_PILLAR[c.topic] || null,
      status: statusOverlay[c.id] || c.status || "fresh",
    }));
    cards.sort((a, b) => (b.created || "").localeCompare(a.created || ""));

    news = Array.isArray(baseNews) ? baseNews : [];
    angles = Array.isArray(baseAngles) ? baseAngles : [];
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
      note: "beats pending — talk it through with Claude",
      status: "fresh",
      platforms: ["tiktok", "linkedin", "meta"],
    };
    const drops = lsGet(LS.drops, []);
    drops.unshift(card);
    lsSet(LS.drops, drops);
    cards.unshift(card);
    return card;
  }

  // ---- counts (per pillar, for home tiles) ----

  function isToRecord(c) { return c.status === "fresh" || c.status === "saved"; }

  function pillarCounts(p) {
    return {
      news: news.filter(n => n.pillar === p && n.status === "new").length,
      angles: angles.filter(a => a.pillar === p && a.status !== "recorded").length,
      ready: cards.filter(c => c.pillar === p && isToRecord(c)).length,
    };
  }

  // ---- rendering ----

  const $ = sel => document.querySelector(sel);

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function chip(label, on, onClick) {
    const b = el("button", "chip" + (on ? " on" : ""), label);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }

  function subjectLabel(s) { return s ? s.replace(/-/g, " ") : s; }

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
        tileCount(n.news, "news"),
        tileCount(n.angles, "angles"),
        tileCount(n.ready, "to record"),
      );
      a.append(counts);
      return a;
    }));

    const unfiled = cards.filter(c => !c.pillar && isToRecord(c));
    const row = $("#unfiled-row");
    row.hidden = unfiled.length === 0;
    row.textContent = unfiled.length + " unfiled drop" + (unfiled.length === 1 ? "" : "s") + " — tap to file";
  }

  function tileCount(n, label) {
    const d = el("div", "tile-count" + (n > 0 ? " has" : ""));
    d.append(el("span", "n", String(n)), el("span", "l", label));
    return d;
  }

  // ---- pillar view ----

  function cardListItem(c, fromPillar) {
    const li = el("li");
    const a = el("a", "card");
    a.href = "#/card/" + encodeURIComponent(c.id) + (fromPillar ? "?from=" + fromPillar : "");

    const meta = el("div", "card-meta");
    meta.append(el("span", "badge type", c.type));
    if (c.subject) meta.append(el("span", "badge", subjectLabel(c.subject)));
    if (c.status !== "fresh") meta.append(el("span", "badge status-" + c.status, c.status));

    a.append(meta, el("h3", null, c.title), el("p", "story", c.story));
    li.append(a);
    return li;
  }

  function renderPillar(p) {
    const isUnfiled = p === "unfiled";
    $("#pillar-title").textContent = isUnfiled ? "UNFILED DROPS" : p;

    // News + angles don't apply to the unfiled bucket
    $("#news-list").closest(".pillar-section").hidden = isUnfiled;
    $("#angle-list").closest(".pillar-section").hidden = isUnfiled;

    if (!isUnfiled) {
      // news we're tracking
      const items = news.filter(n => n.pillar === p && n.status !== "ignored");
      $("#news-list").replaceChildren(...items.map(n => {
        const li = el("li");
        const div = el("div", "news-item");
        const meta = el("div", "card-meta");
        if (n.status === "new") meta.append(el("span", "badge type", "new"));
        if (n.date) meta.append(el("span", "badge", n.date));
        if (n.source) meta.append(el("span", "badge", n.source));
        div.append(meta, el("h3", null, n.title));
        if (n.note) div.append(el("p", "story", n.note));
        if (n.url) {
          const a = el("a", "source-link", n.url);
          a.href = n.url; a.target = "_blank"; a.rel = "noopener";
          div.append(a);
        }
        li.append(div);
        return li;
      }));
      $("#news-empty").hidden = items.length > 0;

      // angles
      const pillarAngles = angles.filter(a => a.pillar === p && a.status !== "recorded");
      $("#angle-list").replaceChildren(...pillarAngles.map(a => {
        const li = el("li");
        const div = el("div", "angle-item");
        const meta = el("div", "card-meta");
        meta.append(el("span", "badge type", a.status));
        if (a.subject) meta.append(el("span", "badge", subjectLabel(a.subject)));
        div.append(meta, el("p", "stance", a.stance));
        li.append(div);
        return li;
      }));
      $("#angle-empty").hidden = pillarAngles.length > 0;
    }

    // ready to record
    const chipsRow = $("#ready-chips");
    const defs = [
      ["torecord", "To record"],
      ["recorded", "Recorded"],
      ["skipped", "Skipped"],
    ];
    chipsRow.replaceChildren(...defs.map(([key, label]) =>
      chip(label, readyFilter.status === key, () => {
        readyFilter.status = key;
        renderPillar(p);
      })
    ));

    const inPillar = cards.filter(c => (isUnfiled ? !c.pillar : c.pillar === p));
    const visible = inPillar.filter(c =>
      readyFilter.status === "torecord" ? isToRecord(c) : c.status === readyFilter.status
    );
    $("#ready-list").replaceChildren(...visible.map(c => cardListItem(c, p)));
    $("#ready-empty").hidden = visible.length > 0;
  }

  // ---- card view ----

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

    const meta = el("div", "card-meta");
    meta.append(el("span", "badge type", c.type));
    if (c.pillar) meta.append(el("span", "badge pillar", c.pillar));
    if (c.subject) meta.append(el("span", "badge", subjectLabel(c.subject)));
    meta.append(el("span", "badge", c.created));
    if (c.status !== "fresh") meta.append(el("span", "badge status-" + c.status, c.status));
    root.append(meta);

    root.append(el("h2", null, c.title));
    root.append(el("p", "story", c.story));

    if (c.source) {
      const a = el("a", "source-link", c.source);
      a.href = c.source;
      a.target = "_blank";
      a.rel = "noopener";
      root.append(a);
    }

    // unfiled drop: one tap files it under a pillar
    if (!c.pillar) {
      root.append(el("p", "beats-label", "File under"));
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

    if (c.angle) {
      const angle = el("div", "angle");
      angle.append(el("p", "label", "The angle"));
      angle.append(el("p", null, c.angle));
      root.append(angle);
    }

    root.append(el("p", "beats-label", "Beats — tick as you nail them"));
    if (Array.isArray(c.beats) && c.beats.length) {
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
      root.append(el("p", "beats-pending", c.note || "beats pending — talk it through with Claude"));
    }

    const actions = el("div", "actions");
    const mkBtn = (label, cls, status) => {
      const b = el("button", "btn " + cls, label);
      b.type = "button";
      b.addEventListener("click", () => {
        setStatus(c.id, status);
        location.hash = backTo ? "#/pillar/" + backTo : "#/";
      });
      return b;
    };
    actions.append(
      mkBtn("Save", "", "saved"),
      mkBtn("Recorded", "btn-accent", "recorded"),
      mkBtn("Skip", "btn-danger", "skipped"),
    );
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
      card: $("#view-card"), drop: $("#view-drop"),
    };
    Object.values(views).forEach(v => { v.hidden = true; });

    const cardMatch = hash.match(/^#\/card\/([^?]+)(?:\?from=([A-Za-z]+))?$/);
    const pillarMatch = hash.match(/^#\/pillar\/([A-Za-z]+)$/);

    if (cardMatch) {
      renderCard(decodeURIComponent(cardMatch[1]), cardMatch[2] || null);
      views.card.hidden = false;
    } else if (pillarMatch && (PILLARS.includes(pillarMatch[1]) || pillarMatch[1] === "unfiled")) {
      renderPillar(pillarMatch[1]);
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
