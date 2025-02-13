<template>
  <div class='search-warp' ref='searchRef'>
    <div class='search-flex'>
      <div class='search-title'>
        <slot name='titleRender'>
          <span>{{ title }}</span>
        </slot>
      </div>
      <div class='search-right'>
        <div class='search-content'>
          <div class='search-result-tag'>
            <div class='tag-all'>{{ $t('Search.Search.673421-0') }}</div>
            <div class='tag-text'>
              <j-ellipsis>
                <span v-for='item in text' class='tag-text-item'>{{ item }}</span>
              </j-ellipsis>
            </div>
            <div @click.stop='onShowParams'>
              <AIcon
                  :class="{
                  'search-result-icon': true,
                  'search-result-icon-down': showParams
                }"

                  type='DoubleRightOutlined'
              />
            </div>
          </div>
          <div class='search-input'>
            <a-input :placeholder="$t('Search.Search.673421-1')" v-model:value='searchValue' :maxlength='64' allow-clear
                     @change='onChange'>
              <template #suffix>
                <AIcon type='SearchOutlined' @click='onSearch' />
              </template>
            </a-input>
          </div>
        </div>
      </div>
    </div>

    <div :class="{'search-params': true, 'slide-in-top': showParams, 'search-params-hidden': hiddenParams }">
      <div class='search-params-top'>
        <slot name='providerRender' :onParamsChange='onProviderRenderChange'>
          <ParamsOptions
              :title="$t('Search.Search.673421-2')"
              :options='providerOptions'
              :fieldNames="{
            label: 'text',
          }"
              style='margin-bottom: 12px'
              @change='(v, r) => onParamsChange(v, r, 0)'
          />
        </slot>
        <ParamsOptions
            :title="$t('Search.Search.673421-3')"
            :options='classifyTypeOptions'
            :fieldNames="{
          label: 'name',
          value: 'id'
        }"
            @change='(v, r) => onParamsChange(v, r, 1)'
        />
      </div>
      <ClassifyOptions
          v-if='classifyOptions?.length'
          :options='classifyOptions'
          @change='onClassifyChange'
          :type='oldClassifyType'
      />
    </div>
  </div>
</template>

<script setup name='ProSearch'>
import ParamsOptions from './ParamsOptions.vue'
import ClassifyOptions from './ClassifyOptions.vue'
import { useRequest } from '@jetlinks-web/hooks'
import { ResourceApi } from '@device/api/resource/resource'
import { cloneDeep, omit } from 'lodash-es'
import { useI18n } from 'vue-i18n'

const { t: $t } = useI18n()
const props = defineProps({
  style: {
    type: Object,
    default: () => ({
      padding: '18px 24px'
    })
  },
  title: {
    type: String,
    default: undefined
  },
  value: {
    type: Array,
    default: undefined
  }
})

const emit = defineEmits(['update:value', 'search'])

const text = ref([$t('Search.Search.673421-4')])

const showParams = ref(false)
const hiddenParams = ref(true)
const searchRef = ref()
const searchValue = ref()
const valueMap = new Map()

let oldClassifyType = 'all'

const searchParams = []

const handleTreeMap = (arr, parentName) => {
  const _name = parentName ? parentName + '/' : ''
  arr.filter(i => i?.id).map((item) => {
    if (!valueMap.get(item.id)) {
      valueMap.set(item.id, {
        ...omit(cloneDeep(item), ['children']),
        fullname: _name + item.name
      })
    }
    if (item.children) {
      handleTreeMap(item.children, _name + item.name)
    }
  })
}

const { data: providerOptions } = useRequest(ResourceApi.queryProvider, { defaultValue: [] })
const { data: classifyOptions, run: runClassify } = useRequest(ResourceApi.queryClassify, {
  immediate: false,
  defaultValue: [],
  onSuccess(res) {
    if (res.success) {
      handleTreeMap(res.result, '')
    }
  }
})
const { data: classifyTypeOptions } = useRequest(ResourceApi.queryClassifyType, {
  defaultValue: [],
  defaultParams: { paging: false, sorts: [{ name: 'order', order: 'asc' }] },
  onSuccess(resp) {
    if (resp.success) {
      resp.result.forEach(item => {
        if (!valueMap.get(item.id)) {
          valueMap.set(item.id, {
            ...item,
            fullname: item.name
          })
        }
      })
    }
  }
})

const paramsArray = []
const optionsArray = ref([])

/**
 * 提交
 */
const searchSubmit = () => {
  const nameParams = searchParams[2]
  const _params = searchParams.filter((item, index) => item && index !== 2)
  const newParams = {
    terms: [
      {
        terms: nameParams ? [{ terms: _params }, nameParams] : _params,
        type: 'and'
      }
    ]
  }

  emit('update:value', newParams)
  emit('search', newParams)
}

const onShowParams = () => {

  const oldValue = showParams.value

  if (oldValue) { // 隐藏
    setTimeout(() => {
      hiddenParams.value = true
    }, 500)
  } else {
    hiddenParams.value = false
  }

  setTimeout(() => {
    showParams.value = !oldValue
  }, 100)
}

const onSearch = () => {
  if (searchValue.value) {
    searchParams[2] = {
      terms: [
        {
          column: 'name',
          value: `%${searchValue.value}%`,
          termType: 'like'
        },
        {
          column: 'id',
          value: `%${searchValue.value}%`,
          termType: 'like',
          type: 'or'
        }
      ],
      type: 'and'
    }
  } else {
    searchParams.splice(2, 1)
  }

  searchSubmit()
}

const handleData = () => {
  const array = paramsArray.filter((item, index) => item.value !== 'all' && !(index === 1 && optionsArray.value.length > 0)).map(item => item.label)
  const arr = [...array, ...optionsArray.value]
  text.value = arr.length ? arr : [$t('Search.Search.673421-4')]
}

const onProviderRenderChange = (params, v, r, index = 0) => {
  searchParams[index] = params
  paramsArray[index] = r
  handleData()
  searchSubmit()
}

const onParamsChange = (value, record, index) => {
  paramsArray[index] = record

  const isType = index === 0
  const isValueAll = value === 'all'
  if (index === 1) {
    optionsArray.value = []
  }
  handleData()
  if (isValueAll) {
    searchParams[index] = undefined
  } else {
    searchParams[index] = {
      column: isType ? 'type' : 'id$resource-bind',
      value: isType ? value : [{
        column: 'key$resources-classification',
        value: [
          {
            'column': 'classificationTypeId',
            'value': value
          }
        ]
      }]
    }

    if (!isType && searchParams.filter(item => item).length > 1) {
      searchParams[index].type = 'or'
    }
  }
  if (!isType) {
    oldClassifyType = value
    if (isValueAll) {
      classifyOptions.value = []
    } else {
      runClassify({
        paging: false,
        sorts: [
          { name: 'sortIndex', order: 'asc' }
        ],
        terms: [{ column: 'classificationTypeId', value }]
      })
    }
  }
  searchSubmit()
}

const onClassifyChange = (keys) => {
  const array = keys.length ? keys : [oldClassifyType]
  const dt = paramsArray?.[0]
  const arr = array.map(i => {
    return valueMap.get(i)?.fullname
  })
  text.value = dt?.value && dt.value !== 'all' ? [dt.label, ...arr] : arr

  if(keys.length){
    optionsArray.value = cloneDeep(arr)
    searchParams[1].value = [
      {
        column: 'key$resources-classification-child',
        termType: 'in',
        value: keys
      }
    ]
  } else {
    optionsArray.value = []
    searchParams[1].value = [
      {
        column: 'key$resources-classification',
        value: oldClassifyType
      }
    ]
  }
  searchSubmit()
}

const domClick = (e) => {
  if (!searchRef.value || !searchRef.value.contains(e.target)) {
    setTimeout(() => {
      hiddenParams.value = true
    }, 500)

    setTimeout(() => {
      showParams.value = false
    }, 100)
  }
}

const onChange = () => {
  if (!searchValue.value) {
    onSearch()
  }
}

onMounted(() => {
  document.addEventListener('click', domClick)
})

onUnmounted(() => {
  document.removeEventListener('click', domClick)
})

</script>

<style scoped lang='less'>
.search-warp {
  width: 100%;
  position: relative;

  .search-flex {
    display: flex;
    justify-content: space-between;
    z-index: 2;
    position: relative;
    gap: 16px;

    .search-right {
      flex: 1;
      min-width: 0;
      display: flex;
      gap: 16px;
      justify-content: flex-end;
    }
  }
}

.search-params {
  position: absolute;
  top: 20px;
  background-color: #fff;
  width: 100%;
  transition: all 0.5s;
  opacity: 0;
  z-index: 9;
  border-radius: 6px;
  box-shadow: 0 1px 6px 0 rgba(0, 0, 0, 0.16);

  .search-params-top {
    background-color: #F8F9FA;
    padding: 16px;
  }

  &.slide-in-top {
    opacity: 1;
    top: 33px;
  }

  &.search-params-hidden {
    display: none;
  }
}

.search-result-icon {
  transform: rotate(90deg);
  transition: all .3s;

  &.search-result-icon-down {
    transform: rotate(-90deg);
  }
}

.search-input {
  width: 260px;
  :deep(.ant-input-affix-wrapper) {
    border-radius: 24px;
  }
}

.search-content {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  justify-content: flex-end;

  .search-result-tag {
    display: flex;;
    gap: 8px;
    flex: 1;
    min-width: 0;
    justify-content: flex-end;

    .tag-all {
      color: #646C73;
      white-space: nowrap;
    }

    .tag-text {
      color: #1F2429;

      .tag-text-item {
        &:not(:last-child)::after {
          content: '；';
        }
      }
    }
  }
}

</style>
