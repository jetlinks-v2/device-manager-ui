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
  const source = readFileSync(new URL(base + relative, import.meta.url), 'utf8')
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
    (id) => dependencies[id] ?? require(id),
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

test('GeoJSON retains real device IDs even when names and coordinates coincide', () => {
  const { parseDeviceGeoJson } = load('services/deviceMap.ts', {
    '@jetlinks-web/constants': {},
    '@jetlinks-web/utils': {},
    '@jetlinks-web-core/utils': {},
    'event-source-polyfill': {}
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
  const mapHook = load(
    'hooks/useDeviceMap.ts',
    {
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
  const { value, unmount } = mount(() => mapHook.useDeviceMap(vue.ref({}), edit, enabled))
  streams[0].onMessage([point('d1'), point('d2'), point('d3')])
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
