<template>
  <a-modal
    :open="open"
    :width="720"
    :mask-closable="false"
    centered
    :title="title"
    class="device-alarm-editor-modal"
    @cancel="emit('update:open', false)"
  >

    <a-form class="device-alarm-editor" layout="vertical" :model="model">
      <a-form-item :label="$t('DeviceAlarm.form.name')" required>
        <a-input
          v-model:value="model.name"
          :maxlength="64"
          :placeholder="$t('DeviceAlarm.placeholder.name')"
        />
      </a-form-item>

      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item :label="$t('DeviceAlarm.form.product')" required>
            <IotAlarmTargetSelect
              :model-value="model.productId"
              :request="productRequest"
              :selected-option="productOption"
              :placeholder="$t('DeviceAlarm.placeholder.productSearch')"
              :disabled="readonlyScope"
              @change="(_value, option) => emit('product-change', option)"
            />
          </a-form-item>
        </a-col>
        <a-col :span="12">
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

      <a-form-item :label="$t('DeviceAlarm.form.level')" required>
        <j-card-select v-model:value="model.level" :column="5" :options="levelOptions">
          <template #itemRender="{ node }">
            <a-space>
              <span :class="['level-icon', `level-icon--${levelTone(node.value)}`]">
                <AIcon type="WarningFilled" />
              </span>
              <span>{{ node.label }}</span>
            </a-space>
          </template>
        </j-card-select>
      </a-form-item>

      <a-form-item class="device-alarm-editor__trigger" :label="$t('DeviceAlarm.form.trigger')" required>
        <a-radio-group v-model:value="model.trigger" :options="triggerOptions" />
      </a-form-item>

      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item :label="$t('DeviceAlarm.form.lower')" required>
            <a-input-number v-model:value="model.limit.lower" class="device-alarm-editor__number" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item :label="$t('DeviceAlarm.form.upper')" required>
            <a-input-number v-model:value="model.limit.upper" class="device-alarm-editor__number" />
          </a-form-item>
        </a-col>
      </a-row>

      <div class="device-alarm-editor__preview">
        <AIcon type="InfoCircleFilled" />
        <span>{{ previewText }}</span>
      </div>

      <DeviceAlarmNotificationConfig
        :model="model"
        :methods="notifyMethods"
        :users="notifyUsers"
        :loading="notifyLoading"
        @load-more-users="emit('load-more-users')"
      />
    </a-form>

    <template #footer>
      <a-space>
        <a-button @click="emit('update:open', false)">{{ $t('DeviceAlarm.action.cancel') }}</a-button>
        <a-button type="primary" @click="emit('save')">{{ $t('DeviceAlarm.action.save') }}</a-button>
      </a-space>
    </template>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
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
import { formatTriggerText, propertyIdOf, propertyNameOf } from '../utils'
import type { IotAlarmTargetSelectOption, IotAlarmTargetSelectQuery } from './IotAlarmTargetSelect.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  model: { type: Object as PropType<DeviceAlarmFormModel>, required: true },
  readonlyScope: { type: Boolean, default: false },
  levelOptions: { type: Array as PropType<Array<{ label: string; value: number }>>, default: () => [] },
  triggerOptions: { type: Array as PropType<Array<{ label: string; value: string }>>, default: () => [] },
  productOption: { type: Object as PropType<DeviceAlarmTargetOption | undefined>, default: undefined },
  deviceOption: { type: Object as PropType<DeviceAlarmTargetOption | undefined>, default: undefined },
  productRequest: { type: Function as PropType<(query: IotAlarmTargetSelectQuery) => Promise<{ data: IotAlarmTargetSelectOption[] }>>, required: true },
  deviceRequest: { type: Function as PropType<(query: IotAlarmTargetSelectQuery) => Promise<{ data: IotAlarmTargetSelectOption[] }>>, required: true },
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

const title = computed(() =>
  props.readonlyScope ? $t('DeviceAlarm.title.edit') : $t('DeviceAlarm.title.create'),
)

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

const previewText = computed(() => {
  return formatTriggerText({
    ...props.model,
    propertyName: props.model.propertyName || $t('DeviceAlarm.preview.property'),
  })
})
</script>

<style scoped lang="less">
.device-alarm-editor__number {
  width: 100%;
}

.device-alarm-editor {
  padding-top: var(--space-2);
	height: 34.75rem;
	overflow-y: auto;
	overflow-x: hidden;
}

.device-alarm-editor__title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
}

.device-alarm-editor__title h3 {
  margin: 0;
  color: var(--jet-theme-text);
  font-size: var(--fs-h3);
  font-weight: 700;
}

.device-alarm-editor__title-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: var(--jet-theme-radius-lg);
  background: rgba(117, 80, 255, 0.12);
  color: var(--ant-primary-color);
  font-size: 1.25rem;
}

.device-alarm-editor__trigger :deep(.ant-radio-wrapper) {
  margin-right: var(--space-5);
}

.device-alarm-editor__preview {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  border: 0.0625rem solid var(--ant-primary-color-outline);
  border-radius: var(--jet-theme-radius);
  background: var(--jet-theme-primary-bg);
  padding: var(--space-3);
  color: var(--jet-theme-text);
  font-weight: 600;
}

.device-alarm-editor__preview :deep(.anticon) {
  color: var(--ant-primary-color);
}

.level-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  font-size: var(--fs-16);
}

.level-icon--emergency {
  background: #ffe8e8;
  color: #ff4d4f;
}

.level-icon--urgent {
  background: #fff4e4;
  color: #ff8a00;
}

.level-icon--severity {
  background: #fffae8;
  color: #ffb800;
}

.level-icon--ordinary {
  background: #e8f3ff;
  color: #2277e9;
}

.level-icon--warn {
  background: #e6fcfc;
  color: #13c2c2;
}

:deep(.j-card-select .j-card-select-item) {
	border-radius: var(--r-3);
}
</style>
