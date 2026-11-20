<template>
  <div class="parsing-script">
    <section class="script-config-section">
    <h4>{{ $t('deviceDetailOptimization.script') }}</h4>
    <div class="script-toolbar">
      <div class="script-toolbar__hint">
        <ExclamationCircleOutlined />
        {{ $t(hasIndependentCodec ? 'deviceDetailOptimization.deviceCodec' : readOnly ? 'deviceDetailOptimization.inheritedCodec' : 'deviceDetailOptimization.editingCodec') }}
      </div>
      <a-tooltip :title="$t('IotDeviceDetail.scriptCodec.fullscreen')">
        <a-button type="text" class="script-toolbar__expand" :aria-label="$t('IotDeviceDetail.scriptCodec.fullscreen')" @click="toggle"><ExpandOutlined /></a-button>
      </a-tooltip>
    </div>

    <div ref="editorEl" class="script-editor">
      <div
        v-show="readOnly"
        class="script-editor__mask"
        @click="warnReadonly"
      />
      <monaco-editor
        v-model:modelValue="editorValue"
        :read-only="readOnly || savingConfig || resettingConfig"
        :auto-format="false"
        language="javascript"
        style="height: 100%"
        theme="vs"
        :registrationTypescript="typescriptTip"
        :init="editorInit"
      />
    </div>

    </section>
    <CodecDebugPanel v-model:topic="topic" v-model:url="url" v-model:payload="simulation"
      :state="{ mqtt: isMqttTransport, options: topicOptions, loading, disabled: debugDisabled, result: resultDisplay, success: resultSuccess, finishedAt: resultTime }"
      @debug="debug" />


  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import CodecDebugPanel from '../../../components/CodecDebugPanel.vue'
import { ExpandOutlined, ExclamationCircleOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'

import { useIotDeviceScriptTransparentCodec } from '../../hooks/useIotDeviceScriptTransparentCodec'
import type { IotDevice } from '../../types'

const props = defineProps({
  device: { type: Object as PropType<IotDevice>, required: true },
  productId: { type: String, default: undefined },
  codec: { type: Object as PropType<Record<string, any> | null>, default: null },
})

const emit = defineEmits<{
  (e: 'updated'): void
}>()

const { t: $t } = useI18n()
const {
  debugDisabled,
  beginEdit,
  confirmLeave,
  editorEl,
  editorInit,
  editorValue,
  isMqttTransport,
  loading,
  isDirty,
  hasIndependentCodec,
  readOnly,
  reloadCodec,
  resetDeviceCodec,
  resultDisplay,
  resultSuccess,
  resultTime,
  saveCodec,
  saveDisabled,
  savingConfig,
  resettingConfig,
  simulation,
  toggle,
  topic,
  topicOptions,
  typescriptTip,
  url,
  warnReadonly,
  debug,
} = useIotDeviceScriptTransparentCodec(props, () => emit('updated'))

defineExpose({
  beginEdit,
  confirmLeave,
  isDirty,
  readOnly,
  reloadCodec,
  resetDeviceCodec,
  resettingConfig,
  saveCodec,
  saveDisabled,
  savingConfig,
})
</script>

<style scoped lang="less" src="./IotDeviceScriptTransparentCodec.less"></style>
