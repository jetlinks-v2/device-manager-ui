<template>
  <a-modal
    :open="open"
    :title="$t('IotDeviceList.assignArea.title', { count: selectedDeviceCount })"
    :confirm-loading="saving"
    :ok-button-props="{ disabled: !selectedAreaId }"
    :ok-text="$t('IotDeviceList.assignArea.confirm')"
    :cancel-text="$t('IotDeviceList.action.cancel')"
    destroy-on-close
    centered
    @update:open="$emit('update:open', $event)"
    @ok="handleOk"
    @cancel="$emit('update:open', false)"
  >
    <div class="assign-area-modal">
      <a-tree-select
        v-model:value="selectedAreaId"
        :tree-data="areaTreeData"
        :loading="loading"
        :placeholder="$t('IotDeviceList.assignArea.placeholder')"
        allow-clear
        show-search
        tree-default-expand-all
        tree-node-filter-prop="title"
        :dropdown-style="{ maxHeight: '320px', overflow: 'auto' }"
        @change="formError = ''"
      />
      <p v-if="visibleError" class="assign-area-modal__error">{{ visibleError }}</p>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { queryProjectSpaceAreaSettings_api } from '@device-manager-ui/api/spaceArea'
import { buildAreaTreeData, type AreaTreeNode } from '../hooks/iotAreaTreeOptions'

const props = defineProps<{
  open: boolean
  projectId: string
  saving?: boolean
  error?: string
  selectedDeviceCount: number
}>()

const emit = defineEmits<{
  (event: 'save', areaId: string): void
  (event: 'update:open', value: boolean): void
}>()

const { t: $t } = useI18n()
const loading = ref(false)
const selectedAreaId = ref('')
const areaTreeData = ref<AreaTreeNode[]>([])
const formError = ref('')
const visibleError = computed(() => formError.value || props.error || '')

watch(() => props.open, (open) => {
  if (!open) return
  selectedAreaId.value = ''
  formError.value = ''
  void loadAreas()
})

async function loadAreas() {
  if (!props.projectId) {
    areaTreeData.value = []
    formError.value = $t('IotDeviceList.assignArea.loadFailed')
    return
  }

  loading.value = true
  try {
    const settings = await queryProjectSpaceAreaSettings_api(props.projectId)
    areaTreeData.value = buildAreaTreeData(settings.areas)
  } catch (error) {
    formError.value = error instanceof Error ? error.message : $t('IotDeviceList.assignArea.loadFailed')
    areaTreeData.value = []
  } finally {
    loading.value = false
  }
}

function handleOk() {
  if (!selectedAreaId.value) {
    formError.value = $t('IotDeviceList.assignArea.selectRequired')
    return
  }
  formError.value = ''
  emit('save', selectedAreaId.value)
}
</script>

<style scoped lang="less">
.assign-area-modal {
  display: grid;
  gap: var(--space-3);
}

.assign-area-modal__error {
  margin: 0;
  color: var(--jet-theme-error);
  font-size: var(--fs-meta);
}
</style>
