import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRenderer, defineComponent, nextTick, reactive } from 'vue'
import { createI18n } from 'vue-i18n'
import type { RouteLocationNormalized } from 'vue-router'
import { usePropertyRules } from '../views/device/components/PropertyRules/usePropertyRules'
import { setAlarmRequestHandler } from './alarmRequest.test-shim'
import { routeGuards, ruleRoute, setConfirmHandler, type TestConfirmation } from './propertyRuleScope.test-shim'
import { usePropertyRuleEditor, type RuleEditorProps } from '../views/device/components/PropertyRules/usePropertyRuleEditor'
import { useRuleResources } from '../views/device/components/PropertyRules/useRuleResources'
import { useRuleExample } from '../views/device/components/PropertyRules/useRuleExample'
import { useAlarmRecipients } from '../views/device/alarm/hooks/useAlarmRecipients'
import { useAlarmNotification } from '../views/device/alarm/hooks/useAlarmNotification'
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

function mountEditor(changed: (props: RuleEditorProps) => void | Promise<void> = () => {}) {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { addEventListener() {}, removeEventListener() {} } })
  const props = reactive<RuleEditorProps>({ open: true, inline: true, scope: { productId: 'p1', deviceId: 'd1' },
    property: { id: 'temperature', valueType: { type: 'double' } },
    snapshot: { hasOverride: true, raw: { provider: 'ratio-sampling', configuration: { ratio: 0.5 } } } })
  const mounted = mountState(() => usePropertyRuleEditor(props, () => {}, () => changed(props)))
  const dialogs: TestConfirmation[] = []
  setConfirmHandler(options => { dialogs.push(options) })
  let active = true
  const unmount = () => { if (active) { mounted.unmount(); active = false } }
  return { props, editor: mounted.state, dialogs, unmount,
    cleanup() { unmount(); setConfirmHandler(); Reflect.deleteProperty(globalThis, 'window') } }
}

const editorRoute = (id: string): RouteLocationNormalized => ({ path: `/products/${id}`, fullPath: `/products/${id}`,
  name: 'product-detail', params: { id }, query: { tab: 'AlarmConfig', ruleProperty: 'temperature' }, hash: '', matched: [], meta: {}, redirectedFrom: undefined })

function notificationProps() {
  const model: DeviceAlarmFormModel = { source: 'device', targetId: 'd1', productId: 'p1', property: 'temperature', name: 'Temperature',
    level: 4, trigger: 'gte', value: 80, limit: {}, autoRelieve: true, relieveCondition: { trigger: 'lte', value: 75, limit: {} },
    notification: { ...createEmptyNotification(), userIds: ['u1'], notifyChannelIds: ['inbox-1'], channelProviders: ['inbox'], parameters: { template: 'Existing content' } } }
  const methods: DeviceAlarmNotifyMethod[] = [
    { id: 'inbox-1', channelId: 'inbox-1', providerId: 'inbox', key: 'inbox', label: 'Inbox', desc: '', icon: 'MailOutlined' },
    { id: 'email-1', channelId: 'email-1', providerId: 'email', key: 'email', label: 'Email', desc: '', icon: 'MailOutlined', raw: { configuration: { templateId: 't1', notifierId: 'n1' } } },
  ]
  return reactive({ model, methods, disabled: false, reveal: false })
}

test('notification enable and disable retain draft selections without eager requests', () => {
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
    assert.equal(requests, 0)
    notification.setPanel('channels', true)
    notification.setPanel('recipients', false)
    assert.equal(notification.activePanel.value, 'channels', 'late close of previous panel is ignored')
    assert.equal(requests, 1)
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

test('notification channel changes preserve message content and alarm recovery on save and readback', () => {
  const props = notificationProps()
  const { state: notification, unmount } = mountState(() => useAlarmNotification(props, () => {}, () => {}))
  try {
    props.model.notification.enabled = true
    notification.channelIds.value = ['email-1']
    assert.deepEqual(props.model.notification.channelProviders, ['email'])
    assert.deepEqual(props.model.notification.parameters, { template: 'Existing content', email: { templateId: 't1', notifierId: 'n1' } })
    const row = toDeviceAlarmRow(buildPreprocessPayload(props.model), 'device', 'Device')!
    assert.equal(row.autoRelieve, true)
    assert.equal(row.relieveCondition?.trigger, 'lte')
    assert.equal(row.relieveCondition?.value, 75)
    assert.deepEqual(row.notification.notifyChannelIds, ['email-1'])
    assert.deepEqual(row.notification.userIds, ['u1'])
    assert.deepEqual(row.notification.parameters, props.model.notification.parameters)
  } finally { unmount() }
})

test('unavailable selected channels retain their IDs and parameters until explicitly deselected', () => {
  const props = notificationProps()
  props.model.notification.notifyChannelIds = ['gone']
  props.model.notification.channelProviders = ['old-provider']
  props.model.notification.parameters['old-provider'] = { notifierId: 'old-notifier' }
  const { state: notification, unmount } = mountState(() => useAlarmNotification(props, () => {}, () => {}))
  try {
    assert.deepEqual(notification.channelIds.value, ['gone'])
    assert.ok(notification.channelOptions.value.some(option => option.value === 'gone'))
    notification.channelIds.value = ['gone', 'email-1']
    assert.deepEqual(props.model.notification.notifyChannelIds, ['gone', 'email-1'])
    assert.deepEqual(props.model.notification.parameters['old-provider'], { notifierId: 'old-notifier' })
    notification.channelIds.value = ['email-1']
    assert.deepEqual(props.model.notification.channelProviders, ['email'])
    assert.equal('old-provider' in props.model.notification.parameters, false)
  } finally { unmount() }
})

test('controlled recipient popovers load lazily and ignore replies after switching panels', async () => {
  const props = reactive({ value: ['u1'], scopeKey: 'device:d1:temperature', open: false })
  let requests = 0
  let release!: (value: unknown) => void
  setAlarmRequestHandler(() => { requests++; return new Promise(resolve => { release = resolve }) })
  const { state: directory, unmount } = mountState(() => useAlarmRecipients(props))
  try {
    assert.equal(requests, 0)
    assert.ok(directory.selectionLabel.value)
    props.open = true
    const pending = directory.config.value.loadSelectedOptions!(['u1'])
    props.open = false
    release({ result: { data: [{ id: 'u1', name: 'Old response' }] } })
    assert.deepEqual(await pending, [])
    assert.equal(directory.open.value, false)
    assert.equal(directory.firstSelectedLabel.value, undefined)
    props.open = true
    const latest = directory.config.value.loadSelectedOptions!(['u1'])
    release({ result: { data: [{ id: 'u1', name: 'Selected user' }] } })
    await latest
    assert.equal(directory.selectionLabel.value, 'Selected user')
    assert.equal(requests, 2)
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
    assert.equal(view.editor.custom.value, false)
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

test('recipient directory is lazy, pages independently from selected hydration and searches remotely', async () => {
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
    assert.equal(calls.length, 0)
    directory.setOpen(true)
    await directory.config.value.loadSelectedOptions!(props.value)
    assert.deepEqual(directory.selected.value.map(user => user.label), ['Saved user', 'unavailable'])
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
  const { state: directory, unmount } = mountState(() => useAlarmRecipients(props))
  try {
    directory.setOpen(true)
    setAlarmRequestHandler(async () => { throw new Error('offline') })
    await assert.rejects(directory.config.value.loadOptions!('', { pageIndex: 0 }))
    assert.equal(directory.candidateFailed.value, true)
    await assert.rejects(directory.config.value.loadSelectedOptions!(props.value))
    assert.equal(directory.selectedFailed.value, true)
    directory.retry()
    let release!: (value: unknown) => void
    setAlarmRequestHandler(() => new Promise(resolve => { release = resolve }))
    const pending = directory.config.value.loadOptions!('', { pageIndex: 0 })
    directory.setOpen(false)
    release({ result: { data: [{ id: 'old', name: 'Old' }], total: 1 } })
    assert.deepEqual(await pending, [])
    assert.equal(directory.options.value.length, 0)
    directory.setOpen(true)
    const previous = directory.config.value.loadSelectedOptions!(props.value)
    props.scopeKey = 'p2:cpu'
    await nextTick()
    release({ result: { data: [{ id: 'saved', name: 'Wrong scope' }], total: 1 } })
    assert.deepEqual(await previous, [])
    assert.equal(directory.open.value, false)
    assert.equal(directory.selected.value[0].label, 'saved')
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
    return { result: { data: [], total: 0 } }
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
      ? new Promise(resolve => { release = resolve }) : Promise.resolve({ result: { data: [], total: 0 } }))
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
    setAlarmRequestHandler(async () => ({ result: { data: [], total: 0 } }))
    await resources.load()
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
    editor.setValues(['0', '12.5'])
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
    panel.configuredOnly.value = true
    await settle()
    assert.deepEqual(panel.rows.value.map(row => row.id), ['p34'])
    panel.keyword.value = 'missing'
    await settle()
    assert.equal(panel.groups.value.length, 0)
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
  const props = reactive<RuleEditorProps>({ open: true, inline: true, scope: { productId: 'p1', deviceId: 'd1' }, property: { id: 'temperature' }, snapshot: { hasOverride: false } })
  const { state: editor, unmount } = mountState(() => usePropertyRuleEditor(props, () => {}, () => {}))
  try {
    await settle()
    assert.equal(editor.editable.value, false)
    editor.customize()
    assert.equal(editor.editable.value, true)
    editor.draft.value!.samplingEnabled = true
    editor.discard()
    assert.equal(editor.custom.value, false)
    assert.equal(editor.dirty.value, false)
  } finally { unmount(); Reflect.deleteProperty(globalThis, 'window') }
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
