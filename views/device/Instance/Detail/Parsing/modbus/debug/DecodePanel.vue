<template>
<div class="debug-body decode-debug-wrap">
            <div class="decode-debug-grid">
              <!-- 左侧：输入 -->
              <DecodeInput :model="model" />
              <!-- 右侧：Modbus 报文解释 -->
              <div class="decode-debug-col decode-debug-parse">
                <div class="debug-label">{{ t('ModbusMapping.ui.frameMapping') }}</div>
                <div v-if="!decodePayload.trim()" class="decode-parse-empty">{{ t('ModbusMapping.ui.pasteHint') }}</div>
                <div v-else-if="decodeInputNormalized.parseError" class="decode-parse-empty decode-parse-err">
                  {{ decodeInputNormalized.parseError }}
                </div>
                <div v-else-if="decodeFrameAnalysis" class="modbus-parse-card modbus-parse-compact">
                  <template v-for="a in [decodeFrameAnalysis]" :key="'dec'">
                    <div class="mp-compact-head">
                      <a-tag size="small" class="mp-tag-tight">{{ a.linkTypeLabel }}</a-tag>
                      <span class="mp-head-meta">{{ t('ModbusMapping.ui.unitLabel') + " " }}<b>{{ a.unitId }}</b> · {{ a.fcLabel }}</span>
                    </div>
                    <div v-if="a.tcpHeader" class="mp-compact-line mp-mono mp-fade" :title="a.tcpHeader">
                      {{ a.tcpHeader }}
                    </div>
                    <div v-if="a.isException" class="mp-compact-exc">{{ a.exceptionLabel }}</div>
                    <template v-else>
                      <div
                        v-if="a.requestStartAddr !== undefined || a.requestQuantity !== undefined"
                        class="mp-compact-kv"
                      >
                        <template v-if="a.requestStartAddr !== undefined">
                          <span class="mp-ck">{{ t('ModbusMapping.ui.startAddress') }}</span><span class="mp-cv">{{ a.requestStartAddr }}</span>
                        </template>
                        <template v-if="a.requestQuantity !== undefined">
                          <span class="mp-ck">{{ t('ModbusMapping.ui.quantity') }}</span><span class="mp-cv">{{ a.requestQuantity }}</span>
                        </template>
                      </div>
                      <div v-if="a.byteCount !== undefined" class="mp-compact-kv">
                        <span class="mp-ck">{{ t('ModbusMapping.ui.dataBytes') }}</span><span class="mp-cv">{{ a.byteCount }}</span>
                        <template v-if="a.wordRegisterCount">
                          <span class="mp-ck">{{ t('ModbusMapping.ui.wordCount') }}</span><span class="mp-cv">{{ a.wordRegisterCount }}</span>
                        </template>
                      </div>
                      <!-- PDU 数据区：与映射融合；未解码仅字节标签，解码后着色映射 -->
                      <DecodedPayload v-if="decodePduStrip && !a.isException" :model="model" :pdu-strip="decodePduStrip" />
                      <div
                        v-else-if="a.dataHexPreview && a.dataHexPreview !== '—'"
                        class="mp-hex-box"
                      >
                        {{ a.dataHexPreview }}
                      </div>
                      <div v-if="a.registerPreview?.length" class="mp-reg-chips">
                        <span v-for="r in a.registerPreview" :key="r.index" class="mp-chip"
                          >#{{ r.index }} {{ r.uint16 }}</span
                        >
                      </div>
                      <div v-if="a.coilBitsPreview" class="mp-coil-bits">{{ a.coilBitsPreview }}</div>
                    </template>
                    <div v-if="a.crcLine" class="mp-crc-line" :class="{ 'mp-crc-bad': a.crcOk === false }">
                      {{ a.crcLine }}
                    </div>
                    <div v-for="(w, wi) in a.warnings" :key="'w' + wi" class="mp-warn-tight">{{ w }}</div>
                    <div class="mp-fill-row">
                      <a-button type="primary" size="small" :disabled="!canFillToMapping" @click="openFillMappingModal">{{ " " + t('ModbusMapping.ui.fillMapping') + " " }}</a-button>
                      <span class="mp-fill-hint">{{ t('ModbusMapping.ui.fillHint') }}</span>
                    </div>
                    <details v-if="decodeResult?.success" class="decode-json-details decode-json-details--in-card">
                      <summary>{{ t('ModbusMapping.ui.rawJson') }}</summary>
                      <pre class="debug-output">{{ JSON.stringify(decodeResult.outputs, null, 2) }}</pre>
                    </details>
                  </template>
                </div>
                <div v-else class="decode-parse-empty">{{ t('ModbusMapping.ui.shortFrame') }}</div>
                <a-alert
                  v-if="decodeFrameAnalysis && decodeResult && !decodeResult.success && !decodePduStrip"
                  type="error"
                  :message="t('ModbusMapping.ui.decodeFailed')"
                  show-icon
                  class="mp-dvm-alert mp-dvm-alert--standalone"
                  :description="decodeResult.reason"
                />
              </div>
            </div>
          </div>
</template>
<script setup lang="ts">
import { toRefs } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ModbusDecodeView } from '../useModbusMapping'
import DecodeInput from './DecodeInput.vue'
import DecodedPayload from './DecodedPayload.vue'
const props = defineProps<{
  model: Pick<
    ModbusDecodeView,
    | 'decodePayload'
    | 'decodePduCoilBase'
    | 'decoding'
    | 'decodeResult'
    | 'decodeHoverSegmentId'
    | 'decodeSimAddressStr'
    | 'decodeSimError'
    | 'refreshDecodeSimFrame'
    | 'applyDecodeSimToPayload'
    | 'decodeSimHexFull'
    | 'decodeSimHexShort'
    | 'decodeSimMetaLine'
    | 'decodeVisualPayload'
    | 'decodePduStrip'
    | 'decodeShowMappingGrid'
    | 'decodeWordRegisterGroups'
    | 'decodeRegWrapHoverClass'
    | 'decodeByteHexSurfaceClass'
    | 'decodeBitCellClass'
    | 'decodeInputNormalized'
    | 'decodeFrameAnalysis'
    | 'bytesToHexSpaced'
    | 'decodeBitValueClass'
    | 'decodeSegmentRangeLabel'
    | 'formatDecodePropValue'
    | 'FC_NAMES'
    | 'canFillToMapping'
    | 'openFillMappingModal'
  >
}>()
const model = props.model
const {
  decodePayload,
  decodeResult,
  decodePduStrip,
  decodeInputNormalized,
  decodeFrameAnalysis,
  canFillToMapping,
  openFillMappingModal
} = toRefs(model)
const { t } = useI18n()
</script>
<style scoped lang="less" src="./DecodePanel.less" />
