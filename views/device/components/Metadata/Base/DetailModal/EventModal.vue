<template>
  <a-modal
      visible
      :maskClosable="false"
      title="事件详情"
      width="650px"
      :getContainer="getPopupContainer"
      @cancel="cancel"
      @ok="ok"
  >
    <a-descriptions
        :column="1"
        :labelStyle="{
          width: '72px',
          textAlign: 'right',
          justifyContent: 'end'
        }"
    >
      <a-descriptions-item label="事件标识">{{ data.id }}</a-descriptions-item>
      <a-descriptions-item label="事件名称">{{ data.name }}</a-descriptions-item>
      <a-descriptions-item label="事件级别">{{ EventLevel[data.expands.level] }}</a-descriptions-item>
      <a-descriptions-item label="输出参数"></a-descriptions-item>
      <a-descriptions-item>
        <JsonView :value="dataTypeTable.dataSource"/>
      </a-descriptions-item>
      <a-descriptions-item v-if="showSetting && data.expands?.storageType" label="存储方式">{{ settingData[data.expands?.storageType] }}</a-descriptions-item>
    </a-descriptions>
    <template #footer>
      <a-button type="primary" @click="ok">确认</a-button>
    </template>
  </a-modal>
</template>

<script setup lang="ts" name="EventModal">
import JsonView from "./JsonView.vue";
import {useStoreType} from "../utils";

const props = defineProps({
  data: {
    type: Object,
    default: () => ({})
  },
  getPopupContainer: {
    type: Function,
    default: undefined
  },
  unitOptions: {
    type: Array,
    default: () => []
  },
  type: {
    type: String,
    default: undefined
  }
})

const EventLevel = {
  ordinary: '普通',
  warn: '警告',
  urgent: '紧急'
}

const { settingData } = useStoreType(props.type)

const showSetting = computed(() => {

})

const dataTypeTable = reactive<{ dataSource: any }>({
  dataSource: props.data?.valueType?.properties || []
})

const emit = defineEmits(['cancel'])
const cancel = () => {
  emit('cancel')
}

const ok = () => {
  cancel()
}



</script>

<style scoped>

</style>
