// The workout's heart-rate curve (w.hrs) for Strava: from the hub's samples, from the watch, and
// which one wins.
import { describe, it, expect } from 'vitest'
import { seriesFromSamples, sanitizeSeries, applyHrSeries, SERIES_MAX } from './heart-rate.js'
import { mergeHeartRate } from './health-read.js'

const T = 1_800_000_000_000
const every = (ms, n, bpm = i => 100 + (i % 30)) => Array.from({ length: n }, (_, i) => [T + i * ms, bpm(i)])

describe('seriesFromSamples', () => {
  it('averages each ten-second slot, 0 where nothing was read', () => {
    const s = seriesFromSamples([...every(5000, 20, () => 120), [T + 200_000, 150], [T + 205_000, 152]], T, T + 210_000)
    expect(s.t0).toBe(T)
    expect(s.dt).toBe(10)
    expect(s.v.slice(0, 10)).toEqual(new Array(10).fill(120))
    expect(s.v[15]).toBe(0)
    expect(s.v[20]).toBe(151)
  })
  it('leaves out a band that saves a reading every ten minutes', () => {
    expect(seriesFromSamples(every(600_000, 6), T, T + 3_600_000)).toBe(null)
    expect(seriesFromSamples(every(5000, 5), T, T + 60_000)).toBe(null)
  })
  it('never grows past six hours', () => {
    expect(seriesFromSamples(every(5000, 6000), T, T + 30_000_000).v.length).toBe(SERIES_MAX)
  })
})

describe('sanitizeSeries', () => {
  it('drops impossible readings and refuses a curve with nothing in it', () => {
    expect(sanitizeSeries({ t0: T, dt: 10, v: [90, 999, 'x', 100] }).v).toEqual([90, 0, 0, 100])
    expect(sanitizeSeries({ t0: T, dt: 10, v: [0, 0, 90] })).toBe(null)
    expect(sanitizeSeries({ t0: T, dt: 0, v: [90, 91] })).toBe(null)
    expect(sanitizeSeries(null)).toBe(null)
  })
})

describe('applyHrSeries (the watch) and mergeHeartRate (the hub)', () => {
  const workout = () => ({ id: 'w1', start: T, end: T + 600_000, entries: [] })
  const stamp = w => { w._ts = 1 }

  it('puts the watch’s curve and calories on the saved workout, stamped', () => {
    const S = { workouts: [workout()] }
    expect(applyHrSeries(S, { wid: 'w1', t0: T, dt: 10, v: [100, 110, 120], kcal: 312.4 }, stamp)).toBe(true)
    expect(S.workouts[0].hrs).toEqual({ t0: T, dt: 10, v: [100, 110, 120], src: 'watch', n: 3 })
    expect(S.workouts[0].kcal).toBe(312)
    expect(S.workouts[0]._ts).toBe(1)
    // the same message again changes nothing
    expect(applyHrSeries(S, { wid: 'w1', t0: T, dt: 10, v: [100, 110, 120], kcal: 312 }, stamp)).toBe(false)
  })
  it('answers null for a workout not saved yet, so the event waits', () => {
    expect(applyHrSeries({ workouts: [] }, { wid: 'w1', t0: T, dt: 10, v: [100, 110] })).toBe(null)
  })
  it('the hub’s curve fills a workout without one and grows with a fuller read, never over the watch’s', () => {
    const S = { workouts: [workout()] }
    mergeHeartRate(S, 'w1', every(5000, 40), 'hc', T + 700_000)
    expect(S.workouts[0].hrs.src).toBe('hc')
    const first = S.workouts[0].hrs.n
    mergeHeartRate(S, 'w1', every(5000, 110), 'hc', T + 800_000)
    expect(S.workouts[0].hrs.n).toBeGreaterThan(first)
    applyHrSeries(S, { wid: 'w1', t0: T, dt: 10, v: [100, 110, 120] })
    expect(S.workouts[0].hrs.src).toBe('watch')
    mergeHeartRate(S, 'w1', every(2000, 290), 'hc', T + 900_000)
    expect(S.workouts[0].hrs.src).toBe('watch')
  })
})
