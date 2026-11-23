<template>
  <div class="table-group-warp">
    <h4 class="table-group-heading">{{ $t('deviceDetailOptimization.propertyGroups') }}<DocumentHelp code="device/Product" help-key="metadata.groups" /></h4>
    <a-tabs tab-position="left" type="line" v-model:activeKey="myActiveKey" @change="change">
      <a-tab-pane v-for="item in options" :key="item.value" :closable="false">
        <template #tab>
          <div class="table-group-error-warp">
            <div class="table-group-error-warp-label">
              <j-ellipsis class="table-group-name">{{ item.label }}</j-ellipsis>
              <span class="table-group-count">({{ item.effective || 0 }})</span>
              <a-tooltip v-if="target === 'device' && item.inherited" :title="$t('deviceDetailOptimization.inheritedGroupHint')">
                <span class="table-group-inherited">{{ $t('deviceDetailOptimization.inheritedGroup') }}</span>
              </a-tooltip>
            </div>
            <a-dropdown v-if="canManageMetadataGroup(item, target, readonly)" :trigger="['click']" placement="bottomRight" :get-popup-container="node => tableWrapperRef || node">
              <template #overlay>
                <a-menu @click="e => menuClick(e, item)">
                  <a-menu-item key="edit">{{ $t('Metadata.group.497268-0') }}</a-menu-item>
                  <a-menu-item key="delete" danger>{{ $t('Metadata.group.497268-1') }}</a-menu-item>
                </a-menu>
              </template>
              <a-button class="table-group-actions" type="text" size="small" :aria-label="$t('deviceDetailOptimization.groupActions', { name: item.label })" @click.stop @keydown.stop>
                <template #icon><AIcon type="EllipsisOutlined" /></template>
              </a-button>
            </a-dropdown>
            <a-tooltip v-if="errorMap[item.value]" color="#ffffff" :get-popup-container="popContainer">
              <template #title><span class="table-group-error-text">{{ $t('Metadata.group.497268-2') }}</span></template>
              <div class="table-group-error-target" />
            </a-tooltip>
          </div>
        </template>
      </a-tab-pane>
    </a-tabs>
    <a-button v-if="!readonly" class="table-group-add" type="dashed" block @click="onAdd(undefined, 'add')">
      <template #icon><AIcon type="PlusOutlined" /></template>
      {{ $t('deviceDetailOptimization.addGroup') }}
    </a-button>
    <a-modal
      :open="visible"
      :title="$t('Metadata.group.497268-3')"
      :maskClosable="false"
      :getContainer="modalContainer"
      @cancel="onCancel"
      @ok="onOk"
    >
      <a-form ref="formRef" :model="formData" @finish="onOk" layout="vertical">
        <a-form-item :label="$t('Metadata.group.497268-9')" name="label" :rules="[{ required: true, message: $t('Metadata.group.497268-4')}, { max: 16, message: $t('Metadata.group.497268-5')}]">
          <a-input v-model:value="formData.label" :placeholder="$t('Metadata.group.497268-4')"/>
        </a-form-item>
        <a-form-item :label="$t('Metadata.group.497268-10')" name="value" validate-first :rules="[
            { required: true, message: $t('Metadata.group.497268-11')},
            { pattern: /^[a-zA-Z0-9_\-]+$/, message: $t('Save.index.902471-2')},
            { max: 64, message: $t('Save.index.912481-20')},
            { max: 64, message: $t('Save.index.912481-20')},
            {
                                    validator: vailId,
                                    trigger: 'blur',
                                },
            ]">
          <a-input v-model:value="formData.value" :placeholder="$t('Metadata.group.497268-11')"/>
        </a-form-item>
        <a-form-item v-show="false">
          <a-button html-type="submit"></a-button>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import DocumentHelp from '@jetlinks-web-core/components/DocumentHelp'
import {Modal} from "ant-design-vue";
import {randomNumber} from "@jetlinks-web/utils";
import {isFullScreen} from "@jetlinks-web-core/utils";
import {useTableGroupError, useTableWrapper} from './context'
import { useI18n } from 'vue-i18n';
import {cloneDeep} from "lodash-es";
import { canManageMetadataGroup } from './groupPolicy'

defineOptions({ name: 'MetadataBaseTableGroup' })

const { t: $t } = useI18n();
const props = defineProps({
  options: {
    type: Array,
    default: () => []
  },
  activeKey: {
    type: String,
    default: undefined
  },
  readonly: {
    type: Boolean,
    default: false
  },
  target: {
    type: String,
    default: "product",
  },
})

const emit = defineEmits(['delete', 'edit', 'add', 'change', 'update:activeKey'])

const myActiveKey = ref(props.activeKey)
const visible = ref(false)
const type = ref($t('Metadata.group.497268-6'))
const errorMap = useTableGroupError()
const tableWrapperRef = useTableWrapper()
const addIndex = ref(0)

const formRef = ref()
const formData = reactive({
  label: undefined,
  value: undefined,
  oldValue: undefined
})

const vailId = async (_, value) => {
  if(formData.oldValue === value){
    return Promise.resolve();
  }
  const dt = props.options.find(item => item.value === value)
  if(dt){
    return Promise.reject($t('Metadata.group.497268-12'));
  } else {
    return Promise.resolve();
  }
};

const onAdd = (targetKey, action) => {
  if (props.readonly) return
  if (action === 'add') {
    type.value = 'add'
    // 获取上一个包含 “分组_” 的信息
    const groupName = props.options.filter(item => item.label.includes($t('Metadata.group.497268-7')))
    let index = addIndex.value + 1
    let findStatus = false
    while (!findStatus) {
      const status = groupName.some(item => {
        const [ _, _index] = item.label.split('_')
        if (index === Number(_index)) {
          index = Number(_index) + 1
          return true
        }
        return false
      })

      findStatus = !status
    }

    addIndex.value = index
    formData.label = $t('Metadata.group.497268-7') + index
    onOk()
  }
}

const onEdit = (record) => {
  if (!canManageMetadataGroup(record, props.target, props.readonly)) return
  visible.value = true
  type.value = 'edit'
  formData.label = record.label
  formData.value = record.value
  formData.oldValue = record.value
}


const onCancel = () => {
  formRef.value.resetFields()
  visible.value = false
}
const onOk = () => {
  const data = cloneDeep(formData)
  if (type.value === 'add') {
    data.value = 'group_'+randomNumber()
    myActiveKey.value = data.value
    emit(type.value, data)
    emit('change', data.value, data.label)
    emit('update:activeKey', data.value)
    visible.value = false
  } else {
    formRef.value.validate().then(() => {
      emit(type.value, data)
      emit('change', data.value, data.label)
      visible.value = false
    })
  }
}

const change = () => {
  const item = props.options.find(item => item.value === myActiveKey.value)
  emit('change', myActiveKey.value, item?.label)
  emit('update:activeKey', myActiveKey.value)
}

const menuClick = (e, record) => {
  if (!canManageMetadataGroup(record, props.target, props.readonly)) return
  if (e.key === 'edit') {
    onEdit(record)
  } else {
    Modal.confirm({
      title: $t(props.target === 'device' ? 'deviceDetailOptimization.deleteDeviceGroup' : 'Metadata.group.497268-8'),
      onOk: () => {
        if (!canManageMetadataGroup(record, props.target, props.readonly)) return
        const index = props.options.findIndex(item => item.value === record.value)
        const next = props.options[index - 1] || props.options[index + 1]
        emit('delete', record.value, index)
        myActiveKey.value = next?.value
        emit('change', next?.value, next?.label)
        emit('update:activeKey', next?.value)
      },
    })
  }
}

const popContainer = (e) => {
  return tableWrapperRef.value || e
}

const modalContainer = (e) =>{
  if (isFullScreen()) {
    return tableWrapperRef.value || document.body
  }
  return document.body
}

onMounted(() => {
  myActiveKey.value = props.options[0]?.value
  emit('change', myActiveKey.value, props.options[0]?.label)
  emit('update:activeKey', myActiveKey.value)
})

watch(() => props.activeKey, (val) => {
  myActiveKey.value = val
})

</script>

<style scoped lang="less" src="./group.less" />
