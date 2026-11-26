import assert from 'node:assert/strict'
import test from 'node:test'
import {
  eventHistoryValueText, formatEventHistoryValue, getEventFieldValue, getEventHistoryValues,
} from '../views/device/list/components/device-detail/event-history/eventHistoryValue.ts'

const labels = { missing: '未上报', emptyString: '空字符串', yes: '是', no: '否' }
const format = (value, valueType) => formatEventHistoryValue(value, valueType, labels, value => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString()
})
const field = type => ({ id: 'value', name: '测试字段', valueType: { type } })
const record = raw => ({ id: 'test', time: '2026-11-12', raw, values: getEventHistoryValues(raw) })

test('large Base64 and URLs remain complete in details while list summaries are bounded', () => {
  for (const value of ['iVBORw0KGgo' + 'A'.repeat(300_000), 'https://example.com/file?token=' + 'b'.repeat(20_000)]) {
    const raw = { timestamp: 1794470000000, value }
    const row = record(raw)
    assert.equal(format(getEventFieldValue(row, field('file')), { type: 'file', bodyType: 'base64' }), value)
    assert.equal(row.raw.value, value)
    assert.equal(JSON.parse(JSON.stringify(row.raw)).value, value)
    assert.equal(eventHistoryValueText(value, 200).length, 201)
    assert.equal(eventHistoryValueText(value), value)
  }
})

test('all numeric types retain zero, decimal precision and string-encoded long integers', () => {
  for (const type of ['int', 'long', 'float', 'double']) {
    for (const value of [0, -12, 1.25, '9223372036854775807', '0.12345678901234567890']) {
      assert.equal(format(value, { type }), value)
    }
  }
})

test('boolean and enum mappings retain unmatched values and custom false values', () => {
  assert.equal(format(false, { type: 'boolean' }), '否')
  assert.equal(format(0, { type: 'boolean', falseValue: 0, falseText: '关闭' }), '关闭')
  assert.equal(format(true, { type: 'boolean', trueText: '开启' }), '开启')
  assert.equal(format('unknown', { type: 'boolean' }), 'unknown')
  const type = { type: 'enum', elements: [{ value: 0, text: '正常' }] }
  assert.equal(format(0, type), '正常')
  assert.equal(format(8, type), '8')
})

test('missing values, null, empty strings, false, zero and empty collections remain distinct', () => {
  const cases = [[undefined, '未上报'], [null, 'null'], ['', '空字符串'], [false, false], [0, 0], [[], []], [{}, {}]]
  for (const [value, expected] of cases) assert.deepEqual(format(value, { type: 'unknown' }), expected)
  for (const value of [null, '', false, 0]) {
    assert.equal(getEventHistoryValues({ value, payload: 'must not replace value' }).value, value)
  }
})

test('nested objects, arrays and geographical coordinates parse without losing nested file fields', () => {
  const value = { nested: { image: 'A'.repeat(5000), flags: [false, 0, null] } }
  assert.deepEqual(format(JSON.stringify(value), { type: 'object' }), value)
  assert.deepEqual(format('[0,false,null,{}]', { type: 'array' }), [0, false, null, {}])
  assert.deepEqual(format('{"lon":106.5,"lat":29.5}', { type: 'geoPoint' }), { lon: 106.5, lat: 29.5 })
  assert.equal(format('{broken}', { type: 'object' }), '{broken}')
})

test('strings, passwords, unknown types and file values never infer a media preview or change their text', () => {
  for (const type of ['string', 'password', 'file', 'extension']) {
    for (const value of ['{"keep":"as text"}', '  leading\ntrailing  ', '<script>alert(1)</script>']) {
      assert.equal(format(value, { type }), value)
    }
  }
})

test('formatted values affect only the readable section and preserve the original response', () => {
  const raw = { value: { level: 0, level_format: '正常' }, extra: { source: 'device' } }
  const original = structuredClone(raw)
  const row = record(raw)
  assert.equal(getEventFieldValue(row, { id: 'level', name: '等级' }), '正常')
  assert.deepEqual(raw, original)
  assert.deepEqual(row.raw, original)
  assert.deepEqual(getEventFieldValue(record({ value: '{"a":[1]}', value_format: '[object Object]' }), field('object')), { a: [1] })
})

test('flat and wrapped historical response shapes keep values and unknown historical fields', () => {
  for (const raw of [
    { value: { photo: 'base64', extra: 1 } },
    { data: { value: { photo: 'base64', extra: 1 } } },
    { payload: '{"photo":"base64","extra":1}' },
    { data: { photo: 'base64', extra: 1 } },
    { photo: 'base64', extra: 1 },
  ]) {
    const row = record(raw)
    assert.equal(row.values.photo, 'base64')
    assert.equal(row.values.extra, 1)
    assert.deepEqual(row.raw, raw)
  }
})

test('dates preserve invalid input and handle the epoch as a real timestamp', () => {
  assert.equal(format(0, { type: 'date' }), '1970-01-01T00:00:00.000Z')
  assert.equal(format('invalid date', { type: 'date' }), 'invalid date')
  assert.equal(format('2026-11-12T08:00:00Z', { type: 'date' }), '2026-11-12T08:00:00.000Z')
})
