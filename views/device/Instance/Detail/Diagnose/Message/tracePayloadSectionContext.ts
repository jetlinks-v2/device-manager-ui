import type { ComputedRef, Ref } from 'vue'
import type { DeviceMessageInfo } from './tracePayloadFormat'
import type { TracePayloadFormat } from './tracePayloadFormat'

export type TraceSection = {
  raw: string
  format: TracePayloadFormat
  parsed: unknown | null
  deviceInfo: DeviceMessageInfo | null
  truncated: boolean
}

export type TracePayloadSectionCtx = {
  sectionModes: Ref<Record<number, 'structured' | 'raw'>>
  hexModes: Ref<Record<number, 'dump' | 'stream'>>
  setSectionMode: (idx: number, v: 'structured' | 'raw') => void
  setHexMode: (idx: number, v: 'dump' | 'stream') => void
  segmentOptions: ComputedRef<{ label: string; value: string }[]>
  hexSegmentOptions: ComputedRef<{ label: string; value: string }[]>
  propertyTableRows: (info: DeviceMessageInfo) => {
    key: string
    id: string
    name: string
    value: string
    /** 是否在当前实例产品物模型 properties 中有定义 */
    inModel: boolean
  }[]
  propertyDisplayName: (id: string) => string
  isPropertyDefinedInModel: (id: string) => boolean
  functionDisplayName: (id: string) => string
  eventDisplayName: (id: string) => string
  formatValue: (v: unknown) => string
  prettyJson: (obj: unknown) => string
  displayRawPretty: (raw: string) => string
  hexStreamText: (raw: string) => string
  canStructured: (section: TraceSection) => boolean
  isPropertyRelatedMessage: (info: DeviceMessageInfo) => boolean
  isFunctionRelatedMessage: (info: DeviceMessageInfo) => boolean
  isEventRelatedMessage: (info: DeviceMessageInfo) => boolean
}
