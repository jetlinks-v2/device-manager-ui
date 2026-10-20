<template>

          <!-- AutoComplete：自由输入任意标识；收起态物模型属性展示「名称 + 弱化 id」 -->
          <div class="mm-prop-ac-wrap">
            <div
              v-show="
                focusedPropertyIndex !== index &&
                record.property &&
                getPropNameById(record.property)
              "
              class="mm-prop-ac-fake"
              aria-hidden="true"
            >
              <span class="mm-prop-ac-fake-name">{{ getPropNameById(record.property) }}</span>
              <span class="mm-prop-ac-fake-id">{{ record.property }}</span>
            </div>
            <a-auto-complete
              :value="record.property"
              :options="propertyOptions"
              :filter-option="filterPropertyACOption"
              allow-clear
              :placeholder="t('ModbusMapping.ui.propertyPlaceholder')"
              style="width: 100%"
              size="small"
              class="mm-prop-ac"
              :class="{
                'mm-prop-ac--ghost':
                  focusedPropertyIndex !== index &&
                  !!record.property &&
                  !!getPropNameById(record.property),
              }"
              popup-class-name="mm-prop-select-dropdown"
              :dropdown-match-select-width="false"
              :list-item-height="34"
              @focus="focusedPropertyIndex = index"
              @blur="onPropertyInputBlur"
              @update:value="(v) => onPropertyAcUpdate(v, record)"
            >
              <template #option="opt">
                <div class="mm-prop-opt">
                  <span class="mm-prop-opt-name">{{ opt.propName }}</span>
                  <span class="mm-prop-opt-id">{{ opt.propId }}</span>
                </div>
              </template>
            </a-auto-complete>
          </div>
          <div v-if="isPropertyNotInThingModel(record.property)" class="mm-prop-undef-hint">{{ " " + t('ModbusMapping.ui.undefinedProperty') + " " }}</div>
          <template v-for="pMeta in [getPropertyUiMeta(record)]" :key="'pm-' + index">
            <template v-if="pMeta">
              <div v-if="pMeta.description" class="mm-prop-desc">{{ pMeta.description }}</div>
              <div v-if="pMeta.thingRead || pMeta.thingWrite" class="mm-prop-rw-tags">
                <template v-if="pMeta.thingRead">
                  <a-tooltip v-if="pMeta.conflictRead" :title="t('ModbusMapping.ui.readUnsupported')">
                    <span class="mm-rw-conflict-wrap">
                      <a-tag color="error" size="small">{{ t('ModbusMapping.ui.read') }}</a-tag>
                      <ExclamationCircleOutlined class="mm-rw-warn-icon" />
                    </span>
                  </a-tooltip>
                  <a-tag v-else color="processing" size="small">{{ t('ModbusMapping.ui.read') }}</a-tag>
                </template>
                <template v-if="pMeta.thingWrite">
                  <a-tooltip v-if="pMeta.conflictWrite" :title="t('ModbusMapping.ui.writeUnsupported')">
                    <span class="mm-rw-conflict-wrap">
                      <a-tag color="error" size="small">{{ t('ModbusMapping.ui.write') }}</a-tag>
                      <ExclamationCircleOutlined class="mm-rw-warn-icon" />
                    </span>
                  </a-tooltip>
                  <a-tag v-else color="processing" size="small">{{ t('ModbusMapping.ui.write') }}</a-tag>
                </template>
              </div>
            </template>
          </template>

</template>
<script setup lang="ts">
import { toRefs } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ModbusMappingView } from '../useModbusMapping'
import type { ModbusSimpleMapping } from '../types'
import { ExclamationCircleOutlined } from '@ant-design/icons-vue'
const props = defineProps<{
  model: Pick<
    ModbusMappingView,
    | 'focusedPropertyIndex'
    | 'onPropertyInputBlur'
    | 'onPropertyAcUpdate'
    | 'getPropertyUiMeta'
    | 'propertyOptions'
    | 'getPropNameById'
    | 'isPropertyNotInThingModel'
    | 'filterPropertyACOption'
  >
  record: ModbusSimpleMapping
  index: number
}>()
const model = props.model
const {
  focusedPropertyIndex,
  onPropertyInputBlur,
  onPropertyAcUpdate,
  getPropertyUiMeta,
  propertyOptions,
  getPropNameById,
  isPropertyNotInThingModel,
  filterPropertyACOption
} = toRefs(model)
const { record, index } = toRefs(props)
const { t } = useI18n()
</script>
<style scoped lang="less" src="./PropertyField.less" />
