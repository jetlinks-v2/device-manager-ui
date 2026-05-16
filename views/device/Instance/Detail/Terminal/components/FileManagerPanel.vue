<template>
  <div class="file-manager-panel">
    <div class="file-manager-panel__header">
      <div class="file-manager-panel__title-row">
        <div class="file-manager-panel__title-main">
          <AIcon type="FolderOpenOutlined" class="file-manager-panel__title-icon" />
          <span class="file-manager-panel__title">{{ $t('Terminal.index.remote-99') }}</span>
          <a-tooltip :title="$t('Terminal.index.remote-100')">
            <AIcon type="QuestionCircleOutlined" class="file-manager-panel__title-help" />
          </a-tooltip>
        </div>
      </div>
    </div>

    <a-alert
      v-if="!online"
      class="file-manager-panel__offline"
      type="warning"
      show-icon
      :message="$t('Terminal.index.remote-101')"
    />

    <div class="file-manager-panel__workspace">
      <div class="file-manager-panel__chrome">
        <div class="file-manager-panel__chrome-row">
          <div class="file-manager-panel__nav">
            <a-button size="small" :loading="loading" :disabled="!online" @click="refreshFileList">
              <template #icon>
                <AIcon type="ReloadOutlined" />
              </template>
            </a-button>
            <a-button size="small" :disabled="!online || !canGoUp || loading" @click="goUp">
              <template #icon>
                <AIcon type="ArrowUpOutlined" />
              </template>
            </a-button>
            <a-button size="small" :disabled="!online || !workingDirectory || loading" @click="goHome">
              <template #icon>
                <AIcon type="HomeOutlined" />
              </template>
            </a-button>
          </div>

          <div class="file-manager-panel__address">
            <span class="file-manager-panel__address-label">{{ $t('Terminal.index.remote-102') }}</span>
            <div class="file-manager-panel__breadcrumbs">
              <template v-if="pathSegments.length">
                <template v-for="(segment, index) in pathSegments" :key="segment.path">
                  <button
                    type="button"
                    class="file-manager-panel__crumb"
                    :class="{ 'is-current': index === pathSegments.length - 1 }"
                    @click="openPath(segment.path)"
                  >
                    {{ segment.label }}
                  </button>
                  <span
                    v-if="index < pathSegments.length - 1"
                    class="file-manager-panel__crumb-separator"
                  >
                    &gt;
                  </span>
                </template>
              </template>
              <span v-else class="file-manager-panel__crumb-empty">-</span>
            </div>
          </div>

          <div class="file-manager-panel__toolbar-actions">
            <a-upload
              :show-upload-list="false"
              :before-upload="handleBeforeUpload"
              :disabled="!online || uploading || !displayPath"
              multiple
            >
              <a-button size="small" :loading="uploading" :disabled="!online || !displayPath">
                <template #icon>
                  <AIcon type="UploadOutlined" />
                </template>
                {{ $t('Terminal.index.remote-106') }}
              </a-button>
            </a-upload>
            <a-button
              size="small"
              :disabled="!online || loading || !displayPath"
              @click="openCreateDir"
            >
              <template #icon>
                <AIcon type="FolderAddOutlined" />
              </template>
              {{ $t('Terminal.index.remote-107') }}
            </a-button>
          </div>

          <a-input-search
            v-model:value="searchText"
            class="file-manager-panel__search"
            allow-clear
            :placeholder="$t('Terminal.index.remote-108')"
            @search="refreshFileList"
          />
        </div>

        <div v-if="uploading" class="file-manager-panel__upload-strip">
          <div class="file-manager-panel__upload-meta">
            <span class="file-manager-panel__upload-title">
              <AIcon type="CloudUploadOutlined" />
              <span>{{ $t('Terminal.index.remote-173', { current: uploadCurrentIndex, total: uploadTotalCount }) }}</span>
            </span>
            <span
              v-if="uploadCurrentName"
              class="file-manager-panel__upload-name"
              :title="uploadCurrentName"
            >
              {{ uploadCurrentName }}
            </span>
          </div>
          <a-progress
            class="file-manager-panel__upload-progress"
            :percent="uploadProgressPercent"
            :show-info="false"
            size="small"
            status="active"
          />
          <span
            class="file-manager-panel__upload-percent"
            :class="{ 'is-processing': uploadProcessing }"
          >
            <template v-if="uploadProcessing">
              <AIcon type="LoadingOutlined" />
              <span>{{ $t('Terminal.index.remote-176') }}</span>
            </template>
            <template v-else>{{ uploadProgressPercent }}%</template>
          </span>
          <a-button type="link" size="small" danger @click="cancelUpload()">
            {{ $t('Terminal.index.remote-43') }}
          </a-button>
        </div>

        <div v-if="downloading" class="file-manager-panel__upload-strip file-manager-panel__upload-strip--download">
          <div class="file-manager-panel__upload-meta">
            <span class="file-manager-panel__upload-title">
              <AIcon type="DownloadOutlined" />
              <span>{{ $t('Terminal.index.remote-177', { current: downloadCurrentIndex, total: downloadTotalCount }) }}</span>
            </span>
            <span
              v-if="downloadCurrentName"
              class="file-manager-panel__upload-name"
              :title="downloadCurrentName"
            >
              {{ downloadCurrentName }}
            </span>
          </div>
          <a-progress
            class="file-manager-panel__upload-progress"
            :percent="downloadProgressPercent"
            :show-info="false"
            size="small"
            status="active"
          />
          <span class="file-manager-panel__upload-size">{{ downloadSizeText }}</span>
          <span
            class="file-manager-panel__upload-percent"
            :class="{ 'is-processing': downloadProcessing }"
          >
            <template v-if="downloadProcessing">
              <AIcon type="LoadingOutlined" />
              <span>{{ $t('Terminal.index.remote-176') }}</span>
            </template>
            <template v-else>{{ downloadProgressPercent }}%</template>
          </span>
          <a-button type="link" size="small" danger @click="cancelDownload()">
            {{ $t('Terminal.index.remote-43') }}
          </a-button>
        </div>
      </div>

      <div
        ref="contentRef"
        class="file-manager-panel__content"
        :class="{ 'is-drag-active': dragActive }"
        @click="closeContentMenu"
        @dragenter.prevent="handleDragEnter"
        @dragover.prevent="handleDragOver"
        @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDropUpload"
        @contextmenu.prevent="handleContentContextMenu"
      >
        <a-spin :spinning="loading" class="file-manager-panel__spin">
          <div v-if="fileList.length" class="file-manager-panel__list">
            <div class="file-manager-panel__list-head">
              <div class="file-manager-panel__list-cell file-manager-panel__list-cell--select">
                <a-checkbox
                  :checked="selectAllChecked"
                  :indeterminate="selectAllIndeterminate"
                  @change="(e) => toggleSelectAll(e.target.checked)"
                />
              </div>
              <div class="file-manager-panel__list-cell file-manager-panel__list-cell--name">
                <button
                  type="button"
                  class="file-manager-panel__sort-btn"
                  :class="{ 'is-active': sortField === 'name' }"
                  @click="toggleSort('name')"
                >
                  <span>{{ $t('Terminal.index.remote-109') }}</span>
                  <span class="file-manager-panel__sort-icons">
                    <AIcon
                      type="CaretUpFilled"
                      :class="{ 'is-active': sortField === 'name' && sortOrder === 'asc' }"
                    />
                    <AIcon
                      type="CaretDownFilled"
                      :class="{ 'is-active': sortField === 'name' && sortOrder === 'desc' }"
                    />
                  </span>
                </button>
              </div>
              <div class="file-manager-panel__list-cell file-manager-panel__list-cell--kind">
                <button
                  type="button"
                  class="file-manager-panel__sort-btn"
                  :class="{ 'is-active': sortField === 'kind' }"
                  @click="toggleSort('kind')"
                >
                  <span>{{ $t('Terminal.index.remote-110') }}</span>
                  <span class="file-manager-panel__sort-icons">
                    <AIcon
                      type="CaretUpFilled"
                      :class="{ 'is-active': sortField === 'kind' && sortOrder === 'asc' }"
                    />
                    <AIcon
                      type="CaretDownFilled"
                      :class="{ 'is-active': sortField === 'kind' && sortOrder === 'desc' }"
                    />
                  </span>
                </button>
              </div>
              <div class="file-manager-panel__list-cell file-manager-panel__list-cell--time">
                <button
                  type="button"
                  class="file-manager-panel__sort-btn"
                  :class="{ 'is-active': sortField === 'modifyTime' }"
                  @click="toggleSort('modifyTime')"
                >
                  <span>{{ $t('Terminal.index.remote-112') }}</span>
                  <span class="file-manager-panel__sort-icons">
                    <AIcon
                      type="CaretUpFilled"
                      :class="{ 'is-active': sortField === 'modifyTime' && sortOrder === 'asc' }"
                    />
                    <AIcon
                      type="CaretDownFilled"
                      :class="{ 'is-active': sortField === 'modifyTime' && sortOrder === 'desc' }"
                    />
                  </span>
                </button>
              </div>
              <div class="file-manager-panel__list-cell file-manager-panel__list-cell--size">
                <button
                  type="button"
                  class="file-manager-panel__sort-btn file-manager-panel__sort-btn--align-end"
                  :class="{ 'is-active': sortField === 'size' }"
                  @click="toggleSort('size')"
                >
                  <span>{{ $t('Terminal.index.remote-111') }}</span>
                  <span class="file-manager-panel__sort-icons">
                    <AIcon
                      type="CaretUpFilled"
                      :class="{ 'is-active': sortField === 'size' && sortOrder === 'asc' }"
                    />
                    <AIcon
                      type="CaretDownFilled"
                      :class="{ 'is-active': sortField === 'size' && sortOrder === 'desc' }"
                    />
                  </span>
                </button>
              </div>
              <div class="file-manager-panel__list-cell file-manager-panel__list-cell--permission">
                {{ $t('Terminal.index.remote-113') }}
              </div>
              <div class="file-manager-panel__list-cell file-manager-panel__list-cell--actions">
                {{ $t('Terminal.index.remote-114') }}
              </div>
            </div>

            <a-dropdown
              v-for="record in displayFileList"
              :key="record.path"
              :trigger="['contextmenu']"
              placement="bottomLeft"
            >
              <article
                class="file-manager-panel__row"
                :class="{
                  'is-active': activePath === record.path,
                  'is-selected': selectedPaths.includes(record.path),
                  'is-directory': record.directory,
                }"
                @click="handleRecordClick(record, $event)"
                @dblclick="handleItemDoubleClick(record)"
                @contextmenu.prevent="handleRecordContextMenu(record)"
              >
                <div class="file-manager-panel__row-cell file-manager-panel__row-cell--select">
                  <a-checkbox
                    :checked="selectedPaths.includes(record.path)"
                    @click.stop
                    @change="(e) => toggleRecordSelection(record, e.target.checked)"
                  />
                </div>
                <div class="file-manager-panel__row-cell file-manager-panel__row-cell--name">
                  <span
                    class="file-manager-panel__row-icon"
                    :class="{ 'is-directory': record.directory }"
                  >
                    <AIcon :type="record.directory ? 'FolderFilled' : 'FileOutlined'" />
                  </span>
                  <span class="file-manager-panel__row-name" :title="record.name">
                    {{ record.name }}
                  </span>
                </div>
                <div
                  class="file-manager-panel__row-cell file-manager-panel__row-cell--kind"
                  :title="getFileKind(record)"
                >
                  {{ getFileKind(record) }}
                </div>
                <div
                  class="file-manager-panel__row-cell file-manager-panel__row-cell--time"
                  :title="formatTime(record.modifyTime)"
                >
                  {{ formatTime(record.modifyTime) }}
                </div>
                <div class="file-manager-panel__row-cell file-manager-panel__row-cell--size">
                  {{ record.directory ? '-' : formatBytes(record.size) }}
                </div>
                <div
                  class="file-manager-panel__row-cell file-manager-panel__row-cell--permission"
                  :title="getPermissionTooltip(record)"
                >
                  <span
                    class="file-manager-panel__row-permission-badge"
                    :class="{ 'is-write': record.canWrite }"
                  >
                    {{ record.canWrite ? $t('Terminal.index.remote-160') : $t('Terminal.index.remote-137') }}
                  </span>
                  <span class="file-manager-panel__row-permission-code">
                    {{ formatPermissionTriplet(record) }}
                  </span>
                </div>
                <div class="file-manager-panel__row-cell file-manager-panel__row-cell--actions">
                  <a-tooltip v-if="record.directory" :title="$t('Terminal.index.remote-117')">
                    <button
                      type="button"
                      class="file-manager-panel__action-btn"
                      @click.stop="enterDirectory(record)"
                    >
                      <AIcon type="FolderOpenOutlined" />
                    </button>
                  </a-tooltip>
                  <a-tooltip v-if="isPreviewable(record)" :title="$t('Terminal.index.remote-162')">
                    <button
                      type="button"
                      class="file-manager-panel__action-btn"
                      @click.stop="openPreviewFromCard(record)"
                    >
                      <AIcon type="EyeOutlined" />
                    </button>
                  </a-tooltip>
                  <a-tooltip v-if="!record.directory" :title="$t('Terminal.index.remote-118')">
                    <button
                      type="button"
                      class="file-manager-panel__action-btn"
                      :disabled="downloading"
                      @click.stop="downloadRecord(record)"
                    >
                      <AIcon type="DownloadOutlined" />
                    </button>
                  </a-tooltip>
                </div>
              </article>

              <template #overlay>
                <a-menu>
                  <a-menu-item v-if="record.directory" @click="enterDirectory(record)">
                    <AIcon type="FolderOpenOutlined" />
                    <span>{{ $t('Terminal.index.remote-117') }}</span>
                  </a-menu-item>
                  <a-menu-item
                    v-else-if="isPreviewable(record)"
                    @click="openPreviewFromCard(record)"
                  >
                    <AIcon type="EyeOutlined" />
                    <span>{{ $t('Terminal.index.remote-162') }}</span>
                  </a-menu-item>
                  <a-menu-item v-if="!record.directory" :disabled="downloading" @click="downloadRecord(record)">
                    <AIcon type="DownloadOutlined" />
                    <span>{{ $t('Terminal.index.remote-118') }}</span>
                  </a-menu-item>
                  <a-menu-item :disabled="!record.canWrite" @click="openRename(record)">
                    <AIcon type="EditOutlined" />
                    <span>{{ $t('Terminal.index.remote-119') }}</span>
                  </a-menu-item>
                  <a-menu-item :disabled="!record.canWrite" @click="confirmDelete(record)">
                    <AIcon type="DeleteOutlined" />
                    <span>{{ $t('Terminal.index.remote-120') }}</span>
                  </a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </div>

          <a-empty v-else :description="$t('Terminal.index.remote-121')" class="file-manager-panel__empty">
            <template #image>
              <AIcon type="InboxOutlined" class="file-manager-panel__empty-icon" />
            </template>
          </a-empty>
        </a-spin>

        <div v-if="dragActive" class="file-manager-panel__drop-mask">
          <AIcon type="InboxOutlined" class="file-manager-panel__drop-icon" />
          <div class="file-manager-panel__drop-title">{{ $t('Terminal.index.remote-158') }}</div>
          <div class="file-manager-panel__drop-path" :title="displayPath || '-'">{{ displayPath || '-' }}</div>
        </div>

        <div
          v-if="contentMenuVisible"
          class="file-manager-panel__context-menu"
          :style="{ left: `${contentMenuPosition.x}px`, top: `${contentMenuPosition.y}px` }"
          @click.stop
        >
          <button type="button" class="file-manager-panel__context-item" @click="runContentMenuAction(refreshFileList)">
            <AIcon type="ReloadOutlined" />
            <span>{{ $t('Terminal.index.remote-103') }}</span>
          </button>
          <button
            type="button"
            class="file-manager-panel__context-item"
            :disabled="!displayPath || !online"
            @click="runContentMenuAction(openCreateDir)"
          >
            <AIcon type="FolderAddOutlined" />
            <span>{{ $t('Terminal.index.remote-107') }}</span>
          </button>
          <button
            type="button"
            class="file-manager-panel__context-item"
            :disabled="!fileList.length"
            @click="runContentMenuAction(selectAllRecords)"
          >
            <AIcon type="CheckSquareOutlined" />
            <span>{{ $t('Terminal.index.remote-165') }}</span>
          </button>
          <button
            type="button"
            class="file-manager-panel__context-item"
            :disabled="!selectedRecords.length"
            @click="runContentMenuAction(clearSelection)"
          >
            <AIcon type="CloseCircleOutlined" />
            <span>{{ $t('Terminal.index.remote-170') }}</span>
          </button>
        </div>
      </div>

      <div class="file-manager-panel__status-bar">
        <div class="file-manager-panel__status-meta">
          <span>{{ $t('Terminal.index.remote-155') }} {{ fileList.length }}</span>
          <span>{{ $t('Terminal.index.remote-115') }} {{ directoryCount }}</span>
          <span>{{ $t('Terminal.index.remote-116') }} {{ fileCount }}</span>
        </div>
        <div v-if="selectedRecords.length" class="file-manager-panel__status-selection">
          <span class="file-manager-panel__status-selection-text">
            {{ $t('Terminal.index.remote-164', { count: selectedRecords.length }) }}
          </span>
          <a-button type="link" size="small" :disabled="!fileList.length" @click="selectAllRecords">
            {{ $t('Terminal.index.remote-165') }}
          </a-button>
          <a-button type="link" size="small" :disabled="!selectedFileRecords.length || downloading" @click="downloadSelectedRecords">
            {{ $t('Terminal.index.remote-168') }}
          </a-button>
          <a-button type="link" size="small" danger :disabled="!selectedWritableRecords.length" @click="confirmDeleteSelected">
            {{ $t('Terminal.index.remote-169') }}
          </a-button>
          <a-button type="link" size="small" @click="clearSelection">
            {{ $t('Terminal.index.remote-170') }}
          </a-button>
        </div>
        <span v-else class="file-manager-panel__status-tip">{{ $t('Terminal.index.remote-157') }}</span>
      </div>
    </div>

    <a-modal
      v-model:open="previewOpen"
      :title="previewTitle"
      :footer="null"
      width="920px"
      @cancel="closePreview"
    >
      <a-spin :spinning="previewLoading" class="file-manager-panel__preview-spin">
        <div v-if="previewMode === 'image'" class="file-manager-panel__preview file-manager-panel__preview--image">
          <img :src="previewImageUrl" :alt="previewRecord?.name || 'preview'" class="file-manager-panel__preview-image" />
        </div>
        <pre v-else-if="previewMode === 'text'" class="file-manager-panel__preview file-manager-panel__preview-text">{{ previewText }}</pre>
        <a-empty v-else :description="$t('Terminal.index.remote-167')" class="file-manager-panel__preview-empty" />
      </a-spin>
    </a-modal>

    <a-modal
      v-model:open="createDirOpen"
      :title="$t('Terminal.index.remote-122')"
      :confirm-loading="submitting"
      @ok="submitCreateDir"
      @cancel="resetCreateDir"
    >
      <a-form layout="vertical">
        <a-form-item :label="$t('Terminal.index.remote-123')">
          <a-input v-model:value="createDirName" :placeholder="$t('Terminal.index.remote-123')" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="renameOpen"
      :title="$t('Terminal.index.remote-124')"
      :confirm-loading="submitting"
      @ok="submitRename"
      @cancel="resetRename"
    >
      <a-form layout="vertical">
        <a-form-item :label="$t('Terminal.index.remote-125')">
          <a-input v-model:value="renameName" :placeholder="$t('Terminal.index.remote-125')" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import { Modal } from 'ant-design-vue'
import { getToken, onlyMessage } from '@jetlinks-web/utils'
import { TOKEN_KEY } from '@jetlinks-web/constants'
import { getBaseApi } from '@jetlinks-web-core/utils'
import {
  createRemoteSystemDirectory,
  deleteRemoteSystemFile,
  downloadRemoteSystemFile,
  getRemoteSystemWorkingDirectory,
  listRemoteSystemFiles,
  moveRemoteSystemFile,
  uploadRemoteSystemFile,
  type RemoteSystemFileInfo,
} from '../../../../../../api/instance'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  deviceId: string
  online: boolean
}>()

const { t: $t } = useI18n()

const loading = ref(false)
const uploading = ref(false)
const submitting = ref(false)
const dragActive = ref(false)
const dragCounter = ref(0)
const previewOpen = ref(false)
const previewLoading = ref(false)
const previewMode = ref<'image' | 'text' | ''>('')
const previewText = ref('')
const previewImageUrl = ref('')
const previewRecord = ref<RemoteSystemFileInfo | null>(null)
const workingDirectory = ref('')
const currentPath = ref('')
const activePath = ref('')
const selectedPaths = ref<string[]>([])
const searchText = ref('')
const fileList = ref<RemoteSystemFileInfo[]>([])
const contentRef = ref<HTMLElement>()
const contentMenuVisible = ref(false)
const contentMenuPosition = reactive({
  x: 0,
  y: 0,
})
const MAX_TEXT_PREVIEW_SIZE = 1024 * 1024
const MAX_IMAGE_PREVIEW_SIZE = 5 * 1024 * 1024
const uploadCurrentName = ref('')
const uploadCurrentIndex = ref(0)
const uploadTotalCount = ref(0)
const uploadProgressPercent = ref(0)
const downloading = ref(false)
const downloadCurrentName = ref('')
const downloadCurrentIndex = ref(0)
const downloadTotalCount = ref(0)
const downloadProgressPercent = ref(0)
const downloadLoadedBytes = ref(0)
const downloadTotalBytes = ref(0)
const DEFAULT_SORT_ORDER: Record<'name' | 'kind' | 'modifyTime' | 'size', 'asc' | 'desc'> = {
  name: 'asc',
  kind: 'asc',
  modifyTime: 'desc',
  size: 'desc',
}

const createDirOpen = ref(false)
const createDirName = ref('')
const renameOpen = ref(false)
const renameName = ref('')
const renameTarget = ref<RemoteSystemFileInfo | null>(null)
const sortField = ref<'name' | 'kind' | 'modifyTime' | 'size'>('name')
const sortOrder = ref<'asc' | 'desc'>(DEFAULT_SORT_ORDER.name)
let previewTaskId = 0
let uploadTaskId = 0
let uploadController: AbortController | null = null
let pendingUploadFiles: File[] = []
let pendingUploadTimer: number | null = null
let uploadCancelSilent = false
let downloadTaskId = 0
let downloadController: AbortController | null = null
let downloadCancelSilent = false

const displayPath = computed(() => currentPath.value || workingDirectory.value)
const directoryCount = computed(() => fileList.value.filter((item) => item.directory).length)
const fileCount = computed(() => fileList.value.filter((item) => !item.directory).length)
const previewTitle = computed(() => previewRecord.value?.name || ($t('Terminal.index.remote-162') as string))
const selectedRecords = computed(() =>
  displayFileList.value.filter((item) => selectedPaths.value.includes(item.path)),
)
const selectedFileRecords = computed(() =>
  selectedRecords.value.filter((item) => !item.directory),
)
const selectedWritableRecords = computed(() =>
  selectedRecords.value.filter((item) => item.canWrite),
)
const uploadProcessing = computed(() => uploading.value && uploadProgressPercent.value >= 100)
const downloadProcessing = computed(() => downloading.value && downloadProgressPercent.value >= 100)
const downloadSizeText = computed(() => {
  const loaded = formatBytes(downloadLoadedBytes.value)
  if (downloadTotalBytes.value > 0) {
    return `${loaded} / ${formatBytes(downloadTotalBytes.value)}`
  }
  return loaded
})
const selectAllChecked = computed(() =>
  !!fileList.value.length && selectedPaths.value.length === fileList.value.length,
)
const selectAllIndeterminate = computed(
  () => selectedPaths.value.length > 0 && selectedPaths.value.length < fileList.value.length,
)

const canGoUp = computed(() => {
  if (!displayPath.value) return false
  const current = trimPath(displayPath.value)
  const working = trimPath(workingDirectory.value)
  if (!current || current === '/' || current === '\\') return false
  if (current === working) return false
  if (/^[A-Za-z]:\\?$/.test(current)) return false
  return true
})

const pathSegments = computed(() => getPathSegments(displayPath.value))
const textCollator = new Intl.Collator('zh-Hans-CN', {
  numeric: true,
  sensitivity: 'base',
})

const trimPath = (path: string) => {
  if (!path) return ''
  if (path === '/' || path === '\\') return path
  if (/^[A-Za-z]:[\\/]?$/.test(path)) return path.replace('/', '\\')
  return path.replace(/[\\/]+$/, '')
}

const joinPath = (base: string, name: string) => {
  const root = trimPath(base)
  if (!root) return name
  if (root === '/' || root === '\\') return `${root}${name}`
  if (/^[A-Za-z]:\\?$/.test(root)) return `${root}${root.endsWith('\\') ? '' : '\\'}${name}`
  const separator = root.includes('\\') && !root.includes('/') ? '\\' : '/'
  return `${root}${separator}${name}`
}

const getParentPath = (path: string) => {
  const current = trimPath(path)
  if (!current || current === '/' || current === '\\') return current
  if (/^[A-Za-z]:\\?$/.test(current)) return current
  const index = Math.max(current.lastIndexOf('/'), current.lastIndexOf('\\'))
  if (index < 0) return current
  const parent = current.slice(0, index)
  if (!parent) {
    return current.includes('\\') ? '\\' : '/'
  }
  if (/^[A-Za-z]:$/.test(parent)) {
    return `${parent}\\`
  }
  return parent
}

const getPathSegments = (path: string) => {
  const current = trimPath(path)
  if (!current) return []

  const segments: Array<{ label: string; path: string }> = []
  const windowsDrive = current.match(/^[A-Za-z]:/)
  const separator = current.includes('\\') && !current.includes('/') ? '\\' : '/'
  let cursor = ''
  let rest = current

  if (windowsDrive) {
    cursor = `${windowsDrive[0]}\\`
    rest = current.slice(windowsDrive[0].length).replace(/^[\\/]+/, '')
    segments.push({ label: cursor, path: cursor })
  } else if (current.startsWith('/') || current.startsWith('\\')) {
    cursor = current.startsWith('\\') ? '\\' : '/'
    rest = current.slice(1)
    segments.push({ label: cursor, path: cursor })
  }

  rest
    .split(/[\\/]+/)
    .filter(Boolean)
    .forEach((part) => {
      if (!cursor) {
        cursor = part
      } else if (cursor === '/' || cursor === '\\') {
        cursor = `${cursor}${part}`
      } else if (/^[A-Za-z]:\\?$/.test(cursor)) {
        cursor = `${cursor}${cursor.endsWith('\\') ? '' : '\\'}${part}`
      } else {
        cursor = `${cursor}${separator}${part}`
      }
      segments.push({ label: part, path: cursor })
    })

  return segments
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const ensureSuccess = (resp: any) => {
  if (resp?.success === false) {
    throw new Error(resp?.message || resp?.result || '')
  }
  if (resp?.status && resp.status !== 200) {
    throw new Error(resp?.message || `${resp.status}`)
  }
  return resp?.result
}

const formatBytes = (value?: number | string) => {
  const num = Number(value)
  if (!Number.isFinite(num) || num < 0) return '-'
  if (num < 1024) return `${Math.round(num)} B`
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(2)} KB`
  if (num < 1024 * 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(2)} MB`
  return `${(num / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

const formatTime = (value?: number) => {
  if (!value) return '-'
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss')
}

const getMediaTypeValue = (record: RemoteSystemFileInfo) => {
  if (typeof record.mediaType === 'string') {
    return record.mediaType
  }
  if (
    record.mediaType &&
    typeof record.mediaType !== 'string' &&
    record.mediaType.type &&
    record.mediaType.subtype
  ) {
    return `${record.mediaType.type}/${record.mediaType.subtype}`
  }
  return ''
}

const getFileExtension = (record: RemoteSystemFileInfo) => record.name.split('.').pop()?.toLowerCase() || ''

const getFileKind = (record: RemoteSystemFileInfo) => {
  if (record.directory) {
    return $t('Terminal.index.remote-115')
  }
  return getMediaTypeValue(record) || ($t('Terminal.index.remote-116') as string)
}

const isImagePreviewable = (record: RemoteSystemFileInfo) => getMediaTypeValue(record).startsWith('image/')

const isTextPreviewable = (record: RemoteSystemFileInfo) => {
  const mediaType = getMediaTypeValue(record)
  if (
    mediaType.startsWith('text/') ||
    mediaType.includes('json') ||
    mediaType.includes('xml') ||
    mediaType.includes('yaml') ||
    mediaType.includes('javascript')
  ) {
    return true
  }

  return [
    'txt',
    'log',
    'md',
    'json',
    'xml',
    'yml',
    'yaml',
    'html',
    'htm',
    'css',
    'js',
    'ts',
    'java',
    'sql',
    'csv',
    'properties',
    'conf',
    'ini',
    'sh',
    'svg',
  ].includes(getFileExtension(record))
}

const getPreviewMode = (record: RemoteSystemFileInfo): 'image' | 'text' | '' => {
  if (record.directory) return ''

  const size = Number(record.size) || 0
  if (isImagePreviewable(record) && size <= MAX_IMAGE_PREVIEW_SIZE) {
    return 'image'
  }
  if (isTextPreviewable(record) && size <= MAX_TEXT_PREVIEW_SIZE) {
    return 'text'
  }
  return ''
}

const isPreviewable = (record: RemoteSystemFileInfo) => !!getPreviewMode(record)

const getPermissionSet = (record: RemoteSystemFileInfo) =>
  new Set((Array.isArray(record.permission) ? record.permission : []).map((item) => String(item)))

const formatPermissionTriplet = (record: RemoteSystemFileInfo) => {
  const permissionSet = getPermissionSet(record)
  if (!permissionSet.size) {
    return record.canWrite ? ($t('Terminal.index.remote-160') as string) : ($t('Terminal.index.remote-137') as string)
  }

  const formatGroup = (prefix: 'OWNER' | 'GROUP' | 'OTHERS') =>
    `${permissionSet.has(`${prefix}_READ`) ? 'r' : '-'}${permissionSet.has(`${prefix}_WRITE`) ? 'w' : '-'}${permissionSet.has(`${prefix}_EXECUTE`) ? 'x' : '-'}`

  return `${formatGroup('OWNER')} ${formatGroup('GROUP')} ${formatGroup('OTHERS')}`
}

const getPermissionTooltip = (record: RemoteSystemFileInfo) => {
  const permissions = Array.from(getPermissionSet(record))
  return permissions.length ? permissions.join(', ') : ($t('Terminal.index.remote-161') as string)
}

const compareText = (left?: string, right?: string) =>
  textCollator.compare(left || '', right || '')

const compareNumber = (left?: number, right?: number) => (Number(left) || 0) - (Number(right) || 0)

const compareDirectory = (left: RemoteSystemFileInfo, right: RemoteSystemFileInfo) =>
  Number(right.directory) - Number(left.directory)

const compareRecord = (
  left: RemoteSystemFileInfo,
  right: RemoteSystemFileInfo,
  field: 'name' | 'kind' | 'modifyTime' | 'size',
) => {
  switch (field) {
    case 'kind':
      return compareText(getFileKind(left), getFileKind(right))
    case 'modifyTime':
      return compareNumber(left.modifyTime, right.modifyTime)
    case 'size':
      return compareNumber(left.size, right.size)
    case 'name':
    default:
      return compareText(left.name, right.name)
  }
}

const displayFileList = computed(() => {
  const direction = sortOrder.value === 'asc' ? 1 : -1
  return [...fileList.value].sort((left, right) => {
    const directoryDiff = compareDirectory(left, right)
    if (directoryDiff) return directoryDiff

    const primary = compareRecord(left, right, sortField.value) * direction
    if (primary) return primary
    return compareRecord(left, right, 'name')
  })
})

const toggleSort = (field: 'name' | 'kind' | 'modifyTime' | 'size') => {
  if (sortField.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
    return
  }
  sortField.value = field
  sortOrder.value = DEFAULT_SORT_ORDER[field]
}

const normalizeName = (value: string) => value.trim()

const validateName = (value: string) => {
  const name = normalizeName(value)
  if (!name) {
    onlyMessage($t('Terminal.index.remote-148') as string, 'warning')
    return ''
  }
  if (/[\\/]/.test(name)) {
    onlyMessage($t('Terminal.index.remote-134') as string, 'warning')
    return ''
  }
  return name
}

const clearPendingUploadQueue = () => {
  pendingUploadFiles = []
  if (pendingUploadTimer !== null) {
    window.clearTimeout(pendingUploadTimer)
    pendingUploadTimer = null
  }
}

const resetUploadState = () => {
  uploadController = null
  uploadCurrentName.value = ''
  uploadCurrentIndex.value = 0
  uploadTotalCount.value = 0
  uploadProgressPercent.value = 0
}

const resetDownloadState = () => {
  downloadController = null
  downloadCurrentName.value = ''
  downloadCurrentIndex.value = 0
  downloadTotalCount.value = 0
  downloadProgressPercent.value = 0
  downloadLoadedBytes.value = 0
  downloadTotalBytes.value = 0
}

const isUploadCanceled = (err: any) =>
  err?.code === 'ERR_CANCELED' ||
  err?.name === 'AbortError' ||
  err?.message === 'canceled' ||
  err?.message === 'Request aborted'

const isDownloadCanceled = (err: any) =>
  err?.name === 'AbortError' ||
  err?.code === 'ERR_CANCELED' ||
  err?.message === 'canceled'

const resetDragState = () => {
  dragCounter.value = 0
  dragActive.value = false
}

const closeContentMenu = () => {
  contentMenuVisible.value = false
}

const revokePreviewImage = () => {
  if (previewImageUrl.value) {
    URL.revokeObjectURL(previewImageUrl.value)
    previewImageUrl.value = ''
  }
}

const closePreview = () => {
  previewTaskId += 1
  previewOpen.value = false
  previewLoading.value = false
  previewMode.value = ''
  previewText.value = ''
  previewRecord.value = null
  revokePreviewImage()
}

const loadWorkingDirectory = async () => {
  const resp = await getRemoteSystemWorkingDirectory(props.deviceId)
  const result = ensureSuccess(resp)
  workingDirectory.value = result || ''
  if (!currentPath.value) {
    currentPath.value = workingDirectory.value
  }
}

const loadFileList = async (path = displayPath.value) => {
  if (!props.deviceId || !path) return
  loading.value = true
  try {
    const filterText = searchText.value.trim()
    const resp = await listRemoteSystemFiles(props.deviceId, {
      path,
      filter: filterText
        ? {
            id: 'fileName',
            configuration: {
              pattern: escapeRegExp(filterText),
            },
          }
        : undefined,
    })
    fileList.value = ensureSuccess(resp) || []
    currentPath.value = path
    selectedPaths.value = selectedPaths.value.filter((item) =>
      fileList.value.some((file) => file.path === item),
    )
    if (!fileList.value.some((item) => item.path === activePath.value)) {
      activePath.value = ''
    }
  } catch (err: any) {
    fileList.value = []
    onlyMessage(err?.message || ($t('Terminal.index.remote-128') as string), 'error')
  } finally {
    loading.value = false
  }
}

const initFileManager = async () => {
  if (!props.deviceId || !props.online) return
  try {
    await loadWorkingDirectory()
    await loadFileList(currentPath.value || workingDirectory.value)
  } catch (err: any) {
    onlyMessage(err?.message || ($t('Terminal.index.remote-128') as string), 'error')
  }
}

const refreshFileList = () => {
  loadFileList(displayPath.value)
}

const openPath = (path: string) => {
  if (path && path !== displayPath.value) {
    loadFileList(path)
  }
}

const selectRecord = (record: RemoteSystemFileInfo) => {
  activePath.value = record.path
}

const toggleRecordSelection = (record: RemoteSystemFileInfo, checked: boolean) => {
  selectRecord(record)
  if (checked) {
    selectedPaths.value = Array.from(new Set([...selectedPaths.value, record.path]))
    return
  }
  selectedPaths.value = selectedPaths.value.filter((item) => item !== record.path)
}

const handleRecordClick = (record: RemoteSystemFileInfo, event: MouseEvent) => {
  closeContentMenu()
  if (event.ctrlKey || event.metaKey) {
    const checked = !selectedPaths.value.includes(record.path)
    toggleRecordSelection(record, checked)
    return
  }
  activePath.value = record.path
  selectedPaths.value = [record.path]
}

const selectAllRecords = () => {
  selectedPaths.value = displayFileList.value.map((item) => item.path)
  activePath.value = selectedPaths.value[0] || ''
}

const toggleSelectAll = (checked: boolean) => {
  if (checked) {
    selectAllRecords()
    return
  }
  clearSelection()
}

const clearSelection = () => {
  selectedPaths.value = []
  activePath.value = ''
}

const enterDirectory = (record: RemoteSystemFileInfo) => {
  loadFileList(record.path)
}

const previewRecordFile = async (record: RemoteSystemFileInfo) => {
  const mode = getPreviewMode(record)
  if (!mode) {
    onlyMessage($t('Terminal.index.remote-163') as string, 'warning')
    return
  }

  const currentTaskId = ++previewTaskId
  previewLoading.value = true
  previewRecord.value = record
  previewMode.value = ''
  previewText.value = ''
  revokePreviewImage()
  previewOpen.value = true

  try {
    const resp = await downloadRemoteSystemFile(props.deviceId, record.path)
    const blob = resp instanceof Blob ? resp : new Blob([resp])
    if (currentTaskId !== previewTaskId) return

    if (mode === 'image') {
      const objectUrl = URL.createObjectURL(blob)
      if (currentTaskId !== previewTaskId) {
        URL.revokeObjectURL(objectUrl)
        return
      }
      previewMode.value = 'image'
      previewImageUrl.value = objectUrl
      return
    }

    const text = await blob.text()
    if (currentTaskId !== previewTaskId) return
    previewMode.value = 'text'
    previewText.value = text
  } catch (err: any) {
    if (currentTaskId !== previewTaskId) return
    closePreview()
    onlyMessage(err?.message || ($t('Terminal.index.remote-166') as string), 'error')
  } finally {
    if (currentTaskId === previewTaskId) {
      previewLoading.value = false
    }
  }
}

const handleItemDoubleClick = (record: RemoteSystemFileInfo) => {
  selectRecord(record)
  if (record.directory) {
    enterDirectory(record)
    return
  }
  if (isPreviewable(record)) {
    previewRecordFile(record)
    return
  }
  onlyMessage($t('Terminal.index.remote-163') as string, 'warning')
}

const handleRecordContextMenu = (record: RemoteSystemFileInfo) => {
  selectRecord(record)
  if (!selectedPaths.value.includes(record.path)) {
    selectedPaths.value = [record.path]
  }
}

const goUp = () => {
  const parent = getParentPath(displayPath.value)
  if (parent && parent !== displayPath.value) {
    loadFileList(parent)
  }
}

const goHome = () => {
  if (workingDirectory.value) {
    loadFileList(workingDirectory.value)
  }
}

const saveBlob = (blobData: any, fileName: string) => {
  const blob = blobData instanceof Blob ? blobData : new Blob([blobData])
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const getDownloadUrl = (record: RemoteSystemFileInfo) =>
  `${getBaseApi().replace(/\/$/, '')}/edge/device/${props.deviceId}/_/file/system/download?fileName=${encodeURIComponent(record.path)}`

const readDownloadError = async (response: Response) => {
  const text = await response.text().catch(() => '')
  if (!text) {
    throw new Error(`HTTP ${response.status}`)
  }
  let message = text
  try {
    const json = JSON.parse(text)
    message = json?.message || json?.result || text
  } catch {
    message = text
  }
  throw new Error(message)
}

const setDownloadProgress = (value: number) => {
  downloadProgressPercent.value = Math.max(0, Math.min(100, Math.round(value)))
}

const setDownloadByteState = (loaded: number, total = downloadTotalBytes.value) => {
  downloadLoadedBytes.value = Math.max(0, loaded)
  downloadTotalBytes.value = Math.max(0, total)
}

const updateDownloadByteProgress = (downloadedBytes: number, totalBytes: number, currentLoaded = 0) => {
  if (totalBytes <= 0) return
  setDownloadByteState(downloadedBytes + Math.max(currentLoaded, 0), totalBytes)
  setDownloadProgress(((downloadedBytes + Math.max(currentLoaded, 0)) / totalBytes) * 100)
}

const updateDownloadCountProgress = (
  completedCount: number,
  totalCount: number,
  currentLoaded = 0,
  currentTotal = 0,
) => {
  if (totalCount <= 0) return
  const partial = currentTotal > 0 ? Math.min(currentLoaded, currentTotal) / currentTotal : 0
  setDownloadProgress(((completedCount + partial) / totalCount) * 100)
}

const streamDownloadBlob = async (
  response: Response,
  totalBytes: number,
  currentFileTotal: number,
  downloadedBytes: number,
  totalCount: number,
  currentIndex: number,
  currentTaskId: number,
) => {
  const reader = response.body?.getReader()
  if (!reader) {
    const blob = await response.blob()
    if (currentTaskId === downloadTaskId) {
      if (totalBytes > 0) {
        updateDownloadByteProgress(downloadedBytes, totalBytes, blob.size)
      } else {
        setDownloadByteState(downloadedBytes + blob.size, downloadedBytes + Math.max(currentFileTotal, blob.size))
        updateDownloadCountProgress(currentIndex, totalCount, 1, 1)
      }
    }
    return blob
  }

  const chunks: Uint8Array[] = []
  let loaded = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    chunks.push(value)
    loaded += value.byteLength
    if (currentTaskId !== downloadTaskId) continue
    if (totalBytes > 0) {
      updateDownloadByteProgress(downloadedBytes, totalBytes, loaded)
    } else {
      setDownloadByteState(downloadedBytes + loaded, downloadedBytes + Math.max(currentFileTotal, loaded))
      updateDownloadCountProgress(currentIndex, totalCount, loaded, Math.max(loaded, 1))
    }
  }

  return new Blob(chunks, {
    type: response.headers.get('content-type') || 'application/octet-stream',
  })
}

const cancelDownload = (silent = false) => {
  downloadCancelSilent = silent
  downloadController?.abort()
}

const downloadFiles = async (records: RemoteSystemFileInfo[]) => {
  if (!records.length || downloading.value) return

  const currentTaskId = ++downloadTaskId
  const token = typeof getToken === 'function' ? getToken() : ''
  const headers: Record<string, string> = {}
  if (token) {
    headers[TOKEN_KEY] = token
  }

  downloading.value = true
  downloadCurrentIndex.value = 0
  downloadTotalCount.value = records.length
  downloadCurrentName.value = ''
  downloadProgressPercent.value = 0

  let success = 0
  let lastError: any = null
  let canceled = false
  let downloadedBytes = 0
  const totalBytes = records.reduce((sum, item) => sum + Math.max(Number(item.size) || 0, 0), 0)
  setDownloadByteState(0, totalBytes)

  try {
    for (const [index, record] of records.entries()) {
      downloadCurrentIndex.value = index + 1
      downloadCurrentName.value = record.name
      const controller = new AbortController()
      downloadController = controller

      try {
        const response = await fetch(getDownloadUrl(record), {
          method: 'GET',
          headers,
          credentials: 'include',
          signal: controller.signal,
        })

        if (!response.ok) {
          await readDownloadError(response)
        }

        const responseLength = Number(response.headers.get('content-length')) || 0
        const blob = await streamDownloadBlob(
          response,
          totalBytes || responseLength || Math.max(Number(record.size) || 0, 0),
          responseLength || Math.max(Number(record.size) || 0, 0),
          downloadedBytes,
          records.length,
          index,
          currentTaskId,
        )
        if (currentTaskId !== downloadTaskId) return

        saveBlob(blob, record.name)
        success += 1
        downloadedBytes += responseLength || Math.max(Number(record.size) || 0, blob.size, 0)

        if (totalBytes > 0) {
          updateDownloadByteProgress(downloadedBytes, totalBytes)
        } else {
          setDownloadByteState(downloadedBytes, downloadedBytes)
          updateDownloadCountProgress(index + 1, records.length)
        }
      } catch (err: any) {
        if (isDownloadCanceled(err)) {
          canceled = true
          break
        }
        lastError = err
        break
      } finally {
        if (downloadController === controller) {
          downloadController = null
        }
      }
    }

    if (canceled) {
      if (!downloadCancelSilent) {
        onlyMessage(
          success > 0
            ? ($t('Terminal.index.remote-179', { success, total: records.length }) as string)
            : ($t('Terminal.index.remote-178') as string),
          'warning',
        )
      }
      return
    }

    if (lastError) {
      onlyMessage(lastError?.message || ($t('Terminal.index.remote-138') as string), 'error')
    }
  } finally {
    downloading.value = false
    downloadCancelSilent = false
    resetDownloadState()
  }
}

const downloadRecord = (record: RemoteSystemFileInfo) => {
  selectRecord(record)
  downloadFiles([record])
}

const downloadSelectedRecords = async () => {
  closeContentMenu()
  await downloadFiles([...selectedFileRecords.value])
}

const openPreviewFromCard = (record: RemoteSystemFileInfo) => {
  selectRecord(record)
  previewRecordFile(record)
}

const selectUploadedRecord = (paths: string[]) => {
  if (!paths.length) return
  const normalizedPaths = paths.map((item) => trimPath(item))
  const targets = fileList.value.filter(
    (item) =>
      normalizedPaths.includes(trimPath(item.path)) ||
      normalizedPaths.some((path) => path.endsWith(item.name)),
  )

  if (targets.length) {
    selectedPaths.value = targets.map((item) => item.path)
    activePath.value = targets[targets.length - 1].path
  }
}

const setUploadProgress = (value: number) => {
  uploadProgressPercent.value = Math.max(0, Math.min(100, Math.round(value)))
}

const updateUploadByteProgress = (uploadedBytes: number, totalBytes: number, currentLoaded = 0) => {
  if (totalBytes <= 0) return
  setUploadProgress(((uploadedBytes + Math.max(currentLoaded, 0)) / totalBytes) * 100)
}

const updateUploadCountProgress = (
  completedCount: number,
  totalCount: number,
  currentLoaded = 0,
  currentTotal = 0,
) => {
  if (totalCount <= 0) return
  const partial = currentTotal > 0 ? Math.min(currentLoaded, currentTotal) / currentTotal : 0
  setUploadProgress(((completedCount + partial) / totalCount) * 100)
}

const cancelUpload = (silent = false) => {
  clearPendingUploadQueue()
  uploadCancelSilent = silent
  uploadController?.abort()
}

const uploadFiles = async (files: File[]) => {
  if (!displayPath.value || !files.length || uploading.value) return

  const currentUploadId = ++uploadTaskId
  uploading.value = true
  uploadCurrentIndex.value = 0
  uploadTotalCount.value = files.length
  uploadCurrentName.value = ''
  uploadProgressPercent.value = 0
  let success = 0
  let lastError: any = null
  let canceled = false
  let uploadedBytes = 0
  const totalBytes = files.reduce((sum, file) => sum + Math.max(Number(file.size) || 0, 0), 0)
  const uploadedPaths: string[] = []

  try {
    for (const [index, file] of files.entries()) {
      uploadCurrentIndex.value = index + 1
      uploadCurrentName.value = file.name
      const formData = new FormData()
      formData.append('file', file)
      const controller = new AbortController()
      uploadController = controller
      try {
        await uploadRemoteSystemFile(props.deviceId, displayPath.value, formData, {
          signal: controller.signal,
          onUploadProgress: (event: any) => {
            if (currentUploadId !== uploadTaskId) return
            const loaded = Number(event?.loaded) || 0
            const total = Number(event?.total) || Math.max(Number(file.size) || 0, 0)
            if (totalBytes > 0) {
              updateUploadByteProgress(uploadedBytes, totalBytes, loaded)
            } else {
              updateUploadCountProgress(index, files.length, loaded, total)
            }
          },
        })
        success += 1
        uploadedBytes += Math.max(Number(file.size) || 0, 0)
        if (totalBytes > 0) {
          updateUploadByteProgress(uploadedBytes, totalBytes)
        } else {
          updateUploadCountProgress(index + 1, files.length)
        }
        uploadedPaths.push(joinPath(displayPath.value, file.name))
      } catch (err: any) {
        if (isUploadCanceled(err)) {
          canceled = true
          break
        }
        lastError = err
      } finally {
        if (uploadController === controller) {
          uploadController = null
        }
      }
    }

    if (success > 0) {
      await loadFileList(displayPath.value)
      selectUploadedRecord(uploadedPaths)
    }

    if (canceled) {
      if (!uploadCancelSilent) {
        onlyMessage(
          success > 0
            ? ($t('Terminal.index.remote-175', { success, total: files.length }) as string)
            : ($t('Terminal.index.remote-174') as string),
          'warning',
        )
      }
      return
    }

    if (success === files.length) {
      onlyMessage(
        files.length > 1
          ? ($t('Terminal.index.remote-159', { success, total: files.length }) as string)
          : ($t('Terminal.index.remote-129') as string),
      )
      return
    }

    if (success > 0) {
      onlyMessage($t('Terminal.index.remote-159', { success, total: files.length }) as string, 'warning')
      return
    }

    onlyMessage(lastError?.message || ($t('Terminal.index.remote-130') as string), 'error')
  } finally {
    uploading.value = false
    uploadCancelSilent = false
    resetUploadState()
  }
}

const flushPendingUploads = () => {
  const files = [...pendingUploadFiles]
  clearPendingUploadQueue()
  uploadFiles(files)
}

const handleBeforeUpload = async (file: File) => {
  if (!displayPath.value || uploading.value) {
    return false
  }
  pendingUploadFiles.push(file)
  if (pendingUploadTimer === null) {
    pendingUploadTimer = window.setTimeout(flushPendingUploads, 0)
  }
  return false
}

const hasDraggedFiles = (event: DragEvent) =>
  Array.from(event.dataTransfer?.types || []).includes('Files')

const handleDragEnter = (event: DragEvent) => {
  if (!props.online || !displayPath.value || uploading.value || !hasDraggedFiles(event)) return
  dragCounter.value += 1
  dragActive.value = true
}

const handleDragOver = (event: DragEvent) => {
  if (!props.online || !displayPath.value || uploading.value || !hasDraggedFiles(event)) return
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

const handleDragLeave = (event: DragEvent) => {
  if (!dragActive.value || !hasDraggedFiles(event)) return
  dragCounter.value = Math.max(dragCounter.value - 1, 0)
  if (!dragCounter.value) {
    dragActive.value = false
  }
}

const handleDropUpload = async (event: DragEvent) => {
  const files = Array.from(event.dataTransfer?.files || [])
  resetDragState()
  if (!props.online || !displayPath.value || uploading.value || !files.length) return
  await uploadFiles(files)
}

const openCreateDir = () => {
  createDirName.value = ''
  createDirOpen.value = true
}

const resetCreateDir = () => {
  createDirOpen.value = false
  createDirName.value = ''
}

const submitCreateDir = async () => {
  const name = validateName(createDirName.value)
  if (!name || !displayPath.value) return
  submitting.value = true
  try {
    await createRemoteSystemDirectory(props.deviceId, joinPath(displayPath.value, name))
    onlyMessage($t('Terminal.index.remote-150') as string)
    resetCreateDir()
    await loadFileList(displayPath.value)
  } catch (err: any) {
    onlyMessage(err?.message || ($t('Terminal.index.remote-131') as string), 'error')
  } finally {
    submitting.value = false
  }
}

const openRename = (record: RemoteSystemFileInfo) => {
  renameTarget.value = record
  renameName.value = record.name
  renameOpen.value = true
}

const resetRename = () => {
  renameOpen.value = false
  renameName.value = ''
  renameTarget.value = null
}

const submitRename = async () => {
  const name = validateName(renameName.value)
  if (!name || !renameTarget.value) return
  submitting.value = true
  try {
    await moveRemoteSystemFile(props.deviceId, {
      fromPath: renameTarget.value.path,
      toPath: joinPath(getParentPath(renameTarget.value.path), name),
      copy: false,
    })
    onlyMessage($t('Terminal.index.remote-151') as string)
    resetRename()
    await loadFileList(displayPath.value)
  } catch (err: any) {
    onlyMessage(err?.message || ($t('Terminal.index.remote-132') as string), 'error')
  } finally {
    submitting.value = false
  }
}

const deleteRecords = async (records: RemoteSystemFileInfo[]) => {
  let success = 0
  let lastError: any = null

  for (const record of records) {
    try {
      await deleteRemoteSystemFile(props.deviceId, record.path)
      success += 1
    } catch (err) {
      lastError = err
    }
  }

  return {
    success,
    total: records.length,
    lastError,
  }
}

const handleDelete = async (record: RemoteSystemFileInfo) => {
  try {
    const result = await deleteRecords([record])
    if (!result.success) {
      throw result.lastError
    }
    onlyMessage($t('Terminal.index.remote-152') as string)
    if (activePath.value === record.path) {
      activePath.value = ''
    }
    selectedPaths.value = selectedPaths.value.filter((item) => item !== record.path)
    await loadFileList(displayPath.value)
  } catch (err: any) {
    onlyMessage(err?.message || ($t('Terminal.index.remote-133') as string), 'error')
  }
}

const confirmDelete = (record: RemoteSystemFileInfo) => {
  Modal.confirm({
    title: $t('Terminal.index.remote-127', { name: record.name }) as string,
    okType: 'danger',
    onOk: () => handleDelete(record),
  })
}

const confirmDeleteSelected = () => {
  const records = [...selectedWritableRecords.value]
  if (!records.length) return

  closeContentMenu()
  Modal.confirm({
    title: $t('Terminal.index.remote-171', { count: records.length }) as string,
    okType: 'danger',
    onOk: async () => {
      const result = await deleteRecords(records)
      if (!result.success) {
        onlyMessage(result.lastError?.message || ($t('Terminal.index.remote-133') as string), 'error')
        return
      }
      selectedPaths.value = []
      if (activePath.value && records.some((item) => item.path === activePath.value)) {
        activePath.value = ''
      }
      await loadFileList(displayPath.value)
      onlyMessage(
        result.total > 1
          ? ($t('Terminal.index.remote-172', { success: result.success, total: result.total }) as string)
          : ($t('Terminal.index.remote-152') as string),
        result.success === result.total ? 'success' : 'warning',
      )
    },
  })
}

const handleContentContextMenu = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null
  if (target?.closest('.file-manager-panel__row')) {
    closeContentMenu()
    return
  }

  const container = contentRef.value
  if (!container) return

  const rect = container.getBoundingClientRect()
  contentMenuPosition.x = Math.max(8, Math.min(event.clientX - rect.left, rect.width - 180))
  contentMenuPosition.y = Math.max(8, Math.min(event.clientY - rect.top, rect.height - 180))
  contentMenuVisible.value = true
}

const runContentMenuAction = (handler: () => void) => {
  closeContentMenu()
  handler()
}

onMounted(() => {
  window.addEventListener('click', closeContentMenu)
})

onBeforeUnmount(() => {
  window.removeEventListener('click', closeContentMenu)
  cancelUpload(true)
  cancelDownload(true)
  closePreview()
})

watch(
  () => props.deviceId,
  () => {
    cancelUpload(true)
    cancelDownload(true)
    closePreview()
    closeContentMenu()
    workingDirectory.value = ''
    currentPath.value = ''
    activePath.value = ''
    selectedPaths.value = []
    fileList.value = []
    searchText.value = ''
    resetDragState()
    if (props.online) {
      initFileManager()
    }
  },
  { immediate: true },
)

watch(
  () => props.online,
  (value) => {
    if (value && !workingDirectory.value) {
      initFileManager()
    }
    if (!value) {
      cancelUpload(true)
      cancelDownload(true)
      closePreview()
      closeContentMenu()
      resetDragState()
    }
  },
)
</script>

<style scoped lang="less">
.file-manager-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px 24px;
  background: linear-gradient(180deg, #f4f7fb 0%, #eef3f8 100%);
  overflow: hidden;
}

.file-manager-panel__header {
  margin-bottom: 10px;
}

.file-manager-panel__title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.file-manager-panel__title-main {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.file-manager-panel__title-icon {
  color: @primary-color;
  font-size: 16px;
}

.file-manager-panel__title {
  font-size: 15px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
}

.file-manager-panel__title-help {
  color: rgba(0, 0, 0, 0.35);
  font-size: 13px;
  cursor: pointer;
}

.file-manager-panel__offline {
  margin-bottom: 10px;
}

.file-manager-panel__workspace {
  flex: 1;
  min-height: 0;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(15, 23, 42, 0.06);
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.06);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.file-manager-panel__chrome {
  padding: 10px 12px;
  border-bottom: 1px solid #ebf0f5;
  background: linear-gradient(180deg, #fbfdff 0%, #f7fafe 100%);
}

.file-manager-panel__chrome-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.file-manager-panel__nav {
  display: inline-flex;
  gap: 6px;
}

.file-manager-panel__address {
  flex: 1;
  min-width: 0;
  padding: 8px 12px;
  border-radius: 14px;
  border: 1px solid #e6edf5;
  background: #fff;
  display: flex;
  align-items: center;
  gap: 10px;
}

.file-manager-panel__address-label {
  flex: 0 0 auto;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}

.file-manager-panel__breadcrumbs {
  min-width: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.file-manager-panel__crumb {
  padding: 2px 8px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: rgba(0, 0, 0, 0.72);
  cursor: pointer;
  transition: all 0.2s ease;
}

.file-manager-panel__crumb:hover {
  background: rgba(22, 119, 255, 0.08);
  color: @primary-color;
}

.file-manager-panel__crumb.is-current {
  background: rgba(22, 119, 255, 0.12);
  color: @primary-color;
  font-weight: 600;
}

.file-manager-panel__crumb-separator,
.file-manager-panel__crumb-empty {
  color: rgba(0, 0, 0, 0.28);
  font-size: 12px;
}

.file-manager-panel__toolbar-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.file-manager-panel__search {
  width: 220px;
  min-width: 180px;
}

.file-manager-panel__upload-strip {
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 14px;
  background: rgba(22, 119, 255, 0.05);
  border: 1px solid rgba(22, 119, 255, 0.08);
  display: flex;
  align-items: center;
  gap: 10px;
}

.file-manager-panel__upload-strip--download {
  background: rgba(15, 23, 42, 0.04);
  border-color: rgba(15, 23, 42, 0.08);
}

.file-manager-panel__upload-meta {
  min-width: 0;
  flex: 0 1 320px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-manager-panel__upload-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: rgba(0, 0, 0, 0.72);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.file-manager-panel__upload-name {
  min-width: 0;
  color: rgba(0, 0, 0, 0.5);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-manager-panel__upload-progress {
  min-width: 120px;
  flex: 1;
}

.file-manager-panel__upload-size {
  min-width: 96px;
  color: rgba(0, 0, 0, 0.48);
  font-size: 12px;
  white-space: nowrap;
  text-align: right;
}

.file-manager-panel__upload-percent {
  min-width: 36px;
  color: rgba(0, 0, 0, 0.55);
  font-size: 12px;
  text-align: right;
}

.file-manager-panel__upload-percent.is-processing {
  min-width: 118px;
  color: rgba(0, 0, 0, 0.62);
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  white-space: nowrap;
}

.file-manager-panel__content {
  position: relative;
  flex: 1;
  min-height: 0;
  padding: 12px;
  overflow: auto;
  background:
    radial-gradient(circle at top left, rgba(22, 119, 255, 0.06), transparent 30%),
    linear-gradient(180deg, rgba(248, 251, 255, 0.72) 0%, rgba(255, 255, 255, 0.86) 100%);
}

.file-manager-panel__content.is-drag-active {
  background:
    radial-gradient(circle at top left, rgba(22, 119, 255, 0.12), transparent 32%),
    linear-gradient(180deg, rgba(240, 247, 255, 0.9) 0%, rgba(250, 253, 255, 0.96) 100%);
}

.file-manager-panel__spin {
  min-height: 100%;
}

.file-manager-panel__spin :deep(.ant-spin-container) {
  min-height: 100%;
}

.file-manager-panel__list {
  min-width: 980px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-manager-panel__list-head,
.file-manager-panel__row {
  display: grid;
  grid-template-columns: 38px minmax(260px, 2.4fr) minmax(140px, 1.2fr) 160px 96px minmax(180px, 1.4fr) 104px;
  gap: 10px;
  align-items: center;
}

.file-manager-panel__list-head {
  position: sticky;
  top: -12px;
  z-index: 1;
  min-height: 34px;
  padding: 0 10px;
  border-radius: 12px;
  background: rgba(247, 250, 254, 0.98);
  border: 1px solid rgba(15, 23, 42, 0.05);
  color: rgba(0, 0, 0, 0.42);
  font-size: 11px;
  font-weight: 600;
}

.file-manager-panel__list-cell,
.file-manager-panel__row-cell {
  min-width: 0;
}

.file-manager-panel__list-cell {
  display: inline-flex;
  align-items: center;
}

.file-manager-panel__list-cell--select,
.file-manager-panel__row-cell--select {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.file-manager-panel__list-cell--size {
  justify-content: flex-end;
}

.file-manager-panel__list-cell--actions {
  justify-content: flex-end;
}

.file-manager-panel__sort-btn {
  width: 100%;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: inherit;
  font-weight: inherit;
}

.file-manager-panel__sort-btn:hover,
.file-manager-panel__sort-btn.is-active {
  color: rgba(0, 0, 0, 0.68);
}

.file-manager-panel__sort-btn--align-end {
  justify-content: flex-end;
}

.file-manager-panel__sort-icons {
  display: inline-flex;
  flex-direction: column;
  gap: 1px;
  color: rgba(0, 0, 0, 0.18);
  font-size: 8px;
  line-height: 1;
}

.file-manager-panel__sort-icons .is-active {
  color: @primary-color;
}

.file-manager-panel__row {
  min-height: 44px;
  padding: 0 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(15, 23, 42, 0.06);
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.file-manager-panel__row:hover {
  border-color: rgba(22, 119, 255, 0.14);
  background: rgba(250, 252, 255, 0.98);
}

.file-manager-panel__row.is-selected {
  background: rgba(246, 250, 255, 0.98);
  border-color: rgba(22, 119, 255, 0.14);
}

.file-manager-panel__row.is-active {
  background: rgba(240, 247, 255, 0.98);
  border-color: rgba(22, 119, 255, 0.22);
  box-shadow: 0 6px 16px rgba(22, 119, 255, 0.08);
}

.file-manager-panel__row-cell--name {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.file-manager-panel__row-icon {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.06);
  color: rgba(15, 23, 42, 0.72);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  flex: 0 0 26px;
}

.file-manager-panel__row-icon.is-directory {
  background: rgba(245, 158, 11, 0.14);
  color: #c47b00;
}

.file-manager-panel__row-name,
.file-manager-panel__row-cell--kind,
.file-manager-panel__row-cell--time,
.file-manager-panel__row-cell--size {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-manager-panel__row-name {
  color: rgba(0, 0, 0, 0.84);
  font-size: 13px;
  font-weight: 500;
}

.file-manager-panel__row-cell--kind,
.file-manager-panel__row-cell--time,
.file-manager-panel__row-cell--size,
.file-manager-panel__row-cell--permission {
  color: rgba(0, 0, 0, 0.58);
  font-size: 12px;
}

.file-manager-panel__row-cell--size {
  text-align: right;
}

.file-manager-panel__row-cell--permission {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  overflow: hidden;
}

.file-manager-panel__row-permission-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.07);
  color: rgba(15, 23, 42, 0.72);
  font-size: 11px;
  white-space: nowrap;
}

.file-manager-panel__row-permission-badge.is-write {
  background: rgba(22, 163, 74, 0.12);
  color: #167e39;
}

.file-manager-panel__row-permission-code {
  min-width: 0;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-manager-panel__row-cell--actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}

.file-manager-panel__action-btn {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.06);
  color: rgba(0, 0, 0, 0.6);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.file-manager-panel__action-btn:hover {
  background: rgba(22, 119, 255, 0.12);
  color: @primary-color;
}

.file-manager-panel__action-btn:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}

.file-manager-panel__row-cell--select :deep(.ant-checkbox-wrapper),
.file-manager-panel__list-cell--select :deep(.ant-checkbox-wrapper) {
  line-height: 1;
}

.file-manager-panel__empty {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-manager-panel__empty-icon {
  font-size: 56px;
  color: rgba(22, 119, 255, 0.25);
}

.file-manager-panel__drop-mask {
  position: absolute;
  inset: 18px;
  border-radius: 24px;
  border: 2px dashed rgba(22, 119, 255, 0.42);
  background: rgba(240, 247, 255, 0.94);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  z-index: 2;
  pointer-events: none;
  text-align: center;
}

.file-manager-panel__drop-icon {
  font-size: 42px;
  color: @primary-color;
}

.file-manager-panel__drop-title {
  color: rgba(0, 0, 0, 0.88);
  font-size: 15px;
  font-weight: 600;
}

.file-manager-panel__drop-path {
  max-width: 80%;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-manager-panel__context-menu {
  position: absolute;
  z-index: 3;
  min-width: 156px;
  padding: 6px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.14);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-manager-panel__context-item {
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: rgba(0, 0, 0, 0.72);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
}

.file-manager-panel__context-item:hover:not(:disabled) {
  background: rgba(22, 119, 255, 0.08);
  color: @primary-color;
}

.file-manager-panel__context-item:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}

.file-manager-panel__status-bar {
  min-height: 38px;
  padding: 6px 12px;
  border-top: 1px solid #ebf0f5;
  background: #fbfcfe;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: rgba(0, 0, 0, 0.52);
  font-size: 12px;
}

.file-manager-panel__status-meta {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.file-manager-panel__status-selection {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

.file-manager-panel__status-selection-text {
  color: rgba(0, 0, 0, 0.72);
  font-weight: 600;
  margin-right: 6px;
}

.file-manager-panel__status-selection :deep(.ant-btn-link) {
  padding-left: 6px;
  padding-right: 6px;
}

.file-manager-panel__status-tip {
  color: rgba(0, 0, 0, 0.4);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-manager-panel__preview-spin {
  min-height: 320px;
}

.file-manager-panel__preview-spin :deep(.ant-spin-container) {
  min-height: 320px;
}

.file-manager-panel__preview {
  min-height: 320px;
}

.file-manager-panel__preview--image {
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-manager-panel__preview-image {
  max-width: 100%;
  max-height: 68vh;
  object-fit: contain;
  border-radius: 12px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
}

.file-manager-panel__preview-text {
  margin: 0;
  padding: 16px;
  max-height: 68vh;
  overflow: auto;
  border-radius: 14px;
  background: #f7f9fc;
  color: rgba(0, 0, 0, 0.78);
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.file-manager-panel__preview-empty {
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 1200px) {
  .file-manager-panel__chrome-row,
  .file-manager-panel__status-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .file-manager-panel__address {
    width: 100%;
  }

  .file-manager-panel__toolbar-actions {
    justify-content: flex-start;
  }

  .file-manager-panel__search {
    width: 100%;
    min-width: 0;
  }

  .file-manager-panel__upload-strip {
    flex-wrap: wrap;
    align-items: stretch;
  }

  .file-manager-panel__upload-meta {
    flex: 1 1 auto;
  }

  .file-manager-panel__upload-progress {
    width: 100%;
    min-width: 0;
    flex-basis: 100%;
  }

  .file-manager-panel__status-meta,
  .file-manager-panel__status-selection {
    flex-wrap: wrap;
    gap: 6px 10px;
  }

  .file-manager-panel__status-tip {
    width: 100%;
  }
}

@media (max-width: 768px) {
  .file-manager-panel {
    padding: 16px;
  }

  .file-manager-panel__workspace {
    border-radius: 20px;
  }

  .file-manager-panel__content {
    padding: 10px;
  }

  .file-manager-panel__list {
    min-width: 720px;
  }

  .file-manager-panel__list-head,
  .file-manager-panel__row {
    grid-template-columns: 38px minmax(220px, 2fr) minmax(120px, 1fr) 140px 84px 88px;
  }

  .file-manager-panel__list-cell--permission,
  .file-manager-panel__row-cell--permission {
    display: none;
  }
}
</style>
