<template>
<div class="debug-body encode-debug-wrap">
            <div class="decode-debug-grid">
              <div class="decode-debug-col decode-debug-input">
                <div class="debug-label">{{ t('ModbusMapping.ui.messageType') }}</div>
                <a-radio-group
                  v-model:value="encodeDebugMode"
                  size="small"
                  button-style="solid"
                  style="margin-bottom: 8px"
                >
                  <a-radio-button value="write">{{ t('ModbusMapping.ui.writeProperties') }}</a-radio-button>
                  <a-radio-button value="read">{{ t('ModbusMapping.ui.readProperties') }}</a-radio-button>
                </a-radio-group>

                <template v-if="encodeDebugMode === 'write'">
                  <div class="debug-label">{{ t('ModbusMapping.ui.simulatedWrite') }}</div>
                  <div
                    v-for="(item, idx) in encodeInputs"
                    :key="idx"
                    class="encode-row"
                  >
                    <a-select
                      v-model:value="item.property"
                      :placeholder="t('ModbusMapping.ui.selectProperty')"
                      size="small"
                      style="width: 200px"
                      show-search
                      allow-clear
                      :options="encodePropertyOptions"
                    />
                    <span class="encode-eq">=</span>
                    <a-input
                      v-model:value="item.value"
                      :placeholder="t('ModbusMapping.ui.simulatedValue')"
                      size="small"
                      style="width: 140px; "
                    />
                    <a-button type="link" size="small" danger @click="removeEncodeInput(idx)">
                      <template #icon><CloseOutlined /></template>
                    </a-button>
                  </div>
                  <a-button size="small" @click="addEncodeInput" style="margin-top: 4px">
                    <template #icon><PlusOutlined /></template>{{ " " + t('ModbusMapping.ui.addProperty') + " " }}</a-button>
                </template>

                <template v-else>
                  <div class="debug-label">{{ t('ModbusMapping.ui.propertiesToRead') }}</div>
                  <a-select
                    v-model:value="readEncodeProps"
                    mode="tags"
                    size="small"
                    style="width: 100%"
                    :placeholder="t('ModbusMapping.ui.readPropertiesPlaceholder')"
                    show-search
                    :options="encodePropertyOptions"
                    :filter-option="filterEncodeReadPropOption as SelectProps['filterOption']"
                  />
                  <div class="encode-read-hint">{{ t('ModbusMapping.ui.readHint') }}</div>
                </template>

                <a-button
                  size="small"
                  type="primary"
                  :loading="encoding"
                  @click="runEncode"
                  style="margin-top: 10px"
                >{{ " " + t('ModbusMapping.ui.generateFrame') + " " }}</a-button>

                <a-alert
                  v-if="encodeResult"
                  :type="encodeResult.success ? 'success' : 'error'"
                  :message="encodeResult.success ? t('ModbusMapping.ui.encodeSuccess') : t('ModbusMapping.ui.encodeFailed')"
                  show-icon
                  style="font-size: 12px; margin-top: 10px"
                >
                  <template v-if="!encodeResult.success" #description>
                    <span>{{ encodeResult.reason }}</span>
                  </template>
                </a-alert>
              </div>

              <div class="decode-debug-col decode-debug-parse">
                <div class="debug-label">{{ t('ModbusMapping.ui.frameStructure') }}</div>
                <div v-if="!encodeResult?.success || !encodeDebugSegments.length" class="decode-parse-empty">{{ " " + t('ModbusMapping.ui.generateHint') + " " }}</div>
                <template v-else>
                  <div v-for="(seg, fi) in encodeDebugSegments" :key="'ep-' + fi" class="encode-parse-frame-block">
                    <div v-if="encodeDebugSegments.length > 1" class="encode-parse-frame-title">{{ t('ModbusMapping.ui.framePrefix') + " " }}{{ fi + 1 }}</div>
                    <div class="encode-full-hex">
                      <span class="encode-full-hex-lbl">{{ encodeDebugSegments.length > 1 ? t('ModbusMapping.ui.frameSegment') : t('ModbusMapping.ui.fullFrame') }}</span>
                      <code class="encode-full-hex-code" :title="seg.hex">{{ seg.hex }}</code>
                    </div>
                    <div v-if="seg.analysis" class="modbus-parse-card modbus-parse-compact">
                      <template v-for="a in [seg.analysis]" :key="'enc' + fi">
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
                          <div v-if="a.dataHexPreview && a.dataHexPreview !== '—'" class="mp-hex-box">
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
                        <div v-for="(w, wi) in a.warnings" :key="'ew' + fi + wi" class="mp-warn-tight">{{ w }}</div>
                      </template>
                    </div>
                    <div v-else class="decode-parse-empty decode-parse-err">{{ t('ModbusMapping.ui.unrecognizedSegment') }}</div>
                  </div>
                </template>
              </div>
            </div>
          </div>
</template>
<script setup lang="ts">
import { toRefs } from 'vue'
import type { SelectProps } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import type { ModbusEncodeView } from '../useModbusMapping'
import { PlusOutlined, CloseOutlined } from '@ant-design/icons-vue'
const props = defineProps<{
  model: Pick<
    ModbusEncodeView,
    | 'encodeDebugSegments'
    | 'addEncodeInput'
    | 'removeEncodeInput'
    | 'runEncode'
    | 'encodeInputs'
    | 'encoding'
    | 'encodeResult'
    | 'encodeDebugMode'
    | 'readEncodeProps'
    | 'encodePropertyOptions'
    | 'filterEncodeReadPropOption'
  >
}>()
const model = props.model
const {
  encodeDebugSegments,
  addEncodeInput,
  removeEncodeInput,
  runEncode,
  encodeInputs,
  encoding,
  encodeResult,
  encodeDebugMode,
  readEncodeProps,
  encodePropertyOptions,
  filterEncodeReadPropOption
} = toRefs(model)
const { t } = useI18n()
</script>
<style scoped lang="less" src="./EncodePanel.less" />
