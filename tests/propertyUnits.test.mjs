import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computed } from 'vue'
import { setAlarmRequestHandler } from './alarmRequest.test-shim'
import { formatPropertyUnit, loadPropertyUnits } from '../views/device/alarm/hooks/usePropertyUnits'
import { splitPropertyValueAndUnit } from '../views/device/list/components/device-detail/iotDevicePropertyDisplay'

const commonUnits = [
  { id: 'celsius', symbol: '℃' }, { id: 'fahrenheit', symbol: '℉' },
  { id: 'percent', symbol: '%' }, { id: 'watts', symbol: 'W' }, { id: 'kwatts', symbol: 'kW' },
  { id: 'wattshour', symbol: 'W·h' }, { id: 'volts', symbol: 'V' }, { id: 'amperes', symbol: 'A' },
  { id: 'ohms', symbol: 'Ω' }, { id: 'meters', symbol: 'm' }, { id: 'seconds', symbol: 's' },
  { id: 'kilopascals', symbol: 'kPa' }, { id: 'metersPerSecondSquared', symbol: 'm/s²' },
  { id: 'kgce', symbol: 'kgce' },
]

test('property unit IDs resolve from the backend dictionary, share loads and react after a failed attempt', async () => {
  let requests = 0
  setAlarmRequestHandler(async url => {
    assert.equal(url, '/protocol/units')
    requests++
    throw new Error('Dictionary temporarily unavailable')
  })
  const label = computed(() => formatPropertyUnit({ type: 'double', unit: 'kWattsHour' }))
  assert.equal(label.value, 'kWattsHour')
  await loadPropertyUnits()
  assert.equal(label.value, 'kWattsHour', 'failure preserves the original unit rather than blocking rules')
  let release
  setAlarmRequestHandler(async url => {
    assert.equal(url, '/protocol/units')
    requests++
    return new Promise(resolve => { release = resolve })
  })
  const first = loadPropertyUnits()
  assert.equal(loadPropertyUnits(), first, 'concurrent cards share the same request')
  release({ success: true, result: [
    { id: 'kWattsHour', symbol: 'kW·h', name: '千瓦时' },
    { id: 'backend-extension', symbol: '自定义·符号' },
    ...commonUnits,
    { id: 'noUnits', symbol: '' },
  ] })
  await first
  assert.equal(requests, 2, 'failed loads can retry once')
  assert.equal(label.value, 'kW·h', 'already-rendered labels update without reopening the card')
  assert.equal(formatPropertyUnit('backend-extension'), '自定义·符号', 'no frontend mapping is needed for new units')
  assert.equal(formatPropertyUnit({ unit: 'kWattsHour', unitName: '自定义显示名' }), '自定义显示名')
  assert.equal(formatPropertyUnit({ unit: 'kWattsHour', unitText: 'kWh' }), 'kWh')
  assert.equal(formatPropertyUnit('unknown-unit'), 'unknown-unit')
  assert.equal(formatPropertyUnit({ type: 'double' }), undefined)
  await loadPropertyUnits()
  assert.equal(requests, 2, 'reopening the page reuses the dictionary')
})

for (const { id, symbol } of commonUnits) {
  test(`property unit ${id} follows the dictionary symbol ${symbol} used by formatted runtime values`, () => {
    assert.equal(formatPropertyUnit(id), symbol)
    assert.equal(formatPropertyUnit({ type: 'double', unit: id }), symbol)
    assert.equal(formatPropertyUnit({ type: 'double', unit: { id } }), symbol)
    assert.equal(formatPropertyUnit({ type: 'double', unit: id, unitText: '自定义文字' }), '自定义文字')
    assert.equal(formatPropertyUnit({ type: 'double', unit: id, unitName: '', unitLabel: ' ' }), symbol)
    for (const value of [0, -16, 12.5]) {
      const runtime = splitPropertyValueAndUnit(`${value}${symbol}`, id)
      assert.equal(runtime.unit, formatPropertyUnit(id), 'rules and already-formatted runtime data show the same symbol')
      assert.equal(runtime.value, String(value))
    }
  })
}

test('a registered empty symbol means no unit instead of exposing its internal ID', () => {
  assert.equal(formatPropertyUnit('noUnits'), '')
  assert.equal(formatPropertyUnit({ type: 'double', unit: 'noUnits' }), '')
  for (const value of [undefined, null, '', ' ', { type: 'double' }]) assert.equal(formatPropertyUnit(value), undefined)
  assert.equal(formatPropertyUnit('custom-unit/长单位'), 'custom-unit/长单位')
})
