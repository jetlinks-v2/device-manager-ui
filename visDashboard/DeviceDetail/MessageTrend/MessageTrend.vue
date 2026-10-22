<template><DeviceDetailWidget kind="MessageTrend" :info="info" :is-edit="isEdit" /></template>
<script setup lang="ts">
import type { PropType } from 'vue'
import DeviceDetailWidget from '../components/DeviceDetailWidget.vue'
import type { DeviceDetailInfo } from '../shared'
defineProps({ info: Object as PropType<DeviceDetailInfo>, isEdit: Boolean })
</script>
