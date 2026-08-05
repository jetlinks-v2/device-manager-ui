<template>
  <div class="card-container">
    <config-item :label="$t('CustomImageCard.Config.100006-0')">
      <a-input
        v-model:value="config.topTitle"
        :maxlength="64"
        :placeholder="$t('CustomImageCard.Config.100006-1')"
        @change="onChange"
      />
    </config-item>

    <config-item :label="$t('CustomImageCard.Config.100006-2')">
      <a-input
        v-model:value="config.bottomLeftTitle"
        :maxlength="64"
        :placeholder="$t('CustomImageCard.Config.100006-3')"
        @change="onChange"
      />
    </config-item>

    <config-item :label="$t('CustomImageCard.Config.100006-4')">
      <a-select
        v-model:value="config.bottomLeftStatus"
        :options="statusOptions"
        :placeholder="$t('CustomImageCard.Config.100006-5')"
        popupClassName="is-dark"
        style="width: 100%"
        @change="onChange"
      />
    </config-item>

    <config-item :label="$t('CustomImageCard.Config.100006-6')">
      <a-input
        v-model:value="config.bottomRightTitle"
        :maxlength="64"
        :placeholder="$t('CustomImageCard.Config.100006-7')"
        @change="onChange"
      />
    </config-item>

    <config-item :label="$t('CustomImageCard.Config.100006-8')">
      <a-select
        v-model:value="config.bottomRightStatus"
        :options="statusOptions"
        :placeholder="$t('CustomImageCard.Config.100006-9')"
        popupClassName="is-dark"
        style="width: 100%"
        @change="onChange"
      />
    </config-item>

    <config-item :label="$t('CustomImageCard.Config.100006-10')">
      <a-input
        v-model:value="config.tooltip"
        :maxlength="64"
        :placeholder="$t('CustomImageCard.Config.100006-11')"
        @change="onChange"
      />
    </config-item>

    <config-item :label="$t('CustomImageCard.Config.100006-12')">
      <a-select
        v-model:value="config.imageChannel"
        :options="imageChannelOptions"
        popupClassName="is-dark"
        style="width: 100%"
        @change="handleImageChannelChange"
      ></a-select>
    </config-item>

    <config-item :label="$t('CustomImageCard.Config.100006-13')">
      <a-input
        v-if="config.imageChannel === 'network'"
        v-model:value="config.img"
        :placeholder="$t('CustomImageCard.Config.100006-14')"
        @change="onChange"
      />
      <div
        v-else
        style="height: 100px; width: 100px"
      >
        <ImageUpload
          v-model:value="config.img"
          :noCropper="true"
          :types="['image/jpg', 'image/png', 'image/jpeg']"
          accept=".jpeg,.png,.pjp,.pjpeg,.jpg"
          @change="onChange"
        />
      </div>
    </config-item>
  </div>
</template>
<script lang="ts" name="CustomImageCard" setup>
import { cloneDeep } from 'lodash-es'
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import { useI18n } from 'vue-i18n'

const { t: $t } = useI18n()

const props = defineProps({
  configData: {
    type: Object,
    default: () => ({})
  }
})

const { ImageUpload } = moduleRegistry.getResource('visualization-manager-ui', 'components')
const { ConfigItem } = moduleRegistry.getResource('visualization-designer-ui', 'components')

const emits = defineEmits(['change'])
const config = ref<any>({})

const imageChannelOptions = computed(() => [
  {
    value: 'network',
    label: $t('CustomImageCard.Config.100006-15')
  },
  {
    value: 'local',
    label: $t('CustomImageCard.Config.100006-16')
  }
])
const statusOptions = computed(() => [
  {
    value: 'disabled',
    label: $t('CustomImageCard.Config.100006-17')
  },
  {
    value: 'default',
    label: $t('CustomImageCard.Config.100006-18')
  },
  {
    value: 'error',
    label: $t('CustomImageCard.Config.100006-19')
  },
  {
    value: 'success',
    label: $t('CustomImageCard.Config.100006-20')
  },
  {
    value: 'warning',
    label: $t('CustomImageCard.Config.100006-21')
  },
  {
    value: 'processing',
    label: $t('CustomImageCard.Config.100006-22')
  }
])

const onChange = () => {
  emits('change', config.value, 'customImageCard')
}

const handleImageChannelChange = () => {
  config.value.img = ''
  onChange()
}

watch(
  () => props.configData?.componentProps?.customImageCard,
  (newVal) => {
    if (newVal) {
      config.value = cloneDeep(newVal)
      // 初始化图片渠道，如果img是网络地址则设为network，否则为local
      if (!config.value.imageChannel) {
        config.value.imageChannel = config.value.img?.startsWith('http') ? 'network' : 'local'
      }
    }
  },
  { deep: true, immediate: true }
)
</script>
<style lang="less" scoped>
.card-container {
  color: #fff;
  gap: 12px;
  display: flex;
  flex-direction: column;

  .card-container-row {
    display: flex;
  }
}
</style>
