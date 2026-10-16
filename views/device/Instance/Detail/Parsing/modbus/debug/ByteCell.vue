<template>
<div


                                    class="dvm-byte-cell"
                                  >
                                    <div
                                      class="dvm-byte-hex"
                                      :class="decodeByteHexSurfaceClass(byte.index)"
                                      :title="
                                        decodeVisualPayload.byteTone[byte.index] < 0 &&
                                        decodeVisualPayload.bitTone[byte.index]?.some((t) => t >= 0)
                                          ? t('ModbusMapping.ui.multipleProperties')
                                          : undefined
                                      "
                                    >
                                      {{ byte.value.toString(16).padStart(2, '0').toUpperCase() }}
                                    </div>
                                    <div class="dvm-byte-bits">
                                      <div
                                        v-for="slot in 8"
                                        :key="byte.bitKey + '-' + slot"
                                        :class="decodeBitCellClass(byte.index, 8 - slot)"
                                        :title="
                                          'B' +
                                          (byte.index) +
                                          ' · bit' +
                                          (8 - slot) +
                                          ' = ' +
                                          ((byte.value >> (8 - slot)) & 1)
                                        "
                                      />
                                    </div>
                                  <div v-if="byte.metaKey !== undefined" class="dvm-bit-meta-row" aria-hidden="true">
                                      <span
                                        v-for="slot in 8"
                                        :key="byte.metaKey + '-' + slot"
                                        class="dvm-bit-idx-lbl"
                                        >{{ 8 - slot }}</span
                                      >
                                    </div></div>
</template>
<script setup lang="ts">
import { toRefs } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ModbusDecodeView } from '../useModbusMapping'
import type { ModbusMappedPayload } from '../types'
interface ByteView {
  value: number
  index: number
  bitKey: string
  metaKey?: string
}
const props = defineProps<{
  model: Pick<ModbusDecodeView, 'decodeByteHexSurfaceClass' | 'decodeBitCellClass'>
  payload: ModbusMappedPayload
  byte: ByteView
}>()
const model = props.model
const { decodeByteHexSurfaceClass, decodeBitCellClass } = toRefs(model)
const { byte, payload: decodeVisualPayload } = toRefs(props)
const { t } = useI18n()
</script>
<style scoped lang="less" src="./ByteCell.less" />
