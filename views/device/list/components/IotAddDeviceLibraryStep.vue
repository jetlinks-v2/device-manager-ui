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
        <!-- 当前 ProTable 的 CARD 模式仅展示内部请求 loading，受控数据由外层 Spin 承载。 -->
        <a-spin :spinning="loading">
          <j-pro-table
            class="add-device-library__table"
            mode="CARD"
            type="PAGE"
            row-key="id"
            :data-source="templates"
            :grid-columns="[2, 3, 3, 3]"
            :alert-show="false"
            :body-style="{ padding: 0 }"
            :scroll="false"
          >
            <template #card="template">
              <IotAddDeviceLibraryCard
                :template="template"
                :selected="template.id === selectedTemplateKey"
                :disabled="isTemplateDisabled(template)"
                @select="$emit('select-template', $event)"
              />
            </template>
            <template #emptyText>
              <CloudEmpty
                class="add-device-library__empty"
                :description="$t('IotDeviceList.add.libraryEmpty')"
              />
            </template>
          </j-pro-table>
        </a-spin>

        <!-- 无总数接口保留前后翻页；二次筛选产生空页时仍可继续查找。 -->
<!--        <div v-if="templates.length || (showEmptyPager && hasMore)" class="add-device-library__pager">-->
<!--          <a-space>-->
<!--            <a-tooltip :title="$t('IotDeviceList.add.prev')">-->
<!--              <a-button-->
<!--                type="text"-->
<!--                size="small"-->
<!--                :aria-label="$t('IotDeviceList.add.prev')"-->
<!--                :disabled="loading || pageIndex === 0"-->
<!--                @click="changePage(pageIndex - 1)"-->
<!--              >-->
<!--                <template #icon><AIcon type="LeftOutlined" /></template>-->
<!--              </a-button>-->
<!--            </a-tooltip>-->
<!--            <span>{{ pageIndex + 1 }}</span>-->
<!--            <a-tooltip :title="$t('IotDeviceList.add.next')">-->
<!--              <a-button-->
<!--                type="text"-->
<!--                size="small"-->
<!--                :aria-label="$t('IotDeviceList.add.next')"-->
<!--                :disabled="loading || !hasMore"-->
<!--                @click="changePage(pageIndex + 1)"-->
<!--              >-->
<!--                <template #icon><AIcon type="RightOutlined" /></template>-->
<!--              </a-button>-->
<!--            </a-tooltip>-->
<!--          </a-space>-->
<!--        </div>-->
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  type IotDeviceLibraryTagGroup,
  type IotDeviceProductTemplate,
} from '@device-manager-ui/api/device'
import IotAddDeviceLibraryCard from './IotAddDeviceLibraryCard.vue'
import IotAddDeviceLibraryTagFilterRow from './IotAddDeviceLibraryTagFilterRow.vue'

import { useDeviceLibrarySelection, type DeviceLibrarySelectionQuery } from '../hooks/device-library/useDeviceLibrarySelection'

const props = defineProps({
  templates: { type: Array as PropType<IotDeviceProductTemplate[]>, required: true },
  selectedTemplateKey: { type: String, required: true },
  selectableDeviceType: { type: String, default: '' },
  tagFilterGroups: { type: Array as PropType<IotDeviceLibraryTagGroup[]>, default: () => [] },
  hasMore: { type: Boolean, default: false },
  pageIndex: { type: Number, default: 0 },
  pageSize: { type: Number, default: 6 },
  loading: { type: Boolean, default: false },
  tagLoading: { type: Boolean, default: false },
  /** 资源被调用方二次筛选时，空页仍需保留继续翻页入口。 */
  showEmptyPager: { type: Boolean, default: false },
})

const emit = defineEmits<{
  (e: 'select-template', templateId: string): void
  (e: 'query-change', query: DeviceLibrarySelectionQuery): void
}>()

const { t: $t } = useI18n()
const {
  keyword, activeTagIds, tagGroupsExpanded, showTagPanel, hasActiveTagFilter,
  visibleTagFilterGroups, hasHiddenTagFilterGroups, handleKeywordSearch,
  handleKeywordChange, toggleTagFilter, clearTagFilters, changePage, isTemplateDisabled,
} = useDeviceLibrarySelection(props, (query) => emit('query-change', query))
</script>

<style scoped src="./IotAddDeviceDrawer.css"></style>
