/* PAAADEL — latihan padel di rumah biar kamu makin jago di lapangan.
   Phone gyroscope → swing detection → racket-head & ball speed estimate, guided drills,
   one-stroke 3D replay, practice stats. Everything stays on this phone (localStorage). */
'use strict';
(function () {
  const app = document.getElementById('app');
  const $ = (s, r = document) => r.querySelector(s);
  const DEG = Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const now = () => performance.now();
  const PREVIEW = !!window.PALA_PREVIEW; // design preview page: no sensors, simulated swings only

  /* ===================== constants ===================== */
  const VERSION = '1.0';
  const LEVER = 0.62;          // m — rotation centre to racket sweet spot (effective)
  const BALL_RATIO = 1.35;     // padel ball off the sweet spot vs racket-head speed
  const GYRO_MAX = 34.4;       // rad/s (~1970 °/s) — most phone gyros clip at 2000 °/s
  const GMAX = 100;            // gauge full scale, km/h ball
  const SENS = {
    light: { label: 'Santai', w: 6 },
    medium: { label: 'Sedang', w: 9 },
    full: { label: 'Kenceng', w: 13 }
  };
  const STROKES = {
    FH: { n: 'Forehand', en: 'Forehand', d: 'Pukulan sisi forehand' },
    BH: { n: 'Backhand', en: 'Backhand', d: 'Pukulan sisi backhand' },
    VL: { n: 'Voli', en: 'Volley', d: 'Di depan net, pendek & tegas' },
    BJ: { n: 'Bandeja', en: 'Bandeja', d: 'Overhead slice, jaga posisi', over: true },
    VB: { n: 'Víbora', en: 'Vibora', d: 'Overhead pakai spin samping', over: true },
    SM: { n: 'Smash', en: 'Smash', d: 'Overhead full power', over: true },
    LB: { n: 'Lob', en: 'Lob', d: 'Angkat bola ke belakang lawan' },
    SV: { n: 'Servis', en: 'Serve', d: 'Underhand, di bawah pinggang' }
  };
  const STROKE_ORDER = ['FH', 'BH', 'VL', 'BJ', 'VB', 'SM', 'LB', 'SV'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const P = (stroke, reps) => ({ kind: 'stroke', stroke, reps });
  const T = (stroke, secs) => ({ kind: 'stroke', stroke, secs });
  const Rr = secs => ({ kind: 'rest', secs });
  const PRESETS = [
    { id: 'p-warm', name: 'Pemanasan', blocks: [P('FH', 10), Rr(20), P('BH', 10), Rr(20), P('VL', 10), Rr(20), P('BJ', 5)] },
    { id: 'p-volley', name: 'Tembok Voli', blocks: [T('VL', 45), Rr(15), T('VL', 45), Rr(15), T('VL', 45)] },
    { id: 'p-bjsm', name: 'Bandeja & Smash', blocks: [P('BJ', 8), Rr(20), P('SM', 8), Rr(20), P('BJ', 8), Rr(20), P('SM', 8)] },
    { id: 'p-cardio', name: 'Kardio 5 Menit', blocks: [T('FH', 60), T('BH', 60), T('FH', 60), T('BH', 60), T('VL', 60)] },
    { id: 'p-lob', name: 'Lob & Bandeja', blocks: [P('LB', 6), Rr(15), P('BJ', 6), Rr(15), P('LB', 6), Rr(15), P('BJ', 6)] },
    { id: 'p-net', name: 'Main di Net', blocks: [P('FH', 8), P('VL', 8), Rr(15), P('BH', 8), P('VL', 8)] },
    { id: 'p-vibora', name: 'Víbora & Smash', blocks: [P('VB', 6), Rr(20), P('VB', 6), Rr(20), P('SM', 5), Rr(20), P('SM', 5)] }
  ];

  /* ===================== icons ===================== */
  const sv = (d, w = 22) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICON = {
    home: sv('<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>'),
    stats: sv('<path d="M5 20V11M10 20V5M15 20v-8M20 20v-4"/>'),
    cube: sv('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>'),
    gear: sv('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    back: sv('<path d="M15 18l-6-6 6-6"/>'),
    chev: sv('<path d="M9 18l6-6-6-6"/>'),
    swing: sv('<circle cx="8.5" cy="4.5" r="1.8"/><path d="M8.5 7.5L7 13.5l3 2.5 1 5M7 13.5L4.5 20M8 9l4.5 2 3-3.5"/><ellipse cx="18" cy="5.2" rx="2.4" ry="3" transform="rotate(38 18 5.2)"/>'),
    wave: sv('<path d="M2 12h4l3-8 4 16 3-8h6"/>'),
    clip: sv('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>'),
    spk: sv('<path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>'),
    spkOff: sv('<path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M22 9l-6 6M16 9l6 6"/>'),
    skip: sv('<path d="M5 5l9 7-9 7V5zM19 5v14"/>'),
    star: sv('<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>'),
    starFill: sv('<path fill="currentColor" d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>'),
    lock: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    reset: sv('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>', 16),
    sliders: sv('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>', 16),
    image: sv('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>', 16),
    target: sv('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor"/>', 16),
    play: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M8 4.5v15l12-7.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
    plus: sv('<path d="M12 5v14M5 12h14"/>'),
    minus: sv('<path d="M5 12h14"/>'),
    up: sv('<path d="M6 15l6-6 6 6"/>'),
    down: sv('<path d="M6 9l6 6 6-6"/>'),
    x: sv('<path d="M6 6l12 12M18 6L6 18"/>'),
    check: sv('<path d="M5 12.5l4.5 4.5L19 7"/>'),
    bolt: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>',
    boltL: sv('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
    rest: sv('<path d="M6 8h10v5a5 5 0 0 1-10 0z"/><path d="M16 9h1.5a2.5 2.5 0 0 1 0 5H16M8 3v2M12 3v2"/>'),
    info: sv('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
    trash: sv('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
    sensor: sv('<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M3 8c-1 2.5-1 5.5 0 8M21 8c1 2.5 1 5.5 0 8"/>'),
    hand: sv('<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11.5V4a1.5 1.5 0 0 1 3 0v8M14 11.5V5.5a1.5 1.5 0 0 1 3 0V14M17 9.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1a7 7 0 0 1-5.5-2.7L3.8 16a1.6 1.6 0 0 1 2.4-2l1.8 1.6"/>'),
    clock: sv('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    flame: sv('<path d="M12 3c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-8z"/>'),
    trophy: sv('<path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 21h6M10 17h4v4h-4z"/>'),
    cal: sv('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
    gauge: sv('<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-6"/>'),
    download: sv('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
    upload: sv('<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>'),
    moon: sv('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>')
  };

  /* ===================== storage ===================== */
  const KEY = 'paaadel.v1', RKEY = 'paaadel.replays.v1';
  const DEFAULTS = {
    goal: 20, sound: true, soundKind: 'pop', dynamic: true, vibrate: true,
    coach: true, coachLang: 'id', unit: 'kmh', sens: 'medium', fine: 1, hand: 'R', calib: 1,
    autolock: true, seenHowTo: false, theme: 'auto', zone: { on: false, min: 35, max: 48, preset: 'kontrol' },
    look: { racket: 'classic', ribbon: true, ribbonColor: 'speed', ribbonWidth: 'face', ghosts: true, ghostDensity: 'normal', peak: true, dots: false }
  };
  function load(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  const S = load(KEY, null) || {};
  const prevLook = (S.settings && S.settings.look) || {}, prevZone = (S.settings && S.settings.zone) || {};
  S.settings = Object.assign({}, DEFAULTS, S.settings || {});
  S.settings.look = Object.assign({}, DEFAULTS.look, prevLook);
  S.settings.zone = Object.assign({}, DEFAULTS.zone, prevZone);
  S.days = S.days || {};
  S.sessions = S.sessions || [];
  S.strokes = S.strokes || {};
  S.best = S.best || { racket: 0, date: null };
  S.workouts = S.workouts || [];
  S.workoutsDone = S.workoutsDone || 0;
  S.replaysMade = S.replaysMade || 0;
  let REPLAYS = load(RKEY, []);
  const set = S.settings;
  let saveT = null;
  function persist(immediate) {
    clearTimeout(saveT);
    if (immediate) store(KEY, S); else saveT = setTimeout(() => store(KEY, S), 400);
  }
  function persistReplays() {
    if (!store(RKEY, REPLAYS)) {
      const i = REPLAYS.findIndex(r => !r.star);
      if (i >= 0 && REPLAYS.length > 1) { REPLAYS.splice(i, 1); persistReplays(); }
    }
  }
  addEventListener('pagehide', () => persist(true));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persist(true); });
  function applyTheme() {
    const r = document.documentElement;
    if (set.theme === 'light' || set.theme === 'dark') r.setAttribute('data-theme', set.theme);
    else if (!PREVIEW) r.removeAttribute('data-theme');
  }
  applyTheme();

  /* ===================== dates & formatting ===================== */
  const z2 = n => String(n).padStart(2, '0');
  function dayKey(d = new Date()) { return d.getFullYear() + '-' + z2(d.getMonth() + 1) + '-' + z2(d.getDate()); }
  function keyDate(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
  function day(k = dayKey()) { return S.days[k] || (S.days[k] = { sw: 0, best: 0, sec: 0, sess: 0 }); }
  function peekDay(k) { return S.days[k] || { sw: 0, best: 0, sec: 0, sess: 0 }; }
  const fmtDate = d => d.getDate() + ' ' + MONTHS[d.getMonth()];
  const mmss = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + z2(s % 60); };
  function dur(sec) {
    sec = Math.round(sec || 0);
    if (sec < 60) return sec + ' dtk';
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return h ? h + ' j ' + m + ' m' : m + ' mnt';
  }
  const U = () => (set.unit === 'mph' ? 'mph' : 'km/h');
  const conv = kmh => (set.unit === 'mph' ? kmh * 0.621371 : kmh);
  const fv = kmh => String(Math.round(conv(kmh)));
  const ballOf = r => r * BALL_RATIO;
  const racketKmh = (w, k) => w * LEVER * 3.6 * (k || set.calib);
  const thr = () => SENS[set.sens].w * set.fine;
  const minKmh = () => fv(racketKmh(thr()));
  const BAND = 5; // km/h ball — consistency band around the session median
  function consistency(arr) {
    if (!arr || arr.length < 5) return null;
    const s = arr.slice().sort((a, b) => a - b), med = s[Math.floor(s.length / 2)];
    return { pct: Math.round(arr.filter(v => Math.abs(v - med) <= BAND).length / arr.length * 100), med };
  }
  const zoneOf = v => !set.zone.on ? null : v < set.zone.min ? 'low' : v > set.zone.max ? 'high' : 'in';
  // racket-face tilt at contact (deg, + = open face), common coaching reference per stroke
  const FACE = { FH: [-5, 20], BH: [-5, 20], VL: [5, 25], BJ: [10, 35], VB: [0, 20], SM: [-15, 10], LB: [25, 55], SV: [0, 25] };

  /* ===================== stats helpers ===================== */
  function recordSwing(racket, stroke, countToRing = true) {
    const d = day();
    if (countToRing) d.sw++;
    const r1 = Math.round(racket * 10) / 10;
    if (r1 > d.best) d.best = r1;
    if (stroke) S.strokes[stroke] = (S.strokes[stroke] || 0) + 1;
    let isBest = false;
    if (r1 > (S.best.racket || 0)) { isBest = (S.best.racket || 0) > 0; S.best = { racket: r1, date: dayKey() }; }
    S.firstDay = S.firstDay || dayKey();
    persist();
    return isBest;
  }
  function recordSession(o) {
    S.sessions.push(o);
    if (S.sessions.length > 500) S.sessions.splice(0, S.sessions.length - 500);
    const d = day(); d.sec += Math.round(o.dur || 0); d.sess++;
    S.firstDay = S.firstDay || dayKey();
    persist(true);
  }
  const practiced = k => { const d = S.days[k]; return !!d && (d.sw > 0 || d.sec > 0); };
  function streaks() {
    const keys = Object.keys(S.days).filter(practiced).sort();
    let longest = 0, run = 0, prev = null;
    for (const k of keys) { const dt = keyDate(k); run = prev && (dt - prev) / 864e5 < 1.5 ? run + 1 : 1; longest = Math.max(longest, run); prev = dt; }
    let cur = 0; const d = new Date(); d.setHours(12, 0, 0, 0);
    if (!practiced(dayKey(d))) d.setDate(d.getDate() - 1);
    while (practiced(dayKey(d))) { cur++; d.setDate(d.getDate() - 1); }
    return { current: cur, longest };
  }

  /* ===================== quaternions [x,y,z,w] ===================== */
  const Q = {
    mul(a, b) {
      const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
      return [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz];
    },
    axis(x, y, z, a) { const s = Math.sin(a / 2); return [x * s, y * s, z * s, Math.cos(a / 2)]; },
    rot(q, v) {
      const [x, y, z, w] = q, [vx, vy, vz] = v;
      const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
      return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
    },
    norm(q) { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; },
    slerp(a, b, t) {
      let [bx, by, bz, bw] = b; let d = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
      if (d < 0) { d = -d; bx = -bx; by = -by; bz = -bz; bw = -bw; }
      if (d > 0.9995) return Q.norm([a[0] + (bx - a[0]) * t, a[1] + (by - a[1]) * t, a[2] + (bz - a[2]) * t, a[3] + (bw - a[3]) * t]);
      const th = Math.acos(d), s = Math.sin(th), wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
      return [a[0] * wa + bx * wb, a[1] * wa + by * wb, a[2] * wa + bz * wb, a[3] * wa + bw * wb];
    },
    // W3C device orientation (Z-X'-Y'') → rotation device frame → earth frame (x east, y north, z up)
    euler(a, b, g) { return Q.mul(Q.mul(Q.axis(0, 0, 1, a * DEG), Q.axis(1, 0, 0, b * DEG)), Q.axis(0, 1, 0, g * DEG)); },
    fromBasis(x, y, z) { // columns = device axes in earth coords
      const m00 = x[0], m01 = y[0], m02 = z[0], m10 = x[1], m11 = y[1], m12 = z[1], m20 = x[2], m21 = y[2], m22 = z[2];
      const tr = m00 + m11 + m22; let qx, qy, qz, qw;
      if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; qw = s / 4; qx = (m21 - m12) / s; qy = (m02 - m20) / s; qz = (m10 - m01) / s; }
      else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; qw = (m21 - m12) / s; qx = s / 4; qy = (m01 + m10) / s; qz = (m02 + m20) / s; }
      else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; qw = (m02 - m20) / s; qx = (m01 + m10) / s; qy = s / 4; qz = (m12 + m21) / s; }
      else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; qw = (m10 - m01) / s; qx = (m02 + m20) / s; qy = (m12 + m21) / s; qz = s / 4; }
      return Q.norm([qx, qy, qz, qw]);
    }
  };

  /* ===================== audio ===================== */
  const Snd = (() => {
    let ctx = null; const bufs = {};
    function noise(n) { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = Math.random() * 2 - 1; return a; }
    function bandpass(x, sr, f0, Qf) {
      const w0 = 2 * Math.PI * f0 / sr, al = Math.sin(w0) / (2 * Qf), cs = Math.cos(w0);
      const b0 = al, b2 = -al, a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
      const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < x.length; i++) { const xi = x[i]; const yi = (b0 * xi + b2 * x2 - a1 * y1 - a2 * y2) / a0; y[i] = yi; x2 = x1; x1 = xi; y2 = y1; y1 = yi; }
      return y;
    }
    function mk(len, fn) {
      const sr = ctx.sampleRate, n = Math.max(1, Math.floor(len * sr)), d = new Float32Array(n);
      fn(d, sr);
      let m = 0; for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(d[i]));
      if (m > 0) for (let i = 0; i < n; i++) d[i] *= 0.92 / m;
      const b = ctx.createBuffer(1, n, sr); b.getChannelData(0).set(d); return b;
    }
    function build() {
      // padel "pok": foam core + perforated face → short, dull, low-mid
      bufs.pop = mk(0.14, (d, sr) => {
        const nz = bandpass(noise(d.length), sr, 1700, 1.1); let ph = 0;
        for (let i = 0; i < d.length; i++) { const t = i / sr; const f = 165 + 560 * Math.exp(-t / 0.007); ph += 2 * Math.PI * f / sr; d[i] = Math.sin(ph) * Math.exp(-t / 0.024) + nz[i] * Math.exp(-t / 0.005) * 1.7; }
      });
      bufs.crisp = mk(0.1, (d, sr) => {
        const nz = bandpass(noise(d.length), sr, 3600, 1.5); let ph = 0;
        for (let i = 0; i < d.length; i++) { const t = i / sr; const f = 480 + 900 * Math.exp(-t / 0.004); ph += 2 * Math.PI * f / sr; d[i] = Math.sin(ph) * Math.exp(-t / 0.013) * 0.7 + nz[i] * Math.exp(-t / 0.0035) * 2.2; }
      });
      bufs.whip = mk(0.12, (d, sr) => {
        const n = d.length, lo = bandpass(noise(n), sr, 1300, 0.9), hi = bandpass(noise(n), sr, 4300, 1.3), tc = 0.012;
        for (let i = 0; i < n; i++) { const t = i / sr; const sw = t < tc ? Math.pow(t / tc, 2) * 0.6 : Math.exp(-(t - tc) / 0.035) * 0.6; const cr = t < tc ? 0 : Math.exp(-(t - tc) / 0.006) * 2.6; d[i] = lo[i] * sw + hi[i] * cr; }
      });
      bufs.tick = mk(0.05, (d, sr) => { for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] = Math.sin(2 * Math.PI * 1500 * t) * Math.exp(-t / 0.008); } });
      bufs.beep = mk(0.13, (d, sr) => { for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] = Math.sin(2 * Math.PI * 880 * t) * Math.min(1, t / 0.004) * Math.exp(-t / 0.06); } });
      bufs.ok = mk(0.32, (d, sr) => { for (let i = 0; i < d.length; i++) { const t = i / sr, t2 = t - 0.065; d[i] = Math.sin(2 * Math.PI * 1568 * t) * Math.exp(-t / 0.05) * Math.min(1, t / 0.002) + (t2 > 0 ? Math.sin(2 * Math.PI * 2093 * t2) * Math.exp(-t2 / 0.09) : 0); } });
      bufs.miss = mk(0.16, (d, sr) => { const nz = bandpass(noise(d.length), sr, 520, 0.8); let ph = 0; for (let i = 0; i < d.length; i++) { const t = i / sr, f = 105 + 70 * Math.exp(-t / 0.02); ph += 2 * Math.PI * f / sr; d[i] = Math.sin(ph) * Math.exp(-t / 0.045) + nz[i] * Math.exp(-t / 0.01) * 0.9; } });
      bufs.ding = mk(0.9, (d, sr) => { for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] = (Math.sin(2 * Math.PI * 1318.5 * t) + 0.45 * Math.sin(2 * Math.PI * 2637 * t) + 0.18 * Math.sin(2 * Math.PI * 3955 * t)) * Math.exp(-t / 0.26) * Math.min(1, t / 0.003); } });
      bufs.done = mk(1.2, (d, sr) => {
        for (let i = 0; i < d.length; i++) {
          const t = i / sr; const a = Math.sin(2 * Math.PI * 988 * t) * Math.exp(-t / 0.2);
          const t2 = t - 0.16; const b = t2 > 0 ? (Math.sin(2 * Math.PI * 1318.5 * t2) + 0.4 * Math.sin(2 * Math.PI * 2637 * t2)) * Math.exp(-t2 / 0.35) : 0;
          d[i] = a * 0.7 + b;
        }
      });
    }
    function unlock() {
      try {
        if (!ctx) {
          try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* older iOS */ }
          const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
          ctx = new AC({ latencyHint: 'interactive' }); build();
        }
        if (ctx.state !== 'running') ctx.resume();
        const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0);
      } catch (e) { /* audio unavailable */ }
    }
    function play(name, gain = 1) {
      if (!ctx || !bufs[name]) return;
      try {
        if (ctx.state !== 'running') ctx.resume();
        const s = ctx.createBufferSource(); s.buffer = bufs[name];
        const g = ctx.createGain(); g.gain.value = gain; s.connect(g); g.connect(ctx.destination); s.start();
      } catch (e) { /* ignore */ }
    }
    function hit(norm) {
      norm = clamp(norm || 0.5, 0, 1);
      if (set.sound) {
        const kinds = ['pop', 'crisp', 'whip'];
        const k = set.soundKind === 'random' ? kinds[Math.floor(Math.random() * 3)] : set.soundKind;
        play(k, set.dynamic ? 0.3 + 0.7 * norm : 1);
      }
      if (set.vibrate && navigator.vibrate) { try { navigator.vibrate(Math.round(14 + 26 * norm)); } catch (e) { /* ignore */ } }
    }
    function zoneHit(norm, z) {
      if (!z || z === 'in') { hit(norm); if (z === 'in' && set.sound) setTimeout(() => play('ok', 0.55), 70); return; }
      if (set.sound) play('miss', 0.95);
      if (set.vibrate && navigator.vibrate) { try { navigator.vibrate([12, 50, 12]); } catch (e) { /* ignore */ } }
    }
    return { unlock, play, hit, zoneHit };
  })();

  /* ===================== coach voice ===================== */
  const Coach = (() => {
    const ss = window.speechSynthesis; let voice = null;
    function pick() {
      if (!ss) return;
      const vs = ss.getVoices() || [], want = set.coachLang === 'en' ? 'en' : 'id';
      voice = vs.find(v => (v.lang || '').toLowerCase().replace('_', '-').startsWith(want + '-') && /premium|enhanced|natural/i.test(v.name))
        || vs.find(v => (v.lang || '').toLowerCase().replace('_', '-').startsWith(want)) || null;
    }
    if (ss) { pick(); try { ss.addEventListener('voiceschanged', pick); } catch (e) { ss.onvoiceschanged = pick; } }
    function say(id, en, force) {
      if (!ss || (!set.coach && !force)) return;
      try {
        const u = new SpeechSynthesisUtterance(set.coachLang === 'en' ? en : id);
        u.lang = set.coachLang === 'en' ? 'en-US' : 'id-ID'; if (voice) u.voice = voice; u.rate = 1.04;
        ss.cancel(); ss.speak(u);
      } catch (e) { /* ignore */ }
    }
    function prime() { if (!ss) return; try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; ss.speak(u); } catch (e) { /* ignore */ } }
    function stop() { try { ss && ss.cancel(); } catch (e) { /* ignore */ } }
    return { say, prime, pick, stop, ok: !!ss };
  })();
  const sName = (k) => STROKES[k].n, sEn = (k) => STROKES[k].en;

  /* ===================== wake lock ===================== */
  const Wake = {
    lock: null, want: false,
    async on() { this.want = true; try { if ('wakeLock' in navigator && !this.lock) { this.lock = await navigator.wakeLock.request('screen'); this.lock.addEventListener('release', () => { this.lock = null; }); } } catch (e) { /* refused */ } },
    off() { this.want = false; try { if (this.lock) this.lock.release(); } catch (e) { /* ignore */ } this.lock = null; }
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Wake.want) Wake.on(); });

  /* ===================== motion sensors ===================== */
  const Motion = (() => {
    const subs = new Set(), buf = [], obuf = [];
    let ok = false, sim = false, listening = false, nEv = 0, firstCb = null, lastT = 0, rate = 0, lastOriE = null;
    function emit(s) {
      buf.push(s); const cut = s.t - 6000; while (buf.length && buf[0].t < cut) buf.shift();
      lastT = s.t; subs.forEach(f => { try { f(s); } catch (e) { console.error(e); } });
    }
    function pushOri(t, q) { obuf.push({ t, q }); const cut = t - 6000; while (obuf.length && obuf[0].t < cut) obuf.shift(); }
    function onMotion(e) {
      const r = e.rotationRate; if (!r || (r.alpha == null && r.beta == null && r.gamma == null)) return;
      const t = now(); nEv++;
      if (lastT && !sim) { const dt = t - lastT; if (dt > 0 && dt < 250) rate = rate ? rate * 0.95 + (1000 / dt) * 0.05 : 1000 / dt; }
      if (firstCb) { const f = firstCb; firstCb = null; f(); }
      if (sim) return;
      const wx = +r.beta || 0, wy = +r.gamma || 0, wz = +r.alpha || 0; // °/s about device x, y, z
      emit({ t, w: Math.hypot(wx, wy, wz) * DEG, wx, wy, wz });
    }
    function onOri(e) {
      if (sim || (e.beta == null && e.gamma == null)) return;
      lastOriE = { a: e.alpha || 0, b: e.beta || 0, g: e.gamma || 0 };
      pushOri(now(), Q.euler(lastOriE.a, lastOriE.b, lastOriE.g));
    }
    function listen() { if (listening) return; listening = true; addEventListener('devicemotion', onMotion); addEventListener('deviceorientation', onOri); }
    async function ensure() {
      if (ok || sim) return { ok: true, sim };
      if (PREVIEW) { sim = true; startSim(); return { ok: true, sim }; }
      const DME = window.DeviceMotionEvent, DOE = window.DeviceOrientationEvent;
      let perm = 'granted';
      try {
        if (DME && typeof DME.requestPermission === 'function') {
          // iOS shows its prompt here; this must run inside the tap handler, before any await
          const ps = [DME.requestPermission()];
          if (DOE && typeof DOE.requestPermission === 'function') ps.push(DOE.requestPermission().catch(() => 'denied'));
          perm = (await Promise.all(ps))[0];
        }
      } catch (err) { perm = 'error'; }
      listen();
      const got = await new Promise(res => { if (nEv > 0) return res(true); firstCb = () => res(true); setTimeout(() => res(nEv > 0), 1500); });
      if (got) { ok = true; return { ok: true, sim: false }; }
      if (perm === 'denied' || perm === 'error') return { ok: false, denied: true };
      sim = true; startSim();
      return { ok: true, sim };
    }
    function sub(f) { subs.add(f); return () => subs.delete(f); }
    function samples(t0, t1) { return buf.filter(s => s.t >= t0 && s.t <= t1); }
    function oriAt(t) {
      if (!obuf.length) return null;
      let lo = 0, hi = obuf.length - 1;
      if (t <= obuf[0].t) return obuf[0].t - t < 120 ? obuf[0].q : null;
      if (t >= obuf[hi].t) return t - obuf[hi].t < 120 ? obuf[hi].q : null;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (obuf[m].t <= t) lo = m; else hi = m; }
      const a = obuf[lo], b = obuf[hi]; const f = (t - a.t) / Math.max(1e-6, b.t - a.t);
      return Q.slerp(a.q, b.q, f);
    }
    function currentQ() { return obuf.length ? obuf[obuf.length - 1].q : null; }

    /* ---- simulation (no sensor: desktop, or for trying the flow) ---- */
    let simTimer = null, simSw = null;
    function poseQ(theta, tilt, face = 0) { // forehand-like: racket axis sweeps around "up"; face tilted open by `face`
      const c = Math.cos(tilt);
      const d = [Math.cos(theta) * c, Math.sin(theta) * c, Math.sin(tilt)];
      let n = [-Math.sin(theta) * Math.cos(face), Math.cos(theta) * Math.cos(face), Math.sin(face)];
      const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      let x = cr(d, n); const l = Math.hypot(x[0], x[1], x[2]) || 1; x = x.map(v => v / l); n = cr(x, d);
      return Q.fromBasis(x, d, n);
    }
    function startSim() {
      if (simTimer) return;
      rate = 60;
      simTimer = setInterval(() => {
        const t = now(); let w = 0.12 + Math.random() * 0.2, theta = -1.9, tilt = 0.35;
        if (simSw) {
          const u = (t - simSw.t0) / 1000 - 0.5;
          if (u > 0.9) { simSw = null; }
          else {
            const S1 = 1 / (1 + Math.exp(-u / simSw.tau));
            theta = -1.9 + simSw.D * S1; tilt = 0.35 - 0.5 * S1 + 0.25 * Math.max(0, S1 - 0.8);
            w += simSw.D / simSw.tau * S1 * (1 - S1) + 1.6 * Math.exp(-Math.pow((u + 0.32) / 0.1, 2));
          }
        }
        pushOri(t, poseQ(theta, tilt, simSw ? simSw.face : 0.15));
        emit({ t, w, wx: 0, wy: 0, wz: w / DEG });
      }, 16);
    }
    function simSwing(power) {
      if (!sim) return;
      const D = 4.1 + Math.random() * 0.4, peak = power || (14 + Math.random() * 9);
      simSw = { t0: now(), D, tau: D / (4 * peak), face: (Math.random() * 34 - 6) * DEG };
    }
    return {
      ensure, sub, samples, oriAt, currentQ, simSwing,
      isSim: () => sim, isOn: () => ok || sim, rate: () => rate, lastT: () => lastT, lastOri: () => lastOriE, events: () => nEv
    };
  })();

  /* swing detector: crossing the threshold opens a swing; first drop off the peak = contact (sound);
     swing closes when speed falls well below the threshold; short cool-down stops double counts */
  class Detector {
    constructor(getT, onHit, onSwing) { this.getT = getT; this.onHit = onHit; this.onSwing = onSwing; this.state = 'idle'; }
    feed(s) {
      const T = this.getT(), t = s.t, w = s.w;
      if (this.state === 'idle') {
        if (w >= T) { this.state = 'rise'; this.peak = w; this.peakT = t; this.t0 = t; this.fired = false; }
      } else if (this.state === 'rise') {
        if (w > this.peak) { this.peak = w; this.peakT = t; }
        else if (!this.fired && w < this.peak * 0.9) { this.fired = true; this.onHit && this.onHit(this.peak, this.peakT); }
        if ((this.fired && w < T * 0.55) || t - this.t0 > 700) {
          if (!this.fired) { this.fired = true; this.onHit && this.onHit(this.peak, this.peakT); }
          this.onSwing && this.onSwing(this.peak, this.peakT);
          this.state = 'cool'; this.coolUntil = t + 230; this.coolStart = t;
        }
      } else if (this.state === 'cool') {
        if ((t >= this.coolUntil && w < T * 0.6) || t - this.coolStart > 1500) this.state = 'idle';
      }
    }
  }

  /* ===================== screen lock (palm on glass) ===================== */
  const Guard = (() => {
    let el = null, holdT = null;
    function engage() {
      if (el || !set.autolock || Motion.isSim()) return; // simulated swings come from a button, so no palm to guard against
      el = document.createElement('div'); el.id = 'guard';
      el.innerHTML = `<div class="guard-pill" role="button" tabindex="0" aria-label="Tahan buat buka kunci layar"><span class="lk"><svg class="pr" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="2.4"/><circle class="p" cx="18" cy="18" r="15.9" fill="none" stroke="#FF6A2B" stroke-width="2.4" pathLength="100"/></svg>${ICON.lock}</span><span>Layar dikunci · tahan buat buka</span></div>`;
      document.body.appendChild(el);
      const pill = el.querySelector('.guard-pill');
      const stopHold = () => { clearTimeout(holdT); pill.classList.remove('hold'); };
      el.addEventListener('pointerdown', e => { e.preventDefault(); });
      el.addEventListener('contextmenu', e => e.preventDefault());
      pill.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); pill.classList.add('hold'); holdT = setTimeout(release, 720); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => pill.addEventListener(ev, stopHold));
      pill.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') release(); });
    }
    function release() { clearTimeout(holdT); if (el) el.remove(); el = null; }
    return { engage, release, on: () => !!el };
  })();


  /* ===================== overlays, toast, routing ===================== */
  let actions = {}, ovActions = {}, curOv = null, cleanup = null, curName = 'home';
  function openOv(html, acts = {}, center = false) {
    closeOv();
    const ov = document.createElement('div'); ov.className = 'ov' + (center ? ' center' : '');
    ov.innerHTML = `<div class="${center ? 'dlg' : 'sheet'}" role="dialog" aria-modal="true">${html}</div>`;
    ov.addEventListener('click', e => { if (e.target === ov) closeOv(); });
    document.body.appendChild(ov); curOv = ov; ovActions = acts;
    return ov;
  }
  function closeOv() { if (curOv) curOv.remove(); curOv = null; ovActions = {}; }
  function dialog(title, body, buttons) {
    const acts = {};
    const html = `<h3>${esc(title)}</h3>${body ? `<p>${body}</p>` : ''}<div class="${buttons.length > 1 ? 'row-btns' : ''}">${buttons.map((b, i) => { acts['b' + i] = () => { closeOv(); b.fn && b.fn(); }; return `<button class="btn small ${b.kind || ''}" data-act="b${i}">${esc(b.label)}</button>`; }).join('')}</div>`;
    openOv(html, acts, true);
  }
  let toastT = null;
  function toast(msg) {
    let el = $('.toast'); if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg; clearTimeout(toastT); toastT = setTimeout(() => el.remove(), 2600);
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-tab]');
    if (t && !(curOv && curOv.contains(t))) { Snd.unlock(); if (t.dataset.tab !== curName) go(t.dataset.tab); return; }
    const b = e.target.closest('[data-act]'); if (!b) return;
    const inOv = curOv && curOv.contains(b);
    const f = inOv ? ovActions[b.dataset.act] : actions[b.dataset.act];
    if (f) { Snd.unlock(); f(b, e); }
  });
  function bindInputs(root, map) { Object.entries(map).forEach(([id, fn]) => { const el = root.querySelector('#' + id); if (el) el.addEventListener('input', () => fn(el)); }); }

  const TAB_SCREENS = ['home', 'workouts', 'analysis', 'stats'];
  function go(name, p = {}) {
    if (cleanup) { const c = cleanup; cleanup = null; try { c(); } catch (e) { console.error(e); } }
    Guard.release(); closeOv(); actions = {};
    curName = name; window.scrollTo(0, 0);
    (SCREENS[name] || SCREENS.home)(p);
    if (name !== 'home') armBack();
  }
  if (!PREVIEW) { try { history.replaceState({ root: true }, ''); } catch (e) { /* ignore */ } }
  function armBack() { if (PREVIEW) return; try { if (!history.state || history.state.root) history.pushState({ app: true }, ''); } catch (e) { /* ignore */ } }
  addEventListener('popstate', () => {
    if (curOv) { closeOv(); armBack(); return; }
    if (curName !== 'home') { (actions.back || (() => go('home')))(); armBack(); }
  });

  async function startWith(fn) {
    Snd.unlock(); Coach.prime();
    const r = await Motion.ensure();
    if (!r.ok) {
      dialog('Izin sensor belum dikasih', 'PAAADEL butuh izin <b>Gerakan & Orientasi</b> buat baca ayunanmu. Tutup tab ini, buka lagi link-nya, terus pilih <b>Izinkan</b>. Pastiin link-nya pakai https ya.', [{ label: 'Oke, ngerti', kind: 'teal' }]);
      return;
    }
    if (r.sim && !startWith.warned && !PREVIEW) { startWith.warned = true; toast('Sensor nggak ketemu, pakai mode simulasi'); }
    fn();
  }

  /* ===================== shared UI pieces ===================== */
  const LOGO = '<span class="logo" aria-label="PAAADEL">P<span class="aaa" aria-hidden="true"><i>A</i><i>A</i><i>A</i></span>DEL</span>';
  const TABS = [['home', 'Beranda', 'home'], ['workouts', 'Program', 'clip'], ['analysis', 'Analisis', 'cube'], ['stats', 'Progres', 'stats']];
  const tabbar = a => `<div class="tabbar"><nav aria-label="Menu utama">${TABS.map(([k, l, ic]) => `<button data-tab="${k}" ${k === a ? 'aria-current="page"' : ''}>${ICON[ic]}<span>${l}</span><i class="pip"></i></button>`).join('')}</nav></div>`;
  const subhdr = (title, right = '<span></span>') => `<header class="subhdr"><button class="round" data-act="back" aria-label="Kembali">${ICON.back}</button><h1 class="title">${title}</h1>${right}</header>`;
  const switchBtn = (act, on, label, extra = '') => `<button class="sw" role="switch" aria-checked="${!!on}" aria-label="${label}" data-act="${act}" ${extra}></button>`;
  const simBtn = () => Motion.isSim() ? '<button class="btn small sim" data-act="sim">Simulasi ayunan</button>' : '';
  const COURT = '<svg class="court" viewBox="0 0 200 100" fill="none" stroke="#fff" stroke-width="2.5" aria-hidden="true"><rect x="2" y="2" width="196" height="96" rx="5"/><path d="M100 2v96M30.5 2v96M169.5 2v96M30.5 50h139"/></svg>';

  function sensSheet(after) {
    const upd = () => {
      const lbl = curOv && curOv.querySelector('#fineLbl'); if (lbl) lbl.textContent = `×${set.fine.toFixed(2)} · minimal ≈${minKmh()} ${U()} raket`;
      const f = curOv && curOv.querySelector('#fine'); if (f) f.style.setProperty('--p', ((set.fine - 0.7) / 0.8 * 100) + '%');
      after && after();
    };
    const ov = openOv(`<div class="shdr"><h2 class="title">Sensitivitas</h2><button class="link" data-act="close">Oke</button></div>
      <p class="sub">Atur seberapa kenceng ayunan yang dihitung jadi 1 rep.</p>
      <div class="seg" role="group" aria-label="Level sensitivitas">${Object.entries(SENS).map(([k, v]) => `<button data-act="lvl" data-k="${k}" aria-pressed="${set.sens === k}">${v.label}</button>`).join('')}</div>
      <div class="sens-sheet"><input type="range" id="fine" min="0.7" max="1.5" step="0.05" value="${set.fine}" aria-label="Setel halus"><div class="fine"><span>Lebih gampang</span><span id="fineLbl"></span><span>Lebih susah</span></div></div>
      <p class="note">Santai cocok buat pemanasan. Kenceng buat yang mau nge-push power.</p>`, {
      close: closeOv,
      lvl: b => { set.sens = b.dataset.k; persist(); b.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.dataset.k === set.sens)); upd(); }
    });
    bindInputs(ov, { fine: el => { set.fine = Math.round(+el.value * 100) / 100; persist(); upd(); } });
    upd();
  }

  /* speedometer gauge (ball speed) */
  const GA0 = 150, GSW = 240, GCX = 150, GCY = 152, GR = 116;
  const gpt = (f, r = GR) => { const a = (GA0 + GSW * clamp(f, 0, 1)) * DEG; return [GCX + r * Math.cos(a), GCY + r * Math.sin(a)]; };
  function gaugeSVG() {
    const [x0, y0] = gpt(0), [x1, y1] = gpt(1);
    const d = `M${x0.toFixed(1)} ${y0.toFixed(1)} A${GR} ${GR} 0 1 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    const lbl = f => { const [x, y] = gpt(f, GR + 25); return `<text class="g-lbl" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${Math.round(conv(GMAX * f))}</text>`; };
    return `<svg class="gauge" viewBox="0 0 300 236" aria-hidden="true"><defs><linearGradient id="gg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" style="stop-color:var(--teal)"/><stop offset="1" style="stop-color:var(--orange)"/></linearGradient></defs>
      <path class="g-track" d="${d}" pathLength="100"/><path class="g-zone" id="gZone" d=""/><path class="g-live" id="gLive" d="${d}" pathLength="100" stroke="url(#gg)" stroke-dasharray="0 100"/>
      <line class="g-th" id="gTh"/><circle class="g-last" id="gLast" r="10" visibility="hidden"/>${lbl(0)}${lbl(0.5)}${lbl(1)}</svg>`;
  }
  function gaugeTh() {
    const f = ballOf(racketKmh(thr())) / GMAX, [a, b] = [gpt(f, GR - 17), gpt(f, GR + 17)], l = $('#gTh');
    if (l) { l.setAttribute('x1', a[0]); l.setAttribute('y1', a[1]); l.setAttribute('x2', b[0]); l.setAttribute('y2', b[1]); }
  }
  function gaugeLast(ballKmh) { const c = $('#gLast'); if (!c) return; const [x, y] = gpt(ballKmh / GMAX); c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('visibility', 'visible'); }

  /* ===================== screens ===================== */
  const SCREENS = {};

  /* ---------- home ---------- */
  SCREENS.home = function () {
    const t = peekDay(dayKey()), pct = clamp(t.sw / set.goal, 0, 1), best = S.best.racket, st = streaks();
    const left = set.goal - t.sw;
    const msg = t.sw === 0 ? 'Yuk, ayunan pertama hari ini!' : left > 0 ? `Kurang ${left} lagi, gas!` : 'Target kelar. Mantap!';
    app.innerHTML = `<section class="scr tabbed">
      <header class="hdr"><div>${LOGO}<p class="tagline">Latihan padel di rumah biar kamu makin jago di lapangan</p></div>
        <button class="round" data-act="settings" aria-label="Pengaturan">${ICON.gear}</button></header>
      <div class="hero">${COURT}
        <div class="top"><span class="lbl">Target hari ini</span>${st.current ? `<span class="streak">${ICON.flame}${st.current} hari beruntun</span>` : ''}</div>
        <div class="big"><b>${t.sw}</b><span>/ ${set.goal} ayunan</span></div>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${set.goal}" aria-valuenow="${t.sw}"><i style="width:${(pct * 100).toFixed(1)}%"></i></div>
        <div class="foot"><span>${msg}</span><span>${Math.round(pct * 100)}%</span></div>
      </div>
      <button class="cta" data-act="free"><span class="ic">${ICON.swing}</span><span><b>Gas latihan bebas</b><span>Tiap lecutan yang bunyi = 1 rep</span></span>${ICON.chev}</button>
      <div class="tiles">
        <button class="tile" data-tab="analysis"><span class="ic">${ICON.cube}</span><b>Analisis 3D</b><span>Rekam 1 pukulan, cek ayunanmu dari segala sudut</span></button>
        <button class="tile" data-tab="workouts"><span class="ic">${ICON.clip}</span><b>Program</b><span>Drill padel dipandu suara coach</span></button>
      </div>
      <div class="card">
        <div class="chart-head"><h3>Rekor kamu</h3><button class="link" data-tab="stats" style="padding:0">Lihat progres</button></div>
        ${best ? `<div class="record"><div class="v">≈${fv(ballOf(best))}<small>${U()} bola</small></div><div class="side">Raket <b class="num">${fv(best)}</b> ${U()}${S.best.date ? `<br>${fmtDate(keyDate(S.best.date))}` : ''}</div></div>`
        : '<p class="sub">Belum ada rekor. Ayunan pertamamu bakal jadi patokan.</p>'}
      </div>
      ${needsBackupNudge() ? `<div class="tip"><span class="ic">${ICON.download}</span><span><b>Udah ${totalSwings()} ayunan, backup dulu yuk</b>Biar progresmu aman kalau ganti HP atau data browser kehapus.<span style="display:flex;gap:16px"><button class="link" data-act="backup" style="padding:6px 0 0">Backup sekarang</button><button class="link" data-act="snooze" style="padding:6px 0 0;color:var(--ink-2)">Nanti aja</button></span></span></div>` : ''}
      ${!S.firstDay && !PREVIEW ? `<div class="tip"><span class="ic">${ICON.hand}</span><span><b>Baru pertama?</b>Pegang HP kayak gagang raket: atas HP = ujung raket, layar = muka raket. Terus gas latihan bebas. <button class="link" data-act="howto" style="padding:4px 0 0">Lihat cara pegang</button></span></div>` : ''}
      ${PREVIEW ? `<div class="banner"><b>Ini pratinjau desain.</b> Halaman ini nggak bisa baca sensor gerak, jadi ayunan pakai tombol Simulasi ayunan. Versi https di HP pakai giroskop beneran.${S.firstDay ? '' : ' <button class="link" data-act="seed">Isi data contoh</button>'}</div>`
        : Motion.isSim() ? `<div class="banner"><b>Mode simulasi.</b> Perangkat ini nggak ngirim data sensor gerak. Buka PAAADEL di HP lewat Safari atau Chrome buat latihan beneran.</div>` : ''}
      ${tabbar('home')}
    </section>`;
    actions = {
      seed: seedExample, settings: () => go('settings'), howto: () => go('howto', { from: 'home' }),
      backup: exportBackup, snooze: () => { S.backupSnooze = Date.now(); persist(true); go('home'); },
      free: () => startWith(() => go('free'))
    };
  };

  /* ---------- free hitting ---------- */
  const zoneLabel = () => set.zone.on ? (set.zone.max >= 200 ? `≥${fv(set.zone.min)}` : `${fv(set.zone.min)}–${fv(set.zone.max)}`) : 'Mati';
  function gaugeZone() {
    const p = $('#gZone'); if (!p) return;
    if (!set.zone.on) { p.setAttribute('d', ''); return; }
    const f0 = clamp(set.zone.min / GMAX, 0, 1), f1 = clamp(Math.min(set.zone.max, GMAX * 1.2) / GMAX, 0, 1);
    if (f1 - f0 < 0.005) { p.setAttribute('d', ''); return; }
    const [x0, y0] = gpt(f0), [x1, y1] = gpt(f1);
    p.setAttribute('d', `M${x0.toFixed(1)} ${y0.toFixed(1)} A${GR} ${GR} 0 ${GSW * (f1 - f0) > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`);
  }
  function drawStrip(svg, balls) {
    if (!svg) return;
    const W = Math.max(200, Math.round(svg.clientWidth || 320)), H = 64, n = 30, arr = balls.slice(-n);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const zOn = set.zone.on, c = consistency(balls);
    const top = Math.max(60, ...arr.map(v => v * 1.12), zOn && set.zone.max < 200 ? set.zone.max * 1.12 : 0, zOn ? set.zone.min * 1.2 : 0);
    const Y = v => H - 3 - (clamp(v, 0, top) / top) * (H - 6);
    let band = '';
    if (zOn) { const y1 = Y(Math.min(set.zone.max, top)), y0 = Y(set.zone.min); band = `<rect class="st-band" x="0" y="${y1.toFixed(1)}" width="${W}" height="${Math.max(2, y0 - y1).toFixed(1)}" rx="4"/>`; }
    else if (c) { const y1 = Y(c.med + BAND), y0 = Y(c.med - BAND); band = `<rect class="st-band soft" x="0" y="${y1.toFixed(1)}" width="${W}" height="${(y0 - y1).toFixed(1)}" rx="4"/>`; }
    const bw = W / n;
    const bars = arr.map((v, i) => {
      const cls = zOn ? (zoneOf(v) === 'in' ? 'in' : 'out') : c ? (Math.abs(v - c.med) <= BAND ? 'in' : 'off') : 'in';
      const x = i * bw + bw * 0.22, w = bw * 0.56, y = Y(v);
      return `<rect class="st-bar ${cls}${i === arr.length - 1 ? ' last' : ''}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${(H - 3 - y).toFixed(1)}" rx="${Math.min(3, w / 2).toFixed(1)}"/>`;
    }).join('');
    svg.innerHTML = band + bars + `<line class="st-base" x1="0" x2="${W}" y1="${H - 2.5}" y2="${H - 2.5}"/>`;
  }
  function zoneSheet(after) {
    const bestBall = S.best.racket ? ballOf(S.best.racket) : 0, base = bestBall || 60;
    const PRE = { kontrol: [0.55, 0.7], tempo: [0.7, 0.85], power: [0.85, 99] };
    const rng = k => { const [a, b] = PRE[k]; return b > 5 ? `≥${fv(base * a)}` : `${fv(base * a)}–${fv(base * b)}`; };
    const apply = k => { const [a, b] = PRE[k]; set.zone.min = Math.round(base * a); set.zone.max = b > 5 ? 200 : Math.round(base * b); set.zone.preset = k; };
    const maxTxt = () => set.zone.max >= 200 ? 'Bebas' : fv(set.zone.max);
    const ov = openOv(`<div class="shdr"><h2 class="title">Zona kecepatan</h2><button class="link" data-act="close">Oke</button></div>
      <p class="sub">Buat latihan kontrol. Atur kecepatan bola target; bunyinya beda kalau ayunanmu masuk zona: <b>tring</b> = pas, <b>tuk</b> = meleset.</p>
      <div class="list"><div class="row"><span class="k">${ICON.target}Pakai zona</span>${switchBtn('zon', set.zone.on, 'Pakai zona')}</div></div>
      <span class="label">${bestBall ? `Preset dari rekormu (≈${fv(bestBall)} ${U()})` : 'Preset sementara (kamu belum punya rekor)'}</span>
      <div class="seg" role="group" aria-label="Preset zona">${[['kontrol', 'Kontrol'], ['tempo', 'Tempo'], ['power', 'Power']].map(([k, l]) => `<button data-act="pre" data-k="${k}" aria-pressed="${set.zone.preset === k}">${l}<br><small style="font-weight:600;opacity:.7">${rng(k)}</small></button>`).join('')}</div>
      <div class="list">
        <div class="row"><span class="k">Minimal (${U()})</span><div class="stepper"><button data-act="mind" aria-label="Kurangin minimal">${ICON.minus}</button><output id="zMin">${fv(set.zone.min)}</output><button data-act="mini" aria-label="Tambahin minimal">${ICON.plus}</button></div></div>
        <div class="row"><span class="k">Maksimal (${U()})</span><div class="stepper"><button data-act="maxd" aria-label="Kurangin maksimal">${ICON.minus}</button><output id="zMax">${maxTxt()}</output><button data-act="maxi" aria-label="Tambahin maksimal">${ICON.plus}</button></div></div>
      </div>
      <p class="note">Bandeja & voli paling enak dilatih di zona kontrol atau tempo; smash di power. Angkanya kecepatan bola ≈.</p>`, {
      close: closeOv,
      zon: b => { set.zone.on = !set.zone.on; b.setAttribute('aria-checked', set.zone.on); persist(); after && after(); },
      pre: b => { apply(b.dataset.k); set.zone.on = true; persist(); ov.querySelector('#zMin').textContent = fv(set.zone.min); ov.querySelector('#zMax').textContent = maxTxt(); ov.querySelector('[data-act="zon"]').setAttribute('aria-checked', 'true'); ov.querySelectorAll('[data-act="pre"]').forEach(x => x.setAttribute('aria-pressed', x.dataset.k === b.dataset.k)); after && after(); },
      mind: () => { set.zone.min = Math.max(10, set.zone.min - 2); set.zone.preset = ''; upd(); },
      mini: () => { set.zone.min = Math.min(set.zone.max >= 200 ? 190 : set.zone.max - 2, set.zone.min + 2); set.zone.preset = ''; upd(); },
      maxd: () => { set.zone.max = set.zone.max >= 200 ? Math.max(set.zone.min + 2, Math.round(base)) : Math.max(set.zone.min + 2, set.zone.max - 2); set.zone.preset = ''; upd(); },
      maxi: () => { set.zone.max = set.zone.max >= 200 ? 200 : set.zone.max + 2 > 150 ? 200 : set.zone.max + 2; set.zone.preset = ''; upd(); }
    });
    function upd() {
      set.zone.on = true; persist();
      ov.querySelector('#zMin').textContent = fv(set.zone.min); ov.querySelector('#zMax').textContent = maxTxt();
      ov.querySelector('[data-act="zon"]').setAttribute('aria-checked', 'true');
      ov.querySelectorAll('[data-act="pre"]').forEach(x => x.setAttribute('aria-pressed', 'false'));
      after && after();
    }
  }

  SCREENS.free = function () {
    const st = { t0: now(), n: 0, best: 0, sum: 0, lastAt: now(), newBest: false, start: Date.now(), balls: [], zIn: 0, zN: 0 }, prevBest = S.best.racket || 0;
    app.innerHTML = `<section class="scr session">
      <div class="s-top"><button class="round" data-act="stop" aria-label="Udahan">${ICON.x}</button><div class="mid"><b>Latihan bebas</b><span id="modeLbl"></span></div><span class="timer-chip" id="timer">0:00</span></div>
      <div class="gauge-wrap">${gaugeSVG()}
        <div class="gauge-num"><div class="n" id="gN"><span class="ap">≈</span><span id="lb">0</span></div><span class="u">${U()} bola</span><span class="r">raket <b id="lr">0</b> ${U()}</span></div></div>
      <p class="sub center cue" id="cue">Lecutin pergelangan kayak nyambuk. Tiap bunyi = 1 rep.</p>
      <div class="stats3"><div><b id="sN">0</b><small>&nbsp;</small><span>Rep</span></div><div><b class="or" id="sBest">–</b><small id="sBestR">&nbsp;</small><span>Terbaik</span></div><div><b id="sC">–</b><small id="sCs">&nbsp;</small><span id="sCl">Konsisten</span></div></div>
      <div class="strip-card"><div class="strip-head"><span class="label">Riwayat ayunan</span><span class="note" id="stripNote"></span></div><svg class="strip" id="strip" viewBox="0 0 320 64" aria-hidden="true"></svg></div>
      <div class="hint" id="hint" hidden>${ICON.info}<span><b>Belum bunyi juga?</b>Lecutannya kurang tajam. Ayunan lengan yang pelan emang sengaja nggak dihitung.</span></div>
      <div class="grow"></div>
      <div class="s-bottom">${simBtn()}
        <div class="tools"><button class="chip" data-act="sens">${ICON.sliders}<span id="sensChip"></span></button><button class="chip" data-act="zone" id="zoneChip">${ICON.target}Zona: <span id="zoneLbl"></span></button></div>
        <div id="stopRow"><button class="btn line" data-act="stop">Udahan</button></div>
      </div>
    </section>`;
    const live = $('#gLive'); let mv = 0, raf = 0;
    function refreshStats() {
      const c = consistency(st.balls);
      if (set.zone.on) {
        $('#sCl').textContent = 'Di zona';
        $('#sC').textContent = st.zN ? Math.round(st.zIn / st.zN * 100) + '%' : '–';
        $('#sCs').textContent = st.zN ? `${st.zIn}/${st.zN} masuk` : 'belum ada';
        $('#stripNote').textContent = `Zona ${zoneLabel()} ${U()}`;
      } else {
        $('#sCl').textContent = 'Konsisten';
        $('#sC').textContent = c ? c.pct + '%' : '–';
        $('#sCs').innerHTML = c ? `±${fv(BAND)} ${U()}` : (st.n ? `${5 - st.n} rep lagi` : '&nbsp;');
        $('#stripNote').textContent = c ? `Pita abu = median ±${fv(BAND)} ${U()}` : 'Konsistensi muncul setelah 5 rep';
      }
      drawStrip($('#strip'), st.balls);
    }
    function refreshMode() {
      $('#sensChip').textContent = 'Sensitivitas: ' + SENS[set.sens].label;
      $('#zoneLbl').textContent = zoneLabel();
      $('#zoneChip').classList.toggle('on', set.zone.on);
      $('#modeLbl').textContent = set.zone.on ? `Zona ${zoneLabel()} ${U()}` : `Sensitivitas ${SENS[set.sens].label.toLowerCase()}`;
      gaugeTh(); gaugeZone();
      const sig = set.zone.on + '|' + set.zone.min + '|' + set.zone.max; // a new/changed zone counts from here on
      if (sig !== st.zSig) { st.zSig = sig; st.zIn = 0; st.zN = 0; }
      refreshStats();
    }
    const det = new Detector(thr, pk => Snd.zoneHit(pk / 22, zoneOf(ballOf(racketKmh(pk)))), pk => onSwing(pk));
    function onSwing(w) {
      const r = racketKmh(w), ball = ballOf(r); st.n++; st.best = Math.max(st.best, r); st.sum += r; st.lastAt = now(); st.balls.push(ball);
      recordSwing(r, null, true); if (prevBest > 0 && r > prevBest) st.newBest = true;
      const z = zoneOf(ball); if (z) { st.zN++; if (z === 'in') st.zIn++; }
      $('#hint').hidden = true;
      $('#lb').textContent = (w >= GYRO_MAX ? '≥' : '') + fv(ball); $('#lr').textContent = fv(r);
      const n = $('#gN'); n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop');
      n.classList.toggle('in', z === 'in'); n.classList.toggle('out', z === 'low' || z === 'high');
      gaugeLast(ball);
      $('#sN').textContent = st.n;
      $('#sBest').textContent = '≈' + fv(ballOf(st.best)); $('#sBestR').textContent = fv(st.best) + ' raket';
      const cue = $('#cue');
      cue.textContent = w >= GYRO_MAX ? 'Mentok batas giroskop HP, aslinya bisa lebih kenceng!'
        : z === 'in' ? 'Pas di zona! Pertahanin temponya.' : z === 'high' ? 'Kekencengan. Kontrol dikit.' : z === 'low' ? 'Kurang kenceng. Lecutin lagi.'
        : st.newBest ? 'Rekor baru! Pertahanin.' : 'Lecutin pergelangan kayak nyambuk. Tiap bunyi = 1 rep.';
      cue.className = 'sub center cue' + (z === 'in' ? ' good' : z === 'high' || z === 'low' ? ' warn' : '');
      refreshStats();
      Guard.engage();
    }
    const unsub = Motion.sub(s => { det.feed(s); mv = Math.max(mv, s.w); });
    const loop = () => { const pc = clamp(ballOf(racketKmh(mv)) / GMAX * 100, 0, 100); live.setAttribute('stroke-dasharray', `${pc.toFixed(1)} 100`); live.style.opacity = pc < 1.5 ? 0 : 1; mv *= 0.86; raf = requestAnimationFrame(loop); };
    loop(); refreshMode();
    const iv = setInterval(() => {
      $('#timer').textContent = mmss((now() - st.t0) / 1000);
      const idle = (now() - st.lastAt) / 1000;
      if ((st.n === 0 && idle > 10) || (st.n > 0 && idle > 25)) $('#hint').hidden = false;
    }, 250);
    const onRs = () => drawStrip($('#strip'), st.balls); addEventListener('resize', onRs);
    Wake.on();
    cleanup = () => { unsub(); clearInterval(iv); cancelAnimationFrame(raf); removeEventListener('resize', onRs); Wake.off(); };
    function finish() {
      const d = (now() - st.t0) / 1000, c = consistency(st.balls);
      const zone = set.zone.on && st.zN ? { min: set.zone.min, max: set.zone.max, hit: st.zIn, n: st.zN } : null;
      if (st.n > 0) {
        recordSession({ type: 'free', start: st.start, dur: d, swings: st.n, best: st.best, avg: st.sum / st.n, cons: c ? c.pct : null, zone });
        go('freeDone', { n: st.n, best: st.best, avg: st.sum / st.n, dur: d, newBest: st.newBest, cons: c, zone });
      } else go('home');
    }
    Object.assign(actions, {
      stop: () => { $('#stopRow').className = 'row-btns'; $('#stopRow').innerHTML = '<button class="btn teal" data-act="keep">Lanjut lagi</button><button class="btn danger" data-act="end">Udahan</button>'; },
      keep: () => { $('#stopRow').className = ''; $('#stopRow').innerHTML = '<button class="btn line" data-act="stop">Udahan</button>'; },
      end: finish, back: () => actions.stop(), sim: () => Motion.simSwing(),
      sens: () => sensSheet(refreshMode),
      zone: () => zoneSheet(refreshMode)
    });
  };

  function insightCard(p) {
    const row = (pct, color, title, body) => `<div class="ins"><span class="ring-sm" style="--p:${pct ?? 0};--c:${color}"><span>${pct == null ? '–' : pct + '%'}</span></span><div><b>${title}</b><p>${body}</p></div></div>`;
    let h = p.cons ? row(p.cons.pct, 'var(--teal)', 'Konsistensi', `${p.cons.pct >= 80 ? 'Stabil banget!' : p.cons.pct >= 60 ? 'Lumayan stabil.' : 'Masih naik-turun.'} ${Math.round(p.cons.pct * p.n / 100)} dari ${p.n} ayunan dalam ±${fv(BAND)} ${U()} dari median ≈${fv(p.cons.med)}.`)
      : row(null, 'var(--teal)', 'Konsistensi', 'Muncul kalau kamu ngayun minimal 5 kali.');
    if (p.zone) { const pct = Math.round(p.zone.hit / p.zone.n * 100); h += row(pct, 'var(--orange)', `Di zona ${p.zone.max >= 200 ? '≥' + fv(p.zone.min) : fv(p.zone.min) + '–' + fv(p.zone.max)} ${U()}`, `${p.zone.hit} dari ${p.zone.n} ayunan masuk zona. ${pct >= 70 ? 'Kontrolnya mantap!' : 'Fokus ke tempo, bukan power.'}`); }
    return `<div class="card insights">${h}</div>`;
  }

  SCREENS.freeDone = function (p) {
    const td = peekDay(dayKey()), left = set.goal - td.sw;
    app.innerHTML = `<section class="scr">
      <div class="done-head"><span class="medal">${ICON.trophy}</span><h1 class="title-lg">Mantap, sesi kelar!</h1><p class="sub">Bola tercepat kamu tadi</p></div>
      <div class="bigspeed"><span class="ap">≈</span>${fv(ballOf(p.best))}<span class="u">${U()}</span></div>
      <p class="sub center">Raket ${fv(p.best)} ${U()}</p>
      ${p.newBest ? `<span class="badge">${ICON.bolt} Rekor baru!</span>` : ''}
      <div class="stats3">
        <div><b>${p.n}</b><small>&nbsp;</small><span>Rep</span></div>
        <div><b>≈${fv(ballOf(p.avg))}</b><small>${fv(p.avg)} raket</small><span>Rata-rata</span></div>
        <div><b>${mmss(p.dur)}</b><small>&nbsp;</small><span>Waktu</span></div>
      </div>
      ${insightCard(p)}
      <p class="note center">Hari ini ${td.sw}/${set.goal} ayunan. ${left > 0 ? `Kurang ${left} lagi buat nutup target.` : 'Target harian kelar!'}</p>
      <div class="grow"></div>
      <button class="btn go" data-act="done">Sip, balik ke beranda</button>
    </section>`;
    actions = { done: () => go('home'), back: () => go('home') };
    Snd.play('done', 0.7);
  };

  /* ---------- how to hold ---------- */
  const HOWTO_ART = `<svg class="howto-art" viewBox="0 0 340 236" role="img" aria-label="Atas HP sama dengan ujung raket; layar menghadap ke arah pukulan">
    <g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <ellipse cx="96" cy="56" rx="30" ry="36" style="stroke:var(--teal)" stroke-width="4"/>
      ${[[-12, -14], [0, -14], [12, -14], [-18, 0], [-6, 0], [6, 0], [18, 0], [-12, 14], [0, 14], [12, 14]].map(([x, y]) => `<circle cx="${96 + x}" cy="${56 + y}" r="2.6" style="fill:var(--teal)" stroke="none"/>`).join('')}
      <path d="M86 90l6 14h8l6-14" style="stroke:var(--teal)" stroke-width="4"/><rect x="91" y="104" width="10" height="34" rx="4" style="fill:var(--teal)" stroke="none"/>
      <text x="170" y="74" style="fill:var(--ink-3)" font-size="30" font-family="Plus Jakarta Sans,system-ui" text-anchor="middle" stroke="none">=</text>
      <rect x="216" y="28" width="44" height="96" rx="9" style="stroke:var(--ink)" stroke-width="4"/><path d="M230 36h16" style="stroke:var(--ink)" stroke-width="3"/>
      <text x="170" y="154" style="fill:var(--ink-2)" font-size="12.5" font-weight="700" font-family="Plus Jakarta Sans,system-ui" text-anchor="middle" stroke="none">Atas HP = ujung raket</text>
      <rect x="62" y="172" width="34" height="58" rx="7" style="fill:var(--well);stroke:var(--ink-3)" stroke-width="2.5"/><circle cx="73" cy="183" r="4" style="stroke:var(--ink-3)" stroke-width="2"/><circle cx="84" cy="183" r="4" style="stroke:var(--ink-3)" stroke-width="2"/>
      <path d="M118 198c14-10 30-10 44 0" style="stroke:var(--orange)" stroke-width="2.5"/><path d="M156 191l7 7-9 3" style="stroke:var(--orange)" stroke-width="2.5"/>
      <rect x="184" y="172" width="34" height="58" rx="7" style="fill:var(--orange)" stroke="none"/>
      <text x="79" y="166" style="fill:var(--ink-3)" font-size="9.5" font-weight="700" font-family="Plus Jakarta Sans,system-ui" text-anchor="middle" stroke="none">BUKAN GINI</text>
      <text x="201" y="166" style="fill:var(--orange)" font-size="9.5" font-weight="700" font-family="Plus Jakarta Sans,system-ui" text-anchor="middle" stroke="none">LAYAR KE DEPAN</text>
      <text x="284" y="198" style="fill:var(--ink-2)" font-size="11" font-family="Plus Jakarta Sans,system-ui" text-anchor="middle" stroke="none">Layar =</text>
      <text x="284" y="213" style="fill:var(--ink-2)" font-size="11" font-family="Plus Jakarta Sans,system-ui" text-anchor="middle" stroke="none">muka raket</text>
    </g></svg>`;
  SCREENS.howto = function (p) {
    const toRecord = p.from === 'record';
    app.innerHTML = `<section class="scr">
      ${subhdr('Cara pegang HP')}
      <div class="card">${HOWTO_ART}</div>
      <ol class="steps">
        <li><span>Pegang HP kayak gagang raket, pakai grip yang biasa kamu pakai buat pukulan itu. <b>Atas HP = ujung raket</b>, <b>layar = muka raket</b> yang ngadep ke arah pukulan.</span></li>
        <li><span>Tap mulai, terus ambil posisi siap. Ada bunyi tik, tik, ding: itu tandanya mulai ngerekam.</span></li>
        <li><span>Lecutin pergelangan kayak nyambuk. Bunyi "pok" = titik paling kencang. Ayunan lengan yang pelan sengaja nggak dihitung.</span></li>
        <li><span>Pegang yang kenceng atau pakai tali HP, dan pastiin ada ruang kosong 2 meter di sekitar kamu.</span></li>
      </ol>
      <div class="grow"></div>
      ${toRecord ? '<button class="btn go" data-act="next">Ngerti, mulai rekam</button>' : '<button class="btn teal" data-act="back">Sip, ngerti</button>'}
    </section>`;
    actions = {
      back: () => p.from === 'settings' ? go('settings') : p.from === 'analysis' || toRecord ? go('analysis') : go('home'),
      next: () => { set.seenHowTo = true; persist(); startWith(() => go('record')); }
    };
  };

  /* ---------- shot analysis ---------- */
  let anStroke = 'FH';
  SCREENS.analysis = function (p = {}) {
    const tab = p.tab || 'new';
    const list = REPLAYS.slice().sort((a, b) => b.date - a.date);
    app.innerHTML = `<section class="scr tabbed">
      <header class="hdr"><div><h1 class="title">Analisis 3D</h1><p class="sub">Rekam 1 pukulan, lihat ayunanmu dari segala sudut.</p></div><button class="round" data-act="how" aria-label="Cara pegang HP">${ICON.hand}</button></header>
      <div class="seg" role="tablist"><button data-act="tabsel" data-k="new" aria-pressed="${tab === 'new'}">Rekam baru</button><button data-act="tabsel" data-k="rep" aria-pressed="${tab === 'rep'}">Replay · ${list.length}</button></div>
      ${tab === 'new' ? `
        <span class="label">Mau rekam pukulan apa?</span>
        <div class="strokes">${STROKE_ORDER.map(k => `<button class="stroke" data-act="stroke" data-k="${k}" aria-pressed="${anStroke === k}"><b>${STROKES[k].n}</b><span>${STROKES[k].d}</span></button>`).join('')}</div>
        <span class="label">Tangan</span>
        <div class="seg compact"><button data-act="hand" data-k="R" aria-pressed="${set.hand === 'R'}">Kanan</button><button data-act="hand" data-k="L" aria-pressed="${set.hand === 'L'}">Kiri</button></div>
        <button class="btn go" data-act="go">Mulai rekam</button>
        <p class="note center">Tik, tik, ding, langsung pukul. Replay kebuka sendiri.</p>`
      : `<div class="list">${list.length ? list.map(r => `<div class="row" style="padding-left:6px">
            <button class="round ghost" data-act="star" data-id="${r.id}" aria-label="${r.star ? 'Hapus bintang' : 'Kasih bintang'}" style="color:${r.star ? 'var(--orange)' : 'var(--ink-3)'}">${r.star ? ICON.starFill : ICON.star}</button>
            <button class="row" data-act="open" data-id="${r.id}" style="padding:4px 0;border:0;min-height:0;flex:1">
              <span class="t"><b>${STROKES[r.stroke].n}</b><span>${whenLabel(r.date)} · ≈${fv(ballOf(r.peak))} ${U()} bola${r.src === 'gyro' ? '' : ' · muka ' + faceTxt(faceMetrics(r).face).toLowerCase()}</span></span><span class="vs">${ICON.chev}</span></button></div>`).join('')
          : '<div class="row"><span class="sub">Belum ada replay. Rekam 1 pukulan dulu di tab Rekam baru.</span></div>'}</div>
        <p class="note">Replay berbintang nggak bakal kehapus otomatis. PAAADEL nyimpen 40 replay terakhir di HP ini.</p>`}
      ${tabbar('analysis')}
    </section>`;
    actions = {
      back: () => go('home'), how: () => go('howto', { from: 'analysis' }),
      tabsel: b => go('analysis', { tab: b.dataset.k }),
      stroke: b => { anStroke = b.dataset.k; app.querySelectorAll('[data-act="stroke"]').forEach(x => x.setAttribute('aria-pressed', x.dataset.k === anStroke)); },
      hand: b => { set.hand = b.dataset.k; persist(); app.querySelectorAll('[data-act="hand"]').forEach(x => x.setAttribute('aria-pressed', x.dataset.k === set.hand)); },
      go: () => set.seenHowTo ? startWith(() => go('record')) : go('howto', { from: 'record' }),
      open: b => go('replay', { id: b.dataset.id }),
      star: b => { const r = REPLAYS.find(x => x.id === b.dataset.id); if (r) { r.star = !r.star; persistReplays(); go('analysis', { tab: 'rep' }); } }
    };
  };
  function whenLabel(ts) {
    const d = new Date(ts);
    if (dayKey(d) === dayKey()) return 'Hari ini ' + z2(d.getHours()) + ':' + z2(d.getMinutes());
    return fmtDate(d);
  }

  SCREENS.record = function () {
    app.innerHTML = `<section class="scr session">
      <div class="s-top"><button class="round" data-act="cancel" aria-label="Batal">${ICON.x}</button><div class="mid"><b>${STROKES[anStroke].n}</b><span>Tangan ${set.hand === 'R' ? 'kanan' : 'kiri'}</span></div><span style="width:44px"></span></div>
      <div class="grow"></div>
      <div class="rec">
        <div class="rec-ring" id="ring"><div class="dots" id="dots"><i></i><i></i><i></i></div></div>
        <h2 class="title" id="recT">Siap-siap…</h2>
        <p class="sub" id="recS">Ambil posisi ready. Tunggu tik, tik, ding.<br>Atas HP = ujung raket, layar = muka raket.</p>
      </div>
      <div class="grow"></div>
      <div class="s-bottom" id="recBottom">${Motion.isSim() ? '<button class="btn small sim" data-act="sim" id="simBtn" hidden>Simulasi ayunan</button>' : ''}</div>
    </section>`;
    const timers = [], recStart = Date.now(); let unsub = null, done = false, det = null;
    const dots = app.querySelectorAll('#dots i');
    timers.push(setTimeout(() => { Snd.play('tick'); dots[0].classList.add('on'); }, 700), setTimeout(() => { Snd.play('tick'); dots[1].classList.add('on'); }, 1400), setTimeout(startRec, 2100));
    function startRec() {
      Snd.play('ding'); dots[2].classList.add('ding');
      timers.push(setTimeout(() => { const ring = $('#ring'); if (!ring) return; ring.classList.add('live'); ring.innerHTML = '<span class="live-dot"></span>'; }, 250));
      $('#recT').textContent = 'Lagi ngerekam';
      $('#recS').innerHTML = 'Pukul kapan aja kamu siap.<br>Ancang-ancangnya ikut kerekam kok.';
      const sb = $('#simBtn'); if (sb) sb.hidden = false;
      Guard.engage();
      const T0 = thr() * 0.85;
      det = new Detector(() => T0, pk => Snd.hit(pk / 22), (pk, pkT) => { if (done) return; done = true; waitCapture(pkT); });
      unsub = Motion.sub(s => det.feed(s));
      timers.push(setTimeout(() => { if (!done) noSwing(); }, 25000));
    }
    function waitCapture(pkT) {
      $('#recT').textContent = 'Bentar, lagi diolah…'; $('#recS').textContent = 'Lagi nyusun replay 3D-nya.';
      const check = () => { if (Motion.lastT() >= pkT + 650 || now() > pkT + 1300) capture(pkT); else timers.push(setTimeout(check, 40)); };
      check();
    }
    function capture(pkT) {
      const rep = buildReplay(pkT, anStroke, set.hand);
      if (!rep) return noSwing();
      REPLAYS.push(rep);
      while (REPLAYS.length > 40) { const i = REPLAYS.findIndex(r => !r.star); if (i < 0) break; REPLAYS.splice(i, 1); }
      persistReplays();
      S.replaysMade++; recordSwing(rep.peak, anStroke, false);
      recordSession({ type: 'analysis', start: recStart, dur: (Date.now() - recStart) / 1000, swings: 1, best: rep.peak, stroke: anStroke });
      go('replay', { id: rep.id, fresh: true });
    }
    function noSwing() {
      done = true; Guard.release();
      const ring = $('#ring'); ring.classList.remove('live'); ring.innerHTML = `<span style="color:var(--ink-3)">${ICON.swing}</span>`;
      $('#recT').textContent = 'Belum ada pukulan nih';
      $('#recS').textContent = 'Ayunannya kurang kenceng. Coba lecutin lebih tajam, atau turunin sensitivitas.';
      $('#recBottom').innerHTML = '<button class="btn go" data-act="retry">Coba lagi</button>';
    }
    Wake.on();
    cleanup = () => { timers.forEach(clearTimeout); if (unsub) unsub(); Wake.off(); };
    actions = { cancel: () => go('analysis'), back: () => go('analysis'), retry: () => go('record'), sim: () => Motion.simSwing() };
  };

  function integrateGyro(ms) {
    let q = Motion.currentQ() || Q.euler(0, 80, 0); const out = [];
    for (let i = 0; i < ms.length; i++) {
      if (i > 0) {
        const dt = (ms[i].t - ms[i - 1].t) / 1000, wx = ms[i].wx * DEG, wy = ms[i].wy * DEG, wz = ms[i].wz * DEG, m = Math.hypot(wx, wy, wz);
        if (m > 1e-6) q = Q.norm(Q.mul(q, Q.axis(wx / m, wy / m, wz / m, m * dt)));
      }
      out.push(q);
    }
    return out;
  }
  function buildReplay(pkT, stroke, hand) {
    const ms = Motion.samples(pkT - 1250, pkT + 700); if (ms.length < 15) return null;
    let pi = 0, pw = -1;
    ms.forEach((s, i) => { if (Math.abs(s.t - pkT) < 90 && s.w > pw) { pw = s.w; pi = i; } });
    if (pw < 0) return null;
    const tPk = ms[pi].t;
    let qs = ms.map(s => Motion.oriAt(s.t)), src = 'ori';
    if (qs.some(q => !q)) { qs = integrateGyro(ms); src = 'gyro'; }
    // turn the court so the racket face (screen) points at the net at contact
    const n = Q.rot(qs[pi], [0, 0, 1]); let hx = n[0], hy = n[1];
    if (Math.hypot(hx, hy) < 0.35) { const a = Q.rot(qs[Math.max(0, pi - 2)], [0, 1, 0]), b = Q.rot(qs[Math.min(qs.length - 1, pi + 2)], [0, 1, 0]); hx = b[0] - a[0]; hy = b[1] - a[1]; }
    const qYaw = Q.axis(0, 0, 1, Math.PI / 2 - Math.atan2(hy, hx));
    const qM = Q.axis(1, 0, 0, -Math.PI / 2); // earth (z up, y north) → scene (y up, −z = net)
    const qw = qs.map(q => Q.norm(Q.mul(qM, Q.mul(qYaw, q))));
    for (let i = 1; i < qw.length; i++) { const a = qw[i - 1], b = qw[i]; if (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] < 0) qw[i] = b.map(c => -c); }
    const rd = (v, d) => Math.round(v * d) / d;
    return {
      id: 'r' + Date.now().toString(36), date: Date.now(), stroke, hand, k: set.calib, star: false, src,
      peak: rd(racketKmh(pw), 10), sat: pw >= GYRO_MAX,
      t: ms.map(s => rd((s.t - tPk) / 1000, 1000)), w: ms.map(s => rd(s.w, 100)), q: qw.map(q => q.map(c => rd(c, 10000)))
    };
  }

  /* racket-face metrics at contact */
  function faceMetrics(rep) {
    let pi = 0; rep.t.forEach((tt, i) => { if (Math.abs(tt) < Math.abs(rep.t[pi])) pi = i; });
    const q = rep.q[pi], n = Q.rot(q, [0, 0, 1]), d = Q.rot(q, [0, 1, 0]);
    const pk = rep.w[pi]; let j = pi; while (j > 0 && rep.w[j - 1] > pk * 0.3) j--;
    return { face: Math.round(Math.asin(clamp(n[1], -1, 1)) / DEG), head: Math.round(Math.asin(clamp(d[1], -1, 1)) / DEG), whip: Math.max(0, -rep.t[j]) };
  }
  const faceTxt = a => Math.abs(a) <= 3 ? 'Tegak' : a > 0 ? `Terbuka ${a}°` : `Tertutup ${-a}°`;
  const angTxt = a => a === 0 ? 'tegak' : a > 0 ? `terbuka ${a}°` : `tertutup ${-a}°`;
  function faceCard(rep) {
    if (rep.src === 'gyro') return `<div class="card"><div class="chart-head"><h3>Muka raket saat kena</h3></div><p class="sub">Sudutnya butuh sensor orientasi, dan pas rekaman ini sensornya nggak kebaca.</p></div>`;
    const m = faceMetrics(rep), [lo, hi] = FACE[rep.stroke], name = STROKES[rep.stroke].n;
    const stt = m.face < lo ? 'closed' : m.face > hi ? 'open' : 'ok';
    const pill = { ok: ['Pas', 'ok'], open: ['Kebuka banget', 'warn'], closed: ['Ketutup banget', 'warn'] }[stt];
    const tip = { ok: 'Mantap, sudutnya udah pas buat pukulan ini.', open: 'Bola cenderung melambung. Coba tutup dikit muka raketnya.', closed: 'Bola cenderung nyangkut net. Coba buka dikit muka raketnya.' }[stt];
    const cx = 42, cy = 54, Pt = (a, r) => [cx + r * Math.cos(a * DEG), cy - r * Math.sin(a * DEG)], f2 = v => v.toFixed(1);
    const l0 = Pt(lo, 46), l1 = Pt(hi, 46), f = m.face, e1 = Pt(f + 90, 30), e2 = Pt(f - 90, 30), tp = Pt(f, 44);
    const dial = `<svg class="dial" viewBox="0 0 124 108" aria-hidden="true"><line class="dl-g" x1="4" y1="${cy}" x2="122" y2="${cy}"/><path class="dl-w" d="M${cx} ${cy}L${f2(l0[0])} ${f2(l0[1])}A46 46 0 0 0 ${f2(l1[0])} ${f2(l1[1])}Z"/><line class="dl-f" x1="${f2(e1[0])}" y1="${f2(e1[1])}" x2="${f2(e2[0])}" y2="${f2(e2[1])}"/><line class="dl-n" x1="${cx}" y1="${cy}" x2="${f2(tp[0])}" y2="${f2(tp[1])}"/><circle class="dl-h" cx="${f2(tp[0])}" cy="${f2(tp[1])}" r="4.5"/><text x="122" y="${cy + 15}" text-anchor="end">net →</text></svg>`;
    return `<div class="card face">
      <div class="chart-head"><h3>Muka raket saat kena</h3><span class="pill ${pill[1]}">${pill[0]}</span></div>
      <div class="face-row">${dial}<div><b class="face-v">${faceTxt(f)}</b><p class="sub">Patokan ${name}: ${angTxt(lo)} sampai ${angTxt(hi)}.</p><p class="sub" style="margin-top:6px">${tip}</p></div></div>
      <div class="face-meta"><span>Kepala raket<b>${Math.abs(m.head)}° ${m.head >= 0 ? 'di atas' : 'di bawah'} pergelangan</b></span><span>Lecutan<b>${m.whip.toFixed(2).replace('.', ',')} dtk</b></span></div>
      <p class="note" style="padding:10px 0 0">Dibaca dari kemiringan layar HP pas titik kena; area hijau = patokan umum, bukan aturan mati. Lecutan = waktu dari mulai ngebut sampai puncak, makin singkat makin tajam.</p>
    </div>`;
  }

  /* ---------- replay (3D) ---------- */
  SCREENS.replay = function (p) {
    const rep = REPLAYS.find(r => r.id === p.id);
    if (!rep) return go('analysis', { tab: 'rep' });
    const T0 = rep.t[0], T1 = rep.t[rep.t.length - 1];
    let t = p.fresh ? T0 : 0, playing = false, rate = 0.25, last = now(), raf = 0, ready = false;
    app.innerHTML = `<section class="scr" style="gap:12px">
      ${subhdr(STROKES[rep.stroke].n, `<button class="round" data-act="del" aria-label="Hapus replay">${ICON.trash}</button>`)}
      <div class="r3d" id="r3d"><canvas id="c3d" aria-label="Replay 3D ayunan"></canvas><div class="r3d-load" id="r3dLoad">Lagi nyiapin 3D…</div>
        <div class="tools"><button class="chip" data-act="resetView">${ICON.reset}Reset</button><span style="display:flex;gap:6px"><button class="chip" data-act="look">${ICON.sliders}Tampilan</button><button class="chip" data-act="snap">${ICON.image}Simpan</button></span></div></div>
      <div class="r-info"><span class="when" id="rInfo"></span><span class="note">${whenLabel(rep.date)}</span></div>
      <div class="r-speeds"><div><span>Bola ≈</span><b class="or" id="rBall">0</b><small>${U()}</small></div><div><span>Raket</span><b id="rRacket">0</b><small>${U()}</small></div></div>
      <div class="scrub-card">
        <div class="spark-wrap"><canvas id="spark" aria-hidden="true"></canvas><span class="ph" id="ph"></span></div>
        <input type="range" id="scrub" min="0" max="1000" value="0" aria-label="Geser waktu replay">
        <div class="r-ctrl">
          <button class="play" data-act="play" id="playBtn" aria-label="Putar">${ICON.play}</button>
          <button class="chip" data-act="peak">${ICON.target}Titik kena</button>
          <div class="seg compact" role="group" aria-label="Kecepatan putar">${[['0.25', '¼×'], ['0.5', '½×'], ['1', '1×']].map(([v, l]) => `<button data-act="rate" data-k="${v}" aria-pressed="${+v === rate}">${l}</button>`).join('')}</div>
        </div>
      </div>
      ${faceCard(rep)}
      <p class="note">Sisi terang raket = muka raket (layar HP). Bola oranye = titik paling kencang, di situ harusnya bola kena. Geser buat muter, cubit buat zoom. Posisi raket diperkirakan dari arah HP; kecepatannya dari giroskop.</p>
      <button class="btn teal" data-act="done">Selesai</button>
    </section>`;
    const kmh = w => racketKmh(w, rep.k);
    const wAt = tt => { let i = 0; while (i < rep.t.length - 2 && rep.t[i + 1] < tt) i++; const f = clamp((tt - rep.t[i]) / Math.max(1e-6, rep.t[i + 1] - rep.t[i]), 0, 1); return rep.w[i] + (rep.w[i + 1] - rep.w[i]) * f; };
    const sp = $('#spark'), sctx = sp.getContext('2d');
    function drawSpark() {
      const cs = getComputedStyle(document.documentElement), teal = cs.getPropertyValue('--teal').trim() || '#0E8A7A', orange = cs.getPropertyValue('--orange').trim() || '#FF6A2B', surf = cs.getPropertyValue('--surface').trim() || '#fff';
      const dpr = Math.min(devicePixelRatio || 1, 2), W = sp.clientWidth, H = sp.clientHeight; if (!W) return;
      sp.width = W * dpr; sp.height = H * dpr; sctx.setTransform(dpr, 0, 0, dpr, 0, 0); sctx.clearRect(0, 0, W, H);
      const maxW = Math.max(...rep.w) * 1.08, X = tt => (tt - T0) / (T1 - T0) * W, Y = w => H - 3 - (w / maxW) * (H - 9);
      const path = () => { sctx.beginPath(); rep.t.forEach((tt, i) => { const x = X(tt), y = Y(rep.w[i]); i ? sctx.lineTo(x, y) : sctx.moveTo(x, y); }); };
      path(); sctx.lineTo(W, H); sctx.lineTo(0, H); sctx.closePath(); sctx.globalAlpha = 0.14; sctx.fillStyle = teal; sctx.fill(); sctx.globalAlpha = 1;
      path(); sctx.strokeStyle = teal; sctx.lineWidth = 2.2; sctx.lineJoin = 'round'; sctx.stroke();
      const pkW = Math.max(...rep.w); sctx.beginPath(); sctx.arc(X(0), Y(pkW), 5, 0, 7); sctx.fillStyle = orange; sctx.fill(); sctx.lineWidth = 2.5; sctx.strokeStyle = surf; sctx.stroke();
    }
    function ui() {
      const r = kmh(wAt(t));
      $('#rBall').textContent = '≈' + fv(ballOf(r)); $('#rRacket').textContent = fv(r);
      const tt = Math.abs(t) < 0.005 ? 'Pas kena' : (t < 0 ? `${Math.abs(t).toFixed(2)} dtk sebelum kena` : `${t.toFixed(2)} dtk setelah kena`);
      $('#rInfo').textContent = tt.replace('.', ',');
      const fr = (t - T0) / (T1 - T0); $('#ph').style.left = `calc(${(fr * 100).toFixed(2)}% - 1px)`;
      const sc = $('#scrub'); sc.value = Math.round(fr * 1000); sc.style.setProperty('--p', (fr * 100) + '%');
    }
    const setPlay = v => { playing = v; const b = $('#playBtn'); b.innerHTML = v ? ICON.pause : ICON.play; b.setAttribute('aria-label', v ? 'Jeda' : 'Putar'); if (v && t >= T1 - 1e-3) t = T0; last = now(); };
    function frame() {
      const n = now(), dt = Math.min(0.05, (n - last) / 1000); last = n;
      if (playing) { t += dt * rate; if (t >= T1) { t = T1; setPlay(false); } }
      if (ready) { R3D.setTime(t); R3D.render(); }
      ui(); raf = requestAnimationFrame(frame);
    }
    drawSpark(); ui(); frame();
    R3D.mount($('#c3d'), rep).then(() => { ready = true; $('#r3dLoad').hidden = true; if (p.fresh) { t = T0; setPlay(true); } })
      .catch(err => { if (String(err && err.message).includes('stale')) return; console.error(err); const l = $('#r3dLoad'); if (l) l.textContent = 'Tampilan 3D nggak bisa dimuat di perangkat ini. Grafik kecepatan di bawah tetap jalan.'; });
    bindInputs(app, { scrub: el => { setPlay(false); t = T0 + (+el.value / 1000) * (T1 - T0); } });
    const onRs = () => drawSpark(); addEventListener('resize', onRs);
    cleanup = () => { cancelAnimationFrame(raf); removeEventListener('resize', onRs); R3D.unmount(); };
    actions = {
      back: () => go('analysis', { tab: p.fresh ? 'new' : 'rep' }),
      done: () => go('analysis', { tab: p.fresh ? 'new' : 'rep' }),
      play: () => setPlay(!playing),
      peak: () => { setPlay(false); t = 0; },
      rate: b => { rate = +b.dataset.k; app.querySelectorAll('[data-act="rate"]').forEach(x => x.setAttribute('aria-pressed', +x.dataset.k === rate)); },
      resetView: () => R3D.resetView(),
      look: () => lookSheet(),
      snap: () => snapshot(),
      del: () => dialog('Hapus replay ini?', 'Replay-nya bakal hilang dari HP ini. Statistik kamu tetap aman.', [
        { label: 'Batal' }, { label: 'Hapus', kind: 'danger', fn: () => { REPLAYS = REPLAYS.filter(r => r.id !== rep.id); persistReplays(); go('analysis', { tab: 'rep' }); } }])
    };
    function lookSheet() {
      const L = set.look;
      const seg = (key, opts) => `<div class="seg compact">${opts.map(([v, l]) => `<button data-act="lk" data-key="${key}" data-v="${v}" aria-pressed="${String(L[key]) === v}">${l}</button>`).join('')}</div>`;
      const sw = (key, label) => `<div class="row"><span class="k">${label}</span>${switchBtn('lt', L[key], label, `data-key="${key}"`)}</div>`;
      openOv(`<div class="shdr"><h2 class="title">Tampilan replay</h2><button class="link" data-act="close">Oke</button></div>
        <span class="label">Raket</span>${seg('racket', [['classic', 'Klasik'], ['white', 'Putih'], ['orange', 'Oranye'], ['teal', 'Teal']])}
        <span class="label">Jejak ayunan</span>
        <div class="list">${sw('ribbon', 'Pita lintasan')}${sw('ghosts', 'Raket bayangan')}${sw('peak', 'Titik kena')}${sw('dots', 'Titik lintasan')}</div>
        <span class="label">Warna pita</span>${seg('ribbonColor', [['speed', 'Kecepatan'], ['orange', 'Oranye'], ['white', 'Putih']])}
        <span class="label">Lebar pita</span>${seg('ribbonWidth', [['line', 'Garis tipis'], ['face', 'Satu muka']])}
        <span class="label">Kerapatan bayangan</span>${seg('ghostDensity', [['sparse', 'Jarang'], ['normal', 'Normal'], ['dense', 'Rapat']])}`, {
        close: closeOv,
        lk: b => { L[b.dataset.key] = b.dataset.v; persist(); b.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === b.dataset.v)); R3D.rebuild(); },
        lt: b => { L[b.dataset.key] = !L[b.dataset.key]; persist(); b.setAttribute('aria-checked', L[b.dataset.key]); R3D.rebuild(); }
      });
    }
    async function snapshot() {
      const url = R3D.snapshot(); if (!url) return toast('Gambarnya belum siap');
      try {
        const blob = await (await fetch(url)).blob();
        const file = new File([blob], `paaadel-${rep.stroke.toLowerCase()}-${dayKey()}.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Replay PAAADEL' }); return; }
      } catch (e) { if (e && e.name === 'AbortError') return; }
      openOv(`<div class="shdr"><h2 class="title">Simpan gambar</h2><button class="link" data-act="close">Tutup</button></div><img class="snap" src="${url}" alt="Replay ${esc(STROKES[rep.stroke].n)}"><p class="note center">Tekan lama gambarnya buat simpan atau share.</p>`, { close: closeOv });
    }
  };

  /* ===================== 3D replay engine (three.js, loaded on demand) ===================== */
  const R3D = (() => {
    let THREEp = null, THREE = null, renderer = null, scene = null, camera = null, canvas = null, rep = null, ro = null;
    let F = [], pi = 0, i0 = 0, i1 = 0, racket = null, shadow = null, ribbon = null, ghosts = [], dots = [], peakM = null, swingGrp = null;
    let orbit = null, home = null, detach = null;
    function loadThree() {
      if (window.THREE) return Promise.resolve(window.THREE);
      return THREEp || (THREEp = new Promise((res, rej) => {
        const s = document.createElement('script'); s.src = 'vendor/three.min.js';
        s.onload = () => res(window.THREE); s.onerror = () => { THREEp = null; rej(new Error('three.js failed')); };
        document.head.appendChild(s);
      }));
    }
    const basic = (color, extra = {}) => new THREE.MeshBasicMaterial(Object.assign({ color }, extra));
    function buildCourt() {
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0xd6ece6); scene.fog = new THREE.Fog(0xd6ece6, 18, 46);
      camera = new THREE.PerspectiveCamera(46, 1, 0.03, 140);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x2a7f6a, 1.0));
      const dl = new THREE.DirectionalLight(0xffffff, 0.85); dl.position.set(3, 9, 6); scene.add(dl);
      const plane = (w, h, mat) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      const ground = plane(70, 80, basic(0x247a66)); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.003; scene.add(ground);
      const court = plane(10, 20, basic(0x2c9a7f)); court.rotation.x = -Math.PI / 2; scene.add(court);
      const lineMat = basic(0xf4f8ff);
      const line = (x1, z1, x2, z2) => { const len = Math.hypot(x2 - x1, z2 - z1); const m = plane(len, 0.05, lineMat); m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(z2 - z1, x2 - x1); m.position.set((x1 + x2) / 2, 0.002, (z1 + z2) / 2); scene.add(m); };
      line(-5, 6.95, 5, 6.95); line(-5, -6.95, 5, -6.95); line(0, -7.15, 0, 7.15); line(-5, 10, 5, 10); line(-5, -10, 5, -10); line(-5, -10, -5, 10); line(5, -10, 5, 10);
      // net
      const net = plane(10, 0.86, basic(0x0b2420, { transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })); net.position.set(0, 0.45, 0); scene.add(net);
      const band = new THREE.Mesh(new THREE.BoxGeometry(10, 0.05, 0.02), basic(0xf4f8ff)); band.position.set(0, 0.88, 0); scene.add(band);
      [-5.05, 5.05].forEach(x => { const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.95, 0.08), basic(0x1b2f2b)); post.position.set(x, 0.475, 0); scene.add(post); });
      // glass + frames
      const glassMat = basic(0xe6fbf6, { transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false });
      const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
      const panel = (w, h, x, y, z, ry) => { const g = new THREE.PlaneGeometry(w, h); const m = new THREE.Mesh(g, glassMat); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), edgeMat); e.position.copy(m.position); e.rotation.copy(m.rotation); scene.add(e); };
      [-10, 10].forEach(z => { for (let i = 0; i < 5; i++) panel(2, 3, -4 + i * 2, 1.5, z, 0); });
      [-5, 5].forEach(x => [-1, 1].forEach(sgn => { panel(2, 3, x, 1.5, sgn * 9, Math.PI / 2); panel(2, 3, x, 1.5, sgn * 7, Math.PI / 2); panel(2, 2, x, 1, sgn * 5, Math.PI / 2); }));
      // fence mesh
      const pts = [], add = (a, b) => pts.push(new THREE.Vector3(...a), new THREE.Vector3(...b));
      [-10, 10].forEach(z => { for (let x = -5; x <= 5.001; x += 0.5) add([x, 3, z], [x, 4, z]); for (let y = 3; y <= 4.001; y += 0.5) add([-5, y, z], [5, y, z]); });
      [-5, 5].forEach(x => {
        for (let z = -4; z <= 4.001; z += 0.5) add([x, 0, z], [x, 3, z]);
        for (let y = 0; y <= 3.001; y += 0.5) add([x, y, -4], [x, y, 4]);
        [-1, 1].forEach(sg => { for (let z = 4; z <= 10.001; z += 0.5) add([x, sg * z > 6 ? 3 : 2, sg * z], [x, 4, sg * z]); add([x, 4, sg * 4], [x, 4, sg * 10]); });
      });
      const fg = new THREE.BufferGeometry().setFromPoints(pts);
      scene.add(new THREE.LineSegments(fg, new THREE.LineBasicMaterial({ color: 0x1d3a35, transparent: true, opacity: 0.35 })));
    }
    const RACKET_COLORS = { classic: [0x1b2826, 0xf2f7f5], white: [0xd9e3df, 0xffffff], orange: [0xff6a2b, 0xffe7db], teal: [0x0e8a7a, 0xdff5f1] };
    let headShape = null, headPlain = null;
    function shapes() {
      if (headShape) return;
      headShape = new THREE.Shape(); headShape.absellipse(0, 0, 0.13, 0.15, 0, Math.PI * 2, false, 0);
      for (let r = 0, yy = -0.11; yy <= 0.111; yy += 0.026, r++) for (let xx = -0.104; xx <= 0.105; xx += 0.026) {
        const x = xx + (r % 2) * 0.013; if ((x / 0.104) ** 2 + (yy / 0.124) ** 2 > 1) continue;
        const h = new THREE.Path(); h.absarc(x, yy, 0.0065, 0, Math.PI * 2, true); headShape.holes.push(h);
      }
      headPlain = new THREE.Shape(); headPlain.absellipse(0, 0, 0.13, 0.15, 0, Math.PI * 2, false, 0);
    }
    function makeRacket(ghost) {
      shapes();
      const g = new THREE.Group(), [frameC, faceC] = RACKET_COLORS[set.look.racket] || RACKET_COLORS.classic;
      if (ghost) {
        const m = basic(0xf4fffb, { transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
        const hg = new THREE.ShapeGeometry(headPlain, 20); hg.translate(0, 0.25, 0); g.add(new THREE.Mesh(hg, m));
        const hd = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.02), m); hd.position.y = 0.02; g.add(hd);
        return g;
      }
      const depth = 0.034;
      const geo = new THREE.ExtrudeGeometry(headShape, { depth, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.004, bevelSegments: 2, curveSegments: 28 });
      geo.translate(0, 0.25, -depth / 2);
      g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: frameC, roughness: 0.5, metalness: 0.1 })));
      const face = new THREE.ShapeGeometry(headShape, 28); face.translate(0, 0.25, depth / 2 + 0.0035);
      g.add(new THREE.Mesh(face, new THREE.MeshStandardMaterial({ color: faceC, roughness: 0.75 })));
      const th = new THREE.Shape(); th.moveTo(-0.02, 0.06); th.lineTo(0.02, 0.06); th.lineTo(0.08, 0.14); th.lineTo(-0.08, 0.14); th.closePath();
      const hole = new THREE.Path(); hole.moveTo(0, 0.085); hole.lineTo(0.035, 0.128); hole.lineTo(-0.035, 0.128); hole.closePath(); th.holes.push(hole);
      const thg = new THREE.ExtrudeGeometry(th, { depth: 0.028, bevelEnabled: false }); thg.translate(0, 0, -0.014);
      g.add(new THREE.Mesh(thg, new THREE.MeshStandardMaterial({ color: frameC, roughness: 0.5 })));
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.0175, 0.0185, 0.13, 18), new THREE.MeshStandardMaterial({ color: 0x0d1117, roughness: 0.9 }));
      g.add(grip);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.012, 18), new THREE.MeshStandardMaterial({ color: 0xff6a2b, roughness: 0.6 })); cap.position.y = -0.07; g.add(cap);
      return g;
    }
    function computeFrames() {
      const over = !!STROKES[rep.stroke].over, hs = rep.hand === 'L' ? -1 : 1, st = rep.stroke;
      const pz = st === 'VL' ? 3.2 : over ? 5.4 : 7.6, px = 1.3 * hs;
      const Sh = [px + 0.19 * hs, over ? 1.5 : 1.42, pz];
      const bias = over ? [0, 0.3, -0.2] : [0, -0.8, -0.3];
      return rep.q.map((q, i) => {
        const d = Q.rot(q, [0, 1, 0]); const a = [d[0] + bias[0], d[1] + bias[1], d[2] + bias[2]]; const L = Math.hypot(a[0], a[1], a[2]) || 1;
        const H = [Sh[0] + 0.58 * a[0] / L, Math.max(0.32, Sh[1] + 0.58 * a[1] / L), Sh[2] + 0.58 * a[2] / L];
        const at = y => { const v = Q.rot(q, [0, y, 0]); return [H[0] + v[0], H[1] + v[1], H[2] + v[2]]; };
        const W = Q.rot(q, [1, 0, 0]);
        return { t: rep.t[i], w: rep.w[i], q, H, C: at(0.25), tip: at(0.40), thr: at(0.12), W };
      });
    }
    const ramp = [[0, [0.25, 0.62, 0.56]], [0.5, [0.93, 0.98, 0.96]], [0.8, [1.0, 0.55, 0.25]], [1, [0.92, 0.27, 0.12]]];
    function speedColor(x) {
      x = clamp(x, 0, 1); let i = 0; while (i < ramp.length - 2 && x > ramp[i + 1][0]) i++;
      const [x0, c0] = ramp[i], [x1, c1] = ramp[i + 1], f = (x - x0) / (x1 - x0);
      return [c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f];
    }
    function buildSwing() {
      if (swingGrp) { scene.remove(swingGrp); swingGrp.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
      swingGrp = new THREE.Group(); scene.add(swingGrp);
      F = computeFrames();
      pi = 0; rep.t.forEach((tt, i) => { if (Math.abs(tt) < Math.abs(rep.t[pi])) pi = i; });
      const pk = Math.max(...rep.w), L = set.look;
      i0 = pi; while (i0 > 0 && (rep.w[i0 - 1] > pk * 0.16 || pi - i0 < 4)) i0--; i0 = Math.max(0, i0 - 2);
      i1 = pi; while (i1 < F.length - 1 && (rep.w[i1 + 1] > pk * 0.16 || i1 - pi < 4)) i1++; i1 = Math.min(F.length - 1, i1 + 2);
      const colorOf = i => L.ribbonColor === 'orange' ? [1.0, 0.42, 0.17] : L.ribbonColor === 'white' ? [0.96, 0.97, 1] : speedColor(F[i].w / pk);
      // ribbon
      ribbon = null;
      if (L.ribbon && i1 > i0) {
        const n = i1 - i0 + 1, pos = new Float32Array(n * 6), col = new Float32Array(n * 6), idx = [];
        for (let k = 0; k < n; k++) {
          const f = F[i0 + k]; let a, b;
          if (L.ribbonWidth === 'line') { a = f.tip.map((v, j) => v - f.W[j] * 0.014); b = f.tip.map((v, j) => v + f.W[j] * 0.014); }
          else { a = f.thr; b = f.tip; }
          pos.set(a, k * 6); pos.set(b, k * 6 + 3); const c = colorOf(i0 + k); col.set(c, k * 6); col.set(c, k * 6 + 3);
          if (k < n - 1) { const v = k * 2; idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); }
        }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
        ribbon = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: L.ribbonWidth === 'line' ? 0.95 : 0.55, side: THREE.DoubleSide, depthWrite: false }));
        swingGrp.add(ribbon);
      }
      // ghosts
      ghosts = [];
      if (L.ghosts) {
        const step = { sparse: 6, normal: 4, dense: 2 }[L.ghostDensity] || 4;
        for (let i = i0; i <= i1; i += step) { const gr = makeRacket(true); gr.position.set(...F[i].H); gr.quaternion.set(...F[i].q); gr.userData.i = i; swingGrp.add(gr); ghosts.push(gr); }
      }
      // dots
      dots = [];
      if (L.dots) {
        const dg = new THREE.SphereGeometry(0.009, 8, 6);
        for (let i = i0; i <= i1; i++) { const c = speedColor(F[i].w / pk); const m = new THREE.Mesh(dg, basic(new THREE.Color(c[0], c[1], c[2]))); m.position.set(...F[i].C); m.userData.i = i; swingGrp.add(m); dots.push(m); }
      }
      // peak marker (ball-sized)
      peakM = null;
      if (L.peak) { peakM = new THREE.Mesh(new THREE.SphereGeometry(0.034, 20, 14), basic(0xff6a2b)); peakM.position.set(...F[pi].C); swingGrp.add(peakM); }
      // racket + floor shadow
      racket = makeRacket(false); swingGrp.add(racket);
      shadow = new THREE.Mesh(new THREE.CircleGeometry(0.17, 24), basic(0x000000, { transparent: true, opacity: 0.18, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; swingGrp.add(shadow);
      // camera target = middle of the active swing
      const c = [0, 0, 0]; for (let i = i0; i <= i1; i++) for (let j = 0; j < 3; j++) c[j] += F[i].C[j] / (i1 - i0 + 1);
      const hs = rep.hand === 'L' ? -1 : 1;
      home = { target: new THREE.Vector3(c[0], c[1], c[2]), az: -0.34 * hs, pol: 1.12, r: 2.35 };
      if (!orbit) orbit = { target: home.target.clone(), az: home.az, pol: home.pol, r: home.r };
    }
    function camUpdate() {
      const { az, pol, r, target } = orbit;
      camera.position.set(target.x + r * Math.sin(pol) * Math.sin(az), target.y + r * Math.cos(pol), target.z + r * Math.sin(pol) * Math.cos(az));
      camera.lookAt(target);
    }
    function fit() {
      if (!renderer || !canvas) return;
      const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    function attachOrbit() {
      const pts = new Map(); let pinch0 = 0, r0 = 0;
      const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
      const down = e => { canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) { pinch0 = dist(); r0 = orbit.r; } };
      const move = e => {
        if (!pts.has(e.pointerId)) return; const p = pts.get(e.pointerId); const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
        if (pts.size === 1) { orbit.az -= dx * 0.008; orbit.pol = clamp(orbit.pol - dy * 0.006, 0.12, 1.5); }
        else if (pts.size === 2 && pinch0 > 0) orbit.r = clamp(r0 * pinch0 / Math.max(1, dist()), 0.8, 14);
      };
      const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch0 = 0; };
      const wheel = e => { e.preventDefault(); orbit.r = clamp(orbit.r * (1 + e.deltaY * 0.0012), 0.8, 14); };
      canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
      ['pointerup', 'pointercancel'].forEach(ev => canvas.addEventListener(ev, up));
      canvas.addEventListener('wheel', wheel, { passive: false });
      return () => { canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); ['pointerup', 'pointercancel'].forEach(ev => canvas.removeEventListener(ev, up)); canvas.removeEventListener('wheel', wheel); };
    }
    let mountId = 0;
    async function mount(cv, r) {
      const my = ++mountId;
      THREE = await loadThree();
      if (my !== mountId || !cv.isConnected) throw new Error('stale mount');
      canvas = cv; rep = r; orbit = null;
      renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      if ('outputEncoding' in renderer) renderer.outputEncoding = THREE.sRGBEncoding;
      buildCourt(); buildSwing(); fit();
      detach = attachOrbit();
      if (window.ResizeObserver) { ro = new ResizeObserver(fit); ro.observe(cv); }
    }
    function setTime(tt) {
      if (!F.length) return;
      let i = 0; while (i < F.length - 2 && F[i + 1].t <= tt) i++;
      const a = F[i], b = F[i + 1] || a, f = clamp((tt - a.t) / Math.max(1e-6, b.t - a.t), 0, 1);
      const H = a.H.map((v, j) => v + (b.H[j] - v) * f), q = Q.slerp(a.q, b.q, f);
      racket.position.set(H[0], H[1], H[2]); racket.quaternion.set(q[0], q[1], q[2], q[3]);
      const C = Q.rot(q, [0, 0.25, 0]); shadow.position.set(H[0] + C[0], 0.004, H[2] + C[2]);
      const cur = i + (f > 0.5 ? 1 : 0);
      if (ribbon) ribbon.geometry.setDrawRange(0, Math.max(0, Math.min(cur, i1) - i0) * 6);
      ghosts.forEach(g => { g.visible = g.userData.i <= cur; });
      dots.forEach(d => { d.visible = d.userData.i <= cur; });
      if (peakM) peakM.visible = tt >= -0.002;
    }
    function render() { if (!renderer) return; camUpdate(); renderer.render(scene, camera); }
    function unmount() {
      mountId++;
      if (detach) detach(); detach = null; if (ro) ro.disconnect(); ro = null;
      if (scene) scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); });
      if (renderer) { renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) { /* ignore */ } }
      renderer = null; scene = null; F = []; ghosts = []; dots = []; swingGrp = null; orbit = null;
    }
    return {
      mount, unmount, setTime, render,
      rebuild() { if (renderer) buildSwing(); },
      resetView() { if (home) orbit = { target: home.target.clone(), az: home.az, pol: home.pol, r: home.r }; },
      snapshot() { if (!renderer) return null; render(); try { return renderer.domElement.toDataURL('image/png'); } catch (e) { return null; } }
    };
  })();


  /* ---------- workouts ---------- */
  const allWorkouts = () => PRESETS.concat(S.workouts);
  const getW = id => allWorkouts().find(w => w.id === id);
  const isPreset = id => id.startsWith('p-');
  const wDur = w => w.blocks.reduce((a, b) => a + (b.kind === 'rest' ? b.secs : b.secs ? b.secs : b.reps * 3), 0);
  const wMins = w => Math.max(1, Math.round(wDur(w) / 60));
  const blockLabel = b => b.kind === 'rest' ? `Istirahat ${b.secs} dtk` : b.secs ? `${STROKES[b.stroke].n} ${b.secs} dtk` : `${STROKES[b.stroke].n} × ${b.reps}`;

  SCREENS.workouts = function () {
    const card = w => `<button class="wcard" data-act="open" data-id="${w.id}"><span class="top"><b>${esc(w.name)}</b><span class="dur">${ICON.clock}${wMins(w)} mnt</span></span>
      <span class="pills">${w.blocks.filter(b => b.kind !== 'rest').map(b => `<span>${b.secs ? b.secs + 'd' : b.reps} ${b.stroke}</span>`).join('')}</span></button>`;
    app.innerHTML = `<section class="scr tabbed">
      <header class="hdr"><div><h1 class="title">Program</h1><p class="sub">Drill padel, dipandu suara coach.</p></div></header>
      <span class="label section">Siap pakai</span>
      ${PRESETS.map(card).join('')}
      <span class="label section">Program kamu</span>
      ${S.workouts.map(card).join('')}
      <button class="wcard add" data-act="new">${ICON.plus}<span><b>Bikin program sendiri</b><br><span class="sub" style="font-size:13px">Atur pukulan, rep, dan istirahatnya</span></span></button>
      <p class="note">FH forehand · BH backhand · VL voli · BJ bandeja · VB víbora · SM smash · LB lob · SV servis. Angka pakai "d" = detik.</p>
      ${tabbar('workouts')}
    </section>`;
    actions = { back: () => go('home'), open: b => go('wdetail', { id: b.dataset.id }), new: () => go('wedit', {}) };
  };

  SCREENS.wdetail = function (p) {
    const w = getW(p.id); if (!w) return go('workouts');
    const nBlocks = w.blocks.filter(b => b.kind !== 'rest').length;
    let n = 0;
    app.innerHTML = `<section class="scr">
      ${subhdr('', `<button class="round" data-act="voice" aria-label="Suara coach ${set.coach ? 'nyala' : 'mati'}">${set.coach ? ICON.spk : ICON.spkOff}</button>`)}
      <h1 class="title-lg">${esc(w.name)}</h1>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><span class="dur">${ICON.clock}${wMins(w)} mnt</span><span class="dur" style="background:var(--teal-soft)">${nBlocks} blok pukulan</span><span class="dur" style="background:var(--well)">Coach ${set.coach ? 'nyala' : 'mati'}</span></div>
      <div class="card" style="padding:10px 16px"><ol class="timeline">${w.blocks.map(b => b.kind === 'rest'
        ? `<li class="rest"><span class="node">${ICON.rest}</span><span class="nm">Istirahat</span><span class="amt">${b.secs} dtk</span></li>`
        : `<li><span class="node">${++n}</span><span class="nm">${STROKES[b.stroke].n}</span><span class="amt">${b.secs ? b.secs + ' dtk' : '× ' + b.reps}</span></li>`).join('')}</ol></div>
      <div class="grow"></div>
      <button class="btn go" data-act="start">Gas mulai</button>
      ${isPreset(w.id) ? '<button class="btn line" data-act="dup">Duplikat & edit</button>' : '<div class="row-btns"><button class="btn line" data-act="edit">Edit</button><button class="btn danger" data-act="del">Hapus</button></div>'}
    </section>`;
    actions = {
      back: () => go('workouts'),
      voice: () => { set.coach = !set.coach; persist(); go('wdetail', p); },
      start: () => startWith(() => go('run', { id: w.id })),
      dup: () => go('wedit', { from: w.id }),
      edit: () => go('wedit', { id: w.id }),
      del: () => dialog('Hapus program ini?', esc(w.name) + ' bakal dihapus dari HP ini.', [{ label: 'Batal' }, { label: 'Hapus', kind: 'danger', fn: () => { S.workouts = S.workouts.filter(x => x.id !== w.id); persist(true); go('workouts'); } }])
    };
  };

  SCREENS.wedit = function (p) {
    const src = p.id ? getW(p.id) : p.from ? getW(p.from) : null;
    const draft = src ? { id: p.id || null, name: p.id ? src.name : src.name + ' (versi aku)', blocks: JSON.parse(JSON.stringify(src.blocks)) } : { id: null, name: 'Program aku', blocks: [P('FH', 10), Rr(20), P('BH', 10)] };
    function render() {
      app.innerHTML = `<section class="scr">
        ${subhdr(draft.id ? 'Edit program' : 'Program baru')}
        <label class="field"><span class="label">Nama program</span><input id="wname" maxlength="40" value="${esc(draft.name)}" autocomplete="off"></label>
        <span class="label">Isi program</span>
        ${draft.blocks.map((b, i) => blockEd(b, i)).join('')}
        <div class="row-btns"><button class="btn line small" data-act="addS">${ICON.plus}Pukulan</button><button class="btn line small" data-act="addR">${ICON.plus}Istirahat</button></div>
        <p class="sub center">Kira-kira ${wMins(draft)} menit</p>
        <div class="grow"></div>
        <button class="btn go" data-act="save">Simpan</button>
      </section>`;
      app.querySelector('#wname').addEventListener('input', e => { draft.name = e.target.value; });
      app.querySelectorAll('select[data-i]').forEach(sel => sel.addEventListener('change', () => { draft.blocks[+sel.dataset.i].stroke = sel.value; }));
    }
    function blockEd(b, i) {
      const mv = `<div class="mv"><button data-act="up" data-i="${i}" aria-label="Naikin">${ICON.up}</button><button data-act="dn" data-i="${i}" aria-label="Turunin">${ICON.down}</button><button data-act="rm" data-i="${i}" aria-label="Hapus blok">${ICON.x}</button></div>`;
      const step = (val, unit) => `<div class="stepper"><button data-act="dec" data-i="${i}" aria-label="Kurangin">${ICON.minus}</button><output>${val}</output><button data-act="inc" data-i="${i}" aria-label="Tambahin">${ICON.plus}</button><span class="sub">${unit}</span></div>`;
      if (b.kind === 'rest') return `<div class="ed-block rest"><div class="top"><span style="flex:1;font-weight:700;color:var(--ink-2)">${i + 1}. Istirahat</span>${mv}</div><div class="bot">${step(b.secs, 'detik')}</div></div>`;
      return `<div class="ed-block"><div class="top"><select data-i="${i}" aria-label="Jenis pukulan">${STROKE_ORDER.map(k => `<option value="${k}" ${k === b.stroke ? 'selected' : ''}>${i + 1}. ${STROKES[k].n}</option>`).join('')}</select>${mv}</div>
        <div class="bot">${b.secs ? step(b.secs, 'detik') : step(b.reps, 'kali')}<div class="seg compact" style="min-width:150px"><button data-act="mode" data-i="${i}" data-k="reps" aria-pressed="${!b.secs}">Rep</button><button data-act="mode" data-i="${i}" data-k="secs" aria-pressed="${!!b.secs}">Waktu</button></div></div></div>`;
    }
    const bi = b => draft.blocks[+b.dataset.i];
    actions = {
      back: () => (p.id || p.from) ? go('wdetail', { id: p.id || p.from }) : go('workouts'),
      addS: () => { draft.blocks.push(P('FH', 10)); render(); },
      addR: () => { draft.blocks.push(Rr(20)); render(); },
      up: b => { const i = +b.dataset.i; if (i > 0) { [draft.blocks[i - 1], draft.blocks[i]] = [draft.blocks[i], draft.blocks[i - 1]]; render(); } },
      dn: b => { const i = +b.dataset.i; if (i < draft.blocks.length - 1) { [draft.blocks[i + 1], draft.blocks[i]] = [draft.blocks[i], draft.blocks[i + 1]]; render(); } },
      rm: b => { draft.blocks.splice(+b.dataset.i, 1); render(); },
      inc: b => { const x = bi(b); if (x.kind === 'rest' || x.secs) x.secs = Math.min(600, x.secs + 5); else x.reps = Math.min(100, x.reps + 1); render(); },
      dec: b => { const x = bi(b); if (x.kind === 'rest' || x.secs) x.secs = Math.max(5, x.secs - 5); else x.reps = Math.max(1, x.reps - 1); render(); },
      mode: b => { const x = bi(b); if (b.dataset.k === 'secs' && !x.secs) { x.secs = 30; delete x.reps; } if (b.dataset.k === 'reps' && x.secs) { x.reps = 10; delete x.secs; } render(); },
      save: () => {
        if (!draft.blocks.some(b => b.kind !== 'rest')) return toast('Tambahin minimal 1 blok pukulan dulu');
        const w = { id: draft.id || 'u' + Date.now().toString(36), name: (draft.name || 'Program aku').trim().slice(0, 40), blocks: draft.blocks };
        const i = S.workouts.findIndex(x => x.id === w.id); if (i >= 0) S.workouts[i] = w; else S.workouts.push(w);
        persist(true); toast('Program disimpan'); go('wdetail', { id: w.id });
      }
    };
    render();
  };

  SCREENS.run = function (p) {
    const w = getW(p.id); if (!w) return go('workouts');
    const blocks = w.blocks;
    const st = { bi: -1, count: 0, bStart: 0, paused: false, pauseAt: 0, t0: now(), pausedMs: 0, start: Date.now(), total: 0, best: 0, newBest: false, said: {}, balls: [] }, prevBest = S.best.racket || 0;
    const res = blocks.map(b => ({ b, done: 0, best: 0 }));
    app.innerHTML = `<section class="scr session">
      <div class="s-top"><button class="round" data-act="end" aria-label="Udahan">${ICON.x}</button><div class="mid"><b>${esc(w.name)}</b><span id="bIdx"></span></div><button class="round" data-act="voice" id="voiceBtn" aria-label="Suara coach">${set.coach ? ICON.spk : ICON.spkOff}</button></div>
      <div class="segs" id="segs">${blocks.map((b, i) => `<i class="${b.kind === 'rest' ? 'r' : ''}" data-i="${i}"></i>`).join('')}</div>
      <h2 class="block-name" id="bName" style="margin-top:8px"></h2>
      <div class="run-ring" id="ring"><svg viewBox="0 0 220 220" aria-hidden="true"><circle class="trk" cx="110" cy="110" r="96"/><circle class="prg" id="prg" cx="110" cy="110" r="96" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/></svg>
        <div class="in"><b id="bBig">0</b><span id="bOf"></span></div></div>
      <div class="stats3"><div><b id="rsL">–</b><small id="rsLr">&nbsp;</small><span>Terakhir</span></div><div><b class="or" id="rsB">–</b><small id="rsBr">&nbsp;</small><span>Terbaik</span></div><div><b id="rsT">0</b><small>&nbsp;</small><span>Total rep</span></div></div>
      <span class="next-chip" id="bNext"></span>
      <div class="grow"></div>
      <div class="s-bottom">${simBtn()}
        <div class="tools"><button class="chip" data-act="sens">${ICON.sliders}Sensitivitas: <span id="sensChip">${SENS[set.sens].label}</span></button><button class="chip" data-act="skip">${ICON.skip}Lewati blok</button></div>
        <button class="btn line" id="pauseBtn" data-act="pause">Jeda dulu</button>
      </div>
    </section>`;
    const cur = () => blocks[st.bi];
    const elapsed = () => ((st.paused ? st.pauseAt : now()) - st.bStart) / 1000;
    const active = () => !st.paused && cur() && cur().kind !== 'rest';
    function sayBlock(b, first) {
      const n = STROKES[b.stroke].n, en = STROKES[b.stroke].en;
      if (b.secs) Coach.say(`${first ? w.name + '. ' : ''}${n}, ${b.secs} detik. Gas!`, `${first ? w.name + '. ' : ''}${en}, ${b.secs} seconds. Go!`);
      else Coach.say(`${first ? w.name + '. ' : ''}${n}, ${b.reps} kali. Gas!`, `${first ? w.name + '. ' : ''}${en}, ${b.reps} reps. Go!`);
    }
    const nextLabel = i => blocks[i] ? 'Abis ini: ' + blockLabel(blocks[i]) : 'Ini blok terakhir, habisin!';
    function startBlock(i) {
      if (i >= blocks.length) return finish(true);
      st.bi = i; st.count = 0; st.bStart = now(); st.said = {};
      const b = blocks[i];
      $('#bIdx').textContent = `Blok ${i + 1} dari ${blocks.length}`;
      $('#ring').classList.toggle('rest', b.kind === 'rest');
      $('#bName').textContent = b.kind === 'rest' ? 'Istirahat dulu' : STROKES[b.stroke].n;
      if (b.kind !== 'rest') sayBlock(b, i === 0);
      $('#bNext').textContent = nextLabel(i + 1);
      draw();
    }
    function blockDone() {
      const nb = blocks[st.bi + 1];
      if (!nb) return finish(true);
      if (nb.kind === 'rest') Coach.say(`Oke, istirahat ${nb.secs} detik.`, `Nice. Rest ${nb.secs} seconds.`);
      Snd.play('ding', 0.8);
      startBlock(st.bi + 1);
    }
    function draw() {
      const b = cur(); if (!b) return;
      const el = elapsed(); let pr;
      if (b.kind === 'rest') { $('#bBig').textContent = Math.max(0, Math.ceil(b.secs - el)); $('#bOf').textContent = 'detik'; pr = el / b.secs; }
      else if (b.secs) { $('#bBig').textContent = st.count; $('#bOf').textContent = `rep · ${mmss(Math.max(0, b.secs - el))} lagi`; pr = el / b.secs; }
      else { $('#bBig').textContent = st.count; $('#bOf').textContent = `dari ${b.reps}`; pr = st.count / b.reps; }
      pr = clamp(pr, 0, 1);
      const prg = $('#prg'); prg.style.strokeDashoffset = (100 - pr * 100).toFixed(2); prg.style.opacity = pr > 0 ? 1 : 0;
      app.querySelectorAll('#segs i').forEach((s, i) => {
        s.className = (blocks[i].kind === 'rest' ? 'r ' : '') + (i < st.bi ? 'done' : i === st.bi ? 'now' : '');
        if (i === st.bi) s.style.setProperty('--p', (pr * 100) + '%');
      });
    }
    const det = new Detector(thr, pk => { if (active()) Snd.hit(pk / 22); }, pk => {
      if (!active()) return;
      const b = cur(), r = racketKmh(pk);
      st.count++; st.total++; st.best = Math.max(st.best, r); st.balls.push(ballOf(r));
      const R = res[st.bi]; R.done++; R.best = Math.max(R.best, r);
      recordSwing(r, b.stroke, true); if (prevBest > 0 && r > prevBest) st.newBest = true;
      $('#rsL').textContent = '≈' + fv(ballOf(r)); $('#rsLr').textContent = fv(r) + ' raket';
      $('#rsB').textContent = '≈' + fv(ballOf(st.best)); $('#rsBr').textContent = fv(st.best) + ' raket';
      $('#rsT').textContent = st.total;
      Guard.engage();
      draw();
      if (!b.secs) {
        const left = b.reps - st.count;
        if (left <= 0) blockDone();
        else if (left === 3 && b.reps >= 6) Coach.say('Tiga lagi!', 'Three more!');
      }
    });
    const unsub = Motion.sub(s => det.feed(s));
    const iv = setInterval(() => {
      if (st.paused) return;
      const b = cur(); if (!b) return;
      if (b.kind === 'rest' || b.secs) {
        const remain = b.secs - elapsed();
        if (b.kind !== 'rest' && b.secs >= 20 && remain <= 10 && remain > 9 && !st.said.ten) { st.said.ten = 1; Coach.say('Sepuluh detik lagi!', 'Ten seconds!'); }
        const c = Math.ceil(remain);
        if (c <= 3 && c >= 1 && !st.said['b' + c]) { st.said['b' + c] = 1; Snd.play('beep', 0.9); }
        if (remain <= 0) { if (b.kind === 'rest') { Snd.play('ding', 0.8); startBlock(st.bi + 1); } else blockDone(); return; }
      }
      draw();
    }, 100);
    Wake.on();
    startBlock(0);
    function finish(completed) {
      if (st.ended) return; st.ended = true;
      const d = (now() - st.t0 - (st.paused ? now() - st.pauseAt : 0) - st.pausedMs) / 1000;
      if (completed) S.workoutsDone++;
      const cons = consistency(st.balls);
      if (st.total > 0 || completed) recordSession({ type: 'workout', name: w.name, start: st.start, dur: d, swings: st.total, best: st.best, completed, cons: cons ? cons.pct : null });
      go('runDone', { name: w.name, completed, n: st.total, dur: d, best: st.best, newBest: st.newBest, cons, res: res.filter(x => x.b.kind !== 'rest') });
      if (completed) Coach.say('Latihan kelar. Keren banget!', 'Workout complete. Great job!');
    }
    const pauseToggle = () => {
      const btn = $('#pauseBtn');
      if (!st.paused) { st.paused = true; st.pauseAt = now(); Coach.stop(); btn.textContent = 'Lanjut lagi'; btn.className = 'btn teal'; }
      else { const d = now() - st.pauseAt; st.bStart += d; st.pausedMs += d; st.paused = false; btn.textContent = 'Jeda dulu'; btn.className = 'btn line'; }
    };
    cleanup = () => { unsub(); clearInterval(iv); Wake.off(); Coach.stop(); };
    Object.assign(actions, {
      pause: pauseToggle,
      end: () => { if (!st.paused) pauseToggle(); dialog('Udahan latihannya?', 'Ayunan yang udah masuk tetep kecatet kok.', [{ label: 'Lanjut', kind: 'teal', fn: () => { if (st.paused) pauseToggle(); } }, { label: 'Udahan', kind: 'danger', fn: () => finish(false) }]); },
      back: () => actions.end(),
      skip: () => { if (st.paused) pauseToggle(); Snd.play('beep', 0.6); const nb = blocks[st.bi + 1]; if (nb && nb.kind === 'rest') Coach.say(`Istirahat ${nb.secs} detik.`, `Rest ${nb.secs} seconds.`); startBlock(st.bi + 1); },
      voice: () => { set.coach = !set.coach; persist(); if (!set.coach) Coach.stop(); $('#voiceBtn').innerHTML = set.coach ? ICON.spk : ICON.spkOff; toast(set.coach ? 'Suara coach nyala' : 'Suara coach dimatiin'); },
      sens: () => sensSheet(() => { $('#sensChip').textContent = SENS[set.sens].label; }),
      sim: () => Motion.simSwing()
    });
  };

  SCREENS.runDone = function (p) {
    app.innerHTML = `<section class="scr">
      <div class="done-head"><span class="medal">${ICON.trophy}</span><h1 class="title-lg">${p.completed ? 'Latihan kelar!' : 'Latihan dihentiin'}</h1><p class="sub">${esc(p.name)}</p></div>
      ${p.newBest ? `<span class="badge">${ICON.bolt} Rekor bola baru!</span>` : ''}
      <div class="stats3">
        <div><b>${p.n}</b><small>&nbsp;</small><span>Rep</span></div>
        <div><b>${mmss(p.dur)}</b><small>&nbsp;</small><span>Waktu</span></div>
        <div><b class="or">${p.best ? '≈' + fv(ballOf(p.best)) : '–'}</b><small>${p.best ? fv(p.best) + ' raket' : '&nbsp;'}</small><span>Terbaik</span></div>
      </div>
      ${p.n ? insightCard({ n: p.n, cons: p.cons }) : ''}
      <div class="list"><ol class="res">${p.res.map(r => { const tgt = r.b.reps || null; const ok = tgt ? r.done >= tgt : r.done > 0; return `<li><span class="${ok ? 'ok' : 'miss'}">${ok ? ICON.check : ICON.x}</span><span style="font-weight:700">${STROKES[r.b.stroke].n}</span><span class="num" style="color:var(--ink-2);font-size:14px">${tgt ? r.done + '/' + tgt : r.done + ' rep'}</span><span class="num or" style="min-width:52px;text-align:right;font-size:14px">${r.best ? '≈' + fv(ballOf(r.best)) : '–'}</span></li>`; }).join('')}</ol></div>
      <p class="note">Angka oranye = bola tercepat di tiap blok (${U()}).</p>
      <div class="grow"></div>
      <button class="btn go" data-act="done">Sip, balik ke beranda</button>
    </section>`;
    actions = { done: () => go('home'), back: () => go('home') };
    if (p.completed) Snd.play('done', 0.7);
  };

  /* ---------- progress (stats) ---------- */
  let statsBars = 'week', statsMetric = 'ball';
  SCREENS.stats = function () {
    const keys = Object.keys(S.days).sort();
    const total = keys.reduce((a, k) => a + S.days[k].sw, 0);
    const practicedDays = keys.filter(practiced).length;
    const totalSec = keys.reduce((a, k) => a + (S.days[k].sec || 0), 0);
    const st = streaks(), td = peekDay(dayKey());
    const wk = new Date(); wk.setHours(12, 0, 0, 0); wk.setDate(wk.getDate() - ((wk.getDay() + 6) % 7));
    const endD = new Date(); endD.setHours(23, 59, 59, 0);
    let weekSec = 0; for (let d = new Date(wk); d <= endD; d.setDate(d.getDate() + 1)) weekSec += peekDay(dayKey(d)).sec || 0;
    const rc = S.sessions.filter(x => x.cons != null && x.start > Date.now() - 7 * 864e5), cons7 = rc.length ? Math.round(rc.reduce((a, x) => a + x.cons, 0) / rc.length) + '%' : '–';
    app.innerHTML = `<section class="scr tabbed">
      <header class="hdr"><div><h1 class="title">Progres</h1><p class="sub">${S.firstDay ? `Latihan sejak ${fmtDate(keyDate(S.firstDay))}. Konsisten itu kuncinya.` : 'Belum ada latihan. Ayunan pertamamu mulai dari sini.'}</p></div></header>
      <div class="sum4">
        <div><span class="ic">${ICON.swing}</span><b>${total}</b><span>Total ayunan</span></div>
        <div><span class="ic o">${ICON.flame}</span><b>${st.current}</b><span>Hari beruntun</span></div>
        <div><span class="ic">${ICON.cal}</span><b>${practicedDays}</b><span>Hari latihan</span></div>
        <div><span class="ic o">${ICON.boltL}</span><b>${S.best.racket ? '≈' + fv(ballOf(S.best.racket)) : '–'}</b><span>Rekor bola (${U()})</span></div>
      </div>
      <div class="card" id="fast"></div>
      <div class="card" id="bars"></div>
      <div class="card" id="heat"></div>
      <div class="card" id="mix"></div>
      <div class="list">
        <div class="row"><span class="k">${ICON.target}Hari ini</span><span class="vs"><b class="num" style="color:var(--ink)">${td.sw}/${set.goal}</b><button class="link" data-act="goal" style="padding:0 0 0 6px">Ubah target</button></span></div>
        ${[['wave', 'Konsistensi 7 hari', cons7], ['clock', 'Sesi', S.sessions.length], ['clip', 'Program kelar', S.workoutsDone], ['cube', 'Replay direkam', S.replaysMade], ['clock', 'Waktu latihan', dur(totalSec)], ['cal', 'Latihan minggu ini', dur(weekSec)], ['trophy', 'Streak terpanjang', st.longest + ' hari']]
          .map(([ic, k, v]) => `<div class="row"><span class="k">${ICON[ic]}${k}</span><span class="v">${v}</span></div>`).join('')}
      </div>
      ${tabbar('stats')}
    </section>`;
    actions = {
      back: () => go('home'),
      goal: () => goalDialog(() => go('stats')),
      metric: b => { statsMetric = b.dataset.k; drawFast(); },
      bars: b => { statsBars = b.dataset.k; drawBars(); },
      pick: b => { const h = b.closest('.card').querySelector('[data-sel]'); if (h) h.innerHTML = b.dataset.lbl; }
    };
    drawFast(); drawBars(); drawHeat(); drawMix();
  };
  function niceRange(min, max) {
    const lo = Math.max(0, Math.floor((min - 3) / 5) * 5), hi = Math.ceil((max + 3) / 5) * 5;
    return [lo, hi === lo ? lo + 5 : hi];
  }
  function drawFast() {
    const el = $('#fast'); if (!el) return;
    const ks = Object.keys(S.days).filter(k => S.days[k].best > 0).sort().slice(-45);
    const val = k => conv(statsMetric === 'ball' ? ballOf(S.days[k].best) : S.days[k].best);
    const last = ks.length ? Math.round(val(ks[ks.length - 1])) : null;
    let body;
    if (!ks.length) body = '<p class="note" style="padding:14px 0">Belum ada data kecepatan. Sesi berikutnya bakal jadi titik pertama.</p>';
    else {
      const W = 320, H = 150, pl = 6, pr = 30, pt = 10, pb = 22;
      const ts = ks.map(k => keyDate(k).getTime()), t0 = ts[0], t1 = Math.max(ts[ts.length - 1], t0 + 864e5);
      const vs = ks.map(val), [lo, hi] = niceRange(Math.min(...vs), Math.max(...vs));
      const X = t => ks.length === 1 ? (pl + W - pr) / 2 : pl + (t - t0) / (t1 - t0) * (W - pl - pr), Y = v => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
      const ticks = []; const stp = Math.max(5, Math.ceil((hi - lo) / 3 / 5) * 5); for (let v = lo; v <= hi; v += stp) ticks.push(v);
      const path = ks.map((k, i) => (i ? 'L' : 'M') + X(ts[i]).toFixed(1) + ' ' + Y(vs[i]).toFixed(1)).join(' ');
      body = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Kecepatan terbaik per hari">
        ${ticks.map(v => `<line class="grid" x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${W - pr + 6}" y="${Y(v) + 3.5}">${v}</text>`).join('')}
        ${ks.length > 1 ? `<path class="ln" d="${path}"/>` : ''}
        ${ks.map((k, i) => `<circle class="dot ${i === ks.length - 1 ? 'last' : ''}" cx="${X(ts[i])}" cy="${Y(vs[i])}" r="${i === ks.length - 1 ? 5.5 : 4}"/><circle class="hit" cx="${X(ts[i])}" cy="${Y(vs[i])}" r="14" data-act="pick" data-lbl="${fmtDate(keyDate(k))}: <b>${Math.round(vs[i])}</b> ${U()}"><title>${fmtDate(keyDate(k))}: ${Math.round(vs[i])} ${U()}</title></circle>`).join('')}
        <text x="${pl}" y="${H - 4}">${fmtDate(keyDate(ks[0]))}</text>${ks.length > 1 ? `<text x="${W - pr}" y="${H - 4}" text-anchor="end">${ks[ks.length - 1] === dayKey() ? 'Hari ini' : fmtDate(keyDate(ks[ks.length - 1]))}</text>` : ''}
      </svg>${ks.length < 3 ? '<p class="note" style="padding:6px 0 0">Balik lagi minggu depan buat lihat trennya.</p>' : ''}`;
    }
    el.innerHTML = `<div class="chart-head"><div><h3>Makin ngebut?</h3><p class="sub" data-sel style="margin-top:2px;font-size:13px">Kecepatan terbaik per hari</p></div><div class="v">${last != null ? last : '–'}<small>${U()} terakhir</small></div></div>
      <div class="seg compact" style="margin-bottom:12px"><button data-act="metric" data-k="ball" aria-pressed="${statsMetric === 'ball'}">Bola ≈</button><button data-act="metric" data-k="racket" aria-pressed="${statsMetric === 'racket'}">Raket</button></div>${body}`;
  }
  function drawBars() {
    const el = $('#bars'); if (!el) return;
    const today = new Date(); today.setHours(12, 0, 0, 0);
    const bins = [];
    if (statsBars === 'day') {
      for (let i = 13; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); bins.push({ lbl: i === 0 ? 'Hari ini' : fmtDate(d), v: peekDay(dayKey(d)).sw }); }
    } else if (statsBars === 'week') {
      const mon = new Date(today); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
      for (let i = 11; i >= 0; i--) { const s = new Date(mon); s.setDate(s.getDate() - 7 * i); let v = 0; for (let j = 0; j < 7; j++) { const d = new Date(s); d.setDate(d.getDate() + j); v += peekDay(dayKey(d)).sw; } bins.push({ lbl: i === 0 ? 'Minggu ini' : fmtDate(s), v }); }
    } else {
      for (let i = 5; i >= 0; i--) { const m = new Date(today.getFullYear(), today.getMonth() - i, 1); let v = 0; const pre = m.getFullYear() + '-' + z2(m.getMonth() + 1); Object.keys(S.days).forEach(k => { if (k.startsWith(pre)) v += S.days[k].sw; }); bins.push({ lbl: i === 0 ? 'Bulan ini' : MONTHS[m.getMonth()], v }); }
    }
    const cur = bins[bins.length - 1].v, avg = Math.round(bins.slice(0, -1).reduce((a, b) => a + b.v, 0) / Math.max(1, bins.length - 1));
    const W = 320, H = 140, pl = 4, pr = 28, pt = 8, pb = 20, n = bins.length;
    let mx = Math.max(4, ...bins.map(b => b.v)); if (statsBars === 'day') mx = Math.max(mx, set.goal);
    const step = mx <= 10 ? 2 : Math.ceil(mx / 4 / 5) * 5; mx = Math.ceil(mx / step) * step;
    const bw = (W - pl - pr) / n, Y = v => pt + (1 - v / mx) * (H - pt - pb), base = Y(0);
    const ticks = []; for (let v = 0; v <= mx; v += step) ticks.push(v);
    const bars = bins.map((b, i) => {
      const x = pl + i * bw + 1.5, w = Math.max(2, bw - 3), y = Y(b.v), r = Math.min(4, w / 2, base - y);
      const d = b.v > 0 ? `M${x} ${base}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${base}Z` : '';
      return `${d ? `<path class="barf ${i === n - 1 ? '' : 'past'}" d="${d}"/>` : ''}<rect class="hit" x="${x - 1.5}" y="${pt}" width="${bw}" height="${H - pt - pb}" data-act="pick" data-lbl="${b.lbl}: <b>${b.v}</b> ayunan"><title>${b.lbl}: ${b.v}</title></rect>`;
    }).join('');
    const xl = [0, Math.floor(n / 2), n - 1].map(i => `<text x="${pl + i * bw + bw / 2}" y="${H - 5}" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${bins[i].lbl}</text>`).join('');
    const per = statsBars === 'day' ? 'hari' : statsBars === 'week' ? 'minggu' : 'bulan';
    el.innerHTML = `<div class="chart-head"><div><h3>Ayunan per ${per}</h3><p class="sub" data-sel style="margin-top:2px;font-size:13px">Rata-rata ${avg}. Tap batang buat lihat angka.</p></div><div class="v">${cur}<small>${per} ini</small></div></div>
      <div class="seg compact" style="margin-bottom:12px">${[['day', 'Hari'], ['week', 'Minggu'], ['month', 'Bulan']].map(([k, l]) => `<button data-act="bars" data-k="${k}" aria-pressed="${statsBars === k}">${l}</button>`).join('')}</div>
      <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Jumlah ayunan per ${per}">
        ${ticks.map(v => `<line class="${v === 0 ? 'base' : 'grid'}" x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${W - pr + 6}" y="${Y(v) + 3.5}">${v}</text>`).join('')}
        ${statsBars === 'day' ? `<line class="goal" x1="${pl}" x2="${W - pr}" y1="${Y(set.goal)}" y2="${Y(set.goal)}"/><text x="${pl + 2}" y="${Y(set.goal) - 4}">target ${set.goal}</text>` : ''}
        ${bars}${xl}
      </svg>`;
  }
  function drawHeat() {
    const el = $('#heat'); if (!el) return;
    const today = new Date(); today.setHours(12, 0, 0, 0);
    const mon = new Date(today); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    const start = new Date(mon); start.setDate(start.getDate() - 16 * 7);
    const cs = 15, gap = 3, top = 16, left = 18, W = left + 17 * (cs + gap), H = top + 7 * (cs + gap);
    const lvl = v => v <= 0 ? 0 : v < set.goal * 0.5 ? 1 : v < set.goal ? 2 : v < set.goal * 2 ? 3 : 4;
    let cells = '', months = '', lastM = -1, nDays = 0;
    for (let c = 0; c < 17; c++) for (let r = 0; r < 7; r++) {
      const d = new Date(start); d.setDate(d.getDate() + c * 7 + r);
      if (r === 0 && d.getMonth() !== lastM) { lastM = d.getMonth(); months += `<text x="${left + c * (cs + gap)}" y="10">${MONTHS[lastM]}</text>`; }
      if (d > today) continue;
      const k = dayKey(d), v = peekDay(k).sw; if (practiced(k)) nDays++;
      cells += `<rect class="h${lvl(v)} ${k === dayKey() ? 'today' : ''}" x="${left + c * (cs + gap)}" y="${top + r * (cs + gap)}" width="${cs}" height="${cs}" rx="4" data-act="pick" data-lbl="${fmtDate(d)}: <b>${v}</b> ayunan"><title>${fmtDate(d)}: ${v} ayunan</title></rect>`;
    }
    const dl = ['S', '', 'R', '', 'J', '', 'M'].map((t, r) => t ? `<text x="0" y="${top + r * (cs + gap) + 11}">${t}</text>` : '').join('');
    el.innerHTML = `<div class="chart-head"><div><h3>Kalender latihan</h3><p class="sub" data-sel style="margin-top:2px;font-size:13px">17 minggu terakhir</p></div><div class="v">${nDays}<small>hari latihan</small></div></div>
      <svg class="heat" viewBox="0 0 ${W} ${H}" role="img" aria-label="Kalender latihan 17 minggu">${months}${dl}${cells}</svg>
      <div class="legend">Dikit <svg class="heat" viewBox="0 0 84 12" aria-hidden="true">${[0, 1, 2, 3, 4].map(i => `<rect class="h${i}" x="${i * 17}" y="0" width="12" height="12" rx="3"/>`).join('')}</svg> Target ×2</div>`;
  }
  function drawMix() {
    const el = $('#mix'); if (!el) return;
    const rows = STROKE_ORDER.map(k => [k, S.strokes[k] || 0]).filter(r => r[1] > 0).sort((a, b) => b[1] - a[1]);
    const mx = Math.max(1, ...rows.map(r => r[1]));
    el.innerHTML = `<div class="chart-head"><h3>Komposisi pukulan</h3></div>
      ${rows.length ? `<div class="mix">${rows.map(([k, v]) => `<div><span>${STROKES[k].n}</span><i style="width:${(v / mx * 100).toFixed(1)}%"></i><b>${v}</b></div>`).join('')}</div>` : ''}
      <p class="note" style="padding:${rows.length ? '12px' : '0'} 0 0">${rows.length ? 'Dari program dan analisis 3D.' : 'Selesaiin program atau analisis 3D, nanti jenis pukulanmu muncul di sini.'} Latihan bebas nggak tahu jenis pukulannya.</p>`;
  }
  function goalDialog(after) {
    let g = set.goal;
    openOv(`<h3>Target harian</h3><p>Jumlah ayunan dari latihan bebas dan program buat nutup target hari ini. Replay analisis nggak dihitung.</p>
      <div class="stepper" style="justify-content:center"><button data-act="dec" aria-label="Kurangin">${ICON.minus}</button><output id="gv">${g}</output><button data-act="inc" aria-label="Tambahin">${ICON.plus}</button></div>
      <div class="row-btns"><button class="btn small" data-act="cancel">Batal</button><button class="btn small teal" data-act="ok">Simpan</button></div>`, {
      dec: () => { g = Math.max(10, g - 5); $('#gv').textContent = g; },
      inc: () => { g = Math.min(1000, g + 5); $('#gv').textContent = g; },
      cancel: closeOv,
      ok: () => { set.goal = g; persist(true); closeOv(); after && after(); }
    }, true);
  }

  /* ---------- backup & restore ---------- */
  const isDay = k => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k);
  const totalSwings = () => Object.values(S.days).reduce((a, d) => a + (d.sw || 0), 0);
  function backupPayload() { return JSON.stringify({ app: 'paaadel', version: 1, exportedAt: new Date().toISOString(), data: S, replays: REPLAYS }); }
  function markBackup() { S.lastBackup = Date.now(); persist(true); const v = $('#bkLast'); if (v) v.textContent = lastBackupTxt(); }
  function lastBackupTxt() {
    if (!S.lastBackup) return 'Belum pernah';
    const d = new Date(S.lastBackup);
    return dayKey(d) === dayKey() ? 'Hari ini ' + z2(d.getHours()) + ':' + z2(d.getMinutes()) : fmtDate(d);
  }
  // must stay synchronous up to navigator.share (iOS needs the tap's user activation)
  function exportBackup() {
    const text = backupPayload(), name = `paaadel-backup-${dayKey()}.json`;
    let file = null; try { file = new File([text], name, { type: 'application/json' }); } catch (e) { /* very old browser */ }
    if (file && navigator.canShare && navigator.share) {
      let ok = false; try { ok = navigator.canShare({ files: [file] }); } catch (e) { ok = false; }
      if (ok) {
        navigator.share({ files: [file], title: 'Backup PAAADEL' })
          .then(() => { markBackup(); toast('Backup kesimpen'); })
          .catch(e => { if (!e || e.name !== 'AbortError') exportFallback(text, name, file); });
        return;
      }
    }
    exportFallback(text, name, file);
  }
  function exportFallback(text, name, file) {
    let tried = false;
    if (file) { try { const url = URL.createObjectURL(file); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000); tried = true; } catch (e) { /* blocked */ } }
    if (tried) markBackup();
    openOv(`<div class="shdr"><h2 class="title">Backup data</h2><button class="link" data-act="close">Tutup</button></div>
      <p class="sub">${tried ? `File <b>${name}</b> lagi diunduh. Cek folder Download, terus simpan di tempat aman: Google Drive, Files, atau kirim ke chat sendiri.` : 'Browser ini nggak bisa nyimpen file langsung.'}</p>
      <p class="sub">Kalau file-nya nggak muncul, salin kode backup ini dan simpan di catatan atau chat:</p>
      <button class="btn teal" data-act="copy">Salin kode backup</button>
      <textarea class="bk-text" id="bkOut" readonly hidden></textarea>
      <p class="note">${Math.max(1, Math.round(text.length / 1024))} KB · ${totalSwings()} ayunan · ${REPLAYS.length} replay</p>`, {
      close: closeOv,
      copy: () => {
        const show = () => { const t = curOv && curOv.querySelector('#bkOut'); if (t) { t.value = text; t.hidden = false; t.focus(); t.select(); } toast('Kodenya udah kepilih, tinggal salin'); };
        try { navigator.clipboard.writeText(text).then(() => { markBackup(); toast('Kode backup udah disalin'); }).catch(show); } catch (e) { show(); }
      }
    });
  }

  function sanitizeBackup(o) {
    if (!o || o.app !== 'paaadel' || !o.data || typeof o.data !== 'object') return null;
    const d = o.data, num = v => (typeof v === 'number' && isFinite(v) ? v : 0), str = (v, n) => String(v == null ? '' : v).slice(0, n);
    const days = {};
    if (d.days && typeof d.days === 'object') for (const [k, v] of Object.entries(d.days)) if (isDay(k) && v && typeof v === 'object') days[k] = { sw: Math.max(0, Math.round(num(v.sw))), best: Math.max(0, num(v.best)), sec: Math.max(0, num(v.sec)), sess: Math.max(0, Math.round(num(v.sess))) };
    const sessions = Array.isArray(d.sessions) ? d.sessions.filter(x => x && typeof x === 'object' && num(x.start) > 0).slice(-500).map(x => ({
      type: ['free', 'workout', 'analysis'].includes(x.type) ? x.type : 'free', name: x.name ? str(x.name, 40) : undefined, start: num(x.start), dur: Math.max(0, num(x.dur)),
      swings: Math.max(0, Math.round(num(x.swings))), best: Math.max(0, num(x.best)), avg: Math.max(0, num(x.avg)), cons: x.cons == null ? null : clamp(Math.round(num(x.cons)), 0, 100), completed: !!x.completed })) : [];
    const strokes = {}; if (d.strokes && typeof d.strokes === 'object') STROKE_ORDER.forEach(k => { const v = Math.round(num(d.strokes[k])); if (v > 0) strokes[k] = v; });
    const okBlock = b => b && typeof b === 'object' && (b.kind === 'rest' ? num(b.secs) > 0 : !!STROKES[b.stroke] && (num(b.reps) > 0 || num(b.secs) > 0));
    const workouts = Array.isArray(d.workouts) ? d.workouts.filter(w => w && typeof w.id === 'string' && /^u[a-z0-9]{1,20}$/.test(w.id) && Array.isArray(w.blocks) && w.blocks.length && w.blocks.length <= 60 && w.blocks.every(okBlock)).slice(0, 100).map(w => ({
      id: w.id, name: str(w.name || 'Program aku', 40),
      blocks: w.blocks.map(b => b.kind === 'rest' ? Rr(clamp(Math.round(num(b.secs)), 5, 600)) : num(b.secs) > 0 ? T(b.stroke, clamp(Math.round(num(b.secs)), 5, 600)) : P(b.stroke, clamp(Math.round(num(b.reps)), 1, 100))) })) : [];
    const rOk = r => r && typeof r === 'object' && typeof r.id === 'string' && STROKES[r.stroke] && [r.t, r.w, r.q].every(Array.isArray) && r.t.length >= 10 && r.t.length < 400 && r.w.length === r.t.length && r.q.length === r.t.length
      && r.t.every(Number.isFinite) && r.w.every(Number.isFinite) && r.q.every(q => Array.isArray(q) && q.length === 4 && q.every(Number.isFinite));
    const replays = Array.isArray(o.replays) ? o.replays.filter(rOk).slice(-60).map(r => ({ id: str(r.id, 24), date: num(r.date), stroke: r.stroke, hand: r.hand === 'L' ? 'L' : 'R', k: clamp(num(r.k) || 1, 0.5, 2), star: !!r.star, src: r.src === 'gyro' ? 'gyro' : 'ori', peak: Math.max(0, num(r.peak)), sat: !!r.sat, t: r.t, w: r.w, q: r.q })) : [];
    // settings: keep only known keys with sane values
    const bs = d.settings && typeof d.settings === 'object' ? d.settings : {}, settings = {};
    const ENUM = { soundKind: ['pop', 'crisp', 'whip', 'random'], coachLang: ['id', 'en'], unit: ['kmh', 'mph'], sens: Object.keys(SENS), hand: ['R', 'L'], theme: ['auto', 'light', 'dark'] };
    Object.keys(DEFAULTS).forEach(k => {
      const v = bs[k], dv = DEFAULTS[k];
      if (ENUM[k]) { if (ENUM[k].includes(v)) settings[k] = v; }
      else if (typeof dv === 'boolean' && typeof v === 'boolean') settings[k] = v;
      else if (typeof dv === 'number' && typeof v === 'number' && isFinite(v)) settings[k] = k === 'goal' ? clamp(Math.round(v), 10, 1000) : k === 'fine' ? clamp(v, 0.7, 1.5) : k === 'calib' ? clamp(v, 0.8, 1.3) : v;
    });
    if (bs.look && typeof bs.look === 'object') settings.look = Object.fromEntries(Object.keys(DEFAULTS.look).filter(k => typeof bs.look[k] === typeof DEFAULTS.look[k]).map(k => [k, typeof bs.look[k] === 'string' ? str(bs.look[k], 12) : bs.look[k]]));
    if (bs.zone && typeof bs.zone === 'object') settings.zone = { on: !!bs.zone.on, min: clamp(num(bs.zone.min) || 35, 10, 200), max: clamp(num(bs.zone.max) || 48, 12, 200), preset: str(bs.zone.preset, 10) };
    const best = { racket: Math.max(0, num(d.best && d.best.racket)), date: d.best && isDay(d.best.date) ? d.best.date : null };
    const keys = Object.keys(days).sort();
    return {
      exportedAt: typeof o.exportedAt === 'string' ? o.exportedAt : null, days, sessions, strokes, workouts, replays, settings, best,
      firstDay: isDay(d.firstDay) ? d.firstDay : keys[0] || null, workoutsDone: Math.max(0, Math.round(num(d.workoutsDone))), replaysMade: Math.max(0, Math.round(num(d.replaysMade)))
    };
  }
  function trimReplays(list) {
    list.sort((a, b) => a.date - b.date);
    while (list.length > 40) { const i = list.findIndex(r => !r.star); if (i < 0) break; list.splice(i, 1); }
    return list;
  }
  function applyBackup(c, mode) {
    if (mode === 'replace') {
      S.days = c.days; S.sessions = c.sessions; S.strokes = c.strokes; S.workouts = c.workouts; S.best = c.best;
      S.workoutsDone = c.workoutsDone; S.replaysMade = c.replaysMade; if (c.firstDay) S.firstDay = c.firstDay; else delete S.firstDay;
      Object.entries(c.settings).forEach(([k, v]) => { if (k === 'look' || k === 'zone') Object.assign(set[k], v); else set[k] = v; });
      REPLAYS = trimReplays(c.replays.slice());
    } else {
      for (const [k, v] of Object.entries(c.days)) { const cur = S.days[k]; S.days[k] = cur ? { sw: Math.max(cur.sw, v.sw), best: Math.max(cur.best, v.best), sec: Math.max(cur.sec, v.sec), sess: Math.max(cur.sess, v.sess) } : v; }
      const seen = new Set(S.sessions.map(x => x.type + x.start));
      c.sessions.forEach(x => { if (!seen.has(x.type + x.start)) S.sessions.push(x); });
      S.sessions.sort((a, b) => a.start - b.start); if (S.sessions.length > 500) S.sessions.splice(0, S.sessions.length - 500);
      Object.entries(c.strokes).forEach(([k, v]) => { S.strokes[k] = Math.max(S.strokes[k] || 0, v); });
      c.workouts.forEach(w => { if (!S.workouts.some(x => x.id === w.id)) S.workouts.push(w); });
      if (c.best.racket > (S.best.racket || 0)) S.best = c.best;
      S.workoutsDone = Math.max(S.workoutsDone, c.workoutsDone); S.replaysMade = Math.max(S.replaysMade, c.replaysMade);
      const firsts = [S.firstDay, c.firstDay].filter(Boolean).sort(); if (firsts.length) S.firstDay = firsts[0];
      const ids = new Set(REPLAYS.map(r => r.id)); REPLAYS = trimReplays(REPLAYS.concat(c.replays.filter(r => !ids.has(r.id))));
    }
    persist(true); persistReplays(); applyTheme(); Coach.pick();
    toast(mode === 'replace' ? 'Data udah dipulihin' : 'Backup udah digabungin');
    go('home');
  }
  function handleImport(text) {
    let o = null; try { o = JSON.parse(String(text || '').trim()); } catch (e) { o = null; }
    const c = sanitizeBackup(o);
    if (!c) { toast('Itu bukan file backup PAAADEL'); return; }
    const sw = Object.values(c.days).reduce((a, d) => a + d.sw, 0), nd = Object.keys(c.days).length;
    const when = c.exportedAt && !isNaN(Date.parse(c.exportedAt)) ? fmtDate(new Date(c.exportedAt)) : 'tanpa tanggal';
    dialog('Pulihkan backup ini?', `Backup ${when}: <b>${sw}</b> ayunan, <b>${nd}</b> hari latihan, <b>${c.replays.length}</b> replay, <b>${c.workouts.length}</b> program buatanmu.<br><br><b>Gabungin</b> = data di HP ini tetap ada, ditambah isi backup.<br><b>Timpa</b> = data di HP ini diganti total sama backup.`,
      [{ label: 'Gabungin', kind: 'teal', fn: () => applyBackup(c, 'merge') }, { label: 'Timpa', kind: 'danger', fn: () => applyBackup(c, 'replace') }]);
  }
  function restoreSheet() {
    const ov = openOv(`<div class="shdr"><h2 class="title">Pulihkan data</h2><button class="link" data-act="close">Tutup</button></div>
      <p class="sub">Pilih file backup PAAADEL (.json) dari Files, Drive, atau Download. Bisa juga tempel kode backup.</p>
      <label class="btn teal" for="bkFile">${ICON.upload}Pilih file backup</label>
      <input type="file" id="bkFile" accept=".json,application/json,text/plain" class="vh">
      <span class="label">Atau tempel kode backup</span>
      <textarea class="bk-text" id="bkIn" placeholder='{"app":"paaadel", …}' spellcheck="false"></textarea>
      <button class="btn line" data-act="useText">Pulihkan dari kode</button>`, {
      close: closeOv,
      useText: () => { const v = ov.querySelector('#bkIn').value; if (!v.trim()) return toast('Tempel kode backup-nya dulu'); handleImport(v); }
    });
    ov.querySelector('#bkFile').addEventListener('change', e => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      if (f.size > 8 * 1024 * 1024) { toast('File-nya kegedean buat backup PAAADEL'); return; }
      const rd = new FileReader(); rd.onload = () => handleImport(rd.result); rd.onerror = () => toast('File-nya nggak bisa dibaca'); rd.readAsText(f);
    });
  }
  const needsBackupNudge = () => !PREVIEW && totalSwings() >= 100 && (!S.lastBackup || Date.now() - S.lastBackup > 14 * 864e5) && (!S.backupSnooze || Date.now() - S.backupSnooze > 14 * 864e5);

  /* ---------- settings ---------- */
  SCREENS.settings = function () {
    const soundNames = { pop: 'Pok padel', crisp: 'Klik nyaring', whip: 'Lecutan', random: 'Acak' };
    const seg = (act, cur, opts, minw = 150) => `<div class="seg compact" style="min-width:${minw}px">${opts.map(([k, l]) => `<button data-act="${act}" data-k="${k}" aria-pressed="${cur === k}">${l}</button>`).join('')}</div>`;
    app.innerHTML = `<section class="scr">
      ${subhdr('Pengaturan')}
      <span class="label section">Target harian</span>
      <div class="list"><div class="row"><span class="k">${ICON.target}Ayunan per hari</span><div class="stepper"><button data-act="gdec" aria-label="Kurangin">${ICON.minus}</button><output id="goalV">${set.goal}</output><button data-act="ginc" aria-label="Tambahin">${ICON.plus}</button></div></div></div>
      <p class="note">Target di beranda penuh setelah jumlah ini (dari latihan bebas & program).</p>

      <span class="label section">Suara & getar</span>
      <div class="list">
        <div class="row"><span class="k">${ICON.spk}Bunyi pukulan</span>${switchBtn('t-sound', set.sound, 'Bunyi pukulan')}</div>
        <button class="row" data-act="soundPick"><span class="k">${ICON.wave}Jenis bunyi</span><span class="vs">${soundNames[set.soundKind]} ${ICON.chev}</span></button>
        <div class="row"><span class="k">${ICON.gauge}Volume ngikut kecepatan</span>${switchBtn('t-dynamic', set.dynamic, 'Volume ngikut kecepatan')}</div>
        <div class="row"><span class="k">${ICON.sensor}Getar pas kena</span>${switchBtn('t-vibrate', set.vibrate, 'Getar pas kena')}</div>
      </div>
      <p class="note">Matiin bunyi kalau mau latihan senyap. Getar cuma jalan di Android, iPhone nggak ngizinin dari web app. Di iPhone, pastiin volume nyala ya.</p>

      <span class="label section">Coach</span>
      <div class="list">
        <div class="row"><span class="k">${ICON.spk}Suara coach di program</span>${switchBtn('t-coach', set.coach, 'Suara coach')}</div>
        <div class="row"><span class="k">Bahasa coach</span>${seg('lang', set.coachLang, [['id', 'Indonesia'], ['en', 'English']], 180)}</div>
        <button class="row" data-act="testVoice"><span class="k">Tes suara coach</span><span class="vs">${ICON.play}</span></button>
      </div>

      <span class="label section">Ayunan</span>
      <div class="list">
        <div class="row"><span class="k">${ICON.hand}Tangan dominan</span>${seg('hand', set.hand, [['R', 'Kanan'], ['L', 'Kiri']])}</div>
        <button class="row" data-act="sens"><span class="k">${ICON.sliders}Sensitivitas</span><span class="vs" id="sensV">${SENS[set.sens].label} ${ICON.chev}</span></button>
        <div class="row"><span class="k">${ICON.lock}Kunci layar pas ngayun</span>${switchBtn('t-autolock', set.autolock, 'Kunci layar pas ngayun')}</div>
        <div class="row" style="flex-direction:column;align-items:stretch;gap:6px"><span class="k" style="justify-content:space-between">Kalibrasi kecepatan <b class="num" id="calV">×${set.calib.toFixed(2)}</b></span><input type="range" id="calib" min="0.8" max="1.3" step="0.01" value="${set.calib}" aria-label="Kalibrasi kecepatan"></div>
      </div>
      <p class="note">Kunci layar bikin telapak tangan nggak sengaja mencet tombol pas HP digenggam; tahan ikon gembok buat buka. Kalibrasi ngegeser semua angka kecepatan berikutnya, misalnya kalau kamu pernah diukur pakai radar.</p>

      <span class="label section">Tampilan</span>
      <div class="list">
        <div class="row"><span class="k">${ICON.gauge}Satuan kecepatan</span>${seg('unit', set.unit, [['kmh', 'km/h'], ['mph', 'mph']])}</div>
        <div class="row"><span class="k">${ICON.moon}Tema</span>${seg('theme', set.theme, [['auto', 'Auto'], ['light', 'Terang'], ['dark', 'Gelap']], 190)}</div>
      </div>

      <span class="label section">Bantuan</span>
      <div class="list">
        <button class="row" data-act="howto"><span class="k">${ICON.hand}Cara pegang HP</span><span class="vs">${ICON.chev}</span></button>
        <button class="row" data-act="howspeed"><span class="k">${ICON.info}Gimana kecepatan diukur</span><span class="vs">${ICON.chev}</span></button>
        <button class="row" data-act="sensor"><span class="k">${ICON.sensor}Tes sensor</span><span class="vs">${ICON.chev}</span></button>
      </div>

      <span class="label section">Backup & data</span>
      <div class="list">
        <button class="row" data-act="backup"><span class="k">${ICON.download}Simpan backup</span><span class="vs"><span id="bkLast">${lastBackupTxt()}</span>${ICON.chev}</span></button>
        <button class="row" data-act="restore"><span class="k">${ICON.upload}Pulihkan dari backup</span><span class="vs">${ICON.chev}</span></button>
        <button class="row" data-act="wipe"><span class="k" style="color:var(--danger)">${ICON.trash}Hapus semua data latihan</span></button>
      </div>
      <p class="note">Data PAAADEL cuma disimpen di HP ini. Simpan backup ke Files, Google Drive, atau kirim ke chat sendiri biar progres aman kalau ganti HP. Tips: pasang PAAADEL ke Layar Utama biar datanya lebih awet.</p>
      <p class="note center">PAAADEL ${VERSION} · semua data cuma disimpen di HP ini.</p>
    </section>`;
    const tog = key => b => { set[key] = !set[key]; b.setAttribute('aria-checked', set[key]); persist(); if (key === 'sound' && set.sound) Snd.hit(0.8); };
    const segAct = (key, after) => b => { set[key] = b.dataset.k; persist(); b.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.dataset.k === set[key])); after && after(); };
    const cal = $('#calib'); const calUpd = () => cal.style.setProperty('--p', ((set.calib - 0.8) / 0.5 * 100) + '%'); calUpd();
    bindInputs(app, { calib: el => { set.calib = Math.round(+el.value * 100) / 100; $('#calV').textContent = '×' + set.calib.toFixed(2); calUpd(); persist(); } });
    actions = {
      back: () => go('home'),
      gdec: () => { set.goal = Math.max(10, set.goal - 5); $('#goalV').textContent = set.goal; persist(); },
      ginc: () => { set.goal = Math.min(1000, set.goal + 5); $('#goalV').textContent = set.goal; persist(); },
      't-sound': tog('sound'), 't-dynamic': tog('dynamic'), 't-vibrate': tog('vibrate'), 't-coach': tog('coach'), 't-autolock': tog('autolock'),
      soundPick: () => soundSheet(),
      sens: () => sensSheet(() => { $('#sensV').innerHTML = SENS[set.sens].label + ' ' + ICON.chev; }),
      lang: segAct('coachLang', () => Coach.pick()),
      testVoice: () => { Coach.pick(); Coach.say('Forehand, sepuluh kali. Gas!', 'Forehand, ten reps. Go!', true); },
      hand: segAct('hand'), unit: segAct('unit'), theme: segAct('theme', applyTheme),
      howto: () => go('howto', { from: 'settings' }), howspeed: helpSpeed,
      backup: exportBackup, restore: restoreSheet,
      sensor: () => startWith(() => go('sensor')),
      wipe: () => dialog('Hapus semua data?', 'Statistik, rekor, program buatanmu, dan replay di HP ini bakal hilang. Pengaturan tetap.', [{ label: 'Batal' }, {
        label: 'Hapus', kind: 'danger', fn: () => {
          S.days = {}; S.sessions = []; S.strokes = {};
          S.best = { racket: 0, date: null }; S.workouts = []; S.workoutsDone = 0; S.replaysMade = 0; delete S.firstDay;
          REPLAYS = []; persistReplays(); persist(true); toast('Data latihan udah dihapus'); go('home');
        }
      }])
    };
    function soundSheet() {
      openOv(`<div class="shdr"><h2 class="title">Jenis bunyi</h2><button class="link" data-act="close">Oke</button></div>
        <div class="list">${Object.entries(soundNames).map(([k, l]) => `<button class="row" data-act="pick" data-k="${k}"><span class="k">${l}</span><span class="vs" style="color:var(--teal)">${set.soundKind === k ? ICON.check : ''}</span></button>`).join('')}</div>
        <p class="note">Tap buat dengerin. "Pok padel" niru bunyi bola padel di raket busa berlubang.</p>`, {
        close: () => { closeOv(); go('settings'); },
        pick: b => { set.soundKind = b.dataset.k; persist(); Snd.hit(0.85); b.closest('.list').querySelectorAll('[data-act="pick"]').forEach(x => { x.querySelector('.vs').innerHTML = x.dataset.k === set.soundKind ? ICON.check : ''; }); }
      });
    }
  };

  function helpSpeed() {
    const lim = Math.round(racketKmh(GYRO_MAX));
    openOv(`<div class="shdr"><h2 class="title">Gimana kecepatan diukur?</h2><button class="link" data-act="close">Tutup</button></div>
      <div class="prose">
        <p>Giroskop di HP ngukur seberapa cepat HP berputar, 60–200 kali per detik. Pas HP kamu pegang kayak gagang raket, putaran HP = putaran raket.</p>
        <p><b>Kecepatan raket</b> = kecepatan putar × tuas ${String(LEVER).replace('.', ',')} m, kira-kira jarak dari poros putaran ke sweet spot raket padel.</p>
        <p><b>Kecepatan bola ≈</b> kecepatan raket × ${String(BALL_RATIO).replace('.', ',')}. Ini perkiraan buat bola yang kena pas di sweet spot, makanya selalu pakai tanda ≈.</p>
        <p>Kebanyakan giroskop HP mentok di sekitar 2000°/detik, setara ≈${lim} km/h raket. Kalau lewat, angkanya ditandai "≥".</p>
        <p>Angka ini paling pas buat bandingin progres kamu sendiri dari hari ke hari, bukan pengganti radar. Pernah diukur pakai radar? Samain lewat Kalibrasi kecepatan di Pengaturan.</p>
      </div>`, { close: closeOv });
  }

  /* ---------- sensor test ---------- */
  SCREENS.sensor = function () {
    app.innerHTML = `<section class="scr">
      ${subhdr('Tes sensor')}
      <p class="sub center" id="sStat"></p>
      <div class="card" style="padding:12px 12px 16px">
        <div class="gauge-wrap">${gaugeSVG()}<div class="gauge-num"><div class="n"><span id="sR">0</span></div><span class="u">${U()} raket (live)</span><span class="r"><b id="sW">0</b> °/detik</span></div></div>
      </div>
      <div class="list">
        <div class="row"><span class="k">${ICON.boltL}Raket tercepat</span><span class="v or" id="sM">0</span></div>
        <div class="row"><span class="k">${ICON.swing}Ayunan kedeteksi</span><span class="v" id="sN">0</span></div>
        <div class="row"><span class="k">${ICON.sensor}Orientasi α / β / γ</span><span class="vs num" id="sO">–</span></div>
      </div>
      <p class="note">Ayunin HP pelan, terus kencang. Bunyi = ayunan kehitung dengan sensitivitas sekarang (garis di speedometer). Kalau angkanya diam aja, sensor nggak kebaca di browser ini.</p>
      <div class="grow"></div>
      ${simBtn()}
      <button class="btn line" data-act="reset">Reset angka</button>
    </section>`;
    let mx = 0, n = 0, curW = 0, raf = 0;
    gaugeTh();
    const live = $('#gLive');
    const det = new Detector(thr, pk => Snd.hit(pk / 22), pk => { n++; $('#sN').textContent = n; gaugeLast(ballOf(racketKmh(pk))); });
    const unsub = Motion.sub(s => { det.feed(s); curW = Math.max(curW, s.w); mx = Math.max(mx, racketKmh(s.w)); });
    const loop = () => {
      const c = curW; curW *= 0.85;
      $('#sW').textContent = Math.round(c / DEG); $('#sR').textContent = fv(racketKmh(c)); $('#sM').textContent = fv(mx) + ' ' + U();
      const pc = clamp(ballOf(racketKmh(c)) / GMAX * 100, 0, 100); live.setAttribute('stroke-dasharray', `${pc.toFixed(1)} 100`); live.style.opacity = pc < 1.5 ? 0 : 1;
      const o = Motion.lastOri(); $('#sO').textContent = o ? `${Math.round(o.a)}° / ${Math.round(o.b)}° / ${Math.round(o.g)}°` : (Motion.isSim() ? 'simulasi' : '–');
      $('#sStat').textContent = Motion.isSim() ? 'Mode simulasi: sensor gerak nggak ketemu di perangkat ini.' : `Giroskop aktif · ${Math.round(Motion.rate())} Hz`;
      raf = requestAnimationFrame(loop);
    };
    loop(); Wake.on();
    cleanup = () => { unsub(); cancelAnimationFrame(raf); Wake.off(); };
    actions = { back: () => go('settings'), reset: () => { mx = 0; n = 0; $('#sN').textContent = 0; const g = $('#gLast'); if (g) g.setAttribute('visibility', 'hidden'); }, sim: () => Motion.simSwing() };
  };

  /* example data for the design preview (labelled there) */
  function seedExample() {
    const today = new Date(); today.setHours(12, 0, 0, 0); let first = null, best = 0;
    for (let i = 48; i >= 1; i--) {
      if (Math.random() < 0.42) continue;
      const d = new Date(today); d.setDate(d.getDate() - i); const k = dayKey(d);
      const sw = Math.round(12 + Math.random() * 38), b = Math.round((33 + (48 - i) * 0.32 + Math.random() * 5) * 10) / 10;
      S.days[k] = { sw, best: b, sec: sw * 9, sess: 1 }; first = first || k; best = Math.max(best, b);
      S.sessions.push({ type: 'free', start: d.getTime(), dur: sw * 9, swings: sw, best: b, avg: b * 0.86, cons: Math.round(55 + Math.random() * 35) });
    }
    S.strokes = { FH: 124, BH: 86, VL: 98, BJ: 41, SM: 23, VB: 16, LB: 19 };
    S.workoutsDone = 6; S.replaysMade = 4; S.firstDay = first; S.best = { racket: best, date: null };
    persist(true); toast('Data contoh udah diisi'); go('home');
  }

  /* ===================== boot ===================== */
  go('home');
  if (!PREVIEW && navigator.storage && navigator.storage.persist) { try { navigator.storage.persist().catch(() => {}); } catch (e) { /* not supported */ } }
  if (!PREVIEW && 'serviceWorker' in navigator && location.protocol === 'https:') {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { /* offline cache optional */ }));
  }
  window.__pala = { Motion, S, go, REPLAYS: () => REPLAYS };
})();
