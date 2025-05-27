<template>
  <div>
    <a-checkbox-group
        v-model:value="_value"
        :options="_options"
        @change="onChange"
    />
  </div>
</template>

<script setup>
const props = defineProps({
  options: {
    type:Array,
    default: () => []
  },
  value: {
    type: Array,
    default: () => ['view']
  },
  bulkBool: {
    type: Boolean,
    default: true
  },
  selected: {
    type: Boolean,
    default: false
  }
})

const emits = defineEmits(['change'])
const _value = ref([])

const onChange = (val) => {
  emits('change', val)
}

const _options = computed(() => {

  return props.options.map(i => {
    const isRead = i.value === 'read'
    const disabled = props.selected ? props.bulkBool: true
    return {
      ...i,
      disabled: isRead || disabled
    }
  })
})

watch(() => props.value, (val) => {
  _value.value = val.length ? val : ['view'];
}, {
  deep: true,
  immediate: true
})
</script>

<style lang="less" scoped>

</style>
