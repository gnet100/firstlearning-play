// The picture leaves its card (Golan 5.11 in the sound wheel; 7.11 for every sound game): after a right answer the drawing
// goes out of its card with a motion that fits it (a car drives off, a bird flies, the dancer pirouettes out, the paratrooper
// drops to the corner...), with a small sound made on the spot (Web Audio, no file). Grown out of sound-wheel's exitPic.
//   FL.picExit.play(el, key, { dur, delay, actx, onDone })  -> true when this picture has an exit (else nothing happens)
//   el = the element that holds only the drawing (an <svg>), never the card itself: the card stays, the drawing leaves it.
//   Its container clips it (overflow: hidden, Golan 7.11): the motion stays inside the card and fades away there; the card stays empty after.
//   FL.picExit.has(key)
// The motions (kinds) are the word-pictures thread's to tune: one entry per picture in EXIT, one function per kind in FRAMES.
(function () {
  const FL = (window.FL = window.FL || {});
  // [kind, direction]: -1 = towards the left of the screen, 1 = towards the right
  const EXIT = {
    // animals
    camel: ["walk", -1], "נ": ["slither", -1], "ט": ["walk", -1], "י": ["fly", 1], "א": ["walk", -1], "ח": ["walk", -1], "צ": ["plod", 1],
    tiger: ["walk", -1], rabbit: ["hop", -1], donkey: ["walk", -1], rooster: ["walk", -1], crocodile: ["slither", -1],
    duck: ["waddle", -1], turtle: ["plod", 1], frog: ["hop", 1], scarf: ["wind", 1],
    // people
    girl: ["twirl", 1],   // Golan 7.11: "the girl turns slowly, one turn, in 3D" as she leaves
    pilot: ["plane", 1], dancer: ["dance", 1],   // Golan 7.11: she dances on her way out (little hops, arms moving) and turns round in 3D
    parachutist: ["parachute", -1], chef: ["walk", -1],
    painter: ["walk", 1], firefighter: ["walk", -1], gnome: ["walk", -1],
    // transport
    "ר": ["drive", 1], ambulance: ["drive", -1], spaceship: ["fly", -1], drone: ["up", 1],
    // things that roll, float or blow away
    wheel: ["roll", -1], buttons: ["roll", 1], "כ": ["bounce", 1], ring: ["grab", 1], plate: ["roll", 1], watermelon: ["roll", -1], orange: ["roll", 1],
    pear: ["roll", -1], "ת": ["roll", 1], ticket: ["wind", 1],
    // stage 2 (Golan 7.11 "בצע"): the places sink or flow away, the things move their own way out
    "ב": ["sink", 1], window: ["sink", 1], trafficLight: ["sink", 1], swing: ["sink", 1], "ם": ["flow", 1],
    hand: ["sink", 1], teaspoon: ["bounce", 1], trumpet: ["float", 1], rattle: ["hop", 1],
    // the sound wheel's own drawings (WHEEL_PICTURES; whole-picture motion only): transport keeps the old wheel directions, toys get one each
    plane: ["fly", -1], helicopter: ["up", -1], truck: ["drive", -1], fireTruck: ["drive", -1],
    slide: ["sink", 1], kite: ["fly", 1], mask: ["float", 1], puzzle: ["hop", 1], windmill: ["up", 1], stream: ["flow", 1], fence: ["sink", 1],   // Golan 7.11: the places leave too: the windmill flies off on its sails, the stream flows away down, the fence sinks into the ground
    "ן": ["float", 1], diamond: ["grab", 1], oven: ["hop", 1], socks: ["hop", 1], shoe: ["hop", -1],
    bottle: ["hop", 1], banana: ["hop", -1],
  };
  // Golan 7.11 (2nd ask): every exit stays INSIDE its card, like the hot-air balloon on the memory game's hint card (memRise):
  // the card clips the picture, which moves on its own path until it has passed the card's edge, so it disappears bit by bit
  // as it goes out. Slower than before (SLOW multiplies every length, also a game's own dur). It starts gently and speeds up.
  const SLOW = 1.5;
  const DUR = { dance: 4200, twirl: 3400, wind: 3200, plod: 3400, grab: 2800, walk: 3000, waddle: 3000, slither: 3000, hop: 2600, run: 2200, roll: 2600, bounce: 2600 };   // the rest 2400; a game passes its own dur
  const steps = (n, fn) => Array.from({ length: n + 1 }, (_, i) => fn(i / n, i));
  const fade = (t) => (t > 0.96 ? 0 : 1);   // no fade on the way: the card's edge hides it; only made invisible at the very end
  const S = (n, fn) => steps(n, (t, i) => ({ transform: fn(t, i), opacity: fade(t) }));
  const E = 120;   // how far (in % of the picture box) it travels: past the card's edge
  const GRAB_ANG = 35, GRAB_DX = 1.2 * Math.sin(GRAB_ANG * Math.PI / 180), GRAB_DY = 1.2 * Math.cos(GRAB_ANG * Math.PI / 180);   // the hand's slant and its way in/out
  const FRAMES = {
    drive: (X) => S(14, (t) => `translateX(${X(t < 0.12 ? -3 * t / 0.12 : -3 + Math.pow((t - 0.12) / 0.88, 1.6) * (E + 3))})`),
    walk: (X, d) => S(18, (t, i) => `translate(${X(t * E)}, ${i % 2 ? -3 : 0}%) rotate(${i % 2 ? d * 3 : 0}deg)`),
    waddle: (X) => S(20, (t, i) => `translate(${X(t * E)}, ${i % 2 ? -2 : 0}%) rotate(${i % 2 ? 7 : -7}deg)`),
    run: (X, d) => S(18, (t, i) => `translate(${X(t * E)}, ${i % 2 ? -6 : 0}%) rotate(${d * (i % 2 ? 5 : 2)}deg)`),
    hop: (X) => S(10, (t, i) => `translate(${X(t * E)}, ${i % 2 ? -12 : 0}%)`),
    slither: (X) => S(16, (t, i) => `translateX(${X(t * E)}) scaleX(${i % 2 ? 1.06 : 0.95})`),
    fly: (X, d) => S(14, (t) => `translate(${X(-3 * Math.sin(Math.min(t / 0.15, 1) * Math.PI) + t * t * 100)}, ${-t * t * 100}%) rotate(${d * -12 * t}deg)`),
    up: (X, d) => S(14, (t) => `translate(${X(t * t * 25)}, ${-t * t * E}%) rotate(${d * 6 * t}deg)`),
    roll: (X, d) => S(16, (t) => `translateX(${X(t * t * E)}) rotate(${d * t * t * 600}deg)`),
    bounce: (X, d) => S(14, (t, i) => `translate(${X(t * E)}, ${i % 2 ? -14 * (1 - t) : 0}%) rotate(${d * t * 360}deg)`),
    pirouette: (X) => S(48, (t) => `translate(${X(t * 115)}, ${-5 * Math.sin(t * Math.PI)}%) perspective(700px) rotateY(${(t * 4 * 360).toFixed(0)}deg) rotateZ(${(Math.sin(t * Math.PI * 8) * 3).toFixed(1)}deg)`),   // Golan 7.11: turns round in 3D (perspective), not a flat flip
    parachute: (X) => S(16, (t) => `translate(${X(t * 100)}, ${t * 115}%) rotate(${(Math.sin(t * Math.PI * 3) * 8).toFixed(1)}deg)`),   // down and to the corner
    wind: (X) => S(24, (t) => { if (t < 0.3) return `rotate(${(Math.sin(t * 60) * 4).toFixed(1)}deg)`;   // Golan 7.11: first the wind blows on it (it shivers), then it pushes it straight to the side
      const u = (t - 0.3) / 0.7; return `translate(${X(u * u * 125)}, ${(Math.sin(u * Math.PI * 4) * 2).toFixed(1)}%) rotate(${(Math.sin(u * Math.PI * 5) * 8).toFixed(1)}deg)`; }),
    float: (X) => S(14, (t) => `translate(${X(Math.sin(t * Math.PI * 2) * 6)}, ${-t * t * E}%) rotate(${(Math.sin(t * Math.PI * 2) * 5).toFixed(1)}deg)`),
    dance: (X) => S(48, (t) => `translate(${X(t * 115)}, ${(-6 * Math.abs(Math.sin(t * Math.PI * 6))).toFixed(1)}%) perspective(700px) rotateY(${(t * 720).toFixed(0)}deg) rotateZ(${(Math.sin(t * Math.PI * 6) * 5).toFixed(1)}deg)`),
    twirl: (X) => S(36, (t) => `translate(${X(t * 115)}, ${-4 * Math.sin(t * Math.PI)}%) perspective(700px) rotateY(${(t * 360).toFixed(0)}deg)`),
    flow: () => S(14, (t) => `translateY(${(t * t * E).toFixed(1)}%)`),
    sink: (X) => S(24, (t, i) => `translate(${X(i % 2 ? 1.2 : -1.2)}, ${(t * t * E).toFixed(1)}%)`),
    plod: (X, d) => S(20, (t, i) => `translate(${X(t * 115)}, ${i % 2 ? -1.5 : 0}%) rotate(${i % 2 ? d * 2 : -d}deg)`),
    plane: (X, d) => S(18, (t) => { const run = Math.min(t / 0.45, 1), up = Math.max(0, (t - 0.35) / 0.65);
      return `translate(${X(run * run * 30 + up * 90)}, ${-up * up * 100}%) rotate(${-d * Math.min(up * 3, 1) * 12}deg)`; }),
    // Golan 7.11: "a hand comes into the card, takes the ring, and goes out" (ring + diamond): the picture waits for the hand,
    // gives a little squeeze, then is carried up and out through the card's top edge (the card clips it; the hand is added in play())
    // Golan 7.11: the hand comes in from the card's TOP CORNER (on the exit side), not straight from above, and leaves back that way with it
    grab: (X) => [{ transform: "translate(0, 0)", offset: 0 }, { transform: "translate(0, 0)", offset: 0.4 }, { transform: "translate(0, 1%) scale(.96,.92)", offset: 0.48 },
      { transform: "translate(0, 0) scale(1)", offset: 0.56 }, { transform: `translate(${X(GRAB_DX * 100)}, ${-GRAB_DY * 100}%)`, opacity: 1, offset: 0.97 }, { transform: `translate(${X(GRAB_DX * 100)}, ${-GRAB_DY * 100}%)`, opacity: 0, offset: 1 }],
  };
  const NO_SHADOW = new Set(["dance", "twirl", "up", "flow", "sink", "roll", "bounce", "wind", "pirouette", "float", "grab"]);
  const LINEAR = new Set(["dance", "twirl", "flow", "sink", "drive", "fly", "up", "roll", "plod", "plane", "grab", "walk", "waddle", "run", "hop", "slither", "pirouette", "parachute", "wind", "float", "bounce"]);

  // ---- the sounds (from sound-wheel's exitSound) ----
  let noiseBuf = null;
  function sound(actx, kind, D) {
    if (!actx) return;
    try {
      const t0 = actx.currentTime, out = actx.createGain(); out.gain.value = 1; out.connect(actx.destination);
      if (!noiseBuf || noiseBuf.sampleRate !== actx.sampleRate) { noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      const noise = (t, len, type, f, q, vol, f2) => { const n = actx.createBufferSource(), fl = actx.createBiquadFilter(), g = actx.createGain(); n.buffer = noiseBuf; n.loop = true;
        fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + len); fl.Q.value = q;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.05, len / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        n.connect(fl).connect(g).connect(out); n.start(t); n.stop(t + len + 0.05); };
      const osc = (t, len, type, f, f2, vol) => { const o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + len);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.04, len / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + len); o.connect(g).connect(out); o.start(t); o.stop(t + len + 0.05); };
      if (kind === "drive") {
        const o = actx.createOscillator(), lfo = actx.createOscillator(), lg = actx.createGain(), fl = actx.createBiquadFilter(), g = actx.createGain();
        o.type = "sawtooth"; o.frequency.setValueAtTime(55, t0); o.frequency.linearRampToValueAtTime(95, t0 + D * 0.8);
        lfo.frequency.value = 22; lg.gain.value = 12; lfo.connect(lg).connect(o.frequency);
        fl.type = "lowpass"; fl.frequency.value = 420; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.25); g.gain.setValueAtTime(0.16, t0 + D * 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t0 + D);
        o.connect(fl).connect(g).connect(out); o.start(t0); lfo.start(t0); o.stop(t0 + D + 0.05); lfo.stop(t0 + D + 0.05);
        osc(t0, 0.25, "square", 520, 0, 0.05); osc(t0 + 0.3, 0.25, "square", 520, 0, 0.05);
      } else if (kind === "train") {
        osc(t0, 0.5, "triangle", 880, 0, 0.12); osc(t0, 0.5, "triangle", 1100, 0, 0.08);
        let t = t0 + 0.45, gap = 0.36; while (t < t0 + D - 0.1) { noise(t, 0.16, "bandpass", 900, 0.8, 0.22); t += gap; gap = Math.max(0.18, gap * 0.92); }
      } else if (kind === "fly") {
        noise(t0 + 0.2, D - 0.2, "bandpass", 300, 1.2, 0.2, 2400); osc(t0 + 0.2, D - 0.2, "sawtooth", 90, 160, 0.05);
      } else if (kind === "up") {
        for (let t = t0; t < t0 + D - 0.05; t += 0.09) noise(t, 0.07, "lowpass", 260, 1, 0.3 * Math.max(0.15, 1 - (t - t0) / D));
      } else if (kind === "wings") {
        for (let t = t0 + 0.2; t < t0 + D - 0.1; t += 0.26) noise(t, 0.12, "bandpass", 700, 1.5, 0.22);
      } else if (kind === "walk" || kind === "waddle") {
        for (let i = 1; i < 12; i++) osc(t0 + (D * i) / 12, 0.09, "sine", kind === "waddle" ? 220 : 150, 70, 0.28 * (1 - i / 14));
      } else if (kind === "run") {
        for (let i = 1; i < 14; i++) osc(t0 + (D * i) / 14, 0.07, "sine", 190, 90, 0.26 * (1 - i / 16));
      } else if (kind === "hop" || kind === "bounce") {
        for (let i = 0; i < 4; i++) osc(t0 + (D * (i * 2 + 0.3)) / 8, 0.28, "sine", 260, 620, 0.16);
      } else if (kind === "slither") {
        noise(t0 + 0.1, D - 0.2, "highpass", 3500, 0.7, 0.07);
      } else if (kind === "roll") {   // a soft rumble that rolls away
        noise(t0, D, "lowpass", 380, 0.8, 0.22, 160);
      } else if (kind === "pirouette") {   // little bells going up
        [0, 0.18, 0.36, 0.54, 0.72].forEach((s, i) => osc(t0 + s * D, 0.35, "sine", 660 * Math.pow(1.19, i), 0, 0.09));
      } else if (kind === "parachute") {   // a soft whoosh down
        noise(t0, D, "bandpass", 1200, 0.9, 0.12, 300);
      } else if (kind === "wind") {   // a gust
        noise(t0, D, "bandpass", 500, 0.6, 0.2, 1600);
      } else if (kind === "plod") {   // slow soft steps
        for (let i = 1; i < 9; i++) osc(t0 + (D * i) / 9, 0.14, "sine", 120, 60, 0.26 * (1 - i / 11));
      } else if (kind === "plane") {   // a propeller hum that gets higher as it climbs
        const o = actx.createOscillator(), g = actx.createGain(), lfo = actx.createOscillator(), lg = actx.createGain();
        o.type = "sawtooth"; o.frequency.setValueAtTime(70, t0); o.frequency.exponentialRampToValueAtTime(170, t0 + D * 0.9); lfo.frequency.value = 30; lg.gain.value = 0.05; lfo.connect(lg).connect(g.gain);
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t0 + D);
        o.connect(g).connect(out); o.start(t0); lfo.start(t0); o.stop(t0 + D + 0.05); lfo.stop(t0 + D + 0.05);
      } else if (kind === "grab") {   // a whoosh down, a little "pop" when it takes it, a sparkle going up
        noise(t0, D * 0.35, "bandpass", 1600, 0.8, 0.12, 500); osc(t0 + D * 0.45, 0.12, "sine", 300, 600, 0.18);
        [0.6, 0.7, 0.8].forEach((s, i) => osc(t0 + s * D, 0.3, "sine", 1050 * Math.pow(1.26, i), 0, 0.07));
      } else if (kind === "float") {   // a soft rising tone
        osc(t0, D * 0.9, "sine", 420, 900, 0.07);
      }
    } catch (e) {}
  }

  // a big friendly hand that comes down from above the picture, takes it and goes up with it (Golan 7.11: the diamond)
  const HAND = `<svg viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;overflow:visible"><g stroke="#3B2F2F" stroke-width="8" stroke-linejoin="round" stroke-linecap="round">` +
    `<rect x="58" y="-60" width="84" height="180" fill="#5BA8F0"/><rect x="48" y="108" width="104" height="32" rx="12" fill="#FFFFFF"/>` +
    `<path d="M150,160 Q192,168 186,212 Q170,220 150,198Z" fill="#FFD9B8"/>` +
    `<path d="M52,140 Q42,200 58,232 L142,232 Q158,200 148,140Z" fill="#FFD9B8"/>` +
    `<rect x="54" y="196" width="24" height="78" rx="12" fill="#FFD9B8"/><rect x="80" y="200" width="24" height="88" rx="12" fill="#FFD9B8"/>` +
    `<rect x="106" y="200" width="24" height="86" rx="12" fill="#FFD9B8"/><rect x="132" y="196" width="22" height="72" rx="11" fill="#FFD9B8"/></g></svg>`;
  function hand(el, dur, delay, d) {   // inside the picture's own container (it clips), so the hand comes in from the card's top corner
    const go = () => {
      const box = el.parentElement, r = el.getBoundingClientRect(); if (!box || !r.width) return;   // (an <svg> has no offsetWidth)
      if (getComputedStyle(box).position === "static") box.style.position = "relative";
      const br = box.getBoundingClientRect(), w = r.width, hgt = r.height, H = hgt * 0.9, W = w * 0.6, h = document.createElement("div");
      const x0 = r.left - br.left - box.clientLeft + box.scrollLeft, y0 = r.top - br.top - box.clientTop + box.scrollTop;
      // the fingertips (50% 90% of the hand) rest on the top of the picture; the arm slants up towards the corner on the exit side
      h.style.cssText = `position:absolute;left:${x0 + w * 0.5 - W / 2}px;top:${y0 + hgt * 0.42 - H * 0.9}px;width:${W}px;height:${H}px;z-index:5;pointer-events:none;transform-origin:50% 90%`;
      h.innerHTML = HAND; box.append(h);
      const rot = `rotate(${d * GRAB_ANG}deg)`, dx = d * GRAB_DX * w, dy = -GRAB_DY * hgt;   // the same way the picture goes (grab frames)
      const at = (k) => `translate(${dx * k}px, ${dy * k}px) ${rot}`;
      const an = h.animate([{ transform: at(1), offset: 0 }, { transform: at(0), offset: 0.4, easing: "ease-out" }, { transform: at(0), offset: 0.56 },
        { transform: at(1), opacity: 1, offset: 0.97 }, { transform: at(1), opacity: 0, offset: 1 }], { duration: dur, easing: "linear", fill: "forwards" });
      an.onfinish = an.oncancel = () => h.remove();
    };
    if (delay) setTimeout(go, delay); else go();
  }

  function play(el, key, opt = {}) {
    const e = EXIT[key]; if (!e || !el || !el.animate) return false;
    const [kind, d] = e, X = (v) => `${d * v}%`, frames = FRAMES[kind](X, d);
    const dur = (opt.dur || DUR[kind] || 2400) * SLOW, delay = opt.delay || 0;
    if (el._flExit) el._flExit.cancel();
    const go = () => {
      if (!el.isConnected) return;
      // Golan 7.11: no sounds with the exits (sound() is kept but not played)
      el.classList.add("pa-exit");
      // Golan 7.11: "the buttons should turn without the shadow": for things that turn or blow away, the ground shadow stays out of it
      const shade = NO_SHADOW.has(kind) && el.querySelector('ellipse[fill="#000"]');
      if (shade) { shade.style.transition = "opacity .25s"; shade.style.opacity = "0"; }   // Golan 7.11: the character moves its own body on the way out (pictures-animated "exit" motions: legs run, feet step...)
      const an = (el._flExit = el.animate(frames, { duration: dur, easing: LINEAR.has(kind) ? "linear" : "ease-in", fill: "forwards" }));
      an.onfinish = () => { if (el._flExit === an) el._flExit = null; if (opt.onDone) opt.onDone(); };
      an.oncancel = () => { el.classList.remove("pa-exit"); if (shade) shade.style.opacity = ""; if (el._flExit === an) el._flExit = null; };
    };
    if (kind === "grab") hand(el, dur, delay, d);
    if (delay) setTimeout(go, delay); else go();
    return true;
  }
  FL.picExit = { play, has: (k) => !!EXIT[k], EXIT, FRAMES, sound };
})();
