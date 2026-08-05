import assert from 'node:assert/strict'
import test from 'node:test'

import {
  describeDeviceToolTimeRange,
  resolveDeviceToolTimeRange,
} from '../views/device/agentTools/timeRangeSupport.ts'

const fixedNow = new Date(2031, 5, 20, 12, 0, 0, 0).getTime()
const options = { now: () => fixedNow, invalidInputMessage: 'invalid range' }

test('resolves an explicit interval string and includes the complete end date', () => {
  const range = resolveDeviceToolTimeRange({
    timeRange: '2031-02-03 to 2031-02-05',
  }, options)

  assert.deepEqual(range, {
    start: new Date(2031, 1, 3, 0, 0, 0, 0).getTime(),
    end: new Date(2031, 1, 5, 23, 59, 59, 999).getTime(),
  })
})

test('resolves nested backend range objects and normalizes reversed boundaries', () => {
  const range = resolveDeviceToolTimeRange({
    timeRange: {
      result: {
        from: new Date(2031, 2, 8).getTime(),
        to: new Date(2031, 2, 6).getTime(),
      },
    },
  }, options)

  assert.equal(range.start, new Date(2031, 2, 6).getTime())
  assert.equal(range.end, new Date(2031, 2, 8).getTime())
})

test('repairs a date-time separator without confusing it with date math', () => {
  const repaired = resolveDeviceToolTimeRange({
    startTime: '2031-02-03||04:05:06+08:00',
    endTime: '2031-02-03||05:05:06+08:00',
  }, options)
  const dateMath = resolveDeviceToolTimeRange({
    startTime: '2031-02-03||+1d',
  }, options)

  assert.equal(repaired.start, Date.parse('2031-02-02T20:05:06Z'))
  assert.equal(repaired.end, Date.parse('2031-02-02T21:05:06Z'))
  assert.equal(dateMath.start, new Date(2031, 1, 4).getTime())
})

test('fails closed for an explicit malformed range instead of returning empty boundaries', () => {
  assert.throws(
    () => resolveDeviceToolTimeRange({ timeRange: 'not-a-time-range' }, options),
    /invalid range/,
  )
})

test('describes only resolved boundaries', () => {
  const range = { start: new Date(2031, 3, 2).getTime() }
  const description = describeDeviceToolTimeRange(range)

  assert.equal(description?.startTime, range.start)
  assert.equal(description?.endTime, undefined)
  assert.equal(typeof description?.startTimeText, 'string')
})
