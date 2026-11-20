import assert from 'node:assert/strict'
import test from 'node:test'
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { runtimeModules } from './helpers/runtimeModules.mjs'

const boundaries = { '@jetlinks-web/utils': { randomString: () => 'condition' } }
const modules = runtimeModules(boundaries)
boundaries['@jetlinks-web-core/components/ConditionFilter'] = modules.load('../../jetlinks-web-core/src/components/ConditionFilter/utils.ts')
const { useIotDevicePropertyHistoryFilter } = modules.load('views/device/list/components/device-detail/useIotDevicePropertyHistoryFilter.ts')
const start = dayjs('2026-11-19T00:00:00'), end = dayjs('2026-11-19T12:00:00')
function fixture(type = 'double', definition = {}) {
  const property = ref({ name: '属性', identifier: 'p', valueType: { type, ...definition } })
  const range = ref([start, end])
  const api = useIotDevicePropertyHistoryFilter(computed(() => property.value), range)
  // 与真实 ConditionFilter.change 契约一致：编辑模型和已转换的查询条件分别回传。
  const submitConditions = terms => {
    api.filterTerms.value = terms
    api.submitListFilter(boundaries['@jetlinks-web-core/components/ConditionFilter'].buildQueryFilter(terms, api.filterFields.value).terms)
  }
  return { ...api, submitConditions, property, range }
}

test('numeric history conditions keep zero, map to numberValue and preserve the outer time range', () => {
  const f = fixture()
  f.submitConditions([{ column: 'value', termType: 'gte', value: 0 }])
  assert.deepEqual(f.buildListTerms(), [
    { terms: [{ column: 'timestamp', termType: 'btw', value: [start.valueOf(), end.valueOf()] }] },
    { type: 'and', terms: [{ column: 'numberValue', termType: 'gte', value: 0 }] },
  ])
  f.filterTerms.value[0].value = 99
  assert.equal(f.buildListTerms()[1].terms[0].value, 0, 'draft edits cannot change paginated queries')
})

test('text contains uses the shared escaping once and reset removes only user conditions', () => {
  const f = fixture('string')
  f.submitConditions([{ column: 'value', termType: 'like', value: 'a%b' }])
  assert.equal(f.buildListTerms()[1].terms[0].value, '%a\\%b%')
  assert.equal(f.buildListTerms()[1].terms[0].value, '%a\\%b%', 'repeated page loads must not add wildcards')
  f.resetListFilter()
  assert.equal(f.filterTerms.value.length, 0)
  assert.equal(f.buildListTerms().length, 1)
})

test('boolean false and enum zero remain selectable and query as original values', () => {
  for (const [type, value, definition] of [
    ['boolean', false, { falseText: '关', trueText: '开' }],
    ['enum', 0, { elements: [{ text: '空闲', value: 0 }, { text: '运行', value: 1 }] }],
  ]) {
    const f = fixture(type, definition)
    const field = f.filterFields.value.find(field => field.dataIndex === 'value')
    assert.equal(field.search.type, 'select')
    assert.equal(field.search.options[0].value, value)
    f.submitConditions([{ column: 'value', termType: 'eq', value }])
    assert.equal(f.buildListTerms()[1].terms[0].value, value)
  }
})

test('date ranges convert to milliseconds and OR conditions stay within the selected time range', () => {
  const f = fixture()
  f.submitConditions([
    { column: 'timestamp', termType: 'btw', value: ['2026-11-19 10:00:00', '2026-11-19 11:00:00'] },
    { column: 'value', termType: 'eq', value: 1, type: 'or' },
  ])
  const [, group] = f.buildListTerms()
  assert.equal(group.type, 'and')
  assert.deepEqual(group.terms[0].value, [dayjs('2026-11-19 10:00:00').valueOf(), dayjs('2026-11-19 11:00:00').valueOf()])
  assert.equal(group.terms[1].type, 'or')
})

test('structured properties expose time filtering without unsupported value comparisons', () => {
  for (const type of ['object', 'array', 'geoPoint', 'file']) {
    const f = fixture(type)
    assert.deepEqual(f.filterFields.value.map(field => field.dataIndex), ['timestamp'])
  }
})
