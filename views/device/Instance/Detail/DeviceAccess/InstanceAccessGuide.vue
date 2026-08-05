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
                ref="protocolDocBodyRef"
                class="access-guide-doc__body markdown-body"
                v-html="markdownToHtml"
                @click="onProtocolDocClick"
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
import { existsDevicePrincipalSupport, getDevicePrincipal } from '../../../../../api/instance'
import { useInstanceStore } from '../../../../../store/instance'
import { useMenuStore } from '@jetlinks-web-core/store/menu'
import { marked } from 'marked'
import dayjs from 'dayjs'
import type { TableColumnType } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web/utils'
import useClipboard from 'vue-clipboard3'

const { t: $t } = useI18n()
const { toClipboard } = useClipboard()
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
const protocolDocBodyRef = ref<HTMLElement | null>(null)
const principalList = ref<Array<Record<string, any>>>([])
const supportPrincipal = ref<boolean | null>(null)
const currentDeviceId = ref<string | undefined>()

const showProtocolDoc = computed(() => !!markdownToHtml.value)

const hasRoutesTable = computed(
  () => !!(config.value?.routes && config.value.routes.length > 0),
)

const providerDesc = computed(() => {
  const p = access.value?.provider
  return dataSource.value.find((item: any) => item?.id === p)?.description || ''
})

const loadPrincipal = async (deviceId?: string) => {
  if (!deviceId) {
    principalList.value = []
    currentDeviceId.value = undefined
    return
  }

  if (currentDeviceId.value !== deviceId) {
    supportPrincipal.value = null
    currentDeviceId.value = deviceId
  }

  if (supportPrincipal.value === false) {
    principalList.value = []
    return
  }

  if (supportPrincipal.value === null) {
    try {
      const supportResp = await existsDevicePrincipalSupport()
      if (supportResp?.status === 200 && supportResp.result) {
        supportPrincipal.value = true
      } else {
        supportPrincipal.value = false
        principalList.value = []
        return
      }
    } catch {
      supportPrincipal.value = false
      principalList.value = []
      return
    }
  }

  try {
    const resp: any = await getDevicePrincipal(deviceId)
    if (resp?.status === 200) {
      principalList.value = resp.result || []
      if (config.value?.document) {
        refreshMarkdownDocument()
      }
    }
  } catch {
    principalList.value = []
  }
}

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

function getByPath(source: Record<string, any> | undefined, path: string): unknown {
  if (!source || !path) return undefined
  const segments = path
    .split('.')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!segments.length) return undefined
  let cur: any = source
  for (const key of segments) {
    if (cur == null || typeof cur !== 'object' || !(key in cur)) {
      return undefined
    }
    cur = cur[key]
  }
  return cur
}

function splitByPipe(input: string): string[] {
  const out: string[] = []
  let buf = ''
  let quote: '"' | "'" | null = null
  let depth = 0
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (quote) {
      buf += ch
      if (ch === quote && input[i - 1] !== '\\') quote = null
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch as '"' | "'"
      buf += ch
      continue
    }
    if (ch === '(') {
      depth += 1
      buf += ch
      continue
    }
    if (ch === ')') {
      depth = Math.max(0, depth - 1)
      buf += ch
      continue
    }
    if (ch === '|' && depth === 0) {
      out.push(buf.trim())
      buf = ''
      continue
    }
    buf += ch
  }
  out.push(buf.trim())
  return out.filter(Boolean)
}

function splitArgs(input: string): string[] {
  const out: string[] = []
  let buf = ''
  let quote: '"' | "'" | null = null
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (quote) {
      buf += ch
      if (ch === quote && input[i - 1] !== '\\') quote = null
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch as '"' | "'"
      buf += ch
      continue
    }
    if (ch === ',') {
      out.push(buf.trim())
      buf = ''
      continue
    }
    buf += ch
  }
  if (buf.trim()) out.push(buf.trim())
  return out
}

function parseLiteral(input: string): unknown {
  const text = String(input || '').trim()
  if (!text) return ''
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1).replace(/\\n/g, '\n').replace(/\\t/g, '\t')
  }
  if (text === 'true') return true
  if (text === 'false') return false
  if (text === 'null') return null
  const n = Number(text)
  if (!Number.isNaN(n) && /^-?\d+(\.\d+)?$/.test(text)) return n
  return text
}

function formatBytes(value: unknown, digits = 2): string {
  const num = Number(value)
  if (!Number.isFinite(num)) return ''
  if (num < 1024) return `${Math.round(num)} B`
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(digits)} KB`
  if (num < 1024 * 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(digits)} MB`
  return `${(num / (1024 * 1024 * 1024)).toFixed(digits)} GB`
}

function applyFilter(name: string, value: unknown, args: unknown[]): unknown {
  switch (name) {
    case 'date': {
      if (value == null || value === '') return ''
      const fmt = String(args[0] ?? 'YYYY-MM-DD HH:mm:ss')
      const d = dayjs(value as any)
      return d.isValid() ? d.format(fmt) : ''
    }
    case 'bytes': {
      const digits = Number(args[0] ?? 2)
      return formatBytes(value, Number.isFinite(digits) ? digits : 2)
    }
    case 'json': {
      const space = Number(args[0] ?? 2)
      try {
        return JSON.stringify(value, null, Number.isFinite(space) ? space : 2)
      } catch {
        return ''
      }
    }
    case 'upper':
      return value == null ? '' : String(value).toUpperCase()
    case 'lower':
      return value == null ? '' : String(value).toLowerCase()
    default:
      return value
  }
}

function toTemplateText(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return ''
    }
  }
  return String(value)
}

function resolveTemplateExpr(
  expr: string,
  context: Record<string, any>,
  missing: Set<string>,
): string {
  const parts = splitByPipe(expr)
  const base = parts[0] || ''
  const idx = base.indexOf('?:')
  const path = (idx >= 0 ? base.slice(0, idx) : base).trim()
  const defaultText = idx >= 0 ? base.slice(idx + 2).trim() : ''

  let value = getByPath(context, path)
  if (value === undefined || value === null || value === '') {
    if (defaultText) {
      value = parseLiteral(defaultText)
    } else {
      missing.add(path)
      value = ''
    }
  }

  for (let i = 1; i < parts.length; i++) {
    const token = parts[i]
    const m = /^([a-zA-Z_][\w-]*)(?:\((.*)\))?$/.exec(token)
    if (!m) continue
    const filterName = m[1]
    const argText = (m[2] || '').trim()
    const args = argText ? splitArgs(argText).map(parseLiteral) : []
    value = applyFilter(filterName, value, args)
  }
  return toTemplateText(value)
}

function renderDocumentWithBuiltins(doc?: string): string {
  if (!doc) return ''
  const firstPrincipal = principalList.value[0] || {}
  const principal = {
    ...firstPrincipal,
    identityType: firstPrincipal?.identity?.type,
    identifier: firstPrincipal?.identity?.identifier,
    credentialType: firstPrincipal?.credential?.type,
    token: firstPrincipal?.credential?.content?.token,
    username: firstPrincipal?.credential?.content?.username,
    password: firstPrincipal?.credential?.content?.password,
  }
  const context = {
    device: instanceStore.current || {},
    access: access.value || {},
    config: config.value || {},
    principal,
    principals: principalList.value || [],
  }
  const missing = new Set<string>()
  const rendered = doc.replace(/\$\{([^}]+)\}/g, (_, rawExpr: string) => {
    const expr = String(rawExpr || '').trim()
    if (!expr) return ''
    return resolveTemplateExpr(expr, context as Record<string, any>, missing)
  })
  if (import.meta.env.DEV && missing.size) {
    console.warn('[InstanceAccessGuide] missing markdown template vars:', [...missing])
  }
  return rendered
}

/**
 * 协议说明 Markdown 内可声明「点击复制」：
 * - 推荐：`<a href="#" data-copy="实际要复制的文本">点击复制</a>`（不会跳转）
 * - 兼容：`<span copy-content="实际要复制的文本">复制</span>`（与 data-copy 等价）
 * - 仅写 `data-copy=""` 时，会回退为复制元素可见文本
 * `${...}` 占位符在 marked 之前已由 renderDocumentWithBuiltins 替换。
 */
function refreshMarkdownDocument() {
  const rendered = renderDocumentWithBuiltins(config.value?.document)
  markdownToHtml.value = rendered ? marked(rendered) : ''
}

/** 从协议说明区点击带 data-copy / copy-content 的元素时写入剪贴板 */
async function copyProtocolDocText(text: string) {
  if (!text.trim()) {
    onlyMessage($t('InstanceDeviceAccess.952800-35'), 'warning')
    return
  }
  try {
    await toClipboard(text)
    onlyMessage($t('InstanceDeviceAccess.952800-7'))
  } catch {
    onlyMessage($t('InstanceDeviceAccess.952800-36'), 'error')
  }
}

function onProtocolDocClick(e: MouseEvent) {
  const root = protocolDocBodyRef.value
  if (!root) return
  const t = e.target
  if (!t || !(t instanceof Element)) return
  const el = t.closest('[data-copy], [copy-content]')
  if (!el || !root.contains(el)) return
  e.preventDefault()
  e.stopPropagation()
  const hasData = el.hasAttribute('data-copy')
  const attrRaw = hasData
    ? (el.getAttribute('data-copy') ?? '')
    : (el.getAttribute('copy-content') ?? '')
  const visible = (el.textContent || '').trim()
  const text = attrRaw.trim() ? attrRaw : visible
  void copyProtocolDocText(text)
}

const loadConfigDetail = (messageProtocol: string, transportProtocol: string) => {
  if (!messageProtocol || !transportProtocol) return
  getConfigView(messageProtocol, transportProtocol).then((resp: any) => {
    if (resp.status === 200) {
      config.value = resp.result
      handleColumns()
      refreshMarkdownDocument()
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
  principalList.value = []
  compositeActive.value = []
  compositeActiveAddress.value = []
  try {
    const inst = instanceStore.current
    await loadPrincipal(inst?.id)
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

watch(
  () => principalList.value,
  () => {
    if (config.value?.document) {
      refreshMarkdownDocument()
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

/* 协议说明内「点击复制」：由 data-copy / copy-content 标记 */
.access-guide-doc__body :deep([data-copy]),
.access-guide-doc__body :deep([copy-content]) {
  cursor: pointer;
  color: @primary-color;
  text-decoration: underline dotted;
  text-underline-offset: 2px;
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
