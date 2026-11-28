<template>
  <IotDeviceScopeCell :key="`${projectId}:${deviceId}`" :style="{ '--device-scope-line-height': '24px' }" :kind="kind" :text="text" :value="ids" :options="options" :allowed="allowed" :disabled="disabled || busy" :loading="loading" :load-error="loadError" :save="value => saveScope(kind, value)" :show-icon="false" @open-change="$event && prepareScope(kind)" />
</template>
<script setup lang="ts">
import { computed } from 'vue'
import IotDeviceScopeCell from '../IotDeviceScopeCell.vue'
import type { DeviceScopeKind } from '../deviceScopeTypes'
import { useDeviceHeaderEditing } from './useDeviceHeaderEditing'
const props = defineProps<{ deviceId: string; projectId?: string; kind: DeviceScopeKind; text: string; allowed: boolean; disabled?: boolean; refresh: (id: string) => void | Promise<void> }>()
const { detail, options, loading, busy, loadError, prepareScope, saveScope } = useDeviceHeaderEditing(props)
const ids = computed(() => props.kind === 'area' ? detail.value?.areaBindings?.map(area => area.areaId) || [] : detail.value?.groupBindings?.map(group => group.id) || [])
</script>
