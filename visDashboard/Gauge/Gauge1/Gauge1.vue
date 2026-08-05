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

interface Gauge1StyleConfig {
  arcAngle: number
  gaugeWidth: number
  pointerLength: string | number
  pointerColor: string
  showName: boolean
  color1: string
  color2: string
  centerColor: string
  splitRatio: number
  valueColor: string
  titleColor: string
  labelColor: string
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

const { dataSourceList, getValue } = useGaugeDashboardData(props, 'gauge1')

const defaultConfig: Gauge1StyleConfig = {
  arcAngle: 230,
  gaugeWidth: 18,
  pointerLength: '82%',
  pointerColor: '#eb6d1f',
  showName: true,
  color1: '#7ec7f7',
  color2: '#f3a0a8',
  centerColor: '#d7dce2',
  splitRatio: 0.36,
  valueColor: '#544942',
  titleColor: '#8aa0b5',
  labelColor: '#78828f'
}

const getPointerRatio = (pointerLength: string | number) => {
  if (typeof pointerLength === 'number') {
    return clamp(pointerLength / 100, 0.45, 0.98)
  }

  if (typeof pointerLength === 'string' && pointerLength.endsWith('%')) {
    return clamp(Number(pointerLength.replace('%', '')) / 100, 0.45, 0.98)
  }

  return 0.82
}

const buildModel = (rawItem: GaugeDataItem, cellSize: number): GaugeSvgModel => {
  const item = rawItem as GaugeDataItem
  const config = mergeGaugeConfig(defaultConfig, item)
  const range = getGaugeRange(props.info, { min: -60, max: 60, unit: '°C' })
  const value = getGaugeValue(item, getValue)
  const title = getGaugeName(item, 'Temperature')
  const size = Math.max(cellSize, 120)
  const centerX = size / 2
  const centerY = size * 0.54
  const outerRadius = size * 0.34
  const gaugeWidth = Math.max(size * 0.05, (toNumber(config.gaugeWidth, defaultConfig.gaugeWidth) / 200) * size)
  const arcAngle = clamp(toNumber(config.arcAngle, defaultConfig.arcAngle), 180, 260)
  const startAngle = 360 - arcAngle / 2
  const endAngle = 360 + arcAngle / 2
  const warmRatio = clamp(toNumber(config.splitRatio, defaultConfig.splitRatio), 0.2, 0.45)
  const coldEndAngle = startAngle + arcAngle * warmRatio
  const hotStartAngle = endAngle - arcAngle * warmRatio
  const majorValues = getScaleValues(range.min, range.max, 8)
  const pointerAngle = getAngleByValue(value, range.min, range.max, startAngle, endAngle)
  const pointerLength = outerRadius * getPointerRatio(config.pointerLength)
  const pointerTip = polarToCartesian(centerX, centerY, pointerLength, pointerAngle)
  const pointerTail = polarToCartesian(centerX, centerY, size * 0.09, pointerAngle + 180)

  return {
    size,
    circles: [
      {
        cx: centerX,
        cy: centerY,
        r: size * 0.44,
        fill: '#f4f6f8',
        stroke: '#d8dde4',
        strokeWidth: size * 0.006
      },
      {
        cx: centerX,
        cy: centerY,
        r: size * 0.36,
        fill: '#fcfcfd',
        stroke: '#eef1f4',
        strokeWidth: size * 0.01
      },
      {
        cx: centerX,
        cy: centerY,
        r: size * 0.028,
        fill: '#ffffff',
        stroke: '#e0e5ea',
        strokeWidth: size * 0.012
      }
    ],
    paths: [
      {
        d: describeArc(centerX, centerY, outerRadius, startAngle, endAngle),
        stroke: '#eef1f4',
        strokeWidth: gaugeWidth + size * 0.02,
        opacity: 0.9,
        lineCap: 'round'
      },
      {
        d: describeArc(centerX, centerY, outerRadius, startAngle, coldEndAngle),
        stroke: `${config.color1}`,
        strokeWidth: gaugeWidth,
        lineCap: 'round'
      },
      {
        d: describeArc(centerX, centerY, outerRadius, coldEndAngle, hotStartAngle),
        stroke: `${config.centerColor}`,
        strokeWidth: gaugeWidth,
        lineCap: 'round'
      },
      {
        d: describeArc(centerX, centerY, outerRadius, hotStartAngle, endAngle),
        stroke: `${config.color2}`,
        strokeWidth: gaugeWidth,
        lineCap: 'round'
      }
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
        minorSteps: 4,
        majorInnerRadius: outerRadius - gaugeWidth * 0.78,
        majorOuterRadius: outerRadius + gaugeWidth * 0.12,
        minorInnerRadius: outerRadius - gaugeWidth * 0.52,
        minorOuterRadius: outerRadius + gaugeWidth * 0.02,
        majorColor: '#8e98a3',
        minorColor: '#bdc5ce',
        majorWidth: size * 0.009,
        minorWidth: size * 0.0045
      }),
      {
        x1: pointerTail.x,
        y1: pointerTail.y,
        x2: pointerTip.x,
        y2: pointerTip.y,
        stroke: `${config.pointerColor}`,
        width: size * 0.016,
        lineCap: 'round'
      }
    ],
    rects: [
      {
        x: size * 0.31,
        y: size * 0.78,
        width: size * 0.38,
        height: size * 0.12,
        fill: '#f3eee9',
        stroke: '#766c65',
        strokeWidth: size * 0.006,
        rx: size * 0.014,
        ry: size * 0.014
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
        size: size * 0.05,
        formatter: (tick) => `${Math.round(tick)}`,
        weight: 600
      }),
      ...(config.showName
        ? [
            {
              x: centerX,
              y: centerY - size * 0.02,
              text: title,
              size: size * 0.055,
              color: `${config.titleColor}`,
              anchor: 'middle',
              baseline: 'middle',
              family: DEFAULT_TEXT_FAMILY
            },
            {
              x: centerX,
              y: centerY + size * 0.085,
              text: range.unit || '°C',
              size: size * 0.07,
              color: `${config.titleColor}`,
              anchor: 'middle',
              baseline: 'middle',
              family: DEFAULT_TEXT_FAMILY,
              weight: 600
            }
          ]
        : []),
      {
        x: centerX,
        y: size * 0.845,
        text: formatGaugeValue(value, 1),
        size: size * 0.065,
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
