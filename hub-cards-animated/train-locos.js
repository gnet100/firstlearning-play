// train-locos.js: three more engines, in other styles, for רכבת האותיות (Golan 20.10, thread "אנימציות לכרטיסי המשחקים"), plus the current one.
// Built from the current engine in games/letter-train/index.html (same toy style, same parts: box(), mat(), addWheel(),
// same footprint: front at x -2.1, coupler at x 2.2, wheels on z ±0.62), so any of them can replace it in place.
// Use: const L = FL.trainLocos.build(name, { scene, mat, box, addWheel }) -> { root, chimneyTop } (chimneyTop = where the steam starts).
// Names: "classic" (the current bordeaux engine), "bullet" (fast electric train), "diesel", "bubbly" (round cartoon engine), "western" (wild-west steam engine), "wooden" (wooden toy engine).
// chimneyTop is null for the electric train (no steam).
(() => {
  "use strict";
  const FL = (window.FL = window.FL || {});
  const cyl = (scene, mat, name, o, hex, parent, x, y, z, rz = Math.PI / 2) => {
    const m = BABYLON.MeshBuilder.CreateCylinder(name, o, scene); m.rotation.z = rz; m.material = mat(hex); m.parent = parent; m.position.set(x, y, z); return m; };
  const ball = (scene, mat, name, d, hex, parent, x, y, z) => {
    const m = BABYLON.MeshBuilder.CreateSphere(name, { diameter: d, segments: 10 }, scene); m.material = mat(hex); m.parent = parent; m.position.set(x, y, z); return m; };

  const LOCOS = {
    // the current engine, unchanged (Golan 18.10: bordeaux)
    classic({ scene, mat, box, addWheel }, root) {
      box("lChassis", 4.1, 0.3, 1.6, "#2B2F36", root, 0, 0.5, 0);
      cyl(scene, mat, "boiler", { diameter: 1.3, height: 2.5, tessellation: 18 }, "#7B1E2B", root, -0.75, 1.3, 0);
      for (const x of [-1.6, -0.6]) cyl(scene, mat, "band", { diameter: 1.36, height: 0.12, tessellation: 18 }, "#FFC400", root, x, 1.3, 0);
      cyl(scene, mat, "front", { diameter: 1.1, height: 0.16, tessellation: 18 }, "#2B2F36", root, -2.03, 1.3, 0);
      ball(scene, mat, "lamp", 0.34, "#FFF4B0", root, -2.12, 1.55, 0);
      cyl(scene, mat, "chimney", { diameterTop: 0.72, diameterBottom: 0.42, height: 0.9, tessellation: 12 }, "#2B2F36", root, -1.45, 2.3, 0, 0);
      ball(scene, mat, "dome", 0.6, "#FFC400", root, -0.5, 1.95, 0);
      box("cab", 1.5, 1.7, 1.6, "#3DA5FF", root, 1.15, 1.5, 0);
      box("roof", 1.8, 0.18, 1.9, "#2B2F36", root, 1.15, 2.42, 0);
      box("window", 0.9, 0.6, 0.05, "#CFEFFF", root, 1.15, 1.85, -0.81);
      box("buffer", 0.2, 0.3, 1.7, "#7B1E2B", root, -2.1, 0.55, 0);
      for (const x of [-1.3, -0.3]) for (const z of [-0.62, 0.62]) addWheel(root, x, z, 1.25);
      for (const z of [-0.62, 0.62]) addWheel(root, 1.2, z, 1);
      return { x: -1.45, y: 2.75 };
    },
    // Golan 20.10: "not only colours, other styles": three engines of a different kind, not steam-engine recolours.
    // 1. the fast train (Golan 20.10, "שפר ציור"): one smooth shell, a rounded body that runs into a long, low nose,
    // a dark wrap-around windscreen, a blue stripe along the side and onto the nose, windows on both sides, a small pantograph
    bullet({ scene, mat, box, addWheel }, root) {
      const YB = 0.8, TAIL = 2.2, NOSE0 = -0.7, TIP = -2.3, N = 4;   // shell bottom, back end, where the nose starts, the tip, squircle power
      // the shell's cross-section at x: width w, height h, flat bottom at YB
      const size = (x) => { if (x >= NOSE0) return { w: 1.5, h: 1.32 }; const u = (x - TIP) / (NOSE0 - TIP), k = Math.sqrt(1 - (1 - u) ** 2);
        return { w: 0.35 + 1.15 * Math.pow(k, 0.7), h: 0.22 + 1.1 * Math.pow(k, 1.6) }; };
      const pt = (x, a, grow = 0) => { const { w, h } = size(x), c = Math.cos(a), s = Math.sin(a), e = 2 / N;
        return new BABYLON.Vector3(x, YB + h / 2 + (h / 2 + grow) * Math.sign(s) * Math.abs(s) ** e, (w / 2 + grow) * Math.sign(c) * Math.abs(c) ** e); };
      const xs = []; for (let k = 0; k <= 40; k++) { const t = k / 40; xs.push(TIP + (NOSE0 - TIP) * (1 - (1 - t) ** 1.5)); } xs.push(0.2, 1.2, TAIL);
      const ring = (x, a0, a1, n, grow) => { const r = []; for (let j = 0; j <= n; j++) r.push(pt(x, a0 + ((a1 - a0) * j) / n, grow)); return r; };
      const shell = BABYLON.MeshBuilder.CreateRibbon("shell", { pathArray: xs.map((x) => ring(x, 0, Math.PI * 2, 48, 0)), sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
      shell.material = mat("#F4F7FB"); shell.parent = root;
      const cap = BABYLON.MeshBuilder.CreateDisc("tailCap", { radius: 0.7, tessellation: 24 }, scene); cap.material = mat("#F4F7FB"); cap.parent = root; cap.rotation.y = -Math.PI / 2; cap.scaling.set(1.07, 0.94, 1); cap.position.set(TAIL, YB + 0.66, 0);
      // a painted patch lying on the shell: x range, angle range
      const patch = (name, x0, x1, a0, a1, hex, grow = 0.012) => { const px = xs.filter((x) => x >= x0 && x <= x1);
        const m = BABYLON.MeshBuilder.CreateRibbon(name, { pathArray: px.map((x) => ring(x, a0, a1, 16, grow)), sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene); m.material = mat(hex); m.parent = root; return m; };
      patch("windscreen", -1.95, -0.95, Math.PI * 0.18, Math.PI * 0.82, "#1F3B73");
      for (const [a0, a1] of [[-Math.PI * 0.11, -Math.PI * 0.02], [Math.PI * 1.02, Math.PI * 1.11]]) patch("stripe", TIP + 0.05, TAIL, a0, a1, "#3DA5FF");
      for (const [a0, a1] of [[-Math.PI * 0.17, -Math.PI * 0.14], [Math.PI * 1.14, Math.PI * 1.17]]) patch("stripe2", -1.9, TAIL, a0, a1, "#1F3B73");
      // windows on both sides, a door at the back
      for (const z of [-0.77, 0.77]) {
        for (const x of [-0.1, 0.5, 1.1, 1.7]) { const w = box("window", 0.42, 0.34, 0.03, "#1F3B73", root, x, 1.72, z); }
        box("door", 0.36, 0.7, 0.03, "#C9D1DB", root, 2.0, 1.45, z * 1.005);
      }
      for (const z of [-0.2, 0.2]) ball(scene, mat, "light", 0.13, "#FFF4B0", root, -2.18, YB + 0.2, z);
      // under the shell: a dark skirt and two wheel trucks
      box("skirt", 4.0, 0.22, 1.3, "#3A4350", root, 0.15, 0.72, 0);
      for (const cx of [-1.0, 1.4]) { box("truck", 1.4, 0.18, 1.2, "#2B2F36", root, cx, 0.5, 0); for (const dx of [-0.42, 0.42]) for (const z of [-0.62, 0.62]) addWheel(root, cx + dx, z, 0.8); }
      // a small pantograph: a base, a diamond frame and a shoe across the top
      box("pBase", 0.55, 0.08, 0.45, "#2B2F36", root, 1.2, YB + 1.36, 0);
      const P = (x, y) => new BABYLON.Vector3(x, YB + y, 0), dia = [P(1.2, 1.4), P(0.98, 1.62), P(1.2, 1.86), P(1.42, 1.62), P(1.2, 1.4)];
      const fr = BABYLON.MeshBuilder.CreateTube("pFrame", { path: dia, radius: 0.025, tessellation: 6 }, scene); fr.material = mat("#2B2F36"); fr.parent = root;
      box("pShoe", 0.1, 0.05, 0.75, "#2B2F36", root, 1.2, YB + 1.88, 0);
      return null;   // electric: no steam
    },
    // 2. the diesel engine: a long low hood with vents, a tall cab at the back, a walkway with railings, two wheel trucks, warning stripes in front
    diesel({ scene, mat, box, addWheel }, root) {
      for (const cx of [-1.2, 1.2]) { box("truck", 1.5, 0.3, 1.3, "#2B2F36", root, cx, 0.45, 0); for (const dx of [-0.45, 0.45]) for (const z of [-0.62, 0.62]) addWheel(root, cx + dx, z, 0.9); }
      box("deck", 4.4, 0.22, 1.8, "#3A4350", root, 0, 0.72, 0);
      box("hood", 2.7, 1.1, 1.15, "#FF8A3D", root, -0.7, 1.38, 0);
      box("hoodStripe", 2.72, 0.16, 1.17, "#FFFFFF", root, -0.7, 1.15, 0);
      for (const x of [-1.6, -1.2, -0.8, -0.4, 0]) box("vent", 0.22, 0.45, 0.03, "#B85A1E", root, x, 1.55, -0.59);
      box("cab", 1.4, 1.75, 1.7, "#FF8A3D", root, 1.4, 1.7, 0);
      box("cabStripe", 1.42, 0.16, 1.72, "#FFFFFF", root, 1.4, 1.15, 0);
      box("cabRoof", 1.6, 0.14, 1.85, "#3A4350", root, 1.4, 2.62, 0);
      box("frontWin", 0.04, 0.5, 1.3, "#CFEFFF", root, 0.69, 2.15, 0);
      box("sideWin", 0.8, 0.5, 0.04, "#CFEFFF", root, 1.45, 2.15, -0.86);
      cyl(scene, mat, "headlight", { diameter: 0.34, height: 0.1, tessellation: 16 }, "#FFF4B0", root, -2.08, 1.62, 0);
      cyl(scene, mat, "exhaust", { diameter: 0.22, height: 0.35, tessellation: 10 }, "#2B2F36", root, -0.2, 2.1, 0, 0);
      cyl(scene, mat, "horn", { diameterTop: 0.16, diameterBottom: 0.06, height: 0.35, tessellation: 10 }, "#C9D1DB", root, 1.0, 2.82, 0.4);
      // warning stripes across the front of the deck
      for (let k = 0; k < 6; k++) { const m = box("warn", 0.06, 0.24, 0.26, k % 2 ? "#2B2F36" : "#FFC400", root, -2.21, 0.72, -0.65 + k * 0.26); }
      // walkway railings along the camera side
      for (const x of [-2.0, -1.1, -0.2, 0.6]) box("rpost", 0.05, 0.6, 0.05, "#FFC400", root, x, 1.12, -0.86);
      box("rail", 2.65, 0.05, 0.05, "#FFC400", root, -0.7, 1.42, -0.86);
      return { x: -0.2, y: 2.35 };
    },
    // 3. the round cartoon engine: a chubby body with eyes and a smile, big red wheels, a round pink cab, a short wobbly chimney
    bubbly({ scene, mat, box, addWheel }, root) {
      box("lChassis", 3.6, 0.28, 1.3, "#2B2F36", root, 0.1, 0.62, 0);
      for (const x of [-1.05, 1.05]) for (const z of [-0.62, 0.62]) addWheel(root, x, z, 1.45);
      const RX = 1.4, RY = 0.75, CX = -0.6, CY = 1.4;
      const body = ball(scene, mat, "body", 1, "#16B6A8", root, CX, CY, 0); body.scaling.set(RX * 2, RY * 2, 1.5);
      const onFront = (dy, z, out = 0) => CX - RX * Math.sqrt(Math.max(0, 1 - (dy / RY) ** 2 - (z / 0.75) ** 2)) - out;   // a point on the front of the body
      for (const z of [-0.27, 0.27]) {
        ball(scene, mat, "eye", 0.46, "#FFFFFF", root, onFront(0.27, z, -0.05), CY + 0.27, z);
        ball(scene, mat, "pupil", 0.22, "#2B2F36", root, onFront(0.27, z, 0.15), CY + 0.25, z * 0.92);
        ball(scene, mat, "cheek", 0.2, "#FF9B8A", root, onFront(-0.08, z * 1.45, -0.04), CY - 0.08, z * 1.45);
      }
      const smile = []; for (let k = 0; k <= 10; k++) { const z = -0.22 + k * 0.044, dy = -0.2 - Math.sin((k / 10) * Math.PI) * 0.1; smile.push(new BABYLON.Vector3(onFront(dy, z, 0.005), CY + dy, z)); }
      const sm = BABYLON.MeshBuilder.CreateTube("smile", { path: smile, radius: 0.05, tessellation: 8 }, scene); sm.material = mat("#B5533C"); sm.parent = root;
      // a short, fat chimney with a round top, leaning back a little
      const ch = cyl(scene, mat, "chimney", { diameterTop: 0.5, diameterBottom: 0.38, height: 0.55, tessellation: 12 }, "#FFC233", root, -1.15, 2.25, 0, 0.12);
      ball(scene, mat, "chimTop", 0.5, "#FFC233", root, -1.18, 2.52, 0);
      const cab = ball(scene, mat, "cab", 1, "#FF8FB8", root, 1.25, 1.75, 0); cab.scaling.set(1.6, 1.9, 1.6);
      const roof = ball(scene, mat, "roof", 1, "#7C5CFF", root, 1.25, 2.6, 0); roof.scaling.set(1.75, 0.45, 1.75);
      const win = cyl(scene, mat, "window", { diameter: 0.55, height: 0.04, tessellation: 20 }, "#CFEFFF", root, 1.25, 1.95, -0.79, 0); win.rotation.x = Math.PI / 2;
      for (const x of [-1.05, 1.05]) for (const z of [-0.78, 0.78]) ball(scene, mat, "hubcap", 0.22, "#FF5A4E", root, x, 0.51, z);
      return { x: -1.18, y: 2.75 };
    },
    // 4. the wild-west engine: big drive wheels at the back, a wide funnel chimney, a big lantern, a cow-catcher, a red cab with a curved roof
    western({ scene, mat, box, addWheel }, root) {
      box("lChassis", 4.2, 0.28, 1.4, "#2B2F36", root, 0, 0.62, 0);
      for (const z of [-0.62, 0.62]) { addWheel(root, -1.45, z, 0.9); addWheel(root, 0.15, z, 1.65); addWheel(root, 1.35, z, 1.65); }
      for (const x of [0.15, 1.35]) for (const z of [-0.8, 0.8]) ball(scene, mat, "hub", 0.24, "#E03131", root, x, 0.58, z);
      box("rod", 1.25, 0.08, 0.06, "#C9D1DB", root, 0.75, 0.58, -0.84);
      cyl(scene, mat, "boiler", { diameter: 1.1, height: 2.3, tessellation: 18 }, "#1F6F5C", root, -0.85, 1.35, 0);
      for (const x of [-1.8, -1.2, -0.6, 0.0]) cyl(scene, mat, "band", { diameter: 1.15, height: 0.08, tessellation: 18 }, "#E0A526", root, x, 1.35, 0);
      cyl(scene, mat, "front", { diameter: 0.95, height: 0.12, tessellation: 18 }, "#2B2F36", root, -2.02, 1.35, 0);
      // the wide funnel: narrow at the bottom, wide in the middle, closing a little at the top
      cyl(scene, mat, "funnel", { diameterTop: 1.15, diameterBottom: 0.32, height: 0.85, tessellation: 16 }, "#2B2F36", root, -1.55, 2.3, 0, 0);
      cyl(scene, mat, "funnelCap", { diameterTop: 0.6, diameterBottom: 1.15, height: 0.28, tessellation: 16 }, "#2B2F36", root, -1.55, 2.86, 0, 0);
      // the big lantern on the front
      box("lantern", 0.45, 0.45, 0.45, "#E0A526", root, -1.95, 2.05, 0);
      box("lanternGlass", 0.04, 0.3, 0.3, "#FFF4B0", root, -2.19, 2.05, 0);
      box("lanternTop", 0.55, 0.08, 0.55, "#2B2F36", root, -1.95, 2.31, 0);
      ball(scene, mat, "bell", 0.36, "#E0A526", root, -0.5, 2.05, 0);
      ball(scene, mat, "dome", 0.5, "#E0A526", root, 0.0, 1.95, 0);
      // the cow-catcher: slanted red bars low in front
      for (const z of [-0.55, -0.27, 0, 0.27, 0.55]) { const bar = box("catcher", 0.75, 0.08, 0.12, "#E03131", root, -2.35, 0.42, z); bar.rotation.z = 0.6; }
      box("catcherTop", 0.12, 0.12, 1.4, "#E03131", root, -2.08, 0.64, 0);
      box("cab", 1.4, 1.6, 1.6, "#C0392B", root, 1.4, 1.62, 0);
      box("cabTrim", 1.42, 0.12, 1.62, "#E0A526", root, 1.4, 1.0, 0);
      box("window", 0.75, 0.6, 0.04, "#CFEFFF", root, 1.4, 1.95, -0.81);
      const roof = BABYLON.MeshBuilder.CreateCylinder("roof", { diameter: 1.95, height: 1.75, tessellation: 18, arc: 0.5 }, scene);
      roof.rotation.x = Math.PI / 2; roof.rotation.y = Math.PI / 2; roof.scaling.set(1, 1, 0.35); roof.material = mat("#2B2F36"); roof.parent = root; roof.position.set(1.4, 2.42, 0);
      return { x: -1.55, y: 3.05 };
    },
    // 5. the wooden toy engine: natural wood blocks with wood grain, round wooden wheels with red pegs, a peg chimney with a red ball
    wooden({ scene, mat, box, addWheel }, root) {
      const woodMat = (name, base, line) => {
        const tx = new BABYLON.DynamicTexture(name, { width: 128, height: 128 }, scene, true), g = tx.getContext();
        g.fillStyle = base; g.fillRect(0, 0, 128, 128); g.strokeStyle = line; g.lineWidth = 2;
        for (let k = 0; k < 9; k++) { g.beginPath(); const y = 8 + k * 14; g.moveTo(0, y); g.bezierCurveTo(40, y + 5, 80, y - 5, 128, y + 2); g.stroke(); }
        tx.update(); const m = new BABYLON.StandardMaterial(name + "M", scene); m.diffuseTexture = tx; m.specularColor = new BABYLON.Color3(.04, .04, .04); return m; };
      const light = woodMat("woodL", "#E8C28A", "#d3a86a"), mid = woodMat("woodM", "#D49A5A", "#bb8040");
      const wb = (name, w, h, d, m, x, y, z) => { const b = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene); b.material = m; b.parent = root; b.position.set(x, y, z); return b; };
      wb("base", 4.2, 0.4, 1.4, mid, 0, 0.75, 0);
      for (const x of [-1.3, 0.0, 1.3]) for (const z of [-0.62, 0.62]) {
        addWheel(root, x, z, 1.3);
        const wd = BABYLON.MeshBuilder.CreateCylinder("woodWheel", { diameter: 0.92, height: 0.24, tessellation: 24 }, scene); wd.rotation.x = Math.PI / 2; wd.material = mid; wd.parent = root; wd.position.set(x, 0.46, z * 1.06);
        ball(scene, mat, "peg", 0.2, "#E03131", root, x, 0.46, z * 1.27);
      }
      const boiler = BABYLON.MeshBuilder.CreateCylinder("boiler", { diameter: 1.15, height: 2.3, tessellation: 24 }, scene); boiler.rotation.z = Math.PI / 2; boiler.material = light; boiler.parent = root; boiler.position.set(-0.85, 1.5, 0);
      for (const x of [-1.6, -0.2]) cyl(scene, mat, "ring", { diameter: 1.2, height: 0.14, tessellation: 24 }, "#3DA5FF", root, x, 1.5, 0);
      cyl(scene, mat, "front", { diameter: 0.9, height: 0.1, tessellation: 24 }, "#FFC233", root, -2.02, 1.5, 0);
      const ch = BABYLON.MeshBuilder.CreateCylinder("chimney", { diameter: 0.42, height: 0.8, tessellation: 16 }, scene); ch.material = mid; ch.parent = root; ch.position.set(-1.4, 2.4, 0);
      ball(scene, mat, "chimBall", 0.5, "#E03131", root, -1.4, 2.85, 0);
      ball(scene, mat, "dome", 0.55, "#2BB673", root, -0.55, 2.08, 0);
      wb("cab", 1.45, 1.6, 1.45, light, 1.35, 1.75, 0);
      box("roof", 1.75, 0.2, 1.75, "#E03131", root, 1.35, 2.65, 0);
      box("window", 0.7, 0.6, 0.04, "#3DA5FF", root, 1.35, 2.0, -0.74);
      return { x: -1.4, y: 3.15 };
    },
  };

  FL.trainLocos = {
    names: Object.keys(LOCOS),
    build(name, ctx) {
      const root = new BABYLON.TransformNode("loco", ctx.scene);
      const top = (LOCOS[name] || LOCOS.classic)(ctx, root);
      box(ctx, root);   // the coupler to the first car, same for all
      return { root, chimneyTop: top ? new BABYLON.Vector3(top.x, top.y, 0) : null };
    },
  };
  function box(ctx, root) { ctx.box("lCoupler", 0.34, 0.12, 0.2, "#2B2F36", root, 2.2, 0.5, 0); }
})();
