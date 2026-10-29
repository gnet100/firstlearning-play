// FL.learner: the child's shared letter card for every letter game (scoring thread, 15.10.2026).
// Design: /mnt/project-files/games/scoring/learner-model.md (version 3, all of Golan's decisions).
// Load after letter-pairs.js:  <script src="../shared/letter-pairs.js"></script><script src="../shared/learner.js"></script>
// Storage: one localStorage key for all games, wrapped because storage can be blocked. Never throws.
(function (root) {
  "use strict";
  const FL = (root.FL = root.FL || {});
  // Feedback lines that have several recordings: whichever one of a group a game asks for, a random one of the group plays,
  // never the same twice in a row (Golan 28.10, every game, every stage). List only clips that are recorded; a new one goes here.
  FL.VARIANTS = [
    ["fb_choice1", "fb_choice2", "fb_choice3", "fb_choice4"],    // after picking a balloon / a board (3-4 recorded 28.10)
    ["fb_correct", "fb_correct2", "fb_correct3", "fb_correct4"],   // a right answer (2-4 recorded 28.10)
  ];
  const lastOf = new Map();
  FL.vary = (id) => {
    const g = FL.VARIANTS.find((v) => v.includes(id));
    if (!g || g.length < 2) return id;
    const opts = g.filter((x) => x !== lastOf.get(g)), pick = opts[Math.floor(Math.random() * opts.length)];
    lastOf.set(g, pick); return pick;
  };
  // "מַתְחִיל / מַתְחִילָה / מַתְחִילִים בַּצְּלִיל" by the picture's word (Golan 29.10, every sound game): feminine and plural
  // words by their plain spelling; any other word is masculine. Clips: sd_explain, sd_explain_f, sd_explain_p.
  const WORD_F = new Set(["דלת", "סכריה", "מטריה", "רכבת", "שמש", "זברה", "בננה", "נעל", "טבעת", "יד", "כף", "צלחת", "משאית", "כבאית", "חללית", "נדנדה", "מגלשה", "חצוצרה", "מסכה"]);
  const WORD_P = new Set(["גרבים"]);
  FL.explainClip = (word) => { const w = String(word || "").replace(/[\u0591-\u05C7]/g, ""); return WORD_P.has(w) ? "sd_explain_p" : WORD_F.has(w) ? "sd_explain_f" : "sd_explain"; };
  const KEY = "fl-learner-v1";
  const SESSION_GAP = 4 * 3600e3;          // a new session after 4 hours without play (Golan 15.10: 2nd success in another session)
  const FAST_WRONG_MS = 800;               // a wrong tap faster than this is a game-skill slip, not a letter error
  // Quick answer (Golan 16.10): faster than the child's typical right answer by half a robust SD (median + MAD on log times,
  // so one very slow answer does not inflate the spread) and by at least 10%. Needs 15+ right answers first.
  const QUICK_SD = 0.5, QUICK_MIN_GAIN = 0.9, QUICK_MIN_ANSWERS = 15;   // Golan 16.10: start at 15, the window then grows to the last 30
  // Distracted (Golan 16.10): a slow time says nothing about knowing the letter. The answer still counts, but its TIME is
  // left out of every time calculation when over 10 s, or (after 5 kept times) over 3x the child's typical right answer.
  const DISTRACTED_MS = 10000, DISTRACTED_X = 3, DISTRACTED_MIN = 5;
  const TYPICAL_LAST = 30;   // Golan 16.10: the child's typical time = median of the last 30 kept right-answer times
  // Golan 16.10: every game asks for something a bit different, so all of the above is kept PER GAME (event.g):
  // a game's typical time, spread, "quick" and "distracted" use only that game's own times. Until a game has 15 kept
  // right answers nothing is "quick" in it (a 2nd success in another session still confirms, as before).
  function timeKept(rt, kept) {
    if (rt == null || rt > DISTRACTED_MS) return false;
    return kept.length < DISTRACTED_MIN || rt <= DISTRACTED_X * median(kept.slice(-TYPICAL_LAST));
  }
  const QUICK_KNOWN = false;              // Golan 18.10: speed alone no longer makes a letter known (2 quick in a row removed)
  const FAST_TRACK = true;                 // Golan 16.10: fast track for a child who makes no mistakes
  const MAX_EVENTS = 4000;                 // per child
  const REVIEW_DAYS = [1, 3, 7, 14];       // known letters come back rarely, at growing gaps (Golan 15.10)
  const DAY = 864e5;

  // ---------- storage ----------
  let db = { v: 1, current: null, profiles: {} };
  function load() { try { const x = JSON.parse(localStorage.getItem(KEY) || "null"); if (x && x.v === 1) db = x; } catch (e) {} }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }
  load();
  // Another game (tab) may have written meanwhile: reload before every change.
  function mutate(fn) { load(); const r = fn(); save(); cache = null; return r; }

  // ---------- profiles ("מי משחק?") ----------
  // The companion (Golan 15.10, thread "חיה מלווה לכל ילד"): one invented creature for every child, 8 colours x 6 head items.
  // It is also the child's sign on "מי משחק?". Two children in one account never share a combination.
  // Until the real art exists, companionSvg() draws a placeholder creature.
  const COMP_COLORS = ["#ff6b6b", "#ffa94d", "#ffd43b", "#69db7c", "#38d9a9", "#4dabf7", "#b197fc", "#f783ac"];
  const COMP_ITEMS = ["hat", "flower", "crown", "bow", "antenna", "leaf"];
  const taken = (exceptId) => Object.values(db.profiles).filter((p) => p.id !== exceptId).map((p) => p.color + ":" + p.item);
  function freeCombo(exceptId) {
    const t = taken(exceptId);
    for (let i = 0; i < 48; i++) { const c = (Object.keys(db.profiles).length + i) % 8, it = Math.floor(i / 8) % 6; if (!t.includes(c + ":" + it)) return { color: c, item: it }; }
    return { color: 0, item: 0 };
  }
  // older profiles (from before the companion) get a free combination once
  for (const p of Object.values(db.profiles)) if (p.color == null) { Object.assign(p, freeCombo(p.id)); save(); }
  function companionSvg(p, size = 64) {
    const col = COMP_COLORS[(p && p.color) || 0], item = COMP_ITEMS[(p && p.item) || 0];
    const items = {
      hat: '<path d="M30 30 L50 4 L70 30 Z" fill="#5c7cfa"/><circle cx="50" cy="5" r="5" fill="#fff"/>',
      flower: '<g transform="translate(62 18)">' + [0, 72, 144, 216, 288].map((a) => `<circle r="6" cx="${(Math.cos(a * Math.PI / 180) * 7).toFixed(1)}" cy="${(Math.sin(a * Math.PI / 180) * 7).toFixed(1)}" fill="#ff8fab"/>`).join("") + '<circle r="5" fill="#ffd43b"/></g>',
      crown: '<path d="M32 28 L34 10 L42 20 L50 6 L58 20 L66 10 L68 28 Z" fill="#fcc419" stroke="#e67700" stroke-width="2"/>',
      bow: '<path d="M50 20 L34 10 L34 30 Z M50 20 L66 10 L66 30 Z" fill="#e64980"/><circle cx="50" cy="20" r="5" fill="#c2255c"/>',
      antenna: '<path d="M42 28 Q38 14 34 8 M58 28 Q62 14 66 8" stroke="#495057" stroke-width="3" fill="none"/><circle cx="34" cy="8" r="5" fill="#fab005"/><circle cx="66" cy="8" r="5" fill="#fab005"/>',
      leaf: '<path d="M50 28 Q40 6 58 2 Q66 18 50 28 Z" fill="#40c057"/><path d="M50 28 Q54 14 58 4" stroke="#2b8a3e" stroke-width="2" fill="none"/>',
    };
    return `<svg viewBox="0 -6 100 106" width="${size}" height="${size}" aria-hidden="true">
<ellipse cx="38" cy="92" rx="10" ry="5" fill="${col}" filter="brightness(.8)"/><ellipse cx="62" cy="92" rx="10" ry="5" fill="${col}"/>
<ellipse cx="50" cy="60" rx="34" ry="33" fill="${col}"/><ellipse cx="50" cy="70" rx="20" ry="16" fill="#fff" opacity=".45"/>
<circle cx="39" cy="52" r="7" fill="#fff"/><circle cx="61" cy="52" r="7" fill="#fff"/><circle cx="40" cy="53" r="3.5" fill="#212529"/><circle cx="62" cy="53" r="3.5" fill="#212529"/>
<path d="M42 66 Q50 73 58 66" stroke="#212529" stroke-width="3" fill="none" stroke-linecap="round"/>
<circle cx="30" cy="64" r="4" fill="#ff8787" opacity=".6"/><circle cx="70" cy="64" r="4" fill="#ff8787" opacity=".6"/>
${items[item]}</svg>`;
  }
  function cur() { return db.profiles[db.current] || null; }
  // Golan 16.10: a regular letter at the end of a word becomes its final form ("שלומ" -> "שלום")
  const FINAL_OF = { "כ": "ך", "מ": "ם", "נ": "ן", "פ": "ף", "צ": "ץ" };
  function cleanName(n) {
    return String(n || "").trim().slice(0, 20)
      .replace(/(?<=[\u05D0-\u05EA][\u0591-\u05C7]*)[כמנפצ](?=[\u0591-\u05C7]*(?![\u0591-\u05EA]))/g, (c) => FINAL_OF[c]);
  }
  // Golan 16.10: typing in a text field (the name on "מי משחק?", any form) must never reach the games' keyboard
  // shortcuts (P / פ = pause, arrows, A/D/S...). This file loads before every game, so this window capture listener
  // runs first and keeps the key inside the field; the letter is still typed as usual.
  for (const t of ["keydown", "keypress", "keyup"]) root.addEventListener && root.addEventListener(t, (e) => {
    const el = e.target;
    if (el && (el.tagName === "INPUT" && !/^(button|checkbox|radio|range|submit)$/i.test(el.type || "") || el.tagName === "TEXTAREA" || el.isContentEditable)) e.stopPropagation();
  }, true);
  // Golan 16.10: the age sets the starting level until the child plays "מעגל האותיות" (which then sets it from what the
  // child knows) or the level moves by itself: up to 5 -> level 1, 6-7 -> level 2. A locked level is never touched.
  const levelForAge = (age) => (age >= 6 ? 2 : 1);
  // Questions per round by the child's age (Golan 16.10, design doc sec 12): up to 4 -> 5, age 5 -> 7, 6-7 -> 9, no age -> 7.
  // The diagnostic (letter-circle) keeps its own count.
  const roundLengthFor = (age) => (!age ? 7 : age <= 4 ? 5 : age === 5 ? 7 : 9);
  function newProfile({ name, gender, color, item, age }) {
    return mutate(() => {
      const id = "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      db.profiles[id] = { id, name: cleanName(name) || "ילד", color: color == null ? null : color, item: item == null ? null : item,
        gender: gender === "f" ? "f" : gender === "m" ? "m" : null, created: Date.now(),
        level: 1, levelLock: false, levelChangedSession: -1, pace: 1, rounds: [], events: [], session: 0, lastAt: 0,
        birthYear: age ? new Date().getFullYear() - age : null, motor: [] };
      const q = db.profiles[id];
      if (age && levelForAge(age) > 1) { q.level = levelForAge(age); q.pace = LEVELS[q.level].startPace; }
      if (q.color == null || q.item == null || taken(id).includes(q.color + ":" + q.item)) Object.assign(q, freeCombo(id));
      db.current = id; return q;
    });
  }
  function updateProfile(id, patch) {
    return mutate(() => { const p = db.profiles[id]; if (!p) return null;
      for (const k of ["name", "gender", "level", "levelLock", "dayMinutes"]) if (k in patch) p[k] = patch[k];
      if ("name" in patch) p.name = cleanName(patch.name) || p.name;
      if ("age" in patch) { const first = p.birthYear == null; p.birthYear = patch.age ? new Date().getFullYear() - patch.age : null;
        // the first age given to an older profile also sets its starting level, if it never played and nothing set it yet
        if (first && patch.age && levelForAge(patch.age) > 1 && !(p.events || []).length && !("level" in patch)) { p.level = levelForAge(patch.age); p.pace = LEVELS[p.level].startPace; } }
      if ("color" in patch || "item" in patch) { const c = patch.color ?? p.color, it = patch.item ?? p.item;
        if (!taken(id).includes(c + ":" + it)) { p.color = c; p.item = it; } }
      if ("level" in patch) p.level = Math.max(1, Math.min(3, patch.level | 0));
      return p; });
  }
  function removeProfile(id) { mutate(() => { delete db.profiles[id]; if (db.current === id) db.current = Object.keys(db.profiles)[0] || null; }); }
  function setCurrent(id) { mutate(() => { if (db.profiles[id]) db.current = id; }); try { refreshSpeed(); } catch (e) {} }   // the speed slider shows this child's value

  // ---------- recording ----------
  // ev: { game, letter, picked, firstTry, solved, opts:[letters shown], rtMs (from end of audio), changed, hint,
  //       mode: "recognize" (tap/pick) | "name" (said aloud, adult judged) | "cursive" (the letter in cursive, כתב יד), by: "child"|"adult", pace,
//       audioOnly (the question was heard only, no letter shown), perfect (that audio-only question solved with no mistake, no hint) }
  // Call once per question, when it is solved (or abandoned), with the FIRST answer's details.
  // Golan 19.10: a letter that becomes "מזהה בביטחון" during a game makes room: the system's practice set is worked out
  // again (the next letters come from the new set), and a game that stays on one letter moves on (it checks known()).
  function record(ev) {
    const stateOf = () => { try { return cardsFor(cur())[ev.letter].recognize.state; } catch (e) { return null; } };
    const was = ev && ev.letter ? stateOf() : null;
    const out = recordRaw(ev);
    if (out && was !== "known" && stateOf() === "known") for (const k of Object.keys(listCache)) delete listCache[k];
    return out;
  }
  // Golan 20.10: the parent's confirm at the end of a name round: that game's name answers since `since` (ms) also count
  // for recognition in all games. Returns how many answers were confirmed.
  function confirmToAll(game, since) {
    let n = 0;
    mutate(() => { const p = cur(); if (!p) return; for (const e of p.events) if (e.g === game && e.m === "name" && e.t >= since && !e.x) { e.x = 1; n++; } });
    cache = null; for (const k of Object.keys(listCache)) delete listCache[k];
    return n;
  }
  // Golan 20.10: not confirmed (3 wrong answers, or the round left without it) = this round's name answers are not kept at all
  function discardSince(game, since) {
    let n = 0;
    mutate(() => { const p = cur(); if (!p) return; const keep = p.events.filter((e) => !(e.g === game && e.m === "name" && e.t >= since && !e.x)); n = p.events.length - keep.length; p.events = keep; });
    for (const k of Object.keys(listCache)) delete listCache[k];
    return n;
  }
  function nameAnswersSince(game, since) { const p = cur(); return p ? p.events.filter((e) => e.g === game && e.m === "name" && e.t >= since && !e.x).length : 0; }
  // A parent's lock (Golan 19.10/20.10, same as the hub's child edit): a times-table question with an answer of 21..49,
  // checked while typing; right -> the box flashes green, then onOk; a wrong answer as long as the right one shakes it and
  // asks a new question; after `tries` wrong answers -> onFail. mathGate(host, { tries, onOk, onFail }) -> { el }
  function mathGate(host, opt = {}) {
    if (!document.getElementById("fl-gate-css")) { const st = document.createElement("style"); st.id = "fl-gate-css";
      st.textContent = `.fl-gate{display:inline-flex;align-items:center;gap:8px;direction:ltr}.fl-gate .q{font-size:20px;font-weight:800;white-space:nowrap}
.fl-gate input{width:3.2em;font:inherit;font-size:20px;font-weight:700;text-align:center;padding:4px 6px;border:2px solid #9cc8f5;border-radius:12px;background:#fff}
.fl-gate.no input{border-color:#e03131;animation:flGateNo .35s}.fl-gate.ok input{border-color:#2b8a3e;animation:flGateOk .55s}
@keyframes flGateNo{25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}@keyframes flGateOk{0%,100%{background:#fff}30%,70%{background:#8ce99a}}`;
      document.head.append(st); }
    let left = opt.tries || 3;
    const f = document.createElement("form"); f.className = "fl-gate";
    f.innerHTML = `<span class="q"></span><input type="text" inputmode="numeric" maxlength="3" autocomplete="off" aria-label="התשובה">`;
    const inp = f.querySelector("input");
    const ask = () => { const all = []; for (let a = 2; a <= 9; a++) for (let b = 2; b <= 9; b++) if (a * b > 20 && a * b < 50) all.push([a, b]);
      const [a, b] = all[Math.floor(Math.random() * all.length)]; f.dataset.ans = a * b; f.querySelector(".q").textContent = `${a} × ${b} =`; inp.value = ""; };
    const check = (full) => { const v = inp.value.replace(/\D/g, ""); if (inp.value !== v) inp.value = v;
      if (v && +v === +f.dataset.ans) { inp.readOnly = true; f.classList.remove("no"); f.classList.add("ok"); setTimeout(() => opt.onOk && opt.onOk(), 550); return; }
      if (v && (full || v.length >= String(f.dataset.ans).length)) { f.classList.remove("no"); void f.offsetWidth; f.classList.add("no");
        if (--left <= 0) { inp.readOnly = true; setTimeout(() => opt.onFail && opt.onFail(), 400); } else ask(); } };
    inp.addEventListener("input", () => check(false));
    inp.addEventListener("keydown", (e) => e.stopPropagation());
    f.onsubmit = (e) => { e.preventDefault(); if (!inp.readOnly) check(true); };
    ask(); host.append(f);
    return { el: f, focus: () => { try { inp.focus({ preventScroll: true }); } catch (e) {} } };
  }
  function recordRaw(ev) {
    return mutate(() => {
      const p = cur(); if (!p || !ev || !ev.letter) return null;
      const now = Date.now();
      if (!p.lastAt || now - p.lastAt > SESSION_GAP) p.session++;
      p.lastAt = now;
      const e = { t: now, s: p.session, g: ev.game || "", l: ev.letter, p: ev.picked || null,
        ok: !!ev.firstTry, hz: !!(ev.firstTry && ev.hesitant), sol: ev.solved !== false, o: (ev.opts || []).slice(0, 8), rt: ev.rtMs == null ? null : Math.round(ev.rtMs),
        ch: !!ev.changed, h: ev.hint || 0, ao: !!ev.audioOnly, pf: !!(ev.audioOnly && ev.perfect), m: ev.mode === "name" ? "name" : ev.mode === "cursive" ? "cursive" : ev.mode === "sound" ? "sound" : "recognize", by: ev.by || "child", pc: ev.pace || null };
      e.fast = e.m === "recognize" && !e.ok && e.rt != null && e.rt < FAST_WRONG_MS;   // slip: not counted as a letter error
      if (ev.timeout) e.to = 1;   // the "not yet" came from no tap (time ran out), not from the adult's button
      p.events.push(e); if (p.events.length > MAX_EVENTS) p.events.splice(0, p.events.length - MAX_EVENTS);
      return e;
    });
  }

  // ---------- the card of each letter ----------
  let cache = null;
  function median(a) { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; }
  // the RT (ms) at or under which a right answer counts as quick for this child; null until enough data
  function quickLimit(rts) {
    if (rts.length < QUICK_MIN_ANSWERS) return null;
    const lg = rts.slice(-TYPICAL_LAST).map((r) => Math.log(Math.max(r, 50))), m = median(lg);
    const sd = 1.4826 * median(lg.map((x) => Math.abs(x - m)));
    return Math.exp(m) * Math.min(QUICK_MIN_GAIN, Math.exp(-QUICK_SD * sd));
  }
  function cardsFor(p) {
    if (!p) return {};
    if (cache && cache.id === p.id && cache.n === p.events.length) return cache.cards;
    const cards = {}, all = [...FL.LETTERS, ...FL.FINALS];
    for (const l of all) cards[l] = { letter: l, recognize: blank(), name: blank(), cursive: blank(), sound: blank(), pairs: {} };
    const runRts = {};   // per game: the child's kept right-answer times so far, to judge "quick" at the moment of each answer
    for (const e of p.events) {
      const c = cards[e.l]; if (!c) continue;
      const g = runRts[e.g] || (runRts[e.g] = []);
      const lim = quickLimit(g);
      const quick = e.ok && e.m === "recognize" && !e.hz && e.rt != null && lim != null && e.o.length >= 3 && e.rt <= lim;
      const kept = timeKept(e.rt, g);
      // the letter keeps its times relative to that game's typical time then (1 = as usual), so games can be compared
      const gm = g.length >= DISTRACTED_MIN ? median(g.slice(-TYPICAL_LAST)) : null;
      step(c[e.m], e, quick, kept && gm != null ? e.rt / gm : null);
      // Golan 20.10: a name answer counts for recognition (the colours and the letter choice of every game) only once the
      // parent confirmed that round at its end (e.x, confirmToAll): "נכון" = success, a tapped "נסו שוב" = error,
      // and a "not yet" from no tap (time ran out) does not count at all
      if (e.m === "name" && e.x && (e.ok || !e.to)) step(c.recognize, e, false, null);
      if (e.ok && e.m === "recognize" && kept) g.push(e.rt);
      if (!e.ok && e.p && e.p !== e.l && !e.fast && e.m !== "sound" && cards[e.p]) {   // a sound mix-up (a picture) is not a letter-shape pair   // pair on both letters; the error only on the asked one
        c.pairs[e.p] = (c.pairs[e.p] || 0) + 1; cards[e.p].pairs[e.l] = (cards[e.p].pairs[e.l] || 0) + 1;
      }
    }
    const gameMedian = {};
    for (const [g, a] of Object.entries(runRts)) gameMedian[g] = median(a.slice(-TYPICAL_LAST));
    for (const l of all) {
      const c = cards[l];
      for (const k of ["recognize", "name", "cursive", "sound"]) finish(c[k]);
      // One colour per letter: "name" wins when there is data on it (literacy review)
      c.state = c.name.n ? c.name.state : c.recognize.state;
      c.fluent = c.recognize.fluent;
    }
    const lastG = p.events.length ? p.events[p.events.length - 1].g : null;
    cache = { id: p.id, n: p.events.length, cards, gameMedian, lastG };
    return cards;
  }
  function blank() { return { n: 0, okStreak: [], errStreak: 0, known: false, knownAt: 0, hard: false, lastAsked: 0, reviews: 0, rts: [] }; }
  function step(k, e, quick, rel) {
    if (e.fast) return;                      // slips feed the game-skill side only
    k.n++; k.lastAsked = e.t;
    if (e.ok) {
      k.errStreak = 0; k.hard = false;
      if (rel != null) k.rts.push(+rel.toFixed(3));   // time relative to the game's typical time
      if (k.known) { k.reviews++; return; }
      // Golan 16.10: a perfect audio-only question (heard, no letter shown; it only comes after the letter was found
      // perfectly with the picture) makes the letter known at once. Losing it works as usual (2 errors in a row).
      if (e.ao && e.pf && !e.h) { k.known = true; k.knownAt = e.t; k.reviews = 0; k.okStreak.push({ s: e.s, q: !!quick }); return; }
      // A hesitant right answer (diagnostic: slow vs the child's own pace) is half evidence: two halves make one success.
      if (e.hz) { if (!k.half) { k.half = true; return; } k.half = false; }
      k.okStreak.push({ s: e.s, q: !!quick });
      if (k.okStreak.length >= 2) {
        const a = k.okStreak[k.okStreak.length - 2], b = k.okStreak[k.okStreak.length - 1];
        // Known: the 2nd success in another session (Golan 15.10), or two QUICK successes in a row (Golan 16.10):
        // each clearly faster than the child's own typical right answer (see quickLimit), so no wait for another session.
        // Golan 18.10: the quick path is off (QUICK_KNOWN); only the 2nd success in another session counts here.
        if (a.s !== b.s || (QUICK_KNOWN && a.q && b.q)) { k.known = true; k.knownAt = e.t; k.reviews = 0; }
      }
    } else {
      k.okStreak = []; k.half = false; k.errStreak++;
      if (k.errStreak >= 2) { k.hard = true; if (k.known) k.known = false; }   // known is lost only after 2 errors in a row
    }
  }
  function finish(k) {
    k.state = k.known ? "known" : k.hard ? "hard" : k.okStreak.length >= 2 ? "almost" : k.n < 2 ? "new" : "learning";
    const m = median(k.rts.slice(-5));
    k.fluent = k.known && m != null && m <= 1;   // the last 5 times on this letter are not slower than usual in their games
    k.due = k.known && Date.now() - k.lastAsked >= REVIEW_DAYS[Math.min(k.reviews, REVIEW_DAYS.length - 1)] * DAY;
  }

  // Confusion pairs that may be shown to the parent (confusion-taxonomy rules 1-5): only from questions with 3+ options,
  // at least 6 chances, the distractor picked 4+ times and twice all others together, on 2+ days, seen in both directions.
  function reportablePairs(p) {
    p = p || cur(); if (!p) return [];
    const stat = {};   // "ב>כ": { chances, picked, otherPicked, days:Set }
    const day = (t) => new Date(t).toDateString();
    for (const e of p.events) {
      if (e.m !== "recognize" || e.o.length < 3 || e.fast) continue;
      for (const x of e.o) {
        if (x === e.l) continue;
        const k = e.l + ">" + x, s = (stat[k] = stat[k] || { chances: 0, picked: 0, otherPicked: 0, days: new Set() });
        s.chances++;
        if (!e.ok && e.p === x) { s.picked++; s.days.add(day(e.t)); } else if (!e.ok && e.p) s.otherPicked++;
      }
    }
    const out = [], seen = new Set();
    for (const [k, s] of Object.entries(stat)) {
      const [a, b] = k.split(">"), back = stat[b + ">" + a];
      const pairKey = [a, b].sort().join("");
      if (s.chances >= 6 && s.picked >= 4 && s.picked >= 2 * s.otherPicked && s.days.size >= 2 && back && back.picked >= 1 && !seen.has(pairKey)) {
        seen.add(pairKey); out.push({ asked: a, picked: b, times: s.picked, chances: s.chances });
      }
    }
    return out;
  }

  // ---------- warm-up taps (game skill, no letters) ----------
  // Taps that need no letter knowledge ("גע בבלון האדום"), ms from the end of the prompt. They set the child's motor pace:
  // before any round has been played, a slow tapper starts slower and a quick one a little faster.
  function warmup(ms) {
    return mutate(() => {
      const p = cur(); if (!p) return null;
      p.motor = [...(p.motor || []), ...[].concat(ms).filter((x) => x > 150 && x < 10000).map(Math.round)].slice(-12);
      const m = median(p.motor);
      if (m != null && !p.rounds.length) p.pace = m > 2500 ? 0.8 : m < 1200 ? 1.1 : 1;
      return m;
    });
  }

  // ---------- levels (3) and pace ----------
  const LEVELS = {
    1: { size: [4, 6], choices: 3, lookalikes: 0, startPace: 0.8 },
    2: { size: [10, 15], choices: 3, lookalikes: 1, startPace: 1 },
    3: { size: [22, 27], choices: 4, lookalikes: 2, startPace: 1 },
  };
  // Golan 19.10 (one settings form): "רמת קושי" per child AND per game = החלטת מערכת (the child's own level, p.level,
  // moved by results) or 1 / 2 / 3 chosen by hand for this game only (p.gameLevels[game]). The old one-lock-for-all
  // (levelLock) is gone: the automatic level always keeps moving, a game set by hand simply does not follow it.
  const gameLevelOf = (p, game) => { const g = game || gameCfg.game, v = p && p.gameLevels && g ? p.gameLevels[g] : null; return v >= 1 && v <= 3 ? v : null; };
  const effLevel = (p, game) => gameLevelOf(p, game) || (p && p.level) || 1;
  function setGameLevel(n, game) { const g = game || gameCfg.game; if (!g) return; mutate(() => { const p = cur(); if (!p) return;
    p.gameLevels = p.gameLevels || {}; if (n >= 1 && n <= 3) p.gameLevels[g] = n | 0; else delete p.gameLevels[g]; p.levelLock = false; }); }
  function levelFromKnownCount(n) { return n >= 15 ? 3 : n >= 6 ? 2 : 1; }
  // After a diagnostic: start level from how many regular letters are known or almost known.
  function setLevelFromDiagnostic() {
    const p = cur(); if (!p) return;
    const c = cardsFor(p), n = FL.LETTERS.filter((l) => ["known", "almost"].includes(c[l].recognize.state)).length;
    mutate(() => { const q = cur(); q.level = levelFromKnownCount(n); q.pace = LEVELS[q.level].startPace; });
  }
  // Call at the end of every round. skillIssue = the child had trouble with the game itself this round
  // (missed the gate in time, many changed choices, many fast slips). Adjusts pace (always) and level (unless locked).
  function roundEnd({ game, skillIssue } = {}) {
    return mutate(() => {
      const p = cur(); if (!p) return null;
      p.rounds.push({ t: Date.now(), g: game || "", issue: !!skillIssue }); if (p.rounds.length > 50) p.rounds.shift();
      p.roundSeq = (p.roundSeq || 0) + 1;   // never reset (p.rounds is emptied after 5 rounds): the practice set's round key
      const last5 = p.rounds.slice(-5);
      if (last5.filter((r) => r.issue).length >= 3) { p.pace = Math.max(0.6, +(p.pace * 0.85).toFixed(3)); p.rounds = []; }
      else if (last5.length === 5 && last5.every((r) => !r.issue)) { p.pace = Math.min(1.5, +(p.pace * 1.1).toFixed(3)); p.rounds = []; }
      let changed = 0;
      if (p.levelChangedSession !== p.session) {
        const ev = p.events.filter((e) => e.m === "recognize" && !e.fast);
        const last20 = ev.slice(-20), last15 = ev.slice(-15);
        const acc = (a) => a.filter((e) => e.ok).length / a.length;
        // Up: 85%+ over the last 20 answers in 2+ sessions, and enough known letters for the next level
        // (the same counts as the diagnostic start: 6 for level 2, 15 for level 3).
        cache = null; const c = cardsFor(p);
        const known = FL.LETTERS.filter((l) => c[l].recognize.state === "known").length;
        if (p.level < 3 && last20.length >= 20 && new Set(last20.map((e) => e.s)).size >= 2 && acc(last20) >= 0.85 && levelFromKnownCount(known) > p.level) changed = 1;
        else if (p.level > 1 && last15.length >= 15 && acc(last15) < 0.6) changed = -1;
        if (changed) { p.level += changed; p.levelChangedSession = p.session; }
      }
      return { pace: p.pace, level: p.level, levelChanged: changed, ...dayInfo(p) };
    });
  }

  // ---------- how long to play (16.10, research in learner-model.md sec 12) ----------
  // Day length: about 10 minutes at age 4 and under, 15 from age 5 (the parent can change it: profile.dayMinutes).
  // A short break suggestion halfway; a soft ending at the day length, or earlier when the child is clearly tired
  // (the last 2 rounds much worse than the start of today). Nothing is ever blocked: the game decides how to show it.
  function dayInfo(p) {
    p = p || cur(); if (!p) return { minutes: 0, suggest: null };
    const today = new Date(Date.now()).toDateString();
    const ev = p.events.filter((e) => new Date(e.t).toDateString() === today && !e.fast);
    const roundsToday = (p.rounds || []).filter((r) => new Date(r.t).toDateString() === today);
    // minutes actually played today: sum of gaps under 3 minutes between answers
    let ms = 0; for (let i = 1; i < ev.length; i++) { const d = ev[i].t - ev[i - 1].t; if (d < 180e3) ms += d; }
    const minutes = Math.round(ms / 6e3) / 10;
    const age = p.birthYear ? new Date().getFullYear() - p.birthYear : null;
    const target = p.dayMinutes || (age != null && age <= 4 ? 10 : 15);
    const acc = (a) => (a.length ? a.filter((e) => e.ok).length / a.length : null);
    const first = acc(ev.slice(0, 12)), last = acc(ev.slice(-12));
    const tired = ev.length >= 24 && first != null && last != null && first - last >= 0.25;
    // Golan 29.10: no "זמן להתמתח" and no "שיחקנו יפה היום" in any game; the minutes and "tired" are still counted
    const suggest = null;
    return { minutes, target, suggest, tired };
  }
  // The game calls this after it showed the break, so it is suggested once a day.
  function breakShown() { mutate(() => { const p = cur(); if (p) p.breakShown = new Date(Date.now()).toDateString(); }); }

  // ---------- which letters to ask ----------
  // The letters this level practises: hard and learning first, then the child's own name letters, then new ones in alphabet order.
  // Golan 16.10: each game sets how many letters "החלטת מערכת" practises at a time. FL.learner.setGame(game, { autoCount })
  // with a number or a function (age, level) => number; nothing set = the level's own size (today's behaviour).
  let gameCfg = {};
  function setGame(game, cfg = {}) { gameCfg = { game, ...cfg }; }
  function autoCount(p) {
    const a = gameCfg.autoCount; if (a == null) return null;
    const age = p && p.birthYear ? new Date().getFullYear() - p.birthYear : null;
    const n = typeof a === "function" ? a(age, effLevel(p)) : a;
    return Number.isFinite(+n) && +n > 0 ? Math.min(Math.round(+n), 27) : null;
  }
  // Golan 19.10: one set per game. The game's own mode (setGame mode, "name" in tell-me) is used when a call gives none,
  // and "recognize" = no mode, so the picker in settings and the game's questions always read the same set.
  const modeKey = (mode) => ((mode || gameCfg.mode) === "name" ? "name" : "recognize");
  function levelPool(p, c, mode) {
    mode = modeKey(mode);
    const n = autoCount(p); if (n) return practiceSet(p, c, mode, n);
    return levelPoolRaw(p, c, mode);
  }
  // ---------- the practice set (literacy ruling literacy/practice-set-size.md, 16.10) ----------
  // Used when the game sets autoCount. One set per child, game, mode and session, so every letter comes back often.
  const SOUNDALIKE = [["ט", "ת"], ["כ", "ח"], ["כ", "ק"], ["ב", "ו"], ["ס", "ש"], ["א", "ע", "ה"]];
  const LOOKALIKE_SET = [["ב", "כ"], ["ד", "ר", "ך"], ["ה", "ח", "ת"], ["ו", "ז", "ן", "י"], ["ס", "ם"], ["ג", "נ"], ["ע", "צ"]];
  const START_ORDER = ["א", "מ", "ל", "ב", "ה", "ר", "ש", "ת", "י", "ד", "נ", "ו", "ס", "ק", "פ", "ג", "ע", "צ", "כ", "ח", "ט", "ז"];   // draft after the name letters (ruling 5.3: א, מ, ל, ב first)
  const FINAL_ORDER = ["ם", "ן", "ך", "ף", "ץ"];   // ruling 9: the common finals first
  const inGroup = (groups, a, b) => groups.some((g) => g.includes(a) && g.includes(b));
  const soundAlike = (a, b) => a !== b && inGroup(SOUNDALIKE, FL.FINAL_BASE[a] || a, FL.FINAL_BASE[b] || b);
  const lookAlike = (a, b) => a !== b && (inGroup(LOOKALIKE_SET, a, b) || FL.LOOKALIKE.some((x) => x.strength === "strong" && x.g.includes(a) && x.g.includes(b)));
  // any look-alike (the games' own lists, FL.lookalikesOf both ways): what the level cap on screen counts (17.10)
  const looksLike = (a, b) => a !== b && (lookAlike(a, b) || (FL.lookalikesOf ? FL.lookalikesOf(a, true).includes(b) || FL.lookalikesOf(b, true).includes(a) : false));
  const confusable = (a, b) => soundAlike(a, b) || lookAlike(a, b) || (a !== b && (FL.FINAL_BASE[a] || a) === (FL.FINAL_BASE[b] || b));
  // (the per-game random sets setCache / prevSets were replaced by the shared list, Golan 19.10)
  const ageOf = (p) => (p && p.birthYear ? new Date().getFullYear() - p.birthYear : null);
  const cfgNum = (v, p, dflt) => { if (v == null) return dflt; const n = typeof v === "function" ? v(ageOf(p), effLevel(p)) : v; return Number.isFinite(+n) ? Math.max(0, Math.round(+n)) : dflt; };
  // at most this many letters that are new or in learning (ruling 3.1-3.2: 1 at 4-5, 2 at 6-7, and 2/3 of the set known)
  const unknownMaxFor = (p, N) => { const age = ageOf(p); return cfgNum(gameCfg.unknownMax, p, Math.max(1, Math.min(age != null && age >= 6 ? 2 : 1, N - Math.ceil((2 * N) / 3)))); };
  // Golan 19.10 (one settings form): ONE ordered list of letters per child, the same in every game. Each game takes the
  // first N it needs (its autoCount); the list follows the child's progress in every game (it is rebuilt when a letter
  // becomes known, record() clears the cache). LIST_SHUFFLE: false = a fixed order (Golan's "רשימה עם סדר האותיות
  // הבאות"); true = the order inside each group is drawn again every round.
  const LIST_SHUFFLE = false;
  const listCache = {};
  function sharedList(p, c) {
    const S = !p.lastAt || Date.now() - p.lastAt > SESSION_GAP ? p.session + 1 : p.session;   // the session the next answer will belong to
    const key = [p.id, S, LIST_SHUFFLE ? p.roundSeq || 0 : 0].join("|");
    if (listCache[key]) return listCache[key].slice();
    const age = ageOf(p), stOf = (l) => stateIn(c[l], "recognize").state;
    const rank = (l) => { const i = START_ORDER.indexOf(FL.FINAL_BASE[l] || l); return (i < 0 ? 30 : i) + (FL.FINAL_BASE[l] ? 0.5 : 0); };
    const mix = (list, first) => (LIST_SHUFFLE ? shuffle(list.slice()) : list.slice().sort((a, b) => rank(a) - rank(b))).sort((a, b) => (first ? first(a, b) : 0));
    const seen = (l) => !!(c[l] && (c[l].recognize.n || c[l].name.n));
    const kind = (l) => { const s = stOf(l); return s === "known" ? "known" : s === "almost" ? "almost" : s === "new" && !seen(l) ? "new" : "learning"; };
    // accuracy of the last sessions (all games): < 70% -> nothing new; > 90% twice -> one more new letter
    const bySess = {}; for (const e of p.events) if (e.s !== S && !e.fast) (bySess[e.s] = bySess[e.s] || []).push(e.ok);
    const accs = Object.keys(bySess).map(Number).sort((a, b) => b - a).map((k) => bySess[k]).filter((a) => a.length >= 5).map((a) => a.filter(Boolean).length / a.length);
    const low = accs.length && accs[0] < 0.7, high = accs.length >= 2 && accs[0] > 0.9 && accs[1] > 0.9;
    // new letters: at most 1 a day at age <= 5 (or no age), 2 at 6-7, counted by the first time a letter was ever met
    const today = new Date().toDateString(), firstSeen = {};
    for (const e of p.events) if (!(e.l in firstSeen)) firstSeen[e.l] = e.t;
    const newToday = Object.values(firstSeen).filter((t) => new Date(t).toDateString() === today).length;
    const perDay = cfgNum(gameCfg.newPerDay, p, age != null && age >= 6 ? 2 : 1);
    const unknownMax = Math.max(1, age != null && age >= 6 ? 2 : 1);
    // finals are in the list after their base letter is known / almost; a game below level 3 skips them (practiceSet)
    const letters = [...FL.LETTERS, ...FINAL_ORDER.filter((f) => ["almost", "known"].includes(kind(FL.FINAL_BASE[f])))];
    const set = [], unsure = (l) => ["new", "learning"].includes(kind(l));
    const clash = (l) => set.some((x) => (unsure(l) || unsure(x)) && confusable(l, x));
    const add = (l) => { if (!set.includes(l) && !clash(l)) { set.push(l); return true; } return false; };
    const unknownIn = () => set.filter(unsure).length;
    const lastSeen = (l) => { for (let i = p.events.length - 1; i >= 0; i--) if (p.events[i].l === l) return p.events[i].t; return 0; };
    // 1. letters in learning (the hardest first), up to the unknown limit
    const learning = mix(letters.filter((l) => kind(l) === "learning"), (a, b) => (stOf(b) === "hard") - (stOf(a) === "hard"));
    for (const l of learning) if (unknownIn() < unknownMax) add(l);
    // 2. new letters if there is room: the child's name letters first, then the start order (א מ ל ב ...)
    const nameL = [...(p.name || "")].map((x) => FL.FINAL_BASE[x] || x).filter((x) => FL.LETTERS.includes(x));
    const newOrder = [...new Set([...nameL, ...mix(letters)])].filter((l) => letters.includes(l));
    let newLeft = low ? 0 : Math.max(0, perDay - newToday);
    for (const l of newOrder) { if (!newLeft || unknownIn() >= unknownMax + (high ? 1 : 0)) break; if (kind(l) === "new" && add(l)) newLeft--; }
    // 3. familiar letters, 4. known letters for review (the longest unseen first); a letter known in THIS session waits at the end
    for (const l of mix(letters.filter((x) => kind(x) === "almost"))) add(l);
    const justKnown = (l) => { const k = stateIn(c[l], "recognize"); if (k.state !== "known" || !k.knownAt) return false; const e = p.events.find((x) => x.t === k.knownAt); return !!e && e.s === S; };
    for (const l of letters.filter((x) => kind(x) === "known" && !justKnown(x)).sort((a, b) => lastSeen(a) - lastSeen(b) || rank(a) - rank(b))) add(l);
    // first visit only (no answers before this session): an untested child is not an "unknown" child, more new letters follow at once
    if (!p.events.some((e) => e.s !== S)) { for (const l of learning) add(l); for (const l of newOrder) if (kind(l) === "new") add(l); }
    // the rest, so every game can take as many as it needs: more learning letters (closest to known first), the next new
    // letters in order, letters known this session, and last the look/sound-alikes the rules kept apart
    const near = (l) => { const k = stateIn(c[l], "recognize"); return (k.okStreak ? k.okStreak.length : 0) * 10 + (k.n || 0); };
    for (const l of mix(learning, (a, b) => near(b) - near(a))) add(l);
    for (const l of newOrder) if (kind(l) === "new") add(l);
    for (const l of letters.filter(justKnown)) add(l);
    for (const l of newOrder) if (!set.includes(l)) set.push(l);
    listCache[key] = set.slice();
    return set;
  }
  // This game's letters in "החלטת מערכת": the first N of the shared list (finals only at this game's level 3, and only
  // letters the game can show, gameCfg.order); one letter less after a weak last session in this game.
  function practiceSet(p, c, mode, N) {
    const game = gameCfg.game || "", S = !p.lastAt || Date.now() - p.lastAt > SESSION_GAP ? p.session + 1 : p.session;
    const bySess = {}; for (const e of p.events) if (e.g === game && e.s !== S && !e.fast) (bySess[e.s] = bySess[e.s] || []).push(e.ok);
    const last = Object.keys(bySess).map(Number).sort((a, b) => b - a).map((k) => bySess[k]).find((a) => a.length >= 5);
    if (last && last.filter(Boolean).length / last.length < 0.7) N = Math.max(2, N - 1);
    const finals = gameCfg.finals !== false && effLevel(p) === 3, can = gameCfg.order ? new Set(gameCfg.order) : null;
    return sharedList(p, c).filter((l) => (finals || !FL.FINAL_BASE[l]) && (!can || can.has(l))).slice(0, N);
  }
  // Distractors for an on-screen question (ruling 4 / 7.3): mostly known letters, never a sound-alike of the target
  // (hearing questions), never its base / final, and a look-alike only when both are known.
  function safeDistractors(target, n, { pool, mode, sound = true, lookalikes } = {}) {
    const p = cur(), c = cardsFor(p), good = (l) => ["known", "almost"].includes(stateIn(c[l], mode).state);
    // look-alikes on screen follow "רמת אתגר" (17.10, all games): at most levelInfo().lookalikes look-alike pairs among
    // the target and the choices (level 1 none, 2 one, 3 two), and only between letters that are both known / almost
    const cap = lookalikes != null ? lookalikes : (LEVELS[effLevel(p)] || LEVELS[1]).lookalikes;
    let pairs = 0;
    const looksOk = (l) => { const np = [target, ...out].filter((x) => looksLike(x, l)); if (!np.length) return true;
      if (pairs + np.length > cap || !good(l) || !np.every(good)) return false; pairs += np.length; return true; };
    const fin = FL.isFinal(target), same = (l) => l !== target && FL.isFinal(l) === fin;
    const ok = (l) => same(l) && (!sound || !soundAlike(l, target)) && (FL.FINAL_BASE[l] || l) !== (FL.FINAL_BASE[target] || target) && (!lookAlike(l, target) || (good(l) && good(target)));
    const uni = fin ? FL.FINALS : FL.LETTERS, inPool = (pool || []).filter(ok), out = [];
    // sound questions (default): never two letters of one same-sound group on screen, even when both are known (ruling 11)
    const take = (list) => { for (const l of shuffle(list)) if (out.length < n && !out.includes(l) && !(sound && out.some((x) => soundAlike(x, l))) && looksOk(l)) out.push(l); };
    // never an unmet letter from outside the set. May return FEWER than n (even none): the game then shows fewer choices (ruling 11).
    const met = (l) => !!(c[l] && (c[l].recognize.n || c[l].name.n));
    // Golan 19.10: the letters on screen are the letters marked in settings first (known ones first); others only to fill up
    take(inPool.filter(good)); take(inPool); take(uni.filter((l) => ok(l) && good(l))); take(uni.filter((l) => ok(l) && met(l)));
    return out;
  }
  function levelPoolRaw(p, c, mode) {
    const L = LEVELS[effLevel(p)] || LEVELS[1];
    const nameLetters = [...(p.name || "")].map((x) => FL.FINAL_BASE[x] || x).filter((x) => FL.LETTERS.includes(x));
    const rank = (l) => { const k = stateIn(c[l], mode); return k.state === "hard" ? 0 : k.state === "learning" ? 1 : k.state === "almost" ? 2 : nameLetters.includes(l) ? 3 : k.state === "new" ? 4 : 5; };
    const withFinals = (pool) => {
      if (effLevel(p) === 3) for (const f of FL.FINALS) if (stateIn(c[FL.FINAL_BASE[f]], mode).state === "known") pool.push(f);   // each final after its base letter
      return pool;
    };
    let pool = FL.LETTERS.slice().sort((a, b) => rank(a) - rank(b) || FL.LETTERS.indexOf(a) - FL.LETTERS.indexOf(b));
    const active = pool.filter((l) => rank(l) <= 2).length;
    const want = Math.max(L.size[0], Math.min(L.size[1], active + 3));   // at most ~3 new letters at a time
    // Fast track (16.10): every answer of this session right on the first try (8 or more) -> all 22 letters come in now.
    // One wrong answer returns to the normal pace. Known still needs another session, so a lucky guess is not enough.
    const now_s = p.events.filter((e) => e.s === p.session && e.m === (mode === "name" ? "name" : "recognize") && !e.fast);
    if (FAST_TRACK && now_s.length >= 8 && now_s.every((e) => e.ok)) { pool = FL.LETTERS.slice().sort((a, b) => rank(a) - rank(b)); return withFinals(pool); }
    pool = pool.slice(0, Math.min(want, 22));
    return withFinals(pool);
  }
  const session = { asked: 0, repeatAt: null, repeatLetter: null };
  // Next target letter. chosen = the parent/teacher's letters (they win). lastOk = was the previous question right on the first try.
  // mode: "recognize" (default) or "name" (tell-me). The game's own mode decides what to practise; the other
  // mode's "known" also counts as known, so a letter the child already names is not drilled as new.
  function stateIn(card, mode) {
    if (!card) return { state: "new" };
    const a = card[mode === "name" ? "name" : "recognize"], b = card[mode === "name" ? "recognize" : "name"];
    return a.state === "new" && b.state === "known" ? b : a;
  }
  function nextLetter({ chosen, prev, lastOk = true, lastLetter, mode } = {}) {
    const p = cur(); const c = cardsFor(p);
    session.asked++;
    if (!lastOk && lastLetter) { session.repeatLetter = lastLetter; session.repeatAt = session.asked + 2 + (Math.random() < 0.5 ? 1 : 0); }
    let pool = chosen && chosen.length ? chosen.slice() : withAutoForce(p ? levelPool(p, c, mode) : FL.LETTERS.slice());
    if (session.repeatLetter && session.asked >= session.repeatAt && session.repeatLetter !== prev) {
      const l = session.repeatLetter; session.repeatLetter = null; return l;   // the missed letter comes back after 2-3 questions
    }
    if (!p) return pick(pool.filter((l) => l !== prev));
    const st = (l) => stateIn(c[l], mode);
    if (!lastOk) {   // after a mistake: a sure success
      const easy = pool.filter((l) => l !== prev && st(l).state === "known");
      const easyAll = easy.length ? easy : (chosen && chosen.length) || autoCount(p) ? [] : FL.LETTERS.filter((l) => l !== prev && st(l).state === "known");
      if (easyAll.length) return pick(easyAll);
      const notMissed = pool.filter((l) => l !== prev && l !== lastLetter);   // nothing known yet: at least not the missed letter again
      if (notMissed.length) return pickWeighted(notMissed, (l) => (st(l).state === "hard" ? 1 : 2));
    }
    // "almost" letters can only be confirmed in another session, so within the session they made it, they rest (weight 0.3).
    const sess = p.session;
    const w = (l) => { const k = st(l); return l === prev ? 0 : k.state === "hard" ? 4 : k.state === "learning" ? 3 : k.state === "almost" ? (k.okStreak[k.okStreak.length - 1].s === sess ? 0.3 : 3) : k.state === "new" ? 2 : k.due ? 1.5 : 0.25; };
    // known letters outside the pool still come back when they are due for review
    const strict = (chosen && chosen.length) || autoCount(p);   // a parent's choice or a game's practice set is never left (16.10)
    const extra = strict ? [] : FL.LETTERS.filter((l) => !pool.includes(l) && st(l).due);
    return pickWeighted([...pool, ...extra], w);
  }
  // Distractors for a target. n = how many wrong answers. Level decides how look-alike they are; the child's own confusions first.
  function distractors(target, n, { level, pool, withFinals } = {}) {
    const p = cur(), c = cardsFor(p), L = LEVELS[level || effLevel(p)];
    const fin = FL.isFinal(target);
    const universe = (pool && pool.length >= n + 1 ? pool : fin ? FL.FINALS : FL.LETTERS).filter((l) => l !== target && FL.isFinal(l) === fin);
    const own = c[target] ? Object.entries(c[target].pairs).sort((a, b) => b[1] - a[1]).map(([l]) => l) : [];
    const looks = [...new Set([...own, ...FL.lookalikesOf(target, withFinals || fin)])].filter((l) => l !== target && FL.isFinal(l) === fin);
    const out = [];
    for (const l of looks) { if (out.length >= Math.min(n, L.lookalikes)) break; out.push(l); }
    const far = shuffle(universe.filter((l) => !out.includes(l) && !FL.lookalikesOf(target, true).includes(l)));
    while (out.length < n && far.length) out.push(far.pop());
    const rest = shuffle(universe.filter((l) => !out.includes(l)));
    while (out.length < n && rest.length) out.push(rest.pop());
    return out;
  }

  // ---------- stars and voice ----------
  const star = (firstTry) => (firstTry ? "gold" : "silver");   // Golan 15.10: gold first try, silver after a mistake, never none
  // Golan 16.10: one shiny star for every game ("silver looked grey and dull, gold looked mustard and did not sparkle").
  // starSvg("gold"|"silver", size) returns an SVG string: a bright gradient body, a white glint and a twinkling sparkle.
  // Optional 3rd arg { delay } (seconds) staggers the twinkle in a row of stars. No animation with "reduce motion".
  let starN = 0;
  // Golan 16.10 (2nd round): only an inner shimmer and a gentle size pulse, no extra sparkles around the star;
  // silver must read as polished silver (mirror bands, bright highlights), gold as rich shiny metal.
  const STAR_PTS = [[50, 5], [62.4, 34.2], [93, 37.1], [69.9, 57.4], [76.7, 87.4], [50, 71.6], [23.3, 87.4], [30.1, 57.4], [7, 37.1], [37.6, 34.2]];
  const STAR_PATH = "M" + STAR_PTS.map((p) => p.join(" ")).join(" L") + " Z";
  const STAR_LOOK = {
    gold: { stops: ["#FFF1A6", "#FFD12E", "#E89A00", "#FFE36B", "#FFB300", "#B86A00"], stroke: "#9A5500", rim: "#FFE680", lit: 0.6 },
    silver: { stops: ["#FFFFFF", "#E4ECF5", "#8D9DB2", "#FFFFFF", "#C3CFDD", "#6F8098"], stroke: "#4D5E75", rim: "#FFFFFF", lit: 1 },
  };
  function starCss() {
    if (document.getElementById("fl-star-css")) return;
    const st = document.createElement("style"); st.id = "fl-star-css";
    st.textContent = `.fl-star{display:inline-block;vertical-align:middle;overflow:visible;filter:drop-shadow(0 2px 2.5px rgba(0,0,0,.22))}
.fl-star .fl-body{transform-origin:50px 50px;animation:fl-pulse 2.2s ease-in-out infinite}
.fl-star .fl-shine{animation:fl-shine 2.2s ease-in-out infinite}
.fl-star .fl-glint{animation:fl-glint 2.2s ease-in-out infinite}
@keyframes fl-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
@keyframes fl-shine{0%{transform:translateX(-110px)}60%,100%{transform:translateX(110px)}}
@keyframes fl-glint{0%,100%{opacity:.55}50%{opacity:1}}
@media (prefers-reduced-motion:reduce){.fl-star .fl-body,.fl-star .fl-shine,.fl-star .fl-glint{animation:none}.fl-star .fl-shine{opacity:0}}`;
    (document.head || document.documentElement).appendChild(st);
  }
  // starSvg("gold"|"silver", size, { delay }) -> SVG string. Bevelled metal star: 10 facets (light/dark halves of each arm)
  // over a banded metallic gradient, a white rim light, a glint, and a shine that sweeps inside the star.
  function starSvg(kind, size = 48, opt = {}) {
    try { starCss(); } catch (e) {}
    const k = STAR_LOOK[kind] ? kind : "gold", L = STAR_LOOK[k], id = "flst" + ++starN, d = (opt.delay || 0) + "s";
    const C = [50, 52], facets = STAR_PTS.map((p, i) => {
      const q = STAR_PTS[(i + 1) % 10], lit = i % 2 === 0 ? (i < 5 ? 0.55 : 0.3) * L.lit : 0;   // upper-left facets catch the light
      const shade = i % 2 === 1 ? (i > 4 ? 0.28 : 0.14) : 0;
      return `<path d="M${C.join(" ")} L${p.join(" ")} L${q.join(" ")} Z" fill="${lit ? "#fff" : "#000"}" opacity="${lit || shade}"/>`;
    }).join("");
    return `<svg class="fl-star fl-star-${k}" viewBox="0 0 100 100" width="${size}" height="${size}" aria-label="${k === "gold" ? "כוכב זהב" : "כוכב כסף"}" role="img">
<defs><linearGradient id="${id}" x1="0.15" y1="0" x2="0.85" y2="1">${L.stops.map((c, i) => `<stop offset="${[0, 0.22, 0.42, 0.56, 0.76, 1][i]}" stop-color="${c}"/>`).join("")}</linearGradient>
<clipPath id="${id}c"><path d="${STAR_PATH}"/></clipPath></defs>
<g class="fl-body" style="animation-delay:${d}">
<path d="${STAR_PATH}" fill="url(#${id})"/>
<g clip-path="url(#${id}c)">${facets}
<g transform="rotate(25 50 50)"><rect class="fl-shine" style="animation-delay:${d}" x="22" y="-20" width="16" height="140" fill="#fff" opacity=".8" transform="translate(-110 0)"/></g></g>
<path d="${STAR_PATH}" fill="none" stroke="${L.rim}" stroke-width="2" stroke-linejoin="round" opacity=".9" transform="translate(50 52) scale(.9) translate(-50 -52)"/>
<path d="${STAR_PATH}" fill="none" stroke="${L.stroke}" stroke-width="3.5" stroke-linejoin="round"/>
<ellipse class="fl-glint" style="animation-delay:${d}" cx="40" cy="38" rx="3.5" ry="7" transform="rotate(35 40 38)" fill="#fff" opacity=".9"/>
</g>
</svg>`;
  }
  // Golan 16.10: the HUD star counter in every game = gold star + count, silver star + count, both animated.
  // const sc = FL.learner.starCounter(el, { size: 28 }); sc.set(gold, silver); sc.add("gold"|"silver"); sc.reset(); sc.get()
  // It fills el (the game's own HUD pill, e.g. #stars) and replaces its old text. Gold comes first (on the right, RTL).
  // Mount at page load (Golan 16.10: no old star may show, even before the countdown): give the HUD pill the attribute
  // data-fl-stars and leave it EMPTY (no ⭐ in the markup); learner.js fills it as soon as the page is parsed.
  // Calling starCounter(el) again returns the same counter.
  // Golan 16.10 (text-size ruling): pointed text only at 28px+ with line-height 1.7-1.9, else no nikud; all or nothing.
  // Strips nikud and cantillation, keeps maqaf and punctuation.
  const stripNikud = (t) => String(t == null ? "" : t).replace(/[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g, "");
  function starCounter(el, opt = {}) {
    if (!el) return null;
    if (el._flsc) { if ("title" in opt) el._flsc.setTitle(opt.title); return el._flsc; }
    try { starCss(); } catch (e) {}
    if (!document.getElementById("fl-sc-css")) {
      const st = document.createElement("style"); st.id = "fl-sc-css";
      st.textContent = `.fl-sc{display:inline-flex;direction:rtl;align-items:center;gap:.7em;line-height:1;white-space:nowrap}
.fl-sc-i{display:inline-flex;direction:ltr;align-items:center;gap:.25em}
.fl-sc-i b{font-weight:800;font-variant-numeric:tabular-nums;min-width:1ch;text-align:center;display:inline-block}
.fl-sc-i b.fl-bump{animation:fl-bump .45s ease-out}
@keyframes fl-bump{0%{transform:scale(1)}40%{transform:scale(1.45)}100%{transform:scale(1)}}
@media (prefers-reduced-motion:reduce){.fl-sc-i b.fl-bump{animation:none}}
.fl-sc-t{font-weight:800;font-size:max(.8em,14px);padding-inline-start:.7em;border-inline-start:2px solid #0002;overflow:hidden;text-overflow:ellipsis;max-width:38vw;min-width:0}
.fl-sc-t:empty{display:none}
.fl-sc-i svg.fl-star{width:var(--fl-star,1.08em);height:var(--fl-star,1.08em)}
.fl-sc-host{max-width:calc(100vw - 100px);box-sizing:border-box}.fl-sc-host .fl-sc{max-width:100%}
@media (max-width:480px){.fl-sc-t{font-size:max(.62em,14px);white-space:normal;line-height:1.1;max-width:9em;overflow:visible;text-overflow:clip;text-align:center}}`;
      (document.head || document.documentElement).appendChild(st);
    }
    // the pill never reaches the door (top left, 100px); on phones up to 480px the name goes to two small lines (from waking-letter, 16.10)
    el.classList.add("fl-sc-host");
    const size = opt.size || 28, n = { gold: 0, silver: 0 };
    // the stars follow the pill's font-size (screens 16.10: on 4K the text grows with --u). size = px next to the
    // standard 26px pill text, so it becomes size/26 em: a normal screen looks exactly as before, a bigger font scales them
    try { el.style.setProperty("--fl-star", +(size / 26).toFixed(3) + "em"); } catch (e) {}
    el.innerHTML = `<span class="fl-sc" role="status">${["gold", "silver"].map((k, i) =>
      `<span class="fl-sc-i fl-sc-${k}">${starSvg(k, size, { delay: i * 0.6 })}<b>0</b></span>`).join("")}<span class="fl-sc-t"></span></span>`;
    // Golan 16.10: the game's name right next to the stars, on their left (RTL: last in the row); cut with "…" on narrow phones
    // the name keeps its nikud only when it shows at 28px or more (4K); smaller: plain letters (opt.titlePlain if the
    // plain spelling differs from just dropping the marks), so the nikud ruling holds on every screen
    let rawTitle = "", plainTitle = "";
    const fitTitle = () => { const e = el.querySelector(".fl-sc-t"); if (!e) return;
      let big = false; try { big = parseFloat(getComputedStyle(e).fontSize) >= 28; } catch (x) {}
      const pointed = big && rawTitle !== stripNikud(rawTitle);
      e.textContent = pointed ? rawTitle : plainTitle; e.style.lineHeight = pointed ? "1.7" : ""; e.title = plainTitle; };
    const setTitle = (t, plain) => { rawTitle = t || ""; plainTitle = plain || stripNikud(rawTitle); fitTitle(); };
    setTitle(opt.title, opt.titlePlain);
    try { root.addEventListener("resize", fitTitle); } catch (e) {}
    const num = (k) => el.querySelector(".fl-sc-" + k + " b");
    const label = () => el.querySelector(".fl-sc").setAttribute("aria-label", `${n.gold} כוכבי זהב, ${n.silver} כוכבי כסף`);
    const show = (k, bump) => { const b = num(k); if (!b) return; b.textContent = n[k]; if (bump) { b.classList.remove("fl-bump"); void b.offsetWidth; b.classList.add("fl-bump"); } };
    label();
    return (el._flsc = {
      set(gold, silver) { const bg = gold > n.gold, bs = silver > n.silver; n.gold = gold | 0; n.silver = silver | 0; show("gold", bg); show("silver", bs); label(); },
      add(kind) { const k = kind === "silver" ? "silver" : "gold"; n[k]++; show(k, true); label(); },
      reset() { n.gold = n.silver = 0; show("gold"); show("silver"); label(); },
      get: () => ({ ...n }),
      setTitle,
    });
  }
  function mountStarCounters() { try { document.querySelectorAll("[data-fl-stars]").forEach((el) => starCounter(el, { size: +el.dataset.flStars || 28, title: el.dataset.flTitle || "" })); } catch (e) {} }
  if (root.document) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountStarCounters); else mountStarCounters(); }
  // ---------- "שליטה במהירות תנועת האלמנטים השונים" (Golan 19.10, every game; replaces the old "קצב" buttons) ----------
  // A slider in steps of 5%: the middle is the speed the challenge level sets, right = slower down to −30%, left = faster
  // up to +30%. Kept per child and per game (localStorage "fl-speed" {childId: {game: pct}}).
  // Games: speed(game) -> 0.7 .. 1.3 to multiply their speeds (divide their durations); markup: an EMPTY
  // <div class="row stack" data-fl-speed="<game>"></div> that learner.js fills; refreshes itself when the child changes.
  const SPEED_KEY = "fl-speed";
  let speedDb = null;
  const speedLoad = () => { if (!speedDb) { try { speedDb = JSON.parse(localStorage.getItem(SPEED_KEY) || "{}") || {}; } catch (e) { speedDb = {}; } } return speedDb; };
  const kidId = () => { try { return db.current || ""; } catch (e) { return ""; } };
  function speedPct(game) { const o = speedLoad()[kidId()]; const v = o && +o[game]; return Number.isFinite(v) ? Math.max(-30, Math.min(30, v)) : 0; }
  function setSpeedPct(game, v) { const d = speedLoad(), k = kidId(); (d[k] = d[k] || {})[game] = Math.max(-30, Math.min(30, Math.round(v / 5) * 5)); try { localStorage.setItem(SPEED_KEY, JSON.stringify(d)); } catch (e) {} }
  const speed = (game) => 1 + speedPct(game) / 100;
  const speedRows = [];
  function speedCss() {
    if (document.getElementById("fl-speed-css")) return;
    const st = document.createElement("style"); st.id = "fl-speed-css";
    st.textContent = `.fl-speed{flex:1 1 100%;width:100%;min-width:0;display:flex;flex-direction:column;gap:6px;direction:rtl}
.fl-speed-t{font-weight:700}.fl-speed-t b{color:#00796b;font-variant-numeric:tabular-nums;white-space:nowrap}
.fl-speed-s{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px}
.fl-speed-i{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:.8em;color:#5d6f86;min-width:40px}.fl-speed-i svg{width:30px;height:22px}
.fl-speed-r{position:relative;height:44px;display:flex;align-items:center}
.fl-speed-m{position:absolute;left:50%;top:4px;bottom:4px;width:3px;border-radius:2px;background:#00796b;transform:translateX(-50%)}
.fl-speed input{width:100%;direction:rtl;-webkit-appearance:none;appearance:none;background:transparent;height:44px;margin:0;position:relative;cursor:pointer}
.fl-speed input::-webkit-slider-runnable-track{height:10px;border-radius:6px;background:#eceff1}
.fl-speed input::-moz-range-track{height:10px;border-radius:6px;background:#eceff1}
.fl-speed input::-webkit-slider-thumb{-webkit-appearance:none;width:30px;height:30px;border-radius:50%;background:#ff8a3d;border:4px solid #fff;box-shadow:0 2px 8px #0003;margin-top:-10px}
.fl-speed input::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:#ff8a3d;border:4px solid #fff;box-shadow:0 2px 8px #0003}
.fl-speed input:focus-visible{outline:3px solid #00796b;outline-offset:2px;border-radius:8px}
.fl-speed-k{display:flex;justify-content:space-between;font-size:.8em;color:#5d6f86;padding:0 50px;font-variant-numeric:tabular-nums}`;
    document.head.append(st);
  }
  const SNAIL = '<svg viewBox="0 0 30 22"><path d="M4 18 q0-9 9-9 q8 0 8 7 q0 4-4 4 H2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="13" cy="14" r="3.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M21 16 l5-7 M24 16 l4-6" stroke="currentColor" stroke-width="1.6"/></svg>';
  const RABBIT = '<svg viewBox="0 0 30 22"><path d="M3 15 q4-8 12-8 q7 0 10 4 l3-1 -1 4 q-3 4-11 4 H6 q-3 0-3-3z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14 7 l-3-6 M18 7 l1-6" stroke="currentColor" stroke-width="1.6"/></svg>';
  function speedRow(host, game, opt = {}) {
    css(); speedCss();
    host.innerHTML = `<div class="fl-speed"><span class="fl-speed-t">שליטה במהירות תנועת האלמנטים השונים: <b></b></span>
<div class="fl-speed-s"><span class="fl-speed-i">${SNAIL}איטי</span><div class="fl-speed-r"><span class="fl-speed-m"></span><input type="range" min="-30" max="30" step="5" aria-label="מהירות תנועה"></div><span class="fl-speed-i">${RABBIT}מהיר</span></div>
<div class="fl-speed-k"><span>‎−30%</span><span>רמת אתגר נוכחית</span><span>‎+30%</span></div></div>`;
    const inp = host.querySelector("input"), out = host.querySelector(".fl-speed-t b");
    const show = (v) => { out.textContent = (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v) + "% (ביחס לרמת האתגר הנוכחית)"; };
    const refresh = () => { const v = speedPct(game); inp.value = v; show(v); };
    inp.addEventListener("input", () => { setSpeedPct(game, +inp.value); show(speedPct(game)); if (opt.onChange) opt.onChange(speed(game)); });
    inp.addEventListener("dblclick", () => { setSpeedPct(game, 0); refresh(); if (opt.onChange) opt.onChange(1); });
    refresh(); const api = { refresh, el: host }; speedRows.push(api);
    try { new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) refresh(); }).observe(host); } catch (e) {}   // shown again (settings opened): the current child's value
    return api;
  }
  // ---------- ONE settings form for every game and the hub (Golan 19.10 16:40, summaries/settings-form-spec.md) ----------
  // FL.learner.settingsForm(host, {
  //   game,                         // the game id used by setGame / the speed slider ("detective", "wake", ...); none = hub
  //   levels: [l1, l2, l3],         // what each level does in THIS game (one short sentence each)
  //   levelsText,                   // optional: one sentence for all levels instead of the list (Golan 28.10, mole)
  //   onLevel(n),                   // the effective level changed (1..3)
  //   picker: { ...letterPicker options },   // shown when given; the picker api is returned as form.picker
  //   voice: { get, set }, quality: { get, set },
  //   tech: { perf (ignored since 28.10: no FPS box), stress: { get, set }, diag: () => text, extra: [elements] } })
  // Same rows, same order, same words everywhere: התקדמות למידה, בחירת אותיות לתרגול, רמת קושי, מהירות, קול הקריינית,
  // איכות גרפיקה, מידע טכני. Returns { refresh(), picker, el }.
  const LEVEL_AUTO_NOTE = "החלטת מערכת: הרמה מותאמת ליכולת הילד. תעלה כשהוא יצליח, ותרד כאשר הוא יתקשה.";   // Golan 28.10 wording
  function formCss() {
    if (document.getElementById("fl-form-css")) return;
    const st = document.createElement("style"); st.id = "fl-form-css";
    st.textContent = `.fl-form{display:flex;flex-direction:column;width:100%;direction:rtl;text-align:start}
.fl-frow{display:flex;flex-direction:column;align-items:stretch;gap:8px;padding:12px 0;border-top:1px solid #e6ebf0}
.fl-frow:first-child{border-top:0;padding-top:4px}
.fl-form>.fl-frow{border:1px solid #dfe6ee;border-radius:16px;padding:10px 12px;margin-bottom:8px}
.fl-form>.fl-frow.fl-kidrow{border:0;padding:0}
.fl-form>.fl-frow:has(.fl-cap[aria-expanded=true]){background:#f5f9ff;border-color:#9cc8f5;box-shadow:inset 0 0 0 1px #9cc8f5}
.fl-ft{font-size:20px;font-weight:800;line-height:1.3}
.fl-fseg{display:flex;flex-wrap:wrap;gap:8px}
.fl-fseg button{min-height:48px;min-width:56px;padding:6px 16px;border-radius:14px;border:2px solid #d5dde6;background:#fff;color:inherit;font:inherit;font-size:18px;font-weight:700;cursor:pointer}
.fl-fseg button[aria-pressed=true]{border-color:#283593;background:#e8eaf6;box-shadow:inset 0 0 0 1px #283593}
.fl-fseg button:focus:not(:focus-visible){outline:none}
.fl-fnote{font-size:16px;line-height:1.5;color:#5b6470}
.fl-flv{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px}
.fl-flv li{font-size:16px;line-height:1.45;color:#5b6470;padding:4px 8px;border-radius:10px}
.fl-flv li.on{background:#e8eaf6;color:#1a237e;font-weight:700}
.fl-fkid{display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:16px;background:#f5f9ff;box-shadow:inset 0 0 0 2px #9cc8f5}
.fl-fkid .c svg{display:block}.fl-fkid .n{font-size:20px;font-weight:700}
.fl-fdiag{direction:ltr;text-align:left;font:13px/1.5 ui-monospace,Menlo,Consolas,monospace;color:#5b6470;white-space:pre-wrap;margin:0}
#settings>.panel.settings{box-sizing:border-box!important;width:min(560px,calc(100vw - 24px))!important;min-width:0!important;max-width:none!important;height:min(860px,calc(100dvh - 24px))!important;max-height:none!important;margin:auto!important;padding:16px 16px 12px!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;border-radius:24px!important;background:#fff!important;color:#1d2733;direction:rtl;text-align:start;transform:none!important}
#settings>.panel.settings>.set-body{flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;margin:0!important;padding:0 2px 8px!important;max-height:none!important}
#settings #closeSettings{background:#34b36b!important;color:#fff!important;border:0!important;box-shadow:0 5px 0 #1f8048!important}
#settings .set-head{display:flex!important;align-items:center;justify-content:center;position:relative!important;min-height:48px;margin:0 0 8px!important;padding:0 52px!important;border-bottom:0}
#settings .set-head::after{display:none!important}
#settings .set-head h2{margin:0!important;padding:0!important;font-size:26px!important;line-height:1.25;text-align:center;flex:0 1 auto!important;min-height:0!important}
#settings .set-head>button:first-child{position:absolute!important;inset-inline-start:0!important;inset-inline-end:auto!important;left:auto;top:50%!important;transform:translateY(-50%)!important;margin:0!important;width:44px!important;height:44px!important;min-width:0!important;padding:0!important;border-radius:50%!important;border:1px solid #d5dde6!important;background:#fff!important;color:#1d2733!important;font-size:20px!important;line-height:1!important;display:flex!important;align-items:center;justify-content:center;box-shadow:0 2px 6px #0002!important;cursor:pointer}
#settings .set-head>button:first-child svg{width:20px;height:20px}
@media (max-width:480px){#settings .set-head h2{font-size:21px!important}}`;
    document.head.append(st);
  }
  // Golan 28.10: every settings window is the same window (size, header, X, scrolling body); only each game's own rows differ
  if (root.document) { if (document.head) formCss(); else document.addEventListener("DOMContentLoaded", formCss); }
  function settingsForm(host, cfg = {}) {
    css(); formCss();
    host.innerHTML = ""; const form = document.createElement("div"); form.className = "fl-form"; host.append(form);
    const row = (title) => { const r = document.createElement("div"); r.className = "fl-frow"; if (title) { const t = document.createElement("div"); t.className = "fl-ft"; t.textContent = title; r.append(t); } form.append(r); return r; };
    const seg = (r, items, get, set) => {   // items: [[value, label]]
      const box = document.createElement("div"); box.className = "fl-fseg"; box.setAttribute("role", "group"); r.append(box);
      const draw = () => { const v = get(); box.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(String(b.dataset.v) === String(v)))); };
      for (const [v, label] of items) { const b = document.createElement("button"); b.type = "button"; b.dataset.v = v; b.textContent = label; b.onclick = () => { set(v); draw(); }; box.append(b); }
      draw(); return draw;
    };
    const api = { el: form, picker: null, refreshers: [] };
    // 0. who plays: the child's companion and name only; the details are edited in the hub's settings alone (Golan 20.10)
    const r0 = row(null), kid = document.createElement("div"); r0.classList.add("fl-kidrow"); kid.className = "fl-fkid"; r0.append(kid);
    api.refreshers.push(() => { const p = cur(); r0.hidden = !p; if (p) { kid.innerHTML = `<span class="c">${companionSvg(p, 46)}</span><span class="n"></span>`; kid.querySelector(".n").textContent = p.name; } });
    // 1. learning progress (closed fold), the current child only
    const r1 = row(null), tbl = document.createElement("div"); r1.append(tbl);
    api.refreshers.push(() => { const p = cur(); r1.hidden = !p; if (p) renderParentTable(tbl); });
    // 2. letters to practise: the shared list ("החלטת מערכת") or the letters tapped by hand
    if (cfg.picker) {
      const r2 = row(PICKER_TITLE), box = document.createElement("div"); box.className = "fl-fletters"; if (cfg.lettersId) box.id = cfg.lettersId; r2.append(box);
      api.picker = letterPicker(box, { legend: false, buttons: true, key: cfg.game || "default", ...cfg.picker });
      api.refreshers.push(() => api.picker.refresh());
    }
    // 3. difficulty: החלטת מערכת or 1 / 2 / 3, per child and per game
    if (cfg.game && cfg.levels) {
      const r3 = row("רמת קושי"); let drawSeg = null;
      const ul = document.createElement("ul"); ul.className = "fl-flv";
      const note = document.createElement("div"); note.className = "fl-fnote"; note.textContent = LEVEL_AUTO_NOTE;
      const draw = () => {
        const p = cur(), man = gameLevelOf(p, cfg.game), auto = p ? p.level : 1, eff = man || auto;
        const b = r3.querySelector('.fl-fseg button[data-v="auto"]'); if (b) b.textContent = "החלטת מערכת (" + auto + ")";
        ul.innerHTML = ""; if (cfg.levelsText) { const li = document.createElement("li"); li.textContent = cfg.levelsText; ul.append(li); } else cfg.levels.forEach((t, i) => { const li = document.createElement("li"); li.textContent = "רמה " + (i + 1) + ": " + t; if (i + 1 === eff) li.className = "on"; ul.append(li); });
        if (drawSeg) drawSeg();
      };
      drawSeg = seg(r3, [["auto", "החלטת מערכת"], [1, "1"], [2, "2"], [3, "3"]], () => gameLevelOf(cur(), cfg.game) || "auto",
        (v) => { const was = effLevel(cur(), cfg.game); setGameLevel(v === "auto" ? null : +v, cfg.game); draw(); const now = effLevel(cur(), cfg.game); if (now !== was && cfg.onLevel) cfg.onLevel(now); });
      r3.append(ul, note); draw(); api.refreshers.push(draw);
    }
    // the game's own rows for the adult (tell-me: how to play, the check round, the parent summary), right under the level
    for (const e of cfg.extra || []) { const r = row(null); r.append(e); }
    // Golan 24.10: "סוג כתב" for the games that show cursive (כתב יד): automatic mix (a letter known in print sometimes shows
    // in cursive), print only, cursive, or "mixed" (half and half at random, Golan 28.10). Per child and per game is the game's own business (cfg.script.get / set).
    if (cfg.script) { const r = row("סוג כתב"); const d = seg(r, cfg.script.items || [["auto", "החלטת מערכת"], ["print", "דפוס בלבד"], ["cursive", "כתב יד"], ["mixed", "משולב"]], cfg.script.get, cfg.script.set);
      const n = document.createElement("div"); n.className = "fl-fnote"; n.textContent = cfg.script.note || "החלטת מערכת: אות שהילד מזהה בביטחון בדפוס מופיעה לפעמים גם בכתב יד, ויותר ככל שהוא מכיר אותה בכתב. משולב: חצי מהאותיות בדפוס וחצי בכתב יד, באקראי."; r.append(n); api.refreshers.push(d); }
    // 4. speed of everything that moves (the shared slider)
    if (cfg.game) { const r4 = row(null), sp = document.createElement("div"); r4.append(sp); const sr = speedRow(sp, cfg.game, cfg.speed || {}); api.refreshers.push(() => sr.refresh()); }
    // 5. the narrator's voice, 6. graphics quality
    if (cfg.voice) { const r5 = row("קול הקריינית"); const d = seg(r5, [["on", "פועל"], ["off", "כבוי"]], cfg.voice.get, cfg.voice.set); api.refreshers.push(d); }
    if (cfg.quality) { const r6 = row("איכות גרפיקה"); const d = seg(r6, [["high", "גבוהה"], ["eco", "חסכונית"]], cfg.quality.get, cfg.quality.set);
      const n = document.createElement("div"); n.className = "fl-fnote"; n.textContent = "חסכונית: למכשיר איטי, או כדי לחסוך בסוללה."; r6.append(n); api.refreshers.push(d); }
    // 7. technical information (closed fold): load test (the FPS box row is gone, Golan 28.10), the game's own extras, diagnostics
    const t = cfg.tech || {};
    if (t.stress || t.diag || (t.extra && t.extra.length)) {
      const r7 = row(null), box = document.createElement("div"); box.className = "fl-topb"; box.hidden = true;
      const cap = document.createElement("button"); cap.type = "button"; cap.className = "fl-cap"; cap.setAttribute("aria-expanded", "false");
      cap.innerHTML = `<span class="fl-capt">מידע טכני</span><span class="fl-chev" aria-hidden="true">▾</span>`;
      cap.onclick = () => { const open = box.hidden; if (open) document.querySelectorAll(".fl-cap[aria-expanded=true]").forEach((o) => o !== cap && o.click()); box.hidden = !open; cap.setAttribute("aria-expanded", String(open)); if (open && diag) diag.textContent = t.diag(); };
      r7.append(cap, box);
      const sub = (title) => { const r = document.createElement("div"); r.className = "fl-frow"; const tt = document.createElement("div"); tt.className = "fl-ft"; tt.style.fontSize = "18px"; tt.textContent = title; r.append(tt); box.append(r); return r; };
      if (t.stress) api.refreshers.push(seg(sub("עומס בדיקה (כ-100 אלף משולשים)"), [["off", "כבוי"], ["on", "פועל"]], t.stress.get, t.stress.set));
      for (const e of t.extra || []) box.append(e);
      var diag = null; if (t.diag) { diag = document.createElement("pre"); diag.className = "fl-fdiag"; box.append(diag); }
      api.closeTech = () => { box.hidden = true; cap.setAttribute("aria-expanded", "false"); };
    }
    api.refresh = () => { for (const f of api.refreshers) try { f(); } catch (e) {} };
    api.refresh();
    return api;
  }
  function mountSpeedRows() { try { document.querySelectorAll("[data-fl-speed]").forEach((el) => { if (!el.firstChild) speedRow(el, el.dataset.flSpeed); }); } catch (e) {} }
  const refreshSpeed = () => speedRows.forEach((r) => r.refresh());
  if (root.document) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountSpeedRows); else mountSpeedRows(); }
  // Gendered narrator line: try "<id>_m"/"<id>_f" by the child's profile, then the neutral "<id>". Co-play lines stay plural (pass neutral ids).
  function lineIds(id) { const g = cur() && cur().gender; return g ? [id + "_" + g, id] : [id]; }

  // ---------- helpers ----------
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function pickWeighted(a, w) { const ws = a.map(w), sum = ws.reduce((x, y) => x + y, 0); if (!sum) return pick(a); let r = Math.random() * sum; for (let i = 0; i < a.length; i++) { r -= ws[i]; if (r <= 0) return a[i]; } return a[a.length - 1]; }

  // ---------- views ----------
  // Golan 16.10: palettes for the parent states + the selected mark (preview games/shared/palette-options.png).
  // A tile's state is told by lightness first (works for colour-blind eyes and in grey); glyph contrast >= 4.5:1;
  // the mark is a ring inside the tile between two white lines, so it needs 3:1 only against white (WCAG 1.4.11).
  const PALETTES = {
    A: { known: "#1565c0", almost: "#90caf9", new: "#eceff1", knownText: "#fff", mark: "#e65100", markBg: "#fff3e0" },   // blue ramp, orange mark
    B: { known: "#2e7d32", almost: "#a5d6a7", new: "#eeeeee", knownText: "#fff", mark: "#7b1fa2", markBg: "#f3e5f5" },   // green ramp, purple mark
    C: { known: "#00796b", almost: "#ffe082", new: "#eceff1", knownText: "#fff", mark: "#283593", markBg: "#e8eaf6" },   // teal / amber / grey, indigo mark (default, Golan 16.10)
  };
  let PAL = PALETTES.C;   // Golan 16.10 20:31 chose option ג
  const COLORS = { new: PAL.new, learning: "#9cc8f5", hard: "#f6b26b", almost: PAL.almost, known: PAL.known };
  const TEXT = (st) => (st === "known" ? PAL.knownText : "#1d3557");
  function setPalette(name) { const q = PALETTES[name]; if (!q) return false; PAL = q; Object.assign(COLORS, { new: q.new, almost: q.almost, known: q.known });
    document.documentElement.style.setProperty("--fl-mark", q.mark); document.documentElement.style.setProperty("--fl-mark-bg", q.markBg); return true; }
  const LABELS = { new: "חדשה", learning: "בלמידה", hard: "בתרגול", almost: "מוכרת", known: "מזהה בביטחון" };   // Golan 16.10
  const shownState = (st) => (st === "known" || st === "almost" ? st : "new");   // Golan 16.10: the parent sees 3 states, no "בלמידה"
  function css() {
    if (document.getElementById("fl-learner-css")) return;
    const s = document.createElement("style"); s.id = "fl-learner-css";
    s.textContent = `.fl-cap{display:flex;align-items:center;gap:8px;width:100%;border:0;background:none;padding:4px 0;font:inherit;font-size:20px;font-weight:800;color:inherit;cursor:pointer;text-align:start}.fl-capt{flex:1}.fl-chev{transition:transform .2s;font-size:18px}.fl-cap[aria-expanded=true] .fl-chev{transform:rotate(180deg)}.fl-cap:focus:not(:focus-visible),.fl-toph:focus:not(:focus-visible){outline:none}.fl-topics{margin-top:6px}.fl-topic{padding:8px 0;border-top:1px solid #e6ebf0}.fl-toph{display:flex;align-items:center;gap:8px;width:100%;border:0;background:none;padding:2px 0;font:inherit;font-size:18px;font-weight:700;color:inherit;cursor:pointer;text-align:start}.fl-toph[aria-expanded=true] .fl-chev{transform:rotate(180deg)}.fl-topb{padding-top:4px}.fl-topn{font-size:16px;color:#5b6470;margin:2px 0 6px}.fl-ov{position:fixed;inset:0;z-index:9999;box-sizing:border-box;padding:var(--edge-t,env(safe-area-inset-top)) var(--edge-r,env(safe-area-inset-right)) var(--edge-b,env(safe-area-inset-bottom)) var(--edge-l,env(safe-area-inset-left));background:rgba(20,40,70,.55);display:flex;align-items:center;justify-content:center;direction:rtl;font-family:inherit}
.fl-ovc{display:contents}
/* the box never sits under the door and gear: room beside them when wide, below them when tall (screens audit 16.10) */
@media (orientation:landscape){.fl-ov{padding-left:calc(var(--edge-l,max(16px,env(safe-area-inset-left))) + 72px)}}
@media (orientation:portrait){.fl-ov{padding-top:calc(var(--edge-t,max(12px,env(safe-area-inset-top))) + 72px)}}
.fl-rb{position:fixed;left:var(--edge-l,max(16px,env(safe-area-inset-left)));width:64px;height:64px;border-radius:50%;border:0;display:grid;place-items:center;cursor:pointer;font-size:30px;padding:0;z-index:30}
.fl-rb svg{width:1em;height:1em;display:block}.fl-rb.fl-gear svg{width:1.3em;height:1.3em}
.fl-rb.fl-door{top:var(--edge-t,max(12px,env(safe-area-inset-top)));background:#ff8a3d;box-shadow:0 3px 0 #c45f1d}
.fl-rb.fl-gear{top:calc(var(--edge-t,max(12px,env(safe-area-inset-top))) + 76px);background:#ffffffee;box-shadow:0 4px 16px #0002}
.fl-rb:active{transform:translateY(2px)}.fl-rb[hidden]{display:none}
.fl-box{background:#fff;border-radius:28px;padding:22px;box-sizing:border-box;max-width:min(calc(560 * var(--u, 1px)),100%);max-height:100%;overflow:auto;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.25)}
.fl-box h2{margin:4px 0 16px;font-size:30px;line-height:1.7;color:#1d3557}
.fl-np{display:none}
.fl-th{display:flex;align-items:center;justify-content:center;gap:6px}.fl-spk{border:0;background:none;cursor:pointer;font-size:28px;line-height:1;padding:4px;border-radius:50%;position:relative}
/* touch area at least --tap-s (about 10 mm; 44px without screen.js), without making the title line taller */
.fl-spk::before{content:"";position:absolute;left:50%;top:50%;width:max(100%,var(--tap-s,44px));height:max(100%,var(--tap-s,44px));transform:translate(-50%,-50%);border-radius:50%}
.fl-big .fl-age{font-size:34px;min-width:72px;padding:10px 14px;border-color:#d0d7e0;border-radius:18px;background:#eef6ff;font-weight:800}
.fl-add{min-height:140px}.fl-add b{font-size:56px}
.fl-kids{display:flex;flex-wrap:wrap;gap:14px;justify-content:center}
.fl-kid{border:0;border-radius:22px;background:#eaf4ff;padding:14px 18px;min-width:120px;font-size:22px;cursor:pointer;font-family:inherit}
.fl-kid b{display:block;font-size:56px;line-height:1.1}
.fl-add{background:#fff;border:3px dashed #9cc8f5}
.fl-row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:12px 0}
.fl-age{font-size:20px;min-width:40px;border:3px solid transparent;border-radius:12px;background:#f3f6fa;padding:4px 8px;cursor:pointer;font-family:inherit}.fl-al{font-size:18px;align-self:center}
.fl-age.on,.fl-g.on,.fl-itm.on{border-color:#2b8a3e;background:#e6f7e9}
.fl-col{width:42px;height:42px;border-radius:50%;border:4px solid #fff;box-shadow:0 0 0 2px #c9d6e3;cursor:pointer}
.fl-col.on{box-shadow:0 0 0 4px #2b8a3e}
.fl-itm{border:3px solid transparent;border-radius:16px;background:#f3f6fa;padding:2px;cursor:pointer;line-height:0}
.fl-itm:disabled{opacity:.25;cursor:default}
.fl-prev{line-height:0;margin-bottom:6px}

.fl-g{font-size:24px;border:3px solid transparent;border-radius:20px;background:#f3f6fa;padding:10px 22px;cursor:pointer;font-family:inherit}
.fl-g b{display:block;font-size:52px}
.fl-in{font-size:24px;padding:10px 14px;border-radius:14px;border:2px solid #c9d6e3;width:70%;text-align:center;font-family:inherit}
.fl-ok{font-size:26px;border:0;border-radius:20px;background:#2bb673;color:#fff;padding:12px 34px;margin-top:10px;cursor:pointer;font-family:inherit}
.fl-ok:disabled{opacity:.4}
.fl-grid{display:grid;grid-template-columns:repeat(9,minmax(0,1fr));gap:clamp(3px,1.2%,5px);padding:0;direction:rtl;width:100%;max-width:420px;min-width:0;margin:0 auto;box-sizing:border-box}
.fl-cursive .fl-cell{font-family:"FL Cursive",cursive;font-size:clamp(20px,4vw,30px);font-weight:400}
.fl-cell{border-radius:8px;font-size:clamp(16px,3.2vw,24px);aspect-ratio:1;display:flex;align-items:center;justify-content:center;min-width:0;position:relative;color:#1d3557}
.fl-cell i{position:absolute;top:1px;left:4px;font-size:12px;font-style:normal}
.fl-pick .fl-cell{border:0;padding:0;font-family:inherit;cursor:pointer;font-weight:inherit}
.fl-pick .fl-cell.fl-sel{box-shadow:inset 0 0 0 2px #fff,inset 0 0 0 5px var(--fl-mark,#283593),inset 0 0 0 6px #fff;font-weight:700}
/* Golan 16.10: no ✓; the only mark = a glowing green ring OUTSIDE the tile + white inner ring, so it shows on every colour, green too */
.fl-pick .fl-cell:disabled{opacity:.3;cursor:default}
.fl-pick .fl-cell.fl-fin{cursor:pointer}
.fl-pbtns{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-start;margin:10px auto 6px;direction:rtl;width:420px;max-width:100%}
.fl-pbtn{font:inherit;font-size:15px;font-weight:700;color:#1d3557;background:transparent;border:2px solid #c9d6e3;border-radius:12px;padding:6px 9px;min-height:max(var(--tap-s,44px),44px);cursor:pointer;white-space:nowrap}
.fl-pbtn.on{border-color:var(--fl-mark,#283593);box-shadow:inset 0 0 0 2px var(--fl-mark,#283593);background:var(--fl-mark-bg,#e8eaf6);color:#1d3557}
.fl-ptitle{font-size:18px;font-weight:700;text-align:right;direction:rtl;width:420px;max-width:100%;margin:0 auto 6px}
.fl-pnote{font-size:14px;color:#4a5a70;text-align:right;direction:rtl;max-width:420px;margin:0 auto}
.fl-leg{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-start;direction:rtl;font-size:16px;margin:10px auto;width:420px;max-width:100%}
.fl-leg span{display:inline-flex;align-items:center;gap:4px}.fl-leg u{display:inline-block;width:14px;height:14px;border-radius:4px}
.fl-lit{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;direction:rtl}
.fl-lit span{font-size:34px;width:52px;line-height:52px;border-radius:50%;text-align:center;background:#eef1f5;color:#c3cad3}
.fl-lit span.half{background:#fff4c2;color:#c9a227;box-shadow:0 0 10px #ffe58a}
.fl-lit span.full{background:#ffd43b;color:#7a5200;box-shadow:0 0 18px #ffd43b}
/* phone held sideways (Golan's phone 915x412): two columns, smaller parts, everything fits without scrolling */
@media (orientation:landscape) and (max-height:560px){
.fl-box{padding:10px 16px;max-height:100%;border-radius:20px}.fl-formbox{max-width:100%}
.fl-box h2{font-size:22px;margin:0 0 6px;line-height:1.3}.fl-pt{display:none}.fl-np{display:inline}
.fl-form{display:grid;grid-template-columns:auto 1fr;gap:6px 18px;align-items:center}
.fl-a{display:flex;flex-direction:column;align-items:center;gap:6px}.fl-a .fl-prev svg{width:84px;height:84px}
.fl-in{width:170px;font-size:20px;padding:6px 10px}
.fl-row{margin:4px 0;gap:6px}.fl-g{font-size:18px;padding:4px 16px}.fl-g b{font-size:30px}
.fl-col{width:28px;height:28px;border-width:3px}.fl-itm svg{width:34px;height:34px}
.fl-ok{font-size:20px;padding:6px 28px;margin-top:4px}
.fl-kid{min-width:96px;padding:8px 12px;font-size:18px}.fl-kid b svg{width:60px;height:60px}}`;
    document.head.appendChild(s);
  }
  const DOOR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2.5" width="12" height="19" rx="1" fill="#3b2a20" stroke="#8a6a55" stroke-width="1"/><path d="M9 2.5 L2.6 0.9 L2.6 23.1 L9 21.5 Z" fill="#e8894a" stroke="#b9612a" stroke-width="1" stroke-linejoin="round"/><circle cx="4.3" cy="12.3" r="1.05" fill="#ffd38a" stroke="#9a4f22" stroke-width=".5"/><path d="M1.5 21.6 H22.5" stroke="#8a6a55" stroke-width="1.4" stroke-linecap="round"/></svg>';
  const GEAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#6b7079" fill-rule="evenodd" d="M10.3 1.5h3.4l.5 2.6a8.3 8.3 0 0 1 2.2.9l2.2-1.5 2.4 2.4-1.5 2.2c.4.7.7 1.4.9 2.2l2.6.5v3.4l-2.6.5a8.3 8.3 0 0 1-.9 2.2l1.5 2.2-2.4 2.4-2.2-1.5a8.3 8.3 0 0 1-2.2.9l-.5 2.6h-3.4l-.5-2.6a8.3 8.3 0 0 1-2.2-.9l-2.2 1.5-2.4-2.4 1.5-2.2a8.3 8.3 0 0 1-.9-2.2l-2.6-.5v-3.4l2.6-.5c.2-.8.5-1.5.9-2.2L3.3 5.9l2.4-2.4 2.2 1.5c.7-.4 1.4-.7 2.2-.9zM12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6z"/></svg>';
  // The central entry page (FirstLearning/index.html, Golan 16.10): "מי משחק?" there, then the game list, then the game.
  // It opens a game with "?hub=1": the child was just chosen there, so the game's first chooseChild() resolves at once
  // with that child (no second "מי משחק?"), and any later call (the door on the game's start screen) goes back to the
  // hub's game list. Opening a game file directly works as before.
  // Where the hub is, in this order, so it holds for every game depth and for copies of learner.js next to a game:
  // 1) "?hub=<full hub URL>" (the hub passes its own address), 2) data-fl-hub="<path from the page>" on the learner.js
  // <script> tag, 3) the address the hub page saved when it last opened (localStorage "fl-hub-url"; file:/// pages share
  // it like the profiles), 4) only for the shared copy (…/games/shared/learner.js): ../../index.html. Otherwise null.
  const HUB_KEY = "fl-hub-url";
  const SCRIPT = (() => { try { return document.currentScript || null; } catch (e) { return null; } })();
  const clean = (u) => { try { const x = new URL(u, location.href); x.search = ""; x.hash = ""; return x.href; } catch (e) { return null; } };
  const sharedHub = (() => { try { const s = SCRIPT && SCRIPT.src; return s && /\/games\/shared\/learner\.js(\?|#|$)/.test(s) ? new URL("../../index.html", s).href : null; } catch (e) { return null; } })();
  const HUB_URL = (() => { try {
    const q = new URLSearchParams(location.search).get("hub");
    if (q && /^(file|https?):/i.test(q)) return clean(q);
    const d = SCRIPT && SCRIPT.getAttribute("data-fl-hub"); if (d) return clean(d);
    const saved = root.localStorage && localStorage.getItem(HUB_KEY); if (saved) return saved;
    return sharedHub;
  } catch (e) { return sharedHub; } })();
  // this page IS the hub (the shared copy loaded by FirstLearning/index.html): remember its address for the games
  try { if (sharedHub && clean(location.href) === sharedHub && root.localStorage) localStorage.setItem(HUB_KEY, sharedHub); } catch (e) {}
  function markHub() { try { const u = clean(location.href); if (u && root.localStorage) localStorage.setItem(HUB_KEY, u); return u; } catch (e) { return null; } }
  const FROM_HUB = (() => { try { return new URLSearchParams(location.search).has("hub"); } catch (e) { return false; } })();
  let hubUsed = false;
  // A session (Golan 19.10): closing the browser / the app and opening it again is a new session, and so is a new
  // child. The browser brings back its last tabs (with "?hub" or "#games" in them), so the page can't tell by its
  // address. Every open page writes a heartbeat (localStorage "fl-alive" {t, sid}) every few seconds and when it
  // hides or closes; a page that finds no heartbeat, or one older than 20 s, starts a new session: the hub asks
  // "מי משחק?" again and a game opened with "?hub" goes back to the hub first.
  const ALIVE_KEY = "fl-alive", ALIVE_GAP = 20000;
  const SESSION = (() => { let v = null; try { v = JSON.parse(localStorage.getItem(ALIVE_KEY) || "null"); } catch (e) {}
    const fresh = !v || !v.sid || !(Date.now() - v.t < ALIVE_GAP);
    return { fresh, sid: fresh ? Date.now().toString(36) + Math.random().toString(36).slice(2, 6) : v.sid }; })();
  const beat = () => { try { localStorage.setItem(ALIVE_KEY, JSON.stringify({ t: Date.now(), sid: SESSION.sid })); } catch (e) {} };
  beat(); try { const iv = setInterval(beat, 4000); if (iv && iv.unref) iv.unref(); addEventListener("pagehide", beat); addEventListener("visibilitychange", beat); } catch (e) {}
  if (SESSION.fresh && FROM_HUB && HUB_URL) { try { location.replace(HUB_URL); } catch (e) {} }
  // "מי משחק?" Resolves with the profile. Shown on EVERY entry to a game, even with one child, because the game
  // can't know who is holding the device (Golan 15.10). No children yet: the first-time registration form.
  // On "מי משחק?" (Golan 16.10): the door is always there (no gear since Golan 19.10), and tapping outside the box returns to the
  // state before the popup: from the new-child form back to the list; from the list the popup closes and the game
  // goes on with the child who was playing (nothing changes). With no child yet the form can't be closed.
  // (no gear here since Golan 19.10: settings open from the game screen, for the child who plays)
  // Hila reads "מִי מְשַׂחֵק?" (Golan 16.10: a speaker at the end of every title). The clip sits in voice/audio/ next to
  // games/; until it exists the speaker stays silent (never a browser voice).
  const CLIP_BASE = (() => { try { const s = document.currentScript && document.currentScript.src; return s ? new URL("../../voice/audio/", s).href : null; } catch (e) { return null; } })();
  let clipNow = null;
  function sayClip(id) { try { if (clipNow) clipNow.pause(); if (!CLIP_BASE) return; clipNow = new Audio(CLIP_BASE + id + ".mp3"); clipNow.play().catch(() => {}); } catch (e) {} }
  const END_DOOR = '<svg class="fl-end-door" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2.5" width="12" height="19" rx="1" fill="#3b2a20" stroke="#8a6a55" stroke-width="1"/><path d="M9 2.5 L2.6 0.9 L2.6 23.1 L9 21.5 Z" fill="#e8894a" stroke="#b9612a" stroke-width="1" stroke-linejoin="round"/><circle cx="4.3" cy="12.3" r="1.05" fill="#ffd38a" stroke="#9a4f22" stroke-width=".5"/></svg>';   // the door of every game (Golan 22.10: on "חזור")
  const spk = (id) => `<button class="fl-spk" type="button" aria-label="הקשבה" data-clip="${id}">🔊</button>`;
  // opt.onBack(): the page's own action when the popup is left from the list with no step inside it to go back to
  // (the hub passes it); without it the popup closes and the child who was playing goes on.
  function chooseChild(opt = {}) {
    load();
    if (FROM_HUB && HUB_URL) {
      if (!hubUsed && cur()) { hubUsed = true; return Promise.resolve(cur()); }
      if (hubUsed) { location.href = HUB_URL + "#games"; return new Promise(() => {}); }
    }
    const list = Object.values(db.profiles);
    return new Promise((resolve) => {
      css();
      const ov = document.createElement("div"); ov.className = "fl-ov";
      ov.addEventListener("click", (e) => { const b = e.target.closest && e.target.closest(".fl-spk"); if (b) sayClip(b.dataset.clip); });
      const done = (p) => { if (clipNow) clipNow.pause(); ov.remove(); resolve(p); };
      // Golan 16.10: the age is part of every child's details. A child saved before that is asked once, right after the pick.
      const askAge = (p) => {
        const he = p.gender === "f" ? "בת" : "בן";   // parent-facing and the name has no nikud: the whole line plain (ruling 16.10)
        view = "age"; box.innerHTML = `<div class="fl-box"><h2 class="fl-t"></h2><div class="fl-row fl-ages fl-big">${[3, 4, 5, 6, 7].map((a) => `<button class="fl-age" data-a="${a}">${a}</button>`).join("")}</div></div>`;
        ov.querySelector(".fl-t").textContent = `${p.name} ${he} כמה?`;
        ov.querySelectorAll(".fl-age").forEach((b) => (b.onclick = () => { updateProfile(p.id, { age: +b.dataset.a }); setCurrent(p.id); done(cur()); }));
        sync();
      };
      const picked = (p) => { if (p.birthYear == null) askAge(p); else { setCurrent(p.id); done(cur()); } };   // the child becomes current only once the age is in, so "back" leaves things as they were
      let view = null;
      ov.innerHTML = `<div class="fl-ovc"></div><button type="button" class="fl-rb fl-door" aria-label="יציאה" title="יציאה">${DOOR_SVG}</button>`;   // no gear on "מי משחק?" (Golan 19.10)
      const box = ov.querySelector(".fl-ovc"), door = ov.querySelector(".fl-door");
      // back = the state before this step: form or age question -> the list; the list -> close (the hub: its own onBack)
      const inner = () => (view === "form" || view === "age") && Object.keys(db.profiles).length;
      const canBack = () => inner() || (view === "list" && (cur() || opt.onBack));
      const back = () => { if (inner()) showList(); else if (view === "list" && opt.onBack) { if (clipNow) clipNow.pause(); ov.remove(); opt.onBack(); } else if (view === "list" && cur()) done(cur()); };
      const sync = () => {};   // only the door; settings open from the game screen, for the child who plays (Golan 19.10)
      const exit = () => { if (canBack()) back(); else if (root.history && history.length > 1) history.back(); };
      ov.addEventListener("click", (e) => { if (e.target === ov) back(); });
      door.onclick = exit;
      const showList = () => {
        view = "list"; box.innerHTML = `<div class="fl-box"><h2 class="fl-th"><span class="fl-pt">מִי מְשַׂחֵק?</span><span class="fl-np">מי משחק?</span>${spk("who_plays")}</h2><div class="fl-kids"></div></div>`;
        const kids = ov.querySelector(".fl-kids");
        for (const p of Object.values(db.profiles)) {
          const b = document.createElement("button"); b.className = "fl-kid"; b.innerHTML = `<b>${companionSvg(p, 84)}</b>`; b.append(p.name);
          b.onclick = () => picked(p); kids.append(b);
        }
        const add = document.createElement("button"); add.className = "fl-kid fl-add"; add.innerHTML = "<b>➕</b>"; add.setAttribute("aria-label", "ילד חדש"); add.title = "ילד חדש"; add.onclick = showForm; kids.append(add);
        sync();
      };
      const showForm = () => {
        let { color, item } = freeCombo(), gender = null, age = null;
        view = "form"; box.innerHTML = `<div class="fl-box fl-formbox"><div class="fl-form">
          <div class="fl-a"><h2 class="fl-th"><span class="fl-pt">מִי מְשַׂחֵק?</span><span class="fl-np">מי משחק?</span>${spk("who_plays")}</h2><div class="fl-prev"></div>
          <input class="fl-in" maxlength="20" placeholder="שם" aria-label="שם"></div>
          <div class="fl-b"><div class="fl-row fl-gs"><button class="fl-g" data-g="m"><b>👦</b>בן</button><button class="fl-g" data-g="f"><b>👧</b>בת</button></div>
          <div class="fl-row fl-ages"><span class="fl-al">גיל</span>${[3, 4, 5, 6, 7].map((a) => `<button class="fl-age" data-a="${a}">${a}</button>`).join("")}</div>
          <div class="fl-row fl-cols"></div><div class="fl-row fl-items"></div><button class="fl-ok" disabled>✓</button></div></div></div>`;
        const inp = ov.querySelector(".fl-in"), ok = ov.querySelector(".fl-ok"), prev = ov.querySelector(".fl-prev");
        const cols = ov.querySelector(".fl-cols"), its = ov.querySelector(".fl-items"), t = taken();
        const upd = () => { ok.disabled = !inp.value.trim() || !gender || !age || t.includes(color + ":" + item); };   // age required (Golan 16.10)
        const draw = () => {
          prev.innerHTML = companionSvg({ color, item }, 120);
          cols.innerHTML = ""; its.innerHTML = "";
          COMP_COLORS.forEach((c, i) => { const b = document.createElement("button"); b.className = "fl-col" + (i === color ? " on" : ""); b.style.background = c; b.setAttribute("aria-label", "צבע " + (i + 1));
            b.onclick = () => { color = i; if (t.includes(color + ":" + item)) { const f = [0, 1, 2, 3, 4, 5].find((k) => !t.includes(color + ":" + k)); if (f != null) item = f; } draw(); }; cols.append(b); });
          COMP_ITEMS.forEach((_, k) => { const b = document.createElement("button"), used = t.includes(color + ":" + k);
            b.className = "fl-itm" + (k === item ? " on" : ""); b.disabled = used; b.innerHTML = companionSvg({ color, item: k }, 52);
            b.onclick = () => { item = k; draw(); }; its.append(b); });
          upd();
        };
        inp.oninput = upd;
        ov.querySelectorAll(".fl-g").forEach((b) => (b.onclick = () => { gender = b.dataset.g; ov.querySelectorAll(".fl-g").forEach((x) => x.classList.toggle("on", x === b)); upd(); }));
        ov.querySelectorAll(".fl-age").forEach((b) => (b.onclick = () => { age = +b.dataset.a; ov.querySelectorAll(".fl-age").forEach((x) => x.classList.toggle("on", x === b)); upd(); }));
        ok.onclick = () => done(newProfile({ name: inp.value, gender, color, item, age }));
        draw(); sync();
        setTimeout(() => inp.focus(), 50);
      };
      document.body.appendChild(ov);
      if (list.length) showList(); else showForm();
    });
  }
  // Parent view (settings): every letter in its colour; 27 tiles (22 + 5 finals) in exactly 3 rows of 9 on every screen (Golan 16.10), with counts and the letters recommended for practice.
  // Golan 19.10: the parent's view is one heading "<name> · התקדמות למידה"; a tap opens the learning topics, another tap
  // closes them. Only letter recognition is measured today; the other topics say so until a game measures them.
  // the 8 opening sounds of בלש הצלילים (summaries/sound-detective-spec.md sec 6), shown with their nikud
  const SOUND_SYL = { "ב": "בַּ", "ג": "גָּ", "נ": "נָ", "ט": "טַ", "י": "יַ", "כ": "כַּ", "א": "אַ", "ח": "חָ", "צ": "צָ", "ר": "רָ", "ת": "תָּ", "מ": "מַ", "ע": "עַ", "פ": "פַּ" };   // צ ר ת added 28.10 18:53; מ ע פ 29.10 (sound wheel: transport, toys)
  const SOUND_LETTERS = Object.keys(SOUND_SYL), SOUND_SKILL = 6;
  function soundsKnown() { const c = cardsFor(cur()); return SOUND_LETTERS.filter((l) => c[l] && c[l].sound.state === "known").length; }
  const TOPICS = ["זיהוי צלילים (הצליל של כל אות)", "זיהוי הברות", "קריאת הברות עם ניקוד", "קריאת מילים", "כתיבת אותיות ומילים", "שפה ואוצר מילים", "הבנת הנשמע", "שטף קריאה"];
  function renderParentTable(el) {
    el.style.minWidth = "0"; el.style.maxWidth = "100%"; el.style.alignSelf = "stretch";   /* the heading spans the whole row, ▾ at its end */   // the host may be a flex item: never wider than its row (phones)
    const p = cur(); el.innerHTML = ""; if (!p) { el.textContent = "עוד לא נבחר ילד"; return; }
    css(); const c = cardsFor(p);
    const rec = [...FL.LETTERS, ...FL.FINALS].filter((l) => c[l] && (c[l].recognize || c[l]).state === "known").length;   // Golan 17.10: out of all 27
    // a heading that opens and closes the box under it (Golan 19.10: everything starts closed; leaving the window = all closed,
    // since the window draws this table anew each time it opens)
    // topics form one group: opening one closes the one that was open (Golan 19.10: never two open together)
    const group = [], shut = (g) => { g.box.hidden = true; g.b.setAttribute("aria-expanded", "false"); };
    const fold = (cls, title, box, inGroup) => { const b = document.createElement("button"); b.type = "button"; b.className = cls; b.setAttribute("aria-expanded", "false");
      b.innerHTML = `<span class="fl-capt"></span><span class="fl-chev" aria-hidden="true">▾</span>`; b.querySelector(".fl-capt").textContent = title; box.hidden = true;
      if (inGroup) group.push({ b, box });
      b.onclick = () => { const open = box.hidden; if (open && inGroup) group.forEach(shut); box.hidden = !open; b.setAttribute("aria-expanded", String(open)); }; return b; };
    const body = document.createElement("div"); body.className = "fl-topics";
    const cap = fold("fl-cap", "התקדמות למידה", body);   // Golan 19.10: no name, no companion here
    // the big menus follow the same rule: opening one closes any other open big menu on the page (Golan 19.10)
    cap.addEventListener("click", () => { if (cap.getAttribute("aria-expanded") !== "true") return;
      document.querySelectorAll(".fl-cap[aria-expanded=true]").forEach((o) => { if (o !== cap) o.click(); }); });
    const topic = (title, sub) => { const t = document.createElement("div"); t.className = "fl-topic"; const inner = document.createElement("div"); inner.className = "fl-topb";
      if (sub) { const n = document.createElement("div"); n.className = "fl-topn"; n.textContent = sub; inner.append(n); }
      t.append(fold("fl-toph", title, inner, true), inner); body.append(t); return inner; };
    const letters = topic("זיהוי אותיות", `מזהה בביטחון ${rec} אותיות מתוך 27 (22 + 5 סופיות)`);   /* Golan 18.10: no "אומר את השם של" line */
    const grid = document.createElement("div"); grid.className = "fl-grid";
    for (const l of [...FL.LETTERS, ...FL.FINALS]) {
      // Golan 16.10: 3 states only; "בלמידה" / "בתרגול" show as "חדשה" (the model keeps them for choosing letters)
      const k = c[l], shown = shownState(k.state), s = document.createElement("div"); s.className = "fl-cell"; s.style.background = COLORS[shown]; s.style.color = TEXT(shown);
      s.textContent = l; s.title = LABELS[shown] + (Object.keys(k.pairs).length ? " · לפעמים עם " + Object.keys(k.pairs).join(", ") : "");
      grid.append(s);
    }
    const leg = document.createElement("div"); leg.className = "fl-leg";
    for (const k of ["known", "almost", "new"]) leg.insertAdjacentHTML("beforeend", `<span><u style="background:${COLORS[k]}"></u>${LABELS[k]}</span>`);
    // Golan 16.10: no "fluent" star for the parent; "מזהה בביטחון" is the top state shown (card(l).fluent stays in the model)
    const pairs = reportablePairs(p); const pl = document.createElement("div"); pl.style.cssText = "font-size:16px;margin-top:6px";
    if (pairs.length) pl.textContent = pairs.map((x) => `${p.name} לומד/ת עכשיו להבחין בין ${x.asked} ל-${x.picked}. הן נראות דומות, וזה שלב רגיל.`)[0];
    letters.append(grid, leg, pl);   // Golan 16.10: no "מומלץ לתרגל כעת" line
    // Golan 24.10: the same table for the cursive letters (כתב יד). A letter opens there only once it is "מזהה בביטחון" in print;
    // until then its tile is faded.
    const all = [...FL.LETTERS, ...FL.FINALS], open = all.filter((l) => c[l].recognize.state === "known");
    const curKnown = all.filter((l) => c[l].cursive.state === "known").length;
    const cbox = topic("זיהוי אותיות בכתב יד", open.length ? `מזהה בביטחון ${curKnown} אותיות כתב מתוך 27. אות בכתב נפתחת אחרי שהילד מזהה אותה בביטחון בדפוס (פתוחות ${open.length}).` : "עוד לא נפתחו אותיות. אות בכתב נפתחת אחרי שהילד מזהה אותה בביטחון בדפוס.");
    const cgrid = document.createElement("div"); cgrid.className = "fl-grid fl-cursive";
    for (const l of all) {
      const s = document.createElement("div"); s.className = "fl-cell"; s.textContent = l;
      if (!open.includes(l)) { s.style.background = "transparent"; s.style.outline = "1.5px dashed #c3ccd8"; s.style.outlineOffset = "-2px"; s.style.color = "#b4bcc8"; s.title = "עוד לא נפתחה"; }
      else { const shown = shownState(c[l].cursive.state); s.style.background = COLORS[shown]; s.style.color = TEXT(shown); s.title = LABELS[shown]; }
      cgrid.append(s);
    }
    const cleg = leg.cloneNode(true); cleg.insertAdjacentHTML("beforeend", `<span><u style="background:transparent;outline:1.5px dashed #c3ccd8;outline-offset:-1px"></u>עוד לא נפתחה</span>`);
    cbox.append(cgrid, cleg);
    // Golan 28.10 (בלש הצלילים): the opening sound (צליל פותח) of each letter, same states and colours. A skill, not a list:
    // 6 different sounds "מזהה בביטחון" = the skill is there (anchor: the start-of-grade-1 check, 5-6 of 6)
    const soundEv = p.events.some((e) => e.m === "sound");
    const sKnown = SOUND_LETTERS.filter((l) => c[l].sound.state === "known").length;
    if (soundEv) {
      const sbox = topic(TOPICS[0], `מזהה את הצליל הפותח ב-${sKnown} צלילים שונים.` + (sKnown >= SOUND_SKILL ? " המיומנות נרכשה." : ` המיומנות נרכשת ב-${SOUND_SKILL} צלילים.`));
      const sgrid = document.createElement("div"); sgrid.className = "fl-grid fl-sounds";
      for (const l of SOUND_LETTERS) { const shown = shownState(c[l].sound.state), s = document.createElement("div"); s.className = "fl-cell";
        s.style.background = COLORS[shown]; s.style.color = TEXT(shown); s.textContent = SOUND_SYL[l]; s.title = LABELS[shown]; sgrid.append(s); }
      sbox.append(sgrid, leg.cloneNode(true));
    }
    for (const t of TOPICS) if (!(soundEv && t === TOPICS[0])) topic(t, "עוד לא נבדק: אין עדיין משחק בנושא הזה.");
    el.append(cap, body);
  }
  // Letter picker for each game's "אותיות ללימוד" (Golan 16.10: identical to the parent table, plus choosing).
  // Same 27 tiles, 3 rows of 9, same state colours. Selected = thick dark outline + small check; letters the game
  // can't use = faded, not clickable. Each letter toggles only itself (Golan 16.10: מ no longer takes ם);
  // with finals:false the finals are display-only and get() returns only the 22 base letters.
  // letterPicker(el, { selected, available, finals, legend, onChange(list) }) -> { get(), set(list), refresh() }
  // Hand changes on top of "החלטת מערכת" (Golan 16.10), for this page only: nextLetter({ chosen: [] }) and autoLetters()
  // add autoForce.in and drop autoForce.out. A game with its own auto list wraps it in FL.learner.withAutoForce(list).
  const autoForce = { in: new Set(), out: new Set() }, pickState = {};
  function withAutoForce(list) {
    const out = list.filter((l) => !autoForce.out.has(l)); for (const b of autoForce.in) if (!out.includes(b)) out.push(b);
    return out.length ? out : list.slice();
  }
  const PICKER_TITLE = "בחירת אותיות לתרגול במשחק זה (ניתן לשינוי ידני בלחיצה על האותיות)";   // Golan 16.10
  const MANUAL_NOTE = "בחירה ידנית: המשחק מתרגל את האותיות המסומנות. לחיצה על אות מוסיפה אותה או מורידה אותה. החלטת מערכת מחזירה את הבחירה למשחק.";
  function letterPicker(el, opt = {}) {
    css();
    el.style.minWidth = "0"; el.style.maxWidth = "100%";
    const finals = opt.finals !== false, avail = new Set(opt.available || FL.LETTERS);
    const sel = new Set();
    // sel holds base letters and (when the game teaches finals) final letters on their own, so "א-ת" can mean no finals.
    // Tapping a base letter still takes its final along; with finals:false a final only mirrors its base.
    const finOf = (b) => FL.FINALS.filter((f) => FL.FINAL_BASE[f] === b);
    const put = (list) => { sel.clear(); for (const x of list || []) { const b = FL.FINAL_BASE[x] || x; if (!FL.LETTERS.includes(b) || !avail.has(b)) continue;
      if (x === b) { sel.add(b); if (!finals) continue; } else if (finals) sel.add(x); else sel.add(b); } };
    const addBase = (b) => { sel.add(b); if (finals) for (const f of finOf(b)) sel.add(f); };
    // Golan 16.10: "החלטת מערכת" = the system picks the letters every round from the child's card (nextLetter with no
    // chosen list). It is the mode for a child with no manual selection; tapping a letter switches to manual.
    // Golan 16.10: every page load starts in "החלטת מערכת"; the state then lives here for the page (reopening settings
    // keeps it), so opt.selected / opt.mode are no longer restored. Exactly one button is pressed: the last one chosen
    // (preset). Tapping letters adds / removes by hand on top of any preset, and the preset stays pressed.
    const key = opt.key || "default", st = pickState[key] || (pickState[key] = { preset: "auto", sel: null });
    if (st.sel) { sel.clear(); for (const x of st.sel) sel.add(x); } else sel.clear();
    let mode = st.preset === "auto" ? "auto" : "manual";
    const save = () => { st.sel = [...sel]; st.preset = preset; };
    let preset = st.preset;
    const list = () => [...FL.LETTERS, ...(finals ? FL.FINALS : [])].filter((l) => sel.has(l));
    const get = () => (mode === "auto" ? [] : list());
    const guess = () => !sel.size ? "clear" : [...sel].every((x) => FL.FINALS.includes(x)) ? "fin" : finals && [...sel].some((x) => FL.FINALS.includes(x)) ? "all" : "ab";
    const changed = () => { save(); draw(); opt.onChange && opt.onChange(get(), mode); };
    const draw = () => {
      el.innerHTML = ""; const p = cur(), c = p ? cardsFor(p) : null;
      if (opt.title) { const h = document.createElement("div"); h.className = "fl-ptitle"; h.textContent = typeof opt.title === "string" ? opt.title : PICKER_TITLE; el.append(h); }
      // auto: the table marks the letters the system practises right now (Golan 16.10: otherwise the button looks dead)
      const autoSrc = mode !== "auto" ? [] : typeof opt.autoList === "function" ? (opt.autoList() || []) : Array.isArray(opt.autoList) ? opt.autoList : autoLetters();   // a game's own auto order (waking-letter)
      const autoSet = new Set(mode === "auto" ? withAutoForce(autoSrc).filter((x) => avail.has(FL.FINAL_BASE[x] || x)) : []);
      const grid = document.createElement("div"); grid.className = "fl-grid fl-pick" + (mode === "auto" ? " fl-auto" : ""); grid.setAttribute("role", "group"); grid.setAttribute("aria-label", "אותיות ללימוד");
      for (const l of [...FL.LETTERS, ...FL.FINALS]) {
        const base = FL.FINAL_BASE[l] || l, k = c && c[l], shown = !k ? "new" : shownState(k.state);
        const b = document.createElement("button"); b.type = "button"; b.className = "fl-cell" + (base !== l ? " fl-fin" : "");
        b.style.background = COLORS[shown]; b.style.color = TEXT(shown); b.textContent = l; b.title = LABELS[shown];
        b.disabled = !avail.has(base) || (!finals && base !== l);   // Golan 17.10: a game without finals shows them faded, never linked to the base letter
        const key = l, on = mode === "auto" ? autoSet.has(key) : sel.has(key); b.classList.toggle("fl-sel", on && !b.disabled); b.setAttribute("aria-pressed", on ? "true" : "false");
        b.onclick = () => {
          if (mode === "auto") {   // auto: the letter is forced in / out on top of the system's pick, which keeps adapting
            if (autoSet.has(key)) { autoForce.out.add(key); autoForce.in.delete(key); } else { autoForce.in.add(key); autoForce.out.delete(key); }
            return changed(); }
          if (base !== l && finals) { if (sel.has(l)) sel.delete(l); else sel.add(l); }   // a final on its own
          else if (sel.has(base)) sel.delete(base); else sel.add(base);   // Golan 16.10: each letter toggles only itself (מ no longer takes ם)
          changed(); };
        grid.append(b);
      }
      el.append(grid);
      if (opt.legend !== false) { const leg = document.createElement("div"); leg.className = "fl-leg";
        for (const k of ["known", "almost", "new"]) leg.insertAdjacentHTML("beforeend", `<span><u style="background:${COLORS[k]}"></u>${LABELS[k]}</span>`);
        el.append(leg); }
      if (opt.buttons) {   // the shared row: "החלטת מערכת", "כל האותיות", "ניקוי" + the explanation (plain text, ruling 16.10)
        const row = document.createElement("div"); row.className = "fl-pbtns";
        const mk = (t, on, fn) => { const b = document.createElement("button"); b.type = "button"; b.className = "fl-pbtn" + (on ? " on" : ""); b.textContent = t; b.setAttribute("aria-pressed", on ? "true" : "false"); b.onclick = fn; row.append(b); };
        mk("החלטת מערכת", preset === "auto", () => { preset = "auto"; mode = "auto"; autoForce.in.clear(); autoForce.out.clear(); changed(); });   // pressed again = the system's own pick, hand changes dropped
        const bases = FL.LETTERS.filter((b) => avail.has(b)), fins = finals ? FL.FINALS.filter((f) => avail.has(FL.FINAL_BASE[f])) : [];
        const pre = (p, fill) => () => { preset = p; mode = "manual"; sel.clear(); fill(); changed(); };
        // one button lit at most, the most specific match; without finals "כל האותיות" = "א-ת", so only "א-ת" is shown (Golan 16.10)
        if (fins.length) mk("כל האותיות", preset === "all", pre("all", () => { for (const b of bases) addBase(b); }));
        mk("א-ת", preset === "ab", pre("ab", () => { for (const b of bases) sel.add(b); }));   // the 22, no finals
        if (fins.length) mk("סופיות", preset === "fin", pre("fin", () => { for (const f of fins) sel.add(f); }));   // only the 5 finals, all else off (Golan 16.10)
        mk("ניקוי", preset === "clear", pre("clear", () => {}));   // Golan 16.10: only removes the marks; the parent then taps letters
        const note = document.createElement("div"); note.className = "fl-pnote";
        const N = autoCount(cur()), un = N ? unknownMaxFor(cur(), N) : null;
        const autoTxt = N ? `המערכת בוחרת ${N} אותיות. חשיפה הדרגתית לאותיות שלא תורגלו עדיין. לחיצה על אות תסמן ותוסיף אותה לתרגול, או תסיר אותה ממנו.`   // Golan 28.10 wording (literacy ruling 6: mostly known, at most 1-2 new)
          : "המערכת בוחרת את האותיות. חשיפה הדרגתית לאותיות שלא תורגלו עדיין. לחיצה על אות תסמן ותוסיף אותה לתרגול, או תסיר אותה ממנו.";   // Golan 28.10 wording
        note.textContent = mode === "auto"
          ? autoTxt
          : !sel.size ? "אין אותיות מסומנות. סמנו את האותיות לתרגול, או בחרו החלטת מערכת. כל עוד לא סומנה אות, המשחק בוחר לבד."
          : MANUAL_NOTE;   // Golan 17.10: the same wording in every game (a game's own opt.note is no longer shown)
        el.append(row, note);
      }
    };
    draw();
    return { get, mode: () => mode, isAuto: () => mode === "auto",
      set: (l, m) => { const was = list().join(""), wasMode = mode; put(l);
        if (list().join("") === was && (m === wasMode || m == null)) { draw(); return; }   // the same choice again (settings reopened): the pressed button stays
        mode = m === "auto" || m === "manual" ? m : sel.size ? "manual" : "auto"; preset = mode === "auto" ? "auto" : guess(); save(); draw(); },
      setMode: (m) => { mode = m === "auto" ? "auto" : "manual"; preset = mode === "auto" ? "auto" : guess(); save(); draw(); }, refresh: draw, preset: () => preset };
  }
  // The letters "החלטת מערכת" works with right now (the child's level pool); nextLetter({ chosen: [] }) picks from it.
  function autoLetters(mode) { const p = cur(); return withAutoForce(p ? levelPool(p, cardsFor(p), mode) : FL.LETTERS.slice()); }
  // Child view: only letters that lit up. Almost known = soft glow, known = full glow. Nothing shows "not yet".
  function renderChildLetters(el) {
    const p = cur(); el.innerHTML = ""; if (!p) return; css(); const c = cardsFor(p);
    const box = document.createElement("div"); box.className = "fl-lit";
    for (const l of FL.LETTERS) { const st = c[l].state; if (st !== "known" && st !== "almost") continue;   // only letters that lit up (Golan 15.10)
      const s = document.createElement("span"); s.textContent = l; s.className = st === "known" ? "full" : "half"; box.append(s); }
    el.append(box);
  }
  // ---------- the end-of-round panel, the same in every game (Golan 16.10; screens standard 4א, modelled on the car) ----------
  // endPanel(host, { title, stars, letters, note, buttons, extra }) draws ONE panel inside the game's own overlay (the
  // game keeps its overlay, door and gear). Order: title, stars (one row, they shrink), letters (one row, two past 12),
  // the day note, extra (e.g. "רוצים להחליף אותיות?"), buttons. Never scrolls: if it does not fit, everything shrinks.
  // stars: ["gold","silver",...]; letters: true = the letters that lit up (child view), or an array of letters
  // (lit = "full"), or [{ l, kind: "full"|"half" }]; note: text or ""; buttons: [{ text, onClick, primary, id, hidden, ghost }].
  // Returns { el, set(opts), fit() }. Voice stays with the game.
  function endCss() {
    if (document.getElementById("fl-end-css")) return;
    const st = document.createElement("style"); st.id = "fl-end-css";
    st.textContent = `.fl-end{--k:1;container-type:inline-size;box-sizing:border-box;width:min(calc(640 * var(--u,1px)),100%);max-height:calc(100dvh - var(--edge-t,0px) - var(--edge-b,0px) - 16px);overflow:hidden;background:#fff;border-radius:calc(28 * var(--u,1px));box-shadow:0 10px 40px #0003;padding:calc(22 * var(--u,1px) * var(--k)) calc(24 * var(--u,1px));display:flex;flex-direction:column;align-items:center;gap:calc(12 * var(--u,1px) * var(--k));text-align:center;direction:rtl;color:#1d3557;font-family:inherit}
.fl-end h1{margin:0;font-size:max(calc(34 * var(--u,1px) * var(--k)),20px);line-height:1.25}
.fl-end-starbox{display:flex;flex-direction:column;align-items:center;gap:calc(4 * var(--u,1px) * var(--k));width:100%}
.fl-end-stars{display:flex;justify-content:center;flex-wrap:nowrap;gap:calc(6 * var(--u,1px));width:100%;direction:rtl}
.fl-end-stars>span{flex:0 1 calc(min(calc(64 * var(--u,1px)),9dvh) * var(--k));max-width:calc((100% - (var(--n) - 1) * 6 * var(--u,1px)) / var(--n));min-width:0;animation:fl-pop .45s cubic-bezier(.3,1.6,.5,1) both}
.fl-end-stars svg{width:100%;height:auto;display:block}
@keyframes fl-pop{from{transform:scale(0)}to{transform:scale(1)}}
@media (prefers-reduced-motion:reduce){.fl-end-stars>span{animation:none}}
.fl-end-lets{display:grid;gap:calc(6 * var(--u,1px));justify-content:center;direction:rtl;width:100%}
.fl-end-lets span{aspect-ratio:1;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:calc(var(--ls) * .62);width:var(--ls);font-weight:700;background:#eef1f5;color:#c3cad3}
.fl-end-ltitle{font-size:max(calc(18 * var(--u,1px) * var(--k)),16px);font-weight:700;color:#4a5a70;margin-bottom:calc(-6 * var(--u,1px) * var(--k))}
.fl-tight .fl-end-ltitle{font-size:14px;line-height:1.2}
.fl-end-lets span.p1{background:#fff6cc;color:#8a6d00}
.fl-end-lets span.p2{background:#ffe082;color:#6b4f00}
.fl-end-lets span.p3{background:#ffc107;color:#4a3500}
.fl-end-lets span.kn{background:var(--fl-known,#00796b);color:#fff}
.fl-end-lets span.half{background:#fff4c2;color:#c9a227;box-shadow:0 0 calc(var(--ls) * .2) #ffe58a}
.fl-end-lets span.full{background:#ffd43b;color:#7a5200;box-shadow:0 0 calc(var(--ls) * .3) #ffd43b}
.fl-end-note{margin:0;font-size:max(calc(24 * var(--u,1px) * var(--k)),16px);font-weight:700;color:#2b6cb0}
.fl-end-btns{display:flex;gap:calc(14 * var(--u,1px));justify-content:center;align-items:stretch;flex-wrap:nowrap;direction:rtl;width:100%}
.fl-end-btn{flex:0 1 calc(260 * var(--u,1px));min-width:0;box-sizing:border-box;border:2px solid transparent;border-radius:999px;background:var(--accent,#ff8a3d);color:var(--accent-ink,#fff);cursor:pointer;font-family:inherit;font-weight:800;font-size:max(calc(30 * var(--u,1px) * var(--k)),20px);padding:0 calc(40 * var(--u,1px));min-height:max(calc(76 * var(--u,1px) * var(--k)),var(--tap,56px));box-shadow:0 5px 0 #c45f1d}
.fl-end-btn:active{transform:translateY(3px);box-shadow:0 2px 0 #c45f1d}
.fl-end-btn.ghost{background:#fff;color:#1d3557;border-color:#d5dde6;box-shadow:0 5px 0 #d5dde6}
.fl-end-btn:not(.ghost){background:#34b36b;color:#fff;box-shadow:0 5px 0 #1f8048}
.fl-end-btn:not(.ghost):active{box-shadow:0 2px 0 #1f8048}
.fl-end-btn{display:inline-flex;align-items:center;justify-content:center;gap:calc(12 * var(--u,1px) * var(--k));white-space:nowrap;padding:0 calc(22 * var(--u,1px))}
.fl-end-btn .fl-end-2l{display:flex;flex-direction:column;align-items:center;line-height:1.02;font-size:.82em}
.fl-end-btn .fl-end-door{width:1.1em;height:1.1em;flex:none}
.fl-end-spk{display:inline-flex;align-items:center;justify-content:center;width:1.5em;height:1.5em;border-radius:50%;background:#ffffff33;font-size:.8em;flex:none}
.fl-end [hidden]{display:none!important}`;
    document.head.append(st);
  }
  // how many times each letter was asked since the previous end panel (or page load): one count per question
  // ---------- the next game, chosen by the system (Golan 29.10) ----------
  // "המשך למשחק הבא" at the end of every game and "התחל משחק" on the map use the same rule: up to 8 letters recognised with
  // confidence: a letter game with a low game challenge; more than 8: one with a higher game challenge; 15 or more: a game
  // of the next island. Never the song, never a game that needs an adult, never the game just played (when there is another).
  const NEXT_GAMES = [
    { id: "waking", g: "wake", path: "games/waking-letter/index.html", tier: "easy" },
    { id: "detective", g: "detective", path: "games/letter-recognition/detective/index.html", tier: "easy" },
    { id: "circle", g: "circle", path: "games/letter-circle/index.html", tier: "easy" },
    { id: "memory", g: "memory", path: "games/memory/index.html", tier: "hard" },
    { id: "race", g: "race", path: "voice/race-gates-voice/index.html", tier: "hard" },
    { id: "train", g: "train", path: "games/letter-train/index.html", tier: "hard" },
    { id: "mole", g: "mole", path: "games/mole/index.html", tier: "hard" },
    { id: "sound", g: "sound", path: "games/sound-detective/index.html", tier: "isle2" },
    { id: "wheel", g: "wheel", path: "games/sound-wheel/index.html", tier: "isle2" },
    { id: "soundtrain", g: "soundtrain", path: "games/sound-train/index.html", tier: "isle2" },   // Golan 29.10
  ];
  function confidentCount() { const p = cur(); if (!p) return 0; const c = cardsFor(p);
    return [...FL.LETTERS, ...FL.FINALS].filter((l) => c[l] && (c[l].recognize || c[l]).state === "known").length; }
  function nextTier() { const n = confidentCount(); return n >= 15 ? "isle2" : n > 8 ? "hard" : "easy"; }
  function nextGame(justPlayed) {
    const now = justPlayed === undefined ? gameCfg.game : justPlayed;
    let last = ""; try { last = localStorage.getItem("fl-map-last") || ""; } catch (e) {}
    const tier = nextTier(), all = NEXT_GAMES.filter((x) => x.tier === tier);
    let pool = all.filter((x) => x.g !== now && x.id !== last);
    if (!pool.length) pool = all.filter((x) => x.g !== now);
    if (!pool.length) pool = all;
    const g = pool[Math.floor(Math.random() * pool.length)];
    try { localStorage.setItem("fl-map-last", g.id); } catch (e) {}
    return g;
  }
  function nextGameUrl(g) { if (!HUB_URL || !g) return null; try { return new URL(g.path, HUB_URL).href + "?hub=" + encodeURIComponent(HUB_URL); } catch (e) { return null; } }
  function goNextGame() { const u = nextGameUrl(nextGame()); if (u) location.href = u; }
  let endShownAt = Date.now(), lastPractice = {}, lastSounds = {};
  function practicedThisRound() {
    const p = cur(); if (!p) return {};
    const fresh = p.events.filter((e) => e.t > endShownAt);
    if (!fresh.length) return lastPractice;   // a redraw of the same end panel
    const n = {}, snd = {}; for (const e of fresh) if (e.l) { const m = e.m === "sound" ? snd : n; m[e.l] = (m[e.l] || 0) + 1; }   // sounds apart (the sound island)
    endShownAt = Date.now(); lastPractice = n; lastSounds = snd; return n;
  }
  function endPanel(host, opt = {}) {
    css(); endCss();
    const el = document.createElement("div"); el.className = "fl-end"; el.setAttribute("role", "dialog");
    host.append(el);
    let o = {}, tight = false; const btnEls = new Map();
    const draw = () => {
      el.innerHTML = "";
      const h = document.createElement("h1"); h.textContent = o.title || "יש! סיימנו סיבוב"; el.append(h);
      // stars in two centred rows (Golan 17.10), the top row one longer when odd; each row shrinks to fit
      const stars = o.stars || [];
      if (stars.length) { const box = document.createElement("div"); box.className = "fl-end-starbox"; box.setAttribute("aria-label", "כוכבים שקיבלנו");
        const top = stars.length > 1 ? Math.ceil(stars.length / 2) : 1, per = Math.max(top, 1);
        for (const part of [stars.slice(0, top), stars.slice(top)]) { if (!part.length) continue;
          const row = document.createElement("div"); row.className = "fl-end-stars"; row.style.setProperty("--n", per);
          part.forEach((k) => { const i = box.childElementCount * top + row.childElementCount;   // place in the whole row of stars
            const sp = document.createElement("span"); sp.innerHTML = starSvg(k === "silver" ? "silver" : "gold", 64, { delay: i * 0.3 }); sp.style.animationDelay = i * 0.12 + "s"; row.append(sp); });
          box.append(row); }
        el.append(box); }
      // letters (Golan 17.10): "האותיות שתורגלו" in yellow shades by how often each was asked this round (3 groups),
      // then "אותיות שזוהו בביטחון" on green. letters: false hides both; an array keeps the old single row.
      const letRow = (title, list, cls) => {
        if (!list.length) return;
        const t = document.createElement("div"); t.className = "fl-end-ltitle"; t.textContent = title; el.append(t);
        const two = list.length > 12 && !tight, cols = two ? Math.ceil(list.length / 2) : list.length;   // tight: one row each (last resort before a scroll)
        const g = document.createElement("div"); g.className = "fl-end-lets " + cls + (two ? " two" : "");
        g.style.setProperty("--ls", `min(calc((100cqw - 48 * var(--u,1px)) / ${cols} - 6px), calc(min(calc(46 * var(--u,1px)), 8dvh) * var(--k)))`);
        g.style.gridTemplateColumns = `repeat(${cols}, auto)`;
        for (const x of list) { const sp = document.createElement("span"); sp.textContent = x.l; sp.className = x.kind; if (x.n) sp.title = x.n + " פעמים"; g.append(sp); }
        el.append(g); };
      // the sound island (Golan 29.10): sounds, not letters: the opening sounds practised this round, then the sounds known for sure
      if (o.sounds) {
        practicedThisRound(); const counts = lastSounds;
        letRow("צלילי תחילת מילה שתורגלו", SOUND_LETTERS.filter((l) => counts[l]).map((l) => ({ l: SOUND_SYL[l], n: counts[l], kind: counts[l] >= 4 ? "p3" : counts[l] >= 2 ? "p2" : "p1" })), "fl-end-prac");
        const c = cur() ? cardsFor(cur()) : null;
        const known = c ? SOUND_LETTERS.filter((l) => c[l] && c[l].sound && c[l].sound.state === "known") : [];
        letRow("צלילים שזוהו בביטחון בכל התרגולים", known.map((l) => ({ l: SOUND_SYL[l], kind: "kn" })), "fl-end-known");
      } else if (Array.isArray(o.letters)) letRow("", o.letters.map((x) => (typeof x === "string" ? { l: x, kind: "full" } : x)), "");
      else if (o.letters !== false) {
        const counts = o.practiced || practicedThisRound();
        const order = [...FL.LETTERS, ...FL.FINALS].filter((l) => counts[l]);
        letRow("האותיות שתורגלו", order.map((l) => ({ l, n: counts[l], kind: counts[l] >= 4 ? "p3" : counts[l] >= 2 ? "p2" : "p1" })), "fl-end-prac");
        const c = cur() ? cardsFor(cur()) : null;
        const known = c ? [...FL.LETTERS, ...FL.FINALS].filter((l) => c[l] && c[l].state === "known") : [];
        letRow("אותיות שזוהו בביטחון בכל התרגולים", known.map((l) => ({ l, kind: "kn" })), "fl-end-known");
      }
      if (o.note) { const n = document.createElement("p"); n.className = "fl-end-note"; n.textContent = o.note; el.append(n); }
      for (const x of [].concat(o.extra || [])) if (x) el.append(x);
      const bs = [...(o.buttons || [{ text: "עוד סיבוב", primary: true }])];
      // "המשך למשחק הבא" (Golan 29.10, every game): the system picks the next game; o.next === false hides it
      if (o.next !== false && HUB_URL && cur()) bs.push({ id: "flNext", text: "המשך למשחק הבא", primary: true, next: true, onClick: () => { try { if (clipNow) clipNow.pause(); } catch (e) {} goNextGame(); } });
      if (bs.length) { const row = document.createElement("div"); row.className = "fl-end-btns";
        // Golan 22.10 (all games): "חזור" with a door on the right, "עוד סיבוב" green with a speaker on the left, both the same size and shape
        // (was 17.10: "עוד סיבוב" right, "לסיים" left). Games still pass "לסיים": it shows as "חזור".
        // the same button elements survive every set() (Golan 17.10: a game that added its own listener to #again lost it on redraw)
        for (const b of [...bs].sort((x, y) => (x.primary ? 1 : 0) + (x.next ? 1 : 0) - (y.primary ? 1 : 0) - (y.next ? 1 : 0))) { const key = b.id || b.text;
          const ghost = b.ghost || b.primary === false, label = b.text === "לסיים" ? "חזור" : b.text;
          const btn = btnEls.get(key) || document.createElement("button"); btnEls.set(key, btn); btn.type = "button"; btn.className = "fl-end-btn" + (ghost ? " ghost" : ""); btn.textContent = "";
          if (ghost && label === "חזור") btn.insertAdjacentHTML("beforeend", END_DOOR);
          if (b.next) { const t = document.createElement("span"); t.className = "fl-end-2l"; t.innerHTML = "<span>הַמְשֵׁךְ</span><span>לַמִּשְׂחָק הַבָּא</span>".replace(/[\u0591-\u05C7]/g, ""); btn.append(t); } else btn.append(label);
          if (!ghost && label === "עוד סיבוב") { const sp = document.createElement("span"); sp.className = "fl-end-spk"; sp.setAttribute("role", "button"); sp.setAttribute("aria-label", "הקשבה"); sp.textContent = "🔊";
            sp.onclick = (e) => { e.stopPropagation(); sayClip("btn_again"); }; btn.append(sp); }   // Hila reads "עוֹד סִבוּב" (btn_again; silent until the clip exists)
          if (b.next) { btn.classList.add("fl-end-next"); const sp = document.createElement("span"); sp.className = "fl-end-spk"; sp.setAttribute("role", "button"); sp.setAttribute("aria-label", "הקשבה"); sp.textContent = "🔊";
            sp.onclick = (e) => { e.stopPropagation(); sayClip("btn_next"); }; btn.append(sp); }   // "הַמְשֵׁךְ לַמִּשְׂחָק הַבָּא" (btn_next; silent until the clip exists)
          if (b.id) btn.id = b.id; btn.hidden = !!b.hidden || label === "חזור"; btn.onclick = b.onClick || null; row.append(btn); }   // no "חזור" (Golan 23.10, all games): the door at the top leaves
        el.append(row); }
      fit();
    };
    // never scroll: shrink stars, letters, gaps and fonts together until it fits (down to 45%)
    const fit = () => { let k = 1; el.style.setProperty("--k", k);
      // the host's content box is the limit (it may pad for the door / gear column); the viewport rule stays as a fallback
      const hs = getComputedStyle(host), hh = host.clientHeight - parseFloat(hs.paddingTop) - parseFloat(hs.paddingBottom);
      el.style.maxHeight = hh > 0 ? `min(${Math.floor(hh)}px, calc(100dvh - var(--edge-t,0px) - var(--edge-b,0px) - 16px))` : "";
      // a letter row split in two stops shrinking at 0.6: then each letter row goes to one line (a phone on its side with a
      // question + two long letter rows, 17.10) and the shrinking goes on down to 0.4
      const floor = !tight && el.querySelector(".fl-end-lets.two") ? 0.6 : 0.4;
      for (let i = 0; i < 14 && el.scrollHeight > el.clientHeight + 1 && k > floor; i++) { k *= 0.9; el.style.setProperty("--k", k.toFixed(3)); }
      if (floor > 0.4 && el.scrollHeight > el.clientHeight + 1) { tight = true; el.classList.add("fl-tight"); draw(); } };
    let seen = "";
    const onR = (force) => { if (!el.isConnected || el.offsetParent === null) return;
      const sz = host.clientWidth + "x" + host.clientHeight; if (force !== true && sz === seen) return; seen = sz;   // only a real change (no loop with a host that grows with us)
      if (tight) { tight = false; el.classList.remove("fl-tight"); draw(); } else fit(); };
    window.addEventListener("resize", () => onR());
    // fit again once the fonts are in and whenever the host changes size or is shown (a game may set() while it is hidden)
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => onR(true));
    if (window.ResizeObserver) new ResizeObserver(() => onR()).observe(host);
    const api = { el, set: (n) => { o = { ...o, ...n }; tight = false; el.classList.remove("fl-tight"); draw(); return api; }, fit };
    return api.set(opt);
  }
  // ---------- one visit to a game (Golan 16.10: the detective's flow, the same in every game) ----------
  // 1) a letter found 3 times in a row with no mistake and no hint (counted over the visit) comes back as a
  //    listening item (speaker only, no letter shown), one item later, never right after; once per letter per visit;
  // 2) a perfect listening item -> record({audioOnly, perfect}) makes it known (see step());
  // 3) a letter that becomes known during the visit is not asked again in this visit;
  // 4) never the same letter twice in a row, also across rounds.
  // const v = FL.learner.visit("detective");
  // const q = v.next({ suggest: () => FL.learner.nextLetter({...}), pool });  -> { letter, listen }
  // ... after the item: FL.learner.record({..., audioOnly: q.listen, perfect }); v.result(q.letter, { perfect, listen: q.listen, count })
  //   count = how many correct finds this item held (detective: the clouds of one sky; default 1)
  const visits = {};
  function visit(game, { listen: canListen = true } = {}) {
    if (visits[game]) return visits[game];
    const streak = {}, knownNow = new Set(), listened = new Set();
    let pending = null, item = 0, last = null;
    const out = (l) => knownNow.has(l) || knownNow.has(FL.FINAL_BASE[l] || l);
    const v = {
      next({ suggest, pool } = {}) {
        if (pending && item >= pending.due && pending.letter !== last && !out(pending.letter) && !(pool && pool.length && !pool.includes(pending.letter))) { const l = pending.letter; pending = null; last = l; return { letter: l, listen: true }; }
        let l = null; const own = pool && pool.length ? pool : null;   // a parent's choice is never left (16.10)
        for (let i = 0; i < 8 && suggest; i++) { l = suggest(); if (l && l !== last && !out(l) && (!own || own.includes(l))) break; l = null; }
        if (!l) { const base = (own || autoLetters()).filter((x) => x !== last && !out(x));
          // the whole choice known this visit: its letters come back (no repeat with 2+, a 1-letter choice repeats)
          const any = base.length ? base : own ? (own.length > 1 ? own.filter((x) => x !== last) : own.slice()) : FL.LETTERS.filter((x) => x !== last && !out(x));
          l = any.length ? any[Math.floor(Math.random() * any.length)] : (suggest && suggest()) || FL.LETTERS[0]; }
        last = l; return { letter: l, listen: false };
      },
      result(letter, { perfect = false, listen = false, count = 1 } = {}) {
        item++;
        if (listen) { streak[letter] = 0; if (pending && pending.letter === letter) pending = null; }
        else { streak[letter] = perfect ? (streak[letter] || 0) + count : 0;
          if (canListen && streak[letter] >= 3 && !listened.has(letter) && !pending && !out(letter)) { pending = { letter, due: item + 1 }; listened.add(letter); } }
        try { const k = cardsFor(cur())[letter]; if (k && k.recognize.state === "known") { knownNow.add(letter); if (pending && pending.letter === letter) pending = null; } } catch (e) {}
      },
      isOut: out, wantsListen: (l) => !!(pending && pending.letter === l), last: () => last,
      setLast: (l) => { last = l; }, pending: () => (pending ? { ...pending } : null), knownThisVisit: () => [...knownNow],
    };
    return (visits[game] = v);
  }
  // ---------- hourglass (Golan 18.10): one game runs on until the golden sand has run out; then the move going on ends the round ----------
  // const hg = FL.learner.hourglass({ paused: () => bool, onEnd: () => {} }); hg.start(); hg.done(); hg.stop(); hg.left() (ms)
  // It sits on the right under the star pill ([data-fl-stars]). Golan 18.10: 15% bigger and 10% wider again than the first one. Minutes by the child's level 1 / 2 / 3: 1.5 / 2 / 2.5 (Golan 18.10).
  // For tests: localStorage "fl-hourglass-ms" sets the length in ms.
  function playMs() {
    try { const t = +localStorage.getItem("fl-hourglass-ms"); if (t > 0) return t; } catch (e) {}
    // Golan 18.10: by the child's level (the age sets the level at first; once the level changes the age no longer counts)
    const p = cur(), lv = p ? effLevel(p) : 2; return (lv <= 1 ? 1.5 : lv === 2 ? 2 : 2.5) * 60000;
  }
  let hgOne = null;
  function hourglass(opt = {}) {
    if (hgOne) { hgOne.opt = opt; return hgOne; }
    if (!document.getElementById("fl-hg-css")) {
      const st = document.createElement("style"); st.id = "fl-hg-css";
      st.textContent = `.fl-hg{position:fixed;z-index:30;pointer-events:none;width:calc(var(--fl-hg,46px)*1.012);height:calc(var(--fl-hg,46px)*1.725);filter:drop-shadow(0 3px 4px #0004);transition:opacity .4s}
.fl-hg[hidden]{display:none}.fl-hg svg{width:100%;height:100%;overflow:visible}
.fl-hg.fl-hg-end{animation:fl-hg-glow 1.2s ease-in-out 2}
@keyframes fl-hg-glow{0%,100%{filter:drop-shadow(0 3px 4px #0004)}50%{filter:drop-shadow(0 0 14px #ffd54f) drop-shadow(0 0 4px #fff)}}
@media (prefers-reduced-motion:reduce){.fl-hg.fl-hg-end{animation:none}}`;
      (document.head || document.documentElement).appendChild(st);
    }
    const el = document.createElement("div"); el.className = "fl-hg"; el.hidden = true; el.setAttribute("aria-hidden", "true");
    // glass bulbs: top y 10..58, bottom 62..110 (x 8..56), neck at y 60; brass caps; gold sand with a light stripe; a thin falling stream with sparkles
    el.innerHTML = `<svg viewBox="0 0 64 120" preserveAspectRatio="none"><defs>
<linearGradient id="flhgBrass" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#FFE58A"/><stop offset=".45" stop-color="#E0A526"/><stop offset="1" stop-color="#8C5A12"/></linearGradient>
<linearGradient id="flhgPost" x1="0" x2="1"><stop offset="0" stop-color="#8C5A12"/><stop offset=".5" stop-color="#F6CF5A"/><stop offset="1" stop-color="#8C5A12"/></linearGradient>
<linearGradient id="flhgSand" x1="0" x2="1"><stop offset="0" stop-color="#E89A00"/><stop offset=".35" stop-color="#FFD54F"/><stop offset=".55" stop-color="#FFF3B0"/><stop offset=".75" stop-color="#FFC21A"/><stop offset="1" stop-color="#D98200"/></linearGradient>
<linearGradient id="flhgGlass" x1="0" x2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset=".3" stop-color="#dff4ff" stop-opacity=".18"/><stop offset=".8" stop-color="#dff4ff" stop-opacity=".12"/><stop offset="1" stop-color="#ffffff" stop-opacity=".4"/></linearGradient>
<clipPath id="flhgTop"><path d="M10 10 H54 C54 34 36 46 33.5 58 H30.5 C28 46 10 34 10 10 Z"/></clipPath>
<clipPath id="flhgBot"><path d="M30.5 62 H33.5 C36 74 54 86 54 110 H10 C10 86 28 74 30.5 62 Z"/></clipPath></defs>
<rect x="8" y="10" width="4" height="100" rx="2" fill="url(#flhgPost)"/><rect x="52" y="10" width="4" height="100" rx="2" fill="url(#flhgPost)"/>
<path d="M10 10 H54 C54 34 36 46 33.5 58 L33.5 62 C36 74 54 86 54 110 H10 C10 86 28 74 30.5 62 L30.5 58 C28 46 10 34 10 10 Z" fill="#cfefff" fill-opacity=".35" stroke="#ffffff" stroke-opacity=".9" stroke-width="1.6"/>
<g clip-path="url(#flhgTop)"><rect class="t" x="8" y="20" width="48" height="40" fill="url(#flhgSand)"/></g>
<g clip-path="url(#flhgBot)"><path class="b" d="M8 110 L8 110 Q32 110 56 110 Z" fill="url(#flhgSand)"/></g>
<rect class="s" x="31.2" y="57" width="1.6" height="52" rx=".8" fill="#FFD54F"/>
<g class="sp" fill="#FFF8D0"><circle r="1.1" cx="32" cy="70"/><circle r=".9" cx="31.4" cy="84"/><circle r="1" cx="32.6" cy="96"/></g>
<path d="M10 10 H54 C54 34 36 46 33.5 58 L33.5 62 C36 74 54 86 54 110 H10 C10 86 28 74 30.5 62 L30.5 58 C28 46 10 34 10 10 Z" fill="url(#flhgGlass)"/>
<path d="M15 16 C15 30 22 40 27 48" stroke="#fff" stroke-opacity=".8" stroke-width="2" fill="none" stroke-linecap="round"/>
<path d="M15 104 C15 92 20 84 26 76" stroke="#fff" stroke-opacity=".6" stroke-width="2" fill="none" stroke-linecap="round"/>
<rect x="2" y="2" width="60" height="9" rx="4.5" fill="url(#flhgBrass)" stroke="#6b4310" stroke-width="1"/>
<rect x="2" y="109" width="60" height="9" rx="4.5" fill="url(#flhgBrass)" stroke="#6b4310" stroke-width="1"/>
<circle cx="8" cy="6.5" r="2" fill="#FFF3B0"/><circle cx="56" cy="6.5" r="2" fill="#FFF3B0"/><circle cx="8" cy="113.5" r="2" fill="#FFF3B0"/><circle cx="56" cy="113.5" r="2" fill="#FFF3B0"/></svg>`;
    (document.body || document.documentElement).appendChild(el);
    const T = el.querySelector(".t"), B = el.querySelector(".b"), S = el.querySelector(".s"), SP = el.querySelectorAll(".sp circle");
    const hg = { opt, el, total: 0, used: 0, running: false, ended: false };
    let last = 0, raf = 0;
    const place = () => {   // under the star pill, its right edges lined up; size from the pill's height
      const pill = document.querySelector("[data-fl-stars]");
      if (!pill || !pill.offsetParent) { el.style.top = "64px"; el.style.right = "12px"; return; }
      const r = pill.getBoundingClientRect(), h = Math.max(40, Math.min(80, r.height * 1.35));
      el.style.setProperty("--fl-hg", h + "px");
      el.style.top = (r.bottom + 8) + "px"; el.style.right = Math.max(4, window.innerWidth - r.right) + "px";
    };
    const draw = (k, t) => {   // k = part of the sand already down (0..1)
      const top = 58 - 34 * Math.sqrt(1 - k);   // the top bulb narrows, so the level drops faster near the end
      T.setAttribute("y", (1 - k) > 0.002 ? top.toFixed(2) : 70);
      const h = 34 * Math.sqrt(k), y = 110 - h, peak = y - Math.min(6, 30 * k);   // a heap with a peak in the middle
      B.setAttribute("d", k <= 0.002 ? "M8 110 Z" : `M8 110 L8 ${(y + 3).toFixed(2)} Q32 ${(peak - 2).toFixed(2)} 56 ${(y + 3).toFixed(2)} L56 110 Z`);
      const flowing = hg.running && !hg.ended && k < 0.999;
      S.setAttribute("height", flowing ? Math.max(0, peak - 57).toFixed(2) : 0);
      SP.forEach((c, i) => { const ph = ((t / 700) + i / 3) % 1, yy = 60 + ph * Math.max(0, peak - 62); c.setAttribute("cy", yy.toFixed(2)); c.setAttribute("opacity", flowing ? (0.9 - 0.6 * ph).toFixed(2) : 0); });
    };
    const tick = (t) => {
      raf = 0; if (!hg.running) return;
      const dt = last ? Math.min(250, t - last) : 0; last = t;
      let paused = false; try { paused = !!(hg.opt.paused && hg.opt.paused()) || document.hidden; } catch (e) {}
      if (!paused && !hg.ended) hg.used += dt;
      const k = Math.min(1, hg.used / hg.total);
      place(); draw(k, t);
      if (k >= 1 && !hg.ended) { hg.ended = true; el.classList.add("fl-hg-end"); draw(1, t); try { hg.opt.onEnd && hg.opt.onEnd(); } catch (e) {} }
      raf = requestAnimationFrame(tick);
    };
    hg.start = (ms) => { endFlyReset(); hg.total = ms || playMs(); hg.used = 0; hg.ended = false; hg.running = true; last = 0; el.classList.remove("fl-hg-end"); el.hidden = false; place(); draw(0, 0); if (!raf) raf = requestAnimationFrame(tick); return hg; };
    hg.stop = () => { hg.running = false; el.hidden = true; if (raf) cancelAnimationFrame(raf); raf = 0; };
    hg.done = () => hg.ended;
    hg.left = () => Math.max(0, hg.total - hg.used);
    hg.show = (on) => { el.hidden = !on; };
    return (hgOne = hg);
  }
  // ---------- end of a round: "everything flies up" (Golan 29.10, summaries/end-transition-spec.md) ----------
  // await FL.learner.endFly({ scene, dom: [els], paused: () => bool, mute: bool }) before the end window, in every game.
  // Each piece (the Babylon scene's top nodes, the HUD pieces, the star counter, the hourglass, opt.dom) lets go in turn over
  // the first 1.5 s and rises faster and faster, swaying a little, until it is off the screen; after 5 s a clean sky is left.
  // The door and the gear stay and work; every other touch is swallowed (no skipping). A soft wordless wind plays meanwhile.
  // The pieces stay away behind the end window; the next round's hourglass.start() (or endFlyReset()) brings them back.
  const FLY_MS = 5000;
  let flyNow = null;
  function endFlyReset() {
    const f = flyNow; flyNow = null; if (!f) return;
    f.stop();
    f.doms.forEach((d) => { d.el.style.translate = d.tr; d.el.style.rotate = d.ro; d.el.style.opacity = d.op; });
    if (f.sky) f.sky.remove();
  }
  function flyWind(mute) {
    if (mute) return () => {};
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return () => {};
      const ac = flyWind.ac || (flyWind.ac = new AC()); if (ac.state === "suspended") ac.resume();
      const n = ac.sampleRate * 2, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
      let b = 0; for (let i = 0; i < n; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 3; }   // soft brown-ish noise
      const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
      const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 500; bp.Q.value = 0.8;
      const g = ac.createGain(), t = ac.currentTime; g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.16, t + 1.2); g.gain.linearRampToValueAtTime(0.12, t + 3.6); g.gain.linearRampToValueAtTime(0, t + FLY_MS / 1000);
      bp.frequency.setValueAtTime(380, t); bp.frequency.linearRampToValueAtTime(900, t + FLY_MS / 1000);   // the wind rises with them
      src.connect(bp); bp.connect(g); g.connect(ac.destination); src.start();
      return () => { try { g.gain.cancelScheduledValues(ac.currentTime); g.gain.setTargetAtTime(0, ac.currentTime, 0.08); src.stop(ac.currentTime + 0.4); } catch (e) {} };
    } catch (e) { return () => {}; }
  }
  function endFly(opt = {}) {
    endFlyReset();
    const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    // the 3-2-1 box stays home too: it is empty now, and a flown box showed the next round's countdown at the top of the screen (Golan 29.10)
    const keep = (el) => /^(door|gear|pause|count)/i.test(el.id || "") || el.classList.contains("gear") || el.classList.contains("door-btn") || el.classList.contains("count");
    const shown = (el) => el && el.isConnected && !el.hidden && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
    const hud = document.getElementById("hud");
    const els = new Set([...(hud && shown(hud) ? hud.children : []), ...document.querySelectorAll("[data-fl-stars], .fl-hg, #flRestart"), ...(opt.dom || [])]);
    const W = innerWidth, H = innerHeight;
    // DOM pieces: the separate translate / rotate properties, so the game's own transform is kept
    const doms = [...els].filter((el) => el && shown(el) && !keep(el)).map((el) => {
      const r = el.getBoundingClientRect();
      return { el, tr: el.style.translate, ro: el.style.rotate, op: el.style.opacity, x: r.left + r.width / 2, rise: r.bottom + H * 0.15, big: r.width * r.height > W * H * 0.5 };
    });
    // Babylon pieces: the scene's top nodes, moved up in world units (one screen high at their depth) just for each drawing
    const nodes = [], sc = opt.scene, cam = sc && sc.activeCamera;
    if (sc && cam && window.BABYLON) {
      const B = BABYLON, eng = sc.getEngine(), vh = eng.getRenderHeight() || H, vw = eng.getRenderWidth() || W;
      const ortho = cam.mode === B.Camera.ORTHOGRAPHIC_CAMERA;
      const prj = (v) => B.Vector3.Project(v, B.Matrix.Identity(), sc.getTransformMatrix(), cam.viewport.toGlobal(vw, vh));
      const heightAt = (p) => {   // one screen high, in world units, at this depth
        if (ortho) return Math.abs((cam.orthoTop != null ? cam.orthoTop : 1) - (cam.orthoBottom != null ? cam.orthoBottom : -1)) || 1;
        const dist = Math.max(0.5, B.Vector3.Dot(p.subtract(cam.globalPosition || cam.position), cam.getDirection(B.Axis.Z)));
        const t = Math.tan((cam.fov || 0.8) / 2); return 2 * dist * (cam.fovMode === B.Camera.FOVMODE_HORIZONTAL_FIXED ? t * vh / vw : t);
      };
      const usable = (n) => !(n instanceof B.Camera || n instanceof B.Light) && n.position && !(n.isEnabled && !n.isEnabled()) && !(opt.skip && opt.skip(n));
      const take = (n, depth) => {
        if (!usable(n)) return;
        const own = n instanceof B.AbstractMesh && n.isVisible ? [n] : [];
        const ms = own.concat(n.getChildMeshes ? n.getChildMeshes(false) : []).filter((m) => m.isVisible && m.isEnabled());
        if (!ms.length) return;
        // its box in the world: its place on the screen (the order of letting go) and its size
        let mn = null, mx = null;
        ms.forEach((m) => { const bb = m.getBoundingInfo && m.getBoundingInfo().boundingBox; if (!bb) return; mn = mn ? B.Vector3.Minimize(mn, bb.minimumWorld) : bb.minimumWorld.clone(); mx = mx ? B.Vector3.Maximize(mx, bb.maximumWorld) : bb.maximumWorld.clone(); });
        if (!mn) return;
        const c = mn.add(mx).scale(0.5), worldH = heightAt(c), sizeH = mx.y - mn.y;
        let x = W / 2;
        try {
          x = prj(c).x * (W / vw);
          // a piece wholly under (or over) the screen stays where it is: rising, it would only come into sight
          const top = prj(new B.Vector3(c.x, mx.y, c.z)).y, bot = prj(new B.Vector3(c.x, mn.y, c.z)).y;
          if (Math.min(top, bot) > vh || Math.max(top, bot) < 0) return;
        } catch (e) {}
        const big = mx.x - mn.x > worldH * 2.5 || sizeH > worldH * 0.9;
        const kids = n.getChildren ? n.getChildren() : [];
        // a very big piece (a whole island, the land, a world that holds everything): its parts fly on their own, its own ground fades
        if (big && depth < 4 && kids.length) {
          if (own.length) nodes.push({ n, ms: own, x, rise: 0, big: true, fade: true, up: null });
          kids.forEach((k) => take(k, depth + 1)); return;
        }
        // "up" in the parent's own units, so a piece inside a turned or scaled group still rises straight up
        let up = null;
        if (n.parent && n.parent.getWorldMatrix) { const inv = n.parent.getWorldMatrix().clone(); inv.invert(); up = B.Vector3.TransformNormal(new B.Vector3(0, 1, 0), inv); }
        nodes.push({ n, ms, x, rise: worldH * 1.25 + sizeH, big, up, rot0: n.rotationQuaternion || n.parent ? null : n.rotation.z });
      };
      sc.rootNodes.slice().forEach((n) => take(n, 0));
    }
    // the order of letting go: shuffled a little, the first 1.5 s
    const all = doms.concat(nodes); all.forEach((it) => { it.k = Math.random(); }); all.sort((a, b) => a.k - b.k);
    all.forEach((it, i) => { it.st = all.length > 1 ? (i / (all.length - 1)) * 1500 : 0; it.ph = Math.random() * 6; });
    const sky = document.createElement("div");   // the clean sky that is left (as before the 3-2-1)
    sky.style.cssText = "position:fixed;inset:0;background:var(--sky,#bfe6ff);opacity:0;pointer-events:none;transition:none";
    const hudEl = document.getElementById("hud");   // just above the game's drawing, under the HUD, the door, the gear and the end window
    if (hudEl && hudEl.parentNode) hudEl.parentNode.insertBefore(sky, hudEl); else (document.body || document.documentElement).appendChild(sky);
    let used = 0, last = 0, raf = 0, done = false, ok;
    const flying = (it) => { const q = Math.max(0, Math.min(1, (used - it.st) / 3000)); return { q, e: q * q, sway: Math.sin(q * 6 + it.ph), rot: Math.sin(q * 5 + it.ph) * 0.15 }; };
    const before = sc ? sc.onBeforeRenderObservable.add(() => {
      for (const it of nodes) {
        const f = flying(it); it.dy = it.big ? 0 : f.e * it.rise;
        if (it.up) it.n.position.addInPlace(it.up.scale(it.dy)); else it.n.position.y += it.dy;
        if (!it.big && it.rot0 != null) it.n.rotation.z = it.rot0 + f.rot;
        if (it.big || reduce) { it.vis = it.ms.map((m) => m.visibility); const a = Math.max(0, 1 - (reduce ? used / 1500 : (used - it.st) / 2000)); it.ms.forEach((m) => { m.visibility *= a; }); }
      }
    }) : null;
    const after = sc ? sc.onAfterRenderObservable.add(() => {
      for (const it of nodes) { if (it.up) it.n.position.subtractInPlace(it.up.scale(it.dy || 0)); else it.n.position.y -= it.dy || 0; it.dy = 0; if (it.rot0 != null) it.n.rotation.z = it.rot0; if (it.vis) { it.ms.forEach((m, j) => { m.visibility = it.vis[j]; }); it.vis = null; } }
    }) : null;
    // touches during the flight do nothing, except on the door and the gear (and the settings window they open)
    const allow = (t) => t && t.closest && t.closest('[id^="door"], #gear, .gear, #pause, #settings, .fl-ov, .fl-set, dialog');
    const swallow = (e) => { if (!allow(e.target)) { e.stopPropagation(); if (e.cancelable && e.type !== "pointermove") e.preventDefault(); } };
    const EV = ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "touchstart", "touchend", "keydown", "wheel"];
    EV.forEach((t) => window.addEventListener(t, swallow, { capture: true, passive: false }));
    const isPaused = () => { try { return document.hidden || !!(opt.paused && opt.paused()) || !!document.querySelector("#settings:not([hidden])"); } catch (e) { return false; } };
    const wind = flyWind(opt.mute);
    const stopAll = () => { if (raf) cancelAnimationFrame(raf); raf = 0; EV.forEach((t) => window.removeEventListener(t, swallow, { capture: true })); wind(); };
    const tick = (t) => {
      raf = 0; const dt = last ? Math.min(100, t - last) : 0; last = t;
      if (!isPaused()) used += dt;
      for (const it of doms) {
        const f = flying(it);
        if (reduce || it.big) { it.el.style.opacity = String(Math.max(0, 1 - (reduce ? used / 1500 : (used - it.st) / 2000))); continue; }
        it.el.style.translate = `${(f.sway * W * 0.01).toFixed(1)}px ${(-f.e * it.rise).toFixed(1)}px`; it.el.style.rotate = `${(f.rot * 57.3).toFixed(1)}deg`;
      }
      sky.style.opacity = String(Math.max(0, Math.min(1, (used - 3800) / 900)));   // whatever is left (land too big to leave) is under a clean sky
      if (used >= FLY_MS) { done = true; stopAll(); ok && ok(); return; }
      raf = requestAnimationFrame(tick);
    };
    flyNow = { doms, sky, stop: () => { stopAll(); if (before) sc.onBeforeRenderObservable.remove(before); if (after) sc.onAfterRenderObservable.remove(after); if (!done) { done = true; ok && ok(false); } } };
    return new Promise((res) => { ok = (v) => { ok = null; res(v !== false); }; raf = requestAnimationFrame(tick); });
  }
  // Letters to practise (for the parent's "recommended" button in the letter picker).
  function recommended(mode) { const c = cardsFor(cur()); return FL.LETTERS.filter((l) => c[l] && ["hard", "learning", "almost"].includes(stateIn(c[l], mode).state)); }

  // Cursive (כתב יד), Golan 24.10: a letter's cursive form opens only once the letter is "מזהה בביטחון" in print; from then its
  // cursive recognition is measured on its own (mode "cursive", same states and rules as print). In the automatic mix the
  // cursive form shows about 1 time in 4 at first and more as the child learns it, up to about half.
  function cursiveReady(l) { try { return cardsFor(cur())[l].recognize.state === "known"; } catch (e) { return false; } }
  function cursiveShare(l) {
    if (!cursiveReady(l)) return 0;
    const st = cardsFor(cur())[l].cursive.state;
    return st === "known" ? 0.5 : st === "almost" ? 0.4 : st === "new" ? 0.25 : 0.32;
  }
  // ---------- moving progress between devices (Golan 29.10: a file; all the children; merged, nothing is lost) ----------
  // The file holds the learner store and every other "fl-" setting of this browser. Opening it on another device merges:
  // a child with the same id or the same name becomes one child (all practice from both devices, sessions counted again
  // by time); a new child is added. Per-child settings follow the device the child played on last.
  const SKIP_KEYS = new Set([KEY, "fl-alive", "fl-hub-url", "fl-hourglass-ms"]);
  function exportAll() {
    load(); const other = {};
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith("fl-") && !SKIP_KEYS.has(k)) other[k] = localStorage.getItem(k); } } catch (e) {}
    return { app: "FirstLearning", kind: "progress", v: 1, at: Date.now(), learner: db, other };
  }
  function importAll(file) {
    if (!file || file.app !== "FirstLearning" || file.kind !== "progress" || !file.learner || !file.learner.profiles) throw new Error("not a progress file");
    const ids = {}, added = [], merged = [];
    mutate(() => {
      const plain = (n) => stripNikud(cleanName(n || "")).replace(/\s+/g, " ").trim();
      for (const ip0 of Object.values(file.learner.profiles)) {
        const ip = JSON.parse(JSON.stringify(ip0));
        const lp = db.profiles[ip.id] || Object.values(db.profiles).find((q) => plain(q.name) === plain(ip.name) && (!q.gender || !ip.gender || q.gender === ip.gender));
        if (!lp) {
          if (db.profiles[ip.id]) ip.id = "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
          db.profiles[ip.id] = ip; if (taken(ip.id).includes(ip.color + ":" + ip.item)) Object.assign(ip, freeCombo(ip.id));
          ids[ip0.id] = ip.id; added.push(ip.name); continue;
        }
        ids[ip0.id] = lp.id; merged.push(lp.name);
        const newer = (ip.lastAt || 0) > (lp.lastAt || 0) ? ip : lp;
        // Golan 29.10 19:53 (fix): a session is kept whole as it was on its own device ("another session" is what makes a letter
        // known), so sessions are renumbered by device and order, never merged by time. A practice in both copies keeps the
        // file's session, so opening an untouched file again repairs a device merged by the first version.
        const seen = new Set(), evs = [];
        for (const [src, list] of [["i", ip.events || []], ["l", lp.events || []]]) for (const e of list) { const k = e.t + "|" + e.l + "|" + e.g + "|" + e.m; if (!seen.has(k)) { seen.add(k); evs.push(Object.assign({}, e, { _src: src + e.s })); } }
        evs.sort((a, b) => a.t - b.t);
        const num = new Map(); for (const e of evs) { if (!num.has(e._src)) num.set(e._src, num.size + 1); e.s = num.get(e._src); delete e._src; }
        const sess = num.size;
        const rs = new Set(), rounds = [...(lp.rounds || []), ...(ip.rounds || [])].filter((r) => { const k = r.t + "|" + r.g; return rs.has(k) ? false : (rs.add(k), true); }).sort((a, b) => a.t - b.t).slice(-50);
        const keep = { id: lp.id, name: lp.name, color: lp.color, item: lp.item, created: Math.min(lp.created || Infinity, ip.created || Infinity) };
        Object.assign(lp, newer === lp ? {} : ip, keep, {
          events: evs.slice(-MAX_EVENTS), rounds, session: sess + 1,   /* a fresh number: play after the merge never joins an old session */ lastAt: Math.max(lp.lastAt || 0, ip.lastAt || 0), levelChangedSession: -1,
          motor: [...(lp.motor || []), ...(ip.motor || [])].slice(-12), gameLevels: Object.assign({}, (newer === lp ? ip : lp).gameLevels || {}, newer.gameLevels || {}),
          gender: lp.gender || ip.gender || null, birthYear: lp.birthYear || ip.birthYear || null });
      }
      if (!db.current && file.learner.current) db.current = ids[file.learner.current] || null;
    });
    // the other settings: keys named for a child follow the child; a setting this device already has stays as it is,
    // but the speed table (per child) merges
    const rename = (k) => { for (const [a, b] of Object.entries(ids)) if (a !== b && k.includes(a)) k = k.split(a).join(b); return k; };
    try {
      for (const [k0, v] of Object.entries(file.other || {})) { const k = rename(k0); if (SKIP_KEYS.has(k)) continue;
        if (k === SPEED_KEY) { let a = {}, b = {}; try { a = JSON.parse(localStorage.getItem(k) || "{}") || {}; b = JSON.parse(v || "{}") || {}; } catch (e) {}
          for (const [id, m] of Object.entries(b)) { const j = ids[id] || id; a[j] = Object.assign({}, m, a[j] || {}); }
          localStorage.setItem(k, JSON.stringify(a)); speedDb = null; continue; }
        if (/^fl-map-seen-/.test(k)) { localStorage.setItem(k, String(Math.max(+localStorage.getItem(k) || 0, +v || 0))); continue; }
        if (localStorage.getItem(k) == null) localStorage.setItem(k, v);
      }
    } catch (e) {}
    cache = null; return { added, merged };
  }
  // buttons for a settings window: "שמירת ההתקדמות לקובץ" and "פתיחת קובץ התקדמות" (the hub's parent settings)
  function transferRow(host, { onDone } = {}) {
    const box = document.createElement("div"); box.className = "fl-transfer";
    box.innerHTML = `<div class="fl-tr-title">העברת ההתקדמות למכשיר אחר</div>
      <div class="fl-tr-btns"><button type="button" class="fl-tr-save">💾 שמירת ההתקדמות לקובץ</button><button type="button" class="fl-tr-open">📂 פתיחת קובץ התקדמות</button></div>
      <div class="fl-tr-msg" aria-live="polite"></div><input type="file" accept=".json,application/json" hidden>`;
    const msg = box.querySelector(".fl-tr-msg"), inp = box.querySelector("input");
    box.querySelector(".fl-tr-save").onclick = async () => {
      const d = new Date(), name = `firstlearning-progress-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}.json`;
      const blob = new Blob([JSON.stringify(exportAll())], { type: "application/json" });
      try { const f = new File([blob], name, { type: "application/json" });   // a phone can send it on (WhatsApp, mail)
        if (navigator.canShare && navigator.canShare({ files: [f] }) && matchMedia("(pointer: coarse)").matches) { await navigator.share({ files: [f], title: name }); msg.textContent = "הקובץ נשלח."; return; } } catch (e) { if (e && e.name === "AbortError") return; }
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      msg.textContent = "הקובץ נשמר (" + name + "). שלחו אותו למכשיר השני ופתחו אותו שם בכפתור \"פתיחת קובץ התקדמות\".";
    };
    box.querySelector(".fl-tr-open").onclick = () => { inp.value = ""; inp.click(); };
    inp.onchange = () => { const f = inp.files && inp.files[0]; if (!f) return; const r = new FileReader();
      r.onload = () => { try { const res = importAll(JSON.parse(String(r.result)));
          msg.textContent = "ההתקדמות נפתחה." + (res.merged.length ? " אוחדו: " + res.merged.join(", ") + "." : "") + (res.added.length ? " נוספו: " + res.added.join(", ") + "." : "");
          if (onDone) onDone(res); } catch (e) { msg.textContent = "זה לא קובץ התקדמות של המשחק."; } };
      r.readAsText(f); };
    if (!document.getElementById("fl-tr-css")) { const st = document.createElement("style"); st.id = "fl-tr-css";
      st.textContent = `.fl-transfer{margin:14px 0 4px;padding:12px;border-radius:14px;background:#f4f8fc;text-align:center}.fl-tr-title{font-weight:800;margin-bottom:8px}
        .fl-tr-btns{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}.fl-tr-btns button{font:inherit;font-weight:700;border:2px solid #d5dde6;background:#fff;border-radius:999px;padding:8px 16px;cursor:pointer;min-height:44px}
        .fl-tr-msg{margin-top:8px;font-size:.9em;color:#3b4a5c;min-height:1em}`; document.head.append(st); }
    host.append(box); return box;
  }
  FL.learner = {
    cursiveReady, cursiveShare, soundsKnown, SOUND_SYL, SOUND_SKILL, nextGame, nextGameUrl, goNextGame, nextTier, NEXT_GAMES,
    confirmToAll, discardSince, nameAnswersSince, mathGate,
    chooseChild, companionSvg, COMP_COLORS, COMP_ITEMS, profile: () => (load(), cur()), profiles: () => (load(), Object.values(db.profiles)), newProfile, updateProfile, removeProfile, setCurrent,
    record, cards: () => cardsFor(cur()), card: (l) => cardsFor(cur())[l], reportablePairs, recommended,
    nextLetter, distractors, safeDistractors, confusable, lookAlike: looksLike, level: () => (cur() ? effLevel(cur()) : 1), levelInfo: (n) => LEVELS[n || (cur() ? effLevel(cur()) : 1)],
    gameLevel: (game) => gameLevelOf(cur(), game), autoLevel: () => (cur() ? cur().level : 1), setGameLevel,
    speed, speedPct, setSpeedPct, speedRow, refreshSpeed,
    pace: () => (cur() ? cur().pace : 1), roundEnd, setLevelFromDiagnostic, star, starSvg, starCounter, lineIds, stripNikud,
    dayInfo: () => dayInfo(), breakShown, warmup, motorMedian: () => { const p = cur(); return p ? median(p.motor || []) : null; },
    hourglass, playMs: () => playMs(), settingsForm, endFly, endFlyReset,
    // Golan 18.10 (all games): once a letter is "מוכרת" (or known), the bar beside the speaker no longer shows it; the letter is only said
    hearOnly: (l) => { try { const k = cardsFor(cur())[l]; return !!k && ["almost", "known"].includes(k.recognize.state); } catch (e) { return false; } },
    roundLength: () => { const p = (load(), cur()); return roundLengthFor(p && p.birthYear ? new Date().getFullYear() - p.birthYear : null); },
    age: () => { const p = cur(); return p && p.birthYear ? new Date().getFullYear() - p.birthYear : null; },
    renderParentTable, renderChildLetters, endPanel, letterPicker, PICKER_TITLE, setGame, autoCount: () => autoCount(cur()), setPalette, palettes: () => Object.keys(PALETTES), autoLetters, withAutoForce, autoForce: () => ({ in: [...autoForce.in], out: [...autoForce.out] }), visit, childMedianRt: (game) => (cardsFor(cur()), cache ? cache.gameMedian[game || cache.lastG] ?? null : null),
    fromHub: FROM_HUB, hubUrl: HUB_URL, markHub, exportAll, importAll, transferRow,
    sessionId: () => SESSION.sid, freshSession: () => SESSION.fresh,
    _reset: () => { db = { v: 1, current: null, profiles: {} }; save(); cache = null; },
  };
})(typeof window !== "undefined" ? window : globalThis);
