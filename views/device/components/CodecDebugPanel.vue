<template>
  <section class="codec-debug">
    <header class="codec-debug__header">
      <strong>{{ $t('IotDeviceDetail.scriptCodec.mockInput') }}</strong>
      <a-button v-if="state.canDebug !== false" type="primary" :loading="state.loading" :disabled="state.disabled" @click="emit('debug')">
        <template #icon><PlayCircleOutlined /></template>
        {{ $t('IotDeviceDetail.scriptCodec.debug') }}
      </a-button>
    </header>
    <div class="codec-debug__body">
      <a-form layout="vertical" class="codec-debug__form">
        <a-form-item :label="state.mqtt ? 'Topic' : 'URL'">
          <a-auto-complete v-if="state.mqtt" :value="topic" :options="state.options" allow-clear
            :aria-label="'Topic'" :placeholder="$t('IotDeviceDetail.scriptCodec.topicPlaceholder')"
            :filter-option="filterOption" @update:value="emit('update:topic', String($event ?? ''))" />
          <a-input v-else :value="url" aria-label="URL" :placeholder="$t('IotDeviceDetail.scriptCodec.urlPlaceholder')"
            @update:value="emit('update:url', $event)" />
        </a-form-item>
        <a-form-item :label="$t('InstanceDeviceAccess.payloadView.raw')">
          <a-textarea :value="payload" :aria-label="$t('IotDeviceDetail.scriptCodec.mockInput')" :rows="4"
            :placeholder="$t('IotDeviceDetail.scriptCodec.dataPlaceholder')" @update:value="emit('update:payload', $event)" />
        </a-form-item>
      </a-form>
      <section v-if="state.finishedAt" class="codec-debug__result" :class="{ 'is-error': state.success === false, 'is-success': state.success === true }">
        <header class="codec-debug__result-header" role="status">
          <CheckCircleFilled v-if="state.success === true" />
          <CloseCircleFilled v-else-if="state.success === false" />
          <strong>{{ $t(state.success === true ? 'deviceDetailOptimization.debugSuccess' : state.success === false ? 'Parsing.mod.debugError' : 'IotDeviceDetail.scriptCodec.parseResult') }}</strong>
          <time v-if="state.finishedAt">{{ state.finishedAt }}</time>
        </header>
        <pre class="codec-debug__output" tabindex="0" :aria-label="$t('IotDeviceDetail.scriptCodec.parseResult')">{{ state.result || '--' }}</pre>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { PlayCircleOutlined, CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'

interface DebugState {
  mqtt: boolean
  options: Array<{ value: string }>
  loading: boolean
  disabled: boolean
  canDebug?: boolean
  result?: string
  success?: boolean
  finishedAt?: string
}
defineProps<{ state: DebugState; topic: string; url: string; payload: string }>()
const emit = defineEmits<{
  (e: 'update:topic', value: string): void
  (e: 'update:url', value: string): void
  (e: 'update:payload', value: string): void
  (e: 'debug'): void
}>()
const { t: $t } = useI18n()
const filterOption = (input: string, option: { value?: string }) => Boolean(option.value?.includes(input))
</script>

<style scoped lang="less">
.codec-debug { min-width: 0; border: 1px solid var(--jet-theme-border-secondary); border-radius: var(--r-2); background: var(--jet-theme-bg-container); }
.codec-debug__header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--jet-theme-border-secondary); }
.codec-debug__header strong { color: var(--jet-theme-text); font-size: var(--fs-14); }
.codec-debug__body { padding: var(--space-4); }
.codec-debug__form :deep(.ant-form-item) { margin-bottom: var(--space-3); }
.codec-debug__form :deep(.ant-form-item-label) { padding-bottom: var(--space-1); }
.codec-debug__form :deep(.ant-select) { width: 100%; }
.codec-debug__form :deep(textarea) { font-family: var(--font-family-code, monospace); }
.codec-debug__result { overflow: hidden; border: 1px solid var(--jet-theme-border); border-radius: var(--r-1); background: var(--jet-theme-bg-layout); }
.codec-debug__result-header { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--jet-theme-border-secondary); color: var(--jet-theme-text-secondary); font-size: var(--fs-12); }
.codec-debug__result-header strong { font-weight: 500; }
.codec-debug__result-header time { color: var(--jet-theme-text-secondary); }
.codec-debug__output { margin: 0; min-height: 12rem; max-height: 26rem; overflow: auto; padding: var(--space-3); color: var(--jet-theme-text); font-size: var(--fs-12); line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; }
.codec-debug__result.is-error { border-color: var(--jet-theme-error); }
.is-error .codec-debug__result-header > :not(time) { color: var(--jet-theme-error); }
.is-success .codec-debug__result-header :deep(.anticon) { color: var(--jet-theme-success); }
.codec-debug__output:focus-visible { outline: 2px solid var(--jet-theme-primary); outline-offset: -2px; }
</style>
