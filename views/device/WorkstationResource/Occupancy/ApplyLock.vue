<template>
  <a-modal v-model:open="visible" title="申请占用" width="720px" :confirmLoading="loading" @ok="handleSubmit">
    <a-form layout="vertical">
      <a-form-item label="工位" required>
        <a-select
          v-if="!fixedWorkstationId"
          v-model:value="formData.workstationId"
          show-search
          :filter-option="selectFilterOption"
          option-filter-prop="label"
          :options="store.workstationOptions.value"
          placeholder="请选择工位"
        />
        <a-input v-else :value="fixedWorkstationLabel" disabled />
      </a-form-item>
      <a-form-item label="占用设备" required>
        <a-select
          v-model:value="formData.deviceIds"
          mode="multiple"
          show-search
          :filter-option="false"
          :options="deviceOptions"
          :loading="deviceLoading"
          placeholder="请选择设备"
          @search="handleDeviceSearch"
          @popupScroll="handleDeviceScroll"
          @dropdownVisibleChange="handleDropdownOpen"
        />
      </a-form-item>
      <a-form-item label="用途说明">
        <a-input v-model:value="formData.reason" placeholder="例如：耐久测试批次A" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { selectFilterOption } from '../utils'
import { applyLock } from '../api/deviceLock'
import { queryWorkstationFreeDevices } from '../api/workstation'
import { useResourceStore } from '../useResourceStore'

const props = defineProps<{ fixedWorkstationId?: string }>()
const emit = defineEmits(['success'])
const store = useResourceStore()
const visible = ref(false)
const loading = ref(false)
const deviceLoading = ref(false)
const deviceOptions = ref<Array<{ label: string; value: string }>>([])
const formData = reactive({ workstationId: '', deviceIds: [] as string[], reason: '' })

// 分页状态
const devicePage = ref(0)
const devicePageSize = 20
const deviceHasMore = ref(true)
const deviceSearchKeyword = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null

const fixedWorkstationLabel = computed(() => {
  if (!props.fixedWorkstationId) return ''
  return `${store.getWorkstationCode(props.fixedWorkstationId)}｜${store.getWorkstationName(props.fixedWorkstationId)}`
})

const resetDevicePager = () => {
  devicePage.value = 0
  deviceHasMore.value = true
  deviceOptions.value = []
}

const loadDeviceOptions = async (append = false) => {
  const wsId = formData.workstationId
  if (!wsId || !deviceHasMore.value) return
  deviceLoading.value = true
  try {
    const params: Record<string, any> = {
      pageIndex: devicePage.value,
      pageSize: devicePageSize,
      sorts: [{ name: 'createTime', order: 'desc' }]
    }
    if (deviceSearchKeyword.value) {
      params.keyword = deviceSearchKeyword.value
    }
    const resp = await queryWorkstationFreeDevices(wsId, params)
    const data = resp.result?.data || []
    const total = resp.result?.total ?? 0
    const newOptions = data.map((d: any) => ({
      label: `${d.code || d.id}｜${d.name || d.id}`,
      value: d.id
    }))
    if (append) {
      deviceOptions.value = [...deviceOptions.value, ...newOptions]
    } else {
      deviceOptions.value = newOptions
    }
    const loaded = (devicePage.value + 1) * devicePageSize
    deviceHasMore.value = loaded < total
  } catch { /* ignore */ } finally {
    deviceLoading.value = false
  }
}

const handleDropdownOpen = (open: boolean) => {
  if (open && formData.workstationId && deviceOptions.value.length === 0) {
    resetDevicePager()
    loadDeviceOptions()
  }
}

const handleDeviceSearch = (val: string) => {
  deviceSearchKeyword.value = val
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    resetDevicePager()
    loadDeviceOptions()
  }, 300)
}

const handleDeviceScroll = (e: Event) => {
  const target = e.target as HTMLElement
  if (target.scrollTop + target.offsetHeight >= target.scrollHeight - 20) {
    if (!deviceLoading.value && deviceHasMore.value) {
      devicePage.value++
      loadDeviceOptions(true)
    }
  }
}

watch(() => formData.workstationId, () => {
  formData.deviceIds = []
  deviceSearchKeyword.value = ''
  resetDevicePager()
  if (formData.workstationId) loadDeviceOptions()
})

watch(visible, (val) => {
  if (val) {
    if (props.fixedWorkstationId) {
      formData.workstationId = props.fixedWorkstationId
    }
  } else {
    formData.workstationId = ''
    formData.deviceIds = []
    formData.reason = ''
    deviceSearchKeyword.value = ''
    resetDevicePager()
  }
})

const open = () => {
  formData.workstationId = props.fixedWorkstationId || ''
  formData.deviceIds = []
  formData.reason = ''
  deviceSearchKeyword.value = ''
  resetDevicePager()
  visible.value = true
}

const openWithDevice = (workstationId: string, deviceId: string) => {
  formData.workstationId = workstationId
  formData.deviceIds = [deviceId]
  formData.reason = ''
  deviceSearchKeyword.value = ''
  resetDevicePager()
  visible.value = true
}

const handleSubmit = async () => {
  if (!formData.workstationId) { message.warning('请选择工位'); return }
  if (!formData.deviceIds.length) { message.warning('请选择设备'); return }
  loading.value = true
  try {
    await applyLock({
      workstationId: formData.workstationId,
      deviceIds: formData.deviceIds,
      reason: formData.reason
    })
    message.success('申请占用成功')
    visible.value = false
    emit('success')
  } catch (e: any) {
    message.error(e?.message || '申请失败')
  } finally {
    loading.value = false
  }
}

defineExpose({ open, openWithDevice })
</script>
