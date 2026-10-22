<template>
  <a-modal
    :open="open"
    width="min(100rem, calc(100vw - 2.25rem))"
    :mask-closable="false"
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

    <a-form class="device-alarm-editor" layout="vertical" :model="model">
      <div class="device-alarm-editor__workspace">
        <aside class="device-alarm-editor__base">
          <h3>{{ $t('DeviceAlarm.editor.baseConfig') }}</h3>

          <a-form-item :label="$t('DeviceAlarm.form.name')" required>
            <a-input
              v-model:value="model.name"
              :maxlength="64"
              :placeholder="$t('DeviceAlarm.placeholder.name')"
            />
          </a-form-item>

          <a-form-item :label="$t('DeviceAlarm.form.level')" required>
            <j-card-select v-model:value="model.level" :column="2" :options="levelOptions">
              <template #itemRender="{ node }">
                <a-space :size="6">
                  <span :class="['level-icon', `level-icon--${levelTone(node.value)}`]">
                    <AIcon type="WarningFilled" />
                  </span>
                  <span>{{ node.label }}</span>
                </a-space>
              </template>
            </j-card-select>
          </a-form-item>

          <nav class="device-alarm-editor__settings" :aria-label="$t('DeviceAlarm.editor.configNavigation')">
            <button
              v-for="panel in panels"
              :key="panel.key"
              type="button"
              class="device-alarm-editor__setting"
              :class="{ 'is-selected': activePanel === panel.key }"
              :aria-pressed="activePanel === panel.key"
              @click="activePanel = panel.key"
            >
              <span class="device-alarm-editor__setting-icon"><AIcon :type="panel.icon" /></span>
              <span class="device-alarm-editor__setting-copy">
                <small>{{ $t(panel.labelKey) }}</small>
                <strong :title="panelSummaries[panel.key]">{{ panelSummaries[panel.key] }}</strong>
              </span>
              <AIcon type="RightOutlined" />
            </button>
          </nav>
        </aside>

        <section class="device-alarm-editor__panel device-alarm-editor__main" :data-panel="activePanel">
          <header class="device-alarm-editor__section-heading">
            <div>
              <h3>{{ $t(activePanelMeta.labelKey) }}</h3>
              <p>{{ $t(activePanelMeta.descriptionKey) }}</p>
            </div>
          </header>

          <div v-show="activePanel === 'target'" class="device-alarm-editor__section">
            <a-row v-if="!fixedProductScope" :gutter="12">
              <a-col :xs="24" :md="12">
                <a-form-item :label="$t('DeviceAlarm.form.product')" required>
                  <IotAlarmTargetSelect
                    :model-value="model.productId"
                    :request="productRequest"
                    :selected-option="productOption"
                    :reload-key="productReloadKey"
                    load-on-reload
                    :placeholder="$t('DeviceAlarm.placeholder.productSearch')"
                    :disabled="readonlyScope"
                    @change="(_value, option) => emit('product-change', option)"
                  />
                </a-form-item>
              </a-col>
              <a-col :xs="24" :md="12">
                <a-form-item :label="$t('DeviceAlarm.form.deviceRange')" required>
                  <IotAlarmTargetSelect
                    :model-value="deviceValue"
                    :request="deviceRequest"
                    :selected-option="deviceOption"
                    :static-options="allDeviceOption"
                    :reload-key="model.productId"
                    :placeholder="$t('DeviceAlarm.placeholder.deviceSearch')"
                    :disabled="readonlyScope"
                    @change="(value, option) => emit('device-change', value, option)"
                  />
                </a-form-item>
              </a-col>
            </a-row>

            <a-form-item :label="$t('DeviceAlarm.form.property')" required>
              <a-select
                show-search
                :value="model.property"
                :disabled="readonlyScope"
                :options="propertySelectOptions"
                :placeholder="$t('DeviceAlarm.placeholder.property')"
                @change="(value) => emit('property-change', String(value))"
              />
            </a-form-item>
          </div>

          <div v-show="activePanel === 'trigger'" class="device-alarm-editor__section">
            <a-form-item class="device-alarm-editor__trigger" :label="$t('DeviceAlarm.form.trigger')" required>
              <a-radio-group v-model:value="model.trigger" :options="triggerOptions" />
            </a-form-item>

            <a-row :gutter="12">
              <a-col :xs="24" :md="12">
                <a-form-item :label="$t('DeviceAlarm.form.lower')" required>
                  <a-input-number v-model:value="model.limit.lower" class="device-alarm-editor__number" />
                </a-form-item>
              </a-col>
              <a-col :xs="24" :md="12">
                <a-form-item :label="$t('DeviceAlarm.form.upper')" required>
                  <a-input-number v-model:value="model.limit.upper" class="device-alarm-editor__number" />
                </a-form-item>
              </a-col>
            </a-row>

            <div class="device-alarm-editor__preview">
              <AIcon type="InfoCircleFilled" />
              <span>{{ previewText }}</span>
            </div>

            <div class="device-alarm-editor__auto-relieve">
              <div class="device-alarm-editor__auto-relieve-header">
                <div>
                  <strong>{{ $t('DeviceAlarm.autoRelieve.title') }}</strong>
                  <p>{{ $t('DeviceAlarm.autoRelieve.description') }}</p>
                </div>
                <a-switch v-model:checked="model.autoRelieve" />
              </div>
              <div v-if="model.autoRelieve" class="device-alarm-editor__relieve-preview">
                <AIcon type="CheckCircleFilled" />
                <span>{{ $t('DeviceAlarm.autoRelieve.condition') }}{{ relievePreviewText }}</span>
              </div>
            </div>
          </div>

          <div v-show="activePanel === 'notification'" class="device-alarm-editor__section">
            <RegistryComponent page-code="device/alarm" code="alarm-editor">
              <DeviceAlarmNotificationConfig
                key="notification"
                :model="model"
                :methods="notifyMethods"
                :users="notifyUsers"
                :loading="notifyLoading"
                @load-more-users="emit('load-more-users')"
              />
            </RegistryComponent>
          </div>
        </section>

        <aside class="device-alarm-editor__panel device-alarm-editor__summary">
          <header class="device-alarm-editor__section-heading">
            <div>
              <h3>{{ $t('DeviceAlarm.editor.summaryTitle') }}</h3>
              <p>{{ $t('DeviceAlarm.editor.summaryDescription') }}</p>
            </div>
          </header>
          <dl class="device-alarm-editor__summary-list">
            <div v-for="item in summaryItems" :key="item.key">
              <dt><AIcon :type="item.icon" />{{ $t(item.labelKey) }}</dt>
              <dd :title="item.value">{{ item.value }}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </a-form>

    <template #footer>
      <div class="device-alarm-editor__footer">
        <a-button @click="close">{{ $t('DeviceAlarm.action.cancel') }}</a-button>
        <a-button type="primary" @click="emit('save')">{{ $t('DeviceAlarm.action.save') }}</a-button>
      </div>
    </template>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import DeviceAlarmNotificationConfig from './DeviceAlarmNotificationConfig.vue'
import IotAlarmTargetSelect from './IotAlarmTargetSelect.vue'
import type {
  DeviceAlarmFormModel,
  DeviceAlarmNotifyMethod,
  DeviceAlarmNotifyUser,
  DeviceAlarmTargetOption,
  ThingModelProperty,
} from '../types'
import { formatRelieveText, formatTriggerText, propertyIdOf, propertyNameOf } from '../utils'
import type { IotAlarmTargetSelectOption, IotAlarmTargetSelectQuery } from './IotAlarmTargetSelect.vue'

type EditorPanel = 'target' | 'trigger' | 'notification'

const props = defineProps({
  open: { type: Boolean, default: false },
  model: { type: Object as PropType<DeviceAlarmFormModel>, required: true },
  // 产品详情只允许维护当前产品配置，不能在表单中切换到其他产品或设备。
  fixedProductScope: { type: Boolean, default: false },
  readonlyScope: { type: Boolean, default: false },
  levelOptions: { type: Array as PropType<Array<{ label: string; value: number }>>, default: () => [] },
  triggerOptions: { type: Array as PropType<Array<{ label: string; value: string }>>, default: () => [] },
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
  notifyUsers: { type: Array as PropType<DeviceAlarmNotifyUser[]>, default: () => [] },
  notifyLoading: { type: Boolean, default: false },
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'product-change', option?: IotAlarmTargetSelectOption): void
  (e: 'device-change', value?: string, option?: IotAlarmTargetSelectOption): void
  (e: 'property-change', value: string): void
  (e: 'load-more-users'): void
  (e: 'save'): void
}>()

const { t: $t } = useI18n()
const activePanel = ref<EditorPanel>('target')
const panels = [
  { key: 'target', icon: 'AimOutlined', labelKey: 'DeviceAlarm.editor.target', descriptionKey: 'DeviceAlarm.editor.targetDescription' },
  { key: 'trigger', icon: 'ThunderboltOutlined', labelKey: 'DeviceAlarm.editor.trigger', descriptionKey: 'DeviceAlarm.editor.triggerDescription' },
  { key: 'notification', icon: 'BellOutlined', labelKey: 'DeviceAlarm.editor.notification', descriptionKey: 'DeviceAlarm.editor.notificationDescription' },
] as const

watch(() => props.open, (open) => {
  if (open) activePanel.value = 'target'
})

const title = computed(() =>
  props.readonlyScope ? $t('DeviceAlarm.title.edit') : $t('DeviceAlarm.title.create'),
)

const activePanelMeta = computed(() => panels.find(panel => panel.key === activePanel.value) ?? panels[0])
const emptySummary = computed(() => $t('DeviceAlarm.editor.notSelected'))

const propertySelectOptions = computed(() =>
  props.propertyOptions.map((property) => ({
    label: propertyNameOf(property),
    value: propertyIdOf(property),
    disabled: Boolean(property.alarmConfigured),
  })),
)

const allDeviceOption = computed(() => [{ label: $t('DeviceAlarm.deviceRange.all'), value: '__all__' }])
const deviceValue = computed(() => props.model.source === 'device' ? props.model.deviceId : '__all__')

const levelTone = (level: unknown) => {
  switch (Number(level)) {
    case 1: return 'emergency'
    case 2: return 'urgent'
    case 3: return 'severity'
    case 4: return 'ordinary'
    default: return 'warn'
  }
}

const previewText = computed(() => formatTriggerText({
  ...props.model,
  propertyName: props.model.propertyName || $t('DeviceAlarm.preview.property'),
}))

const relievePreviewText = computed(() => formatRelieveText({
  ...props.model,
  propertyName: props.model.propertyName || $t('DeviceAlarm.preview.property'),
}))

const productSummary = computed(() => props.model.productName || props.productOption?.label || emptySummary.value)
const deviceSummary = computed(() => props.model.source === 'device'
  ? (props.model.targetName || props.deviceOption?.label || emptySummary.value)
  : $t('DeviceAlarm.deviceRange.all'))
const targetSummary = computed(() => [productSummary.value, deviceSummary.value].filter(Boolean).join(' / '))
const propertySummary = computed(() => props.model.propertyName || props.model.property || emptySummary.value)
const levelSummary = computed(() => props.levelOptions.find(option => option.value === props.model.level)?.label || emptySummary.value)
const notificationSummary = computed(() => {
  if (!props.model.notification.enabled) return $t('DeviceAlarm.notification.disabled')
  const configured = Boolean(
    props.model.notification.channelProviders.length
    || props.model.notification.notifyChannelIds?.length
    || props.model.notification.userIds.length,
  )
  return $t(configured ? 'DeviceAlarm.notification.configured' : 'DeviceAlarm.notification.enabled')
})
const triggerPanelSummary = computed(() =>
  `${previewText.value} · ${
    props.model.autoRelieve
      ? relievePreviewText.value
      : $t('DeviceAlarm.editor.off')
  }`,
)

const panelSummaries = computed<Record<EditorPanel, string>>(() => ({
  target: targetSummary.value,
  trigger: triggerPanelSummary.value,
  notification: notificationSummary.value,
}))

const summaryItems = computed(() => [
  { key: 'target', icon: 'AimOutlined', labelKey: 'DeviceAlarm.editor.target', value: targetSummary.value },
  { key: 'property', icon: 'ApartmentOutlined', labelKey: 'DeviceAlarm.form.property', value: propertySummary.value },
  { key: 'level', icon: 'WarningOutlined', labelKey: 'DeviceAlarm.form.level', value: levelSummary.value },
  { key: 'trigger', icon: 'ThunderboltOutlined', labelKey: 'DeviceAlarm.column.trigger', value: previewText.value },
  {
    key: 'relieve',
    icon: 'CheckCircleOutlined',
    labelKey: 'DeviceAlarm.editor.relieve',
    value: props.model.autoRelieve ? relievePreviewText.value : $t('DeviceAlarm.editor.off'),
  },
  { key: 'notification', icon: 'BellOutlined', labelKey: 'DeviceAlarm.editor.notification', value: notificationSummary.value },
])

function close() {
  emit('update:open', false)
}
</script>

<style scoped lang="less" src="./DeviceAlarmEditorModal.less"></style>
