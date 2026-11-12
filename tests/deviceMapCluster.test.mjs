import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'
import * as vue from 'vue'
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

function viewportModule() {
  return load('hooks/useDeviceMapViewport.ts', {
    '@vueuse/core': { useElementSize: () => ({ width: vue.ref(600), height: vue.ref(400) }) },
    'vue-router': { useRoute: () => ({ fullPath: '/resources/dashboard' }) },
    '@jetlinks-web-core/store/user': { useUserStore: () => ({ userInfo: { id: 'test-user' } }) },
    '@jetlinks-web-core/utils': { getBaseApi: () => '/api' },
  })
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

test('AMap callback coordinates preserve device identity and cluster only stops at the map limit', () => {
  const points = cluster.resolveClusterDevices([
    point('d1'),
    { ...point('d2'), lnglat: { lng: 116.4, lat: 39.9 } },
    point('d3'),
    point('d1')
  ])
  assert.equal(points.length, 3)
  assert.equal(cluster.shouldOpenDeviceCluster(points, 3), true)
  const distinct = [point('d1'), point('d2', 116.40001)]
  assert.equal(cluster.shouldOpenDeviceCluster(distinct, 19), false)
  assert.equal(cluster.shouldOpenDeviceCluster(distinct, 20), true)
  assert.equal(cluster.shouldOpenDeviceCluster([point('d1')], 3), true)
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
      '../../../utils/map': load('../../utils/map.ts')
    },
    {
      window: {
        AMap: {
          Bounds: class {
            constructor(southWest, northEast) {
              assert.ok(southWest.lng <= northEast.lng)
              assert.ok(southWest.lat <= northEast.lat)
            }
          },
          LngLat: class {
            constructor(lng, lat) {
              this.lng = lng
              this.lat = lat
            }
          }
        }
      }
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
  streams[0].onMessage([point('d1'), point('d2', 116.40001), point('d3')])
  streams[0].onMessage([{ ...point('d1'), label: 'Updated name' }])
  assert.equal(value.points.value.length, 3)
  assert.equal(value.points.value[0].label, 'Updated name')
  let zoom = 17
  value.onMapInit({
    getZoom: () => zoom,
    getFitZoomAndCenterByBounds: () => [17, [116.4, 39.9]],
    setZoomAndCenter: (...args) => moves.push(args)
  })
  value.onClusterClick({ clusterData: [point('d1'), point('d2', 116.40001)] })
  assert.equal(moves[0][0], 19)
  assert.equal(value.selection.view.visible, false)
  zoom = 20
  value.onClusterClick({ clusterData: [point('d1'), point('d2', 116.40001)] })
  assert.equal(value.selection.view.count, 2)
  streams[0].onMessage([point('d2')])
  value.onClusterClick({ clusterData: [point('d1'), point('d2'), point('d3')] })
  assert.equal(value.selection.view.count, 3)
  await settle()
  edit.value = true
  await settle()
  assert.equal(streams[0].closed, true)
  assert.equal(value.selection.view.visible, false)
  assert.equal(value.points.value.length, 0)
  streams[0].onMessage([point('late')])
  assert.equal(value.points.value.length, 0)
  value.onClusterClick({ clusterData: [point('d1')] })
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

test('marker renderer treats device names as text and retains aggregation at zoom 20', () => {
  const elements = []
  const { createDeviceMapMarkerOptions } = load(
    'DeviceMapCard/markers.ts',
    {
      './cluster': cluster,
      '@device-manager-ui/assets/marker.png': 'marker.png'
    },
    {
      window: { AMap: { Pixel: class {} } },
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
  assert.ok(options.maxZoom > 20)
  assert.equal(options.zoomOnClick, false)
  let content
  const marker = {
    setOffset() {},
    setAnchor() {},
    setContent(value) {
      content = value
    }
  }
  options.renderMarker({ marker, count: 1, data: [{ label: '<img src=x onerror=alert(1)>' }] })
  assert.equal(content.children[0].textContent, '<img src=x onerror=alert(1)>')
  options.renderClusterMarker({ marker, count: 3, data: [] })
  assert.equal(content.textContent, '3')
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
  assert.deepEqual(value.view.detailFields.map(x=>x.value),['selected','产品','11-12 14:32'])
  assert.equal(value.view.detailFields[0].copyable,true)
  const first=value.openDetailPage(); await value.openDetailPage()
  assert.equal(calls.length,1); assert.equal(calls[0].options.params.id,'selected'); assert.deepEqual(remembered,['selected'])
  pending.resolve(); await first; assert.equal(value.view.openingDetail,false); unmount()
})

test('viewport restores camera and selected visible device only within the same identity', () => {
  const sizes={width:vue.ref(280),height:vue.ref(240)}, route=vue.reactive({fullPath:'/dashboard'}), user=vue.reactive({userInfo:{id:'a'}})
  const viewport=load('hooks/useDeviceMapViewport.ts',{
    '@vueuse/core':{useElementSize:()=>sizes},'vue-router':{useRoute:()=>route},
    '@jetlinks-web-core/store/user':{useUserStore:()=>user},'@jetlinks-web-core/utils':{getBaseApi:()=>'/api'},
  })
  const pos=vue.ref([116,39]), identity=vue.ref('scope-a'), moves=[]
  const instance={getCenter:()=>({lng:116,lat:39}),getZoom:()=>12,setZoomAndCenter:(...args)=>moves.push(args),lngLatToContainer:()=>({x:10,y:10})}
  const a=viewport.useDeviceMapViewport(identity,vue.ref(),pos); a.onMapInit(instance)
  assert.equal(a.popup.value.placement,'below'); assert.equal(a.popup.value.style.width,'256px'); assert.equal(a.popup.value.style.maxHeight,'200px')
  a.remember('d2'); const b=viewport.useDeviceMapViewport(identity,vue.ref(),pos); b.onMapInit(instance)
  assert.deepEqual(moves,[[12,[116,39]]]); const restored=b.takeRestoredSelection([point('d1'),point('d2')]); assert.equal(restored.device.deviceId,'d2'); assert.equal(restored.points.length,2)
  b.remember('d2'); user.userInfo.id='b'; const c=viewport.useDeviceMapViewport(identity,vue.ref(),pos); assert.equal(c.takeRestoredSelection([point('d2')]),undefined)
  user.userInfo.id='a'; const d=viewport.useDeviceMapViewport(identity,vue.ref(),pos); assert.equal(d.takeRestoredSelection([point('other')]),undefined)
})

test('missing authorized detail menu disables navigation', async () => {
  let calls=0
  const factory=selectionFactory({menu:{hasMenu:()=>false,jumpPage:()=>{calls++}}})
  const {value,unmount}=mount(factory.useDeviceMapSelection)
  value.open([point('d1')]); await settle()
  assert.equal(value.view.hasDetailRoute,false); assert.equal(value.view.canOpenDetail,false)
  await value.openDetailPage(); assert.equal(calls,0); unmount()
})
