<template>
<div  class="mp-pdu-fusion">
                        <div class="mp-pdu-fusion-head">
                          <span class="mp-pdu-fusion-ttl">{{ t('ModbusMapping.ui.pduData') }}</span>
                          <template v-if="decodeShowMappingGrid && decodeVisualPayload">
                            <span class="mp-pdu-fusion-meta"
                              >{{ decodeVisualPayload.fcLabel }} · {{ decodeVisualPayload.data.length }}{{ " " + t('ModbusMapping.ui.bytesSuffix', decodeVisualPayload.data.length) }}</span
                            >
                            <span v-if="mappedPayload.pduKind === 'word'" class="mp-pdu-fusion-meta"
                              >{{ t('ModbusMapping.ui.wordBasePrefix') + " " }}{{ mappedPayload.minPdu }}</span
                            >
                            <span v-else class="mp-pdu-fusion-meta"
                              >{{ t('ModbusMapping.ui.coilBasePrefix') + " " }}{{ mappedPayload.minPdu }}</span
                            >
                            <span class="mp-pdu-fusion-badge mp-pdu-fusion-badge--ok">{{ t('ModbusMapping.ui.mapped') }}</span>
                          </template>
                          <template v-else-if="decodePduStrip">
                            <span class="mp-pdu-fusion-meta"
                              >{{ FC_NAMES[decodePduStrip.fc] || t('ModbusMapping.ui.functionCodePrefix') + decodePduStrip.fc.toString(16) }} ·
                              {{ decodePduStrip.data.length }}{{ " " + t('ModbusMapping.ui.bytesSuffix', decodePduStrip.data.length) }}</span
                            >
                            <span
                              v-if="decodeResult?.success && decodeVisualPayload?.kind === 'fallback'"
                              class="mp-pdu-fusion-badge mp-pdu-fusion-badge--warn"
                              >{{ t('ModbusMapping.ui.unaligned') }}</span
                            >
                            <span v-else-if="decodeResult && !decodeResult.success" class="mp-pdu-fusion-badge mp-pdu-fusion-badge--err"
                              >{{ t('ModbusMapping.ui.decodeFailed') }}</span
                            >
                            <span v-else class="mp-pdu-fusion-badge mp-pdu-fusion-badge--muted">{{ t('ModbusMapping.ui.pendingDecode') }}</span>
                          </template>
                        </div>

                        <template v-if="decodeShowMappingGrid && decodeVisualPayload">
                          <MappedPayload :model="model" :payload="mappedPayload" />
                        </template>
                        <template v-else>
                          <div
                            class="dvm-byte-strip dvm-byte-strip--plain"
                            :class="
                              decodePduStrip.fc === 1 || decodePduStrip.fc === 2
                                ? 'dvm-byte-strip--bit'
                                : 'dvm-byte-strip--word-plain'
                            "
                          >
                            <div
                              v-for="(b, bi) in decodePduStrip.data"
                              :key="'pdu-plain' + bi"
                              class="dvm-byte-cell"
                            >
                              <div class="dvm-byte-idx">D{{ bi }}</div>
                              <div class="dvm-byte-hex dvm-t-x">
                                {{ b.toString(16).padStart(2, '0').toUpperCase() }}
                              </div>
                              <div class="dvm-byte-bits dvm-byte-bits--plain">
                                <div
                                  v-for="slot in 8"
                                  :key="'bp' + bi + '-' + slot"
                                  :class="['dvm-bit', 'dvm-bit--plain', decodeBitValueClass(b, 8 - slot)]"
                                  :title="
                                    'B' +
                                    bi +
                                    ' · bit' +
                                    (8 - slot) +
                                    ' = ' +
                                    ((b >> (8 - slot)) & 1)
                                  "
                                />
                              </div>
                              <template v-if="decodePduStrip.fc === 1 || decodePduStrip.fc === 2">
                                <div class="dvm-bit-meta-row" aria-hidden="true">
                                  <span
                                    v-for="slot in 8"
                                    :key="'pidx' + bi + '-' + slot"
                                    class="dvm-bit-idx-lbl"
                                    >{{ 8 - slot }}</span
                                  >
                                </div>
                              </template>
                            </div>
                          </div>
                          <div
                            v-if="decodeResult?.success && decodeVisualPayload?.kind === 'fallback'"
                            class="decode-visual-fallback decode-visual-fallback--embedded"
                          >
                            <a-alert type="info" show-icon class="dvm-fallback-alert">
                              <template #message>{{ decodeVisualPayload.note || t('ModbusMapping.ui.propertyList') }}</template>
                              <template #description>
                                <div v-if="decodeVisualPayload.data.length" class="dvm-fallback-hex">
                                  {{ bytesToHexSpaced(decodeVisualPayload.data) }}
                                </div>
                                <div class="dvm-fallback-props">
                                  <div
                                    v-for="(val, key) in decodeVisualPayload.props"
                                    :key="String(key)"
                                    class="dvm-fallback-row"
                                  >
                                    <span class="dvm-fallback-k">{{ key }}</span>
                                    <span class="dvm-fallback-v">{{ formatDecodePropValue(val) }}</span>
                                  </div>
                                </div>
                              </template>
                            </a-alert>
                          </div>
                          <a-alert
                            v-if="decodeResult && !decodeResult.success"
                            type="error"
                            :message="t('ModbusMapping.ui.decodeFailed')"
                            show-icon
                            class="mp-dvm-alert"
                            :description="decodeResult.reason"
                          />
                          <div v-if="!decodeResult" class="mp-pdu-fusion-foot">{{ " " + t('ModbusMapping.ui.autoDecodeHint') + " " }}</div>
                        </template>
                      </div>
</template>
<script setup lang="ts">
import { computed, toRefs } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ModbusDecodeView } from '../useModbusMapping'
import MappedPayload from './MappedPayload.vue'
import type { ModbusMappedPayload } from '../types'
const props = defineProps<{
  model: Pick<
    ModbusDecodeView,
    | 'decodePduCoilBase'
    | 'decodeResult'
    | 'decodeHoverSegmentId'
    | 'decodeVisualPayload'
    | 'decodePduStrip'
    | 'decodeShowMappingGrid'
    | 'decodeWordRegisterGroups'
    | 'decodeRegWrapHoverClass'
    | 'decodeByteHexSurfaceClass'
    | 'decodeBitCellClass'
    | 'bytesToHexSpaced'
    | 'decodeBitValueClass'
    | 'decodeSegmentRangeLabel'
    | 'formatDecodePropValue'
    | 'FC_NAMES'
  >
  pduStrip: NonNullable<ModbusDecodeView['decodePduStrip']>
}>()
const model = props.model
const {
  decodePduCoilBase,
  decodeResult,
  decodeHoverSegmentId,
  decodeVisualPayload,
  decodeShowMappingGrid,
  decodeWordRegisterGroups,
  decodeRegWrapHoverClass,
  bytesToHexSpaced,
  decodeBitValueClass,
  decodeSegmentRangeLabel,
  formatDecodePropValue,
  FC_NAMES
} = toRefs(model)
const { pduStrip: decodePduStrip } = toRefs(props)
// 父级条件已限定映射网格，这里仅补充分拆后的类型收窄。
const mappedPayload = computed(() => model.decodeVisualPayload as ModbusMappedPayload)
const { t } = useI18n()
</script>
<style scoped lang="less" src="./DecodedPayload.less" />
