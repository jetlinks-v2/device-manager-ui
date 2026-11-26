import { computed, ref } from 'vue'
import { createTagDraft, getTagKey, hasTagValue, serializeTagDraft, type DeviceTag } from './tagEditor'

interface TagActions {
  thingModelTags: DeviceTag[]
  savingTags: boolean
  canDeviceAction: (action: 'update') => boolean
  saveTags: (tags: DeviceTag[]) => Promise<boolean>
  removeTag: (tag: DeviceTag) => Promise<boolean>
}

/** 单项编辑只维护草稿和弹层；持久化及设备切换保护交给详情宿主。 */
export function useTagEditor(state: () => TagActions) {
  const activeKey = ref('')
  const draft = ref<DeviceTag>()
  const failed = ref(false)
  const adding = ref(false)
  const menuOpen = ref(false)
  const visibleTags = computed(() => state().thingModelTags.filter(tag => hasTagValue(tag.value ?? tag.formatValue)))
  // 与已展示标签使用同一判空规则，0 和 false 都属于已填写值。
  const availableTags = computed(() => state().thingModelTags.filter(tag => !hasTagValue(tag.value ?? tag.formatValue)))
  const allowed = () => state().canDeviceAction('update') && !state().savingTags

  function edit(tag: DeviceTag) {
    if (!allowed()) return
    menuOpen.value = false
    adding.value = false
    draft.value = createTagDraft(tag)
    activeKey.value = getTagKey(tag)
    failed.value = false
  }

  function close() {
    if (state().savingTags) return
    adding.value = false
    activeKey.value = ''
    draft.value = undefined
    failed.value = false
  }

  function setMenuOpen(open: boolean) {
    if (open && (!allowed() || !availableTags.value.length)) return
    if (open) close()
    menuOpen.value = open
  }

  function add(tag: DeviceTag) {
    if (!allowed() || !availableTags.value.some(item => getTagKey(item) === getTagKey(tag))) return
    edit(tag)
    adding.value = true
  }

  async function save() {
    if (!draft.value || !allowed()) return
    failed.value = false
    try {
      if (await state().saveTags([serializeTagDraft(draft.value)])) close()
      else failed.value = true
    } catch {
      // 保存失败保持弹层和草稿，允许再次保存。
      failed.value = true
    }
  }

  async function remove(tag: DeviceTag) {
    if (!allowed()) return
    failed.value = false
    try {
      if (await state().removeTag(tag)) close()
      else failed.value = true
    } catch {
      failed.value = true
    }
  }

  return { activeKey, draft, failed, adding, menuOpen, visibleTags, availableTags, setMenuOpen, add, edit, close, save, remove }
}
