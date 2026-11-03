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
  const VERSION = '1.3';
  const LEVER = 0.62;          // m — gyro-only fallback: rotation centre to racket sweet spot (effective)
  const R_HEAD = 0.32;         // m — hand (phone) to the centre of the racket head
  const BALL_RATIO = 1.35;     // padel ball off the sweet spot vs racket-head speed
  const GYRO_MAX = 34.4;       // rad/s (~1970 °/s) — most phone gyros clip at 2000 °/s
  const GMAX = 100;            // gauge full scale, km/h ball
  const SENS = {
    light: { label: 'Santai', w: 5.5 },
    medium: { label: 'Sedang', w: 8 },
    full: { label: 'Kenceng', w: 11 }
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
    autolock: true, seenHowTo: false, theme: 'auto', axis: null, zone: { on: false, min: 35, max: 48, preset: 'kontrol' },
    look: { racket: 'classic', ribbon: true, ghosts: true, ghostDensity: 'normal', peak: true, dots: true, arrow: false }
  };
  function load(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  const S = load(KEY, null) || {};
  const prevLook = (S.settings && S.settings.look) || {}, prevZone = (S.settings && S.settings.zone) || {};
  S.settings = Object.assign({}, DEFAULTS, S.settings || {});
  S.settings.look = Object.assign({}, DEFAULTS.look, prevLook);
  if ('ribbonWidth' in prevLook) { S.settings.look.dots = true; delete S.settings.look.ribbonWidth; delete S.settings.look.ribbonColor; } // 1.0 → 1.1 replay look
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
  const FACE = { FH: [0, 20], BH: [0, 20], VL: [5, 25], BJ: [10, 35], VB: [0, 20], SM: [-15, 10], LB: [25, 55], SV: [0, 25] };

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
    conj(q) { return [-q[0], -q[1], -q[2], q[3]]; },
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

  const V3 = {
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    add: (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k],
    scale: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
    len: a => Math.hypot(a[0], a[1], a[2])
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
  /* Device frame: x across the screen, y along the phone (= racket axis, top = tip), z out of the screen (= forehand face).
     The racket head (on +y) moves with ω × y = (−ωz, 0, ωx): a forehand drives it towards +z (screen leading), a backhand
     towards −z (back of the phone leading); a wrist twist is ωy and does not move the head.
     rotationRate axis naming differs between engines (W3C: x=beta, y=gamma, z=alpha; WebKit/iOS reports x=alpha, y=beta,
     z=gamma), so the mapping is learned by comparing the gyro with the rotation seen in the orientation stream.
     Linear acceleration (device frame) is kept for the hand-speed part; its sign convention is checked against gravity. */
  const PERMS = [[1, 2, 0], [0, 1, 2], [0, 2, 1], [1, 0, 2], [2, 0, 1], [2, 1, 0]];
  const AXMAPS = [];
  PERMS.forEach(p => { for (let sb = 0; sb < 8; sb++) AXMAPS.push({ p, s: [sb & 1 ? -1 : 1, sb & 2 ? -1 : 1, sb & 4 ? -1 : 1] }); });
  const mapRaw = (i, r) => { const m = AXMAPS[i]; return [m.s[0] * r[m.p[0]], m.s[1] * r[m.p[1]], m.s[2] * r[m.p[2]]]; };
  const IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const DEFAULT_MAP = IS_IOS ? 8 : 0; // 8 = WebKit (x=alpha, y=beta, z=gamma), 0 = W3C
  const Motion = (() => {
    const subs = new Set(), buf = [], obuf = [];
    let ok = false, sim = false, listening = false, nEv = 0, firstCb = null, lastT = 0, rate = 0, lastOriE = null;
    const ua = navigator.userAgent.slice(0, 90);
    let mapIdx = DEFAULT_MAP, locked = false, oriW = null, prevOri = null, gAcc = [0, 0, 0], gN = 0;
    const cal = { err: new Float64Array(AXMAPS.length), n: 0, mag: 0 };
    if (set.axis && set.axis.ua === ua && AXMAPS[set.axis.i]) { mapIdx = set.axis.i; locked = true; }
    // accelerometer sign: spec says a phone lying screen-up reads +9.81 on z (including gravity); some engines flip it
    let aSign = set.accSign && set.accSign.ua === ua ? set.accSign.s : 1, aSum = 0, aN = set.accSign && set.accSign.ua === ua ? 99 : 0;
    let raw = null; // raw event log for the sensor page export
    function recalibrate() { cal.err.fill(0); cal.n = 0; cal.mag = 0; locked = false; mapIdx = DEFAULT_MAP; set.axis = null; aSum = 0; aN = 0; set.accSign = null; persist(true); }
    function emit(s) {
      buf.push(s); const cut = s.t - 6000; while (buf.length && buf[0].t < cut) buf.shift();
      lastT = s.t; subs.forEach(f => { try { f(s); } catch (e) { console.error(e); } });
    }
    // s.perp = rotation that moves the racket head (rad/s); s.h kept for old callers; s.acc = linear acceleration (m/s², device frame) or null
    function emitDev(t, v, mag, sat, acc = null) { emit({ t, w: mag, wx: v[0], wy: v[1], wz: v[2], h: v[0], perp: Math.hypot(v[0], v[2]), sat, acc }); }
    function pushOri(t, q) { obuf.push({ t, q }); const cut = t - 6000; while (obuf.length && obuf[0].t < cut) obuf.shift(); }
    const v3 = o => o && o.x != null && isFinite(o.x) ? [+o.x || 0, +o.y || 0, +o.z || 0] : null;
    function onMotion(e) {
      const r = e.rotationRate; if (!r || (r.alpha == null && r.beta == null && r.gamma == null)) return;
      const t = now(); nEv++;
      if (lastT && !sim) { const dt = t - lastT; if (dt > 0 && dt < 250) rate = rate ? rate * 0.95 + (1000 / dt) * 0.05 : 1000 / dt; }
      if (firstCb) { const f = firstCb; firstCb = null; f(); }
      if (sim) return;
      const rw = [(+r.alpha || 0) * DEG, (+r.beta || 0) * DEG, (+r.gamma || 0) * DEG];
      gAcc[0] += rw[0]; gAcc[1] += rw[1]; gAcc[2] += rw[2]; gN++;
      // until the axis map is confirmed: direction from the orientation stream, size always from the gyro
      // (an orientation glitch can then never create a fake fast swing)
      const mag = Math.hypot(rw[0], rw[1], rw[2]);
      let v = mapRaw(mapIdx, rw);
      if (!locked && oriW && t - oriW.t < 80) { const om = Math.hypot(oriW.v[0], oriW.v[1], oriW.v[2]); if (om > 0.05 && om < 2 * mag + 2) v = oriW.v.map(c => c / om * mag); }
      // acceleration
      const lin = v3(e.acceleration), aig = v3(e.accelerationIncludingGravity);
      if (aig && prevOri && aN < 40 && mag < 0.6) { // nearly still: gravity must point along "up"
        const m = Math.hypot(aig[0], aig[1], aig[2]);
        if (Math.abs(m - 9.81) < 1.5) {
          const up = Q.rot(Q.conj(prevOri.q), [0, 0, 1]); aSum += (aig[0] * up[0] + aig[1] * up[1] + aig[2] * up[2]) / m; aN++;
          if (aN >= 15) { aSign = aSum >= 0 ? 1 : -1; if (aN === 39) { set.accSign = { s: aSign, ua }; persist(); } }
        }
      }
      let acc = lin ? lin.map(c => c * aSign) : null;
      if (!acc && aig && prevOri && aN >= 15) { const up = Q.rot(Q.conj(prevOri.q), [0, 0, 1]); acc = aig.map((c, i) => c * aSign - 9.81 * up[i]); }
      if (raw && raw.ev.length < 4000) raw.ev.push([Math.round(t), r.alpha, r.beta, r.gamma, lin && lin[0], lin && lin[1], lin && lin[2], aig && aig[0], aig && aig[1], aig && aig[2], e.interval]);
      emitDev(t, v, mag, Math.max(Math.abs(rw[0]), Math.abs(rw[1]), Math.abs(rw[2])) >= GYRO_MAX, acc);
    }
    function onOri(e) {
      if (sim || (e.beta == null && e.gamma == null)) return;
      const t = now();
      lastOriE = { a: e.alpha || 0, b: e.beta || 0, g: e.gamma || 0 };
      if (raw && raw.ori.length < 4000) raw.ori.push([Math.round(t), e.alpha, e.beta, e.gamma, e.absolute ? 1 : 0]);
      const q = Q.euler(lastOriE.a, lastOriE.b, lastOriE.g);
      if (prevOri) {
        const dt = (t - prevOri.t) / 1000;
        if (dt > 0.004 && dt < 0.08) {
          let d = Q.mul(Q.conj(prevOri.q), q); if (d[3] < 0) d = d.map(c => -c);
          const sh = Math.hypot(d[0], d[1], d[2]), ang = 2 * Math.atan2(sh, d[3]);
          const v = sh > 1e-9 ? [d[0] / sh * ang / dt, d[1] / sh * ang / dt, d[2] / sh * ang / dt] : [0, 0, 0];
          oriW = { t, v };
          if (!locked && gN) calibrate([gAcc[0] / gN, gAcc[1] / gN, gAcc[2] / gN], v);
        }
      }
      gAcc = [0, 0, 0]; gN = 0;
      prevOri = { t, q }; pushOri(t, q);
    }
    function calibrate(g, v) {
      const m = Math.hypot(v[0], v[1], v[2]), gm = Math.hypot(g[0], g[1], g[2]);
      if (m < 1 || m > 20 || Math.abs(m - gm) > 0.6 * Math.max(m, gm) + 0.5) return; // skip glitches
      for (let i = 0; i < AXMAPS.length; i++) { const u = mapRaw(i, g); cal.err[i] += (u[0] - v[0]) ** 2 + (u[1] - v[1]) ** 2 + (u[2] - v[2]) ** 2; }
      cal.n++; cal.mag += m * m;
      if (cal.n < 40) return;
      let b = 0; for (let i = 1; i < AXMAPS.length; i++) if (cal.err[i] < cal.err[b]) b = i;
      // the closest rival that disagrees on what matters (forward axis + its sign, or the sideways axis)
      const B = AXMAPS[b]; let r = -1;
      for (let i = 0; i < AXMAPS.length; i++) { const A = AXMAPS[i]; if (A.p[0] === B.p[0] && A.s[0] === B.s[0] && A.p[2] === B.p[2]) continue; if (r < 0 || cal.err[i] < cal.err[r]) r = i; }
      if ((cal.err[b] < 0.3 * cal.err[r] && cal.err[b] / cal.mag < 0.35) || cal.n >= 500) { mapIdx = b; locked = true; set.axis = { i: b, ua }; persist(true); }
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
    let simH = null, simTh = -1.9, simTl = 0.35, simPrevT = 0, simRec = null;
    function startSim() {
      if (simTimer) return;
      rate = 60;
      simTimer = setInterval(() => {
        const t = now(), dt = simPrevT ? clamp((t - simPrevT) / 1000, 0.004, 0.05) : 0.016; simPrevT = t;
        let theta = simTh, tilt = simTl, S1 = 0;
        if (simSw) {
          const u = (t - simSw.t0) / 1000 - 0.5;
          if (u > 0.9) { simSw = null; simRec = { t0: t, th: simTh, tl: simTl }; }
          else {
            S1 = 1 / (1 + Math.exp(-u / simSw.tau));
            const bk = 0.35 * Math.exp(-Math.pow((u + 0.32) / 0.13, 2)); // small backswing before the stroke
            const fade = Math.max(0, 1 - (u + 0.5) / 0.4); // start from wherever the racket was
            theta = -1.9 + simSw.D * S1 - bk + (simSw.th0 + 1.9) * fade; tilt = -0.2 - 0.6 * S1 + 1.6 * S1 * S1 + (simSw.tl0 + 0.2) * fade; // head dips, then low-to-high
          }
        }
        if (!simSw && simRec) { // easy way back to the ready position (~1.2 s)
          const f = clamp((t - simRec.t0) / 1200, 0, 1), e = (1 - Math.cos(Math.PI * f)) / 2;
          theta = simRec.th + (-1.9 - simRec.th) * e; tilt = simRec.tl + (0.35 - simRec.tl) * e; if (f >= 1) simRec = null;
        }
        const hx = (theta - simTh) / dt + (Math.random() - 0.5) * 0.3; simTh = theta; simTl = tilt;
        const q = poseQ(theta, tilt, simSw ? simSw.face : 0.15);
        pushOri(t, q);
        // the hand travels round the body just behind the racket; its acceleration feeds the hand-speed part
        const ph = theta - 0.3, Hp = [0.48 * Math.cos(ph), 0.48 * Math.sin(ph), 1.0 + 0.25 * (S1 - 0.5) * (simSw ? 1 : 0)];
        let acc = [0, 0, 0];
        if (simH) {
          const v = Hp.map((c, i) => (c - simH.p[i]) / dt), a = simH.v ? v.map((c, i) => (c - simH.v[i]) / dt) : [0, 0, 0];
          acc = Q.rot(Q.conj(q), a).map(c => c + (Math.random() - 0.5) * 0.08); simH = { p: Hp, v };
        } else simH = { p: Hp, v: null };
        emitDev(t, [hx, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3], Math.abs(hx) + 0.1, false, acc);
      }, 16);
    }
    function simSwing(power) {
      if (!sim) return;
      const D = 4.1 + Math.random() * 0.4, peak = power || (11.5 + Math.random() * 6);
      simSw = { t0: now(), D, tau: D / (4 * peak), face: (Math.random() * 12 + 2) * DEG, th0: simTh, tl0: simTl }; simRec = null;
    }
    return {
      ensure, sub, samples, oriAt, currentQ, simSwing, recalibrate,
      rawStart() { raw = { ev: [], ori: [], t0: now() }; },
      rawStop() { const r = raw; raw = null; return r && { app: 'paaadel', kind: 'sensor-log', version: VERSION, ua: navigator.userAgent, ios: IS_IOS, map: mapIdx, locked, accSign: aSign, accChecks: aN, cols: { ev: 't,alpha,beta,gamma,ax,ay,az,gx,gy,gz,interval', ori: 't,alpha,beta,gamma,absolute' }, ev: r.ev, ori: r.ori }; },
      rawCount: () => raw ? raw.ev.length : 0,
      accStatus: () => ({ sign: aSign, n: aN, has: buf.length ? !!buf[buf.length - 1].acc : null }),
      calStatus: () => ({ locked: sim || locked, n: cal.n, map: mapIdx }),
      isSim: () => sim, isOn: () => ok || sim, rate: () => rate, lastT: () => lastT, lastOri: () => lastOriE, events: () => nEv
    };
  })();

  /* ===================== swing detection ===================== */
  /* Works on the racket-head rotation (perp = |ω × y|), so a forehand (screen leading) and a backhand (back leading)
     count the same way.
     - a "push" = the racket head moving one way; it ends when the head slows down or turns back
     - a push counts when it is fast enough (sensitivity), turns the head through a real angle (not a flick) and is not
       mostly a wrist twist
     - take-back vs stroke: a take-back is followed by a stronger push the other way. A stroke that comes straight out of
       a weaker opposite push (take-back → swing) counts at once; a lone push waits ~0.2–0.4 s to see what follows.
     - after a few strokes the detector knows which way "forward" is (towards the net) and ignores pushes going
       backwards or with the racket pointing backwards — take-backs, an overhead's drop behind the back, the way back to
       the ready position — even with a pause before the swing. Only fairly level head travel teaches "forward"; the drop
       of a smash moves mostly up/down, so it never does.
     - overheads (bandeja, víbora, smash = racket head well above the hand at the fastest moment) allow the forearm roll
       of a víbora, ignore the racket being lifted into position, and an arm-driven bandeja counts on its racket-head
       speed (hand + whip) even when the racket itself turns slowly. */
  const MIN_SWEEP = { light: 18, medium: 28, full: 38 }; // degrees the racket head turns in one push
  const sweepMin = () => MIN_SWEEP[set.sens] * set.fine * DEG;
  const LOBE_ON = 1.5, LOBE_OFF = 0.6; // rad/s
  const OVER_ELEV = 25 * DEG;          // racket axis above horizontal at the fastest moment = overhead
  // horizontal (earth) direction the racket head travels at this sample, or null when mostly vertical / unknown
  function headHeading(s) {
    const q = Motion.oriAt(s.t); if (!q) return null;
    const v = Q.rot(q, [-s.wz, 0, s.wx]), hz = Math.hypot(v[0], v[1]);
    return hz > 0.5 && hz > 0.6 * Math.hypot(v[0], v[1], v[2]) ? [v[0] / hz, v[1] / hz] : null;
  }
  // at the fastest moment of a push: racket elevation, how much the head moves up (−1…1), where the racket points (flat)
  function lobeGeo(L) {
    if (L.geoT === L.peakT) return L.geo;
    const s = L.peakS, q = Motion.oriAt(s.t); L.geoT = L.peakT;
    if (!q) return (L.geo = null);
    const d = Q.rot(q, [0, 1, 0]), v = Q.rot(q, [-s.wz, 0, s.wx]), vm = Math.hypot(v[0], v[1], v[2]) || 1, dh = Math.hypot(d[0], d[1]);
    return (L.geo = { elev: Math.asin(clamp(d[2], -1, 1)), up: v[2] / vm, dir: dh > 0.3 ? [d[0] / dh, d[1] / dh] : null });
  }
  const pw = L => (L.sp ? L.sp.kmh : racketKmh(L.peak)); // strength of a push for take-back comparisons (km/h)
  class Detector {
    // o: { getT() → threshold rad/s, over → this drill is an overhead (bool or fn), onStroke(push), onReject(why, push),
    //      onLobe(push) — every fast push, counted or not, onUpgrade(old, push) — the counted push was only the
    //      take-back / drop of this stronger one: same count, take this one's numbers }
    constructor(o) { Object.assign(this, o); this.L = null; this.prev = null; this.cand = null; this.lastF = null; this.lastFire = -1e9; this.lastT = 0; this.fwd = [0, 0]; this.fwdW = 0; this.backN = 0; this.backT = 0; }
    hint() { return typeof this.over === 'function' ? !!this.over() : !!this.over; }
    opp(a, b) { return a.dx * b.dx + a.dz * b.dz < -0.3; }
    fwdDir() {
      if (this.fwdW < 1.8) return null;
      const m = Math.hypot(this.fwd[0], this.fwd[1]); return m < 0.6 * this.fwdW ? null : [this.fwd[0] / m, this.fwd[1] / m];
    }
    fwdScore(h) { const F = this.fwdDir(); return h && F ? h[0] * F[0] + h[1] * F[1] : null; }
    isOver(L) { const g = lobeGeo(L); return this.hint() ? !g || g.elev > 10 * DEG : !!g && g.elev > OVER_ELEV; }
    twistOk(L) { return L.twist <= (this.isOver(L) ? 3 : 1.5) * L.sweep; }
    // head moving mostly up/down (so its heading says nothing) with the racket pointing backwards: an overhead's drop
    pointsBack(L) { const g = lobeGeo(L), F = this.fwdDir(); return !!(g && g.dir && F && Math.abs(g.up) > 0.5 && g.elev < OVER_ELEV && g.dir[0] * F[0] + g.dir[1] * F[1] < -0.7); }
    feed(s) {
      const t = s.t, dt = this.lastT ? clamp((t - this.lastT) / 1000, 0, 0.05) : 0; this.lastT = t;
      const p = s.perp, vx = -s.wz, vz = s.wx;
      let L = this.L;
      if (L && (p < LOBE_OFF || (p > LOBE_ON && vx * L.dx + vz * L.dz < -0.3 * p))) { this.close(t); L = null; }
      if (!L && p > LOBE_ON) L = this.L = { t0: t, t1: t, peak: p, peakT: t, peakS: s, dx: vx / p, dz: vz / p, sweep: 0, twist: 0, past: false, prev: this.prev, sat: false };
      if (L) {
        L.sweep += p * dt; L.twist += Math.abs(s.wy) * dt; L.t1 = t; if (s.sat) L.sat = true;
        if (p > L.peak) { L.peak = p; L.peakT = t; L.peakS = s; L.dx = vx / p; L.dz = vz / p; }
        if (!L.past && L.peak >= this.getT() && p < 0.85 * L.peak) { L.past = true; this.atPeak(L); }
      }
      const c = this.cand;
      if (c && t >= c.due) {
        const o = this.L; // a push the other way is still building: let it finish first
        if (!(o && o !== c && this.opp(c, o) && o.t0 - c.t1 < 600 && o.peak > 0.5 * c.peak && t - c.t1 < 1000)) { this.cand = null; this.fire(c); }
      }
    }
    atPeak(L) { // just past the fastest moment: count right away only if it already looks like a full stroke
      if (L.sweep < sweepMin() || L.t1 - L.t0 < 50 || !this.twistOk(L)) return;
      L.head = headHeading(L.peakS);
      const f = this.fwdScore(L.head), g = lobeGeo(L), over = this.isOver(L);
      if ((f != null && f < 0) || this.pointsBack(L)) return; // backwards: decided when the push ends
      if (over && g && g.up > 0.6) return;                    // lifting the racket into position
      const P = L.prev, takeback = P && !P.fired && P.peak > 0.2 * L.peak && P.peak <= 1.1 * L.peak && this.opp(P, L) && L.t0 - P.t1 < 350;
      const overGo = over && this.hint() && g && g.up < 0.35; // overhead drill: racket up, head going forward/down
      const headGo = f != null && f > 0.5 && (over || !this.hint()); // in an overhead drill a low racket is the drop
      if (takeback || headGo || overGo) {
        const c = this.cand; this.cand = null;
        if (c && c !== P) this.fire(c);
        L.early = true; this.fire(L);
      }
    }
    // an arm-driven overhead (bandeja): the racket turns slowly but its head still moves fast enough
    promote(L, T) {
      if (L.peak < 0.5 * T || L.sweep < 0.8 * sweepMin() || L.t1 - L.t0 < 80 || !this.isOver(L)) return false;
      const g = lobeGeo(L); if (g && g.up > 0.6) return false;
      const sp = strokeSpeed(L); L.sp = sp;
      if (!sp.hand || sp.kmh < racketKmh(T)) return false;
      L.promoted = true; return true;
    }
    close(t) {
      const L = this.L, T = this.getT(); this.L = null;
      const big = !L.fired && (L.peak >= T || this.promote(L, T));
      if (big && !L.sp) L.sp = strokeSpeed(L);
      if ((big || L.fired) && !L.head) L.head = headHeading(L.peakS);
      const c = this.cand;
      if (L.fired) { this.onLobe && this.onLobe(L); this.prev = L; return; }
      if (!big) { // slow push: the way back after a waiting stroke confirms it
        if (c && this.opp(c, L) && L.t0 - c.t1 < 600 && L.peak > 0.3 * c.peak) { this.cand = null; this.fire(c); }
        this.prev = L; return;
      }
      const g = lobeGeo(L), f = this.fwdScore(L.head);
      L.bad = L.sweep < sweepMin() * (L.promoted ? 0.8 : 1) ? 'short' : !this.twistOk(L) ? 'twist' : null;
      if (!L.bad && ((f != null && f < -0.3) || this.pointsBack(L))) L.bad = 'back';
      if (!L.bad && this.isOver(L) && g && g.up > 0.6) L.bad = 'lift';
      this.onLobe && this.onLobe(L);
      if (window.__detLog) window.__detLog.push({ ev: 'close', peak: +L.peak.toFixed(2), kmh: Math.round(pw(L)), sweep: Math.round(L.sweep / DEG), twist: Math.round(L.twist / DEG), bad: L.bad, f: f && +f.toFixed(2), elev: g && Math.round(g.elev / DEG), up: g && +g.up.toFixed(2), promoted: !!L.promoted });
      if (!L.bad && !c && this.upgrade(L)) { this.prev = L; return; }
      if (c) {
        if (this.opp(c, L) && L.t0 - c.t1 < 600) {
          if (!L.bad && pw(L) >= 0.9 * pw(c)) this.cand = null;          // c was the take-back for this one
          else { this.cand = null; this.fire(c); this.prev = L; return; }   // L is the way back after c
        } else { this.cand = null; this.fire(c); }
      }
      const P = L.prev;
      if (P && P.fired && this.opp(P, L) && L.t0 - P.t1 < 350) { this.prev = L; return; } // straight back out of a counted stroke
      if (L.bad) { this.reject(L); this.prev = L; return; }
      L.due = t + (L.peak >= 1.6 * T ? 200 : 380);
      this.cand = L; this.prev = L;
    }
    reject(L) {
      if (L.bad === 'lift') return;
      if (L.bad === 'back') { // take-back / recovery. Many big ones in a row = the player turned around: relearn "forward"
        if (L.peak > 1.3 * this.getT()) { this.backN = L.t0 - this.backT < 8000 ? this.backN + 1 : 1; this.backT = L.t0; if (this.backN >= 3) { this.fwd = [0, 0]; this.fwdW = 0; this.backN = 0; } }
        return;
      }
      if (Math.abs(L.peakT - this.lastFire) < 900) return; // part of a counted stroke
      this.onReject && this.onReject(L.bad, L);
    }
    // the push counted a moment ago was only the take-back / drop of this clearly stronger one the other way
    upgrade(L) {
      const F = this.lastF;
      if (!F || F === L || !F.early || !this.opp(F, L) || L.t0 - F.t1 > 400) return false;
      if (strokeSpeed(L).kmh < 1.25 * strokeSpeed(F).kmh) return false;
      L.fired = true; L.early = true; this.lastF = L; this.lastFire = L.peakT; this.learn(L);
      if (window.__detLog) window.__detLog.push({ ev: 'upgrade', from: +F.peak.toFixed(2), to: +L.peak.toFixed(2) });
      this.onUpgrade && this.onUpgrade(F, L); return true;
    }
    fire(L) {
      if (L.fired) return; L.fired = true;
      if (L.peakT - this.lastFire < 400) { this.upgrade(L); return; }
      this.lastFire = L.peakT; this.backN = 0; this.lastF = L;
      if (!L.head) L.head = headHeading(L.peakS);
      if (window.__detLog) { const g = lobeGeo(L); window.__detLog.push({ ev: 'fire', peak: +L.peak.toFixed(2), sweep: Math.round(L.sweep / DEG), twist: Math.round(L.twist / DEG), early: !!L.early, promoted: !!L.promoted, dur: Math.round(L.t1 - L.t0), f: this.fwdScore(L.head), elev: g && Math.round(g.elev / DEG), up: g && +g.up.toFixed(2) }); }
      this.learn(L);
      this.onStroke && this.onStroke(L);
    }
    learn(L) { // "forward" = where counted strokes send the racket head
      if (!L.head) L.head = headHeading(L.peakS);
      if (L.head) { const w = L.early || L.peak >= 1.3 * this.getT() ? 1 : 0.6; this.fwd = [this.fwd[0] * 0.85 + L.head[0] * w, this.fwd[1] * 0.85 + L.head[1] * w]; this.fwdW = this.fwdW * 0.85 + w; }
    }
  }
  const REJECT_TXT = {
    short: 'Ayunannya kependekan. Tarik dari belakang, terus ayun lebih panjang.',
    twist: 'Kebanyakan muter pergelangan. Ayun pakai lengan, layar HP = muka raket.'
  };

  /* ===================== racket-head speed = hand speed + whip ===================== */
  /* hand: linear acceleration rotated to the earth frame and integrated; the velocity is pinned to zero wherever the
     phone is momentarily still (ready position, end of the follow-through), which removes the drift.
     whip: ω × (racket head 32 cm past the hand). Without a working accelerometer: ω × 62 cm (gyro only). */
  function quatsFor(ms) {
    const qs = ms.map(s => Motion.oriAt(s.t));
    return qs.some(q => !q) ? { qs: integrateGyro(ms), src: 'gyro' } : { qs, src: 'ori' };
  }
  function solveKin(ms, qs, twoSided) {
    const n = ms.length; let nAcc = 0, maxA = 0;
    ms.forEach(s => { if (s.acc) { nAcc++; maxA = Math.max(maxA, Math.hypot(s.acc[0], s.acc[1], s.acc[2])); } });
    const useHand = n > 4 && nAcc >= 0.9 * n && maxA > 1.0, R = useHand ? R_HEAD : LEVER;
    const whipOf = R => ms.map((s, i) => Q.rot(qs[i], [-s.wz * R, 0, s.wx * R])), whip = whipOf(R);
    const gyroOnly = () => { const w = whipOf(LEVER); return { vh: w, spd: w.map(v => Math.hypot(v[0], v[1], v[2])), p: null, hand: false }; };
    if (!useHand) return gyroOnly();
    const aw = []; let last = [0, 0, 0];
    ms.forEach((s, i) => { if (s.acc) last = Q.rot(qs[i], s.acc); aw.push(last); });
    const qv = ms.map((s, i) => Math.hypot(s.wx, s.wy, s.wz) + 0.4 * Math.hypot(aw[i][0], aw[i][1], aw[i][2]));
    const quiet = i => (qv[Math.max(0, i - 1)] + qv[i] + qv[Math.min(n - 1, i + 1)]) / 3 < 1.2;
    const dtOf = i => clamp((ms[i].t - ms[i - 1].t) / 1000, 0, 0.05);
    const v = ms.map(() => [0, 0, 0]);
    const seg = (a, b) => { // non-still samples strictly between still samples a and b (−1 / n = no anchor)
      if (a >= 0) {
        const end = Math.min(b, n - 1), dur = (ms[end].t - ms[a].t) / 1000, tau = b < n ? 0 : (twoSided || dur > 1.2 ? 1.0 : 0);
        for (let i = a + 1; i <= end; i++) { const dt = dtOf(i), k = tau ? Math.exp(-dt / tau) : 1; v[i] = [0, 1, 2].map(c => v[i - 1][c] * k + (aw[i - 1][c] + aw[i][c]) / 2 * dt); }
        if (b < n) { const ve = v[b].slice(), T0 = ms[a].t, T1 = ms[b].t; for (let i = a; i <= b; i++) { const f = (ms[i].t - T0) / Math.max(1e-6, T1 - T0); v[i] = v[i].map((c, ci) => c - ve[ci] * f); } }
      } else if (b < n) {
        for (let i = b - 1; i >= 0; i--) { const dt = dtOf(i + 1), k = Math.exp(-dt / 0.6); v[i] = [0, 1, 2].map(c => v[i + 1][c] * k - (aw[i][c] + aw[i + 1][c]) / 2 * dt); }
      } else {
        for (let i = 1; i < n; i++) { const dt = dtOf(i), k = Math.exp(-dt / 0.6); v[i] = [0, 1, 2].map(c => v[i - 1][c] * k + (aw[i - 1][c] + aw[i][c]) / 2 * dt); }
      }
    };
    let a = -1;
    for (let i = 0; i < n; i++) if (quiet(i)) { if (i - a > 1) seg(a, i); v[i] = [0, 0, 0]; a = i; }
    if (a < n - 1) seg(a, n);
    let vmax = 0; v.forEach(x => { vmax = Math.max(vmax, Math.hypot(x[0], x[1], x[2])); });
    if (!(vmax < 16)) return gyroOnly(); // implausible: accelerometer trouble
    const p = [[0, 0, 0]];
    for (let i = 1; i < n; i++) { const dt = dtOf(i); p.push([0, 1, 2].map(c => p[i - 1][c] + (v[i - 1][c] + v[i][c]) / 2 * dt)); }
    const vh = v.map((x, i) => [x[0] + whip[i][0], x[1] + whip[i][1], x[2] + whip[i][2]]);
    return { vh, spd: vh.map(x => Math.hypot(x[0], x[1], x[2])), p, hand: true };
  }
  // racket speed of a counted push, right after it (km/h, calibrated)
  function strokeSpeed(L) {
    if (L.sp) return L.sp;
    const ms = Motion.samples(L.peakT - 1800, L.peakT + 300); if (!ms.length) return { kmh: racketKmh(L.peak), sat: L.sat };
    const { qs } = quatsFor(ms), K = solveKin(ms, qs, false);
    let best = 0; ms.forEach((s, i) => { if (Math.abs(s.t - L.peakT) <= 120) best = Math.max(best, K.spd[i]); });
    return { kmh: (best || L.peak * LEVER) * 3.6 * set.calib, sat: L.sat, hand: K.hand };
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
      <p class="note">Forehand dan backhand dua-duanya dihitung, asal cukup panjang dan kencang. Ancang-ancang, balik ke posisi siap, dan muter pergelangan nggak dihitung. Santai cocok buat pemanasan; Kenceng buat yang mau nge-push power.</p>`, {
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
      ${!S.firstDay && !PREVIEW ? `<div class="tip"><span class="ic">${ICON.hand}</span><span><b>Baru pertama?</b>Pegang HP kayak gagang raket: atas HP = ujung raket, layar = muka forehand. Terus gas latihan bebas. <button class="link" data-act="howto" style="padding:4px 0 0">Lihat cara pegang</button></span></div>` : ''}
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
      <div class="hint" id="hint" hidden>${ICON.info}<span><b>Belum bunyi juga?</b>Forehand, backhand, sampai bandeja, víbora, dan smash kehitung, asal ayunannya cukup panjang dan kencang. Tarik dari belakang, terus lecutin ke depan. Atas HP = ujung raket.</span></div>
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
    const det = new Detector({
      getT: thr,
      onStroke: L => { const sp = strokeSpeed(L); Snd.zoneHit(clamp(sp.kmh / 60, 0, 1), zoneOf(ballOf(sp.kmh))); onSwing(sp.kmh, sp.sat); },
      onUpgrade: (F, L) => { const sp = strokeSpeed(L); onSwing(sp.kmh, sp.sat, true); },
      onReject: why => { const cue = $('#cue'); cue.textContent = REJECT_TXT[why]; cue.className = 'sub center cue warn'; }
    });
    function onSwing(r, sat, replace) {
      if (replace) { // same swing, better numbers (the first push was only its take-back)
        if (!st.n) return; const ob = st.balls.pop(), zo = zoneOf(ob); st.n--; st.sum -= ob / BALL_RATIO; if (zo) { st.zN--; if (zo === 'in') st.zIn--; }
      }
      const ball = ballOf(r); st.n++; st.best = Math.max(st.best, r); st.sum += r; st.lastAt = now(); st.balls.push(ball);
      recordSwing(r, null, !replace); if (prevBest > 0 && r > prevBest) st.newBest = true;
      const z = zoneOf(ball); if (z) { st.zN++; if (z === 'in') st.zIn++; }
      $('#hint').hidden = true;
      $('#lb').textContent = (sat ? '≥' : '') + fv(ball); $('#lr').textContent = fv(r);
      const n = $('#gN'); n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop');
      n.classList.toggle('in', z === 'in'); n.classList.toggle('out', z === 'low' || z === 'high');
      gaugeLast(ball);
      $('#sN').textContent = st.n;
      $('#sBest').textContent = '≈' + fv(ballOf(st.best)); $('#sBestR').textContent = fv(st.best) + ' raket';
      const cue = $('#cue');
      cue.textContent = sat ? 'Mentok batas giroskop HP, aslinya bisa lebih kenceng!'
        : z === 'in' ? 'Pas di zona! Pertahanin temponya.' : z === 'high' ? 'Kekencengan. Kontrol dikit.' : z === 'low' ? 'Kurang kenceng. Lecutin lagi.'
        : st.newBest ? 'Rekor baru! Pertahanin.' : 'Lecutin pergelangan kayak nyambuk. Tiap bunyi = 1 rep.';
      cue.className = 'sub center cue' + (z === 'in' ? ' good' : z === 'high' || z === 'low' ? ' warn' : '');
      refreshStats();
      Guard.engage();
    }
    const unsub = Motion.sub(s => { det.feed(s); mv = Math.max(mv, s.perp); });
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
        <li><span>Pegang HP kayak gagang raket, pakai grip yang biasa kamu pakai. <b>Atas HP = ujung raket</b>, <b>layar = muka forehand</b>. Backhand otomatis pakai sisi belakang HP, sama kayak raket beneran.</span></li>
        <li><span>Tap mulai, terus ambil posisi siap. Ada bunyi tik, tik, ding: itu tandanya mulai ngerekam.</span></li>
        <li><span>Ayun dan lecutin pergelangan kayak nyambuk. Forehand dan backhand dua-duanya kehitung. Ancang-ancang, balik ke posisi siap, ayunan pendek, dan muter pergelangan sengaja nggak dihitung.</span></li>
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
              <span class="t"><b>${STROKES[r.stroke].n}</b><span>${whenLabel(r.date)} · ≈${fv(ballOf(r.peak))} ${U()} bola · ${BALL_RES[ballFlight(r).res][0].toLowerCase()}${r.src === 'gyro' ? '' : ' · muka ' + faceTxt(faceMetrics(r).face).toLowerCase()}</span></span><span class="vs">${ICON.chev}</span></button></div>`).join('')
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
        <h2 class="title" id="recT">Ambil posisi ready</h2>
        <p class="sub" id="recS">Tik, tik, terus ding = mulai rekam.<br>Atas HP = ujung raket, layar = muka forehand.<br>Nggak usah lihat layar.</p>
      </div>
      <div class="grow"></div>
      <div class="s-bottom" id="recBottom">${Motion.isSim() ? '<button class="btn small sim" data-act="sim" id="simBtn" hidden>Simulasi ayunan</button>' : ''}</div>
    </section>`;
    const timers = [], recStart = Date.now(); let unsub = null, done = false, det = null, best = null, waiting = false;
    const dots = app.querySelectorAll('#dots i');
    timers.push(setTimeout(() => { Snd.play('tick'); dots[0].classList.add('on'); }, 700), setTimeout(() => { Snd.play('tick'); dots[1].classList.add('on'); }, 1400), setTimeout(startRec, 2100));
    function startRec() {
      Snd.play('ding'); dots[2].classList.add('ding');
      timers.push(setTimeout(() => { const ring = $('#ring'); if (!ring) return; ring.classList.add('live'); ring.innerHTML = '<span class="live-dot"></span>'; }, 250));
      $('#recT').textContent = 'Lagi ngerekam';
      $('#recS').innerHTML = STROKES[anStroke].over ? 'Grip kekunci ✓<br>Angkat raket, pukul kapan aja kamu siap.<br>Raket jatuh di belakang punggung nggak kehitung kok.' : 'Grip kekunci ✓<br>Pukul kapan aja kamu siap.<br>Ancang-ancangnya ikut kerekam kok.';
      const sb = $('#simBtn'); if (sb) sb.hidden = false;
      Guard.engage();
      const T0 = thr() * 0.85, kmhOf = L => strokeSpeed(L).kmh;
      // the replay centres on the fastest racket head around the counted stroke (a take-back or a drop is never the fastest)
      det = new Detector({
        getT: () => T0, over: !!STROKES[anStroke].over,
        onStroke: L => { if (done) return; if (!best || kmhOf(L) > kmhOf(best)) best = L; if (!waiting) { waiting = true; Snd.hit(0.7); waitCapture(); } },
        onLobe: L => { if (!done && best && L !== best && Math.abs(L.peakT - best.peakT) < 1200 && L.bad !== 'lift' && kmhOf(L) > kmhOf(best)) best = L; },
        onReject: why => { if (!done && !waiting) $('#recS').textContent = 'Belum kehitung. ' + REJECT_TXT[why]; }
      });
      unsub = Motion.sub(s => det.feed(s));
      timers.push(setTimeout(() => { if (!done && !waiting) noSwing(); }, 25000));
    }
    function waitCapture() {
      $('#recT').textContent = 'Bentar, lagi diolah…'; $('#recS').textContent = 'Lagi nyusun replay 3D-nya.';
      const check = () => {
        if (done) return;
        const pk = best.peakT, settled = Motion.lastT() >= pk + 900 && (!det.L || det.L.peak < best.peak * 0.5);
        if (settled || now() > pk + 1800) { done = true; capture(pk); } else timers.push(setTimeout(check, 40));
      };
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
        const dt = (ms[i].t - ms[i - 1].t) / 1000, wx = ms[i].wx, wy = ms[i].wy, wz = ms[i].wz, m = Math.hypot(wx, wy, wz);
        if (m > 1e-6) q = Q.norm(Q.mul(q, Q.axis(wx / m, wy / m, wz / m, m * dt)));
      }
      out.push(q);
    }
    return out;
  }
  /* replay v3: the full wind-up (−2 s) and follow-through (+0.9 s); racket pose from the orientation sensor, hand path
     from the accelerometer (when the phone has one), racket-head speed = hand + whip, head velocity at contact (vc).
     The court is turned so the ball leaves towards the net — forehand, backhand or a sliced víbora alike. */
  function buildReplay(pkT, stroke, hand) {
    let ms = Motion.samples(pkT - 2000, pkT + 900); if (ms.length < 20) return null;
    if (ms.length > 360) { const k = Math.ceil(ms.length / 360); ms = ms.filter((s, i) => i % k === 0 || Math.abs(s.t - pkT) < 120); } // ≤ ~120 Hz stored
    const { qs, src } = quatsFor(ms), K = solveKin(ms, qs, true);
    let pi = -1; ms.forEach((s, i) => { if (Math.abs(s.t - pkT) < 160 && (pi < 0 || K.spd[i] > K.spd[pi])) pi = i; });
    if (pi < 0) return null;
    // the fastest moment falls between two samples: a parabola through the three around the peak finds it (at 60 Hz a
    // smash turns ~20° between samples, so this steadies the face angle and the ball's launch)
    let dl = 0;
    if (pi > 0 && pi < ms.length - 1) { const a = K.spd[pi - 1], b = K.spd[pi], c = K.spd[pi + 1], den = a - 2 * b + c; if (den < 0) dl = clamp(0.5 * (a - c) / den, -0.5, 0.5); }
    const pj = dl < 0 ? pi - 1 : pi + 1, fr = Math.abs(dl);
    const tPk = ms[pi].t + ((ms[pj] ? ms[pj].t : ms[pi].t) - ms[pi].t) * fr, over = !!(STROKES[stroke] && STROKES[stroke].over);
    const vh = fr && K.vh[pj] ? V3.add(V3.scale(K.vh[pi], 1 - fr), K.vh[pj], fr) : K.vh[pi], qPk = fr && qs[pj] ? Q.slerp(qs[pi], qs[pj], fr) : qs[pi];
    // which side of the phone hit: + = screen (forehand face), − = back. Overheads are hit with the forehand face.
    const nS = Q.rot(qPk, [0, 0, 1]), dn = V3.dot(nS, vh) / (V3.len(vh) || 1), face = over && Math.abs(dn) < 0.4 ? 1 : dn < 0 ? -1 : 1;
    const u0 = launchBall(vh, V3.scale(nS, face)).u;
    let hx = u0[0], hy = u0[1];
    if (Math.hypot(hx, hy) < 0.2 * V3.len(u0)) { hx = vh[0]; hy = vh[1]; }
    if (Math.hypot(hx, hy) < 1e-6) { hx = nS[0] * face; hy = nS[1] * face; }
    const qYaw = Q.axis(0, 0, 1, Math.PI / 2 - Math.atan2(hy, hx));
    const qM = Q.axis(1, 0, 0, -Math.PI / 2); // earth (z up, y north) → scene (y up, −z = net)
    const qS = Q.mul(qM, qYaw);
    const qw = qs.map(q => Q.norm(Q.mul(qS, q)));
    for (let i = 1; i < qw.length; i++) { const a = qw[i - 1], b = qw[i]; if (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] < 0) qw[i] = b.map(c => -c); }
    const rd = (v, d) => Math.round(v * d) / d;
    let p = null;
    if (K.p) { const p0 = K.p[pi]; p = K.p.map(x => Q.rot(qS, [x[0] - p0[0], x[1] - p0[1], x[2] - p0[2]]).map(c => rd(c, 1000))); }
    return {
      v: 3, id: 'r' + Date.now().toString(36), date: Date.now(), stroke, hand, k: set.calib, star: false, src, face, hand3: K.hand,
      vc: Q.rot(qS, vh).map(c => rd(c, 1000)),
      peak: rd(K.spd[pi] * 3.6 * set.calib, 10), sat: ms.some(s => s.sat && Math.abs(s.t - tPk) < 60),
      t: ms.map(s => rd((s.t - tPk) / 1000, 1000)), w: ms.map(s => rd(s.perp, 100)), s: K.spd.map(x => rd(x * 3.6, 10)),
      q: qw.map(q => q.map(c => rd(c, 10000))), p
    };
  }
  // racket-head speed (km/h, calibrated) for sample i — v2 replays store it, v1 replays had the gyro-only model
  const repKmh = (rep, i) => rep.s ? rep.s[i] * rep.k : racketKmh(rep.w[i], rep.k);
  const repSeries = rep => rep.t.map((_, i) => repKmh(rep, i));

  /* racket-face metrics at contact (the face that hit: screen side or back side) */
  // the contact moment (t = 0) sits between two samples: index + fraction
  function contactAt(rep) { let i = 0; while (i < rep.t.length - 2 && rep.t[i + 1] <= 0) i++; return { i, f: clamp(-rep.t[i] / Math.max(1e-6, rep.t[i + 1] - rep.t[i]), 0, 1) }; }
  function faceMetrics(rep) {
    const pi = peakIdx(rep), ca = contactAt(rep), q = Q.slerp(rep.q[ca.i], rep.q[ca.i + 1], ca.f), fs = rep.face || 1;
    const n = Q.rot(q, [0, 0, fs]), d = Q.rot(q, [0, 1, 0]);
    const ser = repSeries(rep), pk = ser[pi]; let j = pi; while (j > 0 && ser[j - 1] > pk * 0.3) j--;
    return { face: Math.round(Math.asin(clamp(n[1], -1, 1)) / DEG), head: Math.round(Math.asin(clamp(d[1], -1, 1)) / DEG), whip: Math.max(0, -rep.t[j]), side: fs };
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
      <div class="face-meta ball-meta"><span>Kena pakai<b>${m.side < 0 ? 'Muka backhand' : 'Muka forehand'}</b></span><span>Kepala raket<b>${Math.abs(m.head)}° ${m.head >= 0 ? 'di atas' : 'di bawah'} pergelangan</b></span><span>Lecutan<b>${m.whip.toFixed(2).replace('.', ',')} dtk</b></span></div>
      <p class="note" style="padding:10px 0 0">Dibaca dari kemiringan HP pas titik kena, di sisi yang mukul (layar = muka forehand, belakang HP = muka backhand); area hijau = patokan umum, bukan aturan mati. Lecutan = waktu dari mulai ngebut sampai puncak, makin singkat makin tajam.</p>
    </div>`;
  }

  function ballCard(rep, fl) {
    const [lbl, cls] = BALL_RES[fl.res], m = v => v.toFixed(1).replace('.', ','), st = rep.stroke, over = !!STROKES[st].over;
    const sp = spinInfo(fl), spinTxt = sp.rpm < 400 ? 'hampir nggak ada' : `${sp.kind.toLowerCase()} · ${(Math.round(sp.rpm / 50) * 50).toLocaleString('id-ID')} rpm`;
    const items = [];
    if (fl.netY != null) items.push(['Di net', fl.res === 'net' ? `nabrak ${m(fl.netY)} m` : `+${m(fl.netY - NET_H)} m di atas`]);
    if (fl.res === 'in') items.push(['Jatuh', `${m(fl.depth)} m dari net`]);
    if (fl.res !== 'back') items.push(['Tinggi maks', `${m(fl.apex)} m`]);
    if (fl.res !== 'back') items.push(['Spin', spinTxt]);
    if (fl.after) items.push(['Abis mantul', `naik ${m(fl.after.h)} m${fl.after.wall === 'side' ? ', ke kaca samping' : fl.after.wall === 'back' ? ', ke kaca belakang' : ''}`]);
    const clear = fl.netY != null ? fl.netY - NET_H : null, lowOver = clear != null && clear < (over ? 1.0 : 0.6);
    const fm = rep.src === 'gyro' ? null : faceMetrics(rep), [flo, fhi] = FACE[st], fClosed = !!fm && fm.face < flo, fOpen = !!fm && fm.face > fhi;
    const lowBounce = fl.after && fl.after.h < 1.1, sideKick = fl.after && fl.after.wall === 'side';
    const inTip = () => {
      if (st === 'LB') return fl.depth >= 7 ? 'Lob dalam, mantap! Lawan dipaksa mundur ke kaca.' : 'Lob-nya kurang dalam. Angkat dikit lagi biar jatuh dekat kaca belakang lawan.';
      if (st === 'VB') return sp.rpm < 900 || Math.abs(sp.side) < 0.25 ? 'Masuk, tapi spinnya kurang. Potong bolanya dari samping (sisi luar bola) sambil ayun ke depan-bawah biar ada spin samping.'
        : sideKick ? 'Víbora mantap! Slice + spin samping bikin bola mantul rendah ke kaca samping.' : 'Víbora masuk dan ada spinnya. Arahin lebih ke samping biar mantulnya nyari kaca samping.';
      if (st === 'BJ') return lowBounce ? 'Bandeja aman: masuk, mantulnya rendah, lawan susah nyerang balik.' : 'Masuk, tapi mantulnya agak tinggi. Potong bolanya lebih banyak (slice) biar mantulnya rendah.';
      if (st === 'SM') return fl.after && fl.after.h >= 1.6 ? 'Smash masuk dan mantulnya tinggi. Mantap!' : 'Smash masuk. Pukul lebih ke bawah biar mantulnya tinggi dan susah dibalikin.';
      return lowOver ? 'Mantap! Rendah di atas net dan masuk.' : 'Masuk, tapi agak tinggi di atas net. Tutup dikit muka raketnya biar lebih tajam.';
    };
    const tip = {
      in: inTip(),
      net: over ? (fClosed ? 'Nyangkut net, muka raketnya ketutup. Buat bandeja/víbora muka raket agak dibuka, terus potong bolanya ke depan, jangan dibanting ke bawah.' : 'Nyangkut net. Kena bolanya lebih di depan-atas badan dan dorong ke depan, jangan cuma motong ke bawah.')
        : fClosed ? 'Bola nyangkut di net karena muka raketnya ketutup. Buka dikit biar bola naik.' : 'Bola nyangkut di net. Muka raketnya udah oke, jadi ayun lebih dari bawah ke atas atau lebih kencang.',
      short: fClosed ? 'Bola jatuh sebelum net karena muka raketnya ketutup. Buka dikit dan ayun lebih ke depan.' : fOpen ? 'Bola kebanyakan naik dan jatuh sebelum net. Tutup dikit muka raketnya dan dorong lebih ke depan.' : 'Bola jatuh sebelum net. Muka raketnya udah oke, jadi ayun lebih kencang dan lebih ke depan.',
      long: fOpen ? 'Kepanjangan karena muka raketnya kebuka banget. Tutup dikit atau kurangi tenaga.' : 'Kepanjangan, bola kena kaca belakang langsung. Muka raketnya udah oke, jadi kurangi tenaga atau ayun lebih rata ke depan.',
      wide: 'Melebar, bola kena kaca samping sebelum mantul. Kurangi spin sampingnya atau arahin lebih ke tengah.',
      back: 'Bola nggak maju ke depan. Pastikan muka raket ngadep ke depan pas kena, jangan kebuka ke atas atau miring.'
    }[fl.res];
    return `<div class="card">
      <div class="chart-head"><h3>Arah bola</h3><span class="pill ${cls}">${lbl}</span></div>
      ${items.length ? `<div class="face-meta ball-meta">${items.map(([k, v]) => `<span>${k}<b>${v}</b></span>`).join('')}</div>` : ''}
      <p class="sub" style="margin-top:12px">${tip}</p>
      <p class="note" style="padding:8px 0 0">Perkiraan dari kecepatan, sudut muka raket, dan arah ayunan pas kena. Bagian ayunan yang motong bola (slice, potongan samping víbora) jadi spin: backspin bikin bola melayang, spin samping bikin melengkung dan mantul ke samping.${over ? ' Buat overhead, tenaga bola lob yang datang ikut dihitung.' : ''} Posisi badanmu belum dihitung.</p>
    </div>`;
  }

  /* ---------- replay (3D) ---------- */
  SCREENS.replay = function (p) {
    const rep = REPLAYS.find(r => r.id === p.id);
    if (!rep) return go('analysis', { tab: 'rep' });
    const fl = ballFlight(rep), lastS = rep.t[rep.t.length - 1], T0 = rep.t[0], T1 = Math.max(lastS, fl.res !== 'back' ? fl.tEnd + 0.35 : 0);
    let t = p.fresh ? T0 : 0, playing = false, rate = 0.25, last = now(), raf = 0, ready = false;
    app.innerHTML = `<section class="scr" style="gap:12px">
      ${subhdr(STROKES[rep.stroke].n, `<button class="round" data-act="del" aria-label="Hapus replay">${ICON.trash}</button>`)}
      <div class="r3d" id="r3d"><canvas id="c3d" aria-label="Replay 3D ayunan"></canvas><div class="r3d-load" id="r3dLoad">Lagi nyiapin 3D…</div>
        <div class="tools"><button class="chip" data-act="resetView">${ICON.reset}Reset</button><span style="display:flex;gap:6px"><button class="chip" data-act="look">${ICON.sliders}Tampilan</button><button class="chip" data-act="snap">${ICON.image}Simpan</button></span></div></div>
      <div class="seg compact" id="viewSeg" role="group" aria-label="Sudut kamera">${[['auto', 'Auto'], ['swing', 'Belakang'], ['side', 'Samping'], ['court', 'Lapangan']].map(([k, l]) => `<button data-act="view" data-k="${k}" aria-pressed="${k === 'auto'}">${l}</button>`).join('')}</div>
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
      ${ballCard(rep, fl)}
      ${faceCard(rep)}
      <p class="note">Sisi oranye = muka forehand (layar HP), sisi gelap = muka backhand. Garis oranye = bagian ayunan paling kencang, di situ harusnya bola kena; bola kuning = titik kena dan arah bolanya. Geser buat muter, dua jari buat geser, cubit buat zoom.${rep.p ? ' Gerak tangan dari akselerometer, arah raket dari sensor orientasi.' : ' Posisi tangan diperkirakan; arah raket dan kecepatannya dari sensor HP.'}</p>
      <div class="r-actions"><button class="btn line" data-act="again" aria-label="Ulangi ${STROKES[rep.stroke].n}">${ICON.reset}Ulangi</button><button class="btn teal" data-act="done">Selesai</button></div>
    </section>`;
    const SER = repSeries(rep), PK = Math.max(...SER);
    const wAt = tt => { let i = 0; while (i < rep.t.length - 2 && rep.t[i + 1] < tt) i++; const f = clamp((tt - rep.t[i]) / Math.max(1e-6, rep.t[i + 1] - rep.t[i]), 0, 1); return SER[i] + (SER[i + 1] - SER[i]) * f; };
    const sp = $('#spark'), sctx = sp.getContext('2d');
    function drawSpark() {
      const cs = getComputedStyle(document.documentElement), teal = cs.getPropertyValue('--teal').trim() || '#0E8A7A', orange = cs.getPropertyValue('--orange').trim() || '#FF6A2B', surf = cs.getPropertyValue('--surface').trim() || '#fff';
      const dpr = Math.min(devicePixelRatio || 1, 2), W = sp.clientWidth, H = sp.clientHeight; if (!W) return;
      sp.width = W * dpr; sp.height = H * dpr; sctx.setTransform(dpr, 0, 0, dpr, 0, 0); sctx.clearRect(0, 0, W, H);
      const maxW = PK * 1.08, X = tt => (tt - T0) / (T1 - T0) * W, Y = w => H - 3 - (w / maxW) * (H - 9);
      const path = () => { sctx.beginPath(); rep.t.forEach((tt, i) => { const x = X(tt), y = Y(SER[i]); i ? sctx.lineTo(x, y) : sctx.moveTo(x, y); }); };
      path(); sctx.lineTo(X(rep.t[rep.t.length - 1]), H); sctx.lineTo(X(rep.t[0]), H); sctx.closePath(); sctx.globalAlpha = 0.14; sctx.fillStyle = teal; sctx.fill(); sctx.globalAlpha = 1;
      path(); sctx.strokeStyle = teal; sctx.lineWidth = 2.2; sctx.lineJoin = 'round'; sctx.stroke();
      sctx.beginPath(); sctx.arc(X(0), Y(SER[peakIdx(rep)]), 5, 0, 7); sctx.fillStyle = orange; sctx.fill(); sctx.lineWidth = 2.5; sctx.strokeStyle = surf; sctx.stroke();
    }
    function ui() {
      const r = t > lastS ? wAt(0) : wAt(t);
      $('#rBall').textContent = '≈' + fv(ballOf(r)); $('#rRacket').textContent = fv(r);
      const tt = Math.abs(t) < 0.005 ? 'Pas kena' : t < 0 ? `${Math.abs(t).toFixed(2)} dtk sebelum kena` : t > lastS + 0.01 ? `Bola terbang · ${t.toFixed(2)} dtk` : `${t.toFixed(2)} dtk setelah kena`;
      $('#rInfo').textContent = tt.replace('.', ',');
      const fr = (t - T0) / (T1 - T0); $('#ph').style.left = `calc(${(fr * 100).toFixed(2)}% - 1px)`;
      const sc = $('#scrub'); sc.value = Math.round(fr * 1000); sc.style.setProperty('--p', (fr * 100) + '%');
    }
    const setPlay = v => { playing = v; const b = $('#playBtn'); b.innerHTML = v ? ICON.pause : ICON.play; b.setAttribute('aria-label', v ? 'Jeda' : 'Putar'); if (v && t >= T1 - 1e-3) t = T0; last = now(); };
    function frame() {
      const n = now(), dt = Math.min(0.05, (n - last) / 1000); last = n;
      if (playing) { t += dt * (t > lastS ? Math.max(rate, 0.5) : rate); if (t >= T1) { t = T1; setPlay(false); } }
      if (ready) { R3D.setTime(t); R3D.render(); }
      ui(); raf = requestAnimationFrame(frame);
    }
    drawSpark(); ui(); frame();
    const viewSeg = k => app.querySelectorAll('[data-act="view"]').forEach(x => x.setAttribute('aria-pressed', x.dataset.k === k));
    R3D.onManual = () => viewSeg('manual');
    R3D.mount($('#c3d'), rep).then(() => { ready = true; $('#r3dLoad').hidden = true; if (p.fresh) { t = T0; setPlay(true); } })
      .catch(err => { if (String(err && err.message).includes('stale')) return; console.error(err); const l = $('#r3dLoad'); if (l) l.textContent = 'Tampilan 3D nggak bisa dimuat di perangkat ini. Grafik kecepatan di bawah tetap jalan.'; });
    bindInputs(app, { scrub: el => { setPlay(false); t = T0 + (+el.value / 1000) * (T1 - T0); } });
    const onRs = () => drawSpark(); addEventListener('resize', onRs);
    cleanup = () => { cancelAnimationFrame(raf); removeEventListener('resize', onRs); R3D.unmount(); };
    actions = {
      back: () => go('analysis', { tab: p.fresh ? 'new' : 'rep' }),
      done: () => go('analysis', { tab: p.fresh ? 'new' : 'rep' }),
      again: () => { anStroke = rep.stroke; startWith(() => go('record')); }, // same stroke, straight back to recording
      play: () => setPlay(!playing),
      peak: () => { setPlay(false); t = 0; },
      rate: b => { rate = +b.dataset.k; app.querySelectorAll('[data-act="rate"]').forEach(x => x.setAttribute('aria-pressed', +x.dataset.k === rate)); },
      resetView: () => { R3D.resetView(); viewSeg('auto'); },
      view: b => { R3D.setView(b.dataset.k); viewSeg(b.dataset.k); },
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
        <span class="label">Warna muka forehand</span>${seg('racket', [['classic', 'Oranye'], ['white', 'Putih'], ['teal', 'Teal']])}
        <span class="label">Jejak ayunan</span>
        <div class="list">${sw('ribbon', 'Garis paling kencang')}${sw('ghosts', 'Raket bayangan')}${sw('dots', 'Lintasan kepala raket')}${sw('peak', 'Bola & titik kena')}${sw('arrow', 'Panah arah muka raket')}</div>
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

  /* ===================== swing geometry & ball flight (pure, no three.js) ===================== */
  const peakIdx = rep => { let pi = 0; rep.t.forEach((tt, i) => { if (Math.abs(tt) < Math.abs(rep.t[pi])) pi = i; }); return pi; };
  const NET_H = 0.88, BALL_R = 0.033, BALL_M = 0.057;
  const AIR = 0.5 * 1.2 * Math.PI * BALL_R * BALL_R / BALL_M; // ½·ρ·A / m
  const LOB_IN = [0, -8.4, 7.1]; // a typical lob arriving for a bandeja / víbora / smash (scene frame, m/s)
  /* ball off the racket: the face pushes it along its normal (≈1.35× that part of the racket-head speed); the part of
     the swing that brushes across the face — the cut of a bandeja / víbora, the low-to-high of a topspin — adds a little
     speed that way and spins the ball (the contact point is dragged along: ball surface ≈ 0.6 × the brushing speed). */
  function launchBall(V, n) {
    const sp = V3.len(V) || 1e-6, vn0 = V3.dot(V, n), Vt = V3.add(V, n, -vn0), vn = Math.max(vn0, 0.2 * sp);
    return { u: V3.add(V3.scale(n, BALL_RATIO * vn), Vt, 0.4), w: V3.scale(V3.cross(Vt, n), 0.6 / BALL_R) };
  }
  // head velocity at contact (scene frame, m/s, uncalibrated) for replays recorded before it was stored
  function estContactVel(rep, pi) {
    const i0 = Math.max(0, pi - 1), i1 = Math.min(rep.t.length - 1, pi + 1), dt = Math.max(1e-3, rep.t[i1] - rep.t[i0]);
    let d = Q.mul(rep.q[i1], Q.conj(rep.q[i0])); if (d[3] < 0) d = d.map(c => -c);
    const sh = Math.hypot(d[0], d[1], d[2]), ang = 2 * Math.atan2(sh, d[3]), w = sh > 1e-9 ? [d[0] / sh * ang / dt, d[1] / sh * ang / dt, d[2] / sh * ang / dt] : [0, 0, 0];
    let V = V3.cross(w, V3.scale(Q.rot(rep.q[pi], [0, 1, 0]), rep.p ? R_HEAD : LEVER));
    if (rep.p) V = V3.add(V, V3.add(rep.p[i1], rep.p[i0], -1), 1 / dt);
    const s = (rep.s ? rep.s[pi] : racketKmh(rep.w[pi], 1)) / 3.6, l = V3.len(V);
    return l > 1e-6 ? V3.scale(V, s / l) : V3.scale(Q.rot(rep.q[pi], [0, 0, rep.face || 1]), s);
  }
  // older replays faced the court by racket-head travel; turn them so the ball leaves towards the net like new ones
  const alignCache = new Map();
  function aligned(rep) {
    if (rep.vc) return rep;
    const key = rep.id + '|' + rep.t.length; if (alignCache.has(key)) return alignCache.get(key);
    const pi = peakIdx(rep), V = estContactVel(rep, pi), u = launchBall(V, Q.rot(rep.q[pi], [0, 0, rep.face || 1])).u;
    const out = Object.assign({}, rep, { vc: V });
    if (Math.hypot(u[0], u[2]) > 0.2 * V3.len(u)) {
      const qA = Q.axis(0, 1, 0, Math.atan2(u[0], -u[2]));
      out.q = rep.q.map(q => Q.mul(qA, q)); out.p = rep.p && rep.p.map(x => Q.rot(qA, x)); out.vc = Q.rot(qA, V);
    }
    alignCache.set(key, out); return out;
  }
  // racket pose is measured (orientation). Hand position: measured path (accelerometer), or — without one — modelled as
  // a hand on an arm from the shoulder. Either way the whole path is then moved so the racket head meets the ball at
  // that stroke's contact point (CONTACT): the sensors give the swing's shape, not where the body is on court.
  // Overheads are played around the service line.
  const HEAD_Y = 0.29, TIP_Y = 0.425; // racket: hand at 0, head centre and tip along the racket axis (m)
  const POS_Z = { VL: 3.2, BJ: 6.8, VB: 6.5, SM: 5.5 };
  /* where the ball meets the racket head, per stroke, for a ~1.75 m player: s = sideways from the body's centre line
     (+ = hitting-hand side, − = the other side), f = in front of the body towards the net, y = height above the court
     (all m). byFace: the side follows the face that hit (screen = forehand side, back of the phone = backhand side). */
  const CONTACT = {
    FH: { s: 0.75, f: 0.35, y: 0.95 },             // waist height, beside the body on the forehand side
    BH: { s: -0.65, f: 0.4, y: 0.9 },              // waist height, on the other side
    VL: { s: 0.45, f: 0.55, y: 1.25, byFace: 1 },  // chest height, well in front
    LB: { s: 0.6, f: 0.3, y: 0.55, byFace: 1 },    // low, under the ball (knee to thigh)
    SV: { s: 0.55, f: 0.35, y: 0.7 },              // underhand, below the waist (the rule)
    BJ: { s: 0.45, f: 0.35, y: 1.8 },              // head height, a little in front and to the side
    VB: { s: 0.55, f: 0.3, y: 1.95 },              // a bit above the head, more to the side
    SM: { s: 0.25, f: 0.35, y: 2.35 }              // highest: arm stretched up
  };
  function computeFrames(rep0) {
    const rep = aligned(rep0), over = !!STROKES[rep.stroke].over, hs = rep.hand === 'L' ? -1 : 1, st = rep.stroke;
    const pz = POS_Z[st] || 7.6, px = 1.3 * hs;
    const Sh = [px + 0.19 * hs, over ? 1.55 : 1.42, pz], arm = over ? 0.62 : 0.58;
    const bias = over ? [0, 0.3, -0.2] : [0, -0.8, -0.3];
    const model = q => { const d = Q.rot(q, [0, 1, 0]); const a = [d[0] + bias[0], d[1] + bias[1], d[2] + bias[2]]; const L = Math.hypot(a[0], a[1], a[2]) || 1; return [Sh[0] + arm * a[0] / L, Math.max(0.32, Sh[1] + arm * a[1] / L), Sh[2] + arm * a[2] / L]; };
    let Hs;
    if (rep.p && rep.p.length === rep.q.length) {
      const pi = peakIdx(rep), A = model(rep.q[pi]);
      let m = 0; rep.p.forEach(x => { m = Math.max(m, Math.hypot(x[0], x[1], x[2])); });
      const k = m > 2.2 ? 2.2 / m : 1; // keep a drifting path inside arm's reach of the body
      Hs = rep.p.map(x => [A[0] + x[0] * k, A[1] + x[1] * k, A[2] + x[2] * k]);
    } else Hs = rep.q.map(model);
    // move the whole path so the racket head is at this stroke's contact point at the moment of contact
    const cp = CONTACT[st] || CONTACT.FH, side = cp.byFace ? (rep.face || 1) : 1;
    const Ct = [px + hs * side * cp.s, cp.y, pz - cp.f];
    const ca = contactAt(rep), q0 = rep.q[ca.i], q1 = rep.q[ca.i + 1] || q0;
    const head = (h, q) => V3.add(h, Q.rot(q, [0, HEAD_Y, 0]), 1);
    const Cc = V3.add(V3.scale(head(Hs[ca.i], q0), 1 - ca.f), head(Hs[ca.i + 1] || Hs[ca.i], q1), ca.f);
    const off = V3.add(Ct, Cc, -1);
    Hs = Hs.map(h => V3.add(h, off, 1));
    // keep the hand off the floor and the racket tip above it (a lob's backswing can reach down low)
    Hs.forEach((h, i) => { const dy = Q.rot(rep.q[i], [0, 1, 0])[1]; h[1] = Math.max(h[1], 0.22, 0.04 - TIP_Y * dy); });
    const ser = repSeries(rep);
    return rep.q.map((q, i) => {
      const H = Hs[i];
      const at = y => { const v = Q.rot(q, [0, y, 0]); return [H[0] + v[0], H[1] + v[1], H[2] + v[2]]; };
      return { t: rep.t[i], w: rep.w[i], kmh: ser[i], q, H, C: at(HEAD_Y), tip: at(TIP_Y), thr: at(0.12), W: Q.rot(q, [1, 0, 0]) };
    });
  }
  const BALL_RES = { in: ['Masuk', 'ok'], net: ['Nyangkut net', 'warn'], short: ['Nggak nyampe net', 'warn'], long: ['Kepanjangan', 'warn'], wide: ['Melebar', 'warn'], back: ['Nggak maju', 'warn'] };
  const flightCache = new Map();
  /* flight: gravity, air drag and the Magnus push of the spin (backspin lifts, sidespin curves). In the opponent's court
     the ball bounces (turf: 74% of the drop speed back; friction with the spin — a slice skids low, topspin kicks on, a
     víbora's sidespin kicks sideways) and is followed to the glass. */
  function ballFlight(rep) {
    const key = rep.id + '|' + rep.k + '|' + rep.t.length; if (flightCache.has(key)) return flightCache.get(key);
    const R = aligned(rep), F = computeFrames(rep), ca = contactAt(rep), F0 = F[ca.i], F1 = F[ca.i + 1] || F0;
    const n = Q.rot(Q.slerp(F0.q, F1.q, ca.f), [0, 0, rep.face || 1]), Cc = V3.add(V3.scale(F0.C, 1 - ca.f), F1.C, ca.f);
    const Ln = launchBall(V3.scale(R.vc, rep.k || 1), n), spin0 = Ln.w.slice();
    // an overhead answers a lob: the falling ball (≈40 km/h, coming down at ~50°) bounces off the face too (×0.35)
    if (STROKES[rep.stroke].over) { const vn = V3.dot(LOB_IN, n); if (vn < 0) Ln.u = V3.add(Ln.u, n, -(BALL_RATIO - 1) * vn); }
    let p = V3.add(Cc, n, 0.052), vel = Ln.u.slice(), w = Ln.w.slice(), tt = 0, res = null, netY = null, apex = p[1], land = null, tLand = null, step = 0;
    const pts = [p.slice()], ts = [0], G = 9.81, dt = 1 / 240, KD = AIR * 0.55, sp = V3.len(vel);
    const accel = (v, w) => {
      const s = V3.len(v); let a = [-KD * s * v[0], -G - KD * s * v[1], -KD * s * v[2]];
      const wl = V3.len(w);
      if (wl > 1 && s > 0.5) { const S = BALL_R * wl / s, CL = 1 / (2.022 + 0.981 / S), m = V3.cross(w, v), ml = V3.len(m); if (ml > 1e-9) a = V3.add(a, m, AIR * CL * s * s / ml); }
      return a;
    };
    const push = (force) => { if (++step % 4 === 0 || force) { pts.push(p.slice()); ts.push(tt); } };
    if (Math.hypot(vel[0], vel[2]) < 0.2 * sp || vel[2] > -0.3) res = 'back';
    // 1) to the first touch: net, ground, glass
    while (!res && tt < 4) {
      const np = V3.add(p, vel, dt); vel = V3.add(vel, accel(vel, w), dt); w = V3.scale(w, 1 - dt / 6); tt += dt;
      if (p[2] > 0 && np[2] <= 0) { // crossing the net plane
        const fr = p[2] / (p[2] - np[2]), y = p[1] + (np[1] - p[1]) * fr; netY = y;
        if (y < NET_H + BALL_R) { res = 'net'; np[0] = p[0] + (np[0] - p[0]) * fr; np[1] = y; np[2] = 0.06; }
      }
      if (!res && np[1] <= BALL_R) { np[1] = BALL_R; land = np.slice(); tLand = tt; res = np[2] >= 0 ? 'short' : Math.abs(np[0]) <= 5 ? 'in' : 'wide'; }
      if (!res && np[2] <= -10 + BALL_R) { np[2] = -10 + BALL_R; res = 'long'; }
      if (!res && np[2] < 0 && Math.abs(np[0]) >= 5 - BALL_R) res = 'wide';
      p = np; apex = Math.max(apex, p[1]); push(!!res);
    }
    if (!res) res = 'long';
    let after = null;
    if (res === 'in') { // 2) the bounce, then on to the glass (or a second bounce)
      const vy = vel[1], vc = [vel[0] + BALL_R * w[2], vel[2] - BALL_R * w[0]], vcl = Math.hypot(vc[0], vc[1]);
      vel[1] = -0.74 * vy;
      if (vcl > 1e-6) {
        const dv = Math.min(0.55 * 1.74 * Math.abs(vy), 0.4 * vcl), ux = vc[0] / vcl, uz = vc[1] / vcl;
        vel[0] -= dv * ux; vel[2] -= dv * uz; w[0] += 1.5 * dv * uz / BALL_R; w[2] -= 1.5 * dv * ux / BALL_R;
      }
      after = { h: 0, wall: null, x0: p[0] }; let t2 = 0, tw = null;
      while (t2 < 1.6) {
        const np = V3.add(p, vel, dt); vel = V3.add(vel, accel(vel, w), dt); w = V3.scale(w, 1 - dt / 6); tt += dt; t2 += dt;
        if (tw == null) {
          if (Math.abs(np[0]) >= 5 - BALL_R && np[1] < 3) { np[0] = Math.sign(np[0]) * (5 - BALL_R); vel[0] *= -0.6; after.wall = 'side'; tw = t2; }
          else if (np[2] <= -10 + BALL_R && np[1] < 3) { np[2] = -10 + BALL_R; vel[2] *= -0.6; after.wall = 'back'; tw = t2; }
        }
        if (np[1] <= BALL_R && vel[1] < 0) { np[1] = BALL_R; p = np; push(true); break; }
        p = np; after.h = Math.max(after.h, p[1]); push(false);
        if (tw != null && t2 - tw > 0.45) break;
      }
      push(true);
    } else if (res !== 'back' && res !== 'short') { // drop from the net / glass to the ground
      let y = p[1], vy = Math.min(0, vel[1]) * 0.3, t2 = tt; const z = res === 'net' ? 0.06 : p[2], x = p[0];
      while (y > BALL_R) { vy -= G / 60; y = Math.max(BALL_R, y + vy / 60); t2 += 1 / 60; pts.push([x, y, z]); ts.push(t2); }
      if (!land) land = [x, BALL_R, z]; tt = t2;
    }
    if (tLand == null && land) tLand = tt;
    const out = { pts, ts, res, netY, apex, land, depth: land && land[2] < 0 ? -land[2] : null, tEnd: tt, tLand, speed: sp, spin: spin0, dir: [Ln.u[0], 0, Ln.u[2]], after };
    flightCache.set(key, out); return out;
  }
  // spin type relative to the ball's direction: backspin (slice) / topspin around the sideways axis, sidespin around "up"
  function spinInfo(fl) {
    const w = fl.spin, tot = V3.len(w), rpm = tot * 60 / (2 * Math.PI);
    if (rpm < 400) return { rpm, kind: 'Hampir tanpa spin', side: 0, back: 0 };
    const dl = Math.hypot(fl.dir[0], fl.dir[2]) || 1, d = [fl.dir[0] / dl, 0, fl.dir[2] / dl];
    const back = V3.dot(w, V3.cross(d, [0, 1, 0])) / tot, side = w[1] / tot;
    const s = Math.abs(side) > 0.3;
    const kind = Math.abs(side) > 0.8 ? 'Spin samping' : back >= 0 ? (s ? 'Slice + samping' : 'Slice') : (s ? 'Topspin + samping' : 'Topspin');
    return { rpm, kind, side, back };
  }

  /* ===================== 3D replay engine (three.js, loaded on demand) ===================== */
  const R3D = (() => {
    let THREEp = null, THREE = null, renderer = null, scene = null, camera = null, canvas = null, rep = null, ro = null;
    let F = [], pi = 0, racket = null, swingGrp = null, sun = null, ghosts = [], pathL = null, p0 = 0, p1 = 0;
    let arc = null, a0 = 0, a1 = 0, arcSegs = 0, ballM = null, ballSh = null, flightL = null, ringM = null, flight = null, spinAx = null, spinVis = 0;
    let orbit = null, views = null, detach = null, camMode = 'auto', curT = 0, onManual = null;
    const ARC_RAD = 8;
    function loadThree() {
      if (window.THREE) return Promise.resolve(window.THREE);
      return THREEp || (THREEp = new Promise((res, rej) => {
        const s = document.createElement('script'); s.src = 'vendor/three.min.js';
        s.onload = () => res(window.THREE); s.onerror = () => { THREEp = null; rej(new Error('three.js failed')); };
        document.head.appendChild(s);
      }));
    }
    const basic = (color, extra = {}) => new THREE.MeshBasicMaterial(Object.assign({ color }, extra));
    const V = a => new THREE.Vector3(a[0], a[1], a[2]);
    function canvasTex(w, h, draw, repeat) {
      const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
      const t = new THREE.CanvasTexture(c); if ('encoding' in t) t.encoding = THREE.sRGBEncoding;
      if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
      t.anisotropy = 4; return t;
    }

    /* ---- padel court: blue turf, white lines, glass back walls, mesh fences, net ---- */
    function buildCourt() {
      scene = new THREE.Scene();
      scene.background = canvasTex(4, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5b9cd8'); gr.addColorStop(0.6, '#a8cff0'); gr.addColorStop(1, '#e2eef8'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
      scene.fog = new THREE.Fog(0xcfe2f2, 26, 80);
      camera = new THREE.PerspectiveCamera(50, 1, 0.03, 200);
      scene.add(new THREE.HemisphereLight(0xeef5ff, 0x2a4e7c, 0.8));
      sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.012;
      Object.assign(sun.shadow.camera, { near: 0.5, far: 30, left: -2.6, right: 2.6, top: 2.6, bottom: -2.6 });
      scene.add(sun); scene.add(sun.target);
      const plane = (w, h, mat) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      const turf = (base, n) => canvasTex(256, 256, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); for (let i = 0; i < n; i++) { const l = Math.random(); g.fillStyle = l < 0.5 ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.06)'; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 1.5, 1 + Math.random() * 1.5); } }, [6, 12]);
      const ground = plane(90, 100, new THREE.MeshLambertMaterial({ color: 0x24497a })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.004; ground.receiveShadow = true; scene.add(ground);
      const court = plane(10, 20, new THREE.MeshLambertMaterial({ color: 0xffffff, map: turf('#2f6ec0', 9000) })); court.rotation.x = -Math.PI / 2; court.receiveShadow = true; scene.add(court);
      const lineMat = basic(0xf6f9ff);
      const line = (x1, z1, x2, z2) => { const len = Math.hypot(x2 - x1, z2 - z1); const m = plane(len, 0.05, lineMat); m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(z2 - z1, x2 - x1); m.position.set((x1 + x2) / 2, 0.003, (z1 + z2) / 2); m.receiveShadow = true; scene.add(m); };
      line(-5, 6.95, 5, 6.95); line(-5, -6.95, 5, -6.95); line(0, -6.95, 0, 6.95); line(-5, 9.97, 5, 9.97); line(-5, -9.97, 5, -9.97); line(-4.97, -10, -4.97, 10); line(4.97, -10, 4.97, 10);
      // net: fine mesh texture, white band, dark posts
      const netTex = canvasTex(256, 32, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(20,28,38,.85)'; g.lineWidth = 1; for (let x = 0; x <= w; x += 4) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, h); g.stroke(); } for (let y = 0; y <= h; y += 4) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(w, y + 0.5); g.stroke(); } }, [6, 1]);
      const net = plane(10, 0.86, new THREE.MeshBasicMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.05 })); net.position.set(0, 0.45, 0); scene.add(net);
      const band = new THREE.Mesh(new THREE.BoxGeometry(10, 0.05, 0.02), basic(0xf6f9ff)); band.position.set(0, 0.88, 0); scene.add(band);
      const darkM = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
      [-5.06, 5.06].forEach(x => { const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.95, 0.08), darkM); post.position.set(x, 0.475, 0); post.castShadow = true; scene.add(post); });
      // glass (back walls + first 4 m of the side walls, stepped)
      const glassMat = basic(0xd9ecfb, { transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false });
      const glassEdge = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
      const panel = (w, h, x, y, z, ry) => { const g = new THREE.PlaneGeometry(w, h); const m = new THREE.Mesh(g, glassMat); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), glassEdge); e.position.copy(m.position); e.rotation.copy(m.rotation); scene.add(e); };
      [-10, 10].forEach(z => { for (let i = 0; i < 5; i++) panel(2, 3, -4 + i * 2, 1.5, z, 0); });
      [-5, 5].forEach(x => [-1, 1].forEach(sg => { panel(2, 3, x, 1.5, sg * 9, Math.PI / 2); panel(2, 2, x, 1, sg * 7, Math.PI / 2); }));
      // posts
      const post = (x, z, h) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.07, h, 0.07), darkM); m.position.set(x, h / 2, z); scene.add(m); };
      [-10, 10].forEach(z => { for (let x = -5; x <= 5.001; x += 2) post(x, z, 4); });
      [-5, 5].forEach(x => { for (let z = -8; z <= 8.001; z += 2) post(x, z, Math.abs(z) >= 6 ? 4 : 3); });
      // wire mesh: above the back glass, along the sides
      const pts = [], add = (a, b) => pts.push(new THREE.Vector3(a[0], a[1], a[2]), new THREE.Vector3(b[0], b[1], b[2]));
      const S = 0.25;
      [-10, 10].forEach(z => { for (let x = -5; x <= 5.001; x += S) add([x, 3, z], [x, 4, z]); for (let y = 3; y <= 4.001; y += S) add([-5, y, z], [5, y, z]); });
      [-5, 5].forEach(x => {
        for (let z = -6; z <= 6.001; z += S) add([x, 0, z], [x, 3, z]);
        for (let y = 0; y <= 3.001; y += S) add([x, y, -6], [x, y, 6]);
        [-1, 1].forEach(sg => { for (let z = 6; z <= 10.001; z += S) add([x, Math.abs(z) > 8 ? 3 : 2, sg * z], [x, 4, sg * z]); for (let y = 3; y <= 4.001; y += S) add([x, y, sg * 6], [x, y, sg * 10]); add([x, 2, sg * 6], [x, 2, sg * 8]); });
      });
      scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x1b2632, transparent: true, opacity: 0.42 })));
      const rail = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
      [-5, 5].forEach(x => { const r = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 12), rail); r.position.set(x, 3, 0); scene.add(r); });
    }

    /* ---- padel racket: hand at the origin, racket axis = +y, forehand face (phone screen) = +z ---- */
    const RX = 0.13, RY = 0.142, RT = 0.038;
    const FACE_COLORS = { classic: '#ff7a3d', white: '#eef2f5', teal: '#19a896', orange: '#ff7a3d' };
    const ellipse = (rx, ry, cy = 0) => { const s = new THREE.Shape(); s.absellipse(0, cy, rx, ry, 0, Math.PI * 2, false, 0); return s; };
    function faceTex(color) {
      return canvasTex(256, 280, (g, w, h) => {
        g.fillStyle = color; g.fillRect(0, 0, w, h);
        const gr = g.createRadialGradient(w * 0.38, h * 0.32, 10, w / 2, h / 2, w * 0.7); gr.addColorStop(0, 'rgba(255,255,255,.16)'); gr.addColorStop(1, 'rgba(0,0,0,.12)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(0,0,0,.34)';
        for (let r = 0, y = 26; y < h - 20; y += 19, r++) for (let x = 22 + (r % 2) * 11; x < w - 18; x += 22) {
          const nx = (x - w / 2) / (w * 0.42), ny = (y - h / 2) / (h * 0.42); if (nx * nx + ny * ny > 1) continue;
          g.beginPath(); g.arc(x, y, 5.2, 0, Math.PI * 2); g.fill();
        }
      });
    }
    function uvPlanar(geo, rx, ry, cy = 0) { const p = geo.attributes.position, uv = geo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / (2 * rx) + 0.5, (p.getY(i) - cy) / (2 * ry) + 0.5); uv.needsUpdate = true; return geo; }
    function makeRacket() {
      const g = new THREE.Group(), L = set.look;
      const frameM = new THREE.MeshStandardMaterial({ color: 0x16191e, roughness: 0.38, metalness: 0.25 });
      const ring = ellipse(RX, RY); ring.holes.push(ellipse(RX - 0.014, RY - 0.014));
      const rg = new THREE.ExtrudeGeometry(ring, { depth: RT - 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 44 });
      rg.translate(0, HEAD_Y, -(RT - 0.008) / 2); g.add(new THREE.Mesh(rg, frameM));
      const fr = ellipse(RX - 0.012, RY - 0.012, HEAD_Y), fg = uvPlanar(new THREE.ShapeGeometry(fr, 44), RX - 0.012, RY - 0.012, HEAD_Y);
      const front = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: faceTex(FACE_COLORS[L.racket] || FACE_COLORS.classic), roughness: 0.62, emissive: 0x000000 }));
      front.position.z = RT / 2 - 0.002; g.add(front);
      const back = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: faceTex('#353c45'), roughness: 0.7 }));
      back.rotation.y = Math.PI; back.position.z = -RT / 2 + 0.002; g.add(back);
      // throat (open bridge) + handle + orange end cap
      const th = new THREE.Shape(); th.moveTo(-0.021, 0.07); th.lineTo(0.021, 0.07); th.lineTo(0.092, HEAD_Y - RY + 0.045); th.lineTo(-0.092, HEAD_Y - RY + 0.045); th.closePath();
      const hole = new THREE.Path(); hole.moveTo(0, 0.102); hole.lineTo(0.048, HEAD_Y - RY + 0.03); hole.lineTo(-0.048, HEAD_Y - RY + 0.03); hole.closePath(); th.holes.push(hole);
      const thg = new THREE.ExtrudeGeometry(th, { depth: 0.026, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1 }); thg.translate(0, 0, -0.013);
      g.add(new THREE.Mesh(thg, frameM));
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.0165, 0.0185, 0.14, 20), new THREE.MeshStandardMaterial({ color: 0x23272d, roughness: 0.92 })); grip.position.y = 0.0; g.add(grip);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.012, 20), new THREE.MeshStandardMaterial({ color: 0xff6a2b, roughness: 0.6 })); cap.position.y = -0.074; g.add(cap);
      if (L.arrow) {
        const am = basic(0x0b6b60), z0 = RT / 2 + 0.004;
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.14, 10), am); shaft.rotation.x = Math.PI / 2; shaft.position.set(0, HEAD_Y, z0 + 0.07); g.add(shaft);
        const head = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.055, 16), am); head.rotation.x = Math.PI / 2; head.position.set(0, HEAD_Y, z0 + 0.165); g.add(head);
      }
      g.traverse(o => { if (o.isMesh) o.castShadow = true; });
      return g;
    }
    let ghostGeo = null, ghostEdge = null, ghostMat = null, ghostLine = null;
    function makeGhost() {
      if (!ghostGeo) {
        const hand = new THREE.Shape(); hand.moveTo(-0.017, -0.075); hand.lineTo(0.017, -0.075); hand.lineTo(0.02, 0.07); hand.lineTo(0.088, HEAD_Y - RY + 0.04); hand.lineTo(-0.088, HEAD_Y - RY + 0.04); hand.lineTo(-0.02, 0.07); hand.closePath();
        ghostGeo = new THREE.ShapeGeometry([ellipse(RX, RY, HEAD_Y), hand], 32);
        ghostEdge = new THREE.EdgesGeometry(new THREE.ShapeGeometry(ellipse(RX, RY, HEAD_Y), 32));
        ghostMat = basic(0xf2f8ff, { transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false });
        ghostLine = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
      }
      const g = new THREE.Group(); g.add(new THREE.Mesh(ghostGeo, ghostMat)); g.add(new THREE.LineSegments(ghostEdge, ghostLine)); return g;
    }

    function buildSwing() {
      if (swingGrp) { scene.remove(swingGrp); swingGrp.traverse(o => { if (o.geometry && o.geometry !== ghostGeo && o.geometry !== ghostEdge) o.geometry.dispose(); if (o.material && o.material !== ghostMat && o.material !== ghostLine) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); }
      swingGrp = new THREE.Group(); scene.add(swingGrp);
      F = computeFrames(rep); pi = peakIdx(rep);
      const n = F.length, pk = F[pi].kmh || 1, L = set.look;
      // the stroke: from the take-back to the end of the follow-through (head speed above 12% of the peak)
      p0 = pi; while (p0 > 0 && (F[p0 - 1].kmh > pk * 0.12 || pi - p0 < 6)) p0--;
      p1 = pi; while (p1 < n - 1 && (F[p1 + 1].kmh > pk * 0.12 || p1 - pi < 6)) p1++;
      // fast part (ghosts) and peak zone (glow arc)
      let g0 = pi, g1 = pi; while (g0 > 0 && F[g0 - 1].kmh > pk * 0.25) g0--; while (g1 < n - 1 && F[g1 + 1].kmh > pk * 0.25) g1++;
      a0 = pi; a1 = pi; while (a0 > 0 && F[a0 - 1].kmh >= pk * 0.7) a0--; while (a1 < n - 1 && F[a1 + 1].kmh >= pk * 0.7) a1++;
      a0 = Math.max(0, a0 - 1); a1 = Math.min(n - 1, a1 + 1); while (a1 - a0 < 4) { if (a0 > 0) a0--; if (a1 < n - 1) a1++; if (a0 === 0 && a1 === n - 1) break; }
      // head path line (whole stroke)
      pathL = null;
      if (L.dots && p1 > p0) {
        pathL = new THREE.Line(new THREE.BufferGeometry().setFromPoints(F.slice(p0, p1 + 1).map(f => V(f.C))), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
        pathL.geometry.setDrawRange(0, 0); swingGrp.add(pathL);
      }
      // ghost rackets spaced along the head path
      ghosts = [];
      if (L.ghosts) {
        const step = { sparse: 0.12, normal: 0.075, dense: 0.045 }[L.ghostDensity] || 0.075; let last = null;
        for (let i = g0; i <= g1 && ghosts.length < 48; i++) {
          if (last && Math.hypot(F[i].C[0] - last[0], F[i].C[1] - last[1], F[i].C[2] - last[2]) < step) continue;
          const gr = makeGhost(); gr.position.set(F[i].H[0], F[i].H[1], F[i].H[2]); gr.quaternion.set(F[i].q[0], F[i].q[1], F[i].q[2], F[i].q[3]); gr.userData.i = i; gr.visible = false; swingGrp.add(gr); ghosts.push(gr); last = F[i].C;
        }
      }
      // glow arc where the racket head is fastest (= where the ball belongs)
      arc = null;
      if (L.ribbon && a1 > a0) {
        const curve = new THREE.CatmullRomCurve3(F.slice(a0, a1 + 1).map(f => V(f.C))); arcSegs = (a1 - a0) * 6;
        const core = new THREE.Mesh(new THREE.TubeGeometry(curve, arcSegs, 0.0105, ARC_RAD, false), basic(0xffd27a));
        const glow = new THREE.Mesh(new THREE.TubeGeometry(curve, arcSegs, 0.03, ARC_RAD, false), basic(0xff6a2b, { transparent: true, opacity: 0.36, depthWrite: false }));
        arc = [core, glow]; arc.forEach(m => { m.geometry.setDrawRange(0, 0); swingGrp.add(m); });
      }
      racket = makeRacket(); swingGrp.add(racket);
      // ball: waits at the contact point, flies after the peak
      flight = ballFlight(rep);
      // padel ball with its seam, so the spin shows (slowed down to stay readable)
      const seam = canvasTex(128, 64, (g, w, h) => { g.fillStyle = '#e3f23a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fbfff0'; g.lineWidth = 3.2; g.beginPath(); for (let x = 0; x <= w; x += 2) { const y = h / 2 + h * 0.27 * Math.sin(x / w * Math.PI * 4); x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); });
      ballM = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 24, 16), new THREE.MeshStandardMaterial({ map: seam, roughness: 0.55, emissive: 0x4a5200, emissiveIntensity: 0.35 }));
      const wl = V3.len(flight.spin || [0, 0, 0]);
      spinAx = wl > 20 ? new THREE.Vector3(flight.spin[0] / wl, flight.spin[1] / wl, flight.spin[2] / wl) : null; spinVis = Math.min(wl * 0.08, 26);
      ballM.visible = !!L.peak; swingGrp.add(ballM);
      ballSh = new THREE.Mesh(new THREE.CircleGeometry(0.05, 18), basic(0x000000, { transparent: true, opacity: 0.25, depthWrite: false })); ballSh.rotation.x = -Math.PI / 2; ballSh.visible = false; swingGrp.add(ballSh);
      flightL = new THREE.Line(new THREE.BufferGeometry().setFromPoints(flight.pts.map(p => V(p))), new THREE.LineBasicMaterial({ color: 0xf2ff5a, transparent: true, opacity: 0.9 }));
      flightL.geometry.setDrawRange(0, 0); swingGrp.add(flightL);
      ringM = null;
      if (flight.land) {
        ringM = new THREE.Mesh(new THREE.RingGeometry(0.13, 0.21, 40), basic(flight.res === 'in' ? 0x2fe0b4 : 0xff6a2b, { side: THREE.DoubleSide }));
        ringM.rotation.x = -Math.PI / 2; ringM.position.set(flight.land[0], 0.012, flight.land[2]); ringM.visible = false; swingGrp.add(ringM);
      }
      // camera presets around the swing
      const c = [0, 0, 0]; for (let i = g0; i <= g1; i++) for (let j = 0; j < 3; j++) c[j] += F[i].C[j] / (g1 - g0 + 1);
      let ext = 0.3; for (let i = p0; i <= p1; i++) ext = Math.max(ext, Math.hypot(F[i].C[0] - c[0], F[i].C[1] - c[1], F[i].C[2] - c[2]));
      const hs = rep.hand === 'L' ? -1 : 1, C = F[pi].C, rB = clamp(ext * 2.0 + 1.1, 1.9, 3.8);
      // cameras are placed by eye position and kept inside the glass box (never behind the fence)
      const inBox = e => [clamp(e[0], -4.7, 4.7), clamp(e[1], 0.3, 6), clamp(e[2], -9.6, 9.65)];
      const fromEye = (eye, tg) => { const e = inBox(eye), d = [e[0] - tg[0], e[1] - tg[1], e[2] - tg[2]], r = Math.hypot(d[0], d[1], d[2]); return { target: new THREE.Vector3(tg[0], tg[1], tg[2]), az: Math.atan2(d[0], d[2]), pol: Math.acos(clamp(d[1] / r, -1, 1)), r }; };
      const tc = [c[0], c[1] + 0.05, c[2]];
      const home = fromEye([c[0] + 0.5 * hs, c[1] + 0.62, c[2] + rB], tc);
      const Ld = flight.land || [C[0], 0, C[2] - 6];
      views = {
        swing: home,
        side: fromEye([c[0] + rB * 0.95 * hs, c[1] + 0.3, c[2] - 0.1], tc),
        court: fromEye([C[0] * 0.45, 3.4, C[2] + 2.6], [(C[0] + Ld[0]) / 2, 0.5, (C[2] + Ld[2]) / 2])
      };
      sun.position.set(c[0] - 2.2, c[1] + 7, c[2] + 2.8); sun.target.position.set(c[0], 0.6, c[2]); sun.target.updateMatrixWorld();
      if (!orbit) orbit = { target: home.target.clone(), az: home.az, pol: home.pol, r: home.r };
    }
    function desired() {
      if (camMode === 'manual' || !views) return null;
      if (camMode === 'auto') return curT > 0.12 && flight && flight.res !== 'back' ? views.court : views.swing;
      return views[camMode] || null;
    }
    function camUpdate() {
      const d = desired();
      if (d) {
        const k = 0.08; let da = d.az - orbit.az; da = Math.atan2(Math.sin(da), Math.cos(da));
        orbit.az += da * k; orbit.pol += (d.pol - orbit.pol) * k; orbit.r += (d.r - orbit.r) * k; orbit.target.lerp(d.target, k);
      }
      const { az, pol, r, target } = orbit;
      camera.position.set(target.x + r * Math.sin(pol) * Math.sin(az), target.y + r * Math.cos(pol), target.z + r * Math.sin(pol) * Math.cos(az));
      camera.lookAt(target);
    }
    function fit() {
      if (!renderer || !canvas) return;
      const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    // one finger: orbit · two fingers: pan + pinch zoom · wheel: zoom
    function attachOrbit() {
      const pts = new Map(); let pinch0 = 0, r0 = 0, mid0 = null;
      const manual = () => { if (camMode !== 'manual') { camMode = 'manual'; onManual && onManual(); } };
      const two = () => { const [a, b] = [...pts.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
      const down = e => { canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) { const m = two(); pinch0 = m.d; r0 = orbit.r; mid0 = m; } };
      const move = e => {
        if (!pts.has(e.pointerId)) return; const p = pts.get(e.pointerId); const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
        if (Math.abs(dx) + Math.abs(dy) > 0) manual();
        if (pts.size === 1) { orbit.az -= dx * 0.008; orbit.pol = clamp(orbit.pol - dy * 0.006, 0.1, 1.56); }
        else if (pts.size === 2 && pinch0 > 0) {
          const m = two(); orbit.r = clamp(r0 * pinch0 / Math.max(1, m.d), 0.6, 22);
          const k = orbit.r * 0.0016, mx = m.x - mid0.x, my = m.y - mid0.y; mid0 = m;
          const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
          orbit.target.addScaledVector(right, -mx * k).addScaledVector(up, my * k);
        }
      };
      const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch0 = 0; };
      const wheel = e => { e.preventDefault(); manual(); orbit.r = clamp(orbit.r * (1 + e.deltaY * 0.0012), 0.6, 22); };
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
      canvas = cv; rep = r; orbit = null; camMode = 'auto';
      if (THREE.ColorManagement && 'legacyMode' in THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;
      renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      if ('outputEncoding' in renderer) renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      buildCourt(); buildSwing(); fit();
      detach = attachOrbit();
      if (window.ResizeObserver) { ro = new ResizeObserver(fit); ro.observe(cv); }
    }
    function setTime(tt) {
      if (!F.length) return;
      curT = tt;
      let i = 0; while (i < F.length - 2 && F[i + 1].t <= tt) i++;
      const a = F[i], b = F[i + 1] || a, f = clamp((tt - a.t) / Math.max(1e-6, b.t - a.t), 0, 1);
      const H = a.H.map((v, j) => v + (b.H[j] - v) * f), q = Q.slerp(a.q, b.q, f);
      racket.position.set(H[0], H[1], H[2]); racket.quaternion.set(q[0], q[1], q[2], q[3]);
      const cur = i + f;
      if (pathL) pathL.geometry.setDrawRange(0, clamp(Math.floor(cur - p0) + 1, 0, p1 - p0 + 1));
      ghosts.forEach(g => { g.visible = g.userData.i <= cur; });
      if (arc) { const fr = clamp((cur - a0) / (a1 - a0), 0, 1), cnt = Math.round(fr * arcSegs) * ARC_RAD * 6; arc.forEach(m => m.geometry.setDrawRange(0, cnt)); }
      // ball
      if (flight && ballM) {
        const show = !!set.look.peak, fly = tt >= 0 && flight.res !== 'back';
        if (!fly) {
          const P = flight.pts[0]; ballM.position.set(P[0], P[1], P[2]); ballM.visible = show; ballSh.visible = false; ballM.quaternion.set(0, 0, 0, 1);
          flightL.geometry.setDrawRange(0, 0); if (ringM) ringM.visible = false;
        } else {
          const ts = flight.ts; let k = 0; while (k < ts.length - 2 && ts[k + 1] <= tt) k++;
          const q0 = flight.pts[k], q1 = flight.pts[k + 1] || q0, fr = clamp((tt - ts[k]) / Math.max(1e-6, (ts[k + 1] || ts[k] + 1) - ts[k]), 0, 1);
          const P = [q0[0] + (q1[0] - q0[0]) * fr, q0[1] + (q1[1] - q0[1]) * fr, q0[2] + (q1[2] - q0[2]) * fr];
          ballM.position.set(P[0], P[1], P[2]); ballSh.position.set(P[0], 0.006, P[2]); ballM.visible = true; ballSh.visible = true;
          if (spinAx) ballM.quaternion.setFromAxisAngle(spinAx, spinVis * tt);
          flightL.geometry.setDrawRange(0, k + 2);
          if (ringM) ringM.visible = tt >= (flight.tLand != null ? flight.tLand : flight.tEnd) - 1e-3;
        }
      }
    }
    function render() {
      if (!renderer) return; camUpdate();
      if (ballM) { const k = clamp(camera.position.distanceTo(ballM.position) / 3.2, 1, 3.4); ballM.scale.setScalar(k); ballSh.scale.setScalar(k); }
      renderer.render(scene, camera);
    }
    function unmount() {
      mountId++;
      if (detach) detach(); detach = null; if (ro) ro.disconnect(); ro = null;
      if (scene) scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); });
      if (scene && scene.background && scene.background.dispose) scene.background.dispose();
      if (renderer) { renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) { /* ignore */ } }
      renderer = null; scene = null; F = []; ghosts = []; swingGrp = null; orbit = null; views = null; onManual = null; arc = null; pathL = null;
      ghostGeo = ghostEdge = ghostMat = ghostLine = null;
    }
    return {
      mount, unmount, setTime, render,
      rebuild() { if (renderer) { buildSwing(); setTime(curT); } },
      setView(m) { camMode = m; },
      resetView() { camMode = 'auto'; },
      set onManual(fn) { onManual = fn; },
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
    const det = new Detector({ getT: thr, over: () => { const b = cur(); return !!(b && b.stroke && STROKES[b.stroke].over); }, onStroke: L => {
      if (!active()) return;
      const b = cur(), r = strokeSpeed(L).kmh, up = !!L.upgradeOf;
      if (!up) Snd.hit(clamp(r / 60, 0, 1));
      if (up) { if (!st.count) return; st.balls.pop(); } else { st.count++; st.total++; }
      st.best = Math.max(st.best, r); st.balls.push(ballOf(r));
      const R = res[st.bi]; if (!up) R.done++; R.best = Math.max(R.best, r);
      recordSwing(r, up ? null : b.stroke, !up); if (prevBest > 0 && r > prevBest) st.newBest = true;
      if (up) { $('#rsL').textContent = '≈' + fv(ballOf(r)); $('#rsLr').textContent = fv(r) + ' raket'; $('#rsB').textContent = '≈' + fv(ballOf(st.best)); $('#rsBr').textContent = fv(st.best) + ' raket'; return; }
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
    }, onUpgrade: (F, L) => { L.upgradeOf = F; det.onStroke(L); }, onReject: why => {
      if (!active()) return;
      const nx = $('#bNext'); nx.textContent = REJECT_TXT[why]; nx.classList.add('warn');
      clearTimeout(st.cueT); st.cueT = setTimeout(() => { nx.classList.remove('warn'); nx.textContent = nextLabel(st.bi + 1); }, 2600);
    } });
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
    cleanup = () => { unsub(); clearInterval(iv); clearTimeout(st.cueT); Wake.off(); Coach.stop(); };
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
    const sOk = r => Array.isArray(r.s) && r.s.length === r.t.length && r.s.every(Number.isFinite);
    const pOk = r => Array.isArray(r.p) && r.p.length === r.t.length && r.p.every(x => Array.isArray(x) && x.length === 3 && x.every(Number.isFinite));
    const replays = Array.isArray(o.replays) ? o.replays.filter(rOk).slice(-60).map(r => Object.assign({ id: str(r.id, 24), date: num(r.date), stroke: r.stroke, hand: r.hand === 'L' ? 'L' : 'R', k: clamp(num(r.k) || 1, 0.5, 2), star: !!r.star, src: r.src === 'gyro' ? 'gyro' : 'ori', peak: Math.max(0, num(r.peak)), sat: !!r.sat, t: r.t, w: r.w, q: r.q },
      sOk(r) ? { v: 2, s: r.s, face: r.face === -1 ? -1 : 1, hand3: !!r.hand3, p: pOk(r) ? r.p : null } : {})) : [];
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
        <p><b>1. Tanganmu.</b> Akselerometer ngukur seberapa kencang tanganmu dipercepat sepanjang ayunan. Dijumlahin dari awal ayunan, jadinya kecepatan tangan. Tiap kali HP sempat diam (posisi siap, akhir follow-through), hitungannya di-nol-in lagi biar nggak ngaco.</p>
        <p><b>2. Plus lecutan.</b> Giroskop ngukur seberapa cepat HP berputar. Kepala raket ada sekitar ${Math.round(R_HEAD * 100)} cm di depan tanganmu, jadi pas pergelangan nglecut, kepala raket nyapu busur lebih lebar dan lebih kencang dari tangan. Selisih itulah lecutan yang kamu latih.</p>
        <p><b>3. Angka raket</b> = kecepatan tangan + lecutan, di detik paling kencang. HP yang nggak punya akselerometer pakai giroskop aja (putaran × ${String(LEVER).replace('.', ',')} m).</p>
        <p><b>4. Bola ≈</b> raket × ${String(BALL_RATIO).replace('.', ',')}, buat bola diam yang kena pas di tengah muka raket (kayak servis). Bola rally yang datang kencang bisa balik lebih kencang, mishit lebih pelan, jadi anggap ini kira-kira, bukan radar.</p>
        <p>Kebanyakan giroskop HP mentok di sekitar 2000°/detik. Kalau ayunanmu lewat batas itu, angkanya ditandai "≥": minimal segitu, aslinya bisa lebih kencang.</p>
        <p>Angka ini paling pas buat bandingin progres kamu sendiri dari hari ke hari, bukan pengganti radar. Pernah diukur pakai radar? Samain lewat Kalibrasi kecepatan di Pengaturan.</p>
      </div>`, { close: closeOv });
  }

  /* ---------- sensor test ---------- */
  SCREENS.sensor = function () {
    app.innerHTML = `<section class="scr">
      ${subhdr('Tes sensor')}
      <p class="sub center" id="sStat"></p>
      <div class="card" style="padding:12px 12px 16px">
        <div class="gauge-wrap">${gaugeSVG()}<div class="gauge-num"><div class="n"><span id="sR">0</span></div><span class="u">${U()} raket, arah maju</span><span class="r">putaran total <b id="sW">0</b> °/dtk</span></div></div>
      </div>
      <div class="list">
        <div class="row"><span class="k">${ICON.target}Kalibrasi arah</span><span class="vs" id="sCal">–</span></div>
        <div class="row"><span class="k">${ICON.swing}Ayunan kehitung</span><span class="v" id="sN">0</span></div>
        <div class="row"><span class="k">${ICON.x}Ditolak</span><span class="vs" id="sRej">–</span></div>
        <div class="row"><span class="k">${ICON.boltL}Raket tercepat</span><span class="v or" id="sM">0</span></div>
        <div class="row"><span class="k">${ICON.sensor}Akselerometer</span><span class="vs" id="sAcc">–</span></div>
        <div class="row"><span class="k">${ICON.sensor}Orientasi α / β / γ</span><span class="vs num" id="sO">–</span></div>
      </div>
      <p class="note">Pegang HP kayak raket (atas HP = ujung raket, layar = muka forehand). Forehand, backhand, atau overhead (bandeja, víbora, smash): bunyi kalau kehitung. Ancang-ancang, raket jatuh di belakang punggung sebelum smash, balik ke posisi siap, atau cuma muter pergelangan: nggak bunyi. Kalau kalibrasi arah belum kekunci, gerak-gerakin HP pelan ke segala arah beberapa detik.</p>
      <div class="card" style="padding:14px 16px">
        <div class="chart-head"><h3>Rekam data mentah</h3><span class="note" id="rawN"></span></div>
        <p class="sub" style="margin-bottom:10px">Kalau deteksinya masih aneh di HP kamu: rekam 15 detik sambil ayun beberapa forehand & backhand, terus kirim file-nya ke yang bikin aplikasi ini buat disetel.</p>
        <button class="btn line small" data-act="raw" id="rawBtn">Mulai rekam 15 dtk</button>
      </div>
      <div class="grow"></div>
      ${simBtn()}
      <div class="row-btns"><button class="btn line small" data-act="recal">Kalibrasi ulang</button><button class="btn line small" data-act="reset">Reset angka</button></div>
    </section>`;
    let mx = 0, n = 0, rj = 0, curH = 0, curW = 0, raf = 0, rawT = null, rawEnd = 0;
    gaugeTh();
    const live = $('#gLive');
    const RJ = { short: 'kependekan', twist: 'muter pergelangan' };
    const det = new Detector({ getT: thr,
      onStroke: L => { const r = strokeSpeed(L).kmh; Snd.hit(clamp(r / 60, 0, 1)); n++; mx = Math.max(mx, r); $('#sN').textContent = n; gaugeLast(ballOf(r)); },
      onUpgrade: (F, L) => { const r = strokeSpeed(L).kmh; mx = Math.max(mx, r); gaugeLast(ballOf(r)); },
      onReject: why => { rj++; $('#sRej').textContent = `${rj} · ${RJ[why] || why}`; } });
    const unsub = Motion.sub(s => { det.feed(s); curH = Math.max(curH, s.perp); curW = Math.max(curW, s.w); });
    const loop = () => {
      const h = curH, w = curW; curH *= 0.85; curW *= 0.85;
      $('#sW').textContent = Math.round(w / DEG); $('#sR').textContent = fv(racketKmh(Math.max(0, h))); $('#sM').textContent = fv(mx) + ' ' + U();
      const pc = clamp(ballOf(racketKmh(Math.max(0, h))) / GMAX * 100, 0, 100); live.setAttribute('stroke-dasharray', `${pc.toFixed(1)} 100`); live.style.opacity = pc < 1.5 ? 0 : 1;
      const o = Motion.lastOri(); $('#sO').textContent = o ? `${Math.round(o.a)}° / ${Math.round(o.b)}° / ${Math.round(o.g)}°` : (Motion.isSim() ? 'simulasi' : '–');
      const c = Motion.calStatus(); $('#sCal').textContent = Motion.isSim() ? 'simulasi' : c.locked ? 'Kekunci ✓' : `Lagi kalibrasi… ${Math.min(99, Math.round(c.n / 40 * 100))}%`;
      const a = Motion.accStatus(); $('#sAcc').textContent = Motion.isSim() ? 'simulasi' : a.has === false ? 'nggak ada (pakai giroskop aja)' : a.n >= 15 ? `aktif ✓${a.sign < 0 ? ' (dibalik)' : ''}` : 'cek gravitasi… diamkan HP sebentar';
      $('#sStat').textContent = Motion.isSim() ? 'Mode simulasi: sensor gerak nggak ketemu di perangkat ini.' : `Giroskop aktif · ${Math.round(Motion.rate())} Hz`;
      if (rawT) $('#rawN').textContent = `${Math.max(0, Math.ceil((rawEnd - now()) / 1000))} dtk · ${Motion.rawCount()} data`;
      raf = requestAnimationFrame(loop);
    };
    loop(); Wake.on();
    async function rawDone() {
      rawT = null; const r = Motion.rawStop(); const b = $('#rawBtn'); if (b) { b.disabled = false; b.textContent = 'Rekam lagi'; }
      if (!r || !r.ev.length) { $('#rawN').textContent = 'nggak ada data'; return; }
      $('#rawN').textContent = `${r.ev.length} data ✓`;
      const name = `paaadel-sensor-${dayKey()}-${Date.now().toString(36)}.json`, text = JSON.stringify(r);
      try {
        const file = new File([text], name, { type: 'application/json' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Data sensor PAAADEL' }); return; }
      } catch (e) { if (e && e.name === 'AbortError') return; }
      try { const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000); toast('File data sensor lagi diunduh'); } catch (e) { toast('Browser ini nggak bisa nyimpen file'); }
    }
    cleanup = () => { unsub(); cancelAnimationFrame(raf); Wake.off(); if (rawT) { clearTimeout(rawT); Motion.rawStop(); } };
    actions = {
      back: () => go('settings'), sim: () => Motion.simSwing(),
      raw: b => { if (rawT || Motion.isSim()) return Motion.isSim() && toast('Butuh sensor beneran, bukan simulasi'); Motion.rawStart(); rawEnd = now() + 15000; b.disabled = true; b.textContent = 'Lagi ngerekam… ayun-ayun ya'; Snd.play('ding'); rawT = setTimeout(() => { Snd.play('done'); rawDone(); }, 15000); },
      recal: () => { Motion.recalibrate(); toast('Kalibrasi diulang. Gerak-gerakin HP pelan ke segala arah.'); },
      reset: () => { mx = 0; n = 0; rj = 0; $('#sN').textContent = 0; $('#sRej').textContent = '–'; const g = $('#gLast'); if (g) g.setAttribute('visibility', 'hidden'); }
    };
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
  window.__pala = { Motion, S, go, REPLAYS: () => REPLAYS, ballFlight, spinInfo, faceMetrics };
})();
