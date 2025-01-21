<template>
  <div class="container">
    <div class="options">
      <div class="search">
        <a-input placeholder="请输入关键词" v-model:value="searchValue" @change="searchChange"
                 style="margin-right: 8px;">
          <template #suffix>
            <AIcon type="SearchOutlined"></AIcon>
          </template>
        </a-input>
        <a-button v-if="showSelectAll" @click="selectAll">全选</a-button>
        <a-button v-else @click="cancelSelect">取消全选</a-button>
      </div>
      <div class="metadataList" v-if="metadataData.length">
        <div v-for="i in metadataData" :key="i.id"
             :class="{ 'metadataItem': true, 'selected': selectedMap.has(i.id) }"
             @click="() => chooseMetadata(i)">
          <div>{{ i.name }}</div>
          <div class="metadataItemContent">
            <div class="text">标识：{{ i.id }}</div>
            <template v-if='activeKey !== "events" && activeKey !== "functions"'>
              <div  class="text">
                数据类型：{{ dataTypeTableMap[i?.valueType?.type] }}
              </div>
            </template>
            <template v-if='activeKey === "properties"'>
              <div class='text'>属性来源 ：{{ getSourceStr(i.expands?.source) }}</div>
            </template>
            <template v-if='activeKey === "functions"'>
              <div class='text'>是否异步 ：{{ i.async ? '是' : '否' }}</div>
            </template>
            <template v-if='activeKey === "events"'>
              <div class='text'>事件级别 ：{{ eventLevelMap[i.expands?.level] }}</div>
            </template>
          </div>
        </div>
      </div>
      <a-empty v-else></a-empty>
    </div>
  </div>
</template>

<script setup>
import {cloneDeep} from 'lodash-es';
import {DataTypeList, EventLevel, sourceType, arrayToObj} from './utils'

const props = defineProps({
  data: {
    type: Object,
    default: () => {

    }
  },
  value: {
    type: Object,
    default: () => {

    }
  },
  activeKey: {
    type:String,
    default: ''
  }
})

const emits = defineEmits(['update:value'])
const eventLevelMap = arrayToObj(EventLevel, {key: 'value', value: 'label'})
const dataTypeTableMap = arrayToObj(DataTypeList, {key: 'value', value: 'label'})
const getSourceStr = (types) => {
  return sourceType.filter(item => types?.includes(item.value) || false ).map(item => item.label).join(',')
}
const metadataData = ref([])
const searchValue = ref();
const selectedMap = ref(new Map());
const showSelectAll = computed(() => {
  return !metadataData.value.every((i) => {
    return selectedMap.value.has(i.id)
  })
})

const searchChange = () => {
  if (searchValue.value) {
    metadataData.value = props.data.filter((i) => {
      return i.id.includes(searchValue.value) || i.name.includes(searchValue.value)
    })
  } else {
    metadataData.value = cloneDeep(props.data)
  }
  emits('update:value', [...selectedMap.value.values()])
}

const chooseMetadata = (data) => {
  if (selectedMap.value.has(data.id)) {
    selectedMap.value.delete(data.id)
  } else {
    selectedMap.value.set(data.id, data)
  }
  emits('update:value', [...selectedMap.value.values()])
}

const selectAll = () => {
  metadataData.value.forEach((i) => {
    if (!selectedMap.value.has(i.id)) {
      selectedMap.value.set(i.id, i)
    }
  })
  emits('update:value', [...selectedMap.value.values()])
}

const cancelSelect = () => {
  metadataData.value.forEach((i) => {
    if (selectedMap.value.has(i.id)) {
      selectedMap.value.delete(i.id, i)
    }
  })
  emits('update:value', [])
}

watch(() => props.value, (val) => {
  if (Array.isArray(val)) {
    val.forEach((i) => {
      selectedMap.value.set(i.id, i)
    })
  }
}, {
  immediate: true,
  deep: true
})

onMounted(() => {
  metadataData.value = cloneDeep(props.data)
  console.log(metadataData.value)
})
</script>
<style lang='less' scoped>
.container {

  .options {
    margin: 0 5px;
  }

  .search {
    margin: 10px 0;
    display: flex;
  }

  .metadataList {
    overflow: auto;
    height: 400px;
  }

  .metadataItem {
    align-items: center;
    justify-content: space-between;
    border: 1px solid #f6f6f6;
    padding: 8px 20px;
    border-radius: 5px;
    margin-bottom: 18px;
  }

  .selected {
    border-color: #2f54eb;
  }
  .metadataItemContent{
    display: flex;
    gap: 16px;
  }
}
</style>