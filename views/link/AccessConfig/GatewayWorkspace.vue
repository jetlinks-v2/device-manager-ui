<template>
  <GatewayList v-if="!standalone" ref="list" />
  <GatewayDetail v-if="detailId" :key="detailKey" />
</template>
<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import GatewayList from './index.vue'
const GatewayDetail = defineAsyncComponent(() => import('./Detail/index.vue'))
const route = useRoute()
const list = ref<{ reload: () => void }>()
const detailId = computed(() => route.params.id as string | undefined)
const detailKey = computed(() => [detailId.value, route.query.provider, route.query.data, route.query.sourceId].join(':'))
// 外部快捷创建和复合子配置沿用独立标签页，不额外加载背景列表。
const standalone = computed(() => !!(route.query.sourceId || route.query.provider || route.query.save))
watch(detailId, (id, previousId) => {
  // 同一宿主保留列表的筛选和分页；返回后只刷新数据，替代原来的列表重挂载。
  if (!id && previousId) list.value?.reload()
})
</script>
