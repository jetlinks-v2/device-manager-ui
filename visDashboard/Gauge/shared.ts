import type { StyleValue } from 'vue'

export interface GaugeRangeConfig {
  unit?: string
  min?: number
  max?: number
}

export interface GaugeExtraConfig {
  gaugeConfig?: GaugeRangeConfig
}

export interface GaugeInfo {
  componentProps?: Record<string, Record<string, unknown>>
  extraProps?: {
    config?: GaugeExtraConfig
    options?: unknown[]
  }
  dataSourceProps?: unknown[]
}

export interface GaugeWidgetProps {
  info: GaugeInfo
  style?: StyleValue
  isEdit?: boolean
}

export interface GaugeDataItem {
  key: string | number
  name?: string
  value?: number
  isMock?: boolean
  config?: Record<string, unknown>
  sourceId?: string
  deviceId?: string
  mappingId?: string
}

export interface GaugeCircleSpec {
  cx: number
  cy: number
  r: number
  fill?: string
  stroke?: string
  strokeWidth?: number
  opacity?: number
}

export interface GaugeLineSpec {
  x1: number
  y1: number
  x2: number
  y2: number
  stroke: string
  width: number
  opacity?: number
  lineCap?: 'round' | 'butt' | 'square'
}

export interface GaugePathSpec {
  d: string
  fill?: string
  stroke?: string
  strokeWidth?: number
  opacity?: number
  lineCap?: 'round' | 'butt' | 'square'
  lineJoin?: 'round' | 'bevel' | 'miter'
  dasharray?: string
}

export interface GaugeRectSpec {
  x: number
  y: number
  width: number
  height: number
  fill?: string
  stroke?: string
  strokeWidth?: number
  opacity?: number
  rx?: number
  ry?: number
}

export interface GaugePolygonSpec {
  points: string
  fill?: string
  stroke?: string
  strokeWidth?: number
  opacity?: number
}

export interface GaugeTextSpec {
  x: number
  y: number
  text: string
  size: number
  color: string
  weight?: number | string
  anchor?: string
  baseline?: string
  letterSpacing?: number
  family?: string
  opacity?: number
}

export interface GaugeSvgModel {
  size: number
  circles?: GaugeCircleSpec[]
  lines?: GaugeLineSpec[]
  paths?: GaugePathSpec[]
  rects?: GaugeRectSpec[]
  polygons?: GaugePolygonSpec[]
  texts?: GaugeTextSpec[]
}

export type GaugeConfigFieldKind = 'slider' | 'number' | 'switch' | 'color' | 'select'

export interface GaugeConfigField {
  key: string
  label: string
  kind: GaugeConfigFieldKind
  min?: number
  max?: number
  step?: number
  placeholder?: string
  options?: Array<{ label: string; value: string | number }>
}

export interface TickLineOptions {
  centerX: number
  centerY: number
  min: number
  max: number
  startAngle: number
  endAngle: number
  majorValues: number[]
  minorSteps: number
  majorInnerRadius: number
  majorOuterRadius: number
  minorInnerRadius: number
  minorOuterRadius: number
  majorColor: string
  minorColor: string
  majorWidth: number
  minorWidth: number
}

export interface TickLabelOptions {
  centerX: number
  centerY: number
  min: number
  max: number
  startAngle: number
  endAngle: number
  values: number[]
  radius: number
  color: string
  size: number
  weight?: number | string
  formatter?: (value: number, index: number) => string
}

export const DEFAULT_TEXT_FAMILY = "'DIN Alternate', 'Trebuchet MS', 'Segoe UI', sans-serif"
export const DEFAULT_DIGITAL_FAMILY = "'Share Tech Mono', 'Consolas', monospace"

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export const toNumber = (value: unknown, fallback: number) => {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

export const normalizeValue = (value: number, min: number, max: number) => {
  if (max === min) return 0
  return clamp((value - min) / (max - min), 0, 1)
}

export const getAngleByValue = (value: number, min: number, max: number, startAngle: number, endAngle: number) =>
  startAngle + normalizeValue(value, min, max) * (endAngle - startAngle)

export const polarToCartesian = (centerX: number, centerY: number, radius: number, angle: number) => {
  const radians = ((angle - 90) * Math.PI) / 180
  return {
    x: centerX + radius * Math.cos(radians),
    y: centerY + radius * Math.sin(radians)
  }
}

export const describeArc = (centerX: number, centerY: number, radius: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(centerX, centerY, radius, startAngle)
  const end = polarToCartesian(centerX, centerY, radius, endAngle)
  const sweep = Math.abs(endAngle - startAngle)
  const largeArcFlag = sweep > 180 ? 1 : 0

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`
}

export const getScaleValues = (min: number, max: number, segments: number) => {
  const safeSegments = Math.max(1, segments)
  const step = (max - min) / safeSegments
  return Array.from({ length: safeSegments + 1 }, (_, index) => Number((min + step * index).toFixed(4)))
}

export const formatGaugeValue = (value: number, digits = 1) => {
  const safeValue = toNumber(value, 0)
  if (Number.isInteger(safeValue)) {
    return `${safeValue}`
  }
  return safeValue.toFixed(digits)
}

export const getGaugeRange = (
  info: GaugeInfo | undefined,
  defaults: Required<GaugeRangeConfig>
): Required<GaugeRangeConfig> => {
  const config = info?.extraProps?.config?.gaugeConfig || {}
  const min = toNumber(config.min, defaults.min)
  let max = toNumber(config.max, defaults.max)

  if (max === min) {
    max = min + 1
  }

  return {
    min,
    max,
    unit: `${config.unit ?? defaults.unit}`
  }
}

export const getGaugeValue = (
  item: GaugeDataItem,
  getter: (item: GaugeDataItem) => unknown,
  fallback = 0
) => {
  const sourceValue = item.isMock ? item.value : getter(item)
  return toNumber(sourceValue, toNumber(item.value, fallback))
}

export const getGaugeName = (item: GaugeDataItem, fallback: string) => `${item.name || fallback}`

export const mergeGaugeConfig = <T extends object>(
  defaults: T,
  item: GaugeDataItem
): T => ({
  ...defaults,
  ...(item.config || {})
}) as T

export const createTickLines = (options: TickLineOptions): GaugeLineSpec[] => {
  const {
    centerX,
    centerY,
    min,
    max,
    startAngle,
    endAngle,
    majorValues,
    minorSteps,
    majorInnerRadius,
    majorOuterRadius,
    minorInnerRadius,
    minorOuterRadius,
    majorColor,
    minorColor,
    majorWidth,
    minorWidth
  } = options

  const lines: GaugeLineSpec[] = []

  majorValues.forEach((value, index) => {
    const angle = getAngleByValue(value, min, max, startAngle, endAngle)
    const start = polarToCartesian(centerX, centerY, majorInnerRadius, angle)
    const end = polarToCartesian(centerX, centerY, majorOuterRadius, angle)

    lines.push({
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      stroke: majorColor,
      width: majorWidth,
      lineCap: 'round'
    })

    if (index === majorValues.length - 1 || minorSteps <= 0) return

    const nextValue = majorValues[index + 1]
    const gap = (nextValue - value) / (minorSteps + 1)

    Array.from({ length: minorSteps }).forEach((_, minorIndex) => {
      const minorValue = value + gap * (minorIndex + 1)
      const minorAngle = getAngleByValue(minorValue, min, max, startAngle, endAngle)
      const minorStart = polarToCartesian(centerX, centerY, minorInnerRadius, minorAngle)
      const minorEnd = polarToCartesian(centerX, centerY, minorOuterRadius, minorAngle)

      lines.push({
        x1: minorStart.x,
        y1: minorStart.y,
        x2: minorEnd.x,
        y2: minorEnd.y,
        stroke: minorColor,
        width: minorWidth,
        lineCap: 'round'
      })
    })
  })

  return lines
}

export const createTickLabels = (options: TickLabelOptions): GaugeTextSpec[] => {
  const {
    centerX,
    centerY,
    min,
    max,
    startAngle,
    endAngle,
    values,
    radius,
    color,
    size,
    weight = 500,
    formatter
  } = options

  return values.map((value, index) => {
    const angle = getAngleByValue(value, min, max, startAngle, endAngle)
    const point = polarToCartesian(centerX, centerY, radius, angle)

    return {
      x: point.x,
      y: point.y,
      text: formatter ? formatter(value, index) : `${value}`,
      size,
      color,
      weight,
      anchor: 'middle',
      baseline: 'middle',
      family: DEFAULT_TEXT_FAMILY
    }
  })
}

export const interpolatePalette = (colors: string[], count: number) => {
  if (count <= 1) return [colors[0] || '#8bc6e8']
  if (colors.length === 1) return Array.from({ length: count }, () => colors[0])

  return Array.from({ length: count }, (_, index) => {
    const ratio = index / Math.max(count - 1, 1)
    const scaled = ratio * (colors.length - 1)
    const lowerIndex = Math.floor(scaled)
    const upperIndex = Math.min(colors.length - 1, lowerIndex + 1)

    if (lowerIndex === upperIndex) return colors[lowerIndex]

    return ratio < 0.5 ? colors[lowerIndex] : colors[upperIndex]
  })
}
