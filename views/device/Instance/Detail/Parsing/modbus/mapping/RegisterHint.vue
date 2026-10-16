<template>
<div class="reg-hint">
                <!-- Row1：区域标识 + 输入格式主地址 -->
                <div class="reg-hint-row1">
                  <span class="reg-zone-badge" :style="{ color: hint.color, background: hint.bg }">{{ hint.zonePrefix }}</span>
                  <span class="reg-zone-name">{{ hint.zoneName }}</span>
                  <template v-if="hint.inputFormat === 'plc'">
                    <!-- PLC格式输入 → Row1 显示 PLC 地址 -->
                    <span class="reg-addr-val">#{{ hint.stdAddr }}<template v-if="hint.stdAddrEnd"> ~ #{{ hint.stdAddrEnd }}</template></span>
                  </template>
                  <template v-else>
                    <!-- FC格式输入 → Row1 显示 FC + Modbus 地址 -->
                    <span class="reg-fc-inline">{{ hint.fcCode }}</span>
                    <span class="reg-addr-val">addr {{ hint.modbusAddr }}<template v-if="hint.modbusAddrEnd !== undefined"> ~ {{ hint.modbusAddrEnd }}</template></span>
                  </template>
                  <span v-if="hint.slaveId" class="reg-slave">{{ t('ModbusMapping.ui.slaveLabel') + " " }}{{ hint.slaveId }}</span>
                </div>
                <!-- Row2：交叉解释（另一种地址表示） + 寄存器数/字节数 -->
                <div class="reg-hint-row2">
                  <template v-if="hint.inputFormat === 'plc'">
                    <!-- PLC格式输入 → Row2 显示 Modbus 解释 -->
                    <span class="reg-interp-label">Modbus</span>
                    <span class="reg-fc-badge">{{ hint.fcCode }}</span>
                    <span class="reg-meta-sep">·</span>
                    <span>addr {{ hint.modbusAddr }}<template v-if="hint.modbusAddrEnd !== undefined"> ~ {{ hint.modbusAddrEnd }}</template></span>
                  </template>
                  <template v-else>
                    <!-- FC格式输入 → Row2 显示 PLC 解释 -->
                    <span class="reg-interp-label">PLC</span>
                    <span class="reg-addr-val-sm">#{{ hint.stdAddr }}<template v-if="hint.stdAddrEnd"> ~ #{{ hint.stdAddrEnd }}</template></span>
                  </template>
                  <span class="reg-meta-sep">·</span>
                  <template v-if="hint.addressing === 'bit'">
                    <span>{{ hint.count }}{{ " " + t('ModbusMapping.ui.bitsSuffix', hint.count) }}</span>
                    <span class="reg-meta-sep">·</span>
                    <span>{{ t('ModbusMapping.ui.dataSizePrefix') + " " }}{{ hint.dataBytes }}{{ " " + t('ModbusMapping.ui.bytesSuffix', hint.dataBytes) }}</span>
                    <span class="reg-meta-sep">·</span>
                    <span class="reg-micro">{{ t('ModbusMapping.ui.packedBits') }}</span>
                  </template>
                  <template v-else>
                    <span>{{ hint.count }}{{ " " + t('ModbusMapping.ui.wordsSuffix', hint.count) }}</span>
                    <span class="reg-meta-sep">·</span>
                    <span>{{ t('ModbusMapping.ui.wordWidth') }}</span>
                    <span class="reg-meta-sep">·</span>
                    <span>{{ hint.dataBytes }}{{ " " + t('ModbusMapping.ui.bytesSuffix', hint.dataBytes) }}</span>
                  </template>
                  <template v-if="hint.bitIndex !== undefined">
                    <span class="reg-meta-sep">·</span>
                    <span>{{ t('ModbusMapping.ui.bitIndexLabel', { index: hint.bitIndex }) }}</span>
                  </template>
                  <template v-if="hint.elementIndex !== undefined">
                    <span class="reg-meta-sep">·</span>
                    <span>{{ t('ModbusMapping.ui.elementPrefix') }}{{ hint.elementIndex }}]</span>
                  </template>
                </div>
                <div class="reg-hint-row3">
                  <span class="reg-hint-zone-explain">{{ hint.zoneExplain }}</span>
                  <slot />
                </div>
              </div>
</template>
<script setup lang="ts">
import { toRefs } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RegHintData } from '../types'
const props = defineProps<{ hint: RegHintData }>()
const { hint } = toRefs(props)
const { t } = useI18n()
</script>
<style scoped lang="less" src="./RegisterHint.less" />
