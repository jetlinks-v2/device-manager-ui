<template>
  <div :class="{
    'metadata-edit-table-wrapper': true,
    'table-full-screen': isFullscreen
  }" ref="tableWrapper">
    <div class="metadata-edit-table-extra">
      <slot name="extra" :isFullscreen="isFullscreen" :fullScreenToggle="toggle"/>
    </div>
    <div class="metadata-edit-table">
      <div class="metadata-edit-table-header" style="height: 50px" :style="{paddingRight: scrollWidth + 'px'}">
        <Header
          :columns="myColumns"
          :style="{width: tableStyle.width}"
        />
      </div>
      <div class="metadata-edit-table-body" :style="{width: tableStyle.width, height: `${height}px`}">
        <Body
          ref="tableBody"
          :dataSource="bodyDataSource"
          :columns="myColumns"
          :cellHeight="cellHeight"
          :height="height"
          :disableMenu="disableMenu"
          :rowKey="rowKey"
          :groupKey="groupActive.value"
          :openGroup="openGroup"
          :rowSelection="rowSelection"
          :readonly="readonly"
          @scrollDown="onScrollDown"
        >
        <template v-for="(_, name) in slots" #[name]="slotData">
          <slot :name="name" v-bind="slotData || {}"/>
        </template>
        </Body>
        <slot name="bodyExtra"></slot>
      </div>
      <Group
        v-if="dataSource.length && openGroup"
        v-model:activeKey="groupActive.value"
        :options="groupOptions"
        :readonly="readonly"
        :target="target"
        @add="addGroup"
        @delete="groupDelete"
        @edit="groupEdit"
        @change="updateGroupActive"
      />
    </div>
  </div>
</template>

<script setup name="MetadataBaseTable">
import {
  FULL_SCREEN,
  RIGHT_MENU,
  TABLE_DATA_SOURCE,
  TABLE_ERROR,
  TABLE_GROUP_ACTIVE,
  TABLE_GROUP_ERROR,
  TABLE_GROUP_OPTIONS,
  TABLE_OPEN_GROUP,
  TABLE_TOOL,
  TABLE_WRAPPER
} from './consts'
import {handleColumnsWidth} from './utils'
import {useGroup, useResizeObserver, useValidate} from './hooks'
import {tableProps} from 'ant-design-vue/lib/table'
import {useFormContext} from './context'
import Header from './header.vue'
import Body from './body.vue'
import {useFullscreen} from '@vueuse/core';
import {provide, useAttrs, useSlots} from 'vue'
import Group from './group.vue'
import {bodyProps} from "./props";
import {findIndex, get, sortBy} from 'lodash-es'
import i18n from '@/locales'
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n();

const emit = defineEmits(['scrollDown', 'rightMenuClick', 'editChange', 'groupDelete', 'groupEdit'])

const props = defineProps({
  ...tableProps(),
  ...bodyProps(),
  serial: {
    type: [Object, Boolean],
    default: () => ({
      width: 66,
      title: i18n.global.t('MetadataMap.index.130045-25')
    })
  },
  validateRowKey: {
    type: Boolean,
    default: false
  },
  readonly: {
    type: Boolean,
    default: false
  },
  target: {
    type: String,
    default: "product",
  },
})

const slots = useSlots()
const attrs = useAttrs()

const myColumns = ref([])
const tableWrapper = ref()
const tableBody = ref()
const tableStyle = reactive({
  width: '100%',
  height: props.height
})

const fields = {}
const defaultGroupId = 'group_1'

const fieldsErrMap = ref({})
const fieldsGroupError = ref({})

const sortData = reactive({
  key: undefined,
  order: undefined,
  orderKeys: [],
  dataIndex: undefined
})

const {
  groupActive,
  groupOptions,
  addGroup,
  removeGroup,
  updateGroupActive,
  updateGroupOptions
} = useGroup(props.openGroup)

const _dataSource = computed(() => {
  const _options = new Map()

  const sortDataSource = sortData.key ?
    sortBy(props.dataSource, (val) => {
      if (!val.id) return 99999999

      const index = findIndex(sortData.orderKeys, val2 => get(val, sortData.key) === val2)
      return sortData.order === 'desc' ? index : ~index + 1
    }) : props.dataSource

  sortDataSource.forEach((item, index) => {
    item.__dataIndex = index
    if (props.openGroup) {
      const _groupId = item.expands?.groupId
      if (!_groupId) {
        item.expands.groupId = groupActive.value || defaultGroupId
        item.expands.groupName = groupActive.label || $t('Metadata.Table.150159-1')
      }

      const _optionsItem = _options.get(item.expands.groupId)

      if (!_optionsItem) {
        _options.set(item.expands.groupId, {
          value: item.expands?.groupId,
          label: item.expands?.groupName,
          effective: item.id ? 1 : 0, // 有效数据长度
          len: 1 // 分组数据总长度
        })
      } else {
        if (item.id) {
          _optionsItem.effective += 1
        }
        _optionsItem.len += 1
        _options.set(item.expands.groupId, _optionsItem)
      }

      item.__serial = _optionsItem?.len || 1
    } else {
      item.__serial = index + 1
    }
  })

  if (props.openGroup) {
    updateGroupOptions([..._options.values()])
  }

  return sortDataSource
})

const bodyDataSource = computed(() => {
  if (props.openGroup) {
    return _dataSource.value.filter(item => {
      return item.expands.groupId === groupActive.value
    })
  }
  return _dataSource.value
})

useResizeObserver(tableWrapper, onResize)

const {isFullscreen, toggle} = useFullscreen(tableWrapper);

const {rules, validateItem, validate, errorMap} = useValidate(
  _dataSource,
  props.columns,
  props.rowKey,
  {
    onError: (err) => {
      fieldsErrMap.value = {}
      fieldsGroupError.value = {}
      const errMap = {}

      // 显示全部err红标
      err.forEach((item, errIndex) => {
        item.forEach((e, eIndex) => {
          const field = findField(e.__dataIndex, e.field)

          const _eventKey = field ? field.eventKey : `${e.__dataIndex}-${e.field}`
          if (field) {
            field.showErrorTip(e.message)
          }
          errMap[_eventKey] = e.message

          if (errIndex === 0 && eIndex === 0) {

            if (props.openGroup) {
              const expands = _dataSource.value[e.__dataIndex].expands
              updateGroupActive(expands.groupId, expands.groupName)
            }

            setTimeout(() => {
              tableBody.value.scrollTo(e.__serial - 1)
            }, 10)
          }
        })
      })

      fieldsErrMap.value = errMap

    },
    onSuccess: () => {
      fieldsErrMap.value = {}
    },
    onEdit: () => {
      emit('editChange', true)
    },
    validateRowKey: props.validateRowKey
  }
)

provide(TABLE_WRAPPER, tableWrapper)
provide(FULL_SCREEN, isFullscreen)
provide(RIGHT_MENU, {click: rightMenu, getPopupContainer: () => tableWrapper.value})
provide(TABLE_ERROR, fieldsErrMap)
provide(TABLE_GROUP_ERROR, fieldsGroupError)
provide(TABLE_DATA_SOURCE, _dataSource)
provide(TABLE_OPEN_GROUP, props.openGroup)
provide(TABLE_TOOL, {
  scrollTo: (record) => {
    if (props.openGroup) {
      const expands = record.expands
      updateGroupActive(expands.groupId, expands.groupName)
    }

    setTimeout(() => {
      tableBody.value.scrollTo(record.__serial)
    }, 10)
  },
  selected: (keys) => {
    tableBody.value.updateSelectedKeys(keys)
  },
  order: (type, key, orderKeys, dataIndex) => {
    sortData.key = key
    sortData.order = type
    sortData.orderKeys = orderKeys
    sortData.dataIndex = dataIndex
  },
  cleanOrder: () => {
    sortData.key = undefined
    sortData.order = undefined
    sortData.orderKeys = []
    sortData.dataIndex = undefined
  },
  sortData
})
provide(TABLE_GROUP_OPTIONS, groupOptions)
provide(TABLE_GROUP_ACTIVE, groupActive)

const addField = (key, field) => {
  fields[key] = field
}

const removeField = (key) => {
  delete fields[key]
}

function findField(index, name) {
  const fieldId = Object.keys(fields).find(key => {
    const {names} = fields[key]
    return names[0] === index && names[1] === name
  })
  return fields[fieldId]
}

function removeFieldError(key) {
  delete fieldsErrMap.value[key]
}

function addFieldError(key, message) {
  fieldsErrMap.value[key] = message
}

const scrollWidth = computed(() => {
  return (props.dataSource.length * props.cellHeight) > props.height ? 17 : 0
})

function onResize({width = 0, height}) {

  const _width = width - scrollWidth.value

  tableStyle.width = width || '100%'

  // tableStyle.height = height - 146

  let newColumns = [...props.columns]

  if (props.serial) {
    const serial = {
      dataIndex: '__serial',
      title: props.serial.title || $t('Metadata.Table.150159-0'),
      customRender: (customData) => {
        if (props.serial?.customRender) {
          return props.serial?.customRender(customData)
        }
        return customData.index + 1
      },
      width: props.serial?.width
    }
    newColumns = [serial, ...props.columns]
  }

  myColumns.value = handleColumnsWidth(newColumns, _width)
}

const onScrollDown = (len) => {
  emit('scrollDown', len)
}

function rightMenu(menuType, record, copyValue) {
  emit('rightMenuClick', menuType, record, copyValue)
}

const scrollToById = (key) => {
  const _index = _dataSource.value.findIndex(item => item[props.rowKey] === key)
  tableBody.value.scrollTo(_index)
}

const scrollToByIndex = (index) => {
  tableBody.value.scrollTo(index)
}

const getTableWrapperRef = () => {
  return tableWrapper.value
}

const groupDelete = (id, index) => {
  removeGroup(index)
  Object.keys(fieldsErrMap.value).forEach(errorKey => {
    const [index] = errorKey.split('-')
    const dataSourceItem = _dataSource.value[index]
    const groupId = dataSourceItem.expands?.groupId
    if (groupId === id) {
      removeFieldError(errorKey)
      removeField(errorKey)
    }
  })
  emit('groupDelete', id)
}

const groupEdit = (record) => {
  emit('groupEdit', record)
}

const getGroupActive = () => {
  return groupActive.value
}

watch(() => fieldsErrMap.value, (errorMap) => {
  fieldsGroupError.value = {}

  if (props.openGroup) {
    const _errorObj = errorMap
    const groupErrorMap = {}

    Object.keys(_errorObj).forEach(errorKey => {
      const [index] = errorKey.split('-')
      const dataSourceItem = _dataSource.value[index]
      const groupId = dataSourceItem.expands?.groupId

      const groupError = groupErrorMap[groupId]

      const groupErrorItem = {
        [errorKey]: {
          message: _errorObj[errorKey],
          index,
          serial: dataSourceItem.__serial
        }
      }

      if (groupError) {
        groupError.push(groupErrorItem)
      } else {
        groupErrorMap[groupId] = [groupErrorItem]
      }
    })
    console.log(groupErrorMap)

    fieldsGroupError.value = groupErrorMap
  }
}, {deep: true})

watch(() => scrollWidth.value, () => {
  onResize({width: tableStyle.width})
})

useFormContext({
  dataSource: computed(() => {
    return props.dataSource
  }),
  errorMap,
  rules,
  addField,
  removeField,
  removeFieldError,
  addFieldError,
  validateItem
})

defineExpose({
  validate,
  tableWrapper,
  scrollToById,
  scrollToByIndex,
  getTableWrapperRef,
  getGroupActive
})
</script>

<style scoped lang="less">
.metadata-edit-table-wrapper {
  background: #fff;
  height: 100%;
  position: relative;

  &.table-full-screen {
    padding: 24px;
  }

  .metadata-edit-table {
    display: flex;
    flex-direction: column;
    flex-grow: 0;
    flex-shrink: 0;
    background: #fafafa;
    transition: background-color .3s ease;

    .metadata-edit-table-header {
      overflow: hidden;
      width: 100%;
    }

    .metadata-edit-table-body {
      background-color: #fff;
      overflow-y: hidden;
      position: relative;
      height: 100%;
      width: 100%;
      flex: 1 1 auto;
      flex-direction: row;
    }
  }
}
</style>
