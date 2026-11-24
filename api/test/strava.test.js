/* Strava (integrations/providers/strava.js, #478): off without its app's credentials, the OAuth
 * round trip with its state bound to the profile and used once, the activity a workout becomes,
 * the token refresh, and what a refusal does. All against a pretend Strava: nothing leaves the
 * machine, and no real Strava app was needed to write these (a real one needs Strava's review to
 * take more than one athlete). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { createIntegrations, OAUTH_STATE_MS } = await import('../integrations/index.js');
const { activityFor, sportOf, tcxFor, setsFileFor, heartPoints, localTime, AUTHORIZE_URL, TOKEN_URL, ACTIVITY_URL, UPLOAD_URL } = await import('../integrations/providers/strava.js');
const { workoutPayload } = await import('../integrations/events.js');

const SECRET = 'b'.repeat(64);
const ENV = { INTEGRATIONS: 'strava', STRAVA_CLIENT_ID: '4242', STRAVA_CLIENT_SECRET: 'shh', STRAVA_DELAY_MIN: '0' };
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gym-strava-'));

// A pretend Strava: the token endpoint and the activity endpoint, with switches for refusals.
function strava() {
  const s = { calls: [], activities: [], codes: new Map([['good', 'r1']]), refresh: new Map([['r1', true]]), access: new Set(), n: 0, activityStatus: 201 };
  s.uploads = []; s.updates = []; s.uploadError = null; s.ready = 1;
  s.fetchFn = async (url, { method, headers, body }) => {
    const multi = /^multipart/.test(headers['Content-Type'] || '');
    const form = multi
      ? Object.fromEntries([...body.matchAll(/name="([^"]+)"(?:; filename="[^"]*")?\r\n(?:Content-Type: [^\r]*\r\n)?\r\n([\s\S]*?)\r\n--/g)].map(m => [m[1], m[2]]))
      : Object.fromEntries(new URLSearchParams(body || ''));
    s.calls.push({ url, method, form, auth: headers.Authorization || null });
    const reply = (status, data) => ({ status, json: async () => data });
    if (url === TOKEN_URL) {
      if (form.client_id !== '4242' || form.client_secret !== 'shh') return reply(401, { message: 'Bad client' });
      if (form.grant_type === 'authorization_code') {
        if (!s.codes.has(form.code)) return reply(400, { message: 'Bad code' });
        const a = 'a' + (++s.n); s.access.add(a);
        return reply(200, { access_token: a, refresh_token: s.codes.get(form.code), expires_at: Math.floor(Date.now() / 1000) + 21600, athlete: { id: 7, firstname: 'Ana', lastname: 'Lift' } });
      }
      if (form.grant_type === 'refresh_token') {
        if (!s.refresh.get(form.refresh_token)) return reply(400, { message: 'Bad refresh' });
        const a = 'a' + (++s.n); s.access.add(a);
        return reply(200, { access_token: a, refresh_token: form.refresh_token, expires_at: Math.floor(Date.now() / 1000) + 21600 });
      }
    }
    if (url === ACTIVITY_URL) {
      const tok = (headers.Authorization || '').replace('Bearer ', '');
      if (!s.access.has(tok)) return reply(401, { message: 'Authorization Error' });
      if (s.activityStatus !== 201) return reply(s.activityStatus, {});
      s.activities.push(form);
      return reply(201, { id: s.activities.length });
    }
    if (url.startsWith(UPLOAD_URL) || url.startsWith(ACTIVITY_URL + '/')) {
      const tok = (headers.Authorization || '').replace('Bearer ', '');
      if (!s.access.has(tok)) return reply(401, { message: 'Authorization Error' });
      if (method === 'POST' && url === UPLOAD_URL) { s.uploads.push(form); return reply(201, { id: 900 + s.uploads.length, status: 'Your activity is still being processed.', activity_id: null, error: null }); }
      if (method === 'GET') {
        if (s.uploadError) return reply(200, { id: 901, error: s.uploadError, activity_id: null });
        if (s.ready-- > 0) return reply(200, { id: 901, status: 'Your activity is still being processed.', activity_id: null, error: null });
        return reply(200, { id: 901, status: 'Your activity is ready.', activity_id: 5000 + s.uploads.length, error: null });
      }
      if (method === 'PUT') { s.updates.push({ id: url.split('/').pop(), ...form }); return reply(200, { id: Number(url.split('/').pop()) }); }
    }
    return reply(404, {});
  };
  return s;
}

function hub(env = ENV, s = strava(), now = Date.now, readDoc = null) {
  const h = createIntegrations({ dataDir: tmp(), secret: SECRET, env, fetchFn: s.fetchFn, now, readDoc });
  return { h, s };
}
const stateOf = url => new URL(url).searchParams.get('state');
async function connect(h, uid = 'u1') {
  const url = h.oauthStart(uid, 'strava', 'https://gym.example.com/api/integrations/oauth/callback');
  return h.oauthFinish({ state: stateOf(url), code: 'good', scope: 'read,activity:write' }, uid);
}
// Finished "after connecting": a little in the future, which the hub takes up to a day ahead.
const NOW = Date.now();
const cardio = { id: 'w1', d: new Date(NOW).toISOString().slice(0, 10), name: 'Morning run', start: NOW + 25 * 60000, end: NOW + 60 * 60000,
  entries: [{ id: 'treadmill-run', sets: [{ min: 30, speed: 10, incline: 1, done: true }, { min: 5, speed: 6, done: true }] }] };
const lifting = { id: 'w2', d: cardio.d, name: 'Push', start: NOW + 10 * 60000, end: NOW + 70 * 60000,
  entries: [{ id: '0025', sets: [{ w: 20, r: 10, phase: 'warmup', done: true }, { w: 60, r: 8, done: true }, { w: 60, r: 7, done: true }] }], prs: ['0025'] };
const doc = { unit: 'kg', customEx: [{ id: 'treadmill-run', name: 'Treadmill run' }], workouts: [] };

test('off without the app’s credentials, or without strava in INTEGRATIONS', () => {
  assert.equal(createIntegrations({ dataDir: tmp(), secret: SECRET, env: { INTEGRATIONS: 'strava' } }).active, false);
  assert.equal(createIntegrations({ dataDir: tmp(), secret: SECRET, env: { STRAVA_CLIENT_ID: '1', STRAVA_CLIENT_SECRET: '2' } }).active, false);
  const { h } = hub();
  assert.deepEqual(h.publicConfig(), { providers: ['strava'] });
  assert.equal(h.describe('u1').providers[0].kind, 'oauth');
  assert.throws(() => h.connect('u1', 'strava', {}), e => e.code === 'oauth');
});

test('the sign-in: Strava’s page with our state, then the tokens sealed and the athlete named', async () => {
  const { h, s } = hub();
  const url = new URL(h.oauthStart('u1', 'strava', 'https://gym.example.com/api/integrations/oauth/callback'));
  assert.equal(url.origin + url.pathname, AUTHORIZE_URL);
  assert.equal(url.searchParams.get('client_id'), '4242');
  assert.equal(url.searchParams.get('scope'), 'activity:write');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://gym.example.com/api/integrations/oauth/callback');
  const out = await h.oauthFinish({ state: url.searchParams.get('state'), code: 'good', scope: 'read,activity:write' }, 'u1');
  assert.equal(out.uid, 'u1');
  assert.equal(out.connection.label, 'Ana Lift');
  assert.equal(out.connection.info.strength, 'off');
  const rec = h._store().get('u1', out.connection.id);
  assert.ok(!JSON.stringify(rec.secrets).includes('a1') || rec.secrets.access.startsWith('v1.'), 'sealed');
  assert.equal(s.calls.filter(c => c.url === TOKEN_URL).length, 1);
});

test('the state: bound to its profile, its ten minutes and one use; the scope has to be granted', async () => {
  let clock = Date.now();
  const { h } = hub(ENV, strava(), () => clock);
  const cb = 'https://gym.example.com/api/integrations/oauth/callback';
  const st = stateOf(h.oauthStart('u1', 'strava', cb));
  await assert.rejects(h.oauthFinish({ state: st, code: 'good', scope: 'activity:write' }, 'u2'), e => e.status === 403);
  await assert.rejects(h.oauthFinish({ state: st.slice(0, -2) + 'xx', code: 'good', scope: 'activity:write' }, 'u1'), e => e.code === 'state');
  const ok = await h.oauthFinish({ state: st, code: 'good', scope: 'activity:write' }, null);   // no cookie: the state names the profile
  assert.equal(ok.uid, 'u1');
  await assert.rejects(h.oauthFinish({ state: st, code: 'good', scope: 'activity:write' }, 'u1'), e => /used/.test(e.message), 'once');
  const late = stateOf(h.oauthStart('u1', 'strava', cb));
  clock += OAUTH_STATE_MS + 1;
  await assert.rejects(h.oauthFinish({ state: late, code: 'good', scope: 'activity:write' }, 'u1'), e => e.code === 'state');
  const noScope = stateOf(h.oauthStart('u1', 'strava', cb));
  await assert.rejects(h.oauthFinish({ state: noScope, code: 'good', scope: 'read' }, 'u1'), e => e.code === 'scope');
  const denied = stateOf(h.oauthStart('u1', 'strava', cb));
  await assert.rejects(h.oauthFinish({ state: denied, error: 'access_denied' }, 'u1'), e => e.code === 'denied');
  // a second sign-in replaces the first
  await connect(h)
  assert.equal(h.describe('u1').connections.length, 1);
});

test('a workout as an activity: cardio as what it was, strength only when asked', () => {
  const run = activityFor(workoutPayload(cardio, doc));
  assert.equal(run.sport_type, 'Run');
  assert.equal(run.trainer, 1);
  assert.equal(run.elapsed_time, 35 * 60);
  assert.equal(run.distance, 5500);
  assert.equal(run.name, 'Morning run');
  assert.match(run.description, /^Treadmill run\nSet 1: 30 min · 5 km · 1%\nSet 2: 5 min · 0\.5 km\n\nLogged with Craveiro Gym$/);
  assert.equal(activityFor(workoutPayload(lifting, doc)), null, 'strength is off by default');
  const lift = activityFor(workoutPayload(lifting, doc), { strength: true });
  assert.equal(lift.sport_type, 'WeightTraining');
  assert.equal(lift.elapsed_time, 60 * 60);
  assert.match(lift.description, /^Barbell bench press\nSet 1: 60 kg × 8\nSet 2: 60 kg × 7\n/);
  assert.match(lift.description, /Muscles: pectorals/);
  assert.ok(!/20 kg × 10/.test(lift.description), 'warm-ups left out');
  assert.match(lift.description, /PRs: /);
  assert.equal(lift.distance, undefined);
  assert.deepEqual(sportOf('Rowing machine'), { sport: 'Rowing', trainer: true });
  assert.deepEqual(sportOf('Outdoor running'), { sport: 'Run', trainer: false });
  assert.deepEqual(sportOf('Stationary bike'), { sport: 'Ride', trainer: true });
  assert.equal(sportOf('Mystery').sport, 'Workout');
});

test('a finished workout goes up once; strength follows the switch, as its sets; an expired token is renewed', async () => {
  const s0 = strava();
  s0.ready = 0;
  const { h, s } = hub(ENV, s0);
  const { connection } = await connect(h);
  const prev = { workouts: [] };
  assert.equal(h.onStateWrite('u1', prev, { ...doc, workouts: [cardio, lifting] }), 2);
  await h._outbox().run();
  assert.equal(s.activities.length, 1, 'the run; the strength session is skipped');
  assert.equal(s.activities[0].sport_type, 'Run');
  // the same document again: nothing new
  assert.equal(h.onStateWrite('u1', { workouts: [cardio, lifting] }, { ...doc, workouts: [cardio, lifting] }), 0);
  h.update('u1', connection.id, { strength: true });
  const third = { ...lifting, id: 'w3' };
  h.onStateWrite('u1', { workouts: [cardio, lifting] }, { ...doc, workouts: [cardio, lifting, third] });
  // the access token is refused once: the refresh is used and the upload goes again
  s.access.clear();
  await h._outbox().run();
  assert.equal(s.activities.length, 1, 'strength is a file, not a manual activity');
  assert.equal(s.uploads.length, 1);
  assert.equal(s.uploads[0].data_type, 'json');
  assert.equal(s.uploads[0].sport_type, 'WeightTraining');
  assert.equal(s.uploads[0].external_id, 'craveirogym-w3.json');
  assert.deepEqual(JSON.parse(s.uploads[0].file).sets, [
    { exercise_type: 'BARBELL_BENCH_PRESS', repetitions: 8, weight: 60 },
    { exercise_type: 'BARBELL_BENCH_PRESS', repetitions: 7, weight: 60 },
  ]);
  assert.equal(s.updates.length, 0, 'the file named its sport, nothing to set after');
  assert.ok(s.calls.some(c => c.url === TOKEN_URL && c.form.grant_type === 'refresh_token'));
});

test('a refresh Strava no longer takes asks for a reconnect and pauses, without retrying forever', async () => {
  const { h, s } = hub();
  const { connection } = await connect(h);
  s.access.clear();
  s.refresh.set('r1', false);
  h.onStateWrite('u1', { workouts: [] }, { ...doc, workouts: [cardio] });
  await h._outbox().run();
  const c = h.describe('u1').connections.find(x => x.id === connection.id);
  assert.equal(c.status, 'attention');
  assert.equal(c.paused, true);
  assert.match(c.lastError.msg, /Reconnect Strava/);
  assert.equal(s.activities.length, 0);
  // Disconnect forgets it here and never calls Strava's deauthorize
  const before = s.calls.length;
  h.disconnect('u1', connection.id);
  assert.equal(s.calls.length, before);
  assert.equal(h.describe('u1').connections.length, 0);
});

test('Send test checks the sign-in without posting an activity', async () => {
  const { h, s } = hub();
  const { connection } = await connect(h);
  const r = await h.test('u1', connection.id);
  assert.equal(r.ok, true);
  assert.equal(s.activities.length, 0);
});

test('in Portuguese: the catalogue’s names, the muscles, and the start in the athlete’s time zone', () => {
  const hr = { ...lifting, hr: { avg: 132, max: 174 }, kcal: 412, entries: [{ id: '0025', sets: [{ w: 60, r: 8, done: true, hr: { avg: 125, max: 168 } }, { w: 60, r: 7, done: true }] }] };
  const a = activityFor(workoutPayload(hr, doc), { strength: true, lang: 'pt-BR', tz: 'America/Sao_Paulo' });
  assert.match(a.description, /^Supino com barra\nSérie 1: 60 kg × 8 · ♥ 125\/168\nSérie 2: 60 kg × 7\n\nMúsculos: peitoral\nVolume: 900 kg · 2 séries\nRecordes: Supino com barra\n♥ média 132 · máx 174 bpm · 412 kcal\n\nRegistrado com Craveiro Gym$/);
  assert.equal(localTime('2026-11-18T22:50:00.000Z', 'America/Sao_Paulo'), '2026-11-18T19:50:00');
  assert.equal(localTime('2026-11-18T22:50:00.000Z', 'Not/AZone'), '2026-11-18T22:50:00');
});

test('the heart rate as a file: the curve when there is one, else what the watch measured per set', () => {
  const t0 = NOW + 10 * 60000;
  const curve = { ...lifting, hrs: { t0, dt: 10, v: [90, 0, 120, 130], src: 'watch', n: 3 } };
  const p = workoutPayload(curve, doc, { series: true });
  assert.deepEqual(heartPoints(p), [[t0, 90], [t0 + 20000, 120], [t0 + 30000, 130]]);
  const file = tcxFor(p, activityFor(p, { strength: true }));
  assert.match(file, /<Activity Sport="Other">/);
  assert.equal((file.match(/<Trackpoint>/g) || []).length, 4, 'and one at the end, so the time is the workout’s');
  assert.equal(workoutPayload(curve, doc).heartRateSeries, undefined, 'webhooks never get the curve');
  const perSet = workoutPayload({ ...lifting, entries: [{ id: '0025', sets: [{ w: 60, r: 8, done: true, at: t0 + 60000, hr: { avg: 120, max: 140 }, restHr: { avg: 110, max: 125 } }, { w: 60, r: 8, done: true, at: t0 + 180000, hr: { avg: 125, max: 150 } }] }] }, doc);
  assert.deepEqual(heartPoints(perSet).map(p => p[1]), [120, 140, 110, 125, 150]);
  assert.equal(tcxFor(workoutPayload(lifting, doc), activityFor(workoutPayload(lifting, doc), { strength: true })), null, 'none without a heart rate');
});

test('a strength workout with a heart rate goes up 10 minutes later, read again then, with its sets and the curve', async () => {
  let clock = NOW;
  const s = strava();
  s.ready = 0;
  let stored = { ...doc, workouts: [lifting] };
  const env = { ...ENV };
  delete env.STRAVA_DELAY_MIN;
  const { h } = hub(env, s, () => clock, () => stored);
  const { connection } = await connect(h);
  h.update('u1', connection.id, { strength: true });
  assert.equal(h.onStateWrite('u1', { workouts: [] }, stored), 1);
  await h._outbox().run();
  assert.equal(s.uploads.length + s.activities.length, 0, 'waits for the curve');
  // the watch's curve arrives meanwhile
  stored = { ...doc, lang: 'pt', workouts: [{ ...lifting, hrs: { t0: lifting.start, dt: 10, v: Array.from({ length: 30 }, (_, i) => 100 + i) } }] };
  clock += 10 * 60000 + 1;
  await h._outbox().run();
  assert.equal(s.activities.length, 0);
  assert.equal(s.uploads.length, 1);
  assert.equal(s.uploads[0].data_type, 'json');
  assert.equal(s.uploads[0].sport_type, 'WeightTraining');
  assert.equal(s.uploads[0].trainer, '1');
  const file = JSON.parse(s.uploads[0].file);
  assert.equal(file.version, '1.0');
  assert.equal(file.elapsed_time, 60 * 60);
  assert.equal(file.streams.heartrate.length, 30);
  assert.equal(file.streams.heartrate[29], 129);
  assert.deepEqual(file.streams.time.slice(0, 3), [0, 10, 20]);
  assert.equal(file.sets.length, 2, 'the warm-up left out');
  assert.match(s.uploads[0].description, /^Supino com barra\nSérie 1/);
  assert.equal(s.updates.length, 0);
  assert.equal(h.describe('u1').connections[0].queued, 0);
});

test('an upload Strava already has is the activity it made; a workout deleted meanwhile is not sent', async () => {
  const s = strava();
  s.uploadError = 'workout.tcx duplicate of <a href=\'/activities/777\' target=\'_blank\'>Push</a>';
  let stored = { ...doc, workouts: [{ ...lifting, hrs: { t0: lifting.start, dt: 10, v: Array.from({ length: 30 }, () => 120) } }] };
  const { h } = hub(ENV, s, Date.now, () => stored);
  const { connection } = await connect(h);
  h.update('u1', connection.id, { strength: true });
  h.onStateWrite('u1', { workouts: [] }, stored);
  await h._outbox().run();
  assert.equal(s.uploads.length, 1);
  assert.equal(s.updates.length, 0, 'the activity Strava made the first time is the one');
  assert.equal(h.describe('u1').connections[0].queued, 0);
  stored = { ...doc, workouts: [] };
  h.onStateWrite('u1', { workouts: [] }, { ...doc, workouts: [{ ...lifting, id: 'w9' }] });
  await h._outbox().run();
  assert.equal(s.uploads.length + s.activities.length, 1, 'the deleted one stayed here');
});

test('cardio with a heart rate still goes as a TCX file, then its sport is set on the activity', async () => {
  const s = strava();
  s.ready = 0;
  const stored = { ...doc, workouts: [{ ...cardio, hrs: { t0: cardio.start, dt: 10, v: Array.from({ length: 30 }, (_, i) => 120 + i) } }] };
  const { h } = hub(ENV, s, Date.now, () => stored);
  await connect(h);
  h.onStateWrite('u1', { workouts: [] }, stored);
  await h._outbox().run();
  assert.equal(s.uploads.length, 1);
  assert.equal(s.uploads[0].data_type, 'tcx');
  assert.equal(s.uploads[0].sport_type, 'Run');
  assert.equal(s.uploads[0].external_id, 'craveirogym-w1.tcx');
  assert.deepEqual(s.updates.map(u => [u.id, u.sport_type]), [['5001', 'Run']]);
});

test('sets Strava will not read: the workout goes again without them, so it still gets there', async () => {
  let clock = NOW;
  const s = strava();
  s.uploadError = 'Unrecognised exercise_type';
  const stored = { ...doc, workouts: [lifting] };
  const { h } = hub(ENV, s, () => clock, () => stored);
  const { connection } = await connect(h);
  h.update('u1', connection.id, { strength: true });
  h.onStateWrite('u1', { workouts: [] }, stored);
  await h._outbox().run();
  assert.equal(s.uploads.length, 1);
  assert.equal(s.activities.length, 0);
  clock += 5000;
  await h._outbox().run();
  assert.equal(s.uploads.length, 1, 'not the same file again');
  assert.equal(s.activities.length, 1, 'a manual Weight Training activity, its sets in the description');
  assert.equal(s.activities[0].sport_type, 'WeightTraining');
  assert.match(s.activities[0].description, /^Barbell bench press\nSet 1: 60 kg × 8/);
  assert.equal(h.describe('u1').connections[0].queued, 0);
});

test('the sets file: work sets only, each side its own set, time for timed sets, pounds in kilograms', () => {
  const t0 = Date.parse('2026-11-18T22:00:00Z');
  const w = { id: 'w5', d: '2026-11-18', name: 'Arms', start: t0, end: t0 + 40 * 60000, entries: [
    { id: '0025', sets: [{ w: 45, r: 10, phase: 'warmup', done: true }, { w: 135, r: 5, done: true }, { w: 135, r: 5, done: false }] },
    { id: 'curl', sets: [{ sides: { L: { w: 20, r: 12, done: true }, R: { w: 20, r: 10, done: true } } }] },
    { id: 'plank', sets: [{ sec: 60, done: true }, { done: true }] },
  ] };
  const own = { unit: 'lb', customEx: [{ id: 'curl', name: 'Rosca alternada com halteres' }, { id: 'plank', name: 'Prancha' }] };
  const p = workoutPayload(w, own);
  const file = JSON.parse(setsFileFor(p, activityFor(p, { strength: true }), { tz: 'America/Sao_Paulo' }));
  assert.equal(file.start_time, '2026-11-18T22:00:00Z');
  assert.equal(file.utc_offset, -3 * 3600);
  assert.equal(file.elapsed_time, 40 * 60);
  assert.equal(file.streams, undefined, 'no heart rate, no stream');
  assert.deepEqual(file.sets, [
    { exercise_type: 'BARBELL_BENCH_PRESS', repetitions: 5, weight: 61.23 },
    { exercise_type: 'STANDING_DUMBBELL_BICEPS_CURL', repetitions: 12, weight: 9.07 },
    { exercise_type: 'STANDING_DUMBBELL_BICEPS_CURL', repetitions: 10, weight: 9.07 },
    { exercise_type: 'PLANK_GENERIC', duration: 60 },
  ]);
  const warmupsOnly = workoutPayload({ ...w, entries: [{ id: '0025', sets: [{ w: 45, r: 10, phase: 'warmup', done: true }] }] }, own);
  assert.equal(setsFileFor(warmupsOnly, activityFor(warmupsOnly, { strength: true })), null);
});
