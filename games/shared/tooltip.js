// One tooltip for every screen (Golan 8.11): the small label that shows when the mouse rests on a button (the door's
// "יְצִיאָה", the gear's "הַגְדָּרוֹת", ...). Blue, white text with nikud, the same font and size everywhere.
// Any element with data-tip (or a button with title, which becomes data-tip so the browser's own grey label does not show
// too) gets it. Only on screens with a mouse (hover); touch screens never show it. Placed beside the button on the side
// that has room (right of the door and gear at the top left, left of an X at the top right).
(() => {
  "use strict";
  if (window.FL_TOOLTIP) return; window.FL_TOOLTIP = true;
  const NIKUD = { "יציאה": "יְצִיאָה", "חזרה": "חֲזָרָה", "סגירה": "סְגִירָה", "הגדרות": "הַגְדָּרוֹת", "עצירה": "עֲצִירָה", "המשך": "הֶמְשֵׁךְ",
    "שוב": "שׁוּב", "התחלה מחדש": "הַתְחָלָה מֵחָדָשׁ", "השמעה": "הַשְׁמָעָה", "עזרה": "עֶזְרָה", "הדגמה": "הַדְגָּמָה", "מחיקה": "מְחִיקָה",
    // Golan 8.11: every tooltip with nikud
    "התחל מחדש": "הַתְחֵל מֵחָדָשׁ", "הקשבה": "הַקְשָׁבָה", "הקשבה להוראות": "הַקְשָׁבָה לְהוֹרָאוֹת", "איך משחקים?": "אֵיךְ מְשַׂחֲקִים?",
    "שמיעה חוזרת": "שְׁמִיעָה חוֹזֶרֶת", "מפת הלמידה": "מַפַּת הַלְּמִידָה", "כניסה": "כְּנִיסָה", "שמאלה": "שְׂמֹאלָה", "ימינה": "יָמִינָה",
    "מהירות תנועה": "מְהִירוּת תְּנוּעָה", "ילד חדש": "יֶלֶד חָדָשׁ", "התשובה": "הַתְּשׁוּבָה", "הצליל": "הַצְּלִיל", "הדגמה חוזרת": "הַדְגָּמָה חוֹזֶרֶת" };
  // a label not in the list: if it has no nikud, the shared FL.nikud word list may know it
  const nikAny = (t) => { const k = (t || "").trim(); if (NIKUD[k]) return NIKUD[k]; if (/[\u05b0-\u05c7]/.test(k)) return k; try { if (window.FL && typeof FL.nikud === "function") return FL.nikud(k); } catch (e) {} return k; };
  const nik = (t) => nikAny(t);
  const css = document.createElement("style");
  css.textContent = `
  .fl-tip { position: fixed; z-index: 100000; pointer-events: none; opacity: 0; transition: opacity .15s ease;
    background: #2f7fd8; color: #fff; font: 700 18px/1.25 "Noto Sans Hebrew", system-ui, sans-serif; padding: 6px 12px; border-radius: 10px;
    box-shadow: 0 3px 10px #0003; white-space: nowrap; direction: rtl; }
  .fl-tip.on { opacity: 1; }
  .door-btn::after { display: none !important; content: none !important; }   /* the old dark label of each game: replaced by this one */`;
  (document.head || document.documentElement).append(css);
  if (!window.matchMedia || !matchMedia("(hover: hover)").matches) return;
  const tip = document.createElement("div"); tip.className = "fl-tip"; tip.setAttribute("aria-hidden", "true");
  let cur = null, timer = 0;
  // the round buttons (door, gear, pause, speaker...) and the X of a window: their label is the tooltip too
  const SEL = ".round-btn, .door-btn, .gear-btn";
  // Golan 8.11 08:02: the X that closes a window (settings and the other popups) has no tooltip
  const NO_TIP = ".x-close, .set-x, .x-btn, .x, [aria-label='סגירה']";
  const adopt = (el) => {
    if (!el || !el.matches || el.hasAttribute("data-tip")) return;
    if (el.matches(NO_TIP)) { el.removeAttribute("title"); return; }
    if (el.hasAttribute("title") && el.closest("button, .round-btn")) { el.setAttribute("data-tip", el.getAttribute("title")); el.removeAttribute("title"); }
    else if (el.matches(SEL) && el.getAttribute("aria-label")) el.setAttribute("data-tip", el.getAttribute("aria-label"));
  };
  const sweep = (root) => { if (root.querySelectorAll) root.querySelectorAll("button[title], .round-btn[title], " + SEL).forEach(adopt); };
  function place(el) {
    const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight, gap = 10, W = innerWidth;
    let x = r.right + gap; if (x + w > W - 6) x = r.left - gap - w;   // right of the button when there is room, else left
    if (x < 6) x = Math.max(6, Math.min(W - w - 6, r.left + r.width / 2 - w / 2));
    let y = r.top + r.height / 2 - h / 2; if (x === Math.max(6, Math.min(W - w - 6, r.left + r.width / 2 - w / 2))) y = r.bottom + gap;
    tip.style.left = Math.round(x) + "px"; tip.style.top = Math.round(Math.max(6, y)) + "px";
  }
  function show(el) {
    const t = el.getAttribute("data-tip"); if (!t) return;
    if (!tip.isConnected) document.body.append(tip);
    tip.textContent = nik(t); tip.classList.remove("on"); place(el);
    clearTimeout(timer); timer = setTimeout(() => { if (cur === el && el.isConnected && el.getClientRects().length) { place(el); tip.classList.add("on"); } }, 250);
  }
  function hide() { cur = null; clearTimeout(timer); tip.classList.remove("on"); }
  document.addEventListener("pointerover", (e) => {
    if (e.pointerType && e.pointerType !== "mouse") return;
    if (!e.target.closest) return;
    adopt(e.target.closest("[title], " + SEL)); const el0 = e.target.closest("[data-tip]"), el = el0 && !el0.matches(NO_TIP) ? el0 : null;
    if (el === cur) return; hide(); if (el && !el.disabled) { cur = el; show(el); }
  }, true);
  document.addEventListener("pointerdown", hide, true);
  addEventListener("scroll", hide, true); addEventListener("blur", hide);
  const start = () => { sweep(document); new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => n.nodeType === 1 && (adopt(n), sweep(n))))).observe(document.body, { childList: true, subtree: true }); };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
