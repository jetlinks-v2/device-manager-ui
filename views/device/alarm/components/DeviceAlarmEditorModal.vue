<template>
  <a-modal
    :open="open"
    width="min(100rem, calc(100vw - 2.25rem))"
    :mask-closable="false"
    :closable="!saving"
    :keyboard="!saving"
    :body-style="{ padding: 0 }"
    wrap-class-name="device-alarm-editor-modal-wrap"
    centered
    @cancel="close"
  >
    <template #title>
      <div class="device-alarm-editor__heading">
        <h2>{{ title }}</h2>
        <p>{{ $t('DeviceAlarm.editor.description') }}</p>
      </div>
    </template>

    <a-form class="device-alarm-editor" layout="vertical" :model="model" :disabled="saving">
      <div class="device-alarm-editor__workspace">
        <ContentPanel fill :background="false" class="device-alarm-editor__base">
          <h3>{{ $t('DeviceAlarm.editor.navigationTitle') }}</h3>

          <a-form-item :label="$t('DeviceAlarm.form.name')" required>
            <a-input
              v-model:value="model.name"
              :maxlength="64"
              :placeholder="$t('DeviceAlarm.placeholder.name')"
            />
          </a-form-item>

          <nav class="device-alarm-editor__settings" :aria-label="$t('DeviceAlarm.editor.configNavigation')">
            <a-button
              v-for="panel in panels"
              :key="panel.key"
              :disabled="saving"
              class="device-alarm-editor__setting"
              :class="{ 'is-selected': activePanel === panel.key }"
              :aria-pressed="activePanel === panel.key"
              @click="selectPanel(panel.key)"
            >
              <span class="device-alarm-editor__setting-icon"><AIcon :type="panel.icon" /></span>
              <span class="device-alarm-editor__setting-label">{{ $t(panel.labelKey) }}</span>
              <a-badge :status="panelStates[panel.key] === 'complete' ? 'success' : 'default'"
                role="img" :aria-label="$t(`DeviceAlarm.editor.state.${panelStates[panel.key]}`)" />
              <AIcon type="RightOutlined" />
            </a-button>
          </nav>
        </ContentPanel>

        <ContentPanel fill :background="false" class="device-alarm-editor__panel device-alarm-editor__main" :data-panel="activePanel">
          <header class="device-alarm-editor__section-heading">
            <div>
              <div class="device-alarm-editor__section-title">
                <h3>{{ $t(activePanelMeta.labelKey) }}</h3>
                <DeviceAlarmNotificationHelp v-if="activePanel === 'notification'" :model="model" show-label />
              </div>
              <p>{{ $t(activePanelMeta.descriptionKey) }}</p>
            </div>
          </header>

          <div v-show="activePanel === 'level'" class="device-alarm-editor__section">
            <a-form-item class="device-alarm-editor__level-field">
              <j-card-select v-model:value="model.level" :column="1" :options="levelOptions" :disabled="saving"
                role="group" :aria-label="$t('DeviceAlarm.form.level')">
                <template #itemRender="{ node }">
                  <a-button block type="text" class="device-alarm-editor__level-option" :class="`alarm-level--${node.value}`"
                    :disabled="saving" :aria-pressed="model.level === node.value">
                    <span class="device-alarm-editor__level-dot" aria-hidden="true" />
                    <span>{{ node.label }}</span>
                    <AIcon v-if="model.level === node.value" class="device-alarm-editor__level-check" type="CheckCircleFilled" />
                  </a-button>
                </template>
              </j-card-select>
            </a-form-item>
          </div>

          <div v-show="activePanel === 'target'" class="device-alarm-editor__section">
            <DeviceAlarmTargetForm
              :model="model" :fixed-product-scope="fixedProductScope" :readonly-scope="readonlyScope"
              :product-option="productOption" :device-option="deviceOption" :product-reload-key="productReloadKey"
              :product-request="productRequest" :device-request="deviceRequest" :property-options="propertyOptions"
              @product-change="option => emit('product-change', option)"
              @device-change="(value, option) => emit('device-change', value, option)"
              @property-change="value => emit('property-change', value)"
            />
          </div>

          <div v-show="activePanel === 'trigger'" class="device-alarm-editor__section">
            <DeviceAlarmTriggerForm :model="model" :property="selectedProperty" :preview="previewText" :relieve-preview="relievePreviewText" :disabled="saving" />
          </div>

          <div v-show="activePanel === 'notification'" class="device-alarm-editor__section">
            <RegistryComponent page-code="device/alarm" code="alarm-editor">
              <DeviceAlarmNotificationConfig
                key="notification"
                layout="form"
                :model="model"
                :methods="notifyMethods"
                :loading="notifyLoading"
                :failed="notifyFailed"
                :disabled="saving"
                @retry-methods="emit('retry-methods')"
              />
            </RegistryComponent>
          </div>
        </ContentPanel>

        <ContentPanel fill :background="false" class="device-alarm-editor__panel device-alarm-editor__summary">
          <header class="device-alarm-editor__section-heading">
            <div>
              <h3>{{ $t('DeviceAlarm.editor.summaryTitle') }}</h3>
              <p>{{ $t('DeviceAlarm.editor.summaryDescription') }}</p>
            </div>
          </header>
          <div class="device-alarm-editor__summary-list">
            <a-card v-for="item in summaryItems" :key="item.key" size="small"
              class="device-alarm-editor__summary-card" :class="{ 'is-pending': item.state === 'pending' }">
              <template #title><span>{{ $t(item.labelKey) }}</span></template>
              <template #extra>
                <a-button type="link" size="small" :disabled="saving"
                  :aria-label="$t('DeviceAlarm.editor.configureSection', { section: $t(item.labelKey) })"
                  @click="selectPanel(item.panel)">
                  {{ $t(item.state === 'pending' ? 'DeviceAlarm.editor.configure' : 'DeviceAlarm.editor.modify') }}
                </a-button>
              </template>
              <a-tag v-if="item.key === 'level' && item.state === 'complete'" class="device-alarm-editor__level-tag" :class="`alarm-level--${model.level}`">
                <span class="device-alarm-editor__level-dot" aria-hidden="true" />{{ item.value }}
              </a-tag>
              <span v-else class="device-alarm-editor__summary-value" :class="{ 'is-muted': item.state !== 'complete' }" :title="item.value">{{ item.value }}</span>
            </a-card>
          </div>
        </ContentPanel>
      </div>
    </a-form>

    <template #footer>
      <div class="device-alarm-editor__footer">
        <a-button :disabled="saving" @click="close">{{ $t('DeviceAlarm.action.cancel') }}</a-button>
        <a-button type="primary" :loading="saving" @click="emit('save')">{{ $t('DeviceAlarm.action.save') }}</a-button>
      </div>
    </template>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import DeviceAlarmNotificationConfig from './DeviceAlarmNotificationConfig.vue'
import DeviceAlarmNotificationHelp from './editor/DeviceAlarmNotificationHelp.vue'
import DeviceAlarmTargetForm from './editor/DeviceAlarmTargetForm.vue'
import DeviceAlarmTriggerForm from './editor/DeviceAlarmTriggerForm.vue'
import type {
  DeviceAlarmFormModel,
  DeviceAlarmNotifyMethod,
  DeviceAlarmTargetOption,
  ThingModelProperty,
} from '../types'
import { useDeviceAlarmEditor } from './editor/useDeviceAlarmEditor'
import type { IotAlarmTargetSelectOption, IotAlarmTargetSelectQuery } from './IotAlarmTargetSelect.vue'

const props = defineProps({
  saving: { type: Boolean, default: false },
  open: { type: Boolean, default: false },
  model: { type: Object as PropType<DeviceAlarmFormModel>, required: true },
  // 产品详情只允许维护当前产品配置，不能在表单中切换到其他产品或设备。
  fixedProductScope: { type: Boolean, default: false },
  readonlyScope: { type: Boolean, default: false },
  levelOptions: { type: Array as PropType<Array<{ label: string; value: number }>>, default: () => [] },
  productOption: { type: Object as PropType<DeviceAlarmTargetOption | undefined>, default: undefined },
  deviceOption: { type: Object as PropType<DeviceAlarmTargetOption | undefined>, default: undefined },
  productReloadKey: { type: Number, default: 0 },
  productRequest: {
    type: Function as PropType<(query: IotAlarmTargetSelectQuery) => Promise<{ data: IotAlarmTargetSelectOption[] }>>,
    default: async () => ({ data: [], total: 0 }),
  },
  deviceRequest: {
    type: Function as PropType<(query: IotAlarmTargetSelectQuery) => Promise<{ data: IotAlarmTargetSelectOption[] }>>,
    default: async () => ({ data: [], total: 0 }),
  },
  propertyOptions: { type: Array as PropType<ThingModelProperty[]>, default: () => [] },
  notifyMethods: { type: Array as PropType<DeviceAlarmNotifyMethod[]>, default: () => [] },
  notifyLoading: { type: Boolean, default: false },
  notifyFailed: { type: Boolean, default: false },
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'product-change', option?: IotAlarmTargetSelectOption): void
  (e: 'device-change', value?: string, option?: IotAlarmTargetSelectOption): void
  (e: 'property-change', value: string): void
  (e: 'save'): void
  (e: 'retry-methods'): void
}>()

const { t: $t } = useI18n()
const { panels, activePanel, activePanelMeta, panelStates, selectedProperty,
  previewText, relievePreviewText, summaryItems, selectPanel } = useDeviceAlarmEditor(props, $t)

const title = computed(() =>
  props.readonlyScope ? $t('DeviceAlarm.title.edit') : $t('DeviceAlarm.title.create'),
)

function close() {
  if (props.saving) return
  emit('update:open', false)
}
</script>

<style scoped lang="less" src="./DeviceAlarmEditorModal.less"></style>
