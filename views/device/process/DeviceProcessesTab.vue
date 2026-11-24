<template><component :is="panel" v-if="panel" :object="{type:'device',id:deviceId}" /></template>
<script setup lang="ts">
import type { Component } from 'vue'
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
defineProps<{deviceId:string}>()
const panel = moduleRegistry.getResourceItem<Component>('rule-engine-manager-ui','components','ObjectProcesses')
</script>
