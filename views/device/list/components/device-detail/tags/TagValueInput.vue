<template>
  <MetadataValueItem v-if="['object', 'array'].includes(type)" v-model="value" :item="tag" />
  <SelectAMap v-else-if="type === 'geoPoint'" v-model:point="value" />
  <a-time-picker v-else-if="isTimeOnlyTag(tag)" v-model:value="value" format="HH:mm:ss" value-format="HH:mm:ss" class="tag-value-input" />
  <a-date-picker v-else-if="isDateOnlyTag(tag)" v-model:value="value" format="YYYY-MM-DD" value-format="YYYY-MM-DD" class="tag-value-input" />
  <j-value-item v-else v-model:modelValue="value" :item-type="type === 'file' ? 'string' : type"
    :action="FileStaticPath()" :headers="getUploadHeaders()" :options="getTagOptions(tag)"
    value-format="YYYY-MM-DD HH:mm:ss" class="tag-value-input" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FileStaticPath } from '@jetlinks-web-core/api/comm'
import { getUploadHeaders } from '@jetlinks-web-core/utils'
import { getTagOptions, getTagType, isDateOnlyTag, isTimeOnlyTag, type DeviceTag } from './tagEditor'

const props = defineProps<{ tag: DeviceTag; modelValue: unknown }>()
const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()
const type = computed(() => getTagType(props.tag))
const value = computed({ get: () => props.modelValue, set: value => emit('update:modelValue', value) })
</script>

<style scoped>
.tag-value-input { width: 100%; }
</style>
