import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { transformSync } from 'esbuild'
import ts from 'typescript'
import * as vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import { renderToString } from 'vue/server-renderer'
import { createI18n } from 'vue-i18n'

const require = createRequire(import.meta.url)
const base = '../visDashboard/DeviceManagement/'
function load(relative, dependencies = {}, globals = {}) {
  const source = readFileSync(new URL(base + relative, import.meta.url), 'utf8').replaceAll('import.meta.env.DEV', 'false')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText
  const exports = {}
  new Function('exports', 'require', ...Object.keys(globals), output)(
    exports,
    (id) => dependencies[id] ?? (id === './deviceMapStatus' || id === '../DeviceMapCard/deviceMapStatus' ? load('DeviceMapCard/deviceMapStatus.ts') : require(id)),
    ...Object.values(globals)
  )
  return exports
}
function mount(setup) {
  let value
  const renderer = vue.createRenderer({
    createElement: () => ({}),
    createText: () => ({}),
    createComment: () => ({}),
    insert() {},
    remove() {},
    setText() {},
    setElementText() {},
    patchProp() {},
    parentNode: () => null,
    nextSibling: () => null
  })
  const app = renderer.createApp({
    setup() {
      value = setup()
      return () => null
    }
  })
  app.mount({})
  return { value, unmount: () => app.unmount() }
}
const point = (id, lng = 116.4, lat = 39.9) => ({ deviceId: id, label: 'Same name', lnglat: [lng, lat] })
const cluster = load('DeviceMapCard/cluster.ts')
const shared = load('shared.ts')
function deferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
const settle = async () => {
  await vue.nextTick()
  await Promise.resolve()
  await vue.nextTick()
}
function selectionFactory(service = {}) {
  const calls = []
  const details = []
  const locale = vue.ref('zh')
  const i18n = { useI18n: () => ({ locale, t: (key) => locale.value + ':' + key }) }
  const { useDeviceMapSelection } = load('hooks/useDeviceMapSelection.ts', {
    'vue-i18n': i18n,
    '@jetlinks-web-core/store/menu': { useMenuStore: () => service.menu ?? { hasMenu: () => false, jumpPage() {} } },
    '../../../dataCapabilities/deviceInstanceMonitoring.service': {
      async loadDeviceStates(query, signal) {
        calls.push({ ...query, signal })
        return service.states
          ? service.states(query, signal)
          : query.deviceIds.map((deviceId) => ({ deviceId, state: 'online', stateText: '在线' }))
      },
      async loadDeviceDetail(query, signal) {
        details.push({ ...query, signal })
        return service.detail ? service.detail(query, signal) : { deviceId: query.deviceId, stateText: '在线' }
      }
    }
  })
  return { useDeviceMapSelection, calls, details, locale }
}

function viewportModule(overrides = {}, globals = {}) {
  return load('hooks/useDeviceMapViewport.ts', {
    '@vueuse/core': { useResizeObserver() {}, useElementSize: () => ({ width: vue.ref(600), height: vue.ref(400) }) },
    'vue-router': { useRoute: () => ({ fullPath: '/resources/dashboard' }) },
    '@jetlinks-web-core/store/user': { useUserStore: () => ({ userInfo: { id: 'test-user' } }) },
    '@jetlinks-web-core/utils': { getBaseApi: () => '/api' },
    '../DeviceMapCard/cluster': cluster,
    '../../../utils/map': load('../../utils/map.ts'),
    ...overrides,
  }, globals)
}

test('GeoJSON retains real device IDs even when names and coordinates coincide', () => {
  const { parseDeviceGeoJson } = load('services/deviceMap.ts', {
    '@jetlinks-web/constants': {},
    '@jetlinks-web/utils': {},
    '@jetlinks-web-core/utils': {},
    'event-source-polyfill': {},
    '../../../api/deviceInstanceMonitoring': {},
    '../../../dataCapabilities/deviceInstanceMonitoring.service': {}
  })
  const feature = (id, coordinates = [116.4, 39.9]) => ({
    geometry: { coordinates },
    properties: { objectId: id, id: 'geo-' + id, deviceName: 'Same name' }
  })
  const points = parseDeviceGeoJson(
    JSON.stringify({
      features: [
        feature('d1'),
        feature('d2'),
        feature('d3'),
        feature('bad', [null, null]),
        feature('', [0, 0]),
        feature('shape', [
          [1, 2],
          [3, 4]
        ])
      ]
    })
  )
  assert.deepEqual(
    points.map((p) => p.deviceId),
    ['d1', 'd2', 'd3']
  )
  assert.deepEqual(points[0].lnglat, [116.4, 39.9])
  assert.deepEqual(parseDeviceGeoJson('broken json'), [])
})

test('SDK coordinates are isolated and only exact matches share a marker at maximum zoom', () => {
  const devices = [point('d1'), point('d2', 116.40001), point('d3')]
  const groups = cluster.groupDevicesByLocation(devices)
  const markers = cluster.toDeviceMapMarkers(groups, false)
  assert.equal(markers.length, 3)
  markers[0].lnglat[0] = 99
  markers[1].lnglat = { lng: 116.40001, lat: 39.9 }
  assert.deepEqual(devices.map(p => p.lnglat[0]), [116.4, 116.40001, 116.4])
  const locations = cluster.toDeviceMapMarkers(groups, true)
  assert.deepEqual(locations.map(p => p.deviceCount), [2, 1])
  assert.deepEqual(groups.get(locations[0].locationKey).map(p => p.deviceId), ['d1', 'd3'])
  locations[0].lnglat = { lng: 116.4, lat: 39.9 }
  assert.equal(devices[0].lnglat.join(', '), '116.4, 39.9')
})

test('card paginates state requests and searches by ID without loading the entire cluster', async () => {
  const factory = selectionFactory()
  const { value, unmount } = mount(factory.useDeviceMapSelection)
  value.open(Array.from({ length: 23 }, (_, i) => point('d' + i)))
  await settle()
  assert.equal(value.view.count, 23)
  assert.equal(value.view.rows.length, 10)
  assert.equal(factory.calls[0].deviceIds.length, 10)
  value.changePage(3)
  await settle()
  assert.deepEqual(factory.calls[1].deviceIds, ['d20', 'd21', 'd22'])
  assert.equal(factory.calls[0].signal.aborted, true)
  value.search('d21')
  await settle()
  assert.equal(value.view.page, 1)
  assert.equal(value.view.total, 1)
  assert.equal(value.view.rows[0].deviceId, 'd21')
  value.search('no matches')
  await settle()
  assert.equal(value.view.total, 0)
  assert.equal(value.view.loading, false)
  value.close()
  await settle()
  assert.equal(value.view.visible, false)
  unmount()
})

test('stale page and detail results cannot overwrite a later selection; close aborts immediately', async () => {
  const requests = [],
    detailRequests = []
  const factory = selectionFactory({
    states: () => {
      const result = deferred()
      requests.push(result)
      return result.promise
    },
    detail: () => {
      const result = deferred()
      detailRequests.push(result)
      return result.promise
    }
  })
  const { value, unmount } = mount(factory.useDeviceMapSelection)
  value.open([point('old')])
  await settle()
  value.open([point('new')])
  await settle()
  requests[1].resolve([{ deviceId: 'new', state: 'online', stateText: 'new status' }])
  detailRequests[1].resolve({ deviceId: 'new', deviceName: 'new detail' })
  await settle()
  requests[0].resolve([{ deviceId: 'old', state: 'offline', stateText: 'old status' }])
  detailRequests[0].resolve({ deviceId: 'old', deviceName: 'old detail' })
  await settle()
  assert.equal(value.view.rows[0].stateText, 'new status')
  assert.equal(value.view.detail.deviceName, 'new detail')
  value.close()
  assert.equal(factory.calls[1].signal.aborted, true)
  assert.equal(factory.details[1].signal.aborted, true)
  await settle()
  assert.equal(value.view.detail, undefined)
  unmount()
})

test('a synthetic 500,000-device cluster keeps rendering and state requests bounded to ten rows', async () => {
  const factory = selectionFactory()
  const { value, unmount } = mount(factory.useDeviceMapSelection)
  value.open(Array.from({ length: 500_000 }, (_, index) => point('d' + index)))
  await settle()
  assert.equal(value.view.count, 500_000)
  assert.equal(value.view.rows.length, 10)
  assert.equal(factory.calls.length, 1)
  assert.equal(factory.calls[0].deviceIds.length, 10)
  value.changePage(50_000)
  await settle()
  assert.equal(value.view.rows[9].deviceId, 'd499999')
  assert.equal(factory.calls[1].deviceIds.length, 10)
  unmount()
})

test('errors allow retry, locale changes reload translated state/detail, and unmount cancels requests', async () => {
  let fail = true
  const factory = selectionFactory({
    states: async () => {
      if (fail) throw new Error('denied')
      return []
    },
    detail: async ({ deviceId }) => {
      if (fail) throw new Error('denied')
      return { deviceId }
    }
  })
  const { value, unmount } = mount(factory.useDeviceMapSelection)
  value.open([point('d1')])
  await settle()
  assert.equal(value.view.error, true)
  assert.equal(value.view.detailError, true)
  fail = false
  await Promise.all([value.refreshStates(), value.refreshDetail()])
  assert.equal(value.view.error, false)
  assert.equal(value.view.detailError, false)
  factory.locale.value = 'en'
  await settle()
  assert.equal(factory.calls.length, 3)
  assert.match(value.view.rows[0].stateText, /^en:/)
  unmount()
  assert.equal(factory.calls.at(-1).signal.aborted, true)
  assert.equal(factory.details.at(-1).signal.aborted, true)
})

test('actual map hook deduplicates by device ID, expands normal clusters, opens terminal cards, and stops in edit mode', async () => {
  const factory = selectionFactory()
  const streams = []
  const navigation = [], granted = vue.ref(true)
  const mapHook = load(
    'hooks/useDeviceMap.ts',
    {
      '@jetlinks-web-core/store/menu': { useMenuStore: () => ({ hasMenu: code => granted.value && code === 'system/Basis', jumpPage: code => navigation.push(code) }) },
      '../DeviceMapCard/config': {
        deviceMapCardConfig: { componentProps: { deviceMapCard: { topTitle: '', isAutoRefresh: false, interval: 60 } } }
      },
      '../shared': shared,
      '../services/deviceMap': {
        createDeviceMapStream(handlers) {
          const stream = {
            ...handlers,
            closed: false,
            close() {
              this.closed = true
            }
          }
          streams.push(stream)
          return stream
        }
      },
      '../DeviceMapCard/markers': { createDeviceMapMarkerOptions: () => ({}) },
      '../DeviceMapCard/cluster': cluster,
      './useDeviceMapSelection': factory,
      './useDeviceMapViewport': viewportModule(),
    }
  )
  const edit = vue.ref(false),
    enabled = vue.ref(true),
    moves = []
  const { value, unmount } = mount(() => mapHook.useDeviceMap(vue.ref({}), edit, enabled, vue.ref()))
  assert.equal(value.canConfigureMap.value, true)
  value.openMapConfig()
  granted.value = false
  value.openMapConfig()
  granted.value = true
  edit.value = true
  value.openMapConfig()
  assert.deepEqual(navigation, ['system/Basis'])
  edit.value = false
  await settle()
  const stream = streams.at(-1)
  stream.onMessage([point('d1'), point('d2', 116.40001), point('d3')])
  stream.onMessage([{ ...point('d1'), label: 'Updated name' }])
  assert.equal(value.points.value.length, 3)
  assert.equal(value.points.value[0].label, 'Updated name')
  let zoom = 17
  let zoomEnd
  value.onMapInit({
    getZoom: () => zoom,
    lngLatToContainer: () => ({ x: 0, y: 0 }),
    on: (_, callback) => { zoomEnd = callback },
    off: (_, callback) => assert.equal(callback, zoomEnd),
    getFitZoomAndCenterByBounds: (bounds, padding, maxZoom) => {
      assert.deepEqual(bounds, [116.4, 39.9, 116.40001, 39.9])
      return [Math.min(17, maxZoom), [116.400005, 39.9]]
    },
    setZoomAndCenter: (...args) => moves.push(args)
  })
  stream.onComplete()
  await settle()
  assert.deepEqual(moves, [[16, [116.400005, 39.9]]])
  const markers = value.clusterLocations.value
  markers.forEach(p => { p.lnglat = { lng: p.lnglat[0], lat: p.lnglat[1] } })
  value.onClusterClick({ clusterData: markers })
  assert.equal(moves.at(-1)[0], 19)
  assert.equal(value.selection.view.visible, false)
  const d2 = markers.find(p => p.deviceId === 'd2')
  value.onClusterClick({ clusterData: [d2] })
  assert.equal(value.selection.view.detailDevice.deviceId, 'd2')
  assert.equal(value.selection.view.detailDevice.lnglat.join(', '), '116.40001, 39.9')
  value.onClusterClick({ clusterData: markers.filter(p => p.deviceId !== 'd2') })
  assert.deepEqual(moves.at(-1), [20, [116.4, 39.9]])
  assert.equal(value.selection.view.visible, false)
  zoom = 19.5
  zoomEnd()
  const grouped = value.clusterLocations.value
  assert.equal(grouped.length, 2)
  const overlapMarker = { getExtData: () => ({ locationKey: grouped[0].locationKey }) }
  value.onClusterClick({ clusterData: [], marker: overlapMarker })
  assert.equal(value.selection.view.visible, false)
  assert.deepEqual(moves.at(-1), [20, [116.4, 39.9]])
  zoom = 20
  zoomEnd()
  const [overlap, single] = value.clusterLocations.value
  value.onClusterClick({ clusterData: [], marker: overlapMarker })
  assert.deepEqual(value.selection.view.rows.map(p => p.deviceId), ['d1', 'd3'])
  value.onClusterClick({ clusterData: [], marker: { getExtData: () => ({ locationKey: single.locationKey }) } })
  assert.equal(value.selection.view.count, 1)
  assert.equal(value.selection.view.detailDevice.deviceId, 'd2')
  await settle()
  edit.value = true
  await settle()
  assert.equal(stream.closed, true)
  assert.equal(value.selection.view.visible, false)
  assert.equal(value.points.value.length, 0)
  stream.onMessage([point('late')])
  assert.equal(value.points.value.length, 0)
  value.onClusterClick({ clusterData: [overlap] })
  assert.equal(value.selection.view.visible, false)
  unmount()
})

test('Chinese and English footer interpolate the actual count', () => {
  for (const locale of ['zh', 'en']) {
    const messages = Object.fromEntries(
      Object.entries(
        JSON.parse(readFileSync(new URL('../locales/lang/' + locale + '.json', import.meta.url), 'utf8'))
      ).filter(([key]) => key.startsWith('components.DeviceMap.'))
    )
    const i18n = createI18n({ legacy: false, locale, flatJson: true, messages: { [locale]: messages } })
    const text = i18n.global.t('components.DeviceMap.tooClose', { count: 3 })
    assert.equal(text.includes('{count}'), false)
    if (locale === 'zh') assert.equal(text, '3台设备位置太近，无法继续展开')
    else assert.equal(text, '3 devices are too close together to expand further')
  }
})

test('marker renderer labels clusters and coincident devices with device counts', () => {
  const elements = []
  const { createDeviceMapMarkerOptions } = load(
    'DeviceMapCard/markers.ts',
    {
      './cluster': cluster,
      '@device-manager-ui/assets/marker.png': 'marker.png'
    },
    {
      window: { AMap: { Pixel: class { constructor(x, y) { this.x = x; this.y = y } } } },
      document: {
        createElement(tag) {
          const node = {
            tag,
            style: {},
            children: [],
            append(...children) {
              this.children.push(...children)
            }
          }
          Object.defineProperty(node, 'innerHTML', {
            set() {
              throw new Error('HTML interpolation is unsafe')
            }
          })
          elements.push(node)
          return node
        }
      }
    }
  )
  const options = createDeviceMapMarkerOptions()
  assert.equal(options.maxZoom, 19)
  assert.equal(options.zoomOnClick, false)
  let content, extData, offset, anchor
  const marker = {
    setExtData(value) { extData = value },
    setOffset(value) { offset = value },
    setAnchor(value) { anchor = value },
    setContent(value) {
      content = value
    }
  }
  options.renderMarker({ marker, count: 1, data: [{ label: '<img src=x onerror=alert(1)>', deviceCount: 1 }] })
  assert.equal(content.children[0].textContent, '<img src=x onerror=alert(1)>')
  options.renderMarker({ marker, data: [{ deviceCount: 2, locationKey: '1,2' }] })
  assert.deepEqual(extData, { locationKey: '1,2' })
  assert.equal(content.textContent, '2')
  options.renderClusterMarker({ marker, count: 3 })
  assert.equal(content.textContent, '3')
  offset = { x: -9, y: -32 }
  createDeviceMapMarkerOptions(true).renderMarker({ marker, data: [{ state: 'online', deviceCount: 1 }] })
  assert.equal(anchor, 'center')
  assert.deepEqual([offset.x, offset.y], [0, 0])
})

test('distribution preserves states, geometry proportions and independent point identity', () => {
  const {buildDeviceDistributionOption,distributionColors} = load('DeviceMapCard/distribution.ts', {
    '@jetlinks-web-core/components/Echarts/library': {use(){},registerMap(){}},
    'echarts/components': {GeoComponent:{}},
    './distributionLand.json': {type:'FeatureCollection',features:[]},
  })
  const points = [
    {...point('on'),state:'online'}, {...point('off'),state:'offline'},
    {...point('disabled'),state:'notActive'}, point('unknown'),
  ]
  const labels={online:'在线',offline:'离线',disabled:'禁用',unknown:'未知'}
  const option=buildDeviceDistributionOption(points,labels,{width:400,height:300})
  assert.equal(option.series[0].data.length,4)
  const byId=Object.fromEntries(option.series[0].data.map(p=>[p.deviceId,p]))
  assert.deepEqual(['on','off','disabled','unknown'].map(id=>byId[id].itemStyle.color),[distributionColors.online,distributionColors.offline,distributionColors.disabled,distributionColors.unknown])
  assert.ok(option.geo.projection.project([116,54])[1] < option.geo.projection.project([116,17])[1])
  assert.ok(option.geo.layoutSize<=388)
  const narrow=buildDeviceDistributionOption(points,labels,{width:100,height:300})
  assert.equal(narrow.geo.layoutSize,88)
})

test('distribution state requests batch and retain unknown points on partial failure', async () => {
  const calls=[]
  const {loadDeviceMapStates}=load('services/deviceMap.ts', {
    '@jetlinks-web/constants':{},'@jetlinks-web/utils':{},'@jetlinks-web-core/utils':{},'event-source-polyfill':{},
    '../../../api/deviceInstanceMonitoring':{},
    '../../../dataCapabilities/deviceInstanceMonitoring.service': {loadDeviceStates:async ({deviceIds})=>{
      calls.push(deviceIds)
      if(calls.length===2) throw Error('failure')
      return deviceIds.map(deviceId=>({deviceId,state:'online',stateText:'在线'}))
    }},
  })
  const points=Array.from({length:201},(_,i)=>point(String(i)))
  const result=await loadDeviceMapStates(points,new AbortController().signal)
  assert.deepEqual(calls.map(c=>c.length),[100,100,1])
  assert.equal(result.failed,true)
  assert.equal(result.points.length,201)
  assert.equal(result.points[0].state,'online')
  assert.equal(result.points[100].state,undefined)
  assert.equal(result.points[200].state,'online')
  const aborted=new AbortController();aborted.abort()
  await assert.rejects(loadDeviceMapStates(points,aborted.signal),/cancelled/)
})

test('distribution hook rejects stale state responses on scope change and selects overlapping devices', async () => {
  const streams=[], pending=[], factory=selectionFactory()
  const {useDeviceMap}=load('hooks/useDeviceMap.ts', {
    '@jetlinks-web-core/store/menu': { useMenuStore: () => ({ hasMenu: () => false, jumpPage() {} }) },
    '../DeviceMapCard/config': {deviceMapCardConfig:{componentProps:{deviceMapCard:{presentation:'distribution',scope:'a',isAutoRefresh:false,interval:60}}}},
    '../shared':shared,
    '../services/deviceMap': {
      createDeviceMapStream(handlers){const stream={...handlers,close(){}};streams.push(stream);return stream},
      loadDeviceMapStates(points,signal){const d=deferred();pending.push({...d,points,signal});return d.promise},
    },
    '../DeviceMapCard/markers':{createDeviceMapMarkerOptions:()=>({})},
    '../DeviceMapCard/cluster':cluster,'./useDeviceMapSelection':factory,'./useDeviceMapViewport':viewportModule(),'../../../utils/map':load('../../utils/map.ts'),
  })
  const info=vue.ref({componentProps:{deviceMapCard:{presentation:'distribution',scope:'a',isAutoRefresh:false}}})
  const {value,unmount}=mount(()=>useDeviceMap(info,vue.ref(false),vue.ref(false),vue.ref()))
  streams[0].onMessage([point('a'),point('b')]);streams[0].onComplete();await settle()
  assert.equal(pending.length,1)
  info.value={componentProps:{deviceMapCard:{presentation:'distribution',scope:'b',isAutoRefresh:false}}};await settle()
  assert.equal(pending[0].signal.aborted,true)
  streams[1].onMessage([point('new'),point('other')]);streams[1].onComplete();await settle()
  pending[1].resolve({points:[{...point('new'),state:'online'},point('other')],failed:false});await settle()
  pending[0].resolve({points:[point('stale')],failed:false});await settle()
  assert.deepEqual(value.points.value.map(p=>p.deviceId),['new','other'])
  value.onPointSelect('new');assert.equal(value.selection.view.count,2)
  unmount()
})

test('summary navigation uses authorized route, correct id and prevents duplicate navigation', async () => {
  const pending = deferred(), calls = [], remembered = []
  const factory = selectionFactory({
    detail: async () => ({ deviceName: '设备', productName: '产品', state: 'online', stateText: '在线', lastActiveTime: new Date(2026, 10, 12, 14, 32).getTime() }),
    menu: { hasMenu: code => code === 'iot-user-device-list/Detail', jumpPage: (code, options) => { calls.push({ code, options }); return pending.promise } },
  })
  const {value,unmount}=mount(()=>factory.useDeviceMapSelection(id=>remembered.push(id)))
  value.open([point('selected')]); await settle()
  assert.equal(value.view.canOpenDetail,true)
  assert.equal(value.view.detailStatus.text,'在线')
  assert.deepEqual(value.view.detailFields.map(x=>x.value),['selected','产品','2026-11-12 14:32:00'])
  assert.equal(value.view.detailFields[0].copyable,true)
  const first=value.openDetailPage(); await value.openDetailPage()
  assert.equal(calls.length,1); assert.equal(calls[0].options.params.id,'selected'); assert.deepEqual(remembered,['selected'])
  pending.resolve(); await first; assert.equal(value.view.openingDetail,false); unmount()
})

test('initial camera waits for visible locations, keeps manual changes on refresh and refits a new scope', async () => {
  const camera = viewportModule()
  const locations = vue.shallowRef([point('only', 103, 26)])
  const scope = vue.ref('project-a')
  const { value, unmount } = mount(() => camera.useDeviceMapViewport(scope, vue.ref(), vue.ref(), locations))
  const moves = []
  const listeners = new Map()
  value.onMapInit({
    getZoom: () => 13,
    on: (event, cb) => listeners.set(event, cb),
    off: (event, cb) => { assert.equal(cb, listeners.get(event)); listeners.delete(event) },
    setZoomAndCenter: (...args) => moves.push(args),
    getFitZoomAndCenterByBounds(bounds, padding, maxZoom) {
      assert.deepEqual(bounds, [90, 26, 122, 26])
      assert.deepEqual(padding, [40, 40, 40, 40])
      assert.equal(maxZoom, 16)
      return [5, { lng: 106, lat: 26 }]
    },
  })
  await settle()
  assert.deepEqual(moves, [[16, [103, 26]]])
  locations.value = []
  await settle()
  locations.value = [point('refresh', 102, 26)]
  await settle()
  assert.equal(moves.length, 1)
  scope.value = 'project-b'
  locations.value = []
  await settle()
  assert.equal(moves.length, 1)
  locations.value = [point('west', 90, 26), point('east', 122, 26)]
  await settle()
  assert.deepEqual(moves[1], [5, { lng: 106, lat: 26 }])
  unmount()
  assert.equal(listeners.size, 0)
})

test('an open popup fits after zoom, map resize and async content layout without panning an in-bounds map', async () => {
  let onContentResize, frame
  const camera = viewportModule({
    '@vueuse/core': {
      useElementSize: () => ({ width: vue.ref(400), height: vue.ref(300) }),
      useResizeObserver: (_, callback) => { onContentResize = callback },
    },
  }, {
    requestAnimationFrame: cb => { assert.equal(frame, undefined); frame = cb; return 1 },
    cancelAnimationFrame: () => { frame = undefined },
  })
  const runFrame = () => { const callback = frame; frame = undefined; callback() }
  const position = vue.ref([116, 39])
  const { value, unmount } = mount(() => camera.useDeviceMapViewport(vue.ref('a'), vue.ref(), position, vue.ref([])))
  const pans = [], listeners = new Map()
  let pixel = { x: 80, y: 0 }, size = { width: 400, height: 300 }
  value.onMapInit({
    lngLatToContainer: () => pixel, getZoom: () => 13, getSize: () => size,
    on: (event, cb) => listeners.set(event, cb), off: event => listeners.delete(event),
    panBy: (...args) => pans.push(args),
  })
  const panel = { offsetWidth: 320, offsetHeight: 220 }
  value.popupElement.value = panel
  await settle()
  onContentResize()
  listeners.get('zoomend')()
  runFrame()
  assert.deepEqual(pans, [[92, 12, 0]])
  // The SDK changes its projection during resize before the previous overlay paints.
  size = { width: 246, height: 219 }
  Object.assign(panel, { offsetWidth: 222, offsetHeight: 179 })
  pixel = { x: 134, y: -42 }
  listeners.get('resize')()
  runFrame()
  assert.deepEqual(pans.at(-1), [-11, 54, 0])
  pixel = { x: 123, y: 207 }
  onContentResize()
  runFrame()
  assert.equal(value.popup.value.placement, 'above')
  assert.equal(pans.length, 2)
  listeners.get('zoomend')()
  unmount()
  assert.equal(frame, undefined)
  assert.equal(listeners.size, 0)
})

test('viewport restores camera and selected visible device only within the same identity', () => {
  const sizes={width:vue.ref(280),height:vue.ref(240)}, route=vue.reactive({fullPath:'/dashboard'}), user=vue.reactive({userInfo:{id:'a'}})
  const viewport=viewportModule({
    '@vueuse/core':{useResizeObserver(){},useElementSize:()=>sizes},'vue-router':{useRoute:()=>route},
    '@jetlinks-web-core/store/user':{useUserStore:()=>user},'@jetlinks-web-core/utils':{getBaseApi:()=>'/api'},
  })
  const pos=vue.ref([116,39]), identity=vue.ref('scope-a'), revision=vue.ref(1), moves=[]
  let containerY=10
  const instance={on(){},off(){},getCenter:()=>({lng:116,lat:39}),getZoom:()=>12,setZoomAndCenter:(...args)=>moves.push(args),lngLatToContainer:()=>({x:10,y:containerY})}
  const a=viewport.useDeviceMapViewport(identity,vue.ref(),pos,vue.ref([]),revision); a.onMapInit(instance)
  assert.equal(a.popup.value.placement,'below'); assert.equal(a.popup.value.style.width,'256px'); assert.equal(a.popup.value.style.maxHeight,'200px')
  assert.deepEqual(a.popup.value.offset,[0,16])
  containerY=200; revision.value=2
  assert.equal(a.popup.value.placement,'above'); assert.equal(a.popup.value.anchor,'bottom-center'); assert.deepEqual(a.popup.value.offset,[0,-16])
  containerY=10; revision.value=3
  sizes.width.value=600; sizes.height.value=400
  assert.equal(a.popup.value.style.width,'256px'); assert.equal(a.popup.value.style.maxHeight,'360px')
  sizes.width.value=280; sizes.height.value=240
  a.remember('d2'); const b=viewport.useDeviceMapViewport(identity,vue.ref(),pos,vue.ref([])); b.onMapInit(instance)
  assert.deepEqual(moves,[[12,[116,39],true]]); const restored=b.takeRestoredSelection([point('d1'),point('d2')]); assert.equal(restored.device.deviceId,'d2'); assert.equal(restored.points.length,2)
  b.remember('d2'); user.userInfo.id='b'; const c=viewport.useDeviceMapViewport(identity,vue.ref(),pos,vue.ref([])); assert.equal(c.takeRestoredSelection([point('d2')]),undefined)
  user.userInfo.id='a'; const d=viewport.useDeviceMapViewport(identity,vue.ref(),pos,vue.ref([])); assert.equal(d.takeRestoredSelection([point('other')]),undefined)
})

test('missing authorized detail menu disables navigation', async () => {
  let calls=0
  const factory=selectionFactory({menu:{hasMenu:()=>false,jumpPage:()=>{calls++}}})
  const {value,unmount}=mount(factory.useDeviceMapSelection)
  value.open([point('d1')]); await settle()
  assert.equal(value.view.hasDetailRoute,false); assert.equal(value.view.canOpenDetail,false)
  await value.openDetailPage(); assert.equal(calls,0); unmount()
})

test('selection card renders compact detail rows, formatted coordinates and link action', async () => {
  const file = new URL(base + 'DeviceMapCard/DeviceMapSelectionCard.vue', import.meta.url)
  const parsed = parse(readFileSync(file, 'utf8'), { filename: file.pathname })
  assert.deepEqual(parsed.errors, [])
  const code = transformSync(
    compileScript(parsed.descriptor, { id: 'DeviceMapSelectionCard.vue', inlineTemplate: true }).content,
    { loader: 'ts', format: 'cjs' },
  ).code
  const mod = { exports: {} }
  const stub = (tag) => ({ setup: (p, { slots, attrs }) => () => vue.h(tag, attrs, slots.default?.()) })
  const deps = {
    '@jetlinks-web-core/components/CloudEmpty/index.vue': { __esModule: true, default: stub('div') },
    '@ant-design/icons-vue': new Proxy({}, { get: () => stub('i') }),
  }
  new Function('require', 'module', 'exports', code)(id => deps[id] ?? require(id), mod, mod.exports)
  const view = {
    visible: true,
    revision: 1,
    count: 1,
    keyword: '',
    page: 1,
    pageSize: 10,
    total: 1,
    rows: [],
    loading: false,
    error: false,
    detailDevice: { deviceId: 'geo-cq-002', label: '重庆江北测试设备', lnglat: [106.53600311279297, 29.575000762939453] },
    detail: { deviceName: '重庆江北测试设备' },
    detailLoading: false,
    detailError: false,
    position: [106.53600311279297, 29.575000762939453],
    detailStatus: { color: '#ef4444', text: '离线' },
    canOpenDetail: true,
    hasDetailRoute: true,
    openingDetail: false,
    detailFields: [
      { key: 'deviceId', label: '设备 ID', value: 'geo-cq-002', copyable: true },
      { key: 'product', label: '所属产品', value: '重庆点位回填测试产品' },
      { key: 'lastActive', label: '最近活动时间', value: '2026-11-17 13:55:13' },
    ],
  }
  const i18nMessages = {
    'components.DeviceMap.openDetail': '查看设备详情',
    'components.DeviceMap.location': '地理位置',
  }
  const renderCard = async (currentView) => {
    const app = vue.createSSRApp(mod.exports.default, { view: currentView })
    app.use(createI18n({ legacy: false, locale: 'zh', messages: { zh: i18nMessages }, flatJson: true }))
    for (const name of ['AButton', 'ABadge', 'ASpin', 'ATypographyText', 'JEllipsis', 'AInputSearch', 'APagination']) {
      app.component(name, stub('span'))
    }
    return renderToString(app)
  }
  const html = await renderCard(view)
  assert.match(html, /device-map-selection__status/)
  assert.match(html, /<dl class="device-map-selection__details">/)
  assert.match(html, /<button[^>]*class="device-map-selection__link"[^>]*aria-label="查看设备详情"[^>]*title="geo-cq-002 · 查看设备详情"[^>]*>geo-cq-002<\/button>/)
  assert.match(html, /<dt class="device-map-selection__label">地理位置<\/dt>/)
  assert.match(html, /106\.536003, 29\.575001/)
  assert.match(html, /title="106\.53600311279297, 29\.575000762939453"/)
  assert.doesNotMatch(html, /device-map-selection__actions/)
  const noRouteHtml = await renderCard({ ...view, hasDetailRoute: false, canOpenDetail: false })
  assert.doesNotMatch(noRouteHtml, /device-map-selection__link/)
  assert.match(noRouteHtml, /<span class="device-map-selection__id-text" title="geo-cq-002">geo-cq-002<\/span>/)
})

test('switching points while open remounts ElAmapInfoWindow with fresh offset, single popupElement ref and ignores stale unmount close', async () => {
  const file = new URL(base + 'DeviceMapCard/DeviceMapCard.vue', import.meta.url)
  const parsed = parse(readFileSync(file, 'utf8'), { filename: file.pathname })
  assert.deepEqual(parsed.errors, [])
  const code = transformSync(
    compileScript(parsed.descriptor, { id: 'DeviceMapCard.vue', inlineTemplate: true }).content,
    { loader: 'ts', format: 'cjs' },
  ).code
  const mountedWindows = []
  let closedCount = 0
  const selectionView = vue.reactive({
    visible: false,
    revision: 0,
    position: undefined,
    detailDevice: undefined,
    detailStatus: { color: '#ef4444', text: '离线' },
  })
  const popup = vue.ref({ placement: 'above', anchor: 'bottom-center', offset: [0, -16], style: { width: '256px' } })
  const popupElement = vue.shallowRef()
  const popupKey = vue.computed(() => (
    selectionView.visible
      ? `${selectionView.revision}:${selectionView.detailDevice?.deviceId ?? 'list'}:${popup.value.placement}`
      : ''
  ))
  const popupMounted = vue.ref(true)
  let token = 0
  vue.watch(popupKey, async (next, prev) => {
    token += 1
    if (!next || !prev || next === prev) { popupMounted.value = true; return }
    const current = token
    popupMounted.value = false
    await vue.nextTick()
    if (current === token) popupMounted.value = true
  })
  const stub = tag => ({ setup: (_, { slots }) => () => vue.h(tag, slots.default?.()) })
  const ElAmapInfoWindow = {
    props: ['position', 'anchor', 'offset', 'visible'],
    emits: ['update:visible'],
    setup(props, { emit, slots }) {
      const record = { position: props.position, anchor: props.anchor, offset: props.offset, unmounted: false }
      mountedWindows.push(record)
      vue.onBeforeUnmount(() => {
        record.unmounted = true
        emit('update:visible', false)
      })
      return () => vue.h('div', slots.default?.())
    },
  }
  assert.match(parsed.descriptor.styles[0].content, /\.device-map-card__body--loading\s+:deep\(\.amap-loading\s*>\s*\*\)/)
  const loading = vue.ref(true)
  const deps = {
    '@jetlinks-web-core/components/CloudEmpty/index.vue': { __esModule: true, default: stub('div') },
    '@jetlinks-web-core/components/DocumentHelp': { __esModule: true, default: stub('div') },
    './MapConfigAction.vue': { __esModule: true, default: stub('div') },
    '@jetlinks-web-core/store/system': { useSystemStore: () => ({ systemInfo: { amap: { apiKey: 'k', secretKey: 's' } } }) },
    '../components/SectionHeader.vue': { __esModule: true, default: stub('div') },
    './DeviceMapSelectionCard.vue': { __esModule: true, default: stub('div') },
    './DeviceDistributionMap.vue': { __esModule: true, default: stub('div') },
    './distribution': { distributionColors: { online: '#22c55e', offline: '#ef4444' }, distributionState: () => 'online' },
    '@vuemap/vue-amap': {
      ElAmapInfoWindow,
      ElAmapMarker: stub('div'),
      ElAmapMarkerCluster: stub('div'),
    },
    '../hooks/useDeviceMap': {
      useDeviceMap: () => ({
        config: vue.ref({ embedded: true }),
        distribution: vue.ref(false),
        points: vue.ref([]),
        clusterLocations: vue.ref([]),
        loading,
        error: vue.ref(false),
        extraOptions: vue.ref({}),
        selection: {
          view: selectionView,
          close() {
            closedCount += 1
            selectionView.visible = false
          },
          closeDetail() {}, search() {}, changePage() {}, selectDevice() {}, refreshStates() {}, refreshDetail() {}, openDetailPage() {},
        },
        popup,
        popupElement,
        popupKey,
        popupMounted,
        onPopupClose(key) { if (popupMounted.value && key === popupKey.value) { closedCount += 1; selectionView.visible = false } },
        setPopupElement(el) { popupElement.value = el ?? undefined },
        refresh() {}, onMapInit() {}, onClusterClick() {}, onPointSelect() {},
        canConfigureMap: vue.ref(false), openMapConfig() {},
      }),
    },
  }
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', code)(id => deps[id] ?? require(id), mod, mod.exports)
  const make = type => ({ type, children: [], props: {} })
  const renderer = vue.createRenderer({
    createElement: make,
    createText: text => ({ text }),
    createComment: text => ({ text }),
    setText(n, t) { n.text = t },
    setElementText(n, t) { n.text = t },
    patchProp(n, k, _o, v) { n.props[k] = v },
    insert(n, p, a) {
      if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1)
      n.parent = p
      const i = p.children.indexOf(a)
      p.children.splice(i < 0 ? p.children.length : i, 0, n)
    },
    remove(n) { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1) },
    parentNode: n => n.parent,
    nextSibling: n => n.parent?.children[n.parent.children.indexOf(n) + 1],
  })
  const app = renderer.createApp(mod.exports.default)
  app.use(createI18n({ legacy: false, locale: 'zh', messages: { zh: {} }, flatJson: true, missingWarn: false }))
  for (const name of ['ASpin', 'AAlert', 'AMapComponent']) app.component(name, stub('div'))
  const root = make('root')
  app.mount(root)
  await settle()
  const findBody = node => String(node.props?.class || '').includes('device-map-card__body')
    ? node
    : (node.children || []).map(findBody).find(Boolean)
  const body = findBody(root)
  assert.ok(body)
  assert.match(body.props.class, /device-map-card__body--loading/)
  loading.value = false
  await settle()
  assert.doesNotMatch(body.props.class, /device-map-card__body--loading/)

  selectionView.visible = true
  selectionView.revision = 1
  selectionView.position = [106.577, 29.5579]
  selectionView.detailDevice = point('d1', 106.577, 29.5579)
  await settle()
  assert.equal(mountedWindows.length, 1)
  assert.deepEqual(mountedWindows[0].offset, [0, -16])
  assert.equal(Array.isArray(popupElement.value), false)
  assert.equal(popupElement.value?.type, 'div')

  selectionView.revision = 2
  selectionView.position = [106.536, 29.575]
  selectionView.detailDevice = point('d2', 106.536, 29.575)
  popup.value = { placement: 'below', anchor: 'top-center', offset: [0, 16], style: { width: '256px' } }
  await settle()
  assert.equal(mountedWindows[0].unmounted, true)
  assert.equal(mountedWindows.length, 2)
  assert.equal(mountedWindows[1].anchor, 'top-center')
  assert.deepEqual(mountedWindows[1].offset, [0, 16])
  assert.equal(closedCount, 0)
  assert.equal(selectionView.visible, true)
  assert.equal(Array.isArray(popupElement.value), false)
  assert.equal(popupElement.value?.type, 'div')
  app.unmount()
})
