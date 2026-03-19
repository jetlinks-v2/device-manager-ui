<template>
  <a-modal v-model:open="visible" :title="mode === 'create' ? '新增工位' : '编辑工位'" :maskClosable="false" destroy-on-close width="860px" :confirmLoading="loading" @ok="handleSubmit">
    <a-form layout="vertical">
      <a-row :gutter="16">
        <a-col flex="180px"><a-form-item label="工位图片"><pro-upload v-model="formData.photoUrl" accept="image/jpeg,image/png" /></a-form-item></a-col>
        <a-col flex="auto">
          <a-row :gutter="12">
            <a-col :span="12"><a-form-item label="工位编号" required><a-input v-model:value="formData.code" placeholder="例如：WS-A-01" /></a-form-item></a-col>
            <a-col :span="12"><a-form-item label="工位名称" required><a-input v-model:value="formData.name" placeholder="例如：老化测试工位01" /></a-form-item></a-col>
          </a-row>
          <a-form-item label="所属区域" required>
            <a-select v-model:value="formData.areaId" show-search :filter-option="selectFilterOption" option-filter-prop="label" :options="store.areaOptions.value" placeholder="请选择所属区域" />
          </a-form-item>
        </a-col>
      </a-row>
      <a-form-item label="配套设备">
        <div class="picker-wrap">
          <a-space style="margin-bottom: 12px">
            <a-button type="primary" @click="openSelector">选择设备</a-button>
            <a-button @click="formData.deviceIds = []; boundDeviceList = []">清空已选</a-button>
            <span class="selected-hint">已选 {{ formData.deviceIds.length }} 台设备</span>
          </a-space>
          <a-table
            :columns="boundDeviceColumns"
            :data-source="boundDeviceList"
            :pagination="formData.deviceIds.length > 10 ? { pageSize: 10, showSizeChanger: false } : false"
            row-key="id"
            size="small"
            :scroll="{ y: 240 }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'action'">
                <a-button type="link" danger size="small" @click="removeDevice(record.id)">移除</a-button>
              </template>
            </template>
          </a-table>
        </div>
      </a-form-item>
      <a-form-item label="工位说明"><a-textarea v-model:value="formData.remark" :rows="3" /></a-form-item>
    </a-form>
  </a-modal>

  <!-- 设备选择弹窗 -->
  <a-modal
    v-model:open="selectorVisible"
    title="选择设备"
    width="980px"
    :maskClosable="false"
    destroy-on-close
    @ok="confirmSelector"
    @cancel="tempSelectedMap.clear(); tempSelectedIds = []"
  >
    <pro-search
      :columns="selectorSearchColumns"
      target="workstation-save-device-selector"
      @search="handleSelectorSearch"
      style="padding: 0"
      :saveButton="false"
    />
    <JProTable
      ref="selectorTableRef"
      :columns="selectorColumns"
      :request="queryDeviceDetail"
      mode="TABLE"
      :params="selectorParams"
      :defaultParams="{ sorts: [{ name: 'createTime', order: 'desc' }] }"
      :rowSelection="{
        selectedRowKeys: tempSelectedIds,
        onSelect: onSelectorSelect,
        onSelectAll: onSelectorSelectAll,
        onSelectNone: () => { tempSelectedIds = []; tempSelectedMap.clear() }
      }"
      :bodyStyle="{ padding: 0 }"
    >
      <template #headerLeftRender>
        <span class="selected-hint">已勾选 {{ tempSelectedIds.length }} 台</span>
      </template>
    </JProTable>
  </a-modal>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { request } from '@jetlinks-web/core'
import { selectFilterOption } from '../utils'
import { getWorkstationBasic, saveWorkstation, updateWorkstation, queryDeviceDetail } from '../api/workstation'
import { useResourceStore } from '../useResourceStore'

const emit = defineEmits(['success'])
const store = useResourceStore()
const visible = ref(false)
const loading = ref(false)
const mode = ref<'create' | 'edit'>('create')
const editId = ref('')
const formData = reactive({ code: '', name: '', photoUrl: '', areaId: '', deviceIds: [] as string[], remark: '' })
let boundDeviceList = ref<any[]>([])

// ---- 设备选择弹窗 ----
const selectorVisible = ref(false)
const selectorTableRef = ref()
const selectorParams = ref<Record<string, any>>({})
let tempSelectedIds = ref<string[]>([])
// 跨页保存选中设备的完整信息，用于回填 boundDeviceList
const tempSelectedMap = reactive(new Map<string, any>())

const selectorSearchColumns = [
  { title: '设备名称', dataIndex: 'name', key: 'name', search: { type: 'string', first: true } },
  { title: '设备ID', dataIndex: 'id', key: 'id', search: { type: 'string', defaultTermType: 'eq' } }
]

const selectorColumns = [
  { title: '设备名称', dataIndex: 'name', key: 'name', ellipsis: true },
  { title: '设备ID', dataIndex: 'id', key: 'id', ellipsis: true },
  { title: '所属产品', dataIndex: 'productName', key: 'productName', ellipsis: true, width: 160 }
]

const boundDeviceColumns = [
  { title: '设备ID', dataIndex: 'id', key: 'id', width: 160 },
  { title: '设备名称', dataIndex: 'name', key: 'name', ellipsis: true },
  { title: '操作', key: 'action', width: 80, fixed: 'right' }
]

const handleSelectorSearch = (params: Record<string, any>) => {
  selectorParams.value = params
  tempSelectedIds.value = []
  tempSelectedMap.clear()
}

const onSelectorSelect = (item: any, selected: boolean) => {
  if (selected) {
    tempSelectedMap.set(item.id, item)
    tempSelectedIds.value = [...tempSelectedIds.value, item.id]
  } else {
    tempSelectedMap.delete(item.id)
    tempSelectedIds.value = tempSelectedIds.value.filter((id) => id !== item.id)
  }
}

const onSelectorSelectAll = (selected: boolean, _: any, changeRows: any[]) => {
  if (selected) {
    changeRows.forEach((item) => { tempSelectedMap.set(item.id, item); })
    const newIds = changeRows.map((item) => item.id).filter((id) => !tempSelectedIds.value.includes(id))
    tempSelectedIds.value = [...tempSelectedIds.value, ...newIds]
  } else {
    changeRows.forEach((item) => tempSelectedMap.delete(item.id))
    const removeSet = new Set(changeRows.map((item) => item.id))
    tempSelectedIds.value = tempSelectedIds.value.filter((id) => !removeSet.has(id))
  }
}

const openSelector = () => {
  tempSelectedIds.value = [...formData.deviceIds]
  tempSelectedMap.clear()
  boundDeviceList.value.forEach((d) => tempSelectedMap.set(d.id, d))
  selectorParams.value = {}
  selectorVisible.value = true
}

const confirmSelector = () => {
  formData.deviceIds = [...tempSelectedIds.value]
  boundDeviceList.value = formData.deviceIds.map((id) => tempSelectedMap.get(id) || { id, name: id })
  selectorVisible.value = false
}

const removeDevice = (id: string) => {
  formData.deviceIds = formData.deviceIds.filter((item) => item !== id)
  boundDeviceList.value = boundDeviceList.value.filter((item) => item.id !== id)
}

const resetForm = () => {
  editId.value = ''
  formData.code = ''
  formData.name = ''
  formData.photoUrl = ''
  formData.areaId = ''
  formData.deviceIds = []
  formData.remark = ''
  boundDeviceList.value = []
  tempSelectedIds.value = []
  tempSelectedMap.clear()
}

const open = async (currentMode: 'create' | 'edit', id?: string) => {
  mode.value = currentMode
  resetForm()
  if (currentMode === 'edit' && id) {
    editId.value = id
    try {
      const resp = await getWorkstationBasic(id)
      const ws = resp.result
      if (ws) {
        formData.code = ws.code || ''
        formData.name = ws.name || ''
        formData.photoUrl = ws.photoUrl || ''
        formData.areaId = ws.areaId || ''
        formData.deviceIds = ws.deviceIds || []
        formData.remark = ws.remark || ''
        if (formData.deviceIds.length) {
          try {
            const devResp = await request.post('/device-instance/detail/_query/no-paging', {
              terms: [{ column: 'id', termType: 'in', value: formData.deviceIds.join(',') }]
            })
            boundDeviceList.value = devResp.result || []
            boundDeviceList.value.forEach((d: any) => tempSelectedMap.set(d.id, d))
          } catch {
            boundDeviceList.value = formData.deviceIds.map((did) => ({ id: did, name: did }))
          }
        }
      }
    } catch { message.error('加载工位详情失败') }
  }
  visible.value = true
}

const handleSubmit = async () => {
  if (!formData.code) { message.warning('请输入工位编号'); return }
  if (!formData.name) { message.warning('请输入工位名称'); return }
  if (!formData.areaId) { message.warning('请选择所属区域'); return }
  if (!formData.deviceIds.length) { message.warning('请至少配置1台配套设备'); return }
  loading.value = true
  try {
    if (mode.value === 'edit') {
      await updateWorkstation(editId.value, { ...formData })
    } else {
      await saveWorkstation({ ...formData })
    }
    message.success(mode.value === 'create' ? '新增成功' : '编辑成功')
    visible.value = false
    emit('success')
  } catch {
    message.error('操作失败')
  } finally {
    loading.value = false
  }
}

defineExpose({ open })
</script>

<style scoped lang="less">
.picker-wrap { padding: 12px; border: 1px solid #f0f0f0; border-radius: 6px; background: #fafafa; }
.selected-hint { color: rgba(0, 0, 0, 0.45); font-size: 12px; }
</style>
