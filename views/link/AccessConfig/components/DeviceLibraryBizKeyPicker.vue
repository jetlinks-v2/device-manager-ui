<template>
  <a-form-item v-if="available" name="bizKey" :label="label">
    <a-space class="biz-key-picker" :size="8">
      <a-input class="biz-key-picker__input" :value="modelValue" readonly :placeholder="placeholder" />
      <a-button @click="openPicker">{{ selectText }}</a-button>
    </a-space>
  </a-form-item>

  <a-modal
    v-model:open="visible"
    :title="dialogTitle"
    width="960px"
    :mask-closable="false"
    :ok-button-props="{ disabled: !selectedTemplateKey }"
    @ok="confirm"
    @cancel="visible = false"
  >
    <IotAddDeviceLibraryStep
      :templates="templates as any"
      :selected-template-key="selectedTemplateKey"
      :tag-filter-groups="tagGroups"
      :has-more="hasMore"
      :page-index="pageIndex"
      :page-size="pageSize"
      :loading="loading"
      :tag-loading="tagLoading"
      show-empty-pager
      @select-template="selectedTemplateKey = $event"
      @query-change="loadTemplates"
    />
  </a-modal>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  probeDeviceLibraryCapability_api,
  queryDeviceLibraryTags_api,
  queryDeviceLibraryTemplates_api,
} from '@device-manager-ui/api/device-library'
import type { DeviceLibraryTemplateQueryInput, DeviceTemplateProductInput, IotDeviceLibraryTagGroup } from '@device-manager-ui/api/device-library/types'
import IotAddDeviceLibraryStep from '@device-manager-ui/views/device/list/components/IotAddDeviceLibraryStep.vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  provider: { type: String, required: true },
})

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()
const { t } = useI18n()
const visible = ref(false)
const available = ref(false)
const loading = ref(false)
const tagLoading = ref(false)
const templates = ref<DeviceTemplateProductInput[]>([])
const tagGroups = ref<IotDeviceLibraryTagGroup[]>([])
const selectedTemplateKey = ref('')
const pageIndex = ref(0)
const pageSize = ref(6)
const hasMore = ref(false)

const label = computed(() => t('AccessConfig.bizKey.label'))
const placeholder = computed(() => t('AccessConfig.bizKey.placeholder'))
const selectText = computed(() => t('AccessConfig.bizKey.select'))
const dialogTitle = computed(() => t('AccessConfig.bizKey.dialogTitle'))

async function loadTags() {
  tagLoading.value = true
  try {
    tagGroups.value = await queryDeviceLibraryTags_api()
  } catch {
    tagGroups.value = []
  } finally {
    tagLoading.value = false
  }
}

async function loadTemplates(query: DeviceLibraryTemplateQueryInput = {}) {
  loading.value = true
  try {
    const result = await queryDeviceLibraryTemplates_api({
      pageIndex: query.pageIndex ?? pageIndex.value,
      pageSize: query.pageSize ?? pageSize.value,
      keyword: query.keyword,
      tags: query.tags,
    })
    pageIndex.value = result.pageIndex
    pageSize.value = result.pageSize
    hasMore.value = result.hasMore
    templates.value = result.data.filter((template) => (
      template.accessProvider === props.provider && Boolean(template.gatewayBizKey?.trim())
    ))
  } catch {
    templates.value = []
    hasMore.value = false
  } finally {
    loading.value = false
  }
}

function openPicker() {
  selectedTemplateKey.value = ''
  visible.value = true
  void loadTemplates({ pageIndex: 0, pageSize: pageSize.value })
}

function confirm() {
  const selected = templates.value.find((template) => template.id === selectedTemplateKey.value)
  if (!selected?.gatewayBizKey) return
  emit('update:modelValue', selected.gatewayBizKey)
  visible.value = false
}

onMounted(async () => {
  try {
    await probeDeviceLibraryCapability_api()
    available.value = true
    void loadTags()
  } catch {
    // 未部署或不可访问设备库时隐藏入口，已有业务标识仍由父表单原样保存。
    available.value = false
  }
})
</script>

<style scoped lang="less">
.biz-key-picker {
  width: 100%;

  &__input {
    width: 240px;
  }
}
</style>
