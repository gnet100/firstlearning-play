// The heart balloon "I LOVE U" (Golan 26.10, from a child's drawing): one of the 9 shared balloons, in place of the checked one.
// uv: false = the flat picker picture, true = a sphere skin.
// Used by every game's balloon picker and 3D balloon, and by the hub sky. Globals: paintLove(ctx, W, H, d, uv), LOVE_ENV,
// loveBend(positions, rx, ry, rz) -> positions of a sphere bent into a heart (seen from the front).
// DRAFT (26.10, awaiting Golan): the "love" balloon. 3D games also need SHAPES.heart [1.08,1.08], an updatable envelope sphere bent by shapeEnvelope(heart) (see handoff.md), and a red skirt.
// "love" balloon pattern (Golan 26.10, from a child's drawing): cream envelope, hand-drawn red "I LOVE U" rows and hearts
const LOVE_GLYPHS = {   // strokes in a 0..1 box (x right, y down), drawn with a round marker
  I: [[[0.5, 0], [0.5, 1]]],
  L: [[[0.15, 0], [0.15, 1], [0.85, 1]]],
  O: "o",
  V: [[[0.05, 0], [0.5, 1], [0.95, 0]]],
  E: [[[0.85, 0], [0.15, 0], [0.15, 1], [0.85, 1]], [[0.15, 0.5], [0.7, 0.5]]],
  U: [[[0.12, 0], [0.12, 0.62], [0.2, 0.88], [0.5, 1], [0.8, 0.88], [0.88, 0.62], [0.88, 0]]],
};
function loveRand(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function loveWord(ctx, x, y, h, rnd) {   // "I LOVE U" from x (left) on the line y (top), letters h tall; returns the end x
  const w = h * 0.62, gap = h * 0.22;
  for (const ch of "I LOVE U") {
    if (ch === " ") { x += h * 0.35; continue; }
    const tilt = (rnd() - 0.5) * 0.18, dy = (rnd() - 0.5) * h * 0.12, lw = ch === "I" ? w * 0.35 : w;
    ctx.save(); ctx.translate(x + lw / 2, y + h / 2 + dy); ctx.rotate(tilt); ctx.translate(-lw / 2, -h / 2);
    const g = LOVE_GLYPHS[ch];
    if (g === "o") { ctx.beginPath(); ctx.ellipse(lw / 2, h / 2, lw / 2, h / 2, 0, 0, 7); ctx.stroke(); }
    else for (const st of g) { ctx.beginPath(); st.forEach(([px, py], k) => { const X = (ch === "I" ? 0.5 * lw : px * lw) + (rnd() - 0.5) * h * 0.04, Y = py * h; k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.stroke(); }
    ctx.restore(); x += lw + gap;
  }
  return x;
}
function loveHeart(ctx, x, y, r, fill) {
  ctx.beginPath(); ctx.moveTo(x, y + r * 0.9); ctx.bezierCurveTo(x - r * 1.4, y, x - r * 0.7, y - r * 1.1, x, y - r * 0.35); ctx.bezierCurveTo(x + r * 0.7, y - r * 1.1, x + r * 1.4, y, x, y + r * 0.9);
  if (fill) ctx.fill(); else ctx.stroke();
}
const loveWordW = (h) => { const w = h * 0.62, gap = h * 0.22; return 6 * (w + gap) + (w * 0.35 + gap) + 2 * h * 0.35 - gap; };   // "I LOVE U"
// flat: W x H front picture (the whole 100 x 134 picker box, y from -14); uv: W x H skin around the balloon (x = around, y = top to bottom)
function paintLove(ctx, W, H, d, uv) {
  // Golan's pick 28.10 (option 5 of 5): a red balloon, cream words in rows that alternate big and small, dark-red and pink hearts
  const a = "#E3262F", b = "#FFF6EF", hearts = ["#8E0F18", "#FFB3BC"], rnd = loveRand(16), boxes = [];
  ctx.fillStyle = a; ctx.fillRect(0, 0, W, H);
  ctx.save(); if (uv) { ctx.translate(W, H); ctx.scale(-1, -1); }   // the sphere skin is turned around: turn it back so the words read
  ctx.strokeStyle = b; ctx.fillStyle = b; ctx.lineCap = "round"; ctx.lineJoin = "round";
  const word = (x, y, h) => { ctx.lineWidth = h * 0.16; const e = loveWord(ctx, x, y, h, rnd); boxes.push([x - h * 0.1, y - h * 0.1, e + h * 0.1, y + h * 1.1]); return e; };
  if (uv) {
    // big, small, big, small rows; every row has one "I LOVE U" centred on the front (three quarters of the way across the skin) and the rest evenly around it
    for (const [t, k] of [[0.22, 0.17], [0.42, 0.06], [0.5, 0.12], [0.65, 0.05]]) { const h = H * k, w = loveWordW(h), n = Math.max(1, Math.floor(W / (w + h * 0.9))), step = W / n;
      for (let j = -n; j <= n; j++) { const x = W * 0.75 - w / 2 + j * step; if (x < W && x + w > 0) word(x, H * t, h); } }
  } else {
    // four rows, narrower and smaller down the heart, as in the drawing: [top, letter height, room] in the 100 x 120 box
    for (const [y, h, room] of [[6, 10, 78], [21, 10, 76], [36, 9.5, 66], [51, 8.5, 50], [65, 7, 32]]) {
      const hh = Math.min(h, h * room / loveWordW(h)) * H / 134; word(W / 2 - loveWordW(hh) / 2, (y + 14) * H / 134, hh);
    }
  }
  // hearts in the gaps, filled and outlined, never on the words
  const unit = uv ? H * 0.1 : H * 0.09, want = uv ? 120 : 14, placed = [];
  const env = uv ? null : new Path2D(LOVE_ENV), inEnv = (x, y, r) => !env || [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].every(([dx, dy]) => ctx.isPointInPath(env, (x + dx) * 100 / W, (y + dy) * 134 / H - 14));
  for (let k = 0; k < 6000 && placed.length < want; k++) {
    const r = unit * (0.18 + rnd() * 0.32), x = r + rnd() * (W - 2 * r), y = H * (uv ? 0.1 : 0.03) + rnd() * H * (uv ? 0.78 : 0.75);
    if (!inEnv(x, y, r * 1.6)) continue;
    if (boxes.some(([x0, y0, x1, y1]) => x > x0 - r && x < x1 + r && y > y0 - r && y < y1 + r)) continue;
    if (placed.some(([px, py, pr]) => Math.hypot(px - x, py - y) < (pr + r) * 1.15)) continue;
    placed.push([x, y, r]); ctx.fillStyle = ctx.strokeStyle = hearts[Math.floor(rnd() * hearts.length)]; ctx.lineWidth = unit * 0.1; loveHeart(ctx, x, y, r, rnd() < 0.7);
  }
  ctx.restore();
}
// the heart-shaped envelope for the flat picture (picker / hub sky), in the picker's 100 x 120 box with the mouth at (50, 90)
const LOVE_ENV = "M50 10C44 -4 30 -9 20 -3 8 5 9 24 16 40 24 58 37 76 41 90H59C63 76 76 58 84 40 91 24 92 5 80 -3 70 -9 56 -4 50 10z";
// A sphere (radii rx, ry, rz, centred) bent into a heart: two lobes with a dip on top, a body narrowing to the mouth.
function loveBend(base, rx, ry, rz) {
  const p = base.slice();
  for (let i = 0; i < p.length; i += 3) {
    const nx = p[i] / rx, ny = p[i + 1] / ry;
    if (ny > 0) { p[i] *= 1 + 0.22 * ny; p[i + 1] -= ry * 0.22 * Math.exp(-((nx / 0.32) ** 2)) * ny ** 2; }
    else { const k = 1 - 0.62 * (-ny) ** 1.2; p[i] *= k; p[i + 2] *= 0.55 + 0.45 * k; }
  }
  return p;
}
// bend (or un-bend) a Babylon sphere mesh made with updatable: true; base = its first positions
// where a rope aimed at (fx, fz) (fractions of the envelope radius) meets the underside: returns that height as a fraction
// of the radius (-1 = the bottom). The heart's lower half is narrower, so its ropes reach higher up (Golan 28.10).
function loveUnder(fx, fz, heart) {
  if (!heart) return -Math.sqrt(Math.max(0, 1 - fx * fx - fz * fz));
  const fits = (ny) => { const s = Math.sqrt(1 - ny * ny), k = 1 - 0.62 * (-ny) ** 1.2, kz = 0.55 + 0.45 * k; return (fx / (s * k)) ** 2 + (fz / (s * kz)) ** 2 <= 1; };
  let lo = -1, hi = 0;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (fits(m)) hi = m; else lo = m; }
  return hi;
}
function loveShape(mesh, base, heart, rx, ry, rz) {
  const p = heart ? loveBend(base, rx, ry, rz) : base.slice();
  mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, p);
  const n = []; BABYLON.VertexData.ComputeNormals(p, mesh.getIndices(), n); mesh.updateVerticesData(BABYLON.VertexBuffer.NormalKind, n);
}
// The picker picture of the heart balloon is a picture of the 3D balloon itself (Golan 26.10), love-balloon.png next to this file.
const LOVE_PIC = ((document.currentScript && document.currentScript.src) || "love-balloon.js").replace(/love-balloon\.js(\?.*)?$/, "love-balloon.png");
const LOVE_IMG = new Image(); LOVE_IMG.src = LOVE_PIC;
// the picker's <svg> (same 0 -14 100 134 box as the other balloons)
function loveSvg() { return `<svg viewBox="0 -14 100 134" aria-hidden="true"><image href="${LOVE_PIC}" x="0" y="-14" width="100" height="134" preserveAspectRatio="xMidYMax meet"/></svg>`; }
