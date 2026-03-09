/**
 * OctaStats — Shared JS utilities v4
 * Slider theme toggle, V1 overlay, GitHub data, formatting, nav, page transitions.
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
  document.querySelectorAll(".theme-toggle-slider").forEach(slider => {
    const darkOpt  = slider.querySelector(".opt-dark");
    const lightOpt = slider.querySelector(".opt-light");
    if (darkOpt)  darkOpt.classList.toggle("active-opt",  theme === "dark");
    if (lightOpt) lightOpt.classList.toggle("active-opt", theme === "light");
  });
}

function initTheme() {
  applyTheme(getPreferredTheme());
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  applyTheme(current === "dark" ? "light" : "dark");
}

// ── Page transition system ────────────────────────────────────────────────────

function initPageTransitions() {
  // Add entrance animation to current page
  document.body.classList.add("page-entering");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.classList.remove("page-entering");
      document.body.classList.add("page-entered");
    });
  });

  // Intercept nav link clicks for exit animation
  document.querySelectorAll("a.nav-link, a.btn-nav-link").forEach(function(link) {
    link.addEventListener("click", function(e) {
      const href = link.getAttribute("href");
      // Only animate same-origin, non-hash links
      if (!href || href.startsWith("#") || href.startsWith("http") || href.startsWith("javascript")) return;
      e.preventDefault();
      document.body.classList.add("page-exiting");
      setTimeout(function() { window.location.href = href; }, 260);
    });
  });
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchJSON(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } catch (e) {
    console.warn("fetchJSON failed:", url, e.message);
    return null;
  }
}

async function fetchCSV(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error("HTTP " + r.status);
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
  return await fetchJSON(DATA_BASE + "/titles/fight_titles.json") || {};
}

async function getV2Predictions() {
  const titles = await getFightTitles();
  const clean  = cleanEventName(titles.upcoming || "");
  if (!clean) return [];
  return await fetchCSV(DATA_BASE + "/predictions/v2_betting_recommendations_" + clean + ".csv");
}

async function getV2PropPredictions() {
  const titles = await getFightTitles();
  const clean  = cleanEventName(titles.upcoming || "");
  if (!clean) return [];
  return await fetchCSV(DATA_BASE + "/predictions/v2_prop_recommendations_" + clean + ".csv");
}

async function getV2AllResults() {
  return await fetchCSV(DATA_BASE + "/results/v2_all_betting_results.csv");
}

async function getV2Stats() {
  return await fetchJSON(DATA_BASE + "/statistics/v2_statistical_analysis.json");
}

async function getV1Titles() {
  return await fetchJSON(V1_DATA_BASE + "/titles/fight_titles.json") || {};
}

async function getV1Predictions() {
  const titles = await getV1Titles();
  const clean  = (titles.upcoming || "").replace(/[^\w\s]/g, "").replace(/\s+/g, "_");
  if (!clean) return [];
  const a = await fetchCSV(V1_DATA_BASE + "/predictions/v1_predictions_latest.csv");
  if (a && a.length) return a;
  return await fetchCSV(V1_DATA_BASE + "/predictions/betting_recommendations_" + clean + ".csv");
}

async function getV1AllResults() {
  const a = await fetchCSV(V1_DATA_BASE + "/results/v1_all_betting_results.csv");
  if (a && a.length) return a;
  return await fetchCSV(V1_DATA_BASE + "/results/all_betting_results.csv");
}

async function getV1Stats() {
  const a = await fetchJSON(V1_DATA_BASE + "/statistics/v1_statistical_analysis.json");
  if (a) return a;
  return await fetchJSON(V1_DATA_BASE + "/statistics/ufc_statistical_analysis.json");
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(val, decimals) {
  if (decimals === undefined) decimals = 2;
  const n = parseFloat(val);
  return isNaN(n) ? "n/a" : n.toFixed(decimals);
}

function fmtPct(val, decimals) {
  if (decimals === undefined) decimals = 1;
  const n = parseFloat(val);
  return isNaN(n) ? "n/a" : (n * 100).toFixed(decimals) + "%";
}

function fmtOdds(val) {
  if (!val || val === "" || val === "nan" || val === "None" || val === "null") return "n/a";
  const n = parseFloat(val);
  if (isNaN(n)) return String(val);
  return n > 0 ? "+" + Math.round(n) : "" + Math.round(n);
}

function fmtUnits(val) {
  const n = parseFloat(val);
  return isNaN(n) ? "n/a" : n.toFixed(2) + "u";
}

function fmtPnL(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return "n/a";
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "u";
}

function pnlClass(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return "";
  return n > 0 ? "td-positive" : n < 0 ? "td-negative" : "td-neutral";
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

function styleBadge(style, shifted) {
  if (!style || style === "" || style === "nan") return "";
  const colour = STYLE_COLOURS[style] || "#94a3b8";
  const cls    = shifted ? "badge badge-shift" : "badge badge-style";
  return '<span class="' + cls + '" style="color:' + colour + ';border-color:' + colour + '40;background:' + colour + '18">' + style.replace("_", " ") + '</span>';
}

function probBar(value, useGreen) {
  const pct = Math.min(100, Math.max(0, parseFloat(value || 0) * 100)).toFixed(1);
  return '<div class="prob-bar-wrap"><div class="prob-bar-track"><div class="prob-bar-fill' + (useGreen ? ' green' : '') + '" style="width:' + pct + '%"></div></div><span class="prob-bar-label">' + pct + '%</span></div>';
}

function finishBars(ko, sub, dec) {
  function f(v) { return Math.min(100, Math.max(0, parseFloat(v || 0) * 100)).toFixed(0); }
  return '<div class="finish-bars">' +
    '<div class="finish-bar-row"><span class="finish-bar-label">KO</span><div class="finish-bar-track"><div class="finish-bar-fill ko" style="width:' + f(ko) + '%"></div></div><span class="finish-bar-pct">' + f(ko) + '%</span></div>' +
    '<div class="finish-bar-row"><span class="finish-bar-label">SUB</span><div class="finish-bar-track"><div class="finish-bar-fill sub" style="width:' + f(sub) + '%"></div></div><span class="finish-bar-pct">' + f(sub) + '%</span></div>' +
    '<div class="finish-bar-row"><span class="finish-bar-label">DEC</span><div class="finish-bar-track"><div class="finish-bar-fill dec" style="width:' + f(dec) + '%"></div></div><span class="finish-bar-pct">' + f(dec) + '%</span></div>' +
  '</div>';
}

function oddsChip(val) {
  const str = fmtOdds(val);
  if (str === "n/a") return "";
  const n = parseFloat(val);
  const isFav = !isNaN(n) && n < 0;
  return '<span class="odds-chip' + (isFav ? ' fav' : '') + '">' + str + '</span>';
}

function betChip(units) {
  const n = parseFloat(units);
  if (isNaN(n) || n <= 0) return "";
  return '<span class="bet-unit-chip">' + n.toFixed(1) + 'u</span>';
}

// ── Prop accordion ────────────────────────────────────────────────────────────

function buildPropAccordion(matchup, propRows) {
  if (!propRows || propRows.length === 0) return "";
  const flagged = propRows.filter(function(p) { return p.flagged === "True" || p.flagged === true; });
  const label   = flagged.length > 0 ? flagged.length + " flagged" : "view props";
  const rows    = propRows.map(function(p) {
    const isFlagged = p.flagged === "True" || p.flagged === true;
    return '<div class="prop-row"><span class="prop-label">' + (p.prop_label || p.prop_type || "Prop") + '</span><span class="prop-prob">' + fmtPct(p.model_prob) + '</span>' + (isFlagged ? '<span class="prop-flagged">Flagged</span>' : "") + '</div>';
  }).join("");

  return '<div class="prop-accordion" data-matchup="' + matchup + '">' +
    '<div class="prop-accordion-header" onclick="togglePropAccordion(this)">' +
      '<div class="prop-accordion-header-left">' +
        '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4" stroke="currentColor" stroke-width="1.2"/><line x1="5" y1="2.5" x2="5" y2="5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="5" cy="7" r="0.6" fill="currentColor"/></svg>' +
        'PROP BETS &mdash; ' + label +
      '</div>' +
      '<span class="prop-accordion-chevron">&#9660;</span>' +
    '</div>' +
    '<div class="prop-accordion-body">' + rows + '</div>' +
  '</div>';
}

function togglePropAccordion(header) {
  header.closest(".prop-accordion").classList.toggle("open");
}

// ── Metrics helper ────────────────────────────────────────────────────────────

function calcMetrics(rows) {
  const bets   = rows.filter(function(r) { return parseFloat(r.bet_size) > 0; });
  const wins   = bets.filter(function(r)  { return r.won === "1" || r.won === 1; });
  const staked = bets.reduce(function(s, r) { return s + parseFloat(r.bet_size || 0); }, 0);
  const ret    = bets.reduce(function(s, r) { return s + parseFloat(r.total_return || 0); }, 0);
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

// ── Sortable tables ───────────────────────────────────────────────────────────

function makeSortable(tableEl) {
  if (!tableEl) return;
  let sortCol = null, sortAsc = true;
  tableEl.querySelectorAll("thead th[data-sort]").forEach(function(th) {
    th.addEventListener("click", function() {
      const col = th.dataset.sort;
      if (sortCol === col) sortAsc = !sortAsc;
      else { sortCol = col; sortAsc = false; }
      tableEl.querySelectorAll("thead th").forEach(function(h) { h.classList.remove("sorted", "asc"); });
      th.classList.add("sorted");
      if (sortAsc) th.classList.add("asc");
      const tbody = tableEl.querySelector("tbody");
      Array.from(tbody.querySelectorAll("tr")).sort(function(a, b) {
        const ci = th.cellIndex;
        const av = a.querySelector('[data-val="' + col + '"]') ? a.querySelector('[data-val="' + col + '"]').dataset.raw : (a.cells[ci] ? a.cells[ci].textContent : "");
        const bv = b.querySelector('[data-val="' + col + '"]') ? b.querySelector('[data-val="' + col + '"]').dataset.raw : (b.cells[ci] ? b.cells[ci].textContent : "");
        const an = parseFloat(av), bn = parseFloat(bv);
        if (!isNaN(an) && !isNaN(bn)) return sortAsc ? an - bn : bn - an;
        return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      }).forEach(function(r) { tbody.appendChild(r); });
    });
  });
}

// ── Nav active state ──────────────────────────────────────────────────────────

function setActiveNav() {
  const path = window.location.pathname;
  document.querySelectorAll(".nav-link").forEach(function(link) {
    const href = link.getAttribute("href") || "";
    const base = href.split("/").pop().replace(".html", "");
    const isIndex = (base === "index" || base === "") &&
      (path.endsWith("/") || path.endsWith("index.html") || path === "/");
    const isMatch = base !== "" && base !== "index" && path.includes(base);
    link.classList.toggle("active", isIndex || isMatch);
  });
}

// ── Mobile nav ────────────────────────────────────────────────────────────────

function initMobileNav() {
  const hamburger = document.querySelector(".nav-hamburger");
  const menu      = document.querySelector(".nav-mobile-menu");
  if (!hamburger || !menu) return;

  hamburger.addEventListener("click", function() {
    const open = menu.classList.toggle("open");
    hamburger.classList.toggle("open", open);
    hamburger.setAttribute("aria-expanded", open);
  });

  document.addEventListener("click", function(e) {
    if (!hamburger.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.remove("open");
      hamburger.classList.remove("open");
    }
  });

  menu.querySelectorAll("a, button").forEach(function(a) {
    a.addEventListener("click", function() {
      menu.classList.remove("open");
      hamburger.classList.remove("open");
    });
  });
}

// ── Theme toggle (slider version) ────────────────────────────────────────────

function initThemeToggles() {
  document.querySelectorAll(".theme-toggle-slider").forEach(function(slider) {
    slider.addEventListener("click", function() { toggleTheme(); });
  });
}

// ── V1 Overlay system ─────────────────────────────────────────────────────────

let _v1OverlayInitialised = false;

function openV1Overlay() {
  const overlay = document.getElementById("v1-overlay");
  if (!overlay) return;
  overlay.classList.add("active");
  document.body.style.overflow = "hidden";
  if (!_v1OverlayInitialised) {
    _v1OverlayInitialised = true;
    initV1OverlayContent();
  }
  updateV1Toggle(true);
}

function closeV1Overlay() {
  const overlay = document.getElementById("v1-overlay");
  if (!overlay) return;
  overlay.classList.remove("active");
  document.body.style.overflow = "";
  updateV1Toggle(false);
}

function updateV1Toggle(v1Active) {
  document.querySelectorAll(".nav-v1-toggle").forEach(function(el) {
    const v2Opt = el.querySelector(".opt-v2");
    const v1Opt = el.querySelector(".opt-v1");
    if (v2Opt) v2Opt.classList.toggle("active-opt", !v1Active);
    if (v1Opt) v1Opt.classList.toggle("active-opt",  v1Active);
  });
}

let _v1CurrentPanel = "predictions";

function showV1Panel(panel) {
  _v1CurrentPanel = panel;
  document.querySelectorAll(".v1-panel").forEach(function(el) {
    el.style.display = el.dataset.panel === panel ? "" : "none";
  });
  document.querySelectorAll(".v1-subnav-tab, .v1-nav-link").forEach(function(btn) {
    btn.classList.toggle("active", btn.dataset.panel === panel);
  });
  const overlay = document.getElementById("v1-overlay");
  if (overlay) overlay.scrollTop = 0;
}

// ── Chart defaults ────────────────────────────────────────────────────────────

function chartDefaults() {
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  return {
    textColor:  isDark ? "#3e3e54" : "#9494ac",
    gridColor:  isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)",
    tooltipBg:  isDark ? "#18181f" : "#ffffff",
    tooltipText:isDark ? "#eeeef6" : "#111118",
    font:       "'IBM Plex Mono', monospace",
  };
}

// ── Init ──────────────────────────────────────────────────────────────────────

initTheme();

document.addEventListener("DOMContentLoaded", function() {
  setActiveNav();
  initMobileNav();
  initThemeToggles();
  initPageTransitions();

  // V1 toggle
  document.querySelectorAll(".nav-v1-toggle").forEach(function(el) {
    el.addEventListener("click", function() {
      const overlay = document.getElementById("v1-overlay");
      if (!overlay) return;
      if (overlay.classList.contains("active")) closeV1Overlay();
      else openV1Overlay();
    });
  });

  // V1 back buttons
  document.querySelectorAll(".v1-close-btn, .v1-back-btn").forEach(function(btn) {
    btn.addEventListener("click", closeV1Overlay);
  });
});

// Listen for system theme changes
window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", function(e) {
  if (!localStorage.getItem("os-theme")) applyTheme(e.matches ? "light" : "dark");
});
