// river-card-animated.js: the river game's hub card in gentle motion (art thread "לצייר דמויות וציורים למשחקים", Golan 7.11.2026).
// Same drawing as riverPic() in index.html (river, three picture stones, the cream bunny, design "A"), WITHOUT the ice cream (Golan 7.11).
// Motion (10 s loop): the river flows, the stones bob, the bunny hops stone by stone to the far bank, wiggles its ears, fades, and starts again.
// Use: load after games/waking-letter/pictures.js, then FL_RIVER_CARD() returns the svg string (also FL_HUB_PICS.river once FL_HUB_PICS exists).
(() => {
  "use strict";
  const CSS = `
  svg.hcr { overflow: hidden; }
  .hcr-flow { animation: hcr-flow 3s linear infinite; } .hcr-flow.d2 { animation-duration: 4s; }
  @keyframes hcr-flow { to { stroke-dashoffset: -24; } }
  .hcr-rip { animation: hcr-rip 5s ease-in-out infinite; } .hcr-rip.d2 { animation-delay: -1.7s; } .hcr-rip.d3 { animation-delay: -3.3s; }
  @keyframes hcr-rip { 0%, 100% { transform: translateX(0); opacity: .9; } 50% { transform: translateX(-5px); opacity: .5; } }
  .hcr-bob { animation: hcr-bob 3.4s ease-in-out infinite; } .hcr-bob.d2 { animation-delay: -1.1s; } .hcr-bob.d3 { animation-delay: -2.2s; }
  @keyframes hcr-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(1.2px); } }
  .hcr-reed { transform-box: fill-box; transform-origin: 50% 100%; animation: hcr-reed 4s ease-in-out infinite; } .hcr-reed.d2 { animation-delay: -2s; }
  @keyframes hcr-reed { 0%, 100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
  /* the bunny's path: start bank (30 84) -> stone 1 (40 61) -> stone 2 (80 55) -> stone 3 (118 47) -> far bank (144 29): it stands ON the stone and covers its picture until it hops on */
  .hcr-path { animation: hcr-path 10s linear infinite; }
  @keyframes hcr-path {
    0%, 12% { transform: translate(30px, 84px); opacity: 1; animation-timing-function: ease-out; }
    16% { transform: translate(35px, 56px); animation-timing-function: ease-in; }
    20%, 30% { transform: translate(40px, 61px); animation-timing-function: ease-out; }
    34% { transform: translate(60px, 47px); animation-timing-function: ease-in; }
    38%, 48% { transform: translate(80px, 55px); animation-timing-function: ease-out; }
    52% { transform: translate(99px, 40px); animation-timing-function: ease-in; }
    56%, 66% { transform: translate(118px, 47px); animation-timing-function: ease-out; }
    70% { transform: translate(131px, 30px); animation-timing-function: ease-in; }
    74%, 88% { transform: translate(144px, 29px); opacity: 1; }
    93% { transform: translate(144px, 29px); opacity: 0; }
    94%, 98% { transform: translate(30px, 84px); opacity: 0; }
    100% { transform: translate(30px, 84px); opacity: 1; } }
  /* squash on every take-off and landing, stretch in the air (feet stay on the ground: origin at the feet) */
  .hcr-squash { transform-box: fill-box; transform-origin: 50% 100%; animation: hcr-squash 10s linear infinite; }
  @keyframes hcr-squash {
    0%, 10%, 22%, 28%, 40%, 46%, 58%, 64%, 76%, 100% { transform: scale(1, 1); }
    12%, 30%, 48%, 66% { transform: scale(1.12, .86); }
    14%, 32%, 50%, 68% { transform: scale(.92, 1.1); }
    20%, 38%, 56%, 74% { transform: scale(1.14, .84); } }
  .hcr-ear { transform-box: fill-box; transform-origin: 50% 100%; animation: hcr-ear 2.6s ease-in-out infinite; } .hcr-ear.d2 { animation-delay: -.4s; }
  @keyframes hcr-ear { 0%, 70%, 100% { transform: rotate(0); } 80% { transform: rotate(-12deg); } 90% { transform: rotate(6deg); } }
  /* a little splash ring round each stone when the bunny lands on it */
  .hcr-ring { opacity: 0; transform-box: fill-box; transform-origin: center; animation: hcr-ring 10s ease-out infinite; }
  .hcr-ring.s1 { animation-name: hcr-ring1; } .hcr-ring.s2 { animation-name: hcr-ring2; } .hcr-ring.s3 { animation-name: hcr-ring3; }
  @keyframes hcr-ring1 { 0%, 19.9% { opacity: 0; transform: scale(.7); } 20% { opacity: .9; transform: scale(.8); } 28%, 100% { opacity: 0; transform: scale(1.6); } }
  @keyframes hcr-ring2 { 0%, 37.9% { opacity: 0; transform: scale(.7); } 38% { opacity: .9; transform: scale(.8); } 46%, 100% { opacity: 0; transform: scale(1.6); } }
  @keyframes hcr-ring3 { 0%, 55.9% { opacity: 0; transform: scale(.7); } 56% { opacity: .9; transform: scale(.8); } 64%, 100% { opacity: 0; transform: scale(1.6); } }
  /* on the far bank: a happy little jump, twice */
  .hcr-joy { animation: hcr-joy 10s ease-in-out infinite; }
  @keyframes hcr-joy { 0%, 77% { transform: translateY(0); } 79.5% { transform: translateY(-4px); } 82%, 83% { transform: translateY(0); } 85.5% { transform: translateY(-4px); } 88%, 100% { transform: translateY(0); } }
  @media (prefers-reduced-motion: reduce) { [class*="hcr-"] { animation: none !important; } .hcr-path { transform: translate(30px, 84px); } }`;

  function card() {
    const P = window.PICTURES || {}, pic = (l, x, y, s) => P[l] ? `<g transform="translate(${x - s / 2} ${y - s / 2}) scale(${s / 1000})">${P[l].svg}</g>` : "";
    const stone = (x, y, k, c, i) => `<ellipse class="hcr-ring s${i}" cx="${x}" cy="${y + 7}" rx="17" ry="5.5" fill="none" stroke="#ffffff" stroke-width="1.6"/>
      <g class="hcr-bob${i > 1 ? " d" + i : ""}"><ellipse cx="${x}" cy="${y + 7}" rx="15" ry="5" fill="#9fd3f5"/><path d="M${x - 13} ${y + 6} Q${x - 14} ${y - 6} ${x} ${y - 7} Q${x + 14} ${y - 6} ${x + 13} ${y + 6} Q${x} ${y + 11} ${x - 13} ${y + 6} Z" fill="${c}" stroke="#6b5a4c" stroke-width="1.2"/><circle cx="${x}" cy="${y - 2}" r="9" fill="#fffaf2" stroke="#d9c7a8" stroke-width="1"/>${pic(k, x, y - 2, 15)}</g>`;
    const reed = (x, y, h, d) => `<g class="hcr-reed${d ? " d2" : ""}"><path d="M${x} ${y} q-1 ${-h / 2} 0 ${-h}" stroke="#4f8f3a" stroke-width="1.6" fill="none" stroke-linecap="round"/><ellipse cx="${x}" cy="${y - h}" rx="1.6" ry="3.4" fill="#8a5a33"/></g>`;
    // the bunny (design A): origin at its feet; small, so it fits on a stone
    const bunny = `<g class="hcr-path"><g class="hcr-joy"><g transform="scale(.72)"><ellipse cx="0" cy="0" rx="10" ry="3" fill="#00000022"/><g class="hcr-squash">
      <ellipse cx="0" cy="-8" rx="9" ry="8" fill="#f2e2c9"/><ellipse cx="0" cy="-6" rx="5" ry="5" fill="#fffaf2"/><circle cx="0" cy="-18" r="7" fill="#f2e2c9"/>
      <g class="hcr-ear"><ellipse cx="-3" cy="-29" rx="2.6" ry="7" fill="#dcc19b"/><ellipse cx="-3" cy="-29" rx="1.2" ry="5" fill="#f7b3c0"/></g>
      <g class="hcr-ear d2"><ellipse cx="3" cy="-29" rx="2.6" ry="7" fill="#dcc19b"/><ellipse cx="3" cy="-29" rx="1.2" ry="5" fill="#f7b3c0"/></g>
      <circle cx="-2.4" cy="-19" r="1.1" fill="#1b1b24"/><circle cx="2.4" cy="-19" r="1.1" fill="#1b1b24"/><circle cx="0" cy="-16.6" r="1" fill="#ff7aa0"/>
      <circle cx="-4.6" cy="-16" r="1.4" fill="#ffb3c7" opacity=".7"/><circle cx="4.6" cy="-16" r="1.4" fill="#ffb3c7" opacity=".7"/></g></g></g></g>`;
    return `<svg class="hcr" viewBox="0 0 160 100" role="img" aria-label="ארנבון קופץ על אבנים בנהר"><rect width="160" height="100" fill="#8fd16a"/><rect y="30" width="160" height="42" fill="#3d9be0"/>
      <path class="hcr-flow" d="M0 38 H160" stroke="#64b2ea" stroke-width="1.4" stroke-dasharray="10 14"/><path class="hcr-flow d2" d="M0 66 H160" stroke="#64b2ea" stroke-width="1.4" stroke-dasharray="14 10"/>
      <path d="M0 30 H160" stroke="#6aa84f" stroke-width="3"/><path d="M0 72 H160" stroke="#6aa84f" stroke-width="3"/>
      <path class="hcr-rip" d="M14 48 q8 -3 16 0" stroke="#b9e1fb" stroke-width="2" fill="none" stroke-linecap="round"/><path class="hcr-rip d2" d="M110 60 q8 -3 16 0" stroke="#b9e1fb" stroke-width="2" fill="none" stroke-linecap="round"/><path class="hcr-rip d3" d="M60 40 q8 -3 16 0" stroke="#b9e1fb" stroke-width="2" fill="none" stroke-linecap="round"/>
      ${reed(8, 31, 12, 0)}${reed(13, 31, 9, 1)}${reed(96, 31, 11, 1)}${reed(152, 74, 12, 0)}${reed(70, 74, 10, 1)}
      <g transform="translate(120 4)"><circle cx="0" cy="8" r="7" fill="#5fb34e"/><circle cx="8" cy="10" r="6" fill="#6cc25a"/><circle cx="-7" cy="11" r="5" fill="#6cc25a"/></g>
      ${stone(40, 58, "ב", "#c9c2b8", 1)}${stone(80, 52, "ג", "#d8b48a", 2)}${stone(118, 44, "ח", "#b8c9a0", 3)}
      ${bunny}</svg>`;
  }
  if (!document.getElementById("hcr-style")) { const st = document.createElement("style"); st.id = "hcr-style"; st.textContent = CSS; document.head.append(st); }
  window.FL_RIVER_CARD = card;
  if (window.FL_HUB_PICS) Object.defineProperty(window.FL_HUB_PICS, "river", { get: card, configurable: true });
})();
