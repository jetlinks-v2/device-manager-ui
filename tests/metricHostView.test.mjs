import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { computed, effectScope, nextTick, reactive, ref, shallowRef, watch } from 'vue'
import { transform } from 'esbuild'

// 执行宿主实际的局部状态段，覆盖 Vue watcher 的调度与返回引用消费，而非复制状态算法。
async function localState(path, start, end, names, args, result) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  const from = source.indexOf(start)
  const until = source.indexOf(end, from)
  assert.ok(from >= 0 && until > from)
  const { code } = await transform(source.slice(from, until), { loader: 'ts' })
  return new Function(...names, `${code}; return ${result}`)(...args)
}
const runtime = { ref, computed, shallowRef, watch }

test('group metrics retains the selected view across valid scopes and consumes explicit return once', async () => {
  const scope = effectScope()
  const route = reactive({ query: {} })
  const hostScope = { scopeType: ref('group'), scopeId: ref('group-1') }
  const sidebarProps = ref({ groups: [{ id: 'group-1', name: '一层' }, { id: 'group-2', name: '二层' }] })
  let host
  await scope.run(async () => {
    host = await localState('../views/device/list/unified/index.vue', 'const groupView =', 'function formatTableTime',
      [...Object.keys(runtime), 'route', 'scope', 'sidebarProps', 'metricAuth', 'deviceMenuCode'],
      [...Object.values(runtime), route, hostScope, sidebarProps, { hasPermission: () => true }, ref('device/Instance')],
      '{ groupView, metricGroup }')
  })
  assert.equal(host.groupView.value, 'devices')
  host.groupView.value = 'metrics'
  hostScope.scopeId.value = 'group-2'; await nextTick()
  assert.equal(host.groupView.value, 'metrics')
  hostScope.scopeType.value = 'area'; await nextTick()
  assert.equal(host.metricGroup.value, undefined)
  hostScope.scopeType.value = 'group'
  route.query = { metricOwnerType: 'deviceGroup', metricOwnerId: 'group-2', metricView: 'metrics', metricConfigId: 'second', metricOutputId: 'peak' }
  await nextTick(); assert.equal(host.groupView.value, 'metrics')
  host.groupView.value = 'devices'
  hostScope.scopeId.value = 'group-1'; await nextTick()
  hostScope.scopeId.value = 'group-2'; await nextTick()
  assert.equal(host.groupView.value, 'devices')
  route.query.metricOutputId = 'total'; await nextTick()
  assert.equal(host.groupView.value, 'metrics')
  scope.stop()
})

test('space region switch keeps metric tab and late explicit return restores once', async () => {
  const props = reactive({ region: { areaId: 'space-1' } })
  const route = reactive({ query: {} })
  const events = []
  const host = await localState('../../jetlinks-space-ui/views/space/Situation/components/SituationRegionDetail.vue', 'const activeTab =', '</script>',
    [...Object.keys(runtime), 'props', 'useRoute', 'emit'],
    [...Object.values(runtime), props, () => route, (...event) => events.push(event)], '{ activeTab }')
  assert.equal(host.activeTab.value, 'info')
  host.activeTab.value = 'metrics'; await nextTick()
  props.region = { areaId: 'space-2' }; await nextTick()
  assert.equal(host.activeTab.value, 'metrics')
  assert.deepEqual(events.at(-1), ['metrics-view-change', { areaId: 'space-2', active: true }])
  route.query = { metricOwnerType: 'space', metricOwnerId: 'space-3', metricView: 'metrics', metricConfigId: 'second', metricOutputId: 'peak' }
  host.activeTab.value = 'info'; await nextTick()
  props.region = { areaId: 'space-3' }; await nextTick()
  assert.equal(host.activeTab.value, 'metrics')
  host.activeTab.value = 'info'; await nextTick()
  props.region = { areaId: 'space-2' }; await nextTick()
  props.region = { areaId: 'space-3' }; await nextTick()
  assert.equal(host.activeTab.value, 'info')
})

test('space expanded workspace follows current region, visibility and detail kind', async () => {
  const props = reactive({ open: true, selectedRegion: { areaId: 'space-1' }, selectedAsset: null, selectedEvent: null })
  const events = []
  const host = await localState('../../jetlinks-space-ui/views/space/Situation/components/SituationDetailDrawer.vue', 'const regionMetricView =', 'const { t } =',
    [...Object.keys(runtime), 'props', 'emit'], [...Object.values(runtime), props, (...event) => events.push(event)], '{ regionMetricView }')
  const active = () => events.at(-1)?.[1]
  assert.equal(active(), false)
  host.regionMetricView.value = { areaId: 'space-1', active: true }; await nextTick()
  assert.equal(active(), true)
  props.selectedRegion = { areaId: 'space-2' }; await nextTick()
  assert.equal(active(), false)
  host.regionMetricView.value = { areaId: 'space-1', active: true }; await nextTick()
  assert.equal(active(), false)
  host.regionMetricView.value = { areaId: 'space-2', active: true }; await nextTick()
  assert.equal(active(), true)
  props.selectedAsset = { id: 'asset-1' }; await nextTick(); assert.equal(active(), false)
  props.selectedAsset = null; props.selectedEvent = { id: 'event-1' }; await nextTick(); assert.equal(active(), false)
  props.selectedEvent = null; await nextTick(); assert.equal(active(), true)
  props.open = false; await nextTick(); assert.equal(active(), false)
  props.open = true; host.regionMetricView.value = { areaId: 'space-2', active: false }; await nextTick(); assert.equal(active(), false)
})
