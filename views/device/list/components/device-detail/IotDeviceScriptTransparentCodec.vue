<template>
  <div class="parsing-script">
    <div class="script-toolbar">
      <div class="script-toolbar__hint">
        <ExclamationCircleOutlined />
        <template v-if="topTitle === 'rest'">
          {{ $t('IotDeviceDetail.scriptCodec.deviceConfigPrefix') }}
          <a-button type="link" size="small" class="script-link" @click="resetDeviceCodec">
            {{ $t('IotDeviceDetail.common.reset') }}
          </a-button>
          {{ $t('IotDeviceDetail.scriptCodec.deviceConfigSuffix') }}
        </template>
        <template v-else>
          {{ $t('IotDeviceDetail.scriptCodec.productConfigPrefix') }}
          <a-button
            type="link"
            size="small"
            class="script-link"
            :style="editLinkStyle"
            @click="readOnly = false"
          >
            {{ $t('IotDeviceDetail.common.edit') }}
          </a-button>
          {{ $t('IotDeviceDetail.scriptCodec.productConfigSuffix') }}
        </template>
      </div>
      <a-tooltip :title="$t('IotDeviceDetail.scriptCodec.fullscreen')">
        <ExpandOutlined class="script-toolbar__expand" @click="toggle" />
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
        language="javascript"
        style="height: 100%"
        theme="vs"
        :registrationTypescript="typescriptTip"
        :init="editorInit"
      />
    </div>

    <div class="script-debug">
      <div class="script-debug__panel">
        <div class="script-debug__title">
          <strong>{{ $t('IotDeviceDetail.scriptCodec.mockInput') }}</strong>
          <div class="script-debug__route">
            <template v-if="isMqttTransport">
              <span>Topic:</span>
              <a-auto-complete
                v-model:value="topic"
                :options="topicOptions"
                :allow-clear="true"
                :filter-option="filterOption"
                :placeholder="$t('IotDeviceDetail.scriptCodec.topicPlaceholder')"
                style="width: 18.75rem"
              />
            </template>
            <template v-else>
              <span>URL:</span>
              <a-input
                v-model:value="url"
                :placeholder="$t('IotDeviceDetail.scriptCodec.urlPlaceholder')"
                style="width: 18.75rem"
              />
            </template>
          </div>
        </div>
        <a-textarea
          v-model:value="simulation"
          :rows="5"
          :placeholder="$t('IotDeviceDetail.scriptCodec.dataPlaceholder')"
        />
      </div>
      <div class="script-debug__panel">
        <div class="script-debug__title">
          <strong>{{ $t('IotDeviceDetail.scriptCodec.parseResult') }}</strong>
        </div>
        <a-textarea
          :value="resultDisplay"
          :readonly="true"
          :auto-size="{ minRows: 5 }"
          :style="resultStyle"
        />
      </div>
    </div>

    <div class="script-actions">
      <a-button
        type="primary"
        :loading="loading"
        :disabled="debugDisabled"
        @click="debug"
      >
        {{ $t('IotDeviceDetail.scriptCodec.debug') }}
      </a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
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
  editLinkStyle,
  editorEl,
  editorInit,
  editorValue,
  filterOption,
  isMqttTransport,
  loading,
  readOnly,
  resetDeviceCodec,
  resultDisplay,
  resultStyle,
  saveCodec,
  savingConfig,
  simulation,
  toggle,
  topTitle,
  topic,
  topicOptions,
  typescriptTip,
  url,
  warnReadonly,
  debug,
} = useIotDeviceScriptTransparentCodec(props, () => emit('updated'))

defineExpose({
  saveCodec,
  savingConfig,
})
</script>

<style scoped lang="less" src="./IotDeviceScriptTransparentCodec.less"></style>
