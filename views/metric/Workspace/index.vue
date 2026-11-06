<template>
  <MetricWorkspace v-if="scopeKey" :key="scopeKey" :scope-key="scopeKey" :selection="selection" :initial-reference="initialReference" :editable="auth.hasPermission('device/Metric:save')" @update:selection="changeSelection" @to-business="toBusiness" />
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import type { RouteLocationRaw } from 'vue-router'
import { useAuthStore, useUserStore } from '@jetlinks-web-core/store'
import { MetricWorkspace, type MetricWorkspaceSelection, type MetricReference } from '@jetlinks-web-core/components'
import { useProjectRouter } from '@jetlinks-web-core/hooks'
import { getRequestTenantDomain } from '@jetlinks-web-core/utils/request-context'
import { metricReferenceFromQuery, metricBusinessQuery, metricScopeKey, metricWorkspaceQuery, metricWorkspaceSelectionFromQuery } from '../../device/metrics/metricLocation'
const route = useRoute()
const router = useProjectRouter()
const user = useUserStore()
const auth = useAuthStore()
const selection = computed(() => metricWorkspaceSelectionFromQuery(route.query))
const scopeKey = computed(() => metricScopeKey(user.userInfo.id || '', router.projectId.value || '', getRequestTenantDomain() || ''))
const initialReference = computed(() => selection.value && metricReferenceFromQuery(route.query, selection.value))
function changeSelection(value?: MetricWorkspaceSelection) {
  if (value?.ownerType === selection.value?.ownerType && value?.ownerId === selection.value?.ownerId) return
  void router.replace({ path: route.path, query: metricWorkspaceQuery(route.query, value) })
}
function toBusiness(target: RouteLocationRaw, reference?: MetricReference) {
  if (typeof target === 'string' || !selection.value) { void router.push(target); return }
  void router.push({ ...target, query: metricBusinessQuery(target.query || {}, selection.value, reference) })
}
</script>
