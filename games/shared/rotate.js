// Golan 12.11 (was sideways since 8.11): the game is played with the phone held UPRIGHT. A phone held sideways gets a full-screen
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
  @keyframes flRot { 0%, 25% { transform: rotate(-90deg); } 55%, 85% { transform: rotate(0deg); } 100% { transform: rotate(-90deg); } }`;
  (document.head || document.documentElement).append(css);
  const el = document.createElement("div"); el.className = "fl-rotate"; el.setAttribute("role", "alert");
  el.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="20" y="6" width="24" height="52" rx="5" fill="#fff" stroke="#2f7fd8" stroke-width="3"/><rect x="24" y="12" width="16" height="36" rx="2" fill="#bfe3ff"/><circle cx="32" cy="53" r="2" fill="#2f7fd8"/></svg>
    <div>סַבְּבוּ אֶת הַטֶּלֶפוֹן לָאֹרֶךְ</div>`;
  const upright = () => (window.matchMedia ? matchMedia("(orientation: landscape)").matches : innerWidth > innerHeight) && Math.min(innerWidth, innerHeight) < 600;   // name kept: true = the card shows (sideways phone)
  const check = () => { if (!document.body) return; if (!el.isConnected) document.body.append(el); el.classList.toggle("on", upright()); };
  addEventListener("resize", check); addEventListener("orientationchange", () => setTimeout(check, 200));
  if (document.body) check(); else document.addEventListener("DOMContentLoaded", check);
  // ask the browser to lock upright where it can (an installed app / full screen); harmless where it cannot
  const lock = () => { try { screen.orientation && screen.orientation.lock && screen.orientation.lock("portrait").catch(() => {}); } catch (e) {} };
  lock();
  // Golan 12.11: full screen on a phone, without the address bar. A browser allows it only after a tap, so the first
  // tap on every page asks for it (an installed app, display "fullscreen" in app.webmanifest, already is). iPhone Safari
  // has no full screen for pages: there only "Add to Home Screen" hides the bar.
  const D = document.documentElement, standalone = matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches;
  const full = () => {
    if (standalone || document.fullscreenElement || document.webkitFullscreenElement) return;
    try { const r = D.requestFullscreen ? D.requestFullscreen({ navigationUI: "hide" }) : D.webkitRequestFullscreen && D.webkitRequestFullscreen();
      if (r && r.then) r.then(lock, () => {}); } catch (e) {}
  };
  addEventListener("pointerup", full, { capture: true, passive: true });
})();
