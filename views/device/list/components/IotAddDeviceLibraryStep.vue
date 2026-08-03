<template>
  <section class="add-device-library">
    <div class="add-device-library__head">
      <a-button @click="$emit('custom')">
        <template #icon>
          <AIcon type="EditOutlined" aria-hidden="true" />
        </template>
        {{ $t('IotDeviceList.add.customAdd') }}
      </a-button>
    </div>

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
          <div v-for="group in tagFilterGroups" :key="group.id" class="add-device-library__tag-row">
            <span>{{ group.name }}</span>
            <button
              v-for="option in group.tags"
              :key="option.id"
              type="button"
              class="add-device-library__tag-option"
              :class="{ 'is-active': activeTagIds.includes(option.id) }"
              @click="toggleTagFilter(option.id)"
            >
              {{ option.name }}
            </button>
          </div>
        </template>
      </aside>

      <div class="add-device-library__content">
        <a-input-search
          class="add-device-library__search"
          v-model:value="keyword"
          allow-clear
          enter-button
          :placeholder="$t('IotDeviceList.add.librarySearch')"
          @search="handleKeywordSearch"
          @change="handleKeywordChange"
        />

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

const props = defineProps({
  templates: { type: Array as PropType<IotDeviceProductTemplate[]>, required: true },
  selectedTemplateKey: { type: String, required: true },
  selectableDeviceType: { type: String, default: '' },
  tagFilterGroups: { type: Array as PropType<IotDeviceLibraryTagGroup[]>, default: () => [] },
  total: { type: Number, default: 0 },
  pageIndex: { type: Number, default: 0 },
  pageSize: { type: Number, default: 4 },
  loading: { type: Boolean, default: false },
  tagLoading: { type: Boolean, default: false },
})

const emit = defineEmits<{
  (e: 'select-template', templateId: string): void
  (e: 'custom'): void
  (e: 'query-change', query: { pageIndex: number; pageSize: number; keyword: string; tags: string[] }): void
}>()

const { t: $t } = useI18n()
const keyword = ref('')
const submittedKeyword = ref('')
const activeTagIds = ref<string[]>([])
const page = ref(props.pageIndex + 1)

const showTagPanel = computed(() => props.tagLoading || props.tagFilterGroups.length || activeTagIds.value.length)
const hasActiveTagFilter = computed(() => activeTagIds.value.length > 0)

function handleKeywordSearch(value = keyword.value) {
  submittedKeyword.value = value.trim()
  updatePageAndQuery(1)
}

function handleKeywordChange(event: Event) {
  const value = (event.target as HTMLInputElement | null)?.value ?? ''
  if (!value && submittedKeyword.value) handleKeywordSearch('')
}

function toggleTagFilter(tagId: string) {
  activeTagIds.value = activeTagIds.value.includes(tagId)
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
</script>

<style scoped src="./IotAddDeviceDrawer.css"></style>
