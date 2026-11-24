import { useAlarmRecipients } from '../views/device/alarm/hooks/useAlarmRecipients'
import { createAlarmRecipientCache } from '../views/device/alarm/hooks/alarmRecipientCache'
import { useAlarmNotificationBlocks } from '../views/device/alarm/hooks/useAlarmNotificationBlocks'
import { useAlarmDimensionOptions } from '../views/device/alarm/hooks/useAlarmDimensionOptions'
import { useAlarmNotificationGroups } from '../views/device/alarm/hooks/useAlarmNotificationGroups'
import { alarmRecipientKinds, queryAlarmRecipientDimensions } from '../views/device/alarm/notificationTargets'
import { notificationRecipientGroups, notificationIsConfigured, notificationUserIds, removeNotificationRecipient } from '../views/device/alarm/notificationRecipients'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRenderer, defineComponent, nextTick, reactive, ref } from 'vue'
import { componentsRegistry } from '@jetlinks-web-core/utils/components-registry'
import { createI18n } from 'vue-i18n'
import { useDeviceAlarmEditor } from '../views/device/alarm/components/editor/useDeviceAlarmEditor'
import { setAlarmRequestHandler } from './alarmRequest.test-shim'
import { queryRuleRecords, queryRecordHistory, queryActiveRuleCounts } from '../views/device/alarm/workspaceApi'
import { useDeviceAlarmDetail } from '../views/device/list/components/device-detail/useDeviceAlarmDetail'
import type { IotDevice } from '../views/device/list/types'
import { useDeviceAlarmRecords } from '../views/device/alarm/hooks/useDeviceAlarmRecords'
import { handleDeviceAlarm } from '../views/device/alarm/workspaceApi'
import { alarmDeviceId, alarmDuration, canHandleRecord } from '../views/device/alarm/workspaceUtils'
import { useDeviceAlarmHistory } from '../views/device/alarm/hooks/useDeviceAlarmHistory'
import {
  buildPreprocessPayload,
  clearNotificationMessageTemplate,
  createEmptyNotification,
  getNotificationMessageMode,
  isDeviceAlarmPreprocess,
  matchesAlarmNotifyMethod,
  hasFixedNotification, hasNotificationRecipients,
  selectAlarmNotificationTypes,
  toDeviceAlarmRow,
} from '../views/device/alarm/utils'
import type { DeviceAlarmFormModel, DeviceAlarmNotifyMethod } from '../views/device/alarm/types'
import { useDeviceAlarmRuleSearch } from '../views/device/alarm/hooks/useDeviceAlarmRuleSearch'
import i18n from '@jetlinks-web-core/locales'
import { localizeDeviceLibraryPreprocessors } from '../views/device/alarm/deviceLibraryI18n'
import { queryDeviceAlarmNotifyMethods, toNotifyMethods } from '../views/device/alarm/api'
import { aggregateTemplateState, hasTemplateBinding, verifiedTemplateState } from '../views/device/alarm/notificationTemplateStatus'
import { useAlarmNotification } from '../views/device/alarm/hooks/useAlarmNotification'
import { useDeviceAlarmPage } from '../views/device/alarm/hooks/useDeviceAlarmPage'
import type { DeviceAlarmRow, DeviceAlarmTargetOption } from '../views/device/alarm/types'

const response = (id: string, total = 1) => ({ result: { data: [{ id, sourceName: id }], total } })
const flush = async () => { await nextTick(); await new Promise(resolve => setTimeout(resolve, 0)); await nextTick() }

test('alarm record resolves a device id from source first and device target as a compatibility fallback', () => {
  assert.equal(alarmDeviceId({ id: 'record-a', sourceType: 'device', sourceId: ' device-a ', targetType: 'device', targetId: 'device-b' }), 'device-a')
  assert.equal(alarmDeviceId({ id: 'record-b', targetType: 'device', targetId: ' device-b ' }), 'device-b')
  assert.equal(alarmDeviceId({ id: 'record-c', sourceType: 'product', sourceId: 'product-a', targetType: 'product', targetId: 'product-b' }), undefined)
  assert.equal(alarmDeviceId({ id: 'record-d', targetType: 'device', targetId: '   ' }), undefined)
})

test('rule keyword search groups three existing conditions and clears only the rule query', () => {
  let page = 3
  let requests = 0
  const search = useDeviceAlarmRuleSearch(() => { page = 0; requests += 1 })
  search.updateKeyword('  温度_50%\\探头  ')
  assert.deepEqual(search.terms.value, [])
  assert.equal(page, 3)
  search.submit()
  const value = '%温度\\_50\\%\\\\探头%'
  assert.deepEqual(search.terms.value, [{ terms: [
    { column: 'templateId', termType: 'product-info', value: [{ column: 'name', termType: 'like', value }] },
    { column: 'thingId', termType: 'dev-instance', type: 'or', value: [{ column: 'name', termType: 'like', value }] },
    { column: 'property', termType: 'like', type: 'or', value },
  ] }])
  assert.equal(page, 0)
  assert.equal(requests, 1)
  search.submit()
  assert.equal(requests, 1)
  search.updateKeyword('未提交的草稿')
  assert.equal(search.terms.value[0].terms[2].value, value)
  search.updateKeyword('')
  search.submit()
  assert.deepEqual(search.terms.value, [])
  assert.equal(requests, 2)
  search.updateKeyword('   ')
  search.submit()
  assert.equal(requests, 2)
})

test('read-only notification names use the same type identity as the editor and resolve legacy channel IDs', () => {
  const notification = { ...createEmptyNotification(), channelProviders: ['email'], parameters: {
    email: { notifierId: 'account-a', templateId: 'template-a' },
  } }
  const method: DeviceAlarmNotifyMethod = { id: 'email', providerId: 'email', channelIds: ['channel-a'],
    key: 'email', label: 'Email', desc: '', icon: '' }
  assert.equal(matchesAlarmNotifyMethod(notification, method), true)
  assert.equal(matchesAlarmNotifyMethod({ ...notification, channelProviders: ['sms'] }, method), false)
  assert.equal(matchesAlarmNotifyMethod({ ...notification, channelProviders: [], notifyChannelIds: ['channel-a'] }, method), true)
})

test('notification content remains visible only for a legacy custom edit session', () => {
  const defaultNotification = createEmptyNotification()
  assert.equal(getNotificationMessageMode(defaultNotification) === 'custom', false)

  const customNotification = {
    ...createEmptyNotification(),
    parameters: { template: { message: '${targetName}触发告警' } },
  }
  const showLegacyMessageTemplate = getNotificationMessageMode(customNotification) === 'custom'
  assert.equal(showLegacyMessageTemplate, true)

  clearNotificationMessageTemplate(customNotification)
  assert.equal(getNotificationMessageMode(customNotification), 'default')
  assert.equal(showLegacyMessageTemplate, true)
})

test('notification options require accessible enabled trigger templates and keep event-specific status', () => {
  const types = [{ id: 'inside-mail', name: 'Inbox' }, { id: 'notifier-email', name: 'Email', receiverPolicy: 'subscriber' },
    { id: 'notifier-sms', name: 'SMS' }, { id: 'notifier-webhook', receiverPolicy: 'explicit' }]
  const channel = (id: string, type: string, config = { templateId: 'template', notifierId: 'sender' }) => ({
    id, name: 'Private channel name', channelProvider: type, state: { value: 'enabled' }, channelConfiguration: config,
  })
  const methods = toNotifyMethods(types, [
    { provider: 'alarm-device', state: 'enabled', channels: [channel('email-a', 'notifier-email'), channel('email-b', 'notifier-email')] },
    { provider: 'alarm-device-relieve', channels: [channel('recovery-email', 'notifier-email', { templateId: '', notifierId: '' })] },
    { provider: 'alarm-device-relieve', state: 'disabled', channels: [channel('disabled-email', 'notifier-email')] },
    { provider: 'alarm-other', channels: [channel('other-sms', 'notifier-sms')] },
  ])
  assert.deepEqual(methods.map(method => method.id), ['inside-mail', 'notifier-email'])
  const email = methods[1]
  assert.equal(email.label, 'Email')
  assert.equal('channelId' in email, false)
  assert.deepEqual(email.channelIds, ['email-a', 'email-b'])
  assert.deepEqual(email.templates, { trigger: 'unknown', relieve: 'missing' })
  assert.deepEqual(methods[0].templates, { trigger: 'unneeded', relieve: 'unneeded' })
  assert.deepEqual(toNotifyMethods(types), [])
  assert.deepEqual(toNotifyMethods(types, []), [])
  assert.deepEqual(toNotifyMethods(types, [{ provider: 'alarm-device', state: 'disabled', channels: [channel('e', 'notifier-email')] }]), [])
  assert.deepEqual(toNotifyMethods(types, [{ provider: 'alarm-device-relieve', channels: [channel('e', 'notifier-email')] }]), [])
  assert.deepEqual(toNotifyMethods(types, [{ provider: 'alarm-device', channels: [] }]).map(method => method.id), ['inside-mail'])
  assert.deepEqual(toNotifyMethods(types, [{ provider: 'alarm-device', channels: [
    { ...channel('e', 'notifier-email'), state: 'disabled' },
    channel('s', 'notifier-sms', { templateId: '', notifierId: 'sender' }),
  ] }]).map(method => method.id), ['inside-mail'])
  assert.equal(matchesAlarmNotifyMethod({ ...createEmptyNotification(), notifyChannelIds: ['email-b'] }, email), true)
})

test('WebHook selection needs no users and retains fixed delivery through save and readback', async () => {
  const channel = { id: 'webhook-a', name: 'WebHook', channelProvider: 'notifier-webhook', state: 'enabled',
    channelConfiguration: { templateId: 'webhook-template', notifierId: 'webhook-config' } }
  for (const receiverPolicy of ['explicit', { value: 'explicit', text: 'Fixed receiver' }]) {
    const requests: string[] = []
    setAlarmRequestHandler(async url => {
      requests.push(url)
      if (url === '/notify/channel/providers') return { result: [{ id: 'notifier-webhook', name: 'WebHook', receiverPolicy }] }
      if (url === '/notify/channel/all') return { result: [{ id: 'trigger-webhook', provider: 'alarm-device', state: 'enabled', channels: [channel] }] }
      if (url === '/notify/channel/trigger-webhook/_query-with-templates') return { result: {
        provider: { state: 'enabled' }, channels: [{ channel, template: { id: 'webhook-template', configId: 'webhook-config' } }],
      } }
      throw new Error(`Unexpected request ${url}`)
    })
    const methods = await queryDeviceAlarmNotifyMethods()
    assert.equal(methods.length, 1)
    assert.equal(methods[0].key, 'webhook')
    assert.equal(methods[0].label, 'WebHook')
    assert.deepEqual(methods[0].templates, { trigger: 'ready', relieve: 'missing' })
    assert.equal(requests.length, 3, 'fixed-receiver channels also verify the bound template')
    const selected = selectAlarmNotificationTypes({ ...createEmptyNotification(), enabled: true, userIds: ['user-a'] }, [methods[0].id], methods)
    assert.deepEqual(selected.channelProviders, [])
    assert.deepEqual(selected.userIds, [])
    assert.deepEqual(selected.notifyChannelIds, [])
    assert.deepEqual(selected.fixedReceiverChannels, [{ channelId: 'webhook-a', templateId: 'webhook-template' }])
    assert.equal(hasNotificationRecipients(selected), true)
    assert.equal(matchesAlarmNotifyMethod(selected, methods[0]), true)
    const payload = buildPreprocessPayload({ ...editorProps().model, name: 'Temperature alarm', targetId: 'product-a',
      property: 'temperature', limit: { lower: 10, upper: 20 }, notification: selected })
    const saved = toDeviceAlarmRow({ id: 'alarm-a', templateId: 'product-a', thingId: '@all', property: 'temperature',
      provider: payload.provider, configuration: payload.configuration }, 'product', 'Product A')
    assert.deepEqual(saved?.notification.channelProviders, [])
    assert.deepEqual(saved?.notification.userIds, [])
    assert.deepEqual(saved?.notification.fixedReceiverChannels, selected.fixedReceiverChannels)
    assert.equal(saved?.notificationConfigured, true)
    assert.equal(saved?.notificationEnabled, true)
    assert.equal(useDeviceAlarmEditor({ ...editorProps(), model: saved! }, key => key).panelStates.value.notification, 'complete')
    const types = [{ id: 'notifier-webhook', receiverPolicy }]
    for (const unavailable of [
      { ...channel, state: 'disabled' },
      { ...channel, channelConfiguration: { templateId: '', notifierId: 'webhook-config' } },
      { ...channel, channelConfiguration: { templateId: 'webhook-template', notifierId: '' } },
    ]) {
      assert.deepEqual(toNotifyMethods(types, [{ provider: 'alarm-device', channels: [unavailable] }]), [])
    }
    assert.deepEqual(toNotifyMethods(types, [{ provider: 'alarm-device', state: 'disabled', channels: [channel] }]), [])
  }
})

test('WebHooks and robots share fixed recipients while mixed personnel channels still require users', () => {
  const channel = (id: string, type: string, notifierId: string, channelKey = id) => ({ id, name: id, channelKey,
    channelProvider: type, channelConfiguration: { notifierId, templateId: `${id}-template` } })
  const trigger = [channel('hook-a', 'notifier-webhook', 'hook-config', 'a'), channel('hook-b', 'notifier-webhook', 'hook-config', 'b'),
    channel('robot', 'notifier-dingTalk', 'robot-config'), channel('email', 'notifier-email', 'email-config')]
  const recovery = [channel('hook-b-relieve', 'notifier-webhook', 'hook-config', 'b'), channel('hook-a-relieve', 'notifier-webhook', 'hook-config', 'a')]
  const providers = [{ id: 'trigger', provider: 'alarm-device', channels: trigger }, { id: 'relieve', provider: 'alarm-device-relieve', channels: recovery }]
  const detail = (channels: ReturnType<typeof channel>[]) => ({ channels: channels.map(channel => ({ channel,
    template: { id: channel.channelConfiguration.templateId, configId: channel.channelConfiguration.notifierId } })) })
  const methods = toNotifyMethods([{ id: 'notifier-webhook' }, { id: 'notifier-dingTalk' }, { id: 'notifier-email' }], providers,
    new Map([['trigger', detail(trigger)], ['relieve', detail(recovery)]]),
    new Map([['robot-config', { type: 'dingTalk', provider: 'dingTalkRobotWebHook' }]]))
  assert.deepEqual(methods.map(method => method.id), ['notifier-email', 'hook-a', 'hook-b', 'robot'])
  assert.equal(methods[1].fixedReceiver?.relieveTemplateId, 'hook-a-relieve-template')
  assert.equal(methods[2].fixedReceiver?.relieveTemplateId, 'hook-b-relieve-template')
  assert.deepEqual(methods[1].templates, { trigger: 'ready', relieve: 'ready' })
  const model = reactive({ ...editorProps().model, id: 'saved', property: 'temperature', trigger: 'gt' as const, value: 50,
    autoRelieve: true, notification: selectAlarmNotificationTypes({ ...createEmptyNotification(), enabled: true, includeRelieve: true }, ['hook-a', 'hook-b', 'robot'], methods) })
  const editor = useDeviceAlarmEditor({ ...editorProps(), model }, key => key)
  const { state, unmount } = mount(() => useAlarmNotification({ model, methods }, () => {}, () => {}))
  try {
    assert.equal(state.requiresRecipients.value, false)
    assert.equal(editor.panelStates.value.notification, 'complete')
    state.setPanel('recipients', true)
    assert.equal(state.activePanel.value, undefined)
    const payload = buildPreprocessPayload(model)
    const [alarm, relieve] = payload.configuration.processors
    for (const branch of [alarm, relieve]) {
      const notify = branch.configuration.processors.find((item: { provider: string }) => item.provider === 'notify')
      assert.deepEqual(notify.configuration.userIds, [])
      assert.deepEqual(notify.configuration.channelProviders, [])
      assert.equal(notify.configuration.fixedReceiverChannels.length, 3)
      assert.equal(notify.configuration.fixedReceiverChannels[0].relieveTemplateId, 'hook-a-relieve-template')
    }
    state.channelIds.value = ['hook-a', 'notifier-email']
    assert.equal(state.requiresRecipients.value, true)
    assert.equal(hasNotificationRecipients(model.notification), false)
    assert.equal(editor.panelStates.value.notification, 'pending')
    model.notification.userIds = ['user-a']
    assert.equal(editor.panelStates.value.notification, 'complete')
    state.setPanel('recipients', true)
    assert.equal(state.activePanel.value, 'recipients')
    state.channelIds.value = ['hook-a']
    assert.equal(state.requiresRecipients.value, false)
    assert.equal(state.activePanel.value, undefined)
    assert.deepEqual(model.notification.userIds, [])
    assert.equal(editor.panelStates.value.notification, 'complete')
    state.channelIds.value = []
    assert.equal(editor.panelStates.value.notification, 'pending')
  } finally { unmount() }
})

test('explicit type selection drops channel bindings but preserves recipients and custom message formats', () => {
  const original = { ...createEmptyNotification(), includeRelieve: true, relieveTopicProvider: 'alarm-device' as const,
    userIds: ['u1'], notifyChannelIds: ['private-channel'], channelProviders: ['notifier-email'], parameters: {
      'notifier-email': { templateId: 'old-template', notifierId: 'old-notifier' },
      template: { message: '${targetName} ${eventText}' }, variableDefinitions: [{ id: 'alarmTime', format: 'yyyy' }],
    } }
  const before = JSON.stringify(original)
  const selected = selectAlarmNotificationTypes(original, ['notifier-email', 'notifier-sms', 'notifier-email'])
  assert.equal(JSON.stringify(original), before)
  assert.deepEqual(selected.channelProviders, ['notifier-email', 'notifier-sms'])
  assert.deepEqual(selected.notifyChannelIds, [])
  assert.deepEqual(selected.userIds, ['u1'])
  assert.equal(selected.relieveTopicProvider, 'alarm-device-relieve')
  assert.deepEqual(selected.parameters, { template: original.parameters.template, variableDefinitions: original.parameters.variableDefinitions })
})

test('template lookup failures reject instead of exposing unconfigured notification types', async () => {
  const calls: string[] = []
  setAlarmRequestHandler(async url => {
    calls.push(url)
    return url === '/notify/channel/providers'
      ? { result: [{ id: 'notifier-email', name: 'Email' }] } : { success: false, status: 403, result: [] }
  })
  await assert.rejects(queryDeviceAlarmNotifyMethods())
  assert.deepEqual(calls.sort(), ['/notify/channel/all', '/notify/channel/providers'])
  setAlarmRequestHandler(async () => ({ success: false, status: 403, result: [] }))
  await assert.rejects(queryDeviceAlarmNotifyMethods())
})

test('notification readiness verifies actual templates and keeps missing, unknown and template-free states distinct', async () => {
  const channel = { id: 'email-a', channelProvider: 'notifier-email', state: 'enabled',
    channelConfiguration: { templateId: 'template-a', notifierId: 'sender-a' } }
  const detail = { provider: { id: 'trigger-a', state: 'enabled' },
    channels: [{ channel, template: { id: 'template-a', configId: 'sender-a' } }] }
  assert.equal(hasTemplateBinding({ channelConfiguration: { templateId: '  ', notifierId: 'sender' } }), false)
  assert.equal(verifiedTemplateState(undefined, channel), 'unknown')
  assert.equal(verifiedTemplateState({ channels: [] }, channel), 'missing')
  assert.equal(verifiedTemplateState(detail, channel), 'ready')
  for (const template of [null, { id: 'other', configId: 'sender-a' }, { id: 'template-a', configId: 'other' }]) {
    assert.equal(verifiedTemplateState({ ...detail, channels: [{ channel, template }] }, channel), 'missing')
  }
  assert.equal(verifiedTemplateState({ ...detail, provider: { state: 'disabled' } }, channel), 'missing')
  assert.equal(verifiedTemplateState({ channels: [{ channel: { ...channel, state: { value: 'disabled' } }, template: detail.channels[0].template }] }, channel), 'missing')
  assert.equal(aggregateTemplateState(['unneeded']), 'unneeded')
  assert.equal(aggregateTemplateState(['ready', 'unneeded']), 'ready')
  assert.equal(aggregateTemplateState(['ready', 'unknown']), 'unknown')
  assert.equal(aggregateTemplateState(['unknown', 'missing']), 'missing')
  assert.equal(aggregateTemplateState([]), 'unknown')
  let templateResponse: unknown = { result: detail }
  const requests: string[] = []
  setAlarmRequestHandler(async url => {
    requests.push(url)
    if (url === '/notify/channel/providers') return { result: [{ id: 'inside-mail' }, { id: 'notifier-email' }] }
    if (url === '/notify/channel/all') return { result: [{ id: 'trigger-a', provider: 'alarm-device', state: 'enabled', channels: [channel] }] }
    if (url === '/notify/channel/trigger-a/_query-with-templates') return templateResponse
    throw new Error(`Unexpected request ${url}`)
  })
  assert.equal((await queryDeviceAlarmNotifyMethods())[1].templates?.trigger, 'ready')
  assert.equal(requests.length, 3, 'one bounded template query for the relevant enabled provider')
  templateResponse = { result: { channels: [{ channel, template: null }] } }
  const missing = await queryDeviceAlarmNotifyMethods()
  assert.equal(missing[1].templates?.trigger, 'missing')
  assert.deepEqual(missing.map(item => item.id), ['inside-mail', 'notifier-email'], 'status verification does not change picker eligibility')
  templateResponse = { success: false, status: 403, result: detail }
  assert.equal((await queryDeviceAlarmNotifyMethods())[1].templates?.trigger, 'unknown')
  templateResponse = { result: [] }
  assert.equal((await queryDeviceAlarmNotifyMethods())[1].templates?.trigger, 'unknown')
})

test('selected notification status preserves template-free delivery, recovery events and legacy trigger topics', () => {
  const model = reactive<DeviceAlarmFormModel>({ ...editorProps().model, id: 'saved', notification: { ...createEmptyNotification(), enabled: true, channelProviders: ['inside-mail'] } })
  const props = reactive({ model, methods: [
    { id: 'inside-mail', providerId: 'inside-mail', templates: { trigger: 'unneeded', relieve: 'unneeded' } },
    { id: 'email', providerId: 'email', templates: { trigger: 'ready', relieve: 'missing' } },
  ] as DeviceAlarmNotifyMethod[] })
  const { state, unmount } = mount(() => useAlarmNotification(props, () => {}, () => {}))
  try {
    assert.deepEqual(state.selectedTemplateStatus.value, { trigger: 'unneeded', relieve: 'unneeded' })
    model.notification.channelProviders = ['inside-mail', 'email']
    assert.deepEqual(state.selectedTemplateStatus.value, { trigger: 'ready', relieve: 'missing' })
    model.notification.relieveTopicProvider = 'alarm-device'
    assert.equal(state.selectedTemplateStatus.value.relieve, 'ready')
    model.notification.channelProviders = ['unavailable']
    assert.equal(state.selectedTemplateStatus.value.trigger, 'unknown')
  } finally { unmount() }
})

test('automatic relief uses complementary matchers and remains editable', () => {
  const form: DeviceAlarmFormModel = {
    name: '温度异常',
    source: 'product',
    targetId: 'product-a',
    productId: 'product-a',
    property: 'temperature',
    propertyName: '温度',
    level: 2,
    trigger: 'outside',
    limit: { lower: 10, upper: 20 },
    autoRelieve: true,
    notification: createEmptyNotification(),
  }

  const payload = buildPreprocessPayload(form)
  assert.equal(payload.provider, 'composite')
  const [alarmBranch, relieveBranch] = payload.configuration.processors
  assert.deepEqual(alarmBranch.configuration.matcher.configuration, { min: 10, max: 20, not: true })
  assert.deepEqual(relieveBranch.configuration.matcher.configuration, { min: 10, max: 20, not: false })
  assert.equal(relieveBranch.configuration.processors[0].provider, 'device-alarm-relieve')
  assert.deepEqual(relieveBranch.configuration.processors[0].configuration, {
    alarmName: '温度异常',
    alarmLevel: 2,
  })

  const row = toDeviceAlarmRow({
    id: 'alarm-a',
    templateId: 'product-a',
    thingId: '@all',
    property: 'temperature',
    provider: payload.provider,
    configuration: payload.configuration,
  }, 'product', '产品 A')
  assert.equal(row?.autoRelieve, true)
  assert.equal(row?.trigger, 'outside')
  assert.deepEqual(row?.limit, { lower: 10, upper: 20 })

  const simplePayload = buildPreprocessPayload({ ...form, autoRelieve: false })
  assert.equal(simplePayload.provider, 'simple')
  assert.equal('processors' in simplePayload.configuration, true)
  assert.equal(JSON.stringify(simplePayload).includes('device-alarm-relieve'), false)
  assert.equal(toDeviceAlarmRow({
    provider: simplePayload.provider,
    configuration: simplePayload.configuration,
  }, 'product', '产品 A')?.autoRelieve, false)

  const insidePayload = buildPreprocessPayload({ ...form, trigger: 'inside' })
  const [insideAlarm, insideRelieve] = insidePayload.configuration.processors
  assert.equal(insideAlarm.configuration.matcher.configuration.not, false)
  assert.equal(insideRelieve.configuration.matcher.configuration.not, true)
})

test('alarm editor ignores composite preprocessors outside its canonical shape', () => {
  const customComposite = {
    provider: 'composite',
    configuration: {
      processors: [{
        provider: 'simple',
        configuration: {
          matcher: { provider: 'number-range', configuration: { min: 10, max: 20, not: true } },
          processors: [{ provider: 'device-alarm', configuration: { alarmName: '温度异常', alarmLevel: 2 } }],
        },
      }, {
        provider: 'simple',
        configuration: {
          matcher: { provider: 'number-range', configuration: { min: 10, max: 20, not: false } },
          processors: [{ provider: 'device-alarm-relieve', configuration: { alarmName: '温度异常', alarmLevel: 2 } }],
        },
      }, {
        provider: 'scale',
        configuration: { scale: 0.1 },
      }],
    },
  }

  assert.equal(isDeviceAlarmPreprocess(customComposite), false)
  assert.equal(toDeviceAlarmRow(customComposite, 'product', '产品 A'), null)
})

test('device library localizes nested alarm processor without dropping relief branch', () => {
  i18n.global.locale.value = 'en-US'
  const [localized] = localizeDeviceLibraryPreprocessors([{
    id: 'alarm-a',
    name: '温度异常',
    property: 'temperature',
    provider: 'composite',
    i18nMessages: { name: { zh_CN: '温度异常', en_US: 'Temperature alarm' } },
    configuration: {
      processors: [{
        provider: 'simple',
        configuration: {
          processors: [{ provider: 'device-alarm', configuration: { alarmName: '温度异常' } }],
        },
      }, {
        provider: 'simple',
        configuration: {
          processors: [{
            provider: 'device-alarm-relieve',
            configuration: { alarmName: '温度异常', alarmLevel: 2 },
          }],
        },
      }],
    },
  } as any], {
    thingModel: { properties: [{ id: 'temperature', name: '温度', i18nMessages: { name: { en_US: 'Temperature' } } }] },
  })

  assert.equal(localized.name, 'Temperature alarm')
  assert.equal(localized.propertyName, 'Temperature')
  const [alarmBranch, relieveBranch] = (localized.configuration as any).processors
  assert.equal(alarmBranch.configuration.processors[0].configuration.alarmName, 'Temperature alarm')
  assert.equal(relieveBranch.configuration.processors[0].provider, 'device-alarm-relieve')
  assert.equal(relieveBranch.configuration.processors[0].configuration.alarmName, 'Temperature alarm')
  assert.equal(relieveBranch.configuration.processors[0].configuration.alarmLevel, 2)
  i18n.global.locale.value = 'zh'
})

test('rule query preserves stable identity and caller filters; global history remains reachable', async () => {
  const calls: { url: string; body: Record<string, unknown> }[] = []
  setAlarmRequestHandler(async (url, body) => { calls.push({ url, body }); return response('record', 27) })
  const result = await queryRuleRecords('product-property-id', { pageIndex: 2, pageSize: 10,
    terms: [{ column: 'targetName', termType: 'like', value: '%device%' }] })
  assert.equal(result.total, 27)
  assert.equal(calls[0].url, '/alarm/record/device/_query')
  assert.deepEqual(calls[0].body.terms, [
    { column: 'alarmConfigId', termType: 'eq', value: 'product-property-id' },
    { column: 'alarmConfigSource', termType: 'eq', value: 'device-property-preprocessor' },
    { terms: [{ column: 'targetName', termType: 'like', value: '%device%' }] },
  ])
  await queryRuleRecords(undefined, { pageIndex: 0, pageSize: 10 })
  assert.equal(JSON.stringify(calls[1].body).includes('alarmConfigId'), false)
})

test('history uses permission-checked record endpoints with real pagination', async () => {
  const urls: string[] = []
  setAlarmRequestHandler(async (url, body) => { urls.push(url); assert.equal(body.pageIndex, 4); return response('history', 52) })
  assert.equal((await queryRecordHistory('record/a', 'logs', { pageIndex: 4, pageSize: 10 })).total, 52)
  await queryRecordHistory('record/a', 'handles', { pageIndex: 4, pageSize: 10 })
  assert.deepEqual(urls, ['/alarm/history/alarm-record/record%2Fa/_query', '/alarm/record/record%2Fa/handle-history/_query'])
})

test('counts are aggregated for the requested page only; invalid counts cannot appear as zero', async () => {
  setAlarmRequestHandler(async (_url, body) => {
    assert.deepEqual(body.groupBy, [{ column: 'alarmConfigId', alias: 'alarmConfigId' }])
    assert.equal(body.limit, 2)
    assert.ok(JSON.stringify(body).includes('rule-a'))
    return { result: [{ alarmConfigId: 'rule-a', count: '3' }] }
  })
  assert.deepEqual(await queryActiveRuleCounts(['rule-a', 'rule-b']), { 'rule-a': 3, 'rule-b': 0 })
  setAlarmRequestHandler(async () => ({ result: [{ alarmConfigId: 'rule-a' }] }))
  await assert.rejects(queryActiveRuleCounts(['rule-a']))
  setAlarmRequestHandler(async () => ({ status: 403 }))
  await assert.rejects(queryActiveRuleCounts(['rule-a']))
  await assert.rejects(queryRuleRecords('rule', { pageIndex: 0, pageSize: 10 }))
})

function mount<T>(setup: () => T) {
  const renderer = createRenderer({ patchProp() {}, insert() {}, remove() {}, createElement: () => ({}),
    createText: () => ({}), createComment: () => ({}), setText() {}, setElementText() {}, parentNode: () => null, nextSibling: () => null })
  let state!: T
  const app = renderer.createApp(defineComponent({ setup() { state = setup(); return () => null } }))
  app.use(createI18n({ legacy: false, locale: 'en', messages: { en: {} }, missingWarn: false, fallbackWarn: false }))
  app.mount({})
  return { state, unmount: () => app.unmount() }
}

const alarmProperty = (id: string) => ({ id, name: id, valueType: { type: 'double', unit: '%' } })
const alarmTarget = (id: string, source: 'product' | 'device' = 'device') => {
  const data: DeviceAlarmTargetOption = { label: id, value: id, source, productId: 'product-a',
    ...(source === 'device' ? { deviceId: id } : {}), metadata: { properties: [alarmProperty('product-property')] } }
  return { label: id, value: id, data }
}

test('single-device alarms load effective detail metadata, clear old selections and return to product scope', async () => {
  const requests: string[] = []
  setAlarmRequestHandler(async url => {
    requests.push(url)
    if (url === '/device-instance/device-a/detail') return { result: { metadata: JSON.stringify({ properties: [alarmProperty('device-only')] }) } }
    if (url === '/device-instance/device-inherited/detail') return { result: { independentMetadata: false,
      metadata: { properties: [alarmProperty('inherited-property')] } } }
    if (url.includes('/property/_list') || url === '/protocol/units') return { result: [] }
    throw new Error(`Unexpected request: ${url}`)
  })
  const { state, unmount } = mount(() => useDeviceAlarmPage(key => key))
  try {
    await state.onProductChange(alarmTarget('product-a', 'product'))
    state.onPropertyChange('product-property')
    const selecting = state.onDeviceChange('device-a', alarmTarget('device-a'))
    assert.equal(state.form.value.property, '')
    assert.equal(state.form.value.propertyName, '')
    assert.equal(state.form.value.propertyUnit, '')
    assert.deepEqual(state.propertyOptions.value, [])
    await selecting
    assert.deepEqual(state.propertyOptions.value.map(item => item.id), ['device-only'])
    state.onPropertyChange('device-only')
    await state.onDeviceChange('device-inherited', alarmTarget('device-inherited'))
    assert.deepEqual(state.propertyOptions.value.map(item => item.id), ['inherited-property'])
    await state.onDeviceChange('__all__')
    assert.equal(state.form.value.source, 'product')
    assert.equal(state.form.value.property, '')
    assert.deepEqual(state.propertyOptions.value.map(item => item.id), ['product-property'])
    assert.equal(requests.some(url => url.startsWith('/device-product/')), false)
  } finally { unmount() }
})

test('editing a device alarm reloads its effective model without losing the selected property', async () => {
  setAlarmRequestHandler(async url => url === '/device-instance/device-a/detail'
    ? { result: { metadata: { properties: [alarmProperty('device-only')] } } }
    : { result: [] })
  const { state, unmount } = mount(() => useDeviceAlarmPage(key => key))
  try {
    const row: DeviceAlarmRow = { ...state.form.value, key: 'alarm-a', id: 'alarm-a', name: 'Device alarm', source: 'device',
      targetId: 'device-a', deviceId: 'device-a', productId: 'product-a', property: 'device-only' }
    await state.openEdit(row)
    assert.equal(state.editorOpen.value, true)
    assert.equal(state.form.value.property, 'device-only')
    assert.deepEqual(state.propertyOptions.value.map(item => item.id), ['device-only'])
  } finally { unmount() }
})

test('late device metadata and configured-rule responses cannot replace the current device properties', async () => {
  const pending = new Map<string, (value: unknown) => void>()
  setAlarmRequestHandler(async url => url === '/protocol/units' ? { result: [] }
    : new Promise(resolve => { pending.set(url, resolve) }))
  const { state, unmount } = mount(() => useDeviceAlarmPage(key => key))
  try {
    const first = state.onDeviceChange('device-a', alarmTarget('device-a'))
    pending.get('/device-instance/device-a/detail')!({ result: { metadata: { properties: [alarmProperty('old-a')] } } })
    await flush()
    const second = state.onDeviceChange('device-b', alarmTarget('device-b'))
    const third = state.onDeviceChange('device-c', alarmTarget('device-c'))
    pending.get('/device-instance/device-c/detail')!({ result: { metadata: { properties: [alarmProperty('current-c')] } } })
    await flush()
    pending.get('/message/preprocessor/product/product-a/device-c/property/_list')!({ result: [] })
    await third
    pending.get('/device-instance/device-b/detail')!({ result: { metadata: { properties: [alarmProperty('old-b')] } } })
    await second
    pending.get('/message/preprocessor/product/product-a/device-a/property/_list')!({ result: [] })
    await first
    assert.deepEqual(state.propertyOptions.value.map(item => item.id), ['current-c'])
    assert.equal(pending.has('/message/preprocessor/product/product-a/device-b/property/_list'), false)
  } finally { unmount() }
})

test('a failed or empty device model never falls back to stale product properties', async () => {
  setAlarmRequestHandler(async url => {
    if (url === '/device-instance/device-a/detail') throw new Error('Device unavailable')
    return { result: [] }
  })
  const { state, unmount } = mount(() => useDeviceAlarmPage(key => key))
  try {
    await state.onProductChange(alarmTarget('product-a', 'product'))
    await assert.rejects(state.onDeviceChange('device-a', alarmTarget('device-a')), /Device unavailable/)
    assert.deepEqual(state.propertyOptions.value, [])
    setAlarmRequestHandler(async url => url === '/device-instance/device-a/detail'
      ? { result: { metadata: { properties: [] } } } : { result: [] })
    await state.onDeviceChange('device-a', alarmTarget('device-a'))
    assert.deepEqual(state.propertyOptions.value, [])
  } finally { unmount() }
})

test('clearing a product invalidates a pending device metadata request', async () => {
  let complete!: (value: unknown) => void
  setAlarmRequestHandler(async url => url === '/protocol/units' ? { result: [] }
    : new Promise(resolve => { complete = resolve }))
  const { state, unmount } = mount(() => useDeviceAlarmPage(key => key))
  try {
    const selecting = state.onDeviceChange('device-a', alarmTarget('device-a'))
    await state.onProductChange()
    complete({ result: { metadata: { properties: [alarmProperty('old-device')] } } })
    await selecting
    assert.deepEqual(state.propertyOptions.value, [])
    assert.equal(state.form.value.targetId, '')
  } finally { unmount() }
})

test('record queries default to all; scope switches preserve search and discard late responses', async () => {
  const pending: { body: Record<string, unknown>; resolve: (value: unknown) => void }[] = []
  setAlarmRequestHandler((_url, body) => new Promise(resolve => pending.push({ body, resolve })))
  const rule = ref<string>()
  const { state, unmount } = mount(() => useDeviceAlarmRecords(rule, key => key))
  const staleRequest = state.table.value.request({ pageIndex: 0, pageSize: 10 })
  assert.ok(!JSON.stringify(pending[0].body).includes('alarmConfigId'))
  rule.value = 'rule-a'
  await flush()
  const scopedRequest = state.table.value.request({ pageIndex: 0, pageSize: 10 })
  pending[1].resolve(response('new-record'))
  assert.equal((await scopedRequest).result?.data[0].id, 'new-record')
  pending[0].resolve(response('stale-record'))
  assert.equal((await staleRequest).success, false)
  state.search({ terms: [], where: '', filter: { terms: [{ column: 'sourceName', termType: 'like', value: '%device%', type: 'and' }] } })
  await flush()
  const filteredRequest = state.table.value.request({ pageIndex: 0, pageSize: 10 })
  assert.ok(JSON.stringify(pending.at(-1)!.body).includes('sourceName'))
  assert.ok(JSON.stringify(pending.at(-1)!.body).includes('"value":"%device%"'))
  rule.value = undefined
  await flush()
  const allRequest = state.table.value.request({ pageIndex: 0, pageSize: 10 })
  const last = pending.at(-1)!
  assert.ok(!JSON.stringify(last.body).includes('alarmConfigId'))
  assert.ok(JSON.stringify(last.body).includes('sourceName'))
  last.resolve(response('all-filtered'))
  assert.equal((await allRequest).result?.data[0].id, 'all-filtered')
  pending.at(-2)!.resolve(response('stale-filtered'))
  assert.equal((await filteredRequest).success, false)
  unmount()
})

test('history opens on the chosen record, isolates tabs and invalidates closed modal requests', async () => {
  const pending: { url: string; resolve: (value: unknown) => void; reject: (error: Error) => void }[] = []
  setAlarmRequestHandler(url => new Promise((resolve, reject) => pending.push({ url, resolve, reject })))
  const { state, unmount } = mount(useDeviceAlarmHistory)
  assert.equal(pending.length, 0)
  state.show({ id: 'record-a' }, 'logs')
  state.show({ id: 'record-b', alarmName: '原始设备温度告警' }, 'handles')
  assert.ok(pending[1].url.includes('/record-b/handle-history/'))
  pending[1].resolve(response('handle-b'))
  await flush()
  pending[0].resolve(response('stale-log-a'))
  await flush()
  assert.equal(state.history.rows[0].id, 'handle-b')
  assert.equal(state.history.rows[0].alarmName, '原始设备温度告警')
  state.show({ id: 'record-c', alarmName: '父记录名称' }, 'handles')
  pending.at(-1)!.resolve({ result: { data: [{ id: 'handle-c', alarmName: '接口快照名称' }], total: 1 } })
  await flush()
  assert.equal(state.history.rows[0].alarmName, '接口快照名称')
  const failed = state.loadHistory()
  pending.at(-1)!.reject(new Error('Forbidden'))
  await failed
  assert.equal(state.history.error, true)
  assert.deepEqual(state.history.rows, [])
  state.changeTab('logs')
  state.close()
  pending.at(-1)!.resolve(response('closed-log'))
  await flush()
  assert.deepEqual(state.history.rows, [])
  unmount()
})

test('handling targets one record and its alarm cycle, validates description, and retains errors', async () => {
  const record = { id: 'device-a', alarmConfigId: 'rule-a', alarmTime: 1000, state: { value: 'warning', text: '告警中' } }
  let count = 0
  setAlarmRequestHandler(async (url, body) => {
    count++
    assert.equal(url, '/alarm/record/device/_handle')
    assert.deepEqual(body, { alarmRecordId: 'device-a', alarmConfigId: 'rule-a', alarmTime: 1000,
      describe: '已排查', type: 'user', state: 'normal' })
    return { status: 200 }
  })
  await handleDeviceAlarm(record, ' 已排查 ')
  await assert.rejects(handleDeviceAlarm(record, '   '))
  await assert.rejects(handleDeviceAlarm({ ...record, id: '' }, '已排查'))
  assert.equal(count, 1)
  setAlarmRequestHandler(async () => ({ status: 403 }))
  await assert.rejects(handleDeviceAlarm(record, '已排查'))
  assert.equal(canHandleRecord(record), true)
  assert.equal(canHandleRecord({ ...record, state: 'normal' }), false)
  assert.equal(alarmDuration(record, 61000), '1.0 min')
  assert.equal(alarmDuration({ ...record, state: 'normal' }, 61000), '—')
})


function editorProps() {
  const model: DeviceAlarmFormModel = {
    name: '', source: 'product', targetId: '', property: '', level: 4,
    trigger: 'outside', limit: {}, autoRelieve: false, notification: createEmptyNotification(),
  }
  return reactive({ open: true, saving: false, model,
    levelOptions: [{ label: 'General', value: 4 }, { label: 'Critical', value: 1 }],
    propertyOptions: [{ id: 'temperature', name: 'Temperature', valueType: { type: 'double' } }],
  })
}

test('editor preview follows completeness without losing zero, false, or pending recovery values', () => {
  const props = editorProps()
  const { state, unmount } = mount(() => useDeviceAlarmEditor(props, key => key))
  assert.equal(state.panelStates.value.target, 'pending')
  assert.equal(state.previewText.value, 'DeviceAlarm.editor.pending')
  props.model.targetId = 'product-a'
  props.model.property = 'temperature'
  props.model.trigger = 'eq'
  props.model.value = 0
  assert.equal(state.panelStates.value.target, 'complete')
  assert.equal(state.panelStates.value.trigger, 'complete')
  assert.match(state.previewText.value, /0/)
  props.model.autoRelieve = true
  props.model.relieveCondition = { trigger: 'gt', value: 0, limit: {} }
  assert.equal(state.panelStates.value.trigger, 'complete')
  props.model.relieveCondition.value = -1
  assert.equal(state.panelStates.value.trigger, 'pending')
  assert.equal(state.relievePreviewText.value, 'DeviceAlarm.editor.pending')
  props.model.autoRelieve = false
  props.model.property = 'boolean-property'
  props.model.value = false
  assert.match(state.previewText.value, /false/)
  props.model.trigger = 'outside'
  props.model.limit = { lower: 0 }
  assert.equal(state.previewText.value, 'DeviceAlarm.editor.pending')
  unmount()
})

test('editor notifications distinguish off from incomplete and accept persisted recipient dimensions', () => {
  const props = editorProps()
  const { state, unmount } = mount(() => useDeviceAlarmEditor(props, key => key))
  assert.equal(state.panelStates.value.notification, 'off')
  props.model.notification.enabled = true
  props.model.notification.channelProviders = ['email']
  assert.equal(state.panelStates.value.notification, 'pending')
  props.model.notification.dimensions = [{ id: 'tenant-a' }]
  assert.equal(state.panelStates.value.notification, 'complete')
  props.model.source = 'device'
  props.model.notification.parameters = { template: { message: '' } }
  assert.equal(state.panelStates.value.notification, 'pending')
  props.model.notification.enabled = false
  assert.equal(state.panelStates.value.notification, 'off')
  unmount()
})

test('hidden alarm panels disappear from navigation and preview without clearing saved notification settings', () => {
  const getRegistry = componentsRegistry.getRegistry
  componentsRegistry.getRegistry = code => code === 'device/alarm:alarm-editor'
    ? [{ targetPage: 'device/alarm', targetModule: 'alarm-editor', target: 'notification', mode: 'hide', code: 'hide-device-alarm-notification', key: 'notification' }]
    : []
  const props = editorProps()
  props.model.notification = { ...createEmptyNotification(), enabled: true, channelProviders: ['email'], userIds: ['user-a'] }
  const savedNotification = JSON.stringify(props.model.notification)
  const { state, unmount } = mount(() => useDeviceAlarmEditor(props, key => key))
  try {
    assert.deepEqual(state.panels.map(panel => panel.key), ['level', 'target', 'trigger'])
    assert.equal(state.summaryItems.value.some(item => item.panel === 'notification'), false)
    state.selectPanel('notification')
    assert.equal(state.activePanel.value, 'level')
    assert.equal(JSON.stringify(props.model.notification), savedNotification)
  } finally {
    unmount()
    componentsRegistry.getRegistry = getRegistry
  }
})

test('editor preview destinations preserve drafts, block navigation during save and reset on reopen', async () => {
  const props = editorProps()
  const { state, unmount } = mount(() => useDeviceAlarmEditor(props, key => key))
  assert.equal(state.activePanel.value, 'level')
  props.model.name = 'Unsaved alarm'
  props.model.level = 1
  for (const item of state.summaryItems.value) {
    state.selectPanel(item.panel)
    assert.equal(state.activePanel.value, item.panel)
  }
  assert.equal(state.summaryItems.value.find(item => item.key === 'property')?.panel, 'target')
  assert.equal(state.summaryItems.value.find(item => item.key === 'relieve')?.panel, 'trigger')
  props.saving = true
  state.selectPanel('level')
  assert.equal(state.activePanel.value, 'notification')
  props.saving = false
  props.open = false
  await nextTick()
  props.open = true
  await nextTick()
  assert.equal(state.activePanel.value, 'level')
  assert.equal(props.model.name, 'Unsaved alarm')
  assert.equal(props.model.level, 1)
  unmount()
})


test('device alarm records and rule counts always constrain the requested device', async () => {
  const calls: { url: string; body: Record<string, any> }[] = []
  setAlarmRequestHandler(async (url, body) => {
    calls.push({ url, body })
    return url.endsWith('_aggregation') ? { result: [{ alarmConfigId: 'inherited-rule', count: 1 }] } : response('device-record')
  })
  await queryRuleRecords(undefined, { pageIndex: 0, pageSize: 10, terms: [{ column: 'sourceId', termType: 'eq', value: 'other-device' }] }, 'device-a')
  assert.deepEqual(calls[0].body.terms.slice(0, 2), [
    { column: 'sourceId', termType: 'eq', value: 'device-a' },
    { column: 'targetType', termType: 'eq', value: 'device' },
  ])
  assert.deepEqual(calls[0].body.terms[2], { terms: [{ column: 'sourceId', termType: 'eq', value: 'other-device' }] })
  await queryRuleRecords('inherited-rule', { pageIndex: 1, pageSize: 10 }, 'device-a')
  assert.deepEqual(calls[1].body.terms[0], { column: 'alarmConfigId', termType: 'eq', value: 'inherited-rule' })
  assert.ok(calls[1].body.terms.some((term: any) => term.column === 'sourceId' && term.value === 'device-a'))
  await queryActiveRuleCounts(['inherited-rule'], 'device-a')
  assert.ok(calls[2].body.filter.terms.some((term: any) => term.column === 'sourceId' && term.value === 'device-a'))
})

test('changing the device rebuilds record pagination and discards an old device response', async () => {
  const pending: { body: Record<string, any>; resolve: (value: unknown) => void }[] = []
  setAlarmRequestHandler((_url, body) => new Promise(resolve => pending.push({ body, resolve })))
  const device = ref('device-a'), rule = ref<string>()
  const { state, unmount } = mount(() => useDeviceAlarmRecords(rule, key => key, device))
  const old = state.table.value.request({ pageIndex: 2, pageSize: 10 })
  const key = state.table.value.key
  device.value = 'device-b'
  await flush()
  assert.notEqual(state.table.value.key, key)
  const current = state.table.value.request({ pageIndex: 0, pageSize: 10 })
  assert.ok(pending[1].body.terms.some((term: any) => term.column === 'sourceId' && term.value === 'device-b'))
  pending[1].resolve(response('device-b-record'))
  assert.equal((await current).result?.data[0].id, 'device-b-record')
  pending[0].resolve(response('device-a-record'))
  assert.equal((await old).success, false)
  unmount()
})


test('device alarm sidebar includes inherited rules while explicit and empty device overrides suppress product rules', async () => {
  const make = (id: string, property: string, thingId = '@all') => ({
    ...buildPreprocessPayload({ name: id, source: 'product', targetId: 'product-a', productId: 'product-a',
      property, propertyName: property, level: 2, trigger: 'outside', limit: { lower: 10, upper: 20 },
      autoRelieve: true, notification: createEmptyNotification() }),
    id, property, templateId: 'product-a', thingId,
  })
  setAlarmRequestHandler(async url => {
    if (url === '/alarm/config/default/level') return { result: { levels: [] } }
    if (url.endsWith('/product-a/property/_list')) return { result: [make('inherited-1', 'p1'), make('inherited-2', 'p2'), make('inherited-3', 'p3')] }
    if (url.endsWith('/product-a/device-a/property/_list')) return { result: [make('override-1', 'p1', 'device-a'),
      { id: 'disabled-2', property: 'p2', templateId: 'product-a', thingId: 'device-a', provider: 'composite', configuration: { processors: [] } }] }
    if (url.endsWith('_aggregation')) return { result: [] }
    throw new Error(url)
  })
  const device = ref({ id: 'device-a', productKey: 'product-a', name: 'Device', productName: 'Product', thingModelMetadata: { properties: [] } } as unknown as IotDevice)
  const { state, unmount } = mount(() => useDeviceAlarmDetail(device))
  await flush()
  assert.equal(state.error.value, false)
  assert.deepEqual(state.rows.value.map(row => row.id), ['inherited-3', 'override-1'])
  assert.deepEqual(state.rows.value.map(row => row.source), ['product', 'device'])
  unmount()
})


test('DingTalk robots remain separate instances alongside work notifications with their own recovery templates', () => {
  const channel = (id: string, notifierId: string, templateId = `${id}-template`) => ({ id, name: id,
    channelProvider: 'notifier-dingTalk', channelConfiguration: { notifierId, templateId } })
  const trigger = [channel('robot-a', 'robot-a-config'), channel('robot-b', 'robot-b-config'), channel('work', 'work-config')]
  const recovery = [channel('robot-a-relieve', 'robot-a-config'), channel('work-relieve', 'work-config')]
  const providers = [{ id: 'trigger', provider: 'alarm-device', channels: trigger }, { id: 'relieve', provider: 'alarm-device-relieve', channels: recovery }]
  const detail = (channels: ReturnType<typeof channel>[]) => ({ channels: channels.map(channel => ({ channel,
    template: { id: channel.channelConfiguration.templateId, configId: channel.channelConfiguration.notifierId } })) })
  const notifiers = new Map(['robot-a-config', 'robot-b-config', 'work-config'].map(id => [id, { type: 'dingTalk', provider: id === 'work-config' ? 'dingTalkMessage' : 'dingTalkRobotWebHook' }]))
  const methods = toNotifyMethods([{ id: 'notifier-dingTalk', name: 'DingTalk' }], providers, new Map([
    ['trigger', detail(trigger)], ['relieve', detail(recovery)],
  ]), notifiers)
  assert.deepEqual(methods.map(method => method.id), ['notifier-dingTalk', 'robot-a', 'robot-b'])
  assert.equal(methods[1].fixedReceiver?.relieveTemplateId, 'robot-a-relieve-template')
  assert.equal(methods[2].templates?.relieve, 'missing')
  assert.deepEqual(methods[0].channelIds, ['work'])
  const fixed = selectAlarmNotificationTypes({ ...createEmptyNotification(), enabled: true }, ['robot-a', 'robot-b'], methods)
  assert.deepEqual(fixed.channelProviders, [])
  assert.equal(fixed.fixedReceiverChannels.length, 2)
  assert.equal(hasNotificationRecipients(fixed), true)
  assert.equal(matchesAlarmNotifyMethod(fixed, methods[1]), true)
  assert.equal(matchesAlarmNotifyMethod(fixed, methods[0]), false)
  const mixed = selectAlarmNotificationTypes(fixed, ['robot-a', 'notifier-dingTalk'], methods)
  assert.equal(hasNotificationRecipients(mixed), false)
  assert.equal(hasNotificationRecipients({ ...mixed, userIds: ['u1'] }), true)
  assert.equal(selectAlarmNotificationTypes(mixed, [], methods).fixedReceiverChannels.length, 0)
})

test('fixed-only alarms retain selection and templates through trigger/recovery payload and readback', () => {
  const model = editorProps().model
  model.property = 'temperature'
  model.trigger = 'gt'
  model.value = 50
  model.autoRelieve = true
  model.notification = { ...createEmptyNotification(), enabled: true, includeRelieve: true,
    fixedReceiverChannels: [{ channelId: 'robot-a', templateId: 'trigger-template', relieveTemplateId: 'recovery-template' }] }
  const payload = buildPreprocessPayload(model)
  const restored = toDeviceAlarmRow({ ...payload, property: model.property }, model.source, model.targetId)
  if (!restored) throw new Error('Fixed notification payload must remain editable after readback')
  assert.equal(restored.notification.enabled, true)
  assert.equal(hasFixedNotification(restored.notification), true)
  assert.deepEqual(restored.notification.fixedReceiverChannels, model.notification.fixedReceiverChannels)
  const editor = useDeviceAlarmEditor({ ...editorProps(), model }, key => key)
  assert.equal(editor.panelStates.value.notification, 'complete')
  const selected = reactive({ model, methods: [{ id: 'robot-a', providerId: 'notifier-dingTalk', key: 'dingtalk', label: 'Robot A', desc: '', icon: '',
    fixedReceiver: model.notification.fixedReceiverChannels![0] }] as DeviceAlarmNotifyMethod[] })
  const { state: notification, unmount } = mount(() => useAlarmNotification(selected, () => {}, () => {}))
  assert.deepEqual(notification.channelIds.value, ['robot-a'])
  assert.equal(notification.requiresRecipients.value, false)
  notification.channelIds.value = []
  assert.equal(hasFixedNotification(model.notification), false)
  unmount()
})


test('notify resources load robot identities once per config and retain work-only recovery status', async () => {
  const calls: string[] = []
  const channel = (id: string, notifierId: string) => ({ id, name: id, channelProvider: 'notifier-dingTalk',
    channelConfiguration: { notifierId, templateId: `${id}-template` } })
  const trigger = [channel('robot-a', 'robot'), channel('robot-b', 'robot'), channel('work', 'work')]
  setAlarmRequestHandler(async url => {
    calls.push(url)
    if (url === '/notify/channel/providers') return { result: [{ id: 'notifier-dingTalk', name: 'DingTalk' }] }
    if (url === '/notify/channel/all') return { result: [{ id: 'trigger', provider: 'alarm-device', channels: trigger }] }
    if (url === '/notify/channel/trigger/_query-with-templates') return { result: { channels: trigger.map(channel => ({ channel,
      template: { id: channel.channelConfiguration.templateId, configId: channel.channelConfiguration.notifierId } })) } }
    if (url.startsWith('/notifier/config/')) return { result: { type: 'dingTalk', provider: url.endsWith('/robot') ? 'dingTalkRobotWebHook' : 'dingTalkMessage' } }
    throw new Error(`Unexpected request ${url}`)
  })
  const methods = await queryDeviceAlarmNotifyMethods()
  assert.deepEqual(methods.map(method => method.id), ['notifier-dingTalk', 'robot-a', 'robot-b'])
  assert.equal(calls.filter(url => url === '/notifier/config/robot').length, 1)
  assert.deepEqual(methods[0].personnelChannels, { providerId: 'notifier-dingTalk', trigger: ['work'], relieve: [] })
  assert.equal(methods[0].templates?.relieve, 'missing')
})

test('missing robot resources keep a saved fixed selection removable without requiring personnel', () => {
  const model = reactive({ ...editorProps().model, id: 'saved', notification: { ...createEmptyNotification(), enabled: true,
    fixedReceiverChannels: [{ channelId: 'missing-robot', templateId: 'saved-template' }] } })
  const props = reactive({ model, methods: [] as DeviceAlarmNotifyMethod[] })
  const { state, unmount } = mount(() => useAlarmNotification(props, () => {}, () => {}))
  try {
    assert.deepEqual(state.channelIds.value, ['missing-robot'])
    assert.equal(state.requiresRecipients.value, false)
    state.channelIds.value = []
    assert.deepEqual(model.notification.fixedReceiverChannels, [])
  } finally { unmount() }
})


test('channel editor preserves independent recipients across switches and serializes both alarm events', () => {
  const model = reactive<DeviceAlarmFormModel>({ ...editorProps().model, name: 'alarm', targetId: 'product', property: 'temperature',
    trigger: 'gt', value: 80, autoRelieve: true, notification: { ...createEmptyNotification(), enabled: true, includeRelieve: true } })
  const methods = [
    { id: 'email', providerId: 'email', key: 'email', label: 'Email' },
    { id: 'sms', providerId: 'sms', key: 'sms', label: 'SMS' },
    { id: 'hook', providerId: 'webhook', key: 'webhook', label: 'Hook', fixedReceiver: { channelId: 'hook', templateId: 'hook-template' } },
  ] as DeviceAlarmNotifyMethod[]
  const { state, unmount } = mount(() => useAlarmNotification({ model, methods }, () => {}, () => {}))
  try {
    state.selectChannel('email')
    state.currentUserIds.value = ['zhang']
    state.selectChannel('sms')
    assert.deepEqual(state.currentUserIds.value, [])
    assert.equal(hasNotificationRecipients(model.notification), false)
    state.currentUserIds.value = ['li']
    state.selectChannel('email')
    assert.deepEqual(state.currentUserIds.value, ['zhang'])
    assert.deepEqual(model.notification.userIds, [])
    state.selectChannel('hook')
    assert.equal(state.currentFixed.value, true)
    assert.equal(hasNotificationRecipients(model.notification), true)
    const payload = buildPreprocessPayload(model)
    const restored = toDeviceAlarmRow(payload, 'product', 'Product')!
    assert.deepEqual(restored.notification.channelRecipients, model.notification.channelRecipients)
    assert.equal(restored.notification.includeRelieve, true)
    assert.equal(restored.notificationEnabled, true)
    const notify = JSON.stringify(payload.configuration)
    assert.match(notify, /alarm-device-relieve/)
    assert.deepEqual(notificationUserIds(restored.notification), ['zhang', 'li'])
    state.removeSelection({ channelId: 'email', userId: 'zhang' })
    state.selectChannel('sms')
    assert.deepEqual(state.currentUserIds.value, ['li'])
    state.selectChannel('email')
    state.removeSelection({ channelId: 'email' })
    assert.equal(state.selectedChannelId.value, 'sms')
    assert.deepEqual(model.notification.channelProviders, ['sms'])
    assert.equal(model.notification.fixedReceiverChannels?.length, 1)
  } finally { unmount() }
})

test('legacy shared recipients and explicit unknown channels survive an edit without guessing providers', () => {
  const model = reactive<DeviceAlarmFormModel>({ ...editorProps().model, id: 'saved', notification: { ...createEmptyNotification(), enabled: true,
    channelProviders: ['email', 'sms'], userIds: ['shared'], dimensions: [{ type: 'org', id: 'org-a' }], notifyChannelIds: ['unmapped'] } })
  const before = JSON.stringify(model.notification)
  const props = reactive({ model, methods: [{ id: 'email', providerId: 'email', key: 'email', label: 'Email' }] as DeviceAlarmNotifyMethod[] })
  const { state, unmount } = mount(() => useAlarmNotification(props, () => {}, () => {}))
  try {
    assert.equal(JSON.stringify(model.notification), before)
    state.selectChannel('email')
    assert.equal(JSON.stringify(model.notification), before, 'switching a saved group does not migrate persistence')
    state.currentUserIds.value = ['zhang']
    const groups = notificationRecipientGroups(model.notification)
    assert.deepEqual(groups.find(group => group.providerId === 'sms')?.userIds, ['shared'])
    assert.deepEqual(groups.find(group => group.providerId === '')?.notifyChannelIds, ['unmapped'])
    assert.deepEqual(groups[0].dimensions, [{ type: 'org', id: 'org-a' }])
    props.methods = []
    assert.equal(state.channelOptions.value.some(option => option.value === 'sms'), true)
    state.removeSelection({ channelId: 'sms' })
    assert.deepEqual(notificationRecipientGroups(model.notification).find(group => group.providerId === '')?.userIds, ['shared'])
  } finally { unmount() }
})

test('explicit empty or invalid groups never revive legacy recipients and fixed templates remain independent', () => {
  const legacy = { ...createEmptyNotification(), channelProviders: ['email'], userIds: ['shared'] }
  assert.equal(notificationIsConfigured(legacy), true)
  for (const channelRecipients of [[], [{ providerId: 'email', userIds: [] }], [{ providerId: '', userIds: ['u'] }]]) {
    assert.equal(notificationIsConfigured({ ...legacy, channelRecipients }), false)
  }
  assert.equal(notificationIsConfigured({ ...legacy, channelRecipients: null }), false)
  const mixed = { ...legacy, channelRecipients: [{ providerId: 'email', userIds: ['zhang'] }, { providerId: 'sms', userIds: ['li'] }] }
  const removed = removeNotificationRecipient(mixed, { channelId: 'email' })
  assert.deepEqual(notificationUserIds(removed), ['li'])
  assert.equal(notificationIsConfigured({ ...legacy, channelRecipients: [], fixedReceiverChannels: [{ channelId: 'hook', templateId: 'template' }] }), true)
})


test('editing known legacy provider and channel IDs retains one recipient group', () => {
  const model = reactive<DeviceAlarmFormModel>({ ...editorProps().model, id: 'saved', notification: { ...createEmptyNotification(), enabled: true,
    channelProviders: ['email'], notifyChannelIds: ['email-channel'], userIds: ['shared'] } })
  const props = { model, methods: [{ id: 'email', providerId: 'email', key: 'email', label: 'Email', channelIds: ['email-channel'] }] as DeviceAlarmNotifyMethod[] }
  const { state, unmount } = mount(() => useAlarmNotification(props, () => {}, () => {}))
  try {
    assert.deepEqual(state.configuredChannelIds.value, ['email'])
    state.currentUserIds.value = ['zhang']
    assert.equal(model.notification.channelRecipients?.length, 1)
    assert.deepEqual(model.notification.channelRecipients?.[0].notifyChannelIds, ['email-channel'])
    state.removeSelection({ channelId: 'email' })
    assert.deepEqual(model.notification.notifyChannelIds, [])
    assert.deepEqual(model.notification.channelProviders, [])
  } finally { unmount() }
})


test('optional form notification needs no switch and selecting a channel alone sends nothing', () => {
  const model = reactive<DeviceAlarmFormModel>({ ...editorProps().model, notification: createEmptyNotification() })
  const methods = [{ id: 'email', providerId: 'email', key: 'email', label: 'Email' },
    { id: 'sms', providerId: 'sms', key: 'sms', label: 'SMS' },
    { id: 'inside-mail', providerId: 'inside-mail', key: 'inbox', label: 'Inbox' }] as DeviceAlarmNotifyMethod[]
  let requests = 0
  const props = reactive({ model, methods, layout: 'form' as const })
  const before = JSON.stringify(model.notification)
  const { state, unmount } = mount(() => useAlarmNotification(props, () => requests++, () => {}))
  try {
    assert.equal(requests, 1, 'channels load while the optional notification is empty')
    assert.deepEqual(state.configuredChannelIds.value, [], 'do not auto-select inbox')
    state.selectChannel('email')
    assert.equal(JSON.stringify(model.notification), before, 'viewing a channel does not create an empty delivery group')
    state.setPanel('recipients', true)
    assert.equal(state.activePanel.value, 'recipients')
    state.currentUserIds.value = ['zhang']
    assert.equal(model.notification.enabled, true)
    state.selectChannel('sms')
    assert.deepEqual(state.currentUserIds.value, [])
    assert.deepEqual(model.notification.channelProviders, ['email'])
    state.currentUserIds.value = ['li']
    state.selectChannel('email')
    assert.deepEqual(state.currentUserIds.value, ['zhang'])
    state.currentUserIds.value = []
    assert.deepEqual(model.notification.channelProviders, ['sms'])
    state.removeSelection({ channelId: 'sms' })
    assert.equal(model.notification.enabled, false)
    assert.equal(notificationIsConfigured(model.notification), false)
  } finally { unmount() }
})

test('optional form retains disabled legacy data until explicit configuration without reactivating old channels', () => {
  const model = reactive<DeviceAlarmFormModel>({ ...editorProps().model, id: 'saved', notification: { ...createEmptyNotification(),
    channelProviders: ['email', 'sms'], userIds: ['old-user'], fixedReceiverChannels: [{ channelId: 'old-hook', templateId: 'old-template' }] } })
  const props = { model, layout: 'form' as const, methods: [{ id: 'email', providerId: 'email', key: 'email', label: 'Email' }] as DeviceAlarmNotifyMethod[] }
  const before = JSON.stringify(model.notification)
  const { state, unmount } = mount(() => useAlarmNotification(props, () => {}, () => {}))
  try {
    assert.deepEqual(state.configuredChannelIds.value, [])
    assert.equal(JSON.stringify(model.notification), before)
    state.selectChannel('email')
    assert.deepEqual(state.currentUserIds.value, [])
    assert.equal(model.notification.enabled, false)
    state.currentUserIds.value = ['new-user']
    assert.equal(model.notification.enabled, true)
    assert.deepEqual(model.notification.channelProviders, ['email'])
    assert.deepEqual(model.notification.fixedReceiverChannels, [])
    assert.deepEqual(notificationUserIds(model.notification), ['new-user'])
  } finally { unmount() }
})

test('optional form fixed destinations enable delivery without users and last removal disables it', () => {
  const model = reactive<DeviceAlarmFormModel>({ ...editorProps().model, notification: createEmptyNotification() })
  const methods = [{ id: 'hook', providerId: 'webhook', key: 'webhook', label: 'Hook', fixedReceiver: { channelId: 'hook', templateId: 'template' } }] as DeviceAlarmNotifyMethod[]
  const { state, unmount } = mount(() => useAlarmNotification({ model, methods, layout: 'form' }, () => {}, () => {}))
  try {
    state.selectChannel('hook')
    assert.equal(model.notification.enabled, true)
    assert.equal(state.currentFixed.value, true)
    assert.deepEqual(model.notification.userIds, [])
    state.removeSelection({ channelId: 'hook' })
    assert.equal(model.notification.enabled, false)
  } finally { unmount() }
})

test('editor preview removes empty personnel groups and disables notification after the final destination', () => {
  const props = reactive(editorProps())
  props.model.notification = { ...createEmptyNotification(), enabled: true, channelProviders: ['email'],
    channelRecipients: [{ providerId: 'email', userIds: ['zhang'] }],
    fixedReceiverChannels: [{ channelId: 'hook', templateId: 'template' }] }
  const { state, unmount } = mount(() => useDeviceAlarmEditor(props, key => key))
  try {
    state.removeNotificationSelection({ channelId: 'email', userId: 'zhang' })
    assert.deepEqual(props.model.notification.channelRecipients, [])
    assert.equal(props.model.notification.enabled, true)
    assert.equal(hasNotificationRecipients(props.model.notification), true)
    state.removeNotificationSelection({ channelId: 'hook' })
    assert.equal(props.model.notification.enabled, false)
    assert.equal(state.panelStates.value.notification, 'off')
  } finally { unmount() }
})


test('compact channel blocks preserve the explicit notification switch and isolate recipient removal', async () => {
  setAlarmRequestHandler(async () => ({ result: [] }))
  const model = editorProps().model
  model.notification = { ...createEmptyNotification(), enabled: false, channelProviders: ['wechat', 'ding'], channelRecipients: [
    { providerId: 'wechat', userIds: ['zhang'], dimensions: [{ type: 'org', id: 'dept' }, { type: 'role', id: 'tag' }] },
    { providerId: 'ding', userIds: ['li'], dimensions: [] },
  ] }
  const props = reactive({ model, compact: true, disabled: false, loading: false, failed: false, reveal: false, methods: [
    { id: 'wechat', providerId: 'wechat', key: 'wechat', recipientKinds: ['org', 'role'] },
    { id: 'ding', providerId: 'ding', key: 'dingtalk', recipientKinds: ['org'] },
  ] as DeviceAlarmNotifyMethod[] })
  const before = JSON.stringify(model.notification)
  const { state, unmount } = mount(() => useAlarmNotificationBlocks(props))
  try {
    assert.equal(state.items.value.length, 2)
    assert.equal(JSON.stringify(model.notification), before, 'mounting never enables a disabled saved rule')
    model.notification.enabled = true
    const first = state.items.value[0].key
    state.setKind(first, 'role')
    state.removeRecipient({ channelId: 'wechat', dimension: { type: 'org', id: 'dept' } })
    assert.deepEqual(model.notification.channelRecipients?.[0].dimensions, [{ type: 'role', id: 'tag' }])
    assert.deepEqual(model.notification.channelRecipients?.[1].userIds, ['li'])
    props.reveal = true
    await flush()
    assert.equal(state.recipientKey.value, first)
    props.reveal = false
    await flush()
    assert.equal(state.recipientKey.value, undefined)
    for (const flag of ['disabled', 'loading', 'failed'] as const) {
      props[flag] = true
      const snapshot = JSON.stringify(model.notification)
      state.add(); state.remove(first); state.setTargets(first, 'role', []); state.removeRecipient({ channelId: 'ding', userId: 'li' })
      assert.equal(state.items.value.length, 2)
      assert.equal(JSON.stringify(model.notification), snapshot)
      props[flag] = false
    }
    state.remove(first)
    state.remove(state.items.value[0].key)
    assert.equal(model.notification.enabled, true, 'removing the last channel leaves the explicit switch on and save validation active')
    assert.equal(notificationIsConfigured(model.notification), false)
    assert.equal(state.items.value.length, 1)
    assert.equal(state.items.value[0].channelId, undefined)
  } finally { unmount() }
})

test('compact blocks honor initial summary navigation and close the picker when editing is disabled', async () => {
  const model = editorProps().model
  model.notification = { ...createEmptyNotification(), enabled: true, channelProviders: ['ding'], userIds: ['zhang'] }
  const props = reactive({ model, compact: true, reveal: true, disabled: false,
    methods: [{ id: 'ding', providerId: 'ding', key: 'dingtalk', recipientKinds: ['org'] }] as DeviceAlarmNotifyMethod[] })
  const { state, unmount } = mount(() => useAlarmNotificationBlocks(props))
  try {
    assert.equal(state.recipientKey.value, state.items.value[0].key)
    props.disabled = true
    await flush()
    assert.equal(state.recipientKey.value, undefined)
    assert.deepEqual(model.notification.userIds, ['zhang'])
  } finally { unmount() }
})

test('channel-local summaries hydrate only their own recipients and preserve legacy dimensions', async () => {
  const users: string[][] = []
  setAlarmRequestHandler(async (url, body) => {
    if (url.startsWith('/user/')) {
      const ids = (body.terms as Array<{ value: string[] }>)[0].value
      users.push(ids)
      return { result: { data: ids.map(id => ({ id, name: id === 'zhang' ? 'Zhang' : 'Li' })), total: ids.length } }
    }
    return { result: [{ id: 'dept', name: 'Operations' }] }
  })
  const props = reactive({ notification: { ...createEmptyNotification(), channelProviders: ['wechat', 'ding'],
    userIds: ['zhang'], dimensions: [{ type: 'org', id: 'dept' }] }, methods: [] as DeviceAlarmNotifyMethod[], scopeKey: 'device-a', channelId: 'wechat' })
  const { state, unmount } = mount(() => useAlarmNotificationGroups(props))
  try {
    await flush()
    assert.deepEqual(state.groups.value.map(group => group.id), ['wechat'])
    assert.equal(state.groups.value[0].users[0].name, 'Zhang')
    assert.equal(state.groups.value[0].targets[0].label, 'DeviceAlarm.notification.workTarget.org · Operations')
    assert.deepEqual(users, [['zhang']])
    props.notification = { ...createEmptyNotification(), channelProviders: ['wechat', 'ding'], userIds: [], dimensions: [],
      channelRecipients: [{ providerId: 'wechat', userIds: ['zhang'] }, { providerId: 'ding', userIds: ['li'] }] } as typeof props.notification
    props.channelId = 'ding'
    await flush()
    assert.deepEqual(state.groups.value.map(group => group.id), ['ding'])
    assert.equal(state.groups.value[0].users[0].name, 'Li')
    assert.deepEqual(users.at(-1), ['li'])
  } finally { unmount() }
})

test('notification blocks keep empty placeholders local, reject duplicates and isolate per-channel targets', () => {
  const props = reactive({ model: editorProps().model, methods: [
    { id: 'email', providerId: 'email', key: 'email' }, { id: 'sms', providerId: 'sms', key: 'sms' },
    { id: 'hook', providerId: 'webhook', key: 'webhook', fixedReceiver: { channelId: 'hook', templateId: 'tpl' } },
  ] as DeviceAlarmNotifyMethod[], disabled: false })
  const before = JSON.stringify(props.model.notification)
  const { state, unmount } = mount(() => useAlarmNotificationBlocks(props))
  try {
    assert.equal(state.items.value.length, 1)
    state.add()
    assert.equal(JSON.stringify(props.model.notification), before)
    const [first, second] = state.items.value
    state.selectChannel(first.key, 'email')
    assert.equal(props.model.notification.enabled, true)
    assert.equal(hasNotificationRecipients(props.model.notification), false, 'selected channel needs a target before saving')
    state.setTargets(first.key, 'people', ['zhang'])
    state.selectChannel(second.key, 'email')
    assert.equal(state.items.value[1].channelId, undefined)
    assert.equal(state.items.value[1].channelOptions.find(item => item.value === 'email')?.disabled, true)
    state.selectChannel(second.key, 'sms')
    state.setTargets(second.key, 'people', ['li'])
    assert.deepEqual(props.model.notification.channelRecipients?.map(group => group.userIds), [['zhang'], ['li']])
    state.setRecipientOpen(first.key, true)
    state.setRecipientOpen(second.key, true)
    state.setRecipientOpen(first.key, false)
    assert.equal(state.recipientKey.value, second.key, 'late close from another block does not close the current picker')
    state.selectChannel(first.key, 'hook')
    assert.deepEqual(props.model.notification.channelProviders, ['sms'])
    assert.deepEqual(props.model.notification.channelRecipients?.[0].userIds, ['li'])
    assert.equal(state.items.value[0].fixed, true)
    state.remove(first.key)
    state.setTargets(second.key, 'people', [])
    assert.equal(hasNotificationRecipients(props.model.notification), false)
    assert.equal(props.model.notification.enabled, true, 'empty selected block must not bypass validation')
    state.remove(second.key)
    assert.equal(props.model.notification.enabled, false)
    assert.equal(state.items.value.length, 1)
    assert.equal(state.items.value[0].channelId, undefined)
    props.disabled = true
    state.add()
    state.selectChannel(state.items.value[0].key, 'hook')
    assert.equal(state.items.value.length, 1)
    assert.equal(props.model.notification.enabled, false)
  } finally { unmount() }
})

test('dimension targets round-trip by channel and explicit kind changes leave other channels intact', async () => {
  setAlarmRequestHandler(async url => url.startsWith('/role/') ? { result: [{ id: 'r1', name: 'Operators' }] }
    : { result: [{ id: 'o1', name: 'Operations' }] })
  const props = reactive({ model: editorProps().model, methods: [
    { id: 'wechat', providerId: 'wechat', key: 'wechat', recipientKinds: ['org', 'role'] },
    { id: 'email', providerId: 'email', key: 'email' },
  ] as DeviceAlarmNotifyMethod[] })
  const { state, unmount } = mount(() => useAlarmNotificationBlocks(props))
  try {
    const key = state.items.value[0].key
    state.selectChannel(key, 'wechat')
    state.setTargets(key, 'org', ['o1', 'o1'])
    state.add()
    const second = state.items.value[1].key
    state.selectChannel(second, 'email')
    state.setTargets(second, 'people', ['zhang'])
    await flush()
    assert.equal(state.items.value[0].options[0].label, 'Operations')
    assert.deepEqual(props.model.notification.channelRecipients?.[0].dimensions, [{ type: 'org', id: 'o1' }])
    const payload = buildPreprocessPayload({ ...props.model, targetId: 'product-a', property: 'temperature', limit: { lower: 10, upper: 20 } })
    const saved = toDeviceAlarmRow({ id: 'alarm-a', templateId: 'product-a', thingId: '@all', property: 'temperature', provider: payload.provider, configuration: payload.configuration }, 'product', 'Product A')
    assert.deepEqual(saved?.notification.channelRecipients, props.model.notification.channelRecipients)
    state.setKind(key, 'role')
    assert.equal(hasNotificationRecipients(props.model.notification), true, 'switching types retains the selected department')
    assert.deepEqual(props.model.notification.channelRecipients?.[0].dimensions, [{ type: 'org', id: 'o1' }])
    state.setTargets(key, 'role', ['r1'])
    assert.deepEqual(props.model.notification.channelRecipients?.[0].dimensions, [{ type: 'org', id: 'o1' }, { type: 'role', id: 'r1' }])
    assert.deepEqual(props.model.notification.channelRecipients?.[1].userIds, ['zhang'])
    const editor = useDeviceAlarmEditor({ ...editorProps(), model: props.model }, key => key)
    editor.removeNotificationSelection({ channelId: 'wechat', dimension: { type: 'role', id: 'r1' } })
    assert.deepEqual(props.model.notification.channelRecipients?.[0].dimensions, [{ type: 'org', id: 'o1' }])
    editor.removeNotificationSelection({ channelId: 'wechat', dimension: { type: 'org', id: 'o1' } })
    assert.deepEqual(props.model.notification.channelProviders, ['email'])
  } finally { unmount() }
})

test('blocks preserve disabled legacy drafts until a real edit and sync external preview removal', () => {
  const model = editorProps().model
  model.notification = { ...createEmptyNotification(), channelProviders: ['old'], userIds: ['old-user'] }
  const props = reactive({ model, methods: [{ id: 'email', providerId: 'email', key: 'email' }] as DeviceAlarmNotifyMethod[] })
  const before = JSON.stringify(model.notification)
  const { state, unmount } = mount(() => useAlarmNotificationBlocks(props))
  try {
    assert.equal(JSON.stringify(model.notification), before)
    state.selectChannel(state.items.value[0].key, 'email')
    state.setTargets(state.items.value[0].key, 'people', ['new-user'])
    assert.deepEqual(model.notification.channelProviders, ['email'])
    assert.deepEqual(notificationUserIds(model.notification), ['new-user'])
    model.notification = { ...createEmptyNotification() }
    assert.equal(state.items.value.length, 1)
    assert.equal(state.items.value[0].channelId, undefined)
    props.model = { ...editorProps().model, targetId: 'another' }
    assert.equal(state.items.value[0].channelId, undefined)
  } finally { unmount() }
})

test('recipient capabilities require confirmed compatible notifier details', () => {
  const channel = (id: string) => ({ channelConfiguration: { notifierId: id } })
  const configs = new Map([['wechat', { type: 'weixin', provider: 'corpMessage' }], ['ding', { type: 'dingTalk', provider: 'dingTalkMessage' }]])
  assert.deepEqual(alarmRecipientKinds([channel('wechat')], configs), ['org', 'role'])
  assert.deepEqual(alarmRecipientKinds([channel('ding')], configs), ['org'])
  assert.equal(alarmRecipientKinds([channel('unknown')], configs), undefined)
  assert.equal(alarmRecipientKinds([channel('wechat'), channel('unknown')], configs), undefined)
  assert.equal(alarmRecipientKinds([channel('wechat'), channel('ding')], configs), undefined)
})

test('dimension directories flatten accessible paths, reject invalid responses and ignore stale scopes', async () => {
  setAlarmRequestHandler(async url => url.startsWith('/organization/')
    ? { result: [{ id: 'o1', name: 'Root', children: [{ id: 'o2', name: 'Child' }] }] }
    : { result: [{ id: 'r1', name: 'Operator' }] })
  assert.deepEqual(await queryAlarmRecipientDimensions('org'), [{ value: 'o1', label: 'Root' }, { value: 'o2', label: 'Root / Child' }])
  assert.deepEqual(await queryAlarmRecipientDimensions('role'), [{ value: 'r1', label: 'Operator' }])
  setAlarmRequestHandler(async () => ({ success: false, result: [] }))
  await assert.rejects(() => queryAlarmRecipientDimensions('org'))
  let resolveOld!: (value: unknown) => void
  let count = 0
  setAlarmRequestHandler(async () => ++count === 1 ? new Promise(resolve => { resolveOld = resolve }) : { result: [{ id: 'new', name: 'New scope' }] })
  const props = reactive({ scopeKey: 'old', kinds: ['org' as const] })
  const { state, unmount } = mount(() => useAlarmDimensionOptions(props))
  try {
    props.scopeKey = 'new'
    await flush()
    resolveOld({ result: [{ id: 'old', name: 'Old scope' }] })
    await flush()
    assert.deepEqual(state.entries.org.options, [{ value: 'new', label: 'New scope' }])
    setAlarmRequestHandler(async () => { throw new Error('forbidden') })
    await state.retry('org')
    assert.equal(state.entries.org.failed, true)
    setAlarmRequestHandler(async () => ({ result: [] }))
    await state.retry('org')
    assert.equal(state.entries.org.failed, false)
    assert.deepEqual(state.entries.org.options, [])
  } finally { unmount() }
})


test('device notification directory identifies enterprise targets from real notifier details and safely falls back when unavailable', async () => {
  let denied = false
  setAlarmRequestHandler(async url => {
    if (url === '/notify/channel/providers') return { result: [{ id: 'notifier-weixin', name: 'WeCom' }] }
    if (url === '/notify/channel/all') return { result: [{ id: 'alarm-config', provider: 'alarm-device', channels: [
      { id: 'wecom-channel', channelProvider: 'notifier-weixin', channelConfiguration: { notifierId: 'wecom-app', templateId: 'tpl' } },
    ] }] }
    if (url === '/notifier/config/wecom-app') {
      if (denied) throw new Error('forbidden')
      return { result: { type: 'weixin', provider: 'corpMessage' } }
    }
    if (url.includes('_query-with-templates')) return { result: {} }
    throw new Error('Unexpected request: ' + url)
  })
  assert.deepEqual((await queryDeviceAlarmNotifyMethods())[0].recipientKinds, ['org', 'role'])
  denied = true
  assert.equal((await queryDeviceAlarmNotifyMethods())[0].recipientKinds, undefined)
})


test('inline rules edit enterprise recipients without losing other kinds or channel assignments', async () => {
  const requests: string[] = []
  setAlarmRequestHandler(async url => {
    requests.push(url)
    return { result: url.startsWith('/role/') ? [{ id: 'tag', name: 'Operators' }] : [{ id: 'dept', name: 'Operations' }] }
  })
  const props = reactive({ model: editorProps().model, methods: [
    { id: 'wechat', providerId: 'wechat', key: 'wechat', recipientKinds: ['org', 'role'] },
    { id: 'ding', providerId: 'ding', key: 'dingtalk', recipientKinds: ['org'] },
    { id: 'email', providerId: 'email', key: 'email' },
    { id: 'robot', providerId: 'ding', key: 'dingtalk', fixedReceiver: { channelId: 'robot', templateId: 'tpl' } },
  ] as DeviceAlarmNotifyMethod[], layout: 'inline' as const, disabled: false, loading: false, failed: false })
  props.model.notification.enabled = true
  const { state, unmount } = mount(() => useAlarmNotification(props, () => {}, () => {}))
  try {
    state.selectChannel('wechat')
    assert.deepEqual(state.currentTargets.value.kinds, ['people', 'org', 'role'])
    state.setTargets('people', ['zhang'])
    const before = JSON.stringify(props.model.notification)
    state.setTargetKind('org')
    assert.equal(JSON.stringify(props.model.notification), before)
    state.setTargets('org', ['dept', 'dept'])
    await flush()
    assert.equal(state.currentTargets.value.options[0].label, 'Operations')
    state.setTargetKind('role')
    state.setTargets('role', ['tag'])
    await flush()
    assert.equal(state.currentTargets.value.options[0].label, 'Operators')
    state.setTargetKind('people')
    assert.deepEqual(state.currentTargets.value.ids, ['zhang'])
    state.setTargets('people', [])
    assert.deepEqual(state.currentGroup.value?.dimensions, [{ type: 'org', id: 'dept' }, { type: 'role', id: 'tag' }])
    state.selectChannel('ding')
    assert.deepEqual(state.currentTargets.value.kinds, ['people', 'org'])
    state.setTargetKind('role')
    state.setTargets('role', ['unsupported'])
    assert.equal(state.currentTargets.value.kind, 'people')
    assert.deepEqual(state.currentGroup.value?.dimensions, [])
    state.setTargets('people', ['li'])
    state.setTargets('org', ['dept'])
    state.selectChannel('wechat')
    assert.equal(state.currentTargets.value.kind, 'org', 'reopening a dimension-only channel selects its saved kind')
    state.setTargets('org', [])
    assert.deepEqual(state.currentGroup.value?.dimensions, [{ type: 'role', id: 'tag' }])
    state.selectChannel('email')
    assert.deepEqual(state.currentTargets.value.kinds, ['people'])
    state.setTargets('people', ['mail-user'])
    const payload = buildPreprocessPayload({ ...props.model, targetId: 'product-a', property: 'temperature', limit: { lower: 10, upper: 20 } })
    const saved = toDeviceAlarmRow({ id: 'alarm-a', templateId: 'product-a', thingId: '@all', property: 'temperature', provider: payload.provider, configuration: payload.configuration }, 'product', 'Product A')
    assert.deepEqual(saved?.notification.channelRecipients, props.model.notification.channelRecipients)
    props.model = saved!
    state.selectChannel('wechat')
    assert.equal(state.currentTargets.value.kind, 'role')
    assert.deepEqual(state.currentTargets.value.ids, ['tag'])
    for (const flag of ['disabled', 'loading', 'failed'] as const) {
      props[flag] = true
      const snapshot = JSON.stringify(props.model.notification)
      state.setTargetKind('people')
      state.setTargets('role', [])
      assert.equal(state.currentTargets.value.kind, 'role')
      assert.equal(JSON.stringify(props.model.notification), snapshot)
      props[flag] = false
    }
    state.selectChannel('robot')
    const snapshot = JSON.stringify(props.model.notification)
    state.setTargets('people', ['ignored'])
    assert.equal(state.currentFixed.value, true)
    assert.equal(JSON.stringify(props.model.notification), snapshot)
    assert.equal(requests.filter(url => url.startsWith('/organization/')).length, 1)
    assert.equal(requests.filter(url => url.startsWith('/role/')).length, 1)
  } finally { unmount() }
})

test('inline dimension selection recovers directory errors and preserves unavailable saved IDs', async () => {
  let denied = true
  setAlarmRequestHandler(async () => { if (denied) throw new Error('forbidden'); return { result: [] } })
  const model = editorProps().model
  model.notification = { ...createEmptyNotification(), enabled: true, channelProviders: ['ding'], channelRecipients: [
    { providerId: 'ding', userIds: [], dimensions: [{ type: 'org', id: 'old-dept' }] },
  ] }
  const props = reactive({ model, methods: [{ id: 'ding', providerId: 'ding', key: 'dingtalk', recipientKinds: ['org'] }] as DeviceAlarmNotifyMethod[], layout: 'inline' as const })
  const before = JSON.stringify(model.notification)
  const { state, unmount } = mount(() => useAlarmNotification(props, () => {}, () => {}))
  try {
    await flush()
    assert.equal(state.currentTargets.value.kind, 'org')
    assert.equal(state.currentTargets.value.directory?.failed, true)
    assert.deepEqual(state.currentTargets.value.options, [{ value: 'old-dept', label: 'old-dept' }])
    denied = false
    await state.retryTargets('org')
    assert.equal(state.currentTargets.value.directory?.failed, false)
    assert.equal(JSON.stringify(model.notification), before)
    props.methods = []
    assert.deepEqual(state.currentTargets.value.kinds, ['org', 'people'])
    state.setTargets('people', ['user'])
    assert.deepEqual(state.currentGroup.value?.dimensions, [{ type: 'org', id: 'old-dept' }])
  } finally { unmount() }
})

test('enterprise channels retain members departments and tags across type switches, clearing and saved reopening', async () => {
  setAlarmRequestHandler(async () => ({ result: [] }))
  const props = reactive({ model: editorProps().model, methods: [
    { id: 'wechat', providerId: 'wechat', key: 'wechat', recipientKinds: ['org', 'role'] },
    { id: 'ding', providerId: 'ding', key: 'dingtalk', recipientKinds: ['org'] },
  ] as DeviceAlarmNotifyMethod[] })
  const { state, unmount } = mount(() => useAlarmNotificationBlocks(props))
  try {
    const key = state.items.value[0].key
    state.selectChannel(key, 'wechat')
    assert.deepEqual(state.items.value[0].kinds, ['people', 'org', 'role'])
    assert.equal(state.items.value[0].kind, 'people', 'new enterprise channels default to members like visual alarms')
    state.setKind(key, 'people')
    state.setTargets(key, 'people', ['zhang'])
    state.setKind(key, 'org')
    state.setTargets(key, 'org', ['dept'])
    state.setKind(key, 'role')
    state.setTargets(key, 'role', ['tag'])
    state.setKind(key, 'people')
    assert.deepEqual(state.items.value[0].ids, ['zhang'])
    const before = JSON.stringify(props.model.notification)
    state.setKind(key, 'org')
    assert.equal(JSON.stringify(props.model.notification), before, 'tab selection alone does not mutate saved targets')
    assert.deepEqual(state.items.value[0].ids, ['dept'])
    state.setTargets(key, 'org', [])
    assert.deepEqual(props.model.notification.channelRecipients?.[0].userIds, ['zhang'])
    assert.deepEqual(props.model.notification.channelRecipients?.[0].dimensions, [{ type: 'role', id: 'tag' }])
    state.setTargets(key, 'org', ['dept'])
    state.setTargets(key, 'people', [])
    assert.equal(props.model.notification.channelRecipients?.[0].dimensions?.length, 2)
    state.setTargets(key, 'people', ['zhang'])
    const payload = buildPreprocessPayload({ ...props.model, targetId: 'product-a', property: 'temperature', limit: { lower: 10, upper: 20 } })
    const saved = toDeviceAlarmRow({ id: 'alarm-a', templateId: 'product-a', thingId: '@all', property: 'temperature', provider: payload.provider, configuration: payload.configuration }, 'product', 'Product A')
    assert.deepEqual(saved?.notification.channelRecipients, props.model.notification.channelRecipients)
    props.model = saved!
    const restoredKey = state.items.value[0].key
    state.setKind(restoredKey, 'role')
    assert.deepEqual(state.items.value[0].ids, ['tag'])
    state.add()
    const dingKey = state.items.value[1].key
    state.selectChannel(dingKey, 'ding')
    assert.deepEqual(state.items.value[1].kinds, ['people', 'org'])
    state.setKind(dingKey, 'role')
    assert.notEqual(state.items.value[1].kind, 'role')
    await flush()
  } finally { unmount() }
})


test('recipient rows keep names and usernames distinct for duplicate names, missing accounts and cached selections', async () => {
  setAlarmRequestHandler(async () => ({ result: { data: [
    { id: 'u1', name: '陈小雨', username: 'chen.xiaoyu', telephone: '13812345678', orgName: '研发' },
    { id: 'u2', name: '陈小雨', username: 'chen.xiaoyu02' },
    { id: 'u3', name: '李四' },
  ], total: 3 } }))
  const props = reactive({ value: ['u1'], scopeKey: 'username-test', open: true })
  const { state, unmount } = mount(() => useAlarmRecipients(props))
  try {
    await flush()
    const rows = await state.config.value.loadOptions!('', { pageIndex: 0, pageSize: 20 })
    assert.deepEqual(rows.map(row => [row.label, row.description]), [
      ['陈小雨', 'chen.xiaoyu'], ['陈小雨', 'chen.xiaoyu02'], ['李四', ''],
    ])
    assert.equal(rows[0].description.includes('138'), false)
    assert.equal(state.selected.value[0].description, 'chen.xiaoyu')
    const selected = await state.config.value.loadSelectedOptions!(['u1'])
    assert.equal(selected[0].description, 'chen.xiaoyu')
    assert.deepEqual(state.selectionLabels.value, ['陈小雨'], 'selected tags still display names')
    const cache = createAlarmRecipientCache()
    await cache.load(['u1'])
    assert.equal(cache.options.value.get('u1')?.description, 'chen.xiaoyu')
  } finally { unmount() }
})
