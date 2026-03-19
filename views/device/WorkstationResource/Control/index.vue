<template>
  <j-page-container>
    <a-card title="工位控制" size="small" class="control-page-card">
      <template #extra>
        <a-space :size="8">
          <a-tag color="blue">{{ wsLabel }}</a-tag>
          <a-tag color="geekblue">{{ deviceLabel }}</a-tag>
          <a-tag :color="conflictLock ? 'red' : 'cyan'">
            {{ conflictLock ? '设备被占用，不可控' : '可下发' }}
          </a-tag>
        </a-space>
      </template>

      <a-steps :current="currentStep" size="small" class="control-page-steps">
        <a-step title="选择工位" :description="wsLabel" />
        <a-step title="选择物模型" :description="formData.modelId || '请选择'" />
        <a-step title="选择设备" :description="deviceLabel" />
      </a-steps>

      <div class="control-three-pane">
        <div class="control-pane">
          <div class="control-pane-title">工位与设备</div>
          <a-form layout="vertical">
            <a-form-item label="工位">
              <a-select
                v-model:value="formData.workstationId"
                show-search
                :filter-option="selectFilterOption"
                option-filter-prop="label"
                :options="store.workstationOptions.value"
                placeholder="请选择工位"
              />
            </a-form-item>
          </a-form>
          <div class="pane-device-block">
            <div class="pane-device-block-title">设备列表</div>
            <a-input v-model:value="deviceKeyword" allow-clear size="small" placeholder="搜索设备" style="margin-bottom: 8px" />
            <div class="pane-device-list">
              <div
                v-for="item in filteredDevices"
                :key="item.id"
                class="pane-device-item"
                :class="{ active: formData.deviceId === item.id }"
                @click="formData.deviceId = item.id"
              >
                <div>
                  <div class="pane-device-name">{{ item.name }}</div>
                  <div class="pane-device-code">{{ item.code }}</div>
                </div>
                <a-tag v-if="formData.deviceId === item.id" color="blue">当前</a-tag>
                <a-tag v-else-if="item.lockInfo" color="red">占用</a-tag>
                <a-tag v-else color="green">空闲</a-tag>
              </div>
              <a-empty v-if="!filteredDevices.length" :image="false" description="暂无设备" />
            </div>
          </div>
        </div>

        <div class="control-pane">
          <div class="control-pane-title">物模型配置</div>
          <a-form layout="vertical">
            <a-form-item label="类型">
              <a-radio-group v-model:value="formData.modelType" :options="modelTypeOptions" option-type="button" button-style="solid" />
            </a-form-item>
            <a-form-item label="物模型项">
              <a-select
                v-model:value="formData.modelId"
                show-search
                :filter-option="selectFilterOption"
                option-filter-prop="label"
                :options="modelOptions"
                placeholder="请选择"
              />
            </a-form-item>
            <template v-if="formData.modelType === 'property' && currentModel">
              <a-form-item :label="currentModel.name">
                <j-value-item
                  v-model:modelValue="paramValues[formData.modelId]"
                  :itemType="currentModel.valueType?.type"
                  :options="propertyValueOptions"
                />
              </a-form-item>
            </template>
            <template v-else-if="formData.modelType === 'function' && paramFields.length">
              <a-form-item v-for="field in paramFields" :key="field.id" :label="field.name">
                <a-input-number v-if="field.type === 'number'" v-model:value="paramValues[field.id]" :min="field.min" :max="field.max" style="width: 100%" />
                <a-select v-else-if="field.type === 'enum'" v-model:value="paramValues[field.id]" :options="field.options" style="width: 100%" />
                <a-switch v-else-if="field.type === 'boolean'" v-model:checked="paramValues[field.id]" />
                <a-input v-else v-model:value="paramValues[field.id]" />
              </a-form-item>
            </template>
          </a-form>
        </div>

        <div class="control-pane">
          <div class="control-pane-title">执行</div>
          <div v-if="conflictLock" class="control-status-bar control-status-bar--error">
            <AIcon type="CloseCircleOutlined" />
            <span>设备被 {{ conflictLock.workstationCode || conflictLock.workstationId }} 占用</span>
          </div>
          <div v-else-if="selectedLock" class="control-status-bar control-status-bar--occupied">
            <AIcon type="LockOutlined" />
            <span>本工位已占用</span>
          </div>
          <div v-else-if="formData.deviceId" class="control-status-bar control-status-bar--ok">
            <AIcon type="CheckCircleOutlined" />
            <span>设备空闲，可下发</span>
          </div>
          <a-button
            type="primary"
            block
            style="margin-top: 16px; height: 44px; font-size: 15px; font-weight: 600"
            :disabled="!canSubmit"
            :loading="submitting"
            @click="submitControl"
          >
            <template #icon><AIcon type="ThunderboltOutlined" /></template>
            下发控制
          </a-button>
        </div>
      </div>
    </a-card>
  </j-page-container>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { selectFilterOption, toParamField } from '../utils'
import { queryWorkstationDevices, getDeviceDetail } from '../api/workstation'
import { getLockByDevice } from '../api/deviceLock'
import { controlDevice } from '../api/control'
import { useResourceStore } from '../useResourceStore'

const store = useResourceStore()
const deviceKeyword = ref('')
const allDevices = ref<any[]>([])
const currentLockInfo = ref<any>(null)
const deviceMetadata = ref<any>(null)
const submitting = ref(false)
const paramValues = reactive<Record<string, any>>({})
const formData = reactive({
  workstationId: '',
  deviceId: '',
  modelType: 'function' as 'property' | 'function',
  modelId: ''
})

const modelTypeOptions = [
  { label: '功能', value: 'function' },
  { label: '属性', value: 'property' }
]

const wsLabel = computed(() => {
  if (!formData.workstationId) return '未选择工位'
  return `${store.getWorkstationCode(formData.workstationId)}｜${store.getWorkstationName(formData.workstationId)}`
})

const deviceLabel = computed(() => {
  if (!formData.deviceId) return '未选择设备'
  const d = allDevices.value.find((item) => item.id === formData.deviceId)
  return d ? `${d.code}｜${d.name}` : formData.deviceId
})

const currentStep = computed(() => {
  if (!formData.workstationId) return 0
  if (!formData.modelId) return 1
  return 2
})

const loadDevices = async () => {
  if (!formData.workstationId) { allDevices.value = []; return }
  try {
    const resp = await queryWorkstationDevices(formData.workstationId, { pageIndex: 0, pageSize: 200, sorts: [{ name: 'createTime', order: 'desc' }] })
    allDevices.value = (resp.result?.data || []).map((d: any) => ({
      id: d.id, code: d.code || d.id, name: d.name || d.id, lockInfo: d.lockInfo
    }))
  } catch { allDevices.value = [] }
}

const filteredDevices = computed(() => {
  const kw = deviceKeyword.value.toLowerCase()
  return allDevices.value.filter(
    (item) => !kw || item.code.toLowerCase().includes(kw) || item.name.toLowerCase().includes(kw)
  )
})

const selectedDevice = computed(() => allDevices.value.find((d) => d.id === formData.deviceId))

const checkDeviceLock = async () => {
  currentLockInfo.value = null
  if (!formData.deviceId) return
  try {
    const resp = await getLockByDevice(formData.deviceId)
    currentLockInfo.value = resp.result || null
  } catch { /* ignore */ }
}

// 获取选中设备的物模型
const loadDeviceMetadata = async () => {
  deviceMetadata.value = null
  if (!formData.deviceId) return
  try {
    const resp = await getDeviceDetail(formData.deviceId)
    const metadata = resp.result?.metadata
    deviceMetadata.value = metadata ? JSON.parse(metadata) : null
  } catch { /* ignore */ }
}

const selectedLock = computed(() =>
  currentLockInfo.value?.workstationId === formData.workstationId ? currentLockInfo.value : null
)
const conflictLock = computed(() =>
  currentLockInfo.value && currentLockInfo.value.workstationId !== formData.workstationId ? currentLockInfo.value : null
)

const parsedModel = computed(() => deviceMetadata.value || { properties: [], functions: [] })

const modelOptions = computed(() => {
  const list = formData.modelType === 'function' ? parsedModel.value.functions || [] : parsedModel.value.properties || []
  return list.map((item: any) => ({ label: `${item.name || item.id}`, value: item.id }))
})

const currentModel = computed(() => {
  const list = formData.modelType === 'function' ? parsedModel.value.functions || [] : parsedModel.value.properties || []
  return list.find((item: any) => item.id === formData.modelId)
})

// 属性写入时的选项（boolean/enum 类型需要）
const propertyValueOptions = computed(() => {
  const vt = currentModel.value?.valueType
  if (!vt) return undefined
  if (vt.type === 'enum') {
    return (vt.elements || []).map((item: any) => ({ label: item.text, value: item.value }))
  }
  if (vt.type === 'boolean') {
    return [
      { label: vt.falseText || 'false', value: vt.falseValue ?? false },
      { label: vt.trueText || 'true', value: vt.trueValue ?? true }
    ]
  }
  return undefined
})

const paramFields = computed(() => {
  const inputs = currentModel.value?.inputs
  return Array.isArray(inputs) ? inputs.map(toParamField) : []
})

const canSubmit = computed(() => !!formData.deviceId && !!formData.modelId && !conflictLock.value && !submitting.value)

watch(() => formData.workstationId, () => {
  formData.deviceId = ''
  formData.modelId = ''
  loadDevices()
})
watch(() => formData.deviceId, () => {
  formData.modelId = ''
  checkDeviceLock()
  loadDeviceMetadata()
})
watch(paramFields, (fields) => {
  Object.keys(paramValues).forEach((k) => { if (!fields.find((f) => f.id === k)) delete paramValues[k] })
  fields.forEach((f) => { if (paramValues[f.id] === undefined) paramValues[f.id] = f.defaultValue })
}, { immediate: true })

const submitControl = async () => {
  if (!canSubmit.value) return
  const payload: Record<string, any> = { deviceId: formData.deviceId }
  if (formData.modelType === 'function') {
    payload.messageType = 'INVOKE_FUNCTION'
    payload.functionId = formData.modelId
    payload.inputs = paramFields.value.map((f) => ({ id: f.id, name: f.name, value: paramValues[f.id] }))
  } else {
    payload.messageType = 'WRITE_PROPERTY'
    payload.properties = { [formData.modelId]: paramValues[formData.modelId] }
  }
  submitting.value = true
  try {
    const resp = await controlDevice(formData.workstationId, payload)
    if (resp.result?.success !== false) {
      message.success('控制下发成功')
    } else {
      message.error(resp.result?.message || '下发失败')
    }
  } catch (e: any) {
    message.error(e?.message || '下发失败')
  } finally { submitting.value = false }
}
</script>

<style scoped lang="less">
.control-page-card { margin-bottom: 16px; }
.control-page-steps { margin-bottom: 24px; }
.control-three-pane { display: grid; grid-template-columns: 280px 1fr 280px; gap: 16px; align-items: start; }
.control-pane { padding: 16px; background: #fff; border: 1px solid #f0f0f0; border-radius: 8px; min-width: 0; }
.control-pane-title { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
.pane-device-block { margin-top: 8px; }
.pane-device-block-title { font-size: 13px; font-weight: 500; margin-bottom: 8px; }
.pane-device-list { max-height: 360px; overflow-y: auto; padding: 4px; background: #fafafa; border: 1px solid #f0f0f0; border-radius: 6px; }
.pane-device-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px; cursor: pointer; background: #fff; border-radius: 6px; & + & { margin-top: 6px; } &.active { background: #e6f4ff; box-shadow: 0 0 0 1px rgba(22, 119, 255, 0.2) inset; } }
.pane-device-name { font-weight: 500; font-size: 13px; }
.pane-device-code { color: rgba(0, 0, 0, 0.45); font-size: 12px; }
.control-status-bar { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 8px; border: 1px solid #f0f0f0; }
.control-status-bar--error { background: #fff2f0; border-color: #ffccc7; color: #cf1322; }
.control-status-bar--occupied { background: #e6f4ff; border-color: #91caff; color: #1677ff; }
.control-status-bar--ok { background: #f6ffed; border-color: #b7eb8f; color: #389e0d; }
</style>
