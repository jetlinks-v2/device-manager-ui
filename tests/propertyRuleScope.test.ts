import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computed, createRenderer, defineComponent, nextTick, reactive, watch } from 'vue'
import { createI18n } from 'vue-i18n'
import type { NavigationFailure, RouteLocationNormalized } from 'vue-router'
import { activeLogoutNavigation, useRuleLogoutNavigation } from '../views/device/components/PropertyRules/useRuleLogoutNavigation'
import { usePropertyRuleCards } from '../views/device/components/PropertyRules/cards/usePropertyRuleCards'
import { parseRule } from '../views/device/components/PropertyRules/codec'
import type { RuleScope } from '../views/device/components/PropertyRules/service'
import { usePropertyRules } from '../views/device/components/PropertyRules/usePropertyRules'
import { getInstance, setAlarmRequestHandler } from './alarmRequest.test-shim'
import { routeGuards, ruleRoute, ruleMenus, ruleMenuVisits, ruleRouteAfterEach, setConfirmHandler, type TestConfirmation } from './propertyRuleScope.test-shim'
import { usePropertyRuleEditor, type RuleEditorProps } from '../views/device/components/PropertyRules/usePropertyRuleEditor'
import { useRuleResources } from '../views/device/components/PropertyRules/useRuleResources'
import { useRuleExample } from '../views/device/components/PropertyRules/useRuleExample'
import { useAlarmRecipients } from '../views/device/alarm/hooks/useAlarmRecipients'
import { useAlarmNotification } from '../views/device/alarm/hooks/useAlarmNotification'
import { alarmSelectionVisibleCount } from '../views/device/alarm/hooks/useAlarmSelectionOverflow'
import { createAlarmRecipientCache } from '../views/device/alarm/hooks/alarmRecipientCache'
import { buildPreprocessPayload, createEmptyNotification, toDeviceAlarmRow } from '../views/device/alarm/utils'
import type { DeviceAlarmFormModel, DeviceAlarmNotifyMethod, ThingPropertyPreprocess } from '../views/device/alarm/types'

const settle = async () => { await new Promise(resolve => setImmediate(resolve)); await nextTick() }
function mountState<T>(setup: () => T) {
  let state!: T
  const renderer = createRenderer({
    patchProp() {}, insert() {}, remove() {}, createElement: () => ({}), createText: () => ({}),
    createComment: () => ({}), setText() {}, setElementText() {}, parentNode: () => null, nextSibling: () => null,
  })
  const app = renderer.createApp(defineComponent({ setup() { state = setup(); return () => null } }))
  app.use(createI18n({ legacy: false, locale: 'en', messages: { en: { 'PropertyRules.defaultAlarmName': '{name} alarm' } }, missingWarn: false, fallbackWarn: false }))
  app.mount({})
  return { state, unmount: () => app.unmount() }
}
const mountPanel = (props: Parameters<typeof usePropertyRules>[0]) => {
  const { state, unmount } = mountState(() => usePropertyRules(props))
  return { panel: state, unmount }
}

function mountRuleWindow() {
  const listeners = new Set<(event: BeforeUnloadEvent) => void>()
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    addEventListener(type: string, listener: (event: BeforeUnloadEvent) => void) { if (type === 'beforeunload') listeners.add(listener) },
    removeEventListener(type: string, listener: (event: BeforeUnloadEvent) => void) { if (type === 'beforeunload') listeners.delete(listener) },
  } })
  return () => {
    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent
    for (const listener of listeners) listener(event)
    return event.defaultPrevented
  }
}

function mountEditor(changed: (props: RuleEditorProps) => void | Promise<void> = () => {}) {
  const beforeUnload = mountRuleWindow()
  const props = reactive<RuleEditorProps>({ open: true, inline: true, scope: { productId: 'p1', deviceId: 'd1' },
    property: { id: 'temperature', valueType: { type: 'double' } },
    snapshot: { hasOverride: true, raw: { provider: 'ratio-sampling', configuration: { ratio: 0.5 } } } })
  const mounted = mountState(() => usePropertyRuleEditor(props, () => {}, () => changed(props)))
  const dialogs: TestConfirmation[] = []
  setConfirmHandler(options => { dialogs.push(options) })
  let active = true
  const unmount = () => { if (active) { mounted.unmount(); active = false } }
  return { props, editor: mounted.state, dialogs, unmount, beforeUnload,
    cleanup() { unmount(); setConfirmHandler(); Reflect.deleteProperty(globalThis, 'window') } }
}

const editorRoute = (id: string): RouteLocationNormalized => ({ path: `/products/${id}`, fullPath: `/products/${id}`,
  name: 'product-detail', params: { id }, query: { tab: 'AlarmConfig', ruleProperty: 'temperature' }, hash: '', matched: [], meta: {}, redirectedFrom: undefined })

async function ruleRequest(data: unknown = { status: 200 }, status = 200, url = '/user-token/reset', method = 'get') {
  return getInstance().request({ method, url, adapter: async config => ({
    config, status, statusText: '', headers: {}, data: JSON.stringify(data),
  }) })
}
const successfulRuleLogout = () => ruleRequest()
function finishRuleLogoutNavigation(failure?: Parameters<import('vue-router').NavigationHookAfter>[2], name = 'Login') {
  const to = { ...editorRoute('login'), name }
  for (const handler of ruleRouteAfterEach) handler(to, editorRoute('p1'), failure)
}

test('rule editor reacts to thing-model unit names without substituting its own symbols', async () => {
  const view = mountEditor()
  try {
    await settle()
    view.props.property.valueType = { type: 'double', unit: 'kWattsHour', unitName: 'kW·h' }
    assert.equal(view.editor.unit.value, 'kW·h')
    assert.equal(view.editor.cleaningUnit.value, 'kW·h')
    assert.equal(view.editor.differenceUnit.value, 'kW·h')
    view.props.property.valueType = { type: 'double', unit: 'kWh' }
    assert.equal(view.editor.unit.value, 'kWh', 'custom metadata text is unchanged')
    view.props.property.valueType = { type: 'double' }
    assert.equal(view.editor.unit.value, undefined, 'no metadata unit means no unit placeholder')
  } finally { view.cleanup() }
})

function notificationProps() {
  const model: DeviceAlarmFormModel = { source: 'device', targetId: 'd1', productId: 'p1', property: 'temperature', name: 'Temperature',
    level: 4, trigger: 'gte', value: 80, limit: {}, autoRelieve: true, relieveCondition: { trigger: 'lte', value: 75, limit: {} },
    notification: { ...createEmptyNotification(), userIds: ['u1'], notifyChannelIds: ['inbox-1'], channelProviders: ['inbox'], parameters: { template: 'Existing content' } } }
  const methods: DeviceAlarmNotifyMethod[] = [
    { id: 'inbox', channelIds: ['inbox-1'], providerId: 'inbox', key: 'inbox', label: 'Inbox', desc: '', icon: 'MailOutlined' },
    { id: 'email', channelIds: ['email-1'], providerId: 'email', key: 'email', label: 'Email', desc: '', icon: 'MailOutlined' },
  ]
  return reactive({ model, methods, disabled: false, loading: false, reveal: false })
}

test('notification name summaries use all available space before reserving overflow counts', () => {
  const widths = [40, 50, 60]
  assert.equal(alarmSelectionVisibleCount(widths, 150, [20, 20, 20], 4), 3, 'all names fit without reserving a counter')
  assert.equal(alarmSelectionVisibleCount(widths, 149, [20, 20, 20], 4), 2)
  assert.equal(alarmSelectionVisibleCount(widths, 113, [20, 20, 20], 4), 1)
  assert.equal(alarmSelectionVisibleCount(widths, 400, [20, 20, 20], 4), 3, 'growing the container reveals names again')
  assert.equal(alarmSelectionVisibleCount([200, 40], 80, [20, 20], 4), 1, 'long first name ellipsizes beside the counter')
  assert.equal(alarmSelectionVisibleCount([200], 80, [20], 4), 1, 'a single name needs no redundant count')
  assert.equal(alarmSelectionVisibleCount([], 80, [], 4), 0)
})

test('disabled notifications defer requests and toggling retains the saved draft', () => {
  const props = notificationProps()
  let requests = 0
  const { state: notification, unmount } = mountState(() => useAlarmNotification(props, () => { requests++ }, () => {}))
  try {
    assert.equal(requests, 0)
    const previous = JSON.stringify(props.model.notification)
    notification.toggleEnabled()
    assert.equal(requests, 1)
    notification.toggleEnabled()
    assert.equal(JSON.stringify(props.model.notification), previous)
    props.disabled = true
    notification.toggleEnabled()
    notification.channelIds.value = ['email-1']
    assert.equal(requests, 1)
    assert.equal(JSON.stringify(props.model.notification), previous)
  } finally { unmount() }
})

test('notification chips have one active panel and reveal the missing selection', async () => {
  const props = notificationProps()
  props.model.notification.enabled = true
  props.model.notification.userIds = []
  let requests = 0
  const { state: notification, unmount } = mountState(() => useAlarmNotification(props, () => { requests++ }, open => { props.reveal = open }))
  try {
    notification.setPanel('recipients', true)
    assert.equal(requests, 1, 'saved notification types hydrate on first display')
    notification.setPanel('channels', true)
    notification.setPanel('recipients', false)
    assert.equal(notification.activePanel.value, 'channels', 'late close of previous panel is ignored')
    assert.equal(requests, 2)
    props.reveal = false
    await settle()
    assert.equal(notification.activePanel.value, undefined)
    props.reveal = true
    await settle()
    assert.equal(notification.activePanel.value, 'recipients', 'save validation opens the missing recipient field')
    props.model.targetId = 'd2'
    await settle()
    assert.equal(notification.activePanel.value, undefined)
    props.disabled = true
    notification.setPanel('channels', true)
    assert.equal(notification.activePanel.value, undefined)
  } finally { unmount() }
})

test('notification type changes preserve message content and recovery, without channel bindings on save', () => {
  const props = notificationProps()
  const { state: notification, unmount } = mountState(() => useAlarmNotification(props, () => {}, () => {}))
  try {
    props.model.notification.enabled = true
    notification.channelIds.value = ['email']
    assert.deepEqual(props.model.notification.channelProviders, ['email'])
    assert.deepEqual(props.model.notification.parameters, { template: 'Existing content' })
    const row = toDeviceAlarmRow(buildPreprocessPayload(props.model), 'device', 'Device')!
    assert.equal(row.autoRelieve, true)
    assert.equal(row.relieveCondition?.trigger, 'lte')
    assert.equal(row.relieveCondition?.value, 75)
    assert.deepEqual(row.notification.notifyChannelIds, [])
    assert.deepEqual(row.notification.userIds, ['u1'])
    assert.deepEqual(row.notification.parameters, props.model.notification.parameters)
  } finally { unmount() }
})

test('changing notification selections does not repeat the initial type lookup', async () => {
  const props = notificationProps()
  props.model.notification.enabled = true
  let requests = 0
  const { state, unmount } = mountState(() => useAlarmNotification(props, () => { requests++ }, () => {}))
  try {
    assert.equal(requests, 1)
    state.channelIds.value = ['email']
    await settle()
    assert.equal(requests, 1, 'selection replaces the notification object but does not change its scope or enabled state')
    props.model.property = 'humidity'
    await settle()
    assert.equal(requests, 2, 'a different property still hydrates its saved types')
  } finally { unmount() }
})

test('opening unavailable legacy selections preserves bindings; explicit type edits remove them', () => {
  const props = notificationProps()
  props.model.notification.notifyChannelIds = ['gone']
  props.model.notification.channelProviders = ['old-provider']
  props.model.notification.parameters['old-provider'] = { notifierId: 'old-notifier' }
  const { state: notification, unmount } = mountState(() => useAlarmNotification(props, () => {}, () => {}))
  try {
    assert.deepEqual(notification.channelIds.value, ['old-provider'])
    assert.equal(notification.channelOptions.value.some(option => option.value === 'old-provider'), false)
    assert.deepEqual(props.model.notification.notifyChannelIds, ['gone'])
    assert.deepEqual(props.model.notification.parameters['old-provider'], { notifierId: 'old-notifier' })
    notification.channelIds.value = ['email']
    assert.deepEqual(props.model.notification.notifyChannelIds, [])
    assert.deepEqual(props.model.notification.channelProviders, ['email'])
    assert.equal('old-provider' in props.model.notification.parameters, false)
    notification.channelIds.value = ['old-provider']
    assert.deepEqual(notification.channelIds.value, [], 'explicit selection cannot retain an unavailable provider')
    assert.deepEqual(props.model.notification.userIds, [])
  } finally { unmount() }
})

test('new notification drafts wait for inbox availability and explicit clears survive reload and remount', async () => {
  const props = notificationProps()
  props.model.notification = { ...createEmptyNotification(), enabled: true }
  props.methods = []
  const mount = () => mountState(() => useAlarmNotification(props, () => {}, () => {}))
  let mounted = mount()
  try {
    assert.deepEqual(mounted.state.channelIds.value, [])
    mounted.state.setPanel('recipients', true)
    assert.equal(mounted.state.activePanel.value, undefined)
    props.loading = true
    props.methods = [{ id: 'inside-mail', providerId: 'inside-mail', key: 'inbox', label: 'Inbox', icon: 'MailOutlined', desc: '' }]
    await settle()
    assert.deepEqual(mounted.state.channelIds.value, [], 'pending refresh must not initialize from an older availability snapshot')
    props.loading = false
    await settle()
    assert.deepEqual(mounted.state.channelIds.value, ['inside-mail'])
    props.model.notification.userIds = ['u1', 'u2']
    mounted.state.toggleEnabled()
    mounted.state.toggleEnabled()
    assert.deepEqual(props.model.notification.userIds, ['u1', 'u2'], 'notification master switch preserves the draft')
    mounted.state.setPanel('recipients', true)
    mounted.state.channelIds.value = []
    assert.deepEqual(props.model.notification.userIds, [])
    assert.equal(mounted.state.channelCount.value, 0)
    assert.equal(mounted.state.activePanel.value, undefined)
    props.methods = [...props.methods]
    mounted.state.toggleEnabled()
    mounted.state.toggleEnabled()
    await settle()
    assert.deepEqual(mounted.state.channelIds.value, [], 'availability and enabled changes cannot undo an explicit clear')
    mounted.unmount()
    mounted = mount()
    assert.deepEqual(mounted.state.channelIds.value, [])
    mounted.state.channelIds.value = ['inside-mail']
    assert.deepEqual(props.model.notification.userIds, [], 'old recipients are not restored')
  } finally { mounted.unmount() }
})

test('inbox defaults never overwrite existing selections, saved rules or disabled drafts', async () => {
  const props = notificationProps()
  props.methods.push({ id: 'inside-mail', providerId: 'inside-mail', key: 'inbox', label: 'Inbox', icon: 'MailOutlined', desc: '' })
  props.model.notification.enabled = true
  const { state, unmount } = mountState(() => useAlarmNotification(props, () => {}, () => {}))
  try {
    const saved = [...props.model.notification.channelProviders]
    await settle()
    assert.deepEqual(props.model.notification.channelProviders, saved)
    props.model = { ...props.model, id: 'saved', notification: { ...createEmptyNotification(), enabled: true } }
    await settle()
    assert.deepEqual(state.channelIds.value, [])
    props.model = { ...props.model, id: undefined, notification: createEmptyNotification() }
    await settle()
    assert.deepEqual(state.channelIds.value, [])
    state.toggleEnabled()
    assert.deepEqual(state.channelIds.value, ['inside-mail'])
  } finally { unmount() }
})

test('first enabling recovery uses its independent template and the shared notification types', () => {
  const props = notificationProps()
  props.model.notification.relieveTopicProvider = 'alarm-device'
  const { state: notification, unmount } = mountState(() => useAlarmNotification(props, () => {}, () => {}))
  try {
    assert.deepEqual(props.model.notification.notifyChannelIds, ['inbox-1'])
    notification.setIncludeRelieve(true)
    assert.equal(props.model.notification.relieveTopicProvider, 'alarm-device-relieve')
    assert.deepEqual(props.model.notification.notifyChannelIds, [])
    assert.deepEqual(props.model.notification.channelProviders, ['inbox'])
    assert.equal(props.model.notification.includeRelieve, true)
    notification.setIncludeRelieve(false)
    assert.equal(props.model.notification.includeRelieve, false)
    props.model.autoRelieve = false
    notification.setIncludeRelieve(true)
    assert.equal(props.model.notification.includeRelieve, false)
  } finally { unmount() }
})

test('saved recipient names hydrate before opening and remain visible after switching panels', async () => {
  const props = reactive({ value: ['u1'], scopeKey: 'device:d1:temperature', open: false })
  let requests = 0
  let release!: (value: unknown) => void
  setAlarmRequestHandler(() => { requests++; return new Promise(resolve => { release = resolve }) })
  const { state: directory, unmount } = mountState(() => useAlarmRecipients(props))
  try {
    assert.equal(requests, 1)
    assert.ok(directory.selectionLabel.value)
    props.open = true
    const pending = directory.config.value.loadSelectedOptions!(['u1'])
    props.open = false
    release({ result: { data: [{ id: 'u1', name: 'Old response' }] } })
    assert.equal((await pending)[0].label, 'Old response')
    assert.equal(directory.open.value, false)
    assert.equal(directory.selectionLabel.value, 'Old response')
    props.open = true
    const latest = directory.config.value.loadSelectedOptions!(['u1'])
    await latest
    assert.equal(directory.selectionLabel.value, 'Old response')
    assert.equal(requests, 1, 'opening the selector reuses the selected-name query')
  } finally { unmount() }
})

test('enabled read-only notifications resolve types without changing persisted bindings', async () => {
  const props = notificationProps()
  props.model.notification.enabled = true
  props.disabled = true
  const before = JSON.stringify(props.model)
  let requests = 0
  const { state, unmount } = mountState(() => useAlarmNotification(props, () => { requests++ }, () => {}))
  try {
    assert.equal(requests, 1)
    assert.equal(state.channelLabel.value, 'Inbox')
    assert.equal(state.channelOptions.value[0].description, 'DeviceAlarm.delivery.address.inbox')
    assert.equal(JSON.stringify(props.model), before)
    state.setPanel('channels', true)
    assert.equal(state.activePanel.value, undefined)
  } finally { unmount() }
})

test('recipient cache batches selected IDs and coalesces overlapping in-flight lookups', async () => {
  const calls: string[][] = []
  const releases: Array<() => void> = []
  setAlarmRequestHandler((_url, body) => new Promise(resolve => {
    const ids = (body.terms as Array<{ value: string[] }>)[0].value
    calls.push(ids)
    releases.push(() => resolve({ result: { data: ids.map(id => ({ id, name: `Name ${id}`, email: 'private@example.test' })) } }))
  }))
  const cache = createAlarmRecipientCache()
  const first = cache.load(['u1', 'u2', 'u1'])
  const second = cache.load(['u2', 'u3'])
  assert.deepEqual(calls, [['u1', 'u2'], ['u3']])
  releases.forEach(release => release())
  await Promise.all([first, second])
  await cache.load(['u2', 'u1'])
  assert.equal(calls.length, 2)
  assert.equal(cache.options.value.get('u1')?.label, 'Name u1')
  assert.equal(JSON.stringify([...cache.options.value]).includes('private@example.test'), false)
})

test('recipient cache invalidation rejects old names without losing the new in-flight request', async () => {
  const releases: Array<(value: unknown) => void> = []
  setAlarmRequestHandler(() => new Promise(resolve => { releases.push(resolve) }))
  const cache = createAlarmRecipientCache()
  const old = cache.load(['u1'])
  cache.reset()
  const current = cache.load(['u1'])
  releases[0]({ result: { data: [{ id: 'u1', name: 'Old account' }] } })
  await old
  assert.equal(cache.options.value.size, 0)
  const joined = cache.load(['u1'])
  assert.equal(releases.length, 2)
  releases[1]({ result: { data: [{ id: 'u1', name: 'Current account' }] } })
  await Promise.all([current, joined])
  assert.equal(cache.options.value.get('u1')?.label, 'Current account')
})

test('initial name failure is retryable without changing saved IDs or prefetching candidates', async () => {
  const props = reactive({ value: ['u1', 'missing'], scopeKey: 'device:d1:temperature', open: false })
  const calls: Array<Record<string, unknown>> = []
  setAlarmRequestHandler(async (_url, body) => { calls.push(body); throw new Error('offline') })
  const { state: directory, unmount } = mountState(() => useAlarmRecipients(props))
  try {
    await settle()
    assert.equal(directory.selectedFailed.value, true)
    assert.equal(directory.selectedLoading.value, false)
    setAlarmRequestHandler(async (_url, body) => { calls.push(body); return { result: { data: [{ id: 'u1', name: 'Alice' }] } } })
    directory.retry()
    await settle()
    assert.equal(directory.selectedFailed.value, false)
    assert.equal(directory.selectionLabel.value, 'Alice')
    assert.deepEqual(directory.selectionLabels.value, ['Alice', 'DeviceAlarm.notification.unavailableUser'])
    assert.equal(directory.selected.value[1].unavailable, true)
    assert.deepEqual(props.value, ['u1', 'missing'])
    assert.equal(calls.length, 2)
    assert.ok(calls.every(body => body.paging === false))
  } finally { unmount() }
})

test('notification resources survive property changes and refresh after a target or permission change', async () => {
  const scope = reactive({ productId: 'p1', deviceId: 'd1', property: 'cpu', permissions: { user: ['query'] } })
  let requests = 0
  setAlarmRequestHandler(async () => { requests++; return { result: [] } })
  const { state: resources, unmount } = mountState(() => useRuleResources(() => [scope.productId, scope.deviceId, scope.permissions]))
  try {
    await resources.load()
    assert.equal(requests, 2)
    scope.property = 'memory'
    await settle()
    await resources.load()
    assert.equal(requests, 2)
    scope.deviceId = 'd2'
    await settle()
    assert.equal(requests, 4)
    scope.permissions.user = []
    await settle()
    assert.equal(requests, 6)
  } finally { unmount() }
})

test('partial notification failures remain stable until an explicit retry', async () => {
  const calls: string[] = []
  let failChannels = true
  setAlarmRequestHandler(async url => {
    calls.push(url)
    if (url === '/notify/channel/all' && failChannels) throw new Error('channel configuration unavailable')
    return { result: url === '/notify/channel/providers' ? [{ id: 'email', name: 'Email' }] : [] }
  })
  const { state: resources, unmount } = mountState(useRuleResources)
  try {
    await resources.load()
    assert.equal(resources.failed.value, true)
    assert.deepEqual(resources.methods.value, [])
    const previous = resources.methods.value
    await resources.load()
    await resources.load()
    assert.equal(calls.length, 2, 'ordinary display and popover opening must not start another failed lookup')
    assert.equal(resources.methods.value, previous)
    failChannels = false
    await resources.retry()
    assert.equal(calls.length, 4)
    assert.equal(resources.failed.value, false)
    assert.equal(resources.loading.value, false)
  } finally { unmount() }
})

test('reopening a property editor refreshes changed notification template availability', async () => {
  let enabled = true
  setAlarmRequestHandler(async url => ({ result: url === '/notify/channel/providers'
    ? [{ id: 'inside-mail', name: 'Inbox' }] : enabled ? [{ provider: 'alarm-device', channels: [] }] : [] }))
  const { props, editor, cleanup } = mountEditor()
  try {
    await editor.resources.load()
    assert.deepEqual(editor.resources.methods.value.map(method => method.id), ['inside-mail'])
    props.open = false
    await settle()
    enabled = false
    props.open = true
    await settle()
    assert.deepEqual(editor.resources.methods.value, [])
    assert.equal(editor.resources.failed.value, false)
  } finally { cleanup() }
})

test('equivalent owner snapshots keep notification resources while actual scope and permission changes invalidate them', async () => {
  const owner = reactive({ scope: { productId: 'p1', deviceId: 'd1', name: 'Before' }, permissions: { notify: ['query'] } })
  let requests = 0
  setAlarmRequestHandler(async () => { requests++; return { result: [] } })
  const { state: resources, unmount } = mountState(() => useRuleResources(() => [owner.scope.productId, owner.scope.deviceId, owner.permissions]))
  try {
    await resources.load()
    const previous = resources.methods.value
    owner.scope = { ...owner.scope, name: 'After' }
    await settle()
    assert.equal(requests, 2, 'a replacement scope object with the same target must not clear and reload options')
    assert.equal(resources.methods.value, previous)
    owner.permissions = { notify: ['query'] }
    await settle()
    assert.equal(requests, 2, 'equivalent permission snapshots must keep the cached resources')
    owner.scope.deviceId = 'd2'
    await settle()
    assert.equal(requests, 4)
    owner.permissions.notify.push('update')
    await settle()
    assert.equal(requests, 6, 'nested permission changes must still invalidate old resources')
  } finally { unmount() }
})

test('restore confirmation is explicit and restores only the captured device property', async () => {
  const calls: string[] = []
  setAlarmRequestHandler(async (url, body) => { assert.equal(body.method, 'DELETE'); calls.push(url); return { result: {} } })
  const view = mountEditor(props => { props.snapshot = { hasOverride: false } })
  try {
    await settle()
    await view.editor.restore()
    assert.equal(calls.length, 0)
    await view.dialogs[0].onCancel?.()
    assert.equal(calls.length, 0)
    await view.editor.restore()
    await view.dialogs[1].onOk?.()
    assert.deepEqual(calls, ['/message/preprocessor/device/p1/d1/property/temperature'])
    assert.equal(view.editor.hasOverride.value, false)
    assert.equal(view.editor.custom.value, true)
    assert.equal(view.editor.saving.value, false)
  } finally { view.cleanup() }
})

test('stale restore confirmations cannot delete a changed or unmounted target', async () => {
  for (const change of ['product', 'device', 'property', 'permission', 'close', 'unmount']) {
    const calls: string[] = []
    setAlarmRequestHandler(async url => { calls.push(url); return { result: {} } })
    const view = mountEditor()
    try {
      await settle()
      await view.editor.restore()
      if (change === 'product') view.props.scope.productId = 'p2'
      else if (change === 'device') view.props.scope.deviceId = 'd2'
      else if (change === 'property') view.props.property = { id: 'pressure' }
      else if (change === 'permission') view.props.scope.canUpdate = false
      else if (change === 'close') view.props.open = false
      else view.unmount()
      // Confirm in the same tick: identity checks must not depend on the watcher having run.
      await view.dialogs[0].onOk?.()
      await settle()
      assert.deepEqual(calls, [], change)
      assert.equal(view.editor.saving.value, false)
    } finally { view.cleanup() }
  }
})

test('changing target during the discard confirmation never opens a restore confirmation', async () => {
  const calls: string[] = []
  setAlarmRequestHandler(async url => { calls.push(url); return { result: {} } })
  const view = mountEditor()
  try {
    await settle()
    view.editor.draft.value!.percent = 60
    const pending = view.editor.restore()
    assert.equal(view.dialogs.length, 1)
    view.props.scope.deviceId = 'd2'
    await view.dialogs[0].onOk?.()
    await pending
    assert.equal(view.dialogs.length, 1)
    assert.deepEqual(calls, [])
  } finally { view.cleanup() }
})

test('a late restore response cannot refresh or reset the next target', async () => {
  let release!: (value: unknown) => void
  let refreshes = 0
  const calls: string[] = []
  setAlarmRequestHandler(url => { calls.push(url); return new Promise(resolve => { release = resolve }) })
  const view = mountEditor(() => { refreshes++ })
  try {
    await settle()
    await view.editor.restore()
    const pending = view.dialogs[0].onOk?.()
    assert.equal(view.editor.saving.value, true)
    view.props.scope.deviceId = 'd2'
    view.props.snapshot = { hasOverride: true, raw: { provider: 'ratio-sampling', configuration: { ratio: 0.75 } } }
    await settle()
    release({ result: {} })
    await pending
    assert.deepEqual(calls, ['/message/preprocessor/device/p1/d1/property/temperature'])
    assert.equal(refreshes, 0)
    assert.equal(view.editor.draft.value?.percent, 75)
    assert.equal(view.editor.hasOverride.value, true)
    assert.equal(view.editor.saving.value, false)
  } finally { view.cleanup() }
})

test('a failed restore keeps the current override editable', async () => {
  setAlarmRequestHandler(async () => { throw new Error('write failed') })
  const view = mountEditor()
  try {
    await settle()
    await view.editor.restore()
    await view.dialogs[0].onOk?.()
    assert.equal(view.editor.saving.value, false)
    assert.equal(view.editor.hasOverride.value, true)
    assert.equal(view.editor.editable.value, true)
    assert.equal(view.editor.draft.value?.percent, 50)
  } finally { view.cleanup() }
})

test('path changes with identical query parameters preserve the unsaved navigation guard', async () => {
  const view = mountEditor()
  try {
    await settle()
    view.editor.draft.value!.percent = 60
    const guard = routeGuards.update.at(-1)!
    assert.equal(await guard(editorRoute('p1'), editorRoute('p1'), () => {}), true)
    assert.equal(view.dialogs.length, 0)
    const cancelled = guard(editorRoute('p2'), editorRoute('p1'), () => {})
    assert.equal(view.dialogs.length, 1)
    await view.dialogs[0].onCancel?.()
    assert.equal(await cancelled, false)
    const accepted = guard(editorRoute('p2'), editorRoute('p1'), () => {})
    await view.dialogs[1].onOk?.()
    assert.equal(await accepted, true)
  } finally { view.cleanup() }
})

test('an active write blocks path changes and leaving without opening another dialog', async () => {
  let release!: (value: unknown) => void
  setAlarmRequestHandler(() => new Promise(resolve => { release = resolve }))
  const view = mountEditor()
  try {
    await settle()
    view.editor.draft.value!.percent = 60
    const saving = view.editor.save()
    assert.equal(view.editor.saving.value, true)
    assert.equal(await routeGuards.update.at(-1)!(editorRoute('p2'), editorRoute('p1'), () => {}), false)
    assert.equal(await routeGuards.leave.at(-1)!(editorRoute('p2'), editorRoute('p1'), () => {}), false)
    assert.equal(view.dialogs.length, 0)
    release({ result: {} })
    await saving
  } finally { view.cleanup() }
})

test('recipient names hydrate immediately while candidate pages and searches remain lazy', async () => {
  const calls: Array<Record<string, any>> = []
  setAlarmRequestHandler(async (url, body) => {
    assert.equal(url, '/user/detail/_query')
    calls.push(body)
    if (body.paging === false) return { result: { data: [{ id: 'saved', name: 'Saved user' }], total: 1 } }
    return { result: { data: Array.from({ length: body.pageIndex ? 1 : 20 }, (_, i) => ({ id: `page-${body.pageIndex}-${i}`, name: `User ${i}` })), total: 21 } }
  })
  const props = reactive({ value: ['saved', 'unavailable'], scopeKey: 'p1:cpu' })
  const { state: directory, unmount } = mountState(() => useAlarmRecipients(props))
  try {
    await settle()
    assert.equal(calls.length, 1)
    assert.equal(calls[0].paging, false)
    assert.deepEqual(calls[0].terms, [{ column: 'id', termType: 'in', value: ['saved', 'unavailable'] }])
    assert.equal(directory.selectionLabel.value, 'Saved user')
    assert.deepEqual(directory.selectionLabels.value, ['Saved user', 'DeviceAlarm.notification.unavailableUser'])
    directory.setOpen(true)
    await directory.config.value.loadSelectedOptions!(props.value)
    assert.deepEqual(directory.selected.value.map(user => user.label), ['Saved user', 'DeviceAlarm.notification.unavailableUser'])
    const first = await directory.config.value.loadOptions!('', { pageIndex: 0 })
    const next = await directory.config.value.loadOptions!('', { pageIndex: 1 })
    assert.equal(first.length, 20)
    assert.equal(next.length, 1, 'selected hydration never changes the candidate page size')
    await directory.config.value.loadOptions!('Alice', { pageIndex: 0 })
    assert.deepEqual(calls.at(-1)!.terms, [{ terms: [
      { column: 'name', termType: 'like', value: '%Alice%' },
      { column: 'username', termType: 'like', value: '%Alice%', type: 'or' },
    ] }])
    assert.deepEqual(calls.at(-1)!.sorts, [{ name: 'name', order: 'asc' }, { name: 'id', order: 'asc' }])
    const count = calls.length
    await directory.config.value.loadSelectedOptions!(props.value)
    assert.equal(calls.length, count, 'already hydrated IDs do not request again on selection changes')
  } finally { unmount() }
})

test('recipient failures are explicit and stale responses cannot cross close or scope changes', async () => {
  const props = reactive({ value: ['saved'], scopeKey: 'p1:cpu' })
  setAlarmRequestHandler(async () => { throw new Error('offline') })
  const { state: directory, unmount } = mountState(() => useAlarmRecipients(props))
  try {
    await settle()
    directory.setOpen(true)
    setAlarmRequestHandler(async () => { throw new Error('offline') })
    await assert.rejects(directory.config.value.loadOptions!('', { pageIndex: 0 }))
    assert.equal(directory.candidateFailed.value, true)
    await assert.rejects(directory.config.value.loadSelectedOptions!(props.value))
    assert.equal(directory.selectedFailed.value, true)
    let release!: (value: unknown) => void
    setAlarmRequestHandler(() => new Promise(resolve => { release = resolve }))
    const pending = directory.config.value.loadOptions!('', { pageIndex: 0 })
    directory.setOpen(false)
    release({ result: { data: [{ id: 'old', name: 'Old' }], total: 1 } })
    assert.deepEqual(await pending, [])
    assert.equal(directory.options.value.length, 0)
    directory.setOpen(true)
    const previous = directory.config.value.loadSelectedOptions!(props.value)
    const releasePrevious = release
    props.scopeKey = 'p2:cpu'
    await nextTick()
    releasePrevious({ result: { data: [{ id: 'saved', name: 'Wrong scope' }], total: 1 } })
    assert.deepEqual(await previous, [])
    assert.equal(directory.open.value, false)
    assert.equal(directory.selected.value[0].label, 'saved')
    release({ result: { data: [{ id: 'saved', name: 'Current scope' }], total: 1 } })
    await settle()
    assert.equal(directory.selectionLabel.value, 'Current scope')
  } finally { unmount() }
})

test('editing and resetting a preview never dirties the saved rule; config changes recompute with the trial inputs', async () => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { addEventListener() {}, removeEventListener() {} } })
  setAlarmRequestHandler(async () => { throw new Error('Preview must not request anything') })
  const props = reactive<RuleEditorProps>({ open: true, inline: true, scope: { productId: 'p1' }, property: { id: 'temperature', valueType: { type: 'double' } }, snapshot: { hasOverride: false, raw: { provider: 'change-sampling', configuration: { deadband: 1, deadbandType: 'absolute' } } } })
  const { state: editor, unmount } = mountState(() => usePropertyRuleEditor(props, () => {}, () => {}))
  await settle()
  const { state: example, unmount: unmountExample } = mountState(() => useRuleExample(reactive({ draft: editor.draft.value!, property: props.property })))
  try {
    const saved = JSON.stringify(editor.draft.value)
    example.inputs.value[0].value = 20
    assert.equal(example.points.value[1].stages[0].baseline, '20')
    assert.equal(JSON.stringify(editor.draft.value), saved)
    assert.equal(editor.pendingSave.value, false)
    example.inputs.value[0].value = null
    assert.equal(example.error.value, 'PropertyRules.diagram.invalidValue')
    assert.equal(example.points.value.length, 0)
    example.reset()
    assert.equal(example.error.value, undefined)
    assert.equal(example.inputs.value[0].value, 10)
    assert.equal(editor.pendingSave.value, false)
    editor.draft.value!.deadband = 2
    assert.equal(example.inputs.value[1].value, 10.4, 'configuration changes retain the manual sample sequence')
    assert.equal(example.points.value[3].sampled, true)
    example.reset()
    assert.equal(example.inputs.value[1].value, 10.8)
  } finally { unmountExample(); unmount(); Reflect.deleteProperty(globalThis, 'window') }
})

test('alarm options load only on demand, cache successes and ignore responses after an editor reset', async () => {
  const requests: string[] = []
  setAlarmRequestHandler(async (url) => {
    requests.push(url)
    if (url === '/alarm/config/default/level') return { result: { levels: [{ level: 4, title: 'Custom level' }] } }
    return { result: [] }
  })
  const { state: resources, unmount } = mountState(useRuleResources)
  try {
    assert.equal(requests.length, 0)
    await resources.loadLevels()
    await resources.loadLevels()
    assert.deepEqual(requests, ['/alarm/config/default/level'])
    assert.deepEqual(resources.levels.value, [{ value: 4, label: 'Custom level' }])
    await resources.load()
    const afterLoad = requests.length
    await resources.load()
    assert.ok(requests.every(url => url !== '/user/detail/_query'), 'opening notifications never prefetches the user directory')
    assert.equal(requests.length, afterLoad, 'opening notifications again reuses the successful option snapshot')
    assert.equal(resources.ready.value, true)
    resources.reset()
    let release!: (value: unknown) => void
    setAlarmRequestHandler(url => url === '/notify/channel/all'
      ? new Promise(resolve => { release = resolve }) : Promise.resolve({ result: [] }))
    const pending = resources.load()
    resources.reset()
    release({ result: [] })
    await pending
    assert.equal(resources.ready.value, false)
    assert.equal(resources.loading.value, false)
    assert.deepEqual(resources.methods.value, [])
    setAlarmRequestHandler(async () => { throw new Error('options unavailable') })
    await resources.loadLevels()
    assert.equal(resources.levelsFailed.value, true)
    assert.equal(resources.failed.value, false, 'a level lookup failure does not invalidate notification options')
    await resources.load()
    assert.equal(resources.failed.value, true)
    assert.equal(resources.ready.value, true)
    setAlarmRequestHandler(async () => ({ result: [] }))
    await resources.load()
    assert.equal(resources.failed.value, true, 'ordinary display must keep a settled failure until an explicit retry')
    await resources.retry()
    assert.equal(resources.ready.value, true)
    assert.equal(resources.failed.value, false)
  } finally { unmount() }
})

test('inline editor saves the selected report strategy and whitelist without extra reads', async () => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { addEventListener() {}, removeEventListener() {} } })
  const writes: Array<Record<string, any>> = []
  setAlarmRequestHandler(async (_url, body) => { writes.push(body); return { result: [] } })
  const props = reactive<RuleEditorProps>({ open: true, inline: true, scope: { productId: 'p1' }, property: { id: 'temperature', valueType: { type: 'double' } }, snapshot: { hasOverride: false } })
  const { state: editor, unmount } = mountState(() => usePropertyRuleEditor(props, () => {}, () => {}))
  try {
    await settle()
    assert.equal(editor.draft.value?.alarm.name, 'temperature alarm')
    editor.addPart('values')
    editor.draft.value!.valuesMode = 'keep'
    // ValueSetInput now emits typed values directly into the shared draft.
    editor.draft.value!.values = [0, 12.5]
    editor.addPart('interval')
    assert.equal(editor.draft.value?.samplingMode, 'interval')
    assert.equal(writes.length, 0)
    editor.draft.value!.interval = 0.5
    editor.draft.value!.intervalUnit = 1000
    await editor.save()
    const processors = writes[0].configuration.processors
    assert.deepEqual(processors[0].configuration.matcher.configuration, { values: [0, 12.5], not: true })
    assert.deepEqual(processors[1], { provider: 'interval-sampling', configuration: { intervalMillis: 500 } })
    editor.draft.value!.samplingMode = 'change'
    editor.draft.value!.deadband = 125
    editor.draft.value!.deadbandType = 'percent'
    await editor.save()
    assert.equal(writes.length, 2)
    assert.deepEqual(writes[1].configuration.processors[1], { provider: 'change-sampling', configuration: { deadband: 125, deadbandType: 'percent' } })
    assert.equal(editor.addableParts.value.some(part => ['sampling', 'interval', 'change'].includes(part)), false)
  } finally { unmount(); Reflect.deleteProperty(globalThis, 'window') }
})

test('detail context refresh preserves an open rule editor; changing device closes it', async () => {
  let requests = 0
  setAlarmRequestHandler(async () => { requests++; return { result: [] } })
  ruleRoute.query = { tab: 'property-rules' }
  const property = { id: 'temperature', name: 'Temperature', valueType: { type: 'double' } }
  const props = reactive({ scope: { productId: 'product', deviceId: 'device-a', name: 'Device A' }, properties: [property] })
  const { panel, unmount } = mountPanel(props)
  try {
    await settle()
    panel.open(property)
    await settle()
    assert.equal(panel.editorOpen.value, true)
    const before = requests
    props.scope = { ...props.scope, name: 'Refreshed device context' }
    await settle()
    assert.equal(panel.editorOpen.value, true)
    assert.equal(panel.selected.value?.id, 'temperature')
    assert.equal(ruleRoute.query.ruleProperty, 'temperature')
    assert.equal(requests, before)
    props.scope = { ...props.scope, deviceId: 'device-b' }
    await settle()
    assert.equal(panel.editorOpen.value, false)
    assert.equal(ruleRoute.query.ruleProperty, undefined)
    assert.equal(requests, before + 2)
  } finally { unmount() }
})

test('property categories preserve model order and identity; search includes collapsed and undisplayed properties', async () => {
  setAlarmRequestHandler(async () => ({ result: [{ property: 'p34', configuration: { processors: [] } }] }))
  ruleRoute.query = {}
  const properties = [
    ...Array.from({ length: 35 }, (_, i) => ({ id: `p${i}`, name: `Property ${i}`, expands: { groupId: 'a', groupName: 'Monitoring' } })),
    { id: 'other', name: 'Other', expands: { groupId: 'b', groupName: 'Monitoring' } },
    { id: 'legacy', name: 'Legacy', expands: { groupName: 'Legacy group' } },
    { id: 'ungrouped', name: 'No group' },
  ]
  const { panel, unmount } = mountPanel(reactive({ scope: { productId: 'product' }, properties }))
  try {
    await settle()
    assert.deepEqual(panel.groups.value.map(group => group.id), ['id:a', 'id:b', 'name:Legacy group', 'unclassified'])
    assert.deepEqual(panel.expandedGroups.value, ['id:a'])
    panel.setExpandedGroup('id:b')
    assert.deepEqual(panel.expandedGroups.value, ['id:b'])
    panel.setExpandedGroup([])
    assert.deepEqual(panel.expandedGroups.value, [])
    assert.equal(panel.groups.value[0].visibleRows.length, 30)
    assert.equal(panel.groups.value[0].remaining, 5)
    panel.showMore('id:a')
    assert.equal(panel.groups.value[0].visibleRows.length, 35)
    panel.expandedGroups.value = []
    panel.keyword.value = 'P34'
    await settle()
    assert.deepEqual(panel.groups.value.flatMap(group => group.visibleRows.map(row => row.id)), ['p34'])
    assert.deepEqual(panel.expandedGroups.value, ['id:a'])
    panel.keyword.value = ''
    panel.configurationFilter.value = 'configured'
    await settle()
    assert.deepEqual(panel.rows.value.map(row => row.id), ['p34'])
    panel.keyword.value = 'missing'
    await settle()
    assert.equal(panel.groups.value.length, 0)
  } finally { unmount() }
})

test('configuration filters count inherited rules and explicit empty overrides without extra requests', async () => {
  let requests = 0
  const ratio = { provider: 'ratio-sampling', configuration: { ratio: 0.5 } }
  setAlarmRequestHandler(async url => {
    requests++
    return { result: url.includes('/product/product/device/')
      ? [{ property: 'disabled', provider: 'composite', configuration: { processors: [] } }]
      : [{ property: 'inherited', ...ratio }, { property: 'disabled', ...ratio }] }
  })
  ruleRoute.query = {}
  const properties = ['inherited', 'disabled', 'none'].map(id => ({ id, expands: { groupId: 'a' } }))
  const { panel, unmount } = mountPanel(reactive({ scope: { productId: 'product', deviceId: 'device', canUpdate: false }, properties }))
  try {
    await settle()
    assert.equal(panel.canSave.value, false)
    assert.deepEqual(panel.rows.value.map(row => row.source), ['product', 'disabled', 'none'])
    panel.configurationFilter.value = 'configured'
    await settle()
    assert.deepEqual(panel.rows.value.map(row => row.id), ['inherited', 'disabled'])
    assert.equal(panel.groups.value[0].configured, 2)
    assert.equal(panel.groups.value[0].total, 3)
    panel.configurationFilter.value = 'unconfigured'
    await settle()
    assert.deepEqual(panel.rows.value.map(row => row.id), ['none'])
    assert.equal(panel.groups.value[0].configured, 2)
    assert.equal(panel.groups.value[0].total, 3)
    panel.keyword.value = 'none'
    await settle()
    assert.equal(panel.groups.value[0].configured, 0)
    assert.equal(panel.groups.value[0].total, 1)
    assert.equal(requests, 2)
  } finally { unmount() }
})

test('property deep links open only their group and reveal rows beyond the first chunk', async () => {
  setAlarmRequestHandler(async () => ({ result: [] }))
  ruleRoute.query = { ruleProperty: 'p34' }
  const properties = [{ id: 'first', expands: { groupId: 'a' } },
    ...Array.from({ length: 35 }, (_, index) => ({ id: `p${index}`, expands: { groupId: 'b' } }))]
  const { panel, unmount } = mountPanel(reactive({ scope: { productId: 'product' }, properties }))
  try {
    await settle()
    assert.deepEqual(panel.expandedGroups.value, ['id:b'])
    assert.equal(panel.groups.value[1].visibleRows.length, 35)
    assert.equal(panel.selected.value?.id, 'p34')
    panel.configurationFilter.value = 'configured'
    await settle()
    assert.equal(panel.groups.value.length, 0)
    assert.equal(panel.editorOpen.value, true, 'hiding a row does not close its draft')
    panel.configurationFilter.value = 'all'
    panel.keyword.value = 'first'
    await settle()
    ruleRoute.query = { ruleProperty: 'p33' }
    await settle()
    assert.equal(panel.keyword.value, '')
    assert.deepEqual(panel.expandedGroups.value, ['id:b'])
    assert.equal(panel.selected.value?.id, 'p33')
  } finally { unmount(); ruleRoute.query = {} }
})

test('scene navigation follows accessible menus without fetching or creating scene rules', async () => {
  setAlarmRequestHandler(async () => ({ result: [] }))
  ruleRoute.query = {}
  ruleMenus.clear()
  ruleMenuVisits.length = 0
  const { panel, unmount } = mountPanel(reactive({ scope: { productId: 'product' }, properties: [] }))
  try {
    assert.equal(panel.sceneMenu.value, undefined)
    panel.openScene()
    assert.deepEqual(ruleMenuVisits, [])
    ruleMenus.add('rule-engine/Scene')
    panel.openScene()
    assert.deepEqual(ruleMenuVisits, ['rule-engine/Scene'])
    ruleMenus.clear()
    ruleMenus.add('iot-user/scene-linkage')
    panel.openScene()
    assert.deepEqual(ruleMenuVisits, ['rule-engine/Scene', 'iot-user/scene-linkage'])
    await settle()
  } finally { unmount(); ruleMenus.clear(); ruleMenuVisits.length = 0 }
})

test('rule load failures stay explicit and can retry without classifying them as unconfigured', async () => {
  let fail = true
  setAlarmRequestHandler(async () => {
    if (fail) throw new Error('Unavailable')
    return { result: [{ property: 'p', provider: 'ratio-sampling', configuration: { ratio: 0.5 } }] }
  })
  ruleRoute.query = {}
  const { panel, unmount } = mountPanel(reactive({ scope: { productId: 'product' }, properties: [{ id: 'p' }] }))
  try {
    await settle()
    assert.equal(panel.failed.value, true)
    fail = false
    await panel.load()
    assert.equal(panel.failed.value, false)
    assert.equal(panel.groups.value[0].configured, 1)
  } finally { unmount() }
})

test('inline editor uses the list snapshot, keeps editing after save and refreshes its full baseline', async () => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { addEventListener() {}, removeEventListener() {} } })
  const raw: ThingPropertyPreprocess = { id: 'stable-rule', property: 'temperature', provider: 'composite', configuration: { processors: [{ provider: 'ratio-sampling', configuration: { ratio: 0.5 } }] } }
  const props = reactive<RuleEditorProps>({ open: true, inline: true, scope: { productId: 'p1' }, property: { id: 'temperature', valueType: { type: 'double' } }, snapshot: { raw, hasOverride: false } })
  const writes: Array<Record<string, unknown>> = []
  setAlarmRequestHandler(async (_url, body) => { writes.push(body); return { result: [] } })
  let closed = 0
  const { state: editor, unmount } = mountState(() => usePropertyRuleEditor(props, () => { closed++ }, async () => {
    props.snapshot = { raw: { ...raw, configuration: { processors: [{ provider: 'ratio-sampling', configuration: { ratio: 0.25 } }] } }, hasOverride: false }
  }))
  try {
    await settle()
    assert.equal(editor.draft.value?.percent, 50)
    assert.equal(writes.length, 0, 'selecting a row does not refetch rules or alarm resources')
    editor.draft.value!.percent = 25
    await editor.save()
    assert.equal(writes.length, 1)
    assert.equal(writes[0].id, 'stable-rule')
    assert.equal(closed, 0)
    assert.equal(editor.dirty.value, false)
    assert.equal(editor.draft.value?.percent, 25)
    editor.draft.value!.percent = 75
    assert.equal(await editor.prepareLeave(), true)
    assert.equal(editor.draft.value?.percent, 25)
    assert.equal(writes.length, 1, 'discarding a draft never saves')
  } finally { unmount(); Reflect.deleteProperty(globalThis, 'window') }
})

test('inline device inheritance remains read-only until customized; undo restores inheritance', async () => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { addEventListener() {}, removeEventListener() {} } })
  setAlarmRequestHandler(async () => { throw new Error('No request expected') })
  const props = reactive<RuleEditorProps>({ open: true, inline: true, scope: { productId: 'p1', deviceId: 'd1' }, property: { id: 'temperature' },
    snapshot: { hasOverride: false, raw: { provider: 'ratio-sampling', configuration: { ratio: 0.5 } } } })
  const { state: editor, unmount } = mountState(() => usePropertyRuleEditor(props, () => {}, () => {}))
  try {
    await settle()
    assert.equal(editor.editable.value, false)
    editor.customize()
    assert.equal(editor.editable.value, true)
    editor.draft.value!.samplingEnabled = false
    editor.discard()
    assert.equal(editor.custom.value, false)
    assert.equal(editor.dirty.value, false)
  } finally { unmount(); Reflect.deleteProperty(globalThis, 'window') }
})

test('a device without product or device rules stays directly editable after discarding or reloading an unsaved draft', async () => {
  const calls: string[] = []
  setAlarmRequestHandler(async url => { calls.push(url); return { result: [] } })
  const view = mountEditor()
  try {
    view.props.snapshot = { hasOverride: false }
    await view.editor.load()
    const { editor } = view
    assert.equal(editor.source.value, 'none')
    assert.equal(editor.displaySource.value, 'none')
    assert.equal(editor.editable.value, true)
    assert.equal(editor.pendingSave.value, false)
    editor.addPart('range')
    assert.equal(editor.pendingSave.value, true)
    assert.equal(editor.displaySource.value, 'device')
    editor.discard()
    assert.equal(editor.editable.value, true)
    assert.equal(editor.pendingSave.value, false)
    assert.equal(editor.displaySource.value, 'none')
    editor.addPart('range')
    await editor.load()
    assert.equal(editor.editable.value, true)
    assert.equal(editor.hasOverride.value, false)
    assert.equal(editor.draft.value?.rangeEnabled, false)
    assert.equal(editor.pendingSave.value, false)
    assert.deepEqual(calls, [], 'unsaved editing, discard and reload never create a device override')
  } finally { view.cleanup() }
})

test('save feedback follows the real write, expires once, and a new edit cancels the success feedback', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { addEventListener() {}, removeEventListener() {} } })
  let finish!: (value: { result: [] }) => void
  const props = reactive<RuleEditorProps>({ open: true, inline: true, scope: { productId: 'p1' }, property: { id: 'temperature' }, snapshot: { hasOverride: false } })
  setAlarmRequestHandler(() => new Promise(resolve => { finish = resolve }))
  const { state: editor, unmount } = mountState(() => usePropertyRuleEditor(props, () => {}, () => {}))
  try {
    await settle()
    editor.addPart('sampling')
    const pending = editor.save()
    assert.equal(editor.saveState.value, 'saving')
    assert.equal(editor.editable.value, false)
    await settle()
    finish({ result: [] })
    await pending
    assert.equal(editor.saveState.value, 'saved')
    context.mock.timers.tick(1800)
    assert.equal(editor.saveState.value, 'idle')
    setAlarmRequestHandler(async () => ({ result: [] }))
    editor.draft.value!.percent = 25
    await editor.save()
    assert.equal(editor.saveState.value, 'saved')
    editor.draft.value!.percent = 75
    assert.equal(editor.saveState.value, 'dirty')
    context.mock.timers.tick(2000)
    assert.equal(editor.saveState.value, 'dirty')
    editor.discard()
    assert.equal(editor.saveState.value, 'idle')
  } finally { unmount(); Reflect.deleteProperty(globalThis, 'window') }
})

test('write failure preserves the draft for retry; refresh failure after a successful write never asks to repeat the write', async () => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { addEventListener() {}, removeEventListener() {} } })
  const props = reactive<RuleEditorProps>({ open: true, inline: true, scope: { productId: 'p1' }, property: { id: 'temperature' }, snapshot: { hasOverride: false } })
  setAlarmRequestHandler(async () => { throw new Error('write failed') })
  const { state: editor, unmount } = mountState(() => usePropertyRuleEditor(props, () => {}, () => { throw new Error('refresh failed') }))
  try {
    await settle()
    editor.addPart('sampling')
    editor.draft.value!.percent = 25
    await editor.save()
    assert.equal(editor.saveState.value, 'error')
    assert.equal(editor.dirty.value, true)
    assert.equal(editor.draft.value?.percent, 25)
    setAlarmRequestHandler(async () => ({ result: [] }))
    await editor.save()
    assert.equal(editor.saveState.value, 'saved')
    assert.equal(editor.dirty.value, false)
    assert.equal(editor.pendingSave.value, false)
    props.property = { id: 'humidity' }
    props.snapshot = { hasOverride: false }
    await settle()
    assert.equal(editor.saveState.value, 'idle')
  } finally { unmount(); Reflect.deleteProperty(globalThis, 'window') }
})

test('invalid fields never start saving and an explicit empty device override remains a pending save', async () => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { addEventListener() {}, removeEventListener() {} } })
  let writes = 0
  setAlarmRequestHandler(async () => { writes++; return { result: [] } })
  const props = reactive<RuleEditorProps>({ open: true, inline: true, scope: { productId: 'p1', deviceId: 'd1' }, property: { id: 'temperature', valueType: { type: 'double' } }, snapshot: { hasOverride: false } })
  const { state: editor, unmount } = mountState(() => usePropertyRuleEditor(props, () => {}, () => {}))
  try {
    await settle()
    editor.customize()
    assert.equal(editor.pendingSave.value, true)
    assert.equal(editor.saveState.value, 'dirty')
    editor.addPart('range')
    await editor.save()
    assert.equal(writes, 0)
    assert.equal(editor.saveState.value, 'dirty')
    editor.clear()
    await editor.save()
    assert.equal(writes, 1)
    assert.equal(editor.pendingSave.value, false)
    assert.equal(editor.saveState.value, 'saved')
  } finally { unmount(); Reflect.deleteProperty(globalThis, 'window') }
})


function cardRows() {
  return ['temperature', 'humidity', 'battery'].map(id => {
    const raw: ThingPropertyPreprocess = { id: `rule-${id}`, property: id, provider: 'ratio-sampling', configuration: { ratio: 0.5 } }
    return { id, name: id, property: { id, valueType: { type: 'double' } }, raw, hasOverride: true,
      source: 'device' as 'device' | 'product' | 'disabled' | 'none', rule: parseRule(raw), effects: [] }
  })
}

const savedParts = (property: string, count: number): ThingPropertyPreprocess => ({ property, provider: 'composite', configuration: {
  processors: [...(count === 3 ? [{ provider: 'simple', configuration: {
    matcher: { provider: 'number-range', configuration: { not: true, min: 0, max: 100 } }, processors: [{ provider: 'ignore', configuration: {} }],
  } }] : []), { provider: 'scale', configuration: { scale: '1' } },
    { provider: 'ratio-sampling', configuration: { ratio: 0.5 } }].slice(0, count),
} })

test('detail lists only effective saved rules, preserves disabled overrides and sorts each group stably', async () => {
  ruleRoute.query = {}
  setAlarmRequestHandler(async url => ({ result: url.includes('/p1/d1/')
    ? [savedParts('disabled', 0)]
    : [savedParts('one', 1), savedParts('three', 3), savedParts('tie', 1), savedParts('disabled', 2),
      { property: 'legacy', provider: 'custom-handler', configuration: {} }] }))
  const { panel, unmount } = mountPanel(reactive({ presentation: 'detail', scope: { productId: 'p1', deviceId: 'd1' },
    properties: ['one', 'three', 'tie', 'disabled', 'legacy', 'none'].map(id => ({ id })) }))
  try {
    await settle()
    assert.deepEqual(panel.groups.value[0].rows.map(row => row.id), ['three', 'one', 'tie', 'legacy'])
    assert.equal(panel.configuredCount.value, 4)
    assert.equal(panel.unconfiguredCount.value, 2)
    assert.deepEqual(panel.unconfiguredRows.value.map(row => [row.id, row.source]), [['disabled', 'disabled'], ['none', 'none']])
    assert.equal(panel.propertyRows.value.find(row => row.id === 'disabled')?.rule.nodes.sampling, undefined, 'empty override never falls back to product rules')
    panel.draftIds.value = ['disabled']
    assert.ok(panel.rows.value.some(row => row.id === 'disabled'), 'an external refresh cannot hide a dirty card')
    assert.ok(!panel.unconfiguredRows.value.some(row => row.id === 'disabled'), 'a retained draft cannot be added twice')
  } finally { unmount() }
})

test('detail additions reveal their group first, support cancellation and retain saved chunk boundaries', async () => {
  ruleRoute.query = {}
  setAlarmRequestHandler(async () => ({ result: Array.from({ length: 35 }, (_, index) => savedParts(`p${index}`, 1)) }))
  const input = reactive({ presentation: 'detail' as const, scope: { productId: 'p1', canUpdate: true }, properties: [
    ...Array.from({ length: 35 }, (_, index) => ({ id: `p${index}`, expands: { groupId: 'a' } })),
    { id: 'blank', expands: { groupId: 'b' } }, { id: 'other', expands: { groupId: 'b' } },
  ] })
  const { panel, unmount } = mountPanel(input)
  try {
    await settle()
    assert.equal(panel.groups.value[0].visibleRows.length, 30)
    panel.showMore('id:a')
    assert.equal(panel.groups.value[0].visibleRows.length, 35)
    panel.keyword.value = 'p3'
    await panel.addProperty('blank')
    assert.equal(panel.keyword.value, '')
    assert.deepEqual(panel.expandedGroups.value, ['id:b'])
    assert.deepEqual(panel.groups.value[1].visibleRows.map(row => row.id), ['blank'])
    await panel.addProperty('blank')
    assert.deepEqual(panel.addedIds.value, ['blank'], 'duplicate selection is ignored')
    await panel.addProperty('other')
    assert.deepEqual(panel.groups.value[1].rows.map(row => row.id), ['other', 'blank'])
    panel.finishAdding('other')
    assert.ok(panel.unconfiguredRows.value.some(row => row.id === 'other'))
    input.scope.canUpdate = false
    await panel.addProperty('other')
    assert.deepEqual(panel.addedIds.value, ['blank'], 'read-only users cannot add cards')
    input.scope.productId = 'p2'
    await settle()
    assert.deepEqual(panel.addedIds.value, [], 'owner changes clear temporary additions')
  } finally { unmount() }
})

test('detail empty deep links stay reachable without resurrecting cancelled cards on refresh', async () => {
  ruleRoute.query = { ruleProperty: 'blank' }
  setAlarmRequestHandler(async () => ({ result: [savedParts('saved', 1)] }))
  const { panel, unmount } = mountPanel(reactive({ presentation: 'detail', scope: { productId: 'p1', canUpdate: false },
    properties: [{ id: 'saved', expands: { groupId: 'a' } }, { id: 'blank', expands: { groupId: 'b' } }] }))
  try {
    await settle()
    assert.deepEqual(panel.expandedGroups.value, ['id:b'])
    assert.equal(panel.groups.value[1].visibleRows[0].id, 'blank')
    panel.finishAdding('blank')
    await panel.load()
    await settle()
    assert.ok(!panel.rows.value.some(row => row.id === 'blank'))
    ruleRoute.query = {}
    await settle()
    ruleRoute.query = { ruleProperty: 'blank' }
    await settle()
    assert.deepEqual(panel.expandedGroups.value, ['id:b'], 'a later explicit link can reveal the same property again')
  } finally { unmount(); ruleRoute.query = {} }
})

test('detail cards stay pinned while editing and after failure, then rank by saved parts and disappear after clearing', async () => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { addEventListener() {}, removeEventListener() {} } })
  ruleRoute.query = {}
  const saved = new Map(['many', 'few', 'tie'].map((id, index) => [id, savedParts(id, index === 0 ? 3 : 1)]))
  let failWrite = false
  let writes = 0
  setAlarmRequestHandler(async (url, body) => {
    const property = decodeURIComponent(url.split('/').pop()!)
    if (body.method === 'PUT') {
      writes++
      if (failWrite) throw new Error('Write failed')
      const { method, ...raw } = body
      saved.set(property, { ...raw, property } as unknown as ThingPropertyPreprocess)
    }
    if (body.method === 'DELETE') saved.delete(property)
    return { result: url.includes('/p1/property/_list') ? [] : [...saved.values()] }
  })
  const mounted = mountState(() => {
    const panel = usePropertyRules(reactive({ presentation: 'detail', scope: { productId: 'p1', deviceId: 'd1' },
      properties: ['few', 'many', 'new', 'tie'].map(id => ({ id, valueType: { type: 'double' } })) }))
    const cards = usePropertyRuleCards(reactive({ scope: { productId: 'p1', deviceId: 'd1' }, rows: panel.propertyRows,
      visibleRows: computed(() => panel.groups.value[0]?.visibleRows ?? []), loading: panel.loading,
    }), async id => { await panel.load(); if (!panel.failed.value) panel.finishAdding(id) })
    watch(() => [...cards.editors].filter(([, entry]) => entry.editor.pendingSave || entry.editor.saving).map(([id]) => id), ids => { panel.draftIds.value = ids })
    return { panel, cards }
  })
  const { panel, cards } = mounted.state
  try {
    await settle()
    await panel.addProperty('new')
    await settle()
    const editor = cards.editors.get('new')!.editor
    editor.addPart('scale')
    editor.addPart('sampling')
    assert.deepEqual(panel.groups.value[0].rows.map(row => row.id), ['new', 'many', 'few', 'tie'])
    failWrite = true
    await editor.save()
    assert.equal(editor.saveState, 'error')
    assert.deepEqual(panel.addedIds.value, ['new'])
    failWrite = false
    await editor.save()
    await settle()
    assert.equal(writes, 2)
    assert.equal(editor.pendingSave, false)
    assert.deepEqual(panel.addedIds.value, [])
    assert.deepEqual(panel.groups.value[0].rows.map(row => row.id), ['many', 'new', 'few', 'tie'])
    editor.clear()
    assert.ok(panel.rows.value.some(row => row.id === 'new'), 'clearing a draft does not hide it before save')
    await editor.save()
    await settle()
    assert.ok(!panel.rows.value.some(row => row.id === 'new'))
    assert.ok(panel.unconfiguredRows.value.some(row => row.id === 'new'))
    assert.equal(saved.get('new')?.provider, 'composite', 'device clear persists an empty override rather than deleting it')
  } finally { mounted.unmount(); Reflect.deleteProperty(globalThis, 'window') }
})
function mountCards() {
  const beforeUnload = mountRuleWindow()
  const input = reactive({ scope: { productId: 'p1', deviceId: 'd1' } as RuleScope, rows: cardRows(), visible: ['temperature', 'humidity'], loading: false })
  let refreshes = 0
  const mounted = mountState(() => usePropertyRuleCards(reactive({ scope: computed(() => input.scope),
    rows: computed(() => input.rows), visibleRows: computed(() => input.rows.filter(row => input.visible.includes(row.id))), loading: computed(() => input.loading),
  }), () => { refreshes++ }))
  return { input, cards: mounted.state, beforeUnload, refreshes: () => refreshes,
    cleanup() { mounted.unmount(); setConfirmHandler(); Reflect.deleteProperty(globalThis, 'window') } }
}

test('persistent cards keep controls and independent drafts across filtering, saving and revisiting', async () => {
  let writes = 0
  setAlarmRequestHandler(async () => { writes++; return { result: [] } })
  const view = mountCards()
  try {
    await settle()
    assert.equal(view.cards.editors.size, 2, 'unvisited properties do not create editors')
    assert.equal(writes, 0, 'all cards reuse the list snapshot')
    const first = view.cards.editors.get('temperature')!.editor
    const second = view.cards.editors.get('humidity')!.editor
    first.draft!.percent = 25
    second.draft!.percent = 75
    view.input.visible = ['humidity', 'battery']
    await settle()
    assert.equal(view.cards.editors.size, 3)
    assert.equal(first.draft!.percent, 25, 'filtering does not dispose a hidden draft')
    assert.equal(second.draft!.percent, 75)
    await first.save()
    assert.equal(writes, 1)
    assert.equal(view.refreshes(), 1)
    assert.equal(first.pendingSave, false)
    assert.equal(first.draft!.percent, 25, 'saving retains the same configuration form')
    assert.equal(second.draft!.percent, 75, 'saving one card cannot discard its neighbour')
    assert.equal(second.pendingSave, true)
    view.input.visible = ['temperature']
    await settle()
    assert.equal(view.cards.editors.get('temperature')!.editor, first)
    first.draft!.percent = 10
    first.discard()
    assert.equal(first.draft!.percent, 25, 'undo uses the last saved baseline')
    second.discard()
    assert.equal(second.draft!.percent, 50)
  } finally { view.cleanup() }
})

test('card snapshot refreshes update clean neighbours while retaining unsaved or hidden drafts', async () => {
  const view = mountCards()
  try {
    await settle()
    const first = view.cards.editors.get('temperature')!.editor
    const second = view.cards.editors.get('humidity')!.editor
    first.draft!.percent = 25
    view.input.visible = ['temperature']
    view.input.rows = cardRows().map(row => ({ ...row, raw: { ...row.raw, configuration: { ratio: 0.1 } } }))
    await settle()
    assert.equal(first.draft!.percent, 25)
    assert.equal(first.pendingSave, true)
    assert.equal(second.draft!.percent, 10, 'hidden clean card receives the refreshed server baseline')
    assert.equal(second.pendingSave, false)
    view.input.scope = { productId: 'p2', deviceId: 'd2' }
    await settle()
    assert.notEqual(view.cards.editors.get('temperature')!.editor, first)
    assert.equal(view.cards.editors.size, 1, 'new owner does not inherit old card caches')
    assert.equal(view.cards.editors.get('temperature')!.editor.draft!.percent, 10)
  } finally { view.cleanup() }
})

test('one leave confirmation covers hidden card drafts and cancellation preserves every draft', async () => {
  const leaveGuards = routeGuards.leave.length
  const updateGuards = routeGuards.update.length
  const view = mountCards()
  try {
    await settle()
    assert.equal(routeGuards.leave.length, leaveGuards + 1, 'guards belong to the collection, not each card')
    assert.equal(routeGuards.update.length, updateGuards + 1)
    const first = view.cards.editors.get('temperature')!.editor
    const second = view.cards.editors.get('humidity')!.editor
    first.draft!.percent = 25
    second.draft!.percent = 75
    view.input.visible = []
    await settle()
    const dialogs: TestConfirmation[] = []
    setConfirmHandler(options => dialogs.push(options))
    const cancelled = view.cards.confirmLeave()
    assert.equal(dialogs.length, 1)
    dialogs[0].onCancel?.()
    assert.equal(await cancelled, false)
    assert.equal(first.draft!.percent, 25)
    assert.equal(second.draft!.percent, 75)
    const accepted = view.cards.confirmLeave()
    dialogs[1].onOk?.()
    assert.equal(await accepted, true)
    assert.equal(first.pendingSave, true, 'an unrelated guard can still cancel navigation without discarding drafts')
  } finally { view.cleanup() }
  assert.equal(routeGuards.leave.length, leaveGuards)
  assert.equal(routeGuards.update.length, updateGuards)
})

test('concurrent card navigations share one dialog and cancellation allows a fresh attempt', async () => {
  const view = mountCards()
  try {
    await settle()
    const editor = view.cards.editors.get('temperature')!.editor
    editor.draft!.percent = 25
    const dialogs: TestConfirmation[] = []
    setConfirmHandler(options => dialogs.push(options))
    const from = editorRoute('p1')
    const to = editorRoute('p2')
    const leave = routeGuards.leave.at(-1)!
    const update = routeGuards.update.at(-1)!
    const first = [leave(to, from, () => {}), update(to, from, () => {}), view.cards.confirmLeave()]
    assert.equal(dialogs.length, 1, 'logout/repeated route requests must not stack discard dialogs')
    dialogs[0].onCancel?.()
    assert.deepEqual(await Promise.all(first), [false, false, false])
    assert.equal(editor.draft!.percent, 25)
    const second = [view.cards.confirmLeave(), leave(to, from, () => {})]
    assert.equal(dialogs.length, 2, 'cancelling permits a new navigation attempt')
    dialogs[0].afterClose?.()
    dialogs[1].onOk?.()
    assert.deepEqual(await Promise.all(second), [true, true])
    assert.equal(editor.pendingSave, true, 'confirmation cannot discard drafts before navigation succeeds')
    const third = view.cards.confirmLeave()
    assert.equal(dialogs.length, 3, 'another guard may have cancelled the accepted navigation')
    dialogs[2].onCancel?.()
    assert.equal(await third, false)
  } finally { view.cleanup() }
})

test('standalone editor coalesces route and close confirmations and settles them on disposal', async () => {
  const view = mountEditor()
  try {
    await settle()
    view.editor.draft.value!.percent = 25
    const from = editorRoute('p1')
    const to = editorRoute('p2')
    const leave = routeGuards.leave.at(-1)!
    const update = routeGuards.update.at(-1)!
    const pending = [leave(to, from, () => {}), update(to, from, () => {}), view.editor.prepareLeave()]
    assert.equal(view.dialogs.length, 1)
    view.dialogs[0].onCancel?.()
    assert.deepEqual(await Promise.all(pending), [false, false, false])
    assert.equal(view.editor.draft.value!.percent, 25)
    const retry = [leave(to, from, () => {}), view.editor.prepareLeave()]
    assert.equal(view.dialogs.length, 2)
    view.unmount()
    assert.equal(view.dialogs[1].destroyed, true, 'unmount closes the editor-owned dialog')
    assert.deepEqual(await Promise.all(retry), [false, false])
    assert.equal(view.editor.draft.value!.percent, 25)
  } finally { view.cleanup() }
})

test('explicit logout releases card navigation and unload guards without retaining a discard dialog', async () => {
  const view = mountCards()
  try {
    await settle()
    const editor = view.cards.editors.get('temperature')!.editor
    editor.draft!.percent = 25
    assert.equal(view.beforeUnload(), true, 'ordinary reload/close keeps unsaved protection')
    const dialogs: TestConfirmation[] = []
    setConfirmHandler(options => dialogs.push(options))
    const pending = view.cards.confirmLeave()
    assert.equal(dialogs.length, 1)
    await successfulRuleLogout()
    assert.equal(dialogs[0].destroyed, true, 'only the editor-owned dialog is closed')
    assert.equal(await pending, true, 'logout releases any already-pending navigation')
    assert.equal(await view.cards.confirmLeave(), true)
    assert.equal(view.beforeUnload(), false, 'full-document logout must not trigger a native prompt')
    const from = editorRoute('p1'), to = editorRoute('p2')
    assert.equal(await routeGuards.update.at(-1)!(to, from, () => {}), true)
    assert.equal(dialogs.length, 1, 'logout creates no additional discard confirmation')
    assert.equal(editor.pendingSave, true, 'the bypass does not write or mutate drafts')
    finishRuleLogoutNavigation({ type: 4 } as NavigationFailure)
    assert.equal(view.beforeUnload(), false, 'failed login navigation cannot restore prompts during logout')
    finishRuleLogoutNavigation(undefined, 'PublicHelp')
    assert.equal(view.beforeUnload(), false, 'an intermediate public route does not end logout')
    finishRuleLogoutNavigation()
    assert.equal(view.beforeUnload(), true, 'normal protection returns after logout navigation finishes')
    const normal = view.cards.confirmLeave()
    assert.equal(dialogs.length, 2)
    dialogs[1].onCancel?.()
    assert.equal(await normal, false)
  } finally { finishRuleLogoutNavigation(); view.cleanup() }
})

test('only the successful explicit logout endpoint bypasses protection and response data is preserved', async () => {
  const view = mountEditor()
  try {
    await settle()
    view.editor.draft.value!.percent = 25
    for (const scenario of [
      { data: { success: false, status: 200 }, status: 200 },
      { data: { success: true }, status: 500 },
      { data: { status: 401 }, status: 401 },
      { data: { status: 200 }, status: 200, url: '/user/detail' },
      { data: { success: true }, status: 200, method: 'post' },
      { data: { result: true }, status: 200 },
      { data: 'invalid response', status: 200 },
    ]) {
      const response = await ruleRequest(scenario.data, scenario.status, scenario.url, scenario.method)
      assert.deepEqual(response.data, scenario.data)
      assert.equal(activeLogoutNavigation.value, false)
      assert.equal(view.beforeUnload(), true)
    }
    const failure = new Error('logout transport failed')
    await assert.rejects(getInstance().get('/user-token/reset', { adapter: async () => { throw failure } }), error => error === failure)
    assert.equal(view.beforeUnload(), true)
    for (const data of [{ success: true }, { status: 200 }]) {
      const response = await ruleRequest(data)
      assert.deepEqual(response.data, data)
      assert.equal(activeLogoutNavigation.value, true, 'intent is visible before the logout caller receives its response')
      assert.equal(view.beforeUnload(), false)
      finishRuleLogoutNavigation()
    }
    assert.equal(view.dialogs.length, 0)
  } finally { view.cleanup() }
})

test('rule scopes share one observer and remove it only when the last scope is disposed', async () => {
  const baseline = ruleRouteAfterEach.size
  const first = mountState(() => useRuleLogoutNavigation())
  const second = mountState(() => useRuleLogoutNavigation())
  try {
    assert.equal(ruleRouteAfterEach.size, baseline + 1)
    const response = await getInstance().get('/user-token/reset', {
      transformResponse: data => ({ ...JSON.parse(data), retained: true }),
      adapter: async config => {
        assert.equal((config.transformResponse as unknown[]).length, 2, 'one observation despite multiple scopes')
        return { config, status: 200, statusText: '', headers: {}, data: '{"success":true}' }
      },
    })
    assert.deepEqual(response.data, { success: true, retained: true })
    first.unmount()
    assert.equal(ruleRouteAfterEach.size, baseline + 1)
    finishRuleLogoutNavigation()
    await successfulRuleLogout()
    assert.equal(activeLogoutNavigation.value, true, 'remaining rules still observe logout')
  } finally { second.unmount() }
  assert.equal(ruleRouteAfterEach.size, baseline)
  assert.equal(activeLogoutNavigation.value, false)
  await successfulRuleLogout()
  assert.equal(activeLogoutNavigation.value, false, 'unmounted rules no longer observe global requests')
})

test('a late logout response cannot bypass a new rule scope after the old owner is destroyed', async () => {
  const first = mountState(() => useRuleLogoutNavigation())
  let respond!: () => void
  const request = getInstance().get('/user-token/reset', { adapter: config => new Promise(resolve => {
    respond = () => resolve({ config, status: 200, statusText: '', headers: {}, data: '{"success":true}' })
  }) })
  await settle()
  first.unmount()
  const second = mountState(() => useRuleLogoutNavigation())
  try {
    respond()
    await request
    assert.equal(activeLogoutNavigation.value, false)
    await successfulRuleLogout()
    assert.equal(activeLogoutNavigation.value, true)
  } finally { second.unmount() }
})

test('login arrival invalidates responses from logout requests issued in the previous session', async () => {
  const view = mountState(() => useRuleLogoutNavigation())
  let respond!: () => void
  const request = getInstance().get('/user-token/reset', { adapter: config => new Promise(resolve => {
    respond = () => resolve({ config, status: 200, statusText: '', headers: {}, data: '{"success":true}' })
  }) })
  try {
    await settle()
    finishRuleLogoutNavigation()
    respond()
    await request
    assert.equal(activeLogoutNavigation.value, false)
    await successfulRuleLogout()
    assert.equal(activeLogoutNavigation.value, true)
  } finally { view.unmount() }
})

test('explicit logout skips standalone rule-editor prompts and leaves later navigation protected', async () => {
  const view = mountEditor()
  try {
    await settle()
    view.editor.draft.value!.percent = 25
    assert.equal(view.beforeUnload(), true)
    const leave = routeGuards.leave.at(-1)!, update = routeGuards.update.at(-1)!
    const from = editorRoute('p1'), to = editorRoute('p2')
    const pending = leave(to, from, () => {})
    assert.equal(view.dialogs.length, 1)
    await successfulRuleLogout()
    assert.equal(view.dialogs[0].destroyed, true)
    assert.equal(await pending, true)
    assert.equal(await leave(to, from, () => {}), true)
    assert.equal(await update(to, from, () => {}), true)
    assert.equal(view.beforeUnload(), false)
    assert.equal(view.dialogs.length, 1)
    finishRuleLogoutNavigation()
    assert.equal(view.beforeUnload(), true)
    const ordinary = leave(to, from, () => {})
    assert.equal(view.dialogs.length, 2)
    view.dialogs[1].onCancel?.()
    assert.equal(await ordinary, false)
    assert.equal(view.editor.draft.value!.percent, 25)
  } finally { finishRuleLogoutNavigation(); view.cleanup() }
})

test('a successful explicit logout cannot be held open by a rule write still in flight', async () => {
  let finish!: (value: { result: [] }) => void
  setAlarmRequestHandler(async () => new Promise(resolve => { finish = resolve }))
  const view = mountCards()
  try {
    await settle()
    const editor = view.cards.editors.get('temperature')!.editor
    editor.draft!.percent = 25
    const write = editor.save()
    await settle()
    assert.equal(view.cards.saving.value, true)
    assert.equal(await view.cards.confirmLeave(), false)
    await successfulRuleLogout()
    assert.equal(await view.cards.confirmLeave(), true)
    assert.equal(view.beforeUnload(), false)
    finish({ result: [] })
    await write
  } finally { finishRuleLogoutNavigation(); view.cleanup() }
})

test('cards serialize writes, share lazy notification resources and reject late saves after owner change', async () => {
  let finish!: (value: { result: [] }) => void
  let methodRequests = 0
  let writes = 0
  setAlarmRequestHandler(async url => {
    if (url === '/notify/channel/all' || url === '/notify/channel/providers') { methodRequests++; return { result: [] } }
    writes++
    return new Promise(resolve => { finish = resolve })
  })
  const view = mountCards()
  try {
    await settle()
    const first = view.cards.editors.get('temperature')!.editor
    const second = view.cards.editors.get('humidity')!.editor
    assert.equal(first.resources, second.resources)
    assert.equal(methodRequests, 0)
    await Promise.all([first.resources.load(), second.resources.load()])
    assert.equal(methodRequests, 2, 'one shared methods load makes one request per underlying endpoint')
    first.draft!.percent = 25
    second.draft!.percent = 75
    const pending = first.save()
    await settle()
    assert.equal(second.blocked, true)
    await second.save()
    assert.equal(writes, 1, 'a second card cannot submit during a write')
    assert.equal(await view.cards.confirmLeave(), false)
    view.input.scope = { productId: 'p2', deviceId: 'd2' }
    await settle()
    finish({ result: [] })
    await pending
    assert.equal(view.refreshes(), 0, 'a stale owner response cannot refresh the new device')
    assert.equal(view.cards.editors.get('temperature')!.editor.draft!.percent, 50)
  } finally { view.cleanup() }
})


test('persistent card controls preserve inheritance, permissions and explicit empty device overrides', async () => {
  let writes = 0
  setAlarmRequestHandler(async () => { writes++; return { result: [] } })
  const view = mountCards()
  try {
    view.input.rows = cardRows().map(row => ({ ...row, hasOverride: false, source: 'product' as const }))
    await settle()
    const first = view.cards.editors.get('temperature')!.editor
    assert.equal(first.draft!.percent, 50, 'inherited data is available for the fixed controls')
    assert.equal(first.editable, false)
    first.customize()
    assert.equal(first.pendingSave, true)
    assert.equal(first.dirty, false)
    let confirmation: TestConfirmation | undefined
    setConfirmHandler(options => { confirmation = options })
    const leave = view.cards.confirmLeave()
    assert.ok(confirmation, 'an explicit override is protected even before changing a field')
    confirmation.onCancel?.()
    assert.equal(await leave, false)
    first.discard()
    assert.equal(first.custom, false)
    view.input.scope.canUpdate = false
    await settle()
    first.customize()
    await first.save()
    assert.equal(first.editable, false)
    assert.equal(writes, 0, 'showing controls cannot grant write permission')
    first.discard()
    view.input.scope.canUpdate = true
    view.input.rows = cardRows().map(row => ({ ...row, raw: { ...row.raw, provider: 'composite', configuration: { processors: [] } }, source: 'disabled' as const }))
    await settle()
    assert.equal(first.displaySource, 'disabled')
    assert.equal(first.steps.some(step => step.enabled), false)
    first.addPart('sampling')
    assert.equal(first.pendingSave, true)
    first.clear()
    assert.equal(first.displaySource, 'disabled')
    assert.equal(first.draft!.samplingEnabled, false)
    assert.equal(writes, 0, 'clearing or undoing a form never implicitly removes an override')
  } finally { view.cleanup() }
})


test('loading a different device never initializes editable cards from the previous device snapshot', async () => {
  const view = mountCards()
  try {
    await settle()
    const old = view.cards.editors.get('temperature')!.editor
    view.input.loading = true
    await settle()
    assert.equal(old.blocked, true, 'list refresh blocks writes against an outdated snapshot')
    view.input.scope = { productId: 'p2', deviceId: 'd2' }
    await settle()
    assert.equal(view.cards.editors.size, 0)
    view.input.rows = cardRows().map(row => ({ ...row, raw: { ...row.raw, configuration: { ratio: 0.2 } } }))
    view.input.loading = false
    await settle()
    const next = view.cards.editors.get('temperature')!.editor
    assert.notEqual(next, old)
    assert.equal(next.draft!.percent, 20)
    assert.equal(next.blocked, false)
  } finally { view.cleanup() }
})
