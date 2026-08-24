import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Rule } from 'ant-design-vue/es/form'
import { updateDeviceBasicInfo_api } from '@device-manager-ui/api/device'
import { queryDeviceGroupDetailList_api, type DeviceGroup } from '@device-manager-ui/api/deviceGroup'
import { queryProjectSpaceAreaSettings_api } from '@device-manager-ui/api/spaceArea'
import type { ProjectArea } from '@device-manager-ui/modules/defaults/types'
import { buildAreaTreeData, isSelectableDeviceArea } from './iotAreaTreeOptions'
import { buildDeviceGroupTreeData } from './iotDeviceGroupTreeOptions'
import { saveIotDeviceAreaGroupBindings } from './iotDeviceAreaGroupBindings'
import { useIotDeviceImageUpload } from './useIotDeviceImageUpload'
import { formatIconValueFont } from '@jetlinks-web-core/components/IconValue'
import type { IotDevice } from '../types'

export type IotEditDeviceDrawerProps = {
  open: boolean
  projectId: string
  device: IotDevice | null
}

type IotEditDeviceDrawerHandlers = {
  updateOpen: (value: boolean) => void
  saved: (deviceId: string) => void
}

export function useIotEditDeviceDrawer(props: IotEditDeviceDrawerProps, handlers: IotEditDeviceDrawerHandlers) {
  const { t: $t } = useI18n()
  const busy = ref(false)
  const errorMessage = ref('')
  const areaOptions = ref<ProjectArea[]>([])
  const groupOptions = ref<DeviceGroup[]>([])
  const formRef = ref<{
    validate?: () => Promise<unknown>
    clearValidate?: () => void
  } | null>(null)
  const imageUpload = useIotDeviceImageUpload()

  const form = reactive({
    name: '',
    areaId: '',
    area: '',
    groupId: [] as string[],
    description: '',
    imageUrl: '',
  })

  const formRules = computed<Record<string, Rule[]>>(() => ({
    name: [{ required: true, message: $t('IotDeviceList.add.nameRequired'), trigger: 'blur' }],
    areaId: [{
      validator: async (_rule, value) => {
        if (value && !isSelectableDeviceArea(selectableAreas.value, String(value))) throw new Error($t('IotDeviceList.add.areaLevelRequired'))
      },
      trigger: 'change',
    }],
  }))

  const selectableAreas = computed(() => areaOptions.value)
  const areaTreeData = computed(() => buildAreaTreeData(selectableAreas.value))
  const groupTreeData = computed(() => buildDeviceGroupTreeData(groupOptions.value))

  function fillForm(device: IotDevice | null) {
    form.name = device?.name && device.name !== '--' ? device.name : ''
    form.areaId = device?.areaId || ''
    form.area = device?.area && device.area !== '--' ? device.area : ''
    form.groupId = resolveGroupIds(device)
    form.description = device?.summary && device.summary !== '--' ? device.summary : ''
    form.imageUrl = device?.imageUrl || ''
    imageUpload.setExistingImage(form.imageUrl)
    errorMessage.value = ''
    busy.value = false
    void nextTick(() => formRef.value?.clearValidate?.())
  }

  function onAreaChange() {
    const area = selectableAreas.value.find((item) => item.id === form.areaId)
    form.area = area?.name ?? ''
  }

  function syncAreaByName() {
    if (form.areaId || !form.area) return
    const area = selectableAreas.value.find((item) => item.name === form.area)
    if (area) form.areaId = area.id
  }

  function findGroupIdByName(name?: string) {
    if (!name) return ''
    return groupOptions.value.find((group) => group.name === name)?.id ?? ''
  }

  function findGroupNameById(id?: string) {
    if (!id) return ''
    return groupOptions.value.find((group) => group.id === id)?.name ?? ''
  }

  function resolveGroupIds(device: IotDevice | null) {
    const ids = [
      ...(device?.groupBindings ?? []).map((group) => group.id),
      device?.groupId,
      findGroupIdByName(device?.groupName || device?.scenario),
    ].filter((id): id is string => Boolean(id))
    return [...new Set(ids)]
  }

  function findGroupNamesByIds(ids: string[]) {
    return ids.map((id) => findGroupNameById(id)).filter(Boolean)
  }

  function clearImage() {
    imageUpload.clearImage()
    form.imageUrl = imageUpload.imageUrl.value
  }

  function selectPresetIcon(icon: string) {
    imageUpload.clearImage()
    form.imageUrl = formatIconValueFont(icon)
    imageUpload.setExistingImage(form.imageUrl)
  }

  async function loadFormOptions() {
    const [areaSettings, groups] = await Promise.all([
      queryProjectSpaceAreaSettings_api(props.projectId).catch(() => ({ areas: [] })),
      queryDeviceGroupDetailList_api().catch(() => []),
    ])
    areaOptions.value = areaSettings.areas
    groupOptions.value = groups
    syncAreaByName()
    form.groupId = resolveGroupIds(props.device)
  }

  function onUpdateOpen(value: boolean) {
    handlers.updateOpen(value)
    if (!value) {
      setTimeout(() => fillForm(null), 200)
    }
  }

  function onClose() {
    handlers.updateOpen(false)
  }

  async function onSubmit() {
    if (!props.device) return
    errorMessage.value = ''
    try {
      await formRef.value?.validate?.()
    } catch {
      return
    }

    busy.value = true
    try {
      const imageUrl = await imageUpload.resolveImageUrl()
      const previousGroupIds = resolveGroupIds(props.device)
      const selectedGroupNames = findGroupNamesByIds(form.groupId)
      const savedDevice = await updateDeviceBasicInfo_api({
        id: props.device.id,
        projectId: props.device.projectId || props.projectId,
        productKey: props.device.productId || props.device.productKey,
        productName: props.device.productName && props.device.productName !== '--' ? props.device.productName : undefined,
        productDeviceType: props.device.deviceTypeValue || undefined,
        name: form.name,
        areaId: form.areaId,
        area: form.area,
        // 基础信息扩展仍是单值 scenario；真实多分组归属以后端分组绑定关系为准。
        scenario: selectedGroupNames[0],
        description: form.description,
        imageUrl,
      })
      await saveIotDeviceAreaGroupBindings({
        deviceId: props.device.id,
        deviceName: form.name,
        productName: savedDevice.productName || props.device.productName,
        state: savedDevice.status || props.device.status,
        areaId: form.areaId,
        previousAreaId: props.device.areaId || '',
        groupIds: form.groupId,
        previousGroupIds,
      })
      handlers.updateOpen(false)
      handlers.saved(props.device.id)
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : $t('IotDeviceDetail.detail.saveFailed')
    } finally {
      busy.value = false
    }
  }

  watch(
    () => props.open,
    (next) => {
      if (!next) return
      fillForm(props.device)
      void loadFormOptions()
    },
  )

  watch(
    () => props.device,
    (device) => {
      if (props.open) fillForm(device)
    },
  )

  return {
    busy,
    errorMessage,
    imagePreviewUrl: imageUpload.imagePreviewUrl,
    imageFileName: imageUpload.imageFileName,
    formRef,
    form,
    formRules,
    areaTreeData,
    groupTreeData,
    onAreaChange,
    handleImageBeforeUpload: imageUpload.handleImageBeforeUpload,
    selectPresetIcon,
    clearImage,
    onUpdateOpen,
    onClose,
    onSubmit,
  }
}
