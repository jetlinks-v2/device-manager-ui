<template>
  <section class="metric-source-fields">
    <header v-if="inline && !state.statistics.active.value"><b>{{ t('sourceTitle') }}</b><a-button type="text" size="small" @click="state.cancel"><AIcon type="ArrowLeftOutlined" />{{ t('back') }}</a-button></header>
    <template v-if="state.request.value">
      <template v-if="!state.statistics.active.value">
        <p v-if="state.inherited.value" class="source-context"><AIcon type="ClusterOutlined" />{{ t('currentDeviceHint') }}</p>
        <button v-else class="source-object" type="button" @click="state.changeObject"><AIcon :type="objectIcon" /><span class="source-object__copy"><b :title="objectLabel">{{ objectLabel }}</b><small>{{ t('changeObject') }}</small></span><AIcon type="SwapOutlined" /></button>
        <div class="source-kinds" role="group" :aria-label="t('sourceKind')"><button v-for="kind in kinds" :key="kind.value" type="button" :aria-pressed="state.category.value === kind.value" :disabled="kind.value === 'metric' && state.inherited.value" :title="t(kind.value === 'metric' && state.inherited.value ? 'inheritedMetricHint' : kind.hint)" @click="chooseKind(kind.value)"><AIcon :type="kind.icon" />{{ t(kind.label) }}</button></div>
      </template>
      <template v-if="state.choosingObject.value">
        <div class="source-scope"><button v-for="item in scopes" :key="String(item.value)" type="button" :aria-pressed="state.scoped.value === item.value" @click="state.changeScope(item.value)">{{ item.label }}</button></div>
        <label class="source-search"><AIcon type="SearchOutlined" /><input v-model="state.keyword.value" type="search" :placeholder="t('search')" :aria-label="t('search')" @input="searchDevices" /></label>
        <a-spin :spinning="state.loading.value"><div class="source-devices" role="group" :aria-label="t('device')">
          <button v-if="state.category.value === 'metric' || state.category.value === 'builtin' && state.hasOwnerBuiltins.value" type="button" @click="state.useOwner"><AIcon :type="objectIcon" /><span class="source-option__copy">{{ state.request.value?.context.label || t('scope') }}<small>{{ t(state.category.value === 'builtin' ? 'objectBuiltins' : 'currentObjectMetrics') }}</small></span></button>
          <button v-for="device in state.devices.value" :key="device.id" type="button" :aria-pressed="state.deviceId.value === device.id" :title="`${device.name} · ${device.id}`" @click="state.selectDevice(device.id)"><AIcon type="DesktopOutlined" /><span class="source-option__copy">{{ device.name }}<small>{{ device.id }}</small></span><AIcon v-if="state.deviceId.value === device.id" type="CheckOutlined" /></button>
          <a-empty v-if="!state.loading.value && !state.error.value && !state.devices.value.length" :description="t('empty')" :image-style="{ height:'36px' }" />
        </div></a-spin>
        <a-pagination v-if="state.total.value > 20" size="small" :current="state.page.value" :total="state.total.value" :page-size="20" :show-size-changer="false" @change="state.changePage" />
      </template>
      <a-alert v-if="state.error.value && state.category.value !== 'metric' && !state.statistics.active.value" type="error" :message="t('failed')" show-icon><template #action><a-button type="link" size="small" @click="retry">{{ t('retry') }}</a-button></template></a-alert>
      <MetricOutputOptions v-if="!state.choosingObject.value && state.category.value === 'metric'" :state="state" :object-label="objectLabel" />
      <template v-else-if="!state.choosingObject.value && state.ownerBuiltin.value">
        <p v-if="!state.statistics.active.value" class="source-context" :role="state.request.value?.scheduled === false ? 'alert' : undefined"><AIcon type="ClockCircleOutlined" />{{ t(state.historyInput.value ? 'builtinNoHistory' : state.request.value?.scheduled === false ? 'builtinScheduleRequired' : 'builtinScheduleHint') }}</p>
        <div v-if="!state.statistics.active.value && state.builtins.value.some(item => item.supportsChildren)" class="source-scope" role="group" :aria-label="t('memberScope')">
          <button v-for="item in memberScopes" :key="String(item.value)" type="button" :aria-pressed="state.includeChildren.value === item.value" @click="state.includeChildren.value = item.value"><AIcon :type="item.value ? 'ApartmentOutlined' : 'EnvironmentOutlined'" /> {{ item.label }}</button>
        </div>
        <MetricMemberStatistics v-if="state.statistics.active.value" :state="state.statistics" :scope-label="objectLabel" :include-children="state.includeChildren.value" />
        <a-spin v-else :spinning="state.builtinLoading.value"><div class="source-properties" role="group" :aria-label="t('builtinData')">
          <button v-for="item in state.deviceId.value ? state.properties.value.filter(value => value.platform) : []" :key="item.id" type="button" :disabled="state.historyInput.value && !item.history" :aria-pressed="state.propertyId.value === item.id" @click="select(item.id,item.name)"><AIcon :type="item.icon || 'ApiOutlined'" /><span class="source-option__copy"><b>{{ item.name }}</b><small>{{ item.description || t('builtinHint') }}</small></span><AIcon v-if="state.propertyId.value === item.id" type="CheckOutlined" /></button>
          <button v-for="item in state.builtins.value" :key="item.id" type="button" :disabled="state.request.value?.scheduled === false || state.historyInput.value || state.builtinLoading.value || state.error.value" :aria-pressed="state.propertyId.value === item.id" @click="item.configurationRequired ? state.statistics.open() : select(item.id, item.name)">
            <AIcon :type="item.icon || builtinIcon(item.id)" /><span class="source-option__copy"><b>{{ item.name }}<small v-if="item.unit">{{ item.unit }}</small></b><small :title="item.description">{{ item.description }}</small></span><AIcon v-if="state.propertyId.value === item.id" type="CheckOutlined" />
          </button>
          <a-empty v-if="!state.builtinLoading.value && !state.error.value && !state.builtins.value.length" :description="t('noBuiltins')" :image-style="{ height:'36px' }" />
        </div></a-spin>
      </template>
      <template v-else-if="!state.choosingObject.value && (state.inherited.value || state.deviceId.value)">
        <p class="source-context">{{ t(state.category.value === 'builtin' ? 'builtinHint' : 'propertyHint') }}</p>
        <label class="source-search"><AIcon type="SearchOutlined" /><input v-model="keyword" type="search" :placeholder="t('searchProperty')" :aria-label="t('searchProperty')" /></label>
        <a-spin :spinning="state.propertyLoading.value"><div class="source-properties" role="group" :aria-label="t('property')">
          <button v-for="property in properties" :key="property.id" type="button" :disabled="state.propertyLoading.value || state.error.value" :aria-pressed="state.propertyId.value === property.id" :title="`${property.name} · ${property.description || property.id}`" @click="select(property.id, property.name)">
            <AIcon :type="property.icon || 'DatabaseOutlined'" /><span class="source-option__copy"><b><span>{{ property.name }}</span><small v-if="property.unit">{{ property.unit }}</small></b><small>{{ property.description || property.id }}</small><small v-if="enumText(property.valueType)">{{ enumText(property.valueType) }}</small></span><AIcon v-if="state.propertyId.value === property.id" type="CheckOutlined" />
          </button>
          <a-empty v-if="!state.propertyLoading.value && !state.error.value && !properties.length" :description="t('noProperties')" :image-style="{ height:'36px' }" />
        </div></a-spin>
      </template>
      <p v-if="state.request.value?.input.unit && selected?.unit && state.request.value.input.unit !== selected.unit" class="source-unit"><AIcon type="InfoCircleOutlined" />{{ t('unitHint') }}</p>
    </template>
  </section>
</template>
<script setup lang="ts">
import { computed, onScopeDispose, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { metricHostMessages } from './messages'
import type { MetricSourcePickerState } from './useMetricSourcePicker'
import MetricOutputOptions from './MetricOutputOptions.vue'
import MetricMemberStatistics from './MetricMemberStatistics.vue'
const props = defineProps<{ state:MetricSourcePickerState; inline?:boolean }>()
const { t } = useI18n({ useScope:'local', messages:metricHostMessages })
const keyword = ref('')
const scopes = computed(() => [{ value:true, label:t('scope') }, { value:false, label:t('all') }])
const memberScopes = computed(() => [{ value:false, label:t('directMembers') }, { value:true, label:t('includeChildren') }])
const objectIcon = computed(() => props.state.deviceId.value ? 'DesktopOutlined' : ({ product:'AppstoreOutlined', deviceGroup:'ClusterOutlined', space:'EnvironmentOutlined' }[(props.state.ownerBuiltin.value ? props.state.builtinScope.value?.type : props.state.request.value?.context.ownerType) || ''] || 'EnvironmentOutlined'))
const builtinIcon = (id:string) => ({ deviceCount:'ClusterOutlined', onlineDeviceCount:'CheckCircleOutlined', offlineDeviceCount:'DisconnectOutlined' }[id] || 'ThunderboltOutlined')
const kinds = [
  { value:'property', icon:'DatabaseOutlined', label:'propertyData', hint:'propertyHint' },
  { value:'builtin', icon:'ThunderboltOutlined', label:'builtinData', hint:'builtinHint' },
  { value:'metric', icon:'NodeIndexOutlined', label:'metrics', hint:'metricHint' },
] as const
const objectLabel = computed(() => {
  const context = props.state.request.value?.context
  const source = props.state.builtinScope.value
  if (props.state.ownerBuiltin.value && source && (source.type !== context?.ownerType || source.id !== context?.ownerId)) return source.id
  return props.state.selectedDevice.value?.name || context?.label || context?.ownerId || t('selectDevice')
})
const properties = computed(() => props.state.properties.value.filter(property => (props.state.category.value === 'builtin' ? property.platform && (!props.state.historyInput.value || property.history) : !property.platform) && `${property.name} ${property.id}`.toLowerCase().includes(keyword.value.trim().toLowerCase())))
const selected = computed(() => props.state.properties.value.find(property => property.id === props.state.propertyId.value))
let timer:ReturnType<typeof setTimeout> | undefined
function searchDevices() { clearTimeout(timer); timer = setTimeout(() => { props.state.page.value = 1; void props.state.search() }, 250) }
function retry() { if (props.state.ownerBuiltin.value) void props.state.loadBuiltins(); else if (props.state.inherited.value) void props.state.loadProduct(); else { void props.state.search(); if (props.state.deviceId.value) void props.state.selectDevice(props.state.deviceId.value, true) } }
function select(id:string, label:string) { props.state.propertyId.value = id; if (props.inline) props.state.confirm(label) }
function chooseKind(value:'property'|'builtin'|'metric') { keyword.value = ''; props.state.changeCategory(value) }
function enumText(type?:Record<string, unknown>) {
  return Array.isArray(type?.elements) ? type.elements.map(item => `${item.value} · ${item.text || item.label || item.value}`).join(' / ') : ''
}
onScopeDispose(() => clearTimeout(timer))
</script>
<style scoped>
.metric-source-fields { display:grid; gap:10px; min-width:0 }
.metric-source-fields header { display:flex; justify-content:space-between; align-items:center; gap:8px }
.source-context,.source-unit { display:flex; align-items:flex-start; gap:6px; margin:0; color:var(--ink-3); font-size:12px; line-height:1.6 }
.source-scope { display:flex; gap:12px; font-size:12px }
.source-scope button { border:0; padding:4px 0; background:transparent; color:var(--ink-3); cursor:pointer }
.source-scope button[aria-pressed=true] { color:var(--accent) }
.source-search { display:flex; align-items:center; gap:8px; min-height:32px; border-bottom:1px solid var(--line); color:var(--ink-3) }
.source-search input { width:100%; min-width:0; border:0; outline:0; background:transparent; color:var(--ink-1); font-size:12px }
.source-search:focus-within { border-color:var(--accent) }
.source-devices,.source-properties { display:grid; gap:4px; overflow:auto; scrollbar-gutter:stable }
.source-devices { max-height:unset }
.source-properties { max-height:unset }
.source-devices button,.source-properties button { display:flex; align-items:center; gap:8px; padding:9px; border:1px solid transparent; border-radius:var(--r-2,6px); color:var(--ink-2); background:transparent; text-align:left; cursor:pointer; min-width:0 }
.source-devices button:hover,.source-properties button:hover { background:var(--bg-sunken) }
.source-devices button[aria-pressed=true],.source-properties button[aria-pressed=true] { color:var(--accent); background:var(--accent-soft); border-color:var(--accent) }
.source-devices button:focus-visible,.source-properties button:focus-visible,.source-scope button:focus-visible { outline:2px solid var(--accent) }
.source-option__copy { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.source-devices button>.anticon,.source-properties button>.anticon,.source-object>.anticon { flex:none; width:16px; font-size:14px }
.source-properties button b { display:flex; gap:6px; align-items:baseline; font-weight:500 }
.source-properties button b>span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.source-properties button b small { flex:none; margin-left:auto }
.source-devices small,.source-properties small { display:block; font-size:11px; color:var(--ink-3); font-weight:400 }
.source-option__copy>small { overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.source-properties button:disabled { opacity:.5; cursor:default }
.source-object { display:flex; align-items:center; gap:10px; width:100%; padding:10px 12px; border:1px solid var(--line); border-radius:var(--r-2,6px); color:var(--ink-2); background:var(--bg-sunken); text-align:left; cursor:pointer }
.source-object__copy { flex:1; min-width:0 }
.source-object b { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; font-weight:500 }
.source-object small { display:block; margin-top:3px; color:var(--ink-3); font-size:11px }
.source-kinds { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:3px; padding:3px; border-radius:var(--r-2,6px); background:var(--bg-sunken) }
.source-kinds button { display:flex; align-items:center; justify-content:center; gap:4px; min-height:32px; padding:4px; border:0; border-radius:4px; background:transparent; color:var(--ink-3); font-size:11px; cursor:pointer }
.source-kinds button[aria-pressed=true] { background:var(--panel-background); color:var(--accent); box-shadow:0 1px 3px #0000000a }
.source-kinds button:disabled { opacity:.45; cursor:default }
.source-kinds button:focus-visible,.source-object:focus-visible { outline:2px solid var(--accent) }
</style>
