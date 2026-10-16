<template>
<div class="decode-debug-col decode-debug-input">
                <div class="decode-sim-bar">
                  <span class="decode-sim-title">{{ t('ModbusMapping.ui.simulation') }}</span>
                  <a-input
                    v-model:value="decodeSimAddressStr"
                    class="decode-sim-addr-input"
                    size="small"
                    allow-clear
                    placeholder="40001 / 3_0-7 / 2:40001"
                  />
                  <code
                    class="decode-sim-hex-preview"
                    :title="decodeSimHexFull"
                  >{{ decodeSimHexShort }}</code>
                  <a-space :size="0" class="decode-sim-actions">
                    <a-tooltip :title="t('ModbusMapping.ui.regenerate')">
                      <a-button type="text" size="small" class="decode-sim-icon-btn" @click="refreshDecodeSimFrame">
                        <template #icon><ReloadOutlined /></template>
                      </a-button>
                    </a-tooltip>
                    <a-tooltip :title="t('ModbusMapping.ui.applyPayload')">
                      <a-button type="text" size="small" class="decode-sim-icon-btn" @click="applyDecodeSimToPayload">
                        <template #icon><DownOutlined /></template>
                      </a-button>
                    </a-tooltip>
                  </a-space>
                </div>
                <div v-if="decodeSimError" class="decode-sim-error">{{ decodeSimError }}</div>
                <div v-else-if="decodeSimMetaLine" class="decode-sim-meta">{{ decodeSimMetaLine }}</div>
                <a-textarea
                  v-model:value="decodePayload"
                  :placeholder="t('ModbusMapping.ui.payloadPlaceholder')"
                  :rows="2"
                  class="decode-textarea decode-textarea--compact"
                />
                <div
                  v-if="decodePayload.trim() && decodeInputNormalized.parseError"
                  class="decode-input-meta decode-input-meta--error"
                >
                  <span class="decode-parse-warn">{{ decodeInputNormalized.parseError }}</span>
                </div>
                <div v-if="decoding" class="decode-auto-hint">{{ t('ModbusMapping.ui.decoding') }}</div>
                <div class="decode-pdu-coil-base">
                  <span class="decode-pdu-coil-base-lbl">{{ t('ModbusMapping.ui.coilBase') }}</span>
                  <a-input-number
                    v-model:value="decodePduCoilBase"
                    :min="0"
                    :max="65535"
                    size="small"
                    :step="1"
                    :controls="true"
                    class="decode-pdu-coil-base-inn"
                  />
                  <a-tooltip
                    :title="t('ModbusMapping.ui.coilBaseHint')"
                  >
                    <span class="decode-pdu-coil-base-hint">?</span>
                  </a-tooltip>
                </div>
              </div>
</template>
<script setup lang="ts">
import { toRefs } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ModbusDecodeView } from '../useModbusMapping'
import { ReloadOutlined, DownOutlined } from '@ant-design/icons-vue'
const props = defineProps<{
  model: Pick<
    ModbusDecodeView,
    | 'decodePayload'
    | 'decodePduCoilBase'
    | 'decoding'
    | 'decodeSimAddressStr'
    | 'decodeSimError'
    | 'refreshDecodeSimFrame'
    | 'applyDecodeSimToPayload'
    | 'decodeSimHexFull'
    | 'decodeSimHexShort'
    | 'decodeSimMetaLine'
    | 'decodeInputNormalized'
  >
}>()
const model = props.model
const {
  decodePayload,
  decodePduCoilBase,
  decoding,
  decodeSimAddressStr,
  decodeSimError,
  refreshDecodeSimFrame,
  applyDecodeSimToPayload,
  decodeSimHexFull,
  decodeSimHexShort,
  decodeSimMetaLine,
  decodeInputNormalized
} = toRefs(model)
const { t } = useI18n()
</script>
<style scoped lang="less" src="./DecodeInput.less" />
