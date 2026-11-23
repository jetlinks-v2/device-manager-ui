<template>
    <j-permission-button
      key='setting'
      :disabled='disabled'
      :has-permission='hasPermission'
      :tooltip='tooltip'
      type='text'
      size='small'
      class='metadata-setting-action'
      @click='modalVisible = true'
    >
      <AIcon type='EditOutlined' />
      {{ $t('Properties.OtherSetting.237457-18') }}
    </j-permission-button>
  <a-modal v-if="!disabled" v-model:open="modalVisible" :width="760" :mask-closable="false"
    :title="$t('deviceDetailOptimization.configureProperty', { name: name || id })"
    :get-container="modalContainer" @ok="confirm" @cancel="cancel">

      <div class='metadata-settings-content' v-if='showContent'>
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
                  <span v-if="readonly">{{ settingValue(item, index) }}</span>
                  <template v-else>
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
                    <a-select
                      v-if="record.property === 'storageType' && record.type?.type === 'enum'"
                      v-model:value="configValue[record.property]"
                      style="width: 100%"
                      :options="getOptions(item, index).map(option => ({ ...option, value: String(option.value) }))"
                      :disabled="_disabled(record.property)"
                      :dropdownStyle="{ zIndex: 1071 }"
                      :getPopupContainer="(node) => tableWrapperRef || node"
                    >
                      <template #option="{ label, value: storageType }">
                        {{ label }}
                        <span v-if="['direct', 'ignore'].includes(storageType)" @mousedown.prevent.stop>
                          <DocumentHelp code="device/Product" :help-key="`metadata.storage.${storageType}`" />
                        </span>
                      </template>
                    </a-select>
                    <j-value-item
                      v-else
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
              </template>
            </a-table>
          </a-collapse-panel>
          <a-collapse-panel
            key='metrics'
            v-if='showMetrics'
          >
            <template #header>
              {{ $t('Properties.OtherSetting.237457-1') }}
              <DocumentHelp code="device/Product" help-key="metadata.metrics" />
            </template>
            <Metrics
              ref='metricsRef'
              :options='booleanOptions'
              :type='props.type'
              :value='metrics'
              :readonly='readonly'
            />
          </a-collapse-panel>
          <a-collapse-panel
            key='overview'
            v-if='showKeyProperty'
            :header="$t('Properties.OtherSetting.237457-35')"
          >
            <span v-if="readonly">{{ $t('Properties.OtherSetting.237457-36') }}: {{ $t(configValue.isKeyMetric ? 'Properties.OtherSetting.237457-23' : 'Properties.OtherSetting.237457-22') }}</span>
            <CardItem
              v-else
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

    <template v-if="readonly" #footer><a-button @click="cancel">{{ $t('IotDeviceDetail.common.close') }}</a-button></template>
  </a-modal>
</template>

<script setup lang='ts'>
import DocumentHelp from '@jetlinks-web-core/components/DocumentHelp'
import Metrics from './Metrics/Metrics.vue'
import { useI18n } from 'vue-i18n'
import CardItem from './components/CardItem.vue'
import { usePropertyOtherSettings } from './usePropertyOtherSettings'

defineOptions({ name: 'OtherSetting' })
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
  readonly: { type: Boolean, default: false },
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

const { modalContainer, modalVisible, confirm, cancel, showContent, activeKey, visible, config, columns, _disabled, popContainer,
  conflictData, configValue, tableWrapperRef, getOptions, settingValue, showMetrics, metricsRef, booleanOptions, metrics, showKeyProperty } = usePropertyOtherSettings(props, emit)
</script>

<style scoped lang='less'>
.metadata-settings-content { max-height: 65vh; overflow-y: auto; }
.extra-tip {
  padding: 8px;
  background-color: rgba(#000, 0.05);
}

.metadata-setting-action {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding-inline: var(--space-1);
  color: var(--jet-theme-primary);
  font-size: var(--fs-14);
  :deep(.anticon + span) { margin-inline-start: 0; }
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
