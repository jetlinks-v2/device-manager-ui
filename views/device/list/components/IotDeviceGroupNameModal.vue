<template>
  <a-modal
    :open="open"
    :title="dialogTitle"
    :confirm-loading="saving"
    :ok-text="$t('IotDeviceList.scope.confirm')"
    :cancel-text="$t('IotDeviceList.scope.cancel')"
    centered
    destroy-on-close
    @update:open="$emit('update:open', $event)"
    @ok="handleSave"
  >
    <a-form layout="vertical">
      <a-form-item :label="$t('IotDeviceList.scope.groupName')" required>
        <a-input
          v-model:value="name"
          :maxlength="128"
          :placeholder="$t('IotDeviceList.scope.groupNamePlaceholder')"
          @press-enter="handleSave"
        />
      </a-form-item>
      <a-form-item :label="$t('IotDeviceList.scope.parentGroup')">
        <a-tree-select v-model:value="parentId" :tree-data="parentOptions" show-search tree-node-filter-prop="title" :tree-default-expanded-keys="['']" style="width: 100%" />
      </a-form-item>
    </a-form>
    <p v-if="visibleError" class="iot-device-group-name-modal__error">{{ visibleError }}</p>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DeviceGroup } from '@device-manager-ui/api/deviceGroup'
import { buildDeviceGroupTreeData } from '../hooks/iotDeviceGroupTreeOptions'
import { canMoveGroup, type GroupFormValue } from '../hooks/iotDeviceGroupTreeInteractions'

type GroupDialogMode = 'create' | 'createChild' | 'edit'

const props = defineProps<{
  open: boolean
  mode: GroupDialogMode
  initialName?: string
  initialParentId?: string
  editingId?: string
  groups: DeviceGroup[]
  saving?: boolean
  error?: string
}>()

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'save', value: GroupFormValue): void
}>()

const { t: $t } = useI18n()
const name = ref('')
const parentId = ref('')
const localError = ref('')
const visibleError = computed(() => localError.value || props.error || '')
const dialogTitle = computed(() => $t(props.mode === 'edit' ? 'IotDeviceList.scope.groupDialog.edit' : parentId.value ? 'IotDeviceList.scope.groupDialog.createChild' : 'IotDeviceList.scope.createRootGroup'))
const parentOptions = computed(() => [{
  key: '', value: '', title: $t('IotDeviceList.scope.topLevelGroup'),
  children: buildDeviceGroupTreeData(props.groups.filter(group => !props.editingId || canMoveGroup(props.groups, props.editingId, group.id))),
}])

watch(() => props.open, (open) => {
  if (!open) return
  name.value = props.initialName || ''
  parentId.value = !props.initialParentId || props.initialParentId === '-1' || props.initialParentId === props.editingId ? '' : props.initialParentId
  localError.value = ''
})

function handleSave() {
  const value = name.value.trim()
  if (!value) {
    localError.value = $t('IotDeviceList.scope.groupNameRequired')
    return
  }
  localError.value = ''
  emit('save', { name: value, parentId: parentId.value })
}
</script>

<style scoped>
.iot-device-group-name-modal__error {
  margin: 0;
  color: var(--jet-theme-error);
  font-size: var(--fs-14);
}
</style>
