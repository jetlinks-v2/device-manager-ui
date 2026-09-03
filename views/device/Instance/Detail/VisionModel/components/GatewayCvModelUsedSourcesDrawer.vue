<template>
  <a-drawer
    :open="open"
    :width="900"
    destroy-on-close
    placement="right"
    @close="$emit('close')"
    @update:open="handleOpenChange"
  >
    <template #title>
      <div class="cv-used-drawer__title">
        <strong>{{ $t('GatewayCvModelUsedSourcesDrawer.title') }}</strong>
        <small>{{ model?.name || '--' }}</small>
      </div>
    </template>

    <section class="cv-used-drawer">
      <a-descriptions v-if="usage" size="small" bordered :column="3">
        <a-descriptions-item :label="$t('GatewayCvModelUsedSourcesDrawer.cameraCount')">
          {{ cameras.length }}
        </a-descriptions-item>
        <a-descriptions-item :label="$t('GatewayCvModelUsedSourcesDrawer.taskCount')">
          {{ tasks.length }}
        </a-descriptions-item>
        <a-descriptions-item :label="$t('GatewayCvModelUsedSourcesDrawer.taskTarget')">
          {{ usageSceneText }}
        </a-descriptions-item>
      </a-descriptions>

      <section class="cv-used-drawer__block">
        <h4>{{ $t('GatewayCvModelUsedSourcesDrawer.cameras') }}</h4>
        <a-table
          :columns="cameraColumns"
          :data-source="cameras"
          :loading="loading"
          :pagination="false"
          :row-key="cameraRowKey"
        >
          <template #emptyText>
            <CloudEmpty :description="$t('GatewayCvModelUsedSourcesDrawer.emptyCameras')" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'online'">
              <a-tag :color="record.online ? 'success' : 'default'">
                {{ record.online ? $t('GatewayCvModelUsedSourcesDrawer.online') : $t('GatewayCvModelUsedSourcesDrawer.offline') }}
              </a-tag>
            </template>
          </template>
        </a-table>
      </section>

      <section class="cv-used-drawer__block">
        <h4>{{ $t('GatewayCvModelUsedSourcesDrawer.tasks') }}</h4>
        <a-table
          :columns="taskColumns"
          :data-source="tasks"
          :loading="loading"
          :pagination="false"
          :row-key="taskRowKey"
        >
          <template #emptyText>
            <CloudEmpty :description="$t('GatewayCvModelUsedSourcesDrawer.emptyTasks')" />
          </template>
        </a-table>
      </section>
    </section>
  </a-drawer>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TableColumnsType } from 'ant-design-vue'
import type {
  EdgeGatewayModelUsageCamera,
  EdgeGatewayModelUsageResponse,
  EdgeGatewayModelUsageTask,
  GatewayCvModelItem,
} from '../gatewayCvModel.types'

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  model: {
    type: Object as PropType<GatewayCvModelItem | undefined>,
    default: undefined,
  },
  usage: {
    type: Object as PropType<EdgeGatewayModelUsageResponse | undefined>,
    default: undefined,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { t: $t } = useI18n()
const cameras = computed(() => props.usage?.cameras || [])
const tasks = computed(() => props.usage?.tasks || [])
const usageSceneText = computed(() => displayText(props.model?.sceneName, props.usage?.tasks?.find(task => task.sceneName)?.sceneName))

const cameraColumns = computed<TableColumnsType<EdgeGatewayModelUsageCamera>>(() => [
  { title: $t('GatewayCvModelUsedSourcesDrawer.columns.deviceName'), dataIndex: 'deviceName', key: 'deviceName', ellipsis: true },
  { title: $t('GatewayCvModelUsedSourcesDrawer.columns.deviceId'), dataIndex: 'deviceId', key: 'deviceId', ellipsis: true },
  { title: $t('GatewayCvModelUsedSourcesDrawer.columns.channelId'), dataIndex: 'channelId', key: 'channelId', ellipsis: true },
  { title: $t('GatewayCvModelUsedSourcesDrawer.columns.online'), key: 'online', width: 100 },
])

const taskColumns = computed<TableColumnsType<EdgeGatewayModelUsageTask>>(() => [
  { title: $t('GatewayCvModelUsedSourcesDrawer.columns.taskName'), dataIndex: 'taskName', key: 'taskName', ellipsis: true },
  { title: $t('GatewayCvModelUsedSourcesDrawer.columns.sceneName'), dataIndex: 'sceneName', key: 'sceneName', ellipsis: true },
  { title: $t('GatewayCvModelUsedSourcesDrawer.columns.taskId'), dataIndex: 'taskId', key: 'taskId', ellipsis: true },
])

function handleOpenChange(value: boolean) {
  if (!value) emit('close')
}

function cameraRowKey(record: EdgeGatewayModelUsageCamera, index?: number) {
  return String(record.deviceId || record.channelId || index)
}

function taskRowKey(record: EdgeGatewayModelUsageTask, index?: number) {
  return String(record.taskId || index)
}

function displayText(...values: Array<string | undefined>) {
  return values.find(value => value && value !== '--') || '--'
}
</script>

<style scoped lang="less">
.cv-used-drawer,
.cv-used-drawer__title,
.cv-used-drawer__block {
  display: grid;
  gap: var(--space-3);
}

.cv-used-drawer__title strong {
  color: var(--jet-theme-text);
  font-size: var(--fs-16);
}

.cv-used-drawer__title small {
  color: var(--jet-theme-text-tertiary, var(--jet-theme-text-disabled));
  font-size: var(--fs-14);
}

.cv-used-drawer__block h4 {
  margin: 0;
  color: var(--jet-theme-text);
  font-size: var(--fs-15);
  font-weight: 700;
}
</style>
