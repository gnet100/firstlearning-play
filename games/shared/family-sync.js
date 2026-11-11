// FL.familySync: the family code (thread "סנכרון בין מכשירים עם קוד משפחה", Golan 11.11.2026).
// One permanent 12-digit code per family. A device that has it pulls from the cloud, merges with
// FL.learner.importAll (nothing is lost, the same merge as the progress file), and pushes back what it has.
// Play never waits for the network: without it the game runs as usual, and the next sync sends the changes.
// Spec: transfer-4-11/family-sync-spec.md. Server: transfer-4-11/sync-server (Fly.io app firstlearning-sync).
//
// Needs learner.js first. Local keys (never exported, never synced): "fl-sync" (this device's code + state)
// and "fl-sync-url" (a test server address). learner.js SKIP_KEYS must hold both.
//
// API: FL.familySync.status(), create(), join(code), syncNow(), disconnect(), deleteFamily(), settingsRow(host),
//      onChange(fn), formatCode(code). All network calls resolve to {ok, code?: <error code>} and never throw.
(function (root) {
  "use strict";
  const FL = (root.FL = root.FL || {});
  const STATE_KEY = "fl-sync", URL_KEY = "fl-sync-url";
  const DEFAULT_URL = "https://firstlearning-sync.fly.dev";
  const EVERY_MS = 60000, CHECK_MS = 15000, START_MS = 1500, TIMEOUT_MS = 15000, RETRIES = 3;

  const read = () => { try { return JSON.parse(localStorage.getItem(STATE_KEY) || "null") || {}; } catch (e) { return {}; } };
  const write = (s) => { try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch (e) {} };
  const patch = (p) => { const s = Object.assign(read(), p); write(s); emit(); return s; };
  const baseUrl = () => { try { return (localStorage.getItem(URL_KEY) || root.FL_SYNC_URL || DEFAULT_URL).replace(/\/+$/, ""); } catch (e) { return DEFAULT_URL; } };
  const digits = (c) => String(c || "").replace(/\D/g, "");
  const formatCode = (c) => { const d = digits(c); return d.length === 12 ? d.slice(0, 4) + "-" + d.slice(4, 8) + "-" + d.slice(8) : d; };
  function newCode() {
    const a = new Uint32Array(3); (root.crypto || {}).getRandomValues ? root.crypto.getRandomValues(a) : a.forEach((_, i) => (a[i] = Math.random() * 1e4));
    return Array.from(a, (n) => String(n % 10000).padStart(4, "0")).join("");
  }

  // Canonical text (sorted keys) of what this device would share, without the export time. Two devices that
  // hold the same progress produce the same text, so a device pushes only when it really has something new.
  const canon = (v) => Array.isArray(v) ? "[" + v.map(canon).join(",") + "]"
    : v && typeof v === "object" ? "{" + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}"
    : JSON.stringify(v === undefined ? null : v);
  // What goes to the cloud (spec sections 3 and 10): the export without this device's own things. Local keys are
  // dropped; inside each game's "fl-*-settings" the device fields stay home; "current" (who plays now) is not sent.
  const LOCAL_KEYS = new Set([STATE_KEY, URL_KEY, "fl-map-last", "fl-hub-isle", "fl-tellme-log", "fl-circle-log", "fl-tellme-check"]);
  const DEVICE_FIELDS = ["quality", "perf", "voice", "stress", "balloon"];
  const snapshot = () => {
    const f = FL.learner.exportAll(); delete f.at;
    if (f.learner) f.learner = Object.assign({}, f.learner, { current: null });
    const other = {};
    for (const [k, v] of Object.entries(f.other || {})) {
      if (LOCAL_KEYS.has(k)) continue;
      if (k === "fl-keytimes") { try { const o = JSON.parse(v) || {}; LOCAL_KEYS.forEach((x) => delete o[x]); other[k] = JSON.stringify(o); continue; } catch (e) {} }
      if (/^fl-[\w-]+-settings$/.test(k)) { try { const o = JSON.parse(v); if (o && typeof o === "object") { DEVICE_FIELDS.forEach((d) => delete o[d]); other[k] = JSON.stringify(o); continue; } } catch (e) {} }
      other[k] = v;
    }
    f.other = other; return f;
  };
  // Fields that belong to each device never count as a difference: "current" (who plays now) and a child's
  // "session" (this device's own session number, learner.js mergeChild sets it per device).
  const shared = (f) => { if (!f.learner || !f.learner.profiles) return f; const profiles = {};
    for (const [id, p] of Object.entries(f.learner.profiles)) profiles[id] = Object.assign({}, p, { session: null });
    return Object.assign({}, f, { learner: Object.assign({}, f.learner, { current: null, profiles }) }); };
  const fingerprint = (f) => { const t = canon(shared(f)); let h = 5381; for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0; return t.length + ":" + h; };

  async function call(path, body) {
    let ctl = null, timer = null;
    try {
      ctl = root.AbortController ? new AbortController() : null; timer = ctl && setTimeout(() => ctl.abort(), TIMEOUT_MS);
      const r = await fetch(baseUrl() + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined });
      let j = {}; try { j = await r.json(); } catch (e) {}
      return Object.assign({ status: r.status, ok: r.ok }, j);
    } catch (e) { return { status: 0, ok: false, code: "offline" }; }
    finally { if (timer) clearTimeout(timer); }
  }

  // ---------- one sync: pull -> merge -> push if needed (retry on conflict) ----------
  let running = null;
  function syncNow() { if (!running) running = withLock(syncOnce).finally(() => { running = null; }); return running; }
  // One tab of this browser syncs at a time (others skip: the leader carries their changes, they share storage).
  async function withLock(fn) {
    if (root.navigator && navigator.locks && navigator.locks.request) {
      return navigator.locks.request("fl-family-sync", { ifAvailable: true }, (lock) => (lock ? fn() : { ok: true, code: "busy" }));
    }
    return fn();
  }
  async function syncOnce() {
    const s = read(); if (!s.code) return { ok: false, code: "not_connected" };
    patch({ state: "syncing" });
    for (let i = 0; i < RETRIES; i++) {
      const got = await call("/v1/pull", { code: s.code });
      if (got.status === 404 && got.code === "not_found") { forget("deleted"); return { ok: false, code: "deleted" }; }
      if (!got.ok) { patch({ state: got.code === "offline" ? "offline" : "error" }); return { ok: false, code: got.code || "error" }; }
      const remote = got.data || {};
      let imported = null;
      if (remote.learner && remote.learner.profiles) { try { imported = FL.learner.importAll(Object.assign({ app: "FirstLearning", kind: "progress", v: 1 }, remote)); } catch (e) { imported = null; } }
      const mine = snapshot(), fp = fingerprint(mine);
      const remoteFp = remote.learner ? fingerprint(Object.assign({}, remote, { at: undefined })) : "";
      if (fp === remoteFp) { patch({ version: got.version, lastFp: fp, lastAt: Date.now(), state: "ok" }); return { ok: true, pushed: false, imported }; }
      const put = await call("/v1/push", { code: s.code, data: mine, base_version: got.version });
      if (put.ok) { patch({ version: put.version, lastFp: fp, lastAt: Date.now(), state: "ok" }); return { ok: true, pushed: true, imported }; }
      if (put.status === 409) continue;                       // another device pushed meanwhile: pull and merge again
      if (put.status === 404) { forget("deleted"); return { ok: false, code: "deleted" }; }
      patch({ state: put.code === "offline" ? "offline" : "error" }); return { ok: false, code: put.code || "error" };
    }
    patch({ state: "error" }); return { ok: false, code: "conflict" };
  }

  // ---------- connect / disconnect / delete ----------
  async function create() {
    if (read().code) return { ok: false, code: "already_connected" };
    for (let i = 0; i < 3; i++) {
      const code = newCode(), mine = snapshot();
      const put = await call("/v1/push", { code, data: mine, base_version: 0 });
      if (put.ok) { write({ code, version: put.version, lastFp: fingerprint(mine), lastAt: Date.now(), state: "ok" }); emit(); start(); return { ok: true, code: formatCode(code) }; }
      if (put.status !== 409) return { ok: false, code: put.code || "error" };   // 409 = the code is taken (very rare): a new one
    }
    return { ok: false, code: "error" };
  }
  async function join(code) {
    const d = digits(code);
    if (d.length !== 12) return { ok: false, code: "bad_code" };
    const got = await call("/v1/pull", { code: d });
    if (!got.ok) return { ok: false, code: got.code || "error" };
    write({ code: d, version: 0, state: "syncing" }); emit();
    const res = await syncNow(); start();
    return res.ok ? { ok: true, imported: res.imported } : res;
  }
  // Only this device stops. Its progress stays here; the cloud keeps the family.
  function disconnect() { forget(null); return { ok: true }; }
  // Removes the family from the cloud for good. Every device stays as it is and disconnects at its next sync.
  async function deleteFamily() {
    const s = read(); if (!s.code) return { ok: false, code: "not_connected" };
    const r = await call("/v1/delete", { code: s.code });
    if (r.ok || r.code === "not_found") { forget(null); return { ok: true }; }
    return { ok: false, code: r.code || "error" };
  }
  function forget(note) { write(note ? { note } : {}); stop(); emit(); }

  // ---------- when to sync ----------
  let timers = [], started = false;
  function start() {
    if (started || !read().code || typeof document === "undefined") return; started = true;
    timers.push(setTimeout(syncNow, START_MS));
    timers.push(setInterval(() => { if (document.visibilityState !== "hidden") syncNow(); }, EVERY_MS));
    // a change on this device: sync within ~15 s (cheap check of the export's fingerprint, in idle time)
    timers.push(setInterval(() => { const go = () => { try { if (read().lastFp !== fingerprint(snapshot())) syncNow(); } catch (e) {} };
      root.requestIdleCallback ? requestIdleCallback(go, { timeout: 3000 }) : go(); }, CHECK_MS));
  }
  function stop() { timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers = []; started = false; }
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && read().code) syncNow(); });
    root.addEventListener("online", () => { if (read().code) syncNow(); });
    root.addEventListener("pagehide", () => { /* nothing to flush: the next open syncs */ });
  }

  // ---------- status + listeners ----------
  const listeners = new Set();
  function emit() { const st = status(); listeners.forEach((fn) => { try { fn(st); } catch (e) {} }); }
  function status() { const s = read(); return { connected: !!s.code, code: s.code ? formatCode(s.code) : null, state: s.state || null, lastAt: s.lastAt || null, note: s.note || null }; }
  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  // ---------- the settings row (bottom of the hub's parent settings, behind the times-table gate) ----------
  const T = {
    title: "סִנְכְּרוּן בֵּין מַכְשִׁירִים",
    intro: "קוֹד אֶחָד לַמִּשְׁפָּחָה. מַקְלִידִים אוֹתוֹ פַּעַם אַחַת בְּכָל מַכְשִׁיר, וּמֵאָז הַהִתְקַדְּמוּת מִתְעַדְכֶּנֶת לְבַד.",
    create: "יְצִירַת קוֹד מִשְׁפָּחָה", have: "יֵשׁ לִי קוֹד", connect: "חִבּוּר", place: "12 סְפָרוֹת",
    codeIs: "קוֹד הַמִּשְׁפָּחָה:", ok: "מְעֻדְכָּן", syncing: "מִתְעַדְכֵּן…", offline: "יִתְעַדְכֵּן כְּשֶׁתַּחְזֹר הָרֶשֶׁת", error: "יִתְעַדְכֵּן בְּהֶמְשֵׁךְ",
    disconnect: "נִתּוּק הַמַּכְשִׁיר", del: "מְחִיקַת הַמִּשְׁפָּחָה מֵהֶעָנָן", delAgain: "לְחִיצָה נוֹסֶפֶת מוֹחֶקֶת מֵהֶעָנָן לְתָמִיד",
    created: "הַקּוֹד מוּכָן. מַקְלִידִים אוֹתוֹ בְּכָל מַכְשִׁיר נוֹסָף.", joined: "הַמַּכְשִׁיר מְחֻבָּר וּמְעֻדְכָּן.",
    disconnected: "הַמַּכְשִׁיר נֻתַּק. הַהִתְקַדְּמוּת נִשְׁאֲרָה בּוֹ.", deleted: "הַמִּשְׁפָּחָה נִמְחֲקָה מֵהֶעָנָן. מַה שֶּׁבַּמַּכְשִׁירִים נִשְׁאַר בָּהֶם.",
    deletedElsewhere: "הַמִּשְׁפָּחָה נִמְחֲקָה מֵהֶעָנָן, וְהַמַּכְשִׁיר נֻתַּק. הַהִתְקַדְּמוּת נִשְׁאֲרָה בּוֹ.",
    not_found: "הַקּוֹד לֹא נִמְצָא. כְּדַאי לִבְדֹּק אוֹתוֹ שׁוּב.", bad_code: "צָרִיךְ 12 סְפָרוֹת.",
    offlineNow: "אֵין אִינְטֶרְנֶט כָּרֶגַע. אֶפְשָׁר לְנַסּוֹת שׁוּב אַחַר כָּךְ.", too_many_wrong_codes: "יוֹתֵר מִדַּי נִסְיוֹנוֹת. אֶפְשָׁר לְנַסּוֹת שׁוּב בְּעוֹד שָׁעָה.",
    rate_limited: "יוֹתֵר מִדַּי בַּקָּשׁוֹת. אֶפְשָׁר לְנַסּוֹת שׁוּב בְּעוֹד דַּקָּה.",
    failed: "מַשֶּׁהוּ לֹא הִצְלִיחַ. אֶפְשָׁר לְנַסּוֹת שׁוּב.",
  };
  const errText = (c) => (c === "offline" ? T.offlineNow : T[c] && c !== "ok" ? T[c] : T.failed);
  function settingsRow(host, { onDone } = {}) {
    css();
    const box = document.createElement("div"); box.className = "fl-sync"; host.append(box);
    let msg = "", busy = false, joinOpen = false, typed = "";
    const draw = () => {
      const st = status();
      if (!st.connected) {
        box.innerHTML = `<div class="fl-sy-title">${T.title}</div><div class="fl-sy-intro">${T.intro}</div>
          <div class="fl-sy-btns"><button type="button" class="fl-sy-create">${T.create}</button><button type="button" class="fl-sy-have">${T.have}</button></div>
          <div class="fl-sy-join"${joinOpen ? "" : " hidden"}><input class="fl-sy-in" inputmode="numeric" autocomplete="off" dir="ltr" maxlength="14" placeholder="${T.place}"><button type="button" class="fl-sy-go">${T.connect}</button></div>
          <div class="fl-sy-msg" aria-live="polite"></div>`;
        const joinBox = box.querySelector(".fl-sy-join"), inp = box.querySelector(".fl-sy-in");
        inp.value = typed;
        box.querySelector(".fl-sy-have").onclick = () => { joinOpen = true; joinBox.hidden = false; inp.focus(); };
        inp.oninput = () => { const d = digits(inp.value).slice(0, 12); inp.value = typed = d.replace(/(\d{4})(?=\d)/g, "$1-"); };
        box.querySelector(".fl-sy-create").onclick = () => act(create, (r) => (msg = T.created));
        const go = () => act(() => join(inp.value), () => (msg = T.joined));
        box.querySelector(".fl-sy-go").onclick = go; inp.onkeydown = (e) => { if (e.key === "Enter") go(); };
      } else {
        box.innerHTML = `<div class="fl-sy-title">${T.title}</div>
          <div class="fl-sy-code"><span>${T.codeIs}</span> <b dir="ltr">${st.code}</b></div>
          <div class="fl-sy-state">${T[st.state] || T.ok}</div>
          <div class="fl-sy-btns"><button type="button" class="fl-sy-off">${T.disconnect}</button><button type="button" class="fl-sy-del">${T.del}</button></div>
          <div class="fl-sy-msg" aria-live="polite"></div>`;
        box.querySelector(".fl-sy-off").onclick = () => { disconnect(); msg = T.disconnected; draw(); };
        const del = box.querySelector(".fl-sy-del"); let armed = 0;
        del.onclick = () => {
          if (!armed) { armed = setTimeout(() => { armed = 0; del.textContent = T.del; del.classList.remove("armed"); }, 6000); del.textContent = T.delAgain; del.classList.add("armed"); return; }
          clearTimeout(armed); armed = 0; act(deleteFamily, () => (msg = T.deleted));
        };
      }
      if (!msg && st.note === "deleted") msg = T.deletedElsewhere;
      box.querySelector(".fl-sy-msg").textContent = msg;
      box.querySelectorAll("button").forEach((b) => (b.disabled = busy));
    };
    async function act(fn, good) {
      if (busy) return; busy = true; msg = T.syncing; draw();
      const r = await fn(); busy = false;
      if (r && r.ok) { good(r); if (onDone) onDone(r); } else msg = errText(r && r.code);
      draw();
    }
    const off = onChange(() => { if (!busy) draw(); });
    draw();
    return { el: box, destroy: () => { off(); box.remove(); } };
  }
  function css() {
    if (typeof document === "undefined" || document.getElementById("fl-sync-css")) return;
    const st = document.createElement("style"); st.id = "fl-sync-css";
    st.textContent = `.fl-sync{margin:14px 0 4px;padding:12px;border-radius:14px;background:#f4f8fc;text-align:center}
      .fl-sy-title{font-weight:800;margin-bottom:6px}.fl-sy-intro{font-size:.9em;color:#3b4a5c;margin-bottom:8px}
      .fl-sy-join[hidden]{display:none}.fl-sy-btns,.fl-sy-join{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:8px}
      .fl-sync button{font:inherit;font-weight:700;border:2px solid #d5dde6;background:#fff;border-radius:999px;padding:8px 16px;cursor:pointer;min-height:44px}
      .fl-sync button:disabled{opacity:.55;cursor:default}.fl-sync button.armed{border-color:#e03131;color:#c92a2a}
      .fl-sy-in{font:inherit;font-size:1.15em;letter-spacing:.08em;text-align:center;width:11em;border:2px solid #d5dde6;border-radius:12px;padding:6px 10px;min-height:44px}
      .fl-sy-code{font-size:1.1em}.fl-sy-code b{letter-spacing:.08em;font-size:1.15em}.fl-sy-state{font-size:.9em;color:#1f8048;margin-top:4px}
      .fl-sy-msg{margin-top:8px;font-size:.9em;color:#3b4a5c;min-height:1em}`;
    document.head.append(st);
  }

  // Is there a server to talk to? (MAIN 11.11: the hub shows the settings row only when this answers,
  // or the device is already connected; until Golan sets up the server the row stays hidden.)
  async function available() {
    let ctl = null, timer = null;
    try {
      ctl = root.AbortController ? new AbortController() : null; timer = ctl && setTimeout(() => ctl.abort(), 5000);
      const r = await fetch(baseUrl() + "/health", { signal: ctl ? ctl.signal : undefined });
      return r.ok;
    } catch (e) { return false; }
    finally { if (timer) clearTimeout(timer); }
  }
  FL.familySync = { status, available, create, join, syncNow, disconnect, deleteFamily, settingsRow, onChange, formatCode, _canon: canon, _snapshot: snapshot };
  if (typeof document !== "undefined") start();
})(typeof window !== "undefined" ? window : globalThis);
