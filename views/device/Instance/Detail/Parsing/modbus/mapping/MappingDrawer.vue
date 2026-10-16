<template>
<a-drawer
      v-model:open="drawerVisible"
      :title="t('ModbusMapping.ui.mappingTitle', { suffix: drawerForm.property ? ' · ' + (drawerForm.propertyName || drawerForm.property) : '' })"
      placement="right"
      :width="480"
      destroy-on-close
    >
      <a-form :model="drawerForm" layout="vertical">
        <a-form-item :label="t('ModbusMapping.ui.propertyId')">
          <div class="mm-prop-ac-wrap">
            <div
              v-show="
                !drawerPropertyFocused &&
                drawerForm.property &&
                getPropNameById(drawerForm.property)
              "
              class="mm-prop-ac-fake"
              aria-hidden="true"
            >
              <span class="mm-prop-ac-fake-name">{{ getPropNameById(drawerForm.property) }}</span>
              <span class="mm-prop-ac-fake-id">{{ drawerForm.property }}</span>
            </div>
            <a-auto-complete
              :value="drawerForm.property"
              :options="propertyOptions"
              :filter-option="filterPropertyACOption"
              allow-clear
              :placeholder="t('ModbusMapping.ui.propertyPlaceholder')"
              class="mm-prop-ac"
              :class="{
                'mm-prop-ac--ghost':
                  !drawerPropertyFocused &&
                  !!drawerForm.property &&
                  !!getPropNameById(drawerForm.property),
              }"
              popup-class-name="mm-prop-select-dropdown"
              :dropdown-match-select-width="false"
              :list-item-height="34"
              @focus="drawerPropertyFocused = true"
              @blur="onDrawerPropertyInputBlur"
              @update:value="onDrawerPropertyAcUpdate"
            >
              <template #option="opt">
                <div class="mm-prop-opt">
                  <span class="mm-prop-opt-name">{{ opt.propName }}</span>
                  <span class="mm-prop-opt-id">{{ opt.propId }}</span>
                </div>
              </template>
            </a-auto-complete>
          </div>
          <div v-if="isPropertyNotInThingModel(drawerForm.property)" class="mm-prop-undef-hint">{{ " " + t('ModbusMapping.ui.undefinedProperty') + " " }}</div>
        </a-form-item>

        <a-form-item :label="t('ModbusMapping.ui.registerAddress')">
          <a-input
            v-model:value="drawerForm.registerStr"
            :placeholder="t('ModbusMapping.ui.addressPlaceholder')"
            @change="onDrawerRegisterChange"
          />
          <div class="drawer-reg-hint">
            <template
              v-for="hint in [drawerForm.registerStr ? getRegisterHintData(drawerForm.registerStr) : null]"
              :key="0"
            >
              <RegisterHint v-if="hint" :hint="hint" />
              <div v-else-if="drawerForm.registerStr" class="reg-hint-error">{{ t('ModbusMapping.ui.invalidAddress') }}</div>
              <div v-else class="reg-format-tip reg-format-tip--drawer">{{ " " + t('ModbusMapping.ui.combineUnitPrefix') }}<code>{{ t('ModbusMapping.ui.unitAddressFormat') }}</code>{{ t('ModbusMapping.ui.examplePrefix') + " " }}<code>2:40001</code>{{ t('ModbusMapping.ui.punctuation4') }}<code>2:3_0</code>{{ t('ModbusMapping.ui.defaultSlavePrefix') + " " }}<code>1</code>
              </div>
            </template>
          </div>
          <AddressGuide />
        </a-form-item>

        <a-form-item :label="t('ModbusMapping.ui.decodingLabel')">
          <DrawerCodecFields :model="model" />
        </a-form-item>

        <a-divider style="margin: 12px 0">{{ t('ModbusMapping.ui.access') }}</a-divider>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item :label="t('ModbusMapping.ui.readable')">
              <a-switch
                v-model:checked="drawerForm.readable"
                :checked-children="t('ModbusMapping.ui.yes')"
                :un-checked-children="t('ModbusMapping.ui.no')"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('ModbusMapping.ui.writable')">
              <a-switch
                v-model:checked="drawerForm.writable"
                :checked-children="t('ModbusMapping.ui.yes')"
                :un-checked-children="t('ModbusMapping.ui.no')"
              />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>

      <template #footer>
        <a-space style="float: right">
          <a-button @click="drawerVisible = false">{{ t('ModbusMapping.ui.cancel') }}</a-button>
          <a-button type="primary" @click="confirmDrawer">{{ t('ModbusMapping.ui.confirm') }}</a-button>
        </a-space>
      </template>
    </a-drawer>
</template>
<script setup lang="ts">
import { toRefs } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ModbusMappingView } from '../useModbusMapping'
import RegisterHint from './RegisterHint.vue'
import AddressGuide from './AddressGuide.vue'
import DrawerCodecFields from './DrawerCodecFields.vue'
const props = defineProps<{
  model: Pick<
    ModbusMappingView,
    | 'drawerPropertyFocused'
    | 'drawerVisible'
    | 'drawerForm'
    | 'onDrawerPropertyInputBlur'
    | 'onDrawerPropertyAcUpdate'
    | 'onDrawerRegisterChange'
    | 'onDrawerCodecChange'
    | 'confirmDrawer'
    | 'propertyOptions'
    | 'getPropNameById'
    | 'isPropertyNotInThingModel'
    | 'filterPropertyACOption'
    | 'doParseRegisterStr'
    | 'getRegisterHintData'
    | 'shortCodecLabel'
    | 'getCodecOptionsForCount'
    | 'getCodecFilterHint'
    | 'isNumericCodec'
    | 'layoutShortLabel'
    | 'getLayoutOptions'
  >
}>()
const model = props.model
const {
  drawerPropertyFocused,
  drawerVisible,
  drawerForm,
  onDrawerPropertyInputBlur,
  onDrawerPropertyAcUpdate,
  onDrawerRegisterChange,
  onDrawerCodecChange,
  confirmDrawer,
  propertyOptions,
  getPropNameById,
  isPropertyNotInThingModel,
  filterPropertyACOption,
  doParseRegisterStr,
  getRegisterHintData,
  shortCodecLabel,
  getCodecOptionsForCount,
  getCodecFilterHint,
  isNumericCodec,
  layoutShortLabel,
  getLayoutOptions
} = toRefs(model)
const { t } = useI18n()
</script>
<style scoped lang="less" src="./MappingDrawer.less" />
