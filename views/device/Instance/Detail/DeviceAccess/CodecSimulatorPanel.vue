<template>
  <div class="codec-simulator-panel">
    <section class="codec-simulator-panel__workspace">
      <header class="codec-simulator-panel__header">
        <div class="codec-simulator-panel__heading">
          <h3>{{ $t('InstanceDeviceAccess.codecDebug.items') }}</h3>
          <span>{{ $t('InstanceDeviceAccess.codecDebug.itemCount', { count: list.length }) }}</span>
        </div>
        <a-popover v-model:open="addOpen" trigger="click" placement="bottomRight">
          <template #content>
            <div class="codec-simulator-panel__choices" @keydown.esc="addOpen = false">
              <button v-for="type in simulatorTypes" :key="type" type="button" class="codec-simulator-panel__choice" @click="handleAdd(type); addOpen = false">
                <AIcon :type="type === 'uplink' ? 'ArrowUpOutlined' : 'ArrowDownOutlined'" />
                <span>
                  <strong>{{ $t(`InstanceDeviceAccess.codecDebug.${type}Tag`) }}</strong>
                  <span>{{ $t(`InstanceDeviceAccess.codecDebug.${type}Description`) }}</span>
                </span>
              </button>
            </div>
          </template>
          <a-button type="primary" size="small" :aria-expanded="addOpen" @keydown.esc="addOpen = false">
            <template #icon><AIcon type="PlusOutlined" /></template>
            {{ $t('InstanceDeviceAccess.codecDebug.simulate') }}
          </a-button>
        </a-popover>
      </header>
      <div ref="simulatorContainerRef" class="codec-simulator-panel__main">
        <div v-if="list.length === 0" class="codec-simulator-panel__empty">
          <AIcon type="ExperimentOutlined" />
          <p>{{ $t('InstanceDeviceAccess.codecDebug.emptyItems') }}</p>
        </div>
        <template v-else>
          <CodecSimulatorItem
            v-for="(item, index) in list"
            :key="item.id"
            v-model="list[index]"
            :type="item.type"
            :metadata="metadata"
            :product-metadata="productMetadata"
            :transport="transport"
            @delete="handleDelete(index)"
            @send="handleSend"
            @move-up="handleMove(index, -1)"
            @move-down="handleMove(index, 1)"
          />
        </template>
      </div>
    </section>

    <aside class="codec-simulator-panel__log">
      <header class="codec-simulator-panel__header">
        <div class="codec-simulator-panel__heading">
          <h3>{{ $t('InstanceDeviceAccess.codecDebug.executionLog') }}</h3>
          <span>{{ $t('InstanceDeviceAccess.codecDebug.logCount', { count: logs.length }) }}</span>
        </div>
      </header>
      <div class="codec-simulator-panel__log-body" aria-live="polite">
        <div v-if="logs.length === 0" class="codec-simulator-panel__log-empty">
          <p>{{ $t('InstanceDeviceAccess.codecDebug.noLogs') }}</p>
        </div>
        <div v-else>
          <div v-for="(log, index) in logs" :key="index" :class="['codec-simulator-panel__log-item', log.type]">
            <span>{{ log.time }}</span>
            <span>{{ log.text }}</span>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import CodecSimulatorItem from './CodecSimulatorItem.vue'
import { useCodecSimulator } from './composables/useCodecSimulator'

const { t: $t } = useI18n()
const addOpen = ref(false)
const simulatorTypes = ['uplink', 'downlink'] as const
const props = defineProps<{
  deviceId: string
  metadata?: unknown
  productMetadata?: unknown
  transport?: string
}>()

// The panel is shared by both device detail shells and must debug the explicitly supplied device.
const deviceContext = computed(() => ({
  id: props.deviceId,
  metadata: props.metadata,
  productMetadata: props.productMetadata,
  transport: props.transport,
}))

const {
  list,
  logs,
  simulatorContainerRef,
  handleAdd,
  handleDelete,
  handleMove,
  handleSend,
  reset,
  fillData,
} = useCodecSimulator(deviceContext, $t)

defineExpose({ reset, fillData })
</script>

<style scoped lang="less">
.codec-simulator-panel {
  display: flex;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--jet-theme-border-secondary, #f0f0f0);
  border-radius: 8px;
  background: var(--jet-theme-bg-container, #fff);
  color: var(--jet-theme-text);
  font-family: var(--font-sans);
  font-size: var(--fs-body);
  line-height: var(--lh-normal);
  container: codec-simulator / inline-size;
}
.codec-simulator-panel__workspace,
.codec-simulator-panel__log {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
}
.codec-simulator-panel__workspace { flex: 1; }
.codec-simulator-panel__log {
  flex: 0 0 300px;
  border-left: 1px solid var(--jet-theme-border-secondary, #f0f0f0);
}
.codec-simulator-panel__header {
  display: flex;
  min-height: 48px;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
}
.codec-simulator-panel__log > .codec-simulator-panel__header {
  border-bottom: 1px solid var(--jet-theme-border-secondary, #f0f0f0);
}
.codec-simulator-panel__heading {
  display: flex;
  align-items: baseline;
  gap: 6px;
  h3 {
    margin: 0;
    color: var(--jet-theme-text-title);
    font-size: var(--fs-14);
    font-weight: 600;
    line-height: var(--lh-normal);
  }
  span { color: var(--jet-theme-text-secondary, #767e8c); font-size: var(--fs-meta); }
}
.codec-simulator-panel__main,
.codec-simulator-panel__log-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--jet-theme-border, #d9d9d9) transparent;
}
.codec-simulator-panel__main { padding: 0 12px 12px; }
.codec-simulator-panel__log-body { padding: 10px 12px; }
.codec-simulator-panel__empty,
.codec-simulator-panel__log-empty {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--jet-theme-text-secondary, #767e8c);
  font-size: var(--fs-caption);
  text-align: center;
}
.codec-simulator-panel__empty {
  gap: 10px;
  padding: 24px;
  p { margin: 0; }
  :deep(.anticon) { color: var(--jet-theme-primary, #1677ff); opacity: 0.55; font-size: var(--fs-28); }
}
.codec-simulator-panel__choices {
  display: flex;
  width: 14rem;
  flex-direction: column;
  gap: 0.375rem;
  font-family: var(--font-sans);
  font-size: var(--fs-body);
  line-height: var(--lh-normal);
}
.codec-simulator-panel__choice {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--jet-theme-border-secondary, #edf0f5);
  border-radius: 6px;
  background: var(--jet-theme-bg-container, #fff);
  color: var(--jet-theme-text, #1f2329);
  font: inherit;
  text-align: left;
  cursor: pointer;
  > .anticon { color: var(--jet-theme-primary, #1677ff); }
  > span:last-child { display: flex; flex-direction: column; gap: 2px; }
  strong { font-size: var(--fs-body); font-weight: 500; }
  span span { color: var(--jet-theme-text-secondary, #767e8c); font-size: var(--fs-caption); }
  &:hover { border-color: var(--jet-theme-primary, #1677ff); background: var(--jet-theme-bg-layout, #f8fafc); }
  &:focus-visible { outline: 2px solid var(--jet-theme-primary, #1677ff); outline-offset: 2px; }
}
.codec-simulator-panel__log-item {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  font-size: var(--fs-meta);
  line-height: var(--lh-relaxed);
  span:first-child { flex-shrink: 0; color: var(--jet-theme-text-secondary, #767e8c); font-variant-numeric: tabular-nums; }
  span:last-child { min-width: 0; overflow-wrap: anywhere; }
  &.success span:last-child { color: color-mix(in srgb, var(--jet-theme-success) 60%, var(--jet-theme-text)); }
  &.warn span:last-child { color: color-mix(in srgb, var(--jet-theme-warning) 60%, var(--jet-theme-text)); }
  &.process span:last-child,
  &.operation span:last-child { color: var(--jet-theme-primary-active); }
}
@container codec-simulator (max-width: 1000px) {
  .codec-simulator-panel__log { flex-basis: 240px; }
}
@container codec-simulator (max-width: 640px) {
  .codec-simulator-panel__log { flex-basis: 180px; }
}
</style>
