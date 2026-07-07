<template>
  <div
    class="device-detail-page-wrap"
    :class="{ 'device-detail-page-wrap--tab-skeleton': detailPageLoading }"
  >
  <j-page-container
    :tabList="pageContainerTabList"
    :showBack="false"
    :tabActiveKey="pageContainerTabActiveKey"
    @tabChange="onTabChange"
  >
    <template #title>
      <DeviceDetailFishboneSkeleton v-if="detailPageLoading" mode="title" />
      <div v-else class="device-detail-title-row">
        <div class="device-detail-title-main">
          <div class="device-detail-name-wrap">
            <button
              type="button"
              class="device-detail-avatar-btn"
              @click="handleEditInstance"
            >
              <img
                class="device-detail-avatar-img"
                :src="avatarSrc"
                alt=""
                @error="avatarError = true"
              />
              <span
                class="device-detail-avatar-edit-mask"
                aria-hidden="true"
              >
                <AIcon type="EditOutlined" />
              </span>
            </button>
            <a-tooltip
              v-if="!isEditingName"
              :title="instanceStore.current?.name"
            >
              <div class="deviceDetailHead">
                {{ instanceStore.current?.name }}
              </div>
            </a-tooltip>
            <div
              v-else
              ref="nameEditorRef"
              class="deviceDetailHead deviceDetailHead--editable"
              contenteditable="true"
              @input="onNameInput"
              @keydown.enter.prevent="handleSaveName"
            ></div>
            <a-button
              v-if="isEditingName"
              type="text"
              size="small"
              class="device-detail-name-action"
              :loading="savingName"
              :title="$t('Detail.index.957187-33')"
              @click="handleSaveName"
            >
              <template #icon>
                <AIcon type="CheckOutlined" />
              </template>
            </a-button>
            <a-tooltip
              v-else-if="permissionStore.hasPermission('device/Instance:update')"
              :title="$t('Detail.index.957187-34')"
            >
              <a-button
                type="text"
                size="small"
                class="device-detail-name-action"
                @click="handleEditName"
              >
                <template #icon>
                  <AIcon type="EditOutlined" />
                </template>
              </a-button>
            </a-tooltip>
            <span
              class="device-detail-meta__sep device-detail-name-status-sep"
              aria-hidden="true"
            >·</span>
            <span class="device-detail-status-inline">
              <span class="device-detail-status-text">
                {{ $t('Detail.index.957187-0') }}
                <a-badge :status="statusMap.get(instanceStore.current?.state?.value)" />
                {{ instanceStore.current?.state?.text }}
              </span>
              <slot
                v-if="instanceStore.current?.state?.value === 'notActive'"
                name="activeDevice"
              ></slot>
              <j-permission-button
                v-if="instanceStore.current?.state?.value === 'notActive' && !slots.activeDevice"
                type="link"
                class="device-detail-inline-action"
                :popConfirm="{
                  title: $t('Detail.index.957187-1'),
                  onConfirm: handleAction
                }"
                hasPermission="device/Instance:action"
              >
                {{ $t('Detail.index.957187-2') }}
              </j-permission-button>
              <slot
                v-if="instanceStore.current?.state?.value === 'online'"
                name="activeDevice"
              ></slot>
              <j-permission-button
                v-if="instanceStore.current?.state?.value === 'online' && !slots.disconnect"
                type="link"
                class="device-detail-inline-action"
                :popConfirm="{
                  title: $t('Detail.index.957187-3'),
                  onConfirm: handleDisconnect
                }"
                hasPermission="device/Instance:action"
              >
                {{ $t('Detail.index.957187-4') }}
              </j-permission-button>
              <a-tooltip
                v-if="
                  instanceStore.current?.accessProvider === 'child-device' &&
                  instanceStore.current?.state?.value === 'offline'
                "
                :title="
                  instanceStore.current?.features?.find((item) => item?.id === 'selfManageState')
                    ? $t('Detail.index.957187-7')
                    : $t('Detail.index.957187-8')
                "
              >
                <AIcon
                  type="QuestionCircleOutlined"
                  class="device-detail-offline-hint-icon"
                />
              </a-tooltip>
            </span>
          </div>
          <div class="device-detail-meta">
            <span class="device-detail-meta__label">ID</span>
            <a-tooltip :title="$t('Detail.index.957187-35')">
              <span
                class="device-detail-meta__id-text device-detail-meta__id-text--copy"
                @click="handleCopyId"
              >
                {{ instanceStore.current?.id }}
              </span>
            </a-tooltip>
            <span
              class="device-detail-meta__sep"
              aria-hidden="true"
            >·</span>
            <span class="device-detail-meta__product">
              <slot name="productName"></slot>
              <j-permission-button
                v-if="!slots.productName"
                type="link"
                class="device-detail-meta__product-link"
                @click="jumpProduct"
                hasPermission="device/Product:view"
              >
                <j-ellipsis>{{ instanceStore.current?.productName }}</j-ellipsis>
              </j-permission-button>
            </span>
            <template v-if="deviceTags.length">
              <span
                class="device-detail-meta__sep"
                aria-hidden="true"
              >·</span>
              <div class="device-detail-meta__tags-inline">
                <a-tooltip
                  v-for="(tag, idx) in visibleTags"
                  :key="tag.key ?? `tag-${idx}`"
                  :title="formatTagTooltipValueOnly(tag)"
                >
                  <a-tag
                    :class="[
                      'device-detail-meta__tag-chip',
                      { 'device-detail-meta__tag-chip--empty': isTagValueEmpty(tag) }
                    ]"
                    size="small"
                    @click.stop="handleCopyTagValue(tag)"
                  >
                    <span class="device-detail-meta__tag-text">{{ formatTagLine(tag) }}</span>
                  </a-tag>
                </a-tooltip>
                <a-popover
                  v-if="deviceTags.length > TAG_PREVIEW_COUNT"
                  v-model:open="tagsPopoverOpen"
                  trigger="click"
                  placement="bottomRight"
                  :overlayStyle="{ zIndex: 2001 }"
                  :overlayInnerStyle="{ padding: '8px', maxWidth: 'min(520px, 92vw)' }"
                  overlayClassName="device-detail-tags-popover"
                  destroyTooltipOnHide
                >
                  <template #content>
                    <div class="device-detail-tags-popover-inner">
                      <a-tooltip
                        v-for="(tag, idx) in moreTags"
                        :key="tag.key ?? `tag-more-${idx}`"
                        :title="formatTagTooltipValueOnly(tag)"
                      >
                        <a-tag
                          :class="[
                            'device-detail-meta__tag-chip',
                            { 'device-detail-meta__tag-chip--empty': isTagValueEmpty(tag) }
                          ]"
                          size="small"
                          @click.stop="handleCopyTagValue(tag)"
                        >
                          <span class="device-detail-meta__tag-text">{{
                            formatTagLine(tag)
                          }}</span>
                        </a-tag>
                      </a-tooltip>
                    </div>
                  </template>
                  <button
                    type="button"
                    class="device-detail-meta__tags-expand-btn"
                    aria-label="expand-tags"
                  >
                    <AIcon
                      type="DownOutlined"
                      :class="{
                        'device-detail-meta__tags-expand-caret--open': tagsPopoverOpen
                      }"
                    />
                  </button>
                </a-popover>
                <j-permission-button
                  v-if="deviceTags.length"
                  type="text"
                  class="device-detail-meta__tags-edit"
                  hasPermission="device/Instance:update"
                  :title="$t('Detail.index.957187-40')"
                  @click="() => { tagsPanelVisible = true; tagsPopoverOpen = false }"
                >
                  <template #icon>
                    <AIcon type="EditOutlined" />
                  </template>
                </j-permission-button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </template>
    <template #extra>
      <div v-if="detailPageLoading" class="device-detail-extra-skeleton">
        <div class="device-detail-extra-skeleton__btn" />
        <div class="device-detail-extra-skeleton__icon" />
      </div>
      <a-space v-else>
        <a-button
          @click="onClick"
          v-if="_arr.includes(instanceStore.current?.accessProvider || '') && userStore.isAdmin"
          type="primary"
          :disabled="instanceStore.current?.state?.value !== 'online'"
        >
          {{ $t('Detail.index.957187-10') }}
        </a-button>

        <a-tooltip :title="$t('Detail.index.957187-30')">
          <img
            @click="handleRefresh"
            :src="device.button"
            style="margin-right: 20px; cursor: pointer"
            alt=""
          />
        </a-tooltip>
      </a-space>
    </template>
  <PhotoSave
    v-if="photoPanelVisible"
    :data="instanceStore.current"
    :imageSrc="photoTempSrc"
    @close="photoPanelVisible = false"
    @save="handlePhotoPanelSaved"
  />
  <input
    ref="photoFileInputRef"
    class="device-photo-file-input"
    type="file"
    accept="image/jpeg,image/png"
    @change="handlePhotoFileSelected"
  />
    <full-page>
      <div v-if="detailPageLoading" class="device-detail-content-wrap device-detail-content-wrap--skeleton">
        <DeviceDetailFishboneSkeleton mode="page" />
      </div>
      <div
        v-else
        :style="contentStyle"
        class="device-detail-content-wrap"
      >
        <RegistryComponent
          code="detail-tabs"
          :activeKey="instanceStore.tabActiveKey"
        >
          <component
            ref="componentRef"
            :key="instanceStore.tabActiveKey"
            :is="tabs[instanceStore.tabActiveKey]"
            v-bind="{ type: 'device', isRefresh: isRefresh }"
            @onJump="onTabChange"
          />
        </RegistryComponent>
      </div>
    </full-page>
  </j-page-container>
  </div>
  <TagsSave
    v-if="tagsPanelVisible"
    @close="tagsPanelVisible = false"
    @save="handleTagsPanelSave"
  />
</template>

<script lang="ts" setup>
import TagsSave from './Info/components/Tags/Save.vue'
import PhotoSave from './PhotoSave.vue'
import DeviceDetailFishboneSkeleton from './DeviceDetailFishboneSkeleton.vue'
import { useInstanceStore } from '../../../../store/instance'
import { _deploy, _disconnect, modifyByDeviceId } from '../../../../api/instance'
import { getBase64ByImg, onlyMessage } from '@jetlinks-web/utils'
import { getFileUrlById } from '@jetlinks-web-core/api/comm'
import { openEdgeUrl, isNoCommunity } from '@jetlinks-web-core/utils/utils'
import { wsClient } from '@jetlinks-web/core'
import { useRouterParams } from '@jetlinks-web/hooks'
import { EventEmitter } from '@jetlinks-web/utils'
import { useSystemStore, useMenuStore, useAuthStore, useAIStore, useUserStore } from '@jetlinks-web-core/store'
import { device } from '../../../../assets'
import { useI18n } from 'vue-i18n'
import { tabs } from './asyncComponent'
import { useRegistryOptions } from '@jetlinks-web-core/hooks'

import { deviceStateList } from '@device-manager-ui/views/device/data'
import { isApplyDashboard } from '@device-manager-ui/utils/dashboardProject'
import { createDeviceDetailClientToolRuntime } from './clientTools'
import {
  EDGE_DIAGNOSIS_SYSTEM_PROMPT_LINES,
  EDGE_DIAGNOSIS_WORKFLOW_GUIDES,
  buildEdgeDiagnosisClientToolsDescription,
  isEdgeDiagnosisToolId
} from './agentDiagnosisManual'
import { isEdgeDiagnosisAccessProvider } from './edgeDiagnosisTool'
import type {
  AgentConversationMarkdownLinkHandler,
  AgentConversationWorkflowGuide,
} from '@jetlinks-ai-agent-ui/components/AgentConversation/types'

const { t: $t } = useI18n()
const menuStory = useMenuStore()
const userStore = useUserStore()
const { showThreshold } = useSystemStore()
const route = useRoute()
const routerParams = useRouterParams()
const instanceStore = useInstanceStore()
const slots = useSlots()

const statusMap = new Map()

statusMap.set('online', 'success')
statusMap.set('offline', 'error')
statusMap.set('notActive', 'warning')

const statusTextMap = new Map()
statusTextMap.set('online', $t('DashBoard.index.954313-11'))
statusTextMap.set('offline', $t('DashBoard.index.954313-12'))
statusTextMap.set('notActive', $t('DashBoard.index.954313-10'))

const statusRef = ref()
const componentRef = ref()
const isEditingName = ref(false)
const savingName = ref(false)
const editableName = ref('')
const nameEditorRef = ref<HTMLElement>()
const photoPanelVisible = ref(false)
const photoTempSrc = ref<string | undefined>(undefined)
const photoFileInputRef = ref<HTMLInputElement | null>(null)
const avatarError = ref(false)

const TAG_PREVIEW_COUNT = 3
const tagsPopoverOpen = ref(false)
const tagsPanelVisible = ref(false)
/** 首屏详情未返回前展示鱼骨骨架屏 */
const detailPageLoading = ref(true)

/** 详情加载完成前 Tab 项未知：用占位 key + 鱼骨样式代替真实标签 */
const SKELETON_TAB_COUNT = 12
const SKELETON_TAB_FIRST_KEY = '__deviceDetailSkTab0'
const skeletonTabList = Array.from({ length: SKELETON_TAB_COUNT }, (_, i) => ({
  key: `__deviceDetailSkTab${i}`,
  /** 占位，实际由 CSS 显示为闪烁条 */
  tab: '\u00A0'
}))

const deviceTags = computed(() => {
  const t = instanceStore.current?.tags
  return Array.isArray(t) && t.length ? t : []
})

const avatarSrc = computed(() => {
  if (avatarError.value) return device.deviceCard
  const raw = instanceStore.current?.photoUrl || (instanceStore.current as any)?.devicePhotoUrl
  if (!raw) return device.deviceCard

  // photoUrl 通常保存的是 fileId；当它不是可访问URL/数据串时，转换为可访问地址
  if (typeof raw === 'string' && (raw.startsWith('http') || raw.startsWith('data:') || raw.startsWith('/'))) {
    return raw
  }
  return getFileUrlById(String(raw))
})

const visibleTags = computed(() => {
  return deviceTags.value.slice(0, TAG_PREVIEW_COUNT)
})

const moreTags = computed(() => {
  if (deviceTags.value.length <= TAG_PREVIEW_COUNT) return []
  return deviceTags.value.slice(TAG_PREVIEW_COUNT)
})

const hiddenTagCount = computed(() =>
  Math.max(0, deviceTags.value.length - TAG_PREVIEW_COUNT)
)

/** 与实例信息 Tab 中标签展示逻辑一致，便于用户对照 */
const formatTagValue = (item: Record<string, any>) => {
  let name: string | undefined
  if (item.dataType) {
    let arr = item.dataType?.elements || []
    if (item.dataType?.type === 'boolean') {
      arr = [
        { text: item.dataType.trueText, value: item.dataType.trueValue },
        { text: item.dataType.falseText, value: item.dataType.falseValue }
      ]
    }
    const el = arr?.find((a: any) => a.value === item.value)
    name = el?.text
  }
  return name ?? item.formatValue ?? item.value
}

const isTagValueEmpty = (item: Record<string, any>) => {
  const v = formatTagValue(item)
  if (v === undefined || v === null) return true
  if (typeof v === 'string' && v.trim() === '') return true
  return false
}

const formatTagLine = (item: Record<string, any>) => {
  const label = item.name || item.key || ''
  if (isTagValueEmpty(item)) {
    return `${label}（${$t('Detail.index.957187-39')}）`
  }
  return `${label}：${formatTagValue(item)}`
}

/** hover：仅展示值（空时展示「未设置」），不含标签标识 */
const formatTagTooltipValueOnly = (item: Record<string, any>) => {
  if (isTagValueEmpty(item)) return $t('Detail.index.957187-39')
  const v = formatTagValue(item)
  if (v !== null && typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

const copyClipboardText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    onlyMessage($t('Detail.index.957187-36'))
  } catch (e) {
    const input = document.createElement('textarea')
    input.value = text
    input.style.position = 'fixed'
    input.style.opacity = '0'
    document.body.appendChild(input)
    input.focus()
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    onlyMessage($t('Detail.index.957187-36'))
  }
}

const handleCopyTagValue = (item: Record<string, any>) => {
  void copyClipboardText(formatTagTooltipValueOnly(item))
}

const handleEditInstance = () => {
  tagsPopoverOpen.value = false
  tagsPanelVisible.value = false
  photoTempSrc.value = undefined
  // 先触发文件选择；真正打开编辑弹窗由选择完成后触发
  photoFileInputRef.value?.click()
}

const handlePhotoPanelSaved = () => {
  photoPanelVisible.value = false
  photoTempSrc.value = undefined
  if (instanceStore.current?.id) {
    avatarError.value = false
    instanceStore.refresh(instanceStore.current?.id)
  }
}

const handlePhotoFileSelected = (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  // 清空 input，确保同一文件可以重复触发 change
  input.value = ''
  if (!file) return

  getBase64ByImg(file, (base64Url: string) => {
    avatarError.value = false
    photoTempSrc.value = base64Url
    photoPanelVisible.value = true
  })
}

const handleTagsPanelSave = () => {
  tagsPanelVisible.value = false
  if (instanceStore.current?.id) {
    instanceStore.refresh(instanceStore.current.id)
  }
}

const initList = [
  {
    key: 'Info',
    tab: $t('Detail.index.957187-11')
  },
  {
    key: 'Running',
    tab: $t('Detail.index.957187-12')
  },
  {
    key: 'Metadata',
    tab: $t('Detail.index.957187-13')
  },
  {
    key: 'Function',
    tab: $t('Detail.index.957187-14')
  },
  {
    key: 'Log',
    tab: $t('Detail.index.957187-15')
  },
  {
    key: 'DeviceRelationship',
    tab: $t('Detail.index.957187-31')
  },
  {
    key: 'DeviceDocument',
    tab: $t('Detail.index.957187-43')
  }
]

const list = ref([...initList])
const isRefresh = ref(false)
const aiStore = useAIStore()
const permissionStore = useAuthStore()
const { mergedOptions } = useRegistryOptions({ baseOptions: list, code: 'detail-tabs' })
const DEVICE_DETAIL_AGENT_CLIENT_ID = 'deviceDetailChat'
const DEVICE_AGENT_SUBJECT_TYPE = 'device'
const DEVICE_DETAIL_AGENT_SYSTEM_PROMPT_LINES = [
  '你是设备详情页内的设备问数与诊断助手。',
  '当前会话的 subject 就是页面打开的设备，已通过 subjectType=device、subjectId、deviceId 和 deviceName 提供；用户没有明确要求其它设备时，不要再追问设备 ID。',
  '当前会话可通过客户端工具读取该设备的状态、运行数据、告警、日志、接入、文档、功能和调试证据。',
  '涉及抓包、实时链路、上报/下发报文、连接或认证复现场景时，先启动抓包窗口；需要触发下发、重连或上报时，应让抓包与触发动作并行，至少保证抓包已开始后再触发，不要事后抓包。',
  '多步骤诊断可以先用一句业务侧说明承接，例如“我会先确认设备状态、近期数据和异常记录，再给出判断与建议。”',
  '下一步建议可以输出 Markdown 链接，例如 [查看今日告警](#prompt=查看今日告警)，让用户一键填充到输入框。',
  '设备告警中，当前状态来自告警记录，触发次数和历史时间线来自告警日志。',
  '用户明确要求选择其它设备、按条件挑设备或跨设备对比时，可使用设备选择能力；未明确要求时仍使用当前 subject 设备。'
]
const deviceDetailClientToolRuntime = createDeviceDetailClientToolRuntime(() => instanceStore.current || {})

const DEVICE_DETAIL_AGENT_WORKFLOW_GUIDES: AgentConversationWorkflowGuide[] = [
  {
    id: 'device-today-operation',
    name: '今日运行分析',
    description: '分析设备今天是否运行正常，覆盖告警、上下线、关键属性最新值和趋势。',
    scenarios: ['分析今日运行情况', '是否正常', '全面检查', '帮我看看', '最近状态'],
    keywords: ['今日', '今天', '运行', '正常', '全面', '状态', '分析'],
    priority: 100,
    steps: [
      {
        title: '识别关键运行指标',
        description: '根据设备属性定义的名称、标识、说明和数据类型识别本设备已有的关键运行指标；不要预设固定字段，只保留实际匹配到的属性。',
        tools: ['device_metadata_markdown', 'device_metadata_search'],
        inputs: { section: 'properties' },
      },
      {
        title: '查询今日平台告警',
        tools: ['device_alarm_records_query'],
        inputs: { timeRange: '今天' },
      },
      {
        title: '统计今日告警触发历史',
        tools: ['device_alarm_history_summary'],
        inputs: { timeRange: '今天' },
      },
      {
        title: '统计今日上下线',
        tools: ['device_online_offline_summary'],
        inputs: { timeRange: '今天', type: 'both' },
      },
      {
        title: '读取关键属性最新值',
        description: '对已匹配属性直接批量读取；没有匹配到运行指标时说明当前设备未暴露相关属性。',
        tools: ['device_latest_properties'],
        inputs: { propertyIds: 'matched-property-ids' },
      },
      {
        title: '按需查看趋势',
        description: '用户问“今日运行/是否正常”时，优先对已匹配的数值型指标按小时聚合，趋势不足时说明数据限制。',
        tools: ['device_property_aggregate'],
        inputs: { propertyIds: 'matched-property-ids', timeRange: '今天', interval: '1h' },
      },
    ],
    output: ['已验证事实', '异常迹象', '建议动作', '无法确认的限制'],
    notes: ['不要让用户先选择属性；不要把属性候选列表当最终答案。'],
  },
  {
    id: 'device-offline-diagnosis',
    name: '离线原因分析',
    description: '设备离线时，按接入配置、上下线记录、日志、告警和链路样本排查原因。',
    scenarios: ['分析离线原因', '为什么离线', '设备不上线', '连接失败', '认证失败'],
    keywords: ['离线', '下线', '不上线', '连接失败', '认证失败', '断开'],
    priority: 90,
    steps: [
      {
        title: '获取接入配置和会话证据',
        tools: ['device_access_summary'],
      },
      {
        title: '统计最近上下线',
        tools: ['device_online_offline_summary'],
        inputs: { timeRange: '最近24小时', type: 'both' },
      },
      {
        title: '查看最近通信日志',
        tools: ['device_logs_summary'],
        inputs: { timeRange: '最近24小时' },
      },
      {
        title: '查询平台告警',
        tools: ['device_alarm_records_query', 'device_alarm_history_summary'],
        inputs: { timeRange: '最近24小时' },
      },
      {
        title: '需要链路细节时先启动实时抓包',
        tools: ['device_trace_capture'],
        tips: ['只有需要连接、认证、上报、下发、编解码证据时再使用。抓包必须先开始；若还要重连、下发或等待上报，应在抓包窗口内并行触发。'],
      },
    ],
    output: ['最可能原因', '已验证证据', '下一步处理动作', '仍需现场确认的信息'],
  },
  {
    id: 'device-trace-diagnosis',
    name: '抓包链路分析',
    description: '分析实时链路、上下行报文、下发后响应、连接认证和编解码异常。',
    scenarios: ['抓包分析', '看报文', '分析上报报文', '下发后有没有响应', '编解码失败', '认证报文', '链路诊断'],
    keywords: ['抓包', '报文', '链路', '上报', '下发', '响应', '编解码', '认证', 'trace'],
    priority: 95,
    steps: [
      {
        title: '先启动抓包窗口',
        description: '抓包是实时窗口。先启动 device_trace_capture，再在窗口内触发下发、重连、认证复现或等待设备上报；不要先触发动作再抓包。',
        tools: ['device_trace_capture'],
        inputs: { seconds: '按用户场景选择，默认5秒；复现较慢可增加到10-15秒', maxEvents: '高频场景可调大' },
      },
      {
        title: '并行触发或等待业务动作',
        description: '如果用户要求观察下发、功能调用、重连或上报，应在抓包已开始后并行触发对应动作；需要用户或设备侧操作时，先说明请在抓包窗口内操作。',
        tools: ['device_function_invoke', 'device_access_summary'],
      },
      {
        title: '整理抓包结果',
        description: '优先使用工具返回的统计、去重摘要、topSignatures 和代表样本判断方向；大量事件已写入文件时，再按 inputPath 做二次过滤或聚合。',
        tools: ['device_trace_capture'],
      },
    ],
    output: ['抓到的通信概况', '上下行方向和关键报文', '重复/高频模式', '异常或缺失环节', '下一步复现建议'],
    notes: ['device_trace_capture 会自动统计和按语义去重；不要把所有原始报文逐条复述给用户。'],
  },
  {
    id: 'device-bring-online',
    name: '上线接入指导',
    description: '回答如何让设备上线、接入地址、认证字段、协议说明和首次上线检查。',
    scenarios: ['如何让设备上线', '设备怎么接入', '接入地址是什么', '认证字段', '首次上线'],
    keywords: ['上线', '接入', '地址', '认证', '协议', '首次'],
    priority: 80,
    steps: [
      {
        title: '获取接入配置',
        tools: ['device_access_summary'],
      },
      {
        title: '查找接入文档',
        tools: ['device_documents_query', 'device_document_reference'],
      },
      {
        title: '结合最近上线/离线和日志判断是否已尝试接入',
        tools: ['device_online_offline_summary', 'device_logs_summary'],
        inputs: { timeRange: '最近24小时' },
      },
    ],
    output: ['接入地址与认证要点', '上线前检查项', '如果仍不上线的排查顺序'],
  },
  {
    id: 'device-property-trend',
    name: '属性趋势分析',
    description: '分析用户指定或设备属性定义中匹配到的指标趋势。',
    scenarios: ['分析属性趋势', '运行指标趋势', '使用率情况', '状态趋势'],
    keywords: ['属性', '趋势', '指标', '使用率', '变化', '统计'],
    priority: 70,
    steps: [
      {
        title: '确认属性标识',
        tools: ['device_metadata_search', 'device_metadata_markdown'],
      },
      {
        title: '读取最新值',
        tools: ['device_latest_properties'],
        inputs: { propertyIds: 'matched-property-ids' },
      },
      {
        title: '聚合趋势',
        description: '导出或生成趋势图时，也先用该工具完成聚合取数；需要完整数据时传 writeToPath，之后仅在二次加工或渲染图片时使用数据集/图表工具。',
        tools: ['device_property_aggregate'],
        inputs: { propertyIds: 'matched-property-ids', timeRange: 'user-time-range-or-今天' },
      },
    ],
    output: ['最新值', '趋势变化', '峰值/均值/低值', '数据缺口'],
  },
  {
    id: 'device-alarm-diagnosis',
    name: '告警排查',
    description: '当前告警状态看平台告警记录；触发次数和历史时间线看告警日志，再用通信日志、属性或上下线记录佐证。',
    scenarios: ['查看今日告警', '有没有告警', '告警原因', '报警中吗', '异常恢复', '告警触发几次', '告警历史数量'],
    keywords: ['告警', '报警', '异常', '恢复', 'warning'],
    priority: 75,
    steps: [
      {
        title: '查询平台告警记录',
        tools: ['device_alarm_records_query'],
        inputs: { timeRange: 'user-time-range-or-今天' },
      },
      {
        title: '统计告警日志触发历史',
        tools: ['device_alarm_history_summary'],
        inputs: { timeRange: 'same-as-alarm-query' },
      },
      {
        title: '补充通信和上下线证据',
        tools: ['device_logs_summary', 'device_online_offline_summary'],
        inputs: { timeRange: 'same-as-alarm-query' },
      },
      {
        title: '必要时查询相关属性或事件',
        tools: ['device_metadata_search', 'device_property_history_summary', 'device_event_history_query'],
      },
    ],
    output: ['告警状态', '触发次数', '触发原因', '恢复情况', '建议处理动作'],
    notes: ['单个告警只会保留一条告警记录；历史触发次数必须来自告警日志。设备属性、事件或通信日志只能作为补充解释。'],
  },
]

const normalizeDeviceAgentTabAliasKey = (value?: string) => (
  String(value || '').trim().replace(/[\s_-]+/g, '').toLowerCase()
)
const DEVICE_AGENT_TAB_ALIASES: Record<string, string> = {
  info: 'Info',
  instanceinfo: 'Info',
  detail: 'Info',
  详情: 'Info',
  实例信息: 'Info',
  running: 'Running',
  status: 'Running',
  property: 'Running',
  properties: 'Running',
  运行状态: 'Running',
  属性: 'Running',
  metadata: 'Metadata',
  thingmodel: 'Metadata',
  物模型: 'Metadata',
  function: 'Function',
  functions: 'Function',
  devicefunction: 'Function',
  设备功能: 'Function',
  log: 'Log',
  logs: 'Log',
  日志: 'Log',
  日志管理: 'Log',
  alarm: 'AlarmRecord',
  alarms: 'AlarmRecord',
  alarmrecord: 'AlarmRecord',
  告警: 'AlarmRecord',
  告警记录: 'AlarmRecord',
  deviceaccess: 'Diagnose',
  access: 'Diagnose',
  diagnose: 'Diagnose',
  设备接入: 'Diagnose',
  device_document: 'DeviceDocument',
  devicedocument: 'DeviceDocument',
  document: 'DeviceDocument',
  documents: 'DeviceDocument',
  设备文档: 'DeviceDocument',
  文档: 'DeviceDocument',
  devicerelationship: 'DeviceRelationship',
  relationship: 'DeviceRelationship',
  relation: 'DeviceRelationship',
  设备关系: 'DeviceRelationship',
  invalid: 'Invalid',
  invaliddata: 'Invalid',
  无效数据: 'Invalid',
  threshold: 'Threshold',
  thresholdconfig: 'Threshold',
  阈值配置: 'Threshold',
  dashboard: 'Dashboard',
  仪表盘: 'Dashboard',
  child: 'Child',
  childdevice: 'ChildDevice',
  子设备: 'ChildDevice',
  parsing: 'Parsing',
  数据解析: 'Parsing',
  metadatamap: 'MetadataMap',
  物模型映射: 'MetadataMap',
  terminal: 'Terminal',
  远程调试: 'Terminal',
  shadow: 'Shadow',
  设备影子: 'Shadow',
  firmware: 'Firmware',
  远程升级: 'Firmware',
}
const DEVICE_AGENT_KNOWN_TABS = new Set(Object.values(DEVICE_AGENT_TAB_ALIASES))

const isDeviceRemoteFileSupported = () => (
  isEdgeDiagnosisAccessProvider(instanceStore.current?.accessProvider)
)

const getDeviceAgentVisibleTabs = () => {
  const source = (orderedOptions as any)?.value || []
  return (Array.isArray(source) ? source : [])
    .filter((item: any) => item?.key && item.key !== 'Info' && tabs[item.key as keyof typeof tabs])
    .map((item: any) => ({
      key: String(item.key),
      label: String(item.tab || item.label || item.title || item.key),
    }))
}

const isDeviceAgentExistingTab = (tabKey?: string) => {
  if (!tabKey) return false
  return getDeviceAgentVisibleTabs().some((item) => item.key === tabKey)
}

const resolveDeviceAgentCurrentTabByLabel = (value?: string) => {
  const normalized = normalizeDeviceAgentTabAliasKey(value)
  if (!normalized) return ''
  return getDeviceAgentVisibleTabs().find((item) => (
    normalizeDeviceAgentTabAliasKey(item.key) === normalized
    || normalizeDeviceAgentTabAliasKey(item.label) === normalized
  ))?.key || ''
}

const normalizeDeviceAgentTabKey = (value?: string) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const normalized = normalizeDeviceAgentTabAliasKey(raw)
  return DEVICE_AGENT_TAB_ALIASES[normalized] || resolveDeviceAgentCurrentTabByLabel(raw) || raw
}

const buildDeviceDetailAgentTabPrompt = () => {
  const visibleTabs = getDeviceAgentVisibleTabs()
  const links = visibleTabs
    .map((item) => `[${item.label}](#tab=${encodeURIComponent(item.key)})`)
    .join('、')

  return links
    ? `当前设备详情页可跳转的一级选项卡：${links}。未列出的选项卡表示当前账号、设备类型或版本暂不支持直接跳转。`
    : '当前设备详情页暂未加载出可跳转选项卡；如需引导用户查看页面数据，应先说明暂不可确认页面选项卡。'
}

const buildDeviceDetailAgentSystemPrompt = () => {
  const lines = [...DEVICE_DETAIL_AGENT_SYSTEM_PROMPT_LINES]
  if (isDeviceRemoteFileSupported()) {
    lines.splice(lines.length - 1, 0, '当前设备支持边缘网关边端运行态、MBean 白名单、线程摘要、系统文件只读片段和云边协同只读诊断能力。')
    lines.splice(lines.length - 1, 0, ...EDGE_DIAGNOSIS_SYSTEM_PROMPT_LINES)
  } else {
    lines.splice(lines.length - 1, 0, '当前设备未暴露边缘网关边端运行态、MBean、线程摘要、系统文件只读片段和云边协同诊断能力，相关入口暂不可用。')
  }
  lines.splice(lines.length - 1, 0, buildDeviceDetailAgentTabPrompt())
  return lines.join('\n')
}

const getDeviceDetailClientTools = () => {
  const tools = deviceDetailClientToolRuntime.clientTools || []
  const withoutLegacyEdgeRemoteFileTools = tools.filter((tool: any) => {
    const toolId = String(tool?.id || tool?.name || '')
    return !toolId.startsWith('edge_remote_file_')
  })
  if (isDeviceRemoteFileSupported()) return withoutLegacyEdgeRemoteFileTools
  return withoutLegacyEdgeRemoteFileTools.filter((tool: any) => {
    const toolId = String(tool?.id || tool?.name || '')
    return !isEdgeDiagnosisToolId(toolId)
  })
}

const getDeviceDetailWorkflowGuides = () => {
  return isDeviceRemoteFileSupported()
    ? [...DEVICE_DETAIL_AGENT_WORKFLOW_GUIDES, ...EDGE_DIAGNOSIS_WORKFLOW_GUIDES]
    : DEVICE_DETAIL_AGENT_WORKFLOW_GUIDES
}

const buildDeviceDetailClientToolsDescription = () => {
  const remoteText = isDeviceRemoteFileSupported()
    ? buildEdgeDiagnosisClientToolsDescription(true)
    : buildEdgeDiagnosisClientToolsDescription(false)
  return [
    '设备详情页提供当前设备的状态、接入、模型字段、属性、事件、文档、告警记录、告警日志、上下线、通信日志和链路样本工具。',
    remoteText,
    isDeviceRemoteFileSupported()
      ? '当前设备是边缘网关时，用户提出诊断、分析、排查、健康、稳定、异常原因、离线抖动、消息积压、日志或 JVM 类问题，应先按云边协同诊断流程取证，再结合平台侧证据回答；CPU、线程、JVM 和积压问题不要从边端文件读取开始。'
      : '宽泛、多步骤或排障类问题可结合工作流指导选择工具。',
    '当前设备默认来自 subject；设备选择能力用于其它设备或跨设备对比。',
    '用户说获取、读取或查询某项设备信息时，先判断数据来源：平台已有的属性、历史、事件、日志、告警和文档走对应查询工具；若该信息命中物模型功能且需要设备返回结果，则通过功能调用工具在确认后获取，不要只解释模型里存在该功能。',
    '抓包、实时链路、上报/下发报文、连接或认证复现场景必须先启动抓包；需要触发下发、重连或上报时，在抓包窗口内并行触发，不要事后抓包。device_trace_capture 会自动返回统计、语义去重摘要和代表样本。',
    '明细较大、导出、报告或图表可由设备业务工具写入会话文件，数据集工具适合已写入文件后的二次加工。'
  ].join('\n')
}

const deviceDetailAgentPromptConfigs = {
  edgeOnline: {
    opening: 'DeviceDetail.agent.opening.edgeOnline',
    prompts: [
      'DeviceDetail.agent.prompt.edge.online.health',
      'DeviceDetail.agent.prompt.edge.online.connection',
      'DeviceDetail.agent.prompt.edge.online.logs'
    ]
  },
  edgeOffline: {
    opening: 'DeviceDetail.agent.opening.edgeOffline',
    prompts: [
      'DeviceDetail.agent.prompt.edge.offline.reason',
      'DeviceDetail.agent.prompt.edge.offline.connection',
      'DeviceDetail.agent.prompt.edge.offline.logs'
    ]
  },
  edgeDefault: {
    opening: 'DeviceDetail.agent.opening.edgeDefault',
    prompts: [
      'DeviceDetail.agent.prompt.edge.default.health',
      'DeviceDetail.agent.prompt.edge.default.backlog',
      'DeviceDetail.agent.prompt.edge.default.logs'
    ]
  },
  online: {
    opening: 'DeviceDetail.agent.opening.online',
    prompts: [
      'DeviceDetail.agent.prompt.online.todayStatus',
      'DeviceDetail.agent.prompt.online.alarm',
      'DeviceDetail.agent.prompt.online.propertyTrend'
    ]
  },
  offline: {
    opening: 'DeviceDetail.agent.opening.offline',
    prompts: [
      'DeviceDetail.agent.prompt.offline.bringOnline',
      'DeviceDetail.agent.prompt.offline.reason',
      'DeviceDetail.agent.prompt.offline.history'
    ]
  },
  notActive: {
    opening: 'DeviceDetail.agent.opening.notActive',
    prompts: [
      'DeviceDetail.agent.prompt.notActive.activate',
      'DeviceDetail.agent.prompt.notActive.accessConfig',
      'DeviceDetail.agent.prompt.notActive.firstOnline'
    ]
  },
  default: {
    opening: 'DeviceDetail.agent.opening.default',
    prompts: [
      'DeviceDetail.agent.prompt.default.status',
      'DeviceDetail.agent.prompt.default.alarm',
      'DeviceDetail.agent.prompt.default.accessConfig'
    ]
  }
} as const

const getDeviceDetailAgentPromptConfig = () => {
  const state = String(instanceStore.current?.state?.value || '')
  if (isDeviceRemoteFileSupported()) {
    if (state === 'online') return deviceDetailAgentPromptConfigs.edgeOnline
    if (state === 'offline') return deviceDetailAgentPromptConfigs.edgeOffline
    return deviceDetailAgentPromptConfigs.edgeDefault
  }
  if (state === 'online' || state === 'offline' || state === 'notActive') {
    return deviceDetailAgentPromptConfigs[state]
  }
  return deviceDetailAgentPromptConfigs.default
}

const buildDeviceDetailAgentOpeningStatement = () => {
  return $t(getDeviceDetailAgentPromptConfig().opening)
}

const buildDeviceDetailAgentPromptExamples = () => {
  return getDeviceDetailAgentPromptConfig().prompts.map((key) => $t(key))
}

const buildDeviceDetailAgentParameters = () => {
  const deviceId = instanceStore.current?.id
  if (!deviceId) return undefined

  const deviceName = instanceStore.current?.name
  return {
    deviceId,
    subjectType: DEVICE_AGENT_SUBJECT_TYPE,
    subjectId: deviceId,
    clientTools: getDeviceDetailClientTools(),
    clientToolHandler: deviceDetailClientToolRuntime.handleClientToolCall,
    clientToolsName: deviceDetailClientToolRuntime.clientToolsName,
    clientToolsDescription: buildDeviceDetailClientToolsDescription(),
    workflowGuides: getDeviceDetailWorkflowGuides(),
    markdownLinkHandler: handleDeviceAgentMarkdownLink,
    systemPrompt: buildDeviceDetailAgentSystemPrompt(),
    openingStatement: buildDeviceDetailAgentOpeningStatement(),
    promptExamples: buildDeviceDetailAgentPromptExamples(),
    conversationTitle: $t('DeviceDetail.agent.conversationTitle'),
    bubbleIcon: 'HddOutlined',
    bubbleIconBadge: 'MessageOutlined',
    bubbleClassName: 'ai-float-btn-wrapper--device-agent',
    bubbleTooltip: $t('DeviceDetail.agent.bubbleTooltip'),
    ...(deviceName ? { deviceName, subjectName: deviceName } : {})
  }
}

const prepareDeviceDetailAgent = (deviceId?: unknown) => {
  const id = String(deviceId || '').trim()
  aiStore.prepareAgentConversation(DEVICE_DETAIL_AGENT_CLIENT_ID, id
    ? {
        deviceId: id,
        subjectType: DEVICE_AGENT_SUBJECT_TYPE,
        subjectId: id
      }
    : {})
}

prepareDeviceDetailAgent(route.params?.id)

const resolveDeviceAgentLinkTab = (href: string) => {
  const raw = String(href || '').trim()
  if (!raw) return ''

  if (raw.startsWith('#')) {
    const fragment = raw.slice(1)
    const params = new URLSearchParams(fragment.includes('=') ? fragment : `tab=${fragment}`)
    return normalizeDeviceAgentTabKey(params.get('tab') || params.get('deviceTab') || fragment)
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw)
      if (url.origin === window.location.origin && url.hash) {
        return resolveDeviceAgentLinkTab(url.hash)
      }
    } catch {
      return ''
    }
  }

  if (/^tab:\/\//i.test(raw)) {
    return normalizeDeviceAgentTabKey(raw.replace(/^tab:\/\//i, '').split(/[?#]/)[0])
  }

  const match = raw.match(/^jetlinks:\/\/device-detail\/tab\/([^?#]+)/i)
  if (match?.[1]) {
    try {
      return normalizeDeviceAgentTabKey(decodeURIComponent(match[1]))
    } catch {
      return normalizeDeviceAgentTabKey(match[1])
    }
  }

  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    const tabKey = normalizeDeviceAgentTabKey(raw)
    if (isDeviceAgentExistingTab(tabKey) || DEVICE_AGENT_KNOWN_TABS.has(tabKey)) {
      return tabKey
    }
  }

  return ''
}

const isDeviceAgentTabLink = (href: string) => {
  const raw = String(href || '').trim()
  if (/^tab:\/\//i.test(raw) || /^jetlinks:\/\/device-detail\/tab\//i.test(raw)) {
    return true
  }
  if (!raw.startsWith('#')) {
    const tabKey = normalizeDeviceAgentTabKey(raw)
    return isDeviceAgentExistingTab(tabKey)
  }
  const fragment = raw.slice(1)
  if (fragment.includes('=')) {
    const params = new URLSearchParams(fragment)
    const tabKey = normalizeDeviceAgentTabKey(params.get('tab') || params.get('deviceTab') || '')
    return !!tabKey && isDeviceAgentExistingTab(tabKey)
  }
  const tabKey = normalizeDeviceAgentTabKey(fragment)
  return isDeviceAgentExistingTab(tabKey)
}

const handleDeviceAgentMarkdownLink: AgentConversationMarkdownLinkHandler = ({ href, event }) => {
  const targetTab = resolveDeviceAgentLinkTab(href)
  if (!targetTab) return false

  const exists = pageContainerTabList.value.some((item: any) => item?.key === targetTab)
  if (!exists) {
    return isDeviceAgentTabLink(href)
  }

  event.preventDefault()
  if (exists) {
    onTabChange(targetTab)
  }
  return true
}

const syncDeviceDetailAgent = () => {
  const parameters = buildDeviceDetailAgentParameters()
  if (!parameters) return
  void aiStore.queryAgent(DEVICE_DETAIL_AGENT_CLIENT_ID, parameters)
    .then(refreshDeviceDetailAgentParameters)
}

const refreshDeviceDetailAgentParameters = () => {
  const parameters = buildDeviceDetailAgentParameters()
  if (!parameters || !aiStore.agentList.length) return
  if (aiStore.parameters?.deviceId !== parameters.deviceId) return
  aiStore.parameters = {
    ...aiStore.parameters,
    ...parameters
  }
}

const orderedOptions = computed(() => {
  const source = (mergedOptions as any)?.value || []
  if (!Array.isArray(source) || !source.length) return source

  const infoIdx = source.findIndex((item: any) => item?.key === 'Info')
  if (infoIdx < 0) return source.filter((item: any) => item?.key !== 'Info')

  const preferredOrder = ['DeviceDetail', 'Diagnose', 'DeviceAccess']
  const movableSet = new Set(preferredOrder)
  const movable = source.filter((item: any) => movableSet.has(item?.key))
  if (!movable.length) return source.filter((item: any) => item?.key !== 'Info')

  // 保留原有顺序，同时确保可识别项按优先级插入「实例详情」后
  movable.sort((a: any, b: any) => preferredOrder.indexOf(a?.key) - preferredOrder.indexOf(b?.key))
  const rest = source.filter((item: any) => !movableSet.has(item?.key))
  const nextInfoIdx = rest.findIndex((item: any) => item?.key === 'Info')
  if (nextInfoIdx < 0) return source.filter((item: any) => item?.key !== 'Info')

  const result = [...rest.slice(0, nextInfoIdx + 1), ...movable, ...rest.slice(nextInfoIdx + 1)]

  // 进一步微调：按「运行状态 -> 设备接入 -> 物模型」调整顺序，其余保持相对不变
  const priorityKeys = ['Running', 'Diagnose', 'Metadata']
  const prioritySet = new Set(priorityKeys)

  const map = new Map(result.map((item: any) => [item?.key, item]))
  const priorityItems = priorityKeys
    .map((key) => map.get(key))
    .filter((v) => !!v) as any[]

  if (priorityItems.length <= 1) return result.filter((item: any) => item?.key !== 'Info')

  const anchorIdx = result.findIndex((item: any) => prioritySet.has(item?.key))
  if (anchorIdx < 0) return result.filter((item: any) => item?.key !== 'Info')

  const restWithoutPriority = result.filter((item: any) => !prioritySet.has(item?.key))
  const nextNonPriority = result.slice(anchorIdx + 1).find((item: any) => !prioritySet.has(item?.key))
  const insertIndex = nextNonPriority
    ? restWithoutPriority.findIndex((item: any) => item?.key === nextNonPriority?.key)
    : restWithoutPriority.length

  return [
    ...restWithoutPriority.slice(0, insertIndex),
    ...priorityItems,
    ...restWithoutPriority.slice(insertIndex)
  ].filter((item: any) => item?.key !== 'Info')
})

const pageContainerTabList = computed(() =>
  detailPageLoading.value ? skeletonTabList : orderedOptions.value
)

const pageContainerTabActiveKey = computed(() =>
  detailPageLoading.value ? SKELETON_TAB_FIRST_KEY : instanceStore.tabActiveKey
)

const resolveDefaultTabKey = (requestedTab?: string) => {
  const keys = (list.value || [])
    .map((i: any) => i?.key)
    .filter((k: any) => !!k && k !== 'Info')

  if (!keys.length) return 'Running'

  const stateValue = instanceStore.current?.state?.value
  const preferred = stateValue === 'online' ? 'Running' : 'Diagnose'

  const requested = requestedTab && requestedTab !== 'Info' ? requestedTab : undefined
  if (requested && keys.includes(requested)) return requested

  if (keys.includes(preferred)) return preferred
  if (keys.includes('Running')) return 'Running'
  return keys[0]
}

const _arr = ['agent-device-gateway', 'agent-media-device-gateway']

const contentStyle = computed(() => {
  if (instanceStore.tabActiveKey === 'Dashboard') {
    return {
      height: '100%',
      padding: '0',
      overflow: 'hidden'
    } as any
  }
  return {
    height: '100%',
    padding: '24px',
    overflowY: 'auto'
  } as any
})

const getStatus = (id: string) => {
  if (statusRef.value) {
    statusRef.value.unsubscribe()
  }
  statusRef.value = wsClient
    .getWebSocket(`instance-editor-info-status-${id}`, `/dashboard/device/status/change/realTime`, {
      deviceId: id
    })
    .subscribe((message: any) => {
      if (message.payload?.value?.type !== instanceStore.current?.state.value) {
        // instanceStore.refresh(id);
        // 调用detail接口无法实时更新状态，所以这里手动更新
        instanceStore.setState({
          value: message.payload?.value?.type,
          text: statusTextMap.get(message.payload?.value?.type) || ''
        })
      }
    })
}

const getDetail = () => {
  list.value = [...initList];
  const keys = list.value.map((i) => i.key)
  if (permissionStore.hasPermission('rule-engine/Alarm/Log:view') && showThreshold) {
    list.value.push({
      key: 'AlarmRecord',
      tab: $t('Detail.index.957187-16')
    })
    if (isNoCommunity) {
      list.value.push({
        key: 'Invalid',
        tab: $t('Detail.index.957187-29')
      })
      list.value.push({
        key: 'Threshold',
        tab: $t('Detail.index.957187-42')
      })
    }
  }
  if (permissionStore.hasPermission('iot-card/CardManagement:view') && isNoCommunity) {
    list.value.push({
      key: 'CardManagement',
      tab: $t('Detail.index.957187-17')
    })
  }

  if (instanceStore.current?.features?.some((item) => item.id === 'deviceShadow-manager') && isNoCommunity) {
    list.value.push({
      key: 'Shadow',
      tab: $t('Detail.index.957187-18')
    })
  }
  if (
    permissionStore.hasPermission('device/Firmware:view') &&
    instanceStore.current?.features?.find((item: any) => item?.id === 'supportFirmware') &&
    isNoCommunity
  ) {
    list.value.push({
      key: 'Firmware',
      tab: $t('Detail.index.957187-19')
    })
  }
  if (
    instanceStore.current?.protocol &&
    !['modbus-tcp', 'opc-ua'].includes(instanceStore.current?.protocol) &&
    !keys.includes('Diagnose')
  ) {
    list.value.push({
      key: 'Diagnose',
      tab: $t('Detail.index.957187-20')
    })
  }
  if (
    instanceStore.current?.features?.find((item: any) => item?.id === 'transparentCodec') &&
    !keys.includes('Parsing')
  ) {
    list.value.push({
      key: 'Parsing',
      tab: $t('Detail.index.957187-21')
    })
  }
  if (instanceStore.current?.protocol === 'modbus-tcp' && !keys.includes('Modbus')) {
    list.value.push({
      key: 'Modbus',
      tab: $t('Detail.index.957187-22')
    })
  }
  if (instanceStore.current?.protocol === 'opc-ua' && !keys.includes('OPCUA')) {
    list.value.push({
      key: 'OPCUA',
      tab: $t('Detail.index.957187-22')
    })
  }
  if (instanceStore.current?.protocol === 'collector-gateway' && !keys.includes('GateWay')) {
    list.value.push({
      key: 'GateWay',
      tab: $t('Detail.index.957187-22')
    })
  }
  if (
    instanceStore.current?.deviceType?.value === 'gateway' &&
    !keys.includes('ChildDevice') &&
    !keys.includes('Child')
  ) {
    const providers = ['agent-device-gateway', 'agent-media-device-gateway']
    if (providers.includes(instanceStore.current?.accessProvider!)) {
      list.value.push({
        key: 'Child',
        tab: $t('Detail.index.957187-23')
      })
    } else {
      // 产品类型为网关的情况下才显示此模块
      list.value.push({
        key: 'ChildDevice',
        tab: $t('Detail.index.957187-23')
      })
    }
  }
  if (
    instanceStore.current?.accessProvider === 'edge-child-device' &&
    instanceStore.current?.parentId &&
    !keys.includes('EdgeMap')
  ) {
    list.value.push({
      key: 'EdgeMap',
      tab: $t('Detail.index.957187-24')
    })
  }

  if (
    instanceStore.current?.features?.find((item: any) => item?.id === 'diffMetadataSameProduct') &&
    !keys.includes('MetadataMap')
  ) {
    list.value.push({ key: 'MetadataMap', tab: $t('Detail.index.957187-25') })
  }

  if (_arr.includes(instanceStore.current?.accessProvider) && !keys.includes('Terminal')) {
    list.value.push({ key: 'Terminal', tab: $t('Detail.index.957187-26') })
  }

  // 仪表盘

  if (isApplyDashboard() && !list.value.some((i) => i.key === 'Dashboard')) {
    list.value.push({ key: 'Dashboard', tab: $t('Detail.index.957187-32') })
  }
}

const initPage = async (newId: any) => {
  detailPageLoading.value = true
  try {
    // 刷新整个页面，防止前一个数据还有残留
    instanceStore.tabActiveKey = 'Running'
    instanceStore.setCurrent({ id: newId })
    await instanceStore.refresh(String(newId))
    getStatus(String(newId))
    getDetail()
    instanceStore.tabActiveKey = resolveDefaultTabKey()
    syncDeviceDetailAgent()
  } finally {
    detailPageLoading.value = false
  }
}

onBeforeRouteUpdate((to: any) => {
  if (to.params?.id !== instanceStore.current.id && to.name === 'device/Instance/Detail') {
    // location.reload()
    prepareDeviceDetailAgent(to.params?.id)
    initPage(to.params?.id)
  }
})

const getDetailFn = async () => {
  detailPageLoading.value = true
  try {
    const _id = route.params?.id
    const tab = routerParams.params.value.tab
    if (_id) {
      await instanceStore.refresh(String(_id))
      getStatus(String(_id))
      getDetail()
      instanceStore.tabActiveKey = resolveDefaultTabKey(tab)
      syncDeviceDetailAgent()
    }
  } finally {
    detailPageLoading.value = false
  }
}

const onTabChange = (e: string) => {
  if (detailPageLoading.value) return
  if (instanceStore.tabActiveKey === 'Metadata') {
    EventEmitter.emit('MetadataTabs', () => {
      instanceStore.tabActiveKey = e
    })
  } else if (instanceStore.tabActiveKey === 'Child') {
    EventEmitter.emit('ChildTabs', () => {
      instanceStore.tabActiveKey = e
    })
  } else {
    instanceStore.tabActiveKey = e
  }
}

const handleAction = () => {
  if (instanceStore.current?.id) {
    const response = _deploy(instanceStore.current?.id)
    response.then((resp) => {
      if (resp.status === 200) {
        onlyMessage($t('Detail.index.957187-27'))
        instanceStore.refresh(instanceStore.current?.id)
      }
    })
    return response
  }
}

const handleDisconnect = () => {
  if (instanceStore.current?.id) {
    const response = _disconnect(instanceStore.current?.id)
    response.then((resp) => {
      if (resp.status === 200) {
        onlyMessage($t('Detail.index.957187-27'))
        instanceStore.refresh(instanceStore.current?.id)
      }
    })
    return response
  }
}

const handleRefresh = async () => {
  if (instanceStore.current?.id) {
    await instanceStore.refresh(instanceStore.current?.id)
    onlyMessage($t('Detail.index.957187-28'))
  }
  if (instanceStore.tabActiveKey === 'Child') {
    componentRef.value?.handleRefresh()
  }
}

const jumpProduct = () => {
  menuStory.jumpPage('device/Product/Detail', {
    params: {
      id: instanceStore.current?.productId
    }
  })
}

const handleEditName = () => {
  editableName.value = instanceStore.current?.name || ''
  isEditingName.value = true
  nextTick(() => {
    if (nameEditorRef.value) {
      nameEditorRef.value.innerText = editableName.value
      nameEditorRef.value.focus()
      const selection = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(nameEditorRef.value)
      range.collapse(false)
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
  })
}

const onNameInput = (e: Event) => {
  editableName.value = ((e.target as HTMLElement)?.innerText || '').replace(/\n/g, '')
}

const handleCopyId = async () => {
  const id = instanceStore.current?.id
  if (!id) return
  await copyClipboardText(id)
}

const handleSaveName = async () => {
  const id = instanceStore.current?.id
  if (!id) return
  const nextName = (editableName.value || '').trim()
  if (!nextName) {
    onlyMessage($t('Save.index.902471-7'), 'error')
    return
  }
  if (nextName.length > 64) {
    onlyMessage($t('Save.index.902471-3'), 'error')
    return
  }
  if (nextName === instanceStore.current?.name) {
    isEditingName.value = false
    return
  }

  savingName.value = true
  const resp = await modifyByDeviceId(id, {
    name: nextName
  }).finally(() => {
    savingName.value = false
  })

  if (resp.success) {
    isEditingName.value = false
    onlyMessage($t('Save.index.902471-16'))
    await instanceStore.refresh(id)
  }
}

const onClick = async () => {
  await openEdgeUrl(instanceStore.current.id)
}

onMounted(async () => {
  await getDetailFn()
  editableName.value = instanceStore.current?.name || ''
})

watch(
  () => instanceStore.current?.id,
  () => {
    isEditingName.value = false
    editableName.value = instanceStore.current?.name || ''
    tagsPopoverOpen.value = false
    tagsPanelVisible.value = false
    avatarError.value = false
  }
)

watch(
  () => [
    instanceStore.current?.id,
    instanceStore.current?.name,
    instanceStore.current?.state?.value,
    instanceStore.current?.accessProvider,
    getDeviceAgentVisibleTabs().map((item) => `${item.key}:${item.label}`).join('|')
  ],
  () => {
    refreshDeviceDetailAgentParameters()
  },
  { flush: 'post' }
)

onUnmounted(() => {
  instanceStore.current = {} as any
  statusRef.value && statusRef.value.unsubscribe()
  aiStore.releaseAgentConversation(DEVICE_DETAIL_AGENT_CLIENT_ID)
})

defineExpose({
  handleAction,
  handleDisconnect,
  jumpProduct
})
</script>

<style lang="less" scoped>
.device-detail-title-row {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 0;
  min-width: 0;
  width: 100%;
}

.device-detail-title-main {
  flex: 1;
  min-width: 0;
  max-width: 100%;
}

.device-detail-name-wrap {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  min-width: 0;
  width: 100%;
  gap: 4px 8px;
}

.device-detail-avatar-btn {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  border: none;
  padding: 0;
  background: rgba(0, 0, 0, 0.04);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  overflow: hidden;
  position: relative;
}

.device-detail-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.device-detail-avatar-edit-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.25);
  opacity: 0;
  transition: opacity 0.15s ease;
  pointer-events: none;
}

.device-detail-avatar-btn:hover .device-detail-avatar-edit-mask {
  opacity: 1;
}

.device-detail-avatar-edit-mask :deep(.anticon) {
  font-size: 14px;
  color: #fff;
}

.device-photo-file-input {
  display: none;
}

.device-detail-name-wrap > :deep(.ant-tooltip) {
  flex: 1 1 auto;
  min-width: 0;
  max-width: min(100%, 480px);
}

.device-detail-name-wrap > .deviceDetailHead--editable {
  flex: 1 1 auto;
  min-width: 0;
  max-width: min(100%, 480px);
}

.device-detail-name-status-sep {
  opacity: 0.65;
}

.device-detail-status-inline {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
  flex: 0 1 auto;
  min-width: 0;
}

.device-detail-inline-action {
  padding: 0 !important;
  margin-top: 0 !important;
  height: auto !important;
  line-height: 1.35 !important;
}

.device-detail-inline-action :deep(.ant-btn) {
  padding: 0 4px !important;
  height: auto !important;
  line-height: 1.35 !important;
}

.device-detail-offline-hint-icon {
  font-size: 12px;
  color: var(--text-color-secondary, rgba(0, 0, 0, 0.45));
}

.deviceDetailHead {
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  line-height: 1.35;
}

.deviceDetailHead--editable {
  cursor: text;
  outline: none;
}

.device-detail-name-action {
  padding: 0 4px !important;
  min-width: auto !important;
  height: auto !important;
  line-height: 1 !important;
}

.device-detail-meta {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 6px;
  margin-top: 2px;
  font-size: 12px;
  line-height: 1.35;
  color: var(--text-color-secondary, rgba(0, 0, 0, 0.45));
}

.device-detail-meta__label {
  flex-shrink: 0;
  opacity: 0.85;
}

.device-detail-meta__id-text {
  flex: 1 1 auto;
  min-width: 0;
  word-break: break-all;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}

.device-detail-meta__id-text--copy {
  cursor: pointer;
  text-decoration: none;
}

.device-detail-meta__id-text--copy:hover {
  color: var(--primary-color, #1677ff);
}

.device-detail-meta__sep {
  flex-shrink: 0;
  opacity: 0.65;
  user-select: none;
}

.device-detail-meta__tags-inline {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
  flex: 1 1 auto;
  position: relative;
  overflow: visible;
}

.device-detail-meta__tag-chip {
  margin: 0 !important;
  max-width: 160px;
  padding: 0 2px 0 4px !important;
  line-height: 18px !important;
  height: auto !important;
  font-size: 12px !important;
  border-style: dashed !important;
  cursor: pointer;
}

.device-detail-meta__tag-chip--empty {
  opacity: 0.75;
  border-style: dashed !important;
  color: var(--text-color-secondary, rgba(0, 0, 0, 0.45)) !important;
  background: transparent !important;
}

.device-detail-meta__tags-edit {
  padding: 0 2px !important;
  min-width: auto !important;
  height: auto !important;
  line-height: 18px !important;
}

.device-detail-meta__tags-edit :deep(.anticon) {
  font-size: 12px;
}

.device-detail-meta__tag-text {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}

.device-detail-meta__tags-toggle {
  border: none;
  background: transparent;
  padding: 0 2px;
  font-size: 12px;
  line-height: 18px;
  color: var(--primary-color, #1677ff);
  cursor: pointer;
  flex-shrink: 0;
}

.device-detail-meta__tags-toggle:hover {
  color: var(--primary-color-hover, #4096ff);
}

.device-detail-meta__tags-expand-btn {
  border: none;
  background: transparent;
  padding: 0 2px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  height: 18px;
}

.device-detail-meta__tags-expand-caret {
  font-size: 12px;
  transition: transform 0.15s ease;
}

.device-detail-meta__tags-expand-caret--open {
  transform: rotate(180deg);
}

.device-detail-tags-dropdown {
  padding: 6px 0;
  text-align: left;
  position: relative;
  z-index: 2000;
}

.device-detail-tags-popover-inner {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-start;
}

.device-detail-tags-dropdown__list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 8px 0 0;
  max-width: 520px;
  justify-content: flex-start;
  position: relative;
  z-index: 2001;
}

.device-detail-tags-dropdown :deep(.ant-dropdown),
.device-detail-tags-dropdown :deep(.ant-dropdown-menu) {
  z-index: 2001;
}

.device-detail-name-action :deep(.anticon) {
  font-size: 12px;
}

.device-detail-meta__product {
  min-width: 0;
  flex: 0 1 auto;
  max-width: 200px;
  overflow: hidden;
  font-size: inherit;
  line-height: inherit;
}

.device-detail-meta__id-text :deep(.j-ellipsis),
.device-detail-meta__product :deep(.j-ellipsis) {
  font-size: inherit;
  line-height: inherit;
}

.device-detail-meta__product :deep(.j-permission-button),
.device-detail-meta__product-link {
  padding: 0 !important;
  height: auto !important;
  font-size: inherit !important;
  line-height: inherit !important;
  color: var(--primary-color, #1677ff) !important;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}

.device-detail-meta__product :deep(.j-permission-button:hover),
.device-detail-meta__product-link:hover {
  color: var(--primary-color-hover, #4096ff) !important;
}

.device-detail-status-text {
  font-size: 14px;
  color: rgba(0, 0, 0, 0.85);
  white-space: nowrap;
}

.device-detail-content-wrap {
  :deep(> div) {
    height: 100%;
  }
}

.device-detail-content-wrap--skeleton {
  min-height: 420px;
  height: 100%;
  box-sizing: border-box;
}

@keyframes device-detail-extra-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.device-detail-extra-skeleton {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.device-detail-extra-skeleton__btn,
.device-detail-extra-skeleton__icon {
  border-radius: 6px;
  background: linear-gradient(
    90deg,
    rgba(0, 0, 0, 0.06) 0%,
    rgba(0, 0, 0, 0.1) 50%,
    rgba(0, 0, 0, 0.06) 100%
  );
  background-size: 200% 100%;
  animation: device-detail-extra-shimmer 1.35s ease-in-out infinite;
}

.device-detail-extra-skeleton__btn {
  width: 88px;
  height: 32px;
}

.device-detail-extra-skeleton__icon {
  width: 28px;
  height: 28px;
  margin-right: 8px;
  border-radius: 4px;
}

/* Tab 鱼骨骨架：详情未返回前标签数量/文案未知，用占位 Tab + 脊柱/肋条视觉 */
@keyframes device-detail-tab-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.device-detail-page-wrap {
  min-width: 0;
  width: 100%;
}

.device-detail-page-wrap--tab-skeleton {
  :deep(.ant-tabs-nav) {
    position: relative;
    margin-bottom: 0 !important;
  }

  :deep(.ant-tabs-nav-wrap) {
    position: relative;
    padding-top: 10px;
    &::before {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      height: 2px;
      border-radius: 1px;
      background: linear-gradient(
        90deg,
        rgba(22, 119, 255, 0.4) 0%,
        rgba(22, 119, 255, 0.1) 45%,
        rgba(22, 119, 255, 0.35) 100%
      );
      pointer-events: none;
    }
  }

  :deep(.ant-tabs-tab) {
    position: relative;
    &::before {
      content: '';
      position: absolute;
      left: 50%;
      top: 2px;
      width: 1px;
      height: 7px;
      transform: translateX(-50%);
      background: rgba(22, 119, 255, 0.22);
      border-radius: 1px;
      pointer-events: none;
    }
  }

  :deep(.ant-tabs-tab-btn) {
    color: transparent !important;
    font-size: 0 !important;
    line-height: 0 !important;
    min-height: 14px;
    padding: 0 4px !important;
    display: inline-block;
    border-radius: 4px;
    background: linear-gradient(
      90deg,
      rgba(0, 0, 0, 0.06) 0%,
      rgba(0, 0, 0, 0.11) 50%,
      rgba(0, 0, 0, 0.06) 100%
    );
    background-size: 200% 100%;
    animation: device-detail-tab-shimmer 1.35s ease-in-out infinite;
  }

  :deep(.ant-tabs-tab:nth-child(1) .ant-tabs-tab-btn) {
    min-width: 52px;
  }
  :deep(.ant-tabs-tab:nth-child(2) .ant-tabs-tab-btn) {
    min-width: 72px;
  }
  :deep(.ant-tabs-tab:nth-child(3) .ant-tabs-tab-btn) {
    min-width: 64px;
  }
  :deep(.ant-tabs-tab:nth-child(4) .ant-tabs-tab-btn) {
    min-width: 48px;
  }
  :deep(.ant-tabs-tab:nth-child(5) .ant-tabs-tab-btn) {
    min-width: 80px;
  }
  :deep(.ant-tabs-tab:nth-child(6) .ant-tabs-tab-btn) {
    min-width: 56px;
  }
  :deep(.ant-tabs-tab:nth-child(7) .ant-tabs-tab-btn) {
    min-width: 68px;
  }
  :deep(.ant-tabs-tab:nth-child(8) .ant-tabs-tab-btn) {
    min-width: 44px;
  }
  :deep(.ant-tabs-tab:nth-child(9) .ant-tabs-tab-btn) {
    min-width: 76px;
  }
  :deep(.ant-tabs-tab:nth-child(10) .ant-tabs-tab-btn) {
    min-width: 60px;
  }
  :deep(.ant-tabs-tab:nth-child(11) .ant-tabs-tab-btn) {
    min-width: 52px;
  }
  :deep(.ant-tabs-tab:nth-child(12) .ant-tabs-tab-btn) {
    min-width: 70px;
  }

  :deep(.ant-tabs-tab-active .ant-tabs-tab-btn) {
    background: linear-gradient(
      90deg,
      rgba(22, 119, 255, 0.2) 0%,
      rgba(22, 119, 255, 0.32) 50%,
      rgba(22, 119, 255, 0.2) 100%
    );
    background-size: 200% 100%;
  }

  :deep(.ant-tabs-ink-bar) {
    background: rgba(22, 119, 255, 0.5) !important;
  }
}
</style>
