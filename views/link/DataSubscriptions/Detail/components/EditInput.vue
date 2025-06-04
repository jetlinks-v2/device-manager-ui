<template>
  <div class="edit-input">
    <div v-if="!visible">
      <slot></slot>
    </div>
    <a-input
        v-else
        placeholder="请输入"
        @blur="onBlur"
        ref="inputRef"
        v-model:value="_value"
        :maxLength="maxLength"
    />
    <a-button type="link" @click="onEdit">
      <AIcon type="EditOutlined"/>
    </a-button>
  </div>
</template>

<script setup>
const props = defineProps({
  value: {
    type: String,
    default: ''
  },
  style: {
    type: Object,
    default: () => ({})
  },
  maxLength: {
    type: Number,
    default: undefined
  }
})

const emits = defineEmits(['update:value', 'save'])

const visible = ref(false)
const _value = ref(props.value)
const inputRef = ref()
const onBlur = () => {
  if(_value.value !== props.value){
    emits('save', _value.value)
  }
  setTimeout(() => {
    visible.value = false
  }, 100)
}

const onEdit = () => {
  _value.value = props.value
  visible.value = true
  nextTick(() => {
    inputRef.value?.focus()
  })
}
</script>

<style lang="less" scoped>
.edit-input {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
