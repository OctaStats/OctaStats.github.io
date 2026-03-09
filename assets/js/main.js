/**
 * OctaStats — Shared JS utilities v2
 * Light/dark theme, GitHub data fetching, formatting, nav, UI patterns.
 */

const DATA_BASE    = "https://raw.githubusercontent.com/zwinship/OctaStats_UFC_Model_V2/main";
const V1_DATA_BASE = "https://raw.githubusercontent.com/zwinship/UFC_Model/main";

// ── Theme system ──────────────────────────────────────────────────────────────

function getPreferredTheme() {
  const stored = localStorage.getItem("os-theme");
  if (stored) return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("os-theme", theme);
}

function initTheme() {
  applyTheme(getPreferredTheme());
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  applyTheme(current === "dark" ? "light" : "dark");
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchJSON(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    console.warn("fetchJSON failed:", url, e.message);
    return null;
  }
}

async function fetchCSV(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return parseCSV(await r.text());
  } catch (e) {
    console.warn("fetchCSV failed:", url, e.message);
    return [];
  }
}

function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(line => {
    const values = [];
    let cur = "", inQuote = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQuote = !inQuote; }
      else if (line[i] === ',' && !inQuote) { values.push(cur.trim()); cur = ""; }
      else { cur += line[i]; }
    }
    values.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] ?? ""; });
    return obj;
  });
}

function cleanEventName(name) {
  return (name || "").replace(/[^\w\s]/g, "").replace(/\s+/g, "_");
}

// ── Data accessors ────────────────────────────────────────────────────────────

async function getFightTitles() {
  return await fetchJSON(`${DATA_BASE}/titles/fight_titles.json`) || {};
}

async function getV2Predictions() {
  const titles = await getFightTitles();
  const clean  = cleanEventName(titles.upcoming || "");
  if (!clean) return [];
  return await fetchCSV(`${DATA_BASE}/predictions/v2_betting_recommendations_${clean}.csv`);
}

async function getV2PropPredictions() {
  const titles = await getFightTitles();
  const clean  = cleanEventName(titles.upcoming || "");
  if (!clean) return [];
  return await fetchCSV(`${DATA_BASE}/predictions/v2_prop_recommendations_${clean}.csv`);
}

async function getV2AllResults() {
  return await fetchCSV(`${DATA_BASE}/results/v2_all_betting_results.csv`);
}

async function getV2Stats() {
  return await fetchJSON(`${DATA_BASE}/statistics/v2_statistical_analysis.json`);
}

// V1
async function getV1Titles() {
  return await fetchJSON(`${V1_DATA_BASE}/titles/fight_titles.json`) || {};
}

async function getV1Predictions() {
  const titles = await getV1Titles();
  const clean  = (titles.upcoming || "").replace(/[^\w\s]/g, "").replace(/\s+/g, "_");
  if (!clean) return [];
  const a = await fetchCSV(`${V1_DATA_BASE}/predictions/v1_predictions_latest.csv`);
  if (a && a.length) return a;
  return await fetchCSV(`${V1_DATA_BASE}/predictions/betting_recommendations_${clean}.csv`);
}

async function getV1AllResults() {
  const a = await fetchCSV(`${V1_DATA_BASE}/results/v1_all_betting_results.csv`);
  if (a && a.length) return a;
  return await fetchCSV(`${V1_DATA_BASE}/results/all_betting_results.csv`);
}

async function getV1Stats() {
  const a = await fetchJSON(`${V1_DATA_BASE}/statistics/v1_statistical_analysis.json`);
  if (a) return a;
  return await fetchJSON(`${V1_DATA_BASE}/statistics/ufc_statistical_analysis.json`);
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(val, decimals = 2) {
  const n = parseFloat(val);
  return isNaN(n) ? "—" : n.toFixed(decimals);
}

function fmtPct(val, decimals = 1) {
  const n = parseFloat(val);
  return isNaN(n) ? "—" : (n * 100).toFixed(decimals) + "%";
}

function fmtPctRaw(val, decimals = 1) {
  const n = parseFloat(val);
  return isNaN(n) ? "—" : n.toFixed(decimals) + "%";
}

function fmtOdds(val) {
  if (!val || val === "" || val === "nan" || val === "None") return "—";
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  return n > 0 ? `+${Math.round(n)}` : `${Math.round(n)}`;
}

function fmtUnits(val) {
  const n = parseFloat(val);
  return isNaN(n) ? "—" : n.toFixed(2) + "u";
}

function fmtPnL(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "u";
}

function pnlClass(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return "";
  return n > 0 ? "td-positive" : n < 0 ? "td-negative" : "td-neutral";
}

function edgeClass(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return "";
  return n > 0 ? "td-positive" : "td-negative";
}

// ── UI components ─────────────────────────────────────────────────────────────

const STYLE_COLOURS = {
  Striker:   "#60a5fa",
  Wrestler:  "#a78bfa",
  BJJ:       "#34d399",
  Muay_Thai: "#fb923c",
  Sniper:    "#e879f9",
  Mixed:     "#94a3b8",
};

function styleBadge(style, shifted = false) {
  if (!style || style === "" || style === "nan") return "";
  const colour  = STYLE_COLOURS[style] || "#94a3b8";
  const cls     = shifted ? "badge badge-shift" : "badge badge-style";
  return `<span class="${cls}" style="color:${colour};border-color:${colour}40;background:${colour}18">${style.replace("_", " ")}</span>`;
}

function shiftBadge() {
  return `<span class="badge badge-shift">⚡ Shift</span>`;
}

function probBar(value, useGreen = false) {
  const pct = Math.min(100, Math.max(0, parseFloat(value) * 100)).toFixed(1);
  return `<div class="prob-bar-wrap">
    <div class="prob-bar-track">
      <div class="prob-bar-fill${useGreen ? ' green' : ''}" style="width:${pct}%"></div>
    </div>
    <span class="prob-bar-label">${pct}%</span>
  </div>`;
}

function finishBars(ko, sub, dec) {
  const f = v => Math.min(100, Math.max(0, parseFloat(v || 0) * 100)).toFixed(0);
  return `<div class="finish-bars">
    <div class="finish-bar-row">
      <span class="finish-bar-label">KO</span>
      <div class="finish-bar-track"><div class="finish-bar-fill ko" style="width:${f(ko)}%"></div></div>
      <span class="finish-bar-pct">${f(ko)}%</span>
    </div>
    <div class="finish-bar-row">
      <span class="finish-bar-label">SUB</span>
      <div class="finish-bar-track"><div class="finish-bar-fill sub" style="width:${f(sub)}%"></div></div>
      <span class="finish-bar-pct">${f(sub)}%</span>
    </div>
    <div class="finish-bar-row">
      <span class="finish-bar-label">DEC</span>
      <div class="finish-bar-track"><div class="finish-bar-fill dec" style="width:${f(dec)}%"></div></div>
      <span class="finish-bar-pct">${f(dec)}%</span>
    </div>
  </div>`;
}

function oddsChip(odds) {
  const n   = parseFloat(odds);
  const str = fmtOdds(odds);
  if (str === "—") return `<span class="odds-chip">${str}</span>`;
  const isFav = !isNaN(n) && n < 0;
  return `<span class="odds-chip${isFav ? ' fav' : ''}">${str}</span>`;
}

function betChip(units) {
  const n = parseFloat(units);
  if (isNaN(n) || n <= 0) return "";
  return `<span class="bet-unit-chip">▶ ${n.toFixed(1)}u</span>`;
}

// ── Prop accordion ────────────────────────────────────────────────────────────

function buildPropAccordion(matchup, propRows) {
  if (!propRows || propRows.length === 0) return "";
  const flagged = propRows.filter(p => p.flagged === "True" || p.flagged === true);
  const label   = flagged.length > 0 ? `${flagged.length} flagged` : "view props";
  const rows    = propRows.map(p => {
    const isFlagged = p.flagged === "True" || p.flagged === true;
    return `<div class="prop-row">
      <span class="prop-label">${p.prop_label || p.prop_type}</span>
      <span class="prop-prob">${fmtPct(p.model_prob)}</span>
      ${isFlagged ? `<span class="prop-flagged">⚑ Flagged</span>` : ""}
    </div>`;
  }).join("");

  return `<div class="prop-accordion" data-matchup="${matchup}">
    <div class="prop-accordion-header" onclick="togglePropAccordion(this)">
      <div class="prop-accordion-header-left">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <circle cx="5" cy="5" r="4" stroke="currentColor" stroke-width="1.2"/>
          <line x1="5" y1="2.5" x2="5" y2="5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          <circle cx="5" cy="7" r="0.6" fill="currentColor"/>
        </svg>
        PROP BETS — ${label}
      </div>
      <span class="prop-accordion-chevron">▾</span>
    </div>
    <div class="prop-accordion-body">${rows}</div>
  </div>`;
}

function togglePropAccordion(header) {
  const accordion = header.closest(".prop-accordion");
  accordion.classList.toggle("open");
}

// ── Nav ───────────────────────────────────────────────────────────────────────

function setActiveNav() {
  const path = window.location.pathname;
  document.querySelectorAll(".nav-link, .nav-link-v1").forEach(link => {
    const href = link.getAttribute("href") || "";
    const base = href.split("/").pop().replace(".html", "");
    const isIndex = (base === "index" || base === "") &&
      (path.endsWith("/") || path.endsWith("index.html") || path === "/");
    const isMatch = base !== "" && base !== "index" && path.includes(base);
    link.classList.toggle("active", isIndex || isMatch);
  });
}

function initMobileNav() {
  const hamburger = document.querySelector(".nav-hamburger");
  const menu      = document.querySelector(".nav-mobile-menu");
  if (!hamburger || !menu) return;

  hamburger.addEventListener("click", () => {
    const open = menu.classList.toggle("open");
    hamburger.classList.toggle("open", open);
    hamburger.setAttribute("aria-expanded", open);
  });

  // Close on outside click
  document.addEventListener("click", e => {
    if (!hamburger.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.remove("open");
      hamburger.classList.remove("open");
    }
  });

  // Close on nav link click
  menu.querySelectorAll("a").forEach(a => {
    a.addEventListener("click", () => {
      menu.classList.remove("open");
      hamburger.classList.remove("open");
    });
  });
}

function initThemeToggle() {
  document.querySelectorAll(".theme-toggle").forEach(btn => {
    btn.addEventListener("click", toggleTheme);
  });
}

// ── Sortable tables ───────────────────────────────────────────────────────────

function makeSortable(tableEl) {
  let sortCol = null, sortAsc = true;
  tableEl.querySelectorAll("thead th[data-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.dataset.sort;
      if (sortCol === col) sortAsc = !sortAsc;
      else { sortCol = col; sortAsc = false; }

      tableEl.querySelectorAll("thead th").forEach(h => h.classList.remove("sorted", "asc"));
      th.classList.add("sorted");
      if (sortAsc) th.classList.add("asc");

      const tbody = tableEl.querySelector("tbody");
      Array.from(tbody.querySelectorAll("tr"))
        .sort((a, b) => {
          const av = a.querySelector(`[data-val="${col}"]`)?.dataset.raw ?? a.cells[th.cellIndex]?.textContent ?? "";
          const bv = b.querySelector(`[data-val="${col}"]`)?.dataset.raw ?? b.cells[th.cellIndex]?.textContent ?? "";
          const an = parseFloat(av), bn = parseFloat(bv);
          if (!isNaN(an) && !isNaN(bn)) return sortAsc ? an - bn : bn - an;
          return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
        })
        .forEach(r => tbody.appendChild(r));
    });
  });
}

// ── Metrics helper ────────────────────────────────────────────────────────────

function calcMetrics(rows) {
  const bets   = rows.filter(r => parseFloat(r.bet_size) > 0);
  const wins   = bets.filter(r => r.won === "1" || r.won === 1);
  const staked = bets.reduce((s, r) => s + parseFloat(r.bet_size || 0), 0);
  const ret    = bets.reduce((s, r) => s + parseFloat(r.total_return || 0), 0);
  return {
    total_bets:   bets.length,
    winning_bets: wins.length,
    losing_bets:  bets.length - wins.length,
    win_rate:     bets.length > 0 ? (wins.length / bets.length * 100).toFixed(1) : "0.0",
    net_units:    (ret - staked).toFixed(2),
    rtp:          staked > 0 ? (ret / staked * 100).toFixed(1) : "0.0",
    units_staked: staked.toFixed(2),
  };
}

// ── Init ──────────────────────────────────────────────────────────────────────

// Theme must apply before first paint to avoid flash
initTheme();

document.addEventListener("DOMContentLoaded", () => {
  setActiveNav();
  initMobileNav();
  initThemeToggle();
});

// Listen for system theme changes (if user hasn't overridden)
window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", e => {
  if (!localStorage.getItem("os-theme")) {
    applyTheme(e.matches ? "light" : "dark");
  }
});
