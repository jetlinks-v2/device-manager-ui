import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import { transform } from 'esbuild'

const conditionFilterPath = new URL('../../../jetlinks-web-core/src/components/ConditionFilter/utils.ts', import.meta.url)
const deviceAlarmPath = new URL('../views/device/list/components/device-detail/IotDeviceAlarmsTab.vue', import.meta.url)
const productAlarmPath = new URL('../views/device/Product/Detail/components/ProductAlarmRecordsTab.vue', import.meta.url)
const conditionFilterSource = (await readFile(conditionFilterPath, 'utf8'))
  .replace("import { randomString } from '@jetlinks-web/utils'", "const randomString = () => ''")
  .replace("import type { ConditionFieldSchema, ConditionFilterRouteVersion, ConditionTerm } from './types'\n", '')
  .replace("import { isConditionFieldArrayTermType } from './schema'", 'const isConditionFieldArrayTermType = () => false')

const { code } = await transform(`${conditionFilterSource}\nmodule.exports = { buildQueryFilter }`, {
  loader: 'ts',
  format: 'cjs',
})
const module = { exports: {} }
vm.runInNewContext(code, { module, exports: module.exports })
const { buildQueryFilter } = module.exports

test('alarm name fuzzy conditions are converted to wildcard syntax exactly once', () => {
  const fields = [{ dataIndex: 'alarmName', search: { type: 'string', defaultTermType: 'like' } }]
  const terms = buildQueryFilter([{ column: 'alarmName', termType: 'like', value: 'a' }], fields).terms

  assert.equal(terms[0].value, '%a%')
})

test('device and product alarm records preserve raw filter terms until request construction', async () => {
  const [deviceAlarm, productAlarm] = await Promise.all([
    readFile(deviceAlarmPath, 'utf8'),
    readFile(productAlarmPath, 'utf8'),
  ])

  assert.match(deviceAlarm, /function handleSearch\(\) \{\s*\/\/[^\n]*\s*submittedTerms\.value = filterTerms\.value\s*\}/)
  assert.match(productAlarm, /function submitSearch\(\) \{\s*\/\/[^\n]*\s*submittedTerms\.value = filterTerms\.value\s*\}/)
})
