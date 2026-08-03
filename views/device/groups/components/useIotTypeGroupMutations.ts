import { ref } from 'vue'
import i18n from '@jetlinks-web-core/locales'
import type { Router, RouteLocationNormalizedLoaded } from 'vue-router'

import {
  createDeviceGroup_api,
  deleteDeviceGroup_api,
  updateDeviceGroup_api,
  type DeviceGroup,
} from '@device-manager-ui/api/deviceGroup'
import type { IotDeviceGroupView } from '@device-manager-ui/hooks/useIotDeviceGroupMeta'

import type { CreateTypeGroupInput, EditTypeGroupModel } from './iotTypeGroup.types'
import type { GroupItem } from './iotDeviceGroupsPage.types'

const $t = i18n.global.t

export interface TypeGroupMutationOptions {
  activeView: { value: IotDeviceGroupView }
  deviceGroups: { value: DeviceGroup[] }
  loadDeviceGroups: () => Promise<void>
  route: RouteLocationNormalizedLoaded
  router: Router
  selectedGroupId: { value: string }
  onChanged: () => void
}

export function useIotTypeGroupMutations(options: TypeGroupMutationOptions) {
  const typeGroupDrawerOpen = ref(false)
  const typeGroupDrawerMode = ref<'create' | 'edit'>('create')
  const typeGroupEditingValue = ref<EditTypeGroupModel | null>(null)
  const typeGroupSaving = ref(false)
  const typeGroupDrawerError = ref('')
  const typeGroupDeleting = ref(false)

  async function handleTypeGroupSave(input: CreateTypeGroupInput) {
    typeGroupSaving.value = true
    typeGroupDrawerError.value = ''
    const isEdit = typeGroupDrawerMode.value === 'edit'
    try {
      const saved = isEdit && typeGroupEditingValue.value
        ? await updateDeviceGroup_api({ ...input, id: typeGroupEditingValue.value.id })
        : await createDeviceGroup_api(input)
      options.onChanged()
      await options.loadDeviceGroups()
      if (options.activeView.value !== 'type') {
        options.activeView.value = 'type'
        await options.router.replace({ query: { ...options.route.query, tab: 'type' } })
      }
      options.selectedGroupId.value = `type:${saved.id}`
      typeGroupDrawerOpen.value = false
      typeGroupEditingValue.value = null
    } catch (error) {
      typeGroupDrawerError.value = error instanceof Error ? error.message : $t('IotDeviceGroups.error.saveGroup')
    } finally {
      typeGroupSaving.value = false
    }
  }

  async function handleTypeGroupDelete(item: GroupItem) {
    if (item.view !== 'type' || typeGroupDeleting.value) return
    typeGroupDeleting.value = true
    try {
      await deleteDeviceGroup_api(item.sourceId)
      options.onChanged()
      await options.loadDeviceGroups()
      options.selectedGroupId.value = options.deviceGroups.value[0]?.id
        ? `type:${options.deviceGroups.value[0].id}`
        : ''
    } finally {
      typeGroupDeleting.value = false
    }
  }

  function openCreateTypeGroupDrawer() {
    typeGroupDrawerMode.value = 'create'
    typeGroupEditingValue.value = null
    typeGroupDrawerOpen.value = true
  }

  function openEditTypeGroupDrawer(item: GroupItem) {
    if (item.view !== 'type') return
    typeGroupDrawerMode.value = 'edit'
    typeGroupEditingValue.value = {
      id: item.sourceId,
      code: item.bizTypeMeta?.code ?? '',
      name: item.name,
      description: item.description,
      sortIndex: item.bizTypeMeta?.sortIndex ?? 0,
    }
    typeGroupDrawerOpen.value = true
  }

  return {
    handleTypeGroupDelete,
    handleTypeGroupSave,
    openCreateTypeGroupDrawer,
    openEditTypeGroupDrawer,
    typeGroupDeleting,
    typeGroupDrawerError,
    typeGroupDrawerMode,
    typeGroupDrawerOpen,
    typeGroupEditingValue,
    typeGroupSaving,
  }
}
