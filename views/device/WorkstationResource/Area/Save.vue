<template>
  <a-modal v-model:open="visible" :title="mode === 'create' ? '新增区域' : '编辑区域'" :maskClosable="false" destroy-on-close width="760px" :confirmLoading="loading" @ok="handleSubmit">
    <a-form layout="vertical">
      <a-row :gutter="16">
        <a-col flex="180px"><a-form-item label="区域图片"><pro-upload v-model="formData.photoUrl" accept="image/jpeg,image/png" /></a-form-item></a-col>
        <a-col flex="auto">
          <a-row :gutter="12">
            <a-col :span="12"><a-form-item label="区域编号" required><a-input v-model:value="formData.code" placeholder="例如：AREA-001" /></a-form-item></a-col>
            <a-col :span="12"><a-form-item label="区域名称" required><a-input v-model:value="formData.name" placeholder="例如：电池老化测试区" /></a-form-item></a-col>
          </a-row>
        </a-col>
      </a-row>
      <a-form-item label="区域说明"><a-textarea v-model:value="formData.remark" :rows="3" /></a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { getAreaDetail, saveArea, updateArea } from '../api/area'

const emit = defineEmits(['success'])
const visible = ref(false)
const loading = ref(false)
const mode = ref<'create' | 'edit'>('create')
const editId = ref('')
const formData = reactive({ code: '', name: '', photoUrl: '', remark: '' })

const resetForm = () => {
  editId.value = ''
  formData.code = ''
  formData.name = ''
  formData.photoUrl = ''
  formData.remark = ''
}

const open = async (currentMode: 'create' | 'edit', id?: string) => {
  mode.value = currentMode
  resetForm()
  if (currentMode === 'edit' && id) {
    editId.value = id
    try {
      const resp = await getAreaDetail(id)
      const area = resp.result
      if (area) {
        formData.code = area.code || ''
        formData.name = area.name || ''
        formData.photoUrl = area.photoUrl || ''
        formData.remark = area.remark || ''
      }
    } catch { message.error('加载区域详情失败') }
  }
  visible.value = true
}

const handleSubmit = async () => {
  if (!formData.code) { message.warning('请输入区域编号'); return }
  if (!formData.name) { message.warning('请输入区域名称'); return }
  loading.value = true
  try {
    if (mode.value === 'edit') {
      await updateArea(editId.value, { ...formData })
    } else {
      await saveArea({ ...formData })
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
.selected-panel { margin-top: 8px; min-height: 32px; }
.selected-hint { color: rgba(0, 0, 0, 0.45); font-size: 12px; }
.selector-preview { margin-bottom: 12px; padding: 8px; background: #f6ffed; border: 1px solid #b7eb8f; border-radius: 4px; }
</style>
