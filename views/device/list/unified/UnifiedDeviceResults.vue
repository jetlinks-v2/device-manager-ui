<template>
  <DefineIdentity v-slot="{ record }">
    <div class="device-results__identity">
      <div class="device-results__name-row">
        <a-tooltip :title="[record.name, deviceTime(record.createdAt) && t('UnifiedDeviceList.createdOn', { time: deviceTime(record.createdAt) })].filter(Boolean).join(' · ')"><a-button type="link" class="device-results__name" @click="openDetail(record)">{{ record.name }}</a-button></a-tooltip>
        <RegistryComponent page-code="device/Instance" code="name-badges" :record="record" />
        <a-tag v-if="model.showCategory && model.categoryLabels[record.category]" :bordered="false">{{ model.categoryLabels[record.category] }}</a-tag>
      </div>
      <a-tooltip :title="record.networkAddress || record.identifier"><small>{{ record.networkAddress || record.identifier }}</small></a-tooltip>
    </div>
  </DefineIdentity>
  <DefineProduct v-slot="{ record }">
    <div class="device-results__metadata">
      <a-tooltip :title="[record.productName, deviceBrandModel(record)].filter(Boolean).join(' · ')"><span class="device-results__product-name">{{ record.productName || t('UnifiedDeviceList.notConfigured') }}</span></a-tooltip>
      <Access v-if="!splitAccess" :record="record" />
      <small v-else-if="!splitProduct && deviceBrandModel(record)">{{ deviceBrandModel(record) }}</small>
    </div>
  </DefineProduct>
  <DefineAccess v-slot="{ record }">
    <a-tooltip :title="accessHint(record)"><small class="device-results__access"><AIcon :type="deviceAccess(record).gateway ? 'ApartmentOutlined' : 'ApiOutlined'" /><span>{{ accessText(record) || t('UnifiedDeviceList.notConfigured') }}</span></small></a-tooltip>
  </DefineAccess>
  <DefineScope v-slot="{ record }">
    <div class="device-results__scope">
      <ScopeItem v-if="model.showArea" :record="record" kind="area" />
      <ScopeItem :record="record" kind="group" />
    </div>
  </DefineScope>
  <DefineScopeItem v-slot="{ record, kind }"><IotDeviceScopeCell :kind="kind" :text="kind === 'area' ? deviceArea(record) : deviceGroup(record)" :value="deviceScopeIds(record, kind)" :options="kind === 'area' ? model.scopeEditor.areas : model.scopeEditor.groups" :allowed="model.scopeEditor.allowed" :disabled="model.scopeEditor.disabled" :loading="model.scopeEditor.loading" :load-error="model.scopeEditor.error" :save="ids => model.scopeEditor.save(record, kind, ids)" /></DefineScopeItem>
  <DefineState v-slot="{ record }">
    <div class="device-results__state">
      <div class="device-results__state-summary">
        <a-tooltip v-if="model.stateAction.allowed" :title="stateActionText(record)">
          <button class="device-results__state-trigger" type="button" :disabled="model.stateAction.disabled" :aria-label="`${record.name} · ${statusText(record)} · ${stateActionText(record)}`" @click="$emit('toggle', record)"><a-badge :text="statusText(record)" :status="statusTone(record)" /></button>
        </a-tooltip>
        <a-badge v-else :text="statusText(record)" :status="statusTone(record)" />
        <a-tooltip v-if="connectionTime(record)" :title="connectionHint(record)"><small class="device-results__duration">{{ duration(record) || deviceTime(connectionTime(record), 'MM-DD HH:mm') }}</small></a-tooltip>
      </div>
      <SkeletonText v-if="!model.runtime[record.id] || model.runtime[record.id].state === 'loading'" :width="112" />
      <a-button v-else-if="model.runtime[record.id].state === 'error'" class="device-results__activity-retry" type="link" size="small" :title="t('UnifiedDeviceList.retryActivity')" @click="$emit('retry-details', [record.id])"><AIcon type="ReloadOutlined" />{{ t('UnifiedDeviceList.activityUnavailable') }}</a-button>
      <a-tooltip v-else :title="activityHint(record)"><small class="device-results__activity"><AIcon type="HistoryOutlined" /><span>{{ activityText(record) }}</span></small></a-tooltip>
    </div>
  </DefineState>
  <DefineChannel v-slot="{ record }">
    <SkeletonText v-if="model.details[record.id] === 'loading'" :width="40" />
    <a-button v-else-if="model.details[record.id] === 'error'" type="link" size="small" :title="t('UnifiedDeviceList.retry')" @click="$emit('retry-details', [record.id])"><AIcon type="ReloadOutlined" /></a-button>
    <template v-else>{{ record.channelNumber ?? '—' }}</template>
  </DefineChannel>
  <DefineEmpty>
    <div class="device-results__empty">
      <a-skeleton v-if="model.loading" active :title="false" :paragraph="{ rows: 6 }" />
      <a-result v-else-if="model.error" status="error" :title="t('UnifiedDeviceList.loadFailed')" :sub-title="model.error"><template #extra><a-button @click="$emit('refresh')">{{ t('UnifiedDeviceList.refresh') }}</a-button></template></a-result>
      <CloudEmpty v-else :search="model.hasSearch" :search-name="t('UnifiedDeviceList.device')"><template #default><slot name="empty-actions" /></template></CloudEmpty>
    </div>
  </DefineEmpty>
  <SplitterPane class="device-results" :scroll="false" :padding="0">
    <template #header><slot name="header" /></template>
    <a-alert v-if="model.error && model.rows.length" type="error" show-icon :message="model.error"><template #action><a-button type="link" @click="$emit('refresh')">{{ t('UnifiedDeviceList.refresh') }}</a-button></template></a-alert>
    <div ref="viewport" class="device-results__viewport" @scroll.capture="tableScroll">
      <div v-if="compact" class="device-results__cards">
        <div class="device-results__select-loaded"><a-checkbox :checked="allLoaded" :indeterminate="partlyLoaded" :disabled="!model.rows.length || model.loading" @change="toggleLoaded">{{ t('UnifiedDeviceList.selectLoaded', { count: model.rows.length }) }}</a-checkbox></div>
        <VirtualScroll v-if="model.rows.length" ref="cards" class="device-results__card-scroll" :data="model.rows" :item-height="cardHeight" @range-change="cardRange" @reach-bottom="more">
          <template #renderItem="record">
            <article class="device-results__card" :class="{ 'is-selected': model.selectedIds.includes(record.id) }">
              <div class="device-results__card-heading"><a-checkbox :checked="model.selectedIds.includes(record.id)" :aria-label="t('UnifiedDeviceList.selectDevice', { name: record.name })" @change="selectOne(record.id)" /><Identity :record="record" /><State :record="record" /></div>
              <div class="device-results__card-details"><div class="device-results__card-product"><Product :record="record" /><span v-if="model.showChannel && ['gateway', 'video'].includes(model.activeType)" class="device-results__channel">{{ t('UnifiedDeviceList.channel') }} <Channel :record="record" /></span></div></div>
              <div v-if="model.activeType === 'gateway' && model.monitorCell" class="device-results__card-monitor"><component :is="model.monitorCell" :snapshot="model.monitorMetrics[record.id]" /></div>
              <footer class="device-results__card-scope"><Scope :record="record" /></footer>
            </article>
          </template>
        </VirtualScroll>
        <Empty v-else />
      </div>
      <a-config-provider v-else :theme="tableTheme">
        <VirtualTable :key="tableRowHeight" ref="table" size="middle" row-key="id" :columns="columns" :data-source="model.rows" :pagination="false" :row-selection="rowSelection" :scroll="{ x: tableWidth, y: bodyHeight }" :virtual="{ itemHeight: tableRowHeight, overscan: 3, threshold: 1 }" :custom-row="() => ({ style: { height: `${tableRowHeight}px` } })" :custom-header-row="() => ({ style: { height: '48px' } })">
          <template #headerCell="{ column }">{{ column.title }}</template>
          <template #emptyText><Empty /></template>
          <template #bodyCell="{ column, record }">
            <Identity v-if="column.key === 'name'" :record="record" />
            <State v-else-if="column.key === 'status'" :record="record" />
            <Product v-else-if="column.key === 'product'" :record="record" />
            <Access v-else-if="column.key === 'access'" :record="record" />
            <a-typography-text v-else-if="column.key === 'manufacturer' || column.key === 'model'" :ellipsis="{ tooltip: true }" :type="!record[column.key === 'manufacturer' ? 'productManufacturer' : 'productModel'] ? 'secondary' : undefined">{{ record[column.key === 'manufacturer' ? 'productManufacturer' : 'productModel'] || t('UnifiedDeviceList.notConfigured') }}</a-typography-text>
            <Scope v-else-if="column.key === 'scope'" :record="record" />
            <ScopeItem v-else-if="column.key === 'area' || column.key === 'group'" :record="record" :kind="column.key === 'area' ? 'area' : 'group'" />
            <component v-else-if="column.key === 'monitor' && model.monitorCell" :is="model.monitorCell" :snapshot="model.monitorMetrics[record.id]" />
            <Channel v-else-if="column.key === 'channel'" :record="record" />
          </template>
        </VirtualTable>
      </a-config-provider>
    </div>
    <template #footer>
      <div class="device-results__footer" aria-live="polite">
        <span v-if="model.total !== undefined">{{ t('UnifiedDeviceList.loadedCount', { loaded: model.rows.length, total: model.total }) }}</span><SkeletonText v-else-if="model.loading" :width="104" /><span v-else />
        <div class="device-results__load-action"><span v-if="model.appendError" role="alert" class="device-results__append-error">{{ t('UnifiedDeviceList.loadFailed') }}</span><span v-else-if="model.selectedIds.length" class="device-results__loaded-hint">{{ t('UnifiedDeviceList.loadedOnly') }}</span><span v-else-if="model.total !== undefined && !model.hasMore">{{ t('UnifiedDeviceList.allLoaded') }}</span>
          <a-button v-if="model.hasMore && !model.error" type="link" :loading="model.loadingMore" :disabled="model.loading" @click="$emit('load-more')">{{ t(model.appendError ? 'UnifiedDeviceList.retry' : 'UnifiedDeviceList.loadMore') }}</a-button>
        </div>
      </div>
    </template>
  </SplitterPane>
</template>
<script setup lang="ts">
import { computed, h, toRef } from 'vue'
import { Checkbox } from 'ant-design-vue'
import type { ThemeConfig } from 'ant-design-vue/es/config-provider/context'
import { createReusableTemplate } from '@vueuse/core'
import { useNow } from '@vueuse/core'
import { formatDeviceSessionDuration, formatDeviceSessionTimestamp } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { useI18n } from 'vue-i18n'
import { SplitterPane, VirtualScroll, VirtualTable } from '@jetlinks-web-core/components'
import type { UnifiedDevice } from '../../../../deviceListProvider'
import { deviceAccess, deviceArea, deviceBrandModel, deviceConnectionTime, deviceGroup, deviceListColumns, deviceScopeIds, deviceTime, type UnifiedDeviceResultsModel } from './deviceListPresentation'
import { useDeviceListViewport } from './useDeviceListViewport'
import IotDeviceScopeCell from '../../../../components/IotDeviceScopeCell.vue'
import SkeletonText from '@jetlinks-web-core/components/SkeletonText'
import type { DeviceScopeKind } from './deviceListPresentation'

const props = defineProps<{ model: UnifiedDeviceResultsModel }>()
const emit = defineEmits<{
  'selection-change': [ids: string[]]; 'visible-change': [ids: string[]]; 'reading-change': [index: number, offset: number]
  'load-more': []; refresh: []; detail: [device: UnifiedDevice]; toggle: [device: UnifiedDevice]; 'retry-details': [ids: string[]]
}>()
const { t, locale } = useI18n()
const now = useNow({ interval: 60000 })
const more = () => { if (!props.model.appendError) emit('load-more') }
const { viewport, table, cards, compact, availableWidth, tableRowHeight, cardHeight, bodyHeight, tableScroll, cardRange, captureReading } = useDeviceListViewport(toRef(props, 'model'), {
  visible: ids => emit('visible-change', ids), reading: (index, offset) => emit('reading-change', index, offset), more,
})
function openDetail(record: UnifiedDevice) { captureReading(); emit('detail', record) }
const columns = computed(() => deviceListColumns(props.model, t, availableWidth.value))
const splitProduct = computed(() => columns.value.some(column => column.key === 'manufacturer'))
const splitAccess = computed(() => !compact.value && columns.value.some(column => column.key === 'access'))
const tableWidth = computed(() => columns.value.reduce((total, column) => total + Number(column.width || 0), 40))
const tableTheme: ThemeConfig = { components: { Table: { borderRadiusLG: 0, colorBorderSecondary: 'var(--line)' } } }
const allLoaded = computed(() => !!props.model.rows.length && props.model.rows.every(row => props.model.selectedIds.includes(row.id)))
const partlyLoaded = computed(() => !allLoaded.value && props.model.selectedIds.length > 0)
function toggleLoaded() { emit('selection-change', allLoaded.value ? [] : props.model.rows.map(row => row.id)) }
function selectOne(id: string) { emit('selection-change', props.model.selectedIds.includes(id) ? props.model.selectedIds.filter(key => key !== id) : [...props.model.selectedIds, id]) }
const rowSelection = computed(() => ({
  selectedRowKeys: props.model.selectedIds, preserveSelectedRowKeys: true, columnWidth: 40,
  columnTitle: h(Checkbox, { checked: allLoaded.value, indeterminate: partlyLoaded.value, disabled: !props.model.rows.length || props.model.loading,
    'aria-label': t('UnifiedDeviceList.selectLoaded', { count: props.model.rows.length }), onChange: toggleLoaded }),
  onChange: (keys: Array<string | number>) => emit('selection-change', keys.map(String)),
}))
const statusText = (row: UnifiedDevice) => row.connectionStatus ? t(`UnifiedDeviceList.${row.connectionStatus}`) : '—'
const statusTone = (row: UnifiedDevice) => row.connectionStatus === 'online' ? 'success' : row.connectionStatus === 'offline' ? 'error' : 'default'
const stateActionText = (row: UnifiedDevice) => t(row.connectionStatus === 'disabled' ? 'IotDeviceList.action.enableShort' : 'IotDeviceList.action.disableShort')
const connectionTime = (row: UnifiedDevice) => deviceConnectionTime(row, props.model.runtime[row.id])
const duration = (row: UnifiedDevice) => formatDeviceSessionDuration(connectionTime(row), now.value.getTime(), String(locale.value), true)
const connectionHint = (row: UnifiedDevice) => [duration(row) && t(`IotDeviceDetail.connectionHealth.segment.${row.connectionStatus === 'online' ? 'onlineDuration' : 'offlineDuration'}`, { duration: duration(row) }), t(row.connectionStatus === 'online' ? 'UnifiedDeviceList.connectedAt' : 'UnifiedDeviceList.disconnectedAt', { time: deviceTime(connectionTime(row)) })].filter(Boolean).join(' · ')
const activityHint = (row: UnifiedDevice) => {
  const time = formatDeviceSessionTimestamp(props.model.runtime[row.id]?.lastActivityAt, String(locale.value))
  return time ? `${t('UnifiedDeviceList.recentActivity')} · ${time}` : t('UnifiedDeviceList.activityUnknown')
}
const activityText = (row: UnifiedDevice) => {
  const time = props.model.runtime[row.id]?.lastActivityAt
  const elapsed = time ? formatDeviceSessionDuration(time, now.value.getTime(), String(locale.value), true) : undefined
  return elapsed ? t('UnifiedDeviceList.activeAgo', { duration: elapsed }) : time ? deviceTime(time, 'MM-DD HH:mm') : t('UnifiedDeviceList.activityUnknown')
}
const accessText = (row: UnifiedDevice) => deviceAccess(row).gateway ? t('UnifiedDeviceList.viaGateway', { name: deviceAccess(row).gateway }) : deviceAccess(row).text
const accessHint = (row: UnifiedDevice) => [accessText(row), deviceAccess(row).gateway && deviceAccess(row).detail, deviceBrandModel(row)].filter(Boolean).join(' · ')
const [DefineIdentity, Identity] = createReusableTemplate<{ record: UnifiedDevice }>()
const [DefineProduct, Product] = createReusableTemplate<{ record: UnifiedDevice }>()
const [DefineAccess, Access] = createReusableTemplate<{ record: UnifiedDevice }>()
const [DefineScope, Scope] = createReusableTemplate<{ record: UnifiedDevice }>()
const [DefineScopeItem, ScopeItem] = createReusableTemplate<{ record: UnifiedDevice; kind: DeviceScopeKind }>()
const [DefineState, State] = createReusableTemplate<{ record: UnifiedDevice }>()
const [DefineChannel, Channel] = createReusableTemplate<{ record: UnifiedDevice }>()
const [DefineEmpty, Empty] = createReusableTemplate()
</script>
<style scoped lang="less">
.device-results__viewport { flex:1; min-width:0; min-height:0; overflow:hidden; }
.device-results__cards { display:flex; flex-direction:column; height:100%; min-height:0; container:device-cards / inline-size; }
.device-results__select-loaded { height:48px; flex:none; display:flex; align-items:center; padding:0 var(--space-4,16px); border-bottom:1px solid var(--line); background:var(--jet-theme-bg-container); }
.device-results__card-scroll { flex:1 1 0; min-height:0; background:var(--jet-theme-bg-layout); }
.device-results__card { height:calc(100% - 12px); margin:6px 0; box-sizing:border-box; padding:12px var(--space-4,16px); border-block:1px solid var(--line); background:var(--jet-theme-bg-container); display:flex; flex-direction:column; gap:8px; }
.device-results__card.is-selected { background:var(--jet-theme-color-primary-bg, var(--info-bg)); }
.device-results__card-heading { display:grid; grid-template-columns:16px minmax(0, 1fr) auto; gap:8px; align-items:start; min-width:0; }
.device-results__card-heading > .ant-checkbox-wrapper { margin-top:3px; }
.device-results__card-heading > .device-results__state { text-align:end; }
.device-results__card-heading .device-results__state-trigger { padding:0; }
.device-results__card-details { margin-inline-start:24px; min-width:0; font-size:12px; }
.device-results__card-heading > .device-results__state { max-width:220px; min-width:0; }
.device-results__card-scope { margin-top:auto; margin-inline-start:24px; padding-top:8px; border-top:1px solid var(--line); min-width:0; }
.device-results__card-scope > .device-results__scope { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; align-items:center; }
.device-results__card-scope :deep(.inline-edit-surface__anchor) { width:100%; }
.device-results__identity { min-width:0; width:100%; }
.device-results__name-row { display:flex; align-items:center; gap:6px; min-width:0; }
.device-results__name { min-width:0; height:auto; padding:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:500; }
.device-results__name-row :deep(.ant-tag) { flex-shrink:0; margin-inline-end:0; font-size:12px; }
.device-results__metadata, .device-results__identity > small { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.device-results small { display:block; margin-top:2px; color:var(--jet-theme-text-secondary); font-size:12px; font-weight:400; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.device-results__metadata > span { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.device-results__product-name { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.device-results small.device-results__access, .device-results small.device-results__activity { display:flex; align-items:center; gap:5px; }
.device-results__access > .anticon, .device-results__activity > .anticon { flex:none; }
.device-results__access > span:last-child, .device-results__activity > span:last-child { min-width:0; overflow:hidden; text-overflow:ellipsis; }
.device-results__card-product { display:flex; align-items:center; gap:8px; min-width:0; }
.device-results__card-product > .device-results__metadata { flex:1; }
.device-results__card-product { color:var(--jet-theme-text); }
.device-results__channel { flex-shrink:0; font-size:12px; color:var(--jet-theme-text-secondary); }
.device-results__card-monitor { flex:none; margin-inline-start:24px; padding-top:8px; border-top:1px solid var(--line); }
.device-results__scope { display:flex; flex-direction:column; gap:3px; min-width:0; }
.device-results__state-trigger { display:inline-flex; align-items:center; gap:6px; padding:2px 0; border:0; background:transparent; cursor:pointer; }
.device-results__state-summary { display:flex; align-items:center; gap:8px; min-width:0; }
.device-results__state-summary > .ant-badge, .device-results__state-trigger { flex:none; }
.device-results small.device-results__duration { margin-top:0; }
.device-results__activity-retry { display:flex; align-items:center; gap:4px; min-width:0; max-width:100%; height:20px; padding:0; overflow:hidden; font-size:12px; color:var(--jet-theme-text-secondary); }
.device-results__activity-retry > .anticon { flex:none; }
.device-results__activity-retry > span:last-child { min-width:0; overflow:hidden; text-overflow:ellipsis; }
.device-results__state-trigger:focus-visible { outline:2px solid var(--jet-theme-primary); outline-offset:2px; }
.device-results__state-trigger:disabled { cursor:default; }
.device-results__state small { font-variant-numeric:tabular-nums; }
.device-results__card .device-results__name { font-weight:600; }
.device-results__card .device-results__identity > small { margin-top:4px; }
.device-results__card-heading .device-results__state-summary { justify-content:flex-end; }
@container device-cards (max-width:420px) {
  .device-results__card-heading { grid-template-columns:16px minmax(0, 1fr); }
  .device-results__card-heading > .device-results__state { grid-column:2; display:grid; grid-template-columns:auto minmax(0, 1fr); align-items:center; gap:8px; text-align:start; }
  .device-results__card-heading > .device-results__state { max-width:none; }
  .device-results__card-heading .device-results__state-summary { justify-content:flex-start; }
  .device-results__card .device-results__state > small { margin-top:0; justify-content:flex-end; }
}
.device-results__empty { box-sizing:border-box; width:100%; padding:32px 16px; min-height:200px; }
.device-results__footer { width:100%; min-height:32px; display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:12px; color:var(--jet-theme-text-secondary); font-variant-numeric:tabular-nums; }
.device-results__load-action { display:flex; align-items:center; gap:8px; min-width:0; }
.device-results__load-action > .ant-btn { padding-inline:0; font-size:12px; }
.device-results__append-error { color:var(--jet-theme-color-error, var(--err)); }
@media(max-width:600px) { .device-results__loaded-hint { display:none; } }
</style>
