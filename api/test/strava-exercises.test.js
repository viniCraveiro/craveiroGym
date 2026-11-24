/* What a lift is on Strava (integrations/strava-exercises.js): every catalogue exercise becomes
 * one of Strava's own exercise_type identifiers, the common lifts the specific one, and a
 * person's own exercises, named in English or Portuguese, too. */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { stravaExercise, STRAVA_EXERCISES } = await import('../integrations/strava-exercises.js');
const { LIBRARY } = await import('../coach/core/library.js');

const byName = n => stravaExercise({ id: LIBRARY.find(e => e.n === n)?.id });
const own = n => stravaExercise({ id: 'custom-1', name: n });

test('every catalogue exercise is one Strava takes', () => {
  assert.ok(STRAVA_EXERCISES.size > 600);
  const off = LIBRARY.filter(e => !STRAVA_EXERCISES.has(stravaExercise({ id: e.id }))).map(e => e.n);
  assert.deepEqual(off, []);
});

test('the common lifts in the catalogue: the specific identifier, by name and equipment', () => {
  const cases = {
    'barbell bench press': 'BARBELL_BENCH_PRESS',
    'dumbbell incline bench press': 'INCLINE_DUMBBELL_BENCH_PRESS',
    'barbell full squat': 'BARBELL_BACK_SQUAT',
    'barbell deadlift': 'BARBELL_DEADLIFT',
    'barbell romanian deadlift': 'BARBELL_ROMANIAN_DEADLIFT',
    'barbell bent over row': 'BENT_OVER_BARBELL_ROW',
    'cable seated row': 'SEATED_CABLE_ROW',
    'cable pulldown': 'LAT_PULLDOWN',
    'cable pushdown': 'CABLE_TRICEPS_PUSHDOWN',
    'dumbbell hammer curl': 'DUMBBELL_HAMMER_CURL',
    'dumbbell biceps curl': 'STANDING_DUMBBELL_BICEPS_CURL',
    'lever seated leg curl': 'MACHINE_LEG_CURL_SEATED',
    'lever leg extension': 'MACHINE_LEG_EXTENSION',
    'sled 45° leg press': 'MACHINE_LEG_PRESS',
    'lever seated calf raise': 'SEATED_CALF_RAISE',
    'barbell hip thrust': 'BARBELL_HIP_THRUST',
    'dumbbell fly': 'DUMBBELL_FLYE',
    'pull-up': 'PULL_UP_GENERIC',
    'push-up': 'PUSH_UP_GENERIC',
  };
  for (const [n, id] of Object.entries(cases)) assert.equal(byName(n), id, n);
});

test('a person’s own exercises, in Portuguese or English', () => {
  const cases = {
    'Supino reto com halteres': 'DUMBBELL_BENCH_PRESS',
    'Supino inclinado barra': 'INCLINE_BARBELL_BENCH_PRESS',
    'Agachamento livre com barra': 'BARBELL_BACK_SQUAT',
    'Leg press 45': 'MACHINE_LEG_PRESS',
    'Cadeira extensora': 'MACHINE_LEG_EXTENSION',
    'Cadeira abdutora': 'MACHINE_HIP_ABDUCTION',
    'Puxada frontal': 'LAT_PULLDOWN',
    'Remada baixa na polia': 'SEATED_CABLE_ROW',
    'Rosca direta barra W': 'STANDING_EZ_BAR_BICEPS_CURL',
    'Tríceps corda': 'CABLE_TRICEPS_PUSHDOWN',
    'Desenvolvimento com halteres': 'OVERHEAD_DUMBBELL_PRESS',
    'Panturrilha sentado': 'SEATED_CALF_RAISE',
    'Abdominal infra': 'REVERSE_CRUNCH',
    'Crucifixo máquina': 'MACHINE_CHEST_FLY',
    'Prancha': 'PLANK_GENERIC',
    'Cable lateral raise': 'CABLE_LATERAL_RAISE',
    'Kettlebell swing': 'KETTLEBELL_SWING',
  };
  for (const [n, id] of Object.entries(cases)) assert.equal(own(n), id, n);
});

test('stretches are not lifts, and a name nothing matches is still a Strava exercise', () => {
  assert.equal(own('Lat stretch'), 'STRETCH');
  assert.equal(own('Alongamento de posterior'), 'STRETCH');
  assert.equal(own('Something I made up'), 'TOTAL_BODY_GENERIC');
  assert.equal(stravaExercise(null), 'TOTAL_BODY_GENERIC');
});
