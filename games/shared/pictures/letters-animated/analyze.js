// Measures every letter's shape (glyphs.json) so build.js can place the face, the arms and the sun without covering the letter.
// Draws each glyph in a headless browser, then finds: the thickest spot near the top (for the face), free spots on the left and right edges (for the arms)
// and which top corner is emptier (for the sun). Writes geometry.json. Run: node analyze.js  (needs playwright; chromium at /opt/pw-browsers/chromium)
const fs = require("fs"), path = require("path");
const { chromium } = require(process.env.PW || "playwright");
const G = JSON.parse(fs.readFileSync(path.join(__dirname, "glyphs.json"), "utf8"));
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }); const p = await b.newPage();
  const geo = await p.evaluate((G) => {
    const N = 500, K = 1000 / N, out = {};
    for (const [ch, g] of Object.entries(G)) {
      const c = document.createElement("canvas"); c.width = c.height = N; const x = c.getContext("2d");
      x.scale(1 / K, 1 / K); x.fill(new Path2D(g.d));
      const a = x.getImageData(0, 0, N, N).data, ink = new Uint8Array(N * N);
      for (let i = 0; i < N * N; i++) ink[i] = a[i * 4 + 3] > 127 ? 1 : 0;
      const at = (X, Y) => X >= 0 && Y >= 0 && X < N && Y < N && ink[Y * N + X];
      // distance to the nearest empty pixel (chamfer 3-4)
      const D = new Float32Array(N * N); for (let i = 0; i < N * N; i++) D[i] = ink[i] ? 1e9 : 0;
      for (let y = 0; y < N; y++) for (let X = 0; X < N; X++) { const i = y * N + X; if (!D[i]) continue; let v = D[i];
        if (X > 0) v = Math.min(v, D[i - 1] + 3); if (y > 0) { v = Math.min(v, D[i - N] + 3); if (X > 0) v = Math.min(v, D[i - N - 1] + 4); if (X < N - 1) v = Math.min(v, D[i - N + 1] + 4); } D[i] = v; }
      for (let y = N - 1; y >= 0; y--) for (let X = N - 1; X >= 0; X--) { const i = y * N + X; if (!D[i]) continue; let v = D[i];
        if (X < N - 1) v = Math.min(v, D[i + 1] + 3); if (y < N - 1) { v = Math.min(v, D[i + N] + 3); if (X < N - 1) v = Math.min(v, D[i + N + 1] + 4); if (X > 0) v = Math.min(v, D[i + N - 1] + 4); } D[i] = v; }
      let max = 0; for (const v of D) if (v < 1e9 && v > max) max = v;
      // face: the highest spot that is nearly as thick as the thickest stroke (thick enough for two eyes and a mouth)
      const need = Math.min(max * 0.88, 3 * 66 / K); let face = null;
      const mid = (g.box[0] + g.box[2]) / 2 / K;
      for (let y = 0; y < N && !face; y++) {   // on the first row thick enough, the thick run nearest the middle of the letter, at the run's centre
        let runs = [], st = -1; for (let X = 0; X <= N; X++) { const ok = X < N && D[y * N + X] >= need; if (ok && st < 0) st = X; if (!ok && st >= 0) { runs.push([st, X - 1]); st = -1; } }
        if (!runs.length) continue; runs.sort((p, q) => Math.abs((p[0] + p[1]) / 2 - mid) - Math.abs((q[0] + q[1]) / 2 - mid));
        face = { X: Math.round((runs[0][0] + runs[0][1]) / 2), y };
      }
      // slide down to the middle of that thick part
      let fy = face.y; while (fy + 1 < N && D[(fy + 1) * N + face.X] >= D[fy * N + face.X]) fy++;
      const fr = D[fy * N + face.X] / 3 * K;
      const [bx0, by0, bx1, by1] = g.box;
      // arms: the outermost ink on a row a bit below the face, so nothing is between the shoulder and the air
      const free = (sx, sy, ang, len) => { for (let t = 40; t <= len + 30; t += 8) { const X = Math.round((sx + Math.cos(ang) * t) / K), Y = Math.round((sy - Math.sin(ang) * t) / K); if (Y < 0 || Y >= N || X < 0 || X >= N) return false; for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) if (at(X + dx, Y + dy)) return false; } return true; };
      function arm(side) {
        const tries = [0.55, 0.45, 0.65, 0.4, 0.7, 0.35, 0.75];
        for (const f of tries) { const yy = Math.round((by0 + (by1 - by0) * f) / K); let X = -1;
          if (side < 0) { for (let i = 0; i < N; i++) if (ink[yy * N + i]) { X = i; break; } } else { for (let i = N - 1; i >= 0; i--) if (ink[yy * N + i]) { X = i; break; } }
          if (X < 0) continue; const sx = X * K + side * -6, sy = yy * K;
          // the most upward free angle (stretch), and a resting one just under it
          let up = null;
          for (let deg = 70; deg >= -20; deg -= 5) { const ang = side < 0 ? Math.PI - deg * Math.PI / 180 : deg * Math.PI / 180; if (free(sx, sy, ang, 150)) { up = deg; break; } }
          if (up === null) continue;
          let rest = null; for (let deg = Math.min(up, -10); deg >= -60; deg -= 5) { const ang = side < 0 ? Math.PI - deg * Math.PI / 180 : deg * Math.PI / 180; if (free(sx, sy, ang, 130)) { rest = deg; break; } }
          return { x: Math.round(sx), y: Math.round(sy), up, rest: rest === null ? up - 25 : rest };
        }
        return null;
      }
      // how much ink is in each top corner (the sun goes in the emptier one)
      const corner = (x0) => { let n = 0; for (let y = 0; y < 300 / K; y++) for (let X = x0 / K; X < (x0 + 300) / K; X++) n += ink[y * N + X]; return n; };
      out[ch] = { box: g.box, face: { x: Math.round(face.X * K), y: Math.round(fy * K), r: Math.round(fr) }, armL: arm(-1), armR: arm(1), inkTL: corner(0), inkTR: corner(700) };
    }
    return out;
  }, G);
  fs.writeFileSync(path.join(__dirname, "geometry.json"), JSON.stringify(geo, null, 1));
  for (const [k, v] of Object.entries(geo)) console.log(k, JSON.stringify(v));
  await b.close();
})();
