<template>
  <div
    v-if="dataSource.length"
    class="metadata-edit-table-body-viewport" :style="{ ...style, height: height + 'px'}" ref="viewScrollRef" @scroll="onScroll">
    <div :style="{position: 'relative'}">
      <div class="metadata-edit-scrollbar" :style="containerStyle"> </div>
      <div class="metadata-edit-table-center" ref="tableCenterRef" >
        <div
            v-if="virtualData.length"
            v-for="(item, index) in virtualData"
            :class="{
              'metadata-edit-table-row': true,
              'metadata-edit-table-row-selected': selectedRowKeys?.includes(item[rowKey] || virtualRang.start + index + 1)
            }"
            :key="`record_${item.__key}`"
            :style="{height: `${cellHeight}px`,}"
            :data-row-key="item[rowKey] || virtualRang.start + index + 1"
            @click.right.native="(e) => showContextMenu(e,item, virtualRang.start + index)"
            @click.stop="() => rowClick(item)"
        >
          <div
              v-for="(column, __index) in columns"
              class="metadata-edit-table-cell"
              :style="{
                width: `${column.width}px`,
                left: `${column.left || 200 * __index}px`,
              }"
          >
            <div v-if="column.dataIndex === '__serial'" class="body-cell-box">
              <slot name="serial" :record="item" :index="item.__dataIndex" :column="column" >
                {{ virtualRang.start + index + 1 }}
              </slot>
            </div>
            <div v-else class="body-cell-box">
              <slot :name="column.dataIndex" :record="item" :index="item.__dataIndex" :column="column" >
                {{ item[column.dataIndex] }}
              </slot>
            </div>
          </div>
        </div>
        <div class="readonly-mask" v-if="readonly"></div>
      </div>
    </div>
  </div>
  <template v-else>
    <slot name="empty">
      <div class="metadata-edit-table-body-empty">
        <j-empty />
      </div>
    </slot>
  </template>
</template>

<script setup name="MetadataBaseTableBody">
import ContextMenu from './components/ContextMenu'
import {useRightMenuContext} from "./context";
import {randomString} from "@jetlinks-web/utils";
import {bodyProps} from "./props";

const props = defineProps({
  ...bodyProps(),
  groupKey: {
    type: [String, Number],
    default: undefined
  },
  readonly: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:dataSource', 'scrollDown'])

const viewScrollRef = ref()
const tableCenterRef = ref()
// const virtualData = ref([])
const virtualRang = reactive({
  start: 0,
  end: 15
})
const containerStyle = ref(0)
const context = useRightMenuContext()

let scrollLock = ref(false)
let menuInstance

const maxLen = computed(() => {
  return Math.trunc(props.height / props.cellHeight)
})

const selectedRowKeys = ref([])

const virtualData = computed(()=> {

  const array = props.dataSource.slice(virtualRang.start, virtualRang.end)
  if (tableCenterRef.value) {
    tableCenterRef.value.style.webkitTransform  =  `translate3d(0, ${virtualRang.start * props.cellHeight}px, 0)`
  }
  // console.log(array, 'arry')
  return array
})
// const updateVirtualData = (start, end) => {
//   debugger
//   virtualData.value = props.dataSource.slice(start, end)
//   if (tableCenterRef.value) {
//     tableCenterRef.value.style.webkitTransform  =  `translate3d(0, ${start * props.cellHeight}px, 0)`
//   }
// }

const onScroll = () => {
  if (!viewScrollRef.value) return
  const height = viewScrollRef.value.scrollTop
  const clientHeight = viewScrollRef.value.clientHeight
  const scrollHeight = viewScrollRef.value.scrollHeight

  const _index = Math.round(height / props.cellHeight) - 1

  const start = _index < 0 ? 0 : _index
  const end = start + maxLen.value + 4

  if (height + clientHeight >= props.dataSource.length * props.cellHeight && !scrollLock.value) { // 滚动到底
    emit('scrollDown')
    scrollLock.value = true
  }

  virtualRang.start = start
  virtualRang.end = end
  // updateVirtualData(start, end)
}

const scrollTo = (index) => {
  if (viewScrollRef.value) {
    let top = index * props.cellHeight
    viewScrollRef.value.scrollTop = top
  }
}

const showContextMenu = (e, record, _index) => {
  e.preventDefault()
  if (props.disableMenu) {
    record = {
      ...record,
      __index: _index
    }
    menuInstance = ContextMenu(e, record, context)
  }
}

// const updateView = () => {
//   updateVirtualData(virtualRang.start, virtualRang.start + maxLen.value)
// }

const rowClick = (record) => {
  if (props.rowSelection?.selectedRowKeys) {
    const rowSet = new Set(selectedRowKeys.value)
    const key = record[props.rowKey]
    const selected = !rowSet.has(key)

    if (selected) {
      rowSet.delete(key)
    } else {
      rowSet.add(key)
    }

    props.rowSelection.onSelect?.(record, selected )

    selectedRowKeys.value = [...rowSet.values()]
  }
}

const updateSelectedKeys = (keys) => {
  selectedRowKeys.value = keys
}

onMounted(() => {
  nextTick(() => {
    onScroll()
  })
})

onBeforeUnmount(() => {
  menuInstance?.destroy()
  menuInstance?.cleanCopy()
})

watch(() => JSON.stringify(props.rowSelection?.selectedRowKeys), (val) => {
  selectedRowKeys.value = JSON.parse(val || '[]')
}, { immediate: true })

watch(() => props.dataSource, (val, oldVal) => {

  props.dataSource.forEach((item, index) => {
    if (!item.__key) {
      item.__key = randomString()
    }
  })

  // updateView()

}, {
  immediate: true,
  deep: true
})

watch(() => props.dataSource.length, () => {
  scrollLock.value = false
  containerStyle.value = {
    height: props.dataSource.length * props.cellHeight + 'px'
  }

  if (props.dataSource.length <= maxLen.value || props.dataSource.length === 0) {
    emit('scrollDown', maxLen.value - props.dataSource.length + 3)
  }
}, { immediate: true})

// watch(() => props.height, () => {
//   updateView()
// })

watch(() => props.groupKey, () => {
  if (props.openGroup) {
    scrollTo(0)
  }
})

defineExpose({
  scrollTo,
  updateSelectedKeys
})

</script>

<style scoped lang="less">
.metadata-edit-table-body-viewport {
  max-height: 100%;
  width: 100%;
  overflow: hidden auto;
  position: relative;

  .metadata-edit-scrollbar {
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
    z-index: -1;
  }

  .metadata-edit-table-body-container {
    overflow: hidden;
    height: 100%;
  }

  .metadata-edit-table-center {
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
    height: 100%;

    .metadata-edit-table-row {
      width: 100%;
      display: flex;
      align-items: center;
      //position: absolute;
      transition: top .2s, height .2s, background-color .1s;
      border-bottom: 1px solid #ebebeb;
      .metadata-edit-table-cell{
        position:absolute;
        min-width: 0;;
      }
      &:hover {
        background-color: rgb(248, 248, 248);
      }

      &.metadata-edit-table-row-selected {
        background-color: var(--ant-primary-1);
      }

      .body-cell-box {
        padding: 0 12px;
        position: relative;
      }
    }

    .readonly-mask {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 4;
    }
  }
}
.metadata-edit-table-body-empty {
  display: flex;
  width: 100%;
  justify-content: center;
  padding-top: 24px;
}
</style>
