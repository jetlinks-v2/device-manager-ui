<template>
  <DefineContent>
    <DetailMetaItem kind="tags" :label="$t('IotDeviceDetail.detail.tags')" multiline>
      <div class="device-tags">
        <div class="device-tags__row">
          <div ref="tagsListRef" class="device-tags__list" :class="{ 'is-expanded': tagsExpanded }">
            <span v-for="tag in state.thingModelTags" :key="getTagKey(tag)" class="device-tag" :class="{ 'device-tag--empty': editable && !filled(tag), 'device-tag--removable': editable && filled(tag) && state.canRemoveTag(tag) }">
              <InlineEditSurface :open="activeKey === getTagKey(tag) && editable" :label="getTagLabel(tag)">
                <template #display="{ contentId }">
                <a-button v-if="editable" type="text" class="device-tag__content" :disabled="savingTags" :aria-controls="contentId" :aria-expanded="activeKey === getTagKey(tag)" :aria-label="`${getTagLabel(tag)}: ${state.formatTagTooltipValueOnly(tag)}`" :title="state.formatTagTooltipValueOnly(tag)" @click="edit(tag)">
                  <AIcon v-if="!filled(tag)" type="PlusOutlined" aria-hidden="true" /><span class="device-tag__label">{{ getTagLabel(tag) }}</span><span v-if="filled(tag)" class="device-tag__value">{{ state.formatTagTooltipValueOnly(tag) }}</span>
                </a-button>
                <span v-else class="device-tag__content" :title="state.formatTagTooltipValueOnly(tag)"><span class="device-tag__label">{{ getTagLabel(tag) }}</span><span class="device-tag__value">{{ state.formatTagTooltipValueOnly(tag) }}</span></span>
                </template>
                <TagEditorForm v-if="draft && activeKey === getTagKey(tag)" :draft="draft" :saving="savingTags" :failed="failed" @update:value="draft.value = $event" @close="close" @save="save" />
              </InlineEditSurface>
              <a-button v-if="editable && filled(tag) && state.canRemoveTag(tag) && activeKey !== getTagKey(tag)" type="text" size="small" danger class="device-tag__remove" :disabled="savingTags" :aria-label="$t('IotDeviceDetail.tagEditor.remove', { name: getTagLabel(tag) })" @click.stop="remove(tag)"><AIcon type="CloseOutlined" /></a-button>
            </span>
          </div>
          <a-button v-if="tagsOverflow" type="text" size="small" class="device-tags__expand" @click="state.toggleTagsExpanded">{{ $t(tagsExpanded ? 'IotDeviceDetail.detail.collapseTags' : 'IotDeviceDetail.detail.expandTags') }}</a-button>
        </div>
        <div v-if="failed && !activeKey" role="alert" class="device-tags__error">{{ $t('IotDeviceDetail.tagEditor.removeFailed') }}</div>
      </div>
    </DetailMetaItem>
  </DefineContent>
  <InlineEditSurface :open="trigger && panelOpen" :label="$t('IotDeviceDetail.detail.tags')">
    <template v-if="trigger" #display="{ contentId }"><a-button :type="editable && !visibleTags.length ? 'dashed' : 'text'" size="small" class="device-tags__trigger" :disabled="savingTags" :aria-controls="contentId" :aria-expanded="panelOpen" @click="panelOpen = !panelOpen"><AIcon aria-hidden="true" :type="editable && !visibleTags.length ? 'PlusOutlined' : 'TagsOutlined'" />{{ $t(editable && !visibleTags.length ? 'IotDeviceDetail.header.setTags' : 'IotDeviceDetail.detail.tags') }}</a-button></template>
    <div class="device-tags__collection" :class="{ 'device-tags__collection--static': !trigger }" @keydown.esc.stop.prevent="closePanel"><TagContent /><a-button v-if="trigger" type="text" size="small" class="device-tags__close" :disabled="savingTags" :aria-label="$t('IotDeviceDetail.connection.close')" @click="closePanel"><AIcon type="CloseOutlined" /></a-button></div>
  </InlineEditSurface>
</template>
<script setup lang="ts">
import { computed, ref, toRefs } from 'vue'
import { createReusableTemplate } from '@vueuse/core'
import DetailMetaItem from '@jetlinks-web-core/components/DetailMetaItem'
import InlineEditSurface from '@jetlinks-web-core/components/InlineEditSurface'
import TagEditorForm from './TagEditorForm.vue'
import { getTagKey, getTagLabel, hasTagValue, type DeviceTag } from './tagEditor'
import { useTagEditor, type DeviceDetailTagsState } from './useTagEditor'
const props = withDefaults(defineProps<{ state: DeviceDetailTagsState; trigger?: boolean }>(), { trigger: false })
const { $t, tagsListRef, tagsExpanded, tagsOverflow, savingTags } = toRefs(props.state)
const editable = computed(() => props.state.canDeviceAction('update'))
const panelOpen = ref(false)
const [DefineContent, TagContent] = createReusableTemplate()
const { activeKey, draft, failed, visibleTags, edit, close, save, remove } = useTagEditor(() => props.state)
const filled = (tag: DeviceTag) => hasTagValue(tag.value ?? tag.formatValue)
const closePanel = () => { if (!savingTags.value) { close(); panelOpen.value = false } }
</script>
<style scoped>
.device-tags { min-width:0; }
.device-tags__row { display:flex; align-items:flex-start; gap:var(--space-2); min-width:0; }
.device-tags__list { display:flex; flex:0 1 auto; flex-wrap:wrap; gap:var(--space-1); min-width:0; max-height:1.625rem; overflow:hidden; }
.device-tags__list.is-expanded { max-height:none; }
.device-tag { position:relative; display:inline-flex; align-items:center; min-width:1rem; max-width:100%; height:1.625rem; border-radius:var(--r-2); background:var(--bg-sunken); }
.device-tag--empty { box-sizing:border-box; border:1px dashed var(--line-strong,var(--jet-theme-border)); background:transparent; }
.device-tag__content { display:inline-flex; align-items:center; gap:var(--space-1); min-width:0; max-width:100%; height:1.625rem; padding:0 var(--space-2); border:0; color:var(--jet-theme-text); font-size:var(--fs-12); line-height:1.625rem; }
.device-tag--removable .device-tag__content { padding-inline-end:28px; }
.device-tag__content.ant-btn:not(:disabled):is(:hover,:active) { background:transparent; }
.device-tag__content:focus-visible { outline:2px solid var(--jet-theme-primary); outline-offset:1px; }
.device-tag__label { flex:0 1 auto; min-width:0; max-width:12rem; overflow:hidden; color:var(--jet-theme-text-secondary); text-overflow:ellipsis; white-space:nowrap; }
.device-tag__value { min-width:0; overflow:hidden; color:var(--jet-theme-text); text-overflow:ellipsis; white-space:nowrap; }
.device-tag__content.ant-btn > span + span { margin-inline-start:0; }
.device-tag__remove.ant-btn { position:absolute; inset-inline-end:1px; top:50%; transform:translateY(-50%); width:24px; min-width:24px; height:24px; padding:0; color:var(--jet-theme-error); font-size:var(--fs-12); opacity:0; pointer-events:none; }
.device-tag:is(:hover,:focus-within) .device-tag__remove,.device-tag__remove:focus-visible { opacity:1; pointer-events:auto; }
.device-tag__remove.ant-btn:disabled { color:var(--jet-theme-text-disabled); }
.device-tags__expand { flex:none; }
.device-tags__trigger { height:24px; font-size:12px; color:var(--jet-theme-text-secondary); }
.device-tags__collection { display:flex; align-items:center; gap:8px; width:max-content; max-width:min(480px,calc(100vw - 64px)); }
.device-tags__collection--static { width:100%; max-width:100%; }
.device-tags__collection :deep(> .detail-meta-item) { flex:1 1 auto; min-width:0; width:auto; }
.device-tags__close { flex:none; width:24px; height:24px; padding:0; }
.device-tags__error { margin-top:var(--space-2); color:var(--jet-theme-error); font-size:var(--fs-12); }
@media (hover:none) { .device-tag .device-tag__remove.ant-btn { opacity:1; pointer-events:auto; } }
</style>
