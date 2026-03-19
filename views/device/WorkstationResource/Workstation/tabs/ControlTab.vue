<template>
  <div class="control-tab">
    <div class="control-two-pane">
      <!-- 左：设备列表 -->
      <div class="control-pane control-pane-devices">
        <div class="control-pane-title">
          工位设备
          <span class="pane-device-total">共 {{ deviceTotal }} 台</span>
        </div>
        <a-input-search
          v-model:value="deviceKeyword"
          allow-clear
          size="small"
          placeholder="搜索设备编号/名称"
          style="margin-bottom: 12px"
          @search="handleDeviceSearch"
          @pressEnter="handleDeviceSearch"
        />
        <div class="pane-device-list" ref="deviceListRef" @scroll="onDeviceScroll">
          <div
            v-for="item in allDevices"
            :key="item.id"
            class="pane-device-item"
            :class="{ active: formData.deviceId === item.id }"
            @click="formData.deviceId = item.id"
          >
            <div class="pane-device-main">
              <div class="pane-device-name">{{ item.name }}</div>
              <div class="pane-device-code">{{ item.code }}</div>
            </div>
            <a-tag v-if="formData.deviceId === item.id" color="blue">当前</a-tag>
            <a-tag v-else-if="item.lockInfo" color="red">占用中</a-tag>
            <a-tag v-else color="green">空闲</a-tag>
          </div>
          <div v-if="hasMoreDevices" class="pane-device-more">
            <a-spin v-if="loadingMore" size="small" />
            <span v-else class="pane-device-more-hint">向下滚动加载更多</span>
          </div>
          <a-empty v-if="!allDevices.length" :image="false" description="暂无设备" />
        </div>
      </div>

      <!-- 右：校验状态 + 物模型配置 -->
      <div class="control-pane control-pane-editor">
        <!-- 顶部：选中设备状态条 -->
        <div class="control-status-bar" :class="statusBarClass">
          <template v-if="selectedDevice">
            <div class="control-status-bar__left">
              <AIcon :type="conflictLock ? 'CloseCircleOutlined' : 'CheckCircleOutlined'" class="control-status-bar__icon" />
              <span class="control-status-bar__name">{{ selectedDevice.name }}</span>
              <span class="control-status-bar__code">{{ selectedDevice.code }}</span>
              <a-tag size="small">{{ selectedDevice.productId }}</a-tag>
            </div>
            <div class="control-status-bar__right">
              <a-tag v-if="conflictLock" color="red">被 {{ conflictLock.workstationCode || conflictLock.workstationId }} 占用，不可控</a-tag>
              <a-tag v-else-if="selectedLock" color="cyan">本工位占用中，可下发</a-tag>
              <a-tag v-else color="green">空闲，可下发</a-tag>
            </div>
          </template>
          <template v-else>
            <AIcon type="InfoCircleOutlined" style="margin-right: 8px; color: rgba(0,0,0,0.35)" />
            <span style="color: rgba(0,0,0,0.45)">请从左侧选择一台设备</span>
          </template>
        </div>

        <!-- 物模型选择 + 参数配置 -->
        <a-form layout="vertical" style="margin-top: 16px">
          <a-row :gutter="16">
            <a-col :span="6">
              <a-form-item label="物模型类型">
                <a-select v-model:value="formData.modelType" :options="modelTypeOptions" />
              </a-form-item>
            </a-col>
            <a-col :span="18">
              <a-form-item label="物模型项">
                <a-select
                  v-model:value="formData.modelId"
                  show-search
                  :filter-option="selectFilterOption"
                  option-filter-prop="label"
                  :options="modelOptions"
                  :disabled="!selectedDevice"
                  placeholder="请先选择设备，再选择物模型项"
                />
              </a-form-item>
            </a-col>
          </a-row>

          <div class="control-param-panel">
            <div class="control-param-panel-title">
              参数配置
              <span v-if="formData.modelType === 'function' && paramFields.length" class="control-param-panel-count">{{ paramFields.length }} 个参数</span>
            </div>
            <!-- 属性写入：用 j-value-item 渲染属性值输入 -->
            <template v-if="formData.modelType === 'property'">
              <div v-if="currentModel" style="margin-top: 12px">
                <div class="control-param-item">
                  <div class="control-param-item-title">{{ currentModel.name }}</div>
                  <div class="control-param-item-meta" style="margin: 4px 0 10px">属性值</div>
                  <j-value-item
                    v-model:modelValue="paramValues[formData.modelId]"
                    :itemType="currentModel.valueType?.type"
                    :options="propertyValueOptions"
                  />
                </div>
              </div>
              <a-empty v-else :image="false" description="请选择属性" style="margin-top: 12px" />
            </template>
            <!-- 功能调用：渲染 inputs 参数列表 -->
            <template v-else>
              <a-row :gutter="[12, 12]" style="margin-top: 12px">
                <a-col v-for="field in paramFields" :key="field.id" :span="12">
                  <div class="control-param-item">
                    <div class="control-param-item-title">{{ field.name }}</div>
                    <div class="control-param-item-meta">{{ getParamFieldTypeLabel(field) }}｜{{ getParamFieldMeta(field) }}</div>
                    <a-select v-if="field.type === 'enum'" v-model:value="paramValues[field.id]" :options="field.options" style="width: 100%" />
                    <a-input-number v-else-if="field.type === 'number'" v-model:value="paramValues[field.id]" style="width: 100%" />
                    <div v-else-if="field.type === 'boolean'" style="display: flex; justify-content: space-between; min-height: 32px; align-items: center">
                      <span style="color: rgba(0,0,0,0.65)">开关量</span>
                      <a-switch v-model:checked="paramValues[field.id]" />
                    </div>
                    <a-input v-else v-model:value="paramValues[field.id]" />
                  </div>
                </a-col>
                <a-col v-if="!paramFields.length" :span="24">
                  <a-empty :image="false" :description="formData.modelId ? '当前功能无输入参数' : '请选择功能'" />
                </a-col>
              </a-row>
            </template>
          </div>

          <a-button
            type="primary"
            style="width: 100%; height: 44px; font-size: 15px; font-weight: 600; margin-top: 16px"
            :disabled="!canSubmit"
            @click="submitControl"
          >
            <template #icon><AIcon type="ThunderboltOutlined" /></template>
            下发控制
          </a-button>
        </a-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { getParamFieldMeta, getParamFieldTypeLabel, selectFilterOption, toParamField } from '../../utils'
import { queryWorkstationDevices, getDeviceDetail } from '../../api/workstation'
import { getLockByDevice } from '../../api/deviceLock'
import { controlDevice } from '../../api/control'

const props = defineProps<{ workstationId: string }>()

const deviceKeyword = ref('')
const devicePage = ref(0)
const devicePageSize = 10
const loadingMore = ref(false)
const deviceListRef = ref<HTMLElement>()
const paramValues = reactive<Record<string, any>>({})
const allDevices = ref<any[]>([])
const deviceTotal = ref(0)
const currentLockInfo = ref<any>(null)
const deviceMetadata = ref<any>(null)
const submitting = ref(false)
const formData = reactive({
  deviceId: '',
  modelType: 'function' as 'property' | 'function',
  modelId: ''
})

const modelTypeOptions = [
  { label: '功能', value: 'function' },
  { label: '属性', value: 'property' }
]

const loadDevices = async (append = false) => {
  try {
    const resp = await queryWorkstationDevices(props.workstationId, {
      pageIndex: devicePage.value,
      pageSize: devicePageSize,
      sorts: [{ name: 'createTime', order: 'desc' }],
      terms: deviceKeyword.value ? [
        { column: 'name', termType: 'like', value: `${deviceKeyword.value}%` },
        { type: 'or', column: 'id', termType: 'like', value: `${deviceKeyword.value}%` }
      ] : undefined
    })
    const result = resp.result || {}
    const list = (result.data || []).map((d: any) => ({
      id: d.id,
      code: d.code || d.id,
      name: d.name || d.id,
      lockInfo: d.lockInfo
    }))
    deviceTotal.value = result.total || 0
    allDevices.value = append ? [...allDevices.value, ...list] : list
  } catch { if (!append) allDevices.value = [] }
}

const hasMoreDevices = computed(() => allDevices.value.length < deviceTotal.value)

const onDeviceScroll = (e: Event) => {
  const el = e.target as HTMLElement
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20 && hasMoreDevices.value && !loadingMore.value) {
    loadingMore.value = true
    devicePage.value += 1
    loadDevices(true).finally(() => { loadingMore.value = false })
  }
}

const handleDeviceSearch = () => {
  devicePage.value = 0
  loadDevices()
}

const selectedDevice = computed(() => allDevices.value.find((d) => d.id === formData.deviceId))

// 实时查询选中设备的占用状态
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
  currentLockInfo.value?.workstationId === props.workstationId ? currentLockInfo.value : null
)
const conflictLock = computed(() =>
  currentLockInfo.value && currentLockInfo.value.workstationId !== props.workstationId ? currentLockInfo.value : null
)

const statusBarClass = computed(() => {
  if (!selectedDevice.value) return 'control-status-bar--empty'
  if (conflictLock.value) return 'control-status-bar--error'
  if (selectedLock.value) return 'control-status-bar--occupied'
  return 'control-status-bar--ok'
})

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
  if (!canSubmit.value) { message.warning('请先选择设备和物模型项'); return }

  const controlPayload: Record<string, any> = { deviceId: formData.deviceId }

  if (formData.modelType === 'function') {
    controlPayload.messageType = 'INVOKE_FUNCTION'
    controlPayload.functionId = formData.modelId
    controlPayload.inputs = paramFields.value.map((f) => ({
      id: f.id,
      name: f.name,
      value: paramValues[f.id]
    }))
  } else {
    controlPayload.messageType = 'WRITE_PROPERTY'
    controlPayload.properties = { [formData.modelId]: paramValues[formData.modelId] }
  }

  submitting.value = true
  try {
    const resp = await controlDevice(props.workstationId, controlPayload)
    if (resp.result?.success !== false) {
      message.success('工位控制下发成功')
    } else {
      message.error(resp.result?.message || '下发失败')
    }
  } catch (e: any) {
    message.error(e?.message || '下发失败')
  } finally {
    submitting.value = false
  }
}

onMounted(() => { loadDevices() })
</script>

<style scoped lang="less">
.control-tab { width: 100%; }

.control-two-pane {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.control-pane {
  padding: 16px;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  min-width: 0;
}

.control-pane-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
}

.pane-device-total { font-size: 12px; font-weight: 400; color: rgba(0, 0, 0, 0.45); }

.pane-device-list {
  height: calc(100vh - 420px);
  min-height: 200px;
  max-height: 500px;
  overflow-y: auto;
  padding: 4px;
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
}

.pane-device-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  background: #fff;
  border-radius: 6px;
  & + & { margin-top: 6px; }
  &.active { background: #e6f4ff; box-shadow: 0 0 0 1px rgba(22, 119, 255, 0.2) inset; }
}

.pane-device-name { font-weight: 500; font-size: 13px; }
.pane-device-code { color: rgba(0, 0, 0, 0.45); font-size: 12px; }

.pane-device-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 0;
}
.pane-device-more-hint { color: rgba(0, 0, 0, 0.35); font-size: 12px; }

/* 状态条 */
.control-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
  background: #fafafa;
  min-height: 44px;
  transition: background 0.2s, border-color 0.2s;

  &--empty { background: #fafafa; border-color: #f0f0f0; }
  &--ok { background: #f6ffed; border-color: #b7eb8f; }
  &--occupied { background: #e6fffb; border-color: #87e8de; }
  &--error { background: #fff2f0; border-color: #ffccc7; }
}

.control-status-bar__left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.control-status-bar__icon { font-size: 16px; flex-shrink: 0; }
.control-status-bar--ok .control-status-bar__icon { color: #52c41a; }
.control-status-bar--occupied .control-status-bar__icon { color: #13c2c2; }
.control-status-bar--error .control-status-bar__icon { color: #ff4d4f; }

.control-status-bar__name {
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}
.control-status-bar__code { color: rgba(0, 0, 0, 0.45); font-size: 12px; white-space: nowrap; }
.control-status-bar__right { flex-shrink: 0; }

/* 参数配置 */
.control-param-panel {
  padding: 16px;
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
}
.control-param-panel-title {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}
.control-param-panel-count { font-size: 12px; font-weight: 400; color: rgba(0, 0, 0, 0.45); }
.control-param-item {
  padding: 12px 14px;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
}
.control-param-item-title { font-weight: 500; }
.control-param-item-meta { margin: 4px 0 10px; color: rgba(0, 0, 0, 0.45); font-size: 12px; }

@media (max-width: 900px) {
  .control-two-pane { grid-template-columns: 1fr; }
}
</style>
