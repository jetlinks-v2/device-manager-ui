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
  }
]

const list = ref([...initList])
const isRefresh = ref(false)
const aiStore = useAIStore()
const permissionStore = useAuthStore()
const { mergedOptions } = useRegistryOptions({ baseOptions: list, code: 'detail-tabs' })
const DEVICE_AGENT_SUBJECT_TYPE = 'device'

const syncDeviceDetailAgent = () => {
  const deviceId = instanceStore.current?.id
  if (!deviceId) return

  const deviceName = instanceStore.current?.name
  void aiStore.queryAgent('deviceDetailChat', {
    deviceId,
    subjectType: DEVICE_AGENT_SUBJECT_TYPE,
    subjectId: deviceId,
    ...(deviceName ? { deviceName, subjectName: deviceName } : {})
  })
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

onUnmounted(() => {
  instanceStore.current = {} as any
  statusRef.value && statusRef.value.unsubscribe()
  aiStore.hideAiButton()
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
