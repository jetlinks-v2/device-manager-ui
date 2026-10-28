<template>
  <a-button type="link" :loading="loading" @click="show"><AIcon type="FilterOutlined" /> {{ $t('PropertyRules.configure') }}</a-button>
  <PropertyRuleEditor v-if="open" v-model:open="open" :scope="scope" :property="property" />
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ThingModelProperty } from '../../alarm/types'
import PropertyRuleEditor from './PropertyRuleEditor.vue'
import { useMetadataRuleShortcut } from './useMetadataRuleShortcut'
const props = defineProps<{ property: ThingModelProperty; target?: string }>()
const { t: $t } = useI18n()
const { open, loading, scope, show } = useMetadataRuleShortcut(props)
</script>
