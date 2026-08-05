<template>
  <div class="gauge-scene">
    <svg
      class="gauge-svg"
      :viewBox="`0 0 ${model.size} ${model.size}`"
      aria-hidden="true"
    >
      <rect
        width="100%"
        height="100%"
        fill="transparent"
      />

      <circle
        v-for="(circle, index) in model.circles || []"
        :key="`circle-${index}`"
        :cx="circle.cx"
        :cy="circle.cy"
        :r="circle.r"
        :fill="circle.fill || 'transparent'"
        :stroke="circle.stroke"
        :stroke-width="circle.strokeWidth"
        :opacity="circle.opacity"
      />

      <path
        v-for="(path, index) in model.paths || []"
        :key="`path-${index}`"
        :d="path.d"
        :fill="path.fill || 'none'"
        :stroke="path.stroke"
        :stroke-width="path.strokeWidth"
        :stroke-linecap="path.lineCap"
        :stroke-linejoin="path.lineJoin"
        :stroke-dasharray="path.dasharray"
        :opacity="path.opacity"
      />

      <rect
        v-for="(rect, index) in model.rects || []"
        :key="`rect-${index}`"
        :x="rect.x"
        :y="rect.y"
        :width="rect.width"
        :height="rect.height"
        :fill="rect.fill || 'transparent'"
        :stroke="rect.stroke"
        :stroke-width="rect.strokeWidth"
        :opacity="rect.opacity"
        :rx="rect.rx"
        :ry="rect.ry"
      />

      <line
        v-for="(line, index) in model.lines || []"
        :key="`line-${index}`"
        :x1="line.x1"
        :y1="line.y1"
        :x2="line.x2"
        :y2="line.y2"
        :stroke="line.stroke"
        :stroke-width="line.width"
        :stroke-linecap="line.lineCap"
        :opacity="line.opacity"
      />

      <polygon
        v-for="(polygon, index) in model.polygons || []"
        :key="`polygon-${index}`"
        :points="polygon.points"
        :fill="polygon.fill || 'transparent'"
        :stroke="polygon.stroke"
        :stroke-width="polygon.strokeWidth"
        :opacity="polygon.opacity"
      />

      <text
        v-for="(text, index) in model.texts || []"
        :key="`text-${index}`"
        :x="text.x"
        :y="text.y"
        :fill="text.color"
        :font-size="text.size"
        :font-weight="text.weight"
        :text-anchor="text.anchor || 'start'"
        :dominant-baseline="text.baseline || 'auto'"
        :font-family="text.family"
        :letter-spacing="text.letterSpacing"
        :opacity="text.opacity"
      >
        {{ text.text }}
      </text>
    </svg>
  </div>
</template>

<script setup lang="ts">
import type { GaugeSvgModel } from '../shared'

defineProps<{
  model: GaugeSvgModel
}>()
</script>

<style scoped lang="less">
.gauge-scene,
.gauge-svg {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
