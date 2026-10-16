<template>
<div class="mm-drawer-parse-wrap">
            <div class="mm-parse-inline-top mm-drawer-parse-inline">
              <span class="mm-drawer-inline-lbl">{{ t('ModbusMapping.ui.typeLabel') }}</span>
              <a-select
                v-model:value="drawerForm.codec"
                allow-clear
                option-label-prop="label"
                class="mm-drawer-parse-type-sel"
                :placeholder="drawerForm.registerStr ? t('ModbusMapping.ui.chooseCodecByRange') : t('ModbusMapping.ui.enterAddressRangeFirst')"
                :dropdown-match-select-width="false"
                popup-class-name="mm-codec-select-dropdown"
                @change="onDrawerCodecChange"
              >
                <template v-for="grp in getCodecOptionsForCount(drawerForm.registerStr)" :key="grp.label">
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
              <span class="mm-drawer-inline-lbl">{{ t('ModbusMapping.ui.layoutLabel') }}</span>
              <a-select
                v-if="getLayoutOptions(drawerForm.registerStr).length"
                v-model:value="drawerForm.layout"
                class="mm-drawer-parse-layout-sel"
                option-label-prop="label"
                :dropdown-match-select-width="false"
                popup-class-name="mm-codec-select-dropdown"
              >
                <a-select-option
                  v-for="opt in getLayoutOptions(drawerForm.registerStr)"
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
              <a-input v-else disabled value="—" class="mm-drawer-layout-dash-input" />
            </div>
            <div v-if="doParseRegisterStr(drawerForm.registerStr)" class="form-help">
              {{ getCodecFilterHint(drawerForm.registerStr) }}
            </div>
            <div v-else-if="!drawerForm.registerStr" class="form-help">{{ " " + t('ModbusMapping.ui.codecRangeHint') + " " }}</div>
            <div class="mm-drawer-sublabel-tip" style="margin-top: 4px">{{ " " + t('ModbusMapping.ui.layoutOnlyPrefix') }}<strong>{{ t('ModbusMapping.ui.wordAreas') }}</strong>{{ t('ModbusMapping.ui.layoutOnlySuffix') + " " }}</div>
            <template v-if="isNumericCodec(drawerForm.codec)">
              <a-row :gutter="12" class="mm-drawer-scale-row">
                <a-col :span="12">
                  <div class="mm-drawer-mini-lbl">{{ t('ModbusMapping.ui.scaleFactor') }}</div>
                  <a-input-number
                    v-model:value="drawerForm.scaleFactor"
                    string-mode
                    :precision="15"
                    :step="1e-12"
                    style="width: 100%"
                  />
                </a-col>
                <a-col :span="12">
                  <div class="mm-drawer-mini-lbl">{{ t('ModbusMapping.ui.decimalPlaces') }}</div>
                  <a-input-number
                    v-model:value="drawerForm.scale"
                    :min="-1"
                    :precision="0"
                    style="width: 100%"
                  />
                </a-col>
              </a-row>
              <div class="form-help" style="margin-top: 4px">{{ " " + t('ModbusMapping.ui.scalingRule') + " " }}</div>
            </template>
          </div>
</template>
<script setup lang="ts">
import { toRefs } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ModbusMappingView } from '../useModbusMapping'
const props = defineProps<{model: Pick<ModbusMappingView, 'drawerForm' | 'doParseRegisterStr' | 'getCodecOptionsForCount' | 'shortCodecLabel' | 'getLayoutOptions' | 'layoutShortLabel' | 'onDrawerCodecChange' | 'getCodecFilterHint' | 'isNumericCodec'>}>()
const { drawerForm, doParseRegisterStr, getCodecOptionsForCount, shortCodecLabel, getLayoutOptions, layoutShortLabel, onDrawerCodecChange, getCodecFilterHint, isNumericCodec } = toRefs(props.model)
const { t } = useI18n()
</script>
<style scoped lang="less" src="./DrawerCodecFields.less" />
