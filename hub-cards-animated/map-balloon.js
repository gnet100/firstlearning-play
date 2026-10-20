// map-balloon.js: the learning-map balloon, improved (Golan 20.10, thread "אנימציות לכרטיסי המשחקים"):
// four ropes that really reach the envelope and the basket, and a square, decorated wicker basket.
// Same envelope, size and touch area as makeBalloon() in games/shared/learning-map.js, so it can replace it in one line:
//   function makeBalloon(hex) { return FL.mapBalloon(scene, hex); }
// Needs BABYLON loaded. Returns the root TransformNode (children not pickable, plus the invisible "balloonHit" sphere).
(() => {
  "use strict";
  const FL = (window.FL = window.FL || {});

  // the envelope's outline (the same curve as the map's lathe), as a function of t = 0 (bottom neck) .. 1 (top)
  const R = (t) => { const a = -Math.PI / 2 + t * Math.PI * 1.05; return Math.max(0.05, Math.cos(a) * 1.15 * (t < .5 ? 1 : 1 - (t - .5) * 0.55)); };
  const Y = (t) => { const a = -Math.PI / 2 + t * Math.PI * 1.05; return Math.sin(a) * 1.3 + 0.2 - (t > .8 ? (t - .8) * 1.2 : 0); };
  const ENV_Y = 1.3;   // where the envelope sits in the root
  const B = 0.62, BH = 0.4, BY = -0.55;   // basket: width = depth, height, centre height
  const ROPE_T = 0.13;   // where the ropes meet the envelope (its lower curve, just above the neck)

  function wicker(scene, hex) {   // a woven texture: rows of short reeds, every other row shifted, with a band in the child's colour
    const tx = new BABYLON.DynamicTexture("wicker", { width: 256, height: 256 }, scene, true), g = tx.getContext();
    g.fillStyle = "#9a6a3a"; g.fillRect(0, 0, 256, 256);
    const rows = 8, h = 256 / rows;
    for (let r = 0; r < rows; r++) for (let k = -1; k < 5; k++) {
      const x = k * 64 + (r % 2 ? 32 : 0), y = r * h;
      const grd = g.createLinearGradient(0, y, 0, y + h); grd.addColorStop(0, "#e2b27a"); grd.addColorStop(0.5, "#c8915a"); grd.addColorStop(1, "#a8723f");
      g.fillStyle = grd; g.beginPath(); g.roundRect(x + 3, y + 3, 58, h - 6, 12); g.fill();
    }
    // the band: the child's colour, white studs
    g.fillStyle = hex; g.fillRect(0, 104, 256, 48);
    g.fillStyle = "#ffffff55"; g.fillRect(0, 106, 256, 6);
    g.fillStyle = "#fff"; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(32 + k * 64, 128, 9, 0, Math.PI * 2); g.fill(); }
    tx.update(); return tx;
  }

  FL.mapBalloon = function (scene, hex, scale = 0.6) {
    const mat = (name, col) => { const m = new BABYLON.StandardMaterial(name, scene); m.diffuseColor = BABYLON.Color3.FromHexString(col); m.specularColor = new BABYLON.Color3(.12, .12, .12); return m; };
    const root = new BABYLON.TransformNode("balloon", scene);

    // envelope: 12 gores, the child's colour and a light tint of it in turn (unchanged)
    const prof = []; for (let k = 0; k <= 20; k++) { const t = k / 20; prof.push(new BABYLON.Vector3(R(t), Y(t), 0)); }
    prof.reverse();
    const c = BABYLON.Color3.FromHexString(hex), light = BABYLON.Color3.Lerp(c, BABYLON.Color3.White(), 0.7);
    const mA = mat("envA", "#ffffff"), mB = mat("envB", "#ffffff"); mA.diffuseColor = c; mB.diffuseColor = light;
    for (let k = 0; k < 12; k++) { const g = BABYLON.MeshBuilder.CreateLathe("gore", { shape: prof, tessellation: 6, arc: 1 / 12, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
      g.material = k % 2 ? mB : mA; g.rotation.y = (k * Math.PI * 2) / 12; g.parent = root; g.position.y = ENV_Y; }
    // a ring in the child's colour where the ropes are tied, so they clearly hold on to the envelope
    const ringR = R(ROPE_T) * 0.99, ringY = ENV_Y + Y(ROPE_T);
    const ring = BABYLON.MeshBuilder.CreateTorus("loadRing", { diameter: ringR * 2, thickness: 0.05, tessellation: 24 }, scene);
    ring.material = mat("ringM", "#5a3d22"); ring.parent = root; ring.position.y = ringY;

    // basket: a square wicker box, a dark rim on top and at the bottom, corner posts, a band in the child's colour
    const wm = new BABYLON.StandardMaterial("bk", scene); wm.diffuseTexture = wicker(scene, hex); wm.specularColor = new BABYLON.Color3(.08, .08, .08);
    const body = BABYLON.MeshBuilder.CreateBox("basket", { width: B, height: BH, depth: B, wrap: true }, scene); body.material = wm; body.parent = root; body.position.y = BY;
    const dark = mat("rim", "#5a3d22");
    for (let k = 0; k < 4; k++) {   // the top rim is a frame of four bars, so the basket stays open
      const bar = BABYLON.MeshBuilder.CreateBox("rimTop", { width: B + 0.08, height: 0.07, depth: 0.07 }, scene); bar.material = dark; bar.parent = root;
      const a = (k * Math.PI) / 2; bar.rotation.y = a; bar.position.set(Math.sin(a) * (B / 2 + 0.005), BY + BH / 2, Math.cos(a) * (B / 2 + 0.005)); }
    const rimBot = BABYLON.MeshBuilder.CreateBox("rimBot", { width: B + 0.04, height: 0.05, depth: B + 0.04 }, scene); rimBot.material = dark; rimBot.parent = root; rimBot.position.y = BY - BH / 2;
    // the opening: a dark inside seen from above, so the basket looks open, not like a closed box
    const hole = BABYLON.MeshBuilder.CreatePlane("inside", { size: B - 0.04, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene); hole.material = mat("insideM", "#3b2a1a"); hole.parent = root;
    hole.rotation.x = Math.PI / 2; hole.position.y = BY + BH / 2 + 0.004;   // just over the box top, inside the rim frame
    const top = BY + BH / 2 + 0.035, corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => [sx * (B / 2 + 0.01), sz * (B / 2 + 0.01)]);
    for (const [x, z] of corners) { const p = BABYLON.MeshBuilder.CreateBox("post", { width: 0.06, height: BH + 0.06, depth: 0.06 }, scene); p.material = dark; p.parent = root; p.position.set(x, BY, z); }

    // ropes: from each top corner of the basket straight up to the ring on the envelope, at the same angle (45°)
    const rm = mat("rope", "#4a3220");
    for (const [x, z] of corners) {
      const a = Math.atan2(z, x), from = new BABYLON.Vector3(x, top, z), to = new BABYLON.Vector3(Math.cos(a) * ringR, ringY, Math.sin(a) * ringR);
      const rope = BABYLON.MeshBuilder.CreateTube("rope", { path: [from, to], radius: 0.016, tessellation: 6 }, scene); rope.material = rm; rope.parent = root;
      const knot = BABYLON.MeshBuilder.CreateSphere("knot", { diameter: 0.07, segments: 6 }, scene); knot.material = rm; knot.parent = root; knot.position = from.clone();
    }

    for (const m of root.getChildMeshes()) m.isPickable = false;
    // an invisible, finger-size touch area: a tap on the balloon brings it home (unchanged)
    const hit = BABYLON.MeshBuilder.CreateSphere("balloonHit", { diameter: 3.6, segments: 8 }, scene); hit.parent = root; hit.position.y = 0.8;
    hit.visibility = 0; hit.metadata = { balloon: true };
    root.scaling.setAll(scale);   // in scale with the smaller islands
    return root;
  };
})();
