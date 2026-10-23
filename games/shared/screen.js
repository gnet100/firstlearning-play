// FL.screen: one place that fits every game to every screen (thread "סוכן מסכים ומיקומים", 16.10.2026).
// Standard: /mnt/project-files/screens/screens-standard.md. Owner: the screens thread (send change requests there).
//
// What it does, on load and on every change (rotation, window resize, browser zoom, moving to another monitor,
// iPad split view / Stage Manager, foldables):
//  1. Sets CSS variables on <html>, so the CSS never needs per-device breakpoints:
//       --u        one design pixel. The design is drawn on a 1280x720 board (720x1280 when the screen stands);
//                  1 --u = min(width/1280, height/720), kept between 0.5px and 3px.
//       --sa-t/-r/-b/-l   the safe area on each side (notch, Dynamic Island, rounded corners, home bar), in px.
//       --edge-t/-r/-b/-l the distance to keep from each edge = max(safe area, 12 design px).
//       --tap-s    the smallest secondary button (door, settings, pause: 10 mm on this device), in px.
//       --tap      the smallest main button for a child's finger (15 mm), in px.
//       --tap-play the smallest thing the child must find and touch, like a letter (20 mm), in px.
//       --gap      the smallest space between two touch targets (5 mm), in px.
//     Size rule in CSS:   width: max(calc(96 * var(--u)), var(--tap));
//     Place rule in CSS:  top: var(--edge-t); left: var(--edge-l);
//  2. Picks the 3D render resolution: devicePixelRatio capped at 2 (1 in "eco") and a pixel budget
//     (about 2.5 million pixels on phones/tablets, 4 million on computers), so a 4K screen does not draw 9x
//     more than a phone. Call FL.screen.attachEngine(engine, () => settings.quality).
//  3. Helps the 3D camera keep the important things inside the free part of the screen: FL.screen.freeRect()
//     and FL.screen.fitBox().
// Nothing here changes how a game plays. Load it before the game's own script:
//   <script src="../shared/screen.js"></script>
(function (root) {
  "use strict";
  const FL = (root.FL = root.FL || {});
  const doc = root.document, html = doc.documentElement;
  const REF_LONG = 1280, REF_SHORT = 720, U_MIN = 0.5, U_MAX = 3;
  const MM = { tapSmall: 10, tap: 15, tapPlay: 20, gap: 5 };
  const listeners = [];
  const info = { w: 0, h: 0, portrait: false, dpr: 1, cls: "pc", mmpx: 0.25, u: 1, safe: { t: 0, r: 0, b: 0, l: 0 }, edge: { t: 12, r: 12, b: 12, l: 12 } };

  // Safe area: Capacitor 8.3+ puts --safe-area-inset-* on <html> (correct on old Android WebViews); else env().
  let probe = null;
  function readSafe() {
    if (!probe) {
      probe = doc.createElement("div");
      probe.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;" +
        "padding:var(--safe-area-inset-top,env(safe-area-inset-top,0px)) var(--safe-area-inset-right,env(safe-area-inset-right,0px)) " +
        "var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)) var(--safe-area-inset-left,env(safe-area-inset-left,0px))";
      (doc.body || html).appendChild(probe);
    }
    const s = getComputedStyle(probe);
    return { t: parseFloat(s.paddingTop) || 0, r: parseFloat(s.paddingRight) || 0, b: parseFloat(s.paddingBottom) || 0, l: parseFloat(s.paddingLeft) || 0 };
  }

  // How many mm one CSS pixel is. Browsers do not tell the real screen size, so we use the device class
  // (measured values: iPhone 0.166, S24 Ultra 0.176-0.189, iPad 0.156-0.192, PC 0.23-0.28, 4K at 100% 0.156).
  function deviceClass(w, h) {
    const coarse = root.matchMedia && matchMedia("(pointer: coarse)").matches;
    const shortSide = Math.min(screen.width || w, screen.height || h);
    if (coarse) return shortSide < 600 ? { cls: "phone", mmpx: 0.17 } : { cls: "tablet", mmpx: 0.185 };
    // a computer: 4K at 100% scaling gives about 3840 CSS px across and phone-like density
    const longSide = Math.max(screen.width || w, screen.height || h);
    return { cls: "pc", mmpx: longSide >= 3000 && (root.devicePixelRatio || 1) < 1.25 ? 0.16 : 0.25 };
  }

  function measure() {
    const w = html.clientWidth || root.innerWidth, h = html.clientHeight || root.innerHeight;
    const portrait = h > w;
    const refW = portrait ? REF_SHORT : REF_LONG, refH = portrait ? REF_LONG : REF_SHORT;
    const u = Math.max(U_MIN, Math.min(U_MAX, Math.min(w / refW, h / refH)));
    const d = deviceClass(w, h), safe = readSafe();
    const e = Math.round(12 * u);
    Object.assign(info, { w, h, portrait, dpr: root.devicePixelRatio || 1, cls: d.cls, mmpx: d.mmpx, u, safe,
      edge: { t: Math.max(e, safe.t), r: Math.max(e, safe.r), b: Math.max(e, safe.b), l: Math.max(e, safe.l) } });
    const px = (mm) => Math.round(mm / info.mmpx);
    const v = { "--u": u.toFixed(4) + "px", "--tap-s": px(MM.tapSmall) + "px", "--tap": px(MM.tap) + "px", "--tap-play": px(MM.tapPlay) + "px", "--gap": px(MM.gap) + "px",
      "--sa-t": safe.t + "px", "--sa-r": safe.r + "px", "--sa-b": safe.b + "px", "--sa-l": safe.l + "px",
      "--edge-t": info.edge.t + "px", "--edge-r": info.edge.r + "px", "--edge-b": info.edge.b + "px", "--edge-l": info.edge.l + "px" };
    for (const k in v) html.style.setProperty(k, v[k]);
    html.dataset.screen = d.cls + (portrait ? " portrait" : " landscape");
    for (const f of listeners) { try { f(info); } catch (err) { console.error(err); } }
  }

  // One update per frame at most, after the browser has finished laying out the new size.
  let queued = false;
  function schedule() { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; measure(); }); }
  function watchDpr() {   // browser zoom (Ctrl +/-) or a monitor with another density
    if (!root.matchMedia) return;
    const mq = matchMedia(`(resolution: ${root.devicePixelRatio || 1}dppx)`);
    const on = () => { schedule(); watchDpr(); };
    if (mq.addEventListener) mq.addEventListener("change", on, { once: true }); else if (mq.addListener) mq.addListener(on);
  }
  function start() {
    measure();
    if (root.ResizeObserver) new ResizeObserver(schedule).observe(html);
    root.addEventListener("resize", schedule);
    root.addEventListener("orientationchange", () => setTimeout(schedule, 120));   // iOS reports the new size a little late
    if (root.visualViewport) visualViewport.addEventListener("resize", schedule);
    watchDpr();
  }

  // ---------- 3D render resolution ----------
  // quality(): "eco" | "high" (the game's own setting). High: up to 2 device pixels per CSS pixel, eco: 1.
  // The pixel budget keeps the cost about the same on every screen.
  function renderScale(quality) {
    const cap = quality === "eco" ? 1 : 2;
    const budget = quality === "eco" ? 1.2e6 : info.cls === "pc" ? 4e6 : 2.5e6;
    let s = Math.min(info.dpr, cap);
    const px = info.w * info.h * s * s;
    if (px > budget) s *= Math.sqrt(budget / px);
    return Math.max(0.5, s);
  }
  function attachEngine(engine, quality) {
    if (!info.w) measure();
    const apply = () => engine.setHardwareScalingLevel(1 / renderScale(quality ? quality() : "high"));   // also resizes
    listeners.push(apply); apply();
    return apply;   // call again when the quality setting changes
  }

  // ---------- the free part of the screen (for the 3D content) ----------
  // The screen without the safe areas and without the given HUD elements, each pushing in from its nearest edge.
  // Returns CSS pixels relative to the canvas: { left, top, right, bottom, width, height, cx, cy }.
  function freeRect(els, canvas) {
    const c = (canvas || doc.querySelector("canvas")).getBoundingClientRect();
    let L = c.left + info.safe.l, T = c.top + info.safe.t, R = c.right - info.safe.r, B = c.bottom - info.safe.b;
    for (const el of els || []) {
      if (!el || el.hidden || !el.offsetParent && getComputedStyle(el).position !== "fixed") continue;
      const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
      // push from the side the element is closest to, measured in share of the free span
      const dl = (r.left - L) / (R - L), dr = (R - r.right) / (R - L), dt = (r.top - T) / (B - T), db = (B - r.bottom) / (B - T);
      const m = Math.min(dl, dr, dt, db);
      if (m === dt) T = Math.max(T, r.bottom); else if (m === db) B = Math.min(B, r.top);
      else if (m === dl) L = Math.max(L, r.right); else R = Math.min(R, r.left);
    }
    const out = { left: L - c.left, top: T - c.top, right: R - c.left, bottom: B - c.top };
    out.width = Math.max(1, out.right - out.left); out.height = Math.max(1, out.bottom - out.top);
    out.cx = out.left + out.width / 2; out.cy = out.top + out.height / 2;
    return out;
  }

  // ---------- fit a box of the 3D world inside a screen rectangle ----------
  // box: { w, h } world units, seen face-on at distance `dist` from the camera.
  // rect: from freeRect(). canvasW/H: canvas CSS size. maxAspect: wider screens than this show more sides
  // but the box is not shrunk further (ultrawide). Returns { fov, shiftX, shiftY }: set camera.fovMode to
  // VERTICAL_FIXED and camera.fov = fov, then move the camera (and its target) by shiftX/shiftY world units
  // along its own right/up axes, so the box's centre lands in the rect's centre. Continuous: no jump at rotation.
  function fitBox(box, dist, rect, canvasW, canvasH, opts = {}) {
    const margin = opts.margin || 1.06, maxFov = opts.maxFov || 1.35;
    const aspect = canvasW / canvasH;
    const fh = rect.height / canvasH, fw = rect.width / canvasW;
    const tanV = Math.max((box.h * margin / 2) / (dist * fh), (box.w * margin / 2) / (dist * fw * Math.min(aspect, opts.maxAspect || 99)));
    const fov = Math.min(maxFov, 2 * Math.atan(tanV));
    const t = Math.tan(fov / 2) * dist;               // half the visible height, in world units, at the box
    const shiftX = -((rect.cx - canvasW / 2) / (canvasW / 2)) * t * aspect;   // move the camera the other way
    const shiftY = ((rect.cy - canvasH / 2) / (canvasH / 2)) * t;
    return { fov, shiftX, shiftY };
  }

  // mm -> CSS px on this device (for sizes computed in JS, like 3D letters: worldSize = px * perPx)
  const mmToPx = (mm) => mm / info.mmpx;

  FL.screen = { info, onChange: (f) => { if (!info.w) measure(); listeners.push(f); f(info); }, renderScale, attachEngine, freeRect, fitBox, mmToPx, refresh: measure, MM };
  // measure at once when <body> is already there (script at the end of the page), not after the big 3D script loads:
  // the start panel no longer grows and shrinks on refresh (Golan 23.10)
  if (doc.readyState === "loading" && !doc.body) doc.addEventListener("DOMContentLoaded", start); else start();
  // the start panel shows only once the screen is measured and the fonts are in (each game's CSS hides
  // html:not(.fl-ready) #start, and shows it anyway after 1.5 s), so it does not jump in size (Golan 23.10)
  // also waits for the whole page (the 3D script and the first picture of the world behind it), so the panel does not
  // first show on an empty background and then move (Golan 23.10)
  const ready = () => requestAnimationFrame(() => requestAnimationFrame(() => html.classList.add("fl-ready")));
  const loaded = new Promise((r) => (doc.readyState === "complete" ? r() : root.addEventListener("load", r, { once: true })));
  const fonts = doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve();
  Promise.race([Promise.all([loaded, fonts]), new Promise((r) => setTimeout(r, 2800))]).then(ready, ready);

  // one start window for every game (Golan 23.10: same size and same fonts everywhere), drawn on the 1280x720 board
  const std = doc.createElement("style"); std.id = "fl-start-std";
  std.textContent = `
    html[data-screen] #start > .panel { width: min(100%, max(calc(640 * var(--u)), 340px)); max-width: none; box-sizing: border-box;
      padding: max(calc(28 * var(--u)), 14px) max(calc(24 * var(--u)), 14px); border-radius: max(calc(28 * var(--u)), 18px); }
    html[data-screen] #start > .panel h1 { font-size: max(calc(44 * var(--u)), 24px); margin: 0 0 calc(8 * var(--u)); line-height: 1.3; }
    html[data-screen] #start > .panel > p { font-size: max(calc(24 * var(--u)), 17px); margin: calc(6 * var(--u)) 0 calc(18 * var(--u)); line-height: 1.35; }
    html[data-screen] #start { --h: max(calc(76 * var(--u)), var(--tap)); place-items: center; padding: var(--edge-t) var(--edge-r) var(--edge-b) var(--edge-l); }
    html[data-screen] #start #go { font-size: max(calc(36 * var(--u)), 22px); min-height: var(--h); height: var(--h); padding-block: 0; }
    html[data-screen] #start #hear { width: var(--h); min-width: var(--h); height: var(--h); min-height: 0; padding: 0; }
    html.fl-counting #count { z-index: 60; }
    html.fl-counting #count::before { content: ""; position: fixed; inset: 0; background: var(--sky, #bfe6ff); z-index: -1; }`;
  (doc.head || html).appendChild(std);

  // the 3-2-1 countdown is on the page's clean light blue, with nothing of the game behind it (Golan 23.10, all games):
  // each game's countdown() adds html.fl-counting; it goes when the count ends (the numbers box empties) or the start window is back
  function watchCount() {
    const st = doc.getElementById("start"), cnt = doc.getElementById("count");
    if (!st || !cnt) return;
    let had = false;
    new MutationObserver(() => {
      if (!st.hidden) { html.classList.remove("fl-counting"); had = false; }
    }).observe(st, { attributes: true, attributeFilter: ["hidden"] });
    new MutationObserver(() => {
      if (cnt.childElementCount) { had = true; html.classList.add("fl-counting"); }
      else if (had) { had = false; html.classList.remove("fl-counting"); }
    }).observe(cnt, { childList: true });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", watchCount); else watchCount();
})(typeof window !== "undefined" ? window : this);
