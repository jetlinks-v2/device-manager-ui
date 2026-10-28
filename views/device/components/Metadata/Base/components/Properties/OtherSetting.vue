<template>
  <PopoverModal
    v-if='!disabled'
    v-model:visible='modalVisible'
    body-style='padding-top:4px;width:600px;'
    placement='bottomRight'
    :disabled='disabled'
    @ok='confirm'
    @cancel='cancel'
  >
    <template #content>
      <div style='height: 350px; overflow-y: auto' v-if='showContent'>
        <a-collapse v-model:activeKey='activeKey' v-if='visible'>
          <a-collapse-panel
            v-if="!(props.isProduct && target === 'device')"
            v-for='(item, index) in config'
            :key="'store_' + index"
          >
            <template #header>
              {{ item.name }}
              <a-tooltip
                v-if='item.description'
                :title='item.description'
              >
                <AIcon
                  type='ExclamationCircleOutlined'
                  style='padding-left: 12px; padding-top: 4px'
                />
              </a-tooltip>
            </template>
            <a-table
              :columns='columns'
              :data-source='item.properties'
              :pagination='false'
              rowKey='id'
            >
              <template #bodyCell='{ column, record, index }'>
                <template v-if="column.dataIndex === 'type'">{{
                    record.type?.name
                  }}
                </template>
                <template
                  v-else-if="column.dataIndex === 'value'"
                >
                  <a-tooltip
                    v-if='_disabled(record.property)'
                    color='#ffffff'
                    :get-popup-container='popContainer'
                    :arrowPointAtCenter='true'
                    placement='topRight'
                  >
                    <template #title>
                      <div style='color: #1A1A1A; padding: 12px'>
                        {{ $t('Properties.OtherSetting.237457-0') }}
                        <div style='display: flex; flex-wrap: wrap; gap: 4px 8px; margin-top: 8px'>
                          <div
                            style='background-color: #F0F0F0; padding: 4px 8px; border-radius: 4px;color: #777777;'
                            v-for='item in conflictData' :key='item'>
                            {{ item }}
                          </div>
                        </div>
                      </div>
                    </template>
                    <div
                      class='table-form-error-target'
                    ></div>
                  </a-tooltip>
                  <div
                    style='position: relative'
                    :class="{
                                            'edit-table-form-has-error':
                                                _disabled(record.property),
                                        }"
                  >
                    <j-value-item
                      style='width: 100%'
                      v-model:modelValue='
                                                configValue[record.property]
                                            '
                      :itemType='
                                                item.properties[index].type
                                                    ?.type
                                            '

                      :extraProps='{
                                                dropdownStyle: {
                                                    zIndex: 1071,
                                                },
                                                popupStyle: {
                                                    zIndex: 1071,
                                                },
                                                disabled: _disabled(record.property),
                                                getPopupContainer: (node: HTMLElement) => tableWrapperRef || node
                                            }'
                      :options='getOptions(item, index)'
                    />
                  </div>
                </template>
              </template>
            </a-table>
          </a-collapse-panel>
          <a-collapse-panel
            key='metrics'
            v-if='showMetrics'
          >
            <template #header>
              {{ $t('Properties.OtherSetting.237457-1') }}
              <a-tooltip
                :title="$t('Properties.OtherSetting.237457-2')"
              >
                <AIcon
                  type='ExclamationCircleOutlined'
                  style='padding-left: 12px; padding-top: 4px'
                />
              </a-tooltip>
            </template>
            <Metrics
              ref='metricsRef'
              :options='booleanOptions'
              :type='props.type'
              :value='metrics'
            />
          </a-collapse-panel>
          <a-collapse-panel
            key='overview'
            v-if='showKeyProperty'
            :header="$t('Properties.OtherSetting.237457-35')"
          >
            <CardItem
              v-model:value='configValue.isKeyMetric'
              :disabled='keyPropertyReadonly'
              :title="$t('Properties.OtherSetting.237457-36')"
              :tip="$t('Properties.OtherSetting.237457-37')"
            />
          </a-collapse-panel>
        </a-collapse>
      </div>
      <div v-else style='padding-top: 24px'>
        <j-empty :description="$t('Properties.OtherSetting.237457-17')" />
      </div>
    </template>
    <j-permission-button
      key='setting'
      :disabled='disabled'
      :has-permission='hasPermission'
      :tooltip='tooltip'
      type='primary'
    >
      <AIcon type='EditOutlined' />
      {{ $t('Properties.OtherSetting.237457-18') }}
    </j-permission-button>
  </PopoverModal>
  <j-permission-button
    v-else
    key='setting'
    :disabled='disabled'
    :has-permission='hasPermission'
    :tooltip='tooltip'
    type='primary'
  >
    <AIcon type='EditOutlined' />
    {{ $t('Properties.OtherSetting.237457-18') }}
  </j-permission-button>
  <PropertyRuleShortcut v-if="metadataType === 'properties' && id" :target="target"
    :property="{ ...record, id, name, valueType: { ...record.valueType, type: props.type } }" />
</template>

<script setup lang='ts' name='OtherSetting'>
import Metrics from './Metrics/Metrics.vue'
import { useI18n } from 'vue-i18n'
import { PopoverModal } from '../../../../../../../components/Metadata'
import PropertyRuleShortcut from '../../../../PropertyRules/PropertyRuleShortcut.vue'
import CardItem from './components/CardItem.vue'
import { usePropertyOtherSettings } from './usePropertyOtherSettings'
const { t: $t } = useI18n()
const emit = defineEmits(['update:value', 'save'])

const props = defineProps({
  value: {
    type: Object,
    default: () => ({})
  },
  type: {
    type: String,
    default: undefined
  },
  disabled: {
    type: Boolean,
    default: false
  },
  id: {
    type: String,
    default: undefined
  },
  name: {
    type: String,
    default: undefined
  },
  record: {
    type: Object,
    default: () => ({})
  },
  hasPermission: String,
  tooltip: Object,
  metadataType: {
    type: String,
    default: 'properties'
  },
  target: String,
  isProduct: {
    type: Boolean,
    default: false
  },
  keyPropertyReadonly: {
    type: Boolean,
    default: false
  }
})

const { modalVisible, confirm, cancel, showContent, activeKey, visible, config, columns, _disabled, popContainer,
  conflictData, configValue, tableWrapperRef, getOptions, showMetrics, metricsRef, booleanOptions, metrics, showKeyProperty } = usePropertyOtherSettings(props, emit)
</script>

<style scoped lang='less'>
.extra-tip {
  padding: 8px;
  background-color: rgba(#000, 0.05);
}

.extra-title {
  font-size: 16px;
  margin: 12px 0;
}

.extra-check-group {
  :deep(.j-card-item) {
    padding: 12px 14px !important;
  }
}

.table-form-error-target {
  position: absolute;
  right: 2px;
  top: 0;
  border: 16px solid transparent;
  border-top-color: @error-color;
  border-right-width: 0;
  border-bottom-width: 0;
}
</style>
