<template>
  <a-modal :width="900" visible :title="$t('DataSubscriptions.Detail.index.697323-54')" @cancel="emit('close')">
    <a-descriptions :labelStyle="{width: '200px'}" title="" bordered :column="1">
      <a-descriptions-item label="ID">
        {{ data?.url }}
      </a-descriptions-item>
      <a-descriptions-item :label="$t('DataSubscriptions.Detail.index.697323-41')">
        {{ data?.httpMethod }}
      </a-descriptions-item>
      <a-descriptions-item :label="$t('DataSubscriptions.Detail.index.697323-43')">
        {{ data?.action }}
      </a-descriptions-item>
      <a-descriptions-item :label="$t('DataSubscriptions.Detail.index.697323-36')">
        {{ data?.target }}
      </a-descriptions-item>
      <a-descriptions-item :label="$t('DataSubscriptions.Detail.index.697323-44')">
        {{ data?.method }}
      </a-descriptions-item>
      <a-descriptions-item :label="$t('DataSubscriptions.Detail.index.697323-42')">
        {{ data?.ip }}
      </a-descriptions-item>
      <a-descriptions-item :label="$t('DataSubscriptions.Detail.index.697323-45')">
        {{ data?.parameters }}
      </a-descriptions-item>
      <a-descriptions-item :label="$t('DataSubscriptions.Detail.index.697323-46')">
        {{ data.exception }}
      </a-descriptions-item>
    </a-descriptions>
    <template #footer>
      <a-button type="primary" @click="emit('close')">{{ $t('Access.index.480752-10') }}</a-button>
    </template>
  </a-modal>
</template>

<script setup>
const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
})
const emit = defineEmits(['close'])
</script>

<style lang="less" scoped>

</style>
