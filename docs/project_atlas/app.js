/* Training Ground Atlas — static viewer over atlas-data.js.
   Views: overview, architecture graph (pan/zoom, focus, inspector),
   data flows, deep dives, decisions. Deep links: ?view= &dive= &node=. */
(function () {
  "use strict";
  const DATA = window.ATLAS_DATA || {};
  const GRAPH = DATA.architecture_graph || { lanes: [], nodes: [], edges: [] };
  const DECISIONS = (DATA.decisions || {}).decisions || [];
  const DIVES = (DATA.deep_dives || {}).dives || [];
  const FLOWS = (DATA.dataflow || {}).flows || [];
  const OVERVIEW = DATA.overview || {};

  const $ = (sel) => document.querySelector(sel);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const laneLabel = {};
  for (const lane of GRAPH.lanes) laneLabel[lane.id] = lane.label;
  const nodeById = {};
  for (const n of GRAPH.nodes) nodeById[n.id] = n;
  const upOf = {}, downOf = {};
  for (const e of GRAPH.edges) {
    (downOf[e.from] = downOf[e.from] || []).push(e);
    (upOf[e.to] = upOf[e.to] || []).push(e);
  }

  /* ---------- tabs & deep links ---------- */
  const VIEWS = ["overview", "graph", "flows", "dives", "decisions"];
  function setView(view, push = true) {
    if (!VIEWS.includes(view)) view = "overview";
    for (const t of document.querySelectorAll(".tab")) t.classList.toggle("is-active", t.dataset.view === view);
    for (const v of VIEWS) $("#view-" + v).classList.toggle("is-active", v === view);
    if (push) {
      const url = new URL(location.href);
      url.searchParams.set("view", view);
      if (view !== "dives") url.searchParams.delete("dive");
      if (view !== "graph") url.searchParams.delete("node");
      history.replaceState(null, "", url);
    }
    if (view === "graph") setTimeout(fitGraph, 0);
  }
  for (const t of document.querySelectorAll(".tab")) t.addEventListener("click", () => setView(t.dataset.view));

  /* ---------- overview ---------- */
  (function renderOverview() {
    const root = $("#view-overview");
    root.append(el("div", "ov-card", `<h3>What this is</h3><p>${esc(OVERVIEW.what)}</p>`));
    root.append(el("div", "ov-run", `<strong>Run it:</strong> ${esc(OVERVIEW.run)}`));
    const grid = el("div", "ov-grid");
    for (const p of OVERVIEW.principles || []) {
      grid.append(el("div", "ov-principle", `<h4>${esc(p.name)}</h4><p>${esc(p.text)}</p>`));
    }
    root.append(grid);
    const maint = el("div", "ov-card", `<h3>Maintenance rule (for agents)</h3><p class="ov-maint">${esc(OVERVIEW.maintenance)}</p>`);
    maint.style.marginTop = "12px";
    root.append(maint);
  })();

  /* ---------- graph ---------- */
  const NODE_W = 230;
  const stage = $("#graph-stage");
  const edgesSvg = $("#graph-edges");
  const nodesHost = $("#graph-nodes");
  const viewport = $("#graph-viewport");
  let nodeEls = {}, edgePaths = [];
  let pinned = null, multiFocus = null;

  function nodeCenter(n) {
    const elN = nodeEls[n.id];
    const h = elN ? elN.offsetHeight : 86;
    return { x: n.x + NODE_W / 2, y: n.y + h / 2, h };
  }

  function renderGraph() {
    let maxX = 0, maxY = 0;
    for (const n of GRAPH.nodes) {
      const card = el("div", "node");
      card.style.left = n.x + "px";
      card.style.top = n.y + "px";
      card.innerHTML = `<div class="lane-tag">${esc(laneLabel[n.lane] || n.lane)}</div><h4>${esc(n.label)}</h4><p>${esc(n.summary)}</p>`;
      card.addEventListener("mouseenter", () => { if (!pinned && !multiFocus) applyFocus(n.id); });
      card.addEventListener("mouseleave", () => { if (!pinned && !multiFocus) clearFocus(false); });
      card.addEventListener("click", (e) => { e.stopPropagation(); pinNode(n.id); });
      nodesHost.append(card);
      nodeEls[n.id] = card;
      maxX = Math.max(maxX, n.x + NODE_W);
      maxY = Math.max(maxY, n.y + 140);
    }
    stage.style.width = maxX + 60 + "px";
    stage.style.height = maxY + 40 + "px";
    edgesSvg.setAttribute("width", maxX + 60);
    edgesSvg.setAttribute("height", maxY + 40);

    for (const e of GRAPH.edges) {
      const a = nodeById[e.from], b = nodeById[e.to];
      if (!a || !b) continue;
      const ca = nodeCenter(a), cb = nodeCenter(b);
      const fromRight = cb.x >= ca.x;
      const x1 = fromRight ? a.x + NODE_W : a.x;
      const x2 = fromRight ? b.x : b.x + NODE_W;
      const y1 = ca.y, y2 = cb.y;
      const dx = Math.max(Math.abs(x2 - x1) * 0.45, 40) * (fromRight ? 1 : -1);
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`);
      edgesSvg.append(path);
      let labelEl = null;
      if (e.label) {
        labelEl = document.createElementNS("http://www.w3.org/2000/svg", "text");
        labelEl.textContent = e.label;
        labelEl.setAttribute("x", (x1 + x2) / 2);
        labelEl.setAttribute("y", (y1 + y2) / 2 - 5);
        labelEl.setAttribute("text-anchor", "middle");
        edgesSvg.append(labelEl);
      }
      edgePaths.push({ e, path, labelEl });
    }
  }

  function applyFocus(id) {
    const ups = new Set((upOf[id] || []).map((e) => e.from));
    const downs = new Set((downOf[id] || []).map((e) => e.to));
    for (const [nid, card] of Object.entries(nodeEls)) {
      card.classList.remove("focus", "up", "down", "dim");
      if (nid === id) card.classList.add("focus");
      else if (ups.has(nid)) card.classList.add("up");
      else if (downs.has(nid)) card.classList.add("down");
      else card.classList.add("dim");
    }
    for (const { e, path, labelEl } of edgePaths) {
      path.classList.remove("up", "down", "dim");
      labelEl && labelEl.classList.remove("dim");
      if (e.to === id) path.classList.add("up");
      else if (e.from === id) path.classList.add("down");
      else { path.classList.add("dim"); labelEl && labelEl.classList.add("dim"); }
    }
    renderNodeInspector(id);
  }

  function applyMultiFocus(ids, title, blurb) {
    multiFocus = ids;
    pinned = null;
    const set = new Set(ids);
    for (const [nid, card] of Object.entries(nodeEls)) {
      card.classList.remove("focus", "up", "down", "dim");
      card.classList.toggle("focus", set.has(nid));
      if (!set.has(nid)) card.classList.add("dim");
    }
    for (const { e, path, labelEl } of edgePaths) {
      path.classList.remove("up", "down", "dim");
      const on = set.has(e.from) && set.has(e.to);
      if (!on) { path.classList.add("dim"); labelEl && labelEl.classList.add("dim"); }
      else labelEl && labelEl.classList.remove("dim");
    }
    $("#clear-focus").hidden = false;
    $("#inspector").innerHTML =
      `<p class="eyebrow">Highlighted on map</p><h2>${esc(title)}</h2><p class="muted">${esc(blurb)}</p>`;
  }

  function clearFocus(full = true) {
    if (full) { pinned = null; multiFocus = null; $("#clear-focus").hidden = true; }
    for (const card of Object.values(nodeEls)) card.classList.remove("focus", "up", "down", "dim", "search-hit");
    for (const { path, labelEl } of edgePaths) { path.classList.remove("up", "down", "dim"); labelEl && labelEl.classList.remove("dim"); }
  }

  function pinNode(id) {
    pinned = id;
    multiFocus = null;
    $("#clear-focus").hidden = false;
    applyFocus(id);
    const url = new URL(location.href);
    url.searchParams.set("view", "graph");
    url.searchParams.set("node", id);
    history.replaceState(null, "", url);
  }

  $("#clear-focus").addEventListener("click", () => {
    clearFocus(true);
    const url = new URL(location.href);
    url.searchParams.delete("node");
    history.replaceState(null, "", url);
  });
  viewport.addEventListener("click", () => { if (pinned || multiFocus) { clearFocus(true); } });

  function renderNodeInspector(id) {
    const n = nodeById[id];
    if (!n) return;
    const ups = (upOf[id] || []).map((e) => e.from);
    const downs = (downOf[id] || []).map((e) => e.to);
    const touching = DECISIONS.filter((d) => (d.touches || []).includes(id));
    const featuring = DIVES.filter((d) => (d.highlights || []).includes(id));
    const ins = $("#inspector");
    ins.innerHTML = `
      <p class="eyebrow">${esc(laneLabel[n.lane] || n.lane)}</p>
      <h2>${esc(n.label)}</h2>
      <p>${esc(n.details || n.summary)}</p>
      <div class="files">${(n.files || []).map(esc).join("<br>")}</div>
      ${ups.length ? `<p class="eyebrow" style="margin-top:12px">Fed by</p><ul class="rel-list up">${ups.map((u) => `<li data-go="${u}">${esc(nodeById[u]?.label || u)}</li>`).join("")}</ul>` : ""}
      ${downs.length ? `<p class="eyebrow">Feeds</p><ul class="rel-list down">${downs.map((d) => `<li data-go="${d}">${esc(nodeById[d]?.label || d)}</li>`).join("")}</ul>` : ""}
      ${touching.length ? `<p class="eyebrow">Decisions here</p><div class="pill-row">${touching.map((d) => `<span class="pill" data-decision="${d.id}">${esc(d.title)}</span>`).join("")}</div>` : ""}
      ${featuring.length ? `<p class="eyebrow" style="margin-top:10px">Deep dives</p><div class="pill-row">${featuring.map((d) => `<span class="pill" data-dive="${d.id}">${esc(d.title)}</span>`).join("")}</div>` : ""}
    `;
    for (const li of ins.querySelectorAll("[data-go]")) li.addEventListener("click", () => pinNode(li.dataset.go));
    for (const p of ins.querySelectorAll("[data-dive]")) p.addEventListener("click", () => { setView("dives"); openDive(p.dataset.dive); });
    for (const p of ins.querySelectorAll("[data-decision]")) {
      p.addEventListener("click", () => { setView("decisions"); location.hash = "d-" + p.dataset.decision; });
    }
  }

  /* pan/zoom (CSS transform on the stage) */
  let view = { scale: 1, tx: 0, ty: 0 };
  function applyView() {
    stage.style.transform = `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`;
  }
  function fitGraph() {
    const vw = viewport.clientWidth, vh = viewport.clientHeight;
    const sw = stage.offsetWidth, sh = stage.offsetHeight;
    if (!vw || !sw) return;
    const scale = Math.min(vw / sw, vh / sh, 1) * 0.96;
    view = { scale, tx: (vw - sw * scale) / 2, ty: Math.max((vh - sh * scale) / 2, 8) };
    applyView();
  }
  viewport.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const scale = Math.min(Math.max(view.scale * factor, 0.25), 2.5);
    const f = scale / view.scale;
    view = { scale, tx: px - (px - view.tx) * f, ty: py - (py - view.ty) * f };
    applyView();
  }, { passive: false });
  let pan = null;
  viewport.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".node") || e.target.closest(".zoom-controls")) return;
    pan = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
    viewport.classList.add("dragging");
    viewport.setPointerCapture(e.pointerId);
  });
  viewport.addEventListener("pointermove", (e) => {
    if (!pan) return;
    view.tx = pan.tx + (e.clientX - pan.x);
    view.ty = pan.ty + (e.clientY - pan.y);
    applyView();
  });
  const endPan = () => { pan = null; viewport.classList.remove("dragging"); };
  viewport.addEventListener("pointerup", endPan);
  viewport.addEventListener("pointercancel", endPan);
  for (const btn of document.querySelectorAll(".zoom-controls button")) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const kind = btn.dataset.zoom;
      if (kind === "reset") return fitGraph();
      const factor = kind === "in" ? 1.25 : 1 / 1.25;
      const px = viewport.clientWidth / 2, py = viewport.clientHeight / 2;
      const scale = Math.min(Math.max(view.scale * factor, 0.25), 2.5);
      const f = scale / view.scale;
      view = { scale, tx: px - (px - view.tx) * f, ty: py - (py - view.ty) * f };
      applyView();
    });
  }

  /* search */
  $("#search").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    setView("graph", true);
    for (const [nid, card] of Object.entries(nodeEls)) {
      const n = nodeById[nid];
      const hit = q && (n.label.toLowerCase().includes(q) || (n.summary || "").toLowerCase().includes(q) || (n.files || []).join(" ").toLowerCase().includes(q));
      card.classList.toggle("search-hit", !!hit);
    }
  });

  /* ---------- flows ---------- */
  (function renderFlows() {
    const root = $("#view-flows");
    for (const flow of FLOWS) {
      const card = el("div", "flow-card");
      card.innerHTML = `<h3>${esc(flow.title)}</h3><p>${esc(flow.summary)}</p>`;
      const steps = el("div", "flow-steps");
      for (const s of flow.steps) {
        steps.append(el("div", "flow-step",
          `<div class="actor">${esc(s.actor)}</div><div><div class="action">${esc(s.action)}</div><div class="detail">${esc(s.detail)}</div></div>`));
      }
      card.append(steps);
      root.append(card);
    }
  })();

  /* ---------- dives ---------- */
  function openDive(id) {
    const dive = DIVES.find((d) => d.id === id) || DIVES[0];
    if (!dive) return;
    for (const item of document.querySelectorAll(".dive-item")) {
      item.classList.toggle("is-active", item.dataset.dive === dive.id);
    }
    const detail = $("#dive-detail");
    const body = dive.narrative.split(/\n\n+/).map((p) => `<p>${esc(p)}</p>`).join("");
    const related = (dive.decisions || [])
      .map((id2) => DECISIONS.find((d) => d.id === id2))
      .filter(Boolean);
    detail.innerHTML = `
      <h3>${esc(dive.title)}</h3>
      <p class="question">${esc(dive.question)}</p>
      <div class="dive-actions"><button class="ghost-btn" data-show-map>Show on the architecture map</button></div>
      <div class="body">${body}</div>
      ${related.length ? `<p class="eyebrow">Related decisions</p><div class="pill-row">${related.map((d) => `<span class="pill" data-decision="${d.id}">${esc(d.title)}</span>`).join("")}</div>` : ""}
    `;
    detail.querySelector("[data-show-map]").addEventListener("click", () => {
      setView("graph");
      setTimeout(() => applyMultiFocus(dive.highlights || [], dive.title, dive.question), 0);
    });
    for (const p of detail.querySelectorAll("[data-decision]")) {
      p.addEventListener("click", () => { setView("decisions"); location.hash = "d-" + p.dataset.decision; });
    }
    const url = new URL(location.href);
    url.searchParams.set("view", "dives");
    url.searchParams.set("dive", dive.id);
    history.replaceState(null, "", url);
  }
  (function renderDives() {
    const list = $("#dive-list");
    for (const d of DIVES) {
      const item = el("button", "dive-item", `<h4>${esc(d.title)}</h4><p>${esc(d.question)}</p>`);
      item.dataset.dive = d.id;
      item.addEventListener("click", () => openDive(d.id));
      list.append(item);
    }
  })();

  /* ---------- decisions ---------- */
  (function renderDecisions() {
    const root = $("#view-decisions");
    for (const d of DECISIONS) {
      const card = el("article", "decision");
      card.id = "d-" + d.id;
      card.innerHTML = `
        <h3><span class="meta">${esc(d.status)}</span>${esc(d.title)}</h3>
        <dl>
          <dt>Context</dt><dd>${esc(d.context)}</dd>
          <dt>Decision</dt><dd>${esc(d.decision)}</dd>
          <dt>Consequences</dt><dd>${esc(d.consequences)}</dd>
        </dl>
        <div class="pill-row" style="margin-top:10px"><span class="pill" data-show>Show on map</span></div>
      `;
      card.querySelector("[data-show]").addEventListener("click", () => {
        setView("graph");
        setTimeout(() => applyMultiFocus(d.touches || [], d.title, d.decision), 0);
      });
      root.append(card);
    }
  })();

  /* ---------- boot ---------- */
  renderGraph();
  const params = new URLSearchParams(location.search);
  const v = params.get("view") || "overview";
  setView(v, false);
  if (params.get("dive")) { setView("dives", false); openDive(params.get("dive")); }
  if (params.get("node") && nodeById[params.get("node")]) {
    setView("graph", false);
    setTimeout(() => pinNode(params.get("node")), 0);
  }
})();
