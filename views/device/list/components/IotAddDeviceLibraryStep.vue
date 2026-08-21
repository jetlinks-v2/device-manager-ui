<template>
  <section class="add-device-library">
    <a-input-search
      v-model:value="keyword"
      class="add-device-library__search"
      allow-clear
      enter-button
      :placeholder="$t('IotDeviceList.add.librarySearch')"
      @search="handleKeywordSearch"
      @change="handleKeywordChange"
    />
    <div class="add-device-library__body" :class="{ 'has-tag-panel': showTagPanel }">
      <aside v-if="showTagPanel" class="add-device-library__tag-panel">
        <div class="add-device-library__tag-panel-head">
          <span>{{ $t('IotDeviceList.add.libraryTagFilter') }}</span>
          <a-button v-if="hasActiveTagFilter" type="link" size="small" @click="clearTagFilters">
            {{ $t('IotDeviceList.add.libraryTagClear') }}
          </a-button>
        </div>
        <div v-if="tagLoading" class="add-device-library__tag-loading">
          <a-spin size="small" />
          <span>{{ $t('IotDeviceList.add.libraryTagLoading') }}</span>
        </div>
        <template v-else>
          <IotAddDeviceLibraryTagFilterRow
            v-for="group in visibleTagFilterGroups"
            :key="group.id"
            :group="group"
            :active-tag-ids="activeTagIds"
            @toggle-tag="toggleTagFilter"
          />
          <a-button
            v-if="hasHiddenTagFilterGroups"
            class="add-device-library__tag-panel-toggle"
            type="link"
            size="small"
            @click="tagGroupsExpanded = !tagGroupsExpanded"
          >
            {{ tagGroupsExpanded ? $t('IotDeviceList.add.libraryTagCollapseGroups') : $t('IotDeviceList.add.libraryTagExpandGroups') }}
            <AIcon :type="tagGroupsExpanded ? 'UpOutlined' : 'DownOutlined'" />
          </a-button>
        </template>
      </aside>

      <div class="add-device-library__content">
        <a-spin :spinning="loading">
          <div v-if="templates.length" class="add-device-library__grid">
            <IotAddDeviceLibraryCard
              v-for="template in templates"
              :key="template.id"
              :template="template"
              :selected="template.id === selectedTemplateKey"
              :disabled="isTemplateDisabled(template)"
              @select="$emit('select-template', $event)"
            />
          </div>

          <CloudEmpty
            v-else
            class="add-device-library__empty"
            :description="$t('IotDeviceList.add.libraryEmpty')"
          />

          <div v-if="templates.length" class="add-device-library__pager">
            <span>{{ $t('IotDeviceList.add.libraryTotal', { total }) }}</span>
            <a-pagination
              v-model:current="page"
              size="small"
              :total="total"
              :page-size="pageSize"
              :show-size-changer="false"
              show-less-items
            />
          </div>
        </a-spin>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  normalizeDeviceTypeValue,
  type IotDeviceLibraryTagGroup,
  type IotDeviceProductTemplate,
} from '@device-manager-ui/api/device'
import IotAddDeviceLibraryCard from './IotAddDeviceLibraryCard.vue'
import IotAddDeviceLibraryTagFilterRow from './IotAddDeviceLibraryTagFilterRow.vue'

const COLLAPSED_TAG_GROUP_COUNT = 5

const props = defineProps({
  templates: { type: Array as PropType<IotDeviceProductTemplate[]>, required: true },
  selectedTemplateKey: { type: String, required: true },
  selectableDeviceType: { type: String, default: '' },
  tagFilterGroups: { type: Array as PropType<IotDeviceLibraryTagGroup[]>, default: () => [] },
  total: { type: Number, default: 0 },
  pageIndex: { type: Number, default: 0 },
  pageSize: { type: Number, default: 6 },
  loading: { type: Boolean, default: false },
  tagLoading: { type: Boolean, default: false },
})

const emit = defineEmits<{
  (e: 'select-template', templateId: string): void
  (e: 'query-change', query: { pageIndex: number; pageSize: number; keyword: string; tags: string[] }): void
}>()

const { t: $t } = useI18n()
const keyword = ref('')
const submittedKeyword = ref('')
const activeTagIds = ref<string[]>([])
const page = ref(props.pageIndex + 1)
const tagGroupsExpanded = ref(false)

const showTagPanel = computed(() => props.tagLoading || props.tagFilterGroups.length || activeTagIds.value.length)
const hasActiveTagFilter = computed(() => activeTagIds.value.length > 0)
const visibleTagFilterGroups = computed(() => (
  tagGroupsExpanded.value ? props.tagFilterGroups : props.tagFilterGroups.slice(0, COLLAPSED_TAG_GROUP_COUNT)
))
const hasHiddenTagFilterGroups = computed(() => props.tagFilterGroups.length > COLLAPSED_TAG_GROUP_COUNT)

function handleKeywordSearch(value = keyword.value) {
  submittedKeyword.value = value.trim()
  updatePageAndQuery(1)
}

function handleKeywordChange(event: Event) {
  const value = (event.target as HTMLInputElement | null)?.value ?? ''
  if (!value && submittedKeyword.value) handleKeywordSearch('')
}

function toggleTagFilter(tagId: string) {
  const isSelected = activeTagIds.value.includes(tagId)
  if (!isSelected && props.tagFilterGroups.slice(COLLAPSED_TAG_GROUP_COUNT).some((group) => (
    group.tags.some((tag) => tag.id === tagId)
  ))) {
    tagGroupsExpanded.value = true
  }
  activeTagIds.value = isSelected
    ? activeTagIds.value.filter((item) => item !== tagId)
    : [...activeTagIds.value, tagId]
  updatePageAndQuery(1)
}

function clearTagFilters() {
  activeTagIds.value = []
  updatePageAndQuery(1)
}

function updatePageAndQuery(nextPage: number) {
  if (page.value !== nextPage) {
    page.value = nextPage
    return
  }
  emitQuery()
}

function emitQuery() {
  emit('query-change', {
    pageIndex: Math.max(0, page.value - 1),
    pageSize: props.pageSize,
    keyword: submittedKeyword.value,
    tags: [...activeTagIds.value],
  })
}

function isTemplateDisabled(template: IotDeviceProductTemplate) {
  return Boolean(
    props.selectableDeviceType
    && normalizeDeviceTypeValue(template.deviceType) !== normalizeDeviceTypeValue(props.selectableDeviceType),
  )
}

watch(page, () => emitQuery())
watch(
  () => props.pageIndex,
  (value) => {
    const nextPage = value + 1
    if (page.value !== nextPage) page.value = nextPage
  },
)
watch(() => props.tagFilterGroups, () => {
  tagGroupsExpanded.value = false
}, { deep: true })
</script>

<style scoped src="./IotAddDeviceDrawer.css"></style>
