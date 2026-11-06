<template><component :is="component" :provider="draft.provider" :data="draft.data" /></template>
<script setup lang="ts">
import Network from '../Network/index.vue'
import Plugin from '../Plugin/index.vue'
import { useGatewayChildContext } from './useGatewayChildContext'
import type { GatewayChildDraft } from '../gatewayEditorContext'
const props = defineProps<{ draft: GatewayChildDraft }>()
const emit = defineEmits<{ save: [data: Record<string, unknown>]; cancel: []; reselect: [] }>()
const { component } = useGatewayChildContext(props, emit, { network: Network, plugin: Plugin })
</script>
