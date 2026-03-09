/**
 * OctaStats — Shared JS utilities
 * Handles GitHub data fetching, formatting, nav, and common UI patterns.
 */

const DATA_BASE    = "https://raw.githubusercontent.com/zwinship/OctaStats_UFC_Model_V2/main";
const V1_DATA_BASE = "https://raw.githubusercontent.com/zwinship/UFC_Model/main";
const SITE_DATA_URL = "assets/data/site-data.json";

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
    const text = await r.text();
    return parseCSV(text);
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
    // Handle quoted fields properly
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

// ── Site metadata (fetched once, shared) ─────────────────────────────────────

let _siteData = null;

async function getSiteData() {
  if (_siteData) return _siteData;
  _siteData = await fetchJSON(SITE_DATA_URL);
  return _siteData;
}

async function getFightTitles() {
  const d = await getSiteData();
  if (d?.v2) return d.v2;
  // Fallback: fetch directly
  return await fetchJSON(`${DATA_BASE}/titles/fight_titles.json`) || {};
}

// Build clean filename segment from event name
function cleanEventName(name) {
  return (name || "").replace(/[^\w\s]/g, "").replace(/\s+/g, "_");
}

async function getV2Predictions() {
  const titles = await getFightTitles();
  const clean  = cleanEventName(titles.upcoming_event || titles.upcoming || "");
  if (!clean) return [];
  return await fetchCSV(`${DATA_BASE}/predictions/v2_betting_recommendations_${clean}.csv`);
}

async function getV2Results(event_name) {
  if (event_name) {
    const clean = cleanEventName(event_name);
    return await fetchCSV(`${DATA_BASE}/results/v2_betting_results_${clean}.csv`);
  }
  return await fetchCSV(`${DATA_BASE}/results/v2_all_betting_results.csv`);
}

async function getV2AllResults() {
  return await fetchCSV(`${DATA_BASE}/results/v2_all_betting_results.csv`);
}

async function getV2Stats() {
  return await fetchJSON(`${DATA_BASE}/statistics/v2_statistical_analysis.json`);
}

// ── V1 data ───────────────────────────────────────────────────────────────────

async function getV1Titles() {
  return await fetchJSON(`${V1_DATA_BASE}/titles/fight_titles.json`) || {};
}

async function getV1Predictions() {
  const titles = await getV1Titles();
  const clean  = (titles.upcoming || "").replace(/[^\w\s]/g, "").replace(/\s+/g, "_");
  if (!clean) return [];
  const automated = await fetchCSV(`${V1_DATA_BASE}/predictions/v1_predictions_latest.csv`);
  if (automated && automated.length) return automated;
  return await fetchCSV(`${V1_DATA_BASE}/predictions/betting_recommendations_${clean}.csv`);
}

async function getV1AllResults() {
  const automated = await fetchCSV(`${V1_DATA_BASE}/results/v1_all_betting_results.csv`);
  if (automated && automated.length) return automated;
  return await fetchCSV(`${V1_DATA_BASE}/results/all_betting_results.csv`);
}

async function getV1Stats() {
    const automated = await fetchJSON(`${V1_DATA_BASE}/statistics/v1_statistical_analysis.json`);
  if (automated) return automated;
  return await fetchJSON(`${V1_DATA_BASE}/statistics/ufc_statistical_analysis.json`);
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmt(val, decimals = 2) {
  const n = parseFloat(val);
  return isNaN(n) ? "—" : n.toFixed(decimals);
}

function fmtPct(val, decimals = 1) {
  const n = parseFloat(val);
  return isNaN(n) ? "—" : (n * 100).toFixed(decimals) + "%";
}

function fmtPctRaw(val, decimals = 1) {
  // For values already in 0-100 range
  const n = parseFloat(val);
  return isNaN(n) ? "—" : n.toFixed(decimals) + "%";
}

function fmtOdds(val) {
  if (!val || val === "" || val === "nan") return "—";
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  return n > 0 ? `+${n}` : `${n}`;
}

function fmtUnits(val) {
  const n = parseFloat(val);
  return isNaN(n) ? "—" : n.toFixed(2) + "u";
}

function fmtPnL(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  const str = (n >= 0 ? "+" : "") + n.toFixed(2) + "u";
  return str;
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

// ── Style badge HTML ──────────────────────────────────────────────────────────

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
  const classes = shifted ? "badge badge-style-shift" : "badge badge-style";
  return `<span class="${classes}" style="color:${colour};border-color:${colour}33;background:${colour}15">${style.replace("_", " ")}</span>`;
}

function shiftAlertBadge() {
  return `<span class="badge badge-style-shift">⚡ Style Shift</span>`;
}

// ── Probability bar ───────────────────────────────────────────────────────────

function probBar(value, positive = false) {
  const pct = (parseFloat(value) * 100).toFixed(1);
  const fillClass = positive ? "prob-bar-fill positive" : "prob-bar-fill";
  return `
    <div class="prob-bar-wrap">
      <div class="prob-bar-track">
        <div class="${fillClass}" style="width:${pct}%"></div>
      </div>
      <span class="prob-bar-label">${pct}%</span>
    </div>`;
}

// ── Nav active state ──────────────────────────────────────────────────────────

function setActiveNav() {
  const path = window.location.pathname;
  document.querySelectorAll(".nav-link").forEach(link => {
    const href = link.getAttribute("href");
    if (!href) return;
    const isActive =
      (href === "index.html" && (path.endsWith("/") || path.endsWith("index.html"))) ||
      (href !== "index.html" && path.includes(href.replace(".html", "")));
    link.classList.toggle("active", isActive);
  });
}

// ── Mobile nav toggle ─────────────────────────────────────────────────────────

function initMobileNav() {
  const toggle = document.querySelector(".nav-toggle");
  const links  = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => links.classList.toggle("open"));
  }
}

// ── Sortable tables ───────────────────────────────────────────────────────────

function makeSortable(tableEl) {
  const headers = tableEl.querySelectorAll("thead th[data-sort]");
  let sortCol = null, sortAsc = true;

  headers.forEach(th => {
    th.style.cursor = "pointer";
    th.addEventListener("click", () => {
      const col = th.dataset.sort;
      if (sortCol === col) { sortAsc = !sortAsc; }
      else { sortCol = col; sortAsc = false; }

      headers.forEach(h => { h.classList.remove("sorted", "asc"); });
      th.classList.add("sorted");
      if (sortAsc) th.classList.add("asc");

      const tbody = tableEl.querySelector("tbody");
      const rows  = Array.from(tbody.querySelectorAll("tr"));
      rows.sort((a, b) => {
        const aVal = a.querySelector(`[data-val="${col}"]`)?.dataset.raw ?? a.cells[th.cellIndex]?.textContent ?? "";
        const bVal = b.querySelector(`[data-val="${col}"]`)?.dataset.raw ?? b.cells[th.cellIndex]?.textContent ?? "";
        const aNum = parseFloat(aVal), bNum = parseFloat(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) return sortAsc ? aNum - bNum : bNum - aNum;
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
      rows.forEach(r => tbody.appendChild(r));
    });
  });
}

// ── Performance metrics helper ────────────────────────────────────────────────

function calcMetrics(rows) {
  const bets   = rows.filter(r => parseFloat(r.bet_size) > 0);
  const wins   = bets.filter(r => r.won === "1" || r.won === 1);
  const staked = bets.reduce((s, r) => s + parseFloat(r.bet_size || 0), 0);
  const ret    = bets.reduce((s, r) => s + parseFloat(r.total_return || 0), 0);

  return {
    total_bets:    bets.length,
    winning_bets:  wins.length,
    losing_bets:   bets.length - wins.length,
    win_rate:      bets.length > 0 ? (wins.length / bets.length * 100).toFixed(1) : "0.0",
    net_units:     (ret - staked).toFixed(2),
    rtp:           staked > 0 ? (ret / staked * 100).toFixed(1) : "0.0",
    units_staked:  staked.toFixed(2),
  };
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  setActiveNav();
  initMobileNav();
});
