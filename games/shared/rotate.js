// Golan 8.11: the game is played with the phone held sideways. A phone held upright gets a full-screen
// "turn the phone" card (a phone that turns, text with nikud) until it is turned. Only on touch phones; never on a computer.
(() => {
  "use strict";
  if (window.FL_ROTATE) return; window.FL_ROTATE = true;
  const touch = window.matchMedia && matchMedia("(pointer: coarse)").matches;
  if (!touch) return;
  const css = document.createElement("style");
  css.textContent = `
  .fl-rotate { position: fixed; inset: 0; z-index: 200000; display: none; flex-direction: column; align-items: center; justify-content: center; gap: 28px;
    background: linear-gradient(#8fd0ff, #e6f6ff); direction: rtl; font: 700 26px/1.4 "Noto Sans Hebrew", system-ui, sans-serif; color: #1d3557; text-align: center; padding: 24px; }
  .fl-rotate.on { display: flex; }
  .fl-rotate svg { width: 120px; height: 120px; animation: flRot 2.4s ease-in-out infinite; }
  @keyframes flRot { 0%, 25% { transform: rotate(0deg); } 55%, 85% { transform: rotate(-90deg); } 100% { transform: rotate(0deg); } }`;
  (document.head || document.documentElement).append(css);
  const el = document.createElement("div"); el.className = "fl-rotate"; el.setAttribute("role", "alert");
  el.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="20" y="6" width="24" height="52" rx="5" fill="#fff" stroke="#2f7fd8" stroke-width="3"/><rect x="24" y="12" width="16" height="36" rx="2" fill="#bfe3ff"/><circle cx="32" cy="53" r="2" fill="#2f7fd8"/></svg>
    <div>סַבְּבוּ אֶת הַטֶּלֶפוֹן לָרֹחַב</div>`;
  const upright = () => (window.matchMedia ? matchMedia("(orientation: portrait)").matches : innerHeight > innerWidth) && Math.min(innerWidth, innerHeight) < 600;
  const check = () => { if (!document.body) return; if (!el.isConnected) document.body.append(el); el.classList.toggle("on", upright()); };
  addEventListener("resize", check); addEventListener("orientationchange", () => setTimeout(check, 200));
  if (document.body) check(); else document.addEventListener("DOMContentLoaded", check);
  // ask the browser to lock sideways where it can (an installed app / full screen); harmless where it cannot
  try { screen.orientation && screen.orientation.lock && screen.orientation.lock("landscape").catch(() => {}); } catch (e) {}
})();
