/* =====================================================================
   phrase-engine.js — shared engine for every chapter's Phrases.html.
   The chapter page only provides:
     window.CHAPTER_CURRENT   : number — which chapter this page is
     window.PHRASES           : array  — phrase data for this chapter
   The engine reads:
     window.CHAPTERS, window.HOME_HREF  (from assets/chapters.js)
   and renders the entire page (nav drawer, header, toolbar, cards,
   help, diagnostics) into document.body.

   Phrase shape:
     {p, pe, v, a, e, eh?, ah?}
       p   Arabic headword (group title; also default Arabic highlight target)
       pe  English headword/gloss (group title; also default English highlight target)
       v   verse key "S:A"
       a   phrase Arabic
       e   phrase English
       eh  OPTIONAL string[] — English substrings to highlight (overrides auto-derive)
       ah  OPTIONAL string[] — Arabic substrings to highlight (overrides default which uses p)
   ===================================================================== */
(function () {
'use strict';

const CHAPTERS = window.CHAPTERS || [];
const HOME_HREF = window.HOME_HREF || "../../index.html";
const PHRASES = window.PHRASES || [];
const CHAPTER_NUM = window.CHAPTER_CURRENT;
const CHAPTER = CHAPTERS.find(c => c.num === CHAPTER_NUM) || {};

// ============================================================
//  Arabic normalization
//  Diacritic ranges written as Unicode escapes — bug-proof against
//  char-class ordering mistakes.
// ============================================================
const DIACS_RE = /[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿ]/g;

function normAr(s) {
  if (!s) return "";
  s = s.normalize("NFC");
  s = s.replace(DIACS_RE, "");
  s = s.replace(/[إأآٱا]/g, "ا"); // إأآٱا → ا
  s = s.replace(/ى/g, "ي");                          // ى → ي
  s = s.replace(/ؤ/g, "و");                          // ؤ → و
  s = s.replace(/ئ/g, "ي");                          // ئ → ي
  s = s.replace(/ة/g, "ه");                          // ة → ه
  s = s.replace(/[ـ\s ]/g, "");                           // tatweel + whitespace
  s = s.replace(/[،؛؟!\.,۝]/g, "");
  return s;
}

// ============================================================
//  Highlight: Arabic
//  Build a regex that matches the headword with arbitrary diacritics
//  between letters in the un-normalized phrase text.
// ============================================================
const AR_LETTER_GROUP = {
  "ا": "[إأآٱا]", // ا → any alif variant
  "ي": "[يىئ]",                  // ي → ي / ى / ئ (yeh-with-hamza)
  "و": "[وؤ]",                   // و → و / ؤ
  "ه": "[هة]",                   // ه → ه / ة
};
// Diacritics + tatweel + whitespace can appear between any two letters
// of the headword as it sits in the phrase text.
const DIACS_PAT = "[\\u0610-\\u061A\\u064B-\\u065F\\u0670\\u06D6-\\u06ED\\u08D3-\\u08FF\\u0640\\s]*";

function buildArabicRegex(headword) {
  const norm = normAr(headword);
  if (!norm) return null;
  const letters = [...norm];
  const parts = letters.map(c => {
    if (AR_LETTER_GROUP[c]) return AR_LETTER_GROUP[c];
    return c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  });
  try { return new RegExp(parts.join(DIACS_PAT), "g"); }
  catch (e) { return null; }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
}

function highlightArabic(phraseText, phrase) {
  const heads = phrase.ah && phrase.ah.length ? phrase.ah
              : (phrase.p ? phrase.p.split(/\s*…\s*|\s*\.{3,}\s*/).filter(s => s.trim()) : []);
  // Find every match span across all heads, in the original phraseText.
  const spans = []; // [start, end]
  for (const head of heads) {
    const re = buildArabicRegex(head);
    if (!re) continue;
    let m; re.lastIndex = 0;
    while ((m = re.exec(phraseText)) !== null) {
      if (m[0].length === 0) { re.lastIndex++; continue; }
      spans.push([m.index, m.index + m[0].length]);
    }
  }
  return wrapSpans(phraseText, spans);
}

function highlightEnglish(text, phrase) {
  const terms = phrase.eh && phrase.eh.length ? phrase.eh : autoEnglishTerms(phrase.pe);
  const spans = [];
  for (const term of terms) {
    if (!term) continue;
    // Escape regex metacharacters, then loosen inter-word whitespace so
    // the search is flexible across commas/semicolons/etc that may appear
    // between words in the actual phrase (e.g. "Yes, indeed" should match
    // "Yes indeed" too).
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const flex = escaped.replace(/[\s,;:!?\-—]+/g, "[\\s,;:!?\\-—]+");
    const re = new RegExp(flex, "gi");
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) { re.lastIndex++; continue; }
      spans.push([m.index, m.index + m[0].length]);
    }
  }
  return wrapSpans(text, spans);
}

function autoEnglishTerms(pe) {
  if (!pe) return [];
  // Strip parenthesized and bracketed parts; trim em-dash suffix.
  let s = pe.replace(/\([^)]*\)/g, "")
            .replace(/\[[^\]]*\]/g, "")
            .replace(/\s*—.*$/, "")
            .replace(/\s+/g, " ").trim();
  if (!s) return [];
  // If contains " / ", treat each side as a candidate term.
  return s.split(/\s*\/\s*/).filter(Boolean);
}

// Merge overlapping spans, then wrap each in <mark class="focus">.
// Span indices refer to positions in plain text; we escape-HTML inside.
function wrapSpans(text, rawSpans) {
  if (rawSpans.length === 0) return escapeHtml(text);
  // sort + merge
  rawSpans.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const spans = [];
  for (const sp of rawSpans) {
    if (spans.length && sp[0] <= spans[spans.length - 1][1]) {
      spans[spans.length - 1][1] = Math.max(spans[spans.length - 1][1], sp[1]);
    } else {
      spans.push([sp[0], sp[1]]);
    }
  }
  // build HTML
  let out = "", pos = 0;
  for (const [s, e] of spans) {
    out += escapeHtml(text.slice(pos, s));
    out += '<mark class="focus">' + escapeHtml(text.slice(s, e)) + "</mark>";
    pos = e;
  }
  out += escapeHtml(text.slice(pos));
  return out;
}

// ============================================================
//  Audio: constants + cache + fetch + match
// ============================================================
const RECITER_ID = 7;
const API_BASE = "https://api.quran.com/api/v4/verses/by_key/";
const AUDIO_CDNS = [
  v => { const [s,a] = v.split(":").map(n => n.padStart(3,"0"));
         return `https://everyayah.com/data/Alafasy_128kbps/${s}${a}.mp3`; },
  v => `https://verses.quran.com/Alafasy/mp3/${v.split(":").map(n=>n.padStart(3,"0")).join("")}.mp3`,
  v => `https://download.quranicaudio.com/quran/mishaari_raashid_al_3afaasee/${v.split(":").map(n=>n.padStart(3,"0")).join("")}.mp3`,
  v => `https://audio.qurancdn.com/Alafasy/mp3/${v.split(":").map(n=>n.padStart(3,"0")).join("")}.mp3`,
];

function cacheKey(v) { return "qph_v_" + v; }
function getCached(v) {
  try {
    const raw = localStorage.getItem(cacheKey(v));
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (obj.ver !== 1) return null;
    return obj;
  } catch (e) { return null; }
}
function setCached(v, data) {
  try { localStorage.setItem(cacheKey(v), JSON.stringify({ver:1, ...data})); } catch (e) {}
}

async function fetchAyah(v) {
  const cached = getCached(v);
  if (cached) return cached;
  const url = `${API_BASE}${encodeURIComponent(v)}?audio=${RECITER_ID}&words=true&word_fields=text_uthmani,position`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("API " + resp.status);
  const data = await resp.json();
  const verse = data.verse;
  const words = verse.words
    .filter(w => w.char_type_name === "word")
    .map(w => ({pos: w.position, text: w.text_uthmani || w.text}));
  const segments = (verse.audio && verse.audio.segments) || [];
  const segByPos = {};
  for (const seg of segments) if (seg.length >= 4) segByPos[seg[1]] = [seg[2], seg[3]];
  const out = {words, segByPos, verseKey: v};
  setCached(v, out);
  return out;
}

function matchPhrase(phraseAr, words) {
  const target = normAr(phraseAr);
  if (!target) return null;
  let cat = "";
  const spans = [];
  for (const w of words) {
    const n = normAr(w.text);
    spans.push({start: cat.length, end: cat.length + n.length, pos: w.pos});
    cat += n;
  }
  const idx = cat.indexOf(target);
  if (idx < 0) return null;
  const endIdx = idx + target.length;
  let first = null, last = null;
  for (const sp of spans) {
    if (first === null && sp.start <= idx && idx < sp.end) first = sp.pos;
    if (sp.start < endIdx && endIdx <= sp.end) { last = sp.pos; break; }
  }
  if (first === null) for (const sp of spans) if (sp.start >= idx) { first = sp.pos; break; }
  if (last === null) {
    for (let i = spans.length - 1; i >= 0; i--) if (spans[i].end <= endIdx) { last = spans[i].pos; break; }
    if (last === null && first !== null) last = first;
  }
  if (first === null || last === null) return null;
  return {first, last};
}

function rangeMs(match, segByPos) {
  if (!match) return null;
  const s = segByPos[match.first];
  const e = segByPos[match.last];
  if (!s || !e) return null;
  return {startMs: s[0], endMs: e[1]};
}

// ============================================================
//  Page render — build entire <body> contents
// ============================================================
const SVG_HAMBURGER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>';
const SVG_CLOSE     = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M6 18L18 6"/></svg>';
const SVG_PLAY      = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';

function buildNavList() {
  return CHAPTERS.map(c => {
    const isCurrent = c.num === CHAPTER_NUM;
    const attr = isCurrent ? ' aria-current="page"' : "";
    return `<li><a href="${escapeHtml(c.href)}"${attr}><span class="num">Chapter ${c.num} · List ${c.list}</span>${escapeHtml(c.title)}</a></li>`;
  }).join("");
}

function pageHeaderTitle() {
  if (CHAPTER.num) return `Chapter ${CHAPTER.num} — ${CHAPTER.title}`;
  return "Quranic Phrases";
}

function renderShell() {
  document.title = `${pageHeaderTitle()} | Quranic Phrases`;
  document.body.innerHTML = `
    <div class="nav-backdrop" id="navBackdrop" aria-hidden="true"></div>
    <aside class="nav-drawer" id="navDrawer" aria-label="Site navigation" aria-hidden="true">
      <div class="nav-head">
        <div class="brand"><span class="ar">قرآن</span>Quranic Vocab</div>
        <button class="nav-close" id="navClose" aria-label="Close navigation">${SVG_CLOSE}</button>
      </div>
      <div class="nav-section">Navigate</div>
      <ul class="nav-list">
        <li><a href="${escapeHtml(HOME_HREF)}"><span class="num">Start</span>Home</a></li>
      </ul>
      <div class="nav-section">Chapters</div>
      <ul class="nav-list">${buildNavList()}</ul>
      <div class="nav-foot">More chapters coming as they're built.</div>
    </aside>

    <header>
      <button class="nav-toggle" id="navToggle" aria-label="Open navigation" aria-controls="navDrawer" aria-expanded="false">${SVG_HAMBURGER}</button>
      <div class="titles">
        <h1>${escapeHtml(pageHeaderTitle())}</h1>
        <p class="sub">Quranic example phrases · Reciter: Mishary bin Rashid al-Afasy · Audio plays only the phrase span (trimmed at runtime from the full ayah).</p>
      </div>
    </header>

    <div class="toolbar">
      <label>Font
        <select id="fontPick">
          <option value="amiri">Amiri Quran (recommended)</option>
          <option value="scheherazade">Scheherazade New</option>
        </select>
      </label>
      <label>Size <span id="sizeLabel" style="font-variant-numeric:tabular-nums; color:var(--ink); min-width:54px; display:inline-block;">36 / 17</span>
        <input id="size" type="range" min="26" max="48" value="36">
      </label>
      <label id="enSizeWrap" hidden>English <span id="enSizeLabel" style="font-variant-numeric:tabular-nums; color:var(--ink); min-width:24px; display:inline-block;">17</span>
        <input id="enSize" type="range" min="16" max="24" value="17">
      </label>
      <label><input id="unlinkEn" type="checkbox"> Unlink English</label>
      <label><input id="autoNext" type="checkbox"> Auto-play next</label>
      <span class="status" id="status">loading timings…</span>
    </div>

    <main id="main"></main>

    <details class="help" open>
      <summary>How playback works</summary>
      <div class="body">
        <p><span class="legend"><span class="pill ok"><span class="dot"></span>trimmed</span></span>
           phrase-only audio: starts at the first word of the phrase, stops at the last word.
           <span class="legend" style="margin-left:14px;"><span class="pill full"><span class="dot"></span>full ayah</span></span>
           fallback if phrase word-positions can't be matched — plays the whole ayah.
           <span class="legend" style="margin-left:14px;"><span class="pill fail"><span class="dot"></span>error</span></span>
           audio or timing couldn't load.</p>
        <p>Word-level timing data comes from the Quran.com API (reciter id 7 = Alafasy). It loads once per ayah on first visit, then caches in your browser for instant playback next time. Audio streams from the EveryAyah CDN with three fallback CDNs if it's blocked.</p>
      </div>
    </details>

    <details class="help" id="diagWrap">
      <summary>Diagnostics (open this if audio doesn't play)</summary>
      <div class="body">
        <p style="margin-top:0;">
          <button id="testAudio" class="diag-btn">Test audio (plays Surah Fatiha ayah 1)</button>
          <button id="clearCache" class="diag-btn">Clear cache + reload</button>
          <button id="copyDiag" class="diag-btn">Copy log</button>
        </p>
        <p style="font-size:12px; color: var(--muted); margin: 6px 0;">
          If you see <code>NETWORK</code> errors → your network or browser is blocking the CDN. Try a different network, disable ad-blockers, or check the browser console (F12).<br>
          If you see <code>SRC_NOT_SUPPORTED</code> → your browser can't play the MP3 from that URL (rare; try a different browser).<br>
          If <em>no log entries appear</em> when you click Play → the timing data hasn't loaded yet. Wait for the status bar at the top to say "ready", or click "Clear cache + reload".
        </p>
        <pre id="diagLog"></pre>
      </div>
    </details>

    <audio id="player" preload="none"></audio>
  `;
}

// ============================================================
//  UI: render phrase cards, grouped by headword
// ============================================================
const main      = () => document.getElementById("main");
const statusEl  = () => document.getElementById("status");
const fontPick  = () => document.getElementById("fontPick");
const sizeRange = () => document.getElementById("size");
const sizeLabel = () => document.getElementById("sizeLabel");
const enSizeRange = () => document.getElementById("enSize");
const enSizeWrap  = () => document.getElementById("enSizeWrap");
const enSizeLabel = () => document.getElementById("enSizeLabel");
const unlinkEnCb  = () => document.getElementById("unlinkEn");
const autoNextCb  = () => document.getElementById("autoNext");
const player      = () => document.getElementById("player");

const FONT_FAMILIES = {
  amiri: "'Amiri Quran', serif",
  scheherazade: "'Scheherazade New', serif",
};
const LINE_HEIGHT = { amiri: 2.05, scheherazade: 1.85 };

function linkedEnglishSize(arSize) {
  return Math.min(22, Math.max(16, Math.round(arSize * 0.46)));
}

function renderPhrases() {
  const m = main();
  m.innerHTML = "";
  let currentKey = "";
  let group = null;
  PHRASES.forEach((p, i) => {
    const key = p.p + "||" + p.pe;
    if (key !== currentKey) {
      currentKey = key;
      group = document.createElement("section");
      group.className = "group";
      const h2 = document.createElement("h2");
      h2.innerHTML = `${escapeHtml(p.pe)}<span class="ar">${escapeHtml(p.p)}</span>`;
      group.appendChild(h2);
      m.appendChild(group);
    }
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.idx = i;
    card.innerHTML = `
      <button class="play" data-idx="${i}" aria-label="Play phrase">${SVG_PLAY}</button>
      <div class="body">
        <div class="arabic">${highlightArabic(p.a, p)}</div>
        <div class="english">“${highlightEnglish(p.e, p)}”</div>
        <div class="meta">
          <span class="ref">[${escapeHtml(p.v)}]</span>
          <span class="pill" data-pill="${i}"><span class="dot"></span>loading…</span>
        </div>
      </div>
    `;
    group.appendChild(card);
  });
  applyFontAndSize();
  bindPlay();
}

function applyFontAndSize() {
  const fam = fontPick().value;
  const arSize = parseInt(sizeRange().value, 10);
  const enSize = unlinkEnCb().checked ? parseInt(enSizeRange().value, 10) : linkedEnglishSize(arSize);
  if (!unlinkEnCb().checked) enSizeRange().value = enSize;
  sizeLabel().textContent = `${arSize} / ${enSize}`;
  enSizeLabel().textContent = enSize;
  document.querySelectorAll(".body .arabic").forEach(el => {
    el.style.fontFamily = FONT_FAMILIES[fam];
    el.style.fontSize = arSize + "px";
    el.style.lineHeight = LINE_HEIGHT[fam];
  });
  document.querySelectorAll(".body .english").forEach(el => {
    el.style.fontSize = enSize + "px";
  });
  document.querySelectorAll(".group h2 .ar").forEach(el => {
    el.style.fontFamily = FONT_FAMILIES[fam];
  });
}

// ============================================================
//  Resolve timings up-front
// ============================================================
const resolved = new Array(PHRASES.length).fill(null);

async function resolveAll() {
  const unique = [...new Set(PHRASES.map(p => p.v))];
  let done = 0;
  statusEl().textContent = `loading timings 0/${unique.length}`;
  await Promise.all(unique.map(async v => {
    try {
      const ay = await fetchAyah(v);
      PHRASES.forEach((p, i) => {
        if (p.v !== v) return;
        const mt = matchPhrase(p.a, ay.words);
        const range = rangeMs(mt, ay.segByPos);
        resolved[i] = range
          ? {verseKey: ay.verseKey, ...range, kind: "ok"}
          : {verseKey: ay.verseKey, kind: "full"};
      });
    } catch (err) {
      PHRASES.forEach((p, i) => { if (p.v !== v) return; resolved[i] = {kind: "fail", err: err.message}; });
    } finally {
      done++; statusEl().textContent = `loading timings ${done}/${unique.length}`;
      updatePills();
    }
  }));
  statusEl().textContent = `ready · ${resolved.filter(r => r && r.kind === "ok").length}/${PHRASES.length} trimmed`;
}

function updatePills() {
  resolved.forEach((r, i) => {
    const pill = document.querySelector(`[data-pill="${i}"]`);
    if (!pill) return;
    if (!r) { pill.className = "pill"; pill.innerHTML = '<span class="dot"></span>loading…'; return; }
    if (r.kind === "ok")   { pill.className = "pill ok";   pill.innerHTML = '<span class="dot"></span>trimmed'; }
    if (r.kind === "full") { pill.className = "pill full"; pill.innerHTML = '<span class="dot"></span>full ayah (fallback)'; }
    if (r.kind === "fail") { pill.className = "pill fail"; pill.innerHTML = '<span class="dot"></span>error'; }
  });
}

// ============================================================
//  Playback w/ CDN fallback
// ============================================================
let activeIdx = -1;
let stopAt = null;
let onTimeUpdate = null;
let workingCdnIdx = parseInt(localStorage.getItem("qph_cdn") || "0", 10);
const diag = [];

function logDiag(msg, type) {
  const t = new Date().toLocaleTimeString();
  diag.push({t, msg, type: type || "info"});
  if (diag.length > 50) diag.shift();
  console.log(`[Phrases ${t}] ${msg}`);
  renderDiag();
}

function stopAudio() {
  if (onTimeUpdate) { player().removeEventListener("timeupdate", onTimeUpdate); onTimeUpdate = null; }
  player().pause();
  if (activeIdx >= 0) {
    const btn = document.querySelector(`button.play[data-idx="${activeIdx}"]`);
    if (btn) btn.classList.remove("playing");
  }
  activeIdx = -1; stopAt = null;
}

function tryLoadAudio(verseKey, startCdnIdx) {
  return new Promise((resolve, reject) => {
    let cdnIdx = startCdnIdx;
    const tryNext = () => {
      if (cdnIdx >= AUDIO_CDNS.length) { reject(new Error("All CDNs failed for " + verseKey)); return; }
      const url = AUDIO_CDNS[cdnIdx](verseKey);
      logDiag(`Trying CDN ${cdnIdx}: ${url}`);
      const p = player();
      const onLoad = () => { cleanup(); workingCdnIdx = cdnIdx; localStorage.setItem("qph_cdn", String(cdnIdx)); logDiag(`✓ loaded from CDN ${cdnIdx}`, "ok"); resolve(url); };
      const onError = () => { cleanup(); logDiag(`✗ CDN ${cdnIdx} failed: ${p.error ? "code "+p.error.code+" ("+errCodeName(p.error.code)+")" : "unknown"}`, "err"); cdnIdx++; tryNext(); };
      const cleanup = () => { p.removeEventListener("loadedmetadata", onLoad); p.removeEventListener("error", onError); };
      p.addEventListener("loadedmetadata", onLoad, {once: true});
      p.addEventListener("error", onError, {once: true});
      p.src = url;
      p.load();
    };
    tryNext();
  });
}

function errCodeName(c) {
  return {1:"ABORTED",2:"NETWORK",3:"DECODE",4:"SRC_NOT_SUPPORTED"}[c] || "?";
}

async function play(i) {
  const r = resolved[i];
  if (!r || r.kind === "fail") { logDiag(`No resolved timing for phrase ${i}`, "err"); return; }
  if (activeIdx === i) { stopAudio(); return; }
  stopAudio();
  activeIdx = i;
  const btn = document.querySelector(`button.play[data-idx="${i}"]`);
  btn.classList.add("playing");

  let url;
  try { url = await tryLoadAudio(r.verseKey, workingCdnIdx); }
  catch (err) { logDiag(`Could not load audio for ${r.verseKey}: ${err.message}`, "err"); stopAudio(); return; }

  const p = player();
  if (r.kind === "ok") {
    const startSec = (r.startMs || 0) / 1000;
    stopAt = (r.endMs || 0) / 1000 + 0.05;
    p.currentTime = Math.max(0, startSec - 0.02);
    try { await p.play(); }
    catch (err) { logDiag(`play() rejected: ${err.message}`, "err"); stopAudio(); return; }
    logDiag(`▶ ${r.verseKey} [${startSec.toFixed(2)}s → ${stopAt.toFixed(2)}s]`);
    onTimeUpdate = () => {
      if (p.currentTime >= stopAt) {
        stopAudio();
        if (autoNextCb().checked && i + 1 < PHRASES.length) setTimeout(() => play(i+1), 250);
      }
    };
    p.addEventListener("timeupdate", onTimeUpdate);
  } else {
    p.currentTime = 0;
    try { await p.play(); } catch (err) { logDiag(`play() rejected: ${err.message}`, "err"); stopAudio(); return; }
    logDiag(`▶ ${r.verseKey} (full ayah)`);
    p.addEventListener("ended", () => {
      stopAudio();
      if (autoNextCb().checked && i + 1 < PHRASES.length) setTimeout(() => play(i+1), 250);
    }, {once: true});
  }
}

function bindPlay() {
  document.querySelectorAll("button.play").forEach(btn => {
    btn.onclick = () => play(parseInt(btn.dataset.idx, 10));
  });
}

// ============================================================
//  Preferences (font, size, etc) persistence
// ============================================================
function loadPrefs() {
  const f = localStorage.getItem("qph_font"); if (f) fontPick().value = f;
  const s = localStorage.getItem("qph_size");
  if (s) {
    const n = parseInt(s, 10);
    sizeRange().value = Math.min(48, Math.max(26, isNaN(n) ? 36 : n));
  }
  const u = localStorage.getItem("qph_unlink"); if (u === "1") unlinkEnCb().checked = true;
  const e = localStorage.getItem("qph_enSize"); if (e) enSizeRange().value = e;
  enSizeWrap().hidden = !unlinkEnCb().checked;
  const a = localStorage.getItem("qph_autonext"); if (a === "1") autoNextCb().checked = true;
}

function wirePrefs() {
  fontPick().addEventListener("change", () => { localStorage.setItem("qph_font", fontPick().value); applyFontAndSize(); });
  sizeRange().addEventListener("input", () => { localStorage.setItem("qph_size", sizeRange().value); applyFontAndSize(); });
  enSizeRange().addEventListener("input", () => { localStorage.setItem("qph_enSize", enSizeRange().value); applyFontAndSize(); });
  unlinkEnCb().addEventListener("change", () => {
    localStorage.setItem("qph_unlink", unlinkEnCb().checked ? "1" : "0");
    enSizeWrap().hidden = !unlinkEnCb().checked;
    applyFontAndSize();
  });
  autoNextCb().addEventListener("change", () => { localStorage.setItem("qph_autonext", autoNextCb().checked ? "1" : "0"); });
}

// ============================================================
//  Diagnostics UI
// ============================================================
function renderDiag() {
  const diagLog = document.getElementById("diagLog");
  if (!diagLog) return;
  diagLog.innerHTML = diag.map(d => `<span class="${d.type}">[${d.t}] ${d.msg.replace(/</g,"&lt;")}</span>`).join("\n");
  diagLog.scrollTop = diagLog.scrollHeight;
}

function wireDiag() {
  document.getElementById("testAudio").addEventListener("click", async () => {
    document.getElementById("diagWrap").open = true;
    logDiag("=== Test playback: 1:1 ===");
    stopAudio();
    try {
      const url = await tryLoadAudio("1:1", 0);
      player().currentTime = 0;
      await player().play();
      logDiag(`✓ Playing test audio from ${url}`, "ok");
    } catch (err) {
      logDiag(`✗ Test failed: ${err.message}`, "err");
    }
  });
  document.getElementById("clearCache").addEventListener("click", () => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("qph_")) localStorage.removeItem(k);
    logDiag("Cleared cache. Reloading…");
    setTimeout(() => location.reload(), 300);
  });
  document.getElementById("copyDiag").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(diag.map(d => `[${d.t}] ${d.msg}`).join("\n")); logDiag("Copied log to clipboard", "ok"); }
    catch (e) { logDiag("Copy failed: " + e.message, "err"); }
  });
  logDiag(`User agent: ${navigator.userAgent.slice(0,120)}`);
  logDiag(`Page protocol: ${location.protocol}`);
  if (location.protocol === "file:") logDiag("⚠ Loaded from file:// — fetch() to api.quran.com may be blocked in some browsers. If timings don't load, open via a local server.", "err");
}

// ============================================================
//  Nav drawer interactions
// ============================================================
function wireNav() {
  const toggle = document.getElementById("navToggle");
  const close = document.getElementById("navClose");
  const drawer = document.getElementById("navDrawer");
  const backdrop = document.getElementById("navBackdrop");
  function open() { drawer.classList.add("open"); backdrop.classList.add("open"); drawer.setAttribute("aria-hidden","false"); toggle.setAttribute("aria-expanded","true"); }
  function shut() { drawer.classList.remove("open"); backdrop.classList.remove("open"); drawer.setAttribute("aria-hidden","true"); toggle.setAttribute("aria-expanded","false"); }
  toggle.addEventListener("click", open);
  close.addEventListener("click", shut);
  backdrop.addEventListener("click", shut);
  document.addEventListener("keydown", e => { if (e.key === "Escape") shut(); });
}

// ============================================================
//  Boot
// ============================================================
function boot() {
  renderShell();
  loadPrefs();
  wirePrefs();
  wireNav();
  wireDiag();
  renderPhrases();
  resolveAll();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

})();
