<template>
  <j-page-container>
    <SceneRecordTimeline v-if="recordScene" :scene="recordScene" @back="recordScene = undefined" />
    <section v-else class="scene-list">
      <PageHeader
        :title="$t('IotSceneLinkage.title.list')"
        :description="$t('IotSceneLinkage.description.list')"
        style="margin: 0"
      >
        <template #actions>
          <j-permission-button
            type="primary"
            hasPermission="iot-user/scene-linkage:add"
            @click="openEditor()"
          >
            <template #icon><AIcon type="PlusOutlined" /></template>
            {{ $t('IotSceneLinkage.title.add') }}
          </j-permission-button>
        </template>
      </PageHeader>
      <div class="scene-list-table">
	      <ConditionFilter :fields="filterFields" :common-fields="filterCommonFields" :model-value="terms" :placeholder="$t('IotSceneLinkage.placeholder.search')" @update:model-value="terms = $event" @change="reload($event)" />
	      <div class="scene-list__count">{{ $t('IotSceneLinkage.list.total', { total }) }}</div>
	      <a-table class="scene-list__table" :loading="loading" :columns="columns" :data-source="list" row-key="scene.id" :pagination="pagination" @change="changePage">
		      <template #bodyCell="{ column, record }">
			      <template v-if="column.dataIndex === 'name'"><strong>{{ record.scene.name }}</strong><div><a-tag class="scene-list__trigger-tag">{{ triggerLabel(record.scene) }}</a-tag></div></template>
			      <template v-else-if="column.dataIndex === 'rule'"><div class="scene-list__summary"><template v-for="part in sceneSummaryParts(record.scene)" :key="part.keyword"><b :class="part.kind === 'action' ? 'scene-list__summary-keyword--action' : 'scene-list__summary-keyword--trigger'">{{ part.keyword }}</b><span :class="`scene-list__summary-field--${part.kind}`">{{ part.value }}</span></template></div></template>
			      <template v-else-if="column.dataIndex === 'state'"><a-switch :checked="stateValue(record.scene) === 'started'" :loading="pendingId === record.scene.id" @change="confirmToggle(record.scene)" /></template>
			      <template v-else-if="column.dataIndex === 'lastExecute'">{{ record.lastExecute || '-' }}</template>
			      <template v-else-if="column.dataIndex === 'actions'"><div class="scene-list__actions"><span><a-button v-if="sceneTriggerType(record.scene) === 'manual'" type="link" @click="confirmExecute(record.scene)">{{ $t('IotSceneLinkage.action.execute') }}</a-button></span><j-permission-button type="link" hasPermission="iot-user/scene-linkage:update" @click="openEditor(record.scene.id)">{{ $t('IotSceneLinkage.action.edit') }}</j-permission-button><a-dropdown><a-button type="link"><AIcon type="MoreOutlined" /></a-button><template #overlay><a-menu><a-menu-item @click="recordScene = record.scene">{{ $t('IotSceneLinkage.action.records') }}</a-menu-item><a-menu-item v-if="stateValue(record.scene) !== 'disable'" danger disabled><a-tooltip :title="$t('IotSceneLinkage.message.disableBeforeDelete')"><span class="scene-list__delete-tooltip">{{ $t('IotSceneLinkage.action.delete') }}</span></a-tooltip></a-menu-item><a-menu-item v-else danger @click="confirmRemove(record.scene)">{{ $t('IotSceneLinkage.action.delete') }}</a-menu-item></a-menu></template></a-dropdown></div></template>
		      </template>
	      </a-table>
      </div>
    </section>
  </j-page-container>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Modal } from 'ant-design-vue'
import ConditionFilter, { type ConditionFilterChangePayload, type ConditionFilterCommonField, type ConditionFilterField, type ConditionFilterTerm } from '@jetlinks-web-core/components/ConditionFilter'
import { onlyMessage } from '@jetlinks-web-core/utils/comm'
import { PageHeader } from '@jetlinks-web-core/components'
import { deleteScene, disableScene, enableScene, executeScene, queryScenes } from '../../api/scene-linkage'
import { normalizeResult } from './utils'
import SceneRecordTimeline from './components/SceneRecordTimeline.vue'
const router = useRouter()
const { t } = useI18n()
const list = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const pendingId = ref('')
const terms = ref<ConditionFilterTerm[]>([])
const queryTerms = ref<ConditionFilterTerm[]>([])
const pageIndex = ref(0)
const pageSize = ref(10)
const recordScene = ref<any>()
const triggerTypeOptions = computed(() => ['manual', 'timer', 'device', 'alarm', 'multi'].map(value => ({
  label: t(`IotSceneLinkage.triggerType.${value}`),
  value,
})))
const filterCommonFields: ConditionFilterCommonField[] = [{ label: t('IotSceneLinkage.form.name'), value: 'name' }, { label: t('IotSceneLinkage.form.triggerType'), value: 'triggerType' }, { label: t('IotSceneLinkage.form.state'), value: 'state' }]
const filterFields = computed<ConditionFilterField[]>(() => [{ dataIndex: 'name', title: t('IotSceneLinkage.form.name'), search: { type: 'string', defaultTermType: 'like', handleParamsItem: term => ({ ...term, value: term.termType === 'like' && typeof term.value === 'string' && !term.value.includes('%') ? `%${term.value}%` : term.value }) } }, { dataIndex: 'triggerType', title: t('IotSceneLinkage.form.triggerType'), search: { type: 'select', defaultTermType: 'eq', options: triggerTypeOptions.value } }, { dataIndex: 'state', title: t('IotSceneLinkage.form.state'), search: { type: 'select', defaultTermType: 'eq', options: [{ label: t('IotSceneLinkage.state.started'), value: 'started' }, { label: t('IotSceneLinkage.state.disable'), value: 'disable' }] } }])
const columns = computed(() => [{ title: t('IotSceneLinkage.column.scene'), dataIndex: 'name', width: 230 }, { title: t('IotSceneLinkage.column.rule'), dataIndex: 'rule' }, { title: t('IotSceneLinkage.column.state'), dataIndex: 'state', width: 100 }, { title: t('IotSceneLinkage.column.action'), dataIndex: 'actions', width: 160 }])
const pagination = computed(() => ({ current: pageIndex.value + 1, pageSize: pageSize.value, total: total.value, showSizeChanger: true, showQuickJumper: true, showTotal: (value: number) => t('IotSceneLinkage.list.total', { total: value }) }))
const stateValue = (scene: any) => scene.state?.value || scene.state
const sceneTriggerType = (scene: any) => scene.triggerType || scene.trigger?.type
const triggerLabel = (scene: any) => t(`IotSceneLinkage.triggerType.${sceneTriggerType(scene)}`)
const sceneSummary = (scene: any) => scene.options?.summary || `${t('IotSceneLinkage.rule.when')} ${triggerLabel(scene)}，${t('IotSceneLinkage.rule.then')} ${(scene.actions || []).map((a: any) => t(`IotSceneLinkage.action.${a.executor}`)).join('、')}`
const sceneSummaryParts = (scene: any) => {
  const text = sceneSummary(scene); const matches = [...text.matchAll(/(?:^|[，。\s])([当且就则])\s*(.*?)(?=[，。\s]+[且就则]|$)/g)]
  return matches.length ? matches.map((item, index) => ({ keyword: item[1], value: item[2].replace(/[，。]\s*$/, '').trim(), kind: item[1] === '就' || item[1] === '则' ? 'action' : index ? 'condition' : 'trigger' })) : [{ keyword: t('IotSceneLinkage.rule.when'), value: text, kind: 'trigger' }]
}
async function reload(payload?: ConditionFilterChangePayload) {
  // 翻页时沿用 ConditionFilter 已转换的查询条件，避免丢失名称模糊匹配的通配符。
  if (payload) queryTerms.value = payload.terms
  loading.value = true
  try {
    const result = normalizeResult<any>(await queryScenes({
      pageIndex: pageIndex.value,
      pageSize: pageSize.value,
      terms: queryTerms.value,
      sorts: [{ name: 'createTime', order: 'desc' }],
    }))
    list.value = result.data.map(scene => ({ scene }))
    total.value = result.total
  } finally {
    loading.value = false
  }
}
function changePage(pager: any) {
  pageIndex.value = Number(pager.current || 1) - 1
  pageSize.value = Number(pager.pageSize || 10)
  reload()
}
function openEditor(id?: string) {
  router.push(id ? `/iot-user/scene-linkage/editor/${id}` : '/iot-user/scene-linkage/editor')
}
async function toggle(scene: any) {
  pendingId.value = scene.id
  try {
    const enabled = stateValue(scene) !== 'started'
    enabled ? await enableScene(scene.id) : await disableScene(scene.id)
    onlyMessage(t(enabled ? 'IotSceneLinkage.message.enabled' : 'IotSceneLinkage.message.disabled', { name: scene.name }), 'success')
    await reload()
  } finally {
    pendingId.value = ''
  }
}
function confirmToggle(scene: any) {
  const enabled = stateValue(scene) !== 'started'
  Modal.confirm({
    title: t(enabled ? 'IotSceneLinkage.confirm.enable' : 'IotSceneLinkage.confirm.disable'),
    onOk: () => toggle(scene),
  })
}
async function execute(scene: any) {
  await executeScene(scene.id)
  onlyMessage(t('IotSceneLinkage.message.executed', { name: scene.name }), 'success')
  await reload()
}
function confirmExecute(scene: any) {
  Modal.confirm({
    title: t('IotSceneLinkage.confirm.executeTitle'),
    content: t('IotSceneLinkage.confirm.executeContent', { name: scene.name }),
    okText: t('IotSceneLinkage.action.execute'),
    onOk: () => execute(scene),
  })
}
function confirmRemove(scene: any) {
  Modal.confirm({
    title: t('IotSceneLinkage.confirm.delete'),
    okType: 'danger',
    onOk: () => remove(scene),
  })
}
async function remove(scene: any) {
  await deleteScene(scene.id)
  reload()
}
onMounted(reload)
</script>
<style scoped>
.scene-list {
  display: grid;
  width: 100%;
  min-width: 0;
  gap: var(--space-4);
  padding-bottom: var(--space-4);
}

.scene-list-table {
	background: var(--jet-theme-bg-container);
	border-radius: var(--jet-theme-radius);
	display: grid;
	gap: var(--space-4);
}

.scene-list__count {
  margin: 0 0 var(--space-2);
  font-weight: 600;
}

.scene-list__actions {
  display: grid;
  grid-template-columns: 40px 40px 24px;
  gap: var(--space-2);
  align-items: center;
}

.scene-list__actions > span {
  min-width: 0;
}

.scene-list__delete-tooltip {
  display: block;
  cursor: not-allowed;
}

.scene-list :deep(.ant-table-pagination) {
  margin: var(--space-4) 0 0;
}

.scene-list__table :deep(.ant-table-container) {
  overflow: hidden;
  border-radius: var(--r-2);
}

.scene-list__table :deep(.ant-table-thead > tr > th) {
  background: var(--canvas);
  font-weight: 600;
  border-bottom: 1px solid var(--line);
}

.scene-list__trigger-tag {
  display: inline-flex;
  margin-top: var(--space-2);
  padding: 1px 6px !important;
  color: var(--ant-color-primary) !important;
  background: #eef4ff !important;
  border: 1px solid #d6e4ff !important;
  border-radius: 3px;
}

.scene-list__summary {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  align-items: center;
  color: var(--ant-color-text-secondary);
  line-height: 24px;
}

.scene-list__summary b {
  font-weight: 600;
}

.scene-list__summary-keyword--trigger {
  color: #d46b08;
}

.scene-list__summary-keyword--action {
  color: var(--ant-color-primary);
}

.scene-list__summary span {
  padding: 0;
}

.scene-list__summary-field--trigger,
.scene-list__summary-field--condition,
.scene-list__summary-field--action {
  color: inherit;
  background: transparent;
}
</style>
