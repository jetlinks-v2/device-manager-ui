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
  clamp,
  formatGaugeValue,
  getGaugeName,
  getGaugeRange,
  getGaugeValue,
  getScaleValues,
  interpolatePalette,
  mergeGaugeConfig,
  normalizeValue,
  toNumber,
  type GaugeDataItem,
  type GaugeInfo,
  type GaugeSvgModel,
  type GaugeWidgetProps
} from '../shared'

interface Gauge2StyleConfig {
  barHeight: number
  showName: boolean
  markerColor: string
  coldColor: string
  hotColor: string
  trackColor: string
  titleColor: string
  labelColor: string
  valueColor: string
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

const { dataSourceList, getValue } = useGaugeDashboardData(props, 'gauge2')

const defaultConfig: Gauge2StyleConfig = {
  barHeight: 14,
  showName: true,
  markerColor: '#5b4e47',
  coldColor: '#8bc5eb',
  hotColor: '#ff5c4d',
  trackColor: '#dfe7f0',
  titleColor: '#6b8ba4',
  labelColor: '#39424c',
  valueColor: '#4c4c4c'
}

const buildModel = (rawItem: GaugeDataItem, cellSize: number): GaugeSvgModel => {
  const item = rawItem as GaugeDataItem
  const config = mergeGaugeConfig(defaultConfig, item)
  const range = getGaugeRange(props.info, { min: -60, max: 100, unit: '°C' })
  const value = getGaugeValue(item, getValue)
  const title = getGaugeName(item, 'Temperature')
  const size = Math.max(cellSize, 120)
  const startX = size * 0.14
  const endX = size * 0.88
  const upperY = size * 0.34
  const lowerY = size * 0.6
  const markerX = startX + normalizeValue(value, range.min, range.max) * (endX - startX)
  const barHeight = Math.max(size * 0.035, (toNumber(config.barHeight, defaultConfig.barHeight) / 200) * size)
  const majorValues = getScaleValues(range.min, range.max, 8)
  const segmentCount = 12
  const upperWidth = endX - startX
  const segmentGap = size * 0.005
  const segmentWidth = (upperWidth - segmentGap * (segmentCount - 1)) / segmentCount
  const segmentColors = interpolatePalette(
    [`${config.coldColor}`, '#b7d9f2', '#eed1bf', '#f6a26c', `${config.hotColor}`],
    segmentCount
  )

  return {
    size,
    circles: [
      {
        cx: startX,
        cy: lowerY + barHeight / 2,
        r: size * 0.06,
        fill: `${config.coldColor}`,
        stroke: '#5d7387',
        strokeWidth: size * 0.01
      },
      {
        cx: startX,
        cy: lowerY + barHeight / 2,
        r: size * 0.027,
        fill: '#b9d3e8'
      }
    ],
    rects: [
      {
        x: startX,
        y: upperY,
        width: upperWidth,
        height: barHeight,
        fill: '#f3f7fa',
        stroke: '#8a9197',
        strokeWidth: size * 0.004,
        rx: barHeight / 4,
        ry: barHeight / 4
      },
      ...segmentColors.map((color, index) => ({
        x: startX + index * (segmentWidth + segmentGap),
        y: upperY + size * 0.006,
        width: segmentWidth,
        height: barHeight - size * 0.012,
        fill: color,
        rx: size * 0.003,
        ry: size * 0.003
      })),
      {
        x: startX,
        y: lowerY,
        width: upperWidth,
        height: barHeight,
        fill: '#f4f7fa',
        stroke: '#7f858a',
        strokeWidth: size * 0.004,
        rx: barHeight / 2,
        ry: barHeight / 2
      },
      {
        x: startX,
        y: lowerY + size * 0.006,
        width: Math.max(markerX - startX, 0),
        height: barHeight - size * 0.012,
        fill: `${config.coldColor}`,
        rx: barHeight / 2,
        ry: barHeight / 2
      },
      {
        x: markerX - size * 0.015,
        y: upperY - size * 0.01,
        width: size * 0.03,
        height: barHeight + size * 0.02,
        fill: '#d1b29a',
        stroke: `${config.markerColor}`,
        strokeWidth: size * 0.004,
        rx: size * 0.01,
        ry: size * 0.01
      },
      {
        x: markerX - size * 0.015,
        y: lowerY - size * 0.01,
        width: size * 0.03,
        height: barHeight + size * 0.02,
        fill: '#d1b29a',
        stroke: `${config.markerColor}`,
        strokeWidth: size * 0.004,
        rx: size * 0.01,
        ry: size * 0.01
      }
    ],
    lines: [
      {
        x1: markerX,
        y1: upperY - size * 0.08,
        x2: markerX,
        y2: lowerY + barHeight + size * 0.08,
        stroke: `${config.markerColor}`,
        width: size * 0.012,
        lineCap: 'round'
      }
    ],
    texts: [
      ...(config.showName
        ? [
            {
              x: size / 2,
              y: size * 0.18,
              text: `${title}${range.unit ? `, ${range.unit}` : ''}`,
              size: size * 0.075,
              color: `${config.titleColor}`,
              anchor: 'middle',
              baseline: 'middle',
              family: DEFAULT_TEXT_FAMILY
            }
          ]
        : []),
      ...majorValues.flatMap((tick) => {
        const ratio = normalizeValue(tick, range.min, range.max)
        const x = startX + ratio * (endX - startX)

        return [
          {
            x,
            y: size * 0.25,
            text: formatGaugeValue(tick, 0),
            size: size * 0.048,
            color: `${config.labelColor}`,
            anchor: 'middle' as const,
            baseline: 'middle' as const,
            family: DEFAULT_TEXT_FAMILY
          },
          {
            x,
            y: size * 0.81,
            text: formatGaugeValue(tick, 0),
            size: size * 0.048,
            color: `${config.labelColor}`,
            anchor: 'middle' as const,
            baseline: 'middle' as const,
            family: DEFAULT_TEXT_FAMILY
          }
        ]
      }),
      {
        x: markerX,
        y: size * 0.53,
        text: formatGaugeValue(value, 1),
        size: size * 0.055,
        color: `${config.valueColor}`,
        anchor: 'middle',
        baseline: 'middle',
        family: DEFAULT_TEXT_FAMILY,
        weight: 700
      }
    ]
  }
}
</script>
