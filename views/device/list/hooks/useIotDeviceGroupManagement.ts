import { ref } from 'vue'
import { onlyMessage } from '@jetlinks-web/utils'
import i18n from '@jetlinks-web-core/locales'
import {
  createDeviceGroup_api,
  deleteDeviceGroup_api,
  updateDeviceGroup_api,
  type DeviceGroup,
} from '@device-manager-ui/api/deviceGroup'

type ScopeChange = { type: 'area' | 'group'; id: string }
type GroupDialogMode = 'create' | 'createChild' | 'edit'

interface IotDeviceGroupManagementOptions {
  getActiveScope: () => ScopeChange
  reloadGroups: () => Promise<void>
  changeScope: (scope: ScopeChange) => void
}

const $t = i18n.global.t

/** Keeps the group tree and the device-list scope filter in sync after a group mutation. */
export function useIotDeviceGroupManagement(options: IotDeviceGroupManagementOptions) {
  const groupDialogOpen = ref(false)
  const groupDialogMode = ref<GroupDialogMode>('create')
  const groupEditing = ref<DeviceGroup | null>(null)
  const groupSaving = ref(false)
  const groupDialogError = ref('')

  function openCreateGroup() {
    groupDialogMode.value = 'create'
    groupEditing.value = null
    groupDialogError.value = ''
    groupDialogOpen.value = true
  }

  function openCreateChildGroup(group: DeviceGroup) {
    groupDialogMode.value = 'createChild'
    groupEditing.value = group
    groupDialogError.value = ''
    groupDialogOpen.value = true
  }

  function openEditGroup(group: DeviceGroup) {
    groupDialogMode.value = 'edit'
    groupEditing.value = group
    groupDialogError.value = ''
    groupDialogOpen.value = true
  }

  async function saveGroup(name: string) {
    groupSaving.value = true
    groupDialogError.value = ''
    try {
      const editing = groupEditing.value
      const isEdit = groupDialogMode.value === 'edit' && editing
      const saved = isEdit
        ? await updateDeviceGroup_api({
          id: editing.id,
          code: editing.key || editing.id,
          name,
          parentId: editing.parentId,
          description: editing.description,
          sortIndex: editing.sortIndex,
        })
        : await createDeviceGroup_api({
          code: `group_${Date.now().toString(36)}`,
          name,
          parentId: groupDialogMode.value === 'createChild' ? editing?.id : undefined,
        })

      await options.reloadGroups()
      options.changeScope({ type: 'group', id: saved.id })
      onlyMessage($t(isEdit ? 'IotDeviceList.scope.groupUpdated' : 'IotDeviceList.scope.groupCreated', { name: saved.name }), 'success')
      groupDialogOpen.value = false
      groupEditing.value = null
    } catch (error) {
      groupDialogError.value = error instanceof Error ? error.message : $t('IotDeviceList.scope.groupSaveFailed')
    } finally {
      groupSaving.value = false
    }
  }

  async function deleteGroup(group: DeviceGroup) {
    try {
      await deleteDeviceGroup_api(group.id)
      await options.reloadGroups()
      if (options.getActiveScope().type === 'group' && options.getActiveScope().id === group.id) {
        options.changeScope({ type: 'group', id: '' })
      }
      onlyMessage($t('IotDeviceList.scope.groupDeleted', { name: group.name }), 'success')
    } catch (error) {
      onlyMessage(error instanceof Error ? error.message : $t('IotDeviceList.scope.groupDeleteFailed'), 'error')
      throw error
    }
  }

  return {
    deleteGroup,
    groupDialogError,
    groupDialogMode,
    groupDialogOpen,
    groupEditing,
    groupSaving,
    openCreateChildGroup,
    openCreateGroup,
    openEditGroup,
    saveGroup,
  }
}
