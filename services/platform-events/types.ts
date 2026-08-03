/**
 * PlatformEvent<TPayload> —— 平台级事件 envelope。
 *
 * 所有业务产源 emit 的事件都必须共用这层 envelope；产源自有字段只能放在 payload。
 */

export type PlatformEventSource =
  | 'video-event'
  | 'iot-event'
  | 'patrol-event'
  | 'behavior-event'
  | 'external'

export type PlatformEventStatus =
  | 'new'
  | 'in_progress'
  | 'resolved'
  | 'auto_resolved'
  | 'pending_manual_review'

export type PlatformEventSeverity = 'low' | 'normal' | 'high' | 'urgent'

export type PlatformEventSubjectKind =
  | 'channel'
  | 'device'
  | 'person'
  | 'area'

export interface PlatformEvent<TPayload = unknown> {
  id: string
  source: PlatformEventSource
  /** 产源自定义子类型 slug；video-event = scenePackRef，iot-event = event kind。 */
  subType: string
  occurredAt: string
  status: PlatformEventStatus

  severity: PlatformEventSeverity
  subjectKind: PlatformEventSubjectKind
  /** channelId / deviceId / personId / areaId */
  subjectRef: string
  subjectName?: string
  areaRef?: string

  title: string
  desc: string

  payload: TPayload
}

export function isPlatformEvent(value: unknown): value is PlatformEvent<unknown> {
  if (value === null || typeof value !== 'object') return false
  const event = value as Partial<Record<keyof PlatformEvent, unknown>>
  return (
    typeof event.id === 'string' &&
    typeof event.source === 'string' &&
    typeof event.subType === 'string' &&
    typeof event.occurredAt === 'string' &&
    typeof event.status === 'string' &&
    typeof event.severity === 'string' &&
    typeof event.subjectKind === 'string' &&
    typeof event.subjectRef === 'string' &&
    typeof event.title === 'string' &&
    typeof event.desc === 'string' &&
    event.payload !== undefined
  )
}

