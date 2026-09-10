<template>
  <UnifiedDeviceList v-if="isList" />
  <router-view v-else />
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useMenuStore } from '@jetlinks-web-core/store'
import UnifiedDeviceList from './index.vue'
const route = useRoute()
const menu = useMenuStore()
// 父菜单承载列表时仍须提供子路由出口，否则旧详情路由匹配成功也无法渲染。
const isList = computed(() => route.name === menu.getMenu('iot-user-device-list')?.routeName)
</script>
