<template>
  <button type="button" class="source-row" :aria-pressed="selected" @click="$emit('select')">
    <AIcon :type="item.methods[0].icon || kindIcon(item.methods[0].kind)" /><span class="source-row__copy"><b>{{ item.name }}<small v-if="item.methods[0].unit">{{ item.methods[0].unit }}</small></b><small>{{ summary }}</small></span><AIcon v-if="selected" type="CheckOutlined" />
  </button>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { metricHostMessages } from '../messages'
import type { SourceItem } from './catalog'
const props=defineProps<{item:SourceItem;selected:boolean}>()
defineEmits<{(event:'select'):void}>()
const {t}=useI18n({useScope:'local',messages:metricHostMessages})
const kindIcon = (kind:string)=>({property:'DatabaseOutlined',event:'ThunderboltOutlined',builtin:'ApiOutlined',metric:'NodeIndexOutlined',businessEvent:'ThunderboltOutlined',businessQuery:'SearchOutlined'}[kind] || 'DatabaseOutlined')
const summary=computed(()=>[...new Set(props.item.methods.flatMap(method=>method.capabilities))].map(value=>t(`capability_${value}`)).join(' · '))
</script>
<style scoped>
.source-row { display:flex; align-items:center; gap:8px; width:100%; min-width:0; min-height:44px; padding:8px; border:1px solid transparent; border-radius:var(--r-2,6px); background:transparent; text-align:left; color:var(--ink-2); cursor:pointer }
.source-row:hover { background:var(--bg-sunken) }
.source-row[aria-pressed=true] { background:var(--accent-soft); border-color:var(--accent); color:var(--accent) }
.source-row:focus-visible { outline:2px solid var(--accent); outline-offset:1px }
.source-row__copy { flex:1; min-width:0 }
.source-row__copy>b { display:flex; gap:8px; font-size:13px; font-weight:500; overflow-wrap:anywhere }
.source-row__copy small { font-size:12px; font-weight:400; color:var(--ink-3) }
.source-row__copy>b>small { margin-left:auto; flex:none }
</style>
