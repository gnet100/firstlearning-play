// The picture leaves its card (Golan 5.11 in the sound wheel; 7.11 for every sound game): after a right answer the drawing
// goes out of its card with a motion that fits it (a car drives off, a bird flies, the dancer pirouettes out, the paratrooper
// drops to the corner...), with a small sound made on the spot (Web Audio, no file). Grown out of sound-wheel's exitPic.
//   FL.picExit.play(el, key, { dur, delay, actx, onDone })  -> true when this picture has an exit (else nothing happens)
//   el = the element that holds only the drawing (an <svg>), never the card itself: the card stays, the drawing leaves it.
//   Its container must not clip it (overflow: visible); the game decides what is shown after (the card stays empty).
//   FL.picExit.has(key)
// The motions (kinds) are the word-pictures thread's to tune: one entry per picture in EXIT, one function per kind in FRAMES.
(function () {
  const FL = (window.FL = window.FL || {});
  // [kind, direction]: -1 = towards the left of the screen, 1 = towards the right
  const EXIT = {
    // animals
    camel: ["walk", -1], "נ": ["slither", -1], "ט": ["walk", -1], "י": ["fly", 1], "א": ["walk", -1], "ח": ["walk", -1], "צ": ["walk", 1],
    tiger: ["walk", -1], rabbit: ["hop", -1], donkey: ["walk", -1], rooster: ["walk", -1], crocodile: ["slither", -1],
    duck: ["waddle", -1], lamb: ["hop", -1],
    // people
    girl: ["run", 1], pilot: ["fly", 1], dancer: ["pirouette", 1], parachutist: ["parachute", -1], carpenter: ["walk", 1], chef: ["walk", -1],
    painter: ["walk", 1], firefighter: ["walk", -1], gnome: ["walk", -1],
    // transport
    "ר": ["drive", 1], ambulance: ["drive", -1], spaceship: ["fly", -1], drone: ["up", 1],
    // things that roll, float or blow away
    wheel: ["roll", -1], buttons: ["roll", 1], "כ": ["bounce", 1], ring: ["roll", -1], plate: ["roll", 1], watermelon: ["roll", -1], orange: ["roll", 1],
    pear: ["roll", -1], "ת": ["roll", 1], ticket: ["wind", 1], "ן": ["float", 1], diamond: ["float", -1], socks: ["hop", 1], shoe: ["hop", -1],
    bottle: ["hop", 1], banana: ["hop", -1],
  };
  const DUR = { walk: 3000, waddle: 3000, slither: 3000, hop: 2600, run: 2000, roll: 2400, bounce: 2400 };   // the rest 2400; a game passes its own dur
  const steps = (n, fn) => Array.from({ length: n + 1 }, (_, i) => fn(i / n, i));
  const fade = (t) => (t > 0.85 ? 0 : 1);
  const FRAMES = {
    drive: (X) => [{ transform: "translateX(0)" }, { transform: `translateX(${X(-6)})`, offset: 0.15 }, { transform: `translateX(${X(190)})`, opacity: 1, offset: 0.85 }, { transform: `translateX(${X(230)})`, opacity: 0 }],
    walk: (X, d) => steps(12, (t, i) => ({ transform: `translate(${X(t * 220)}, ${i % 2 ? -5 : 0}%) rotate(${i % 2 ? d * 3 : 0}deg)`, opacity: fade(t) })),
    waddle: (X) => steps(16, (t, i) => ({ transform: `translate(${X(t * 220)}, ${i % 2 ? -3 : 0}%) rotate(${i % 2 ? 8 : -8}deg)`, opacity: fade(t) })),
    run: (X, d) => steps(14, (t, i) => ({ transform: `translate(${X(t * 240)}, ${i % 2 ? -10 : 0}%) rotate(${d * (i % 2 ? 6 : 2)}deg)`, opacity: fade(t) })),
    hop: (X) => steps(8, (t, i) => ({ transform: `translate(${X(t * 220)}, ${i % 2 ? -16 : 0}%)`, opacity: fade(t) })),
    slither: (X) => steps(12, (t, i) => ({ transform: `translateX(${X(t * 220)}) scaleX(${i % 2 ? 1.08 : 0.94})`, opacity: fade(t) })),
    fly: (X, d) => [{ transform: "translate(0, 0)" }, { transform: `translate(${X(-5)}, 3%)`, offset: 0.15 }, { transform: `translate(${X(140)}, -120%) rotate(${d * -12}deg) scale(.75)`, opacity: 1, offset: 0.85 }, { transform: `translate(${X(170)}, -150%) rotate(${d * -12}deg) scale(.6)`, opacity: 0 }],
    up: (X, d) => [{ transform: "translate(0, 0)" }, { transform: "translate(0, -25%)", offset: 0.35 }, { transform: `translate(${X(140)}, -110%) rotate(${d * 8}deg)`, opacity: 1, offset: 0.85 }, { transform: `translate(${X(170)}, -130%) rotate(${d * 8}deg)`, opacity: 0 }],
    // new 7.11
    roll: (X, d) => steps(12, (t) => ({ transform: `translateX(${X(t * t * 230)}) rotate(${d * t * t * 720}deg)`, opacity: fade(t) })),
    bounce: (X, d) => steps(12, (t, i) => ({ transform: `translate(${X(t * 220)}, ${i % 2 ? -22 * (1 - t) : 0}%) rotate(${d * t * 360}deg)`, opacity: fade(t) })),
    pirouette: (X) => steps(16, (t) => ({ transform: `translate(${X(t * 200)}, ${-8 * Math.sin(t * Math.PI)}%) scaleX(${Math.cos(t * Math.PI * 8).toFixed(3)})`, opacity: fade(t) })),
    parachute: (X) => steps(12, (t) => ({ transform: `translate(${X(t * 150)}, ${t * 150}%) rotate(${(Math.sin(t * Math.PI * 4) * 10).toFixed(1)}deg) scale(${1 - t * 0.3})`, opacity: fade(t) })),
    wind: (X) => steps(14, (t) => ({ transform: `translate(${X(t * 200)}, ${-t * 90 + Math.sin(t * Math.PI * 5) * 10}%) rotate(${(Math.sin(t * Math.PI * 6) * 35).toFixed(1)}deg) scale(${1 - t * 0.35})`, opacity: fade(t) })),
    float: (X) => steps(12, (t) => ({ transform: `translate(${X(Math.sin(t * Math.PI * 3) * 14)}, ${-t * 170}%) rotate(${(Math.sin(t * Math.PI * 3) * 6).toFixed(1)}deg)`, opacity: fade(t) })),
  };
  const LINEAR = new Set(["walk", "waddle", "run", "hop", "slither", "pirouette", "parachute", "wind", "float", "bounce"]);

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
      } else if (kind === "float") {   // a soft rising tone
        osc(t0, D * 0.9, "sine", 420, 900, 0.07);
      }
    } catch (e) {}
  }

  function play(el, key, opt = {}) {
    const e = EXIT[key]; if (!e || !el || !el.animate) return false;
    const [kind, d] = e, X = (v) => `${d * v}%`, frames = FRAMES[kind](X, d);
    const dur = opt.dur || DUR[kind] || 2400, delay = opt.delay || 0;
    if (el._flExit) el._flExit.cancel();
    const go = () => {
      if (!el.isConnected) return;
      sound(opt.actx, key === "ר" ? "train" : key === "י" ? "wings" : kind, dur / 1000);
      const an = (el._flExit = el.animate(frames, { duration: dur, easing: LINEAR.has(kind) ? "linear" : "ease-in", fill: "forwards" }));
      an.onfinish = () => { if (el._flExit === an) el._flExit = null; if (opt.onDone) opt.onDone(); };
    };
    if (delay) setTimeout(go, delay); else go();
    return true;
  }
  FL.picExit = { play, has: (k) => !!EXIT[k], EXIT, FRAMES, sound };
})();
