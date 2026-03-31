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
        <div
          class="access-guide-layout"
          :class="{ 'access-guide-layout--with-doc': showProtocolDoc }"
        >
          <!-- 左侧：接入方式 / 接入地址 / 配置 / 身份 -->
          <div class="access-guide-main">
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
          </div>

          <!-- 右侧：协议返回的 Markdown 说明（getConfigView document） -->
          <aside
            v-if="showProtocolDoc"
            class="access-guide-doc"
          >
            <div class="access-guide-doc__sticky">
              <div class="access-guide-doc__title">
                {{ $t('InstanceDeviceAccess.952800-34') }}
              </div>
              <div
                class="access-guide-doc__body markdown-body"
                v-html="markdownToHtml"
              />
            </div>
          </aside>
        </div>
      </template>
    </a-spin>
  </div>
</template>

<script lang="ts" setup>
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

const showProtocolDoc = computed(() => !!markdownToHtml.value)

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

.access-guide-layout {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  width: 100%;
  min-width: 0;
}

.access-guide-main {
  flex: 1;
  min-width: 0;
}

/* 有协议说明时：左右等宽，说明区与接入配置列对齐，不横向挤占身份等表单项 */
.access-guide-layout--with-doc .access-guide-main {
  flex: 1 1 0;
  min-width: 0;
}

.access-guide-doc {
  flex: 1 1 0;
  min-width: 0;
  max-width: none;
}

.access-guide-doc__sticky {
  position: sticky;
  top: 0;
  max-height: calc(100vh - 220px);
  overflow: auto;
  padding: 12px 14px;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  background: #fafafa;
}

.access-guide-doc__title {
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
  color: rgba(0, 0, 0, 0.85);
  font-weight: 600;
  font-size: 14px;
}

.access-guide-doc__body {
  font-size: 13px;
  line-height: 1.65;
  color: rgba(0, 0, 0, 0.75);
  word-break: break-word;
}

.access-guide-doc__body :deep(h1),
.access-guide-doc__body :deep(h2),
.access-guide-doc__body :deep(h3) {
  margin: 0.75em 0 0.4em;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
}

.access-guide-doc__body :deep(p) {
  margin: 0.45em 0;
}

.access-guide-doc__body :deep(ul),
.access-guide-doc__body :deep(ol) {
  padding-left: 1.25em;
  margin: 0.4em 0;
}

.access-guide-doc__body :deep(pre) {
  padding: 8px 10px;
  overflow-x: auto;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.04);
  font-size: 12px;
}

.access-guide-doc__body :deep(code) {
  padding: 0 4px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.06);
  font-size: 12px;
}

.access-guide-doc__body :deep(pre code) {
  padding: 0;
  background: transparent;
}

.access-guide-doc__body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.access-guide-doc__body :deep(th),
.access-guide-doc__body :deep(td) {
  padding: 6px 8px;
  border: 1px solid #f0f0f0;
}

@media (max-width: 992px) {
  .access-guide-layout--with-doc {
    flex-direction: column;
  }

  .access-guide-doc {
    flex: 1 1 auto;
    max-width: 100%;
    width: 100%;
    min-width: 0;
  }

  .access-guide-doc__sticky {
    max-height: none;
  }
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
