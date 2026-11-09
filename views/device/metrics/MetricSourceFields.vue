<template>
  <section class="metric-source-fields">
    <header v-if="inline && !state.statistics.active.value"><b>{{ t('sourceTitle') }}</b><a-button type="text" size="small" @click="state.cancel"><AIcon type="ArrowLeftOutlined" />{{ t('back') }}</a-button></header>
    <template v-if="state.request.value">
      <button v-if="!state.statistics.active.value && !state.choosingObject.value" class="source-object" type="button" @click="state.changeObject">
        <AIcon :type="objectIcon" /><span class="source-object__copy"><b>{{ state.object.value.name || t('chooseObject') }}</b><small>{{ state.currentMember.value ? t('currentDeviceHint') : `${objectTypeLabel} · ${t('changeObject')}` }}</small></span><AIcon type="SwapOutlined" />
      </button>
      <template v-if="state.choosingObject.value">
        <a-select :value="state.objectType.value" :options="objectTypes" :aria-label="t('businessSubject')" @change="state.changeObjectType(String($event))"><template #option="option"><SelectOption :label="option.label" :icon="option.icon" :description="option.description" /></template></a-select>
        <a-alert v-if="state.objectTypesError.value" type="warning" :message="t('objectTypesFailed')"><template #action><a-button type="link" size="small" @click="state.loadObjectTypes">{{ t('retry') }}</a-button></template></a-alert>
        <div v-if="state.objectType.value === 'device'" class="source-scope"><a-button v-for="value in [true,false]" :key="String(value)" type="text" size="small" :class="{active:state.scoped.value === value}" @click="state.changeScope(value)">{{ t(value ? 'scope' : 'all') }}</a-button></div>
        <a-input v-model:value="state.keyword.value" allow-clear :placeholder="t('searchObject')" :aria-label="t('searchObject')" @change="searchObjects"><template #prefix><AIcon type="SearchOutlined" /></template></a-input>
        <a-alert v-if="state.error.value" type="error" show-icon :message="t('failed')"><template #action><a-button type="link" @click="state.search">{{ t('retry') }}</a-button></template></a-alert>
        <a-spin :spinning="state.loading.value"><div class="source-objects">
          <button v-if="state.request.value.context.ownerId" type="button" @click="state.useOwner"><AIcon type="EnvironmentOutlined" /><span>{{ state.request.value.context.label || t('scope') }}<small>{{ t('scope') }}</small></span></button>
          <button v-for="item in state.devices.value" :key="item.id" type="button" @click="state.selectObject(item.id,item.name)"><AIcon :type="objectIcon" /><span>{{ item.name }}<small>{{ item.id }}</small></span><AIcon type="RightOutlined" /></button>
          <a-empty v-if="!state.loading.value && !state.error.value && !state.devices.value.length" :description="t('noObjects')" :image-style="{height:'36px'}" />
        </div></a-spin>
        <a-pagination v-if="state.total.value > 20" size="small" :current="state.page.value" :total="state.total.value" :page-size="20" :show-size-changer="false" @change="state.changePage" />
      </template>
      <MetricMemberStatistics v-else-if="state.statistics.active.value" :state="state.statistics" :scope-label="state.object.value.name" :include-children="state.includeChildren.value" />
      <template v-else>
        <div class="source-search"><a-input v-model:value="state.dataKeyword.value" allow-clear :placeholder="t('searchData')" :aria-label="t('searchData')"><template #prefix><AIcon type="SearchOutlined" /></template></a-input><a-button v-if="state.suggestedSources.value.length" type="link" size="small" @click="state.showAllSources.value = !state.showAllSources.value">{{ t(state.showAllSources.value ? 'suggestedSources' : 'allSources') }}</a-button></div>
        <p class="source-note">{{ t(state.historyInput.value ? 'readingHistory' : 'readingCurrent') }}</p>
        <a-alert v-if="state.propertyError.value" type="error" show-icon :message="t('failed')"><template #action><a-button type="link" size="small" @click="state.loadObject">{{ t('retry') }}</a-button></template></a-alert>
        <a-alert v-if="state.builtinError.value" type="warning" show-icon :message="t('builtinFailed')"><template #action><a-button type="link" size="small" @click="state.loadBuiltins">{{ t('retry') }}</a-button></template></a-alert>
        <a-alert v-if="state.business.failed.value" type="warning" show-icon :message="t('businessFailed')"><template #action><a-button type="link" size="small" @click="state.business.load">{{ t('retry') }}</a-button></template></a-alert>
        <a-alert v-if="state.metricSources.error.value" type="warning" show-icon :message="t('metricsFailed')"><template #action><a-button type="link" size="small" @click="state.metricSources.load">{{ t('retry') }}</a-button></template></a-alert>
        <a-spin :spinning="state.propertyLoading.value">
          <div class="source-catalog">
            <div v-if="state.builtinLoading.value || state.business.loading.value" class="source-note" role="status"><a-spin size="small" /> {{ t('sourceLoading') }}</div>
            <section v-for="group in mainGroups" :key="group.name" class="source-group">
              <h4><AIcon type="FolderOutlined" />{{ group.name || t('ungrouped') }}<small>{{ group.items.length }}</small></h4>
              <SourceItemRow v-for="item in group.items" :key="item.key" :item="item" :selected="state.selectedKey.value === item.key" @select="selectItem(item)" />
            </section>
            <a-empty v-if="!state.groups.value.length && !services.length" :description="t('noData')" :image-style="{height:'36px'}" />
            <details v-if="!state.inherited.value && state.request.value.purpose !== 'declaration' && showKind('metric')" :open="state.metricsExpanded.value" class="source-service" @toggle="state.metricsExpanded.value = ($event.target as HTMLDetailsElement).open">
              <summary><AIcon type="NodeIndexOutlined" />{{ t('metrics') }}</summary>
              <a-spin v-if="state.metricSources.loading.value" size="small" />
              <SourceItemRow v-for="item in metricItems" :key="item.key" :item="item" :selected="state.selectedKey.value === item.key" @select="selectItem(item)" />
              <p v-if="!state.metricSources.loading.value && !state.metricSources.error.value && !metricItems.length" class="source-note">{{ t('noMetrics') }}</p>
            </details>
            <details v-for="service in services" :key="service.id" :open="state.method.value?.service === service.id || undefined" class="source-service" @toggle="event=>{if ((event.target as HTMLDetailsElement).open) state.business.loadService(service.id)}">
              <summary><AIcon type="SearchOutlined" />{{ service.name || service.id }}<small>{{ t('queryData') }}</small></summary>
              <a-spin v-if="state.business.loadingService.value === service.id" />
              <a-button v-if="state.business.failedService.value === service.id" type="link" size="small" @click="state.business.loadService(service.id)">{{ t('retry') }}</a-button>
              <p v-else-if="state.business.commands.value[service.id]?.length === 0" class="source-note">{{ t('noQueries') }}</p>
              <template v-else>
                <section v-for="group in serviceGroups(service.id)" :key="group.name" class="source-group">
                  <h4 v-if="group.name"><AIcon type="FolderOutlined" />{{ group.name }}</h4>
                  <SourceItemRow v-for="item in group.items" :key="item.key" :item="item" :selected="state.selectedKey.value === item.key" @select="selectItem(item)" />
                </section>
                <p v-if="linkedService(service.id)" class="source-note">{{ t('queriesLoaded') }}</p>
              </template>
            </details>
            <a-pagination v-if="serviceCount > 10" size="small" :current="servicePage" :total="serviceCount" :page-size="10" :show-size-changer="false" @change="servicePage = $event" />
          </div>
        </a-spin>
        <a-alert v-if="state.category.value === 'unsupported'" type="info" show-icon :message="t('unsupported')" />
        <div v-if="state.selected.value && state.method.value" class="source-selection">
          <b>{{ state.selected.value.name }}</b>
          <a-radio-group v-if="state.selected.value.methods.length > 1" :value="state.methodKey.value" size="small" @change="state.selectMethod(state.selected.value!.methods.find(method=>method.key === $event.target.value)!)"><a-radio-button v-for="method in state.selected.value.methods" :key="method.key" :value="method.key">{{ t(method.kind === 'businessEvent' ? 'readOnReport' : 'readOnQuery') }}</a-radio-button></a-radio-group>
          <p v-if="state.method.value.description" class="source-note">{{ state.method.value.description }}</p>
          <p v-if="state.issue(state.method.value)" class="source-note" role="status">{{ t(state.issue(state.method.value)!) }}</p>
          <BusinessSourceOptions v-if="state.method.value.kind === 'businessEvent' || state.method.value.kind === 'businessQuery'" :state="state.business" />
          <a-checkbox v-if="state.builtins.value.find(item=>item.id === state.method.value?.id)?.supportsChildren" v-model:checked="state.includeChildren.value">{{ t('includeChildren') }}</a-checkbox>
          <p v-if="state.request.value.input.unit && state.method.value.unit && state.request.value.input.unit !== state.method.value.unit" class="source-note">{{ t('unitHint') }}</p>
        </div>
        <footer v-if="inline && state.requiresConfirmation.value"><a-button type="primary" :disabled="!state.canConfirm.value" @click="state.confirm">{{ t('confirm') }}</a-button></footer>
      </template>
    </template>
  </section>
</template>
<script setup lang="ts">
import { computed, onScopeDispose } from 'vue'
import { useI18n } from 'vue-i18n'
import { SelectOption } from '@jetlinks-web-core/components'
import { metricHostMessages } from './messages'
import type { MetricSourcePickerState } from './useMetricSourcePicker'
import type { SourceItem } from './sources/catalog'
import MetricMemberStatistics from './MetricMemberStatistics.vue'
import BusinessSourceOptions from './sources/BusinessSourceOptions.vue'
import SourceItemRow from './sources/SourceItemRow.vue'
const props = defineProps<{state:MetricSourcePickerState;inline?:boolean}>()
const {t}=useI18n({useScope:'local',messages:metricHostMessages})
const objectIcons:Record<string,string>={device:'DesktopOutlined',product:'AppstoreOutlined',member:'ClusterOutlined',space:'EnvironmentOutlined',deviceGroup:'FolderOutlined'}
const objectTypes = computed(()=>{
  const options=new Map(['device','product'].map(id=>[id,{value:id,label:t(id),icon:objectIcons[id],description:t(`${id}SourceHint`)}]))
  for (const type of props.state.objectTypes.value) options.set(type.id,{value:type.id,label:type.name,icon:type.icon || objectIcons[type.id] || 'DeploymentUnitOutlined',description:options.get(type.id)?.description || type.description || t('sourceObjectHint')})
  return [...options.values()]
})
const objectTypeLabel = computed(()=>objectTypes.value.find(item=>item.value === props.state.objectType.value)?.label || props.state.objectType.value)
const objectIcon = computed(()=>objectTypes.value.find(item=>item.value === props.state.objectType.value)?.icon || objectIcons[props.state.objectType.value] || 'DeploymentUnitOutlined')
const mainGroups=computed(()=>props.state.groups.value.map(group=>({...group,items:group.items.filter(item=>!item.methods.every(method=>['businessQuery','metric'].includes(method.kind)))})).filter(group=>group.items.length))
const serviceGroups=(id:string)=>props.state.groups.value.map(group=>({...group,items:group.items.filter(item=>item.methods.every(method=>method.kind === 'businessQuery' && method.service === id))})).filter(group=>group.items.length)
const linkedService=(id:string)=>mainGroups.value.some(group=>group.items.some(item=>item.methods.some(method=>method.kind === 'businessQuery' && method.service === id)))
const metricItems=computed(()=>props.state.groups.value.flatMap(group=>group.items).filter(item=>item.methods.every(method=>method.kind === 'metric')))
const showKind=(kind:string)=>props.state.showAllSources.value || !props.state.suggestedSources.value.length || props.state.suggestedSources.value.includes(kind) || props.state.method.value?.kind === kind
const {services,serviceCount,servicePage}=props.state.business
const selectItem=(item:SourceItem)=>props.state.chooseMethod(item.methods.find(method=>!props.state.issue(method)) || item.methods[0])
let timer:ReturnType<typeof setTimeout> | undefined
function searchObjects() { clearTimeout(timer); timer=setTimeout(()=>{props.state.page.value=1;void props.state.search()},250) }
onScopeDispose(()=>clearTimeout(timer))
</script>
<style scoped>
.metric-source-fields { display:grid; gap:10px; min-width:0; color:var(--ink-2); font-size:12px }
.metric-source-fields header,.source-search { display:flex; align-items:center; justify-content:space-between; gap:8px }
.source-search :deep(.ant-input-affix-wrapper) { min-width:0 }
.source-object,.source-objects button { display:flex; align-items:center; gap:8px; width:100%; min-width:0; text-align:left; color:inherit; cursor:pointer }
.source-object { padding:8px 10px; border:1px solid var(--line); border-radius:var(--r-2,6px); background:var(--bg-sunken) }
.source-object__copy,.source-objects button>span:not(.anticon) { flex:1; min-width:0 }
.source-object>.anticon,.source-objects button>.anticon { flex:none; width:16px }
.source-object b,.source-object small,.source-objects small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.source-object:disabled { cursor:default }
.source-object b { font-size:13px; font-weight:500 }
.source-object small,.source-objects small,.source-note { font-size:12px; color:var(--ink-3); line-height:1.5 }
.source-note { margin:0 }
.source-scope { display:flex; gap:8px }.source-scope .active { color:var(--accent) }
.source-objects { display:grid; gap:4px }
.source-objects button { padding:8px; min-height:44px; border:1px solid transparent; border-radius:var(--r-2,6px); background:transparent }
.source-objects button:hover { background:var(--bg-sunken) }
button:focus-visible,summary:focus-visible { outline:2px solid var(--accent); outline-offset:1px }
.source-catalog { display:grid; gap:12px; max-height:min(360px,42vh); overflow:auto; scrollbar-gutter:stable }
.source-group { min-width:0 }
.source-group h4 { display:flex; align-items:center; gap:6px; margin:0 0 4px; font-size:12px; color:var(--ink-3); font-weight:500 }
.source-group h4 small { margin-left:auto; font-weight:400 }
.source-service summary { display:flex; gap:6px; align-items:center; cursor:pointer; min-height:32px; font-size:13px }
.source-service summary small { margin-left:auto; color:var(--ink-3); font-size:12px }
.source-selection { display:grid; gap:8px; border-top:1px solid var(--line); padding-top:10px; min-width:0 }
.source-selection>b { font-weight:500; font-size:13px }
footer { display:flex; justify-content:flex-end }
</style>
