<template>
  <PropertyRulesPanel :scope="scope" :properties="properties" />
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useProductStore } from '@device-manager-ui/store/product'
import PropertyRulesPanel from '../../../components/PropertyRules/PropertyRulesPanel.vue'
import { parseMetadata } from '../../../alarm/utils'
const store = useProductStore()
const scope = computed(() => ({ productId: String(store.current?.id ?? ''), name: store.current?.name }))
const properties = computed(() => parseMetadata(store.current?.metadata).properties)
</script>
