<template>
  <div>
    <a-switch
        :checked="checked"
        :disabled="disabled && !checked"
        @change="onChange"
    />
  </div>
</template>

<script setup>
const props = defineProps({
  property: {
    type: Object,
    default: () => ({})
  },
  list: {
    type: Array,
    default: () => []
  },
  disabled: {
    type: Boolean,
    default: false
  }
})
const emit = defineEmits(['change'])

const checked = computed(() => {
  return props.list.find(item => item.id === props.property.id)?.enabled
})

const onChange = (e) => {
  emit('change', e)
}
</script>

<style lang="less" scoped>

</style>
