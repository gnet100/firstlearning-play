// hub-cards-animated.js: gentle, slow animations for the six game-card pictures on the games screen (index.html).
// Thread "אנימציות לכרטיסי המשחקים" (20.10). Same drawings as the static PICS in index.html, plus soft motion.
// Use: load this file with a script tag, then FL_HUB_PICS[g.pic] instead of PICS[g.pic].
// CSS loops for most of the motion; one small rAF loop moves the detective's magnifying glass (the letter under it looks bigger).
(() => {
  "use strict";
  const L = (x, y, ch, size, fill = "#1d2a3a") => `<text x="${x}" y="${y}" font-size="${size}" font-weight="800" text-anchor="middle" dominant-baseline="central" fill="${fill}" font-family="Noto Sans Hebrew, sans-serif">${ch}</text>`;
  const wheel = (x, y, r, hub) => `<g transform="translate(${x} ${y})"><g class="hca-spin"><circle r="${r}" fill="#2b2f3a"/><circle r="${hub}" fill="#ccc"/><path d="M${-r + 1.5} 0 H${r - 1.5}" stroke="#ccc" stroke-width="1.6" stroke-linecap="round"/></g></g>`;

  const CSS = `
  .hca svg, svg.hca { overflow: hidden; }
  .hca-spin, .hca-spin-r { transform-box: fill-box; transform-origin: center; animation: hca-spin 2.4s linear infinite; }
  .hca-spin-r { animation-direction: reverse; }
  @keyframes hca-spin { to { transform: rotate(360deg); } }
  /* race: the car drives in from the right, out on the left, and comes again (Golan 20.10) */
  .hca-car { animation: hca-drive 8s linear infinite; }
  @keyframes hca-drive { from { transform: translateX(112px); } to { transform: translateX(-112px); } }
  .hca-hum { animation: hca-hum .9s ease-in-out infinite; }
  @keyframes hca-hum { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-.8px); } }
  .hca-sign { transform-box: fill-box; transform-origin: 50% 0; animation: hca-sway 6s ease-in-out infinite; }
  .hca-sign.d2 { animation-delay: -3s; }
  @keyframes hca-sway { 0%, 100% { transform: rotate(-1.5deg); } 50% { transform: rotate(1.5deg); } }
  /* clouds drift slowly (detective) */
  .hca-cloud { animation: hca-cloud 12s ease-in-out infinite; }
  .hca-cloud.d2 { animation-duration: 14s; animation-delay: -6s; } .hca-cloud.d3 { animation-duration: 13s; animation-delay: -3s; }
  @keyframes hca-cloud { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(2px); } }
  /* waking: the letter breathes in its sleep, the z's float up one after another, the sun glows */
  .hca-breathe { transform-box: fill-box; transform-origin: 50% 100%; animation: hca-breathe 4s ease-in-out infinite; }
  @keyframes hca-breathe { 0%, 100% { transform: scale(1, 1); } 50% { transform: scale(1.03, 1.05); } }
  .hca-z { opacity: 0; animation: hca-z 6s ease-in-out infinite; }
  .hca-z.d2 { animation-delay: 2s; } .hca-z.d3 { animation-delay: 4s; }
  @keyframes hca-z { 0% { opacity: 0; transform: translate(0, 4px) scale(.7); } 20% { opacity: 1; } 70% { opacity: 1; } 100% { opacity: 0; transform: translate(-6px, -14px) scale(1.15); } }
  .hca-z text { transform-box: fill-box; }
  .hca-sun { transform-box: fill-box; transform-origin: center; animation: hca-glow 5s ease-in-out infinite; }
  @keyframes hca-glow { 0%, 100% { transform: scale(1); opacity: .35; } 50% { transform: scale(1.25); opacity: .1; } }
  /* together: the three balloons float up and down, each at its own pace; the children wave */
  .hca-bob { transform-box: fill-box; transform-origin: 50% 0; animation: hca-bob 6s ease-in-out infinite; }
  .hca-bob.b2 { animation-duration: 7s; animation-delay: -2.5s; } .hca-bob.b3 { animation-duration: 6.5s; animation-delay: -4.5s; }
  @keyframes hca-bob { 0%, 100% { transform: translateY(0) rotate(-1deg); } 50% { transform: translateY(-3px) rotate(1deg); } }
  .hca-wave { transform-box: fill-box; transform-origin: 0% 100%; animation: hca-wave 3s ease-in-out infinite; }
  .hca-wave.b2 { animation-delay: -1s; } .hca-wave.b3 { animation-delay: -2s; }
  @keyframes hca-wave { 0%, 60%, 100% { transform: rotate(0); } 70%, 90% { transform: rotate(-14deg); } 80% { transform: rotate(6deg); } }
  /* train: it drives to the left: the sleepers slide right, the cars rock a little, smoke puffs drift back from the chimney */
  .hca-rail { animation: hca-rail 1.4s linear infinite; }
  @keyframes hca-rail { to { stroke-dashoffset: -14; } }
  .hca-rock { animation: hca-hum 1s ease-in-out infinite; } .hca-rock.d2 { animation-delay: -.33s; } .hca-rock.d3 { animation-delay: -.66s; }
  .hca-puff { opacity: 0; transform-box: fill-box; transform-origin: center; animation: hca-puff 4.5s ease-out infinite; }
  .hca-puff.d2 { animation-delay: 1.5s; } .hca-puff.d3 { animation-delay: 3s; }
  @keyframes hca-puff { 0% { opacity: 0; transform: translate(0, 0) scale(.5); } 15% { opacity: .9; } 100% { opacity: 0; transform: translate(16px, -26px) scale(1.6); } }
  /* circle: the ring turns slowly clockwise, like in the game, and the letters stay upright */
  .hca-ring { transform-origin: 80px 50px; animation: hca-spin 40s linear infinite; }
  .hca-up { transform-box: fill-box; transform-origin: center; animation: hca-spin 40s linear infinite reverse; }
  /* mole (Golan 21.10): the two moles take turns popping up out of their holes with their letter signs */
  .hca-pop { animation: hca-pop 5s ease-in-out infinite; } .hca-pop.d2 { animation-delay: -2.5s; }
  @keyframes hca-pop { 0%, 8% { transform: translateY(64px); } 22%, 62% { transform: translateY(0); } 26% { transform: translateY(-2px); } 76%, 100% { transform: translateY(64px); } }
  /* memory: the two matching cards lean toward each other, little hearts float up, the night cards' stars twinkle */
  .hca-lean { transform-box: fill-box; transform-origin: 50% 100%; animation: hca-lean 3.2s ease-in-out infinite; } .hca-lean.d2 { animation-direction: reverse; }
  @keyframes hca-lean { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(4deg); } }
  .hca-heart { opacity: 0; transform-box: fill-box; transform-origin: center; animation: hca-heart 3.6s ease-out infinite; } .hca-heart.d2 { animation-delay: 1.2s; } .hca-heart.d3 { animation-delay: 2.4s; }
  @keyframes hca-heart { 0% { opacity: 0; transform: translateY(6px) scale(.6); } 20% { opacity: 1; } 100% { opacity: 0; transform: translateY(-18px) scale(1.15); } }
  .hca-twinkle { animation: hca-twinkle 2.4s ease-in-out infinite; } .hca-twinkle.d2 { animation-delay: -.8s; } .hca-twinkle.d3 { animation-delay: -1.6s; }
  @keyframes hca-twinkle { 0%, 100% { opacity: 1; } 50% { opacity: .25; } }
  .hca-float { animation: hca-float 5s ease-in-out infinite; }
  @keyframes hca-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
  /* song: the letters hop one after another to the beat, notes float up, the moon glows */
  .hca-hop { animation: hca-hop 2.4s ease-in-out infinite; } .hca-hop.d2 { animation-delay: .4s; } .hca-hop.d3 { animation-delay: .8s; }
  @keyframes hca-hop { 0%, 30%, 100% { transform: translateY(0); } 12% { transform: translateY(-8px); } 20% { transform: translateY(1px); } }
  .hca-note { opacity: 0; transform-box: fill-box; transform-origin: center; animation: hca-note 3.6s ease-out infinite; } .hca-note.d2 { animation-delay: 1.2s; } .hca-note.d3 { animation-delay: 2.4s; }
  @keyframes hca-note { 0% { opacity: 0; transform: translate(0, 6px) rotate(-10deg); } 20% { opacity: 1; } 100% { opacity: 0; transform: translate(6px, -18px) rotate(10deg); } }
  @media (prefers-reduced-motion: reduce) { [class*="hca-"] { animation: none !important; } }`;

  // ---------- detective: a glass that wanders between the clouds; inside it the scene is drawn again, bigger ----------
  const MAG = 1.45, LENS = 17;   // magnification, inner lens radius (the frame is drawn outside it)
  const detScene = (bg) => `<rect width="160" height="100" fill="${bg}"/><g class="hca-cloud"><g fill="#fff"><ellipse cx="40" cy="40" rx="30" ry="16"/><ellipse cx="60" cy="32" rx="20" ry="16"/></g>${L(48, 38, "ש", 22, "#7c5cff")}</g>
    <g class="hca-cloud d2"><g fill="#fff"><ellipse cx="118" cy="62" rx="30" ry="15"/><ellipse cx="102" cy="56" rx="16" ry="13"/></g>${L(116, 62, "ג", 20, "#ff5a8a")}</g>
    <g class="hca-cloud d3"><g fill="#fff"><ellipse cx="128" cy="24" rx="22" ry="12"/><ellipse cx="114" cy="20" rx="12" ry="10"/></g>${L(122, 23, "ד", 18, "#2bb673")}</g>`;
  const detective = `<svg class="hca hca-det" viewBox="0 0 160 100"><defs><clipPath id="hca-lens"><circle class="hca-lc" cx="48" cy="38" r="${LENS}"/></clipPath></defs>
    <g>${detScene("#e4f6ff")}</g>
    <g clip-path="url(#hca-lens)"><g class="hca-mag">${detScene("#eef9ff")}</g></g>
    <g class="hca-glass" transform="translate(48 38)"><g transform="rotate(-20)"><circle r="${LENS + 2}" fill="none" stroke="#3b2a20" stroke-width="6"/><path d="M-11 -6 A12 12 0 0 1 -4 -12" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".8"/><rect x="-4" y="${LENS + 4}" width="8" height="26" rx="4" fill="#3b2a20"/></g></g></svg>`;
  // the route: rest over ש, glide to ד, rest, glide to ג, rest, back to ש (a slight arc on the way, a tiny drift while resting)
  const STOPS = [[48, 38], [122, 23], [116, 62]], REST = 2600, GLIDE = 3200, LOOP = STOPS.length * (REST + GLIDE);
  const ease = (u) => u * u * (3 - 2 * u);
  function lensAt(t) {
    t %= LOOP; const step = REST + GLIDE, leg = Math.floor(t / step), u = t - leg * step;
    const a = STOPS[leg], b = STOPS[(leg + 1) % STOPS.length];
    if (u < REST) { const w = (u / REST) * Math.PI * 2; return [a[0] + Math.sin(w) * .8, a[1] + Math.sin(w * 2) * .5]; }
    const k = ease((u - REST) / GLIDE), arc = Math.sin(k * Math.PI) * (leg % 2 ? 6 : -6);
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k + arc];
  }
  const still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let t0 = 0;
  function tick(now) {
    const els = document.querySelectorAll("svg.hca-det");
    if (els.length && !document.hidden) {
      if (!t0) t0 = now;
      const [x, y] = still ? STOPS[0] : lensAt(now - t0);
      for (const s of els) {
        s.querySelector(".hca-glass").setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
        const c = s.querySelector(".hca-lc"); c.setAttribute("cx", x.toFixed(2)); c.setAttribute("cy", y.toFixed(2));
        // scale MAG around the lens centre: what is under the glass shows bigger inside it
        s.querySelector(".hca-mag").setAttribute("transform", `translate(${(x * (1 - MAG)).toFixed(2)} ${(y * (1 - MAG)).toFixed(2)}) scale(${MAG})`);
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ---------- the other five ----------
  const car = `<svg class="hca" viewBox="0 0 160 100"><rect y="70" width="160" height="30" fill="#8fd18a"/><path d="M0 78 H160" stroke="#fff" stroke-width="3" stroke-dasharray="12 10"/>
      <g><rect x="18" y="20" width="8" height="54" rx="3" fill="#ff5a4e"/><rect x="62" y="20" width="8" height="54" rx="3" fill="#ff5a4e"/><g class="hca-sign"><rect x="18" y="16" width="52" height="22" rx="8" fill="#fff" stroke="#ff5a4e" stroke-width="3"/>${L(44, 27, "ב", 18)}</g></g>
      <g><rect x="92" y="20" width="8" height="54" rx="3" fill="#3da5ff"/><rect x="136" y="20" width="8" height="54" rx="3" fill="#3da5ff"/><g class="hca-sign d2"><rect x="92" y="16" width="52" height="22" rx="8" fill="#fff" stroke="#3da5ff" stroke-width="3"/>${L(118, 27, "מ", 18)}</g></g>
      <defs><clipPath id="hca-road-clip"><rect width="160" height="100"/></clipPath></defs><g clip-path="url(#hca-road-clip)"><g class="hca-car"><g transform="translate(52 56)"><g class="hca-hum"><rect x="0" y="12" width="56" height="18" rx="8" fill="#ff8a3d"/><path d="M12 12 Q18 0 30 0 H38 Q46 0 48 12 Z" fill="#ffc233"/><rect x="24" y="3" width="12" height="9" rx="2" fill="#bfe6ff"/></g>
      ${wheel(14, 31, 7, 3).replace("hca-spin", "hca-spin-r")}${wheel(44, 31, 7, 3).replace("hca-spin", "hca-spin-r")}</g></g></g></svg>`;

  const waking = `<svg class="hca" viewBox="0 0 160 100"><circle class="hca-sun" cx="22" cy="20" r="12" fill="#ffe066"/><path d="M18 8.6 A12 12 0 1 1 10.4 27 A9.5 9.5 0 1 0 18 8.6 Z" fill="#ffd43b"/>
      <g transform="translate(100 52)"><g class="hca-breathe"><rect x="-32" y="-34" width="64" height="68" rx="22" fill="#b197fc"/>${L(0, 2, "ב", 50, "#fff")}
      <path d="M-14 -16 q5 4 10 0 M6 -16 q5 4 10 0" stroke="#1d2a3a" stroke-width="3" fill="none" stroke-linecap="round"/></g></g>
      <g fill="#7c5cff" font-weight="800" font-family="sans-serif"><g class="hca-z"><text x="58" y="52" font-size="14">z</text></g><g class="hca-z d2"><text x="58" y="52" font-size="17">z</text></g><g class="hca-z d3"><text x="58" y="52" font-size="20">z</text></g></g></svg>`;

  const tellme = `<svg class="hca" viewBox="0 0 160 100" role="img" aria-label="כדורים פורחים: אמא ובן, אבא ובן, אמא ובת"><g transform="translate(38 3) scale(0.84)"><g class="hca-bob b2"><g transform="translate(50 0) scale(.78) translate(-50 0)"><path d="M50 3 C25 3 14 20 18 37 C21 48 34 53 40 58 L60 58 C66 53 79 48 82 37 C86 20 75 3 50 3 Z" fill="#4dabf7"/><path d="M50 3 C40 4 34 20 36 37 C37 48 40 53 43 58 L57 58 C60 53 63 48 64 37 C66 20 60 4 50 3 Z" fill="#fff"/><path d="M50 3 C46 7 45 22 46 37 C46.5 48 48 53 48.5 58 L51.5 58 C52 53 53.5 48 54 37 C55 22 54 7 50 3 Z" fill="#4dabf7"/><ellipse cx="37" cy="17" rx="4.5" ry="8" fill="#fff" opacity=".35" transform="rotate(20 37 17)"/></g><path d="M41 45 L30 70 M59 45 L70 70" stroke="#7A4E27" stroke-width="1.4"/><ellipse cx="40" cy="74" rx="12.5" ry="8.5" fill="#2fb36b"/><ellipse cx="62" cy="76" rx="8.5" ry="6" fill="#3DA5FF"/><circle cx="40" cy="57" r="9" fill="#f6cba5"/><path d="M31 55 Q31 47 40 47 Q49 47 49 55 Q47 51 44 51 Q38 52 31 55 Z" fill="#3a2a22"/><circle cx="37" cy="58.5" r="1.2" fill="#3a2a22"/><circle cx="43" cy="58.5" r="1.2" fill="#3a2a22"/><path d="M37.3 62 Q40 64.5 42.7 62" stroke="#b5533c" stroke-width="1.3" fill="none" stroke-linecap="round"/><path class="hca-wave b2" d="M68 74 Q74 64 71 54" stroke="#f6cba5" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="62" cy="64" r="7" fill="#f6cba5"/><path d="M55 63 Q55.5 55.5 62.5 56 Q69.5 56.5 69 63 Q63 59 55 63 Z" fill="#8a5a2b"/><circle cx="59.6" cy="65" r="1" fill="#3a2a22"/><circle cx="64.4" cy="65" r="1" fill="#3a2a22"/><path d="M60 68 Q62 70 64 68" stroke="#b5533c" stroke-width="1.2" fill="none" stroke-linecap="round"/><path d="M48 75 Q53 71 57 74" stroke="#f6cba5" stroke-width="3.6" fill="none" stroke-linecap="round"/><path d="M24 74 H76 L72 96 Q50 99 28 96 Z" fill="#C98A4B"/><rect x="22" y="71" width="56" height="6" rx="3" fill="#8A5A2B"/><path d="M33 80 V95 M43 80 V97 M57 80 V97 M67 80 V95" stroke="#A8743F" stroke-width="1.5"/></g></g><g transform="translate(90 10) scale(0.84)"><g class="hca-bob b3"><g transform="translate(50 0) scale(.78) translate(-50 0)"><path d="M50 3 C25 3 14 20 18 37 C21 48 34 53 40 58 L60 58 C66 53 79 48 82 37 C86 20 75 3 50 3 Z" fill="#FF5A4E"/><path d="M50 3 C40 4 34 20 36 37 C37 48 40 53 43 58 L57 58 C60 53 63 48 64 37 C66 20 60 4 50 3 Z" fill="#fff"/><path d="M50 3 C46 7 45 22 46 37 C46.5 48 48 53 48.5 58 L51.5 58 C52 53 53.5 48 54 37 C55 22 54 7 50 3 Z" fill="#FF5A4E"/><ellipse cx="37" cy="17" rx="4.5" ry="8" fill="#fff" opacity=".35" transform="rotate(20 37 17)"/></g><path d="M41 45 L30 70 M59 45 L70 70" stroke="#7A4E27" stroke-width="1.4"/><circle cx="40" cy="55" r="11" fill="#6b3a1e"/><circle cx="31" cy="48" r="4.5" fill="#6b3a1e"/><ellipse cx="40" cy="74" rx="12" ry="8" fill="#7C5CFF"/><ellipse cx="62" cy="76" rx="8.5" ry="6" fill="#3DA5FF"/><circle cx="40" cy="57" r="9" fill="#f6cba5"/><path d="M31 56 Q33 46 42 47 Q49 48 49 55 Q42 51 31 56 Z" fill="#6b3a1e"/><circle cx="37" cy="58.5" r="1.2" fill="#3a2a22"/><circle cx="43" cy="58.5" r="1.2" fill="#3a2a22"/><path d="M37.3 62 Q40 64.5 42.7 62" stroke="#b5533c" stroke-width="1.3" fill="none" stroke-linecap="round"/><circle cx="34.5" cy="61.5" r="1.7" fill="#ff9b8a" opacity=".55"/><circle cx="45.5" cy="61.5" r="1.7" fill="#ff9b8a" opacity=".55"/><path class="hca-wave b3" d="M68 74 Q74 64 71 54" stroke="#f6cba5" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="62" cy="64" r="7" fill="#f6cba5"/><path d="M55 63 Q55.5 55.5 62.5 56 Q69.5 56.5 69 63 Q63 59 55 63 Z" fill="#8a5a2b"/><circle cx="59.6" cy="65" r="1" fill="#3a2a22"/><circle cx="64.4" cy="65" r="1" fill="#3a2a22"/><path d="M60 68 Q62 70 64 68" stroke="#b5533c" stroke-width="1.2" fill="none" stroke-linecap="round"/><path d="M48 75 Q53 71 57 74" stroke="#f6cba5" stroke-width="3.6" fill="none" stroke-linecap="round"/><path d="M24 74 H76 L72 96 Q50 99 28 96 Z" fill="#C98A4B"/><rect x="22" y="71" width="56" height="6" rx="3" fill="#8A5A2B"/><path d="M33 80 V95 M43 80 V97 M57 80 V97 M67 80 V95" stroke="#A8743F" stroke-width="1.5"/></g></g><g transform="translate(-19 4) scale(0.96)"><g class="hca-bob "><g transform="translate(50 0) scale(.78) translate(-50 0)"><path d="M50 3 C25 3 14 20 18 37 C21 48 34 53 40 58 L60 58 C66 53 79 48 82 37 C86 20 75 3 50 3 Z" fill="#ffb000"/><path d="M50 3 C40 4 34 20 36 37 C37 48 40 53 43 58 L57 58 C60 53 63 48 64 37 C66 20 60 4 50 3 Z" fill="#fff"/><path d="M50 3 C46 7 45 22 46 37 C46.5 48 48 53 48.5 58 L51.5 58 C52 53 53.5 48 54 37 C55 22 54 7 50 3 Z" fill="#ffb000"/><ellipse cx="37" cy="17" rx="4.5" ry="8" fill="#fff" opacity=".35" transform="rotate(20 37 17)"/></g><path d="M41 45 L30 70 M59 45 L70 70" stroke="#7A4E27" stroke-width="1.4"/><circle cx="40" cy="55" r="11" fill="#6b3a1e"/><circle cx="31" cy="48" r="4.5" fill="#6b3a1e"/><ellipse cx="40" cy="74" rx="12" ry="8" fill="#7C5CFF"/><ellipse cx="62" cy="76" rx="8.5" ry="6" fill="#ff6fa8"/><circle cx="54.5" cy="63" r="3.2" fill="#c0392b"/><circle cx="69.5" cy="63" r="3.2" fill="#c0392b"/><circle cx="40" cy="57" r="9" fill="#f6cba5"/><path d="M31 56 Q33 46 42 47 Q49 48 49 55 Q42 51 31 56 Z" fill="#6b3a1e"/><circle cx="37" cy="58.5" r="1.2" fill="#3a2a22"/><circle cx="43" cy="58.5" r="1.2" fill="#3a2a22"/><path d="M37.3 62 Q40 64.5 42.7 62" stroke="#b5533c" stroke-width="1.3" fill="none" stroke-linecap="round"/><circle cx="34.5" cy="61.5" r="1.7" fill="#ff9b8a" opacity=".55"/><circle cx="45.5" cy="61.5" r="1.7" fill="#ff9b8a" opacity=".55"/><path class="hca-wave " d="M68 74 Q74 64 71 54" stroke="#f6cba5" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="62" cy="64" r="7" fill="#f6cba5"/><path d="M55 64 Q54.5 55.5 62 55.5 Q69.5 55.5 69 64 Q67 59 62 58.5 Q57 59 55 64 Z" fill="#c0392b"/><circle cx="59.6" cy="65" r="1" fill="#3a2a22"/><circle cx="64.4" cy="65" r="1" fill="#3a2a22"/><path d="M60 68 Q62 70 64 68" stroke="#b5533c" stroke-width="1.2" fill="none" stroke-linecap="round"/><path d="M48 75 Q53 71 57 74" stroke="#f6cba5" stroke-width="3.6" fill="none" stroke-linecap="round"/><path d="M24 74 H76 L72 96 Q50 99 28 96 Z" fill="#C98A4B"/><rect x="22" y="71" width="56" height="6" rx="3" fill="#8A5A2B"/><path d="M33 80 V95 M43 80 V97 M57 80 V97 M67 80 V95" stroke="#A8743F" stroke-width="1.5"/></g></g></svg>`;

  const train = `<svg class="hca" viewBox="0 0 160 100"><path d="M0 84 H160" stroke="#7a5230" stroke-width="4"/><path class="hca-rail" d="M0 90 H160" stroke="#a0703f" stroke-width="3" stroke-dasharray="6 8"/>
      <g fill="#fff"><circle class="hca-puff" cx="17" cy="30" r="5"/><circle class="hca-puff d2" cx="17" cy="30" r="5"/><circle class="hca-puff d3" cx="17" cy="30" r="5"/></g>
      <g transform="translate(8 34)"><g class="hca-rock"><rect x="0" y="14" width="46" height="32" rx="6" fill="#ff5a4e"/><rect x="24" y="0" width="22" height="22" rx="4" fill="#ff5a4e"/><rect x="28" y="4" width="14" height="10" rx="2" fill="#bfe6ff"/><rect x="4" y="2" width="10" height="14" fill="#2b2f3a"/></g>${wheel(12, 48, 7, 2.5).replace("hca-spin", "hca-spin-r")}${wheel(36, 48, 7, 2.5).replace("hca-spin", "hca-spin-r")}</g>
      ${[[60, "#3da5ff", "ר", "d2"], [108, "#2bb673", "כ", "d3"]].map(([x, c, ch, d]) => `<g transform="translate(${x} 46)"><g class="hca-rock ${d}"><rect width="42" height="32" rx="6" fill="${c}"/>${L(21, 15, ch, 24, "#fff")}</g>${wheel(10, 36, 6, 2).replace("hca-spin", "hca-spin-r")}${wheel(32, 36, 6, 2).replace("hca-spin", "hca-spin-r")}</g>`).join("")}
      <path d="M54 64 H60 M102 64 H108" stroke="#2b2f3a" stroke-width="3"/></svg>`;

  const circle = `<svg class="hca" viewBox="0 0 160 100"><g class="hca-ring"><circle cx="80" cy="50" r="38" fill="none" stroke="#ff5a8a" stroke-width="4" stroke-dasharray="4 8" stroke-linecap="round"/>
      ${["א", "ב", "ג", "ד", "ה", "ו"].map((ch, i) => { const a = -Math.PI / 2 + i * Math.PI / 3, x = 80 + Math.cos(a) * 38, y = 50 + Math.sin(a) * 38, c = ["#ff5a4e", "#ff8a3d", "#ffc233", "#2bb673", "#3da5ff", "#7c5cff"][i];
        return `<g class="hca-up"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="13" fill="${c}"/>${L(x.toFixed(1), y.toFixed(1), ch, 16, "#fff")}</g>`; }).join("")}</g></svg>`;

  // ---------- the three station-1 games (Golan 21.10): the same drawings as their static PICS in index.html, plus soft motion ----------
  const mole = `<svg class="hca" viewBox="0 0 160 100"><ellipse cx="80" cy="72" rx="72" ry="22" fill="#5fb34e"/><path d="M12 74 Q80 112 148 74 L132 92 Q80 108 28 92 Z" fill="#a47148"/>
      <ellipse cx="44" cy="70" rx="17" ry="6" fill="#3b2a20"/><ellipse cx="118" cy="72" rx="15" ry="5" fill="#3b2a20"/>
      ${[[44, "ב", 40, 70], [116, "ס", 50, 72]].map(([x, ch, y, hole], i) => `<defs><clipPath id="hca-hole${i}"><rect x="${x - 30}" y="0" width="60" height="${hole + 6}"/></clipPath></defs>
        <g clip-path="url(#hca-hole${i})"><g class="hca-pop${i ? " d2" : ""}"><g transform="translate(${x} ${y})"><ellipse cx="0" cy="8" rx="14" ry="20" fill="#7b5a4c"/><ellipse cx="0" cy="0" rx="7" ry="5" fill="#f2c9a8"/><circle cx="0" cy="-1" r="3" fill="#ff7f9b"/><circle cx="-5" cy="-7" r="1.8" fill="#1d1d1d"/><circle cx="5" cy="-7" r="1.8" fill="#1d1d1d"/>
        <rect x="-15" y="6" width="30" height="22" rx="4" fill="#fffaf0" stroke="#a0703f" stroke-width="2"/>${L(0, 17, ch, 16)}<circle cx="-14" cy="8" r="3.5" fill="#f7b3c0"/><circle cx="14" cy="8" r="3.5" fill="#f7b3c0"/></g></g></g>
`).join("")}</svg>`;

  const night = (x, y, k) => `<g transform="translate(${x} ${y})"><rect width="34" height="34" rx="5" fill="url(#hca-night)"/><circle cx="22" cy="12" r="6" fill="#FFF0A8"/><circle cx="25" cy="10" r="5" fill="#25307a"/>
      <circle class="hca-twinkle${k ? " d" + (k + 1) : ""}" cx="9" cy="25" r="1.3" fill="#FFF6C8"/><circle class="hca-twinkle d${3 - k}" cx="14" cy="8" r="1" fill="#FFF6C8"/></g>`;
  const card = (x, rot, cls) => `<g transform="translate(${x} 20) rotate(${rot} 20 22)"><g class="hca-lean ${cls}"><rect width="40" height="44" rx="6" fill="#FFF3C9" stroke="#ff8fb3" stroke-width="2.5"/>${L(20, 25, "ב", 30)}<circle cx="13" cy="36" r="1.6" fill="#1d2a3a"/><circle cx="27" cy="36" r="1.6" fill="#1d2a3a"/></g></g>`;
  const heart = (x, y, k, cls, fill) => `<g transform="translate(${x} ${y}) scale(${k})"><path class="hca-heart ${cls}" d="M0 -3c-2-3-7-2-7 2 0 3 4 6 7 8 3-2 7-5 7-8 0-4-5-5-7-2z" fill="${fill}"/></g>`;
  const memory = `<svg class="hca" viewBox="0 0 160 100"><defs><linearGradient id="hca-night" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#1b2a6b"/><stop offset="1" stop-color="#3b2f86"/></linearGradient></defs>
      ${night(8, 14, 0)}${night(8, 54, 1)}${night(118, 54, 2)}
      ${card(50, -8, "")}${card(82, 8, "d2")}
      ${heart(86, 15, 1, "", "#ff5a8a")}${heart(74, 11, 0.6, "d2", "#ff8fb3")}${heart(98, 9, 0.6, "d3", "#ff8fb3")}
      <g class="hca-float"><g transform="translate(120 6) scale(.32)"><path d="M50 6c22 0 38 16 38 38 0 20-18 36-28 46H40C30 80 12 64 12 44 12 22 28 6 50 6z" fill="#3DA5FF"/><path d="M41 90l-3 12M59 90l3 12" stroke="#5b4632" stroke-width="3"/><rect x="36" y="100" width="28" height="16" rx="3" fill="#A0703F"/></g></g></svg>`;

  const tile = (x, y, ch, fill, cls) => `<g transform="translate(${x} ${y})"><g class="hca-hop ${cls}"><rect width="40" height="40" rx="9" fill="#ffe9b8"/>${L(20, 21, ch, 28, fill)}</g></g>`;
  const song = `<svg class="hca" viewBox="0 0 160 100"><rect width="160" height="100" fill="#2a2f6b"/><circle class="hca-sun" cx="132" cy="20" r="10" fill="#fff6cf"/><circle cx="132" cy="20" r="10" fill="#fff6cf"/>
      <g fill="#fff"><circle class="hca-twinkle" cx="20" cy="14" r="1.5"/><circle class="hca-twinkle d2" cx="60" cy="10" r="1.2"/><circle class="hca-twinkle d3" cx="96" cy="22" r="1.4"/><circle class="hca-twinkle d2" cx="40" cy="30" r="1"/></g>
      ${tile(106, 46, "א", "#2bb673", "")}${tile(60, 40, "ב", "#ff5a8a", "d2")}${tile(14, 46, "ג", "#7c5cff", "d3")}
      <g fill="#ffd43b" font-family="sans-serif" font-weight="800"><g class="hca-note"><text x="146" y="44" font-size="14">♪</text></g><g class="hca-note d2"><text x="98" y="30" font-size="20">♫</text></g><g class="hca-note d3"><text x="56" y="34" font-size="16">♪</text></g></g></svg>`;

  if (!document.getElementById("hca-style")) { const st = document.createElement("style"); st.id = "hca-style"; st.textContent = CSS; document.head.append(st); }
  window.FL_HUB_PICS = { car, detective, waking, tellme, train, circle, mole, memory, song };
})();
