// FL.familySync: sync between a family's devices (thread "סנכרון בין מכשירים עם קוד משפחה", Golan 11.11.2026).
// Security review 12.11 (Golan chose): the 8-digit code only JOINS a device. A connected device presses
// "הוספת מכשיר" and gets a code that works once, for 10 minutes. From then on every device holds its own long
// random secret (in "fl-sync"), and all syncing uses that.
// Encryption (Golan 12.11, the middle option): the family's progress is encrypted on the devices with a family key
// (AES-GCM, 32 random bytes, kept in "fl-sync"). The server stores only an envelope it cannot read. The join code
// never leaves the device as is: the device sends a slow PBKDF2 "lookup" of it, and the family key wrapped with
// another slow PBKDF2 of the code (600,000 rounds, a new random salt each time). The server deletes the wrapped key
// when it is used or after 10 minutes. The code itself is never stored or logged; it lives only on the screen.
// A device pulls from the cloud, merges with FL.learner.importAll (nothing is lost, the same merge as the progress
// file), and pushes back what it has. Play never waits for the network.
// Spec: summaries (family-sync-spec.md). Server: sync-server/ (Fly.io, not deployed yet).
//
// Needs learner.js first. Local keys (never exported, never synced): "fl-sync" (this device's secret + state)
// and "fl-sync-url" (a test server address). learner.js SKIP_KEYS holds both.
//
// Encrypted envelope (server checks its shape): {enc: "A256GCM", z: "gzip"|"none", iv, ct} (base64).
// Wrapped key (opaque to the server): JSON {v: 1, it: 600000, salt, iv, ct}.
// API: FL.familySync.status(), available(), create(), invite(), join(code), syncNow(), disconnect(), deleteFamily(),
//      settingsRow(host), onChange(fn), formatCode(code). Network calls resolve to {ok, code?: <error>} and never throw.
(function (root) {
  "use strict";
  const FL = (root.FL = root.FL || {});
  const STATE_KEY = "fl-sync", URL_KEY = "fl-sync-url";
  // No address until the server really exists under our own Fly account (security review 12.11: a name we do not
  // own could be taken by a stranger, who would then receive the children's progress). Set it when deploying.
  const DEFAULT_URL = "";
  const EVERY_MS = 60000, CHECK_MS = 15000, START_MS = 1500, TIMEOUT_MS = 15000, RETRIES = 3;

  const read = () => { try { return JSON.parse(localStorage.getItem(STATE_KEY) || "null") || {}; } catch (e) { return {}; } };
  const write = (s) => { try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch (e) {} };
  const patch = (p) => { const s = Object.assign(read(), p); write(s); emit(); return s; };
  const baseUrl = () => { try { return String(localStorage.getItem(URL_KEY) || root.FL_SYNC_URL || DEFAULT_URL).replace(/\/+$/, ""); } catch (e) { return DEFAULT_URL; } };
  const digits = (c) => String(c || "").replace(/\D/g, "");
  const CODE_LEN = 8;
  const group = (d) => d.replace(/(\d{4})(?=\d)/g, "$1-");
  const formatCode = (c) => { const d = digits(c); return d.length === CODE_LEN ? group(d) : d; };


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

  // ---------- encryption (WebCrypto; needs https or localhost) ----------
  const subtle = () => (root.crypto && root.crypto.subtle) || null;
  const ROUNDS = 600000, LOOKUP_SALT = "FirstLearning-join-v1";
  const enc = new TextEncoder(), dec = new TextDecoder();
  const rand = (n) => root.crypto.getRandomValues(new Uint8Array(n));
  const b64 = (u) => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));
  const hex = (u) => Array.from(u, (x) => x.toString(16).padStart(2, "0")).join("");
  const aes = (raw) => subtle().importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  async function slow(code, salt, bits) {   // PBKDF2-SHA256 of the 8 digits
    const base = await subtle().importKey("raw", enc.encode(code), "PBKDF2", false, ["deriveBits"]);
    return new Uint8Array(await subtle().deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ROUNDS }, base, bits));
  }
  const lookupOf = async (code) => hex(await slow(code, enc.encode(LOOKUP_SALT), 256));
  function newCode() {   // 8 random digits, evenly spread (no modulo bias)
    let d = "";
    while (d.length < CODE_LEN) { const b = rand(16); for (const x of b) if (x < 250 && d.length < CODE_LEN) d += String(x % 10); }
    return d;
  }
  const pipe = async (u, stream) => new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(stream)).arrayBuffer());
  const gz = typeof root.CompressionStream === "function" && typeof root.DecompressionStream === "function";
  async function seal(obj, keyB64) {   // -> {enc, z, iv, ct}
    let u = enc.encode(JSON.stringify(obj)), z = "none";
    if (gz) { u = await pipe(u, new CompressionStream("gzip")); z = "gzip"; }
    const iv = rand(12);
    const ct = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv }, await aes(unb64(keyB64)), u));
    return { enc: "A256GCM", z, iv: b64(iv), ct: b64(ct) };
  }
  async function unseal(env, keyB64) {   // -> the object, or throws
    if (!env || env.enc !== "A256GCM") throw new Error("not encrypted");
    let u = new Uint8Array(await subtle().decrypt({ name: "AES-GCM", iv: unb64(env.iv) }, await aes(unb64(keyB64)), unb64(env.ct)));
    if (env.z === "gzip") u = await pipe(u, new DecompressionStream("gzip"));
    return JSON.parse(dec.decode(u));
  }
  async function wrap(keyB64, code) {   // the family key, locked with the code (new random salt every time)
    const salt = rand(16), iv = rand(12);
    const ct = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv }, await aes(await slow(code, salt, 256)), unb64(keyB64)));
    return JSON.stringify({ v: 1, it: ROUNDS, salt: b64(salt), iv: b64(iv), ct: b64(ct) });
  }
  async function unwrap(text, code) {
    const w = JSON.parse(text);
    if (w.it !== ROUNDS) throw new Error("rounds");
    const raw = new Uint8Array(await subtle().decrypt({ name: "AES-GCM", iv: unb64(w.iv) }, await aes(await slow(code, unb64(w.salt), 256)), unb64(w.ct)));
    if (raw.length !== 32) throw new Error("key");
    return b64(raw);
  }

  async function call(path, body) {
    if (!baseUrl()) return { status: 0, ok: false, code: "offline" };
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
    const s = read(); if (!s.secret || !s.key) return { ok: false, code: "not_connected" };
    patch({ state: "syncing" });
    for (let i = 0; i < RETRIES; i++) {
      const got = await call("/v1/pull", { secret: s.secret });
      if (got.status === 404 && got.code === "not_found") { forget("deleted"); return { ok: false, code: "deleted" }; }
      if (!got.ok) { patch({ state: got.code === "offline" ? "offline" : "error" }); return { ok: false, code: got.code || "error" }; }
      let remote;
      try { remote = await unseal(got.data, s.key); } catch (e) { patch({ state: "error" }); return { ok: false, code: "unreadable" }; }
      let imported = null;
      if (remote.learner && remote.learner.profiles) { try { imported = FL.learner.importAll(Object.assign({ app: "FirstLearning", kind: "progress", v: 1 }, remote)); } catch (e) { imported = null; } }
      const mine = snapshot(), fp = fingerprint(mine);
      const remoteFp = remote.learner ? fingerprint(Object.assign({}, remote, { at: undefined })) : "";
      if (fp === remoteFp) { patch({ version: got.version, lastFp: fp, lastAt: Date.now(), state: "ok" }); return { ok: true, pushed: false, imported }; }
      const put = await call("/v1/push", { secret: s.secret, data: await seal(mine, s.key), base_version: got.version });
      if (put.ok) { patch({ version: put.version, lastFp: fp, lastAt: Date.now(), state: "ok" }); return { ok: true, pushed: true, imported }; }
      if (put.status === 409) continue;                       // another device pushed meanwhile: pull and merge again
      if (put.status === 404) { forget("deleted"); return { ok: false, code: "deleted" }; }
      patch({ state: put.code === "offline" ? "offline" : "error" }); return { ok: false, code: put.code || "error" };
    }
    patch({ state: "error" }); return { ok: false, code: "conflict" };
  }

  // ---------- connect / add a device / disconnect / delete ----------
  // The first device: a new family in the cloud with everything this device has.
  async function create() {
    if (read().secret) return { ok: false, code: "already_connected" };
    if (!subtle()) return { ok: false, code: "no_crypto" };
    const mine = snapshot(), key = b64(rand(32));
    const r = await call("/v1/create", { data: await seal(mine, key) });
    if (!r.ok || !r.secret) return { ok: false, code: r.code || "error" };
    write({ secret: r.secret, key, version: r.version || 1, lastFp: fingerprint(mine), lastAt: Date.now(), state: "ok" }); emit(); start();
    return { ok: true };
  }
  // On a connected device: a join code for one more device (once, 10 minutes). Asking again replaces it.
  async function invite() {
    const s = read(); if (!s.secret || !s.key) return { ok: false, code: "not_connected" };
    if (!baseUrl()) return { ok: false, code: "offline" };
    for (let i = 0; i < 3; i++) {   // the code is made here and shown once; only its slow hashes go out
      const code = newCode();
      const [lookup, wrapped] = await Promise.all([lookupOf(code), wrap(s.key, code)]);
      const r = await call("/v1/invite", { secret: s.secret, lookup, wrapped });
      if (r.status === 404) { forget("deleted"); return { ok: false, code: "deleted" }; }
      if (r.status === 409) continue;   // another family holds this code right now: pick another
      if (!r.ok) return { ok: false, code: r.code || "error" };
      return { ok: true, code: formatCode(code), until: Date.now() + (r.expires_in || 600) * 1000 };
    }
    return { ok: false, code: "error" };
  }
  // On the new device: the code from the connected one.
  async function join(code) {
    if (read().secret) return { ok: false, code: "already_connected" };
    const d = digits(code);
    if (d.length !== CODE_LEN) return { ok: false, code: "bad_code" };
    if (!subtle()) return { ok: false, code: "no_crypto" };
    if (!baseUrl()) return { ok: false, code: "offline" };
    const r = await call("/v1/join", { lookup: await lookupOf(d) });
    if (!r.ok || !r.secret) return { ok: false, code: r.code || "error" };
    let key;
    try { key = await unwrap(r.wrapped, d); } catch (e) { await call("/v1/leave", { secret: r.secret }); return { ok: false, code: "failed" }; }
    write({ secret: r.secret, key, version: 0, state: "syncing" }); emit();
    const res = await syncNow(); start();
    return res.ok ? { ok: true, imported: res.imported } : res;
  }
  // Only this device stops (its secret is cancelled in the cloud when there is a network). Its progress stays here.
  async function disconnect() { const s = read(); forget(null); if (s.secret) await call("/v1/leave", { secret: s.secret }); return { ok: true }; }
  // Removes the family from the cloud for good. Every device keeps what it has and disconnects at its next sync.
  async function deleteFamily() {
    const s = read(); if (!s.secret) return { ok: false, code: "not_connected" };
    const r = await call("/v1/delete", { secret: s.secret });
    if (r.ok || r.code === "not_found") { forget(null); return { ok: true }; }
    return { ok: false, code: r.code || "error" };
  }
  function forget(note) { write(note ? { note } : {}); stop(); emit(); }

  // ---------- when to sync ----------
  let timers = [], started = false;
  function start() {
    if (started || !read().secret || !read().key || typeof document === "undefined") return; started = true;
    timers.push(setTimeout(syncNow, START_MS));
    timers.push(setInterval(() => { if (document.visibilityState !== "hidden") syncNow(); }, EVERY_MS));
    // a change on this device: sync within ~15 s (cheap check of the export's fingerprint, in idle time)
    timers.push(setInterval(() => { const go = () => { try { if (read().lastFp !== fingerprint(snapshot())) syncNow(); } catch (e) {} };
      root.requestIdleCallback ? requestIdleCallback(go, { timeout: 3000 }) : go(); }, CHECK_MS));
  }
  function stop() { timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers = []; started = false; }
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && read().secret) syncNow(); });
    root.addEventListener("online", () => { if (read().secret) syncNow(); });
    root.addEventListener("pagehide", () => { /* nothing to flush: the next open syncs */ });
  }

  // ---------- status + listeners ----------
  const listeners = new Set();
  function emit() { const st = status(); listeners.forEach((fn) => { try { fn(st); } catch (e) {} }); }
  function status() { const s = read(); return { connected: !!(s.secret && s.key), state: s.state || null, lastAt: s.lastAt || null, note: s.note || null }; }
  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  // ---------- the settings row (bottom of the hub's parent settings, behind the times-table gate) ----------
  const T = {
    title: "סִנְכְּרוּן בֵּין מַכְשִׁירִים",
    intro: "הַהִתְקַדְּמוּת שֶׁל הַיְּלָדִים מִתְעַדְכֶּנֶת לְבַד בְּכָל הַמַּכְשִׁירִים שֶׁל הַמִּשְׁפָּחָה.",
    create: "חִבּוּר הַמַּכְשִׁיר הָרִאשׁוֹן", have: "יֵשׁ לִי קוֹד", connect: "חִבּוּר", place: "8 סְפָרוֹת",
    haveHelp: "אֶת הַקּוֹד מְקַבְּלִים בְּמַכְשִׁיר שֶׁכְּבָר מְחֻבָּר, בַּכַּפְתּוֹר \"הוֹסָפַת מַכְשִׁיר\".",
    connected: "הַמַּכְשִׁיר מְחֻבָּר.", ok: "מְעֻדְכָּן", syncing: "מִתְעַדְכֵּן…", offline: "יִתְעַדְכֵּן כְּשֶׁתַּחְזֹר הָרֶשֶׁת", error: "יִתְעַדְכֵּן בְּהֶמְשֵׁךְ",
    add: "הוֹסָפַת מַכְשִׁיר", codeIs: "הַקּוֹד לַמַּכְשִׁיר הַחָדָשׁ:", codeLeft: (m) => "תָּקֵף עוֹד " + m + " דַּקּוֹת, פַּעַם אַחַת.", codeGone: "הַקּוֹד פָּג. אֶפְשָׁר לְבַקֵּשׁ קוֹד חָדָשׁ.",
    disconnect: "נִתּוּק הַמַּכְשִׁיר", del: "מְחִיקַת הַמִּשְׁפָּחָה מֵהֶעָנָן", delAgain: "לְחִיצָה נוֹסֶפֶת מוֹחֶקֶת מֵהֶעָנָן לְתָמִיד",
    created: "הַמַּכְשִׁיר מְחֻבָּר. לְמַכְשִׁיר נוֹסָף: \"הוֹסָפַת מַכְשִׁיר\".", joined: "הַמַּכְשִׁיר מְחֻבָּר וּמְעֻדְכָּן.",
    disconnected: "הַמַּכְשִׁיר נֻתַּק. הַהִתְקַדְּמוּת נִשְׁאֲרָה בּוֹ.", deleted: "הַמִּשְׁפָּחָה נִמְחֲקָה מֵהֶעָנָן. מַה שֶּׁבַּמַּכְשִׁירִים נִשְׁאַר בָּהֶם.",
    deletedElsewhere: "הַמִּשְׁפָּחָה נִמְחֲקָה מֵהֶעָנָן, וְהַמַּכְשִׁיר נֻתַּק. הַהִתְקַדְּמוּת נִשְׁאֲרָה בּוֹ.",
    not_found: "הַקּוֹד לֹא נִמְצָא אוֹ שֶׁפָּג. אֶפְשָׁר לְבַקֵּשׁ קוֹד חָדָשׁ בַּמַּכְשִׁיר הַמְּחֻבָּר.", bad_code: "צָרִיךְ 8 סְפָרוֹת.",
    offlineNow: "אֵין אִינְטֶרְנֶט כָּרֶגַע. אֶפְשָׁר לְנַסּוֹת שׁוּב אַחַר כָּךְ.", too_many_wrong_codes: "יוֹתֵר מִדַּי נִסְיוֹנוֹת. אֶפְשָׁר לְנַסּוֹת שׁוּב בְּעוֹד שָׁעָה.",
    rate_limited: "יוֹתֵר מִדַּי בַּקָּשׁוֹת. אֶפְשָׁר לְנַסּוֹת שׁוּב בְּעוֹד דַּקָּה.", too_many_families: "אִי אֶפְשָׁר לְחַבֵּר כָּרֶגַע. אֶפְשָׁר לְנַסּוֹת שׁוּב בְּעוֹד שָׁעָה.",
    too_many_invites: "בִּקַּשְׁתֶּם הַרְבֵּה קוֹדִים. אֶפְשָׁר לְנַסּוֹת שׁוּב בְּעוֹד שָׁעָה.",
    no_crypto: "הַדַּפְדְּפָן הַזֶּה לֹא יָכוֹל לְהַצְפִּין. אֶפְשָׁר לְנַסּוֹת בְּדַפְדְּפָן אַחֵר.", unreadable: "יִתְעַדְכֵּן בְּהֶמְשֵׁךְ",
    failed: "מַשֶּׁהוּ לֹא הִצְלִיחַ. אֶפְשָׁר לְנַסּוֹת שׁוּב.",
  };
  const errText = (c) => (c === "offline" ? T.offlineNow : typeof T[c] === "string" && c !== "ok" ? T[c] : T.failed);
  function settingsRow(host, { onDone } = {}) {
    css();
    const box = document.createElement("div"); box.className = "fl-sync"; host.append(box);
    let msg = "", busy = false, joinOpen = false, typed = "", inv = null, tick = 0;
    const draw = () => {
      const st = status();
      if (!st.connected) {
        inv = null;
        box.innerHTML = `<div class="fl-sy-title">${T.title}</div><div class="fl-sy-intro">${T.intro}</div>
          <div class="fl-sy-btns"><button type="button" class="fl-sy-create">${T.create}</button><button type="button" class="fl-sy-have">${T.have}</button></div>
          <div class="fl-sy-join"${joinOpen ? "" : " hidden"}><div class="fl-sy-help">${T.haveHelp}</div><input class="fl-sy-in" inputmode="numeric" autocomplete="off" dir="ltr" maxlength="9" placeholder="${T.place}"><button type="button" class="fl-sy-go">${T.connect}</button></div>
          <div class="fl-sy-msg" aria-live="polite"></div>`;
        const joinBox = box.querySelector(".fl-sy-join"), inp = box.querySelector(".fl-sy-in");
        inp.value = typed;
        box.querySelector(".fl-sy-have").onclick = () => { joinOpen = true; joinBox.hidden = false; inp.focus(); };
        inp.oninput = () => { const d = digits(inp.value).slice(0, CODE_LEN); inp.value = typed = group(d); };
        box.querySelector(".fl-sy-create").onclick = () => act(create, () => (msg = T.created));
        const go = () => act(() => join(inp.value), () => { msg = T.joined; typed = ""; joinOpen = false; });
        box.querySelector(".fl-sy-go").onclick = go; inp.onkeydown = (e) => { if (e.key === "Enter") go(); };
      } else {
        const left = inv ? Math.ceil((inv.until - Date.now()) / 60000) : 0;
        if (inv && left <= 0) { inv = null; if (!msg) msg = T.codeGone; }
        box.innerHTML = `<div class="fl-sy-title">${T.title}</div>
          <div class="fl-sy-state">${T.connected} ${T[st.state] || T.ok}</div>
          ${inv ? `<div class="fl-sy-code"><span>${T.codeIs}</span> <b dir="ltr">${inv.code}</b><div class="fl-sy-left">${T.codeLeft(left)}</div></div>` : ""}
          <div class="fl-sy-btns"><button type="button" class="fl-sy-add">${T.add}</button><button type="button" class="fl-sy-off">${T.disconnect}</button><button type="button" class="fl-sy-del">${T.del}</button></div>
          <div class="fl-sy-msg" aria-live="polite"></div>`;
        box.querySelector(".fl-sy-add").onclick = () => act(invite, (r) => { inv = r; msg = ""; });
        box.querySelector(".fl-sy-off").onclick = () => act(disconnect, () => { inv = null; msg = T.disconnected; });
        const del = box.querySelector(".fl-sy-del"); let armed = 0;
        del.onclick = () => {
          if (!armed) { armed = setTimeout(() => { armed = 0; del.textContent = T.del; del.classList.remove("armed"); }, 6000); del.textContent = T.delAgain; del.classList.add("armed"); return; }
          clearTimeout(armed); armed = 0; act(deleteFamily, () => { inv = null; msg = T.deleted; });
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
    tick = setInterval(() => { if (inv && !busy) draw(); }, 15000);   // the minutes left on the join code
    draw();
    return { el: box, destroy: () => { off(); clearInterval(tick); box.remove(); } };
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
      .fl-sy-help{width:100%;font-size:.85em;color:#3b4a5c}.fl-sy-left{font-size:.85em;color:#3b4a5c;margin-top:2px}.fl-sy-code{font-size:1.1em;margin-top:6px}.fl-sy-code b{letter-spacing:.08em;font-size:1.15em}.fl-sy-state{font-size:.9em;color:#1f8048;margin-top:4px}
      .fl-sy-msg{margin-top:8px;font-size:.9em;color:#3b4a5c;min-height:1em}`;
    document.head.append(st);
  }

  // Is there a server to talk to? (MAIN 11.11: the hub shows the settings row only when this answers,
  // or the device is already connected; until Golan sets up the server the row stays hidden.)
  async function available() {
    if (!baseUrl()) return false;   // no server address yet: nothing is sent anywhere
    if (!subtle()) return false;    // no WebCrypto (not https): sync cannot be encrypted, so it is not offered
    let ctl = null, timer = null;
    try {
      ctl = root.AbortController ? new AbortController() : null; timer = ctl && setTimeout(() => ctl.abort(), 5000);
      const r = await fetch(baseUrl() + "/health", { signal: ctl ? ctl.signal : undefined });
      return r.ok;
    } catch (e) { return false; }
    finally { if (timer) clearTimeout(timer); }
  }
  FL.familySync = { status, available, create, invite, join, syncNow, disconnect, deleteFamily, settingsRow, onChange, formatCode, _canon: canon, _snapshot: snapshot };
  if (typeof document !== "undefined") start();
})(typeof window !== "undefined" ? window : globalThis);
