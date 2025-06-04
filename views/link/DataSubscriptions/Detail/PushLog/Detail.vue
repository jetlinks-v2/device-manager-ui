<template>
  <a-modal :width="900" visible title="推送详情" @cancel="emit('close')">
    <a-descriptions :labelStyle="{width: '200px'}" title="" bordered :column="1">
      <a-descriptions-item label="ID">
        {{ data?.url }}
      </a-descriptions-item>
      <a-descriptions-item label="推送时间">
        {{ data?.httpMethod }}
      </a-descriptions-item>
      <a-descriptions-item label="目标地址">
        {{ data?.action }}
      </a-descriptions-item>
      <a-descriptions-item label="推送方式">
        {{ data?.target }}
      </a-descriptions-item>
      <a-descriptions-item label="状态">
        {{ data?.method }}
      </a-descriptions-item>
      <a-descriptions-item label="耗时">
        {{ data?.ip }}
      </a-descriptions-item>
      <a-descriptions-item label="重试次数">
        {{ data?.parameters }}
      </a-descriptions-item>
      <a-descriptions-item label="错误信息">
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
