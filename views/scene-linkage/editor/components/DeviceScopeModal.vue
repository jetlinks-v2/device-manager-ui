<template>
  <a-modal :open="open" :title="title" :width="680" :footer="null" :mask-closable="false" @cancel="$emit('cancel')">
    <a-form layout="vertical">
      <a-input-search v-model:value="keyword" class="device-scope-modal__search" :placeholder="$t('IotSceneLinkage.placeholder.searchDevice')" :loading="deviceLoading" @search="searchDevices" />
      <div class="device-scope-modal__toolbar">
        <a-button-group class="device-scope-modal__tabs">
          <a-button :type="scopeView === 'space' ? 'primary' : 'default'" @click="selectScopeView('space')">{{ $t('IotSceneLinkage.editor.areas') }}</a-button>
          <a-button :type="scopeView === 'device-group' ? 'primary' : 'default'" @click="selectScopeView('device-group')">{{ $t('IotSceneLinkage.editor.groups') }}</a-button>
          <a-button :type="scopeView === 'custom' ? 'primary' : 'default'" @click="selectScopeView('custom')">{{ $t('IotSceneLinkage.editor.customDevices') }}</a-button>
          <a-button :type="scopeView === 'all' ? 'primary' : 'default'" @click="selectScopeView('all')">{{ $t('IotSceneLinkage.editor.allDevices') }}</a-button>
        </a-button-group>
      </div>
      <template v-if="searched">
        <a-spin :spinning="deviceLoading">
          <a-checkbox-group v-if="fixedDeviceOptions.length" :value="fixedDeviceIds" class="device-scope-modal__device-list" @change="changeFixedDevices">
            <a-checkbox v-for="device in fixedDeviceOptions" :key="device.value" :value="device.value"><IotAlarmTargetOption :option="device" type="device" single-line :show-description="false" /></a-checkbox>
          </a-checkbox-group>
          <a-empty v-else-if="!deviceLoading" :description="$t('IotSceneLinkage.scope.empty')" />
          <a-pagination v-if="fixedTotal > pageSize" class="device-scope-modal__pagination" size="small" :current="pageIndex + 1" :page-size="pageSize" :total="fixedTotal" show-less-items @change="changePage" />
        </a-spin>
      </template>
      <a-tree v-else-if="visibleScopeTreeData.length" class="device-scope-modal__tree" checkable block-node :check-strictly="true" :tree-data="visibleScopeTreeData" :checked-keys="checkedKeys" :expanded-keys="expandedKeys" :loading="scopeLoading" @check="onScopeCheck" @expand="onScopeExpand">
        <template #title="node"><IotAlarmTargetOption v-if="node.deviceId" :option="{ label: node.title, value: node.deviceId, data: node.deviceData }" type="device" single-line :show-description="false" /><span v-else class="device-scope-modal__node"><b>{{ node.title }}</b></span></template>
      </a-tree>
      <a-empty v-else-if="draft.selector === 'all'" :description="$t('IotSceneLinkage.scope.allHint')" />
      <a-empty v-else :description="$t('IotSceneLinkage.scope.searchHint')" />
    </a-form>
    <div class="device-scope-modal__footer">
      <a-space>
        <span>{{ draft.selector === 'all' ? $t('IotSceneLinkage.scope.selectedAll') : $t('IotSceneLinkage.scope.selected', { count: draft.selectorValues.length }) }}</span>
        <a-button type="link" :disabled="!canSelectCurrentView" @click="selectAll">{{ $t('IotSceneLinkage.action.selectAll') }}</a-button>
        <a-button type="link" :disabled="!draft.selectorValues.length" @click="clearSelection">{{ $t('IotSceneLinkage.action.clear') }}</a-button>
      </a-space>
      <a-space><a-button @click="$emit('cancel')">{{ $t('IotSceneLinkage.action.cancel') }}</a-button><a-button type="primary" @click="save">{{ $t('IotSceneLinkage.action.confirm') }}</a-button></a-space>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { getProduct, queryDevicesPage } from '../../../../api/scene-linkage'
import { queryDeviceGroupDetailList_api, queryDeviceGroupRuntimeDevices_api } from '../../../../api/deviceGroup'
import { queryProjectSpaceAreaSettings_api } from '../../../../api/spaceArea'
import IotAlarmTargetOption from '../../../device/alarm/components/IotAlarmTargetOption.vue'

export type DeviceScope = {
  selector: 'fixed' | 'space' | 'device-group' | 'all'
  selectorValues: Array<{ value: string; name?: string }>
  options?: { view?: 'space' | 'device-group' | 'custom' | 'all' }
}

const props = defineProps({
  open: { type: Boolean, default: false },
  productId: { type: String, default: '' },
  modelValue: { type: Object as PropType<DeviceScope>, required: true },
})
const emit = defineEmits<{
  (event: 'cancel'): void
  (event: 'save', value: DeviceScope): void
}>()

const { t } = useI18n()
const pageSize = 20
const productName = ref('')
const keyword = ref('')
const pageIndex = ref(0)
const searched = ref(false)
const deviceLoading = ref(false)
const scopeLoading = ref(false)
const fixedTotal = ref(0)
const fixedDeviceOptions = ref<Array<{ label: string; value: string; data: Record<string, any> }>>([])
const scopeView = ref<'space' | 'device-group' | 'custom' | 'all'>()
const expandedKeys = ref<string[]>([])
const scopeTreeData = ref<any[]>([])
const scopeNodeMap = new Map<string, any>()
const loadedScopeDeviceKeys = new Set<string>()
const scopeTreeVersion = ref(0)
const draft = reactive<DeviceScope>({ selector: 'fixed', selectorValues: [] })
const dynamicScope = computed(() => ['space', 'device-group'].includes(draft.selector))
const title = computed(() => t('IotSceneLinkage.title.selectDevicesWithProduct', { productName: productName.value || props.productId || '-' }))
const visibleScopeTreeData = computed(() => ['space', 'device-group'].includes(scopeView.value || '') ? withCheckboxState(scopeTreeData.value.find(item => item.key === `root:${scopeView.value === 'space' ? 'space' : 'group'}`)?.children || []) : [])
const checkedKeys = computed(() => { scopeTreeVersion.value; if (dynamicScope.value) return draft.selectorValues.map(item => `${draft.selector}:${item.value}`); const selectedIds = new Set(draft.selectorValues.map(item => item.value)); return [...scopeNodeMap.values()].filter(node => node.deviceId && selectedIds.has(node.deviceId)).map(node => node.key) })
const fixedDeviceIds = computed(() => draft.selectorValues.map(item => item.value))
const canSelectCurrentView = computed(() => searched.value ? fixedDeviceOptions.value.length > 0 : dynamicScope.value && visibleScopeTreeData.value.length > 0)

watch(() => props.open, async open => {
  if (!open) return
  draft.selector = props.modelValue.selector
  draft.selectorValues = props.modelValue.selectorValues.map(item => ({ value: String(item.value), name: item.name }))
  // 每次打开都先展示区域分组；已保存的选择状态只影响勾选，不改变用户首次看到的分组视图。
  scopeView.value = 'space'
  keyword.value = ''
  searched.value = false
  fixedDeviceOptions.value = []
  await Promise.all([loadProductName(), loadScopeTree()])
  await expandScopeTree('space')
})

async function loadProductName() {
  if (!props.productId) return
  const response: any = await getProduct(props.productId)
  const product = response?.result ?? response
  productName.value = product?.name || props.productId
}

async function changeScopeMode(enabled: boolean) {
  if (enabled) scopeView.value = 'space'
  draft.selector = enabled ? 'space' : 'fixed'
  draft.selectorValues = []
  if (enabled) await expandScopeTree('space')
}

async function selectScopeView(type: 'space' | 'device-group' | 'custom' | 'all') {
  scopeView.value = type
  if (type === 'all') {
    draft.selector = 'all'
    draft.selectorValues = []
    searched.value = false
    return
  }
  if (type === 'custom') {
    await searchDevices()
    return
  }
  searched.value = false
  fixedDeviceOptions.value = []
  fixedTotal.value = 0
  if (dynamicScope.value) {
    draft.selector = type
    draft.selectorValues = []
  } else if (draft.selector === 'all') {
    draft.selector = 'fixed'
    draft.selectorValues = []
  }
  if (!scopeTreeData.value.length) await loadScopeTree()
  await expandScopeTree(type)
}

function onScopeCheck(keys: any) {
  const checked = Array.isArray(keys) ? keys : keys.checked || []
  const nodes = checked.map((key: string) => scopeNodeMap.get(key)).filter(Boolean)
  if (!dynamicScope.value) {
    const knownIds = new Set([...scopeNodeMap.values()].map(node => node.deviceId).filter(Boolean)); const retainedIds = fixedDeviceIds.value.filter(id => !knownIds.has(id)); const selectedIds = nodes.map((node: any) => node.deviceId).filter(Boolean)
    draft.selectorValues = [...new Set([...retainedIds, ...selectedIds])].map(value => ({ value, name: scopeNodeMap.get([...scopeNodeMap.keys()].find(key => scopeNodeMap.get(key)?.deviceId === value) || '')?.title }))
    return
  }
  draft.selectorValues = nodes.filter((node: any) => node.scopeType === draft.selector).map((node: any) => ({ value: node.scopeId }))
}

async function onScopeExpand(keys: string[]) {
  expandedKeys.value = keys
  await Promise.all(keys
    .map(key => scopeNodeMap.get(key))
    .filter(node => node?.scopeType && !loadedScopeDeviceKeys.has(node.key))
    .map(loadScopeDevices))
}

async function expandScopeTree(type: 'space' | 'device-group') {
  const nodes = getScopeNodes(scopeTreeData.value.find(item => item.key === `root:${type === 'space' ? 'space' : 'group'}`)?.children || [])
    .filter(node => node.scopeType === type)
  expandedKeys.value = nodes.map(node => node.key)
  await Promise.all(nodes.map(loadScopeDevices))
}

function changeFixedDevices(values: Array<string | number>) {
  const currentPageIds = new Set(fixedDeviceOptions.value.map(item => item.value))
  const retainedIds = fixedDeviceIds.value.filter(id => !currentPageIds.has(id))
  const selectedIds = values.map(value => String(value))
  draft.selectorValues = [...new Set([...retainedIds, ...selectedIds])].map(value => ({ value, name: fixedDeviceOptions.value.find(item => item.value === value)?.label || draft.selectorValues.find(item => item.value === value)?.name }))
}

function selectAll() {
  const values = new Set(searched.value ? [...fixedDeviceIds.value, ...fixedDeviceOptions.value.map(item => item.value)] : getScopeNodes(visibleScopeTreeData.value).map(node => node.scopeId))
  draft.selectorValues = [...values].map(value => ({ value, name: fixedDeviceOptions.value.find(item => item.value === value)?.label || draft.selectorValues.find(item => item.value === value)?.name }))
}

function clearSelection() {
  if (draft.selector === 'all') {
    draft.selector = 'fixed'
    scopeView.value = 'custom'
  }
  draft.selectorValues = []
}

async function searchDevices() {
  pageIndex.value = 0
  scopeView.value = 'custom'
  searched.value = true
  if (draft.selector !== 'fixed') {
    draft.selector = 'fixed'
    draft.selectorValues = []
  }
  await loadDevices()
}

async function changePage(page: number) {
  pageIndex.value = page - 1
  await loadDevices()
}

async function loadDevices() {
  if (!props.productId) return
  deviceLoading.value = true
  try {
    const response: any = await queryDevicesPage({
      pageIndex: pageIndex.value,
      pageSize,
      terms: [
        { column: 'productId', value: props.productId },
        ...(keyword.value.trim() ? [{ column: 'name', termType: 'like', value: `%${keyword.value.trim()}%`, type: 'or' }, { column: 'id', termType: 'like', value: `%${keyword.value.trim()}%`, type: 'or' }] : []),
      ],
    })
    const result = response?.result ?? response
    const rows = result?.data || result?.records || []
    fixedTotal.value = Number(result?.total ?? result?.totalElements ?? rows.length)
    fixedDeviceOptions.value = rows.map((device: any) => ({
      label: device.name || device.id,
      value: String(device.id),
      data: device,
    }))
    searched.value = true
  } finally {
    deviceLoading.value = false
  }
}

async function loadScopeTree() {
  scopeLoading.value = true
  try {
    const [areas, groups] = await Promise.all([queryProjectSpaceAreaSettings_api(''), queryDeviceGroupDetailList_api()])
    scopeNodeMap.clear()
    loadedScopeDeviceKeys.clear()
    scopeTreeVersion.value++
    const areaNodes = (areas?.areas || []).map((area: any) => {
      const node = { key: `space:${area.id}`, title: area.name, scopeType: 'space', scopeId: String(area.id), isLeaf: false, children: [] as any[] }
      scopeNodeMap.set(node.key, node)
      return node
    })
    const treeMap = new Map(areaNodes.map((node: any) => [node.key, node]))
    const areaRoots: any[] = []
    areaNodes.forEach((node: any) => {
      const area = (areas?.areas || []).find((item: any) => String(item.id) === node.scopeId)
      const parent = area?.parentId ? treeMap.get(`space:${area.parentId}`) : undefined
      if (parent) parent.children.push(node); else areaRoots.push(node)
    })
    const groupNodes = groups.map((group: any) => {
      const node = { key: `device-group:${group.id}`, title: group.name, scopeType: 'device-group', scopeId: String(group.id), isLeaf: false, children: [] as any[] }
      scopeNodeMap.set(node.key, node)
      return node
    })
    scopeTreeData.value = [{ key: 'root:space', children: areaRoots }, { key: 'root:group', children: groupNodes }].filter(item => item.children.length)
    expandedKeys.value = []
  } finally {
    scopeLoading.value = false
  }
}

async function loadScopeDevices(node: any) {
  if (!props.productId || loadedScopeDeviceKeys.has(node.key)) return
  loadedScopeDeviceKeys.add(node.key)
  try {
    // 分组设备按展开动作加载，避免首次打开时同时查询全部区域和业务分组。
    const response: any = node.scopeType === 'space'
      ? await queryDevicesPage({ pageIndex: 0, pageSize: 100, terms: [{ column: 'productId', value: props.productId }, { column: 'id', termType: 'space-bind$device', value: node.scopeId }] })
      : await queryDeviceGroupRuntimeDevices_api(node.scopeId, { pageIndex: 0, pageSize: 100, withAlarmInfo: false, terms: [{ column: 'productId', value: props.productId }] })
    const result = response?.result ?? response
    const rows = result?.data || result?.records || []
    const devices = rows.map((device: any) => ({
      key: `device:${node.key}:${device.id}`,
      title: device.name || device.id,
      deviceId: String(device.id),
      deviceData: device,
    }))
    node.children.push(...devices)
    devices.forEach(device => scopeNodeMap.set(device.key, device))
    scopeTreeVersion.value++
  } catch {
    loadedScopeDeviceKeys.delete(node.key)
  }
}

function save() {
  emit('save', { selector: draft.selector, selectorValues: draft.selectorValues.map(item => ({ value: String(item.value), name: item.name })), options: { view: scopeView.value || 'space' } })
}

function withCheckboxState(nodes: any[]): any[] {
  return nodes.map(node => ({
    ...node,
    disableCheckbox: dynamicScope.value ? !node.scopeType : !node.deviceId,
    children: withCheckboxState(node.children || []),
  }))
}

function getScopeNodes(nodes: any[]): any[] {
  return nodes.flatMap(node => [node, ...getScopeNodes(node.children || [])])
}
</script>

<style scoped>
.device-scope-modal__mode { display: inline-flex; gap: 8px; align-items: center; }
.device-scope-modal__toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.device-scope-modal__tabs { display: inline-flex; }
.device-scope-modal__tabs :deep(.ant-btn) { min-width: 112px; }
.device-scope-modal__search { display: block; width: 100%; margin-bottom: 12px; }
.device-scope-modal__device-list { display: grid; max-height: 360px; overflow: auto; padding: 4px 12px; border: 1px solid var(--ant-color-border-secondary); border-radius: 6px; background: var(--ant-color-bg-container); }
.device-scope-modal__device-list :deep(.ant-checkbox-wrapper) { display: flex; gap: 10px; align-items: center; min-height: 48px; margin-inline-start: 0; border-bottom: 1px solid var(--ant-color-border-secondary); }
.device-scope-modal__device-list :deep(.ant-checkbox-wrapper:last-child) { border-bottom: 0; }
.device-scope-modal__device-list :deep(.ant-checkbox + span) { flex: 1; min-width: 0; }
.device-scope-modal__pagination { display: flex; justify-content: flex-end; margin-top: 12px; }
.device-scope-modal__tree { max-height: 480px; overflow: auto; padding: 8px; border: 1px solid var(--ant-color-border-secondary); border-radius: 6px; }
.device-scope-modal__node { display: flex; gap: 12px; align-items: center; min-width: 0; }
.device-scope-modal__tree :deep(.ant-tree-title) { display: block; min-width: 0; width: 100%; }
.device-scope-modal__tree :deep(.ant-tree-node-content-wrapper) { flex: 1; min-width: 0; }
.device-scope-modal__footer { display: flex; justify-content: space-between; align-items: center; padding-top: 16px; }
</style>
