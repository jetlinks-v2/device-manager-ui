<template>
  <article class="property-card" :data-compact="compact">
    <header class="property-card__head">
      <div class="property-card__title">
        <strong>{{ property.name }}</strong>
        <em>{{ property.identifier }}</em>
      </div>
      <div v-if="headActions.length" class="property-card__actions property-card__actions--head">
        <a-tooltip v-for="action in headActions" :key="action.key" :title="action.title">
          <a-button
            type="text"
            size="small"
            class="property-card__icon-btn"
            :disabled="action.disabled"
            :loading="action.loading"
            :aria-label="action.title"
            @click="emit('action', action.key, property)"
          >
            <template v-if="!action.loading" #icon>
              <AIcon :type="action.icon" aria-hidden="true" />
            </template>
          </a-button>
        </a-tooltip>
      </div>
    </header>

    <div class="property-card__value" :class="{ 'is-updating': valueUpdating }">
      <span>{{ displayValue(property.value) }}</span>
    </div>

    <IotDevicePropertyMiniChart
      v-if="showTrend && trendDeviceId"
      :device-id="trendDeviceId"
      :property="property"
    />

    <dl class="property-card__meta">
      <div>
        <dt>{{ $t('IotDeviceDetail.runtime.dataType') }}</dt>
        <dd>{{ displayValue(property.dataType) }}</dd>
      </div>
      <div>
        <dd class="property-card__time">{{ displayValue(property.updatedAt) }}</dd>
      </div>
    </dl>

    <div v-if="footActions.length" class="property-card__actions property-card__actions--foot">
      <a-tooltip v-for="action in footActions" :key="action.key" :title="action.title">
        <a-button
          type="text"
          size="small"
          class="property-card__icon-btn"
          :disabled="action.disabled"
          :loading="action.loading"
          :aria-label="action.title"
          @click="emit('action', action.key, property)"
        >
          <template v-if="!action.loading" #icon>
            <AIcon :type="action.icon" aria-hidden="true" />
          </template>
        </a-button>
      </a-tooltip>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'

import IotDevicePropertyMiniChart from './IotDevicePropertyMiniChart.vue'
import type { RealtimePropertyRow } from './iotDeviceDetail.types'

interface IotDevicePropertyCardAction {
  key: string
  title: string
  icon: string
  disabled?: boolean
  loading?: boolean
  show?: boolean
  placement?: 'head' | 'foot'
}

const props = defineProps({
  property: {
    type: Object as PropType<RealtimePropertyRow>,
    required: true,
  },
  actions: {
    type: Array as PropType<IotDevicePropertyCardAction[]>,
    default: () => [],
  },
  compact: {
    type: Boolean,
    default: false,
  },
  showTrend: {
    type: Boolean,
    default: false,
  },
  trendDeviceId: {
    type: String,
    default: '',
  },
})

const emit = defineEmits<{
  action: [key: string, property: RealtimePropertyRow]
}>()

const { t: $t } = useI18n()
const visibleActions = computed(() => props.actions.filter((item) => item.show !== false))
const headActions = computed(() => visibleActions.value.filter((item) => item.placement === 'head'))
const footActions = computed(() => visibleActions.value.filter((item) => item.placement !== 'head'))
const valueUpdating = ref(false)
let valueUpdateTimer: ReturnType<typeof setTimeout> | undefined

function displayValue(value?: string | null) {
  return value && String(value).trim() ? String(value) : '--'
}

watch(
  () => props.property.value,
  (next, prev) => {
    if (prev === undefined || next === prev) return
    valueUpdating.value = true
    if (valueUpdateTimer) clearTimeout(valueUpdateTimer)
    valueUpdateTimer = setTimeout(() => {
      valueUpdating.value = false
      valueUpdateTimer = undefined
    }, 520)
  },
)

onBeforeUnmount(() => {
  if (valueUpdateTimer) clearTimeout(valueUpdateTimer)
})

</script>

<style scoped src="./IotDevicePropertyCard.css"></style>
