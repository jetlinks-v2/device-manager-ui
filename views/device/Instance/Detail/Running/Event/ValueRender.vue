<template>
  <div class='event-value-render'>
    <template v-if='isFile'>
      <div class='event-file'>
        <img class='event-file-icon' :src='fileIcon' alt='' />
        <div class='event-file-content'>
          <j-ellipsis>
            {{ fileName }}
          </j-ellipsis>
          <a-space :size='4' class='event-file-actions'>
            <a-tooltip v-if='isImageFile' :title="$t('Product.index.660348-12')">
              <a-button type='link' size='small' @click.stop='openPreview'>
                <AIcon type='EyeOutlined' />
              </a-button>
            </a-tooltip>
            <a-tooltip :title="$t('Product.index.660348-12')">
              <a-button type='link' size='small' @click.stop='openInNewPage'>
                <AIcon type='ExportOutlined' />
              </a-button>
            </a-tooltip>
          </a-space>
        </div>
      </div>
    </template>
    <template v-else-if='isEnumLike'>
      <a-tag :color='tagColor'>
        {{ displayText }}
      </a-tag>
    </template>
    <template v-else-if='isComplexValue'>
      <div class='event-value-complex' @click='openDetail'>
        <j-ellipsis>
          {{ displayText }}
        </j-ellipsis>
        <a-button type='link' size='small'>
          {{ $t('Product.index.660348-12') }}
        </a-button>
      </div>
    </template>
    <template v-else>
      <div class='event-value-text'>
        <j-ellipsis>
          {{ displayText }}
        </j-ellipsis>
      </div>
    </template>
  </div>

  <a-modal
    v-model:open='previewVisible'
    :title='modalTitle'
    :footer='null'
    :width='previewType === "video" ? 880 : 720'
    destroyOnClose
  >
    <div class='event-value-preview'>
      <img
        v-if='previewType === "image"'
        class='event-preview-image'
        :src='previewSrc'
        alt=''
      />
      <video
        v-else-if='previewType === "video"'
        class='event-preview-video'
        :src='previewSrc'
        controls
      />
      <iframe
        v-else-if='previewType === "pdf"'
        class='event-preview-pdf'
        :src='previewSrc'
      />
      <JsonViewer
        v-else-if='previewType === "json"'
        :value='detailValue'
        :expand-depth='5'
      />
      <pre v-else class='event-preview-text'>{{ detailText }}</pre>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { get } from 'lodash-es'
import dayjs from 'dayjs'
import { JsonViewer } from 'vue3-json-viewer'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web/utils'
import { proxyUrl } from '../../../../../../api/instance'
import { useInstanceStore } from '../../../../../../store/instance'
import { fileList, getType, imgList, imgMap, videoList } from '../Property/index'

const { t: $t } = useI18n()

const props = defineProps({
  record: {
    type: Object,
    default: () => ({})
  },
  field: {
    type: Object,
    default: () => ({})
  }
})

const instanceStore = useInstanceStore()
const previewVisible = ref(false)
const previewSrc = ref('')
const previewType = ref<'image' | 'video' | 'pdf' | 'json' | 'text'>('text')
const tempBlobUrls = ref<string[]>([])

const fieldId = computed(() => props.field?.id || props.field?.dataIndex || 'value')
const valueType = computed(() => props.field?.valueType?.type || 'string')
const bodyType = computed(() => props.field?.valueType?.bodyType)

const rawValue = computed(() => get(props.record, fieldId.value))
const formatValue = computed(() => {
  const value = get(props.record, `${fieldId.value}_format`)
  return isEmpty(value) ? rawValue.value : value
})

const detailValue = computed(() => {
  if (['object', 'array', 'geoPoint'].includes(valueType.value)) {
    return isObjectLike(rawValue.value) ? rawValue.value : formatValue.value
  }
  return formatValue.value
})

const displayText = computed(() => {
  if (isEmpty(formatValue.value)) {
    return '--'
  }
  if (valueType.value === 'boolean') {
    return getBooleanText(rawValue.value)
  }
  if (valueType.value === 'enum') {
    return getEnumText(rawValue.value)
  }
  if (valueType.value === 'date') {
    return formatDate(rawValue.value)
  }
  if (valueType.value === 'geoPoint') {
    return formatGeoPoint(detailValue.value)
  }
  if (['object', 'array'].includes(valueType.value)) {
    return formatJson(detailValue.value)
  }
  if (valueType.value === 'file') {
    return fileName.value
  }
  return formatPlainText(rawValue.value)
})

const isEnumLike = computed(() => ['boolean', 'enum'].includes(valueType.value) && !isEmpty(formatValue.value))
const isComplexValue = computed(() => ['object', 'array', 'geoPoint'].includes(valueType.value))

const fileSource = computed(() => {
  if (typeof rawValue.value === 'string' && rawValue.value) {
    return rawValue.value
  }
  if (typeof formatValue.value === 'string' && formatValue.value) {
    return formatValue.value
  }
  if (isObjectLike(rawValue.value)) {
    return rawValue.value?.url || rawValue.value?.value || rawValue.value?.base64 || ''
  }
  return ''
})

const fileCategory = computed(() => {
  if (valueType.value !== 'file') return ''
  if (bodyType.value === 'base64') {
    return getType(fileSource.value)
  }

  const lowerValue = String(fileSource.value || '').toLowerCase()

  if (imgList.some((item) => lowerValue.includes(item))) {
    return 'img'
  }
  if (videoList.some((item) => lowerValue.includes(item))) {
    return 'video'
  }
  if (lowerValue.includes('.pdf')) {
    return 'pdf'
  }
  if (['.json', '.txt', '.log', '.csv', '.xml', '.html', '.md'].some((item) => lowerValue.includes(item))) {
    return 'txt'
  }
  const ext = fileList.find((item) => lowerValue.includes(item))
  return ext ? ext.slice(1) : 'other'
})

const isFile = computed(() => valueType.value === 'file' && !isEmpty(fileSource.value))
const fileIcon = computed(() => imgMap.get(fileCategory.value || 'other') || imgMap.get('other'))
const canPreview = computed(() => ['img', 'video', 'pdf'].includes(fileCategory.value))
const isImageFile = computed(() => fileCategory.value === 'img')

const fileName = computed(() => {
  if (!fileSource.value) {
    return props.field?.name || '--'
  }
  if (bodyType.value === 'base64') {
    return `${props.field?.name || fieldId.value}.${guessExtension(fileCategory.value)}`
  }
  try {
    const url = new URL(fileSource.value)
    const path = decodeURIComponent(url.pathname.split('/').pop() || '')
    return path || `${props.field?.name || fieldId.value}.${guessExtension(fileCategory.value)}`
  } catch (e) {
    return `${props.field?.name || fieldId.value}.${guessExtension(fileCategory.value)}`
  }
})

const tagColor = computed(() => {
  if (valueType.value === 'boolean') {
    return rawValue.value === props.field?.valueType?.trueValue ? 'success' : 'default'
  }
  return 'processing'
})

const detailText = computed(() => {
  if (typeof detailValue.value === 'string') {
    return detailValue.value
  }
  return formatJson(detailValue.value)
})

const modalTitle = computed(() => props.field?.name || fieldId.value || $t('Event.index.277611-0'))

const openDetail = () => {
  previewType.value = ['object', 'array', 'geoPoint'].includes(valueType.value) ? 'json' : 'text'
  previewVisible.value = true
}

const openPreview = async () => {
  if (!canPreview.value) {
    return
  }
  const source = await resolvePreviewSource()
  if (!source) {
    onlyMessage($t('Property.ValueRender.865445-1'), 'error')
    return
  }
  previewSrc.value = source
  previewType.value = resolvePreviewType()
  previewVisible.value = true
}

const openInNewPage = async () => {
  const result = await resolveDownloadSource()
  if (!result?.url) {
    onlyMessage($t('Property.ValueRender.865445-1'), 'error')
    return
  }
  window.open(result.url, '_blank', 'noopener,noreferrer')
}

const resolvePreviewType = () => {
  if (fileCategory.value === 'img') return 'image'
  if (fileCategory.value === 'video') return 'video'
  if (fileCategory.value === 'pdf') return 'pdf'
  return 'text'
}

const resolvePreviewSource = async () => {
  if (bodyType.value === 'base64') {
    const url = createBase64ObjectUrl()
    return url || fileSource.value
  }
  if (instanceStore.current.accessProvider === 'agent-device-gateway' && isHttpUrl(fileSource.value)) {
    const blob = await proxyUrl(getProxyDeviceId(), fileSource.value)
    return createBlobUrl(blob)
  }
  return fileSource.value
}

const resolveDownloadSource = async () => {
  if (bodyType.value === 'base64') {
    const url = createBase64ObjectUrl()
    return {
      url,
      extension: guessExtension(fileCategory.value)
    }
  }
  if (instanceStore.current.accessProvider === 'agent-device-gateway' && isHttpUrl(fileSource.value)) {
    const blob = await proxyUrl(getProxyDeviceId(), fileSource.value)
    return {
      url: createBlobUrl(blob),
      extension: guessExtension(fileCategory.value)
    }
  }
  return {
    url: fileSource.value,
    extension: guessExtension(fileCategory.value)
  }
}

const createBase64ObjectUrl = () => {
  if (!fileSource.value) return ''
  if (fileSource.value.startsWith('data:')) return fileSource.value
  try {
    const blob = base64ToBlob(fileSource.value, inferMimeType(fileCategory.value))
    return createBlobUrl(blob)
  } catch (e) {
    return ''
  }
}

const createBlobUrl = (blob: Blob) => {
  const url = window.URL.createObjectURL(blob)
  tempBlobUrls.value.push(url)
  return url
}

const getProxyDeviceId = () => {
  return instanceStore?.current.deviceType?.value === 'childrenDevice'
    ? instanceStore.current?.parentId
    : instanceStore.current.id
}

const formatDate = (value: any) => {
  if (value instanceof Date) {
    return dayjs(value).format('YYYY-MM-DD HH:mm:ss')
  }
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    return dayjs(Number(value)).format('YYYY-MM-DD HH:mm:ss')
  }
  const date = dayjs(value)
  return date.isValid() ? date.format('YYYY-MM-DD HH:mm:ss') : String(value)
}

const formatGeoPoint = (value: any) => {
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  if (isObjectLike(value)) {
    return [value.lon, value.lat].filter((item) => item !== undefined).join(', ')
  }
  return formatPlainText(value)
}

const formatJson = (value: any) => {
  try {
    return typeof value === 'string' ? value : JSON.stringify(value)
  } catch (e) {
    return String(value)
  }
}

const formatPlainText = (value: any) => {
  if (isObjectLike(value)) {
    return formatJson(value)
  }
  return String(value)
}

const getBooleanText = (value: any) => {
  const trueValue = props.field?.valueType?.trueValue
  const falseValue = props.field?.valueType?.falseValue

  if (isSameValue(value, trueValue)) {
    return props.field?.valueType?.trueText || String(value)
  }

  if (isSameValue(value, falseValue)) {
    return props.field?.valueType?.falseText || String(value)
  }

  return formatPlainText(value)
}

const getEnumText = (value: any) => {
  const options = props.field?.valueType?.elements || []
  const matched = options.find((item: any) => isSameValue(item?.value, value))
  return matched?.text || formatPlainText(value)
}

const guessExtension = (category: string) => {
  const extensionMap: Record<string, string> = {
    img: 'png',
    video: 'mp4',
    pdf: 'pdf',
    txt: 'txt',
    doc: 'doc',
    docx: 'docx',
    xls: 'xls',
    xlsx: 'xlsx',
    ppt: 'ppt',
    pptx: 'pptx'
  }
  return extensionMap[category] || 'dat'
}

const inferMimeType = (category: string) => {
  const mimeMap: Record<string, string> = {
    img: 'image/png',
    video: 'video/mp4',
    pdf: 'application/pdf',
    txt: 'text/plain'
  }
  return mimeMap[category] || 'application/octet-stream'
}

const base64ToBlob = (base64: string, mimeType: string) => {
  const cleanBase64 = base64.replace(/^data:([a-zA-Z]+\/[a-zA-Z0-9-.+]+);base64,/, '')
  const bytes = window.atob(cleanBase64)
  const array = new Uint8Array(bytes.length)
  for (let index = 0; index < bytes.length; index += 1) {
    array[index] = bytes.charCodeAt(index)
  }
  return new Blob([array], { type: mimeType })
}

const isHttpUrl = (value: string) => /^https?:\/\//.test(value)

const isObjectLike = (value: any) => typeof value === 'object' && value !== null

const isSameValue = (left: any, right: any) => {
  return String(left) === String(right)
}

const isEmpty = (value: any) =>
  value === undefined || value === null || value === ''

onBeforeUnmount(() => {
  tempBlobUrls.value.forEach((item) => window.URL.revokeObjectURL(item))
  tempBlobUrls.value = []
})
</script>

<style scoped lang="less">
.event-value-render {
  width: 100%;
  min-width: 0;
}

.event-value-text {
  width: 100%;
  min-width: 0;
}

.event-value-complex {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-width: 0;
  cursor: pointer;
}

.event-file {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.event-file-icon {
  width: 28px;
  height: 28px;
  object-fit: contain;
  flex-shrink: 0;
}

.event-file-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.event-file-actions {
  flex-shrink: 0;
}

.event-value-preview {
  max-height: calc(100vh - 240px);
  overflow: auto;
}

.event-preview-image,
.event-preview-video,
.event-preview-pdf {
  width: 100%;
  min-height: 360px;
}

.event-preview-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
