<template>
  <PropertyRulesPanel :scope="scope" :properties="properties" presentation="detail" />
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useProductStore } from '@device-manager-ui/store/product'
import PropertyRulesPanel from '../../../components/PropertyRules/PropertyRulesPanel.vue'
import { parseMetadata } from '../../../alarm/utils'
const store = useProductStore()
// 产品规则在 SaaS 中也可统一配置，由规则面板继续校验产品编辑权限。
const scope = computed(() => ({ productId: String(store.current?.id ?? ''), name: store.current?.name }))
const properties = computed(() => parseMetadata(store.current?.metadata).properties)
</script>
