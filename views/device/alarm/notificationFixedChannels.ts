import type { DeviceAlarmNotifyMethod } from './types'
import { hasTemplateBinding, verifiedTemplateState } from './notificationTemplateStatus'

type RecordValue = Record<string, unknown>
const record = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}
const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const enabled = (value: unknown) => !value || (record(value).value ?? value) === 'enabled'
const binding = (channel: RecordValue) => record(channel.channelConfiguration)

/** 机器人共享钉钉类型，但每个固定接收方必须保留自己的实例和主题模板。 */
export function fixedNotificationMethods(providers: RecordValue[], details: ReadonlyMap<string, unknown>, notifiers: ReadonlyMap<string, RecordValue>): DeviceAlarmNotifyMethod[] {
  const channels = providers.flatMap(provider => (Array.isArray(provider.channels) ? provider.channels : []).map(record)
    .filter((channel: RecordValue) => channel.id && enabled(channel.state) && hasTemplateBinding(channel))
    .map((channel: RecordValue) => ({ channel, provider })))
  const robots = channels.filter(({ channel }) => {
    const config = notifiers.get(text(binding(channel).notifierId))
    return config?.type === 'dingTalk' && config.provider === 'dingTalkRobotWebHook'
  })
  return robots.filter(({ provider }) => provider.provider === 'alarm-device').map<DeviceAlarmNotifyMethod>(({ channel, provider }) => {
    const config = binding(channel)
    // 只连接同一通知配置的解除模板；多个候选时按实例 key 消除歧义。
    const candidates = robots.filter(item => item.provider.provider === 'alarm-device-relieve'
      && binding(item.channel).notifierId === config.notifierId)
    const recovery = candidates.length === 1 ? candidates[0]
      : candidates.find(item => channel.channelKey && item.channel.channelKey === channel.channelKey)
    return {
      id: text(channel.id), providerId: text(channel.channelProvider), key: 'dingtalk',
      label: text(channel.name) || text(notifiers.get(text(config.notifierId))?.name) || text(channel.id),
      desc: '', icon: 'DingdingOutlined',
      templates: {
        trigger: verifiedTemplateState(details.get(text(provider.id)), channel),
        relieve: recovery ? verifiedTemplateState(details.get(text(recovery.provider.id)), recovery.channel) : 'missing',
      },
      fixedReceiver: {
        channelId: text(channel.id), templateId: text(config.templateId),
        ...(recovery ? { relieveChannelId: text(recovery.channel.id), relieveTemplateId: text(binding(recovery.channel).templateId) } : {}),
      },
    }
  })
}
