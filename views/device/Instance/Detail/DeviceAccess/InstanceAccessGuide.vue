<template>
  <div class="access-guide">
    <j-empty v-if="empty && !loading">
      <template #description>
        <span>{{ $t('InstanceDeviceAccess.952800-9') }}</span>
      </template>
    </j-empty>
    <a-spin v-else :spinning="loading">
      <div v-if="pluginOnly">
        <a-button
          type="link"
          @click="jumpProduct"
        >
          {{ $t('InstanceDeviceAccess.952800-8') }}
        </a-button>
      </div>

      <template v-else-if="access?.id">
        <!-- item 列表：接入方式 / 接入地址（无外层卡片） -->
        <a-list
          class="access-item-list"
          item-layout="vertical"
          :split="true"
          size="small"
        >
          <a-list-item class="access-list-item">
            <a-list-item-meta>
              <template #title>
                <div class="access-meta-title">
                  <div
                    class="title-before"
                    aria-hidden="true"
                  />
                  <span>{{ $t('DeviceAccess.index.594346-4') }}</span>
                </div>
              </template>
              <template #description>
                  <div class="item-style">
                      <div>{{ access?.name }}</div>
                      <div>{{ access?.description || providerDesc }}</div>
                  </div>
              </template>
            </a-list-item-meta>
          </a-list-item>

          <a-list-item class="access-list-item">
            <a-list-item-meta>
              <template #title>
                <div class="access-meta-title">
                  <div
                    class="title-before"
                    aria-hidden="true"
                  />
                  <span>{{ $t('InstanceDeviceAccess.itemAccessAddress') }}</span>
                </div>
              </template>
              <template #description>
                  <div v-if="access?.channelInfo?.addresses?.length > 0">
                      <div
                          v-for="addr in access?.channelInfo?.addresses"
                          :key="addr.address"
                      >
                          <a-badge
                              :color="addr.health === -1 ? 'red' : 'green'"
                              :text="addr.address"
                          />
                      </div>
                  </div>
                  <div v-else>
                      {{ $t('DeviceAccess.index.594346-8') }}
                  </div>
              </template>
            </a-list-item-meta>
          </a-list-item>

          <Config
            variant="item"
            @saved="onConfigSaved"
          />
          <Principal
            variant="item"
            ref="principalRef"
          />
        </a-list>

      </template>
    </a-spin>
  </div>
</template>

<script lang="ts" setup>
import Title from '../../../Product/Detail/Title/index.vue'
import Config from '../Info/components/Config/index.vue'
import Principal from '../Info/components/Principal/index.vue'
import {
  queryList,
  getConfigView,
  detail as productDetail,
  getProviders,
} from '../../../../../api/product'
import { getCompositeProviderDetail } from '../../../../../api/link/accessConfig'
import { useInstanceStore } from '../../../../../store/instance'
import { useMenuStore } from '@jetlinks-web-core/store/menu'
import { marked } from 'marked'
import type { TableColumnType } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'

const { t: $t } = useI18n()
const instanceStore = useInstanceStore()
const menuStore = useMenuStore()

const loading = ref(false)
const empty = ref(false)
const pluginOnly = ref(false)
const access = ref<Record<string, any>>({})
const config = ref<any>({})
const markdownToHtml = shallowRef('')
const dataSource = ref<any[]>([])
const compositeActive = ref<string[]>([])
const compositeActiveAddress = ref<string[]>([])
const columnsMQTT = ref<TableColumnType[]>([])
const columnsHTTP = ref<TableColumnType[]>([])

const principalRef = ref<{ refresh?: () => void } | null>(null)

const hasRoutesTable = computed(
  () => !!(config.value?.routes && config.value.routes.length > 0),
)

const providerDesc = computed(() => {
  const p = access.value?.provider
  return dataSource.value.find((item: any) => item?.id === p)?.description || ''
})

const ColumnsMQTT: TableColumnType[] = [
  { title: 'topic', dataIndex: 'topic', key: 'topic', ellipsis: true, width: '28%' },
  {
    title: $t('DeviceAccess.index.594346-22'),
    dataIndex: 'stream',
    key: 'stream',
    ellipsis: true,
    width: '18%',
  },
  {
    title: $t('DeviceAccess.index.594346-23'),
    dataIndex: 'description',
    key: 'description',
    ellipsis: true,
  },
]

const ColumnsHTTP = [
  {
    title: $t('DeviceAccess.index.594346-24'),
    dataIndex: 'address',
    key: 'address',
    ellipsis: true,
    width: '32%',
  },
  {
    title: $t('DeviceAccess.index.594346-25'),
    dataIndex: 'example',
    key: 'example',
    ellipsis: true,
    width: '28%',
  },
  {
    title: $t('DeviceAccess.index.594346-23'),
    dataIndex: 'description',
    key: 'description',
    ellipsis: true,
  },
]

const getStream = (record: any) => {
  const list: string[] = []
  if (record?.upstream) list.push($t('DeviceAccess.index.594346-26'))
  if (record?.downstream) list.push($t('DeviceAccess.index.594346-27'))
  return list.join(',')
}

const handleColumns = () => {
  const Group: TableColumnType = {
    title: $t('DeviceAccess.index.594346-28'),
    dataIndex: 'group',
    key: 'group',
    ellipsis: true,
    align: 'center',
    width: 72,
    customCell: (record: any, rowIndex: number) => {
      const obj: any = {
        children: record,
        rowSpan: 0,
      }
      const list = config.value?.routes || []
      const arr = list.filter((res: any) => res.group === record.group)
      const isRowIndex =
        rowIndex === 0 || list[rowIndex - 1].group !== record.group
      if (isRowIndex) obj.rowSpan = arr.length
      return obj
    },
  }
  columnsMQTT.value = [Group, ...ColumnsMQTT]
  columnsHTTP.value = [Group, ...ColumnsHTTP]
}

const loadConfigDetail = (messageProtocol: string, transportProtocol: string) => {
  if (!messageProtocol || !transportProtocol) return
  getConfigView(messageProtocol, transportProtocol).then((resp: any) => {
    if (resp.status === 200) {
      config.value = resp.result
      handleColumns()
      markdownToHtml.value = config.value?.document ? marked(config.value.document) : ''
    }
  })
}

const onConfigSaved = () => {
  principalRef.value?.refresh?.()
}

const queryAccessDetail = async (id: string) => {
  const res: any = await queryList({
    terms: [{ column: 'id', value: id }],
  })
  if (res.status === 200 && res.result?.data?.[0]) {
    access.value = res.result.data[0]
    if (access.value.provider === 'composite-device-gateway') {
      getCompositeProviderDetail(access.value.configuration?.gateways || []).then((r: any) => {
        if (r.success && access.value.configuration) {
          access.value.configuration.gateways = r.result
        }
      })
      return
    }
    if (access.value.provider === 'plugin_gateway') {
      pluginOnly.value = true
      return
    }
    const inst = instanceStore.current
    loadConfigDetail(
      inst.messageProtocol || access.value.protocol,
      inst.transportProtocol || access.value.transport,
    )
  } else {
    empty.value = true
  }
}

const load = async () => {
  loading.value = true
  empty.value = false
  pluginOnly.value = false
  access.value = {}
  config.value = {}
  markdownToHtml.value = ''
  compositeActive.value = []
  compositeActiveAddress.value = []
  try {
    const inst = instanceStore.current
    let accessId = inst.accessId
    if (!accessId && inst.productId) {
      const pr: any = await productDetail(inst.productId)
      if (pr.status === 200) {
        accessId = pr.result?.accessId
      }
    }
    if (!accessId) {
      empty.value = true
      return
    }
    await queryAccessDetail(accessId)
  } finally {
    loading.value = false
  }
}

const jumpProduct = () => {
  menuStore.jumpPage('device/Product/Detail', {
    params: {
      id: instanceStore.current?.productId,
      tab: 'Device',
    },
  })
}

onMounted(() => {
  getProviders().then((res: any) => {
    dataSource.value = res.result || []
  })
})

watch(
  () => instanceStore.current?.id,
  () => load(),
  { immediate: true },
)

watch(
  () => access.value?.configuration?.gateways,
  (g) => {
    if (access.value?.provider !== 'composite-device-gateway' || !g?.length) return
    const first = g[0]?.id
    if (first && compositeActive.value.length === 0) {
      compositeActive.value = [first]
    }
    if (first && compositeActiveAddress.value.length === 0) {
      compositeActiveAddress.value = [first]
    }
  },
  { deep: true },
)
</script>

<style lang="less" scoped>
.access-guide {
  min-width: 0;
  max-width: 100%;
  padding: 0;
  overflow-x: hidden;
}

.access-item-list {
  margin-bottom: 8px;

  :deep(.ant-list-item) {
    padding-inline: 0;
    padding-block: 8px;
  }

  :deep(.ant-list-item-meta-title) {
    margin-bottom: 4px;
  }

  :deep(.ant-list-item-meta-description) {
    max-width: 100%;
    color: rgba(0, 0, 0, 0.88);
  }
}

/* 与 Product/Detail/Title 一致的 title-before */
.access-meta-title {
  position: relative;
  display: flex;
  align-items: center;
  padding-left: 10px;
  min-height: 22px;
  color: rgba(0, 0, 0, 0.85);
  font-weight: 600;
  font-size: 16px;
  line-height: 1.4;

  .title-before {
    position: absolute;
    top: 2px;
    left: 0;
    width: 4px;
    height: calc(100% - 4px);
    min-height: 14px;
    background-color: @primary-color;
    border-radius: 0 3px 3px 0;
  }

  &--sub {
    font-size: 14px;
    margin-bottom: 4px;

    .title-before {
      top: 1px;
    }
  }
}

.access-list-item {
  padding-block: 8px !important;
}

.access-guide__col {
  min-width: 0;
}

.routes-panel-title {
  margin-bottom: 8px;
}

.routes-table-shell {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-x: auto;
}

.cell-clip {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-style {
  margin-bottom: 8px;
}

.jump-product {
  margin-top: 16px;
}

:deep(.routes-table .ant-table) {
  font-size: 12px;
}

:deep(.routes-table .ant-table-cell) {
  word-break: break-word;
}
</style>
