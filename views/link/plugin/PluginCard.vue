<template>
  <div ref="element" class="plugin-card">
  <CardSummary class="plugin-card__surface" :data="summary" :background-opacity="100" :interactive="false">
    <template #title><span class="plugin-card__title" :title="`${summary.title}\nID: ${data.id}`"><span class="plugin-card__type-icon" aria-hidden="true"><AIcon :type="getPluginTypeIcon(data.type)" /></span><span class="plugin-card__name">{{ summary.title }}</span></span></template>
    <template #subtitle><span class="plugin-card__subtitle" :title="summary.subtitle">{{ summary.subtitle }}</span></template>
    <template v-if="loading || packageName || packageDescription" #meta>
      <div class="plugin-card__runtime">
        <a-skeleton-input v-if="loading" class="plugin-card__summary-loading" active size="small" />
        <template v-else-if="packageName || packageDescription">
          <span v-if="packageName" class="plugin-card__driver-name" :title="packageName">{{ packageName }}</span>
          <span v-if="packageDescription" class="plugin-card__description" :title="packageDescription">{{ packageDescription }}</span>
        </template>
      </div>
    </template>
    <template #status>
      <a-dropdown v-model:open="menuOpen" :trigger="['click']" placement="bottomRight" @open-change="open => open && emit('inspect', false)">
        <a-button type="text" size="small" :aria-label="t('pluginRuntime.actions')" @click.stop><AIcon type="EllipsisOutlined" /></a-button>
        <template #overlay>
          <a-menu @click="({ domEvent }) => domEvent.stopPropagation()">
            <a-menu-item v-for="action in actions" :key="action.key">
              <j-permission-button type="text" size="small" :style="{ width: '100%', height: '24px', padding: 0, textAlign: 'left', background: 'transparent' }" :danger="action.key === 'delete'" :disabled="action.disabled"
                :has-permission="`${permission}:${action.key}`" :pop-confirm="action.popConfirm" :tooltip="action.tooltip"
                @click.stop="menuOpen = false; action.onClick?.()"><template #icon><AIcon :type="action.icon" /></template>{{ action.text }}</j-permission-button>
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
    </template>
    <template #footer>
      <RuntimeStatus v-if="loading" :status="status" loading />
      <a-config-provider v-else :theme="{ components: { Popover: { boxShadowSecondary: 'var(--shadow-pop)' } } }">
      <a-popover :open="inspectionOpen" :trigger="['hover', 'focus', 'click']" placement="topLeft" :mouse-enter-delay="0.15" :mouse-leave-delay="0.15" destroy-tooltip-on-hide @open-change="inspect">
        <template #content><RuntimePopover v-if="inspection" :name="summary.title" :runtime="inspection" :can-view-logs="canViewLogs" @refresh="emit('refresh')" @retry="emit('retry', $event)" @logs="emit('logs', $event)" @close="inspect(false)" /></template>
        <button type="button" class="plugin-card__status-trigger" :aria-label="`${summary.title} · ${t(`pluginRuntime.${status.state}`)}`" :aria-expanded="inspectionOpen" @click.stop @keydown.stop @keydown.esc="inspect(false)"><RuntimeStatus :status="status" /></button>
      </a-popover>
      </a-config-provider>
    </template>
  </CardSummary>
  </div>
</template>
<script setup lang="ts">
import { computed, onScopeDispose, ref } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { CardSummary } from '@jetlinks-web-core/components/CardBox'
import type { CardSummaryData } from '@jetlinks-web-core/components/CardBox'
import { getI18nText } from '../../../utils/i18n'
import { getPluginTypeLabel, getPluginTypeIcon } from './util'
import type { PluginDriverRecord, PluginRuntimeInfo } from '../../../api/link/pluginRuntime'
import type { pluginAvailability, PluginRuntimeInspection } from './runtimeState'
import RuntimeStatus from './RuntimeStatus.vue'
import RuntimePopover from './RuntimePopover.vue'
import type { PluginCardAction } from './usePluginActions'
const props = defineProps<{
  data: PluginDriverRecord
  actions: PluginCardAction[]
  permission: string
  status: ReturnType<typeof pluginAvailability>
  metadata?: Pick<PluginRuntimeInfo, 'driverName' | 'driverDescription'>
  loading?: boolean
  typeLabel?: string
  inspectionOpen: boolean
  inspection?: PluginRuntimeInspection
  canViewLogs: boolean
}>()
const emit = defineEmits<{ inspect: [open: boolean]; visibility: [visible: boolean]; refresh: []; retry: [node: PluginRuntimeInfo]; logs: [serverId: string] }>()
const { t } = useI18n()
const menuOpen = ref(false)
function inspect(open: boolean) {
  if (open) menuOpen.value = false
  emit('inspect', open)
}
const element = ref<HTMLElement>()
useIntersectionObserver(element, ([entry]) => emit('visibility', !!entry?.isIntersecting))
onScopeDispose(() => emit('visibility', false))
const packageName = computed(() => props.metadata?.driverName?.trim())
const packageDescription = computed(() => props.metadata?.driverDescription?.trim())
const summary = computed<CardSummaryData>(() => ({
  title: getI18nText(props.data, 'name') || props.data.id,
  subtitle: [props.typeLabel || props.data.type
    ? t('pluginRuntime.driverType', { type: props.typeLabel || getPluginTypeLabel(props.data.type) })
    : t('pluginRuntime.definition'), props.data.version].filter(Boolean).join(' · '),
}))
</script>
<style scoped>
.plugin-card { height:calc(var(--plugin-card-row-height,192px) - 16px); min-width:0; }
.plugin-card__surface { --panel-radius:var(--r-2,6px); --fs-h3:var(--fs-14,14px); --card-summary-footer-padding:8px 16px; border-color:var(--line); box-shadow:none; }
.plugin-card__surface:hover { border-color:var(--accent); background:var(--accent-soft); box-shadow:none; }
.plugin-card__title { display:flex; align-items:center; gap:var(--space-2); min-width:0; font-size:var(--fs-14,14px); font-weight:500; line-height:24px; }
.plugin-card__type-icon { flex:none; color:var(--accent); font-size:14px; }
.plugin-card__name { min-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.plugin-card__runtime { display:flex; flex-direction:column; gap:calc(var(--space-1) / 2); width:100%; min-width:0; padding-bottom:var(--space-2); font-size:var(--fs-12,12px); line-height:18px; }
.plugin-card__driver-name { min-width:0; overflow:hidden; color:var(--ink-2); white-space:nowrap; text-overflow:ellipsis; }
.plugin-card__description { display:-webkit-box; min-width:0; overflow:hidden; -webkit-box-orient:vertical; -webkit-line-clamp:2; color:var(--ink-3); overflow-wrap:anywhere; }
.plugin-card__summary-loading { height:18px; line-height:18px; overflow:hidden; }
.plugin-card__subtitle { display:block; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:var(--ink-3); font-size:12px; }
.plugin-card__status-trigger { display:flex; align-items:center; min-width:0; width:calc(100% + var(--space-4) * 2); margin:calc(var(--space-2) * -1) calc(var(--space-4) * -1); padding:var(--space-2) var(--space-4); border:0; background:transparent; color:inherit; font:inherit; text-align:left; line-height:18px; cursor:pointer; }
.plugin-card__status-trigger:hover { background:var(--bg); }
.plugin-card__status-trigger:focus-visible { outline:var(--jet-theme-stroke-width) solid var(--accent); outline-offset:calc(var(--space-1) * -1); }
</style>
