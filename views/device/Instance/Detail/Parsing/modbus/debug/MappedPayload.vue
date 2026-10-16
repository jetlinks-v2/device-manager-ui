<template>
<div class="decode-visual-map decode-visual-map--embedded">
                            <div class="dvm-hint">
                              <b>{{ t('ModbusMapping.ui.wordMode') }}</b>{{ t('ModbusMapping.ui.wordHoverPrefix') }}<strong>{{ t('ModbusMapping.ui.registerOutline') }}</strong>{{ t('ModbusMapping.ui.outerOutline') }}<b>{{ t('ModbusMapping.ui.bitMode') }}</b>{{ t('ModbusMapping.ui.bitGridPrefix') }}<strong>{{ t('ModbusMapping.ui.bitOrder') }}</strong>{{ t('ModbusMapping.ui.bitOrderSuffix') }}<strong>0/1</strong>{{ t('ModbusMapping.ui.bitColorOnly') }}<strong>{{ t('ModbusMapping.ui.bitCellBackground') }}</strong>{{ t('ModbusMapping.ui.bitColorExplain') + " " }}</div>
                            <!-- 保持/输入寄存器：每字 2 字节外层寄存器框 -->
                            <div
                              v-if="decodeVisualPayload.pduKind === 'word'"
                              class="dvm-byte-strip dvm-byte-strip--word"
                            >
                              <div
                                v-for="(grp, gi) in decodeWordRegisterGroups"
                                :key="'wr' + gi"
                                class="dvm-reg-wrap"
                                :class="decodeRegWrapHoverClass('word', gi)"
                              >
                                <span class="dvm-reg-chip">#{{ gi }}</span>
                                <div class="dvm-reg-inner">
                                  <ByteCell v-for="(b, j) in grp.bytes" :key="'db' + grp.start + j" :model="model" :payload="decodeVisualPayload" :byte="{ value: b, index: grp.start + j, bitKey: 'bit' + grp.start + j }" />
                                </div>
                              </div>
                            </div>
                            <!-- 线圈/离散：每字节一块外框 -->
                            <div
                              v-else
                              class="dvm-byte-strip dvm-byte-strip--bit"
                            >
                              <div
                                v-for="(b, bi) in decodeVisualPayload.data"
                                :key="'db' + bi"
                                class="dvm-reg-wrap dvm-reg-wrap--coil"
                                :class="decodeRegWrapHoverClass('bit', bi)"
                              >
                                <span class="dvm-reg-chip">B{{ bi }}</span>
                                <div class="dvm-reg-inner dvm-reg-inner--single">
                                  <ByteCell :model="model" :payload="decodeVisualPayload" :byte="{ value: b, index: bi, bitKey: 'bit' + bi, metaKey: 'bidx' + bi }" />
                                </div>
                              </div>
                            </div>
                            <div class="dvm-prop-list">
                              <div
                                v-for="seg in decodeVisualPayload.segments"
                                :key="seg.propertyId"
                                class="dvm-prop-compact"
                                :class="{ 'dvm-prop-compact--hover': decodeHoverSegmentId === seg.propertyId }"
                                @mouseenter="decodeHoverSegmentId = seg.propertyId"
                                @mouseleave="decodeHoverSegmentId = null"
                              >
                                <span class="dvm-dot" :class="'dvm-t-' + seg.tone" />
                                <span class="dvm-prop-id">{{ seg.propertyId }}</span>
                                <span class="dvm-prop-val">{{ seg.displayValue }}</span>
                                <span class="dvm-prop-meta">
                                  <span class="dvm-prop-range">{{
                                    decodeSegmentRangeLabel(
                                      seg,
                                      decodeVisualPayload.pduKind === 'bit' ? decodePduCoilBase : 0,
                                    )
                                  }}</span>
                                  <span v-if="seg.registerHint" class="dvm-prop-reg">{{ seg.registerHint }}</span>
                                </span>
                              </div>
                            </div>
                            <div v-if="decodeVisualPayload.warnings.length" class="dvm-warns">
                              <div v-for="(w, wi) in decodeVisualPayload.warnings" :key="'dw' + wi">{{ w }}</div>
                            </div>
                            <div v-if="decodeVisualPayload.unmappedProps.length" class="dvm-unmapped">{{ " " + t('ModbusMapping.ui.unmappedPrefix') }}{{ decodeVisualPayload.unmappedProps.join(', ') }}
                            </div>
                          </div>
</template>
<script setup lang="ts">

import { toRefs } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ModbusDecodeView } from '../useModbusMapping'
import ByteCell from './ByteCell.vue'
import type { ModbusMappedPayload } from '../types'
const props = defineProps<{
  model: Pick<
    ModbusDecodeView,
    | 'decodePduCoilBase'
    | 'decodeResult'
    | 'decodeHoverSegmentId'
    | 'decodeVisualPayload'
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
  payload: ModbusMappedPayload
}>()
const model = props.model
const {
  decodePduCoilBase,
  decodeResult,
  decodeHoverSegmentId,
  decodeShowMappingGrid,
  decodeWordRegisterGroups,
  decodeRegWrapHoverClass,
  bytesToHexSpaced,
  decodeBitValueClass,
  decodeSegmentRangeLabel,
  formatDecodePropValue,
  FC_NAMES
} = toRefs(model)
const { payload: decodeVisualPayload } = toRefs(props)
const { t } = useI18n()

</script>
<style scoped lang="less" src="./MappedPayload.less" />
