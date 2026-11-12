import type { DeviceAlarmNotifyMethod } from './types'

export type TemplateState = NonNullable<DeviceAlarmNotifyMethod['templates']>['trigger']
type RecordValue = Record<string, unknown>
const record = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}
const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const enabled = (value: unknown) => !value || text(record(value).value ?? value) === 'enabled'
const configuration = (channel: RecordValue) => record(channel.channelConfiguration ?? channel.configuration)

/** A stored binding is enough for the existing type picker, but does not prove its template still exists. */
export function hasTemplateBinding(channel: RecordValue): boolean {
  const config = configuration(channel)
  return Boolean(text(config.templateId) && text(config.notifierId))
}

/** Verify the exact accessible channel/template association; deleted or replaced bindings cannot report ready. */
export function verifiedTemplateState(detail: unknown, channel: RecordValue): TemplateState {
  const snapshot = record(detail)
  if (!Array.isArray(snapshot.channels)) return 'unknown'
  if (!enabled(record(snapshot.provider).state)) return 'missing'
  const config = configuration(channel)
  return snapshot.channels.some(value => {
    const item = record(value)
    const current = record(item.channel)
    const binding = configuration(current)
    const template = record(item.template)
    return Boolean(text(channel.id) && current.id === channel.id
      && current.channelProvider === channel.channelProvider && enabled(current.state)
      && text(template.id) && template.id === config.templateId && template.id === binding.templateId
      && text(template.configId) && template.configId === config.notifierId && template.configId === binding.notifierId)
  }) ? 'ready' : 'missing'
}

/** Missing is actionable even when another type is unknown; template-free delivery stays a separate neutral state. */
export function aggregateTemplateState(states: TemplateState[]): TemplateState {
  if (states.includes('missing')) return 'missing'
  if (!states.length || states.includes('unknown')) return 'unknown'
  return states.every(state => state === 'unneeded') ? 'unneeded' : 'ready'
}
