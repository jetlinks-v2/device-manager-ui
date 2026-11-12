<template>
  <DetailMetaItem kind="tags" :label="$t('IotDeviceDetail.detail.tags')" multiline>
    <div class="device-tags">
      <div class="device-tags__row">
        <div ref="tagsListRef" class="device-tags__list" :class="{ 'is-expanded': tagsExpanded }">
          <span v-for="tag in visibleTags" :key="getTagKey(tag)" class="device-tag">
            <a-popover :open="activeKey === getTagKey(tag) && !adding && editable" :trigger="[]" placement="bottomLeft">
              <template #title>
                <div class="device-tag__editor-title" :title="getTagLabel(tag)">{{ getTagLabel(tag) }}</div>
              </template>
              <template #content>
                <TagEditorForm v-if="draft && activeKey === getTagKey(tag) && !adding" :draft="draft" :saving="savingTags" :failed="failed"
                  @update:value="draft.value = $event" @close="close" @save="save" />
              </template>
              <a-button v-if="editable" type="text" class="device-tag__content" :disabled="savingTags"
                :title="state.formatTagTooltipValueOnly(tag)" @click="edit(tag)">
                <span class="device-tag__label">{{ getTagLabel(tag) }}</span>
                <span class="device-tag__value">{{ state.formatTagTooltipValueOnly(tag) }}</span>
              </a-button>
              <span v-else class="device-tag__content" :title="state.formatTagTooltipValueOnly(tag)">
                <span class="device-tag__label">{{ getTagLabel(tag) }}</span>
                <span class="device-tag__value">{{ state.formatTagTooltipValueOnly(tag) }}</span>
              </span>
            </a-popover>
            <a-button v-if="editable && state.canRemoveTag(tag)" type="text" size="small" danger class="device-tag__remove"
              :disabled="savingTags" :aria-label="$t('IotDeviceDetail.tagEditor.remove', { name: getTagLabel(tag) })"
              @click.stop="remove(tag)"><AIcon type="CloseOutlined" /></a-button>
          </span>
        </div>
        <a-button v-if="tagsOverflow" type="text" size="small" class="device-tags__expand" @click="state.toggleTagsExpanded">
          {{ $t(tagsExpanded ? 'IotDeviceDetail.detail.collapseTags' : 'IotDeviceDetail.detail.expandTags') }}
        </a-button>
        <a-popover v-if="editable" :open="adding && !!draft" :trigger="[]" placement="bottomLeft">
          <template #title>
            <div v-if="draft" class="device-tag__editor-title" :title="getTagLabel(draft)">{{ getTagLabel(draft) }}</div>
          </template>
          <template #content>
            <TagEditorForm v-if="draft && adding" :draft="draft" :saving="savingTags" :failed="failed"
              @update:value="draft.value = $event" @close="close" @save="save" />
          </template>
          <a-dropdown :open="menuOpen" :trigger="['click']" placement="bottomLeft"
            :disabled="savingTags || !availableTags.length" @open-change="setMenuOpen">
            <template #overlay>
              <a-menu :selectable="false" class="device-tags__menu">
                <a-menu-item v-for="tag in availableTags" :key="getTagKey(tag)" @click="add(tag)">
                  <span :title="getTagLabel(tag)">{{ getTagLabel(tag) }}</span>
                </a-menu-item>
              </a-menu>
            </template>
            <a-button size="small" :disabled="savingTags || !availableTags.length" class="device-tags__add">
              <template #icon><AIcon type="PlusOutlined" /></template>{{ $t('IotDeviceDetail.detail.tags') }}
            </a-button>
          </a-dropdown>
        </a-popover>
      </div>
      <div v-if="failed && !activeKey" role="alert" class="device-tags__error">{{ $t('IotDeviceDetail.tagEditor.removeFailed') }}</div>
    </div>
  </DetailMetaItem>
</template>

<script setup lang="ts">
import { computed, toRefs } from 'vue'
import DetailMetaItem from '@jetlinks-web-core/components/DetailMetaItem'
import type { IotDeviceDetailViewState } from '../../../hooks/useIotDeviceDetailView'
import TagEditorForm from './TagEditorForm.vue'
import { getTagKey, getTagLabel } from './tagEditor'
import { useTagEditor } from './useTagEditor'

type TagState = Pick<IotDeviceDetailViewState, '$t' | 'thingModelTags' | 'tagsListRef' | 'tagsExpanded' | 'tagsOverflow' |
  'savingTags' | 'canDeviceAction' | 'canRemoveTag' | 'removeTag' | 'saveTags' |
  'formatTagTooltipValueOnly' | 'toggleTagsExpanded'>
const props = defineProps<{ state: TagState }>()
const { $t, tagsListRef, tagsExpanded, tagsOverflow, savingTags } = toRefs(props.state)
const editable = computed(() => props.state.canDeviceAction('update'))
// 显式保存/取消控制弹层，地图、日期等传送到 body 的浮层不会误关编辑器。
const { activeKey, draft, failed, adding, menuOpen, visibleTags, availableTags, setMenuOpen, add, edit, close, save, remove } = useTagEditor(() => props.state)
</script>

<style scoped>
.device-tags { min-width: 0; }
.device-tags__row { display: flex; align-items: flex-start; gap: var(--space-2); min-width: 0; }
.device-tags__list { display: flex; flex: 0 1 auto; flex-wrap: wrap; gap: var(--space-1); min-width: 0; max-height: 1.625rem; overflow: hidden; }
.device-tags__list.is-expanded { max-height: none; }
.device-tag { position: relative; display: inline-flex; align-items: center; min-width: 1rem; max-width: 100%; height: 1.625rem; border-radius: var(--r-2); background: var(--bg-sunken); }
.device-tag__content { display: inline-flex; align-items: center; gap: var(--space-1); min-width: 0; max-width: 100%; height: 1.625rem; padding: 0 var(--space-2); border: 0; color: var(--jet-theme-text); font-size: var(--fs-12); line-height: 1.625rem; }
.device-tag__content.ant-btn:not(:disabled):is(:hover, :active) { background: transparent; }
.device-tag__label { flex: 0 1 auto; min-width: 0; max-width: 12rem; overflow: hidden; color: var(--jet-theme-text-secondary); text-overflow: ellipsis; white-space: nowrap; }
.device-tag__value { min-width: 0; overflow: hidden; color: var(--jet-theme-text); text-overflow: ellipsis; white-space: nowrap; }
.device-tag__editor-title { width: min(17rem, calc(100vw - 4rem)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.device-tag__content.ant-btn > span + span { margin-inline-start: 0; }
.device-tag__remove.ant-btn { position: absolute; inset-inline-end: 0; top: 50%; z-index: 1; transform: translateY(-50%); width: 1.25rem; min-width: 0; height: 1.25rem; padding: 0; color: var(--jet-theme-error); font-size: var(--fs-12); opacity: 0; visibility: hidden; pointer-events: none; -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); }
.device-tag__remove.ant-btn,
.device-tag__remove.ant-btn:not(:disabled):is(:hover, :active, :focus-visible) { color: var(--jet-theme-error); background: transparent; }
.device-tag:hover .device-tag__remove { opacity: 1; visibility: visible; pointer-events: auto; }
.device-tag__remove.ant-btn:disabled { color: var(--jet-theme-text-disabled); }
.device-tags__expand, .device-tags__add { flex: none; }
.device-tags__menu { width: 10rem; max-height: min(20rem, 60vh); overflow-y: auto; }
.device-tags__menu :deep(.ant-dropdown-menu-title-content) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.device-tags__error { margin-top: var(--space-2); color: var(--jet-theme-error); font-size: var(--fs-12); }
</style>
