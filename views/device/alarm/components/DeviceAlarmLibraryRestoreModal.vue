<template>
  <a-modal
    :open="open"
    :title="$t('DeviceAlarm.restore.title')"
    width="760px"
    @update:open="(value) => emit('update:open', value)"
    @ok="emit('confirm')"
  >
    <a-form layout="vertical">
      <a-form-item :label="$t('DeviceAlarm.restore.library')" required>
        <a-select
          :value="libraryId"
          show-search
          :loading="loading"
          :options="libraryOptions"
          :placeholder="$t('DeviceAlarm.restore.libraryPlaceholder')"
          @change="(value) => emit('update:libraryId', String(value ?? ''))"
        />
      </a-form-item>
      <a-checkbox
        :checked="clearDeviceConfig"
        @change="(event) => emit('update:clearDeviceConfig', Boolean(event.target.checked))"
      >
        {{ $t('DeviceAlarm.restore.clearDeviceConfig') }}
      </a-checkbox>
    </a-form>

    <a-table
      class="device-alarm-restore__table"
      :row-key="rowKey"
      size="small"
      :loading="loading"
      :columns="columns"
      :data-source="configs"
      :pagination="false"
      :row-selection="{
        selectedRowKeys,
        onChange: (keys) => emit('update:selectedRowKeys', keys.map(String)),
      }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'">
          <span>{{ alarmName(record) }}</span>
        </template>
        <template v-else-if="column.key === 'condition'">
          <span>{{ formatTrigger(record) }}</span>
        </template>
      </template>
      <template #emptyText>
        <CloudEmpty>
          <template #description>
            <span>{{ $t('DeviceAlarm.restore.empty') }}</span>
          </template>
        </CloudEmpty>
      </template>
    </a-table>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DeviceAlarmLibraryTemplate, ThingPropertyPreprocess } from '../types'
import { getAlarmMatcher, getAlarmProcessor } from '../utils'

const props = defineProps({
  open: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  libraryId: { type: String, default: '' },
  clearDeviceConfig: { type: Boolean, default: false },
  selectedRowKeys: { type: Array as PropType<string[]>, default: () => [] },
  libraries: { type: Array as PropType<DeviceAlarmLibraryTemplate[]>, default: () => [] },
  configs: { type: Array as PropType<ThingPropertyPreprocess[]>, default: () => [] },
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'update:libraryId', value: string): void
  (e: 'update:clearDeviceConfig', value: boolean): void
  (e: 'update:selectedRowKeys', value: string[]): void
  (e: 'confirm'): void
}>()

const { t: $t } = useI18n()

const libraryOptions = computed(() => {
  const values = new Set<string>()
  return props.libraries
    .map((item) => ({
      label: [item.name, item.manufacturer, item.model].filter(Boolean).join(' / '),
      value: item.id,
    }))
    .filter((item) => {
      if (!item.value || values.has(item.value)) return false
      values.add(item.value)
      return true
    })
})

const columns = computed(() => [
  { title: $t('DeviceAlarm.column.name'), key: 'name' },
  { title: $t('DeviceAlarm.column.property'), dataIndex: 'propertyName', key: 'propertyName' },
  { title: $t('DeviceAlarm.column.trigger'), key: 'condition' },
])

function alarmName(record: ThingPropertyPreprocess) {
  return String(getAlarmProcessor(record)?.configuration?.alarmName ?? record.name ?? '')
}

function rowKey(record: ThingPropertyPreprocess) {
  return String(record.id ?? record.property ?? '')
}

function formatTrigger(record: ThingPropertyPreprocess) {
  const config = getAlarmMatcher(record)?.configuration ?? {}
  const lower = config.min ?? '-'
  const upper = config.max ?? '-'
  return config.not === false ? `[${lower}, ${upper}]` : `< ${lower} / > ${upper}`
}
</script>

<style scoped lang="less">
.device-alarm-restore__table {
  margin-top: var(--space-4);
}
</style>
