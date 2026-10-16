<template>

          <div class="mm-codec-layout-cell">
            <div class="mm-parse-inline-top">
              <span class="mm-parse-label mm-parse-label--inline">{{ t('ModbusMapping.ui.typeLabel') }}</span>
              <a-select
                v-model:value="record.codec"
                class="mm-parse-inline-sel"
                :placeholder="t('ModbusMapping.ui.selectCodec')"
                allow-clear
                size="small"
                option-label-prop="label"
                :dropdown-match-select-width="false"
                popup-class-name="mm-codec-select-dropdown"
                @change="() => onCodecChange(record)"
              >
                <template v-for="grp in getCodecOptionsForCount(record.registerStr)" :key="grp.label">
                  <a-select-opt-group :label="grp.label">
                    <a-select-option
                      v-for="opt in grp.options"
                      :key="opt.value"
                      :value="opt.value"
                      :label="shortCodecLabel(opt.value)"
                    >
                      <div class="mm-codec-opt">
                        <div class="mm-codec-opt-title">{{ shortCodecLabel(opt.value) }}</div>
                        <div class="mm-codec-opt-desc">{{ opt.desc }}</div>
                      </div>
                    </a-select-option>
                  </a-select-opt-group>
                </template>
              </a-select>
              <span class="mm-parse-label mm-parse-label--inline">{{ t('ModbusMapping.ui.layoutLabel') }}</span>
              <a-select
                v-if="getLayoutOptions(record.registerStr).length"
                v-model:value="record.layout"
                class="mm-parse-inline-sel mm-parse-inline-sel--layout"
                size="small"
                option-label-prop="label"
                :dropdown-match-select-width="false"
                popup-class-name="mm-codec-select-dropdown"
              >
                <a-select-option
                  v-for="opt in getLayoutOptions(record.registerStr)"
                  :key="opt.value"
                  :value="opt.value"
                  :label="layoutShortLabel(opt.value)"
                >
                  <div class="mm-codec-opt">
                    <div class="mm-codec-opt-title">{{ opt.title }}</div>
                    <div class="mm-codec-opt-desc">{{ opt.desc }}</div>
                  </div>
                </a-select-option>
              </a-select>
              <span v-else class="mm-parse-layout-dash">—</span>
            </div>
            <div v-if="record.registerStr && doParseRegisterStr(record.registerStr)" class="cell-hint mm-parse-hint">
              <span class="codec-count-hint">{{ getCodecFilterHint(record.registerStr) }}</span>
            </div>
            <div v-if="isNumericCodec(record.codec)" class="mm-parse-scale-row">
              <span class="mm-parse-scale-inline">
                <a-tooltip :title="t('ModbusMapping.ui.scaleHint')">
                  <span class="mm-parse-scale-lbl">{{ t('ModbusMapping.ui.scale') }}</span>
                </a-tooltip>
                <a-input-number
                  v-model:value="record.scaleFactor"
                  string-mode
                  :precision="15"
                  :step="1e-12"
                  size="small"
                  :controls="false"
                  :bordered="false"
                  placeholder="1"
                  class="mm-parse-scale-inn mm-parse-scale-inn--factor"
                  @change="(v) => onTableScaleFactorChange(record, v)"
                />
              </span>
              <span class="mm-parse-scale-sep">·</span>
              <span class="mm-parse-scale-inline">
                <a-tooltip :title="t('ModbusMapping.ui.decimalHint')">
                  <span class="mm-parse-scale-lbl">{{ t('ModbusMapping.ui.decimals') }}</span>
                </a-tooltip>
                <a-input-number
                  v-model:value="record.scale"
                  :min="-1"
                  :precision="0"
                  size="small"
                  :controls="false"
                  :bordered="false"
                  placeholder="-1"
                  class="mm-parse-scale-inn mm-parse-scale-inn--scale"
                  @change="(v) => onTableScaleChange(record, v as number | null)"
                />
              </span>
            </div>
          </div>

</template>
<script setup lang="ts">
import { toRefs } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ModbusMappingView } from '../useModbusMapping'
import type { ModbusSimpleMapping } from '../types'
const props = defineProps<{
  model: Pick<
    ModbusMappingView,
    | 'onTableScaleFactorChange'
    | 'onTableScaleChange'
    | 'onCodecChange'
    | 'doParseRegisterStr'
    | 'shortCodecLabel'
    | 'getCodecOptionsForCount'
    | 'getCodecFilterHint'
    | 'isNumericCodec'
    | 'layoutShortLabel'
    | 'getLayoutOptions'
  >
  record: ModbusSimpleMapping
}>()
const model = props.model
const {
  onTableScaleFactorChange,
  onTableScaleChange,
  onCodecChange,
  doParseRegisterStr,
  shortCodecLabel,
  getCodecOptionsForCount,
  getCodecFilterHint,
  isNumericCodec,
  layoutShortLabel,
  getLayoutOptions
} = toRefs(model)
const { record } = toRefs(props)
const { t } = useI18n()
</script>
<style scoped lang="less" src="./CodecFields.less" />
