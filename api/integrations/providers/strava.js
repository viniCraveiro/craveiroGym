/* Strava (#478, idea by @workhardbekind): finished workouts go up to Strava as activities, cardio
 * as what it was (a run, a ride, a row) and, when the person switches it on, strength sessions as
 * Weight Training. Upload only: nothing is read back from Strava.
 *
 * Strava gives one API application per Strava account and wants every self-hoster to register
 * their own (https://www.strava.com/settings/api), so this is off unless the admin sets
 * INTEGRATIONS=strava (beside any others) and STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET, with the
 * app's "Authorization Callback Domain" set to the host of ORIGIN. docs/INTEGRATIONS.md, Strava.
 *
 * Two choices follow from that one app being shared with whatever else its owner runs:
 *   - no webhook subscription (an app gets one; openGym taking it would take it from the other)
 *   - Disconnect forgets the tokens here and never calls /oauth/deauthorize, which would end the
 *     app's access for that athlete everywhere
 *
 * The OAuth exchange (code → tokens) and the refresh go to www.strava.com. A strength session
 * goes up as Strava's JSON file (POST /api/v3/uploads, data_type json): every work set with its
 * exercise (strava-exercises.js), reps and weight, so Strava lists the exercises and the volume
 * the way it does for Hevy, with the heart rate when there is one. Cardio goes as a TCX file
 * when it has a heart rate, else as a manual activity (POST /api/v3/activities: name, sport
 * type, start, length, distance). Every one carries a description with each exercise and its
 * sets. Tokens are sealed by the hub (crypto.js).
 * `fetchFn` is the network, injectable for the tests: (url, { method, headers, body }) →
 * { status, json() }. */

import { LIB_BY_ID } from '../../coach/core/library.js';
import { NAMES_PT } from '../exercise-names-pt.js';
import { stravaExercise } from '../strava-exercises.js';

export const AUTHORIZE_URL = 'https://www.strava.com/oauth/authorize';
export const TOKEN_URL = 'https://www.strava.com/oauth/token';
export const ACTIVITY_URL = 'https://www.strava.com/api/v3/activities';
export const UPLOAD_URL = 'https://www.strava.com/api/v3/uploads';
export const SCOPE = 'activity:write';
const TIMEOUT_MS = 15_000;
// Strava's own limits are 100 requests per 15 minutes and 1000 a day per application; the
// instance stays well under them, a profile further still.
const RATE = { capacity: 60, refillMs: 15_000 };
const CONN_RATE = { capacity: 10, refillMs: 60_000 };
const DESC_MAX = 3500;

// What a cardio exercise is on Strava, by its name. The first that matches wins.
const SPORTS = [
  [/treadmill/i, 'Run', true], [/\b(run|running|jog|jogging|sprint)/i, 'Run', false],
  [/\b(walk|walking)\b/i, 'Walk', false], [/\bhike|hiking\b/i, 'Hike', false],
  [/(stationary|spin|assault|air)\s*bike|bike|cycl|ergometer.*bike/i, 'Ride', true],
  [/row/i, 'Rowing', true], [/elliptical|cross.?trainer/i, 'Elliptical', true],
  [/stair|step.?mill|stepper|climb/i, 'StairStepper', true], [/swim/i, 'Swim', false],
  [/ski.?erg|nordic/i, 'NordicSki', true], [/jump.?rope|skipping/i, 'Workout', false],
];
export function sportOf(name) {
  for (const [re, sport, trainer] of SPORTS) if (re.test(String(name || ''))) return { sport, trainer };
  return { sport: 'Workout', trainer: false };
}

const isCardioSet = s => s && !s.sides && Number(s.minutes) > 0 && !(Number(s.reps) > 0);
const cardioOf = ex => (ex.sets || []).filter(isCardioSet);

/* ---------- the words: English, or Portuguese for a profile (or a server, STRAVA_LANG) in it ---------- */

const WORDS = {
  en: { set: 'Set', muscles: 'Muscles', volume: 'Volume', sets: 'sets', prs: 'PRs', hr: 'Heart rate', avg: 'avg', max: 'max', logged: 'Logged with Craveiro Gym', strength: 'Strength training', workout: 'Workout', left: 'L', right: 'R' },
  pt: { set: 'Série', muscles: 'Músculos', volume: 'Volume', sets: 'séries', prs: 'Recordes', hr: 'Frequência cardíaca', avg: 'média', max: 'máx', logged: 'Registrado com Craveiro Gym', strength: 'Treino de força', workout: 'Treino', left: 'E', right: 'D' },
};
// The catalogue's target muscle (coach/core/library.js `tg`) in Portuguese.
const MUSCLE_PT = {
  abs: 'abdômen', obliques: 'oblíquos', lats: 'dorsais', pectorals: 'peitoral', hamstrings: 'posteriores de coxa',
  triceps: 'tríceps', 'cardiovascular system': 'cardio', spine: 'lombar', 'upper back': 'costas', quads: 'quadríceps',
  biceps: 'bíceps', glutes: 'glúteos', 'side delts': 'deltoide lateral', 'front delts': 'deltoide anterior',
  'rear delts': 'deltoide posterior', forearms: 'antebraços', traps: 'trapézio', calves: 'panturrilhas',
  'serratus anterior': 'serrátil anterior', adductors: 'adutores', abductors: 'abdutores', shins: 'tibiais',
  'hip flexors': 'flexores do quadril', 'levator scapulae': 'elevador da escápula',
};
export const langOf = l => (/^pt\b/i.test(String(l || '')) ? 'pt' : 'en');
const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** An exercise's name in the description: the catalogue's in Portuguese when that is the language. */
export function exerciseLabel(e, lang) {
  if (lang === 'pt' && LIB_BY_ID.has(String(e.id)) && NAMES_PT[e.id]) return cap(NAMES_PT[e.id]);
  return cap(e.name || String(e.id));
}

const fmt = n => String(Math.round(n * 100) / 100);
function setText(s, unit, W) {
  if (s.sides) return `${W.left} ${setText(s.sides.left, unit, W)} / ${W.right} ${setText(s.sides.right, unit, W)}`;
  if (isCardioSet(s)) {
    const km = s.distanceKm != null ? s.distanceKm : (s.speedKmh ? s.speedKmh * s.minutes / 60 : null);
    return [fmt(s.minutes) + ' min', km ? fmt(km) + ' km' : null, s.incline ? fmt(s.incline) + '%' : null].filter(Boolean).join(' · ');
  }
  if (s.seconds != null && !(s.reps > 0)) return (s.weight ? fmt(s.weight) + unit + ' × ' : '') + fmt(s.seconds) + ' s';
  return (s.weight ? fmt(s.weight) + unit + ' × ' : '') + fmt(s.reps || 0);
}

/** "2026-11-18T19:50:00" in `tz`: what Strava's start_date_local wants (it takes no offset). */
export function localTime(iso, tz) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz || 'UTC', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(d).map(x => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
  } catch { return d.toISOString().slice(0, 19); }
}

/**
 * The activity for a workout (events.js workoutPayload), or null when there is nothing to send:
 * a strength-only workout with strength uploads off. `lang` 'pt' or 'en'; `tz` the time zone the
 * manual activity's local start is written in (a file upload carries UTC and needs none).
 */
export function activityFor(w, { strength = false, lang = 'en', tz = 'UTC' } = {}) {
  if (!w || typeof w !== 'object') return null;
  const W = WORDS[langOf(lang)];
  const L = langOf(lang);
  const exercises = Array.isArray(w.exercises) ? w.exercises : [];
  const cardio = exercises.filter(e => cardioOf(e).length);
  const lifting = exercises.filter(e => (e.sets || []).some(s => !isCardioSet(s)));
  if (!cardio.length && !(strength && lifting.length)) return null;
  const cardioMin = cardio.reduce((a, e) => a + cardioOf(e).reduce((b, s) => b + Number(s.minutes), 0), 0);
  const distanceKm = cardio.reduce((a, e) => a + cardioOf(e).reduce((b, s) => b + (s.distanceKm != null ? Number(s.distanceKm) : s.speedKmh ? s.speedKmh * s.minutes / 60 : 0), 0), 0);
  // Strength on: the whole session as Weight Training, its cardio in the description. Off: the
  // cardio as what it was, the longest exercise naming the sport.
  const asStrength = strength && lifting.length > 0;
  const main = cardio.slice().sort((a, b) => cardioOf(b).reduce((x, s) => x + s.minutes, 0) - cardioOf(a).reduce((x, s) => x + s.minutes, 0))[0];
  const { sport, trainer } = asStrength ? { sport: 'WeightTraining', trainer: true } : sportOf(main?.name);
  const elapsed = asStrength || !cardioMin
    ? (w.durationMin > 0 ? w.durationMin * 60 : Math.max(60, Math.round(cardioMin * 60)))
    : Math.round(cardioMin * 60);
  const unit = w.unit === 'lb' ? ' lb' : ' kg';
  const shown = asStrength ? exercises : cardio;

  // One block per exercise, one line per work set (as Hevy writes it), the set's heart rate after it.
  const describe = withHr => {
    const lines = [];
    for (const e of shown) {
      const sets = (e.sets || []).filter(s => !s.warmup && (asStrength || isCardioSet(s)));
      if (!sets.length) continue;
      if (lines.length) lines.push('');
      lines.push(exerciseLabel(e, L));
      sets.forEach((s, i) => lines.push(`${W.set} ${i + 1}: ${setText(s, unit, W)}${withHr && s.heartRate ? ` · ♥ ${s.heartRate.avg}/${s.heartRate.max}` : ''}`));
    }
    const tail = [];
    if (asStrength) {
      const seen = new Map();
      for (const e of lifting) {
        const tg = LIB_BY_ID.get(String(e.id))?.tg;
        const n = (e.sets || []).filter(s => !s.warmup).length;
        if (tg && n) seen.set(tg, (seen.get(tg) || 0) + n);
      }
      const muscles = [...seen].sort((a, b) => b[1] - a[1]).map(([m]) => (L === 'pt' ? MUSCLE_PT[m] || m : m));
      if (muscles.length) tail.push(`${W.muscles}: ${muscles.join(', ')}`);
      if (w.totals?.volume) tail.push(`${W.volume}: ${fmt(w.totals.volume)}${unit} · ${w.totals.sets} ${W.sets}`);
    }
    if (Array.isArray(w.records) && w.records.length) tail.push(`${W.prs}: ${w.records.map(r => exerciseLabel(r, L)).join(', ')}`);
    const hr = w.heartRate ? `♥ ${W.avg} ${w.heartRate.avg} · ${W.max} ${w.heartRate.max} bpm` : '';
    const kcal = w.calories ? `${w.calories} kcal` : '';
    if (hr || kcal) tail.push([hr, kcal].filter(Boolean).join(' · '));
    if (tail.length) lines.push('', ...tail);
    if (w.note) lines.push('', w.note);
    lines.push('', W.logged);
    return lines.join('\n');
  };
  let description = describe(true);
  if (description.length > DESC_MAX) description = describe(false);
  const name = (w.name || (asStrength ? W.strength : main ? exerciseLabel(main, L) : null) || W.workout).slice(0, 120);
  const start = w.startedAt || (w.date ? w.date + 'T12:00:00Z' : new Date().toISOString());
  return {
    name,
    sport_type: sport,
    start_date_local: localTime(start, tz) || start.slice(0, 19),
    elapsed_time: Math.max(1, Math.round(elapsed)),
    description: description.slice(0, DESC_MAX),
    ...(trainer ? { trainer: 1 } : {}),
    ...(!asStrength && distanceKm > 0 ? { distance: Math.round(distanceKm * 1000) } : {}),
  };
}

/* ---------- the file: what gives Strava a heart-rate chart and Relative Effort ---------- */

/**
 * [ms, bpm] points for the file: the workout's curve when it has one (heartRateSeries); else,
 * from what a watch measured per set, the set's average and peak at its tick and the rest's
 * average after it (a coarse line, made of real readings). Empty without either.
 */
export function heartPoints(w) {
  const s = w?.heartRateSeries;
  if (s && Array.isArray(s.v)) {
    const t0 = Date.parse(s.start);
    if (Number.isFinite(t0)) {
      const pts = [];
      s.v.forEach((b, i) => { if (b > 0) pts.push([t0 + i * s.dt * 1000, b]); });
      if (pts.length >= 2) return pts;
    }
  }
  const ticks = [];
  for (const e of w?.exercises || []) for (const set of e.sets || []) {
    const t = Date.parse(set.doneAt);
    if (Number.isFinite(t) && (set.heartRate || set.restHeartRate)) ticks.push({ t, hr: set.heartRate, rest: set.restHeartRate });
  }
  ticks.sort((a, b) => a.t - b.t);
  const pts = [];
  ticks.forEach((x, i) => {
    const gap = ticks[i + 1] ? ticks[i + 1].t - x.t : 120_000;
    if (x.hr) { pts.push([x.t - 20_000, x.hr.avg]); pts.push([x.t, x.hr.max]); }
    if (x.rest && gap > 20_000) pts.push([x.t + Math.min(60_000, gap / 2), x.rest.avg]);
  });
  const out = [];
  for (const p of pts.sort((a, b) => a[0] - b[0])) if (!out.length || p[0] > out[out.length - 1][0]) out.push(p);
  return out.length >= 2 ? out : [];
}

const xml = s => String(s).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
const iso = ms => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

/** The workout as a TCX file with its heart rate, or null when there is none to give. */
export function tcxFor(w, act) {
  const pts = heartPoints(w);
  if (!pts.length) return null;
  let start = Date.parse(w.startedAt), end = Date.parse(w.endedAt);
  if (!Number.isFinite(start)) start = pts[0][0];
  if (!Number.isFinite(end) || end <= start) end = Math.max(start + act.elapsed_time * 1000, pts[pts.length - 1][0]);
  const inside = pts.filter(([t]) => t >= start && t <= end);
  if (inside.length < 2) return null;
  // The first and last point at the workout's start and end, so Strava's time is the workout's.
  if (inside[0][0] > start) inside.unshift([start, inside[0][1]]);
  if (inside[inside.length - 1][0] < end) inside.push([end, inside[inside.length - 1][1]]);
  const sport = act.sport_type === 'Run' ? 'Running' : act.sport_type === 'Ride' ? 'Biking' : 'Other';
  const dist = Number(act.distance) || 0;
  const avg = Math.round(inside.reduce((a, p) => a + p[1], 0) / inside.length), max = Math.max(...inside.map(p => p[1]));
  const span = end - start;
  const track = inside.map(([t, b]) => `<Trackpoint><Time>${iso(t)}</Time>${dist ? `<DistanceMeters>${(dist * (t - start) / span).toFixed(1)}</DistanceMeters>` : ''}<HeartRateBpm><Value>${b}</Value></HeartRateBpm></Trackpoint>`).join('');
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">'
    + `<Activities><Activity Sport="${sport}"><Id>${iso(start)}</Id><Lap StartTime="${iso(start)}">`
    + `<TotalTimeSeconds>${Math.round(span / 1000)}</TotalTimeSeconds><DistanceMeters>${dist}</DistanceMeters>`
    + (w.calories ? `<Calories>${w.calories}</Calories>` : '<Calories>0</Calories>')
    + `<AverageHeartRateBpm><Value>${avg}</Value></AverageHeartRateBpm><MaximumHeartRateBpm><Value>${max}</Value></MaximumHeartRateBpm>`
    + `<Intensity>Active</Intensity><TriggerMethod>Manual</TriggerMethod><Track>${track}</Track></Lap>`
    + `<Notes>${xml(act.name)}</Notes><Creator xsi:type="Device_t" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><Name>Craveiro Gym</Name></Creator></Activity></Activities></TrainingCenterDatabase>\n`;
}

/* ---------- the sets: what lets Strava show the exercises, the weight and the volume ---------- */

const KG_PER_LB = 0.45359237;

/**
 * A strength session as Strava's JSON upload (developers.strava.com/docs/uploads): each work set
 * as { exercise_type, repetitions, weight (kg) } or, timed, { exercise_type, duration }, each side
 * of a one-sided set as a set of its own, and the heart rate as a stream when there is one. A
 * string, or null when there is not one set to give (Strava wants at least one).
 */
export function setsFileFor(w, act, { tz = 'UTC' } = {}) {
  if (!w || !act) return null;
  const kg = w.unit === 'lb' ? x => Math.round(x * KG_PER_LB * 100) / 100 : x => Math.round(x * 100) / 100;
  const sets = [];
  const add = (type, s) => {
    if (!s || s.warmup) return;
    const o = { exercise_type: type };
    if (isCardioSet(s)) o.duration = Math.round(Number(s.minutes) * 60);
    else if (Number(s.reps) > 0) o.repetitions = Math.round(Number(s.reps));
    else if (Number(s.seconds) > 0) o.duration = Math.round(Number(s.seconds));
    else return;
    if (!isCardioSet(s) && Number(s.weight) > 0) o.weight = kg(Number(s.weight));
    sets.push(o);
  };
  for (const e of Array.isArray(w.exercises) ? w.exercises : []) {
    const type = stravaExercise(e);
    for (const s of e.sets || []) {
      if (s?.sides) { add(type, s.sides.left); add(type, s.sides.right); } else add(type, s);
    }
  }
  if (!sets.length) return null;
  let t0 = Date.parse(w.startedAt || (w.date ? w.date + 'T12:00:00Z' : ''));
  if (!Number.isFinite(t0)) t0 = Date.now();
  t0 = Math.floor(t0 / 1000) * 1000;
  const elapsed = Math.max(1, Number(act.elapsed_time) || 1);
  const local = localTime(new Date(t0).toISOString(), tz);
  const offset = local ? Math.round((Date.parse(local + 'Z') - t0) / 60_000) * 60 : 0;
  // The heart rate inside the session, in whole seconds from its start.
  const time = [], heartrate = [];
  for (const [t, b] of heartPoints(w)) {
    const sec = Math.floor((t - t0) / 1000);
    if (sec < 0 || sec > elapsed || (time.length && sec <= time[time.length - 1])) continue;
    time.push(sec); heartrate.push(b);
  }
  return JSON.stringify({
    version: '1.0',
    start_time: iso(t0),
    utc_offset: Number.isFinite(offset) ? offset : 0,
    elapsed_time: elapsed,
    ...(w.calories ? { total_calories: w.calories } : {}),
    creator: { name: 'Craveiro Gym' },
    ...(time.length >= 2 ? { streams: { time, heartrate } } : {}),
    sets,
  });
}

/* ---------- talking to Strava ---------- */

const form = o => Object.entries(o).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v))).join('&');

/** A multipart body (the upload): plain fields and one file. → { body, type } */
export function multipart(fields, file) {
  const b = '----craveirogym' + Math.random().toString(16).slice(2);
  let s = '';
  for (const [k, v] of Object.entries(fields)) s += `--${b}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`;
  s += `--${b}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: ${file.type || 'application/xml'}\r\n\r\n${file.data}\r\n--${b}--\r\n`;
  return { body: s, type: 'multipart/form-data; boundary=' + b };
}

async function request(fetchFn, method, url, { token = null, body = null, type = 'application/x-www-form-urlencoded' } = {}) {
  const ctrl = new AbortController();
  const tm = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  tm.unref?.();
  const t0 = Date.now();
  try {
    const headers = { Accept: 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body != null ? { 'Content-Type': type } : {}) };
    const r = await fetchFn(url, { method, headers, ...(body != null ? { body: typeof body === 'string' ? body : form(body) } : {}), signal: ctrl.signal });
    let data = null;
    try { data = await r.json(); } catch { /* no body */ }
    return { status: r.status, data, ms: Date.now() - t0 };
  } finally { clearTimeout(tm); }
}
const call = (fetchFn, url, body) => request(fetchFn, 'POST', url, { body });

export function stravaProvider({ env = process.env, fetchFn = globalThis.fetch, now = Date.now, pollMs = 2500 } = {}) {
  const clientId = String(env.STRAVA_CLIENT_ID || '').trim();
  const clientSecret = String(env.STRAVA_CLIENT_SECRET || '').trim();

  /** Tokens from Strava's answer, or a refusal the hub turns into a message. */
  const tokensFrom = (r, refreshToken = null) => {
    if (r.status === 200 && r.data?.access_token) {
      return { access: r.data.access_token, refresh: r.data.refresh_token || refreshToken, expiresAt: Number(r.data.expires_at) * 1000 || now() + 3600_000, athlete: r.data.athlete || null };
    }
    return null;
  };

  async function refresh(reveal, reseal) {
    const rt = reveal('refresh');
    if (!rt) return { error: { ok: false, retry: false, gone: true, code: 'reconnect', msg: 'Reconnect Strava: its sign-in is gone.' } };
    let r;
    try { r = await call(fetchFn, TOKEN_URL, { client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token', refresh_token: rt }); }
    catch { return { error: { ok: false, retry: true, code: 'network', msg: 'Could not reach Strava.' } }; }
    const tok = tokensFrom(r, rt);
    if (!tok) {
      // 400/401: Strava no longer honours it (revoked, or replaced by another service of the same app).
      if (r.status === 400 || r.status === 401) return { error: { ok: false, retry: false, gone: true, status: r.status, code: 'reconnect', msg: 'Reconnect Strava: it no longer accepts this sign-in.' } };
      return { error: { ok: false, retry: true, status: r.status, code: 'http', msg: `Strava answered ${r.status} to the sign-in refresh.` } };
    }
    reseal({ access: tok.access, refresh: tok.refresh, expires: String(tok.expiresAt) });
    return { access: tok.access };
  }

  return {
    id: 'strava',
    kind: 'oauth',
    category: 'training',
    events: ['workout.finished'],
    // Ten minutes before the first try, and the workout read again then: the watch's heart-rate
    // curve and the health hub's readings reach the server after the finish.
    delayMs: Math.max(0, Number(env.STRAVA_DELAY_MIN ?? 10)) * 60_000,
    fresh: true,
    env: ['STRAVA_CLIENT_ID', 'STRAVA_CLIENT_SECRET'],
    configured: e => !!String(e.STRAVA_CLIENT_ID || '').trim() && !!String(e.STRAVA_CLIENT_SECRET || '').trim(),
    max: 1,
    rate: RATE,
    connRate: CONN_RATE,

    authorizeUrl({ state, redirectUri }) {
      const u = new URL(AUTHORIZE_URL);
      u.search = new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: redirectUri, approval_prompt: 'auto', scope: SCOPE, state }).toString();
      return u.toString();
    },

    /** The callback's code for tokens. → { label, info, secrets, events } or throws { status, code, message }. */
    async callback(query) {
      const fail = (status, code, message) => { throw Object.assign(new Error(message), { status, code }); };
      if (query.error) fail(400, 'denied', 'Strava was not given access.');
      const granted = String(query.scope || '').split(/[\s,]+/);
      if (!granted.includes(SCOPE)) fail(400, 'scope', 'Strava has to be allowed to upload activities. Connect again and leave that box ticked.');
      if (!query.code) fail(400, 'code', 'Strava sent no code back.');
      let r;
      try { r = await call(fetchFn, TOKEN_URL, { client_id: clientId, client_secret: clientSecret, code: String(query.code).slice(0, 200), grant_type: 'authorization_code' }); }
      catch { fail(502, 'network', 'Could not reach Strava.'); }
      const tok = tokensFrom(r);
      if (!tok) fail(502, 'exchange', `Strava did not hand over the sign-in (${r.status}).`);
      const a = tok.athlete || {};
      const who = [a.firstname, a.lastname].filter(Boolean).join(' ').trim() || (a.id ? 'Athlete ' + a.id : 'Strava');
      return {
        label: who.slice(0, 60),
        events: ['workout.finished'],
        info: { athlete: who.slice(0, 80), ...(a.id ? { athleteId: String(a.id).slice(0, 20) } : {}), strength: 'off' },
        secrets: { access: tok.access, refresh: tok.refresh, expires: String(tok.expiresAt) },
      };
    },

    connect() { throw Object.assign(new Error('connect Strava through its sign-in'), { status: 400, code: 'oauth' }); },

    /** The one setting: strength workouts too, as Weight Training. And pause. */
    update(input, rec) {
      const patch = {};
      if (typeof input.strength === 'boolean') patch.info = { ...(rec?.info || {}), strength: input.strength ? 'on' : 'off' };
      if (typeof input.paused === 'boolean') patch.paused = input.paused;
      return patch;
    },

    /**
     * One workout up. `reveal(name)` opens a sealed secret, `reseal(map)` stores refreshed ones.
     * Strength goes as Strava's JSON file (POST /uploads): its sets, reps and weight, and the
     * heart rate when there is one. Cardio with a heart rate (the curve, or a watch's per set)
     * goes as a TCX file, then the sport set on the activity it made, which gives Strava its chart
     * and Relative Effort; without, as a manual activity. A JSON file Strava cannot read goes
     * again the cardio way, so the workout still gets there. Where an upload got to is kept on the
     * job (`job.stage`), so a retry picks up there instead of uploading twice.
     */
    async deliver(job, reveal, { reseal = () => {}, info = {}, workout, lang = null } = {}) {
      if (job.ev === 'test') {
        // "Send test" checks the sign-in without posting an activity nobody did.
        const r = await refresh(reveal, reseal);
        return r.error || { ok: true, status: 200 };
      }
      // The workout as it is now (the hub reads it again, the curve may have come since); null:
      // deleted meanwhile, nothing to send.
      if (workout === null) return { ok: true, status: 0, msg: 'The workout was deleted before it went up.' };
      const w = workout || job.payload?.data?.workout;
      const L = langOf(String(env.STRAVA_LANG || '').trim() || lang);
      const tz = String(env.STRAVA_TZ || env.TZ || '').trim() || 'UTC';
      const act = activityFor(w, { strength: info.strength === 'on', lang: L, tz });
      if (!act) return { ok: true, status: 0, msg: 'Nothing to upload: strength workouts are off.' };

      let token = reveal('access');
      const exp = Number(reveal('expires')) || 0;
      if (!token || exp - now() < 120_000) {
        const r = await refresh(reveal, reseal);
        if (r.error) return r.error;
        token = r.access;
      }
      // A request with the token, once more with a renewed one when Strava refuses it.
      const send = async (method, url, opts = {}) => {
        let res = await request(fetchFn, method, url, { ...opts, token });
        if (res.status === 401) {
          const r = await refresh(reveal, reseal);
          if (r.error) return { error: r.error };
          token = r.access;
          res = await request(fetchFn, method, url, { ...opts, token });
        }
        return res;
      };
      const refused = (res, what) => {
        if (res.error) return res.error;
        if (res.status === 429) return { ok: false, retry: true, retryAfterMs: 15 * 60_000, status: 429, code: 'rate', msg: 'Strava says slow down, trying again in 15 minutes.' };
        if (res.status >= 500) return { ok: false, retry: true, status: res.status, code: 'http', msg: `Strava answered ${res.status}.` };
        if (res.status === 403 || res.status === 401) return { ok: false, retry: false, gone: true, status: res.status, code: 'reconnect', msg: 'Reconnect Strava: it no longer lets Craveiro Gym upload.' };
        return { ok: false, retry: false, status: res.status, code: 'http', msg: `Strava refused the ${what} (${res.status}).` };
      };
      const net = { ok: false, retry: true, code: 'network', msg: 'Could not reach Strava.' };

      job.stage = job.stage && typeof job.stage === 'object' ? job.stage : {};
      const sets = act.sport_type === 'WeightTraining' && !job.stage.plain ? setsFileFor(w, act, { tz }) : null;
      const tcx = sets ? null : tcxFor(w, act);
      const file = sets ? { kind: 'json', data: sets, type: 'application/json' } : tcx ? { kind: 'tcx', data: tcx, type: 'application/xml' } : null;
      try {
        if (!file && !job.stage.upload && !job.stage.activity) {
          const res = await send('POST', ACTIVITY_URL, { body: act });
          if (res.status === 201 || res.status === 200) return { ok: true, status: res.status, ms: res.ms };
          return refused(res, 'activity');
        }
        if (!job.stage.upload && !job.stage.activity) {
          const { body, type } = multipart({
            data_type: file.kind, name: act.name, description: act.description, sport_type: act.sport_type,
            external_id: `craveirogym-${String(w.id).slice(0, 60)}.${file.kind}`,
            ...(act.trainer ? { trainer: 1 } : {}),
          }, { name: 'workout.' + file.kind, data: file.data, type: file.type });
          const res = await send('POST', UPLOAD_URL, { body, type });
          if (res.status !== 201 && res.status !== 200) return refused(res, 'upload');
          if (!res.data?.id) return { ok: false, retry: true, status: res.status, code: 'http', msg: 'Strava took the upload without saying where it went.' };
          job.stage.upload = String(res.data.id);
          job.stage.kind = file.kind;
        }
        // An upload from before the JSON file was a TCX one.
        const kind = job.stage.kind || 'tcx';
        // Strava turns the file into an activity in a few seconds.
        for (let i = 0; !job.stage.activity && i < 4; i++) {
          if (i) await new Promise(r => { const t = setTimeout(r, pollMs); t.unref?.(); });
          const res = await send('GET', `${UPLOAD_URL}/${encodeURIComponent(job.stage.upload)}`);
          if (res.status !== 200) return refused(res, 'upload');
          if (res.data?.activity_id) { job.stage.activity = String(res.data.activity_id); break; }
          if (res.data?.error) {
            // The same file twice (a job sent again after a crash): the activity it made the first time.
            const dup = /duplicate of .*?activities\/(\d+)/i.exec(String(res.data.error));
            if (dup) { job.stage.activity = dup[1]; break; }
            const why = String(res.data.error).replace(/<[^>]*>/g, '').slice(0, 120);
            // The sets refused (an exercise Strava does not take, a change on its side): the
            // workout goes again with its sets in the description only.
            if (kind === 'json') { job.stage = { plain: why }; return { defer: 1000 }; }
            return { ok: false, retry: false, status: 400, code: 'upload', msg: `Strava could not read the file: ${why}` };
          }
        }
        if (!job.stage.activity) return { defer: 30_000 };
        // The JSON file named its sport itself.
        if (kind === 'json') return { ok: true, status: 201 };
        // The file says only "other": the sport (Weight Training) and the indoor flag go on now.
        const res = await send('PUT', `${ACTIVITY_URL}/${encodeURIComponent(job.stage.activity)}`, {
          body: { sport_type: act.sport_type, name: act.name, description: act.description, ...(act.trainer ? { trainer: 1 } : {}) },
        });
        if (res.status === 200 || res.status === 201) return { ok: true, status: 201, ms: res.ms };
        return refused(res, 'activity');
      } catch { return net; }
    },
  };
}
