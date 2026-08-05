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
  DEFAULT_DIGITAL_FAMILY,
  DEFAULT_TEXT_FAMILY,
  clamp,
  createTickLabels,
  createTickLines,
  describeArc,
  formatGaugeValue,
  getAngleByValue,
  getGaugeName,
  getGaugeRange,
  getGaugeValue,
  getScaleValues,
  mergeGaugeConfig,
  polarToCartesian,
  toNumber,
  type GaugeDataItem,
  type GaugeInfo,
  type GaugeSvgModel,
  type GaugeWidgetProps
} from '../shared'

interface Gauge3StyleConfig {
  arcAngle: number
  gaugeWidth: number
  showName: boolean
  backgroundColor: string
  progressColor: string
  pointerColor: string
  labelColor: string
  valueColor: string
  titleColor: string
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

const { dataSourceList, getValue } = useGaugeDashboardData(props, 'gauge3')

const defaultConfig: Gauge3StyleConfig = {
  arcAngle: 270,
  gaugeWidth: 14,
  showName: false,
  backgroundColor: '#d6dce4',
  progressColor: '#f08d50',
  pointerColor: '#ea6b1b',
  labelColor: '#6e7680',
  valueColor: '#5d5048',
  titleColor: '#7d8793'
}

const buildModel = (rawItem: GaugeDataItem, cellSize: number): GaugeSvgModel => {
  const item = rawItem as GaugeDataItem
  const config = mergeGaugeConfig(defaultConfig, item)
  const range = getGaugeRange(props.info, { min: 0, max: 180, unit: 'MPH' })
  const value = getGaugeValue(item, getValue)
  const title = getGaugeName(item, 'Speed')
  const size = Math.max(cellSize, 120)
  const centerX = size / 2
  const centerY = size * 0.58
  const outerRadius = size * 0.39
  const gaugeWidth = Math.max(size * 0.035, (toNumber(config.gaugeWidth, defaultConfig.gaugeWidth) / 200) * size)
  const arcAngle = clamp(toNumber(config.arcAngle, defaultConfig.arcAngle), 220, 300)
  const startAngle = 360 - arcAngle / 2
  const endAngle = 360 + arcAngle / 2
  const majorValues = getScaleValues(range.min, range.max, 9)
  const pointerAngle = getAngleByValue(value, range.min, range.max, startAngle, endAngle)
  const pointerTip = polarToCartesian(centerX, centerY, outerRadius - gaugeWidth * 1.1, pointerAngle)
  const pointerTail = polarToCartesian(centerX, centerY, size * 0.06, pointerAngle + 180)
  const bandStart = startAngle + arcAngle * 0.42
  const bandPalette = ['#f3dc5f', '#f5c45c', '#f3a65b', `${config.progressColor}`]

  return {
    size,
    circles: [
      {
        cx: centerX,
        cy: centerY,
        r: size * 0.05,
        fill: '#f2f4f7',
        stroke: '#d3dae2',
        strokeWidth: size * 0.01
      },
      {
        cx: centerX,
        cy: centerY,
        r: size * 0.026,
        fill: '#e7edf3'
      }
    ],
    paths: [
      {
        d: describeArc(centerX, centerY, outerRadius, startAngle, endAngle),
        stroke: `${config.backgroundColor}`,
        strokeWidth: gaugeWidth,
        lineCap: 'round',
        opacity: 0.45
      },
      ...bandPalette.map((color, index) => {
        const segmentStart = bandStart + ((endAngle - bandStart) / bandPalette.length) * index
        const segmentEnd = bandStart + ((endAngle - bandStart) / bandPalette.length) * (index + 1)

        return {
          d: describeArc(centerX, centerY, outerRadius, segmentStart, segmentEnd),
          stroke: color,
          strokeWidth: gaugeWidth + size * 0.012,
          lineCap: 'round' as const
        }
      })
    ],
    lines: [
      ...createTickLines({
        centerX,
        centerY,
        min: range.min,
        max: range.max,
        startAngle,
        endAngle,
        majorValues,
        minorSteps: 1,
        majorInnerRadius: outerRadius - gaugeWidth * 0.8,
        majorOuterRadius: outerRadius + gaugeWidth * 0.18,
        minorInnerRadius: outerRadius - gaugeWidth * 0.52,
        minorOuterRadius: outerRadius + gaugeWidth * 0.08,
        majorColor: '#8d949d',
        minorColor: '#b7bfc8',
        majorWidth: size * 0.008,
        minorWidth: size * 0.005
      }),
      {
        x1: pointerTail.x,
        y1: pointerTail.y,
        x2: pointerTip.x,
        y2: pointerTip.y,
        stroke: `${config.pointerColor}`,
        width: size * 0.015,
        lineCap: 'round'
      }
    ],
    rects: [
      {
        x: size * 0.38,
        y: size * 0.78,
        width: size * 0.24,
        height: size * 0.12,
        fill: '#f3eee9',
        stroke: '#786a60',
        strokeWidth: size * 0.006,
        rx: size * 0.012,
        ry: size * 0.012
      }
    ],
    texts: [
      ...createTickLabels({
        centerX,
        centerY,
        min: range.min,
        max: range.max,
        startAngle,
        endAngle,
        values: majorValues,
        radius: outerRadius - gaugeWidth * 1.45,
        color: `${config.labelColor}`,
        size: size * 0.052,
        formatter: (tick) => `${Math.round(tick)}`,
        weight: 600
      }),
      ...(config.showName
        ? [
            {
              x: centerX,
              y: centerY + size * 0.03,
              text: title,
              size: size * 0.06,
              color: `${config.titleColor}`,
              anchor: 'middle',
              baseline: 'middle',
              family: DEFAULT_TEXT_FAMILY
            }
          ]
        : []),
      {
        x: centerX,
        y: centerY + size * 0.15,
        text: range.unit || 'MPH',
        size: size * 0.07,
        color: `${config.titleColor}`,
        anchor: 'middle',
        baseline: 'middle',
        family: DEFAULT_TEXT_FAMILY,
        weight: 700
      },
      {
        x: centerX,
        y: size * 0.845,
        text: formatGaugeValue(value, 0),
        size: size * 0.075,
        color: `${config.valueColor}`,
        anchor: 'middle',
        baseline: 'middle',
        family: DEFAULT_DIGITAL_FAMILY,
        letterSpacing: size * 0.006
      }
    ]
  }
}
</script>
