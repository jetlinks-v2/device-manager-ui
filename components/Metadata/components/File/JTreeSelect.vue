<template>
  <j-auto-complete
      show-search
      style="width: 100%"
      :dropdown-style="{ maxHeight: '400px', overflow: 'auto', zIndex: 1999 }"
      v-bind="omit(props, ['options', 'value'])"
      :value="selectedValue"
      :options="options"
      @change="onChange"
  >
    <template #option="item">
      <template v-if="item.value === selectedValue?.[0]">
        <span class="select-item">{{item.value}}</span>
      </template>
      <template v-else>
        {{item.value}}
      </template>
    </template>
  </j-auto-complete>
</template>

<script setup>
import {omit} from "lodash-es";

const props = defineProps({
  value: {
    type: String
  },
  options: {
    type: Array,
    default: () => [],
  },
  placeholder: {
    type: String
  }
})

const emit = defineEmits(['update:value', 'change'])
const selectedValue = ref([]);

const onChange = (val) => {
  let _val;
  if(val){
    const __val = props.options.find(item => {
      return item.options.find(option => {
        return option.value === val
      })
    })
    if(__val?.mediaType){
      _val = `${__val.mediaType}/${val}`
    } else {
      _val = `data/${val}`
    }
  }
  emit('update:value', _val)
  emit('change', _val)
}

watch(
    () => props.value,
    (val) => {
      if(val){
        const dt = val.split('/')
        if(dt.length === 2){
          selectedValue.value = [dt[1]]
        } else {
          selectedValue.value = []
        }
      } else {
        selectedValue.value = []
      }
    },
    {
      deep: true,
      immediate: true
    }
)
</script>

<style scoped lang="less">
.select-item {
  color: @primary-color;
}
</style>
