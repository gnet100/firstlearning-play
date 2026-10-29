// The learning path (Golan 20.10): a 3D map after "מי משחק?". A balloon in the child's colour flies over sky islands;
// every island is one learning topic, in the order of "התקדמות למידה". Tap an island, or drag: the island nearest the
// balloon takes the focus and the camera comes closer to its animation. An open island opens its games; a locked one
// sits in a glass bubble (Golan 20.10: no clouds, no locks), and Hila says what it holds and that it opens later.
// Island 2 opens at 15 letters recognised with confidence; the cloud then blows away the first time the child sees it.
// Clips (voice/audio, silent until generated): map_t1..9 names, map_d2..9 contents, map_locked, map_soon, map_system.
//   FL.map.show({ host, profile, known, onOpen(i), onSystem(), say(id[, then]) })  ->  FL.map.hide()
(() => {
  "use strict";
  const FL = (window.FL = window.FL || {});
  const BJS = "https://cdn.jsdelivr.net/npm/babylonjs@9.27.1/babylon.js";
  const UNLOCK_AT = 15;   // letters recognised with confidence that open island 2 (Golan 20.10)
  // Golan 20.10: every title says "מִשְׂחֲקֵי ..." (the island holds the games of that topic)
  const STOPS = [
    { name: "מִשְׂחֲקֵי זִיהוּי אוֹתִיּוֹת", show: ["א", "ב", "ג", "ד", "ה", "ו", "ז"] },
    { name: "מִשְׂחֲקֵי זִיהוּי צְלִילִים", show: ["מ", "ס", "ש", "ר"], rings: true },
    { name: "מִשְׂחֲקֵי זִיהוּי הֲבָרוֹת", show: ["בָּ", "לִי", "נוּ"] },
    { name: "מִשְׂחֲקֵי קְרִיאַת הֲבָרוֹת עִם נִקּוּד", show: ["מָ", "לֶ", "כִּי", "דוֹ"] },
    { name: "מִשְׂחֲקֵי קְרִיאַת מִלִּים", show: ["אַבָּא", "בַּיִת", "סֵפֶר"] },
    { name: "מִשְׂחֲקֵי כְּתִיבַת אוֹתִיּוֹת וּמִלִּים", show: ["א", "ב"], pencil: true },
    { name: "מִשְׂחֲקֵי שָׂפָה וְאוֹצַר מִלִּים", show: ["שֶׁמֶשׁ", "יָם", "עֵץ"] },
    { name: "מִשְׂחֲקֵי הֲבָנַת הַנִּשְׁמָע", show: ["?", "!"], rings: true },
    { name: "מִשְׂחֲקֵי שֶׁטֶף קְרִיאָה", show: ["קוֹרְאִים", "מַהֵר"] },
  ];
  // Golan 20.10: the first island at the bottom left, the path going up and to the right and away into the distance,
  // so several islands show, each one farther and smaller
  // Golan 20.10: a standing phone has its own layout: the trail goes straight up the screen with a narrower zigzag
  let tall = innerHeight > innerWidth;
  const lay = () => (tall ? { gap: 10, dir: { x: 0.1, z: 0.995 }, w: 2.3, lat: { x: -1, z: 0 } } : { gap: 8.5, dir: { x: 0.55, z: 0.835 }, w: 4.0, lat: { x: -0.954, z: 0.299 } });
  // Golan 20.10: the zigzag goes across the screen (lat = left on screen), so an island is never straight above the one before it
  // Golan 20.10: a winding trail, the islands zigzag left and right of the way ahead so each one shows
  const far0 = (v) => (v <= 1 ? v * 0.65 : v - 0.35);   // Golan 20.10: the second island sits closer to the first
  const spot = (i) => { const L = lay(), D = L.dir, w = (i % 2 ? -1 : 1) * L.w, d = far0(i);
    return { x: d * L.gap * D.x + w * L.lat.x, y: i * 0.55, z: d * L.gap * D.z + w * L.lat.z }; };
  const mid = (v) => { const L = lay(), d = far0(v); return { x: d * L.gap * L.dir.x, z: d * L.gap * L.dir.z }; };   // the middle of the trail
  const ISLE = 0.62;   // island size (Golan 20.10: smaller)
  const BAL = { x: 0, y: 1.8, z: 0.2 };
  const BACK = 0.85, BACK_TALL = 0.4, SHIFT = 1.4;   // SHIFT: on a wide screen the view moves right a little, so the balloon's island is not at the edge   // Golan 29.10: the camera stands this much of the way behind the balloon, so the island before shows   // Golan 20.10: the balloon hangs right above the middle of the island it serves

  let host = null, opt = null, ui = null, engine = null, scene = null, cam = null, built = false, loading = null, visible = false;
  let isles = [], balloon = null, s = 0, sTo = 0, tw = null, dragTo = 0, home = 0, focus = -1, focusedAt = 0, dragging = null, zoom = 0, open = 1, seenKey = "";
  const prefersStill = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function loadBabylon() {
    if (window.BABYLON) return Promise.resolve();
    if (!loading) loading = new Promise((ok, no) => { const sc = document.createElement("script"); sc.src = BJS; sc.onload = ok; sc.onerror = no; document.head.append(sc); });
    return loading;
  }
  function css() {
    if (document.getElementById("fl-map-css")) return;
    const st = document.createElement("style"); st.id = "fl-map-css";
    st.textContent = `
      .fl-map { position: fixed; inset: 0; z-index: 50; background: linear-gradient(#8fd0ff 0%, #bfe6ff 55%, #e6f6ff 100%); touch-action: none; }
      .fl-map canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; outline: none; touch-action: none; }
      .fl-map .top { position: absolute; top: var(--e-t, 12px); left: 50%; translate: -50% 0; display: flex; align-items: center; gap: 10px;
        max-width: calc(100% - 2 * (var(--e-l, 16px) + var(--btn, 54px) + var(--g, 8px))); pointer-events: none; }
      .fl-map .pill { display: flex; align-items: center; gap: 6px; background: #ffffffee; border-radius: 999px; box-shadow: 0 4px 16px #0002;
        padding: 2px 18px 2px 8px; min-height: var(--btn, 54px); pointer-events: auto; transition: opacity .25s; }
      .fl-map .pill b { font-size: max(calc(34 * var(--u, 1px)), 22px); font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .fl-map .pill .lk { font-size: max(calc(28 * var(--u, 1px)), 20px); }
      .fl-map .go { width: calc(var(--btn, 54px) * 1.15); height: calc(var(--btn, 54px) * 1.15); border-radius: 50%; border: 0; cursor: pointer; flex: none;
        background: #2bb673; box-shadow: 0 4px 0 #1e8a55, 0 6px 16px #0003; display: grid; place-items: center; pointer-events: auto; animation: flMapGo 1.4s ease-in-out infinite; }
      .fl-map .go svg { width: 50%; height: 50%; margin-inline-start: 8%; }
      .fl-map .go:active { transform: scale(.92); }
      @keyframes flMapGo { 50% { transform: scale(1.08); } }
      /* Golan 20.10: taller, green, straight, a deeper raised edge and a shadow to the side that shows its height */
      .fl-map .sys { position: absolute; bottom: calc(var(--e-b, 12px) + 10px); left: var(--e-l, 16px); width: fit-content;   /* Golan 20.10: fixed at the bottom left */ border: 0; cursor: pointer; font: inherit;
        font-size: max(calc(24 * var(--u, 1px)), 17px); font-weight: 800; color: #fff; background: linear-gradient(#40c97f, #2bb673); border-radius: 999px;
        padding: 18px 30px; min-height: max(calc(84 * var(--u, 1px)), 64px); text-shadow: 0 2px 0 #0003;
        box-shadow: 5px 9px 0 #1a7f4b, 7px 16px 22px #0004, inset 0 2px 0 #ffffff55; transition: translate .08s, box-shadow .08s; max-width: calc(100% - 2 * var(--e-l, 16px) - 12px);
        display: flex; align-items: center; gap: 8px; text-align: center; line-height: 1.3; }
      .fl-map .sys:active { translate: 4px 7px; box-shadow: 1px 2px 0 #1a7f4b, 2px 5px 10px #0004, inset 0 2px 0 #ffffff55; }
      .fl-map .sys .spk { font-size: 1.1em; }
      .fl-map .sys .tx { display: flex; flex-direction: column; align-items: center; }
      .fl-map .sys .tx b { font-size: 1.5em; line-height: 1.1; }
      .fl-map .sys .tx small { font-size: .62em; font-weight: 700; max-width: 9em; }
      .fl-map .sys { padding: 10px 16px; min-height: 0; gap: 6px; } .fl-map .sys small { white-space: nowrap; }
      .fl-map .pill .spk { font-size: max(calc(28 * var(--u, 1px)), 22px); }
      html[data-screen~="portrait"] .fl-map .top { top: calc(var(--e-t, 12px) + 2 * var(--btn, 54px) + 2 * var(--g, 8px)); max-width: calc(100% - 2 * var(--e-l, 16px)); }
      .fl-map .wait { position: absolute; inset: 0; display: grid; place-items: center; font-size: 22px; color: #1d2a3a; }`;
    document.head.append(st);
  }
  const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5 L20 12 L6 20.5 Z" fill="#fff" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>';

  // ---------- the scene ----------
  function mat(name, hex, opts = {}) {
    const m = new BABYLON.StandardMaterial(name, scene); m.diffuseColor = BABYLON.Color3.FromHexString(hex);
    m.specularColor = new BABYLON.Color3(.12, .12, .12); if (opts.emissive) m.emissiveColor = BABYLON.Color3.FromHexString(opts.emissive);
    if (opts.alpha != null) m.alpha = opts.alpha; return m;
  }
  // text on a square plane that always faces the camera (Hebrew with nikud, in the self-hosted font)
  function textPlane(txt, size, colour) {
    const W = 256, dt = new BABYLON.DynamicTexture("t" + txt, { width: W * Math.max(1, Math.min(3, txt.replace(/[֑-ׇ]/g, "").length * 0.55)), height: W }, scene, true);
    const w = dt.getSize().width, ctx = dt.getContext(); ctx.clearRect(0, 0, w, W);
    let fs = 170; ctx.font = `800 ${fs}px "Noto Sans Hebrew", sans-serif`;
    while (ctx.measureText(txt).width > w * 0.9 && fs > 40) { fs -= 8; ctx.font = `800 ${fs}px "Noto Sans Hebrew", sans-serif`; }
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.direction = "rtl";
    ctx.lineWidth = 18; ctx.strokeStyle = "#ffffff"; ctx.lineJoin = "round"; ctx.strokeText(txt, w / 2, W * 0.54);
    ctx.fillStyle = colour; ctx.fillText(txt, w / 2, W * 0.54); dt.hasAlpha = true; dt.update();
    const m = new BABYLON.StandardMaterial("tm" + txt, scene); m.diffuseTexture = dt; m.useAlphaFromDiffuseTexture = true;
    m.emissiveColor = new BABYLON.Color3(1, 1, 1); m.disableLighting = true; m.backFaceCulling = false;
    const p = BABYLON.MeshBuilder.CreatePlane("p" + txt, { width: size * w / W, height: size }, scene); p.material = m;
    p.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL; return p;
  }
  const INK = ["#ff5a4e", "#ff8a3d", "#e6a800", "#2bb673", "#3da5ff", "#7c5cff", "#ff5a8a"];
  function island(i) {
    const P = spot(i), root = new BABYLON.TransformNode("isle" + i, scene); root.position.set(P.x, P.y, P.z); root.scaling.setAll(ISLE);
    const top = BABYLON.MeshBuilder.CreateCylinder("top" + i, { height: 0.5, diameterTop: 4.6, diameterBottom: 4.2, tessellation: 28 }, scene);
    top.material = mat("g" + i, i % 2 ? "#7bd389" : "#8fdc7a"); top.parent = root;
    const rock = BABYLON.MeshBuilder.CreateCylinder("rock" + i, { height: 2.6, diameterTop: 4.2, diameterBottom: 0.3, tessellation: 14 }, scene);
    rock.material = mat("r" + i, "#b98a5e"); rock.position.y = -1.55; rock.parent = root;
    // Golan 20.10: no flags; stones and bushes in a different pattern on every island, kept in the middle (inside the ring
    // of letters) or out at the rim, so they never stand in the letters' way
    let seed = i * 9301 + 49297; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const inner = 1 + Math.floor(rnd() * 3), outer = Math.floor(rnd() * 4);
    for (let k = 0; k < inner + outer; k++) {
      const out = k >= inner, a = rnd() * Math.PI * 2, rr = out ? 1.75 + rnd() * 0.3 : (inner === 1 ? 0 : 0.18 + rnd() * 0.15), sz = out ? 0.22 + rnd() * 0.18 : 0.2 + rnd() * 0.14;
      const stone = rnd() < 0.45, b = BABYLON.MeshBuilder.CreateSphere(stone ? "stone" : "bush", { diameter: sz * 2, segments: stone ? 5 : 8 }, scene);
      b.material = stone ? mat("sm", rnd() < 0.5 ? "#9aa1a8" : "#a88f74") : mat("bm", rnd() < 0.5 ? "#4caf50" : "#5cbf5a");
      if (stone) { b.scaling.y = 0.6; b.rotation.y = rnd() * 3; }
      b.position.set(Math.cos(a) * rr, 0.25 + sz * (stone ? 0.4 : 0.6), Math.sin(a) * rr); b.parent = root; }
    // the topic's animation: its letters / syllables / words circling above the island
    const show = new BABYLON.TransformNode("show" + i, scene); show.parent = root; show.position.y = 0.75;   /* Golan 20.10: the letters close to the ground, circling inside the island */
    const items = STOPS[i].show.map((t, k, a) => { const pl = textPlane(t, t.length > 2 ? 0.75 : 0.9, INK[(k + i) % INK.length]); pl.parent = show;
      const ang = (k / a.length) * Math.PI * 2; pl.metadata = { ang, k }; return pl; });
    const extra = [];
    if (STOPS[i].rings) for (let k = 0; k < 3; k++) { const t = BABYLON.MeshBuilder.CreateTorus("ring", { diameter: 1, thickness: 0.05, tessellation: 32 }, scene);
      t.material = mat("rg", "#3da5ff", { emissive: "#1c5d99", alpha: .7 }); t.parent = show; t.metadata = { ring: k }; extra.push(t); }
    if (STOPS[i].pencil) { const pen = new BABYLON.TransformNode("pen", scene); pen.parent = show;
      const body = BABYLON.MeshBuilder.CreateCylinder("pb", { height: 1.3, diameter: .2, tessellation: 6 }, scene); body.material = mat("pbm", "#ffd43b"); body.parent = pen;
      const tip = BABYLON.MeshBuilder.CreateCylinder("pt", { height: .3, diameterTop: .2, diameterBottom: 0, tessellation: 6 }, scene); tip.material = mat("ptm", "#3b2a20"); tip.position.y = -.8; tip.parent = pen;
      pen.rotation.z = .5; pen.metadata = { pen: true }; extra.push(pen); }
    // Golan 20.10: a closed island sits in a clear, shiny glass bubble (its animation waits inside); the bubble pops when it opens
    const bubble = BABYLON.MeshBuilder.CreateSphere("bubble" + i, { diameter: 5.8, segments: 32 }, scene); bubble.parent = root; bubble.position.y = -0.55;
    const bm = new BABYLON.StandardMaterial("bub" + i, scene); bm.diffuseColor = new BABYLON.Color3(0.75, 0.9, 1); bm.alpha = 0.07;
    bm.specularColor = new BABYLON.Color3(1, 1, 1); bm.specularPower = 48; bm.emissiveColor = new BABYLON.Color3(0.15, 0.2, 0.28);
    bm.opacityFresnelParameters = new BABYLON.FresnelParameters(); bm.opacityFresnelParameters.leftColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    bm.opacityFresnelParameters.rightColor = new BABYLON.Color3(0.08, 0.08, 0.08); bm.opacityFresnelParameters.power = 2.2;
    bm.emissiveFresnelParameters = new BABYLON.FresnelParameters(); bm.emissiveFresnelParameters.leftColor = new BABYLON.Color3(0.85, 0.95, 1);
    bm.emissiveFresnelParameters.rightColor = new BABYLON.Color3(0, 0, 0); bm.emissiveFresnelParameters.power = 2.5;
    bm.backFaceCulling = true; bubble.material = bm; bubble.isPickable = false;
    const pick = BABYLON.MeshBuilder.CreateCylinder("hit" + i, { height: 5, diameter: 6 }, scene); pick.parent = root; pick.position.y = 0.5; pick.visibility = 0; pick.isPickable = true;
    for (const m of root.getChildMeshes()) m.metadata = Object.assign(m.metadata || {}, { stop: i });
    return { root, show, items, extra, bubble, pick, open: false, gone: 0, grow: 0 };
  }
  function makeBalloon(hex) {
    if (window.FL && window.FL.mapBalloon) return window.FL.mapBalloon(scene, hex);   // Golan 20.10: the new balloon (ropes reach the envelope and a square decorated basket)
    const root = new BABYLON.TransformNode("balloon", scene);
    const prof = []; for (let k = 0; k <= 20; k++) { const t = k / 20, a = -Math.PI / 2 + t * Math.PI * 1.05;
      const r = Math.max(0.05, Math.cos(a) * 1.15 * (t < .5 ? 1 : 1 - (t - .5) * 0.55)); prof.push(new BABYLON.Vector3(r, Math.sin(a) * 1.3 + 0.2 - (t > .8 ? (t - .8) * 1.2 : 0), 0)); }
    prof.reverse();
    // 12 gores, the child's colour and a light tint of it in turn
    const c = BABYLON.Color3.FromHexString(hex), light = BABYLON.Color3.Lerp(c, BABYLON.Color3.White(), 0.7);
    const mA = mat("envA", "#ffffff"), mB = mat("envB", "#ffffff"); mA.diffuseColor = c; mB.diffuseColor = light;
    for (let k = 0; k < 12; k++) { const g = BABYLON.MeshBuilder.CreateLathe("gore", { shape: prof, tessellation: 6, arc: 1 / 12, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
      g.material = k % 2 ? mB : mA; g.rotation.y = (k * Math.PI * 2) / 12; g.parent = root; g.position.y = 1.3; }
    const basket = BABYLON.MeshBuilder.CreateCylinder("basket", { height: 0.45, diameterTop: 0.75, diameterBottom: 0.6, tessellation: 12 }, scene);
    basket.material = mat("bk", "#a0703f"); basket.parent = root; basket.position.y = -0.55;
    const ropes = BABYLON.MeshBuilder.CreateLineSystem("ropes", { lines: [[-.32, .3], [.32, .3], [-.32, -.3], [.32, -.3]].map(([x, z]) => [new BABYLON.Vector3(x, -0.35, z), new BABYLON.Vector3(x * 1.6, 0.25, z * 1.6)]) }, scene);
    ropes.color = new BABYLON.Color3(.35, .25, .15); ropes.parent = root;
    for (const m of root.getChildMeshes()) m.isPickable = false;
    // an invisible, finger-size touch area: a tap on the balloon brings it home (Golan 20.10)
    const hit = BABYLON.MeshBuilder.CreateSphere("balloonHit", { diameter: 3.6, segments: 8 }, scene); hit.parent = root; hit.position.y = 0.8;
    hit.visibility = 0; hit.metadata = { balloon: true };
    root.scaling.setAll(0.6);   // in scale with the smaller islands
    return root;
  }
  function pathDots() {   // Golan 20.10: dots on the short straight way from one island's edge to the next one's
    let n = 0;
    // Golan 20.10 (his X marks): the trail leaves an island at the side of its grass that faces the next one, and
    // meets the next island on the front of its grass edge, the side the camera sees, just under the grass
    const R = 2.3 * ISLE, unit = (x, z) => { const l = Math.hypot(x, z) || 1; return [x / l, z / l]; };
    for (let i = 0; i < STOPS.length - 1; i++) { const a = spot(i), b = spot(i + 1);   /* dots of a segment show with its islands */
      const [ux, uz] = unit(b.x - a.x, b.z - a.z), [vx, vz] = unit(a.x - b.x, a.z - b.z - 2.2);
      const s0 = { x: a.x + ux * R, y: a.y - 0.12, z: a.z + uz * R }, s1 = { x: b.x + vx * R, y: b.y - 0.12, z: b.z + vz * R };
      for (let k = 0; k < 7; k++) { const t = (k + 0.5) / 7, d = dots[n++] || (dots.push(BABYLON.MeshBuilder.CreateSphere("dot", { diameter: 0.16, segments: 6 }, scene)), dots[dots.length - 1]);
        d.position.set(s0.x + (s1.x - s0.x) * t, s0.y + (s1.y - s0.y) * t, s0.z + (s1.z - s0.z) * t);
        if (!d.material) d.material = dotOff(); d.isPickable = false; d.metadata = { seg: i };
        // Golan 29.10: a touch on a dot takes the balloon there (a finger-size touch area that never shows)
        if (!d.hit) { d.hit = BABYLON.MeshBuilder.CreateSphere("dotHit", { diameter: 0.8, segments: 6 }, scene); d.hit.parent = d; d.hit.visibility = 0; d.hit.isPickable = true; }
        d.hit.metadata = { dot: n - 1 }; } }
    route();
  }
  // Golan 29.10: the balloon flies over the dots. The way: from the middle of an island to its edge, along the dots,
  // into the next island's edge and its middle, as one soft curve (Catmull-Rom). A float stop number v: whole numbers
  // are the islands, the fraction is the share of the way to the next island.
  let way = [], wayLen = [], isleLen = [], dotV = [];
  function route() {
    const R = 2.3 * ISLE, unit = (x, z) => { const l = Math.hypot(x, z) || 1; return [x / l, z / l]; }, pts = [], isleAt = [], dotAt = [];
    for (let i = 0; i < STOPS.length; i++) { const a = spot(i); isleAt.push(pts.length); pts.push(a);
      if (i === STOPS.length - 1) break;
      const b = spot(i + 1), [ux, uz] = unit(b.x - a.x, b.z - a.z), [vx, vz] = unit(a.x - b.x, a.z - b.z - 2.2);
      const s0 = { x: a.x + ux * R, y: a.y - 0.12, z: a.z + uz * R }, s1 = { x: b.x + vx * R, y: b.y - 0.12, z: b.z + vz * R };
      pts.push(s0); for (let k = 0; k < 7; k++) { const t = (k + 0.5) / 7; dotAt.push(pts.length); pts.push({ x: s0.x + (s1.x - s0.x) * t, y: s0.y + (s1.y - s0.y) * t, z: s0.z + (s1.z - s0.z) * t }); }
      pts.push(s1); }
    const N = 10, cr = (p0, p1, p2, p3, t, c) => 0.5 * (2 * p1[c] + (p2[c] - p0[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t * t + (3 * p1[c] - p0[c] - 3 * p2[c] + p3[c]) * t * t * t);
    way = []; wayLen = []; const at = [];
    for (let j = 0; j < pts.length - 1; j++) { const p0 = pts[Math.max(0, j - 1)], p1 = pts[j], p2 = pts[j + 1], p3 = pts[Math.min(pts.length - 1, j + 2)];
      at[j] = way.length; for (let k = 0; k < N; k++) { const t = k / N; way.push({ x: cr(p0, p1, p2, p3, t, "x"), y: cr(p0, p1, p2, p3, t, "y"), z: cr(p0, p1, p2, p3, t, "z") }); } }
    at[pts.length - 1] = way.length; way.push(pts[pts.length - 1]);
    let L = 0; way.forEach((q, n) => { if (n) L += Math.hypot(q.x - way[n - 1].x, q.y - way[n - 1].y, q.z - way[n - 1].z); wayLen.push(L); });
    isleLen = isleAt.map((j) => wayLen[at[j]]);
    dotV = dotAt.map((j, n) => { const i = Math.floor(n / 7); return i + (wayLen[at[j]] - isleLen[i]) / (isleLen[i + 1] - isleLen[i]); });
  }
  // places islands, trail and far clouds for the current screen shape (called again when a phone turns)
  function layout() { isles.forEach((it, i) => { const P = spot(i); it.root.position.set(P.x, P.y, P.z); }); pathDots(); placeFar(); }
  let far = [];
  function placeFar() { const D = lay().dir;
    far.forEach((g, k) => { const t = k * 4.5 - 6, side = k % 2 ? 1 : -1, off = (tall ? 9 : 14) + (k % 3) * 4;
      g.position.set(t * D.x + side * off * D.z, t * 0.085 + (side < 0 ? 0.8 : -7), t * D.z - side * off * D.x);
      if (k === 4 && !tall) g.position.addInPlace(new BABYLON.Vector3(-2.4, -1.3, 0.8));   /* Golan 20.10: this cloud a little lower and to the left */
      if (k === 14) g.position.copyFrom(far[13].position).addInPlace(tall ? new BABYLON.Vector3(1, 6.5, 2) : new BABYLON.Vector3(3.5, 7.5, 3));   /* and one more in the top right corner */
      g.metadata = { home: g.position.clone(), ph: k * 1.7 }; }); }
  let dots = [];
  function build() {
    const canvas = ui.querySelector("canvas");
    engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false, antialias: true }, false);
    engine.setHardwareScalingLevel(1 / Math.min(2, devicePixelRatio || 1));
    scene = new BABYLON.Scene(engine); scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
    scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR; scene.fogStart = 40; scene.fogEnd = 110; scene.fogColor = BABYLON.Color3.FromHexString("#d6efff");
    const hemi = new BABYLON.HemisphericLight("h", new BABYLON.Vector3(0.2, 1, -0.4), scene); hemi.intensity = 0.95; hemi.groundColor = new BABYLON.Color3(.55, .6, .7);
    const sun = new BABYLON.DirectionalLight("s", new BABYLON.Vector3(-0.4, -1, 0.6), scene); sun.intensity = 0.45;
    cam = new BABYLON.FreeCamera("cam", new BABYLON.Vector3(0, 6, -16), scene); cam.minZ = 0.3; cam.maxZ = 200;
    isles = STOPS.map((_, i) => island(i)); pathDots();
    // far-away soft clouds for depth
    const fm = mat("far", "#ffffff", { emissive: "#ffffff" }); fm.disableLighting = true; fm.fogEnabled = false;
    for (let k = 0; k < 15; k++) { const g = new BABYLON.TransformNode("far", scene); far.push(g);   /* Golan 20.10: plain clouds stay away from the path, so they never look like a closed island's cloud */
      for (let j = 0; j < 3; j++) { const p = BABYLON.MeshBuilder.CreateSphere("fp", { diameter: 2 + j * 0.7, segments: 8 }, scene); p.material = fm; p.position.x = j * 1.3; p.parent = g; p.isPickable = false; } }
    placeFar();
    balloon = makeBalloon(opt.colour || "#ff6b6b");
    scene.onBeforeRenderObservable.add(tick);
    pointer(canvas);
    addEventListener("resize", () => { if (visible) { engine.resize(); fov(); } });
    built = true;
  }
  function fov() { const was = tall, portrait = (tall = innerHeight > innerWidth); if (built && was !== tall) layout(); cam.fovMode = portrait ? BABYLON.Camera.FOVMODE_HORIZONTAL_FIXED : BABYLON.Camera.FOVMODE_VERTICAL_FIXED; cam.fov = portrait ? 1.0 : 0.8; }

  // ---------- motion ----------
  const lerp = (a, b, k) => a + (b - a) * k;
  function along(v) {   // a point on the way (over the dots) for a float stop number
    v = Math.max(0, Math.min(STOPS.length - 1, v)); const i = Math.min(STOPS.length - 2, Math.floor(v)), L = lerp(isleLen[i], isleLen[i + 1], v - i);
    let lo = 0, hi = wayLen.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (wayLen[m] <= L) lo = m; else hi = m; }
    const a = way[lo], b = way[hi], t = wayLen[hi] > wayLen[lo] ? (L - wayLen[lo]) / (wayLen[hi] - wayLen[lo]) : 0;
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) };
  }
  let T = 0, camLook = null, balSide = 0, vel = 0;
  // how far the view must move (world units: x along the screen's right, y up) so no island in view sits behind the start button.
  // Islands move right on a wide screen and up on a standing one; the view only eases back while there is room to spare.
  const btnOff = { x: 0, y: 0 };
  function keepClear(dt) {
    const b = ui && ui.querySelector(".sys"); if (!b || !b.offsetWidth) return;
    const cv = engine.getRenderingCanvas(), k = cv.clientWidth / engine.getRenderWidth(), vp = cam.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
    const M = scene.getTransformMatrix(), I = BABYLON.Matrix.IdentityReadOnly, R = cam.getDirection(BABYLON.Axis.X), U = new BABYLON.Vector3(0, 1, 0);
    const br = b.getBoundingClientRect(), c0 = cv.getBoundingClientRect(), bx1 = br.right - c0.left + 34, by0 = br.top - c0.top - 30;
    const ax = tall ? "y" : "x"; let need = 0, room = Infinity;
    const cur = Math.max(0, Math.round(s));   // islands already passed are leaving the screen anyway
    for (const [n, it] of isles.entries()) { if (n < cur || !it.root.isEnabled() || it.vis < 0.3) continue;
      const c = it.root.position, q = BABYLON.Vector3.Project(c, I, M, vp); if (q.z < 0 || q.z > 1) continue;
      const rx = Math.abs(BABYLON.Vector3.Project(c.add(R.scale(2.6 * ISLE)), I, M, vp).x - q.x) * k, x = q.x * k, y = q.y * k;
      const ppu = tall ? Math.abs(BABYLON.Vector3.Project(c.add(U), I, M, vp).y - q.y) * k : Math.abs(BABYLON.Vector3.Project(c.add(R), I, M, vp).x - q.x) * k;
      if (ppu < 1e-3) continue;
      const left = x - rx, bottom = y + rx * 0.9;   // the island's box on the screen (the cone hangs below)
      if (left >= bx1 || bottom <= by0) { room = Math.min(room, (tall ? bottom - by0 < 0 ? (by0 - bottom) : Infinity : left - bx1 >= 0 ? left - bx1 : Infinity) / ppu); continue; }
      need = Math.max(need, (tall ? bottom - by0 : bx1 - left) / ppu);
    }
    if (need > 0) btnOff[ax] += need * Math.min(1, dt * 6);
    else if (room !== Infinity && btnOff[ax] > 0) btnOff[ax] = Math.max(0, btnOff[ax] - Math.min(room - 0.3, btnOff[ax]) * Math.min(1, dt * 2) * (room > 0.3 ? 1 : 0));
    else if (room === Infinity) btnOff[ax] = Math.max(0, btnOff[ax] - btnOff[ax] * Math.min(1, dt * 2));
    btnOff[tall ? "x" : "y"] = 0; btnOff[ax] = Math.min(btnOff[ax], 6);
  }
  function clearSide(P) {   // how far (world units, along the screen's right) the balloon must slide to leave every island ahead visible
    const vp = cam.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()), M = scene.getTransformMatrix(), I = BABYLON.Matrix.IdentityReadOnly;
    const scr = (v) => BABYLON.Vector3.Project(v, I, M, vp), R = cam.getDirection(BABYLON.Axis.X); R.y = 0; R.normalize();
    const B = new BABYLON.Vector3(P.x + BAL.x, P.y + BAL.y + 0.9, P.z + BAL.z), b = scr(B), ppu = scr(B.add(R)).x - b.x;   // the envelope's middle
    const bk = scr(new BABYLON.Vector3(B.x, B.y - 1.2, B.z));   // and the basket's
    if (!isFinite(ppu) || Math.abs(ppu) < 1e-3) return balSide;
    const rb = Math.abs(ppu) * 0.75, rk = Math.abs(ppu) * 0.3, cur = Math.max(0, Math.min(STOPS.length - 1, Math.round(s))), ahead = [];
    for (let i = cur + 1; i <= Math.min(STOPS.length - 1, cur + 4); i++) { const it = isles[i]; if (!it.root.isEnabled()) continue;
      const k = it.root.scaling.x / ISLE, c = it.root.position.add(new BABYLON.Vector3(0, -0.25 * k * ISLE, 0)), q = scr(c);
      if (q.z < 0 || q.z > 1) continue; ahead.push({ x: q.x, y: q.y, r: Math.abs(scr(c.add(R)).x - q.x) * (it.bubble.isEnabled() ? 1.8 : 1.5) * k }); }
    if (!ahead.length) return 0;
    const away = ahead[0].x > b.x ? -1 : 1;
    let best = 0, bestGap = -1e9;
    for (let n = 0; n <= 60; n++) { const sh = n === 0 ? 0 : (n % 2 ? away : -away) * Math.ceil(n / 2) * 12, x = b.x + sh;
      if (x - rb < 0 || x + rb > vp.width) continue;
      const gap = Math.min(...ahead.map((a) => Math.min(Math.hypot(x - a.x, b.y - a.y) - rb, Math.hypot(x + bk.x - b.x - a.x, bk.y - a.y) - rk) - a.r - 4));
      if (gap >= 0) return sh / ppu;
      if (gap > bestGap) { bestGap = gap; best = sh / ppu; } }
    return best;
  }
  function tick() {
    const dt = Math.min(0.05, engine.getDeltaTime() / 1000); T += dt;
    // Golan 20.10: the balloon glides softly from island to island (eases in and out); a drag moves it gently too
    // Golan 29.10: rebuilt: a soft start and a soft stop over any distance, along the dots; a new target on the way
    // keeps the speed the balloon already has, so it never jerks
    const s0 = s;
    // Golan 29.10 19:53: while the finger or mouse drags, the balloon glides slowly toward the point of the way under it
    // (the view holds still meanwhile, so the target does not run away), never faster than half an island a second
    if (dragging) { const want = (dragTo - s) * Math.min(1, dt * 1.6), cap = 0.5 * dt; s += Math.max(-cap, Math.min(cap, want)); }
    else { if (!tw || tw.to !== sTo) { const d = Math.abs(sTo - s); const dur = Math.min(6, 1.4 + d * 1.1), dir = Math.sign(sTo - s);
        // Golan 29.10 20:01: the speed it already has never carries it past the target (no overshoot after a drag)
        const v0 = dir && Math.sign(vel) === dir ? dir * Math.min(Math.abs(vel), 1.2 * d / dur) : 0;
        tw = { from: s, to: sTo, t: 0, v0, dur }; }
      tw.t = Math.min(tw.dur, tw.t + dt); const u = tw.t / tw.dur, m0 = tw.v0 * tw.dur;
      s = tw.from * (2 * u * u * u - 3 * u * u + 1) + m0 * (u * u * u - 2 * u * u + u) + tw.to * (3 * u * u - 2 * u * u * u); }
    vel = dt > 0 ? (s - s0) / dt : 0;
    const sc = dragging && dragging.moved ? dragging.cam : s, P = along(s), C = along(sc - (tall ? BACK_TALL : BACK)), bob = prefersStill ? 0 : Math.sin(T * 1.6) * 0.15;
    // Golan 20.10: the balloon never hides an island ahead: on screen it slides sideways (left or right, whichever is
    // nearer and stays on the screen) until it no longer covers any of them
    const nearIsle = Math.max(0, 1 - Math.abs(s - Math.round(s)) * 4);   // between islands it stays right over the dots
    balSide += (clearSide(P) * nearIsle - balSide) * Math.min(1, dt * 4);
    const R = cam.getDirection(BABYLON.Axis.X); R.y = 0; R.normalize();
    balloon.position.set(P.x + BAL.x + R.x * balSide, P.y + BAL.y + bob, P.z + BAL.z + R.z * balSide); balloon.rotation.y += dt * 0.25;
    const near = Math.round(s), settled = !dragging && Math.abs(sTo - s) < 0.04 && Math.abs(sTo - near) < 0.01;   // resting on a dot: no island in focus
    if (settled && focus !== near) setFocus(near);
    if (!settled && focus !== -1 && (Math.abs(s - focus) > 0.35 || Math.abs(sTo - focus) > 0.01)) setFocus(-1);
    dotsInView();
    // every plain cloud drifts gently on its own (Golan 20.10)
    if (!prefersStill) far.forEach((g) => { const h = g.metadata.home, q = T * 0.12 + g.metadata.ph; g.position.set(h.x + Math.sin(q) * 1.2, h.y + Math.sin(q * 1.7) * 0.25, h.z + Math.cos(q * 0.8) * 0.6); });
    zoom += ((focus >= 0 ? 1 : 0) - zoom) * Math.min(1, dt * 2.2);
    // the camera follows the balloon and comes closer to a focused island
    // the camera stands behind the island, a little left, looking ahead along the path: this island at the bottom left,
    // the next ones up and to the right, farther and smaller; a focused island brings it closer
    let want, look;
    if (tall) {   // standing phone: the camera stays over the middle of the trail and looks up it; islands zigzag around the middle
      const M = mid(Math.max(0, sc - BACK_TALL)), cx = lerp(M.x, C.x, zoom * 0.6);
      want = new BABYLON.Vector3(cx, C.y + lerp(11, 6, zoom), C.z - lerp(7.5, 6.5, zoom));
      look = new BABYLON.Vector3(cx + lerp(0.6, 0.2, zoom), C.y + lerp(2.6, 1.2, zoom), C.z + lerp(11, 5, zoom));
    } else {
      want = new BABYLON.Vector3(C.x + lerp(1.0, 0.4, zoom) + SHIFT, C.y + lerp(5.2, 3.5, zoom), C.z - lerp(9.5, 7.3, zoom));
      look = new BABYLON.Vector3(C.x + lerp(6.8, 3.8, zoom) + SHIFT, C.y + lerp(0.7, 0.2, zoom), C.z + lerp(9, 4.5, zoom));
    }
    { const R = cam.getDirection(BABYLON.Axis.X); R.y = 0; R.normalize(); keepClear(dt);   // Golan 20.10: islands make room for the start button (it never moves)
      const off = R.scale(-btnOff.x).add(new BABYLON.Vector3(0, -btnOff.y, 0)); want.addInPlace(off); look.addInPlace(off); }
    cam.position = BABYLON.Vector3.Lerp(cam.position, want, Math.min(1, dt * 4)); camLook = BABYLON.Vector3.Lerp(camLook || look, look, Math.min(1, dt * 4)); cam.setTarget(camLook);
    // Golan 20.10: only the balloon's island and the next 4 show; moving on brings one more in and lets the first go
    const cur = Math.max(0, Math.min(STOPS.length - 1, Math.round(s)));
    isles.forEach((it, i) => {
      const inView = i >= cur - 1 && i <= cur + 4 ? 1 : 0;   /* Golan 29.10: the island before stays in view too */ it.vis = it.vis == null ? inView : it.vis + (inView - it.vis) * Math.min(1, dt * 3.5);
      const v = it.vis < 0.02 ? 0 : it.vis; it.root.setEnabled(v > 0); it.root.scaling.setAll(ISLE * (v * v * (3 - 2 * v)));
      const f = i === focus ? 1 : 0; it.grow += (f - it.grow) * Math.min(1, dt * 3);
      // the ring of letters turns the other way and slowly (Golan 20.10)
      const sp = prefersStill ? 0 : (0.16 + it.grow * 0.08);
      it.spin = (it.spin || 0) - dt * sp; it.show.scaling.setAll((1 + it.grow * 0.35) * (it.open ? Math.max(0.8, Math.min(1, Math.max(0, it.gone))) : 0.8));   /* Golan 29.10: a closed island's letters and sounds wait inside its bubble (a bit smaller); opening grows them */
      it.items.forEach((pl) => { const a = pl.metadata.ang + it.spin, r = 1.25 + it.grow * 0.05;   /* Golan 20.10: a little wider */
        pl.position.set(Math.cos(a) * r, (prefersStill ? 0 : Math.sin(T * 2 + pl.metadata.k) * 0.08) + it.grow * 0.1, Math.sin(a) * r); });
      it.extra.forEach((x) => { if (x.metadata.ring != null) { const q = ((T * 0.5 + x.metadata.ring / 3) % 1); x.scaling.setAll(0.4 + q * 2.4); x.material.alpha = 0.7 * (1 - q); x.position.y = 0.3; }
        if (x.metadata.pen) { x.position.set(Math.cos(T * 1.3) * 0.6, 0.6 + Math.sin(T * 2.6) * 0.15, -0.6); } });
      if (it.open && it.gone < 1) { it.gone = Math.min(1, it.gone + dt / 1.6); tint(it, Math.max(0, it.gone)); }
      // a closed island in focus gives a small shake: "not yet"
      if (!it.open) it.root.rotation.z = i === focus && !prefersStill ? Math.sin(T * 14) * 0.05 * Math.max(0, 1 - (T - focusedAt) / 0.8) : 0;
    });
  }
  function dotsInView() { const cur = Math.round(s); dots.forEach((d) => d.setEnabled(d.metadata.seg >= cur - 1 && d.metadata.seg < cur + 4)); }
    function tint(it, k) {   // k = 0 closed (in its bubble), 1 open; in between the bubble swells and pops
    const b = it.bubble; b.setEnabled(k < 1); if (k < 1) { const e = k * k; b.scaling.setAll(1 + e * 0.35); b.visibility = 1 - e; }
  }
  function setFocus(i) {
    focus = i; focusedAt = T; title(); if (i < 0) return;
    if (isles[i].open) opt.say("map_t" + (i + 1));
    else opt.say("map_t" + (i + 1), null, ["map_d" + (i + 1), "map_locked"]);   // Golan 20.10: its name, what it holds, then "opens later"
  }
  function title() {
    const pill = ui.querySelector(".pill"), go = ui.querySelector(".go");
    if (focus < 0) { pill.style.opacity = "0"; go.hidden = true; return; }
    const st = STOPS[focus], openNow = isles[focus].open;
    pill.style.opacity = "1"; pill.querySelector("b").dataset.nq = st.name; 
    pill.querySelector(".spk").dataset.clip = openNow ? "map_t" + (focus + 1) : "map_d" + (focus + 1);
    go.hidden = true; fit();   /* Golan 20.10: no round ▶ button; a tap on the island (or the balloon) opens it */
  }
  function fit() {   // Golan 29.10: every word shown in the topics keeps its nikud (was: only at 28px or more)
    const b = ui.querySelector(".pill b"); b.textContent = b.dataset.nq || "";
  }
  function goTo(i, far) {   // arrows and the wheel: one island at a time; a touch (far) flies to any island ahead or behind (Golan 29.10)
    const c = Math.round(s); if (!far) i = Math.max(c - 1, Math.min(c + 1, i)); sTo = Math.max(0, Math.min(STOPS.length - 1, i)); }
  function enter(i) {
    if (!isles[i].open) { opt.say("map_t" + (i + 1), null, ["map_d" + (i + 1), "map_locked"]); focusedAt = T; return; }
    if (i === 0 || (opt.has && opt.has(i))) { opt.onOpen(i); return; }   // Golan 28.10: island 2 has its first game
    opt.say("map_soon");   // an open topic whose games are still being built
  }

  function nearestOnWay(px, py) {
    const cv = engine.getRenderingCanvas(), r = cv.getBoundingClientRect(), k = cv.clientWidth / engine.getRenderWidth();
    const vp = cam.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()), M = scene.getTransformMatrix(), I = BABYLON.Matrix.IdentityReadOnly;
    const lo = Math.max(0, s - 1.2), hi = Math.min(STOPS.length - 1, s + 1.2);   // only the way near the balloon (far islands crowd together on the screen)
    let best = s, bd = Infinity;
    for (let v = lo; v <= hi + 1e-6; v += 0.02) { const q = along(v), p = BABYLON.Vector3.Project(new BABYLON.Vector3(q.x, q.y + BAL.y * 0.6, q.z), I, M, vp);
      if (p.z < 0 || p.z > 1) continue; const d = Math.hypot(r.left + p.x * k - px, r.top + p.y * k - py); if (d < bd) { bd = d; best = v; } }
    return best;
  }
  // ---------- touch: a tap on an island flies there (a tap on the focused one opens it); a drag moves the balloon ----------
  function pointer(canvas) {
    canvas.addEventListener("pointerdown", (e) => { canvas.setPointerCapture(e.pointerId); dragging = { x: e.clientX, y: e.clientY, s0: Math.round(sTo), moved: false, cam: s }; dragTo = s; });
    canvas.addEventListener("pointermove", (e) => {
      if (!dragging) return; const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
      if (!dragging.moved && Math.hypot(dx, dy) < 10) return; dragging.moved = true;
      // the point of the way (over the dots) nearest to the finger on the screen, among the islands in view
      dragTo = nearestOnWay(e.clientX, e.clientY); if (Math.abs(dragTo - Math.round(dragTo)) < 0.15) dragTo = Math.round(dragTo);   // near an island: its middle
    });
    const up = () => {
      if (!dragging) return; const d = dragging; dragging = null;
      if (d.moved) { tw = null; sTo = Math.max(0, Math.min(STOPS.length - 1, Math.round(s))); return; }   // Golan 29.10 20:31: let go = the island nearest to where the balloon IS, softly (never on past it)
      const hit = scene.pick(scene.pointerX, scene.pointerY, (m) => m.isEnabled() && m.metadata && (m.metadata.stop != null || m.metadata.balloon || m.metadata.dot != null));
      if (!hit || !hit.hit) return;
      // Golan 20.10: a tap on the balloon past the child's progress flies it back to the last open island
      // Golan 20.10: a tap on the balloon brings it back to where it started (the island its progress recommends); there, it opens it
      if (hit.pickedMesh.metadata.balloon) { if (sTo !== home) goTo(home, true); else if (focus >= 0) enter(focus); return; }
      if (hit.pickedMesh.metadata.dot != null) { sTo = dotV[hit.pickedMesh.metadata.dot]; return; }   // Golan 29.10: a dot on the way: the balloon goes to it
      const i = hit.pickedMesh.metadata.stop;
      if (i === focus) enter(i); else goTo(i, true);
    };
    canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", () => { if (dragging) { dragging.moved = true; up(); } });
    canvas.addEventListener("wheel", (e) => { e.preventDefault(); goTo(Math.round(s) + (e.deltaY + e.deltaX > 0 ? 1 : -1)); }, { passive: false });
    addEventListener("keydown", (e) => { if (!visible || document.querySelector(".set-ov, .fl-ov")) return;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") goTo(Math.round(s) + 1); else if (e.key === "ArrowLeft" || e.key === "ArrowDown") goTo(Math.round(s) - 1); else if (e.key === "Enter" && focus >= 0) enter(focus); });
  }

  // ---------- show / hide ----------
  function mount() {
    css(); ui = document.createElement("div"); ui.className = "fl-map";
    ui.innerHTML = `<canvas aria-label="מפת הלמידה"></canvas><div class="wait">…</div>
      <div class="top"><div class="pill" style="opacity:0"><span class="lk" aria-hidden="true" hidden></span><b></b><button class="spk" type="button" aria-label="הקשבה">🔊</button></div>
      <button class="go" type="button" aria-label="כניסה" hidden>${PLAY}</button></div>
      <button class="sys" type="button"><span class="tx"><b>הַתְחֵל מִשְׂחָק</b><small>עַל פִּי רָמַת הִתְקַדְּמוּת</small></span><span class="spk" role="button" tabindex="0" aria-label="הקשבה" data-clip="map_system">🔊</span></button>`;
    ui.querySelector(".go").onclick = () => focus >= 0 && enter(focus);
    ui.querySelector(".pill .spk").onclick = (e) => { e.stopPropagation(); if (focus >= 0) setFocus(focus); };
    ui.querySelector(".sys").onclick = (e) => { if (e.target.closest(".spk")) return; opt.onSystem(); };
    host.append(ui);
    addEventListener("resize", () => visible && fit());
  }
  async function show(o) {
    opt = o; host = o.host || document.body; if (!ui) mount();
    ui.hidden = false; visible = true;
    const p = o.profile || {}; seenKey = "fl-map-seen-" + (p.id || "x");
    open = 1 + ((o.known || 0) >= UNLOCK_AT ? 1 : 0);   // islands 3-9: no games measure them yet
    try { await loadBabylon(); if (document.fonts) await Promise.race([document.fonts.load('800 40px "Noto Sans Hebrew"'), new Promise((r) => setTimeout(r, 1500))]); }
    catch (e) { if (o.onFail) o.onFail(); return; }
    if (!visible) return;
    if (!built) build(); else balloon.getChildMeshes().forEach((m) => m.dispose()), balloon.dispose(), (balloon = makeBalloon(o.colour || "#ff6b6b"));
    ui.querySelector(".wait").hidden = true;
    let seen = 1; try { seen = Math.max(1, +localStorage.getItem(seenKey) || 1); } catch (e) {}
    isles.forEach((it, i) => { const was = i < Math.min(seen, open); it.open = i < open; it.gone = was || !it.open ? (it.open ? 1 : 0) : 0;
      if (it.open && it.gone < 1) it.gone = -0.6;   // a short wait, then the colours come back in view
      tint(it, it.open ? Math.max(0, it.gone) : 0); });
    dots.forEach((d) => { d.material = d.metadata.seg < open - 1 ? dotOn() : dotOff(); });
    const fresh = open > seen;   // a new island opened since the last visit: start there so the cloud blows away in view
    s = sTo = fresh ? open - 1 : Math.min(open - 1, o.at != null ? o.at : 0); home = open - 1; tw = null; vel = 0; focus = -1; zoom = 0;
    const P = along(s); cam.position.set(P.x + 1, P.y + 7, P.z - 14); camLook = null;
    try { localStorage.setItem(seenKey, String(open)); } catch (e) {}
    fov(); engine.resize(); engine.runRenderLoop(() => scene.render()); fit();
  }
  let on = null, off = null;
  // Golan 20.10: dots a little darker than the sky (a touch darker still on the way already open)
  const flat = (n, hex) => { const m = new BABYLON.StandardMaterial(n, scene); m.disableLighting = true; m.emissiveColor = BABYLON.Color3.FromHexString(hex); return m; };
  const dotOn = () => on || (on = flat("don", "#86b9e0")), dotOff = () => off || (off = flat("doff", "#a3cdee"));
  function hide() { visible = false; if (ui) ui.hidden = true; if (engine) engine.stopRenderLoop(); }
  // for the tester: where each island sits on the screen now (CSS px) and how wide it looks
  function probe() {
    if (!engine) return null;
    const cv = engine.getRenderingCanvas(), k = cv.clientWidth / engine.getRenderWidth(), vp = cam.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
    const M = scene.getTransformMatrix(), I = BABYLON.Matrix.IdentityReadOnly, R = cam.getDirection(BABYLON.Axis.X);
    const b = ui.querySelector(".sys").getBoundingClientRect(), c0 = cv.getBoundingClientRect();
    return { W: cv.clientWidth, H: cv.clientHeight, s, btn: { x: b.left - c0.left, y: b.top - c0.top, w: b.width, h: b.height },
      isles: isles.map((it, i) => { const c = it.root.position, q = BABYLON.Vector3.Project(c, I, M, vp), e = BABYLON.Vector3.Project(c.add(R.scale(2.9 * ISLE)), I, M, vp);
        return { i, on: it.root.isEnabled() && it.vis > 0.5, x: q.x * k, y: q.y * k, r: Math.abs(e.x - q.x) * k }; }),
      clouds: far.map((g, i) => { const q = BABYLON.Vector3.Project(g.position.add(new BABYLON.Vector3(1.3, 0, 0)), I, M, vp); return { i, x: q.x * k, y: q.y * k, z: q.z }; }) };
  }
  // text without nikud keeps the full spelling (כתיב מלא): "זִיהוּי" -> "זיהוי", not "זהוי" (Golan 28.10 16:32). Used by the hub too.
  const FULL = { "זהוי": "זיהוי", "זכרון": "זיכרון" };
  FL.plainHe = (t) => t.replace(/[\u0591-\u05BD\u05BF-\u05C7]/g, "").replace(/[\u05D0-\u05EA]+/g, (w) => FULL[w] || w);
  FL.loadBabylon = loadBabylon;   // one loader for the hub's 3D sky balloons too
  FL.map = { show, hide, STOPS, UNLOCK_AT, at: () => Math.round(sTo), probe, state: () => ({ s, sTo, dragTo, dragging: !!dragging, moved: !!(dragging && dragging.moved), vel }) };   // state: for the tester
})();
