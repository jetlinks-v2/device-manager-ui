<template>
  <PropertyRulesPanel :scope="scope" :properties="properties" />
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@jetlinks-web-core/store'
import { useInstanceStore } from '../../../../../store/instance'
import { parseMetadata } from '../../../alarm/utils'
import PropertyRulesPanel from '../../../components/PropertyRules/PropertyRulesPanel.vue'

const store = useInstanceStore()
const permission = useAuthStore()
const scope = computed(() => ({ productId: String(store.current.productId ?? ''), deviceId: store.current.id,
  name: store.current.name, canUpdate: permission.hasPermission('device/Instance:update') }))
// The device detail endpoint returns the effective model, including inherited product properties.
const properties = computed(() => parseMetadata(store.current.metadata || store.current.productMetadata).properties)
</script>
