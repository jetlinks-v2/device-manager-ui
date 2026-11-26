<template><ObjectMetrics v-if="product.id" :context="context" /></template>
<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@jetlinks-web-core/store'
import { useProductStore } from '@device-manager-ui/store/product'
import ObjectMetrics from '../../../metrics/ObjectMetrics.vue'
const store = useProductStore()
const auth = useAuthStore()
const product = computed(() => store.current)
const context = computed(() => ({ ownerType: 'product', ownerId: product.value.id, label: product.value.name, editable: auth.hasPermission('device/Product:update') }))
</script>
