<template>
<a-modal
      v-model:open="fillModalOpen"
      :class="{ 'mm-fill-modal-en': locale.startsWith('en') }"
      :title="t('ModbusMapping.ui.importTitle')"
      :ok-text="fillModalOkText"
      :cancel-text="t('ModbusMapping.ui.cancel')"
      :width="480"
      @ok="confirmFillMapping"
    >
      <p class="fill-modal-tip">{{ " " + t('ModbusMapping.ui.importResponsePrefix') }}<b>{{ t('ModbusMapping.ui.startAddress') }}</b>{{ t('ModbusMapping.ui.importStartSuffix') + " " }}<b>0</b>{{ t('ModbusMapping.ui.punctuation5') + " " }}</p>
      <a-form layout="vertical" class="fill-modal-form">
        <a-form-item :label="t('ModbusMapping.ui.addressFormat')">
          <a-radio-group v-model:value="fillAddressFormat" size="small" button-style="solid">
            <a-radio-button value="plc">{{ t('ModbusMapping.ui.plcFormat') }}</a-radio-button>
            <a-radio-button value="fc">{{ t('ModbusMapping.ui.fcFormat') }}</a-radio-button>
          </a-radio-group>
          <div class="form-help">{{ t('ModbusMapping.ui.addressFormatHint') }}</div>
        </a-form-item>
        <a-form-item :label="t('ModbusMapping.ui.startOffset')">
          <a-input-number v-model:value="fillPduStart" :min="0" :max="65535" style="width: 100%" />
        </a-form-item>
        <template v-if="fillModalMultiWord">
          <a-alert type="info" show-icon class="fill-multi-reg-alert">
            <template #message>{{ " " + t('ModbusMapping.ui.detectedPrefix') + " " }}<b>{{ fillModalWordCount }}</b>{{ " " + t('ModbusMapping.ui.detectedWordsSuffix') + " " }}</template>
            <template #description>{{ " " + t('ModbusMapping.ui.mergePrefix') }}<b>{{ t('ModbusMapping.ui.oneMapping') }}</b>{{ t('ModbusMapping.ui.rangeOrPrefix') }}<b>{{ t('ModbusMapping.ui.splitPrefix') + " " }}{{ fillModalWordCount }}{{ " " + t('ModbusMapping.ui.rowsSuffix') }}</b>{{ t('ModbusMapping.ui.splitDescriptionSuffix') + " " }}</template>
          </a-alert>
          <a-form-item :label="t('ModbusMapping.ui.wordHandling')" style="margin-bottom: 8px">
            <a-radio-group v-model:value="fillWordMergeMode" size="small">
              <a-radio value="merge">{{ t('ModbusMapping.ui.mergeRange') }}</a-radio>
              <a-radio value="split">{{ t('ModbusMapping.ui.splitRegisters') }}</a-radio>
            </a-radio-group>
          </a-form-item>
        </template>
        <template v-if="fillModalCoilMode">
          <a-form-item :label="t('ModbusMapping.ui.endBitOffset')">
            <a-input-number v-model:value="fillCoilEndPdu" :min="0" :max="65535" style="width: 100%" />
            <div class="form-help">{{ t('ModbusMapping.ui.endBitHint') }}</div>
          </a-form-item>
          <a-alert
            v-if="fillCoilMultiBit"
            type="info"
            show-icon
            class="fill-multi-reg-alert"
            :message="t('ModbusMapping.ui.multipleBits')"
            :description="t('ModbusMapping.ui.multipleBitsHint')"
          />
        </template>
        <a-form-item :label="t('ModbusMapping.ui.generatedAddress')">
          <template v-if="fillModalMultiWord && fillWordMergeMode === 'split'">
            <pre class="fill-preview mono fill-preview-multi">{{ fillSplitPreviewSample }}</pre>
            <div class="form-help">{{ t('ModbusMapping.ui.splitHint') }}</div>
          </template>
          <template v-else>
            <div class="fill-preview mono">{{ fillMappingPreviewStr || '—' }}</div>
          </template>
        </a-form-item>
      </a-form>
    </a-modal>
</template>
<script setup lang="ts">
import { toRefs } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ModbusFillView } from '../useModbusMapping'
const props = defineProps<{
  model: Pick<
    ModbusFillView,
    | 'fillModalOpen'
    | 'fillPduStart'
    | 'fillCoilEndPdu'
    | 'fillAddressFormat'
    | 'fillWordMergeMode'
    | 'fillModalCoilMode'
    | 'fillModalWordCount'
    | 'fillModalMultiWord'
    | 'fillCoilMultiBit'
    | 'fillModalOkText'
    | 'fillSplitPreviewSample'
    | 'fillMappingPreviewStr'
    | 'confirmFillMapping'
  >
}>()
const model = props.model
const {
  fillModalOpen,
  fillPduStart,
  fillCoilEndPdu,
  fillAddressFormat,
  fillWordMergeMode,
  fillModalCoilMode,
  fillModalWordCount,
  fillModalMultiWord,
  fillCoilMultiBit,
  fillModalOkText,
  fillSplitPreviewSample,
  fillMappingPreviewStr,
  confirmFillMapping
} = toRefs(model)
const { t, locale } = useI18n()
</script>
<style scoped lang="less" src="./FillMappingModal.less" />
