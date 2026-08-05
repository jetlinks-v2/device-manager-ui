<template>
  <GaugeGrid
    :dataSourceList="dataSourceList"
    :style="style"
  >
    <template #default="{ item, cellSize }">
      <GaugeSvgScene :model="buildModel(item, cellSize)" />
    </template>
  </GaugeGrid>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import GaugeGrid from '../components/GaugeGrid.vue'
import GaugeSvgScene from '../components/GaugeSvgScene.vue'
import { useGaugeDashboardData } from '../hooks/useGaugeDashboardData'
import {
  DEFAULT_TEXT_FAMILY,
  createTickLines,
  getGaugeName,
  getGaugeRange,
  getGaugeValue,
  mergeGaugeConfig,
  polarToCartesian,
  type GaugeDataItem,
  type GaugeInfo,
  type GaugePolygonSpec,
  type GaugeSvgModel,
  type GaugeTextSpec,
  type GaugeWidgetProps
} from '../shared'

interface GaugeCompassStyleConfig {
  showName: boolean
  backgroundColor: string
  textColor: string
  northColor: string
  southColor: string
  ringColor: string
}

const props = defineProps({
  info: {
    type: Object as PropType<GaugeInfo>,
    required: true
  },
  style: {
    type: [Object, String] as PropType<GaugeWidgetProps['style']>,
    default: () => ({})
  },
  isEdit: {
    type: Boolean,
    default: false
  }
})

const { dataSourceList, getValue } = useGaugeDashboardData(props, 'gaugeCompass')

const defaultConfig: GaugeCompassStyleConfig = {
  showName: false,
  backgroundColor: '#25282d',
  textColor: '#f4f5f7',
  northColor: '#d85a5a',
  southColor: '#f4f5f7',
  ringColor: '#aeb4bb'
}

const createTriangle = (
  centerX: number,
  centerY: number,
  angle: number,
  length: number,
  baseWidth: number
): GaugePolygonSpec => {
  const tip = polarToCartesian(centerX, centerY, length, angle)
  const left = polarToCartesian(centerX, centerY, baseWidth, angle - 90)
  const right = polarToCartesian(centerX, centerY, baseWidth, angle + 90)

  return {
    points: `${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`
  }
}

const buildDirectionLabels = (
  centerX: number,
  centerY: number,
  radius: number,
  color: string
): GaugeTextSpec[] => {
  const labels = [
    { angle: 0, text: 'N', size: 0.085, weight: 700 },
    { angle: 45, text: 'NE', size: 0.048, weight: 500 },
    { angle: 90, text: 'E', size: 0.052, weight: 600 },
    { angle: 135, text: 'SE', size: 0.048, weight: 500 },
    { angle: 180, text: 'S', size: 0.052, weight: 600 },
    { angle: 225, text: 'SW', size: 0.048, weight: 500 },
    { angle: 270, text: 'W', size: 0.052, weight: 600 },
    { angle: 315, text: 'NW', size: 0.048, weight: 500 }
  ]

  return labels.map((item) => {
    const point = polarToCartesian(centerX, centerY, radius, item.angle)
    return {
      x: point.x,
      y: point.y,
      text: item.text,
      size: radius * item.size,
      color,
      anchor: 'middle',
      baseline: 'middle',
      weight: item.weight,
      family: DEFAULT_TEXT_FAMILY
    }
  })
}

const buildModel = (rawItem: GaugeDataItem, cellSize: number): GaugeSvgModel => {
  const item = rawItem as GaugeDataItem
  const config = mergeGaugeConfig(defaultConfig, item)
  const range = getGaugeRange(props.info, { min: 0, max: 360, unit: '°' })
  const value = getGaugeValue(item, getValue)
  const title = getGaugeName(item, 'Compass')
  const size = Math.max(cellSize, 120)
  const centerX = size / 2
  const centerY = size / 2
  const outerRadius = size * 0.43
  const majorValues = Array.from({ length: 36 }, (_, index) => range.min + ((range.max - range.min) / 36) * index)
  const pointerAngle = ((value - range.min) / Math.max(range.max - range.min, 1)) * 360
  const northTriangle = createTriangle(centerX, centerY, pointerAngle, outerRadius * 0.9, size * 0.045)
  const southTriangle = createTriangle(centerX, centerY, pointerAngle + 180, outerRadius * 0.5, size * 0.034)

  return {
    size,
    circles: [
      {
        cx: centerX,
        cy: centerY,
        r: outerRadius + size * 0.02,
        fill: '#f2f3f5'
      },
      {
        cx: centerX,
        cy: centerY,
        r: outerRadius,
        fill: `${config.backgroundColor}`,
        stroke: '#2f3338',
        strokeWidth: size * 0.012
      },
      {
        cx: centerX,
        cy: centerY,
        r: size * 0.04,
        fill: '#f2f3f5',
        stroke: '#b9c0c8',
        strokeWidth: size * 0.01
      }
    ],
    lines: [
      ...createTickLines({
        centerX,
        centerY,
        min: range.min,
        max: range.max,
        startAngle: 0,
        endAngle: 360,
        majorValues,
        minorSteps: 1,
        majorInnerRadius: outerRadius - size * 0.065,
        majorOuterRadius: outerRadius - size * 0.005,
        minorInnerRadius: outerRadius - size * 0.04,
        minorOuterRadius: outerRadius - size * 0.005,
        majorColor: `${config.ringColor}`,
        minorColor: 'rgba(255,255,255,0.35)',
        majorWidth: size * 0.006,
        minorWidth: size * 0.0035
      }),
      {
        x1: polarToCartesian(centerX, centerY, outerRadius * 0.55, pointerAngle + 180).x,
        y1: polarToCartesian(centerX, centerY, outerRadius * 0.55, pointerAngle + 180).y,
        x2: polarToCartesian(centerX, centerY, outerRadius * 0.9, pointerAngle).x,
        y2: polarToCartesian(centerX, centerY, outerRadius * 0.9, pointerAngle).y,
        stroke: '#dbe1e7',
        width: size * 0.01,
        lineCap: 'round'
      }
    ],
    polygons: [
      {
        ...northTriangle,
        fill: `${config.northColor}`,
        opacity: 0.95
      },
      {
        ...southTriangle,
        fill: `${config.southColor}`,
        opacity: 0.9
      }
    ],
    texts: [
      ...buildDirectionLabels(centerX, centerY, outerRadius * 0.72, `${config.textColor}`),
      ...(config.showName
        ? [
            {
              x: centerX,
              y: size * 0.84,
              text: title,
              size: size * 0.055,
              color: `${config.textColor}`,
              anchor: 'middle' as const,
              baseline: 'middle' as const,
              family: DEFAULT_TEXT_FAMILY
            }
          ]
        : [])
    ]
  }
}
</script>
