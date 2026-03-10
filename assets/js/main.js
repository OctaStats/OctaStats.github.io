/**
 * OctaStats - Shared JS utilities v4
 * Slider theme toggle, V1 overlay, data, formatting, nav, page transitions.
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
  // Try V2 repo first (primary source written by 04_predict.py)
  const data = await fetchJSON(DATA_BASE + "/titles/fight_titles.json");
  if (data && (data.upcoming || data.upcoming_event)) return data;
  // Fallback: V1 repo titles
  const v1data = await fetchJSON(V1_DATA_BASE + "/titles/fight_titles.json");
  return v1data || {};
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
  const b = await fetchJSON(V1_DATA_BASE + "/statistics/ufc_statistical_analysis.json");
  if (b) return b;
  // Fall back: build stats from raw CSV
  return await buildV1StatsFromCSV();
}

async function buildV1StatsFromCSV() {
  const rows = await getV1AllResults();
  if (!rows || !rows.length) return null;
  const bets = rows.filter(r => parseFloat(r.bet_size || r.units || 0) > 0);
  if (!bets.length) return null;

  const wins = bets.filter(r => r.won === "1" || r.won === 1);
  // Compute total_return: if not present in CSV, derive from net + bet_size
  function getTotalReturn(r) {
    const tr = parseFloat(r.total_return);
    if (!isNaN(tr) && (r.total_return !== "" && r.total_return !== undefined)) return tr;
    const bs = parseFloat(r.bet_size || r.units || 0);
    const net = parseFloat(r.net || r.profit || 0);
    return bs + net;
  }
  const totalStaked = bets.reduce((s,r) => s + parseFloat(r.bet_size || r.units || 0), 0);
  const totalReturn = bets.reduce((s,r) => s + getTotalReturn(r), 0);
  const netUnits = totalReturn - totalStaked;
  const rtp = totalStaked > 0 ? (totalReturn / totalStaked * 100) : 0;
  const winRate = bets.length > 0 ? (wins.length / bets.length * 100) : 0;

  // T-test: multipliers vs break-even (0.96)
  const multipliers = bets.map(r => {
    const bs = parseFloat(r.bet_size || r.units || 0);
    const tr = getTotalReturn(r);
    return bs > 0 ? tr / bs : 0;
  });
  const n = multipliers.length;
  const mean = multipliers.reduce((s,x) => s+x, 0) / n;
  const variance = multipliers.reduce((s,x) => s + Math.pow(x - mean, 2), 0) / (n - 1);
  const se = Math.sqrt(variance / n);
  const t = se > 0 ? (mean - 0.96) / se : 0;
  // One-sided p-value approximation via t-distribution
  function tCDF(t, df) {
    const x = df / (df + t * t);
    let ib = 0, a = df/2, b = 0.5;
    // Simple beta regularized approximation
    const bt = Math.exp(a*Math.log(x) + b*Math.log(1-x));
    const coeff = bt / (a * (function betaFn(a,b){ let res=1; for(let i=0;i<50;i++){res*=(a+i)/(a+b+i);} return res; })(a,b));
    return Math.min(1, Math.max(0, coeff));
  }
  // Simple normal approx for p-value
  function normalCDF(z) {
    const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
    const sign = z < 0 ? -1 : 1;
    const absZ = Math.abs(z);
    const t2 = 1 / (1 + p * absZ);
    const poly = ((((a5*t2+a4)*t2+a3)*t2+a2)*t2+a1)*t2;
    return 0.5 * (1 + sign * (1 - poly * Math.exp(-absZ*absZ/2)));
  }
  const pValue = 1 - normalCDF(t);
  const conclusion = pValue < 0.05 ? "Reject H0" : "Fail to Reject H0";

  // Monthly aggregation
  const monthMap = new Map();
  bets.forEach(r => {
    const d = r.date_added || r.date || "";
    const month = d.length >= 7 ? d.substring(0, 7) : "Unknown";
    if (!monthMap.has(month)) monthMap.set(month, {bets:0,wins:0,staked:0,ret:0});
    const m = monthMap.get(month);
    const bs = parseFloat(r.bet_size || r.units || 0);
    m.bets++;
    m.staked += bs;
    m.ret += getTotalReturn(r);
    if (r.won === "1" || r.won === 1) m.wins++;
  });
  const monthly = Array.from(monthMap.entries())
    .sort((a,b) => a[0].localeCompare(b[0]))
    .map(([month, m]) => ({
      month,
      bets: m.bets,
      wins: m.wins,
      win_rate: m.bets > 0 ? m.wins/m.bets*100 : 0,
      units_staked: m.staked,
      net_units: m.ret - m.staked,
      rtp: m.staked > 0 ? m.ret/m.staked*100 : 0,
    }));

  // Bet size distribution
  const bsd = {"0-1":0,"1-2":0,"2-3":0,"3-4":0,"4-5":0};
  bets.forEach(r => {
    const bs = parseFloat(r.bet_size || r.units || 0);
    if (bs < 1) bsd["0-1"]++; else if (bs < 2) bsd["1-2"]++; else if (bs < 3) bsd["2-3"]++; else if (bs < 4) bsd["3-4"]++; else bsd["4-5"]++;
  });
  const meanUnits = bets.reduce((s,r) => s + parseFloat(r.bet_size || r.units || 0), 0) / bets.length;

  // Odds buckets for RTP-by-odds
  const oddsBuckets = {
    "Big Fav (<-200)": {staked:0,ret:0},
    "Fav (-200/-101)": {staked:0,ret:0},
    "Pick'em": {staked:0,ret:0},
    "Dog (+101/+200)": {staked:0,ret:0},
    "Big Dog (>+200)": {staked:0,ret:0}
  };
  bets.forEach(r => {
    const odds = parseFloat(r.Odds || r.odds_numeric || 0);
    const bs = parseFloat(r.bet_size || r.units || 0);
    const ret = getTotalReturn(r);
    if (!odds || bs <= 0) return;
    const key = odds < -200 ? "Big Fav (<-200)" : odds < -100 ? "Fav (-200/-101)" : odds <= 100 ? "Pick'em" : odds <= 200 ? "Dog (+101/+200)" : "Big Dog (>+200)";
    oddsBuckets[key].staked += bs;
    oddsBuckets[key].ret += ret;
  });

  return {
    overall_performance: {
      total_bets: bets.length,
      total_wins: wins.length,
      total_losses: bets.length - wins.length,
      win_rate_pct: winRate,
      net_units: netUnits,
      rtp_pct: rtp,
    },
    basic_statistics: { count: bets.length, mean_return: mean },
    t_test: {
      t_statistic: t,
      p_value_one_sided: pValue,
      conclusion,
    },
    monthly_performance: monthly,
    bet_size_distribution: {
      mean_units: meanUnits,
      units_by_bucket: bsd,
    },
    odds_buckets: oddsBuckets,
    _raw_bets: bets,
  };
}

// ── Formatters ────────────────────────────────────────────────────────────────

function gamblyUrl(prompt) {
  return "https://gambly.com/gambly-bot?auto=1&prompt=" + encodeURIComponent(prompt.toLowerCase().replace(/\s+/g, "+"));
}

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

function shiftBadge() {
  return '<span class="badge badge-shift">Style Shift</span>';
}

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
        'PROP BETS - ' + label +
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
  const bets   = rows.filter(function(r) { return parseFloat(r.bet_size || r.units || 0) > 0; });
  const wins   = bets.filter(function(r)  { return r.won === "1" || r.won === 1; });
  const staked = bets.reduce(function(s, r) { return s + parseFloat(r.bet_size || r.units || 0); }, 0);
  // V2 CSV has total_return; V1 CSV only has net. Derive whichever is missing.
  const ret    = bets.reduce(function(s, r) {
    const tr = parseFloat(r.total_return);
    if (!isNaN(tr) && r.total_return !== "" && r.total_return !== undefined) return s + tr;
    const bs  = parseFloat(r.bet_size || r.units || 0);
    const net = parseFloat(r.net || r.profit || 0);
    return s + (bs + net);
  }, 0);
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
let _v1Open = false;

// ── V1 state persistence across pages ────────────────────────────────────────
function getV1State() {
  try { return localStorage.getItem("os-model") === "v1"; } catch(e) { return false; }
}
function setV1State(isV1) {
  try { localStorage.setItem("os-model", isV1 ? "v1" : "v2"); } catch(e) {}
}

function openV1Overlay() {
  _v1Open = true;
  setV1State(true);
  const overlay = document.getElementById("v1-overlay");
  const mainEl  = document.querySelector("main.page");
  const footerEl = document.querySelector("footer");
  if (!overlay) return;
  overlay.style.display = "block";
  if (mainEl) mainEl.style.display = "none";
  if (footerEl) footerEl.style.display = "none";
  window.scrollTo(0, 0);
  if (!_v1OverlayInitialised) {
    _v1OverlayInitialised = true;
    initV1OverlayContent();
  }
  updateV1Toggle(true);
  _patchNavLinksForModel(true);
}

function closeV1Overlay() {
  _v1Open = false;
  setV1State(false);
  const overlay = document.getElementById("v1-overlay");
  const mainEl  = document.querySelector("main.page");
  const footerEl = document.querySelector("footer");
  if (!overlay) return;
  overlay.style.display = "none";
  if (mainEl) mainEl.style.display = "";
  if (footerEl) footerEl.style.display = "";
  window.scrollTo(0, 0);
  updateV1Toggle(false);
  _patchNavLinksForModel(false);
}

function _patchNavLinksForModel(isV1) {
  document.querySelectorAll("a.nav-link, a.btn-nav-link").forEach(function(link) {
    const href = link.getAttribute("href") || "";
    if (!href || href.startsWith("http") || href.startsWith("#")) return;
    const base = href.split("?")[0];
    link.setAttribute("href", isV1 ? base + "?model=v1" : base);
  });
}

function updateV1Toggle(v1Active) {
  document.querySelectorAll(".nav-v1-toggle").forEach(function(el) {
    const v2Opt = el.querySelector(".opt-v2");
    const v1Opt = el.querySelector(".opt-v1");
    if (v2Opt) v2Opt.classList.toggle("active-opt", !v1Active);
    if (v1Opt) v1Opt.classList.toggle("active-opt",  v1Active);
    // Slide the animated pill
    el.classList.toggle("v1-active", v1Active);
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
    textColor:  isDark ? "#9090b8" : "#6060a0",
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
      if (_v1Open) closeV1Overlay();
      else         openV1Overlay();
    });
  });

  // V1 back buttons
  document.querySelectorAll(".v1-close-btn, .v1-back-btn").forEach(function(btn) {
    btn.addEventListener("click", closeV1Overlay);
  });

  // Auto-restore V1 state from localStorage or ?model=v1 URL param
  const urlParam = new URLSearchParams(window.location.search).get("model");
  const shouldOpenV1 = urlParam === "v1" || (!urlParam && getV1State());
  if (shouldOpenV1 && document.getElementById("v1-overlay")) {
    // Small delay so page renders before overlay switches
    setTimeout(openV1Overlay, 0);
  }
});

// Listen for system theme changes
window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", function(e) {
  if (!localStorage.getItem("os-theme")) applyTheme(e.matches ? "light" : "dark");
});
