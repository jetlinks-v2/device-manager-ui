<template>
  <a-modal
    :open="open"
    :title="$t('IotDeviceList.assignGroup.title', { count: selectedDeviceCount })"
    :confirm-loading="saving"
    :ok-button-props="{ disabled: !selectedGroupId }"
    :ok-text="$t('IotDeviceList.assignGroup.confirm')"
    :cancel-text="$t('IotDeviceList.action.cancel')"
    destroy-on-close
    centered
    @update:open="$emit('update:open', $event)"
    @ok="handleOk"
    @cancel="$emit('update:open', false)"
  >
    <div class="assign-group-modal">
      <a-tree-select
        v-model:value="selectedGroupId"
        :tree-data="groupTreeData"
        :loading="loading"
        :placeholder="$t('IotDeviceList.assignGroup.searchPlaceholder')"
        allow-clear
        show-search
        tree-default-expand-all
        tree-node-filter-prop="title"
        :dropdown-style="{ maxHeight: '320px', overflow: 'auto' }"
        @change="formError = ''"
      />
      <p v-if="visibleError" class="assign-group-modal__error">{{ visibleError }}</p>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { queryDeviceGroupDetailList_api, type DeviceGroup } from '@device-manager-ui/api/deviceGroup'
import { buildDeviceGroupTreeData, type DeviceGroupTreeNode } from '../hooks/iotDeviceGroupTreeOptions'

const props = defineProps<{
  open: boolean
  saving?: boolean
  error?: string
  selectedDeviceCount: number
}>()

const emit = defineEmits<{
  (event: 'save', group: DeviceGroup): void
  (event: 'update:open', value: boolean): void
}>()

const { t: $t } = useI18n()
const loading = ref(false)
const groups = ref<DeviceGroup[]>([])
const selectedGroupId = ref('')
const groupTreeData = ref<DeviceGroupTreeNode[]>([])
const formError = ref('')
const visibleError = computed(() => formError.value || props.error || '')

watch(() => props.open, (open) => {
  if (!open) return
  selectedGroupId.value = ''
  formError.value = ''
  void loadGroups()
})

async function loadGroups() {
  loading.value = true
  try {
    groups.value = await queryDeviceGroupDetailList_api()
    groupTreeData.value = buildDeviceGroupTreeData(groups.value)
  } catch (error) {
    groups.value = []
    groupTreeData.value = []
    formError.value = error instanceof Error ? error.message : $t('IotDeviceList.assignGroup.loadFailed')
  } finally {
    loading.value = false
  }
}

function handleOk() {
  const group = groups.value.find((item) => item.id === selectedGroupId.value)
  if (!group) {
    formError.value = $t('IotDeviceList.assignGroup.selectRequired')
    return
  }
  formError.value = ''
  emit('save', group)
}
</script>

<style scoped lang="less">
.assign-group-modal {
  display: grid;
  gap: var(--space-3);
}

.assign-group-modal__error {
  margin: 0;
  color: var(--jet-theme-error);
  font-size: var(--fs-meta);
}
</style>
